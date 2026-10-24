import { DEFAULT_TZ, utcToZoned, zonedToUtc } from "../time";
import type { Store } from "./store";
import type {
  Attendance,
  AttendanceStatus,
  EventType,
  ID,
  RsvpResponse,
  Team,
  TeamEvent,
  TeamRole,
  TeamSettings,
} from "./types";
import { DEFAULT_POINTS_RULES, TEAM_PERMISSIONS, permissionsForRoles } from "./types";
import { pointsForAttendance } from "./rules";

/*
 * Sample data: an independent Sunday-league side (Kingston Strikers) and a club
 * (Limestone City FC) with two teams. People wear several hats: Dan owns the club and plays
 * for, captains and manages the First Team; Rahul plays on two teams.
 * Dates are relative to the day the server starts, in Toronto time.
 */

export const DEMO_ACCOUNTS = [
  { id: "u-dan", blurb: "Club owner, and plays for, captains and manages the First Team" },
  { id: "u-priya", blurb: "Plays for and captains Kingston Strikers" },
  { id: "u-rahul", blurb: "Player on two teams: Strikers and Limestone City Reserves" },
  { id: "u-marcus", blurb: "Plays for and captains Limestone City Reserves" },
  { id: "u-aisha", blurb: "Club treasurer, and plays for the Reserves" },
];

const settings = (s: Partial<TeamSettings> = {}): TeamSettings => ({
  crest: null,
  pointsEnabled: false,
  pointsPublic: true,
  pointsRules: { ...DEFAULT_POINTS_RULES },
  geoCheckinEnabled: false,
  membersCanPost: true,
  ...s,
});

// Small deterministic hash so "random" sample attendance is the same every run.
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

