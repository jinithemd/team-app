import "server-only";
import type { ActionResult, AvailabilityPeriod, ID, UnavailableKind } from "./types";
import { DEFAULT_TZ, utcToZoned } from "../time";
import {
  activePlayers,
  db,
  eventById,
  isActivePlayer,
  isTeamMember,
  isTeamStaff,
  newId,
  now,
  openSeason,
  personFor,
  profileById,
  requireUser,
  teamById,
} from "./store";

/*
 * Away, injured or unavailable for a stretch of days. Teammates only see "unavailable until";
 * captains see the reason and the note. Events in those dates count as "can't go" unless the
 * player answers otherwise, and reminders skip them.
 */

const today = () => utcToZoned(now(), DEFAULT_TZ).date;

export async function listMyAvailability() {
  const user = await requireUser();
  const teams = db.teams.filter((t) => isActivePlayer(user.id, t.id)).map((t) => ({ id: t.id, name: t.name }));
  const periods = db.availability
    .filter((a) => a.userId === user.id && a.endsOn >= today())
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  return { teams, periods };
}

export async function saveAvailability(
  periodId: ID | null,
  input: { kind: string; startsOn: string; endsOn: string; note?: string; teamIds: string[] },
): Promise<ActionResult<{ period: AvailabilityPeriod; affected: number }>> {
  const user = await requireUser();
  const fieldErrors: Record<string, string> = {};
  const kind = (["injured", "away", "other"] as const).find((k) => k === input.kind);
  if (!kind) fieldErrors.kind = "Pick a reason.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startsOn)) fieldErrors.startsOn = "Pick the first day.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.endsOn)) fieldErrors.endsOn = "Pick the last day.";
  else if (input.startsOn && input.endsOn < input.startsOn) fieldErrors.endsOn = "The last day can't be before the first.";
  else if (input.endsOn < today()) fieldErrors.endsOn = "That's already over.";
  if (input.note && input.note.length > 300) fieldErrors.note = "Keep the note under 300 characters.";
  const teamIds = input.teamIds.filter((t) => isActivePlayer(user.id, t));
  if (!teamIds.length) fieldErrors.teamIds = "Pick at least one team.";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };

  let p = periodId ? db.availability.find((a) => a.id === periodId && a.userId === user.id) : undefined;
  if (periodId && !p) return { ok: false, error: "That's already been cleared." };
  if (!p) {
    p = { id: newId(), userId: user.id, teamIds: [], kind: kind!, startsOn: "", endsOn: "", note: null, createdAt: now() };
    db.availability.push(p);
  }
  Object.assign(p, { kind: kind!, startsOn: input.startsOn, endsOn: input.endsOn, note: input.note?.trim() || null, teamIds });
  const affected = db.events.filter((e) => {
    if (!teamIds.includes(e.teamId) || e.status === "cancelled" || Date.parse(e.startAt) < Date.now()) return false;
    const d = utcToZoned(e.startAt, e.tz).date;
    return d >= p!.startsOn && d <= p!.endsOn;
  }).length;
  return { ok: true, data: { period: p, affected } };
}

export async function clearAvailability(periodId: ID): Promise<ActionResult> {
  const user = await requireUser();
  const p = db.availability.find((a) => a.id === periodId && a.userId === user.id);
  if (!p) return { ok: false, error: "That's already been cleared." };
  // "Back early": end it yesterday so the history stays, or drop it if it hasn't started.
  if (p.startsOn >= today()) db.availability = db.availability.filter((a) => a !== p);
  else {
    const y = new Date(Date.parse(today() + "T12:00:00Z") - 86400000).toISOString().slice(0, 10);
    p.endsOn = y;
  }
  return { ok: true, data: undefined };
}

