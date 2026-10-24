import "server-only";
import type { ActionResult, Club, ClubRole, ID, Person } from "./types";
import { CLUB_ROLE_LABEL } from "./types";
import {
  APP_URL, EMAIL_RE, HEX_RE, activePlayers, clubRoleFor, currentUserId, db, hasTeamPerm, isClubAdmin, isTeamStaff, myRow, newId, norm, now, personFor, personOf, profileById, queueEmail, requireUser, teamById,
} from "./store";
import { clubDues } from "./dues";

/*
 * Clubs in the app: a public club page with every team (for posters and WhatsApp), asking to
 * join a team, the club admin screen, club settings (name, logo, colours), club admins and
 * club stats. Club owners and admins run every club team; the club treasurer sees dues.
 */

const MAX_LOGO = 400_000;

function clubBySlug(slug: string) {
  return db.clubs.find((c) => c.slug === slug);
}
function captainsOf(teamId: ID): Person[] {
  return db.roster.filter((r) => r.teamId === teamId && r.status === "active" && r.roles.includes("captain")).map(personFor);
}

/** Public: anyone with the link can see the club and its teams. */
export async function getClubPage(slug: string) {
  const club = clubBySlug(slug);
  if (!club) return null;
  const uid = await currentUserId();
  const teams = db.teams
    .filter((t) => t.clubId === club.id && t.isPublic)
    .map((t) => {
      const req = uid ? db.joinRequests.find((r) => r.teamId === t.id && r.userId === uid && r.status === "pending") : undefined;
      return {
        id: t.id,
        name: t.name,
        level: t.level,
        sport: t.sport,
        players: activePlayers(t.id).length,
        captains: captainsOf(t.id).map((p) => p.firstName),
        mine: uid ? (myRow(uid, t.id) ? "member" : req ? "requested" : "none") : "signed-out",
      } as const;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return { club, teams, signedIn: !!uid, isAdmin: uid ? isClubAdmin(uid, club.id) : false };
}

export async function requestToJoin(teamId: ID, message: string): Promise<ActionResult> {
  const user = await requireUser();
  const team = teamById(teamId);
  if (!team || !team.isPublic) return { ok: false, error: "That team isn't taking requests." };
  const club = team.clubId ? db.clubs.find((c) => c.id === team.clubId) : undefined;
  if (club && !club.joinOpen) return { ok: false, error: `${club.name} isn't taking new players right now.` };
  if (myRow(user.id, teamId)) return { ok: false, error: "You're already on this team." };
  if (db.joinRequests.some((r) => r.teamId === teamId && r.userId === user.id && r.status === "pending")) return { ok: false, error: "You've already asked. The captain will get back to you." };
  db.joinRequests.push({ id: newId(), teamId, userId: user.id, message: message.trim().slice(0, 300) || null, status: "pending", createdAt: now() });
  for (const r of db.roster.filter((x) => x.teamId === teamId && x.status === "active" && x.permissions.includes("roster"))) {
    const p = profileById(r.userId);
    if (p)
      queueEmail({
        to: p.email,
        subject: `${team.name} · ${user.firstName} ${user.lastName} wants to join`,
        text: `${user.firstName} ${user.lastName} asked to join ${team.name}.${message.trim() ? `\n\n"${message.trim()}"` : ""}`,
        links: [{ label: "Review the request", href: `${APP_URL}/t/${teamId}/roster` }],
      });
  }
  return { ok: true, data: undefined };
}

export async function listJoinRequests(teamId: ID) {
  const user = await requireUser();
  if (!hasTeamPerm(user.id, teamId, "roster")) return [];
  return db.joinRequests
    .filter((r) => r.teamId === teamId && r.status === "pending")
    .map((r) => ({ id: r.id, person: personOf(r.userId), email: profileById(r.userId)?.email ?? "", message: r.message, createdAt: r.createdAt }));
}

export async function decideJoinRequest(requestId: ID, approve: boolean): Promise<ActionResult<{ teamId: ID }>> {
  const user = await requireUser();
  const r = db.joinRequests.find((x) => x.id === requestId);
  if (!r || r.status !== "pending") return { ok: false, error: "Already sorted." };
  if (!hasTeamPerm(user.id, r.teamId, "roster")) return { ok: false, error: "Only captains and managers can add people." };
  r.status = approve ? "approved" : "declined";
  const team = teamById(r.teamId)!;
  const p = profileById(r.userId);
  if (approve && !myRow(r.userId, r.teamId))
    db.roster.push({ id: newId(), teamId: r.teamId, userId: r.userId, invitedEmail: null, invitedName: null, isPlayer: true, roles: [], jersey: null, position: null, permissions: [], status: "active" });
  if (p)
    queueEmail({
      to: p.email,
      subject: approve ? `You're on ${team.name}` : `${team.name} is full for now`,
      text: approve ? `${user.firstName} added you to ${team.name}. Open the app to see the schedule.` : `Thanks for asking. ${team.name} can't take anyone else right now.`,
      links: approve ? [{ label: "Open the team", href: `${APP_URL}/t/${team.id}/schedule` }] : [],
    });
  return { ok: true, data: { teamId: r.teamId } };
}

/** Find a team: public teams and clubs by name, or one team by its join code. */
export async function searchTeams(q: string) {
  const user = await requireUser();
  const s = q.trim().toLowerCase();
  if (s.length < 2) return [];
  return db.teams
    .filter((t) => t.isPublic && (t.joinCode.toLowerCase() === s || t.name.toLowerCase().includes(s) || (t.clubId && db.clubs.find((c) => c.id === t.clubId)!.name.toLowerCase().includes(s))))
    .slice(0, 20)
    .map((t) => {
      const club = t.clubId ? db.clubs.find((c) => c.id === t.clubId)! : null;
      return {
        id: t.id,
        name: t.name,
        level: t.level,
        location: t.location,
        club: club ? { name: club.name, slug: club.slug } : null,
        players: activePlayers(t.id).length,
        byCode: t.joinCode.toLowerCase() === s,
        mine: myRow(user.id, t.id) ? "member" : db.joinRequests.some((r) => r.teamId === t.id && r.userId === user.id && r.status === "pending") ? "requested" : "none",
      };
    });
}

/** The team's join code is a key: anyone holding it joins straight away as a player. */
export async function joinByCode(code: string): Promise<ActionResult<{ teamId: ID }>> {
  const user = await requireUser();
  const t = db.teams.find((x) => x.joinCode.toLowerCase() === code.trim().toLowerCase());
  if (!t) return { ok: false, error: "No team has that code. Check it with your captain." };
  if (!myRow(user.id, t.id))
    db.roster.push({ id: newId(), teamId: t.id, userId: user.id, invitedEmail: null, invitedName: null, isPlayer: true, roles: [], jersey: null, position: null, permissions: [], status: "active" });
  return { ok: true, data: { teamId: t.id } };
}

// ---------------------------------------------------------------------------
// club admin
// ---------------------------------------------------------------------------

export async function getClubAdmin(clubId: ID) {
  const user = await requireUser();
  const club = db.clubs.find((c) => c.id === clubId);
  const role = clubRoleFor(user.id, clubId);
  if (!club || !role) return null;
  const teams = db.teams.filter((t) => t.clubId === clubId);
  const weekEnd = Date.now() + 7 * 86400_000;
  const thisWeek = db.events
    .filter((e) => teams.some((t) => t.id === e.teamId) && e.status === "active" && Date.parse(e.startAt) > Date.now() - 3 * 3600_000 && Date.parse(e.startAt) < weekEnd && (e.type === "match" || e.type === "tournament"))
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .map((e) => ({
      id: e.id,
      teamId: e.teamId,
      team: teamById(e.teamId)!.name,
      startAt: e.startAt,
      tz: e.tz,
      opponent: e.opponent,
      homeAway: e.homeAway,
      title: e.title,
      type: e.type,
      going: db.rsvps.filter((r) => r.eventId === e.id && r.response === "going").length,
      needed: e.squadSize ?? activePlayers(e.teamId).length,
    }));
  return {
    club,
    myRole: role,
    canEdit: role === "owner" || role === "admin",
    isOwner: role === "owner",
    teams: teams
      .map((t) => ({
        id: t.id,
        name: t.name,
        level: t.level,
        players: activePlayers(t.id).length,
        captains: captainsOf(t.id).map((p) => `${p.firstName} ${p.lastName}`),
        requests: db.joinRequests.filter((r) => r.teamId === t.id && r.status === "pending").length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    players: new Set(teams.flatMap((t) => activePlayers(t.id).map((r) => r.userId))).size,
    requests: db.joinRequests.filter((r) => teams.some((t) => t.id === r.teamId) && r.status === "pending").length,
    thisWeek,
    dues: await clubDues(clubId),
    admins: db.clubAdmins
      .filter((a) => a.clubId === clubId)
      .map((a) => ({ userId: a.userId, person: personOf(a.userId), email: profileById(a.userId)?.email ?? "", role: a.role, label: CLUB_ROLE_LABEL[a.role] })),
  };
}

export async function updateClub(clubId: ID, input: { name: string; color: string; colorSecondary: string | null; blurb: string; joinOpen: boolean; logo?: string | null }): Promise<ActionResult<Club>> {
  const user = await requireUser();
  const club = db.clubs.find((c) => c.id === clubId);
  if (!club || !isClubAdmin(user.id, clubId)) return { ok: false, error: "Only the club owner or admins can change the club." };
  const fieldErrors: Record<string, string> = {};
  if (!input.name.trim()) fieldErrors.name = "Give the club a name.";
  if (!HEX_RE.test(input.color)) fieldErrors.color = "Pick a colour.";
  if (input.colorSecondary && !HEX_RE.test(input.colorSecondary)) fieldErrors.colorSecondary = "Pick a valid colour.";
  if (input.logo && (!/^data:image\/(png|jpe?g|webp|svg\+xml);base64,/.test(input.logo) || input.logo.length > MAX_LOGO)) fieldErrors.logo = "Use a PNG, JPG or SVG under 300 KB.";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  const colorChanged = club.color !== input.color.toUpperCase() || club.colorSecondary !== (input.colorSecondary?.toUpperCase() || null);
  Object.assign(club, {
    name: input.name.trim().slice(0, 80),
    color: input.color.toUpperCase(),
    colorSecondary: input.colorSecondary?.toUpperCase() || null,
    blurb: input.blurb.trim().slice(0, 280) || null,
    joinOpen: input.joinOpen,
    ...(input.logo !== undefined ? { logo: input.logo } : {}),
  });
  // Club teams wear the club's colours.
  if (colorChanged) db.teams.filter((t) => t.clubId === clubId).forEach((t) => Object.assign(t, { color: club.color, colorSecondary: club.colorSecondary }));
  return { ok: true, data: club };
}

export async function addClubAdmin(clubId: ID, email: string, role: string): Promise<ActionResult> {
  const user = await requireUser();
  if (clubRoleFor(user.id, clubId) !== "owner") return { ok: false, error: "Only the club owner can add admins." };
  const r = (["admin", "treasurer"] as ClubRole[]).find((x) => x === role);
  if (!r) return { ok: false, error: "Pick admin or treasurer." };
  if (!EMAIL_RE.test(norm(email))) return { ok: false, error: "Enter an email like name@gmail.com.", fieldErrors: { email: "Enter an email like name@gmail.com." } };
  const p = db.profiles.find((x) => x.email === norm(email));
  if (!p) return { ok: false, error: "They need an account first. Invite them to a team, then add them here.", fieldErrors: { email: "No account with that email yet." } };
  const existing = db.clubAdmins.find((a) => a.clubId === clubId && a.userId === p.id);
  if (existing?.role === "owner") return { ok: false, error: "That's the owner." };
  if (existing) existing.role = r;
  else db.clubAdmins.push({ clubId, userId: p.id, role: r });
  const club = db.clubs.find((c) => c.id === clubId)!;
  queueEmail({ to: p.email, subject: `You're now ${CLUB_ROLE_LABEL[r].toLowerCase()} of ${club.name}`, text: `${user.firstName} made you ${CLUB_ROLE_LABEL[r].toLowerCase()}.`, links: [{ label: "Open the club", href: `${APP_URL}/clubs/${clubId}` }] });
  return { ok: true, data: undefined };
}

export async function removeClubAdmin(clubId: ID, userId: ID): Promise<ActionResult> {
  const user = await requireUser();
  if (clubRoleFor(user.id, clubId) !== "owner") return { ok: false, error: "Only the club owner can remove admins." };
  const a = db.clubAdmins.find((x) => x.clubId === clubId && x.userId === userId);
  if (!a || a.role === "owner") return { ok: false, error: "The owner can't be removed." };
  db.clubAdmins = db.clubAdmins.filter((x) => x !== a);
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// club stats
// ---------------------------------------------------------------------------

export async function getClubStats(clubId: ID) {
  const user = await requireUser();
  const club = db.clubs.find((c) => c.id === clubId);
  if (!club || !clubRoleFor(user.id, clubId)) return null;
  const teams = db.teams.filter((t) => t.clubId === clubId);
  const teamIds = new Set(teams.map((t) => t.id));
  const past = db.events.filter((e) => teamIds.has(e.teamId) && e.status === "active" && Date.parse(e.endAt) < Date.now());
  const rate = (evs: typeof past) => {
    const marks = db.attendance.filter((a) => evs.some((e) => e.id === a.eventId));
    return marks.length ? Math.round((marks.filter((a) => a.status === "present" || a.status === "late").length / marks.length) * 100) : null;
  };
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = Date.now() - i * 7 * 86400_000;
    const start = end - 7 * 86400_000;
    const evs = past.filter((e) => Date.parse(e.startAt) >= start && Date.parse(e.startAt) < end);
    return { weekOf: new Date(start).toISOString().slice(0, 10), rate: rate(evs), events: evs.length };
  }).reverse();
  // Answered before the day: share of player answers given before the event's date.
  const answers = db.rsvps.filter((r) => past.some((e) => e.id === r.eventId));
  const early = answers.filter((r) => {
    const e = past.find((x) => x.id === r.eventId)!;
    return r.updatedAt.slice(0, 10) < e.startAt.slice(0, 10);
  }).length;
  const dues = (await clubDues(clubId)) ?? [];
  const seats = db.rideRequests.filter((r) => r.offerId && db.events.some((e) => e.id === r.eventId && teamIds.has(e.teamId))).length;
  const trips = new Set(db.rideOffers.filter((o) => db.events.some((e) => e.id === o.eventId && teamIds.has(e.teamId))).map((o) => o.eventId)).size;
  return {
    club,
    attendance: rate(past),
    answeredEarly: answers.length ? Math.round((early / answers.length) * 100) : null,
    weeks,
    byTeam: teams.map((t) => ({ id: t.id, name: t.name, rate: rate(past.filter((e) => e.teamId === t.id)), players: activePlayers(t.id).length })).sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1)),
    dues: { collected: dues.reduce((n, d) => n + d.collected, 0), total: dues.reduce((n, d) => n + d.total, 0), owing: dues.reduce((n, d) => n + d.owing, 0) },
    carpool: { seats, trips },
    staffCanSee: teams.some((t) => isTeamStaff(user.id, t.id)),
  };
}
