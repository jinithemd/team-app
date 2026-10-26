"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as svc from "@/lib/tournaments/service";
import type { FormState } from "./actions";

// Thin server-action wrappers for tournaments. Every rule is in lib/tournaments/service.ts.

const str = (f: FormData, k: string) => String(f.get(k) ?? "");
const refresh = (id?: string) => {
  revalidatePath("/tournaments", "layout");
  revalidatePath("/tournament", "layout");
  if (id) revalidatePath(`/tournaments/${id}`, "layout");
};

function input(f: FormData): svc.TournamentInput {
  const logo = f.get("logo");
  return {
    clubId: str(f, "clubId"),
    name: str(f, "name"),
    logo: logo === null || String(logo) === "keep" ? undefined : String(logo) || null,
    format: str(f, "format"),
    legs: str(f, "legs"),
    groupCount: str(f, "groupCount"),
    advancePerGroup: str(f, "advancePerGroup"),
    startsOn: str(f, "startsOn"),
    endsOn: str(f, "endsOn"),
    venueName: str(f, "venueName"),
    venueAddress: str(f, "venueAddress"),
    venueLat: str(f, "lat"),
    venueLng: str(f, "lng"),
    rules: str(f, "rules"),
    fee: str(f, "fee"),
    payTo: str(f, "payTo"),
    maxTeams: str(f, "maxTeams"),
    pointsWin: str(f, "pointsWin"),
    pointsDraw: str(f, "pointsDraw"),
    pointsLoss: str(f, "pointsLoss"),
    isPublic: str(f, "isPublic") === "on",
    registrationOpen: str(f, "registrationOpen") === "on",
  };
}

export async function createTournamentAction(_: FormState, f: FormData): Promise<FormState> {
  const res = await svc.createTournament(input(f));
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  refresh();
  redirect(`/tournaments/${res.data.id}/teams?created=1`);
}

export async function updateTournamentAction(id: string, _: FormState, f: FormData): Promise<FormState> {
  const res = await svc.updateTournament(id, input(f));
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  refresh(id);
  return { ok: true, message: "Saved." };
}

export async function setStatusAction(id: string, status: "draft" | "registration" | "in_progress" | "finished"): Promise<FormState> {
  const res = await svc.setTournamentStatus(id, status);
  if (!res.ok) return { error: res.error };
  refresh(id);
  return { ok: true, message: "Saved." };
}

export async function deleteTournamentAction(id: string): Promise<FormState> {
  const res = await svc.deleteTournament(id);
  if (!res.ok) return { error: res.error };
  refresh();
  redirect("/tournaments?deleted=1");
}

export async function inviteTeamAction(id: string, teamId: string, teamName: string): Promise<FormState> {
  const res = await svc.inviteTeam(id, teamId, teamName);
  if (!res.ok) return { error: res.error };
  refresh(id);
  return { ok: true, message: `Invited ${teamName}. Their captains and managers will see it in Tournaments.` };
}

export async function addGuestAction(id: string, _: FormState, f: FormData): Promise<FormState> {
  const res = await svc.addGuestTeam(id, str(f, "guestName"), str(f, "guestEmail"));
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  refresh(id);
  return { ok: true, message: `Added ${str(f, "guestName").trim()}.` };
}

export async function setEntryAction(id: string, entryId: string, patch: { status?: "accepted" | "declined"; paid?: boolean }): Promise<FormState> {
  const res = await svc.setEntry(id, entryId, patch);
  if (!res.ok) return { error: res.error };
  refresh(id);
  return { ok: true };
}

export async function removeEntryAction(id: string, entryId: string): Promise<FormState> {
  const res = await svc.removeEntry(id, entryId);
  if (!res.ok) return { error: res.error };
  refresh(id);
  return { ok: true };
}

export async function respondInviteAction(entryId: string, accept: boolean): Promise<FormState> {
  const res = await svc.respondInvite(entryId, accept);
  if (!res.ok) return { error: res.error };
  refresh();
  return { ok: true, message: accept ? "You're in." : "Declined." };
}

export async function applyAction(id: string, _: FormState, f: FormData): Promise<FormState> {
  const res = await svc.applyToTournament(id, str(f, "teamId"));
  if (!res.ok) return { error: res.error };
  refresh(id);
  return { ok: true, message: "Entry sent. The organizers will accept it." };
}

export async function withdrawAction(id: string, entryId: string): Promise<FormState> {
  const res = await svc.withdrawEntry(entryId);
  if (!res.ok) return { error: res.error };
  refresh(id);
  return { ok: true, message: "Withdrawn." };
}

export async function generateFixturesAction(id: string, _: FormState, f: FormData): Promise<FormState> {
  const res = await svc.generateFixtures(id, { random: str(f, "draw") === "random", replace: str(f, "replace") === "on" });
  if (!res.ok) return { error: res.error };
  refresh(id);
  redirect(`/tournaments/${id}/fixtures?made=${res.data.count}`);
}

export async function clearFixturesAction(id: string): Promise<FormState> {
  const res = await svc.clearFixtures(id);
  if (!res.ok) return { error: res.error };
  refresh(id);
  return { ok: true, message: "Fixtures cleared." };
}

export async function saveResultAction(id: string, matchId: string, _: FormState, f: FormData): Promise<FormState> {
  const res = await svc.saveResult(id, matchId, {
    status: str(f, "status"),
    homeScore: str(f, "homeScore"),
    awayScore: str(f, "awayScore"),
    homePens: str(f, "homePens"),
    awayPens: str(f, "awayPens"),
    kickoffAt: str(f, "kickoffAt"),
    pitch: str(f, "pitch"),
  });
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  refresh(id);
  return { ok: true, message: "Saved. Table and bracket are up to date." };
}

export async function addEventAction(id: string, matchId: string, _: FormState, f: FormData): Promise<FormState> {
  const res = await svc.addMatchEvent(id, matchId, { entryId: str(f, "entryId"), kind: str(f, "kind"), minute: str(f, "minute"), player: str(f, "player") });
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  refresh(id);
  return { ok: true };
}

export async function removeEventAction(id: string, eventId: string): Promise<FormState> {
  const res = await svc.removeMatchEvent(id, eventId);
  if (!res.ok) return { error: res.error };
  refresh(id);
  return { ok: true };
}

export async function addOfficialAction(id: string, _: FormState, f: FormData): Promise<FormState> {
  const res = await svc.addOfficial(id, str(f, "officialEmail"), str(f, "role") === "organizer" ? "organizer" : "official");
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  refresh(id);
  return { ok: true, message: "Added." };
}

export async function removeOfficialAction(id: string, userId: string): Promise<FormState> {
  const res = await svc.removeOfficial(id, userId);
  if (!res.ok) return { error: res.error };
  refresh(id);
  return { ok: true };
}

/** "My team is my club": make a club from a team I run, then go host. */
export async function clubFromTeamAction(teamId: string): Promise<FormState> {
  const { createClubFromTeam } = await import("@/lib/data");
  const res = await createClubFromTeam(teamId);
  if (!res.ok) return { error: res.error };
  revalidatePath("/", "layout");
  redirect("/tournaments/new?club=1");
}
