import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, userClient } from "../supabase/server";
import type { Repo, TeamRef } from "./repo";
import type { Entry, Match, MatchEvent, OfficialRole, Tournament } from "./types";

/*
 * Live build: tournaments in Supabase, read and written as the signed-in person (or as a
 * visitor on the public page), so the tournament access rules decide what's allowed.
 * The service layer checks the same rules first to give friendly messages.
 */

type Row = Record<string, unknown>;
// The generated database types predate these tables, so this client is untyped.
async function sb(): Promise<SupabaseClient> {
  return (await userClient()) as unknown as SupabaseClient;
}
const s = (v: unknown) => (v == null ? null : String(v));
const n = (v: unknown) => (v == null ? null : Number(v));

const toT = (r: Row): Tournament => ({
  id: s(r.id)!, clubId: s(r.club_id)!, slug: s(r.slug)!, name: s(r.name)!, logo: s(r.logo),
  format: r.format as Tournament["format"], legs: (Number(r.legs) === 2 ? 2 : 1), groupCount: Number(r.group_count), advancePerGroup: Number(r.advance_per_group),
  startsOn: s(r.starts_on)!, endsOn: s(r.ends_on)!, venueName: s(r.venue_name), venueAddress: s(r.venue_address), venueLat: n(r.venue_lat), venueLng: n(r.venue_lng),
  rules: s(r.rules), feeCents: Number(r.fee_cents ?? 0), currency: s(r.currency) ?? "CAD", payTo: s(r.pay_to),
  pointsWin: Number(r.points_win), pointsDraw: Number(r.points_draw), pointsLoss: Number(r.points_loss), maxTeams: n(r.max_teams),
  status: r.status as Tournament["status"], isPublic: !!r.is_public, registrationOpen: !!r.registration_open, createdBy: s(r.created_by), updatedAt: s(r.updated_at)!,
});
const fromT = (t: Partial<Tournament>): Row => {
  const map: Record<string, string> = {
    clubId: "club_id", slug: "slug", name: "name", logo: "logo", format: "format", legs: "legs", groupCount: "group_count", advancePerGroup: "advance_per_group",
    startsOn: "starts_on", endsOn: "ends_on", venueName: "venue_name", venueAddress: "venue_address", venueLat: "venue_lat", venueLng: "venue_lng", rules: "rules",
    feeCents: "fee_cents", currency: "currency", payTo: "pay_to", pointsWin: "points_win", pointsDraw: "points_draw", pointsLoss: "points_loss", maxTeams: "max_teams",
    status: "status", isPublic: "is_public", registrationOpen: "registration_open", createdBy: "created_by",
  };
  const out: Row = {};
  for (const [k, v] of Object.entries(t)) if (map[k]) out[map[k]] = v;
  return out;
};
const toE = (r: Row): Entry => ({
  id: s(r.id)!, tournamentId: s(r.tournament_id)!, teamId: s(r.team_id), name: s(r.name)!, status: r.status as Entry["status"], paid: !!r.paid,
  groupLabel: s(r.group_label), seed: n(r.seed), createdAt: s(r.created_at)!,
});
const fromE = (e: Partial<Entry>): Row => {
  const map: Record<string, string> = { tournamentId: "tournament_id", teamId: "team_id", name: "name", status: "status", paid: "paid", groupLabel: "group_label", seed: "seed" };
  const out: Row = {};
  for (const [k, v] of Object.entries(e)) if (map[k]) out[map[k]] = v;
  return out;
};
const toM = (r: Row): Match => ({
  id: s(r.id)!, tournamentId: s(r.tournament_id)!, stage: r.stage as Match["stage"], groupLabel: s(r.group_label), round: Number(r.round), slot: Number(r.slot), roundName: s(r.round_name),
  homeId: s(r.home_id), awayId: s(r.away_id), homeSource: s(r.home_source), awaySource: s(r.away_source), kickoffAt: s(r.kickoff_at), pitch: s(r.pitch),
  status: r.status as Match["status"], homeScore: n(r.home_score), awayScore: n(r.away_score), homePens: n(r.home_pens), awayPens: n(r.away_pens), winnerId: s(r.winner_id),
});
const fromM = (m: Partial<Match>): Row => {
  const map: Record<string, string> = {
    id: "id", tournamentId: "tournament_id", stage: "stage", groupLabel: "group_label", round: "round", slot: "slot", roundName: "round_name", homeId: "home_id", awayId: "away_id",
    homeSource: "home_source", awaySource: "away_source", kickoffAt: "kickoff_at", pitch: "pitch", status: "status", homeScore: "home_score", awayScore: "away_score",
    homePens: "home_pens", awayPens: "away_pens", winnerId: "winner_id",
  };
  const out: Row = {};
  for (const [k, v] of Object.entries(m)) if (map[k]) out[map[k]] = v;
  return out;
};
function check(error: { message: string } | null, what: string) {
  if (error) {
    console.error(`[tournaments] ${what}:`, error.message);
    throw new Error(/permission|policy|privilege/i.test(error.message) ? "You don't have permission to do that." : error.message.includes("only") || error.message.includes("isn't") ? error.message : `Couldn't ${what}. Try again.`);
  }
}

