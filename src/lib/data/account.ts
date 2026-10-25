import "server-only";
import type { ActionResult } from "./types";
import { db, requireUser } from "./store";
import { clearSession } from "./session";
import { planAccountDeletion, type DeletePlan } from "../account-delete";

/*
 * Delete your own account (sample-data build). Teams and clubs you run are handed over or,
 * if nobody else is in them, deleted. Stops with a reason if a team would be left without
 * anyone who can run it.
 */

function samplePlan(uid: string): DeletePlan {
  return planAccountDeletion(uid, {
    teams: db.teams.map((t) => ({ id: t.id, name: t.name, createdBy: t.createdBy, clubId: t.clubId, archived: false })),
    roster: db.roster.map((r) => ({ teamId: r.teamId, userId: r.userId, status: r.status, permissions: r.permissions })),
    clubs: db.clubs.map((c) => ({ id: c.id, name: c.name, createdBy: c.createdBy })),
    clubAdmins: db.clubAdmins.map((a) => ({ clubId: a.clubId, userId: a.userId, role: a.role })),
  });
}

/** What deleting would do, for the confirm screen: anything that stops it. */
export async function accountDeletionBlockers(): Promise<string[]> {
  const user = await requireUser();
  return samplePlan(user.id).blockers;
}

export async function deleteAccount(confirmEmail: string): Promise<ActionResult> {
  const user = await requireUser();
  if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase())
    return { ok: false, error: "Type your email exactly as shown to confirm.", fieldErrors: { confirmEmail: "That doesn't match your email." } };
  const plan = samplePlan(user.id);
  if (plan.blockers.length) return { ok: false, error: plan.blockers.join(" ") };

  for (const { teamId, to } of plan.teamsToReassign) db.teams.find((t) => t.id === teamId)!.createdBy = to;
  for (const { clubId, to } of plan.clubsToReassign) db.clubs.find((c) => c.id === clubId)!.createdBy = to;
  for (const { clubId, userId } of plan.ownersToPromote) {
    for (const a of db.clubAdmins) if (a.clubId === clubId && a.role === "owner") a.role = "admin";
    db.clubAdmins.find((a) => a.clubId === clubId && a.userId === userId)!.role = "owner";
  }
  const goneTeams = new Set(plan.teamsToDelete);
  const goneClubs = new Set(plan.clubsToDelete);
  db.teams = db.teams.filter((t) => !goneTeams.has(t.id));
  for (const t of db.teams) if (t.clubId && goneClubs.has(t.clubId)) t.clubId = null;
  db.clubs = db.clubs.filter((c) => !goneClubs.has(c.id));

  // Everything that belongs to the person or to a deleted team.
  const uid = user.id;
  const email = user.email.toLowerCase();
  const personKeys = ["userId", "voterId", "driverId", "riderId"] as const;
  for (const key of Object.keys(db) as (keyof typeof db)[]) {
    const v = db[key];
    if (!Array.isArray(v)) continue;
    (db as unknown as Record<string, unknown[]>)[key] = (v as unknown as Record<string, unknown>[]).filter(
      (row) =>
        !personKeys.some((k) => row[k] === uid) &&
        !(typeof row.teamId === "string" && goneTeams.has(row.teamId)) &&
        !(typeof row.clubId === "string" && goneClubs.has(row.clubId) && key !== "teams") &&
        !(key === "roster" && !row.userId && String(row.invitedEmail ?? "").toLowerCase() === email),
    );
  }
  db.profiles = db.profiles.filter((p) => p.id !== uid);
  await clearSession();
  return { ok: true, data: undefined };
}
