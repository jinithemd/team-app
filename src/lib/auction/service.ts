import "server-only";
import { getSessionUser, myPerms } from "../data";
import * as st from "./store";
import type { Auction, Player, Snapshot, Squad } from "./store";

/*
 * Player auction for an internal tournament: the team's players are split into squads. Each
 * squad's captain (or manager) bids points from the same budget; every player has a base
 * price. The host puts players up one at a time; each bid restarts the clock and the top bid
 * when it runs out wins. A squad can never bid so much that it couldn't fill its minimum
 * squad at base price. Unsold players can go round again.
 */

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };
const fail = (error: string, fieldErrors?: Record<string, string>): { ok: false; error: string; fieldErrors?: Record<string, string> } => ({ ok: false, error, fieldErrors });

export const SQUAD_COLOURS: [string, string][] = [
  ["Red", "#C0283F"], ["Blue", "#2346D8"], ["Green", "#18794E"], ["Yellow", "#B08900"],
  ["Black", "#1F2328"], ["Orange", "#C2560C"], ["Purple", "#6D3FD6"], ["Teal", "#08706B"],
];

async function me() {
  return getSessionUser();
}
async function canHost(teamId: string) {
  const p = await myPerms(teamId).catch(() => null);
  return !!p && (p.events || p.staff);
}
async function members(teamId: string): Promise<{ id: string; name: string }[]> {
  const { teamMemberIds, people } = await import("../sessions/store");
  const ids = await teamMemberIds(teamId);
  const who = await people(ids);
  return ids.map((id) => ({ id, name: who.get(id)?.name ?? "Player" })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Positions and shirt numbers from the team roster, for the player cards. */
async function rosterInfo(teamId: string): Promise<Map<string, { position: string | null; jersey: string | null }>> {
  const out = new Map<string, { position: string | null; jersey: string | null }>();
  const { LIVE } = await import("../mode");
  if (!LIVE) {
    const { db } = await import("../data/store");
    for (const r of db.roster.filter((x) => x.teamId === teamId && x.userId)) out.set(r.userId!, { position: r.position ?? null, jersey: r.jersey ?? null });
    return out;
  }
  const { adminClient } = await import("../supabase/server");
  const { data } = await adminClient().from("roster_members").select("user_id, position, jersey").eq("team_id", teamId).not("user_id", "is", null);
  for (const r of data ?? []) out.set(String(r.user_id), { position: r.position ?? null, jersey: r.jersey ?? null });
  return out;
}

const imgUrl = (auctionId: string, kind: "squad" | "player" | "banner" | "sponsors" | "crest" | "logo", id: string, v: string, token?: string) =>
  `/api/auction/img/${auctionId}/${kind}/${id}?v=${encodeURIComponent(v)}${token ? `&t=${token}` : ""}`;

// ---------------------------------------------------------------------------
// numbers
// ---------------------------------------------------------------------------

export interface SquadView extends Squad {
  logoUrl: string | null;
  captainName: string | null;
  managerName: string | null;
  players: PlayerView[];
  spent: number;
  left: number;
  count: number;
  maxBid: number;
  full: boolean;
}

export type PlayerView = Player & { photoUrl: string | null };

function playerView(p: Player, auctionId: string, pv: Map<string, string>, token?: string): PlayerView {
  const v = p.photoAt ?? (p.userId ? pv.get(p.userId) : undefined);
  return { ...p, photoUrl: v ? imgUrl(auctionId, "player", p.id, v, token) : null };
}

function squadViews(snap: Snapshot, names: Map<string, string>, pv: Map<string, string> = new Map(), token?: string): SquadView[] {
  const a = snap.auction;
  return snap.squads.map((sq) => {
    const players = snap.players.filter((p) => p.squadId === sq.id && (p.status === "sold" || p.status === "captain"));
    const spent = players.reduce((n, p) => n + (p.price ?? 0), 0);
    const left = a.budget - spent;
    const count = players.length;
    const full = a.squadMax != null && count >= a.squadMax;
    // Keep enough to fill the minimum squad at base price after this player.
    const reserve = Math.max(0, a.squadMin - count - 1) * a.basePrice;
    return {
      ...sq, logoUrl: sq.logoAt ? imgUrl(a.id, "squad", sq.id, sq.logoAt, token) : null, captainName: sq.captainId ? names.get(sq.captainId) ?? null : null, managerName: sq.managerId ? names.get(sq.managerId) ?? null : null,
      players: players.map((p) => playerView(p, a.id, pv, token)).sort((x, y) => (y.status === "captain" ? 1 : 0) - (x.status === "captain" ? 1 : 0) || (y.price ?? 0) - (x.price ?? 0)),
      spent, left, count, maxBid: full ? 0 : Math.max(0, left - reserve), full,
    };
  });
}

function minNext(snap: Snapshot) {
  const lot = snap.lot;
  if (!lot) return 0;
  const p = snap.players.find((x) => x.id === lot.playerId);
  return lot.topBid == null ? p?.basePrice ?? snap.auction.basePrice : lot.topBid + snap.auction.minIncrement;
}

// ---------------------------------------------------------------------------
// settling the clock
// ---------------------------------------------------------------------------

/** If the current lot's clock has run out, sell it (or mark unsold). Safe to call from every poll. */
async function settle(snap: Snapshot, force?: "sold" | "unsold"): Promise<boolean> {
  const lot = snap.lot;
  if (!lot || lot.status !== "open") return false;
  if (!force && Date.parse(lot.endsAt) > Date.now()) return false;
  const status = force ?? (lot.topSquadId ? "sold" : "unsold");
  if (status === "sold" && !lot.topSquadId) return false;
  if (!(await st.closeLot(lot, status))) return false;
  if (status === "sold") await st.updatePlayer(lot.playerId, { status: "sold", squadId: lot.topSquadId, price: lot.topBid });
  else await st.updatePlayer(lot.playerId, { status: "unsold", squadId: null, price: null });
  await st.updateAuction(snap.auction.id, { currentLotId: null });
  return true;
}

// ---------------------------------------------------------------------------
// the room
// ---------------------------------------------------------------------------

export interface AuctionSummary {
  sold: number;
  unsold: number;
  toGo: number;
  spent: number;
  topBuys: { player: string; squad: string; color: string; price: number }[];
  teams: { id: string; name: string; color: string; spent: number; left: number; count: number; average: number; top: string | null }[];
}

export interface AuctionView {
  auction: Auction;
  squads: SquadView[];
  pool: PlayerView[];
  unsold: PlayerView[];
  lot: (st.Lot & { player: PlayerView; squadName: string | null; squadColor: string | null; minNext: number; secondsLeft: number }) | null;
  bids: { squad: string; color: string; amount: number; at: string }[];
  recent: { id: string; player: string; squad: string | null; color: string | null; price: number | null; status: string; at: string | null }[];
  summary: AuctionSummary;
  host: boolean;
  /** I'm the monitor: I run the big screen and see the summary. */
  monitor: boolean;
  monitorName: string | null;
  /** Host and monitor only: the private big-screen link token. */
  screenToken: string | null;
  bannerUrl: string | null;
  eventLogoUrl: string | null;
  sponsorBannerUrl: string | null;
  teamName: string;
  mySquadId: string | null;
  members: { id: string; name: string }[];
  now: string;
}

function build(snap: Snapshot, team: { id: string; name: string }[], teamName: string, who: { uid: string | null; host: boolean }, pv: Map<string, string>, token?: string): AuctionView {
  const names = new Map(team.map((m) => [m.id, m.name]));
  const squads = squadViews(snap, names, pv, token);
  const pview = (p: Player) => playerView(p, snap.auction.id, pv, token);
  const sqById = new Map(squads.map((x) => [x.id, x]));
  const mine = who.uid ? squads.find((x) => x.captainId === who.uid || x.managerId === who.uid) ?? null : null;
  const player = snap.lot ? snap.players.find((p) => p.id === snap.lot!.playerId) : undefined;
  const pName = new Map(snap.players.map((p) => [p.id, p.name]));
  const monitor = !!who.uid && snap.auction.monitorId === who.uid;
  const sold = snap.players.filter((p) => p.status === "sold");
  const summary: AuctionSummary = {
    sold: sold.length,
    unsold: snap.players.filter((p) => p.status === "unsold").length,
    toGo: snap.players.filter((p) => p.status === "pool").length,
    spent: sold.reduce((n, p) => n + (p.price ?? 0), 0),
    topBuys: [...sold]
      .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
      .slice(0, 5)
      .map((p) => ({ player: p.name, squad: sqById.get(p.squadId ?? "")?.name ?? "", color: sqById.get(p.squadId ?? "")?.color ?? "#888", price: p.price ?? 0 })),
    teams: squads.map((x) => {
      const bought = x.players.filter((p) => p.status === "sold");
      const top = [...bought].sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0];
      return { id: x.id, name: x.name, color: x.color, spent: x.spent, left: x.left, count: x.count, average: bought.length ? Math.round(x.spent / bought.length) : 0, top: top ? `${top.name} (${top.price})` : null };
    }),
  };
  return {
    auction: { ...snap.auction, screenToken: "" },
    squads,
    pool: snap.players.filter((p) => p.status === "pool" && p.id !== snap.lot?.playerId).map(pview),
    unsold: snap.players.filter((p) => p.status === "unsold").map(pview),
    lot:
      snap.lot && player
        ? {
            ...snap.lot, player: pview(player), squadName: snap.lot.topSquadId ? sqById.get(snap.lot.topSquadId)?.name ?? null : null,
            squadColor: snap.lot.topSquadId ? sqById.get(snap.lot.topSquadId)?.color ?? null : null, minNext: minNext(snap),
            secondsLeft: Math.max(0, Math.ceil((Date.parse(snap.lot.endsAt) - Date.now()) / 1000)),
          }
        : null,
    bids: snap.bids.map((b) => ({ squad: sqById.get(b.squadId)?.name ?? "", color: sqById.get(b.squadId)?.color ?? "#888", amount: b.amount, at: b.createdAt })),
    recent: snap.recent.map((l) => ({
      id: l.id, player: pName.get(l.playerId) ?? "", squad: l.status === "sold" && l.topSquadId ? sqById.get(l.topSquadId)?.name ?? null : null,
      color: l.status === "sold" && l.topSquadId ? sqById.get(l.topSquadId)?.color ?? null : null, price: l.status === "sold" ? l.topBid : null, status: l.status, at: l.closedAt,
    })),
    summary,
    host: who.host,
    monitor,
    monitorName: snap.auction.monitorId ? names.get(snap.auction.monitorId) ?? null : null,
    screenToken: who.host || monitor ? snap.auction.screenToken : null,
    eventLogoUrl: snap.auction.eventLogoAt ? imgUrl(snap.auction.id, "logo", snap.auction.id, snap.auction.eventLogoAt, token) : null,
    bannerUrl: snap.auction.bannerAt ? imgUrl(snap.auction.id, "banner", snap.auction.id, snap.auction.bannerAt, token) : null,
    sponsorBannerUrl: snap.auction.sponsorBannerAt ? imgUrl(snap.auction.id, "sponsors", snap.auction.id, snap.auction.sponsorBannerAt, token) : null,
    teamName,
    mySquadId: mine?.id ?? null,
    members: who.host ? team : [],
    now: new Date().toISOString(),
  };
}

export async function auctionView(id: string): Promise<AuctionView | null> {
  const u = await me();
  if (!u) return null;
  let snap = await st.snapshot(id);
  if (!snap) return null;
  const team = await members(snap.auction.teamId);
  const host = await canHost(snap.auction.teamId);
  if (!host && !team.some((m) => m.id === u.id)) return null;
  if (snap.auction.status === "live" && (await settle(snap))) snap = (await st.snapshot(id))!;
  const { teamBasics } = await import("../sessions/store");
  const pv = await st.profilePhotoVersions(snap.players.map((p) => p.userId).filter((x): x is string => !!x));
  return build(snap, team, (await teamBasics(snap.auction.teamId))?.name ?? "", { uid: u.id, host }, pv);
}

/** The big screen: read-only, opened from the private link on a TV or projector (no sign-in). */
export async function screenView(token: string): Promise<(AuctionView & { teamColor: string; teamColor2: string | null }) | null> {
  const id = await st.idForScreen(token);
  if (!id) return null;
  let snap = await st.snapshot(id);
  if (!snap) return null;
  if (snap.auction.status === "live" && (await settle(snap))) snap = (await st.snapshot(id))!;
  const { teamBasics } = await import("../sessions/store");
  const t = await teamBasics(snap.auction.teamId);
  const pv = await st.profilePhotoVersions(snap.players.map((p) => p.userId).filter((x): x is string => !!x));
  const v = build(snap, await members(snap.auction.teamId), t?.name ?? "", { uid: null, host: false }, pv, token);
  return { ...v, teamColor: t?.color ?? "#2346D8", teamColor2: t?.colorSecondary ?? null };
}

/** Host: pick who runs the big screen. */
export async function setMonitor(auctionId: string, userId: string): Promise<Result> {
  return caught(async () => {
    const snap = await asHost(auctionId);
    if (userId && !(await members(snap.auction.teamId)).some((m) => m.id === userId)) return fail("They're not on the team.");
    await st.updateAuction(auctionId, { monitorId: userId || null });
    return { ok: true, data: undefined };
  });
}

export async function teamAuctions(teamId: string) {
  const u = await me();
  if (!u) return null;
  const host = await canHost(teamId);
  const team = await members(teamId);
  if (!host && !team.some((m) => m.id === u.id)) return null;
  return { host, auctions: await st.auctionsFor(teamId) };
}

// ---------------------------------------------------------------------------
// setting up
// ---------------------------------------------------------------------------

export interface AuctionInput {
  title: string;
  squads: string;
  budget: string;
  basePrice: string;
  minIncrement: string;
  bidSeconds: string;
  squadMin: string;
  squadMax: string;
  captainsPlay: boolean;
}

export async function createAuction(teamId: string, input: AuctionInput): Promise<Result<{ id: string }>> {
  const u = await me();
  if (!u || !(await canHost(teamId))) return fail("Only team staff can run an auction.");
  const fe: Record<string, string> = {};
  const int = (v: string, d: number) => (v.trim() === "" ? d : Number(v.replace(/[,\s]/g, "")));
  const title = input.title.trim() || "Player auction";
  const n = int(input.squads, 4);
  const budget = int(input.budget, 1000);
  const base = int(input.basePrice, 50);
  const inc = int(input.minIncrement, 10);
  const secs = int(input.bidSeconds, 20);
  const smin = int(input.squadMin, 0);
  const smax = input.squadMax.trim() ? int(input.squadMax, 0) : null;
  if (title.length > 80) fe.title = "Keep it under 80 characters.";
  if (!Number.isInteger(n) || n < 2 || n > 8) fe.squads = "2 to 8 teams.";
  if (!Number.isInteger(budget) || budget < 1 || budget > 1_000_000) fe.budget = "Points per team, like 1000.";
  if (!Number.isInteger(base) || base < 0 || base > budget) fe.basePrice = "From 0 up to the budget.";
  if (!Number.isInteger(inc) || inc < 1 || inc > budget) fe.minIncrement = "At least 1.";
  if (!Number.isInteger(secs) || secs < 5 || secs > 300) fe.bidSeconds = "5 to 300 seconds.";
  if (!Number.isInteger(smin) || smin < 0 || smin > 60) fe.squadMin = "0 to 60.";
  if (smax != null && (!Number.isInteger(smax) || smax < 1 || smax > 60 || smax < smin)) fe.squadMax = "At least the minimum.";
  if (!fe.budget && !fe.basePrice && !fe.squadMin && smin * base > budget) fe.squadMin = `A full minimum team at base price costs ${smin * base}, more than the budget.`;
  if (Object.keys(fe).length) return fail("Check the highlighted fields.", fe);
  const team = await members(teamId);
  const info = await rosterInfo(teamId);
  const id = await st.createAuction(
    { teamId, title, budget, basePrice: base, minIncrement: inc, bidSeconds: secs, squadMin: smin, squadMax: smax, captainsPlay: input.captainsPlay, createdBy: u.id },
    Array.from({ length: n }, (_, i) => ({ name: `Team ${SQUAD_COLOURS[i][0]}`, color: SQUAD_COLOURS[i][1], captainId: null, managerId: null, sort: i, logoAt: null })),
    team.map((m, i) => ({
      userId: m.id, name: m.name, basePrice: base, status: "pool" as const, squadId: null, price: null, sort: i, photoAt: null,
      position: info.get(m.id)?.position ?? null, jersey: info.get(m.id)?.jersey ?? null,
    })),
  );
  return { ok: true, data: { id } };
}

async function asHost(auctionId: string) {
  const snap = await st.snapshot(auctionId);
  if (!snap) throw new Error("That auction no longer exists.");
  if (!(await canHost(snap.auction.teamId))) throw new Error("Only the host can do that.");
  return snap;
}
async function caught<T>(fn: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await fn();
  } catch (e) {
    return fail((e as Error).message || "Something went wrong. Try again.");
  }
}

