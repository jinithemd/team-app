"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Coins, Expand, Gavel, Layers, Shirt as ShirtIcon, Timer, Users } from "lucide-react";
import type { AuctionView, PlayerView, SquadView } from "@/lib/auction/service";

/*
 * The big screen: the auction on a TV or projector for the whole team and the fans.
 * A night-stadium broadcast look (floodlights, dark sky, a strip of lit grass) with neon-lime
 * accents and glowing cards in each team's colour.
 *
 * It's drawn on a fixed 1920×1080 stage and scaled to fit, so a TV, a laptop and a phone all
 * show the same picture. On a phone held upright the stage is turned sideways (landscape), and
 * Full screen also asks the phone to lock to landscape where it can.
 *
 * While a player is up: their profile card, the bid, the clock, and every team's points.
 * Between players and at the end: every team's squad, slot by slot.
 */

type ScreenView = AuctionView & { teamColor: string; teamColor2: string | null };
type Recent = AuctionView["recent"][number];

const W = 1920;
const H = 1080;
const LIME = "#B8F42C";
const LIME_DEEP = "#7CC316";
const SKY = "#060A14";
const PANEL = "rgba(12,18,30,.86)";
const LINE = "rgba(255,255,255,.12)";
const DIM = "rgba(255,255,255,.62)";
const RED = "#FF3B4A";

