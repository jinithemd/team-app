import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIVE } from "../mode";

/*
 * Player auction storage. Sample build: memory. Live: Supabase through the server key; the
 * service checks who may do what first. Bids use the lot's bid count as a version, so two
 * captains bidding at the same moment can't both win the same step.
 */

export interface Auction {
  id: string;
  teamId: string;
  title: string;
  status: "setup" | "live" | "done";
  budget: number;
  basePrice: number;
  minIncrement: number;
  bidSeconds: number;
  squadMin: number;
  squadMax: number | null;
  captainsPlay: boolean;
  currentLotId: string | null;
  createdBy: string | null;
  createdAt: string;
  /** Runs the big screen; sees the full summary. */
  monitorId: string | null;
  /** The private big-screen link (/screen/<token>): read-only, no sign-in. */
  screenToken: string;
  /** Big-screen banners (loaded separately): tournament poster on top, sponsors at the bottom. */
  bannerAt: string | null;
  sponsorBannerAt: string | null;
}
export interface Squad {
  id: string;
  auctionId: string;
  name: string;
  color: string;
  captainId: string | null;
  managerId: string | null;
  sort: number;
  /** When the logo last changed (null = no logo). The image itself loads separately. */
  logoAt: string | null;
}
export interface Player {
  id: string;
  auctionId: string;
  userId: string | null;
  name: string;
  basePrice: number;
  status: "pool" | "sold" | "unsold" | "captain";
  squadId: string | null;
  price: number | null;
  sort: number;
  /** When a photo was added for the auction (else the profile photo is used, if any). */
  photoAt: string | null;
  position: string | null;
  jersey: string | null;
}
export interface Lot {
  id: string;
  auctionId: string;
  playerId: string;
  status: "open" | "sold" | "unsold";
  topBid: number | null;
  topSquadId: string | null;
  bids: number;
  endsAt: string;
  openedAt: string;
  closedAt: string | null;
}
export interface Bid {
  id: string;
  lotId: string;
  squadId: string;
  amount: number;
  bidBy: string | null;
  createdAt: string;
}

interface Mem {
  auctions: Auction[];
  squads: Squad[];
  players: Player[];
  lots: Lot[];
  bids: Bid[];
}
const g = globalThis as unknown as { __clbxAuctions?: Mem };
const mem: Mem = (g.__clbxAuctions ??= { auctions: [], squads: [], players: [], lots: [], bids: [] } as Mem);

type Row = Record<string, unknown>;
async function admin(): Promise<SupabaseClient> {
  const { adminClient } = await import("../supabase/server");
  return adminClient() as unknown as SupabaseClient;
}
const s = (v: unknown) => (v == null ? null : String(v));
const iso = (v: unknown) => (v == null ? null : new Date(String(v)).toISOString());
function check(error: { message: string } | null, what: string) {
  if (error) {
    console.error(`[auction] ${what}: ${error.message}`);
    throw new Error("Couldn't save that. Try again.");
  }
}

