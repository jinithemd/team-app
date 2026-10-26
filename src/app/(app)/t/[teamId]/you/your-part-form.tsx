"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { setMyPartAction, type FormState } from "@/app/actions";
import { Avatar, Field, Input, buttonClass } from "@/components/ui";
import { HatBadges } from "@/components/hats";
import { PositionPicker } from "@/components/position-picker";
import { TEAM_ROLES, ROLE_LABEL, hatLabels, type ClubRole, type TeamRole } from "@/lib/data/types";

export function YourPartForm({
  teamId,
  next,
  submitLabel,
  name,
  clubRole,
  canChangeRoles,
  sport,
  photo,
  initial,
}: {
  teamId: string;
  next: string;
  submitLabel: string;
  name: string;
  clubRole: ClubRole | null;
  canChangeRoles: boolean;
  sport: string;
  photo: string | null;
  initial: { isPlayer: boolean; jersey: string; position: string; roles: TeamRole[] };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(setMyPartAction.bind(null, teamId, next), null);
  const fe = state?.fieldErrors ?? {};
  const [plays, setPlays] = useState(initial.isPlayer);
  const [jersey, setJersey] = useState(initial.jersey);
  const [position, setPosition] = useState(initial.position);
  const [roles, setRoles] = useState<TeamRole[]>(initial.roles);
  const toggle = (r: TeamRole) => setRoles((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));
  const labels = hatLabels({ isPlayer: plays, roles: TEAM_ROLES.filter((r) => roles.includes(r)), clubRole, isCreator: false }, jersey);

  return (
    <form action={action} className="grid gap-6" noValidate>
      <fieldset className="grid gap-3">
        <legend className="mb-1 font-semibold">Do you play on this team?</legend>
        <input type="hidden" name="plays" value={plays ? "yes" : "no"} />
        <div role="radiogroup" aria-label="Do you play on this team?" className="grid grid-cols-2 gap-2">
          {(
            [
              [true, "Yes, I play"],
              [false, "No, I just run it"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={plays === v}
              onClick={() => setPlays(v)}
              className={`min-h-12 rounded-md border text-sm font-semibold ${plays === v ? "border-2 border-team bg-team-soft text-team-ink" : "border-border-input bg-bg"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {plays && (
          <div className="grid gap-4">
            <div className="max-w-24">
              <Field id="jersey" label="Number" error={fe.jersey}>
                <Input id="jersey" name="jersey" inputMode="numeric" maxLength={3} value={jersey} onChange={(e) => setJersey(e.target.value)} error={fe.jersey} />
              </Field>
            </div>
            <PositionPicker sport={sport} initial={initial.position} onChange={setPosition} />
          </div>
        )}
      </fieldset>

      <fieldset className="grid gap-2" aria-describedby={fe.roles ? "roles-error" : undefined}>
        <legend className="mb-1 font-semibold">
          Any other roles? <span className="text-sm font-normal text-muted">Pick all that fit</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {TEAM_ROLES.map((r) => {
            const on = roles.includes(r);
            return (
              <label
                key={r}
                className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-pill border px-4 text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
                  on ? "border-team bg-team text-on-team" : "border-border-input bg-bg"
                } ${!canChangeRoles ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <input type="checkbox" name="role" value={r} checked={on} onChange={() => toggle(r)} disabled={!canChangeRoles} className="sr-only" />
                {on && <Check aria-hidden className="size-4" />}
                {ROLE_LABEL[r]}
              </label>
            );
          })}
        </div>
        {!canChangeRoles && (
          <>
            {roles.map((r) => (
              <input key={r} type="hidden" name="role" value={r} />
            ))}
            <p className="text-xs text-muted">Only someone who manages permissions can change roles. Ask your captain.</p>
          </>
        )}
        {fe.roles && (
          <p id="roles-error" className="text-xs font-medium text-danger">
            {fe.roles}
          </p>
        )}
      </fieldset>

      <section aria-labelledby="preview-h" className="grid gap-2 rounded-lg border border-border p-3.5">
        <h3 id="preview-h" className="eyebrow">
          How you&apos;ll show on the roster
        </h3>
        <div className="flex items-center gap-3">
          <Avatar name={name} src={photo} />
          <div className="min-w-0">
            <p className="font-semibold break-words">
              {name}
              {plays && position ? ` · ${position}` : ""}
            </p>
            <HatBadges labels={labels} />
          </div>
        </div>
        <a href="/account" className="text-xs font-semibold text-team-ink underline">
          {photo ? "Change your photo" : "Add a profile photo"}
        </a>
        <p className="text-xs text-muted">
          {plays
            ? "You'll answer, check in and vote like any player, and see the captain tools under each event."
            : "You won't get asked if you're in for games, but you'll see every answer and the captain tools."}
        </p>
      </section>

      {state?.error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      <button className={buttonClass("primary", "lg", "w-full sm:w-auto sm:justify-self-start")} disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
