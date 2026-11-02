"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, Copy, Gavel, MonitorPlay, Play, Shuffle, Timer, Trophy, Undo2, UserPlus } from "lucide-react";
import type { AuctionView, SquadView } from "@/lib/auction/service";
import {
  addGuestAction, bidAction, closeNowAction, deleteAuctionAction, finishAuctionAction, nextPlayerAction, setPlayerAction, setSquadAction, startAuctionAction,
  undoSaleAction, unsoldBackAction, setMonitorAction, setSquadLogoAction, setPlayerPhotoAction, setBannerAction,
} from "@/app/auction-actions";
import { buttonClass, inputClass } from "@/components/ui";

/*
 * The auction room. Everyone on the team can watch; captains and managers bid for their team;
 * the host runs it. It refreshes about once a second, and the server decides when the clock
 * has run out, so every phone sees the same result.
 */

function useLive(initial: AuctionView) {
  const [v, setV] = useState(initial);
  const [skew, setSkew] = useState(0); // server time minus this phone's time
  const busy = useRef(false);
  const refresh = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const r = await fetch(`/api/auction/${initial.auction.id}`, { cache: "no-store" });
      if (r.ok) {
        const next = (await r.json()) as AuctionView;
        setSkew(Date.parse(next.now) - Date.now());
        setV(next);
      }
    } finally {
      busy.current = false;
    }
  };
  useEffect(() => {
    setSkew(Date.parse(initial.now) - Date.now());
    const every = initial.auction.status === "live" ? 1000 : 4000;
    const t = setInterval(refresh, every);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.auction.id, v.auction.status]);
  return { v, refresh, skew };
}

function useTick(on: boolean) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setN((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [on]);
}

export function AuctionRoom({ initial, teamName, screenUrl, screenQr }: { initial: AuctionView; teamName: string; screenUrl: string | null; screenQr: string | null }) {
  const { v, refresh, skew } = useLive(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ error?: string } | undefined>) =>
    start(async () => {
      const r = await fn();
      setError(r?.error ?? null);
      await refresh();
    });
  const a = v.auction;
  const mySquad = v.squads.find((x) => x.id === v.mySquadId) ?? null;
  return (
    <div className="grid gap-5">
      <Link href={`/t/${a.teamId}/auction`} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        {teamName}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-display text-3xl leading-none font-bold uppercase">
            <Gavel aria-hidden className="size-6 shrink-0" />
            <span className="break-words">{a.title}</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            {a.budget} points per team · base {a.basePrice} · steps of {a.minIncrement}
            {a.squadMin ? ` · at least ${a.squadMin} players` : ""}
            {a.squadMax ? ` · at most ${a.squadMax}` : ""}
          </p>
        </div>
        {a.status === "live" && <span className="inline-flex items-center gap-1.5 rounded-pill bg-danger px-3 py-1 text-xs font-bold text-on-danger uppercase"><span className="live-dot size-1.5 rounded-pill bg-current" />Live</span>}
        {a.status === "done" && <span className="rounded-pill bg-success-soft px-3 py-1 text-xs font-bold text-success uppercase">Finished</span>}
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger">
          {error}
        </p>
      )}
      {mySquad && a.status !== "done" && (
        <p className="rounded-md p-3 text-sm" style={{ background: `color-mix(in srgb, ${mySquad.color} 12%, transparent)` }}>
          You&apos;re bidding for <strong>{mySquad.name}</strong>: {mySquad.left} points left
          {a.status === "live" && !mySquad.full ? `, up to ${mySquad.maxBid} on one player` : ""}
          {mySquad.full ? " (team full)" : ""}.
        </p>
      )}

      {a.status === "setup" && <Setup v={v} run={run} pending={pending} />}
      {a.status === "live" && <Live v={v} run={run} pending={pending} skew={skew} />}
      {a.status === "done" && (
        <p className="flex items-center gap-2 rounded-md bg-success-soft p-3 text-sm">
          <Trophy aria-hidden className="size-4 shrink-0" />
          The teams are picked. Good luck in the tournament!
        </p>
      )}

      {(v.host || v.monitor) && screenUrl && <BigScreen url={screenUrl} qr={screenQr} monitor={v.monitor} monitorName={v.monitorName} />}

      {(v.host || v.monitor || a.status === "done") && a.status !== "setup" && <Summary v={v} />}

      <Squads squads={v.squads} highlight={v.lot?.topSquadId ?? null} />

      {a.status !== "setup" && (v.pool.length > 0 || v.unsold.length > 0) && (
        <section aria-labelledby="pool-h" className="grid gap-2">
          <h2 id="pool-h" className="eyebrow">
            {a.status === "done" ? `Not picked (${v.pool.length + v.unsold.length})` : `Still to go (${v.pool.length})${v.unsold.length ? ` · Unsold (${v.unsold.length})` : ""}`}
          </h2>
          <ul className="flex flex-wrap gap-1.5">
            {v.pool.map((p) => (
              <li key={p.id} className="rounded-pill border border-border px-2.5 py-1 text-sm">
                {p.name} <span className="text-xs text-muted tabular">{p.basePrice}</span>
              </li>
            ))}
            {v.unsold.map((p) => (
              <li key={p.id} className="rounded-pill border border-dashed border-border px-2.5 py-1 text-sm text-muted">
                {p.name} · unsold
              </li>
            ))}
          </ul>
        </section>
      )}

      {v.host && a.status !== "live" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm("Delete this auction? This can't be undone.")) run(() => deleteAuctionAction(a.id));
          }}
          className="justify-self-start text-sm font-semibold text-danger underline"
        >
          Delete auction
        </button>
      )}
    </div>
  );
}