/*
 * Visitors (no account) on the public page: the database gives the anonymous role no
 * table access at all, so their reads go through the server's own key, limited here to
 * tournaments that are public and past draft. Writes always use the person's own client.
 */
async function reader(): Promise<{ c: SupabaseClient; visitor: boolean }> {
  const me = await uid();
  return me ? { c: await sb(), visitor: false } : { c: adminClient() as unknown as SupabaseClient, visitor: true };
}

async function uid() {
  const c = await sb();
  const { data } = await c.auth.getUser();
  return data.user?.id ?? null;
}

export const supabaseRepo: Repo = {
  uid,
  async myName() {
    const c = await sb();
    const id = await uid();
    if (!id) return "";
    const { data } = await c.from("profiles").select("first_name, last_name").eq("id", id).maybeSingle();
    return data ? `${data.first_name} ${data.last_name}` : "";
  },
  async clubsIRun() {
    const c = await sb();
    const id = await uid();
    if (!id) return [];
    const { data } = await c.from("club_admins").select("club_id, role, clubs(name)").eq("user_id", id).in("role", ["owner", "admin"]);
    return (data ?? []).map((r: Row) => ({ id: s(r.club_id)!, name: s((r.clubs as Row | null)?.name) ?? "Club" }));
  },
  async teamsIRun() {
    const c = await sb();
    const id = await uid();
    if (!id) return [];
    const [{ data: rows }, { data: created }] = await Promise.all([
      c.from("roster_members").select("team_id, permissions").eq("user_id", id).eq("status", "active"),
      c.from("teams").select("id").eq("created_by", id),
    ]);
    const ids = [...new Set([...(rows ?? []).filter((r: Row) => (r.permissions as string[] | null)?.length).map((r: Row) => s(r.team_id)!), ...(created ?? []).map((r: Row) => s(r.id)!)])];
    return [...(await this.teamRefs(ids)).values()];
  },
  async clubName(clubId) {
    const { data } = await (await sb()).from("clubs").select("name").eq("id", clubId).maybeSingle();
    if (data) return data.name as string;
    // Visitors can't read private clubs; the name of a host club isn't a secret.
    const { data: d2 } = await (adminClient() as unknown as SupabaseClient).from("clubs").select("name").eq("id", clubId).maybeSingle();
    return (d2?.name as string) ?? null;
  },
  async teamRefs(ids) {
    const m = new Map<string, TeamRef>();
    if (!ids.length) return m;
    const { data } = await (await reader()).c.from("teams").select("id, name, logo_path").in("id", ids);
    for (const r of data ?? []) m.set(s(r.id)!, { id: s(r.id)!, name: s(r.name)!, crest: s(r.logo_path) });
    return m;
  },
  async tournament(key) {
    const { c, visitor } = await reader();
    const isUuid = /^[0-9a-f-]{36}$/i.test(key);
    let q = c.from("tournaments").select("*").eq(isUuid ? "id" : "slug", key);
    if (visitor) q = q.eq("is_public", true).neq("status", "draft");
    const { data } = await q.maybeSingle();
    return data ? toT(data) : null;
  },
  async myTournamentIds() {
    const c = await sb();
    const id = await uid();
    if (!id) return [];
    const teams = (await this.teamsIRun()).map((t) => t.id);
    const { data: member } = await c.from("roster_members").select("team_id").eq("user_id", id).neq("status", "removed");
    const teamIds = [...new Set([...teams, ...(member ?? []).map((r: Row) => s(r.team_id)!)])];
    const [{ data: off }, { data: ent }, clubs] = await Promise.all([
      c.from("tournament_officials").select("tournament_id").eq("user_id", id),
      teamIds.length ? c.from("tournament_teams").select("tournament_id").in("team_id", teamIds) : Promise.resolve({ data: [] as Row[] }),
      this.clubsIRun(),
    ]);
    const { data: hosted } = clubs.length ? await c.from("tournaments").select("id").in("club_id", clubs.map((x) => x.id)) : { data: [] as Row[] };
    return [...new Set([...(off ?? []), ...(ent ?? [])].map((r: Row) => s(r.tournament_id)!).concat((hosted ?? []).map((r: Row) => s(r.id)!)))];
  },
  async tournamentsByIds(ids) {
    if (!ids.length) return [];
    const { data } = await (await sb()).from("tournaments").select("*").in("id", ids);
    return (data ?? []).map(toT);
  },
  async isOrganizer(t) {
    const { data } = await (await sb()).rpc("is_tournament_organizer", { t: t.id });
    return !!data;
  },
  async isOfficial(t) {
    const { data } = await (await sb()).rpc("is_tournament_official", { t: t.id });
    return !!data;
  },
  async entries(tid) {
    const { data } = await (await reader()).c.from("tournament_teams").select("*").eq("tournament_id", tid).order("created_at");
    return (data ?? []).map(toE);
  },
  async entriesForTeams(teamIds) {
    if (!teamIds.length) return [];
    const { data } = await (await sb()).from("tournament_teams").select("*").in("team_id", teamIds);
    return (data ?? []).map(toE);
  },
  async matches(tid) {
    const { data } = await (await reader()).c.from("tournament_matches").select("*").eq("tournament_id", tid).order("round").order("slot");
    return (data ?? []).map(toM);
  },
  async events(tid) {
    const { data } = await (await reader()).c.from("tournament_match_events").select("*, tournament_matches!inner(tournament_id)").eq("tournament_matches.tournament_id", tid).order("minute");
    return (data ?? []).map((r: Row) => ({ id: s(r.id)!, matchId: s(r.match_id)!, entryId: s(r.entry_id)!, kind: r.kind as MatchEvent["kind"], minute: n(r.minute), player: s(r.player) }));
  },
  async officials(tid) {
    const { data } = await (await sb()).from("tournament_officials").select("user_id, role").eq("tournament_id", tid);
    if (!data?.length) return [];
    const { data: people } = await (adminClient() as unknown as SupabaseClient).from("profiles").select("id, first_name, last_name").in("id", data.map((r: Row) => s(r.user_id)!));
    return data.map((r: Row) => {
      const p = people?.find((x: Row) => x.id === r.user_id);
      return { userId: s(r.user_id)!, role: r.role as OfficialRole, name: p ? `${p.first_name} ${p.last_name}` : "Someone" };
    });
  },
  async contacts(tid) {
    const c = await sb();
    const { data } = await c.from("tournament_team_contacts").select("entry_id, email, tournament_teams!inner(tournament_id)").eq("tournament_teams.tournament_id", tid);
    return Object.fromEntries((data ?? []).map((r: Row) => [s(r.entry_id)!, s(r.email)!]));
  },
  async insertTournament(t) {
    const { data, error } = await (await sb()).from("tournaments").insert(fromT(t)).select("*").single();
    check(error, "create the tournament");
    return toT(data!);
  },
  async updateTournament(id, patch) {
    const { error } = await (await sb()).from("tournaments").update(fromT(patch)).eq("id", id);
    check(error, "save the tournament");
  },
  async deleteTournament(id) {
    const { error } = await (await sb()).from("tournaments").delete().eq("id", id);
    check(error, "delete the tournament");
  },
  async insertEntry(e, email) {
    const c = await sb();
    const { data, error } = await c.from("tournament_teams").insert({ ...fromE(e), created_by: await uid() }).select("*").single();
    check(error, "add the team");
    if (email) await c.from("tournament_team_contacts").insert({ entry_id: data!.id, email });
    return toE(data!);
  },
  async updateEntry(id, patch) {
    const { error } = await (await sb()).from("tournament_teams").update(fromE(patch)).eq("id", id);
    check(error, "update the team");
  },
  async deleteEntry(id) {
    const { error } = await (await sb()).from("tournament_teams").delete().eq("id", id);
    check(error, "remove the team");
  },
  async replaceMatches(tid, matches) {
    const c = await sb();
    const del = await c.from("tournament_matches").delete().eq("tournament_id", tid);
    check(del.error, "clear the old fixtures");
    if (!matches.length) return;
    // Insert round by round so "winner of" links always point at a match that exists.
    const { error } = await c.from("tournament_matches").insert(matches.map(fromM));
    check(error, "save the fixtures");
  },
  async updateMatches(list) {
    const c = await sb();
    const me = await uid();
    for (const m of list) {
      const { id, ...rest } = m;
      const { error } = await c.from("tournament_matches").update({ ...fromM(rest), updated_by: me }).eq("id", id);
      check(error, "save the match");
    }
  },
  async insertEvent(e) {
    const { error } = await (await sb()).from("tournament_match_events").insert({ match_id: e.matchId, entry_id: e.entryId, kind: e.kind, minute: e.minute, player: e.player, created_by: await uid() });
    check(error, "add that");
  },
  async deleteEvent(id) {
    const { error } = await (await sb()).from("tournament_match_events").delete().eq("id", id);
    check(error, "remove that");
  },
  async userIdByEmail(email) {
    // Looking someone up by email needs the service key; the caller is already an organizer.
    const { data } = await (adminClient() as unknown as SupabaseClient).from("profiles").select("id").eq("email", email.trim().toLowerCase()).maybeSingle();
    return (data?.id as string) ?? null;
  },
  async addOfficial(tid, userId, role) {
    const { error } = await (await sb()).from("tournament_officials").upsert({ tournament_id: tid, user_id: userId, role });
    check(error, "add them");
  },
  async removeOfficial(tid, userId) {
    const { error } = await (await sb()).from("tournament_officials").delete().eq("tournament_id", tid).eq("user_id", userId);
    check(error, "remove them");
  },
  async respondInvite(entryId, accept) {
    const { error } = await (await sb()).rpc("respond_tournament_invite", { p_entry: entryId, p_accept: accept });
    check(error, "answer the invitation");
  },
  async apply(tid, teamId) {
    const { error } = await (await sb()).rpc("apply_to_tournament", { p_tournament: tid, p_team: teamId });
    check(error, "send your entry");
  },
  async withdraw(entryId) {
    const { error } = await (await sb()).rpc("withdraw_from_tournament", { p_entry: entryId });
    check(error, "withdraw");
  },
};
