import "server-only";
import type { ActionResult, Profile } from "../types";

// Live build: people sign in with Supabase Auth (src/lib/auth.ts), not demo accounts.

export async function listDemoAccounts(): Promise<{ id: string; name: string; email: string; blurb: string }[]> {
  return [];
}

export async function signInAs(): Promise<void> {
  throw new Error("Demo accounts are only in the sample-data build");
}

export async function signUp(): Promise<ActionResult<Profile>> {
  return { ok: false, error: "Sign up with the email link instead." };
}

/** The sample inbox page, for local testing only (DEV_OUTBOX=1). Real emails go out through the outbox worker. */
export async function listOutbox(): Promise<import("../types").OutboxEmail[]> {
  if (process.env.DEV_OUTBOX !== "1") return [];
  const { adminClient } = await import("../../supabase/server");
  const admin = adminClient();
  const { data } = await admin.from("outbox").select("id, kind, user_id, payload, created_at").eq("channel", "email").order("created_at", { ascending: false }).limit(50);
  const { renderOutbox } = await import("../../email/render");
  return Promise.all((data ?? []).map((r) => renderOutbox(admin, r)));
}

// ---------------------------------------------------------------------------
// delete your own account (Supabase): hand over or delete what you run, then remove the
// auth user. Every table that points at the person cascades or clears its link
// (replica/schema.sql); only teams.created_by and clubs.created_by block, so those are
// handed over first.
// ---------------------------------------------------------------------------

async function liveDeletionPlan(uid: string) {
  const { adminClient } = await import("../../supabase/server");
  const { planAccountDeletion } = await import("../../account-delete");
  const admin = adminClient();
  const [myTeams, myRows, myClubs, myAdminRows] = await Promise.all([
    admin.from("teams").select("id").eq("created_by", uid),
    admin.from("roster_members").select("team_id").eq("user_id", uid),
    admin.from("clubs").select("id").eq("created_by", uid),
    admin.from("club_admins").select("club_id").eq("user_id", uid),
  ]);
  const clubIds = [...new Set([...(myClubs.data ?? []).map((c) => c.id), ...(myAdminRows.data ?? []).map((a) => a.club_id)])];
  const clubTeams = clubIds.length ? ((await admin.from("teams").select("id").in("club_id", clubIds)).data ?? []) : [];
  const teamIds = [...new Set([...(myTeams.data ?? []).map((t) => t.id), ...(myRows.data ?? []).map((r) => r.team_id), ...clubTeams.map((t) => t.id)])];
  const [teams, roster, clubs, clubAdmins] = await Promise.all([
    teamIds.length ? admin.from("teams").select("id, name, created_by, club_id, archived_at").in("id", teamIds) : Promise.resolve({ data: [] as never[] }),
    teamIds.length ? admin.from("roster_members").select("team_id, user_id, status, permissions").in("team_id", teamIds) : Promise.resolve({ data: [] as never[] }),
    clubIds.length ? admin.from("clubs").select("id, name, created_by").in("id", clubIds) : Promise.resolve({ data: [] as never[] }),
    clubIds.length ? admin.from("club_admins").select("club_id, user_id, role").in("club_id", clubIds) : Promise.resolve({ data: [] as never[] }),
  ]);
  const plan = planAccountDeletion(uid, {
    teams: (teams.data ?? []).map((t) => ({ id: t.id, name: t.name, createdBy: t.created_by, clubId: t.club_id, archived: !!t.archived_at })),
    roster: (roster.data ?? []).map((r) => ({ teamId: r.team_id, userId: r.user_id, status: r.status as "active", permissions: r.permissions ?? [] })),
    clubs: (clubs.data ?? []).map((c) => ({ id: c.id, name: c.name, createdBy: c.created_by })),
    clubAdmins: (clubAdmins.data ?? []).map((a) => ({ clubId: a.club_id, userId: a.user_id, role: a.role as "admin" })),
  });
  return { admin, plan };
}

async function signedInUser() {
  const { userClient } = await import("../../supabase/server");
  const sb = await userClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return { sb, user: data.user };
}

export async function accountDeletionBlockers(): Promise<string[]> {
  const { user } = await signedInUser();
  return (await liveDeletionPlan(user.id)).plan.blockers;
}

