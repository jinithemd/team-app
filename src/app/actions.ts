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
  const next = str(f, "next");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
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

function eventInput(f: FormData) {
  return {
    type: (str(f, "type") || "match") as data.EventInput["type"],
    competition: str(f, "competition") as data.EventInput["competition"],
    title: str(f, "title"),
    date: str(f, "date"),
    startTime: str(f, "startTime"),
    endTime: str(f, "endTime"),
    meetMinutes: str(f, "meetMinutes"),
    tz: str(f, "tz") || undefined,
    venueId: str(f, "venueId") || undefined,
    locationText: str(f, "locationText"),
    opponent: str(f, "opponent"),
    homeAway: (str(f, "homeAway") || "home") as "home" | "away" | "neutral",
    notes: str(f, "notes"),
    squadSize: str(f, "squadSize"),
    repeatWeeks: str(f, "repeat") === "on" ? str(f, "repeatWeeks") : "1",
    notify: str(f, "notify") === "on",
  };
}

export async function createEventAction(teamId: string, _: FormState, f: FormData): Promise<FormState> {
  const res = await data.createEvent(teamId, eventInput(f));
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath("/", "layout");
  redirect(`/t/${teamId}/e/${res.data.id}?created=1`);
}

export async function updateEventAction(eventId: string, teamId: string, _: FormState, f: FormData): Promise<FormState> {
  const res = await data.updateEvent(eventId, { ...eventInput(f), scope: str(f, "scope") === "following" ? "following" : "one" });
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath("/", "layout");
  redirect(`/t/${teamId}/e/${eventId}?saved=1`);
}

