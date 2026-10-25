import "server-only";
import type { DB } from "../supabase/server";
import type { OutboxEmail } from "../data/types";
import { APP_URL } from "../data/store";

/*
 * Turns an outbox row into an email. The app writes ready-made emails (kind "email": to,
 * subject, text, links). The database's own functions write short notices (someone joined,
 * asked to join, was let in) with ids only; those are worded here. The email worker and the
 * local inbox page both use this.
 */

type Row = { id: string; kind: string; user_id: string | null; payload: unknown; created_at: string };

export async function renderOutbox(admin: DB, r: Row): Promise<OutboxEmail> {
  const p = (r.payload ?? {}) as Record<string, unknown> & { links?: { label: string; href: string }[] };
  if (r.kind === "email") return { id: r.id, to: String(p.to ?? ""), subject: String(p.subject ?? ""), text: String(p.text ?? ""), links: p.links ?? [], createdAt: r.created_at };
  const [{ data: to }, { data: team }] = await Promise.all([
    r.user_id ? admin.from("profiles").select("email").eq("id", r.user_id).maybeSingle() : Promise.resolve({ data: null }),
    p.team_id ? admin.from("teams").select("id, name").eq("id", String(p.team_id)).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const who = String(p.who ?? "Someone");
  const name = team?.name ?? "your team";
  const roster = { label: "Open the roster", href: `${APP_URL}/t/${team?.id}/roster` };
  const base = { id: r.id, to: to?.email ?? "", createdAt: r.created_at };
  switch (r.kind) {
    case "joined_by_link":
      return { ...base, subject: `${name} · ${who} joined`, text: `${who} joined ${name} with the team's invite link. Add their number and position from the roster.`, links: [roster] };
    case "join_request":
      return { ...base, subject: `${name} · ${who} wants to join`, text: `${who} asked to join ${name} and is waiting for your OK.`, links: [{ label: "Review the request", href: roster.href }] };
    case "join_approved":
      return { ...base, subject: `You're on ${name}`, text: `You've been added to ${name}. Open the app to see the schedule.`, links: [{ label: "Open the team", href: `${APP_URL}/t/${team?.id}/schedule` }] };
    case "join_declined":
      return { ...base, subject: `${name} is full for now`, text: `Thanks for asking. ${name} can't take anyone else right now.`, links: [] };
    default:
      return { ...base, subject: r.kind, text: JSON.stringify(p), links: [] };
  }
}
