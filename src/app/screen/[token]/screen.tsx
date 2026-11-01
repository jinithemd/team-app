"use client";

import { useEffect, useRef, useState } from "react";
import { Expand, Gavel } from "lucide-react";
import type { AuctionView, SquadView } from "@/lib/auction/service";

/*
 * The big screen: the auction on a TV or projector for the whole team and the fans.
 * A daylight pitch (bright grass, white chalk lines) with white broadcast panels on top:
 * the player up as a big card, each team as a board with its shirt or logo and a points bar,
 * and a rubber SOLD stamp in the buying team's colour. Read-only, refreshes every second, keeps the screen awake.
 * Fits a TV (landscape) and a phone held upright.
 */

type ScreenView = AuctionView & { teamColor: string; teamColor2: string | null };

const GRASS = "#2E9E4E";
const GRASS_DARK = "#24853F";
const CHALK = "#FFFFFF";
const INK = "#13213D";
const GOLD = "#E8A80C";
const GOLD_INK = "#8A5A00";
const RED = "#D93A3F";
// Kept for the player card's frame.
const PITCH_DEEP = "#13213D";

const STYLE = `
.au-root { --ink: ${INK}; --chalk: ${CHALK}; --gold: ${GOLD}; font-size: clamp(13px, min(1.15vw, 2.1vh), 30px); }
@keyframes au-stamp { 0% { transform: rotate(-14deg) scale(2.6); opacity: 0 } 14% { transform: rotate(-14deg) scale(.94); opacity: 1 } 20%, 100% { transform: rotate(-14deg) scale(1) } }
@keyframes au-show { 0%, 90% { opacity: 1 } 100% { opacity: 0 } }
@keyframes au-bump { 0% { transform: scale(1.14) } 100% { transform: scale(1) } }
.au-stamp { animation: au-stamp 6s cubic-bezier(.2,.9,.3,1.2) forwards }
.au-show { animation: au-show 6s linear forwards }
.au-bump { animation: au-bump .5s ease-out }
.au-paper { background-color: #FFFFFF }
.au-light { color: #FFFFFF }
.au-pill:hover { background-color: rgba(19,33,61,.06) }
@media (prefers-reduced-motion: reduce) { .au-stamp, .au-bump { animation: none; transform: rotate(-14deg) } .au-bump { transform: none } }
`;

const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter((w) => /^[\p{L}\d]/u.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

/** Chalk markings: halfway line, centre circle, the two boxes. Sits behind everything. */
function Pitch() {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="au-flood-l" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(80 -60) rotate(40) scale(900 700)">
          <stop stopColor="#FFF6D6" stopOpacity=".35" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="au-flood-r" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1520 -60) rotate(140) scale(900 700)">
          <stop stopColor="#FFF6D6" stopOpacity=".25" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <pattern id="au-mow" width="200" height="900" patternUnits="userSpaceOnUse">
          <rect width="100" height="900" fill={GRASS_DARK} fillOpacity=".55" />
        </pattern>
      </defs>
      <rect width="1600" height="900" fill="url(#au-mow)" />
      <g fill="none" stroke={CHALK} strokeOpacity=".55" strokeWidth="5">
        <rect x="40" y="40" width="1520" height="820" />
        <line x1="800" y1="40" x2="800" y2="860" />
        <circle cx="800" cy="450" r="130" />
        <rect x="40" y="230" width="220" height="440" />
        <rect x="1340" y="230" width="220" height="440" />
        <rect x="40" y="345" width="80" height="210" />
        <rect x="1480" y="345" width="80" height="210" />
      </g>
      <circle cx="800" cy="450" r="8" fill={CHALK} fillOpacity=".6" />
      <rect width="1600" height="900" fill="url(#au-flood-l)" />
      <rect width="1600" height="900" fill="url(#au-flood-r)" />
    </svg>
  );
}