export async function deleteAccount(confirmEmail: string): Promise<ActionResult> {
  const { sb, user } = await signedInUser();
  const email = (user.email ?? "").toLowerCase();
  if (confirmEmail.trim().toLowerCase() !== email)
    return { ok: false, error: "Type your email exactly as shown to confirm.", fieldErrors: { confirmEmail: "That doesn't match your email." } };
  const { admin, plan } = await liveDeletionPlan(user.id);
  if (plan.blockers.length) return { ok: false, error: plan.blockers.join(" ") };

  const fail = (what: string, e: { message: string } | null) => {
    if (e) throw new Error(`delete account: ${what}: ${e.message}`);
  };
  try {
    for (const { teamId, to } of plan.teamsToReassign) fail("hand over team", (await admin.from("teams").update({ created_by: to }).eq("id", teamId)).error);
    for (const { clubId, to } of plan.clubsToReassign) fail("hand over club", (await admin.from("clubs").update({ created_by: to }).eq("id", clubId)).error);
    for (const { clubId, userId } of plan.ownersToPromote) {
      // One owner per club: step the leaver down before promoting.
      fail("club owner", (await admin.from("club_admins").update({ role: "admin" }).eq("club_id", clubId).eq("role", "owner")).error);
      fail("club owner", (await admin.from("club_admins").update({ role: "owner" }).eq("club_id", clubId).eq("user_id", userId)).error);
    }
    if (plan.teamsToDelete.length) fail("delete teams", (await admin.from("teams").delete().in("id", plan.teamsToDelete)).error);
    if (plan.clubsToDelete.length) fail("delete clubs", (await admin.from("clubs").delete().in("id", plan.clubsToDelete)).error);
    // Pending invites sent to this address before the person had an account.
    if (email) fail("invites", (await admin.from("roster_members").delete().is("user_id", null).eq("invited_email", email)).error);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    fail("auth user", error);
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Something went wrong, and your account wasn't deleted. Try again in a minute." };
  }
  await sb.auth.signOut().catch(() => {});
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// "Your part on the team" (Supabase). A player may change their own number, positions
// and whether they play through set_my_player_details(); only someone who manages
// permissions can change roles, which goes through the shared logic.
// ---------------------------------------------------------------------------

export async function setMyPart(
  teamId: string,
  input: { isPlayer: boolean; jersey?: string; position?: string; roles: string[] },
): Promise<ActionResult<import("../types").RosterMember>> {
  const { onLive } = await import("./run");
  const shared = await import("../fake");
  const { TEAM_ROLES } = await import("../types");
  const { sb, user } = await signedInUser();
  const { data: row } = await sb
    .from("roster_members")
    .select("id, roles, status")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .in("status", ["active", "inactive"])
    .maybeSingle();
  if (!row) return { ok: false, error: "You're not on this team." };
  const roles = TEAM_ROLES.filter((r) => input.roles.includes(r));
  const current = TEAM_ROLES.filter((r) => (row.roles ?? []).includes(r));
  if (roles.join() !== current.join()) return onLive(shared.setMyPart)(teamId, input);

  const jersey = input.isPlayer ? input.jersey?.trim() || null : null;
  const position = input.isPlayer ? input.position?.trim() || null : null;
  if (!input.isPlayer && !roles.length) return { ok: false, error: "Check the highlighted fields.", fieldErrors: { roles: "Pick at least one: you play, or a role on the team." } };
  if (jersey && !/^\d{1,3}$/.test(jersey)) return { ok: false, error: "Check the highlighted fields.", fieldErrors: { jersey: "Use up to 3 digits." } };
  if (jersey) {
    const { data: same } = await sb.from("roster_members").select("id").eq("team_id", teamId).eq("jersey", jersey).eq("is_player", true).neq("status", "removed").neq("id", row.id).limit(1);
    if (same?.length) return { ok: false, error: "Check the highlighted fields.", fieldErrors: { jersey: `Someone already wears ${jersey}.` } };
  }
  if (position && position.length > 80) return { ok: false, error: "Pick fewer positions." };
  const { error } = await sb.rpc("set_my_player_details", { t: teamId, p_is_player: input.isPlayer, p_jersey: jersey ?? "", p_position: position ?? "" });
  if (error) {
    console.error("[setMyPart]", error.message);
    return { ok: false, error: "Couldn't save that. Try again in a minute." };
  }
  const { data: r } = await sb.from("roster_members").select("*").eq("id", row.id).single();
  if (!r) return { ok: false, error: "Saved, but couldn't read it back. Refresh the page." };
  return {
    ok: true,
    data: {
      id: r.id,
      teamId: r.team_id,
      userId: r.user_id,
      invitedEmail: r.invited_email,
      invitedName: null,
      isPlayer: r.is_player,
      roles: r.roles as import("../types").RosterMember["roles"],
      jersey: r.jersey,
      position: r.position,
      permissions: r.permissions as import("../types").RosterMember["permissions"],
      status: r.status as import("../types").RosterMember["status"],
    },
  };
}
