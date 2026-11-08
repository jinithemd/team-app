import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIVE } from "../mode";

/*
 * Groups storage. Sample build: memory. Live: Supabase through the server key; the service
 * (service.ts) checks who may do what first.
 */

export interface Group {
  id: string;
  teamId: string;
  name: string;
  about: string | null;
  createdBy: string | null;
  createdAt: string;
}
export interface GroupMember {
  groupId: string;
  userId: string;
  addedBy: string | null;
  lastReadAt: string | null;
  createdAt: string;
}
export interface GroupMessage {
  id: string;
  groupId: string;
  authorId: string | null;
  body: string;
  createdAt: string;
}

type Row = Record<string, unknown>;
type Mem = { groups: Group[]; members: GroupMember[]; messages: GroupMessage[] };
const g = globalThis as unknown as { __clbxGroups?: Mem };
const mem: Mem = (g.__clbxGroups ??= { groups: [], members: [], messages: [] });

async function admin(): Promise<SupabaseClient> {
  const { adminClient } = await import("../supabase/server");
  return adminClient() as unknown as SupabaseClient;
}
function check(error: { message: string } | null, what: string) {
  if (error) throw new Error(`${what}: ${error.message}`);
}
const s = (v: unknown) => (v == null ? null : String(v));
const toGroup = (r: Row): Group => ({ id: String(r.id), teamId: String(r.team_id), name: String(r.name), about: s(r.about), createdBy: s(r.created_by), createdAt: String(r.created_at) });
const toMember = (r: Row): GroupMember => ({ groupId: String(r.group_id), userId: String(r.user_id), addedBy: s(r.added_by), lastReadAt: s(r.last_read_at), createdAt: String(r.created_at) });
const toMessage = (r: Row): GroupMessage => ({ id: String(r.id), groupId: String(r.group_id), authorId: s(r.author_id), body: String(r.body), createdAt: String(r.created_at) });

export async function groupsForTeam(teamId: string): Promise<Group[]> {
  if (!LIVE) return mem.groups.filter((x) => x.teamId === teamId).sort((a, b) => a.name.localeCompare(b.name));
  const { data, error } = await (await admin()).from("groups").select("*").eq("team_id", teamId).order("name");
  check(error, "groups");
  return ((data ?? []) as Row[]).map(toGroup);
}

export async function groupById(id: string): Promise<Group | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (!LIVE) return mem.groups.find((x) => x.id === id) ?? null;
  const { data } = await (await admin()).from("groups").select("*").eq("id", id).maybeSingle();
  return data ? toGroup(data as Row) : null;
}

export async function groupsByIds(ids: string[]): Promise<Group[]> {
  if (!ids.length) return [];
  if (!LIVE) return mem.groups.filter((x) => ids.includes(x.id));
  const { data, error } = await (await admin()).from("groups").select("*").in("id", ids);
  check(error, "groups");
  return ((data ?? []) as Row[]).map(toGroup);
}

export async function insertGroup(x: Omit<Group, "id" | "createdAt">): Promise<Group> {
  if (!LIVE) {
    const row = { ...x, id: randomUUID(), createdAt: new Date().toISOString() };
    mem.groups.push(row);
    return row;
  }
  const { data, error } = await (await admin()).from("groups").insert({ team_id: x.teamId, name: x.name, about: x.about, created_by: x.createdBy }).select("*").single();
  check(error, "new group");
  return toGroup(data as Row);
}

export async function updateGroup(id: string, patch: { name: string; about: string | null }) {
  if (!LIVE) {
    const x = mem.groups.find((y) => y.id === id);
    if (x) Object.assign(x, patch);
    return;
  }
  check((await (await admin()).from("groups").update(patch).eq("id", id)).error, "rename group");
}

export async function deleteGroup(id: string) {
  if (!LIVE) {
    mem.groups = mem.groups.filter((x) => x.id !== id);
    mem.members = mem.members.filter((x) => x.groupId !== id);
    mem.messages = mem.messages.filter((x) => x.groupId !== id);
    return;
  }
  check((await (await admin()).from("groups").delete().eq("id", id)).error, "delete group");
}

export async function membersOf(groupIds: string[]): Promise<GroupMember[]> {
  if (!groupIds.length) return [];
  if (!LIVE) return mem.members.filter((x) => groupIds.includes(x.groupId));
  const { data, error } = await (await admin()).from("group_members").select("*").in("group_id", groupIds);
  check(error, "group members");
  return ((data ?? []) as Row[]).map(toMember);
}

export async function membershipsOf(userId: string): Promise<GroupMember[]> {
  if (!LIVE) return mem.members.filter((x) => x.userId === userId);
  const { data, error } = await (await admin()).from("group_members").select("*").eq("user_id", userId);
  check(error, "my groups");
  return ((data ?? []) as Row[]).map(toMember);
}

