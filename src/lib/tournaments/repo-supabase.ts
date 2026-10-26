import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, userClient } from "../supabase/server";
import type { CalendarEvent, Repo, TeamRef } from "./repo";
import type { Award, Entry, Match, MatchEvent, OfficialRole, RosterPerson, Tournament } from "./types";

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
  status: r.status as Tournament["status"], isPublic: !!r.is_public, registrationOpen: !!r.registration_open,
  rosterMax: n(r.roster_max), rosterMin: n(r.roster_min), rosterRules: s(r.roster_rules), rosterDeadline: s(r.roster_deadline), bannerAt: s(r.banner_at), createdBy: s(r.created_by), updatedAt: s(r.updated_at)!,
});
const fromT = (t: Partial<Tournament>): Row => {
  const map: Record<string, string> = {
    clubId: "club_id", slug: "slug", name: "name", logo: "logo", format: "format", legs: "legs", groupCount: "group_count", advancePerGroup: "advance_per_group",
    startsOn: "starts_on", endsOn: "ends_on", venueName: "venue_name", venueAddress: "venue_address", venueLat: "venue_lat", venueLng: "venue_lng", rules: "rules",
    feeCents: "fee_cents", currency: "currency", payTo: "pay_to", pointsWin: "points_win", pointsDraw: "points_draw", pointsLoss: "points_loss", maxTeams: "max_teams",
    status: "status", isPublic: "is_public", registrationOpen: "registration_open", createdBy: "created_by",
    rosterMax: "roster_max", rosterMin: "roster_min", rosterRules: "roster_rules", rosterDeadline: "roster_deadline", bannerAt: "banner_at",
  };
  const out: Row = {};
  for (const [k, v] of Object.entries(t)) if (map[k]) out[map[k]] = v;
  return out;
};
const toE = (r: Row): Entry => ({
  id: s(r.id)!, tournamentId: s(r.tournament_id)!, teamId: s(r.team_id), name: s(r.name)!, status: r.status as Entry["status"], paid: !!r.paid,
  groupLabel: s(r.group_label), seed: n(r.seed), apartSet: n(r.apart_set), rosterSubmittedAt: s(r.roster_submitted_at), createdAt: s(r.created_at)!,
});
const fromE = (e: Partial<Entry>): Row => {
  const map: Record<string, string> = { tournamentId: "tournament_id", teamId: "team_id", name: "name", status: "status", paid: "paid", groupLabel: "group_label", seed: "seed", apartSet: "apart_set", rosterSubmittedAt: "roster_submitted_at" };
  const out: Row = {};
  for (const [k, v] of Object.entries(e)) if (map[k]) out[map[k]] = v;
  return out;
};
const toM = (r: Row): Match => ({
  id: s(r.id)!, tournamentId: s(r.tournament_id)!, stage: r.stage as Match["stage"], groupLabel: s(r.group_label), round: Number(r.round), slot: Number(r.slot), roundName: s(r.round_name),
  homeId: s(r.home_id), awayId: s(r.away_id), homeSource: s(r.home_source), awaySource: s(r.away_source), kickoffAt: s(r.kickoff_at), pitch: s(r.pitch),
  status: r.status as Match["status"], homeScore: n(r.home_score), awayScore: n(r.away_score), homePens: n(r.home_pens), awayPens: n(r.away_pens), winnerId: s(r.winner_id),
  motmRosterId: s(r.motm_roster_id),
});
const fromM = (m: Partial<Match>): Row => {
  const map: Record<string, string> = {
    id: "id", tournamentId: "tournament_id", stage: "stage", groupLabel: "group_label", round: "round", slot: "slot", roundName: "round_name", homeId: "home_id", awayId: "away_id",
    homeSource: "home_source", awaySource: "away_source", kickoffAt: "kickoff_at", pitch: "pitch", status: "status", homeScore: "home_score", awayScore: "away_score",
    homePens: "home_pens", awayPens: "away_pens", winnerId: "winner_id", motmRosterId: "motm_roster_id",
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
    const { data } = await (await reader()).c.from("teams").select("id, name, logo_path, club_id").in("id", ids);
    for (const r of data ?? []) m.set(s(r.id)!, { id: s(r.id)!, name: s(r.name)!, crest: s(r.logo_path), clubId: s(r.club_id) });
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
    const { c, visitor } = await reader();
    let q = c.from("tournaments").select("*").in("id", ids);
    if (visitor) q = q.eq("is_public", true).neq("status", "draft");
    const { data } = await q;
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
    // Visitors get entries only through tournamentsByIds' public filter (fan pages' honours).
    const { data } = await (await reader()).c.from("tournament_teams").select("*").in("team_id", teamIds);
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
    // No "return the new row" here: the read rule checks the tournaments table, which can't
    // see the row while it's being inserted, so Postgres would refuse. Insert, then read.
    const c = await sb();
    const id = randomUUID();
    const { error } = await c.from("tournaments").insert({ ...fromT(t), id });
    check(error, "create the tournament");
    const { data, error: e2 } = await c.from("tournaments").select("*").eq("id", id).single();
    check(e2, "open the new tournament");
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

  async isParticipant(t) {
    const { data, error } = await (await sb()).rpc("is_tournament_participant", { t: t.id });
    check(error, "check your access");
    return !!data;
  },
  async roster(tid) {
    const { data, error } = await (await sb()).from("tournament_roster").select("*").eq("tournament_id", tid).order("created_at");
    check(error, "load the rosters");
    return (data ?? []).map(toR);
  },
  async insertRosterPerson(p) {
    const { error } = await (await sb()).from("tournament_roster").insert({ tournament_id: p.tournamentId, entry_id: p.entryId, role: p.role, name: p.name, jersey: p.jersey, user_id: p.userId });
    check(error, "add them to the roster");
  },
  async updateRosterPerson(id, patch) {
    const { error } = await (await sb()).from("tournament_roster").update({ name: patch.name, jersey: patch.jersey }).eq("id", id);
    check(error, "save the change");
  },
  async deleteRosterPerson(id) {
    const { error } = await (await sb()).from("tournament_roster").delete().eq("id", id);
    check(error, "remove them");
  },
  async submitRoster(entryId) {
    const { error } = await (await sb()).rpc("submit_tournament_roster", { p_entry: entryId });
    check(error, "submit the roster");
  },
  async setCaptain(entryId, personId) {
    const c = await sb();
    // Clear the old one first: only one captain per roster.
    const off = await c.from("tournament_roster").update({ is_captain: false }).eq("entry_id", entryId).eq("is_captain", true).neq("id", personId ?? "00000000-0000-0000-0000-000000000000");
    check(off.error, "change the captain");
    if (personId) {
      const on = await c.from("tournament_roster").update({ is_captain: true }).eq("id", personId);
      check(on.error, "change the captain");
    }
  },
  // Team calendars: written with the server key, since the host can't write to other teams'
  // schedules. Only ever what the tournament's own data says (worked out in the service).
  async syncCalendar(tid, wanted) {
    const a = adminClient() as unknown as SupabaseClient;
    const { data, error } = await a.from("events").select("id, team_id, tournament_match_id, type, title, start_at, end_at, location_text, opponent, notes, status").eq("tournament_id", tid);
    check(error, "update team calendars");
    const key = (teamId: unknown, mid: unknown) => `${teamId}:${mid ?? ""}`;
    const have = new Map((data ?? []).map((r: Row) => [key(r.team_id, r.tournament_match_id), r]));
    const row = (w: CalendarEvent) => ({
      type: w.type, competition: w.type === "match" ? "cup" : null, title: w.title, start_at: w.startAt, end_at: w.endAt, tz: "America/Toronto",
      location_text: w.locationText, opponent: w.opponent, home_away: w.opponent ? "neutral" : null, notes: w.notes, status: w.status,
    });
    const keep = new Set<string>();
    for (const w of wanted) {
      const k = key(w.teamId, w.tournamentMatchId);
      keep.add(k);
      const old = have.get(k);
      const r = row(w);
      if (!old) {
        const ins = await a.from("events").insert({ ...r, team_id: w.teamId, tournament_id: tid, tournament_match_id: w.tournamentMatchId });
        if (ins.error) console.error("[tournaments] calendar insert:", ins.error.message);
      } else if (
        old.title !== r.title || Date.parse(String(old.start_at)) !== Date.parse(r.start_at) || Date.parse(String(old.end_at)) !== Date.parse(r.end_at) ||
        (old.location_text ?? null) !== r.location_text || (old.opponent ?? null) !== r.opponent || (old.notes ?? null) !== r.notes || old.status !== r.status
      ) {
        const up = await a.from("events").update(r).eq("id", String(old.id));
        if (up.error) console.error("[tournaments] calendar update:", up.error.message);
      }
    }
    const gone = [...have.entries()].filter(([k]) => !keep.has(k)).map(([, r]) => String(r.id));
    if (gone.length) {
      const del = await a.from("events").delete().in("id", gone);
      if (del.error) console.error("[tournaments] calendar delete:", del.error.message);
    }
  },
  async awards(tid) {
    const { data, error } = await (await reader()).c.from("tournament_awards").select("*").eq("tournament_id", tid).order("sort").order("created_at");
    check(error, "load the awards");
    return (data ?? []).map((r: Row) => ({ id: s(r.id)!, tournamentId: s(r.tournament_id)!, title: s(r.title)!, entryId: s(r.entry_id), rosterId: s(r.roster_id), note: s(r.note), sort: Number(r.sort ?? 0) }));
  },
  async insertAward(a) {
    const { error } = await (await sb()).from("tournament_awards").insert({ tournament_id: a.tournamentId, title: a.title, entry_id: a.entryId, roster_id: a.rosterId, note: a.note, sort: a.sort });
    check(error, "save the award");
  },
  async deleteAward(id) {
    const { error } = await (await sb()).from("tournament_awards").delete().eq("id", id);
    check(error, "remove the award");
  },
  async rosterPeople(tid, ids) {
    if (!ids.length) return [];
    // Only names and numbers of winners: the server key is fine here (visitors on the public page).
    const { data } = await (adminClient() as unknown as SupabaseClient).from("tournament_roster").select("*").eq("tournament_id", tid).in("id", ids);
    return (data ?? []).map(toR);
  },
  async honoursFor(userId) {
    const a = adminClient() as unknown as SupabaseClient;
    const { data: rows } = await a.from("tournament_roster").select("*").eq("user_id", userId).or("host_change.is.null,host_change.neq.removed");
    const roster = (rows ?? []).map(toR);
    const ids = roster.map((r) => r.id);
    if (!ids.length) return { roster, motm: [], awards: [] };
    const [m, w] = await Promise.all([a.from("tournament_matches").select("*").in("motm_roster_id", ids), a.from("tournament_awards").select("*").in("roster_id", ids)]);
    return {
      roster,
      motm: (m.data ?? []).map(toM),
      awards: (w.data ?? []).map((r: Row) => ({ id: s(r.id)!, tournamentId: s(r.tournament_id)!, title: s(r.title)!, entryId: s(r.entry_id), rosterId: s(r.roster_id), note: s(r.note), sort: Number(r.sort ?? 0) })),
    };
  },
  async banner(tid) {
    const { c } = await reader();
    const { data } = await c.from("tournament_banners").select("image").eq("tournament_id", tid).maybeSingle();
    return s(data?.image);
  },
  async setBanner(tid, image) {
    const c = await sb();
    if (image) {
      const { error } = await c.from("tournament_banners").upsert({ tournament_id: tid, image, updated_at: new Date().toISOString() });
      check(error, "save the banner");
    } else {
      const { error } = await c.from("tournament_banners").delete().eq("tournament_id", tid);
      check(error, "remove the banner");
    }
    const { error } = await c.from("tournaments").update({ banner_at: image ? new Date().toISOString() : null }).eq("id", tid);
    check(error, "save the banner");
  },
  async teamPlayers(teamId) {
    const c = await sb();
    const { data, error } = await c.from("roster_members").select("user_id, jersey, invited_name, is_player, status").eq("team_id", teamId).eq("is_player", true).eq("status", "active");
    check(error, "load your team's players");
    const ids = (data ?? []).map((r: Row) => s(r.user_id)).filter((x): x is string => !!x);
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: ps } = await c.from("profiles").select("id, first_name, last_name").in("id", ids);
      for (const p of ps ?? []) names.set(s(p.id)!, `${s(p.first_name) ?? ""} ${s(p.last_name) ?? ""}`.trim());
    }
    return (data ?? []).map((r: Row) => {
      const j = s(r.jersey)?.trim();
      return { userId: s(r.user_id), name: names.get(s(r.user_id) ?? "") || "Player", jersey: j && /^\d{1,3}$/.test(j) ? Number(j) : null };
    });
  },
};

const toR = (r: Row): RosterPerson => ({
  id: s(r.id)!, tournamentId: s(r.tournament_id)!, entryId: s(r.entry_id)!, role: r.role as RosterPerson["role"], name: s(r.name)!, jersey: n(r.jersey), userId: s(r.user_id), isCaptain: !!r.is_captain,
  hostChange: (s(r.host_change) as RosterPerson["hostChange"]) ?? null, hostChangedAt: s(r.host_changed_at), prevName: s(r.prev_name), prevJersey: n(r.prev_jersey), prevCaptain: r.prev_captain == null ? null : !!r.prev_captain, createdAt: s(r.created_at)!,
});