export function seed(): Store {
  const s: Store = {
    profiles: [], clubs: [], clubAdmins: [], joinRequests: [], teams: [], roster: [], venues: [], seasons: [],
    events: [], rsvps: [], availability: [], attendance: [], points: [], scores: [], matchEvents: [], potmVotes: [], eventManagers: [],
    rideOffers: [], rideRequests: [], fees: [], dues: [], payments: [], conversations: [], chat: [], reactions: [],
    pollVotes: [], reads: [], messages: [], prefs: [], outbox: [],
  };
  const tz = DEFAULT_TZ;
  const nowIso = new Date().toISOString();
  const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();

  // ---- people --------------------------------------------------------------
  const people: [string, string, string][] = [
    ["u-dan", "Dan", "Kowalski"], ["u-priya", "Priya", "Raman"], ["u-rahul", "Rahul", "Menon"], ["u-marcus", "Marcus", "Lee"],
    ["u-sam", "Sam", "Okafor"], ["u-jordan", "Jordan", "Blake"], ["u-chris", "Chris", "Wong"], ["u-tom", "Tom", "Reyes"],
    ["u-ade", "Ade", "Bello"], ["u-leo", "Leo", "Grant"], ["u-femi", "Femi", "Ade"], ["u-aisha", "Aisha", "Shah"],
    ["u-kofi", "Kofi", "Mensah"], ["u-dev", "Dev", "Kapoor"], ["u-owen", "Owen", "Park"], ["u-ravi", "Ravi", "Patel"],
    ["u-nia", "Nia", "Brooks"], ["u-mei", "Mei", "Lin"], ["u-grace", "Grace", "Okoye"], ["u-hana", "Hana", "Sato"],
    ["u-tariq", "Tariq", "Aziz"], ["u-sana", "Sana", "Iqbal"], ["u-paul", "Paul", "Dubois"],
  ];
  for (const [pid, f, l] of people)
    s.profiles.push({
      id: pid, firstName: f, lastName: l, email: `${f.toLowerCase()}.${l.toLowerCase()}@example.com`,
      phone: `613-555-0${100 + people.findIndex((p) => p[0] === pid)}`, theme: "system", useTeamColors: true,
    });

  // ---- club ----------------------------------------------------------------
  s.clubs.push({
    id: "c-lcfc", name: "Limestone City FC", slug: "limestone-city", color: "#0F5C3A", colorSecondary: "#F2C14E",
    logo: null, blurb: "Adult football in Kingston. Men's, women's and over-35s, all levels.", joinOpen: true,
    createdBy: "u-dan", createdAt: nowIso,
  });
  s.clubAdmins.push({ clubId: "c-lcfc", userId: "u-dan", role: "owner" }, { clubId: "c-lcfc", userId: "u-aisha", role: "treasurer" });

  // ---- teams ---------------------------------------------------------------
  const team = (tid: string, name: string, clubId: string | null, level: string, color: string, color2: string, by: string, code: string, st: Partial<TeamSettings>): Team => {
    const t: Team = {
      id: tid, clubId, name, sport: "Soccer", level, location: "Kingston, ON", color, colorSecondary: color2,
      joinCode: code, isPublic: true, rosterVisible: true, createdBy: by, createdAt: nowIso, settings: settings(st),
    };
    s.teams.push(t);
    s.conversations.push({ id: `cv-${tid}`, teamId: tid, kind: "team" }, { id: `cv-${tid}-staff`, teamId: tid, kind: "staff" });
    return t;
  };
  team("t-strikers", "Kingston Strikers", null, "Sunday league", "#2D0A3E", "#B8964A", "u-priya", "KSTR7A2Q", { pointsEnabled: true, geoCheckinEnabled: true });
  team("t-first", "Limestone City First Team", "c-lcfc", "Division 1", "#0F5C3A", "#F2C14E", "u-dan", "LCFT9K3M", {});
  team("t-reserves", "Limestone City Reserves", "c-lcfc", "Division 2", "#0F5C3A", "#F2C14E", "u-dan", "LCRS4P8X", { pointsEnabled: true, geoCheckinEnabled: true });
  team("t-women", "Limestone City Women", "c-lcfc", "Women's league", "#0F5C3A", "#F2C14E", "u-dan", "LCWM2H6R", {});
  team("t-o35", "Limestone City Over-35s", "c-lcfc", "Masters", "#0F5C3A", "#F2C14E", "u-dan", "LCOV5T1D", {});

  const member = (teamId: string, userId: string, jersey: string | null, position: string | null, roles: TeamRole[] = [], allPerms = false) => {
    s.roster.push({
      id: `r-${teamId}-${userId}`, teamId, userId, invitedEmail: null, invitedName: null, isPlayer: jersey !== null, roles,
      jersey, position, permissions: allPerms ? [...TEAM_PERMISSIONS] : permissionsForRoles(roles), status: "active",
    });
  };
  member("t-strikers", "u-priya", "4", "Defence", ["captain"], true);
  member("t-strikers", "u-rahul", "10", "Midfield");
  member("t-strikers", "u-sam", "1", "Goalkeeper", ["vice_captain"]);
  member("t-strikers", "u-jordan", "7", "Forward");
  member("t-strikers", "u-chris", "22", "Midfield");
  member("t-strikers", "u-tom", "9", "Forward");
  member("t-strikers", "u-ade", "15", "Defence", ["treasurer"]);
  s.roster.push({
    id: "r-t-strikers-ben", teamId: "t-strikers", userId: null, invitedEmail: "ben.hart@example.com",
    invitedName: { firstName: "Ben", lastName: "Hart" }, isPlayer: true, roles: [], jersey: "18", position: "Defence", permissions: [], status: "invited",
  });
  member("t-first", "u-dan", "9", "Forward", ["captain", "manager"], true);
  member("t-first", "u-kofi", "5", "Defence", ["vice_captain"]);
  member("t-first", "u-dev", "11", "Midfield");
  member("t-first", "u-owen", "8", "Midfield");
  member("t-reserves", "u-marcus", "2", "Defence", ["captain"]);
  member("t-reserves", "u-rahul", "14", "Midfield");
  member("t-reserves", "u-leo", "3", "Defence");
  member("t-reserves", "u-femi", "19", "Forward");
  member("t-reserves", "u-aisha", "12", "Midfield", ["treasurer"]);
  member("t-reserves", "u-ravi", "6", "Midfield");
  member("t-reserves", "u-nia", "17", "Forward");

  // ---- venues --------------------------------------------------------------
  const venue = (vid: string, teamId: string, name: string, address: string, lat: number, lng: number, radiusM = 150) =>
    s.venues.push({ id: vid, teamId, name, address, lat, lng, radiusM });
  venue("v-invista2", "t-strikers", "Invista Centre, Field 2", "1350 Gardiners Rd, Kingston", 44.2539, -76.5732);
  venue("v-invista1", "t-strikers", "Invista Centre, Field 1", "1350 Gardiners Rd, Kingston", 44.2543, -76.5725);
  venue("v-caraco", "t-strikers", "Caraco Park", "Caraco Dr, Kingston", 44.2294, -76.5409, 200);
  venue("v-club", "t-reserves", "Club grounds, Pitch 1", "Limestone City FC, Kingston", 44.2312, -76.486);
  venue("v-fieldhouse", "t-reserves", "Club fieldhouse", "Limestone City FC, Kingston", 44.2315, -76.4852, 100);
  venue("v-napanee", "t-reserves", "Napanee Fairgrounds", "Napanee, ON", 44.2486, -76.9526, 250);
  venue("v-club-first", "t-first", "Club grounds, Pitch 1", "Limestone City FC, Kingston", 44.2312, -76.486);

  // ---- seasons -------------------------------------------------------------
  for (const t of s.teams) s.seasons.push({ id: `s-${t.id}-sum26`, teamId: t.id, name: "Summer 2026", startsOn: "2026-05-02", endsOn: "2026-11-21", closedAt: null });
  s.seasons.push(
    { id: "s-t-strikers-win25", teamId: "t-strikers", name: "Winter 2025–26", startsOn: "2025-11-29", endsOn: "2026-03-28", closedAt: "2026-03-29T12:00:00Z" },
    { id: "s-t-strikers-sum25", teamId: "t-strikers", name: "Summer 2025", startsOn: "2025-05-03", endsOn: "2025-11-15", closedAt: "2025-11-16T12:00:00Z" },
  );

  // ---- dates ---------------------------------------------------------------
  const today = utcToZoned(nowIso, tz).date;
  const addDays = (date: string, n: number) => new Date(Date.parse(date + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);
  const dowOf = (date: string) => new Date(Date.parse(date + "T12:00:00Z")).getUTCDay();
  const next = (dow: number, weeks = 0) => {
    let d = today;
    while (dowOf(d) !== dow) d = addDays(d, 1);
    return addDays(d, weeks * 7);
  };
  const last = (dow: number, weeksBack = 1) => {
    let d = addDays(today, -1);
    while (dowOf(d) !== dow) d = addDays(d, -1);
    return addDays(d, -(weeksBack - 1) * 7);
  };
  const venueName = (vid: string | null) => s.venues.find((v) => v.id === vid)?.name ?? null;
  const ev = (eid: string, teamId: string, type: EventType, date: string, start: string, end: string, extra: Partial<TeamEvent> = {}): TeamEvent => {
    const startAt = zonedToUtc(date, start, tz);
    const e: TeamEvent = {
      id: eid, teamId, seasonId: `s-${teamId}-sum26`, seriesId: null, type, competition: null, title: null,
      startAt, endAt: zonedToUtc(date, end, tz), meetAt: null, tz, venueId: null, locationText: null, opponent: null,
      homeAway: null, notes: null, squadSize: null, status: "active", statusReason: null, potmOpen: false,
      createdBy: s.teams.find((t) => t.id === teamId)!.createdBy, ...extra,
    };
    if (e.venueId && !e.locationText) e.locationText = venueName(e.venueId);
    s.events.push(e);
    return e;
  };
  const meet = (date: string, hhmm: string) => zonedToUtc(date, hhmm, tz);

  // ---- Strikers schedule ---------------------------------------------------
  const sat = next(6);
  const game1 = ev("e-s-g1", "t-strikers", "match", sat, "10:00", "11:30", {
    competition: "league", opponent: "Frontenac FC", homeAway: "home", venueId: "v-invista2", meetAt: meet(sat, "09:30"),
    notes: "Purple kit. Bring both socks.", squadSize: 14,
  });
  for (let w = 0; w < 3; w++) {
    ev(`e-s-p-tue-${w}`, "t-strikers", "training", next(2, w), "18:00", "19:15", { venueId: "v-caraco", seriesId: "ser-s-tue" });
    ev(`e-s-p-thu-${w}`, "t-strikers", "training", next(4, w), "18:00", "19:15", { venueId: "v-caraco", seriesId: "ser-s-thu" });
  }
  ev("e-s-g2", "t-strikers", "match", next(6, 1), "10:00", "11:30", {
    competition: "league", opponent: "Ottawa Rangers", homeAway: "away", locationText: "Mooney's Bay Park, Ottawa",
    status: "cancelled", statusReason: "Field closed for frost",
  });
  ev("e-s-g3", "t-strikers", "match", next(6, 2), "10:00", "11:30", { competition: "cup", opponent: "Belleville United", homeAway: "home", venueId: "v-invista1", squadSize: 14 });
  ev("e-s-social", "t-strikers", "social", next(6, 3), "19:00", "22:00", { title: "End-of-season night", locationText: "The clubhouse", notes: "Partners welcome." });

  // A session starting shortly after the server starts, so check-in can be tried right away.
  const soon = new Date(Math.ceil((Date.now() + 20 * 60000) / (15 * 60000)) * 15 * 60000);
  const soonLocal = utcToZoned(soon.toISOString(), tz);
  const soonEnd = utcToZoned(new Date(soon.getTime() + 90 * 60000).toISOString(), tz);
  ev("e-s-now", "t-strikers", "training", soonLocal.date, soonLocal.time, soonEnd.date === soonLocal.date ? soonEnd.time : "23:59", {
    title: "Small-sided session", venueId: "v-invista2", notes: "Extra session. Check in when you get there.",
  });

  // Past four weeks: trainings and matches with attendance, results and points.
  const pastMatches: [number, string, "home" | "away", string | null, number, number][] = [
    [1, "Brockville Blaze", "home", "v-caraco", 2, 1],
    [2, "Cobourg Lions", "away", null, 3, 3],
    [3, "Picton Pirates", "home", "v-invista1", 1, 0],
    [4, "Gananoque Gulls", "away", null, 0, 2],
  ];
  const strikersPlayers = s.roster.filter((r) => r.teamId === "t-strikers" && r.status === "active").map((r) => r.userId!);
  const rules = s.teams.find((t) => t.id === "t-strikers")!.settings.pointsRules;
  const mark = (e: TeamEvent, userId: ID, status: AttendanceStatus, minutesLate: number | null = null, geo = false) => {
    const a: Attendance = {
      eventId: e.id, userId, status, minutesLate, method: geo ? "geo" : "staff",
      checkedInAt: geo ? new Date(Date.parse(e.startAt) + ((minutesLate ?? 0) - 12) * 60000).toISOString() : null,
      distanceM: geo ? 20 + Math.round(hash(e.id + userId) * 90) : null, accuracyM: geo ? 8 + Math.round(hash(userId + e.id) * 20) : null,
      recordedBy: geo ? userId : "u-priya", updatedAt: e.endAt,
    };
    s.attendance.push(a);
    for (const p of pointsForAttendance(e, a, rules))
      s.points.push({ id: `pt-${e.id}-${userId}-${p.reason}`, teamId: e.teamId, seasonId: e.seasonId, userId, eventId: e.id, points: p.points, reason: p.reason, note: null, createdBy: null, createdAt: e.endAt });
  };
  const autoMark = (e: TeamEvent, overrides: Record<string, [AttendanceStatus, number?]> = {}) => {
    for (const u of strikersPlayers) {
      const o = overrides[u];
      if (o) { mark(e, u, o[0], o[1] ?? null, o[0] === "present" || o[0] === "late"); continue; }
      const h = hash(e.id + u);
      if (h < 0.72) mark(e, u, "present", null, h < 0.5);
      else if (h < 0.82) mark(e, u, "late", 5 + Math.round(h * 20), true);
      else if (h < 0.92) mark(e, u, "excused");
      else mark(e, u, "absent");
    }
  };
  for (const [w, opp, ha, vid, us, them] of pastMatches) {
    const d = last(6, w);
    const e = ev(`e-s-past-${w}`, "t-strikers", "match", d, "10:00", "11:30", {
      competition: "league", opponent: opp, homeAway: ha, venueId: vid, locationText: vid ? null : `${opp.split(" ")[0]} Memorial Park`,
    });
    s.scores.push({ eventId: e.id, us, them, status: "final", period: "FT", version: 1, updatedAt: e.endAt });
    autoMark(e, w === 1 ? { "u-rahul": ["present"], "u-priya": ["present"], "u-jordan": ["present"], "u-sam": ["present"], "u-tom": ["present"] } : w === 2 ? { "u-rahul": ["present"] } : {});
    const tue = ev(`e-s-past-tue-${w}`, "t-strikers", "training", last(2, w), "18:00", "19:15", { venueId: "v-caraco", seriesId: "ser-s-tue" });
    autoMark(tue, w === 1 ? { "u-rahul": ["present"] } : {});
    const thu = ev(`e-s-past-thu-${w}`, "t-strikers", "training", last(4, w), "18:00", "19:15", { venueId: "v-caraco", seriesId: "ser-s-thu" });
    autoMark(thu, w === 1 ? { "u-rahul": ["late", 20] } : w === 2 ? { "u-rahul": ["excused"] } : {});
  }
  // Last match: goals, and the player of the match vote still open.
  const lastMatch = s.events.find((e) => e.id === "e-s-past-1")!;
  lastMatch.potmOpen = true;
  // The result went in this morning, so the vote is still open (it closes 36 hours after).
  s.scores.find((x) => x.eventId === lastMatch.id)!.updatedAt = new Date(Date.now() - 20 * 3600_000).toISOString();
  s.matchEvents.push(
    { id: "me-1", eventId: lastMatch.id, minute: 23, kind: "goal", side: "us", userId: "u-rahul", assistId: "u-priya", note: null, createdAt: lastMatch.endAt },
    { id: "me-2", eventId: lastMatch.id, minute: 51, kind: "goal", side: "them", userId: null, assistId: null, note: "Penalty", createdAt: lastMatch.endAt },
    { id: "me-3", eventId: lastMatch.id, minute: 64, kind: "yellow", side: "us", userId: "u-tom", assistId: null, note: null, createdAt: lastMatch.endAt },
    { id: "me-4", eventId: lastMatch.id, minute: 78, kind: "goal", side: "us", userId: "u-jordan", assistId: null, note: "Header from a corner", createdAt: lastMatch.endAt },
  );
  s.potmVotes.push(
    { eventId: lastMatch.id, voterId: "u-sam", nomineeId: "u-jordan" },
    { eventId: lastMatch.id, voterId: "u-tom", nomineeId: "u-rahul" },
    { eventId: lastMatch.id, voterId: "u-priya", nomineeId: "u-jordan" },
  );
  // Earlier player-of-the-match awards, so the leaderboard has some.
  for (const [w, u] of [[2, "u-priya"], [3, "u-rahul"], [4, "u-priya"]] as const)
    s.points.push({ id: `pt-potm-${w}`, teamId: "t-strikers", seasonId: "s-t-strikers-sum26", userId: u, eventId: `e-s-past-${w}`, points: rules.potm, reason: "potm", note: null, createdBy: null, createdAt: nowIso });
  s.points.push({ id: "pt-manual-1", teamId: "t-strikers", seasonId: "s-t-strikers-sum26", userId: "u-ade", eventId: null, points: 5, reason: "manual", note: "Ran the kit wash all season", createdBy: "u-priya", createdAt: nowIso });

  // ---- Reserves and First Team schedule --------------------------------------
  const sun = next(0);
  ev("e-r-g1", "t-reserves", "match", sun, "13:00", "14:45", {
    competition: "cup", opponent: "Napanee Rovers", homeAway: "away", venueId: "v-napanee", meetAt: meet(sun, "11:45"),
    notes: "45 min drive. Sort out lifts in Carpool.", squadSize: 14,
  });
  ev("e-r-p1", "t-reserves", "training", next(3), "19:30", "21:00", { venueId: "v-fieldhouse", seriesId: "ser-r-wed" });
  ev("e-r-p2", "t-reserves", "training", next(3, 1), "19:30", "21:00", { venueId: "v-fieldhouse", seriesId: "ser-r-wed" });
  ev("e-r-g2", "t-reserves", "match", next(6, 1), "10:30", "12:15", { competition: "league", opponent: "Amherstview", homeAway: "home", venueId: "v-club" });
  ev("e-f-g1", "t-first", "match", sat, "14:00", "15:45", { competition: "league", opponent: "Kingston Royals", homeAway: "home", venueId: "v-club-first" });
  ev("e-f-p1", "t-first", "training", next(2), "19:00", "20:30", { venueId: "v-club-first", seriesId: "ser-f-tue" });
  ev("e-f-t1", "t-first", "tournament", next(6, 2), "09:00", "16:00", { title: "Limestone Cup", locationText: "Club grounds, all pitches", notes: "Group games every 40 minutes." });

  // ---- answers -------------------------------------------------------------
  const answers: [string, string, RsvpResponse, string | null][] = [
    [game1.id, "u-priya", "going", null], [game1.id, "u-sam", "going", null], [game1.id, "u-jordan", "going", null],
    [game1.id, "u-chris", "maybe", "Depends on work, will confirm Friday"], [game1.id, "u-tom", "not_going", "Away at a wedding"],
    [game1.id, "u-ade", "going", "Might be 10 min late"],
    ["e-f-g1", "u-kofi", "going", null], ["e-f-g1", "u-dev", "going", null],
    ["e-r-g1", "u-marcus", "going", null], ["e-r-g1", "u-leo", "going", null], ["e-r-g1", "u-femi", "going", null],
    ["e-r-g1", "u-aisha", "going", null], ["e-r-g1", "u-ravi", "going", null], ["e-r-g1", "u-nia", "maybe", null],
    ["e-s-now", "u-priya", "going", null], ["e-s-now", "u-sam", "going", null], ["e-s-now", "u-rahul", "going", null],
  ];
  for (const [e, u, r, note] of answers) s.rsvps.push({ id: `rs-${e}-${u}`, eventId: e, userId: u, response: r, note, respondedBy: u, updatedAt: nowIso });

  // ---- unavailable ---------------------------------------------------------
  s.availability.push(
    { id: "av-rahul", userId: "u-rahul", teamIds: ["t-strikers", "t-reserves"], kind: "injured", startsOn: next(0, 1), endsOn: addDays(next(0, 1), 20), note: "Hamstring, physio says 3 weeks.", createdAt: nowIso },
    { id: "av-tom", userId: "u-tom", teamIds: ["t-strikers"], kind: "away", startsOn: addDays(today, 1), endsOn: addDays(today, 6), note: "Family wedding in Halifax", createdAt: nowIso },
  );

  // ---- carpool for the Napanee trip -----------------------------------------
  s.rideOffers.push(
    { id: "ro-marcus", eventId: "e-r-g1", driverId: "u-marcus", seats: 4, leavesAt: "11:45", from: "Club car park", note: null },
    { id: "ro-aisha", eventId: "e-r-g1", driverId: "u-aisha", seats: 3, leavesAt: "11:30", from: "Princess St & Sir John A", note: "Can stop for coffee" },
    { id: "ro-leo", eventId: "e-r-g1", driverId: "u-leo", seats: 2, leavesAt: "11:50", from: "Cataraqui Centre", note: null },
  );
  s.rideRequests.push(
    { id: "rr-femi", eventId: "e-r-g1", userId: "u-femi", from: "Downtown", offerId: "ro-marcus" },
    { id: "rr-ravi", eventId: "e-r-g1", userId: "u-ravi", from: null, offerId: "ro-leo" },
    { id: "rr-nia", eventId: "e-r-g1", userId: "u-nia", from: null, offerId: "ro-leo" },
  );

  // ---- dues ----------------------------------------------------------------
  s.teams.find((t) => t.id === "t-reserves")!.settings.payTo = "treasurer@limestonecityfc.ca";
  s.teams.find((t) => t.id === "t-first")!.settings.payTo = "treasurer@limestonecityfc.ca";
  s.teams.find((t) => t.id === "t-strikers")!.settings.payTo = "ade.bello@example.com";
  const fee = (fid: string, teamId: string, name: string, cents: number, dueOn: string) => {
    s.fees.push({ id: fid, teamId, seasonId: `s-${teamId}-sum26`, name, amountCents: cents, dueOn, createdAt: nowIso });
    for (const r of s.roster.filter((x) => x.teamId === teamId && x.isPlayer && x.status === "active"))
      s.dues.push({ id: `du-${fid}-${r.userId}`, feeId: fid, userId: r.userId!, amountCents: cents });
  };
  fee("f-res-season", "t-reserves", "Season fee", 12000, "2026-09-30");
  fee("f-str-season", "t-strikers", "Pitch and refs", 8000, "2026-10-15");
  fee("f-first-season", "t-first", "Season fee", 12000, "2026-09-30");
  const pay = (dueId: string, cents: number, method: "etransfer" | "cash", paidOn: string, by: string, verifiedBy: string | null, ref: string | null = null) =>
    s.payments.push({ id: `pa-${dueId}-${cents}-${paidOn}`, dueId, amountCents: cents, method, ref, paidOn, reportedBy: by, verifiedBy, verifiedAt: verifiedBy ? nowIso : null, createdAt: nowIso });
  pay("du-f-res-season-u-marcus", 12000, "etransfer", "2026-09-02", "u-marcus", "u-aisha");
  pay("du-f-res-season-u-aisha", 12000, "etransfer", "2026-09-01", "u-aisha", "u-aisha");
  pay("du-f-res-season-u-rahul", 8000, "etransfer", "2026-09-12", "u-rahul", "u-aisha", "CA8K2");
  pay("du-f-res-season-u-femi", 6000, "cash", "2026-10-02", "u-femi", "u-aisha");
  pay("du-f-res-season-u-leo", 12000, "cash", addDays(today, -3), "u-leo", null);
  pay("du-f-res-season-u-nia", 12000, "etransfer", "2026-09-20", "u-nia", "u-aisha");
  for (const u of ["u-priya", "u-sam", "u-jordan", "u-ade"]) pay(`du-f-str-season-${u}`, 8000, "etransfer", "2026-09-10", u, "u-ade");
  pay("du-f-str-season-u-rahul", 8000, "etransfer", addDays(today, -1), "u-rahul", null, "RM1024");
  for (const u of ["u-dan", "u-kofi", "u-dev"]) pay(`du-f-first-season-${u}`, 12000, "etransfer", "2026-09-05", u, "u-aisha");

  // ---- chat ----------------------------------------------------------------
  const msg = (mid: string, conv: string, userId: string, body: string, minsAgo: number, extra: Partial<Store["chat"][number]> = {}) =>
    s.chat.push({ id: mid, conversationId: conv, userId, body, imageUrl: null, replyToId: null, poll: null, pinned: false, createdAt: ago(minsAgo), deletedAt: null, ...extra });
  msg("m-1", "cv-t-strikers", "u-priya", "Training on Tuesday is at Caraco Park, not Invista. Pitch 3, by the fence.", 60 * 26, { pinned: true });
  msg("m-2", "cv-t-strikers", "u-jordan", "What a header though 😄", 60 * 22);
  msg("m-3", "cv-t-strikers", "u-sam", "Great win lads. Vote for player of the match before tonight!", 60 * 21);
  msg("m-4", "cv-t-strikers", "u-priya", "End-of-season night: what should we do?", 60 * 5, {
    poll: { question: "End-of-season night: what should we do?", options: ["Clubhouse BBQ", "Bowling", "Curry night"], multi: false },
  });
  msg("m-5", "cv-t-strikers", "u-chris", "Curry night every time", 60 * 4, { replyToId: "m-4" });
  msg("m-6", "cv-t-strikers", "u-ade", "Pitch fees: e-Transfer $80 to me by Friday please. Thanks to everyone who's paid.", 90);
  msg("m-7", "cv-t-strikers-staff", "u-priya", "Sam, can you take attendance Thursday? I'm in late.", 60 * 3);
  msg("m-8", "cv-t-strikers-staff", "u-sam", "Yep, no problem.", 60 * 2);
  msg("m-9", "cv-t-reserves", "u-marcus", "Napanee on Sunday: 3 cars so far. Add yourself in Carpool if you need a lift.", 120);
  msg("m-10", "cv-t-reserves", "u-femi", "In Marcus's car 👍", 100);
  msg("m-11", "cv-t-first", "u-dan", "Royals on Saturday, 2 pm. Answer in the app so I can pick the squad.", 300);
  s.reactions.push(
    { messageId: "m-2", userId: "u-rahul", emoji: "😂" }, { messageId: "m-2", userId: "u-sam", emoji: "😂" }, { messageId: "m-3", userId: "u-priya", emoji: "👍" },
    { messageId: "m-6", userId: "u-sam", emoji: "👍" }, { messageId: "m-10", userId: "u-marcus", emoji: "👍" },
  );
  s.pollVotes.push({ messageId: "m-4", userId: "u-chris", option: 2 }, { messageId: "m-4", userId: "u-jordan", option: 0 }, { messageId: "m-4", userId: "u-ade", option: 2 }, { messageId: "m-4", userId: "u-sam", option: 1 });
  s.reads.push({ conversationId: "cv-t-strikers", userId: "u-rahul", lastReadAt: ago(60 * 23) });

  s.messages.push({
    id: "tm-1", teamId: "t-strikers", fromId: "u-priya", subject: "Cup draw and kit order",
    body: "We drew Belleville United in the cup, home on the 7th. Kit order closes Friday: add your size to the sheet in chat.",
    recipientIds: strikersPlayers, createdAt: ago(60 * 48),
  });

  // ---- the rest of the club, and people asking to join -------------------------
  member("t-women", "u-mei", "8", "Midfield", ["captain"]);
  member("t-women", "u-grace", "1", "Goalkeeper");
  member("t-women", "u-hana", "10", "Forward");
  member("t-o35", "u-paul", "6", "Defence", ["captain", "manager"]);
  member("t-o35", "u-owen", "12", "Midfield");
  s.joinRequests.push(
    { id: "jr-tariq", teamId: "t-first", userId: "u-tariq", message: "Played centre-back for Queen's last year. Free most Saturdays.", status: "pending", createdAt: new Date(Date.now() - 26 * 3600_000).toISOString() },
    { id: "jr-sana", teamId: "t-women", userId: "u-sana", message: "New to Kingston, keen to play!", status: "pending", createdAt: new Date(Date.now() - 5 * 3600_000).toISOString() },
  );
  s.clubs[0].blurb = "Five teams, one club. Adult football in Kingston since 1994. New players always welcome.";
  return s;
}
