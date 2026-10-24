"use client";

import { useActionState, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { saveAttendanceAction, type FormState } from "@/app/actions";
import { buttonClass } from "@/components/ui";
import { pointsForAttendance } from "@/lib/data/rules";
import type { Attendance, AttendanceStatus, EventType, PointsRules, RsvpResponse, UnavailableKind } from "@/lib/data/types";
import { formatTime } from "@/lib/time";

type Row = {
  userId: string;
  person: { firstName: string; lastName: string };
  jersey: string | null;
  response: RsvpResponse | null;
  note: string | null;
  unavailable: UnavailableKind | null;
  mark: Attendance | null;
};

const OPTS: { v: AttendanceStatus; short: string; label: string; on: string }[] = [
  { v: "present", short: "P", label: "Present", on: "bg-success text-on-success" },
  { v: "late", short: "L", label: "Late", on: "bg-warning text-on-warning" },
  { v: "absent", short: "A", label: "Absent", on: "bg-danger text-on-danger" },
  { v: "excused", short: "E", label: "Excused", on: "bg-muted text-bg" },
];
const SAID: Record<RsvpResponse, string> = { going: "Said going", maybe: "Said maybe", not_going: "Said can't go" };

export function AttendanceSheet({
  eventId,
  teamId,
  event,
  rows,
  rules,
  pointsEnabled,
  locked,
}: {
  eventId: string;
  teamId: string;
  event: { type: EventType; homeAway: "home" | "away" | "neutral" | null; startAt: string; tz: string };
  rows: Row[];
  rules: PointsRules;
  pointsEnabled: boolean;
  locked: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAttendanceAction.bind(null, eventId, teamId), null);
  const fe = state?.fieldErrors ?? {};
  const [marks, setMarks] = useState<Record<string, { status: AttendanceStatus | ""; mins: string }>>(() =>
    Object.fromEntries(rows.map((r) => [r.userId, { status: r.mark?.status ?? "", mins: r.mark?.minutesLate ? String(r.mark.minutesLate) : "" }])),
  );
  const set = (u: string, patch: Partial<{ status: AttendanceStatus | ""; mins: string }>) => setMarks((m) => ({ ...m, [u]: { ...m[u], ...patch } }));
  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, excused: 0, none: 0 };
    rows.forEach((r) => c[(marks[r.userId].status || "none") as keyof typeof c]++);
    return c;
  }, [marks, rows]);
  const geo = rows.filter((r) => r.mark?.method === "geo").length;

  function markGoing() {
    setMarks((m) => {
      const n = { ...m };
      rows.forEach((r) => {
        if (!n[r.userId].status) n[r.userId] = { ...n[r.userId], status: r.response === "going" ? "present" : r.unavailable ? "excused" : n[r.userId].status };
      });
      return n;
    });
  }

  return (
    <form action={action} className="grid gap-4" noValidate>
      <div className="flex flex-wrap gap-2 text-sm font-semibold" aria-live="polite">
        <span className="rounded-md bg-success-soft px-2.5 py-1 text-success">{counts.present} present</span>
        <span className="rounded-md bg-warning-soft px-2.5 py-1 text-warning">{counts.late} late</span>
        <span className="rounded-md bg-danger-soft px-2.5 py-1 text-danger">{counts.absent} absent</span>
        <span className="rounded-md bg-sunken px-2.5 py-1 text-muted">{counts.none} to mark</span>
      </div>
      <p className="text-sm text-muted">
        {geo > 0 && (
          <span className="font-semibold text-success">
            <MapPin aria-hidden className="mr-0.5 inline size-3.5" />
            {geo} checked in at the venue, marked for you.{" "}
          </span>
        )}
        Arriving {rules.late_after_minutes} minutes or more after the start counts as late.
      </p>
      {counts.none > 0 && !locked && (
        <button type="button" onClick={markGoing} className="justify-self-start text-sm font-semibold text-team-ink">
          Mark everyone who said going as present
        </button>
      )}

      <ul className="grid">
        {rows.map((r) => {
          const m = marks[r.userId];
          const pts = pointsEnabled && m.status ? pointsForAttendance(event, { status: m.status, minutesLate: m.status === "late" ? Number(m.mins || 0) : null }, rules) : [];
          const total = pts.reduce((s, p) => s + p.points, 0);
          const name = `${r.person.firstName} ${r.person.lastName}`;
          const sub = [
            r.mark?.method === "geo" && r.mark.checkedInAt ? `Checked in ${formatTime(r.mark.checkedInAt, event.tz)} · ${r.mark.distanceM} m` : null,
            r.unavailable && !r.response ? (r.unavailable === "injured" ? "Injured" : r.unavailable === "away" ? "Away" : "Unavailable") : r.response ? SAID[r.response] : "No answer",
            r.note,
          ].filter(Boolean);
          return (
            <li key={r.userId} className="grid gap-2 border-b border-border py-3 last:border-0">
              <input type="hidden" name="uid" value={r.userId} />
              <input type="hidden" name={`s.${r.userId}`} value={m.status} />
              <div className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-pill bg-team-soft font-display text-base font-bold text-team-ink tabular">{r.jersey ?? "–"}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold break-words">{name}</p>
                  <p className={`text-xs ${r.mark?.method === "geo" ? "text-success" : "text-muted"}`}>
                    {sub.join(" · ")}
                    {pointsEnabled && m.status ? <span className="text-muted"> · {total > 0 ? `+${total}` : total} pts</span> : null}
                  </p>
                </div>
                <div role="radiogroup" aria-label={`Attendance for ${name}`} className="flex shrink-0 overflow-hidden rounded-md border border-border-input">
                  {OPTS.map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      role="radio"
                      aria-checked={m.status === o.v}
                      aria-label={`${o.label}`}
                      title={o.label}
                      disabled={locked}
                      onClick={() => set(r.userId, { status: m.status === o.v ? "" : o.v })}
                      className={`grid size-10 place-items-center border-l border-border text-sm font-bold first:border-l-0 disabled:opacity-60 ${m.status === o.v ? o.on : "bg-bg text-fg"}`}
                    >
                      {o.short}
                    </button>
                  ))}
                </div>
              </div>
              {m.status === "late" && (
                <label className="ml-11 flex items-center gap-2 text-sm">
                  <input
                    name={`m.${r.userId}`}
                    type="number"
                    min={1}
                    max={600}
                    value={m.mins}
                    onChange={(e) => set(r.userId, { mins: e.target.value })}
                    aria-label={`Minutes late for ${name}`}
                    aria-invalid={fe[`late.${r.userId}`] ? true : undefined}
                    className="min-h-10 w-20 rounded-md border border-border-input bg-bg px-2 text-base"
                  />
                  minutes late
                  {fe[`late.${r.userId}`] && <span className="text-xs font-medium text-danger">{fe[`late.${r.userId}`]}</span>}
                </label>
              )}
            </li>
          );
        })}
      </ul>

      {state?.error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button className={buttonClass("primary", "lg", "w-full sm:w-auto")} disabled={pending || locked} aria-busy={pending}>
          {pending ? "Saving…" : "Save attendance"}
        </button>
        <span role="status" className="text-sm text-success">
          {state?.ok && state.message}
        </span>
      </div>
      <p className="text-xs text-muted">{pointsEnabled ? "Points update when you save. " : ""}Your mark always wins over a check-in, and you can fix it until the season closes.</p>
    </form>
  );
}
