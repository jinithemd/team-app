"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, Expand, Gavel } from "lucide-react";
import type { AuctionView, PlayerView, SquadView } from "@/lib/auction/service";

/*
 * The big screen: the auction on a TV or projector for the whole team and the fans.
 *
 * A card table. Every player is a collectable card (our own design): a foil frame, shirt number
 * and position badge, photo, and a name plate. Players whose base price was raised above the
 * auction's standard price are gold "Marquee" cards; the rest are silver. When a player comes up
 * their card flips over from the deck with one sweep of foil light. That is the one big motion.
 * Each team's signings sit along the bottom as a fanned hand of mini cards.
 *
 * Drawn on a fixed 1920×1080 stage and scaled to fit any screen; on a phone held upright the
 * stage turns sideways, and Full screen asks the phone to lock to landscape where it can.
 */

type ScreenView = AuctionView & { teamColor: string; teamColor2: string | null };
type Recent = AuctionView["recent"][number];

const W = 1920;
const H = 1080;
const FELT = "#120E24";
const INK = "#0A0816";
const LINE = "rgba(255,255,255,.12)";
const DIM = "rgba(255,255,255,.62)";
const WHITE = "#FFFFFF";
const HOT = "#FF4D5E";

type Tier = "gold" | "silver";
const TIERS: Record<Tier, { label: string; frame: string; edge: string; ink: string; glow: string; plate: string }> = {
  gold: {
    label: "Marquee",
    frame: "linear-gradient(145deg, #FFF0B8 0%, #F2C556 22%, #B5801F 48%, #F7D877 70%, #9C6A16 100%)",
    edge: "#E9B949",
    ink: "#3A2604",
    glow: "rgba(242,197,86,.55)",
    plate: "linear-gradient(180deg, #2A1C05, #120B02)",
  },
  silver: {
    label: "Player",
    frame: "linear-gradient(145deg, #FFFFFF 0%, #D6DEE9 24%, #8592A6 50%, #E9EEF5 72%, #6E7A8E 100%)",
    edge: "#C9D3E0",
    ink: "#1B2230",
    glow: "rgba(201,211,224,.45)",
    plate: "linear-gradient(180deg, #1C2230, #0D1119)",
  },
};

const STYLE = `
.au-root { font-family: Inter, system-ui, sans-serif; color: ${WHITE}; }
.au-hd { font-family: Barlow, "Barlow Condensed", Inter, sans-serif; font-style: italic; font-weight: 800; letter-spacing: -0.01em; }
.au-num { font-variant-numeric: tabular-nums; }
.au-dim { color: ${DIM}; }
@keyframes au-flip { 0% { transform: perspective(1800px) rotateY(180deg) scale(.86); } 55% { transform: perspective(1800px) rotateY(-8deg) scale(1.03); } 100% { transform: perspective(1800px) rotateY(0) scale(1); } }
@keyframes au-sheen { 0% { transform: translateX(-130%) skewX(-18deg); opacity: 0 } 15% { opacity: .9 } 100% { transform: translateX(230%) skewX(-18deg); opacity: 0 } }
@keyframes au-stamp { 0% { transform: rotate(-12deg) scale(2.6); opacity: 0 } 18% { transform: rotate(-12deg) scale(.94); opacity: 1 } 26%, 100% { transform: rotate(-12deg) scale(1) } }
@keyframes au-show { 0%, 92% { opacity: 1 } 100% { opacity: 0 } }
@keyframes au-bump { 0% { transform: scale(1.1) } 100% { transform: scale(1) } }
@keyframes au-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .35 } }
.au-flip { animation: au-flip 1.1s cubic-bezier(.2,.8,.25,1) both; transform-style: preserve-3d; }
.au-sheen { animation: au-sheen 1.6s .55s ease-out both; }
.au-stamp { animation: au-stamp 6s cubic-bezier(.2,.9,.3,1.2) forwards }
.au-show { animation: au-show 6s linear forwards }
.au-bump { animation: au-bump .45s ease-out }
.au-dot { animation: au-pulse 1.2s ease-in-out infinite }
.au-btn:hover { background-color: rgba(255,255,255,.1) }
@media (prefers-reduced-motion: reduce) { .au-flip, .au-sheen, .au-bump, .au-dot { animation: none } .au-sheen { opacity: 0 } .au-stamp { animation: none; transform: rotate(-12deg) } }
`;

