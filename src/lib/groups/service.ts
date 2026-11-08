import "server-only";
import { getSessionUserId } from "../data/session";
import { getTeam, myPerms } from "../data";
import * as st from "./store";
import type { Group } from "./store";

/*
 * Groups: a team's named circles of players, like "Sunday Fun" or "Wednesday Futsal". The
 * captain (team staff) makes them and adds people: the team's own players, guest players,
 * followers, or anyone with a Clbx account by email. Each group has its own chat, and a
 * drop-in game can be posted to one group, so only they hear about it and the held spots
 * are theirs. Group members who aren't on the team see the group, not the team.
 */

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
async function caught<T>(fn: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await fn();
  } catch (e) {
    console.error("[groups]", e);
    return fail("Something went wrong. Try again.");
  }
}
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Team staff (captains, managers, coaches) run a team's groups. */
async function staffOf(teamId: string): Promise<string | null> {
  const team = await getTeam(teamId).catch(() => null);
  if (!team) return null;
  const p = await myPerms(teamId);
  return p.staff ? p.userId : null;
}

/** Who I am to a group: a member, staff of its team (manage), or nobody. */
async function access(groupId: string) {
  const uid = await getSessionUserId();
  const group = uid ? await st.groupById(groupId) : null;
  if (!uid || !group) return null;
  const [members, staff] = await Promise.all([st.membersOf([groupId]), staffOf(group.teamId)]);
  const member = members.some((m) => m.userId === uid);
  if (!member && !staff) return null;
  return { uid, group, members, member, manage: !!staff };
}

export interface GroupCard {
  id: string;
  name: string;
  about: string | null;
  members: number;
  inIt: boolean;
}

/** The team's groups: staff see them all, players the ones they're in. */
export async function teamGroups(teamId: string): Promise<{ groups: GroupCard[]; manage: boolean } | null> {
  const uid = await getSessionUserId();
  const team = uid ? await getTeam(teamId).catch(() => null) : null;
  if (!uid || !team) return null;
  const manage = !!(await staffOf(teamId));
  const all = await st.groupsForTeam(teamId);
  const members = await st.membersOf(all.map((x) => x.id));
  const cards = all.map((x) => ({ id: x.id, name: x.name, about: x.about, members: members.filter((m) => m.groupId === x.id).length, inIt: members.some((m) => m.groupId === x.id && m.userId === uid) }));
  return { groups: manage ? cards : cards.filter((c) => c.inIt), manage };
}

const cleanName = (v: string) => v.trim().replace(/\s+/g, " ");

export async function createGroup(teamId: string, input: { name: string; about?: string }): Promise<Result<{ id: string }>> {
  return caught(async () => {
    const me = await staffOf(teamId);
    if (!me) return fail("Only captains and managers can make groups.");
    const name = cleanName(input.name);
    if (!name) return fail("Give the group a name.");
    if (name.length > 60) return fail("Keep the name under 60 characters.");
    const about = input.about?.trim() || null;
    if (about && about.length > 300) return fail("Keep the description under 300 characters.");
    if ((await st.groupsForTeam(teamId)).some((x) => x.name.toLowerCase() === name.toLowerCase())) return fail("There's already a group with that name.");
    const g = await st.insertGroup({ teamId, name, about, createdBy: me });
    await st.addMembers(g.id, [me], me); // whoever makes it is in it
    return { ok: true, data: { id: g.id } };
  });
}

export async function editGroup(groupId: string, input: { name: string; about?: string }): Promise<Result> {
  return caught(async () => {
    const a = await access(groupId);
    if (!a?.manage) return fail("Only captains and managers can change a group.");
    const name = cleanName(input.name);
    if (!name || name.length > 60) return fail("Give the group a name under 60 characters.");
    await st.updateGroup(groupId, { name, about: input.about?.trim().slice(0, 300) || null });
    return { ok: true, data: undefined };
  });
}