const STYLE = `
.au-root { font-family: Inter, system-ui, sans-serif; color: #fff; }
.au-hd { font-family: Barlow, "Barlow Condensed", Inter, sans-serif; font-style: italic; font-weight: 800; letter-spacing: -0.01em; }
.au-cap { letter-spacing: .22em; text-transform: uppercase; font-weight: 600; }
.au-num { font-variant-numeric: tabular-nums; }
@keyframes au-stamp { 0% { transform: scale(2.4) rotate(-8deg); opacity: 0 } 16% { transform: scale(.95) rotate(-8deg); opacity: 1 } 24%, 100% { transform: scale(1) rotate(-8deg) } }
@keyframes au-show { 0%, 92% { opacity: 1 } 100% { opacity: 0 } }
@keyframes au-bump { 0% { transform: scale(1.12) } 100% { transform: scale(1) } }
@keyframes au-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .35 } }
@keyframes au-glow { 0%, 100% { box-shadow: 0 0 0 2px var(--c), 0 0 26px 2px var(--c) } 50% { box-shadow: 0 0 0 2px var(--c), 0 0 46px 8px var(--c) } }
.au-stamp { animation: au-stamp 6s cubic-bezier(.2,.9,.3,1.2) forwards }
.au-show { animation: au-show 6s linear forwards }
.au-bump { animation: au-bump .45s ease-out }
.au-dot { animation: au-pulse 1.2s ease-in-out infinite }
.au-lead { animation: au-glow 1.6s ease-in-out infinite }
.au-btn:hover { background-color: rgba(255,255,255,.12) }
@media (prefers-reduced-motion: reduce) { .au-stamp, .au-bump, .au-dot, .au-lead { animation: none } .au-stamp { transform: rotate(-8deg) } }
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
const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Shirt({ color, size = 56 }: { color: string; size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 64 60" width={size} height={size} className="shrink-0" style={{ filter: `drop-shadow(0 0 10px ${glow(color, 0.6)})` }}>
      <path d="M22 4 12 8 2 20l8 9 6-5v32h32V24l6 5 8-9L52 8 42 4c-1.5 5-5.5 8-10 8s-8.5-3-10-8Z" fill={color} stroke="rgba(0,0,0,.35)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M22 4c1.5 5 5.5 8 10 8s8.5-3 10-8" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2" />
    </svg>
  );
}

/** A team's logo if it has one, otherwise its shirt. */
function Mark({ color, logoUrl, size = 56 }: { color: string; logoUrl?: string | null; size?: number }) {
  return logoUrl ? (
    <img src={logoUrl} alt="" width={size} height={size} className="shrink-0 rounded-[10px] object-contain" style={{ width: size, height: size, filter: `drop-shadow(0 0 10px ${glow(color, 0.5)})` }} />
  ) : (
    <Shirt color={color} size={size} />
  );
}

/** Floodlights, crowd, a strip of lit grass. Sits behind everything. */
function Stadium() {
  const bank = (x: number) => (
    <g transform={`translate(${x} 70)`}>
      <circle cx="70" cy="40" r="190" fill="url(#au-flood)" />
      <rect x="0" y="0" width="140" height="80" rx="10" fill="#1A2233" />
      {Array.from({ length: 12 }, (_, i) => (
        <circle key={i} cx={22 + (i % 4) * 32} cy={18 + Math.floor(i / 4) * 22} r="10" fill="#FFFFFF" />
      ))}
      <rect x="64" y="80" width="12" height="260" fill="#111827" />
    </g>
  );
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <radialGradient id="au-flood">
          <stop stopColor="#FFFFFF" stopOpacity=".55" />
          <stop offset=".35" stopColor="#CFE3FF" stopOpacity=".18" />
          <stop offset="1" stopColor="#CFE3FF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="au-sky" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#0B1730" />
          <stop offset=".45" stopColor={SKY} />
          <stop offset=".72" stopColor="#07140C" />
          <stop offset="1" stopColor="#0E3A18" />
        </linearGradient>
        <linearGradient id="au-grass" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#1B6B2C" stopOpacity="0" />
          <stop offset=".35" stopColor="#1E7A31" stopOpacity=".75" />
          <stop offset="1" stopColor="#2A9A3E" />
        </linearGradient>
        <pattern id="au-mow" width="240" height="400" patternUnits="userSpaceOnUse">
          <rect width="120" height="400" fill="#000" fillOpacity=".14" />
        </pattern>
        <pattern id="au-crowd" width="14" height="10" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="5" r="2.2" fill="#9FB4D8" fillOpacity=".16" />
          <circle cx="11" cy="2" r="1.6" fill="#E9C46A" fillOpacity=".08" />
        </pattern>
        <radialGradient id="au-vig" cx=".5" cy=".5" r=".75">
          <stop offset=".6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".55" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#au-sky)" />
      <path d={`M0 330 Q ${W / 2} 250 ${W} 330 L ${W} 470 Q ${W / 2} 420 0 470 Z`} fill="url(#au-crowd)" />
      <rect y="680" width={W} height="400" fill="url(#au-grass)" />
      <rect y="680" width={W} height="400" fill="url(#au-mow)" opacity=".8" />
      {bank(40)}
      {bank(W - 180)}
      <rect width={W} height={H} fill="url(#au-vig)" />
    </svg>
  );
}

function Slash({ flip }: { flip?: boolean }) {
  return <span aria-hidden className="inline-block h-[34px] w-[40px] shrink-0" style={{ background: LIME, transform: `skewX(${flip ? 24 : -24}deg)`, boxShadow: `0 0 18px ${glow(LIME, 0.7)}` }} />;
}

function Pill({ children, color = LIME }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-[18px] py-[4px] text-[26px] font-semibold" style={{ background: color, color: "#0A1408", boxShadow: `0 0 16px ${glow(color, 0.45)}` }}>
      {children}
    </span>
  );
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

  const goFull = async () => {
    try {
      await document.documentElement.requestFullscreen?.();
      // Phones (Android) can be held to landscape once full screen; elsewhere the stage turns itself.
      await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.("landscape");
    } catch {
      /* not supported here */
    }
  };

  const a = v.auction;
  const lot = v.lot;
  const left = lot ? Math.max(0, Math.ceil((Date.parse(lot.endsAt) - (Date.now() + skew)) / 1000)) : 0;
  const teamsSize = a.squadMax ? (a.squadMax === a.squadMin ? `${a.squadMax}` : `${a.squadMin}–${a.squadMax}`) : `${a.squadMin}+`;
  const bottom = (v.sponsorBannerUrl ? 92 : 0) + 58;
  const mainH = H - 334 - bottom - 22;

  return (
    <div className="au-root fixed inset-0 overflow-hidden" style={{ background: "#02040A" }}>
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <div
        className="absolute top-1/2 left-1/2 overflow-hidden"
        style={{
          width: W,
          height: H,
          transform: fit ? `translate(-50%, -50%) rotate(${fit.turn ? 90 : 0}deg) scale(${fit.s})` : "translate(-50%, -50%)",
          visibility: fit ? "visible" : "hidden",
        }}
      >
        <Stadium />

        {/* Header: LIVE, the title around the crest (or the tournament poster), the count. */}
        <header className="absolute inset-x-0 top-0 h-[250px]">
          <div className="absolute top-[34px] left-[230px]">
            {a.status === "live" ? (
              <span className="inline-flex items-center gap-[12px] rounded-full border-[3px] px-[22px] py-[6px] text-[28px] au-hd uppercase" style={{ borderColor: RED, background: "rgba(40,4,8,.75)", boxShadow: `0 0 22px ${glow(RED, 0.55)}` }}>
                <span className="au-dot size-[16px] rounded-full" style={{ background: RED }} />
                Live auction
              </span>
            ) : a.status === "done" ? (
              <span className="inline-flex rounded-full border-[3px] px-[22px] py-[6px] text-[28px] au-hd uppercase" style={{ borderColor: LIME, color: LIME }}>
                Full time
              </span>
            ) : (
              <span className="inline-flex rounded-full border-[3px] border-white/40 px-[22px] py-[6px] text-[28px] au-hd uppercase">Starting soon</span>
            )}
          </div>
          <div className="absolute top-[34px] right-[230px] flex items-center gap-[14px]">
            <span className="rounded-full border-[2px] px-[22px] py-[7px] text-[26px] font-semibold au-num" style={{ borderColor: LINE, background: PANEL }}>
              {a.status === "done" ? `${v.summary.sold} sold · ${v.summary.unsold} unsold` : `${v.summary.sold} sold · ${v.summary.toGo} to go`}
            </span>
            {!full && (
              <button type="button" onClick={() => void goFull()} className="au-btn inline-flex items-center gap-[10px] rounded-full border-[2px] px-[20px] py-[7px] text-[24px] font-semibold" style={{ borderColor: LINE }}>
                <Expand aria-hidden className="size-[24px]" />
                Full screen
              </button>
            )}
          </div>
          <Title title={a.title} crestUrl={crestUrl} posterUrl={v.bannerUrl} color={v.teamColor} />
        </header>

        {/* What the auction is: players a team, points each, how many teams. */}
        <div className="absolute top-[258px] left-1/2 flex -translate-x-1/2 items-center gap-[34px] rounded-full border-[2px] px-[40px] py-[10px] text-[27px] whitespace-nowrap" style={{ borderColor: LINE, background: PANEL }}>
          <span className="inline-flex items-center gap-[12px]">
            <Users aria-hidden className="size-[30px]" style={{ color: LIME }} />
            {teamsSize} players / team
          </span>
          <span className="h-[30px] w-[2px] bg-white/20" />
          <span className="inline-flex items-center gap-[12px]">
            <Coins aria-hidden className="size-[30px]" style={{ color: LIME }} />
            {a.budget.toLocaleString()} points each
          </span>
          <span className="h-[30px] w-[2px] bg-white/20" />
          <span className="inline-flex items-center gap-[12px]">
            <Layers aria-hidden className="size-[30px]" style={{ color: LIME }} />
            {v.squads.length} teams
          </span>
          <span className="h-[30px] w-[2px] bg-white/20" />
          <span className="max-w-[420px] truncate text-white/70">{v.teamName}</span>
        </div>

        <main className="absolute inset-x-[48px] top-[334px]" style={{ bottom: bottom + 22 }}>
          {lot && a.status === "live" ? <LiveLot v={v} left={left} h={mainH} /> : <Squads v={v} h={mainH} />}
        </main>

        {v.sponsorBannerUrl && (
          <div className="absolute inset-x-0 flex h-[92px] items-center gap-[26px] border-t-[2px] px-[60px]" style={{ bottom: 58, borderColor: LINE, background: "rgba(255,255,255,.96)" }}>
            <span className="au-cap shrink-0 text-[20px]" style={{ color: "#3A4A2A" }}>
              Sponsors
            </span>
            <img src={v.sponsorBannerUrl} alt="Sponsors" className="h-full min-w-0 flex-1 object-contain py-[10px]" />
          </div>
        )}

        <Ticker v={v} />

        {soldShow && soldShow.status === "sold" && <SoldOverlay sold={soldShow} v={v} />}
      </div>
    </div>
  );
}

/** "WINTER CUP" [crest] "AUCTION", with lime slashes, like a broadcast title card. */
function Title({ title, crestUrl, posterUrl, color }: { title: string; crestUrl: string | null; posterUrl: string | null; color: string }) {
  const words = title.trim().split(/\s+/);
  const last = words[words.length - 1] ?? "";
  const [l, r] = words.length > 1 && /^auction$/i.test(last) ? [words.slice(0, -1).join(" "), last] : [title, "Auction"];
  const size = (s: string) => (s.length <= 8 ? 104 : s.length <= 12 ? 86 : s.length <= 18 ? 66 : 50);
  return (
    <div className="absolute inset-x-0 top-[80px] flex items-center justify-center gap-[26px]">
      <div className="flex min-w-0 flex-1 items-center justify-end gap-[20px]">
        <Slash />
        <h1 className="truncate au-hd leading-none uppercase" style={{ fontSize: size(l), textShadow: "0 4px 18px rgba(0,0,0,.6)" }}>
          {l}
        </h1>
      </div>
      <div className="relative grid h-[170px] shrink-0 place-items-center" style={{ width: posterUrl ? 400 : 170 }}>
        <span aria-hidden className="absolute inset-[-30px] rounded-full" style={{ background: `radial-gradient(closest-side, ${glow(LIME, 0.28)}, transparent)` }} />
        {posterUrl ? (
          <img src={posterUrl} alt="Tournament poster" className="relative max-h-full max-w-full rounded-[12px] object-contain" style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,0,.6))" }} />
        ) : crestUrl ? (
          <img src={crestUrl} alt="" className="relative size-full object-contain" style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,0,.6))" }} />
        ) : (
          <span className="relative grid size-[150px] place-items-center rounded-full border-[5px]" style={{ borderColor: LIME, background: `radial-gradient(circle at 35% 30%, ${color}, #0B1220 75%)`, boxShadow: `0 0 34px ${glow(LIME, 0.45)}` }}>
            <Gavel aria-hidden className="size-[74px]" style={{ color: LIME }} />
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-[20px]">
        <p className="truncate au-hd leading-none uppercase" style={{ fontSize: size(r), textShadow: "0 4px 18px rgba(0,0,0,.6)" }}>
          {r}
        </p>
        <Slash flip />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// While a player is up
// ---------------------------------------------------------------------------

function LiveLot({ v, left, h }: { v: ScreenView; left: number; h: number }) {
  const lot = v.lot!;
  const p = lot.player;
  const tint = lot.squadColor;
  const leader = v.squads.find((x) => x.id === lot.topSquadId);
  const hot = left <= 5;
  const bidH = h > 620 ? 250 : 200;
  const nameSize = p.name.length > 18 ? 72 : p.name.length > 12 ? 84 : 96;
  const listH = h - 72 - (v.bids.length > 1 ? 50 : 0);
  return (
    <div className="grid h-full grid-cols-[1080px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-[34px]">
      <section aria-label="Up now" className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-[22px]">
        {/* Player profile */}
        <div className="relative flex min-h-0 overflow-hidden rounded-[28px] border-[3px]" style={{ borderColor: LIME, background: `linear-gradient(110deg, #10301A 0%, ${PANEL} 46%)`, boxShadow: `0 0 34px ${glow(LIME, 0.35)}, inset 0 0 60px rgba(0,0,0,.4)` }}>
          <span aria-hidden className="absolute inset-y-0 left-0 w-[230px]" style={{ background: `repeating-linear-gradient(115deg, ${glow(LIME, 0.55)} 0 14px, transparent 14px 46px)`, maskImage: "linear-gradient(90deg, #000, transparent)" }} />
          <div className="relative w-[360px] shrink-0">
            {p.photoUrl ? (
              <img src={p.photoUrl} alt="" className="absolute inset-0 size-full object-cover object-top" style={{ maskImage: "linear-gradient(90deg, #000 70%, transparent)" }} />
            ) : (
              <span className="absolute inset-0 grid place-items-center au-hd text-[150px]" style={{ color: LIME, textShadow: `0 0 30px ${glow(LIME, 0.5)}` }}>
                {initials(p.name)}
              </span>
            )}
            {p.jersey && (
              <span className="absolute top-[14px] left-[18px] au-hd text-[64px] leading-none" style={{ color: LIME, textShadow: "0 3px 12px rgba(0,0,0,.8)" }}>
                {p.jersey}
              </span>
            )}
          </div>
          <div className="relative grid min-w-0 flex-1 content-center gap-[20px] py-[26px] pr-[40px] pl-[18px]">
            <p className="au-cap text-[24px]" style={{ color: DIM }}>
              Current player
            </p>
            <p className="au-hd leading-[0.9] break-words uppercase" style={{ fontSize: nameSize, textShadow: "0 4px 16px rgba(0,0,0,.6)" }}>
              {p.name}
            </p>
            <div className="flex flex-wrap gap-[14px]">
              {p.position && (
                <Pill>
                  Position:&nbsp;<strong className="font-bold">{p.position}</strong>
                </Pill>
              )}
              <Pill>
                Base:&nbsp;<strong className="font-bold au-num">{p.basePrice} pts</strong>
              </Pill>
              {p.jersey && (
                <span className="inline-flex items-center gap-[8px] rounded-full border-[2px] px-[18px] py-[4px] text-[26px]" style={{ borderColor: LINE }}>
                  <ShirtIcon aria-hidden className="size-[24px]" style={{ color: LIME }} />#{p.jersey}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bid, bidder, clock */}
        <div className="grid grid-cols-[290px_minmax(0,1fr)_300px] gap-[22px]" style={{ height: bidH }}>
          <div key={lot.bids} className="au-bump grid content-center justify-items-center rounded-[24px] border-[2px] text-center" style={{ borderColor: LINE, background: PANEL }}>
            <p className="au-cap text-[24px]" style={{ color: DIM }}>
              {lot.topBid != null ? "Current bid" : "Opening bid"}
            </p>
            <p className="au-hd au-num leading-none whitespace-nowrap" style={{ color: LIME, textShadow: `0 0 28px ${glow(LIME, 0.55)}` }}>
              <span className="text-[100px]">{lot.topBid ?? lot.minNext}</span> <span className="text-[44px]">pts</span>
            </p>
          </div>
          <div className="grid min-w-0 content-center justify-items-center gap-[16px] overflow-hidden rounded-[24px] border-[2px] px-[20px] text-center" style={{ borderColor: LINE, background: PANEL }}>
            <p className="au-cap text-[24px]" style={{ color: DIM }}>
              Highest bidder
            </p>
            {leader && tint ? (
              <span className="flex w-full min-w-0 items-center justify-center gap-[14px] rounded-[18px] border-[3px] px-[16px] py-[10px]" style={{ borderColor: tint, background: `linear-gradient(90deg, ${glow(tint, 0.35)}, rgba(0,0,0,.4))`, boxShadow: `0 0 26px ${glow(tint, 0.55)}` }}>
                <Mark color={tint} logoUrl={leader.logoUrl} size={52} />
                <span className="min-w-0 truncate au-hd leading-[1.1] uppercase" style={{ fontSize: leader.name.length > 16 ? 30 : leader.name.length > 11 ? 38 : 46 }}>{leader.name}</span>
              </span>
            ) : (
              <span className="au-hd text-[44px] text-white/50 uppercase">No bids yet</span>
            )}
          </div>
          <div
            className="grid content-center justify-items-center rounded-[24px] border-[3px]"
            style={{ borderColor: hot ? RED : LIME, background: hot ? "rgba(60,6,12,.85)" : `linear-gradient(160deg, ${glow(LIME, 0.3)}, ${PANEL})`, boxShadow: `0 0 30px ${glow(hot ? RED : LIME, 0.5)}` }}
            aria-label={`${left} seconds left`}
          >
            <p className="au-cap text-[22px]" style={{ color: DIM }}>
              Time left
            </p>
            <p className="flex items-center gap-[10px] au-hd au-num text-[78px] leading-none whitespace-nowrap" style={{ color: hot ? RED : LIME }}>
              <Timer aria-hidden className="size-[54px]" strokeWidth={2.6} />
              {clock(left)}
            </p>
          </div>
        </div>
      </section>

      {/* Teams */}
      <section aria-label="Teams" className="relative flex min-h-0 flex-col rounded-[28px] border-[2px] px-[22px] pt-[50px] pb-[22px]" style={{ borderColor: LINE, background: "rgba(8,12,22,.7)" }}>
        <span className="absolute top-[-26px] left-[22px] inline-flex rounded-[14px] border-[3px] px-[30px] py-[4px] au-hd text-[36px] uppercase" style={{ borderColor: LIME, color: LIME, background: "#0B1A0E", transform: "skewX(-12deg)", boxShadow: `0 0 18px ${glow(LIME, 0.45)}` }}>
          Teams
        </span>
        <div className="grid min-h-0 content-start gap-[14px]" style={{ gridTemplateColumns: "minmax(0,1fr)", gridAutoRows: `${Math.min(122, Math.floor((listH - 14 * (v.squads.length - 1)) / v.squads.length))}px` }}>
          {v.squads.map((sq) => (
            <TeamRow key={sq.id} sq={sq} max={v.auction.squadMax ?? v.auction.squadMin} leading={lot.topSquadId === sq.id} />
          ))}
        </div>
        {v.bids.length > 1 && (
          <ol aria-label="Earlier bids" className="mt-[16px] flex flex-wrap gap-x-[22px] gap-y-[6px] text-[22px] text-white/65">
            {v.bids.slice(1, 5).map((b, i) => (
              <li key={b.at + i} className="inline-flex items-center gap-[8px]">
                <Shirt color={b.color} size={24} />
                {b.squad} <span className="au-hd au-num text-white">{b.amount}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function TeamRow({ sq, max, leading }: { sq: SquadView; max: number; leading: boolean }) {
  return (
    <article
      aria-label={sq.name}
      className={`flex min-h-0 items-center gap-[18px] rounded-[18px] border-[3px] px-[22px] ${leading ? "au-lead" : ""}`}
      style={{ ["--c" as string]: glow(sq.color, 0.7), borderColor: sq.color, background: `linear-gradient(90deg, ${glow(sq.color, leading ? 0.4 : 0.22)}, rgba(6,10,18,.92) 60%)`, boxShadow: `0 0 18px ${glow(sq.color, 0.35)}` }}
    >
      <Mark color={sq.color} logoUrl={sq.logoUrl} size={62} />
      <div className="min-w-0 flex-1">
        <p className="truncate au-hd text-[40px] leading-none uppercase">{sq.name}</p>
        <p className="mt-[6px] flex items-center gap-[8px] text-[21px] text-white/70">
          <Users aria-hidden className="size-[22px] shrink-0" />
          <span className="truncate">
            {sq.count} / {max} players{sq.captainName ? ` · Capt. ${sq.captainName}` : ""}
          </span>
        </p>
      </div>
      <span className="h-[54px] w-[2px] shrink-0 bg-white/25" />
      <p className="w-[190px] shrink-0 text-right whitespace-nowrap">
        <span className="au-hd au-num text-[50px] leading-none" style={{ color: LIME }}>
          {sq.left.toLocaleString()}
        </span>{" "}
        <span className="text-[22px] text-white/75">pts left</span>
      </p>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Between players, before the start, and at the end: every squad, slot by slot
// ---------------------------------------------------------------------------

function Squads({ v, h }: { v: ScreenView; h: number }) {
  const a = v.auction;
  const last = v.recent[0];
  const top = v.summary.topBuys[0];
  const n = Math.max(1, v.squads.length);
  const cols = n <= 4 ? n : Math.ceil(n / 2);
  const rowsOfCards = n <= 4 ? 1 : 2;
  const slots = Math.max(a.squadMax ?? a.squadMin, ...v.squads.map((s) => s.players.length), 1);
  const cardH = Math.floor((h - 172 - (rowsOfCards - 1) * 18) / rowsOfCards);
  const listH = cardH - (rowsOfCards > 1 ? 150 : 176);
  const rowH = Math.max(24, Math.min(64, Math.floor(listH / slots)));
  const small = rowH < 44;

  return (
    <div className="grid h-full grid-rows-[150px_1fr] gap-[22px]">
      {/* The banner across the top: what just happened, or what's next */}
      <div className="relative flex items-center gap-[30px] overflow-hidden rounded-[26px] border-[3px] px-[40px]" style={{ borderColor: LIME, background: `linear-gradient(110deg, #10301A, ${PANEL} 55%)`, boxShadow: `0 0 30px ${glow(LIME, 0.3)}` }}>
        <span aria-hidden className="absolute inset-y-0 left-0 w-[160px]" style={{ background: `repeating-linear-gradient(115deg, ${glow(LIME, 0.5)} 0 12px, transparent 12px 40px)`, maskImage: "linear-gradient(90deg, #000, transparent)" }} />
        {a.status === "done" ? (
          <>
            <p className="relative au-hd text-[84px] leading-none uppercase" style={{ textShadow: `0 0 26px ${glow(LIME, 0.35)}` }}>
              The teams are set
            </p>
            {top && (
              <p className="relative ml-auto text-right text-[28px] text-white/80">
                <span className="au-cap block text-[20px]" style={{ color: LIME }}>
                  Record signing
                </span>
                <strong className="text-white">{top.player}</strong> to {top.squad} for <span className="au-hd au-num text-[40px]" style={{ color: LIME }}>{top.price}</span>
              </p>
            )}
          </>
        ) : a.status === "setup" ? (
          <p className="relative au-hd text-[84px] leading-none uppercase">Auction night · starting soon</p>
        ) : last ? (
          <>
            <div className="relative">
              <p className="au-cap text-[22px]" style={{ color: DIM }}>
                {last.status === "sold" ? "Just signed" : "No takers for"}
              </p>
              <p className="au-hd text-[70px] leading-none uppercase">{last.player}</p>
            </div>
            {last.status === "sold" && last.color && (
              <span className="relative inline-flex items-center gap-[14px] rounded-[18px] border-[3px] px-[24px] py-[10px]" style={{ borderColor: last.color, boxShadow: `0 0 22px ${glow(last.color, 0.5)}` }}>
                <Shirt color={last.color} size={50} />
                <span className="au-hd text-[44px] uppercase">{last.squad}</span>
                <span className="au-hd au-num text-[52px]" style={{ color: LIME }}>
                  {last.price} pts
                </span>
              </span>
            )}
            <p className="relative ml-auto au-cap text-[24px]" style={{ color: LIME }}>
              Next player coming up
            </p>
          </>
        ) : (
          <>
            <p className="relative au-hd text-[84px] leading-none uppercase">Here we go</p>
            <p className="relative ml-auto au-cap text-[24px]" style={{ color: LIME }}>
              First player coming up
            </p>
          </>
        )}
      </div>

      <section aria-label="Teams" className="grid min-h-0 gap-[18px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, alignItems: "start" }}>
        {v.squads.map((sq) => (
          <SquadCard key={sq.id} sq={sq} slots={slots} rowH={rowH} small={small || cols > 4} maxH={cardH} />
        ))}
      </section>
    </div>
  );
}

function SquadCard({ sq, slots, rowH, small, maxH }: { sq: SquadView; slots: number; rowH: number; small: boolean; maxH: number }) {
  const rows: (PlayerView | null)[] = [...sq.players, ...Array.from({ length: Math.max(0, slots - sq.players.length) }, () => null)];
  return (
    <article
      aria-label={sq.name}
      className="flex min-h-0 flex-col overflow-hidden rounded-[22px] border-[3px]"
      style={{ maxHeight: maxH, borderColor: sq.color, background: `linear-gradient(180deg, ${glow(sq.color, 0.3)}, rgba(6,10,18,.94) 32%)`, boxShadow: `0 0 26px ${glow(sq.color, 0.4)}` }}
    >
      <div className="flex items-center gap-[14px] px-[18px] pt-[14px] pb-[10px]">
        <Mark color={sq.color} logoUrl={sq.logoUrl} size={small ? 46 : 64} />
        <div className="min-w-0 flex-1">
          <p className={`truncate au-hd leading-none uppercase ${small ? "text-[28px]" : "text-[38px]"}`}>{sq.name}</p>
          <p className="mt-[4px] flex items-center gap-[6px] text-[19px] text-white/70">
            <Users aria-hidden className="size-[20px]" />
            {sq.count} / {slots} players
          </p>
        </div>
        <p className="shrink-0 border-l-[2px] border-white/20 pl-[14px] text-right leading-none">
          <span className={`block au-hd au-num ${small ? "text-[34px]" : "text-[46px]"}`} style={{ color: LIME }}>
            {sq.left.toLocaleString()}
          </span>
          <span className="text-[18px] text-white/70">pts left</span>
        </p>
      </div>
      <ol className="min-h-0 overflow-hidden border-t-[2px] border-white/10 bg-black/25">
        {rows.map((p, i) => (
          <li key={p?.id ?? `open-${i}`} className="flex items-center gap-[12px] border-b border-white/[.07] px-[16px]" style={{ height: rowH }}>
            <span className="w-[22px] shrink-0 text-[18px] text-white/50 au-num">{i + 1}</span>
            {p ? (
              <>
                <span className="grid shrink-0 place-items-center overflow-hidden rounded-full border-[2px] bg-[#1A2436] text-[14px] font-bold" style={{ width: rowH - 12, height: rowH - 12, borderColor: glow(sq.color, 0.8) }}>
                  {p.photoUrl ? <img src={p.photoUrl} alt="" className="size-full object-cover" /> : initials(p.name)}
                </span>
                <span className={`min-w-0 flex-1 truncate font-semibold ${small ? "text-[19px]" : "text-[23px]"}`}>
                  {p.name}
                  {p.status === "captain" && <span className="text-white/55"> (C)</span>}
                </span>
                {p.status === "sold" && (
                  <span className="shrink-0 rounded-full border-[2px] px-[12px] au-hd au-num text-[22px]" style={{ borderColor: RED, background: "rgba(80,8,14,.7)" }}>
                    {p.price}
                  </span>
                )}
              </>
            ) : (
              <>
                <span aria-hidden className="grid shrink-0 place-items-center rounded-full border-[2px] border-dashed border-white/45 text-[18px] text-white/70" style={{ width: rowH - 14, height: rowH - 14 }}>
                  +
                </span>
                <span className={`flex-1 ${small ? "text-[18px]" : "text-[21px]"}`} style={{ color: "#9DB4FF" }}>
                  Open slot
                </span>
              </>
            )}
          </li>
        ))}
      </ol>
      <p className="flex items-center justify-center gap-[10px] border-t-[2px] border-white/10 py-[8px] text-[21px]">
        <Coins aria-hidden className="size-[22px] text-white/60" />
        Total spent: <span className="au-hd au-num text-[30px]" style={{ color: LIME }}>{sq.spent}</span> pts
      </p>
    </article>
  );
}

// ---------------------------------------------------------------------------

function Ticker({ v }: { v: ScreenView }) {
  return (
    <footer className="absolute inset-x-0 bottom-0 flex h-[58px] items-center gap-[26px] overflow-hidden border-t-[2px] px-[60px] whitespace-nowrap" style={{ borderColor: glow(LIME, 0.5), background: "rgba(4,8,14,.95)" }}>
      <span className="shrink-0 au-hd text-[28px] uppercase" style={{ color: LIME }}>
        Latest
      </span>
      {v.recent.length === 0 ? (
        <span className="text-[22px] text-white/55">The first sale shows up here</span>
      ) : (
        v.recent.map((r) => (
          <span key={r.id} className="inline-flex shrink-0 items-center gap-[10px] text-[22px]">
            {r.color ? <Shirt color={r.color} size={26} /> : <span className="size-[10px] rounded-full bg-white/30" />}
            <strong className="font-semibold">{r.player}</strong>
            <span className="text-white/60">{r.status === "sold" ? `${r.squad}, ${r.price}` : "unsold"}</span>
          </span>
        ))
      )}
      <span className="ml-auto shrink-0 au-hd text-[26px] text-white/45">clbx.ca</span>
    </footer>
  );
}

function SoldOverlay({ sold, v }: { sold: Recent; v: ScreenView }) {
  const color = sold.color ?? LIME;
  const sq = v.squads.find((x) => x.name === sold.squad);
  const p = sq?.players.find((x) => x.name === sold.player);
  return (
    <div className="au-show pointer-events-none absolute inset-0 grid place-items-center" style={{ background: "radial-gradient(circle, rgba(6,10,20,.88), rgba(2,4,10,.97))" }}>
      <div className="au-stamp grid justify-items-center gap-[18px] rounded-[30px] border-[8px] px-[90px] py-[40px] text-center" style={{ borderColor: color, background: "rgba(6,10,18,.92)", boxShadow: `0 0 80px ${glow(color, 0.65)}` }}>
        <div className="flex items-center gap-[30px]">
          {p?.photoUrl && <img src={p.photoUrl} alt="" className="size-[170px] rounded-full border-[6px] object-cover" style={{ borderColor: color }} />}
          <span className="au-hd text-[230px] leading-[0.8] tracking-[0.04em]" style={{ color, textShadow: `0 0 50px ${glow(color, 0.7)}` }}>
            SOLD
          </span>
        </div>
        <span className="au-hd text-[72px] leading-none uppercase">{sold.player}</span>
        <span className="flex items-center gap-[18px] text-[40px] font-semibold">
          <Mark color={color} logoUrl={sq?.logoUrl} size={64} />
          {sold.squad}
          <span className="au-hd au-num text-[60px]" style={{ color: LIME }}>
            {sold.price} pts
          </span>
        </span>
      </div>
    </div>
  );
}