const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter((w) => /^[\p{L}\d]/u.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const glow = (c: string, a = 0.55) => `color-mix(in srgb, ${c} ${Math.round(a * 100)}%, transparent)`;

/** GK, DEF, MID, FWD for the usual football positions; otherwise the first letters. */
function posCode(p: string | null) {
  if (!p) return null;
  const s = p.toLowerCase();
  if (/goal|keeper|\bgk\b/.test(s)) return "GK";
  if (/defen|back|\bcb\b|\blb\b|\brb\b/.test(s)) return "DEF";
  if (/mid/.test(s)) return "MID";
  if (/forw|strik|attack|wing|\bst\b|\bcf\b/.test(s)) return "FWD";
  return p.replace(/[^\p{L}]/gu, "").slice(0, 3).toUpperCase() || null;
}

/** How much the card area shrinks so it clears the teams row (and the sponsors strip, if any). */
const fit0 = (sponsorH: number) => Math.min(1, (H - 124 - (sponsorH + 22 + 204) - 18) / 690);

const tierOf = (p: Pick<PlayerView, "basePrice">, standard: number): Tier => (p.basePrice > standard ? "gold" : "silver");

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

/** The big collectable card for the player on the block. */
function PlayerCard({ p, tier, flipKey, team }: { p: PlayerView; tier: Tier; flipKey: string; team?: string | null }) {
  const t = TIERS[tier];
  const code = posCode(p.position);
  return (
    <div key={flipKey} className="au-flip relative h-[690px] w-[480px] shrink-0 rounded-[30px] p-[12px]" style={{ background: t.frame, boxShadow: `0 40px 80px -20px rgba(0,0,0,.7), 0 0 70px ${t.glow}` }}>
      <div className="relative size-full overflow-hidden rounded-[20px]" style={{ background: `radial-gradient(120% 80% at 50% 0%, ${team ? glow(team, 0.55) : "#2A2350"}, ${INK} 70%)` }}>
        {/* Corner: number and position */}
        <div className="absolute top-[22px] left-[24px] z-10 grid justify-items-center gap-[6px]">
          <span className="au-hd text-[92px] leading-[0.8]" style={{ color: t.edge, textShadow: "0 4px 14px rgba(0,0,0,.6)" }}>
            {p.jersey ?? "–"}
          </span>
          {code && (
            <span className="rounded-[8px] px-[10px] py-[2px] au-hd text-[30px] leading-tight" style={{ background: t.frame, color: t.ink }}>
              {code}
            </span>
          )}
        </div>
        <span className="absolute top-[26px] right-[24px] z-10 rounded-full px-[16px] py-[4px] text-[20px] font-bold" style={{ background: "rgba(0,0,0,.45)", color: t.edge, border: `2px solid ${t.edge}` }}>
          {t.label}
        </span>
        {/* Photo */}
        <div className="absolute inset-x-0 top-[70px] bottom-[168px]">
          {p.photoUrl ? (
            <img src={p.photoUrl} alt="" className="size-full object-cover object-top" style={{ maskImage: "linear-gradient(180deg, #000 72%, transparent)" }} />
          ) : (
            <span className="grid size-full place-items-center au-hd text-[200px]" style={{ color: t.edge, opacity: 0.9 }}>
              {initials(p.name)}
            </span>
          )}
        </div>
        {/* Name plate */}
        <div className="absolute inset-x-0 bottom-0 grid h-[168px] content-center justify-items-center gap-[8px] px-[22px] text-center" style={{ background: t.plate, borderTop: `3px solid ${t.edge}` }}>
          <p className="max-w-full truncate au-hd uppercase leading-none" style={{ fontSize: p.name.length > 16 ? 46 : 58 }}>
            {p.name}
          </p>
          <p className="text-[24px] au-dim">
            {p.position ? <span style={{ color: WHITE }}>{p.position}</span> : "Any position"}
            <span className="mx-[10px]">·</span>
            Base <strong className="au-hd au-num text-[30px]" style={{ color: t.edge }}>{p.basePrice}</strong>
          </p>
        </div>
        {/* One sweep of foil light on reveal */}
        <span aria-hidden className="au-sheen pointer-events-none absolute inset-y-0 left-0 w-[40%]" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent)" }} />
      </div>
    </div>
  );
}

