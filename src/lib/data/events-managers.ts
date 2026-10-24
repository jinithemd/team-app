import "server-only";
import type { ActionResult, EventPermission, ID, Person } from "./types";
import { EVENT_PERMISSIONS } from "./types";
import { activePlayers, db, eventById, hasEventPerm, isEventManager, isTeamStaff, personFor, requireUser } from "./store";

/*
 * Event managers: hand one away trip or tournament to someone (attendance, score, carpools)
 * without making them staff for the season. Mirrors the event_managers table and has_event_perm.
 */

export async function eventPerms(eventId: ID) {
  const user = await requireUser();
  return {
    attendance: hasEventPerm(user.id, eventId, "attendance"),
    scoring: hasEventPerm(user.id, eventId, "scoring"),
    carpools: hasEventPerm(user.id, eventId, "carpools"),
    manager: isEventManager(user.id, eventId),
  };
}

export async function listEventManagers(eventId: ID): Promise<{ canEdit: boolean; managers: { person: Person; permissions: EventPermission[] }[]; candidates: Person[] } | null> {
  const user = await requireUser();
  const e = eventById(eventId);
  if (!e) return null;
  const canEdit = isTeamStaff(user.id, e.teamId);
  const managers = db.eventManagers
    .filter((m) => m.eventId === eventId)
    .map((m) => {
      const r = db.roster.find((x) => x.teamId === e.teamId && x.userId === m.userId)!;
      return { person: personFor(r), permissions: m.permissions };
    });
  const candidates = activePlayers(e.teamId)
    .filter((r) => !db.eventManagers.some((m) => m.eventId === eventId && m.userId === r.userId) && !isTeamStaff(r.userId!, e.teamId))
    .map(personFor)
    .sort((a, b) => a.firstName.localeCompare(b.firstName));
  return { canEdit, managers, candidates };
}

export async function setEventManager(eventId: ID, userId: ID, permissions: string[]): Promise<ActionResult> {
  const user = await requireUser();
  const e = eventById(eventId);
  if (!e || !isTeamStaff(user.id, e.teamId)) return { ok: false, error: "Only captains and managers can hand out an event." };
  if (!db.roster.some((r) => r.teamId === e.teamId && r.userId === userId && r.status === "active"))
    return { ok: false, error: "Pick someone on the team." };
  const perms = EVENT_PERMISSIONS.filter((p) => permissions.includes(p));
  db.eventManagers = db.eventManagers.filter((m) => !(m.eventId === eventId && m.userId === userId));
  if (perms.length) db.eventManagers.push({ eventId, userId, permissions: perms });
  return { ok: true, data: undefined };
}
