"use client";

import { useActionState, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Shield, UserPlus } from "lucide-react";
import { addGuestAction, clearFixturesAction, saveSeedingAction, generateFixturesAction, inviteTeamAction, removeEntryAction, setEntryAction } from "@/app/tournament-actions";
import type { FormState } from "@/app/actions";
import { Field, Input, TeamCrest, buttonClass, inputClass } from "@/components/ui";

export function InviteButton({ id, teamId, teamName }: { id: string; teamId: string; teamName: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  if (done) return <span className="text-xs font-semibold text-success">{done}</span>;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await inviteTeamAction(id, teamId, teamName);
          setDone(r?.error ?? "Invited");
        })
      }
      className={buttonClass("primary", "sm", "shrink-0")}
    >
      {pending ? "Inviting…" : "Invite"}
    </button>
  );
}

export function GuestForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addGuestAction.bind(null, id), null);
  const fe = state?.fieldErrors ?? {};
  return (
    <details className="rounded-md border border-border p-3">
      <summary className="cursor-pointer text-sm font-semibold text-team-ink">
        <UserPlus aria-hidden className="mr-1.5 inline size-4" />
        Add a team that isn&apos;t on Clbx
      </summary>
      <form action={action} className="mt-3 grid gap-3" noValidate>
        <Field id="guestName" label="Team name" error={fe.guestName}>
          <Input id="guestName" name="guestName" maxLength={80} error={fe.guestName} key={state?.ok ? state.message : "g"} />
        </Field>
        <Field id="guestEmail" label="Contact email" error={fe.guestEmail} hint="Optional. Only organizers see it.">
          <Input id="guestEmail" name="guestEmail" type="email" inputMode="email" error={fe.guestEmail} key={state?.ok ? `${state.message}e` : "e"} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <button className={buttonClass("secondary")} disabled={pending}>
            {pending ? "Adding…" : "Add team"}
          </button>
          {state?.message && <span role="status" className="text-sm text-success">{state.message}</span>}
          {state?.error && !Object.keys(fe).length && <span role="alert" className="text-sm text-danger">{state.error}</span>}
        </div>
      </form>
    </details>
  );
}

export function EntryControls({ id, entry, fee }: { id: string; entry: { id: string; status: string; paid: boolean; name: string }; fee: string | null }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [paid, setPaid] = useState(entry.paid);
  const run = (fn: () => Promise<FormState>) =>
    start(async () => {
      const r = await fn();
      setErr(r?.error ?? null);
    });
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
      {entry.status === "applied" && (
        <>
          <button type="button" disabled={pending} onClick={() => run(() => setEntryAction(id, entry.id, { status: "accepted" }))} className={buttonClass("primary", "sm")} aria-label={`Accept ${entry.name}`}>
            Accept
          </button>
          <button type="button" disabled={pending} onClick={() => run(() => setEntryAction(id, entry.id, { status: "declined" }))} className={buttonClass("secondary", "sm")} aria-label={`Decline ${entry.name}`}>
            Decline
          </button>
        </>
      )}
      {entry.status === "declined" && (
        <button type="button" disabled={pending} onClick={() => run(() => setEntryAction(id, entry.id, { status: "accepted" }))} className={buttonClass("secondary", "sm")}>
          Let them in
        </button>
      )}
      {fee && entry.status === "accepted" && (
        <label className="inline-flex min-h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={paid}
            disabled={pending}
            onChange={(e) => {
              const v = e.target.checked;
              setPaid(v);
              start(async () => {
                const r = await setEntryAction(id, entry.id, { paid: v });
                if (r?.error) {
                  setPaid(!v);
                  setErr(r.error);
                }
              });
            }}
            className="size-5 accent-[var(--team)]"
          />
          Paid {fee}
        </label>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm(`Remove ${entry.name} from the tournament?`)) run(() => removeEntryAction(id, entry.id));
        }}
        className="ml-auto text-sm font-semibold text-muted hover:text-danger"
      >
        Remove
      </button>
      {err && <p role="alert" className="w-full text-xs text-danger">{err}</p>}
    </div>
  );
}

