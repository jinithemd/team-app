"use client";

import { useEffect, useRef, useState } from "react";
import { Expand, Gavel } from "lucide-react";
import type { AuctionView, SquadView } from "@/lib/auction/service";

/*
 * The big screen: the auction on a TV or projector for the whole team and the fans.
 * A floodlit night pitch (chalk markings, gold for points), the player up as a big card,
 * each team as a dugout board with its shirt and a points bar, and a rubber SOLD stamp in
 * the buying team's colour. Read-only, refreshes every second, keeps the screen awake.
 * Fits a TV (landscape) and a phone held upright.
 */

type ScreenView = AuctionView & { teamColor: string; teamColor2: string | null };

const PITCH = "#0A2418";
const PITCH_DEEP = "#061A11";
const CHALK = "#E9F1EA";
const GOLD = "#F2C14E";
const RED = "#FF5A5F";

const STYLE = `
.au-root { --pitch: ${PITCH}; --deep: ${PITCH_DEEP}; --chalk: ${CHALK}; --gold: ${GOLD}; font-size: clamp(13px, min(1.15vw, 2.1vh), 30px); }
@keyframes au-stamp { 0% { transform: rotate(-14deg) scale(2.6); opacity: 0 } 14% { transform: rotate(-14deg) scale(.94); opacity: 1 } 20%, 100% { transform: rotate(-14deg) scale(1) } }
@keyframes au-show { 0%, 90% { opacity: 1 } 100% { opacity: 0 } }
@keyframes au-bump { 0% { transform: scale(1.14) } 100% { transform: scale(1) } }
.au-stamp { animation: au-stamp 6s cubic-bezier(.2,.9,.3,1.2) forwards }
.au-show { animation: au-show 6s linear forwards }
.au-bump { animation: au-bump .5s ease-out }
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
          <stop stopColor="#FFFFFF" stopOpacity=".16" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="au-flood-r" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1520 -60) rotate(140) scale(900 700)">
          <stop stopColor="#FFFFFF" stopOpacity=".16" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <pattern id="au-mow" width="200" height="900" patternUnits="userSpaceOnUse">
          <rect width="100" height="900" fill="#FFFFFF" fillOpacity=".022" />
        </pattern>
      </defs>
      <rect width="1600" height="900" fill="url(#au-mow)" />
      <g fill="none" stroke={CHALK} strokeOpacity=".09" strokeWidth="4">
        <rect x="40" y="40" width="1520" height="820" />
        <line x1="800" y1="40" x2="800" y2="860" />
        <circle cx="800" cy="450" r="130" />
        <rect x="40" y="230" width="220" height="440" />
        <rect x="1340" y="230" width="220" height="440" />
        <rect x="40" y="345" width="80" height="210" />
        <rect x="1480" y="345" width="80" height="210" />
      </g>
      <circle cx="800" cy="450" r="7" fill={CHALK} fillOpacity=".12" />
      <rect width="1600" height="900" fill="url(#au-flood-l)" />
      <rect width="1600" height="900" fill="url(#au-flood-r)" />
    </svg>
  );
}

function Shirt({ color, size = "2.6em" }: { color: string; size?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 64 60" style={{ width: size, height: size }} className="shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,.45)]">
      <path d="M22 4 12 8 2 20l8 9 6-5v32h32V24l6 5 8-9L52 8 42 4c-1.5 5-5.5 8-10 8s-8.5-3-10-8Z" fill={color} stroke="rgba(255,255,255,.55)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
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
      className="au-root fixed inset-0 flex flex-col overflow-x-hidden overflow-y-auto text-[color:var(--chalk)] lg:overflow-hidden"
      style={{ background: `radial-gradient(120% 90% at 50% 0%, ${PITCH} 0%, ${PITCH_DEEP} 70%)` }}
    >
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <Pitch />

      <header className="relative z-10 flex items-center gap-[1em] px-[clamp(16px,2.5vw,48px)] pt-[clamp(12px,2vh,28px)]">
        <span className="grid size-[3em] shrink-0 place-items-center rounded-full" style={{ background: GOLD, color: PITCH_DEEP }}>
          <Gavel aria-hidden style={{ width: "1.6em", height: "1.6em" }} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[2.6em] leading-[0.95] font-bold uppercase">{a.title}</h1>
          <p className="truncate text-[0.95em] text-[color:var(--chalk)]/70">
            {v.teamName}, {a.budget} points a team
          </p>
        </div>
        {a.status === "live" && (
          <span className="inline-flex shrink-0 items-center gap-[0.45em] rounded-full px-[0.9em] py-[0.25em] font-display text-[1.2em] font-bold uppercase" style={{ background: RED }}>
            <span className="live-dot size-[0.55em] rounded-full bg-white" />
            Live
          </span>
        )}
        {!full && (
          <button
            type="button"
            onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})}
            className="hidden shrink-0 items-center gap-[0.4em] rounded-full border border-white/25 px-[0.9em] py-[0.35em] text-[0.85em] font-semibold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white sm:inline-flex"
          >
            <Expand aria-hidden style={{ width: "1em", height: "1em" }} />
            Full screen
          </button>
        )}
      </header>

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

      <footer className="relative z-10 flex items-center gap-[1.2em] overflow-hidden border-t border-white/10 bg-black/25 px-[clamp(16px,2.5vw,48px)] py-[0.7em] text-[1em] whitespace-nowrap">
        <span className="shrink-0 font-display text-[1.15em] font-bold" style={{ color: GOLD }}>
          {v.summary.sold} sold, {v.summary.toGo} to go
        </span>
        <span className="h-[1.2em] w-px shrink-0 bg-white/20" />
        {v.recent.length === 0 ? (
          <span className="text-[color:var(--chalk)]/55">The first sale shows up here</span>
        ) : (
          v.recent.map((r) => (
            <span key={r.id} className="inline-flex shrink-0 items-center gap-[0.45em]">
              {r.color ? <Shirt color={r.color} size="1.2em" /> : <span className="size-[0.55em] rounded-full bg-white/30" />}
              <strong className="font-semibold">{r.player}</strong>
              <span className="text-[color:var(--chalk)]/65">{r.status === "sold" ? `${r.squad}, ${r.price}` : "unsold"}</span>
            </span>
          ))
        )}
        <span className="ml-auto shrink-0 font-display font-bold text-[color:var(--chalk)]/45">clbx.ca</span>
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
      className="relative grid min-h-[60vh] content-center overflow-hidden rounded-[1.4em] border border-white/10 p-[clamp(18px,2.5vw,48px)] lg:min-h-0"
      style={{ background: tint ? `linear-gradient(160deg, color-mix(in srgb, ${tint} 34%, transparent), rgba(0,0,0,.35) 65%)` : "rgba(0,0,0,.28)" }}
    >
      {a.status === "setup" ? (
        <div className="grid justify-items-center gap-[0.6em] text-center">
          <p className="font-display text-[1.6em] font-bold" style={{ color: GOLD }}>
            Starting soon
          </p>
          <p className="font-display text-[clamp(3rem,7vw,9rem)] leading-[0.85] font-bold uppercase">Auction night</p>
          <p className="text-[1.3em] text-[color:var(--chalk)]/75">
            {v.pool.length} players, {v.squads.length} teams, {a.budget} points each
          </p>
        </div>
      ) : lot ? (
        <div className="grid gap-[1.6em]">
          <div className="flex items-center gap-[clamp(14px,2vw,40px)]">
            <div
              className="grid aspect-[3/4] w-[clamp(84px,13vw,240px)] shrink-0 place-items-center rounded-[clamp(10px,1.1vw,22px)] border-[clamp(3px,0.3vw,6px)] font-display text-[clamp(2.6rem,6vw,7.5rem)] leading-none font-bold shadow-[0_18px_40px_rgba(0,0,0,.45)]"
              style={{ borderColor: GOLD, background: `linear-gradient(170deg, ${GOLD}33, transparent 60%), ${PITCH_DEEP}`, color: GOLD }}
            >
              {initials(lot.player.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[1.2em] text-[color:var(--chalk)]/70">On the block</p>
              <p className="font-display text-[clamp(2.6rem,6.2vw,8rem)] leading-[0.86] font-bold break-words uppercase">{lot.player.name}</p>
              <p className="mt-[0.4em] text-[1.25em]">
                Base price <strong className="font-display text-[1.25em] tabular" style={{ color: GOLD }}>{lot.player.basePrice}</strong>
              </p>
            </div>
            <Clock left={left} frac={frac} />
          </div>

          <div key={lot.bids} className="au-bump flex flex-wrap items-center gap-x-[0.6em] gap-y-[0.3em] rounded-[1em] px-[1em] py-[0.6em]" style={{ background: tint ?? "rgba(255,255,255,.07)" }}>
            {lot.topBid != null ? (
              <>
                <span className="font-display text-[clamp(3.4rem,8vw,10rem)] leading-[0.85] font-bold tabular" style={{ color: GOLD, textShadow: "0 4px 0 rgba(0,0,0,.35)" }}>
                  {lot.topBid}
                </span>
                <span className="flex items-center gap-[0.4em] font-display text-[clamp(1.6rem,3.2vw,4rem)] leading-none font-bold uppercase">
                  <Shirt color={tint!} size="1.1em" />
                  {lot.squadName}
                </span>
              </>
            ) : (
              <span className="font-display text-[clamp(1.6rem,3.4vw,4.2rem)] leading-none font-bold">
                Opening bid <span className="tabular" style={{ color: GOLD }}>{lot.minNext}</span>
              </span>
            )}
          </div>

          {v.bids.length > 1 && (
            <ol aria-label="Earlier bids" className="flex flex-wrap gap-x-[1.2em] gap-y-[0.3em] text-[1.15em] text-[color:var(--chalk)]/75">
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
              <p className="text-[1.3em] text-[color:var(--chalk)]/70">{v.recent[0].status === "sold" ? "Just signed" : "No takers for"}</p>
              <p className="font-display text-[clamp(2.8rem,6.5vw,8rem)] leading-[0.86] font-bold uppercase">{v.recent[0].player}</p>
              {v.recent[0].status === "sold" && (
                <p className="flex items-center gap-[0.4em] text-[1.6em]">
                  <Shirt color={v.recent[0].color ?? "#888"} size="1.2em" />
                  {v.recent[0].squad}, <strong className="font-display text-[1.3em] tabular" style={{ color: GOLD }}>{v.recent[0].price}</strong>
                </p>
              )}
            </>
          ) : (
            <p className="font-display text-[clamp(3rem,7vw,9rem)] leading-[0.85] font-bold uppercase">Here we go</p>
          )}
          <p className="mt-[0.6em] text-[1.15em] text-[color:var(--chalk)]/55">Next player coming up</p>
        </div>
      )}

      {soldShow && soldShow.status === "sold" && (
        <div className="au-show pointer-events-none absolute inset-0 grid place-items-center" style={{ background: "rgba(4,16,10,.92)" }}>
          <div className="au-stamp grid justify-items-center gap-[0.25em] rounded-[0.5em] border-[0.35em] px-[1em] py-[0.4em] text-center" style={{ borderColor: soldShow.color ?? GOLD, color: soldShow.color ?? GOLD, background: PITCH_DEEP }}>
            <span className="font-display text-[clamp(4rem,11vw,13rem)] leading-[0.82] font-bold tracking-[0.04em]">SOLD</span>
            <span className="font-display text-[clamp(1.4rem,3vw,3.6rem)] leading-none font-bold text-[color:var(--chalk)] uppercase">{soldShow.player}</span>
            <span className="text-[clamp(1rem,1.8vw,2.2rem)] font-semibold text-[color:var(--chalk)]">
              {soldShow.squad}, <span className="font-display font-bold tabular" style={{ color: GOLD }}>{soldShow.price}</span>
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
        <circle cx="50" cy="50" r={r} fill="rgba(0,0,0,.35)" stroke="rgba(255,255,255,.12)" strokeWidth="7" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={hot ? RED : GOLD} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: "stroke-dashoffset .25s linear" }} />
      </svg>
      <span className="absolute inset-0 grid place-content-center font-display text-[clamp(1.6rem,4vw,5rem)] leading-none font-bold tabular" style={{ color: hot ? RED : CHALK }}>
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
        borderColor: leading ? GOLD : "rgba(255,255,255,.1)",
        background: `linear-gradient(100deg, color-mix(in srgb, ${sq.color} 26%, transparent), rgba(0,0,0,.3) 55%)`,
        boxShadow: leading ? `0 0 0 0.12em ${GOLD}, 0 0 2.2em ${GOLD}55` : undefined,
      }}
    >
      <div className="flex items-center gap-[0.7em]">
        <Shirt color={sq.color} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[1.75em] leading-none font-bold uppercase">{sq.name}</p>
          <p className="truncate text-[0.9em] text-[color:var(--chalk)]/65">
            {sq.captainName ? `Captain ${sq.captainName}` : "No captain yet"}, {sq.count} {sq.count === 1 ? "player" : "players"}
            {sq.full ? ", full" : ""}
          </p>
        </div>
        <p className="shrink-0 text-right">
          <span className="block font-display text-[2em] leading-none font-bold tabular" style={{ color: GOLD }}>
            {sq.left}
          </span>
          <span className="text-[0.75em] text-[color:var(--chalk)]/60">points left</span>
        </p>
      </div>
      <div className="h-[0.35em] overflow-hidden rounded-full bg-white/10" aria-hidden>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${sq.color}, ${GOLD})` }} />
      </div>
      {sq.players.length > 0 && (
        <p className="line-clamp-2 text-[0.95em] leading-snug">
          {sq.players.map((p, i) => (
            <span key={p.id}>
              {i > 0 && <span className="text-[color:var(--chalk)]/35"> / </span>}
              {p.name}
              {p.status === "captain" ? <span className="text-[color:var(--chalk)]/55"> (C)</span> : <span className="font-display font-bold tabular" style={{ color: GOLD }}> {p.price}</span>}
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
        <p className="font-display text-[clamp(2.6rem,6vw,7rem)] leading-[0.86] font-bold uppercase">The teams are set</p>
        {top && (
          <p className="flex flex-wrap items-center gap-x-[0.4em] text-[1.3em]">
            Record signing: <strong>{top.player}</strong> to {top.squad} for{" "}
            <strong className="font-display text-[1.3em] tabular" style={{ color: GOLD }}>
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
            className="grid content-start gap-[0.7em] overflow-hidden rounded-[1.2em] border border-white/10 p-[1.1em]"
            style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${sq.color} 38%, transparent), rgba(0,0,0,.35) 45%)` }}
          >
            <div className="flex items-center gap-[0.7em]">
              <Shirt color={sq.color} size="3.2em" />
              <div className="min-w-0">
                <p className="font-display text-[2em] leading-none font-bold break-words uppercase">{sq.name}</p>
                <p className="text-[0.9em] text-[color:var(--chalk)]/70">
                  Spent <span className="font-display font-bold tabular" style={{ color: GOLD }}>{sq.spent}</span> of {v.auction.budget}
                </p>
              </div>
            </div>
            <ul className="grid gap-[0.15em] border-t border-white/10 pt-[0.6em]">
              {sq.players.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-[0.6em] text-[1.15em]">
                  <span className="min-w-0 truncate">
                    {p.name}
                    {p.status === "captain" && <span className="text-[color:var(--chalk)]/55"> (C)</span>}
                  </span>
                  {p.status === "sold" && (
                    <span className="shrink-0 font-display font-bold tabular" style={{ color: GOLD }}>
                      {p.price}
                    </span>
                  )}
                </li>
              ))}
              {sq.players.length === 0 && <li className="text-[color:var(--chalk)]/55">No players</li>}
            </ul>
          </article>
        ))}
      </div>
    </main>
  );
}
