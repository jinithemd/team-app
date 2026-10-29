"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as svc from "@/lib/sessions/service";
import type { FormState } from "./actions";

// Thin server-action wrappers for game sessions. Every rule is in lib/sessions/service.ts.

const str = (f: FormData, k: string) => String(f.get(k) ?? "");
const refresh = () => revalidatePath("/", "layout");

function input(f: FormData): svc.SessionInput {
  return {
    title: str(f, "title"), date: str(f, "date"), weekday: str(f, "weekday"), startTime: str(f, "startTime"), endTime: str(f, "endTime"),
    venueName: str(f, "venueName"), venueAddress: str(f, "venueAddress"), price: str(f, "price"), capacity: str(f, "capacity"), memberSpots: str(f, "memberSpots"),
    releaseHours: str(f, "releaseHours"), notes: str(f, "notes"), postWhen: str(f, "postWhen") === "later" ? "later" : "now", postDate: str(f, "postDate"),
    postTime: str(f, "postTime"), postDaysBefore: str(f, "postDaysBefore"),
  };
}

export async function createSessionAction(teamId: string, weekly: boolean, _: FormState, f: FormData): Promise<FormState> {
  const r = weekly ? await svc.createSeries(teamId, input(f)) : await svc.createSession(teamId, input(f));
  if (!r.ok) return { error: r.error, fieldErrors: r.fieldErrors };
  refresh();
  redirect(weekly ? `/t/${teamId}/schedule?weekly=1` : `/s/${r.data.id}?posted=1`);
}

export async function bookSessionAction(sessionId: string): Promise<{ error?: string; payUrl?: string }> {
  const r = await svc.book(sessionId);
  refresh();
  if (!r.ok) return { error: r.error };
  return { payUrl: r.data.payUrl };
}

export async function payForBookingAction(sessionId: string): Promise<{ error?: string; payUrl?: string }> {
  const r = await svc.payForBooking(sessionId);
  return r.ok ? { payUrl: r.data.url } : { error: r.error };
}

export async function cancelBookingAction(sessionId: string): Promise<{ error?: string }> {
  const r = await svc.cancelMyBooking(sessionId);
  refresh();
  return r.ok ? {} : { error: r.error };
}

export async function staffBookingAction(sessionId: string, bookingId: string, op: "cash" | "uncash" | "remove"): Promise<{ error?: string }> {
  const r = await svc.staffBooking(sessionId, bookingId, op);
  refresh();
  return r.ok ? {} : { error: r.error };
}

export async function cancelSessionAction(sessionId: string): Promise<{ error?: string }> {
  const r = await svc.cancelSession(sessionId);
  refresh();
  return r.ok ? {} : { error: r.error };
}

export async function seriesAction(seriesId: string, op: { active: boolean } | { skip: string; on: boolean }): Promise<{ error?: string }> {
  const r = "active" in op ? await svc.setSeriesActive(seriesId, op.active) : await svc.skipWeek(seriesId, op.skip, op.on);
  refresh();
  return r.ok ? {} : { error: r.error };
}