/** Who's out on a team right now or soon. Staff see why; teammates see only "unavailable". */
export async function listTeamUnavailable(teamId: ID) {
  const user = await requireUser();
  if (!isTeamMember(user.id, teamId)) return [];
  const staff = isTeamStaff(user.id, teamId);
  const t = today();
  const soon = new Date(Date.parse(t + "T12:00:00Z") + 21 * 86400000).toISOString().slice(0, 10);
  return activePlayers(teamId)
    .flatMap((r) =>
      db.availability
        .filter((a) => a.userId === r.userId && a.teamIds.includes(teamId) && a.endsOn >= t && a.startsOn <= soon)
        .map((a) => ({
          person: personFor(r),
          startsOn: a.startsOn,
          endsOn: a.endsOn,
          kind: (staff || r.userId === user.id ? a.kind : null) as UnavailableKind | null,
          note: staff || r.userId === user.id ? a.note : null,
        })),
    )
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
}

/** Player profile: season numbers, recent attendance, and (staff only) contact and private notes. */
export async function getPlayerProfile(teamId: ID, userId: ID) {
  const viewer = await requireUser();
  const team = teamById(teamId);
  if (!team || !isTeamMember(viewer.id, teamId)) return null;
  const row = db.roster.find((r) => r.teamId === teamId && r.userId === userId && r.status !== "removed");
  if (!row) return null;
  const staff = isTeamStaff(viewer.id, teamId);
  if (!staff && viewer.id !== userId && !team.rosterVisible) return null;
  const season = openSeason(teamId);
  const seasonEvents = db.events.filter((e) => e.teamId === teamId && (!season || e.seasonId === season.id) && e.status !== "cancelled" && Date.parse(e.endAt) < Date.now());
  const marks = db.attendance.filter((a) => a.userId === userId && seasonEvents.some((e) => e.id === a.eventId));
  const counted = marks.filter((m) => m.status !== "excused");
  const attended = counted.filter((m) => m.status === "present" || m.status === "late").length;
  const rate = counted.length ? Math.round((attended / counted.length) * 100) : null;

  const totals = new Map<ID, number>();
  db.points.filter((p) => p.teamId === teamId && (!season || p.seasonId === season.id)).forEach((p) => totals.set(p.userId, (totals.get(p.userId) ?? 0) + p.points));
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const pts = totals.get(userId) ?? 0;
  const rank = ranked.findIndex(([u]) => u === userId) + 1 || null;
  const goals = db.matchEvents.filter((m) => m.userId === userId && m.kind === "goal" && m.side === "us" && seasonEvents.some((e) => e.id === m.eventId)).length;
  const assists = db.matchEvents.filter((m) => m.assistId === userId && seasonEvents.some((e) => e.id === m.eventId)).length;
  const potm = db.points.filter((p) => p.teamId === teamId && p.userId === userId && p.reason === "potm" && (!season || p.seasonId === season.id)).length;

  const recent = marks
    .map((m) => ({ m, e: eventById(m.eventId)! }))
    .sort((a, b) => b.e.startAt.localeCompare(a.e.startAt))
    .slice(0, 6)
    .map(({ m, e }) => ({
      eventId: e.id,
      type: e.type,
      title: e.type === "match" ? `${e.homeAway === "away" ? "at" : "vs"} ${e.opponent}` : e.title || "Training",
      startAt: e.startAt,
      tz: e.tz,
      status: m.status,
      minutesLate: m.minutesLate,
      geo: m.method === "geo",
      goals: db.matchEvents.filter((x) => x.eventId === e.id && x.userId === userId && x.kind === "goal" && x.side === "us").length,
      awayBonus: e.type === "match" && e.homeAway === "away",
    }));

  const out = db.availability.find((a) => a.userId === userId && a.teamIds.includes(teamId) && a.endsOn >= today() && a.startsOn <= today());
  const p = profileById(userId);
  return {
    person: personFor(row),
    row,
    seasonName: season?.name ?? null,
    stats: { rate, points: team.settings.pointsEnabled && (staff || team.settings.pointsPublic) ? pts : null, rank, goals, assists, potm },
    recent,
    unavailable: out ? { until: out.endsOn, kind: staff || viewer.id === userId ? out.kind : null, note: staff || viewer.id === userId ? out.note : null } : null,
    contact: staff || viewer.id === userId ? { email: p?.email ?? row.invitedEmail, phone: p?.phone ?? null } : null,
    canEdit: staff,
    isMe: viewer.id === userId,
  };
}
