import "server-only";
import type { ActionResult, Attendance, AttendanceStatus, ID, PointsEntry, RsvpResponse, Season, TeamEvent, UnavailableKind } from "./types";
import { isFixture } from "./types";
import { pointsForAttendance } from "./rules";
import { DEFAULT_TZ, utcToZoned, zonedToUtc } from "../time";
import {
  activePlayers,
  db,
  distanceM,
  eventById,
  hasTeamPerm,
  isActivePlayer,
  isTeamMember,
  isTeamStaff,
  newId,
  now,
  openSeason,
  personFor,
  requireUser,
  teamById,
  unavailableFor,
} from "./store";

/*
 * What actually happened: attendance marks, geo check-in, the points they earn, the
 * leaderboard and seasons. Mirrors attendance, points_ledger, seasons and check_in() in SQL.
 */

const CHECKIN_OPENS_MIN = 60;
const MAX_ACCURACY_M = 200;

function seasonOf(e: TeamEvent): Season | null {
  return e.seasonId ? db.seasons.find((s) => s.id === e.seasonId) ?? null : null;
}

/** Replace the automatic points for one player at one event (manual and POTM rows are kept). */
function rewritePoints(e: TeamEvent, userId: ID, a: Attendance | null) {
  const team = teamById(e.teamId)!;
  db.points = db.points.filter((p) => !(p.eventId === e.id && p.userId === userId && ["training", "match", "away_bonus", "late_penalty"].includes(p.reason)));
  if (!a || !team.settings.pointsEnabled) return;
  for (const p of pointsForAttendance(e, a, team.settings.pointsRules))
    db.points.push({ id: newId(), teamId: e.teamId, seasonId: e.seasonId, userId, eventId: e.id, points: p.points, reason: p.reason, note: null, createdBy: null, createdAt: now() });
}

// ---------------------------------------------------------------------------
// taking attendance
// ---------------------------------------------------------------------------

export async function getAttendanceSheet(eventId: ID) {
  const user = await requireUser();
  const e = eventById(eventId);
  if (!e || !hasTeamPerm(user.id, e.teamId, "attendance")) return null;
  const team = teamById(e.teamId)!;
  const season = seasonOf(e);
  const rows = activePlayers(e.teamId)
    .map((r) => {
      const rsvp = db.rsvps.find((x) => x.eventId === e.id && x.userId === r.userId);
      const mark = db.attendance.find((x) => x.eventId === e.id && x.userId === r.userId) ?? null;
      const away = unavailableFor(r.userId!, e.teamId, e.startAt, e.tz);
      return {
        userId: r.userId!,
        person: personFor(r),
        jersey: r.jersey,
        response: (rsvp?.response ?? (away ? "not_going" : null)) as RsvpResponse | null,
        note: rsvp?.note ?? null,
        unavailable: (away?.kind ?? null) as UnavailableKind | null,
        mark,
      };
    })
    .sort((a, b) => (+(a.jersey ?? 999) - +(b.jersey ?? 999)) || a.person.firstName.localeCompare(b.person.firstName));
  return {
    event: e,
    rows,
    rules: team.settings.pointsRules,
    pointsEnabled: team.settings.pointsEnabled,
    locked: !!season?.closedAt,
    seasonName: season?.name ?? null,
    opensAt: new Date(Date.parse(e.startAt) - CHECKIN_OPENS_MIN * 60000).toISOString(),
  };
}