export async function addMembers(groupId: string, userIds: string[], addedBy: string) {
  if (!userIds.length) return;
  if (!LIVE) {
    for (const userId of userIds)
      if (!mem.members.some((x) => x.groupId === groupId && x.userId === userId)) mem.members.push({ groupId, userId, addedBy, lastReadAt: null, createdAt: new Date().toISOString() });
    return;
  }
  const { error } = await (await admin())
    .from("group_members")
    .upsert(userIds.map((user_id) => ({ group_id: groupId, user_id, added_by: addedBy })), { onConflict: "group_id,user_id", ignoreDuplicates: true });
  check(error, "add to group");
}

export async function removeMember(groupId: string, userId: string) {
  if (!LIVE) {
    mem.members = mem.members.filter((x) => !(x.groupId === groupId && x.userId === userId));
    return;
  }
  check((await (await admin()).from("group_members").delete().eq("group_id", groupId).eq("user_id", userId)).error, "remove from group");
}

export async function markRead(groupId: string, userId: string) {
  const now = new Date().toISOString();
  if (!LIVE) {
    const x = mem.members.find((y) => y.groupId === groupId && y.userId === userId);
    if (x) x.lastReadAt = now;
    return;
  }
  await (await admin()).from("group_members").update({ last_read_at: now }).eq("group_id", groupId).eq("user_id", userId);
}

export async function messages(groupId: string, limit = 100): Promise<GroupMessage[]> {
  if (!LIVE) return mem.messages.filter((x) => x.groupId === groupId).slice(-limit);
  const { data, error } = await (await admin()).from("group_messages").select("*").eq("group_id", groupId).order("created_at", { ascending: false }).limit(limit);
  check(error, "group chat");
  return ((data ?? []) as Row[]).map(toMessage).reverse();
}

/** Messages newer than each member's last read, per group (for unread counts). */
export async function unreadCounts(rows: GroupMember[], userId: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!rows.length) return out;
  if (!LIVE) {
    for (const r of rows) out.set(r.groupId, mem.messages.filter((m) => m.groupId === r.groupId && m.authorId !== userId && (!r.lastReadAt || m.createdAt > r.lastReadAt)).length);
    return out;
  }
  const sb = await admin();
  await Promise.all(
    rows.map(async (r) => {
      let q = sb.from("group_messages").select("id", { count: "exact", head: true }).eq("group_id", r.groupId).neq("author_id", userId);
      if (r.lastReadAt) q = q.gt("created_at", r.lastReadAt);
      const { count } = await q;
      out.set(r.groupId, count ?? 0);
    }),
  );
  return out;
}

export async function lastMessages(groupIds: string[]): Promise<Map<string, GroupMessage>> {
  const out = new Map<string, GroupMessage>();
  if (!groupIds.length) return out;
  if (!LIVE) {
    for (const m of mem.messages) if (groupIds.includes(m.groupId)) out.set(m.groupId, m);
    return out;
  }
  const sb = await admin();
  await Promise.all(
    groupIds.map(async (id) => {
      const { data } = await sb.from("group_messages").select("*").eq("group_id", id).order("created_at", { ascending: false }).limit(1);
      const r = (data ?? [])[0] as Row | undefined;
      if (r) out.set(id, toMessage(r));
    }),
  );
  return out;
}

export async function postMessage(x: { groupId: string; authorId: string; body: string }): Promise<GroupMessage> {
  if (!LIVE) {
    const row = { id: randomUUID(), groupId: x.groupId, authorId: x.authorId, body: x.body, createdAt: new Date().toISOString() };
    mem.messages.push(row);
    return row;
  }
  const { data, error } = await (await admin()).from("group_messages").insert({ group_id: x.groupId, author_id: x.authorId, body: x.body }).select("*").single();
  check(error, "send");
  return toMessage(data as Row);
}

export async function deleteMessage(id: string) {
  if (!LIVE) {
    mem.messages = mem.messages.filter((x) => x.id !== id);
    return;
  }
  check((await (await admin()).from("group_messages").delete().eq("id", id)).error, "delete message");
}

export async function messageById(id: string): Promise<GroupMessage | null> {
  if (!LIVE) return mem.messages.find((x) => x.id === id) ?? null;
  const { data } = await (await admin()).from("group_messages").select("*").eq("id", id).maybeSingle();
  return data ? toMessage(data as Row) : null;
}

export async function teamName(teamId: string): Promise<{ name: string; color: string } | null> {
  if (!LIVE) {
    const { db } = await import("../data/store");
    const t = db.teams.find((x) => x.id === teamId);
    return t ? { name: t.name, color: t.color } : null;
  }
  const { data } = await (await admin()).from("teams").select("name, color").eq("id", teamId).maybeSingle();
  return data ? { name: String(data.name), color: String(data.color ?? "#1D4ED8") } : null;
}
