"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as data from "@/lib/data";
import type { ActionResult, RsvpResponse } from "@/lib/data/types";

// Thin server-action wrappers. Permission checks live in the data layer (and in RLS later).

export type FormState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean; message?: string } | null;

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function signInAsAction(f: FormData) {
  await data.signInAs(str(f, "userId"));
  redirect(str(f, "next") || "/");
}

export async function signUpAction(_: FormState, f: FormData): Promise<FormState> {
  const res = await data.signUp({ firstName: str(f, "firstName"), lastName: str(f, "lastName"), email: str(f, "email") });
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  redirect("/");
}

export async function signOutAction() {
  await data.signOut();
  redirect("/login");
}

export async function updatePreferencesAction(f: FormData) {
  const theme = str(f, "theme") as "system" | "light" | "dark";
  await data.updatePreferences({
    theme: ["system", "light", "dark"].includes(theme) ? theme : undefined,
    useTeamColors: f.has("useTeamColors") ? str(f, "useTeamColors") === "on" : undefined,
  });
  revalidatePath("/", "layout");
}

export async function createTeamAction(_: FormState, f: FormData): Promise<FormState> {
  const res = await data.createTeam({
    name: str(f, "name"),
    sport: str(f, "sport"),
    level: str(f, "level"),
    location: str(f, "location"),
    color: str(f, "color"),
    colorSecondary: str(f, "colorSecondary") || null,
    clubId: str(f, "clubId") || null,
  });
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath("/", "layout");
  redirect(`/t/${res.data.id}/you?new=1`);
}

export async function createClubAction(_: FormState, f: FormData): Promise<FormState> {
  const res = await data.createClub({ name: str(f, "name"), color: str(f, "color"), colorSecondary: str(f, "colorSecondary") || null });
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath("/", "layout");
  redirect(`/teams/new?club=${res.data.id}&clubCreated=1`);
}

export async function setMyPartAction(teamId: string, next: string, _: FormState, f: FormData): Promise<FormState> {
  const res = await data.setMyPart(teamId, {
    isPlayer: str(f, "plays") === "yes",
    jersey: str(f, "jersey"),
    position: str(f, "position"),
    roles: f.getAll("role").map(String),
  });
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath("/", "layout");
  if (next) redirect(next);
  return { ok: true, message: "Saved." };
}

export async function invitePeopleAction(teamId: string, _: FormState, f: FormData): Promise<FormState> {
  const count = Number(f.get("count") ?? 0);
  const rows = Array.from({ length: count }, (_, i) => ({
    firstName: str(f, `${i}.firstName`),
    lastName: str(f, `${i}.lastName`),
    email: str(f, `${i}.email`),
    jersey: str(f, `${i}.jersey`),
    position: str(f, `${i}.position`),
    isPlayer: str(f, `${i}.plays`) !== "no",
    roles: f.getAll(`${i}.role`).map(String),
  })).filter((r) => r.firstName || r.lastName || r.email);
  if (!rows.length) return { error: "Add at least one person." };
  const res = await data.invitePeople(teamId, rows);
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath(`/t/${teamId}`, "layout");
  redirect(`/t/${teamId}/roster?invited=${res.data.count}`);
}

export async function createEventAction(teamId: string, _: FormState, f: FormData): Promise<FormState> {
  const res = await data.createEvent(teamId, {
    type: (str(f, "type") || "game") as "game" | "practice" | "event",
    title: str(f, "title"),
    date: str(f, "date"),
    startTime: str(f, "startTime"),
    endTime: str(f, "endTime"),
    tz: str(f, "tz") || undefined,
    locationText: str(f, "locationText"),
    opponent: str(f, "opponent"),
    homeAway: (str(f, "homeAway") || "home") as "home" | "away" | "neutral",
    notes: str(f, "notes"),
    notify: str(f, "notify") === "on",
  });
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath("/", "layout");
  redirect(`/t/${teamId}/e/${res.data.id}?created=1`);
}

export async function setEventStatusAction(eventId: string, teamId: string, _: FormState, f: FormData): Promise<FormState> {
  const status = str(f, "status") as "active" | "postponed" | "cancelled";
  const res = await data.setEventStatus(eventId, status, str(f, "reason"), str(f, "notify") !== "off");
  if (!res.ok) return { error: res.error };
  revalidatePath("/", "layout");
  return { ok: true, message: status === "active" ? "Back on the schedule. The team was told." : `Marked ${status}. The team was told.` };
}

export async function setRsvpAction(
  eventId: string,
  userId: string,
  response: RsvpResponse,
  note?: string | null,
): Promise<ActionResult<{ response: RsvpResponse; note: string | null }>> {
  const res = await data.setRsvp(eventId, userId, response, note);
  if (!res.ok) return res;
  revalidatePath("/", "layout");
  return { ok: true, data: { response: res.data.response, note: res.data.note } };
}

export async function nudgeAction(eventId: string, _: FormState): Promise<FormState> {
  const res = await data.nudgeNonResponders(eventId);
  if (!res.ok) return { error: res.error };
  return {
    ok: true,
    message: res.data.sent ? `Reminder sent to ${res.data.sent} ${res.data.sent === 1 ? "player" : "players"}.` : "Everyone has answered already.",
  };
}

export async function rsvpFromLinkAction(token: string) {
  const res = await data.rsvpFromLink(token);
  if (!res.ok) return { ok: false as const, error: res.error };
  revalidatePath("/", "layout");
  return {
    ok: true as const,
    teamId: res.data.event.teamId,
    eventId: res.data.event.id,
    personName: res.data.person.firstName,
    response: res.data.response,
  };
}

export async function acceptInviteAction(token: string, _: FormState, f: FormData): Promise<FormState> {
  const res = await data.acceptInvite(token, { firstName: str(f, "firstName"), lastName: str(f, "lastName") });
  if (!res.ok) return { error: res.error };
  revalidatePath("/", "layout");
  redirect(`/t/${res.data.teamId}/schedule?joined=1`);
}

export async function updateMemberAction(teamId: string, memberId: string, _: FormState, f: FormData): Promise<FormState> {
  const res = await data.updateMember(teamId, memberId, {
    isPlayer: str(f, "plays") === "yes",
    jersey: str(f, "jersey"),
    position: str(f, "position"),
    roles: f.getAll("role").map(String),
    permissions: f.getAll("perm").map(String),
  });
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath(`/t/${teamId}`, "layout");
  redirect(`/t/${teamId}/roster?saved=member`);
}