/** Name a team and pick its captain and manager. With "captains play", the captain joins the team for free. */
export async function setSquad(auctionId: string, squadId: string, input: { name: string; captainId: string; managerId: string }): Promise<Result> {
  return caught(async () => {
    const snap = await asHost(auctionId);
    if (snap.auction.status === "done") return fail("This auction is finished.");
    const sq = snap.squads.find((x) => x.id === squadId);
    if (!sq) return fail("That team isn't in this auction.");
    const name = input.name.trim().slice(0, 40) || sq.name;
    const cap = input.captainId || null;
    const man = input.managerId || null;
    if (cap && snap.squads.some((x) => x.id !== squadId && (x.captainId === cap || x.managerId === cap))) return fail("They're already running another team.");
    if (man && snap.squads.some((x) => x.id !== squadId && (x.captainId === man || x.managerId === man))) return fail("They're already running another team.");
    if (snap.auction.captainsPlay && cap !== sq.captainId) {
      // The old captain goes back into the pool; the new one joins this team at no cost.
      const old = snap.players.find((p) => p.status === "captain" && p.squadId === squadId);
      if (old) await st.updatePlayer(old.id, { status: "pool", squadId: null, price: null });
      if (cap) {
        const p = snap.players.find((x) => x.userId === cap);
        if (p && (p.status === "sold" || (snap.lot && snap.lot.playerId === p.id))) return fail("That player has already been bought.");
        if (p) await st.updatePlayer(p.id, { status: "captain", squadId, price: 0 });
      }
    }
    await st.updateSquad(squadId, { name, captainId: cap, managerId: man });
    return { ok: true, data: undefined };
  });
}