const toAuction = (r: Row): Auction => ({
  id: s(r.id)!, teamId: s(r.team_id)!, title: s(r.title)!, status: r.status as Auction["status"], budget: Number(r.budget), basePrice: Number(r.base_price),
  minIncrement: Number(r.min_increment), bidSeconds: Number(r.bid_seconds), squadMin: Number(r.squad_min ?? 0), squadMax: r.squad_max == null ? null : Number(r.squad_max),
  captainsPlay: !!r.captains_play, currentLotId: s(r.current_lot_id), createdBy: s(r.created_by), createdAt: iso(r.created_at)!,
  monitorId: s(r.monitor_id), screenToken: s(r.screen_token) ?? "", bannerAt: iso(r.banner_at), sponsorBannerAt: iso(r.sponsor_banner_at),
});
const toSquad = (r: Row): Squad => ({
  id: s(r.id)!, auctionId: s(r.auction_id)!, name: s(r.name)!, color: s(r.color) ?? "#2346D8", captainId: s(r.captain_id), managerId: s(r.manager_id), sort: Number(r.sort ?? 0), logoAt: iso(r.logo_at),
});
const toPlayer = (r: Row): Player => ({
  id: s(r.id)!, auctionId: s(r.auction_id)!, userId: s(r.user_id), name: s(r.name)!, basePrice: Number(r.base_price), status: r.status as Player["status"],
  squadId: s(r.squad_id), price: r.price == null ? null : Number(r.price), sort: Number(r.sort ?? 0), photoAt: iso(r.photo_at), position: s(r.position), jersey: s(r.jersey),
});
const toLot = (r: Row): Lot => ({
  id: s(r.id)!, auctionId: s(r.auction_id)!, playerId: s(r.player_id)!, status: r.status as Lot["status"], topBid: r.top_bid == null ? null : Number(r.top_bid),
  topSquadId: s(r.top_squad_id), bids: Number(r.bids ?? 0), endsAt: iso(r.ends_at)!, openedAt: iso(r.opened_at)!, closedAt: iso(r.closed_at),
});
const toBid = (r: Row): Bid => ({ id: s(r.id)!, lotId: s(r.lot_id)!, squadId: s(r.squad_id)!, amount: Number(r.amount), bidBy: s(r.bid_by), createdAt: iso(r.created_at)! });

const snake = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), v]));

// ---- reads ----------------------------------------------------------------

// Images are left out of the once-a-second reads; they load through /api/auction/img.
const AUCTION_COLS =
  "id, team_id, title, status, budget, base_price, min_increment, bid_seconds, squad_min, squad_max, captains_play, current_lot_id, created_by, created_at, monitor_id, screen_token, banner_at, sponsor_banner_at";
const SQUAD_COLS = "id, auction_id, name, color, captain_id, manager_id, sort, logo_at";
const PLAYER_COLS = "id, auction_id, user_id, name, base_price, status, squad_id, price, sort, photo_at, position, jersey";

export interface Snapshot {
  auction: Auction;
  squads: Squad[];
  players: Player[];
  lot: Lot | null;
  bids: Bid[];
  recent: Lot[];
}

export async function snapshot(id: string): Promise<Snapshot | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (!LIVE) {
    const auction = mem.auctions.find((a) => a.id === id);
    if (!auction) return null;
    const lot = auction.currentLotId ? mem.lots.find((l) => l.id === auction.currentLotId) ?? null : null;
    return {
      auction: { ...auction },
      squads: mem.squads.filter((x) => x.auctionId === id).sort((a, b) => a.sort - b.sort).map((x) => ({ ...x })),
      players: mem.players.filter((x) => x.auctionId === id).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name)).map((x) => ({ ...x })),
      lot: lot ? { ...lot } : null,
      bids: lot ? mem.bids.filter((b) => b.lotId === lot.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8) : [],
      recent: mem.lots.filter((l) => l.auctionId === id && l.status !== "open").sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? "")).slice(0, 6),
    };
  }
  const sb = await admin();
  const { data: a } = await sb.from("auctions").select(AUCTION_COLS).eq("id", id).maybeSingle();
  if (!a) return null;
  const auction = toAuction(a);
  const [sq, pl, lot, recent] = await Promise.all([
    sb.from("auction_squads").select(SQUAD_COLS).eq("auction_id", id).order("sort"),
    sb.from("auction_players").select(PLAYER_COLS).eq("auction_id", id).order("sort").order("name"),
    auction.currentLotId ? sb.from("auction_lots").select("*").eq("id", auction.currentLotId).maybeSingle() : Promise.resolve({ data: null }),
    sb.from("auction_lots").select("*").eq("auction_id", id).neq("status", "open").order("closed_at", { ascending: false }).limit(6),
  ]);
  const l = lot.data ? toLot(lot.data as Row) : null;
  const bids = l ? ((await sb.from("auction_bids").select("*").eq("lot_id", l.id).order("created_at", { ascending: false }).limit(8)).data ?? []).map(toBid) : [];
  return { auction, squads: (sq.data ?? []).map(toSquad), players: (pl.data ?? []).map(toPlayer), lot: l, bids, recent: (recent.data ?? []).map(toLot) };
}