/** The back of a card: the deck waiting for the next player. */
function CardBack({ crestUrl, color }: { crestUrl: string | null; color: string }) {
  return (
    <div className="relative h-[690px] w-[480px] shrink-0 rounded-[30px] p-[12px]" style={{ background: TIERS.silver.frame, boxShadow: "0 40px 80px -20px rgba(0,0,0,.7)" }}>
      <div
        className="grid size-full place-items-center rounded-[20px]"
        style={{ background: `repeating-linear-gradient(45deg, ${glow(color, 0.5)} 0 14px, transparent 14px 28px), radial-gradient(circle, #2A2350, ${INK} 70%)` }}
      >
        <span className="grid size-[200px] place-items-center rounded-full border-[6px]" style={{ borderColor: TIERS.silver.edge, background: INK }}>
          {crestUrl ? <img src={crestUrl} alt="" className="size-[150px] object-contain" /> : <Gavel aria-hidden className="size-[96px]" style={{ color: TIERS.silver.edge }} />}
        </span>
      </div>
    </div>
  );
}

/** A small card in a team's hand. */
function MiniCard({ p, tier, size = 1 }: { p: PlayerView; tier: Tier; size?: number }) {
  const t = TIERS[tier];
  return (
    <div className="relative shrink-0 rounded-[10px] shadow-[0_8px_18px_rgba(0,0,0,.5)]" style={{ width: 74 * size, height: 104 * size, padding: 4 * Math.min(size, 2), background: t.frame }} title={p.name}>
      <div className="relative size-full overflow-hidden rounded-[6px]" style={{ background: INK }}>
        {p.photoUrl ? (
          <img src={p.photoUrl} alt="" className="absolute inset-0 size-full object-cover object-top" />
        ) : (
          <span className="absolute inset-0 grid place-items-center au-hd text-[30px]" style={{ color: t.edge, fontSize: 30 * size }}>
            {initials(p.name)}
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 truncate px-[4px] text-center font-bold leading-[1.5]" style={{ background: "rgba(0,0,0,.7)", fontSize: 12 * size }}>
          {p.name.split(" ")[0]}
        </span>
      </div>
    </div>
  );
}

function Shirt({ color, size = 48 }: { color: string; size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 64 60" width={size} height={size} className="shrink-0">
      <path d="M22 4 12 8 2 20l8 9 6-5v32h32V24l6 5 8-9L52 8 42 4c-1.5 5-5.5 8-10 8s-8.5-3-10-8Z" fill={color} stroke="rgba(0,0,0,.35)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function Mark({ color, logoUrl, size = 48 }: { color: string; logoUrl?: string | null; size?: number }) {
  return logoUrl ? <img src={logoUrl} alt="" className="shrink-0 rounded-[8px] object-contain" style={{ width: size, height: size }} /> : <Shirt color={color} size={size} />;
}

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

export function AuctionScreen({ token, initial, crestUrl }: { token: string; initial: ScreenView; crestUrl: string | null }) {
  const [v, setV] = useState(initial);
  const [skew, setSkew] = useState(0);
  const [, tick] = useState(0);
  const [soldShow, setSoldShow] = useState<Recent | null>(null);
  const lastSeen = useRef<string | null>(initial.recent[0]?.id ?? null);
  const [full, setFull] = useState(false);
  const [fit, setFit] = useState<{ s: number; turn: boolean } | null>(null);

  // Scale the 1920×1080 stage to the window; turn it sideways on a phone held upright.
  useLayoutEffect(() => {
    const measure = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const turn = h > w * 1.05;
      setFit({ turn, s: turn ? Math.min(h / W, w / H) : Math.min(w / W, h / H) });
    };
    measure();
    window.addEventListener("resize", measure);
    screen.orientation?.addEventListener?.("change", measure);
    return () => {
      window.removeEventListener("resize", measure);
      screen.orientation?.removeEventListener?.("change", measure);
    };
  }, []);

  useEffect(() => {
    setSkew(Date.parse(initial.now) - Date.now());
    let busy = false;
    const t = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        const r = await fetch(`/api/auction/screen/${token}`, { cache: "no-store" });
        if (r.ok) {
          const next = (await r.json()) as ScreenView;
          setSkew(Date.parse(next.now) - Date.now());
          setV(next);
          const top = next.recent[0];
          if (top && top.id !== lastSeen.current) {
            lastSeen.current = top.id;
            setSoldShow(top);
            setTimeout(() => setSoldShow((s) => (s?.id === top.id ? null : s)), 6000);
          }
        }
      } finally {
        busy = false;
      }
    }, 1000);
    const c = setInterval(() => tick((n) => n + 1), 250);
    return () => {
      clearInterval(t);
      clearInterval(c);
    };
  }, [token, initial.now]);

  // Keep the TV awake while the auction is on.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const grab = async () => {
      try {
        lock = (await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen")) ?? null;
      } catch {
        /* not supported */
      }
    };
    void grab();
    const again = () => document.visibilityState === "visible" && void grab();
    document.addEventListener("visibilitychange", again);
    const fs = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fs);
    return () => {
      document.removeEventListener("visibilitychange", again);
      document.removeEventListener("fullscreenchange", fs);
      void lock?.release().catch(() => {});
    };
  }, []);

  // Leave the big screen: out of full screen first, then back to where you came from
  // (or to the auction room if the screen was opened straight from its link).
  const goBack = async () => {
    try {
      (screen.orientation as unknown as { unlock?: () => void })?.unlock?.();
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* not supported here */
    }
    const fromHere = document.referrer && new URL(document.referrer).origin === location.origin;
    if (fromHere && history.length > 1) history.back();
    else location.href = `/auction/${v.auction.id}`;
  };

  const goFull = async () => {
    try {
      await document.documentElement.requestFullscreen?.();
      await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.("landscape");
    } catch {
      /* not supported here */
    }
  };

  const a = v.auction;
  const lot = v.lot;
  const left = lot ? Math.max(0, Math.ceil((Date.parse(lot.endsAt) - (Date.now() + skew)) / 1000)) : 0;
  const sponsorH = v.sponsorBannerUrl ? 84 : 0;

  return (
    <div className="au-root fixed inset-0 overflow-hidden" style={{ background: "#05040C" }}>
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <div
        className="absolute top-1/2 left-1/2 overflow-hidden"
        style={{
          width: W,
          height: H,
          transform: fit ? `translate(-50%, -50%) rotate(${fit.turn ? 90 : 0}deg) scale(${fit.s})` : "translate(-50%, -50%)",
          visibility: fit ? "visible" : "hidden",
          background: `radial-gradient(70% 60% at 38% 18%, #2B2160 0%, ${FELT} 55%, ${INK} 100%)`,
        }}
      >
        {/* A faint card-table weave */}
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[.07]" style={{ backgroundImage: "repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 6px), repeating-linear-gradient(90deg, #fff 0 1px, transparent 1px 6px)" }} />

        <TopBar v={v} crestUrl={crestUrl} full={full} onBack={() => void goBack()} onFull={() => void goFull()} />

        <main
          className="absolute top-[124px] left-[60px] origin-top-left"
          style={a.status === "done" ? { width: W - 120, height: H - 124 - sponsorH - 30 } : { width: (W - 120) / fit0(sponsorH), height: 690, transform: `scale(${fit0(sponsorH)})` }}
        >
          {a.status === "done" ? <FinalTable v={v} /> : lot && a.status === "live" ? <OnTheBlock v={v} left={left} /> : <Waiting v={v} crestUrl={crestUrl} />}
        </main>

        {a.status !== "done" && <Hands v={v} bottom={sponsorH} />}

        {v.sponsorBannerUrl && (
          <div className="absolute inset-x-0 bottom-0 flex h-[84px] items-center gap-[24px] px-[60px]" style={{ background: "rgba(255,255,255,.96)" }}>
            <span className="shrink-0 text-[20px] font-semibold" style={{ color: "#3A3550" }}>
              Sponsored by
            </span>
            <img src={v.sponsorBannerUrl} alt="Sponsors" className="h-full min-w-0 flex-1 object-contain py-[10px]" />
          </div>
        )}

        {soldShow && soldShow.status === "sold" && <SoldOverlay sold={soldShow} v={v} />}
      </div>
    </div>
  );
}