export async function setPlayer(auctionId: string, playerId: string, op: { basePrice?: string; remove?: boolean; position?: string }): Promise<Result> {
  return caught(async () => {
    const snap = await asHost(auctionId);
    const p = snap.players.find((x) => x.id === playerId);
    if (!p) return fail("That player isn't in this auction.");
    if (op.remove) {
      if (p.status === "sold" || p.status === "captain" || snap.lot?.playerId === p.id) return fail("They're already on a team.");
      await st.removePlayer(p.id);
      return { ok: true, data: undefined };
    }
    if (op.position !== undefined) {
      await st.updatePlayer(p.id, { position: op.position.trim().slice(0, 30) || null });
      return { ok: true, data: undefined };
    }
    const v = Number(String(op.basePrice ?? "").replace(/[,\s]/g, ""));
    if (!Number.isInteger(v) || v < 0 || v > snap.auction.budget) return fail("Base price from 0 up to the budget.");
    if (p.status === "sold") return fail("They've already been bought.");
    await st.updatePlayer(p.id, { basePrice: v });
    return { ok: true, data: undefined };
  });
}

export async function addGuest(auctionId: string, name: string, basePrice: string): Promise<Result> {
  return caught(async () => {
    const snap = await asHost(auctionId);
    const n = name.trim().slice(0, 80);
    if (!n) return fail("Type their name.");
    if (snap.players.some((p) => p.name.toLowerCase() === n.toLowerCase())) return fail(`${n} is already in.`);
    const v = basePrice.trim() ? Number(basePrice) : snap.auction.basePrice;
    if (!Number.isInteger(v) || v < 0 || v > snap.auction.budget) return fail("Base price from 0 up to the budget.");
    await st.addPlayers(auctionId, [{ userId: null, name: n, basePrice: v, status: "pool", squadId: null, price: null, sort: snap.players.length, photoAt: null, position: null, jersey: null }]);
    return { ok: true, data: undefined };
  });
}