export async function idForScreen(token: string): Promise<string | null> {
  if (!/^[0-9a-f]{32}$/i.test(token)) return null;
  if (!LIVE) return mem.auctions.find((a) => a.screenToken === token)?.id ?? null;
  const { data } = await (await admin()).from("auctions").select("id").eq("screen_token", token).maybeSingle();
  return data ? String((data as Row).id) : null;
}

export async function auctionsFor(teamId: string): Promise<Auction[]> {
  if (!LIVE) return mem.auctions.filter((a) => a.teamId === teamId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const { data } = await (await admin()).from("auctions").select(AUCTION_COLS).eq("team_id", teamId).order("created_at", { ascending: false }).limit(20);
  return (data ?? []).map(toAuction);
}

// ---- writes ---------------------------------------------------------------

export async function createAuction(a: Omit<Auction, "id" | "createdAt" | "currentLotId" | "status" | "monitorId" | "screenToken" | "bannerAt" | "sponsorBannerAt">, squads: Omit<Squad, "id" | "auctionId">[], players: Omit<Player, "id" | "auctionId">[]) {
  const id = randomUUID();
  const auction: Auction = { ...a, id, status: "setup", currentLotId: null, createdAt: new Date().toISOString(), monitorId: null, screenToken: randomUUID().replace(/-/g, ""), bannerAt: null, sponsorBannerAt: null };
  const sq = squads.map((x) => ({ ...x, id: randomUUID(), auctionId: id }));
  const pl = players.map((x) => ({ ...x, id: randomUUID(), auctionId: id }));
  if (!LIVE) {
    mem.auctions.push(auction);
    mem.squads.push(...sq);
    mem.players.push(...pl);
    return id;
  }
  const sb = await admin();
  const { createdAt: _c, ...rest } = auction;
  check((await sb.from("auctions").insert(snake(rest))).error, "create auction");
  if (sq.length) check((await sb.from("auction_squads").insert(sq.map((x) => snake(x)))).error, "create squads");
  if (pl.length) check((await sb.from("auction_players").insert(pl.map((x) => snake(x)))).error, "add players");
  return id;
}

export async function updateAuction(id: string, patch: Partial<Auction>) {
  if (!LIVE) {
    Object.assign(mem.auctions.find((a) => a.id === id) ?? {}, patch);
    return;
  }
  const { id: _i, createdAt: _c, ...rest } = patch;
  check((await (await admin()).from("auctions").update({ ...snake(rest), updated_at: new Date().toISOString() }).eq("id", id)).error, "update auction");
}

export async function updateSquad(id: string, patch: Partial<Squad>) {
  if (!LIVE) {
    Object.assign(mem.squads.find((x) => x.id === id) ?? {}, patch);
    return;
  }
  const { id: _i, auctionId: _a, ...rest } = patch;
  check((await (await admin()).from("auction_squads").update(snake(rest)).eq("id", id)).error, "update squad");
}

export async function addPlayers(auctionId: string, players: Omit<Player, "id" | "auctionId">[]) {
  const pl = players.map((x) => ({ ...x, id: randomUUID(), auctionId }));
  if (!LIVE) {
    mem.players.push(...pl);
    return;
  }
  if (pl.length) check((await (await admin()).from("auction_players").insert(pl.map((x) => snake(x)))).error, "add players");
}

export async function updatePlayer(id: string, patch: Partial<Player>) {
  if (!LIVE) {
    Object.assign(mem.players.find((x) => x.id === id) ?? {}, patch);
    return;
  }
  const { id: _i, auctionId: _a, ...rest } = patch;
  check((await (await admin()).from("auction_players").update(snake(rest)).eq("id", id)).error, "update player");
}

export async function removePlayer(id: string) {
  if (!LIVE) {
    mem.players = mem.players.filter((x) => x.id !== id);
    return;
  }
  check((await (await admin()).from("auction_players").delete().eq("id", id)).error, "remove player");
}

export async function openLot(auctionId: string, playerId: string, endsAt: string): Promise<Lot> {
  const lot: Lot = { id: randomUUID(), auctionId, playerId, status: "open", topBid: null, topSquadId: null, bids: 0, endsAt, openedAt: new Date().toISOString(), closedAt: null };
  if (!LIVE) {
    mem.lots.push(lot);
    return lot;
  }
  check((await (await admin()).from("auction_lots").insert(snake(lot as unknown as Record<string, unknown>))).error, "open lot");
  return lot;
}

/** A bid lands only if nobody else bid since the caller looked (bid count as the version). */
export async function placeBid(lot: Lot, squadId: string, amount: number, by: string, endsAt: string): Promise<boolean> {
  const bid: Bid = { id: randomUUID(), lotId: lot.id, squadId, amount, bidBy: by, createdAt: new Date().toISOString() };
  if (!LIVE) {
    const l = mem.lots.find((x) => x.id === lot.id);
    if (!l || l.status !== "open" || l.bids !== lot.bids) return false;
    Object.assign(l, { topBid: amount, topSquadId: squadId, bids: l.bids + 1, endsAt });
    mem.bids.push(bid);
    return true;
  }
  const sb = await admin();
  const { data, error } = await sb
    .from("auction_lots")
    .update({ top_bid: amount, top_squad_id: squadId, bids: lot.bids + 1, ends_at: endsAt })
    .eq("id", lot.id)
    .eq("status", "open")
    .eq("bids", lot.bids)
    .select("id");
  check(error, "bid");
  if (!data?.length) return false;
  await sb.from("auction_bids").insert(snake(bid as unknown as Record<string, unknown>));
  return true;
}

/** Closes an open lot once (returns false if someone else already did). */
export async function closeLot(lot: Lot, status: "sold" | "unsold"): Promise<boolean> {
  const closedAt = new Date().toISOString();
  if (!LIVE) {
    const l = mem.lots.find((x) => x.id === lot.id);
    if (!l || l.status !== "open") return false;
    Object.assign(l, { status, closedAt });
    return true;
  }
  const { data, error } = await (await admin()).from("auction_lots").update({ status, closed_at: closedAt }).eq("id", lot.id).eq("status", "open").select("id");
  check(error, "close lot");
  return !!data?.length;
}

export async function reopenLastSale(auctionId: string): Promise<Lot | null> {
  if (!LIVE) {
    const l = mem.lots.filter((x) => x.auctionId === auctionId && x.status === "sold").sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""))[0];
    return l ? { ...l } : null;
  }
  const { data } = await (await admin()).from("auction_lots").select("*").eq("auction_id", auctionId).eq("status", "sold").order("closed_at", { ascending: false }).limit(1);
  return data?.[0] ? toLot(data[0]) : null;
}

