"use client";

import { useActionState, useState } from "react";
import { Trophy } from "lucide-react";
import { createTournamentAction, updateTournamentAction } from "@/app/tournament-actions";
import type { FormState } from "@/app/actions";
import { Field, Input, buttonClass, inputClass } from "@/components/ui";
import { ImagePicker } from "@/components/image-picker";
import { LocationPicker } from "@/components/location-picker";
import { FORMAT_HINT, FORMAT_LABEL, type Format } from "@/lib/tournaments/engine";
import type { Tournament } from "@/lib/tournaments/types";

const FORMATS: Format[] = ["groups_knockout", "knockout", "league", "round_robin"];

/** Host a tournament, or edit one (T2). */
export function TournamentForm({ clubs, t, logoUrl, locked }: { clubs: { id: string; name: string }[]; t?: Tournament; logoUrl?: string | null; locked?: boolean }) {
  const editing = !!t;
  const bound = editing ? updateTournamentAction.bind(null, t!.id) : createTournamentAction;
  const [state, action, pending] = useActionState<FormState, FormData>(bound, null);
  const fe = state?.fieldErrors ?? {};
  const [format, setFormat] = useState<Format>(t?.format ?? "groups_knockout");
  const [lat, setLat] = useState(t?.venueLat != null ? String(t.venueLat) : "");
  const [lng, setLng] = useState(t?.venueLng != null ? String(t.venueLng) : "");
  const [venueName, setVenueName] = useState(t?.venueName ?? "");
  const [venueAddress, setVenueAddress] = useState(t?.venueAddress ?? "");
  const [fee, setFee] = useState(t ? (t.feeCents ? String(t.feeCents / 100) : "") : "");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="grid gap-6" noValidate>
      {!editing && (
        <Field id="clubId" label="Hosted by" error={fe.clubId}>
          <select id="clubId" name="clubId" defaultValue={clubs[0]?.id} className={inputClass}>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field id="name" label="Tournament name" error={fe.name}>
        <Input id="name" name="name" maxLength={80} defaultValue={t?.name} placeholder="e.g. Limestone Summer Cup" error={fe.name} />
      </Field>
      <ImagePicker name="logo" initial={logoUrl ?? null} label="Logo" fallback={<Trophy aria-hidden className="size-6 text-muted" />} />
      {fe.logo && <p className="-mt-4 text-xs text-danger">{fe.logo}</p>}

      <fieldset className="grid gap-2" disabled={locked}>
        <legend className="mb-1 text-sm font-semibold">Format</legend>
        {locked && <p className="text-xs text-muted">Fixtures are made, so the format is locked. Clear the fixtures on the Teams tab to change it.</p>}
        <input type="hidden" name="format" value={format} />
        <div role="radiogroup" aria-label="Format" className="grid gap-2 sm:grid-cols-2">
          {FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={format === f}
              onClick={() => setFormat(f)}
              className={`grid gap-0.5 rounded-md border p-3 text-left disabled:opacity-60 ${format === f ? "border-2 border-team bg-team-soft" : "border-border-input bg-bg"}`}
            >
              <span className="text-sm font-semibold">{FORMAT_LABEL[f]}</span>
              <span className="text-xs text-muted">{FORMAT_HINT[f]}</span>
            </button>
          ))}
        </div>
        {format === "league" && (
          <Field id="legs" label="Legs">
            <select id="legs" name="legs" defaultValue={String(t?.legs ?? 2)} className={`${inputClass} max-w-60`}>
              <option value="1">Once (one game per pair)</option>
              <option value="2">Twice (home and away)</option>
            </select>
          </Field>
        )}
        {format === "groups_knockout" && (
          <div className="grid grid-cols-2 gap-3">
            <Field id="groupCount" label="Groups" error={fe.groupCount}>
              <Input id="groupCount" name="groupCount" type="number" min={1} max={16} defaultValue={t?.groupCount ?? 2} error={fe.groupCount} />
            </Field>
            <Field id="advancePerGroup" label="Through from each" error={fe.advancePerGroup}>
              <Input id="advancePerGroup" name="advancePerGroup" type="number" min={1} max={8} defaultValue={t?.advancePerGroup ?? 2} error={fe.advancePerGroup} />
            </Field>
          </div>
        )}
        {format !== "groups_knockout" && (
          <>
            <input type="hidden" name="groupCount" value={t?.groupCount ?? 2} />
            <input type="hidden" name="advancePerGroup" value={t?.advancePerGroup ?? 2} />
          </>
        )}
        {format !== "league" && <input type="hidden" name="legs" value="1" />}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field id="startsOn" label="First day" error={fe.startsOn}>
          <Input id="startsOn" name="startsOn" type="date" defaultValue={t?.startsOn ?? today} error={fe.startsOn} />
        </Field>
        <Field id="endsOn" label="Last day" error={fe.endsOn}>
          <Input id="endsOn" name="endsOn" type="date" defaultValue={t?.endsOn ?? today} error={fe.endsOn} />
        </Field>
      </div>

      <fieldset className="grid gap-3 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-semibold">Venue</legend>
        <LocationPicker
          idPrefix="tvenue"
          lat={lat}
          lng={lng}
          radiusM={150}
          onPin={(a, b) => {
            setLat(a);
            setLng(b);
          }}
          onPlace={(p) => {
            if (!venueName.trim()) setVenueName(p.label.slice(0, 120));
            setVenueAddress([p.label, p.detail].filter(Boolean).join(", ").slice(0, 200));
          }}
        />
        <input type="hidden" name="lat" value={lat} />
        <input type="hidden" name="lng" value={lng} />
        <Field id="venueName" label="Venue name">
          <Input id="venueName" name="venueName" maxLength={120} value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="e.g. Caraco Park" />
        </Field>
        <Field id="venueAddress" label="Address" hint="Optional">
          <Input id="venueAddress" name="venueAddress" maxLength={200} value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} />
        </Field>
      </fieldset>

      <Field id="rules" label="Rules" error={fe.rules} hint="Match length, squad sizes, tie-breakers, what to bring. Shown on the tournament page.">
        <textarea id="rules" name="rules" rows={5} maxLength={5000} defaultValue={t?.rules ?? ""} className={`${inputClass} py-2.5`} />
      </Field>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-semibold">Registration</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field id="fee" label="Entry fee per team ($)" error={fe.fee} hint="Leave blank for free">
            <Input id="fee" name="fee" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0" error={fe.fee} />
          </Field>
          <Field id="maxTeams" label="Most teams" error={fe.maxTeams} hint="Optional">
            <Input id="maxTeams" name="maxTeams" type="number" min={2} max={128} defaultValue={t?.maxTeams ?? ""} error={fe.maxTeams} />
          </Field>
        </div>
        {fee.trim() && Number(fee) > 0 && (
          <Field id="payTo" label="How teams pay" hint="Shown to teams, e.g. e-Transfer to treasurer@club.ca. Mark each team paid on the Teams tab.">
            <Input id="payTo" name="payTo" maxLength={200} defaultValue={t?.payTo ?? ""} />
          </Field>
        )}
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" name="registrationOpen" defaultChecked={t?.registrationOpen ?? true} className="mt-0.5 size-5 shrink-0 accent-[var(--team)]" />
          <span>
            <span className="font-semibold">Teams can apply</span>
            <span className="block text-muted">Captains and managers can enter from the public page. You accept each one.</span>
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" name="isPublic" defaultChecked={t?.isPublic ?? true} className="mt-0.5 size-5 shrink-0 accent-[var(--team)]" />
          <span>
            <span className="font-semibold">Public page</span>
            <span className="block text-muted">Anyone with the link sees fixtures, results and the table. Off: only teams in it and officials.</span>
          </span>
        </label>
      </fieldset>

      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-team-ink">Points for a win, draw and loss</summary>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Field id="pointsWin" label="Win" error={fe.pointsWin}>
            <Input id="pointsWin" name="pointsWin" type="number" defaultValue={t?.pointsWin ?? 3} error={fe.pointsWin} />
          </Field>
          <Field id="pointsDraw" label="Draw" error={fe.pointsDraw}>
            <Input id="pointsDraw" name="pointsDraw" type="number" defaultValue={t?.pointsDraw ?? 1} error={fe.pointsDraw} />
          </Field>
          <Field id="pointsLoss" label="Loss" error={fe.pointsLoss}>
            <Input id="pointsLoss" name="pointsLoss" type="number" defaultValue={t?.pointsLoss ?? 0} error={fe.pointsLoss} />
          </Field>
        </div>
      </details>

      {state?.error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      {state?.ok && state.message && (
        <p role="status" className="text-sm font-medium text-success">
          {state.message}
        </p>
      )}
      <button className={buttonClass("primary", "lg", "w-full sm:w-auto sm:justify-self-start")} disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : editing ? "Save changes" : "Create tournament"}
      </button>
    </form>
  );
}