export async function startAuction(auctionId: string): Promise<Result> {
  return caught(async () => {
    const snap = await asHost(auctionId);
    if (snap.auction.status !== "setup") return { ok: true, data: undefined };
    const missing = snap.squads.filter((x) => !x.captainId && !x.managerId);
    if (missing.length) return fail(`Pick a captain or manager for ${missing.map((x) => x.name).join(", ")} so someone can bid.`);
    if (!snap.players.some((p) => p.status === "pool")) return fail("Add some players to auction.");
    await st.updateAuction(auctionId, { status: "live" });
    return { ok: true, data: undefined };
  });
}

// ---------------------------------------------------------------------------
// running it
// ---------------------------------------------------------------------------

/** Put a player up: a chosen one, or a random one from the pool. */
export async function nextPlayer(auctionId: string, playerId?: string): Promise<Result> {
  return caught(async () => {
    let snap = await asHost(auctionId);
    if (snap.auction.status !== "live") return fail("Start the auction first.");
    if (await settle(snap)) snap = (await st.snapshot(auctionId))!;
    if (snap.lot && snap.lot.status === "open") return fail("Finish the current player first.");
    const pool = snap.players.filter((p) => p.status === "pool");
    const p = playerId ? pool.find((x) => x.id === playerId) : pool[Math.floor(Math.random() * pool.length)];
    if (!p) return fail(pool.length ? "That player isn't in the pool." : "Everyone's been up. Bring back the unsold players or finish the auction.");
    const lot = await st.openLot(auctionId, p.id, new Date(Date.now() + snap.auction.bidSeconds * 1000).toISOString());
    await st.updateAuction(auctionId, { currentLotId: lot.id });
    return { ok: true, data: undefined };
  });
}

