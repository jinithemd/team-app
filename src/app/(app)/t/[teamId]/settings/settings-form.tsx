"use client";

import { useActionState, useState } from "react";
import { updateTeamAction, type FormState } from "@/app/actions";
import { Field, Input, buttonClass } from "@/components/ui";
import { ImagePicker } from "@/components/image-picker";
import { ColorField } from "../../../teams/new/create-team-form";
import type { PointsRules } from "@/lib/data/types";

type Initial = {
  name: string;
  level: string;
  location: string;
  color: string;
  colorSecondary: string | null;
  rosterVisible: boolean;
  crest: string | null;
  membersCanPost: boolean;
  sponsorChat: boolean;
  pointsEnabled: boolean;
  pointsPublic: boolean;
  geoCheckinEnabled: boolean;
  pointsRules: PointsRules;
};

const RULES: [keyof PointsRules, string, string][] = [
  ["training", "Training attended", "points"],
  ["match", "Match played", "points"],
  ["away_bonus", "Away match bonus", "points"],
  ["potm", "Player of the match", "points"],
  ["late_penalty", "Late penalty", "points (0 or less)"],
  ["late_after_minutes", "Counts as late after", "minutes"],
];

function Toggle({ name, label, hint, defaultChecked, onChange }: { name: string; label: string; hint?: string; defaultChecked: boolean; onChange?: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} onChange={(e) => onChange?.(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--team)]" />
    </label>
  );
}

export function TeamSettingsForm({ teamId, initial, clubName }: { teamId: string; initial: Initial; clubName: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateTeamAction.bind(null, teamId), null);
  const fe = state?.fieldErrors ?? {};
  const [color, setColor] = useState(initial.color);
  const [secondary, setSecondary] = useState<string | null>(initial.colorSecondary);
  const [points, setPoints] = useState(initial.pointsEnabled);
  const initials = initial.name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <form action={action} className="grid gap-7" noValidate>
      <section aria-labelledby="t-h" className="grid gap-4">
        <h3 id="t-h" className="text-lg font-semibold">
          Team
        </h3>
        <Field id="name" label="Team name" error={fe.name}>
          <Input id="name" name="name" maxLength={80} defaultValue={initial.name} error={fe.name} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="level" label="Level or league">
            <Input id="level" name="level" maxLength={40} defaultValue={initial.level} />
          </Field>
          <Field id="location" label="Where you play">
            <Input id="location" name="location" maxLength={60} defaultValue={initial.location} />
          </Field>
        </div>
        <ImagePicker
          name="crest"
          initial={initial.crest}
          label="Crest"
          fallback={<span className="font-display text-xl font-bold text-muted">{initials}</span>}
        />
        {fe.crest && <p className="text-xs font-medium text-danger">{fe.crest}</p>}
        <ColorField label="Team colour" name="color" value={color} onChange={(v) => v && setColor(v)} error={fe.color} />
        <ColorField label="Second colour" name="colorSecondary" value={secondary} onChange={setSecondary} optional />
        {clubName && <p className="text-xs text-muted">Part of {clubName}. The club sets its own name, logo and colours on the club page.</p>}
      </section>

      <section aria-labelledby="w-h" className="grid gap-2 border-t border-border pt-5">
        <h3 id="w-h" className="text-lg font-semibold">
          Who sees what
        </h3>
        <Toggle name="rosterVisible" label="Players can see the roster" hint="Off: players only see themselves. Captains always see everyone." defaultChecked={initial.rosterVisible} />
        <Toggle name="membersCanPost" label="Everyone can post in team chat" hint="Off: only captains and managers post; players can still react and reply." defaultChecked={initial.membersCanPost} />
        <Toggle name="sponsorChat" label="Sponsor chat" hint="A room where your sponsors and the whole team talk. Sponsors see first names and last initials only." defaultChecked={initial.sponsorChat} />
      </section>

      <section aria-labelledby="c-h" className="grid gap-2 border-t border-border pt-5">
        <h3 id="c-h" className="text-lg font-semibold">
          Check-in at the venue
        </h3>
        <Toggle
          name="geoCheckinEnabled"
          label="Let players check in with their location"
          hint="Players tap I'm here at the venue and get marked present or late. We check their location once and keep the distance, not where they were."
          defaultChecked={initial.geoCheckinEnabled}
        />
      </section>

      <section aria-labelledby="p-h" className="grid gap-3 border-t border-border pt-5">
        <h3 id="p-h" className="text-lg font-semibold">
          Points
        </h3>
        <Toggle name="pointsEnabled" label="Give points for turning up" hint="Points come from attendance, so nobody can add their own." defaultChecked={initial.pointsEnabled} onChange={setPoints} />
        {points && (
          <>
            <Toggle name="pointsPublic" label="Players can see the leaderboard" hint="Off: only captains see it." defaultChecked={initial.pointsPublic} />
            <div className="grid gap-3 sm:grid-cols-2">
              {RULES.map(([k, label, unit]) => (
                <Field key={k} id={`rule.${k}`} label={label} error={fe[`rule.${k}`]} hint={unit}>
                  <Input id={`rule.${k}`} name={`rule.${k}`} type="number" defaultValue={initial.pointsRules[k]} error={fe[`rule.${k}`]} className="max-w-28" />
                </Field>
              ))}
            </div>
          </>
        )}
      </section>

      {state?.error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button className={buttonClass("primary", "lg")} disabled={pending} aria-busy={pending}>
          {pending ? "Saving…" : "Save settings"}
        </button>
        <span role="status" className="text-sm text-success">
          {state?.ok && state.message}
        </span>
      </div>
    </form>
  );
}
