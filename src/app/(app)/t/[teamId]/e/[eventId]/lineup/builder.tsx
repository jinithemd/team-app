"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shuffle, X } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { FORMATIONS, SIDES, autoPick, sizeOf, slotsFor } from "@/lib/lineups/formations";
import type { Lineup, LineupPlayer } from "@/lib/lineups/service";
import { saveLineupAction } from "@/app/lineup-actions";

/*
 * Pick the team: choose a formation, tap a spot on the pitch, then tap who plays there.
 * Tap a player who's already on the pitch to move them; the bench takes everyone else you want.
 * Read-only for players: they see the same pitch without the controls.
 */

const RESPONSE: Record<string, { label: string; cls: string }> = {
  going: { label: "Going", cls: "bg-success-soft text-success" },
  maybe: { label: "Maybe", cls: "bg-warning-soft text-warning" },
  not_going: { label: "Can't", cls: "bg-danger-soft text-danger" },
};

const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

export function LineupBuilder({
  teamId,
  eventId,
  canEdit,
  players,
  initial,
  saved,
  squadSize,
}: {
  teamId: string;
  eventId: string;
  canEdit: boolean;
  players: LineupPlayer[];
  initial: Lineup;
  saved: boolean;
  squadSize: number | null;
}) {
  const router = useRouter();
  const [formation, setFormation] = useState(initial.formation);
  const [slots, setSlots] = useState<(string | null)[]>(() => {
    const n = sizeOf(initial.formation);
    return Array.from({ length: n }, (_, i) => initial.slots[i] ?? null);
  });
  const [subs, setSubs] = useState<string[]>(initial.subs);
  const [pick, setPick] = useState<number | null>(null);
  const [dirty, setDirty] = useState(!saved);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const spots = slotsFor(formation);
  const side = sizeOf(formation);
  const placed = new Set(slots.filter(Boolean) as string[]);
  const going = players.filter((p) => p.response === "going");

  const change = (fn: () => void) => {
    fn();
    setDirty(true);
    setMsg(null);
  };

  const chooseFormation = (f: string) =>
    change(() => {
      // Keep whoever was on the pitch, in order, and put any overflow on the bench.
      const n = sizeOf(f);
      const on = slots.filter(Boolean) as string[];
      setFormation(f);
      setSlots(Array.from({ length: n }, (_, i) => on[i] ?? null));
      setSubs((s) => [...on.slice(n), ...s.filter((x) => !on.includes(x))]);
      setPick(null);
    });

  const chooseSide = (n: number) => chooseFormation(FORMATIONS[n][0]);

  const place = (playerId: string) =>
    change(() => {
      if (pick == null) return;
      const next = [...slots];
      const from = next.indexOf(playerId);
      if (from >= 0) next[from] = next[pick];
      else if (next[pick]) setSubs((s) => [next[pick]!, ...s.filter((x) => x !== playerId)]);
      next[pick] = playerId;
      setSlots(next);
      setSubs((s) => s.filter((x) => x !== playerId));
      setPick(null);
    });

  const tapSpot = (i: number) => {
    if (!canEdit) return;
    if (pick === i) return setPick(null);
    if (pick != null && slots[pick] && pick !== i) {
      // Swap two spots on the pitch.
      return change(() => {
        const next = [...slots];
        [next[pick], next[i]] = [next[i], next[pick]];
        setSlots(next);
        setPick(null);
      });
    }
    setPick(i);
  };

  const clearSpot = () =>
    change(() => {
      if (pick == null) return;
      const next = [...slots];
      next[pick] = null;
      setSlots(next);
      setPick(null);
    });

  const toggleSub = (id: string) =>
    change(() => {
      if (placed.has(id)) {
        setSlots((s) => s.map((x) => (x === id ? null : x)));
        setSubs((s) => [id, ...s]);
      } else setSubs((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    });

  const auto = () =>
    change(() => {
      const r = autoPick(formation, going.map((p) => ({ id: p.id, line: p.line })));
      setSlots(r.slots);
      setSubs(r.subs);
      setPick(null);
    });

  const save = () =>
    start(async () => {
      const r = await saveLineupAction(teamId, eventId, { formation, slots, subs });
      if (r.ok) {
        setDirty(false);
        setMsg({ ok: true, text: "Team saved. Everyone on the team can see it now." });
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });

  const sides = SIDES.filter((n) => n <= Math.max(11, squadSize ?? 11));

  return (
    <div className="grid gap-4">
      {canEdit && (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="side" className="text-sm font-semibold">
              Players a side
            </label>
            <select id="side" value={side} onChange={(e) => chooseSide(Number(e.target.value))} className="min-h-10 rounded-md border border-border-input bg-bg px-2 text-sm">
              {sides.map((n) => (
                <option key={n} value={n}>
                  {n}-a-side
                </option>
              ))}
            </select>
            <button type="button" onClick={auto} disabled={going.length === 0} className={buttonClass("secondary", "md", "ml-auto")}>
              <Shuffle aria-hidden />
              Auto-pick
            </button>
          </div>
          <div role="radiogroup" aria-label="Formation" className="flex flex-wrap gap-1.5">
            {FORMATIONS[side].map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={f === formation}
                onClick={() => chooseFormation(f)}
                className={`min-h-10 rounded-pill border px-3.5 text-sm font-semibold tabular ${f === formation ? "border-team bg-team text-on-team" : "border-border text-fg hover:bg-sunken"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* The pitch */}
      <div className="relative mx-auto aspect-[68/92] w-full max-w-md overflow-hidden rounded-xl" style={{ background: "repeating-linear-gradient(180deg, #2E8B47 0 9%, #2A7F41 9% 18%)" }}>
        <svg aria-hidden viewBox="0 0 68 92" className="absolute inset-0 size-full">
          <g fill="none" stroke="rgba(255,255,255,.75)" strokeWidth=".5">
            <rect x="2" y="2" width="64" height="88" />
            <line x1="2" y1="46" x2="66" y2="46" />
            <circle cx="34" cy="46" r="8" />
            <rect x="15" y="75" width="38" height="15" />
            <rect x="25" y="85" width="18" height="5" />
            <rect x="15" y="2" width="38" height="15" />
            <rect x="25" y="2" width="18" height="5" />
          </g>
        </svg>
        <ol aria-label="Starting line-up" className="absolute inset-0">
          {spots.map((s, i) => {
            const p = slots[i] ? byId.get(slots[i]!) : undefined;
            const active = pick === i;
            return (
              <li key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
                <button
                  type="button"
                  onClick={() => tapSpot(i)}
                  disabled={!canEdit}
                  aria-label={p ? `${s.line}: ${p.name}${canEdit ? ". Tap to move" : ""}` : `${s.line}: empty${canEdit ? ". Tap to pick a player" : ""}`}
                  aria-pressed={canEdit ? active : undefined}
                  className="grid w-[4.6rem] justify-items-center gap-0.5 focus-visible:outline-none"
                >
                  <span
                    className={`grid size-11 place-items-center overflow-hidden rounded-full border-2 text-sm font-bold shadow-md ${
                      p ? "border-[#FFFFFF] bg-team text-on-team" : "border-dashed border-[rgba(255,255,255,.8)] bg-[rgba(0,0,0,.2)] text-[#FFFFFF]"
                    } ${active ? "ring-4 ring-[#FFD84D]" : ""}`}
                  >
                    {p ? p.jersey ?? initials(p.name) : <span className="text-[10px]">{s.line}</span>}
                  </span>
                  <span className={`max-w-full truncate rounded px-1 text-[11px] font-semibold ${p ? "bg-[rgba(0,0,0,.55)] text-[#FFFFFF]" : "text-[rgba(255,255,255,.85)]"}`}>{p ? p.short : canEdit ? "Pick" : ""}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {canEdit && pick != null && (
        <div role="status" className="flex items-center gap-2 rounded-md bg-team-soft px-3 py-2 text-sm">
          <span className="flex-1">
            {slots[pick] ? `Tap a player to swap with ${byId.get(slots[pick]!)?.short}, or another spot to switch.` : `Who plays ${spots[pick].line}? Tap a player below.`}
          </span>
          {slots[pick] && (
            <button type="button" onClick={clearSpot} className="inline-flex min-h-9 items-center gap-1 font-semibold text-danger">
              <X aria-hidden className="size-4" />
              Take off
            </button>
          )}
        </div>
      )}

      {/* Subs */}
      <section aria-labelledby="subs-h" className="grid gap-2">
        <h3 id="subs-h" className="font-semibold">
          Subs <span className="font-normal text-muted">({subs.length})</span>
        </h3>
        {subs.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {subs.map((id) => {
              const p = byId.get(id);
              return p ? (
                <li key={id} className="inline-flex min-h-9 items-center gap-1.5 rounded-pill bg-sunken px-3 text-sm font-semibold">
                  {p.jersey && <span className="text-muted tabular">{p.jersey}</span>}
                  {p.name}
                </li>
              ) : null;
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">No subs yet.</p>
        )}
      </section>

      {canEdit && (
        <section aria-labelledby="squad-h" className="grid gap-2">
          <h3 id="squad-h" className="font-semibold">
            Squad
          </h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {players.map((p) => {
              const on = placed.has(p.id);
              const sub = subs.includes(p.id);
              const r = p.response ? RESPONSE[p.response] : null;
              return (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => pick != null && place(p.id)}
                    disabled={pick == null}
                    aria-label={pick != null ? `Put ${p.name} in this spot` : p.name}
                    className={`flex min-w-0 flex-1 items-center gap-3 text-left ${pick != null ? "cursor-pointer rounded-md hover:bg-sunken" : ""}`}
                  >
                    <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-sunken text-xs font-bold text-muted">
                      {p.photo ? <img src={p.photo} alt="" className="size-full object-cover" /> : initials(p.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {p.name}
                        {p.jersey && <span className="font-normal text-muted"> #{p.jersey}</span>}
                      </span>
                      <span className="block truncate text-xs text-muted">{[p.position, on ? "Starting" : sub ? "Sub" : null].filter(Boolean).join(" · ") || "No position set"}</span>
                    </span>
                  </button>
                  {r && <span className={`shrink-0 rounded-pill px-2 py-0.5 text-xs font-semibold ${r.cls}`}>{r.label}</span>}
                  <button type="button" onClick={() => toggleSub(p.id)} className="min-h-9 shrink-0 rounded-md px-2 text-xs font-semibold text-team-ink hover:bg-sunken">
                    {on ? "To bench" : sub ? "Off bench" : "Bench"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {canEdit && (
        <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom,0px))] z-10 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-bg p-3 shadow-md lg:bottom-4">
          <button type="button" onClick={save} disabled={pending || !dirty} className={buttonClass("primary", "md")} aria-busy={pending}>
            {saved && !dirty ? "Team saved" : "Save team"}
          </button>
          <span className="text-sm text-muted">
            {slots.filter(Boolean).length} of {side} picked{subs.length ? ` · ${subs.length} subs` : ""}
          </span>
          {msg && (
            <p role={msg.ok ? "status" : "alert"} className={`w-full text-sm ${msg.ok ? "text-success" : "text-danger"}`}>
              {msg.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