export async function setLotStatus(id: string, status: Lot["status"]) {
  if (!LIVE) {
    Object.assign(mem.lots.find((x) => x.id === id) ?? {}, { status });
    return;
  }
  check((await (await admin()).from("auction_lots").update({ status }).eq("id", id)).error, "update lot");
}

export async function deleteAuction(id: string) {
  if (!LIVE) {
    mem.auctions = mem.auctions.filter((a) => a.id !== id);
    return;
  }
  check((await (await admin()).from("auctions").delete().eq("id", id)).error, "delete auction");
}

// ---- images ---------------------------------------------------------------

const memImg = ((globalThis as unknown as { __clbxAuctionImg?: Map<string, string> }).__clbxAuctionImg ??= new Map<string, string>());

export async function setSquadLogo(id: string, dataUrl: string | null) {
  const at = dataUrl ? new Date().toISOString() : null;
  if (!LIVE) {
    if (dataUrl) memImg.set(`squad:${id}`, dataUrl);
    else memImg.delete(`squad:${id}`);
    Object.assign(mem.squads.find((x) => x.id === id) ?? {}, { logoAt: at });
    return;
  }
  check((await (await admin()).from("auction_squads").update({ logo: dataUrl, logo_at: at }).eq("id", id)).error, "save logo");
}

