import "server-only";
import type { Store } from "../store";
import type { DB } from "../../supabase/server";
import { adminClient } from "../../supabase/server";
import { TABLES, type Aux, type Row, type TableSpec } from "./tables";
import { PUB } from "./load";

/*
 * Writes back what a data function changed in the loaded slice: inserts, changed columns
 * only, and deletes. Every write goes through the person's own access (RLS); an update
 * the database refuses shows up as "no rows changed" and becomes an error here. The email
 * outbox is the one exception: it's written with the server key, and only ever inserted.
 */

export class SyncError extends Error {}

const keyOf = (spec: TableSpec, row: Row) => spec.pk.map((c) => String(row[c])).join("|");
const isPub = (spec: TableSpec, row: Row) => spec.pk.some((c) => String(row[c] ?? "").startsWith(PUB));
const pkMatch = (spec: TableSpec, row: Row) => Object.fromEntries(spec.pk.map((c) => [c, row[c]]));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function friendly(table: string, msg: string) {
  console.error(`[live sync] ${table}: ${msg}`);
  if (/row-level security|permission denied|insufficient_privilege/i.test(msg)) return "You don't have permission to do that.";
  if (/duplicate key/i.test(msg)) return "That's already been saved.";
  if (/violates check constraint/i.test(msg)) return "Something in that isn't allowed. Check it and try again.";
  return `Couldn't save (${table}): ${msg}`;
}

export async function syncChanges(sb: DB, before: Store, after: Store, aux: Aux) {
  const inserts: [TableSpec, Row][] = [];
  const updates: [TableSpec, Row, Row][] = [];
  const deletes: [TableSpec, Row][] = [];
  const pollInserts: { messageId: string; options: string[] }[] = [];
  const recipientInserts: { messageId: string; ids: string[] }[] = [];
  const linkUpdates: { teamId: string; needsApproval: boolean }[] = [];

  for (const spec of TABLES) {
    if (spec.readOnly) continue;
    const prev = new Map<string, Row>();
    for (const o of before[spec.key] as unknown[]) {
      const r = spec.toDb(o as never, aux);
      if (!isPub(spec, r)) prev.set(keyOf(spec, r), r);
    }
    const seen = new Set<string>();
    for (const o of after[spec.key] as unknown[]) {
      const r = spec.toDb(o as never, aux);
      if (isPub(spec, r)) continue;
      const k = keyOf(spec, r);
      seen.add(k);
      const old = prev.get(k);
      if (!old) {
        inserts.push([spec, r]);
        if (spec.key === "chat") {
          const poll = (o as Store["chat"][number]).poll;
          if (poll) pollInserts.push({ messageId: String(r.id), options: poll.options });
        }
        if (spec.key === "messages") recipientInserts.push({ messageId: String(r.id), ids: (o as Store["messages"][number]).recipientIds });
        continue;
      }
      const changed: Row = {};
      for (const c of Object.keys(r)) if (!spec.pk.includes(c) && !same(r[c], old[c])) changed[c] = r[c];
      if (spec.key === "chat" && "pinned_at" in changed && old.pinned_at && r.pinned_at) delete changed.pinned_at;
      if (Object.keys(changed).length) updates.push([spec, r, changed]);
      if (spec.key === "teams") {
        const a = (before.teams.find((x) => x.id === r.id)?.settings.linkNeedsApproval ?? false) as boolean;
        const b = !!(o as Store["teams"][number]).settings.linkNeedsApproval;
        if (a !== b) linkUpdates.push({ teamId: String(r.id), needsApproval: b });
      }
    }
    if (spec.admin) continue; // outbox: insert-only
    for (const [k, r] of prev) if (!seen.has(k)) deletes.push([spec, r]);
  }
  if (!inserts.length && !updates.length && !deletes.length && !linkUpdates.length) return;

  const client = (spec: TableSpec) => (spec.admin ? adminClient() : sb);
  const from = (spec: TableSpec) => client(spec).from(spec.table as never) as unknown as ReturnType<DB["from"]>;
  const check = (spec: TableSpec, error: { message: string } | null) => {
    if (error) throw new SyncError(friendly(spec.table, error.message));
  };

  // Parents before children on the way in; children before parents on the way out.
  for (const [spec, row] of inserts) {
    // Rows the database makes for itself (a club's owner, say) may already be there: keep theirs.
    // (A plain insert: "on conflict do nothing" would also need the new row to be readable.)
    const { error } = await from(spec).insert(row as never);
    if (!(error && /duplicate key/i.test(error.message))) check(spec, error);
    if (spec.key === "chat") {
      const p = pollInserts.find((x) => x.messageId === row.id);
      if (p) {
        const opts = p.options.map((label, position) => ({ message_id: p.messageId, label, position }));
        const { data, error: e2 } = await sb.from("poll_options").insert(opts).select("id, position, label");
        check(spec, e2);
        aux.pollOptions.set(p.messageId, (data ?? []).sort((a, b) => a.position - b.position).map((o) => `${o.id}\u0000${o.label}`));
      }
    }
    if (spec.key === "messages") {
      const rec = recipientInserts.find((x) => x.messageId === row.id);
      if (rec?.ids.length) {
        const { error: e3 } = await sb.from("message_recipients").insert(rec.ids.map((user_id) => ({ message_id: rec.messageId, user_id })));
        check(spec, e3);
      }
    }
  }
  for (const [spec, row, changed] of updates) {
    const { data, error } = await from(spec).update(changed as never).match(pkMatch(spec, row)).select(spec.pk.join(","));
    check(spec, error);
    if (!data?.length) {
      console.error(`[live sync] ${spec.table}: update matched no rows`, pkMatch(spec, row), Object.keys(changed));
      throw new SyncError("You don't have permission to do that.");
    }
  }
  for (const l of linkUpdates) {
    const { data, error } = await sb.from("team_invite_links").update({ needs_approval: l.needsApproval }).eq("team_id", l.teamId).select("team_id");
    if (error || !data?.length) throw new SyncError("Only captains and managers can change this.");
  }
  for (const [spec, row] of [...deletes].reverse()) {
    const { data, error } = await from(spec).delete().match(pkMatch(spec, row)).select(spec.pk.join(","));
    check(spec, error);
    if (!data?.length) {
      console.error(`[live sync] ${spec.table}: delete matched no rows`, pkMatch(spec, row));
      throw new SyncError("You don't have permission to do that.");
    }
  }
}
