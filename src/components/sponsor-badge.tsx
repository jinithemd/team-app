import { Award, Gem, Medal } from "lucide-react";
import type { PublicSponsor, SponsorTier } from "@/lib/data/types";
import { TIER_LABEL } from "@/lib/data/types";

// Light metal chips with dark text: readable on light and dark pages (all >= 6:1).
const TIER_STYLE: Record<SponsorTier, { bg: string; fg: string; ring: string }> = {
  diamond: { bg: "linear-gradient(135deg,#DCEFFB,#E9F6FD)", fg: "#0B4F6C", ring: "#9FD3EE" },
  platinum: { bg: "linear-gradient(135deg,#E4E7EC,#F4F5F7)", fg: "#353B45", ring: "#C3C8D0" },
  gold: { bg: "linear-gradient(135deg,#FBE3A0,#FDF1CF)", fg: "#6B4A00", ring: "#E9C35A" },
  silver: { bg: "linear-gradient(135deg,#E8ECF0,#F6F8FA)", fg: "#4A5361", ring: "#CDD3DA" },
  bronze: { bg: "linear-gradient(135deg,#F2D2B6,#FAE6D6)", fg: "#7A3712", ring: "#DDA77F" },
};

export function TierBadge({ tier, size = "sm" }: { tier: SponsorTier; size?: "sm" | "lg" }) {
  const s = TIER_STYLE[tier];
  const Icon = tier === "diamond" ? Gem : tier === "platinum" ? Award : Medal;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill font-bold tracking-[.05em] uppercase ring-1 ${size === "lg" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[11px]"}`}
      style={{ background: s.bg, color: s.fg, ["--tw-ring-color" as string]: s.ring }}
    >
      <Icon aria-hidden className={size === "lg" ? "size-4" : "size-3.5"} />
      {TIER_LABEL[tier]}
      <span className="sr-only"> sponsor</span>
    </span>
  );
}

export function SponsorMark({ s, big }: { s: Pick<PublicSponsor, "name" | "logo">; big?: boolean }) {
  const initials = s.name.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const box = big ? "size-14 text-lg" : "size-10 text-sm";
  return s.logo ? (
    <img src={s.logo} alt="" className={`${box} shrink-0 rounded-md bg-white object-contain p-0.5 ring-1 ring-border`} />
  ) : (
    <span aria-hidden className={`${box} grid shrink-0 place-items-center rounded-md bg-sunken font-display font-bold text-muted`}>
      {initials}
    </span>
  );
}

/** "Our sponsors": top tiers first and bigger. Links go to the sponsor's own site. */
export function SponsorStrip({ sponsors, title = "Our sponsors", manageHref }: { sponsors: PublicSponsor[]; title?: string; manageHref?: string }) {
  if (!sponsors.length && !manageHref) return null;
  return (
    <section aria-labelledby="sponsors-h" className="grid gap-2.5 rounded-lg border border-border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="sponsors-h" className="eyebrow">
          {title}
        </h2>
        {manageHref && (
          <a href={manageHref} className="text-sm font-semibold text-team-ink">
            {sponsors.length ? "Manage" : "Add a sponsor"}
          </a>
        )}
      </div>
      {sponsors.length === 0 ? (
        <p className="text-sm text-muted">No sponsors yet. Local businesses can back the team and follow your results.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {sponsors.map((s) => {
            const top = s.tier === "diamond" || s.tier === "platinum";
            const body = (
              <>
                <SponsorMark s={s} big={top} />
                <span className="min-w-0 flex-1">
                  <span className={`block font-semibold break-words ${top ? "text-base" : "text-sm"}`}>{s.name}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <TierBadge tier={s.tier} />
                    {s.scope === "club" && <span className="text-xs text-muted">Club sponsor</span>}
                  </span>
                  {s.blurb && top && <span className="mt-1 block text-xs text-muted">{s.blurb}</span>}
                </span>
              </>
            );
            return (
              <li key={s.id} className={top ? "sm:col-span-2" : ""}>
                {s.website ? (
                  <a href={s.website} target="_blank" rel="noreferrer sponsored" className="flex items-center gap-3 rounded-md p-1.5 hover:bg-surface">
                    {body}
                  </a>
                ) : (
                  <div className="flex items-center gap-3 p-1.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