function TopBar({ v, crestUrl, full, onBack, onFull }: { v: ScreenView; crestUrl: string | null; full: boolean; onBack: () => void; onFull: () => void }) {
  const a = v.auction;
  return (
    <header className="absolute inset-x-0 top-0 flex h-[108px] items-center gap-[22px] px-[40px]" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.45), transparent)" }}>
      <button type="button" onClick={onBack} className="au-btn inline-flex shrink-0 items-center gap-[6px] rounded-full border-[2px] py-[7px] pr-[22px] pl-[12px] text-[24px] font-semibold" style={{ borderColor: LINE }}>
        <ChevronLeft aria-hidden className="size-[28px]" />
        Back
      </button>
      {crestUrl ? <img src={crestUrl} alt="" className="size-[64px] shrink-0 object-contain" /> : null}
      <div className="min-w-0 flex-1">
        <h1 className="truncate au-hd text-[52px] leading-none uppercase">{a.title}</h1>
        <p className="mt-[4px] truncate text-[22px] au-dim">
          {v.teamName} · {v.squads.length} teams · {a.budget.toLocaleString()} points each
        </p>
      </div>
      {v.bannerUrl && <img src={v.bannerUrl} alt="Tournament poster" className="h-[88px] max-w-[420px] shrink rounded-[10px] object-contain" />}
      {a.status === "live" ? (
        <span className="inline-flex shrink-0 items-center gap-[10px] rounded-full px-[20px] py-[6px] au-hd text-[26px] uppercase" style={{ background: HOT }}>
          <span className="au-dot size-[14px] rounded-full" style={{ background: WHITE }} />
          Live
        </span>
      ) : null}
      <span className="shrink-0 rounded-full border-[2px] px-[20px] py-[6px] text-[24px] font-semibold au-num" style={{ borderColor: LINE }}>
        {a.status === "done" ? `${v.summary.sold} signed` : `${v.summary.sold} signed · ${v.summary.toGo} to go`}
      </span>
      {!full && (
        <button type="button" onClick={onFull} className="au-btn inline-flex shrink-0 items-center gap-[10px] rounded-full border-[2px] px-[20px] py-[7px] text-[22px] font-semibold" style={{ borderColor: LINE }}>
          <Expand aria-hidden className="size-[22px]" />
          Full screen
        </button>
      )}
    </header>
  );
}