export async function removeGroup(groupId: string): Promise<Result<{ teamId: string }>> {
  return caught(async () => {
    const a = await access(groupId);
    if (!a?.manage) return fail("Only captains and managers can delete a group.");
    await st.deleteGroup(groupId);
    return { ok: true, data: { teamId: a.group.teamId } };
  });
}

export interface GroupView {
  group: Group;
  team: { id: string; name: string; color: string };
  manage: boolean;
  member: boolean;
  me: string;
  members: { id: string; name: string; you: boolean }[];
  messages: { id: string; author: string; authorId: string | null; body: string; at: string; mine: boolean }[];
}

export async function groupView(groupId: string): Promise<GroupView | null> {
  const a = await access(groupId);
  if (!a) return null;
  const [team, msgs] = await Promise.all([st.teamName(a.group.teamId), st.messages(groupId)]);
  const { people } = await import("../sessions/store");
  const who = await people([...new Set([...a.members.map((m) => m.userId), ...msgs.map((m) => m.authorId).filter((x): x is string => !!x)])]);
  if (a.member) await st.markRead(groupId, a.uid);
  return {
    group: a.group,
    team: { id: a.group.teamId, name: team?.name ?? "", color: team?.color ?? "#1D4ED8" },
    manage: a.manage,
    member: a.member,
    me: a.uid,
    members: a.members.map((m) => ({ id: m.userId, name: who.get(m.userId)?.name || "Someone", you: m.userId === a.uid })).sort((x, y) => x.name.localeCompare(y.name)),
    messages: msgs.map((m) => ({ id: m.id, author: (m.authorId && who.get(m.authorId)?.name) || "Someone", authorId: m.authorId, body: m.body, at: m.createdAt, mine: m.authorId === a.uid })),
  };
}

/** People to add: an exact email (any Clbx account), or a name among people the team knows. */
export async function findPeople(groupId: string, q: string): Promise<Result<{ id: string; name: string; hint: string | null }[]>> {
  return caught<{ id: string; name: string; hint: string | null }[]>(async () => {
    const a = await access(groupId);
    if (!a?.manage) return fail("Only captains and managers can add people.");
    const term = q.trim().toLowerCase();
    if (term.length < 2) return { ok: true, data: [] };
    const skip = new Set(a.members.map((m) => m.userId));
    const gs = await import("../guests/store");
    if (EMAIL.test(term)) {
      const p = await gs.profileByEmail(term);
      return { ok: true, data: p && !skip.has(p.id) ? [{ id: p.id, name: p.name, hint: "Clbx account" }] : [] };
    }
    const [known, roster] = await Promise.all([gs.knownPeople(a.group.teamId), gs.rosterUserIds(a.group.teamId)]);
    const onTeam = new Set(roster);
    const people = await gs.profiles([...new Set([...known, ...roster])].filter((id) => !skip.has(id)));
    const hits = [...people.values()]
      .filter((p) => p.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(term)) || p.name.toLowerCase().includes(term))
      .sort((x, y) => x.name.localeCompare(y.name))
      .slice(0, 8)
      .map((p) => ({ id: p.id, name: p.name, hint: onTeam.has(p.id) ? "On the team" : null }));
    return { ok: true, data: hits };
  });
}

/** Everyone on the team's roster who isn't in the group yet, to add in one go. */
export async function rosterNotInGroup(groupId: string): Promise<{ id: string; name: string }[]> {
  const a = await access(groupId);
  if (!a?.manage) return [];
  const gs = await import("../guests/store");
  const skip = new Set(a.members.map((m) => m.userId));
  const people = await gs.profiles((await gs.rosterUserIds(a.group.teamId)).filter((id) => !skip.has(id)));
  return [...people.values()].map((p) => ({ id: p.id, name: p.name })).sort((x, y) => x.name.localeCompare(y.name));
}

export async function addToGroup(groupId: string, userIds: string[]): Promise<Result<{ added: number }>> {
  return caught(async () => {
    const a = await access(groupId);
    if (!a?.manage) return fail("Only captains and managers can add people.");
    const ids = [...new Set(userIds)].filter((id) => /^[0-9a-z-]{3,}$/i.test(id) && !a.members.some((m) => m.userId === id));
    if (ids.length > 200) return fail("Add up to 200 people at a time.");
    const { people } = await import("../sessions/store");
    const real = [...(await people(ids)).keys()];
    await st.addMembers(groupId, real, a.uid);
    return { ok: true, data: { added: real.length } };
  });
}

