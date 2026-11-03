"use server";

import { revalidatePath } from "next/cache";
import * as svc from "@/lib/guests/service";
import type { GuestResponse, } from "@/lib/guests/store";

// Thin server-action wrappers for guest players. Every rule is in lib/guests/service.ts.

type Out = { error?: string; fieldErrors?: Record<string, string>; message?: string };
const out = (r: { ok: boolean; error?: string; fieldErrors?: Record<string, string> }, message?: string): Out => (r.ok ? { message } : { error: r.error, fieldErrors: r.fieldErrors });

export async function findGuestPeopleAction(teamId: string, q: string) {
  const r = await svc.findPeople(teamId, q);
  return r.ok ? r.data : [];
}
export async function addGuestAction(teamId: string, input: svc.NewGuest): Promise<Out> {
  const r = await svc.addGuest(teamId, input);
  revalidatePath(`/t/${teamId}`, "layout");
  return out(r, r.ok ? `${r.data.name} is on your guest list.` : undefined);
}
export async function removeGuestAction(teamId: string, guestId: string): Promise<Out> {
  const r = await svc.removeGuest(teamId, guestId);
  revalidatePath(`/t/${teamId}`, "layout");
  return out(r);
}
export async function inviteGuestsAction(teamId: string, eventId: string, ids: "all" | string[]): Promise<Out> {
  const r = await svc.invite(eventId, ids, { notify: true });
  revalidatePath(`/t/${teamId}/e/${eventId}`);
  return out(r, r.ok ? (r.data.count ? `Asked ${r.data.count} guest${r.data.count === 1 ? "" : "s"}. They've been emailed.` : "Everyone's already asked.") : undefined);
}
export async function addGuestToEventAction(teamId: string, eventId: string, input: svc.NewGuest & { guestId?: string }, keep: boolean): Promise<Out> {
  const r = await svc.addToEvent(eventId, input, keep);
  revalidatePath(`/t/${teamId}/e/${eventId}`);
  revalidatePath(`/t/${teamId}`, "layout");
  return out(r, r.ok ? `${r.data.name} is asked.` : undefined);
}
export async function uninviteGuestAction(teamId: string, eventId: string, guestId: string): Promise<Out> {
  const r = await svc.uninvite(eventId, guestId);
  revalidatePath(`/t/${teamId}/e/${eventId}`);
  return out(r);
}
export async function setGuestAnswerAction(teamId: string, eventId: string, guestId: string, response: GuestResponse): Promise<Out> {
  const r = await svc.setFor(eventId, guestId, response);
  revalidatePath(`/t/${teamId}/e/${eventId}`);
  return out(r);
}
export async function answerAsGuestAction(eventId: string, response: GuestResponse): Promise<Out> {
  const r = await svc.answerAsMe(eventId, response);
  revalidatePath(`/guest/${eventId}`);
  revalidatePath("/");
  return out(r);
}
export async function guestAnswerFromLinkAction(token: string) {
  const r = await svc.answerFromLink(token);
  return r.ok ? ({ ok: true as const, ...r.data }) : ({ ok: false as const, error: r.error });
}