export async function saveAttendance(
  eventId: ID,
  marks: { userId: ID; status: string; minutesLate?: string }[],
): Promise<ActionResult<{ saved: number; points: number }>> {
  const user = await requireUser();
  const e = eventById(eventId);
  if (!e) return { ok: false, error: "That event no longer exists." };
  if (!hasTeamPerm(user.id, e.teamId, "attendance")) return { ok: false, error: "You don't have permission to take attendance." };
  if (seasonOf(e)?.closedAt) return { ok: false, error: "This season is closed, so attendance is locked." };
  if (e.status === "cancelled") return { ok: false, error: "This event was cancelled." };
  if (Date.parse(e.startAt) - Date.now() > CHECKIN_OPENS_MIN * 60000) return { ok: false, error: "Attendance opens an hour before the start." };
  const fieldErrors: Record<string, string> = {};
  const clean: { userId: ID; status: AttendanceStatus; minutesLate: number | null }[] = [];
  for (const m of marks) {
    if (!m.status) continue; // not marked yet
    if (!["present", "late", "absent", "excused"].includes(m.status)) continue;
    if (!isActivePlayer(m.userId, e.teamId)) continue;
    const mins = m.status === "late" ? Number(m.minutesLate || 0) : null;
    if (m.status === "late" && (!Number.isInteger(mins) || mins! < 1 || mins! > 600)) {
      fieldErrors[`late.${m.userId}`] = "How many minutes late?";
      continue;
    }
    clean.push({ userId: m.userId, status: m.status as AttendanceStatus, minutesLate: mins });
  }
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Add how late they were.", fieldErrors };
  let points = 0;
  for (const m of clean) {
    let a = db.attendance.find((x) => x.eventId === e.id && x.userId === m.userId);
    if (a && a.status === m.status && a.minutesLate === m.minutesLate) continue; // unchanged: keep a check-in as it is
    if (!a) {
      a = { eventId: e.id, userId: m.userId, status: m.status, minutesLate: m.minutesLate, method: "staff", checkedInAt: null, distanceM: null, accuracyM: null, recordedBy: user.id, updatedAt: now() };
      db.attendance.push(a);
    } else Object.assign(a, { status: m.status, minutesLate: m.minutesLate, method: "staff", recordedBy: user.id, updatedAt: now() });
    rewritePoints(e, m.userId, a);
  }
  for (const m of clean) points += db.points.filter((p) => p.eventId === e.id && p.userId === m.userId && p.reason !== "potm").reduce((s, p) => s + p.points, 0);
  return { ok: true, data: { saved: clean.length, points } };
}

export async function attendanceSummary(eventId: ID) {
  const user = await requireUser();
  const e = eventById(eventId);
  if (!e || !isTeamMember(user.id, e.teamId)) return null;
  const marks = db.attendance.filter((a) => a.eventId === e.id);
  const count = (s: AttendanceStatus) => marks.filter((m) => m.status === s).length;
  return { present: count("present"), late: count("late"), absent: count("absent"), excused: count("excused"), geo: marks.filter((m) => m.method === "geo").length, total: activePlayers(e.teamId).length };
}

// ---------------------------------------------------------------------------
// geo check-in
// ---------------------------------------------------------------------------

/** What the check-in card should show for me at this event. */
export async function getCheckIn(eventId: ID) {
  const user = await requireUser();
  const e = eventById(eventId);
  if (!e || !isActivePlayer(user.id, e.teamId)) return null;
  const team = teamById(e.teamId)!;
  if (!team.settings.geoCheckinEnabled || e.status !== "active") return null;
  const venue = e.venueId ? db.venues.find((v) => v.id === e.venueId) : undefined;
  const opens = Date.parse(e.startAt) - CHECKIN_OPENS_MIN * 60000;
  const mine = db.attendance.find((a) => a.eventId === e.id && a.userId === user.id) ?? null;
  const t = Date.now();
  return {
    venue: venue ? { name: venue.name, pinned: venue.lat != null, radiusM: venue.radiusM } : null,
    state: (t < opens ? "not_yet" : t > Date.parse(e.endAt) ? "closed" : "open") as "not_yet" | "open" | "closed",
    opensAt: new Date(opens).toISOString(),
    lateAfter: new Date(Date.parse(e.startAt) + team.settings.pointsRules.late_after_minutes * 60000).toISOString(),
    mine: mine ? { status: mine.status, minutesLate: mine.minutesLate, method: mine.method, checkedInAt: mine.checkedInAt, distanceM: mine.distanceM } : null,
  };
}

/**
 * Same rules as check_in() in SQL: one location fix, distance worked out here, only the
 * distance and accuracy kept. A captain's mark wins; the first check-in time stands.
 */
