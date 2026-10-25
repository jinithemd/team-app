import "server-only";
import type { ActionResult, ID } from "./types";
import { APP_URL, activePlayers, currentUserId, db, hasTeamPerm, myRow, newId, now, profileById, queueEmail, requireUser, teamById } from "./store";
import { newInviteToken } from "./invite-token";

/*
 * The team invite link: /join/<token>. Captains drop it in the team WhatsApp group.
 * Whoever opens it signs up (or signs in) and joins as a player, or, when the captain
 * has switched on approval, asks to join and waits. Roles are never given by the link.
 * Resetting the link makes every old copy stop working.
 */

const linkFor = (token: string) => `${APP_URL}/join/${token}`;
const byToken = (token: string) => (token.length >= 16 ? db.teams.find((t) => t.inviteToken === token) : undefined);

/** For the Add people screen. Only people who can change the roster see the link. */
export async function getInviteLink(teamId: ID) {
  const user = await requireUser();
  const t = teamById(teamId);
  if (!t || !hasTeamPerm(user.id, teamId, "roster")) return null;
  return { url: linkFor(t.inviteToken), needsApproval: !!t.settings.linkNeedsApproval };
}

export async function resetInviteLink(teamId: ID): Promise<ActionResult<{ url: string }>> {
  const user = await requireUser();
  const t = teamById(teamId);
  if (!t || !hasTeamPerm(user.id, teamId, "roster")) return { ok: false, error: "Only captains and managers can reset the link." };
  t.inviteToken = newInviteToken();
  return { ok: true, data: { url: linkFor(t.inviteToken) } };
}

export async function setLinkApproval(teamId: ID, needsApproval: boolean): Promise<ActionResult> {
  const user = await requireUser();
  const t = teamById(teamId);
  if (!t || !hasTeamPerm(user.id, teamId, "roster")) return { ok: false, error: "Only captains and managers can change this." };
  t.settings.linkNeedsApproval = needsApproval;
  return { ok: true, data: undefined };
}

/** Public: what someone opening the link sees. Name, colours, crest, club, headcount. No roster. */
export async function getJoinPage(token: string) {
  const t = byToken(token);
  if (!t) return null;
  const club = t.clubId ? db.clubs.find((c) => c.id === t.clubId) ?? null : null;
  const uid = await currentUserId();
  const pending = uid ? db.joinRequests.some((r) => r.teamId === t.id && r.userId === uid && r.status === "pending") : false;
  return {
    team: { id: t.id, name: t.name, level: t.level, location: t.location, sport: t.sport, color: t.color, colorSecondary: t.colorSecondary, crest: t.settings.crest },
    club: club ? { name: club.name, slug: club.slug } : null,
    players: activePlayers(t.id).length,
    needsApproval: !!t.settings.linkNeedsApproval,
    me: !uid ? ("signed-out" as const) : myRow(uid, t.id) ? ("member" as const) : pending ? ("requested" as const) : ("none" as const),
  };
}

function tellRosterManagers(teamId: ID, subject: string, text: string) {
  for (const r of db.roster.filter((x) => x.teamId === teamId && x.status === "active" && x.permissions.includes("roster"))) {
    const p = profileById(r.userId);
    if (p) queueEmail({ to: p.email, subject, text, links: [{ label: "Open the roster", href: `${APP_URL}/t/${teamId}/roster` }] });
  }
}

export async function joinByLink(token: string): Promise<ActionResult<{ teamId: ID; status: "joined" | "requested" | "member" }>> {
  const user = await requireUser();
  const t = byToken(token);
  if (!t) return { ok: false, error: "This invite link doesn't work any more. Ask your captain for the new one." };
  if (myRow(user.id, t.id)) return { ok: true, data: { teamId: t.id, status: "member" } };
  const who = `${user.firstName} ${user.lastName}`;
  if (t.settings.linkNeedsApproval) {
    if (!db.joinRequests.some((r) => r.teamId === t.id && r.userId === user.id && r.status === "pending")) {
      db.joinRequests.push({ id: newId(), teamId: t.id, userId: user.id, message: "Opened the team invite link", status: "pending", createdAt: now() });
      tellRosterManagers(t.id, `${t.name} · ${who} wants to join`, `${who} opened the team's invite link and is waiting for your OK.`);
    }
    return { ok: true, data: { teamId: t.id, status: "requested" } };
  }
  db.roster.push({ id: newId(), teamId: t.id, userId: user.id, invitedEmail: null, invitedName: null, isPlayer: true, roles: [], jersey: null, position: null, permissions: [], status: "active" });
  tellRosterManagers(t.id, `${t.name} · ${who} joined`, `${who} joined ${t.name} with the team's invite link. Add their number and position from the roster.`);
  return { ok: true, data: { teamId: t.id, status: "joined" } };
}
