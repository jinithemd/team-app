"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as svc from "@/lib/auction/service";
import type { FormState } from "./actions";

// Thin server-action wrappers for player auctions. Every rule is in lib/auction/service.ts.

const str = (f: FormData, k: string) => String(f.get(k) ?? "");
type Out = { error?: string };
const out = (r: { ok: boolean; error?: string }): Out => (r.ok ? {} : { error: r.error });

export async function createAuctionAction(teamId: string, _: FormState, f: FormData): Promise<FormState> {
  const r = await svc.createAuction(teamId, {
    title: str(f, "title"), squads: str(f, "squads"), budget: str(f, "budget"), basePrice: str(f, "basePrice"), minIncrement: str(f, "minIncrement"),
    bidSeconds: str(f, "bidSeconds"), squadMin: str(f, "squadMin"), squadMax: str(f, "squadMax"), captainsPlay: str(f, "captainsPlay") === "on",
  });
  if (!r.ok) return { error: r.error, fieldErrors: r.fieldErrors };
  revalidatePath(`/t/${teamId}/auction`);
  redirect(`/auction/${r.data.id}`);
}

export async function setSquadAction(auctionId: string, squadId: string, input: { name: string; captainId: string; managerId: string }): Promise<Out> {
  return out(await svc.setSquad(auctionId, squadId, input));
}
export async function setPlayerAction(auctionId: string, playerId: string, op: { basePrice?: string; remove?: boolean; position?: string }): Promise<Out> {
  return out(await svc.setPlayer(auctionId, playerId, op));
}
export async function addGuestAction(auctionId: string, name: string, basePrice: string): Promise<Out> {
  return out(await svc.addGuest(auctionId, name, basePrice));
}
export async function startAuctionAction(auctionId: string): Promise<Out> {
  return out(await svc.startAuction(auctionId));
}
export async function nextPlayerAction(auctionId: string, playerId?: string): Promise<Out> {
  return out(await svc.nextPlayer(auctionId, playerId));
}
export async function bidAction(auctionId: string, amount: number): Promise<Out> {
  return out(await svc.bid(auctionId, amount));
}
export async function closeNowAction(auctionId: string, as: "sold" | "unsold"): Promise<Out> {
  return out(await svc.closeNow(auctionId, as));
}
export async function undoSaleAction(auctionId: string): Promise<Out> {
  return out(await svc.undoLastSale(auctionId));
}
export async function unsoldBackAction(auctionId: string): Promise<Out> {
  return out(await svc.unsoldBack(auctionId));
}
export async function finishAuctionAction(auctionId: string): Promise<Out> {
  return out(await svc.finishAuction(auctionId));
}
export async function deleteAuctionAction(auctionId: string): Promise<Out> {
  const r = await svc.deleteAuction(auctionId);
  if (!r.ok) return { error: r.error };
  redirect(`/t/${r.data.teamId}/auction`);
}
export async function setMonitorAction(auctionId: string, userId: string): Promise<Out> {
  return out(await svc.setMonitor(auctionId, userId));
}
export async function setSquadLogoAction(auctionId: string, squadId: string, dataUrl: string | null): Promise<Out> {
  return out(await svc.setSquadLogo(auctionId, squadId, dataUrl));
}
export async function setPlayerPhotoAction(auctionId: string, playerId: string, dataUrl: string | null): Promise<Out> {
  return out(await svc.setPlayerPhoto(auctionId, playerId, dataUrl));
}
export async function setBannerAction(auctionId: string, which: "banner" | "sponsors" | "logo", dataUrl: string | null): Promise<Out> {
  return out(await svc.setBanner(auctionId, which, dataUrl));
}