/** Staff take someone out; anyone can leave. */
export async function removeFromGroup(groupId: string, userId: string): Promise<Result> {
  return caught(async () => {
    const a = await access(groupId);
    if (!a || (!a.manage && userId !== a.uid)) return fail("Only captains and managers can take people out.");
    await st.removeMember(groupId, userId);
    return { ok: true, data: undefined };
  });
}

export async function sendMessage(groupId: string, body: string): Promise<Result> {
  return caught(async () => {
    const a = await access(groupId);
    if (!a) return fail("You're not in this group.");
    const text = body.trim();
    if (!text) return fail("Write a message first.");
    if (text.length > 2000) return fail("Keep it under 2,000 characters.");
    if (!a.member) await st.addMembers(groupId, [a.uid], a.uid); // staff who speak up join the group
    await st.postMessage({ groupId, authorId: a.uid, body: text });
    await st.markRead(groupId, a.uid);
    void notify(a.group, a.uid, text, a.members.map((m) => m.userId));
    return { ok: true, data: undefined };
  });
}

async function notify(group: Group, from: string, text: string, to: string[]) {
  try {
    const push = await import("../push/send");
    if (!push.pushConfigured()) return;
    const { people } = await import("../sessions/store");
    const name = (await people([from])).get(from)?.name.split(" ")[0] ?? "Someone";
    await Promise.all(to.filter((id) => id !== from).map((id) => push.pushToUser(id, { title: group.name, body: `${name}: ${text.slice(0, 140)}`, url: `/g/${group.id}` }).catch(() => {})));
  } catch (e) {
    console.error("[groups] push", e);
  }
}

export async function deleteMessage(groupId: string, messageId: string): Promise<Result> {
  return caught(async () => {
    const a = await access(groupId);
    const m = a && (await st.messageById(messageId));
    if (!a || !m || m.groupId !== groupId) return fail("That message is gone.");
    if (m.authorId !== a.uid && !a.manage) return fail("You can only delete your own messages.");
    await st.deleteMessage(messageId);
    return { ok: true, data: undefined };
  });
}

export interface MyGroup {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  members: number;
  unread: number;
  last: { body: string; at: string } | null;
}

/** The groups I'm in, newest message first (Chat and Teams tabs). */
export async function myGroups(): Promise<MyGroup[]> {
  const uid = await getSessionUserId();
  if (!uid) return [];
  const mine = await st.membershipsOf(uid);
  if (!mine.length) return [];
  const ids = mine.map((m) => m.groupId);
  const [groups, all, unread, last] = await Promise.all([st.groupsByIds(ids), st.membersOf(ids), st.unreadCounts(mine, uid), st.lastMessages(ids)]);
  const teams = new Map<string, string>();
  for (const t of new Set(groups.map((x) => x.teamId))) teams.set(t, (await st.teamName(t))?.name ?? "");
  return groups
    .map((x) => ({
      id: x.id,
      name: x.name,
      teamId: x.teamId,
      teamName: teams.get(x.teamId) ?? "",
      members: all.filter((m) => m.groupId === x.id).length,
      unread: unread.get(x.id) ?? 0,
      last: last.get(x.id) ? { body: last.get(x.id)!.body, at: last.get(x.id)!.createdAt } : null,
    }))
    .sort((a, b) => (b.last?.at ?? "").localeCompare(a.last?.at ?? "") || a.name.localeCompare(b.name));
}

/** For drop-ins: the people in a group, and whether someone is in it. */
export async function groupMemberIds(groupId: string): Promise<string[]> {
  return (await st.membersOf([groupId])).map((m) => m.userId);
}
export async function groupName(groupId: string): Promise<string | null> {
  return (await st.groupById(groupId))?.name ?? null;
}