export async function setPlayerPhoto(id: string, dataUrl: string | null) {
  const at = dataUrl ? new Date().toISOString() : null;
  if (!LIVE) {
    if (dataUrl) memImg.set(`player:${id}`, dataUrl);
    else memImg.delete(`player:${id}`);
    Object.assign(mem.players.find((x) => x.id === id) ?? {}, { photoAt: at });
    return;
  }
  check((await (await admin()).from("auction_players").update({ photo: dataUrl, photo_at: at }).eq("id", id)).error, "save photo");
}

export async function setBanner(auctionId: string, which: "banner" | "sponsors", dataUrl: string | null) {
  const at = dataUrl ? new Date().toISOString() : null;
  if (!LIVE) {
    if (dataUrl) memImg.set(`${which}:${auctionId}`, dataUrl);
    else memImg.delete(`${which}:${auctionId}`);
    Object.assign(mem.auctions.find((x) => x.id === auctionId) ?? {}, which === "banner" ? { bannerAt: at } : { sponsorBannerAt: at });
    return;
  }
  const row = which === "banner" ? { banner: dataUrl, banner_at: at } : { sponsor_banner: dataUrl, sponsor_banner_at: at };
  check((await (await admin()).from("auctions").update(row).eq("id", auctionId)).error, "save banner");
}

/** A team logo, a player's photo (falling back to their profile photo), or a banner. */
export async function image(auctionId: string, kind: "squad" | "player" | "banner" | "sponsors", id: string): Promise<string | null> {
  if (kind === "banner" || kind === "sponsors") {
    if (!LIVE) return memImg.get(`${kind}:${auctionId}`) ?? null;
    const { data } = await (await admin()).from("auctions").select(kind === "banner" ? "banner" : "sponsor_banner").eq("id", auctionId).maybeSingle();
    return s((data as Row | null)?.[kind === "banner" ? "banner" : "sponsor_banner"]);
  }
  if (!LIVE) {
    if (kind === "squad") return mem.squads.some((x) => x.id === id && x.auctionId === auctionId) ? memImg.get(`squad:${id}`) ?? null : null;
    const p = mem.players.find((x) => x.id === id && x.auctionId === auctionId);
    if (!p) return null;
    if (memImg.get(`player:${id}`)) return memImg.get(`player:${id}`)!;
    if (!p.userId) return null;
    return (globalThis as unknown as { __clbxPhotos?: Map<string, string> }).__clbxPhotos?.get(p.userId) ?? null;
  }
  const sb = await admin();
  if (kind === "squad") {
    const { data } = await sb.from("auction_squads").select("logo").eq("id", id).eq("auction_id", auctionId).maybeSingle();
    return s((data as Row | null)?.logo);
  }
  const { data } = await sb.from("auction_players").select("photo, user_id").eq("id", id).eq("auction_id", auctionId).maybeSingle();
  if (!data) return null;
  if ((data as Row).photo) return s((data as Row).photo);
  if (!(data as Row).user_id) return null;
  const { data: prof } = await sb.from("profiles").select("avatar_path").eq("id", String((data as Row).user_id)).maybeSingle();
  return s((prof as Row | null)?.avatar_path);
}

/** Profile photo versions, so the card can show a member's photo when there's no auction photo. */
export async function profilePhotoVersions(userIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!userIds.length) return out;
  if (!LIVE) {
    const photos = (globalThis as unknown as { __clbxPhotos?: Map<string, string> }).__clbxPhotos;
    for (const id of userIds) if (photos?.has(id)) out.set(id, String(photos.get(id)!.length));
    return out;
  }
  const { data } = await (await admin()).from("profiles").select("id, updated_at").in("id", userIds).not("avatar_path", "is", null);
  for (const r of (data ?? []) as Row[]) out.set(String(r.id), String(Date.parse(String(r.updated_at))));
  return out;
}
