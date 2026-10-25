/*
 * Deleting an account: what has to happen to the teams and clubs the person runs, worked out
 * the same way for the sample-data and Supabase builds. Pure: no database access here.
 *
 * Rules:
 * - Every team someone else is on must keep at least one person who can run it: another member
 *   with permissions, the team's creator, or a club admin. If the leaver is the last one,
 *   deletion stops and says which teams need a new manager first.
 * - Teams and clubs the leaver created are handed to someone who can already run them.
 * - A team or club nobody else is in is deleted along with the account.
 */

export interface PlanTeam {
  id: string;
  name: string;
  createdBy: string;
  clubId: string | null;
  archived: boolean;
}
export interface PlanRosterRow {
  teamId: string;
  userId: string | null;
  status: "invited" | "active" | "inactive" | "removed";
  permissions: string[];
}
export interface PlanClub {
  id: string;
  name: string;
  createdBy: string;
}
export interface PlanClubAdmin {
  clubId: string;
  userId: string;
  role: "owner" | "admin" | "treasurer";
}

export interface DeletePlan {
  blockers: string[];
  /** Hand these teams to another person (new created_by). */
  teamsToReassign: { teamId: string; to: string }[];
  teamsToDelete: string[];
  clubsToReassign: { clubId: string; to: string }[];
  /** Make this person the club owner (the leaver was the owner). */
  ownersToPromote: { clubId: string; userId: string }[];
  clubsToDelete: string[];
}

export function planAccountDeletion(
  uid: string,
  input: { teams: PlanTeam[]; roster: PlanRosterRow[]; clubs: PlanClub[]; clubAdmins: PlanClubAdmin[] },
): DeletePlan {
  const plan: DeletePlan = { blockers: [], teamsToReassign: [], teamsToDelete: [], clubsToReassign: [], ownersToPromote: [], clubsToDelete: [] };
  const live = (r: PlanRosterRow) => r.userId && r.userId !== uid && (r.status === "active" || r.status === "inactive");

  // Clubs first: whether a club keeps an admin decides whether it can look after its teams.
  const clubKeepsAdmin = new Map<string, string>(); // club id -> an admin who stays
  for (const c of input.clubs) {
    const admins = input.clubAdmins.filter((a) => a.clubId === c.id);
    const mine = admins.find((a) => a.userId === uid);
    const others = admins.filter((a) => a.userId !== uid && (a.role === "owner" || a.role === "admin"));
    const heir = others.find((a) => a.role === "owner") ?? others[0];
    if (heir) clubKeepsAdmin.set(c.id, heir.userId);
    if (c.createdBy !== uid && mine?.role !== "owner") continue;
    if (heir) {
      if (c.createdBy === uid) plan.clubsToReassign.push({ clubId: c.id, to: heir.userId });
      if (mine?.role === "owner" && heir.role !== "owner") plan.ownersToPromote.push({ clubId: c.id, userId: heir.userId });
      continue;
    }
    const busyTeams = input.teams.filter((t) => t.clubId === c.id && input.roster.some((r) => r.teamId === t.id && live(r)));
    if (busyTeams.length) plan.blockers.push(`You're the only admin of the club ${c.name}. Make someone else an admin first.`);
    else plan.clubsToDelete.push(c.id);
  }

  for (const t of input.teams) {
    const rows = input.roster.filter((r) => r.teamId === t.id);
    const iRun = t.createdBy === uid || rows.some((r) => r.userId === uid && r.status === "active" && r.permissions.length > 0);
    if (!iRun) continue;
    const staff = rows.filter((r) => live(r) && r.status === "active" && r.permissions.length > 0);
    const others = rows.filter(live);
    const clubAdmin = t.clubId ? clubKeepsAdmin.get(t.clubId) : undefined;
    const heir =
      staff.find((r) => r.permissions.includes("manage_permissions"))?.userId ??
      staff[0]?.userId ??
      (t.createdBy !== uid ? t.createdBy : undefined) ??
      clubAdmin ??
      (t.archived ? others[0]?.userId : undefined);
    if (t.createdBy !== uid) {
      // Someone else created it, so the team keeps its creator. Nothing to hand over.
      continue;
    }
    if (heir) plan.teamsToReassign.push({ teamId: t.id, to: heir as string });
    else if (!others.length) plan.teamsToDelete.push(t.id);
    else plan.blockers.push(`You're the only manager of ${t.name}. Give someone else on the team permissions first.`);
  }
  return plan;
}
