import "server-only";
import type { ID, Team, TeamEvent, Venue } from "./types";
import { EVENT_TYPE_LABEL } from "./types";
import { APP_URL, db, hasTeamPerm, isTeamMember, isTeamStaff, personFor, profileById, requireUser, teamById } from "./store";
import { sign, verify } from "../tokens";
import { eventTitle } from "../event-title";
import { APP_DOMAIN, APP_NAME } from "../brand";

/*
 * Calendar feed (iCal) and spreadsheet exports. The feed URL carries a signed token so phone
 * calendars can fetch it without signing in; resetting it gives a new link (old ones stop).
 */

const FEED_TTL = 60 * 60 * 24 * 365 * 5;

export async function myCalendarFeed() {
  const user = await requireUser();
  const token = sign({ k: "cal", u: user.id, v: feedVersion(user.id) }, FEED_TTL);
  const https = `${APP_URL}/cal/${token}.ics`;
  return { https, webcal: https.replace(/^https?:/, "webcal:"), google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(https.replace(/^https?:/, "webcal:"))}` };
}

// Kept in the shared store (real build: calendar_feeds table), so every route sees a reset.
function feedVersion(uid: ID) {
  return db.calFeedVersions[uid] ?? 0;
}
export async function resetCalendarFeed() {
  const user = await requireUser();
  db.calFeedVersions[user.id] = feedVersion(user.id) + 1;
  return myCalendarFeed();
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** Fold lines at 75 octets as the iCal spec asks. */
const fold = (line: string) => line.match(/.{1,74}/g)!.join("\r\n ");

export async function calendarIcs(token: string): Promise<string | null> {
  const t = verify<{ k: string; u: string; v: number }>(token.replace(/\.ics$/, ""));
  if (!t || t.k !== "cal" || t.v !== feedVersion(t.u) || !profileById(t.u)) return null;
  const events = db.events.filter((e) => isTeamMember(t.u, e.teamId) && Date.parse(e.endAt) > Date.now() - 30 * 86400_000);
  return buildIcs(
    events.map((e) => ({ e, team: teamById(e.teamId)!, venue: e.venueId ? db.venues.find((v) => v.id === e.venueId) : undefined })),
  );
}

/** The iCal text for a list of events. Shared with the live build's feed. */
export function buildIcs(items: { e: TeamEvent; team: Pick<Team, "id" | "name">; venue?: Pick<Venue, "name" | "address" | "lat" | "lng"> }[]): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${APP_NAME}//Schedule//EN`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:My teams", "REFRESH-INTERVAL;VALUE=DURATION:PT1H"];
  for (const { e, team, venue } of items) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@${APP_DOMAIN}`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(e.startAt)}`,
      `DTEND:${stamp(e.endAt)}`,
      `SUMMARY:${esc(`${e.status === "cancelled" ? "CANCELLED: " : ""}${team.name}: ${eventTitle(e)}`)}`,
      `DESCRIPTION:${esc(`${EVENT_TYPE_LABEL[e.type]}${e.notes ? `\n${e.notes}` : ""}\n${APP_URL}/t/${team.id}/e/${e.id}`)}`,
      ...(venue || e.locationText ? [`LOCATION:${esc([venue?.name ?? e.locationText, venue?.address].filter(Boolean).join(", "))}`] : []),
      ...(venue?.lat != null ? [`GEO:${venue.lat};${venue.lng}`] : []),
      `STATUS:${e.status === "cancelled" ? "CANCELLED" : e.status === "postponed" ? "TENTATIVE" : "CONFIRMED"}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// CSV exports (staff only; payments need the payments permission)
// ---------------------------------------------------------------------------

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Quote everything that needs it, and stop spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const csv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

export async function exportCsv(teamId: ID, kind: string): Promise<{ filename: string; body: string } | null> {
  const user = await requireUser();
  const team = teamById(teamId);
  if (!team || !isTeamStaff(user.id, teamId)) return null;
  const slug = team.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const roster = db.roster.filter((r) => r.teamId === teamId && r.status !== "removed");

  if (kind === "players")
    return {
      filename: `${slug}-players.csv`,
      body: csv([
        ["First name", "Last name", "Email", "Number", "Position", "Plays", "Roles", "Status"],
        ...roster.map((r) => {
          const p = personFor(r);
          return [p.firstName, p.lastName, profileById(r.userId)?.email ?? r.invitedEmail, r.jersey, r.position, r.isPlayer ? "yes" : "no", r.roles.join(" "), r.status];
        }),
      ]),
    };

  if (kind === "attendance") {
    const events = db.events.filter((e) => e.teamId === teamId && db.attendance.some((a) => a.eventId === e.id)).sort((a, b) => a.startAt.localeCompare(b.startAt));
    const players = roster.filter((r) => r.isPlayer && r.userId);
    return {
      filename: `${slug}-attendance.csv`,
      body: csv([
        ["Player", ...events.map((e) => `${e.startAt.slice(0, 10)} ${eventTitle(e)}`), "Present", "Late", "Absent", "Excused"],
        ...players.map((r) => {
          const marks = events.map((e) => db.attendance.find((a) => a.eventId === e.id && a.userId === r.userId));
          const n = (s: string) => marks.filter((m) => m?.status === s).length;
          return [
            `${personFor(r).firstName} ${personFor(r).lastName}`,
            ...marks.map((m) => (m ? (m.status === "late" ? `late ${m.minutesLate}m` : m.status) + (m.method === "geo" ? " (checked in)" : "") : "")),
            n("present"), n("late"), n("absent"), n("excused"),
          ];
        }),
      ]),
    };
  }

  if (kind === "dues") {
    if (!hasTeamPerm(user.id, teamId, "payments")) return null;
    const fees = db.fees.filter((f) => f.teamId === teamId);
    const rows: unknown[][] = [["Player", "Fee", "Amount", "Paid (confirmed)", "Reported, not confirmed", "Left", "Due by"]];
    for (const f of fees)
      for (const d of db.dues.filter((x) => x.feeId === f.id)) {
        const pays = db.payments.filter((p) => p.dueId === d.id);
        const ok = pays.filter((p) => p.verifiedAt).reduce((n, p) => n + p.amountCents, 0);
        const rep = pays.filter((p) => !p.verifiedAt).reduce((n, p) => n + p.amountCents, 0);
        const p = profileById(d.userId);
        rows.push([`${p?.firstName} ${p?.lastName}`, f.name, (d.amountCents / 100).toFixed(2), (ok / 100).toFixed(2), (rep / 100).toFixed(2), (Math.max(0, d.amountCents - ok) / 100).toFixed(2), f.dueOn]);
      }
    return { filename: `${slug}-dues.csv`, body: csv(rows) };
  }

  if (kind === "events")
    return {
      filename: `${slug}-schedule.csv`,
      body: csv([
        ["Date", "Start", "End", "Type", "Title", "Opponent", "Home/away", "Where", "Status", "Going", "Maybe", "Can't"],
        ...db.events
          .filter((e) => e.teamId === teamId)
          .sort((a, b) => a.startAt.localeCompare(b.startAt))
          .map((e) => {
            const rs = db.rsvps.filter((r) => r.eventId === e.id);
            return [e.startAt.slice(0, 10), e.startAt, e.endAt, EVENT_TYPE_LABEL[e.type], eventTitle(e), e.opponent, e.homeAway, e.locationText ?? db.venues.find((v) => v.id === e.venueId)?.name, e.status, rs.filter((r) => r.response === "going").length, rs.filter((r) => r.response === "maybe").length, rs.filter((r) => r.response === "not_going").length];
          }),
      ]),
    };
  return null;
}