function Shirt({ color, size = "2.6em" }: { color: string; size?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 64 60" style={{ width: size, height: size }} className="shrink-0 drop-shadow-[0_2px_4px_rgba(19,33,61,.25)]">
      <path d="M22 4 12 8 2 20l8 9 6-5v32h32V24l6 5 8-9L52 8 42 4c-1.5 5-5.5 8-10 8s-8.5-3-10-8Z" fill={color} stroke="rgba(19,33,61,.35)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** A team's logo if it has one, otherwise its shirt. */
function Mark({ color, logoUrl, size = "2.6em" }: { color: string; logoUrl?: string | null; size?: string }) {
  return logoUrl ? (
    <img src={logoUrl} alt="" className="shrink-0 rounded-[0.2em] object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,.45)]" style={{ width: size, height: size }} />
  ) : (
    <Shirt color={color} size={size} />
  );
}

export function AuctionScreen({ token, initial }: { token: string; initial: ScreenView }) {
  const [v, setV] = useState(initial);
  const [skew, setSkew] = useState(0);
  const [, tick] = useState(0);
  const [soldShow, setSoldShow] = useState<AuctionView["recent"][number] | null>(null);
  const lastSeen = useRef<string | null>(initial.recent[0]?.id ?? null);
  const [full, setFull] = useState(false);

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

  const a = v.auction;
  const lot = v.lot;
  const left = lot ? Math.max(0, Math.ceil((Date.parse(lot.endsAt) - (Date.now() + skew)) / 1000)) : 0;
  const frac = lot ? Math.min(1, left / Math.max(1, a.bidSeconds)) : 0;

  return (
    <div
      className="au-root fixed inset-0 flex flex-col overflow-x-hidden overflow-y-auto text-[color:var(--ink)] lg:overflow-hidden"
      style={{ background: `linear-gradient(180deg, #38B25A 0%, ${GRASS} 45%, ${GRASS_DARK} 100%)` }}
    >
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <Pitch />

      <header className="relative z-10 flex items-center gap-[1em] au-paper px-[clamp(16px,2.5vw,48px)] py-[clamp(10px,1.6vh,22px)] shadow-[0_4px_18px_rgba(19,33,61,.18)]">
        <span className="grid size-[3em] shrink-0 place-items-center rounded-full" style={{ background: GOLD, color: INK }}>
          <Gavel aria-hidden style={{ width: "1.6em", height: "1.6em" }} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[2.6em] leading-[0.95] font-bold uppercase">{a.title}</h1>
          <p className="truncate text-[0.95em] text-[color:var(--ink)]/65">
            {v.teamName}, {a.budget} points a team
          </p>
        </div>
        {a.status === "live" && (
          <span className="inline-flex shrink-0 items-center gap-[0.45em] rounded-full px-[0.9em] py-[0.25em] font-display text-[1.2em] font-bold au-light uppercase" style={{ background: RED }}>
            <span className="live-dot size-[0.55em] rounded-full au-paper" />
            Live
          </span>
        )}
        {!full && (
          <button
            type="button"
            onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})}
            className="hidden shrink-0 items-center gap-[0.4em] rounded-full border border-[color:var(--ink)]/25 px-[0.9em] py-[0.35em] text-[0.85em] font-semibold au-pill focus-visible:outline-2 focus-visible:outline-[color:var(--ink)] sm:inline-flex"
          >
            <Expand aria-hidden style={{ width: "1em", height: "1em" }} />
            Full screen
          </button>
        )}
      </header>

      {v.bannerUrl && (
        <div className="relative z-10 flex h-[clamp(56px,10vh,150px)] shrink-0 justify-center au-paper border-t border-[color:var(--ink)]/10">
          <img src={v.bannerUrl} alt="Tournament poster" className="h-full w-full object-contain" />
        </div>
      )}

      {a.status === "done" ? (
        <Final v={v} />
      ) : (
        <main className="relative z-10 grid flex-1 grid-cols-1 gap-[clamp(14px,2vw,40px)] px-[clamp(16px,2.5vw,48px)] py-[clamp(12px,2vh,28px)] lg:min-h-0 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <Stage v={v} left={left} frac={frac} soldShow={soldShow} />
          <section aria-label="Teams" className="grid content-start gap-[0.8em] lg:min-h-0 lg:overflow-hidden">
            {v.squads.map((sq) => (
              <Board key={sq.id} sq={sq} budget={a.budget} leading={lot?.topSquadId === sq.id} />
            ))}
          </section>
        </main>
      )}

      {v.sponsorBannerUrl && (
        <div className="relative z-10 flex h-[clamp(44px,7vh,110px)] shrink-0 items-center justify-center gap-[1em] au-paper border-b border-[color:var(--ink)]/10 px-[clamp(16px,2.5vw,48px)]">
          <span className="hidden shrink-0 text-[0.8em] font-semibold tracking-[0.12em] text-[color:var(--ink)]/50 uppercase sm:inline">Sponsors</span>
          <img src={v.sponsorBannerUrl} alt="Sponsors" className="h-full min-w-0 flex-1 object-contain py-[0.4em]" />
        </div>
      )}

      <footer className="relative z-10 flex items-center gap-[1.2em] overflow-hidden au-paper px-[clamp(16px,2.5vw,48px)] py-[0.7em] text-[1em] whitespace-nowrap">
        <span className="shrink-0 font-display text-[1.15em] font-bold" style={{ color: GOLD_INK }}>
          {v.summary.sold} sold, {v.summary.toGo} to go
        </span>
        <span className="h-[1.2em] w-px shrink-0 bg-[color:var(--ink)]/20" />
        {v.recent.length === 0 ? (
          <span className="text-[color:var(--ink)]/55">The first sale shows up here</span>
        ) : (
          v.recent.map((r) => (
            <span key={r.id} className="inline-flex shrink-0 items-center gap-[0.45em]">
              {r.color ? <Shirt color={r.color} size="1.2em" /> : <span className="size-[0.55em] rounded-full bg-[color:var(--ink)]/25" />}
              <strong className="font-semibold">{r.player}</strong>
              <span className="text-[color:var(--ink)]/60">{r.status === "sold" ? `${r.squad}, ${r.price}` : "unsold"}</span>
            </span>
          ))
        )}
        <span className="ml-auto shrink-0 font-display font-bold text-[color:var(--ink)]/45">clbx.ca</span>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Stage({ v, left, frac, soldShow }: { v: ScreenView; left: number; frac: number; soldShow: AuctionView["recent"][number] | null }) {
  const a = v.auction;
  const lot = v.lot;
  const tint = lot?.squadColor ?? null;
  return (
    <section
      aria-label="Up now"
      className="relative grid min-h-[60vh] content-center overflow-hidden rounded-[1.4em] border-t-[0.5em] au-paper p-[clamp(18px,2.5vw,48px)] shadow-[0_14px_40px_rgba(10,40,20,.35)] lg:min-h-0"
      style={{ borderTopColor: tint ?? GOLD, background: tint ? `linear-gradient(170deg, color-mix(in srgb, ${tint} 10%, white), white 55%)` : "white" }}
    >
      {a.status === "setup" ? (
        <div className="grid justify-items-center gap-[0.6em] text-center">
          <p className="font-display text-[1.6em] font-bold" style={{ color: GOLD_INK }}>
            Starting soon
          </p>
          <p className="font-display text-[clamp(3rem,7vw,9rem)] leading-[0.85] font-bold uppercase">Auction night</p>
          <p className="text-[1.3em] text-[color:var(--ink)]/70">
            {v.pool.length} players, {v.squads.length} teams, {a.budget} points each
          </p>
        </div>
      ) : lot ? (
        <div className="grid gap-[1.6em]">
          <div className="flex items-center gap-[clamp(14px,2vw,40px)]">
            <div
              className="relative grid aspect-[3/4] w-[clamp(96px,15vw,280px)] shrink-0 place-items-center overflow-hidden rounded-[clamp(10px,1.1vw,22px)] border-[clamp(3px,0.3vw,6px)] font-display text-[clamp(2.6rem,6vw,7.5rem)] leading-none font-bold shadow-[0_14px_30px_rgba(19,33,61,.3)]"
              style={{ borderColor: GOLD, background: `linear-gradient(170deg, ${GOLD}55, transparent 60%), ${PITCH_DEEP}`, color: GOLD }}
            >
              {lot.player.photoUrl ? <img src={lot.player.photoUrl} alt="" className="absolute inset-0 size-full object-cover" /> : initials(lot.player.name)}
              {lot.player.jersey && (
                <span className="absolute top-[0.12em] left-[0.18em] font-display text-[0.42em] leading-none font-bold" style={{ color: GOLD, textShadow: "0 2px 6px rgba(0,0,0,.7)" }}>
                  {lot.player.jersey}
                </span>
              )}
              {lot.player.position && (
                <span className="absolute inset-x-0 bottom-0 truncate px-[0.3em] py-[0.12em] text-center font-display text-[0.24em] leading-tight font-bold uppercase" style={{ background: GOLD, color: PITCH_DEEP }}>
                  {lot.player.position}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[1.2em] text-[color:var(--ink)]/65">On the block</p>
              <p className="font-display text-[clamp(2.6rem,6.2vw,8rem)] leading-[0.86] font-bold break-words uppercase">{lot.player.name}</p>
              <p className="mt-[0.4em] text-[1.25em]">
                {lot.player.position && <span className="text-[color:var(--ink)]/75">{lot.player.position}, </span>}
                base price <strong className="font-display text-[1.25em] tabular" style={{ color: GOLD_INK }}>{lot.player.basePrice}</strong>
              </p>
            </div>
            <Clock left={left} frac={frac} />
          </div>

          <div key={lot.bids} className="au-bump flex flex-wrap items-center gap-x-[0.6em] gap-y-[0.3em] rounded-[1em] px-[1em] py-[0.6em]" style={{ background: tint ?? "rgba(19,33,61,.06)", color: tint ? "#FFFFFF" : INK }}>
            {lot.topBid != null ? (
              <>
                <span className="font-display text-[clamp(3.4rem,8vw,10rem)] leading-[0.85] font-bold tabular" style={{ color: "#FFFFFF", textShadow: "0 4px 0 rgba(0,0,0,.25)" }}>
                  {lot.topBid}
                </span>
                <span className="flex items-center gap-[0.4em] font-display text-[clamp(1.6rem,3.2vw,4rem)] leading-none font-bold uppercase">
                  <Mark color={tint!} logoUrl={v.squads.find((x) => x.id === lot.topSquadId)?.logoUrl} size="1.1em" />
                  {lot.squadName}
                </span>
              </>
            ) : (
              <span className="font-display text-[clamp(1.6rem,3.4vw,4.2rem)] leading-none font-bold">
                Opening bid <span className="tabular" style={{ color: GOLD_INK }}>{lot.minNext}</span>
              </span>
            )}
          </div>

          {v.bids.length > 1 && (
            <ol aria-label="Earlier bids" className="flex flex-wrap gap-x-[1.2em] gap-y-[0.3em] text-[1.15em] text-[color:var(--ink)]/70">
              {v.bids.slice(1, 6).map((b, i) => (
                <li key={b.at + i} className="inline-flex items-center gap-[0.35em]">
                  <Shirt color={b.color} size="1em" />
                  {b.squad} <span className="font-display font-bold tabular">{b.amount}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : (
        <div className="grid justify-items-center gap-[0.5em] text-center">
          {v.recent[0] ? (
            <>
              <p className="text-[1.3em] text-[color:var(--ink)]/65">{v.recent[0].status === "sold" ? "Just signed" : "No takers for"}</p>
              <p className="font-display text-[clamp(2.8rem,6.5vw,8rem)] leading-[0.86] font-bold uppercase">{v.recent[0].player}</p>
              {v.recent[0].status === "sold" && (
                <p className="flex items-center gap-[0.4em] text-[1.6em]">
                  <Shirt color={v.recent[0].color ?? "#888"} size="1.2em" />
                  {v.recent[0].squad}, <strong className="font-display text-[1.3em] tabular" style={{ color: GOLD_INK }}>{v.recent[0].price}</strong>
                </p>
              )}
            </>
          ) : (
            <p className="font-display text-[clamp(3rem,7vw,9rem)] leading-[0.85] font-bold uppercase">Here we go</p>
          )}
          <p className="mt-[0.6em] text-[1.15em] text-[color:var(--ink)]/55">Next player coming up</p>
        </div>
      )}

      {soldShow && soldShow.status === "sold" && (
        <div className="au-show pointer-events-none absolute inset-0 grid place-items-center" style={{ background: "rgba(255,255,255,.95)" }}>
          <div className="au-stamp grid justify-items-center gap-[0.25em] rounded-[0.5em] border-[0.35em] px-[1em] py-[0.4em] text-center" style={{ borderColor: soldShow.color ?? GOLD, color: soldShow.color ?? GOLD, background: "#FFFFFF" }}>
            {v.squads.find((x) => x.name === soldShow.squad)?.logoUrl && <Mark color={soldShow.color ?? GOLD} logoUrl={v.squads.find((x) => x.name === soldShow.squad)?.logoUrl} size="clamp(3rem,6vw,7rem)" />}
            <span className="font-display text-[clamp(4rem,11vw,13rem)] leading-[0.82] font-bold tracking-[0.04em]">SOLD</span>
            <span className="font-display text-[clamp(1.4rem,3vw,3.6rem)] leading-none font-bold text-[color:var(--ink)] uppercase">{soldShow.player}</span>
            <span className="text-[clamp(1rem,1.8vw,2.2rem)] font-semibold text-[color:var(--ink)]">
              {soldShow.squad}, <span className="font-display font-bold tabular" style={{ color: GOLD_INK }}>{soldShow.price}</span>
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

function Clock({ left, frac }: { left: number; frac: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const hot = left <= 5;
  return (
    <div className="relative shrink-0" style={{ width: "clamp(64px,9vw,190px)", aspectRatio: "1" }} aria-label={`${left} seconds left`}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="#FFFFFF" stroke="rgba(19,33,61,.1)" strokeWidth="7" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={hot ? RED : GOLD} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: "stroke-dashoffset .25s linear" }} />
      </svg>
      <span className="absolute inset-0 grid place-content-center font-display text-[clamp(1.6rem,4vw,5rem)] leading-none font-bold tabular" style={{ color: hot ? RED : INK }}>
        {left}
      </span>
    </div>
  );
}

function Board({ sq, budget, leading }: { sq: SquadView; budget: number; leading: boolean }) {
  const pct = Math.max(0, Math.min(100, (sq.left / Math.max(1, budget)) * 100));
  return (
    <article
      aria-label={sq.name}
      className="relative grid min-h-0 content-start gap-[0.45em] overflow-hidden rounded-[1em] border px-[1em] py-[0.75em] transition-shadow"
      style={{
        borderColor: leading ? GOLD : "transparent",
        borderLeft: `0.45em solid ${sq.color}`,
        background: "#FFFFFF",
        boxShadow: leading ? `0 0 0 0.16em ${GOLD}, 0 10px 30px rgba(10,40,20,.35)` : "0 8px 22px rgba(10,40,20,.25)",
      }}
    >
      <div className="flex items-center gap-[0.7em]">
        <Mark color={sq.color} logoUrl={sq.logoUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[1.75em] leading-none font-bold uppercase">{sq.name}</p>
          <p className="truncate text-[0.9em] text-[color:var(--ink)]/60">
            {sq.captainName ? `Captain ${sq.captainName}` : "No captain yet"}, {sq.count} {sq.count === 1 ? "player" : "players"}
            {sq.full ? ", full" : ""}
          </p>
        </div>
        <p className="shrink-0 text-right">
          <span className="block font-display text-[2em] leading-none font-bold tabular" style={{ color: INK }}>
            {sq.left}
          </span>
          <span className="text-[0.75em] text-[color:var(--ink)]/55">points left</span>
        </p>
      </div>
      <div className="h-[0.35em] overflow-hidden rounded-full bg-[color:var(--ink)]/10" aria-hidden>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${sq.color}, ${GOLD})` }} />
      </div>
      {sq.players.length > 0 && (
        <p className="line-clamp-2 text-[0.95em] leading-snug">
          {sq.players.map((p, i) => (
            <span key={p.id}>
              {i > 0 && <span className="text-[color:var(--ink)]/30"> / </span>}
              {p.name}
              {p.status === "captain" ? <span className="text-[color:var(--ink)]/55"> (C)</span> : <span className="font-display font-bold tabular" style={{ color: GOLD_INK }}> {p.price}</span>}
            </span>
          ))}
        </p>
      )}
    </article>
  );
}

function Final({ v }: { v: AuctionView }) {
  const top = v.summary.topBuys[0];
  return (
    <main className="relative z-10 grid flex-1 content-start gap-[1.2em] px-[clamp(16px,2.5vw,48px)] py-[clamp(12px,2vh,28px)] lg:min-h-0">
      <div className="grid gap-[0.3em]">
        <p className="font-display text-[clamp(2.6rem,6vw,7rem)] leading-[0.86] font-bold au-light uppercase" style={{ textShadow: "0 3px 0 rgba(10,40,20,.35)" }}>The teams are set</p>
        {top && (
          <p className="flex flex-wrap items-center gap-x-[0.4em] justify-self-start rounded-[0.8em] au-paper px-[1em] py-[0.3em] text-[1.3em] shadow-[0_6px_18px_rgba(10,40,20,.25)]">
            Record signing: <strong>{top.player}</strong> to {top.squad} for{" "}
            <strong className="font-display text-[1.3em] tabular" style={{ color: GOLD_INK }}>
              {top.price}
            </strong>
          </p>
        )}
      </div>
      <div className="grid gap-[1em] lg:min-h-0" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 15em), 1fr))" }}>
        {v.squads.map((sq) => (
          <article
            key={sq.id}
            aria-label={sq.name}
            className="grid content-start gap-[0.7em] overflow-hidden rounded-[1.2em] border-t-[0.5em] au-paper p-[1.1em] shadow-[0_12px_30px_rgba(10,40,20,.3)]"
            style={{ borderTopColor: sq.color }}
          >
            <div className="flex items-center gap-[0.7em]">
              <Mark color={sq.color} logoUrl={sq.logoUrl} size="3.2em" />
              <div className="min-w-0">
                <p className="font-display text-[2em] leading-none font-bold break-words uppercase">{sq.name}</p>
                <p className="text-[0.9em] text-[color:var(--ink)]/65">
                  Spent <span className="font-display font-bold tabular" style={{ color: GOLD_INK }}>{sq.spent}</span> of {v.auction.budget}
                </p>
              </div>
            </div>
            <ul className="grid gap-[0.15em] border-t border-[color:var(--ink)]/10 pt-[0.6em]">
              {sq.players.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-[0.6em] text-[1.15em]">
                  <span className="min-w-0 truncate">
                    {p.name}
                    {p.status === "captain" && <span className="text-[color:var(--ink)]/55"> (C)</span>}
                  </span>
                  {p.status === "sold" && (
                    <span className="shrink-0 font-display font-bold tabular" style={{ color: GOLD_INK }}>
                      {p.price}
                    </span>
                  )}
                </li>
              ))}
              {sq.players.length === 0 && <li className="text-[color:var(--ink)]/55">No players</li>}
            </ul>
          </article>
        ))}
      </div>
    </main>
  );
}