/** A captain or manager bids for their team. */
export async function bid(auctionId: string, amount: number): Promise<Result> {
  return caught(async () => {
    const u = await me();
    if (!u) return fail("Sign in to bid.");
    let snap = await st.snapshot(auctionId);
    if (!snap || snap.auction.status !== "live") return fail("The auction isn't running.");
    if (await settle(snap)) return fail("Too late, that one's gone.");
    snap = (await st.snapshot(auctionId))!;
    const lot = snap.lot;
    if (!lot || lot.status !== "open") return fail("Nobody's up right now.");
    const team = await members(snap.auction.teamId);
    const squads = squadViews(snap, new Map(team.map((m) => [m.id, m.name])));
    const mine = squads.find((x) => x.captainId === u.id || x.managerId === u.id);
    if (!mine) return fail("Only captains and managers can bid.");
    if (lot.topSquadId === mine.id) return fail("You're already the top bid.");
    if (mine.full) return fail(`${mine.name} is full.`);
    const min = minNext(snap);
    if (!Number.isInteger(amount) || amount < min) return fail(`The next bid is at least ${min}.`);
    if (amount > mine.maxBid) return fail(mine.maxBid < min ? `${mine.name} can't afford this one.` : `${mine.name} can bid up to ${mine.maxBid} (keeping enough to fill the team).`);
    // Every bid gives the others a fair chance to answer.
    const endsAt = new Date(Math.max(Date.parse(lot.endsAt), Date.now() + Math.min(snap.auction.bidSeconds, 15) * 1000)).toISOString();
    if (!(await st.placeBid(lot, mine.id, amount, u.id, endsAt))) return fail("Someone just bid. Try again.");
    return { ok: true, data: undefined };
  });
}

