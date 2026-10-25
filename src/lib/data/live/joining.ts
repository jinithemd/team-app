import "server-only";
import type { ActionResult, ID } from "../types";
import { userClient, adminClient } from "../../supabase/server";
import { verify } from "../../tokens";
import { APP_URL } from "../store";
import { SPONSOR_TIERS, hatLabels, type SponsorTier } from "../types";
import { kickOutbox } from "../../email/worker";

/*
 * Joining a team in the live build. These go through the database functions in the
 * schema's "joining a team" section, because the person joining isn't on the team yet and
 * so can't read or write its rows directly.
 */

const msg = (e: { message: string } | null, fallback: string) => (e ? e.message.replace(/^.*?:\s*/, "") || fallback : fallback);

export async function getJoinPage(token: string) {
  const sb = await userClient();
  const { data } = await sb.rpc("join_page", { p_token: token });
  const r = data?.[0];
  if (!r) return null;
  return {
    team: { id: r.team_id, name: r.name, level: r.level, location: r.location, sport: r.sport, color: r.color, colorSecondary: r.color_secondary, crest: r.logo_path },
    club: r.club_name ? { name: r.club_name, slug: r.club_slug! } : null,
    players: r.players ?? 0,
    needsApproval: !!r.needs_approval,
    me: r.me as "signed-out" | "member" | "requested" | "none",
  };
}

export async function joinByLink(token: string): Promise<ActionResult<{ teamId: ID; status: "joined" | "requested" | "member" }>> {
  const sb = await userClient();
  const { data, error } = await sb.rpc("join_by_link", { p_token: token });
  const r = data?.[0];
  if (error || !r) return { ok: false, error: error && /sign in/i.test(error.message) ? "Sign in first." : "This invite link doesn't work any more. Ask your captain for the new one." };
  if (r.status !== "member") await kickOutbox(); // the captains' "joined" / "wants to join" email
  return { ok: true, data: { teamId: r.team_id, status: r.status as "joined" | "requested" | "member" } };
}

export async function joinByCode(code: string): Promise<ActionResult<{ teamId: ID }>> {
  const sb = await userClient();
  const { data, error } = await sb.rpc("join_by_code", { p_code: code });
  if (error || !data) return { ok: false, error: "No team has that code. Check it with your captain." };
  return { ok: true, data: { teamId: data } };
}

export async function requestToJoin(teamId: ID, message: string): Promise<ActionResult> {
  const sb = await userClient();
  const { error } = await sb.rpc("request_to_join", { p_team: teamId, p_message: message });
  if (error) return { ok: false, error: /taking/i.test(error.message) ? "That team isn't taking requests." : msg(error, "Couldn't send that. Try again.") };
  await kickOutbox();
  return { ok: true, data: undefined };
}

export async function decideJoinRequest(requestId: ID, approve: boolean): Promise<ActionResult<{ teamId: ID }>> {
  const sb = await userClient();
  const { data: req } = await sb.from("join_requests").select("team_id").eq("id", requestId).maybeSingle();
  const { error } = await sb.rpc("decide_join_request", { p_request: requestId, p_approve: approve });
  if (error || !req) return { ok: false, error: error && /sorted/i.test(error.message) ? "Already sorted." : "Only captains and managers can add people." };
  await kickOutbox();
  return { ok: true, data: { teamId: req.team_id } };
}

export async function resetInviteLink(teamId: ID): Promise<ActionResult<{ url: string }>> {
  const sb = await userClient();
  const { data, error } = await sb.rpc("reset_invite_link", { p_team: teamId });
  if (error || !data) return { ok: false, error: "Only captains and managers can reset the link." };
  return { ok: true, data: { url: `${APP_URL}/join/${data}` } };
}