type Run = (fn: () => Promise<{ error?: string } | undefined>) => void;

// ---------------------------------------------------------------------------

function Setup({ v, run, pending }: { v: AuctionView; run: Run; pending: boolean }) {
  const a = v.auction;
  const [guest, setGuest] = useState("");
  if (!v.host)
    return <p className="rounded-md bg-sunken p-3 text-sm">The auction hasn&apos;t started yet. Keep this page open: it goes live here.</p>;
  const inPool = v.pool;
  return (
    <div className="grid gap-5">
      <section aria-labelledby="sq-h" className="grid gap-3">
        <h2 id="sq-h" className="text-lg font-semibold">
          1. Teams, captains and managers
        </h2>
        <p className="text-sm text-muted">The captain or manager of each team does the bidding.{a.captainsPlay ? " Captains join their team for free." : ""}</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {v.squads.map((sq) => (
            <SquadSetup key={sq.id} auctionId={a.id} sq={sq} members={v.members} run={run} pending={pending} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="pl-h" className="grid gap-3">
        <h2 id="pl-h" className="text-lg font-semibold">
          2. Players and base prices ({inPool.length})
        </h2>
        <p className="text-sm text-muted">Give your best players a higher base price. Remove anyone who isn&apos;t playing.</p>
        <ul className="grid gap-1.5">
          {inPool.map((p) => (
            <li key={p.id} className="grid gap-2 rounded-md border border-border p-2.5">
              <div className="flex items-center gap-2.5">
                <PhotoButton
                  label={`Photo for ${p.name}`}
                  src={p.photoUrl}
                  fallback={initials(p.name)}
                  disabled={pending}
                  onPick={(url) => run(() => setPlayerPhotoAction(a.id, p.id, url))}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {p.name}
                    {p.jersey && <span className="font-normal text-muted"> #{p.jersey}</span>}
                  </span>
                  {!p.userId && <span className="block text-xs text-muted">Guest</span>}
                </span>
                <button type="button" disabled={pending} onClick={() => run(() => setPlayerAction(a.id, p.id, { remove: true }))} aria-label={`Remove ${p.name}`} className="min-h-9 px-2 text-xs font-semibold text-danger">
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
                <label className="grid gap-0.5 text-xs font-semibold text-muted">
                  Position
                  <input
                    list="auction-positions"
                    aria-label={`Position for ${p.name}`}
                    defaultValue={p.position ?? ""}
                    placeholder="e.g. Midfield"
                    maxLength={30}
                    onBlur={(e) => {
                      if (e.target.value !== (p.position ?? "")) run(() => setPlayerAction(a.id, p.id, { position: e.target.value }));
                    }}
                    className={`${inputClass} min-h-9 text-sm font-normal text-fg`}
                  />
                </label>
                <label className="grid gap-0.5 text-xs font-semibold text-muted">
                  Base price
                  <input
                    id={`base-${p.id}`}
                    aria-label={`Base price for ${p.name}`}
                    type="number"
                    min={0}
                    defaultValue={p.basePrice}
                    onBlur={(e) => {
                      if (e.target.value !== String(p.basePrice)) run(() => setPlayerAction(a.id, p.id, { basePrice: e.target.value }));
                    }}
                    className={`${inputClass} min-h-9 text-right text-sm font-normal text-fg tabular`}
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
        <datalist id="auction-positions">
          {["Goalkeeper", "Defence", "Midfield", "Forward", "Winger", "Striker"].map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = guest;
            setGuest("");
            run(() => addGuestAction(a.id, n, ""));
          }}
        >
          <label htmlFor="guest" className="sr-only">
            Add a player who isn&apos;t on the team
          </label>
          <input id="guest" value={guest} onChange={(e) => setGuest(e.target.value)} placeholder="Add a guest player" className={`${inputClass} min-h-10`} />
          <button disabled={pending || !guest.trim()} className={buttonClass("secondary", "md")}>
            <UserPlus aria-hidden />
            Add
          </button>
        </form>
      </section>

      <section aria-labelledby="mon-h" className="grid gap-2">
        <h2 id="mon-h" className="text-lg font-semibold">
          3. Big screen monitor (optional)
        </h2>
        <p className="text-sm text-muted">They run the big screen on a TV or projector and see the full summary.</p>
        <label htmlFor="monitor" className="sr-only">
          Monitor
        </label>
        <select
          id="monitor"
          value={a.monitorId ?? ""}
          disabled={pending}
          onChange={(e) => {
            const id = e.target.value;
            run(() => setMonitorAction(a.id, id));
          }}
          className={`${inputClass} min-h-11 max-w-sm`}
        >
          <option value="">No monitor (you run the screen)</option>
          {v.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </section>

      <section aria-labelledby="ban-h" className="grid gap-2">
        <h2 id="ban-h" className="text-lg font-semibold">
          4. Big screen logo and banners (optional)
        </h2>
        <p className="text-sm text-muted">Your event logo, a tournament poster across the top and your sponsors along the bottom. Without a logo, the club crest is used.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <BannerPick label="Event logo" hint="Top bar and card deck" src={v.eventLogoUrl} disabled={pending} onPick={(d) => run(() => setBannerAction(a.id, "logo", d))} />
          <BannerPick label="Tournament poster" hint="Top of the screen" src={v.bannerUrl} disabled={pending} onPick={(d) => run(() => setBannerAction(a.id, "banner", d))} />
          <BannerPick label="Sponsors banner" hint="Bottom of the screen" src={v.sponsorBannerUrl} disabled={pending} onPick={(d) => run(() => setBannerAction(a.id, "sponsors", d))} />
        </div>
      </section>

      <button type="button" disabled={pending} onClick={() => run(() => startAuctionAction(a.id))} className={buttonClass("primary", "lg", "justify-self-start")}>
        <Play aria-hidden />
        Start the auction
      </button>
    </div>
  );
}

function SquadSetup({ auctionId, sq, members, run, pending }: { auctionId: string; sq: SquadView; members: { id: string; name: string }[]; run: Run; pending: boolean }) {
  const [name, setName] = useState(sq.name);
  const [cap, setCap] = useState(sq.captainId ?? "");
  const [man, setMan] = useState(sq.managerId ?? "");
  const dirty = name !== sq.name || cap !== (sq.captainId ?? "") || man !== (sq.managerId ?? "");
  return (
    <li className="grid gap-2 rounded-lg border-2 p-3" style={{ borderColor: sq.color }}>
      <div className="flex items-center gap-3">
        <PhotoButton label={`Logo for ${sq.name}`} src={sq.logoUrl} fallback={<Shirt color={sq.color} />} disabled={pending} onPick={(url) => run(() => setSquadLogoAction(auctionId, sq.id, url))} square />
        <span className="text-xs text-muted">{sq.logoUrl ? "Tap the logo to change it." : "Tap to add a team logo."}</span>
      </div>
      <label className="grid gap-1 text-xs font-semibold">
        Team name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={`${inputClass} min-h-10 text-sm font-semibold`} />
      </label>
      <label className="grid gap-1 text-xs font-semibold">
        Captain
        <select value={cap} onChange={(e) => setCap(e.target.value)} className={`${inputClass} min-h-10 text-sm`}>
          <option value="">Pick a captain</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-semibold">
        Manager (optional)
        <select value={man} onChange={(e) => setMan(e.target.value)} className={`${inputClass} min-h-10 text-sm`}>
          <option value="">None</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      {dirty && (
        <button type="button" disabled={pending} onClick={() => run(() => setSquadAction(auctionId, sq.id, { name, captainId: cap, managerId: man }))} className={buttonClass("primary", "sm", "justify-self-start")}>
          Save {name || "team"}
        </button>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------

function Live({ v, run, pending, skew }: { v: AuctionView; run: Run; pending: boolean; skew: number }) {
  const a = v.auction;
  const lot = v.lot;
  useTick(!!lot);
  const left = lot ? Math.max(0, Math.ceil((Date.parse(lot.endsAt) - (Date.now() + skew)) / 1000)) : 0;
  const mine = v.squads.find((x) => x.id === v.mySquadId) ?? null;
  const [custom, setCustom] = useState("");
  const [pick, setPick] = useState("");
  const steps = useMemo(() => (lot ? [lot.minNext, lot.minNext + a.minIncrement * 2, lot.minNext + a.minIncrement * 5] : []), [lot, a.minIncrement]);
  const leading = !!lot && !!mine && lot.topSquadId === mine.id;
  const canBid = !!lot && !!mine && !leading && !mine.full && left > 0;
  return (
    <div className="grid gap-4">
      {lot ? (
        <section aria-label="Up now" className="grid gap-3 rounded-xl border-2 p-4" style={{ borderColor: lot.squadColor ?? "var(--border)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-sunken font-display text-2xl font-bold text-muted">
                {lot.player.photoUrl ? <img src={lot.player.photoUrl} alt="" className="size-full object-cover" /> : initials(lot.player.name)}
              </span>
              <div className="min-w-0">
                <p className="eyebrow">Up now</p>
                <p className="font-display text-4xl leading-none font-bold break-words uppercase">{lot.player.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {[lot.player.position, lot.player.jersey ? `#${lot.player.jersey}` : null, `base price ${lot.player.basePrice}`].filter(Boolean).join(", ")}
                </p>
              </div>
            </div>
            <div className={`grid shrink-0 justify-items-center rounded-lg px-3 py-2 ${left <= 5 ? "bg-danger text-on-danger" : "bg-sunken"}`} aria-label={`${left} seconds left`}>
              <Timer aria-hidden className="size-4" />
              <span className="font-display text-3xl leading-none font-bold tabular">{left}</span>
            </div>
          </div>
          <div role="status" aria-live="polite" className="rounded-lg p-3" style={{ background: lot.squadColor ? `color-mix(in srgb, ${lot.squadColor} 14%, transparent)` : "var(--sunken)" }}>
            {lot.topBid != null ? (
              <p className="text-lg">
                <span className="font-display text-3xl font-bold tabular">{lot.topBid}</span> <span className="font-semibold">{lot.squadName}</span>
                {leading && <span className="ml-2 text-sm font-semibold text-success">That&apos;s you</span>}
              </p>
            ) : (
              <p className="text-lg font-semibold">No bids yet · opens at {lot.minNext}</p>
            )}
          </div>
          {mine && (
            <div className="grid gap-2">
              <div className="grid grid-cols-3 gap-2">
                {steps.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    disabled={pending || !canBid || amt > mine.maxBid}
                    onClick={() => run(() => bidAction(a.id, amt))}
                    className={buttonClass("primary", "lg", "w-full tabular")}
                  >
                    {amt}
                  </button>
                ))}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = Number(custom);
                  setCustom("");
                  run(() => bidAction(a.id, n));
                }}
              >
                <label htmlFor="custom-bid" className="sr-only">
                  Your bid
                </label>
                <input id="custom-bid" type="number" inputMode="numeric" min={lot.minNext} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={`Bid ${lot.minNext} or more`} className={`${inputClass} min-h-11 tabular`} />
                <button disabled={pending || !canBid || !custom} className={buttonClass("secondary", "md")}>
                  Bid
                </button>
              </form>
              <p className="text-xs text-muted">{leading ? "You're winning. Others can still bid." : mine.full ? "Your team is full." : `You can bid up to ${mine.maxBid}.`}</p>
            </div>
          )}
          {v.bids.length > 0 && (
            <ol className="grid gap-0.5 text-sm" aria-label="Bids">
              {v.bids.map((b, i) => (
                <li key={b.at + i} className="flex items-center gap-2">
                  <span aria-hidden className="size-2 rounded-pill" style={{ background: b.color }} />
                  <span className="font-semibold">{b.squad}</span>
                  <span className="tabular text-muted">{b.amount}</span>
                </li>
              ))}
            </ol>
          )}
          {v.host && (
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <button type="button" disabled={pending || lot.topBid == null} onClick={() => run(() => closeNowAction(a.id, "sold"))} className={buttonClass("primary", "sm")}>
                Sold now
              </button>
              <button type="button" disabled={pending} onClick={() => run(() => closeNowAction(a.id, "unsold"))} className={buttonClass("secondary", "sm")}>
                Pass (unsold)
              </button>
            </div>
          )}
        </section>
      ) : (
        <section aria-label="Up now" className="grid gap-2 rounded-xl border-2 border-dashed border-border p-4 text-center">
          {v.recent[0] ? (
            <p className="text-lg">
              <strong>{v.recent[0].player}</strong>{" "}
              {v.recent[0].status === "sold" ? (
                <>
                  sold to <strong>{v.recent[0].squad}</strong> for <strong className="tabular">{v.recent[0].price}</strong>
                </>
              ) : (
                "went unsold"
              )}
            </p>
          ) : (
            <p className="text-lg font-semibold">The auction is open.</p>
          )}
          <p className="text-sm text-muted">{v.host ? "Put the next player up." : "Waiting for the next player…"}</p>
        </section>
      )}

      {v.host && !lot && (
        <div className="grid gap-3 rounded-lg border border-border p-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending || v.pool.length === 0} onClick={() => run(() => nextPlayerAction(a.id))} className={buttonClass("primary", "md")}>
              <Shuffle aria-hidden />
              Next player (random)
            </button>
            <span className="flex gap-2">
              <label htmlFor="pick" className="sr-only">
                Choose who goes next
              </label>
              <select id="pick" value={pick} onChange={(e) => setPick(e.target.value)} className={`${inputClass} min-h-11 max-w-48`}>
                <option value="">Choose who&apos;s next</option>
                {v.pool.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.basePrice})
                  </option>
                ))}
              </select>
              <button type="button" disabled={pending || !pick} onClick={() => run(() => nextPlayerAction(a.id, pick))} className={buttonClass("secondary", "md")}>
                Put up
              </button>
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <button type="button" disabled={pending} onClick={() => run(() => undoSaleAction(a.id))} className={buttonClass("ghost", "sm")}>
              <Undo2 aria-hidden />
              Undo last sale
            </button>
            {v.unsold.length > 0 && (
              <button type="button" disabled={pending} onClick={() => run(() => unsoldBackAction(a.id))} className={buttonClass("ghost", "sm")}>
                Bring back {v.unsold.length} unsold
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (confirm(v.pool.length ? `${v.pool.length} players haven't been up yet. Finish anyway?` : "Finish the auction?")) run(() => finishAuctionAction(a.id));
              }}
              className={buttonClass("secondary", "sm")}
            >
              Finish auction
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Squads({ squads, highlight }: { squads: SquadView[]; highlight: string | null }) {
  return (
    <section aria-labelledby="teams-h" className="grid gap-2">
      <h2 id="teams-h" className="eyebrow">
        Teams
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {squads.map((sq) => (
          <li key={sq.id} aria-label={sq.name} className={`grid content-start gap-2 rounded-lg border-2 p-3 ${highlight === sq.id ? "shadow-card" : ""}`} style={{ borderColor: sq.color }}>
            <div className="flex items-center justify-between gap-2">
              <p className="flex min-w-0 items-center gap-2 font-semibold" style={{ color: sq.color }}>
                {sq.logoUrl ? <img src={sq.logoUrl} alt="" className="size-7 shrink-0 rounded object-contain" /> : <Shirt color={sq.color} size={22} />}
                <span className="truncate">{sq.name}</span>
              </p>
              <p className="text-sm tabular">
                <strong>{sq.left}</strong> <span className="text-muted">left</span>
              </p>
            </div>
            <p className="text-xs text-muted">
              {[sq.captainName && `Captain ${sq.captainName}`, sq.managerName && `Manager ${sq.managerName}`].filter(Boolean).join(" · ") || "No captain yet"} · {sq.count}{" "}
              {sq.count === 1 ? "player" : "players"}
            </p>
            {sq.players.length > 0 && (
              <ul className="grid gap-0.5 text-sm">
                {sq.players.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span className="truncate">
                      {p.name}
                      {p.status === "captain" && <span className="text-xs text-muted"> · captain</span>}
                    </span>
                    {p.status === "sold" && <span className="tabular text-muted">{p.price}</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------

function BigScreen({ url, qr, monitor, monitorName }: { url: string; qr: string | null; monitor: boolean; monitorName: string | null }) {
  const [copied, setCopied] = useState(false);
  return (
    <section aria-labelledby="screen-h" className="grid gap-3 rounded-lg border border-border p-4">
      <h2 id="screen-h" className="flex items-center gap-2 text-lg font-semibold">
        <MonitorPlay aria-hidden className="size-5" />
        Big screen
      </h2>
      <p className="text-sm text-muted">
        {monitor ? "You're the monitor. " : monitorName ? `${monitorName} is the monitor. ` : ""}
        Show the auction live on a TV or projector: the player up, the bids, the clock, every team&apos;s points and a SOLD! moment for each buy.
      </p>
      <div className="flex flex-wrap items-start gap-4">
        {qr && <img src={qr} alt="QR code for the big screen link" width={128} height={128} className="size-32 rounded-md border border-border bg-white p-1" />}
        <div className="grid min-w-0 flex-1 gap-2">
          <ol className="grid gap-1 pl-5 text-sm [list-style:decimal]">
            <li>On the laptop or smart TV connected to the screen, open the link below (no sign-in needed).</li>
            <li>Or scan the code with a phone and mirror it to the TV (AirPlay or Chromecast).</li>
            <li>Tap Full screen on the TV page.</li>
          </ol>
          <p className="text-xs break-all text-muted">{url}</p>
          <div className="flex flex-wrap gap-2">
            <a href={url} target="_blank" rel="noreferrer" className={buttonClass("primary", "sm")}>
              <MonitorPlay aria-hidden />
              Open big screen
            </a>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard?.writeText(url).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className={buttonClass("secondary", "sm")}
            >
              <Copy aria-hidden />
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <p className="text-xs text-muted">Anyone with the link can watch, so share it only with the screen.</p>
        </div>
      </div>
    </section>
  );
}

function Summary({ v }: { v: AuctionView }) {
  const s = v.summary;
  return (
    <section aria-labelledby="sum-h" className="grid gap-3 rounded-lg border border-border p-4">
      <h2 id="sum-h" className="flex items-center gap-2 text-lg font-semibold">
        <BarChart3 aria-hidden className="size-5" />
        Summary
      </h2>
      <dl className="grid grid-cols-4 gap-2 text-center">
        {(
          [
            ["Sold", s.sold],
            ["To go", s.toGo],
            ["Unsold", s.unsold],
            ["Points spent", s.spent],
          ] as const
        ).map(([k, n]) => (
          <div key={k} className="rounded-md bg-sunken p-2">
            <dt className="text-[11px] font-semibold text-muted uppercase">{k}</dt>
            <dd className="font-display text-2xl font-bold tabular">{n}</dd>
          </div>
        ))}
      </dl>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1 font-semibold">Team</th>
              <th className="py-1 text-right font-semibold">Players</th>
              <th className="py-1 text-right font-semibold">Spent</th>
              <th className="py-1 text-right font-semibold">Left</th>
              <th className="py-1 text-right font-semibold">Avg</th>
            </tr>
          </thead>
          <tbody>
            {s.teams.map((t) => (
              <tr key={t.id} className="border-t border-border">
                <td className="py-1.5 font-semibold" style={{ color: t.color }}>
                  {t.name}
                  {t.top && <span className="block text-xs font-normal text-muted">Top: {t.top}</span>}
                </td>
                <td className="py-1.5 text-right tabular">{t.count}</td>
                <td className="py-1.5 text-right tabular">{t.spent}</td>
                <td className="py-1.5 text-right tabular">{t.left}</td>
                <td className="py-1.5 text-right tabular">{t.average || "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {s.topBuys.length > 0 && (
        <div className="grid gap-1">
          <h3 className="eyebrow">Biggest buys</h3>
          <ol className="grid gap-0.5 text-sm">
            {s.topBuys.map((b, i) => (
              <li key={b.player + i} className="flex items-center gap-2">
                <span aria-hidden className="size-2 rounded-pill" style={{ background: b.color }} />
                <span className="font-semibold">{b.player}</span>
                <span className="text-muted">{b.squad}</span>
                <span className="ml-auto tabular">{b.price}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

export const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter((w) => /^[\p{L}\d]/u.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

export function Shirt({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 64 60" width={size} height={size} className="shrink-0">
      <path d="M22 4 12 8 2 20l8 9 6-5v32h32V24l6 5 8-9L52 8 42 4c-1.5 5-5.5 8-10 8s-8.5-3-10-8Z" fill={color} stroke="rgba(0,0,0,.25)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** Shrinks a picked image to a square in the browser, so uploads stay small. */
async function toSquare(file: File, size = 320): Promise<string> {
  const url = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const s = Math.min(img.width, img.height);
  ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  return file.type === "image/png" ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.85);
}

function PhotoButton({ label, src, fallback, onPick, disabled, square }: { label: string; src: string | null; fallback: React.ReactNode; onPick: (dataUrl: string) => void; disabled?: boolean; square?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="grid shrink-0 justify-items-center gap-0.5">
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={() => input.current?.click()}
        className={`grid size-12 place-items-center overflow-hidden border border-border bg-sunken text-sm font-bold text-muted focus-visible:outline-2 focus-visible:outline-focus ${square ? "rounded-md" : "rounded-full"}`}
      >
        {src ? <img src={src} alt="" className={`size-full ${square ? "object-contain" : "object-cover"}`} /> : fallback}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-label={label}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return setErr("PNG or JPG");
          setErr(null);
          onPick(await toSquare(f));
        }}
      />
      {err && <span className="text-[10px] text-danger">{err}</span>}
    </span>
  );
}

/** Shrinks a wide banner in the browser (keeps its shape), so uploads stay small. */
async function toWide(file: File, maxW = 1920, maxH = 640): Promise<string> {
  const url = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = new Image();
  img.src = url;
  await img.decode();
  const k = Math.min(1, maxW / img.width, maxH / img.height);
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  const png = file.type === "image/png" ? c.toDataURL("image/png") : "";
  return png && png.length < 1_400_000 ? png : c.toDataURL("image/jpeg", 0.85);
}

function BannerPick({ label, hint, src, onPick, disabled }: { label: string; hint: string; src: string | null; onPick: (dataUrl: string | null) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="grid gap-1.5 rounded-lg border border-border p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{label}</span>
        <span className="text-xs text-muted">{hint}</span>
      </div>
      <button
        type="button"
        aria-label={`Choose ${label.toLowerCase()}`}
        disabled={disabled}
        onClick={() => input.current?.click()}
        className="grid h-20 place-items-center overflow-hidden rounded-md border border-dashed border-border bg-sunken text-sm text-muted focus-visible:outline-2 focus-visible:outline-focus"
      >
        {src ? <img src={src} alt={label} className="size-full object-contain" /> : "Add an image"}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-label={label}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return setErr("Use a PNG or JPG.");
          setErr(null);
          onPick(await toWide(f));
        }}
      />
      {err && <span className="text-xs text-danger">{err}</span>}
      {src && (
        <button type="button" disabled={disabled} onClick={() => onPick(null)} className="justify-self-start text-sm text-muted underline">
          Remove
        </button>
      )}
    </div>
  );
}
