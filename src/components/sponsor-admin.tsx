"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { saveSponsorAction, sponsorOpAction, type FormState } from "@/app/actions";
import { Field, Input, buttonClass } from "@/components/ui";
import { ImagePicker } from "@/components/image-picker";
import { SponsorMark, TierBadge } from "@/components/sponsor-badge";
import { SPONSOR_TIERS, TIER_LABEL, type PublicSponsor, type SponsorTier } from "@/lib/data/types";

export type ManagedSponsor = PublicSponsor & {
  status: "active" | "invited" | "ended";
  startsOn: string | null;
  endsOn: string | null;
  contact: { name: string | null; email: string } | null;
};

const day = (d: string | null) => (d ? new Date(d + "T12:00:00Z").toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : null);

export function SponsorRows({ sponsors, editBase, canManage }: { sponsors: ManagedSponsor[]; editBase: string; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const op = (id: string, o: "end" | "restart" | "resend", ok: string) =>
    start(async () => {
      const r = await sponsorOpAction(id, o);
      setMsg(r.ok ? ok : r.error);
      router.refresh();
    });
  return (
    <div className="grid gap-2">
      {msg && <p role="status" className="text-sm font-medium text-success">{msg}</p>}
      <ul className="grid gap-2">
        {sponsors.map((s) => (
          <li key={s.id} className={`grid gap-2 rounded-lg border border-border p-3.5 ${s.status === "ended" ? "opacity-70" : ""}`}>
            <div className="flex items-center gap-3">
              <SponsorMark s={s} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold break-words">{s.name}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <TierBadge tier={s.tier} />
                  {s.status === "invited" && <span className="rounded-pill bg-sunken px-2 py-0.5 text-[11px] font-bold tracking-[.06em] text-muted uppercase">Invite sent</span>}
                  {s.status === "ended" && <span className="rounded-pill bg-sunken px-2 py-0.5 text-[11px] font-bold tracking-[.06em] text-muted uppercase">Ended</span>}
                </div>
              </div>
            </div>
            {canManage && s.contact && (
              <p className="text-sm break-words text-muted">
                {s.contact.name ? `${s.contact.name} · ` : ""}
                <span className="break-all">{s.contact.email}</span>
                {(s.startsOn || s.endsOn) && ` · ${day(s.startsOn) ?? "…"} to ${day(s.endsOn) ?? "open-ended"}`}
              </p>
            )}
            {canManage && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
                <Link href={`${editBase}/${s.id}`} className="text-team-ink">
                  Edit
                </Link>
                <Link href={`/sponsor/${s.id}`} className="inline-flex items-center gap-1 text-team-ink">
                  <Eye aria-hidden className="size-4" />
                  See what they see
                </Link>
                {s.status === "invited" && (
                  <button type="button" disabled={pending} onClick={() => op(s.id, "resend", "Invite sent again.")} className="text-team-ink">
                    Resend invite
                  </button>
                )}
                {s.status !== "ended" ? (
                  <button type="button" disabled={pending} onClick={() => op(s.id, "end", `${s.name}'s sponsorship has ended. Their sponsor page is closed.`)} className="text-muted hover:text-danger">
                    End sponsorship
                  </button>
                ) : (
                  <button type="button" disabled={pending} onClick={() => op(s.id, "restart", `${s.name} is back on.`)} className="text-team-ink">
                    Start again
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SponsorForm({
  scope,
  id,
  back,
  initial,
}: {
  scope: { teamId?: string; clubId?: string };
  id: string | null;
  back: string;
  initial: { name: string; tier: SponsorTier | null; website: string; blurb: string; email: string; startsOn: string; endsOn: string; logo: string | null };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSponsorAction.bind(null, scope, id, back), null);
  const fe = state?.fieldErrors ?? {};
  const [tier, setTier] = useState<SponsorTier | null>(initial.tier);
  return (
    <form action={action} className="grid gap-5" noValidate>
      <Field id="name" label="Business name" error={fe.name}>
        <Input id="name" name="name" maxLength={80} defaultValue={initial.name} placeholder="e.g. Corner Cafe" error={fe.name} />
      </Field>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">Badge (optional)</legend>
        <input type="hidden" name="tier" value={tier ?? ""} />
        <div role="radiogroup" aria-label="Tier" className="flex flex-wrap gap-2">
          <button
            type="button"
            role="radio"
            aria-checked={tier === null}
            onClick={() => setTier(null)}
            className={`min-h-9 rounded-pill border border-border px-3 text-xs font-bold tracking-[.05em] text-muted uppercase ${tier === null ? "outline-2 outline-offset-1 outline-fg" : ""}`}
          >
            No badge
          </button>
          {SPONSOR_TIERS.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tier === t}
              aria-label={TIER_LABEL[t]}
              onClick={() => setTier(t)}
              className={`rounded-pill p-1 ${tier === t ? "outline-2 outline-offset-1 outline-fg" : ""}`}
            >
              <TierBadge tier={t} size="lg" />
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">Higher badges show first and bigger wherever sponsors appear. Sponsors without a badge show after them.</p>
        {fe.tier && <p className="text-xs font-medium text-danger">{fe.tier}</p>}
      </fieldset>
      <ImagePicker name="logo" initial={initial.logo} label="Logo" fallback={<span className="text-xs text-muted">No logo</span>} />
      {fe.logo && <p className="-mt-3 text-xs font-medium text-danger">{fe.logo}</p>}
      <Field id="website" label="Website (optional)" error={fe.website}>
        <Input id="website" name="website" type="url" defaultValue={initial.website} placeholder="https://" error={fe.website} />
      </Field>
      <Field id="blurb" label="A line about them (optional)" hint="Shown on the sponsor strip for Diamond and Platinum.">
        <Input id="blurb" name="blurb" maxLength={200} defaultValue={initial.blurb} placeholder="e.g. Post-match coffee on us" />
      </Field>
      <Field
        id="email"
        label="Contact email (optional)"
        error={fe.email}
        hint={id ? "Add or change it to hand the sponsor their own page. They'll get an invite." : "Add one and they get an invite to their own sponsor page. Leave it blank to just show them as a sponsor."}
      >
        <Input id="email" name="email" type="email" defaultValue={initial.email} error={fe.email} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="startsOn" label="From (optional)" error={fe.startsOn}>
          <Input id="startsOn" name="startsOn" type="date" defaultValue={initial.startsOn} error={fe.startsOn} />
        </Field>
        <Field id="endsOn" label="Until (optional)" error={fe.endsOn} hint="Their page closes after this">
          <Input id="endsOn" name="endsOn" type="date" defaultValue={initial.endsOn} error={fe.endsOn} />
        </Field>
      </div>
      <section className="rounded-md bg-surface p-3.5 text-sm">
        <p className="font-semibold">What sponsors see</p>
        <p className="text-muted">Matches, tournaments and socials (date, opponent, venue), scores and player of the match, and news you choose to share. Never the roster, who&apos;s coming, chat, attendance, dues or anyone&apos;s contact details.</p>
      </section>
      {state?.error && !Object.keys(fe).length && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button className={buttonClass("primary", "lg", "w-full sm:w-auto sm:justify-self-start")} disabled={pending}>
        {pending ? "Saving…" : id ? "Save" : "Add sponsor"}
      </button>
    </form>
  );
}