// ---------------------------------------------------------------------------
// A player on the block
// ---------------------------------------------------------------------------

function OnTheBlock({ v, left }: { v: ScreenView; left: number }) {
  const lot = v.lot!;
  const p = lot.player;
  const tier = tierOf(p, v.auction.basePrice);
  const leader = v.squads.find((x) => x.id === lot.topSquadId) ?? null;
  const tint = lot.squadColor;
  const frac = Math.min(1, left / Math.max(1, v.auction.bidSeconds));
  const hot = left <= 5;
  return (
    <section aria-label="Up now" className="flex h-full items-start gap-[70px]">
      <PlayerCard p={p} tier={tier} flipKey={lot.id} team={tint} />
      <div className="grid min-w-0 flex-1 content-start gap-[34px] pt-[30px]">
        <p className="text-[30px] font-semibold au-dim">Current player</p>
        <div key={lot.bids} className="au-bump">
          <p className="text-[28px] au-dim">{lot.topBid != null ? "Highest bid" : "Opening bid"}</p>
          <p className="au-hd au-num leading-[0.85]" style={{ fontSize: 280, color: WHITE, textShadow: `0 6px 0 ${tint ?? TIERS[tier].edge}, 0 0 70px ${glow(tint ?? TIERS[tier].edge, 0.6)}` }}>
            {lot.topBid ?? lot.minNext}
          </p>
        </div>
        <div className="flex min-h-[96px] items-center gap-[20px]">
          {leader && tint ? (
            <span className="flex min-w-0 items-center gap-[18px] rounded-[20px] px-[28px] py-[14px]" style={{ background: `linear-gradient(90deg, ${glow(tint, 0.6)}, ${glow(tint, 0.15)})`, boxShadow: `inset 0 0 0 3px ${tint}` }}>
              <Mark color={tint} logoUrl={leader.logoUrl} size={64} />
              <span className="min-w-0 truncate au-hd text-[56px] leading-none uppercase">{leader.name}</span>
            </span>
          ) : (
            <span className="au-hd text-[48px] uppercase au-dim">Waiting for the first bid</span>
          )}
        </div>
        {/* The clock as a draining bar */}
        <div aria-label={`${left} seconds left`} className="grid gap-[12px]">
          <div className="flex items-baseline justify-between">
            <span className="text-[26px] au-dim">Time left</span>
            <span className="au-hd au-num text-[64px] leading-none" style={{ color: hot ? HOT : WHITE }}>
              {left}s
            </span>
          </div>
          <div className="h-[22px] overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.1)" }}>
            <div className="h-full rounded-full" style={{ width: `${frac * 100}%`, background: hot ? HOT : TIERS[tier].frame, transition: "width .25s linear" }} />
          </div>
        </div>
        {v.bids.length > 1 && (
          <ol aria-label="Earlier bids" className="flex flex-wrap gap-[14px]">
            {v.bids.slice(1, 6).map((b, i) => (
              <li key={b.at + i} className="inline-flex items-center gap-[10px] rounded-full px-[18px] py-[6px] text-[24px]" style={{ background: "rgba(255,255,255,.07)", boxShadow: `inset 0 0 0 2px ${glow(b.color, 0.7)}` }}>
                <Shirt color={b.color} size={26} />
                {b.squad}
                <strong className="au-hd au-num text-[28px]">{b.amount}</strong>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Between players
// ---------------------------------------------------------------------------

function Waiting({ v, crestUrl }: { v: ScreenView; crestUrl: string | null }) {
  const a = v.auction;
  const last = v.recent[0];
  const lastSquad = last ? v.squads.find((s) => s.name === last.squad) : undefined;
  const lastPlayer = lastSquad?.players.find((p) => p.name === last?.player);
  return (
    <section aria-label="Up now" className="flex h-full items-start gap-[70px]">
      <CardBack crestUrl={crestUrl} color={v.teamColor} />
      <div className="grid min-w-0 flex-1 content-start gap-[26px] pt-[40px]">
        {a.status === "setup" ? (
          <>
            <p className="au-hd text-[120px] leading-[0.9] uppercase">Auction night</p>
            <p className="text-[34px] au-dim">
              {v.pool.length} players · {v.squads.length} teams · {a.budget.toLocaleString()} points each. Starting soon.
            </p>
          </>
        ) : last ? (
          <>
            <p className="text-[30px] font-semibold au-dim">{last.status === "sold" ? "Just signed" : "No takers for"}</p>
            <div className="flex items-center gap-[28px]">
              {lastPlayer && <MiniCard p={lastPlayer} tier={tierOf(lastPlayer, a.basePrice)} size={1.6} />}
              <div className="min-w-0">
                <p className="truncate au-hd text-[96px] leading-[0.9] uppercase">{last.player}</p>
                {last.status === "sold" && last.color && (
                  <p className="mt-[12px] flex items-center gap-[14px] text-[38px]">
                    <Mark color={last.color} logoUrl={lastSquad?.logoUrl} size={52} />
                    {last.squad}
                    <strong className="au-hd au-num text-[54px]" style={{ color: last.color }}>
                      {last.price}
                    </strong>
                  </p>
                )}
              </div>
            </div>
            <p className="mt-[20px] text-[34px] au-dim">Next card coming up</p>
          </>
        ) : (
          <>
            <p className="au-hd text-[140px] leading-[0.9] uppercase">Here we go</p>
            <p className="text-[34px] au-dim">The first card is about to be turned over.</p>
          </>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Each team's hand, along the bottom
// ---------------------------------------------------------------------------

function Hands({ v, bottom }: { v: ScreenView; bottom: number }) {
  const n = Math.max(1, v.squads.length);
  return (
    <section aria-label="Teams" className="absolute inset-x-[60px] grid gap-[18px]" style={{ bottom: bottom + 22, gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      {v.squads.map((sq) => (
        <Hand key={sq.id} sq={sq} standard={v.auction.basePrice} leading={v.lot?.topSquadId === sq.id} max={v.auction.squadMax ?? v.auction.squadMin} small={n > 4} />
      ))}
    </section>
  );
}

function Hand({ sq, standard, leading, max, small }: { sq: SquadView; standard: number; leading: boolean; max: number; small: boolean }) {
  const shown = sq.players.slice(-7);
  const overlap = small ? 46 : 40;
  return (
    <article
      aria-label={sq.name}
      className="relative min-w-0 rounded-[20px] px-[18px] pt-[14px] pb-[16px]"
      style={{ background: `linear-gradient(180deg, ${glow(sq.color, leading ? 0.5 : 0.28)}, rgba(10,8,22,.92))`, boxShadow: leading ? `inset 0 0 0 3px ${sq.color}, 0 0 40px ${glow(sq.color, 0.5)}` : `inset 0 0 0 2px ${glow(sq.color, 0.6)}` }}
    >
      <div className="flex items-center gap-[12px]">
        <Mark color={sq.color} logoUrl={sq.logoUrl} size={small ? 38 : 46} />
        <p className={`min-w-0 flex-1 truncate au-hd leading-none uppercase ${small ? "text-[26px]" : "text-[32px]"}`}>{sq.name}</p>
        <p className="shrink-0 text-right leading-none">
          <span className={`au-hd au-num ${small ? "text-[30px]" : "text-[38px]"}`}>{sq.left.toLocaleString()}</span>
          <span className="block text-[16px] au-dim">pts left</span>
        </p>
      </div>
      <div className="mt-[12px] flex h-[112px] items-end">
        {shown.length === 0 ? (
          <span className="text-[20px] au-dim">No cards yet</span>
        ) : (
          shown.map((p, i) => (
            <div key={p.id} style={{ marginLeft: i ? -overlap : 0, transform: `rotate(${(i - (shown.length - 1) / 2) * 3}deg)`, zIndex: i }}>
              <MiniCard p={p} tier={p.status === "captain" ? "gold" : tierOf(p, standard)} />
            </div>
          ))
        )}
        <span className="ml-auto shrink-0 self-end text-[20px] au-dim au-num">
          {sq.count}/{max}
        </span>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// The end: every team's cards laid out
// ---------------------------------------------------------------------------

function FinalTable({ v }: { v: ScreenView }) {
  const top = v.summary.topBuys[0];
  const n = Math.max(1, v.squads.length);
  const most = Math.max(1, ...v.squads.map((s) => s.players.length));
  const size = n <= 2 ? (most <= 6 ? 2 : 1.4) : n <= 4 ? (most <= 5 ? 1.5 : 1.1) : 1;
  const cols = n <= 4 ? n : Math.ceil(n / 2);
  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-[26px]">
      <div className="flex items-end justify-between gap-[30px]">
        <p className="au-hd text-[96px] leading-[0.9] uppercase">The teams are set</p>
        {top && (
          <p className="text-right text-[28px] au-dim">
            Record signing
            <span className="block text-[36px]" style={{ color: WHITE }}>
              <strong>{top.player}</strong> to {top.squad} for <span className="au-hd au-num text-[46px]" style={{ color: top.color }}>{top.price}</span>
            </span>
          </p>
        )}
      </div>
      <section aria-label="Teams" className="grid min-h-0 content-start gap-[20px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {v.squads.map((sq) => (
          <article key={sq.id} aria-label={sq.name} className="min-w-0 rounded-[22px] p-[20px]" style={{ background: `linear-gradient(180deg, ${glow(sq.color, 0.4)}, rgba(10,8,22,.92))`, boxShadow: `inset 0 0 0 3px ${glow(sq.color, 0.8)}` }}>
            <div className="flex items-center gap-[14px]">
              <Mark color={sq.color} logoUrl={sq.logoUrl} size={56} />
              <p className="min-w-0 flex-1 truncate au-hd text-[38px] leading-none uppercase">{sq.name}</p>
              <p className="shrink-0 text-right text-[18px] au-dim">
                Spent <span className="au-hd au-num text-[30px]" style={{ color: WHITE }}>{sq.spent}</span>
              </p>
            </div>
            <div className="mt-[16px] flex flex-wrap gap-[12px]">
              {sq.players.map((p) => (
                <div key={p.id} className="grid justify-items-center gap-[4px]">
                  <MiniCard p={p} tier={p.status === "captain" ? "gold" : tierOf(p, v.auction.basePrice)} size={size} />
                  <span className="text-[20px] au-num au-dim">{p.status === "captain" ? "Capt." : p.price}</span>
                </div>
              ))}
              {sq.players.length === 0 && <span className="text-[22px] au-dim">No players</span>}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SoldOverlay({ sold, v }: { sold: Recent; v: ScreenView }) {
  const color = sold.color ?? TIERS.gold.edge;
  const sq = v.squads.find((x) => x.name === sold.squad);
  const p = sq?.players.find((x) => x.name === sold.player);
  return (
    <div className="au-show pointer-events-none absolute inset-0 z-50 grid place-items-center" style={{ background: `radial-gradient(circle at 50% 45%, ${glow(color, 0.35)}, transparent 60%), ${INK}` }}>
      <div className="flex items-center gap-[80px]">
        {p && <MiniCard p={p} tier={tierOf(p, v.auction.basePrice)} size={3.4} />}
        <div className="grid justify-items-start gap-[20px]">
          <span className="au-stamp mb-[46px] rounded-[22px] border-[10px] px-[44px] py-[4px] au-hd text-[190px] leading-[0.95] tracking-[0.03em]" style={{ borderColor: color, color, textShadow: `0 0 50px ${glow(color, 0.7)}` }}>
            SOLD
          </span>
          <span className="au-hd text-[80px] leading-none uppercase">{sold.player}</span>
          <span className="flex items-center gap-[20px] text-[44px] font-semibold">
            <Mark color={color} logoUrl={sq?.logoUrl} size={70} />
            {sold.squad}
            <span className="au-hd au-num text-[70px]" style={{ color }}>
              {sold.price}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
