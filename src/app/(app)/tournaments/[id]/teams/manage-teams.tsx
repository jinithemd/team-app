"use client";

import { useActionState, useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { addGuestAction, clearFixturesAction, generateFixturesAction, inviteTeamAction, removeEntryAction, setEntryAction } from "@/app/tournament-actions";
import type { FormState } from "@/app/actions";
import { Field, Input, buttonClass } from "@/components/ui";

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
          : `Makes every match for the format from the ${accepted} teams that are in. Groups and seeds are set for you.`}
      </p>
      <form action={action} className="grid gap-3">
        <fieldset className="grid gap-1.5">
          <legend className="mb-1 text-sm font-semibold">Draw</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="draw" value="random" defaultChecked className="size-4 accent-[var(--team)]" />
            Random draw
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="draw" value="order" className="size-4 accent-[var(--team)]" />
            Seeded in the order teams joined (first in = top seed)
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
