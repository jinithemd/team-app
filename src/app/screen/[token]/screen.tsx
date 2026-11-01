"use client";

import { useEffect, useRef, useState } from "react";
import { Expand, Gavel, Trophy } from "lucide-react";
import type { AuctionView, SquadView } from "@/lib/auction/service";

/*
 * The big screen: the live auction on a TV or projector, for the whole team and the fans.
 * Read-only, sized to the screen (everything scales with the window), refreshes every second,
 * keeps the screen awake and celebrates every sale.
 */

type ScreenView = AuctionView & { teamColor: string; teamColor2: string | null };

const STYLE = `
@keyframes sold-show { 0%, 88% { opacity: 1 } 100% { opacity: 0 } }
@keyframes sold-pop { 0% { transform: scale(.6) } 12% { transform: scale(1.08) } 22%, 100% { transform: scale(1) } }
@keyframes bid-flash { 0% { transform: scale(1.12) } 100% { transform: scale(1) } }
.sold-show { animation: sold-show 6s linear forwards }
.sold-pop { animation: sold-pop 6s ease-out forwards }
.bid-flash { animation: bid-flash .45s ease-out }
`;

export function AuctionScreen({ token, initial }: { token: string; initial: ScreenView }) {
  const [v, setV] = useState(initial);
  const [skew, setSkew] = useState(0);
  const [, tick] = useState(0);
  const [soldShow, setSoldShow] = useState<AuctionView["recent"][number] | null>(null);
  const lastSeen = useRef<string | null>(initial.recent[0]?.id ?? null);
  const [full, setFull] = useState(false);

  // Live updates.
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

  // Keep the TV awake while the auction is on screen.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const grab = async () => {
      try {
        lock = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") ?? null;
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
    <div className="fixed inset-0 grid grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-[#06080D] text-[#F3F4F6]" style={{ fontSize: "clamp(12px, 1.25vw, 28px)" }}>
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      {/* Header */}
      <header className="flex items-center justify-between gap-[2vw] border-b-[0.4vh] px-[2.5vw] py-[1.6vh]" style={{ borderColor: v.teamColor }}>
        <div className="flex min-w-0 items-center gap-[1vw]">
          <Gavel aria-hidden style={{ width: "2.4em", height: "2.4em", color: v.teamColor2 ?? v.teamColor }} />
          <div className="min-w-0">
            <p className="truncate font-display text-[2.4em] leading-none font-bold uppercase">{a.title}</p>
            <p className="truncate text-[1em] opacity-70">
              {v.teamName} · {a.budget} points a team · bids in steps of {a.minIncrement}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-[1vw]">
          {a.status === "live" && (
            <span className="inline-flex items-center gap-[0.5em] rounded-full bg-[#E5484D] px-[1em] py-[0.3em] text-[1.1em] font-bold uppercase">
              <span className="live-dot size-[0.6em] rounded-full bg-white" />
              Live
            </span>
          )}
          <span className="text-[1em] opacity-70 tabular">
            {v.summary.sold} sold · {v.summary.toGo} to go
          </span>
          {!full && (
            <button
              type="button"
              onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})}
              className="inline-flex items-center gap-[0.4em] rounded-md border border-white/30 px-[0.8em] py-[0.4em] text-[0.9em] font-semibold"
            >
              <Expand aria-hidden style={{ width: "1.1em", height: "1.1em" }} />
              Full screen
            </button>
          )}
        </div>
      </header>

      {/* Main */}
      {a.status === "done" ? (
        <Final v={v} />
      ) : (
        <main className="grid min-h-0 grid-cols-1 gap-[2vw] px-[2.5vw] py-[2vh] lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <section aria-label="Up now" className="relative grid min-h-0 content-center gap-[2.5vh] rounded-[1.2vw] border-[0.3vw] p-[2.5vw]" style={{ borderColor: lot?.squadColor ?? "rgba(255,255,255,.12)" }}>
            {a.status === "setup" ? (
              <div className="grid gap-[2vh] text-center">
                <p className="text-[1.6em] tracking-[0.3em] uppercase opacity-70">Starting soon</p>
                <p className="font-display text-[6em] leading-none font-bold uppercase">Player auction</p>
                <p className="text-[1.4em] opacity-80">{v.pool.length} players · {v.squads.length} teams</p>
              </div>
            ) : lot ? (
              <>
                <div className="flex items-start justify-between gap-[2vw]">
                  <div className="min-w-0">
                    <p className="text-[1.3em] tracking-[0.3em] uppercase opacity-60">Now bidding</p>
                    <p className="font-display text-[6.5em] leading-[0.95] font-bold break-words uppercase">{lot.player.name}</p>
                    <p className="mt-[1vh] text-[1.5em] opacity-70">Base price {lot.player.basePrice}</p>
                  </div>
                  <Clock left={left} frac={frac} />
                </div>
                <div key={lot.bids} className="bid-flash flex flex-wrap items-baseline gap-x-[1.5vw] rounded-[1vw] px-[2vw] py-[2vh]" style={{ background: lot.squadColor ?? "rgba(255,255,255,.06)" }}>
                  {lot.topBid != null ? (
                    <>
                      <span className="font-display text-[7em] leading-none font-bold tabular">{lot.topBid}</span>
                      <span className="font-display text-[3em] leading-none font-bold uppercase">{lot.squadName}</span>
                    </>
                  ) : (
                    <span className="font-display text-[3.5em] leading-none font-bold uppercase opacity-90">No bids yet · opens at {lot.minNext}</span>
                  )}
                </div>
                {v.bids.length > 1 && (
                  <ol className="flex flex-wrap gap-x-[1.5vw] gap-y-[0.5vh] text-[1.3em] opacity-80">
                    {v.bids.slice(1, 6).map((b, i) => (
                      <li key={b.at + i} className="inline-flex items-center gap-[0.4em]">
                        <span className="size-[0.6em] rounded-full" style={{ background: b.color }} />
                        {b.squad} <span className="tabular opacity-70">{b.amount}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            ) : (
              <div className="grid gap-[2vh] text-center">
                {v.recent[0] ? (
                  <>
                    <p className="text-[1.6em] tracking-[0.3em] uppercase opacity-60">Last player</p>
                    <p className="font-display text-[5em] leading-none font-bold uppercase">{v.recent[0].player}</p>
                    <p className="text-[2em]">
                      {v.recent[0].status === "sold" ? (
                        <>
                          to <strong style={{ color: v.recent[0].color ?? undefined }}>{v.recent[0].squad}</strong> for <strong className="tabular">{v.recent[0].price}</strong>
                        </>
                      ) : (
                        "unsold"
                      )}
                    </p>
                  </>
                ) : (
                  <p className="font-display text-[5em] leading-none font-bold uppercase">Here we go</p>
                )}
                <p className="text-[1.4em] opacity-60">Next player coming up…</p>
              </div>
            )}
            {soldShow && soldShow.status === "sold" && (
              <div className="sold-show pointer-events-none absolute inset-0 grid place-content-center rounded-[1vw] text-center" style={{ background: soldShow.color ?? "#18794E" }}>
                <div className="sold-pop grid gap-[1vh]">
                  <p className="font-display text-[10em] leading-none font-bold tracking-wide">SOLD!</p>
                  <p className="font-display text-[4em] leading-none font-bold uppercase">{soldShow.player}</p>
                  <p className="text-[2.2em] font-semibold">
                    to {soldShow.squad} for <span className="tabular">{soldShow.price}</span>
                  </p>
                </div>
              </div>
            )}
          </section>

          <aside aria-label="Teams" className="grid min-h-0 auto-rows-fr gap-[1.2vh] overflow-hidden">
            {v.squads.map((sq) => (
              <TeamBoard key={sq.id} sq={sq} leading={lot?.topSquadId === sq.id} />
            ))}
          </aside>
        </main>
      )}

      {/* Ticker */}
      <footer className="flex items-center gap-[1.5vw] overflow-hidden border-t border-white/10 px-[2.5vw] py-[1.2vh] text-[1.1em] whitespace-nowrap">
        <span className="shrink-0 font-bold tracking-[0.2em] uppercase opacity-60">Latest</span>
        {v.recent.length === 0 ? (
          <span className="opacity-50">No sales yet</span>
        ) : (
          v.recent.map((r) => (
            <span key={r.id} className="inline-flex shrink-0 items-center gap-[0.4em]">
              <span className="size-[0.6em] rounded-full" style={{ background: r.color ?? "#666" }} />
              <strong>{r.player}</strong>
              <span className="opacity-70">{r.status === "sold" ? `${r.squad} · ${r.price}` : "unsold"}</span>
            </span>
          ))
        )}
        <span className="ml-auto shrink-0 opacity-50">clbx.ca</span>
      </footer>
    </div>
  );
}

function Clock({ left, frac }: { left: number; frac: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const hot = left <= 5;
  return (
    <div className="relative shrink-0" style={{ width: "9em", height: "9em" }} aria-label={`${left} seconds left`}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={hot ? "#E5484D" : "#F3F4F6"} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: "stroke-dashoffset .25s linear" }} />
      </svg>
      <span className={`absolute inset-0 grid place-content-center font-display text-[4em] leading-none font-bold tabular ${hot ? "text-[#E5484D]" : ""}`}>{left}</span>
    </div>
  );
}

function TeamBoard({ sq, leading }: { sq: SquadView; leading: boolean }) {
  return (
    <div className={`grid min-h-0 content-start gap-[0.6vh] overflow-hidden rounded-[0.8vw] border-l-[0.5vw] bg-white/[.04] px-[1.2vw] py-[1vh] ${leading ? "ring-[0.25vw] ring-white" : ""}`} style={{ borderColor: sq.color }}>
      <div className="flex items-baseline justify-between gap-[1vw]">
        <p className="truncate font-display text-[1.9em] leading-none font-bold uppercase" style={{ color: sq.color }}>
          {sq.name}
        </p>
        <p className="shrink-0 font-display text-[2em] leading-none font-bold tabular">
          {sq.left}
          <span className="ml-[0.2em] text-[0.45em] font-normal opacity-60">left</span>
        </p>
      </div>
      <p className="truncate text-[0.95em] opacity-70">
        {sq.captainName ? `Captain ${sq.captainName}` : "No captain"} · {sq.count} {sq.count === 1 ? "player" : "players"}
        {sq.full ? " · full" : ""}
      </p>
      <p className="line-clamp-2 text-[1em] opacity-90">{sq.players.map((p) => (p.status === "sold" ? `${p.name} ${p.price}` : p.name)).join(" · ")}</p>
    </div>
  );
}

function Final({ v }: { v: AuctionView }) {
  return (
    <main className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-[2vh] px-[2.5vw] py-[2vh]">
      <div className="flex flex-wrap items-center justify-between gap-[2vw]">
        <p className="inline-flex items-center gap-[0.5em] font-display text-[3.5em] leading-none font-bold uppercase">
          <Trophy aria-hidden style={{ width: "1em", height: "1em" }} />
          The teams are picked
        </p>
        {v.summary.topBuys[0] && (
          <p className="text-[1.4em]">
            Top buy: <strong>{v.summary.topBuys[0].player}</strong> · {v.summary.topBuys[0].squad} · <strong className="tabular">{v.summary.topBuys[0].price}</strong>
          </p>
        )}
      </div>
      <div className="grid min-h-0 gap-[1.5vw]" style={{ gridTemplateColumns: `repeat(${Math.min(4, v.squads.length)}, minmax(0, 1fr))` }}>
        {v.squads.map((sq) => (
          <div key={sq.id} className="grid min-h-0 content-start gap-[1vh] overflow-hidden rounded-[1vw] border-t-[0.6vh] bg-white/[.04] p-[1.5vw]" style={{ borderColor: sq.color }}>
            <p className="font-display text-[2.4em] leading-none font-bold uppercase" style={{ color: sq.color }}>
              {sq.name}
            </p>
            <p className="text-[1em] opacity-70">
              Spent {sq.spent} · {sq.left} left
            </p>
            <ul className="grid gap-[0.4vh] text-[1.25em]">
              {sq.players.map((p) => (
                <li key={p.id} className="flex justify-between gap-[1vw]">
                  <span className="truncate">
                    {p.name}
                    {p.status === "captain" && <span className="opacity-60"> (C)</span>}
                  </span>
                  {p.status === "sold" && <span className="tabular opacity-70">{p.price}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