export async function checkIn(eventId: ID, lat: number, lng: number, accuracy: number): Promise<ActionResult<{ status: AttendanceStatus; minutesLate: number | null; distanceM: number }>> {
  const user = await requireUser();
  const e = eventById(eventId);
  if (!e) return { ok: false, error: "Event not found." };
  if (!isActivePlayer(user.id, e.teamId)) return { ok: false, error: "Only players on this team can check in." };
  const team = teamById(e.teamId)!;
  if (!team.settings.geoCheckinEnabled) return { ok: false, error: "Check-in is off for this team." };
  if (e.status !== "active") return { ok: false, error: `This event is ${e.status}.` };
  if (Date.now() < Date.parse(e.startAt) - CHECKIN_OPENS_MIN * 60000) return { ok: false, error: "Check-in opens an hour before the start." };
  if (Date.now() > Date.parse(e.endAt)) return { ok: false, error: "Check-in has closed." };
  const v = e.venueId ? db.venues.find((x) => x.id === e.venueId) : undefined;
  if (!v || v.lat == null || v.lng == null) return { ok: false, error: "This venue has no map pin yet. Ask your captain to mark you." };
  if (![lat, lng, accuracy].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { ok: false, error: "Bad location." };
  if (accuracy > MAX_ACCURACY_M)
    return { ok: false, error: `Your location is too rough (± ${Math.round(accuracy)} m). Step outside and try again, or ask your captain.` };
  const d = distanceM(lat, lng, v.lat, v.lng);
  if (d > v.radiusM) return { ok: false, error: `You're ${Math.round(d).toLocaleString("en-CA")} m from ${v.name}. Check in when you get there.` };

  const existing = db.attendance.find((a) => a.eventId === e.id && a.userId === user.id);
  if (existing) return { ok: true, data: { status: existing.status, minutesLate: existing.minutesLate, distanceM: existing.distanceM ?? Math.round(d) } };
  const mins = Math.max(0, Math.floor((Date.now() - Date.parse(e.startAt)) / 60000));
  const status: AttendanceStatus = mins >= team.settings.pointsRules.late_after_minutes ? "late" : "present";
  const a: Attendance = {
    eventId: e.id, userId: user.id, status, minutesLate: status === "late" ? mins : null, method: "geo", checkedInAt: now(),
    distanceM: Math.round(d), accuracyM: Math.round(accuracy), recordedBy: user.id, updatedAt: now(),
  };
  db.attendance.push(a);
  rewritePoints(e, user.id, a);
  return { ok: true, data: { status, minutesLate: a.minutesLate, distanceM: a.distanceM! } };
}

// ---------------------------------------------------------------------------
// points and leaderboard
// ---------------------------------------------------------------------------

export async function getLeaderboard(teamId: ID, seasonId?: ID) {
  const user = await requireUser();
  const team = teamById(teamId);
  if (!team || !isTeamMember(user.id, teamId)) return null;
  const staff = isTeamStaff(user.id, teamId);
  const st = team.settings;
  const seasons = db.seasons.filter((s) => s.teamId === teamId).sort((a, b) => b.startsOn.localeCompare(a.startsOn));
  const season = (seasonId ? seasons.find((s) => s.id === seasonId) : null) ?? openSeason(teamId) ?? seasons[0] ?? null;
  const visible = st.pointsEnabled && (st.pointsPublic || staff);
  if (!visible) return { team, enabled: st.pointsEnabled, visible: false as const, staff, seasons, season, rules: st.pointsRules, rows: [], canAdd: false };
  const pts = db.points.filter((p) => p.teamId === teamId && (!season || p.seasonId === season.id));
  const seasonEvents = db.events.filter((e) => e.teamId === teamId && (!season || e.seasonId === season.id) && e.status !== "cancelled" && Date.parse(e.endAt) < Date.now());
  const ids = new Set(seasonEvents.map((e) => e.id));
  const rows = db.roster
    .filter((r) => r.teamId === teamId && r.isPlayer && r.userId && r.status !== "removed")
    .map((r) => {
      const mine = pts.filter((p) => p.userId === r.userId);
      const marks = db.attendance.filter((a) => a.userId === r.userId && ids.has(a.eventId) && a.status !== "excused");
      const went = marks.filter((a) => a.status === "present" || a.status === "late").length;
      return {
        userId: r.userId!,
        person: personFor(r),
        jersey: r.jersey,
        points: mine.reduce((s, p) => s + p.points, 0),
        potm: mine.filter((p) => p.reason === "potm").length,
        late: marks.filter((a) => a.status === "late").length,
        away: mine.filter((p) => p.reason === "away_bonus").length,
        rate: marks.length ? Math.round((went / marks.length) * 100) : null,
        me: r.userId === user.id,
      };
    })
    .sort((a, b) => b.points - a.points || (b.rate ?? 0) - (a.rate ?? 0) || a.person.firstName.localeCompare(b.person.firstName));
  // Equal points share a place.
  let place = 0;
  const ranked = rows.map((r, i) => ({ ...r, place: i > 0 && rows[i - 1].points === r.points ? place : (place = i + 1) }));
  const manual = staff
    ? pts.filter((p) => p.reason === "manual").map((p) => ({ ...p, person: personFor(db.roster.find((r) => r.teamId === teamId && r.userId === p.userId)!) }))
    : [];
  return { team, enabled: true, visible: true as const, staff, seasons, season, rules: st.pointsRules, rows: ranked, canAdd: hasTeamPerm(user.id, teamId, "attendance") && !season?.closedAt, manual };
}

export async function addManualPoints(teamId: ID, input: { userId: string; points: string; note: string }): Promise<ActionResult<PointsEntry>> {
  const user = await requireUser();
  if (!hasTeamPerm(user.id, teamId, "attendance")) return { ok: false, error: "Only captains can add points." };
  const season = openSeason(teamId);
  if (!season) return { ok: false, error: "Start a season first." };
  const fieldErrors: Record<string, string> = {};
  const pts = Number(input.points);
  if (!isActivePlayer(input.userId, teamId)) fieldErrors.userId = "Pick a player.";
  if (!Number.isInteger(pts) || pts === 0 || Math.abs(pts) > 100) fieldErrors.points = "Use a whole number from -100 to 100, not 0.";
  if (!input.note.trim()) fieldErrors.note = "Say what it's for, so everyone knows.";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  const p: PointsEntry = { id: newId(), teamId, seasonId: season.id, userId: input.userId, eventId: null, points: pts, reason: "manual", note: input.note.trim().slice(0, 140), createdBy: user.id, createdAt: now() };
  db.points.push(p);
  return { ok: true, data: p };
}

export async function removeManualPoints(teamId: ID, pointsId: ID): Promise<ActionResult> {
  const user = await requireUser();
  if (!hasTeamPerm(user.id, teamId, "attendance")) return { ok: false, error: "Only captains can change points." };
  const before = db.points.length;
  db.points = db.points.filter((p) => !(p.id === pointsId && p.teamId === teamId && p.reason === "manual"));
  return before === db.points.length ? { ok: false, error: "Already removed." } : { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// seasons
// ---------------------------------------------------------------------------

export async function listSeasons(teamId: ID) {
  const user = await requireUser();
  const team = teamById(teamId);
  if (!team || !isTeamMember(user.id, teamId)) return null;
  const summarise = (s: Season) => {
    const evs = db.events.filter((e) => e.seasonId === s.id && e.status !== "cancelled");
    const played = evs.filter((e) => isFixture(e.type) && db.scores.some((x) => x.eventId === e.id && x.status === "final"));
    const res = played.map((e) => db.scores.find((x) => x.eventId === e.id)!);
    const record = { w: res.filter((r) => r.us > r.them).length, d: res.filter((r) => r.us === r.them).length, l: res.filter((r) => r.us < r.them).length };
    const ids = new Set(evs.filter((e) => Date.parse(e.endAt) < Date.now()).map((e) => e.id));
    const marks = db.attendance.filter((a) => ids.has(a.eventId) && a.status !== "excused");
    const rate = marks.length ? Math.round((marks.filter((a) => a.status === "present" || a.status === "late").length / marks.length) * 100) : null;
    const totals = new Map<ID, number>();
    db.points.filter((p) => p.seasonId === s.id).forEach((p) => totals.set(p.userId, (totals.get(p.userId) ?? 0) + p.points));
    const top = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([u, pts]) => ({ person: personFor(db.roster.find((r) => r.teamId === teamId && r.userId === u)!), points: pts }));
    const remaining = evs.filter((e) => Date.parse(e.startAt) > Date.now()).length;
    return { ...s, events: evs.length, remaining, record, rate, top };
  };
  const seasons = db.seasons.filter((s) => s.teamId === teamId).sort((a, b) => b.startsOn.localeCompare(a.startsOn)).map(summarise);
  const activeCount = db.roster.filter((r) => r.teamId === teamId && r.status === "active" && r.isPlayer).length;
  const series = new Set(db.events.filter((e) => e.teamId === teamId && e.seriesId && e.seasonId === openSeason(teamId)?.id).map((e) => e.seriesId)).size;
  return { current: seasons.find((s) => !s.closedAt) ?? null, past: seasons.filter((s) => s.closedAt), canManage: hasTeamPerm(user.id, teamId, "edit_settings"), activeCount, series };
}

export async function closeSeason(
  teamId: ID,
  input: { nextName: string; startsOn: string; copyRoster: boolean; keepRoles: boolean; copyTrainings: boolean; carryDues: boolean },
): Promise<ActionResult<Season>> {
  const user = await requireUser();
  if (!hasTeamPerm(user.id, teamId, "edit_settings")) return { ok: false, error: "Only managers can close a season." };
  const team = teamById(teamId)!;
  const cur = openSeason(teamId);
  const fieldErrors: Record<string, string> = {};
  if (!input.nextName.trim()) fieldErrors.nextName = "Name the next season, like Winter 2026–27.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startsOn)) fieldErrors.startsOn = "Pick when it starts.";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  const today = utcToZoned(now(), DEFAULT_TZ).date;
  if (cur) {
    cur.closedAt = now();
    cur.endsOn = cur.endsOn && cur.endsOn < today ? cur.endsOn : today;
  }
  const next: Season = { id: newId(), teamId, name: input.nextName.trim(), startsOn: input.startsOn, endsOn: null, closedAt: null };
  db.seasons.push(next);
  // Events after the new start date move into the new season.
  db.events.filter((e) => e.teamId === teamId && utcToZoned(e.startAt, e.tz).date >= input.startsOn).forEach((e) => (e.seasonId = next.id));

  for (const r of db.roster.filter((x) => x.teamId === teamId && x.status !== "removed" && x.userId !== team.createdBy)) {
    if (!input.copyRoster && r.status === "active") r.status = "inactive";
    if (!input.keepRoles) {
      r.roles = [];
      r.permissions = [];
      if (!r.isPlayer) r.status = "removed";
    }
  }
  if (input.copyTrainings && cur) {
    // One new series per old weekly training: same weekday, time and venue, for 12 weeks.
    const bySeries = new Map<ID, TeamEvent>();
    db.events
      .filter((e) => e.seasonId === cur.id && e.seriesId && e.type === "training")
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .forEach((e) => bySeries.set(e.seriesId!, e));
    for (const tpl of bySeries.values()) {
      const { time } = utcToZoned(tpl.startAt, tpl.tz);
      const endTime = utcToZoned(tpl.endAt, tpl.tz).time;
      const dow = new Date(Date.parse(utcToZoned(tpl.startAt, tpl.tz).date + "T12:00:00Z")).getUTCDay();
      let d = input.startsOn;
      while (new Date(Date.parse(d + "T12:00:00Z")).getUTCDay() !== dow) d = new Date(Date.parse(d + "T12:00:00Z") + 86400000).toISOString().slice(0, 10);
      const sid = newId();
      for (let w = 0; w < 12; w++) {
        const date = new Date(Date.parse(d + "T12:00:00Z") + w * 7 * 86400000).toISOString().slice(0, 10);
        if (db.events.some((x) => x.teamId === teamId && x.type === "training" && utcToZoned(x.startAt, x.tz).date === date && utcToZoned(x.startAt, x.tz).time === time)) continue;
        db.events.push({ ...tpl, id: newId(), seasonId: next.id, seriesId: sid, startAt: zonedToUtc(date, time, tpl.tz), endAt: zonedToUtc(date, endTime, tpl.tz), status: "active", statusReason: null, potmOpen: false, createdBy: user.id });
      }
    }
  }
  if (input.carryDues && cur) {
    const owed = new Map<ID, number>();
    for (const f of db.fees.filter((x) => x.teamId === teamId && x.seasonId === cur.id))
      for (const d of db.dues.filter((x) => x.feeId === f.id)) {
        const paid = db.payments.filter((p) => p.dueId === d.id && p.verifiedAt).reduce((s, p) => s + p.amountCents, 0);
        if (d.amountCents > paid) owed.set(d.userId, (owed.get(d.userId) ?? 0) + d.amountCents - paid);
      }
    if (owed.size) {
      const fee = { id: newId(), teamId, seasonId: next.id, name: `Carried over from ${cur.name}`, amountCents: 0, dueOn: input.startsOn, createdAt: now() };
      db.fees.push(fee);
      for (const [u, cents] of owed) db.dues.push({ id: newId(), feeId: fee.id, userId: u, amountCents: cents });
    }
  }
  return { ok: true, data: next };
}