/** Host: sell to the top bid now, or pass on the player (unsold). */
export async function closeNow(auctionId: string, as: "sold" | "unsold"): Promise<Result> {
  return caught(async () => {
    const snap = await asHost(auctionId);
    if (!snap.lot || snap.lot.status !== "open") return fail("Nobody's up right now.");
    if (as === "sold" && !snap.lot.topSquadId) return fail("No bids yet. Pass instead.");
    await settle(snap, as);
    return { ok: true, data: undefined };
  });
}

/** Host: take back the last sale (the player goes back into the pool, the points come back). */
export async function undoLastSale(auctionId: string): Promise<Result> {
  return caught(async () => {
    const snap = await asHost(auctionId);
    if (snap.lot && snap.lot.status === "open") return fail("Finish the current player first.");
    const last = await st.reopenLastSale(auctionId);
    if (!last) return fail("Nothing to undo.");
    await st.setLotStatus(last.id, "unsold");
    await st.updatePlayer(last.playerId, { status: "pool", squadId: null, price: null });
    return { ok: true, data: undefined };
  });
}

export async function unsoldBack(auctionId: string): Promise<Result<{ count: number }>> {
  return caught(async () => {
    const snap = await asHost(auctionId);
    const list = snap.players.filter((p) => p.status === "unsold");
    for (const p of list) await st.updatePlayer(p.id, { status: "pool" });
    return { ok: true, data: { count: list.length } };
  });
}