export function FixtureMaker({ id, accepted, hasFixtures, hasResults }: { id: string; accepted: number; hasFixtures: boolean; hasResults: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(generateFixturesAction.bind(null, id), null);
  const [clearing, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <section id="fixtures" aria-labelledby="fx-h" className="grid gap-3 rounded-lg border border-border p-4">
      <h2 id="fx-h" className="text-lg font-semibold">
        Fixtures
      </h2>
      <p className="text-sm text-muted">
        {hasFixtures
          ? "Fixtures are made. Making them again replaces every match."
          : `Makes every match for the format from the ${accepted} teams that are in. Save the seeding first.`}
      </p>
      <form action={action} className="grid gap-3">
        <fieldset className="grid gap-1.5">
          <legend className="mb-1 text-sm font-semibold">Draw</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="draw" value="order" defaultChecked className="size-4 accent-[var(--team)]" />
            Use our seeding (top seeds spread across groups)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="draw" value="random" className="size-4 accent-[var(--team)]" />
            Random draw (ignores seeding, still keeps sets apart)
          </label>
        </fieldset>
        {hasResults && (
          <label className="flex items-start gap-2 text-sm text-danger">
            <input type="checkbox" name="replace" className="mt-0.5 size-4 accent-[var(--danger)]" />
            Start over: delete every result entered so far
          </label>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button className={buttonClass("primary")} disabled={pending || accepted < 2} aria-busy={pending}>
            {pending ? "Making fixtures…" : hasFixtures ? "Make fixtures again" : "Make fixtures"}
          </button>
          {hasFixtures && (
            <button
              type="button"
              disabled={clearing}
              onClick={() => {
                if (confirm("Clear every fixture and result? Teams stay in.")) start(async () => setMsg((await clearFixturesAction(id))?.message ?? null));
              }}
              className="text-sm font-semibold text-danger"
            >
              Clear fixtures
            </button>
          )}
        </div>
        {accepted < 2 && <p className="text-xs text-muted">You need at least 2 teams in.</p>}
        {(state?.error || msg) && (
          <p role="alert" className={`text-sm ${state?.error ? "text-danger" : "text-success"}`}>
            {state?.error ?? msg}
          </p>
        )}
      </form>
    </section>
  );
}

export interface SeedRow {
  id: string;
  name: string;
  teamId: string | null;
  crestUrl: string | null;
  apartSet: number | null;
  hostClub: boolean;
}

/**
 * The host's seeding: drag-free up/down ordering (1 = top seed) and, for group formats,
 * keep-apart sets so chosen teams (like a club's own teams) never share a group.
 */
export function SeedingEditor({ id, rows, groups, groupCount, clubName }: { id: string; rows: SeedRow[]; groups: boolean; groupCount: number; clubName: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSeedingAction.bind(null, id), null);
  const [list, setList] = useState(rows);
  const [dirty, setDirty] = useState(false);
  const change = (next: SeedRow[]) => {
    setList(next);
    setDirty(true);
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    change(next);
  };
  const setApart = (eid: string, v: number | null) => change(list.map((r) => (r.id === eid ? { ...r, apartSet: v } : r)));
  const club = list.filter((r) => r.hostClub);
  const clubApart = club.length >= 2 && club.every((r) => r.apartSet != null && r.apartSet === club[0].apartSet) && list.filter((r) => r.apartSet === club[0].apartSet).length === club.length;
  const keepClubApart = () => {
    const used = new Set(list.filter((r) => !r.hostClub && r.apartSet != null).map((r) => r.apartSet));
    const free = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((n) => !used.has(n)) ?? 1;
    change(list.map((r) => (r.hostClub ? { ...r, apartSet: free } : r)));
  };

  return (
    <section id="seeding" aria-labelledby="seed-h" className="grid gap-3 rounded-lg border border-border p-4">
      <div className="grid gap-1">
        <h2 id="seed-h" className="text-lg font-semibold">
          Seeding
        </h2>
        <p className="text-sm text-muted">
          Put the strongest team at the top. Everyone can see the seeding, so the draw is open and fair.
          {groups ? " Teams in the same keep-apart set never go in the same group." : ""}
        </p>
      </div>
      {groups && club.length >= 2 && !clubApart && (
        <button type="button" onClick={keepClubApart} className={buttonClass("secondary", "md", "justify-self-start")}>
          <Shield aria-hidden />
          Keep {clubName ? `${clubName}'s` : "our club's"} {club.length} teams apart
        </button>
      )}
      <form action={action} className="grid gap-3">
        <ol className="grid gap-2">
          {list.map((r, i) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border p-2.5">
              <input type="hidden" name="order" value={r.id} />
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-sm font-bold tabular-nums" aria-label={`Seed ${i + 1}`}>
                {i + 1}
              </span>
              <TeamCrest teamId={r.teamId ?? "guest"} name={r.name} crestUrl={r.crestUrl} size={24} />
              <span className="min-w-0 flex-1 text-sm font-semibold break-words">
                {r.name}
                {r.hostClub && <span className="ml-1.5 text-xs font-normal text-muted">Host club</span>}
              </span>
              {groups && (
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <span className="sr-only">Keep {r.name} apart, set</span>
                  <span aria-hidden>Apart</span>
                  <select
                    name={`apart_${r.id}`}
                    value={r.apartSet ?? ""}
                    onChange={(e) => setApart(r.id, e.target.value ? Number(e.target.value) : null)}
                    className={`${inputClass} h-10 w-16 px-2 py-0 text-sm`}
                  >
                    <option value="">—</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <span className="flex gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${r.name} up`} className="grid size-10 place-items-center rounded-md border border-border disabled:opacity-40">
                  <ArrowUp aria-hidden className="size-4" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label={`Move ${r.name} down`} className="grid size-10 place-items-center rounded-md border border-border disabled:opacity-40">
                  <ArrowDown aria-hidden className="size-4" />
                </button>
              </span>
            </li>
          ))}
        </ol>
        {groups && <p className="text-xs text-muted">Up to {groupCount} teams per set, one for each group.</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button className={buttonClass("primary")} disabled={pending} aria-busy={pending} onClick={() => setDirty(false)}>
            {pending ? "Saving…" : "Save seeding"}
          </button>
          {dirty && <span className="text-xs text-muted">Not saved yet</span>}
        </div>
        {state && (state.error || state.message) && (
          <p role={state.error ? "alert" : "status"} className={`text-sm ${state.error ? "text-danger" : "text-success"}`}>
            {state.error ?? state.message}
          </p>
        )}
      </form>
    </section>
  );
}