/** Find a team: public teams by name, club name or join code. */
export async function searchTeams(q: string) {
  const sb = await userClient();
  const { data: auth } = await sb.auth.getUser();
  const uid = auth.user?.id;
  const s = q.trim();
  if (!uid || s.length < 2) return [];
  const like = `%${s.replace(/[%_,()]/g, " ")}%`;
  const [{ data: byName }, { data: clubs }] = await Promise.all([
    sb.from("teams").select("id, name, level, location, club_id, join_code").eq("is_public", true).is("archived_at", null).or(`name.ilike.${like},join_code.eq.${s.toUpperCase().replace(/[^A-Z0-9]/g, "")}`).limit(20),
    sb.from("clubs").select("id, name, slug").ilike("name", like).limit(10),
  ]);
  const clubTeams = clubs?.length
    ? (await sb.from("teams").select("id, name, level, location, club_id, join_code").eq("is_public", true).is("archived_at", null).in("club_id", clubs.map((c) => c.id)).limit(20)).data ?? []
    : [];
  const teams = [...(byName ?? []), ...clubTeams].filter((t, i, a) => a.findIndex((x) => x.id === t.id) === i).slice(0, 20);
  if (!teams.length) return [];
  const ids = teams.map((t) => t.id);
  const admin = adminClient();
  const [{ data: allClubs }, { data: players }, { data: mine }, { data: asked }] = await Promise.all([
    admin.from("clubs").select("id, name, slug").in("id", teams.map((t) => t.club_id).filter((x): x is string => !!x)),
    admin.from("roster_members").select("team_id").in("team_id", ids).eq("status", "active").eq("is_player", true).not("user_id", "is", null),
    sb.from("roster_members").select("team_id").eq("user_id", uid).neq("status", "removed").in("team_id", ids),
    sb.from("join_requests").select("team_id").eq("user_id", uid).eq("status", "pending").in("team_id", ids),
  ]);
  return teams.map((t) => {
    const club = allClubs?.find((c) => c.id === t.club_id) ?? null;
    return {
      id: t.id,
      name: t.name,
      level: t.level,
      location: t.location,
      club: club ? { name: club.name, slug: club.slug } : null,
      players: players?.filter((p) => p.team_id === t.id).length ?? 0,
      byCode: t.join_code.toLowerCase() === s.toLowerCase(),
      mine: (mine?.some((m) => m.team_id === t.id) ? "member" : asked?.some((a) => a.team_id === t.id) ? "requested" : "none") as "member" | "requested" | "none",
    };
  });
}

/** Public club page: the club and its public teams, with headcounts and captains' first names. */
export async function getClubPage(slug: string) {
  const admin = adminClient();
  const { data: club } = await admin.from("clubs").select("*").eq("slug", slug).maybeSingle();
  if (!club) return null;
  const sb = await userClient();
  const { data: auth } = await sb.auth.getUser();
  const uid = auth.user?.id ?? null;
  const [{ data: teams }, { data: admins }, { data: sponsors }] = await Promise.all([
    admin.from("teams").select("id, name, level, sport").eq("club_id", club.id).eq("is_public", true).is("archived_at", null).order("name"),
    uid ? admin.from("club_admins").select("role").eq("club_id", club.id).eq("user_id", uid) : Promise.resolve({ data: [] as { role: string }[] }),
    admin.from("sponsors_public").select("*").eq("club_id", club.id),
  ]);
  const ids = (teams ?? []).map((t) => t.id);
  const [{ data: roster }, { data: asked }] = await Promise.all([
    ids.length ? admin.from("roster_members").select("team_id, user_id, is_player, roles, status").in("team_id", ids).eq("status", "active") : Promise.resolve({ data: [] as never[] }),
    uid && ids.length ? admin.from("join_requests").select("team_id").eq("user_id", uid).eq("status", "pending").in("team_id", ids) : Promise.resolve({ data: [] as { team_id: string }[] }),
  ]);
  const capIds = [...new Set((roster ?? []).filter((r) => (r.roles as string[]).includes("captain")).map((r) => r.user_id as string))];
  const { data: caps } = capIds.length ? await admin.from("profiles").select("id, first_name").in("id", capIds) : { data: [] as { id: string; first_name: string }[] };
  const mapped = {
    id: club.id,
    name: club.name,
    slug: club.slug,
    color: club.color,
    colorSecondary: club.color_secondary,
    logo: club.logo_path,
    blurb: club.blurb,
    joinOpen: club.join_open,
    createdBy: club.created_by,
    createdAt: club.created_at,
  };
  return {
    club: mapped,
    teams: (teams ?? []).map((t) => {
      const rows = (roster ?? []).filter((r) => r.team_id === t.id);
      return {
        id: t.id,
        name: t.name,
        level: t.level,
        sport: t.sport,
        players: rows.filter((r) => r.is_player && r.user_id).length,
        captains: rows.filter((r) => (r.roles as string[]).includes("captain")).map((r) => caps?.find((c) => c.id === r.user_id)?.first_name ?? "").filter(Boolean),
        mine: (!uid ? "signed-out" : rows.some((r) => r.user_id === uid) ? "member" : asked?.some((a) => a.team_id === t.id) ? "requested" : "none") as
          | "signed-out"
          | "member"
          | "requested"
          | "none",
      };
    }),
    sponsors: (sponsors ?? [])
      .map((s) => ({ id: s.id!, name: s.name!, tier: s.tier as SponsorTier, logo: s.logo_url, website: s.website, blurb: s.blurb, scope: "club" as const }))
      .sort((a, b) => SPONSOR_TIERS.indexOf(a.tier) - SPONSOR_TIERS.indexOf(b.tier) || a.name.localeCompare(b.name)),
    signedIn: !!uid,
    isAdmin: !!admins?.some((a) => a.role === "owner" || a.role === "admin"),
  };
}