export async function deleteEventAction(eventId: string, _: FormState, f: FormData): Promise<FormState> {
  const res = await data.deleteEvent(eventId, str(f, "scope") === "following" ? "following" : "one");
  if (!res.ok) return { error: res.error };
  revalidatePath("/", "layout");
  redirect(`/t/${res.data.teamId}/schedule?deleted=${res.data.count}`);
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

export async function updateTeamAction(teamId: string, _: FormState, f: FormData): Promise<FormState> {
  const crest = f.get("crest");
  const res = await data.updateTeam(teamId, {
    name: str(f, "name"),
    level: str(f, "level"),
    location: str(f, "location"),
    color: str(f, "color"),
    colorSecondary: str(f, "colorSecondary") || null,
    rosterVisible: str(f, "rosterVisible") === "on",
    membersCanPost: str(f, "membersCanPost") === "on",
    pointsEnabled: str(f, "pointsEnabled") === "on",
    pointsPublic: str(f, "pointsPublic") === "on",
    geoCheckinEnabled: str(f, "geoCheckinEnabled") === "on",
    pointsRules: {
      training: str(f, "rule.training"),
      match: str(f, "rule.match"),
      away_bonus: str(f, "rule.away_bonus"),
      late_penalty: str(f, "rule.late_penalty"),
      late_after_minutes: str(f, "rule.late_after_minutes"),
      potm: str(f, "rule.potm"),
    },
    crest: crest === null ? undefined : String(crest) === "keep" ? undefined : String(crest),
  });
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}

export async function saveVenueAction(teamId: string, venueId: string | null, _: FormState, f: FormData): Promise<FormState> {
  const res = await data.saveVenue(teamId, venueId, {
    name: str(f, "name"),
    address: str(f, "address"),
    lat: str(f, "lat"),
    lng: str(f, "lng"),
    radiusM: str(f, "radiusM"),
  });
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath(`/t/${teamId}`, "layout");
  redirect(`/t/${teamId}/venues?saved=1`);
}

export async function setMemberStatusAction(teamId: string, memberId: string, status: "active" | "inactive" | "removed", _: FormState): Promise<FormState> {
  const res = await data.setMemberStatus(teamId, memberId, status);
  if (!res.ok) return { error: res.error };
  revalidatePath(`/t/${teamId}`, "layout");
  redirect(`/t/${teamId}/roster?saved=${status}`);
}

export async function resendInviteAction(teamId: string, memberId: string, _: FormState): Promise<FormState> {
  const res = await data.resendInvite(teamId, memberId);
  if (!res.ok) return { error: res.error };
  return { ok: true, message: "Invite sent again." };
}

export async function saveAvailabilityAction(periodId: string | null, _: FormState, f: FormData): Promise<FormState> {
  const res = await data.saveAvailability(periodId, {
    kind: str(f, "kind"),
    startsOn: str(f, "startsOn"),
    endsOn: str(f, "endsOn"),
    note: str(f, "note"),
    teamIds: f.getAll("teamId").map(String),
  });
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath("/", "layout");
  redirect(`/availability?saved=${res.data.affected}`);
}

export async function clearAvailabilityAction(periodId: string, _: FormState): Promise<FormState> {
  const res = await data.clearAvailability(periodId);
  if (!res.ok) return { error: res.error };
  revalidatePath("/", "layout");
  redirect("/availability?cleared=1");
}

export async function saveAttendanceAction(eventId: string, teamId: string, _: FormState, f: FormData): Promise<FormState> {
  const ids = f.getAll("uid").map(String);
  const res = await data.saveAttendance(
    eventId,
    ids.map((u) => ({ userId: u, status: str(f, `s.${u}`), minutesLate: str(f, `m.${u}`) })),
  );
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath(`/t/${teamId}`, "layout");
  return { ok: true, message: `Saved ${res.data.saved} ${res.data.saved === 1 ? "mark" : "marks"}.` };
}

export async function checkInAction(eventId: string, lat: number, lng: number, accuracy: number) {
  const res = await data.checkIn(eventId, lat, lng, accuracy);
  if (res.ok) revalidatePath("/", "layout");
  return res;
}

export async function addPointsAction(teamId: string, _: FormState, f: FormData): Promise<FormState> {
  const res = await data.addManualPoints(teamId, { userId: str(f, "userId"), points: str(f, "points"), note: str(f, "note") });
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath(`/t/${teamId}/points`);
  return { ok: true, message: "Points added." };
}

export async function removePointsAction(teamId: string, pointsId: string, _: FormState): Promise<FormState> {
  const res = await data.removeManualPoints(teamId, pointsId);
  if (!res.ok) return { error: res.error };
  revalidatePath(`/t/${teamId}/points`);
  return { ok: true };
}

export async function closeSeasonAction(teamId: string, _: FormState, f: FormData): Promise<FormState> {
  const res = await data.closeSeason(teamId, {
    nextName: str(f, "nextName"),
    startsOn: str(f, "startsOn"),
    copyRoster: str(f, "copyRoster") === "on",
    keepRoles: str(f, "keepRoles") === "on",
    copyTrainings: str(f, "copyTrainings") === "on",
    carryDues: str(f, "carryDues") === "on",
  });
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath(`/t/${teamId}`, "layout");
  redirect(`/t/${teamId}/seasons?started=1`);
}

export async function updateScoreAction(eventId: string, input: { us: number; them: number; period: string | null; status: "not_started" | "live" | "final"; version: number }) {
  const res = await data.updateScore(eventId, input);
  revalidatePath("/", "layout");
  return res;
}

export async function addMatchEventAction(eventId: string, input: { kind: string; side: string; userId?: string; assistId?: string; minute?: string; version: number }) {
  const res = await data.addMatchEvent(eventId, input);
  revalidatePath("/", "layout");
  return res.ok ? { ok: true as const, score: res.data.score } : res;
}

export async function removeMatchEventAction(eventId: string, matchEventId: string) {
  const res = await data.removeMatchEvent(eventId, matchEventId);
  revalidatePath("/", "layout");
  return res;
}

export async function votePotmAction(eventId: string, nomineeId: string) {
  const res = await data.votePotm(eventId, nomineeId);
  revalidatePath("/", "layout");
  return res;
}

export async function closePotmAction(eventId: string, _: FormState): Promise<FormState> {
  const res = await data.closePotm(eventId);
  if (!res.ok) return { error: res.error };
  revalidatePath("/", "layout");
  return { ok: true, message: "Voting closed." };
}

export async function setEventManagerAction(teamId: string, eventId: string, _: FormState, f: FormData): Promise<FormState> {
  const res = await data.setEventManager(eventId, str(f, "userId"), f.getAll("perm").map(String));
  if (!res.ok) return { error: res.error };
  revalidatePath(`/t/${teamId}`, "layout");
  return { ok: true, message: f.getAll("perm").length ? "Saved. They'll see the tools on this event." : "Removed." };
}

export async function offerRideAction(teamId: string, eventId: string, _: FormState, f: FormData): Promise<FormState> {
  const res = await data.offerRide(eventId, { seats: Number(str(f, "seats")), leavesAt: str(f, "leavesAt"), from: str(f, "from"), note: str(f, "note") });
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath(`/t/${teamId}`, "layout");
  return { ok: true, message: "Thanks. Teammates can take a seat now." };
}

export async function carpoolAction(
  teamId: string,
  eventId: string,
  op: { kind: "take"; offerId: string | null; from?: string } | { kind: "leave" } | { kind: "cancelOffer" } | { kind: "assign"; requestId: string; offerId: string | null },
) {
  const res =
    op.kind === "take"
      ? await data.takeSeat(eventId, op.offerId, op.from)
      : op.kind === "leave"
        ? await data.leaveCarpool(eventId)
        : op.kind === "cancelOffer"
          ? await data.cancelOffer(eventId)
          : await data.assignRider(eventId, op.requestId, op.offerId);
  revalidatePath(`/t/${teamId}`, "layout");
  return res.ok ? { ok: true as const } : { ok: false as const, error: res.error };
}

export async function addFeeAction(teamId: string, _: FormState, f: FormData): Promise<FormState> {
  const res = await data.addFee(teamId, { name: str(f, "name"), amount: str(f, "amount"), dueOn: str(f, "dueOn") });
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath(`/t/${teamId}`, "layout");
  return { ok: true, message: `Added for ${res.data.players} players.` };
}

export async function reportPaymentAction(teamId: string, dueId: string, _: FormState, f: FormData): Promise<FormState> {
  const res = await data.reportPayment(dueId, { amount: str(f, "amount"), method: str(f, "method"), ref: str(f, "ref"), paidOn: str(f, "paidOn") });
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath("/", "layout");
  return { ok: true, message: "Thanks. The treasurer will tick it off." };
}

export async function confirmPaymentAction(teamId: string, paymentId: string, accept: boolean) {
  const res = await data.confirmPayment(paymentId, accept);
  revalidatePath(`/t/${teamId}`, "layout");
  return res.ok ? { ok: true as const } : { ok: false as const, error: res.error };
}

export async function remindUnpaidAction(teamId: string, _: FormState): Promise<FormState> {
  const res = await data.remindUnpaid(teamId);
  if (!res.ok) return { error: res.error };
  return { ok: true, message: res.data.sent ? `Reminder sent to ${res.data.sent} ${res.data.sent === 1 ? "player" : "players"}.` : "Nobody owes anything." };
}

export async function sendChatAction(convId: string, input: { body: string; replyToId?: string | null; imageUrl?: string | null; poll?: { question: string; options: string[]; multi: boolean } | null }) {
  const res = await data.sendChat(convId, input);
  revalidatePath("/", "layout");
  return res.ok ? { ok: true as const } : { ok: false as const, error: res.error };
}

export async function chatOpAction(op: { kind: "react"; messageId: string; emoji: string } | { kind: "vote"; messageId: string; option: number } | { kind: "pin" | "unpin" | "delete"; messageId: string }) {
  const res =
    op.kind === "react" ? await data.toggleReaction(op.messageId, op.emoji) : op.kind === "vote" ? await data.votePoll(op.messageId, op.option) : await data.moderateMessage(op.messageId, op.kind);
  revalidatePath("/", "layout");
  return res.ok ? { ok: true as const } : { ok: false as const, error: res.error };
}

export async function sendTeamMessageAction(teamId: string, _: FormState, f: FormData): Promise<FormState> {
  const to = (["all", "players", "staff", "chosen"] as const).find((x) => x === str(f, "to")) ?? "all";
  const res = await data.sendTeamMessage(teamId, { subject: str(f, "subject"), body: str(f, "body"), to, recipientIds: f.getAll("recipient").map(String) });
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath(`/t/${teamId}`, "layout");
  redirect(`/t/${teamId}/messages?sent=${res.data.count}`);
}

export async function savePrefsAction(teamId: string, _: FormState, f: FormData): Promise<FormState> {
  const res = await data.savePrefs(teamId, {
    newEvents: f.has("newEvents"),
    changes: f.has("changes"),
    reminders: f.has("reminders"),
    chat: (str(f, "chat") || "all") as "all" | "mentions" | "off",
    email: f.has("email"),
    push: f.has("push"),
  });
  if (!res.ok) return { error: res.error };
  return { ok: true, message: "Saved." };
}

export async function resetFeedAction() {
  await data.resetCalendarFeed();
  return { ok: true as const };
}

export async function requestToJoinAction(teamId: string, path: string, _: FormState, f: FormData): Promise<FormState> {
  const res = await data.requestToJoin(teamId, str(f, "message"));
  if (!res.ok) return { error: res.error };
  revalidatePath(path);
  return { ok: true, message: "Sent. The captain will get back to you." };
}

export async function decideJoinAction(teamId: string, requestId: string, approve: boolean) {
  const res = await data.decideJoinRequest(requestId, approve);
  revalidatePath(`/t/${teamId}`, "layout");
  return res.ok ? { ok: true as const } : { ok: false as const, error: res.error };
}

export async function joinByCodeAction(_: FormState, f: FormData): Promise<FormState> {
  const res = await data.joinByCode(str(f, "code"));
  if (!res.ok) return { error: res.error };
  revalidatePath("/", "layout");
  redirect(`/t/${res.data.teamId}/schedule?joined=1`);
}

export async function updateClubAction(clubId: string, _: FormState, f: FormData): Promise<FormState> {
  const logo = f.get("logo");
  const res = await data.updateClub(clubId, {
    name: str(f, "name"),
    color: str(f, "color"),
    colorSecondary: str(f, "colorSecondary") || null,
    blurb: str(f, "blurb"),
    joinOpen: str(f, "joinOpen") === "on",
    logo: logo === null ? undefined : String(logo) || null,
  });
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved. Every club team now shows the new look." };
}

export async function clubAdminAction(clubId: string, _: FormState, f: FormData): Promise<FormState> {
  const remove = str(f, "remove");
  const res = remove ? await data.removeClubAdmin(clubId, remove) : await data.addClubAdmin(clubId, str(f, "email"), str(f, "role"));
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath(`/clubs/${clubId}`, "layout");
  return { ok: true, message: remove ? "Removed." : "Added. They got an email." };
}
