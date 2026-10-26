"use client";

import { PositionPicker } from "@/components/position-picker";
import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { updateMemberAction, type FormState } from "@/app/actions";
import { Field, Input, buttonClass } from "@/components/ui";
import {
  PERMISSION_LABEL,
  ROLE_LABEL,
  TEAM_PERMISSIONS,
  TEAM_ROLES,
  permissionsForRoles,
  type TeamPermission,
  type TeamRole,
} from "@/lib/data/types";

export function MemberForm({
  teamId,
  memberId,
  isCreator,
  sport,
  initial,
}: {
  teamId: string;
  memberId: string;
  isCreator: boolean;
  sport: string;
  initial: { isPlayer: boolean; jersey: string; position: string; roles: TeamRole[]; permissions: TeamPermission[] };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateMemberAction.bind(null, teamId, memberId), null);
  const fe = state?.fieldErrors ?? {};
  const [plays, setPlays] = useState(initial.isPlayer);
  const [roles, setRoles] = useState<TeamRole[]>(initial.roles);
  const [perms, setPerms] = useState<TeamPermission[]>(isCreator ? [...TEAM_PERMISSIONS] : initial.permissions);

  // Picking a role fills in what that role usually does. Fine-tune below.
  function toggleRole(r: TeamRole) {
    const nextRoles = roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r];
    setRoles(nextRoles);
    if (!isCreator) setPerms(permissionsForRoles(nextRoles));
  }

  return (
    <form action={action} className="grid gap-6" noValidate>
      <fieldset className="grid gap-3">
        <legend className="mb-1 font-semibold">Plays on the team?</legend>
        <input type="hidden" name="plays" value={plays ? "yes" : "no"} />
        <div role="radiogroup" aria-label="Plays on the team?" className="grid grid-cols-2 gap-2">
          {(
            [
              [true, "Yes, plays"],
              [false, "No, staff only"],
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
                <Input id="jersey" name="jersey" inputMode="numeric" maxLength={3} defaultValue={initial.jersey} error={fe.jersey} />
              </Field>
            </div>
            <PositionPicker sport={sport} initial={initial.position} />
          </div>
        )}
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-1 font-semibold">
          Roles <span className="text-sm font-normal text-muted">Pick any. Several people can share a role.</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {TEAM_ROLES.map((r) => {
            const on = roles.includes(r);
            return (
              <label
                key={r}
                className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-pill border px-4 text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
                  on ? "border-team bg-team text-on-team" : "border-border-input bg-bg"
                }`}
              >
                <input type="checkbox" name="role" value={r} checked={on} onChange={() => toggleRole(r)} className="sr-only" />
                {on && <Check aria-hidden className="size-4" />}
                {ROLE_LABEL[r]}
              </label>
            );
          })}
        </div>
        {fe.roles && <p className="text-xs font-medium text-danger">{fe.roles}</p>}
      </fieldset>

      <fieldset className="grid gap-1.5">
        <legend className="mb-1 font-semibold">What they can do</legend>
        {isCreator && <p className="text-xs text-muted">They started this team, so they can always do everything.</p>}
        <div className="grid gap-1 sm:grid-cols-2">
          {TEAM_PERMISSIONS.map((p) => (
            <label key={p} className="flex min-h-10 items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="perm"
                value={p}
                checked={perms.includes(p)}
                disabled={isCreator}
                onChange={() => setPerms((ps) => (ps.includes(p) ? ps.filter((x) => x !== p) : [...ps, p]))}
                className="size-4 accent-[var(--team)]"
              />
              {PERMISSION_LABEL[p]}
            </label>
          ))}
        </div>
        {!isCreator && !perms.length && <p className="text-xs text-muted">No extra permissions: they use the app like any player.</p>}
      </fieldset>

      {state?.error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      <button className={buttonClass("primary", "lg", "w-full sm:w-auto sm:justify-self-start")} disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