/** Email invites: the token names the roster row and address. Read with the server key. */
export async function getInvite(token: string) {
  const data = verify<{ k: string; r: string; e: string }>(token);
  if (!data || data.k !== "invite") return null;
  const admin = adminClient();
  const { data: rm } = await admin.from("roster_members").select("*").eq("id", data.r).maybeSingle();
  if (!rm || rm.status === "removed") return null;
  const [{ data: team }, { data: prof }] = await Promise.all([
    admin.from("teams").select("id, name, color, color_secondary").eq("id", rm.team_id).single(),
    admin.from("profiles").select("id").eq("email", data.e).maybeSingle(),
  ]);
  if (!team) return null;
  const [firstName, ...rest] = (rm.invited_name ?? "").split(" ");
  return {
    email: data.e,
    team: { id: team.id, name: team.name, color: team.color, colorSecondary: team.color_secondary },
    person: { id: rm.id, firstName: firstName ?? "", lastName: rest.join(" ") },
    hats: hatLabels({ isPlayer: rm.is_player, roles: rm.roles as never, clubRole: null, isCreator: false }, rm.jersey),
    accepted: rm.status === "active",
    hasAccount: !!prof,
  };
}

/**
 * Signed in with the invited address: put me on that roster row (or keep the row I already
 * have on that team). The page sends an email link first when nobody is signed in.
 */
export async function acceptInvite(token: string): Promise<ActionResult<{ teamId: ID }>> {
  const data = verify<{ k: string; r: string; e: string }>(token);
  if (!data || data.k !== "invite") return { ok: false, error: "This invite link has expired. Ask your captain to send a new one." };
  const sb = await userClient();
  const { data: auth } = await sb.auth.getUser();
  const me = auth.user;
  if (!me) return { ok: false, error: "Sign in first." };
  if ((me.email ?? "").toLowerCase() !== data.e) return { ok: false, error: `This invite is for ${data.e}. Sign out, then open the link again.` };
  const admin = adminClient();
  const { data: rm } = await admin.from("roster_members").select("id, team_id, status, user_id").eq("id", data.r).maybeSingle();
  if (!rm || rm.status === "removed") return { ok: false, error: "This invite was cancelled by the team." };
  if (rm.status === "invited") {
    const { data: mine } = await admin.from("roster_members").select("id").eq("team_id", rm.team_id).eq("user_id", me.id).neq("status", "removed").maybeSingle();
    await admin
      .from("roster_members")
      .update(mine ? { status: "removed" } : { user_id: me.id, status: "active", joined_at: new Date().toISOString() })
      .eq("id", rm.id);
  }
  return { ok: true, data: { teamId: rm.team_id } };
}