export async function finishAuction(auctionId: string): Promise<Result> {
  return caught(async () => {
    const snap = await asHost(auctionId);
    if (snap.lot && snap.lot.status === "open") return fail("Finish the current player first.");
    await st.updateAuction(auctionId, { status: "done", currentLotId: null });
    return { ok: true, data: undefined };
  });
}

export async function deleteAuction(auctionId: string): Promise<Result<{ teamId: string }>> {
  return caught(async () => {
    const snap = await asHost(auctionId);
    await st.deleteAuction(auctionId);
    return { ok: true, data: { teamId: snap.auction.teamId } };
  });
}

// ---------------------------------------------------------------------------
// pictures
// ---------------------------------------------------------------------------

const IMG = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;

/** Host: a team logo (or null to remove it). */
export async function setSquadLogo(auctionId: string, squadId: string, dataUrl: string | null): Promise<Result> {
  return caught(async () => {
    const snap = await asHost(auctionId);
    if (!snap.squads.some((x) => x.id === squadId)) return fail("That team isn't in this auction.");
    if (dataUrl && (!IMG.test(dataUrl) || dataUrl.length > 400_000)) return fail("Use a PNG, JPG or SVG under 300 KB.");
    await st.setSquadLogo(squadId, dataUrl);
    return { ok: true, data: undefined };
  });
}

/** Host: a player's photo for the auction (or null to go back to their profile photo). */
export async function setPlayerPhoto(auctionId: string, playerId: string, dataUrl: string | null): Promise<Result> {
  return caught(async () => {
    const snap = await asHost(auctionId);
    if (!snap.players.some((x) => x.id === playerId)) return fail("That player isn't in this auction.");
    if (dataUrl && (!IMG.test(dataUrl) || dataUrl.length > 400_000)) return fail("Use a PNG or JPG under 300 KB.");
    await st.setPlayerPhoto(playerId, dataUrl);
    return { ok: true, data: undefined };
  });
}

/** The image route: team members (signed in) or the big screen (its private link). */
export async function auctionImage(auctionId: string, kind: "squad" | "player" | "banner" | "sponsors" | "crest" | "logo", id: string, token: string | null): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(auctionId) || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  let ok = false;
  if (token) ok = (await st.idForScreen(token)) === auctionId;
  if (!ok) {
    const u = await me();
    const snap = u ? await st.snapshot(auctionId) : null;
    if (u && snap) ok = (await canHost(snap.auction.teamId)) || (await members(snap.auction.teamId)).some((m) => m.id === u.id);
  }
  return ok ? st.image(auctionId, kind, id) : null;
}

/** Host: the big-screen banners (tournament poster on top, sponsors at the bottom), or null to remove. */
export async function setBanner(auctionId: string, which: "banner" | "sponsors" | "logo", dataUrl: string | null): Promise<Result> {
  return caught(async () => {
    await asHost(auctionId);
    if (dataUrl && (!IMG.test(dataUrl) || dataUrl.length > 1_500_000)) return fail("Use a PNG or JPG under 1 MB.");
    await st.setBanner(auctionId, which, dataUrl);
    return { ok: true, data: undefined };
  });
}

/** The club crest for the big screen's header (looked up once when the screen opens). */
export async function screenCrestUrl(token: string): Promise<string | null> {
  const id = await st.idForScreen(token);
  if (!id) return null;
  const img = await st.image(id, "crest", id).catch(() => null);
  return img ? imgUrl(id, "crest", id, String(img.length), token) : null;
}
