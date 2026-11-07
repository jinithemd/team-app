import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIVE } from "./mode";
import { crestUrl } from "./images";
import { teamHonours, type Honour } from "./tournaments/service";
import type { PublicSponsor, SponsorTier } from "./data/types";

/*
 * Fans: a public team's fan page (/f/<teamId>) and following it. Fans see games, results,
 * sponsors and trophies, never people: no rosters, chat, attendance or contact details.
 * Shown when the team is public; its own members can always open it.
 * Sample build: the in-memory store. Live: Supabase, with public reads through the server
 * key (visitors have no database access of their own) limited to public teams.
 */

export interface FanGame {
  id: string;
  startAt: string;
  title: string | null;
  opponent: string | null;
  homeAway: "home" | "away" | "neutral" | null;
  type: "match" | "tournament";
  locationText: string | null;
  status: "active" | "postponed" | "cancelled";
  score: { us: number; them: number; final: boolean } | null;
  tournamentId: string | null;
}

export interface FanTeam {
  id: string;
  name: string;
  color: string;
  colorSecondary: string | null;
  crest: string | null;
  crestUrl: string | null;
  level: string | null;
  location: string | null;
  clubName: string | null;
  isPublic: boolean;
}

export interface FanPage {
  team: FanTeam;
  upcoming: FanGame[];
  results: FanGame[];
  sponsors: PublicSponsor[];
  honours: Honour[];
  followers: number;
  following: boolean;
  signedIn: boolean;
  isMember: boolean;
}

// ---------------------------------------------------------------------------
// sample build
// ---------------------------------------------------------------------------

const memFollows = ((globalThis as unknown as { __clbxFollows?: Map<string, Set<string>> }).__clbxFollows ??= new Map<string, Set<string>>());

async function memPage(teamId: string): Promise<FanPage | null> {
  const { db, currentUserId, isTeamMember } = await import("./data/store");
  const { teamSponsors } = await import("./data/sponsors");
  const t = db.teams.find((x) => x.id === teamId);
  if (!t) return null;
  const uid = await currentUserId();
  const isMember = !!uid && isTeamMember(uid, t.id);
  if (!t.isPublic && !isMember) return null;
  const now = Date.now();
  const games: FanGame[] = db.events
    .filter((e) => e.teamId === t.id && (e.type === "match" || e.type === "tournament"))
    .map((e) => {
      const sc = db.scores.find((x) => x.eventId === e.id);
      return {
        id: e.id,
        startAt: e.startAt,
        title: e.title,
        opponent: e.opponent,
        homeAway: e.homeAway,
        type: e.type as "match" | "tournament",
        locationText: e.locationText ?? (e.venueId ? db.venues.find((v) => v.id === e.venueId)?.name ?? null : null),
        status: e.status,
        score: sc && sc.status !== "not_started" ? { us: sc.us, them: sc.them, final: sc.status === "final" } : null,
        tournamentId: e.tournamentId ?? null,
      };
    });
  let followers = 0;
  for (const set of memFollows.values()) if (set.has(t.id)) followers++;
  return {
    team: {
      id: t.id, name: t.name, color: t.color, colorSecondary: t.colorSecondary, crest: t.settings.crest, crestUrl: crestUrl(t.id, t.settings.crest),
      level: t.level, location: t.location, clubName: t.clubId ? db.clubs.find((c) => c.id === t.clubId)?.name ?? null : null, isPublic: t.isPublic,
    },
    upcoming: games.filter((g) => Date.parse(g.startAt) >= now - 3 * 3_600_000).sort((a, b) => a.startAt.localeCompare(b.startAt)).slice(0, 6),
    results: games.filter((g) => Date.parse(g.startAt) < now - 3 * 3_600_000 && g.type === "match").sort((a, b) => b.startAt.localeCompare(a.startAt)).slice(0, 6),
    sponsors: teamSponsors(t.id),
    honours: await teamHonours(t.id),
    followers,
    following: !!uid && !!memFollows.get(uid)?.has(t.id),
    signedIn: !!uid,
    isMember,
  };
}

// ---------------------------------------------------------------------------
// live build
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? null : String(v));

async function clients() {
  const { adminClient, userClient } = await import("./supabase/server");
  const user = (await userClient()) as unknown as SupabaseClient;
  const data = { user: await (await import("./supabase/server")).authUser() };
  return { admin: adminClient() as unknown as SupabaseClient, user, uid: data.user?.id ?? null };
}

async function livePage(teamId: string): Promise<FanPage | null> {
  if (!/^[0-9a-f-]{36}$/i.test(teamId)) return null;
  const { admin, user, uid } = await clients();
  const { data: t } = await admin.from("teams").select("id, name, color, color_secondary, logo_path, level, location, club_id, is_public, archived_at").eq("id", teamId).maybeSingle();
  if (!t || t.archived_at) return null;
  let isMember = false;
  if (uid) {
    const { data: m } = await user.rpc("is_team_member", { t: teamId });
    isMember = !!m;
  }
  if (!t.is_public && !isMember) return null;

  const since = new Date(Date.now() - 3 * 3_600_000).toISOString();
  const cols = "id, start_at, title, opponent, home_away, type, location_text, venue_id, status, tournament_id";
  const [up, past, club, spons, fol, mine] = await Promise.all([
    admin.from("events").select(cols).eq("team_id", teamId).in("type", ["match", "tournament"]).gte("start_at", since).order("start_at").limit(6),
    admin.from("events").select(cols).eq("team_id", teamId).eq("type", "match").lt("start_at", since).order("start_at", { ascending: false }).limit(6),
    t.club_id ? admin.from("clubs").select("name").eq("id", t.club_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("sponsors_public").select("*").or(t.club_id ? `team_id.eq.${teamId},club_id.eq.${t.club_id}` : `team_id.eq.${teamId}`),
    admin.from("follows").select("user_id", { count: "exact", head: true }).eq("team_id", teamId),
    uid ? user.from("follows").select("team_id").eq("team_id", teamId).eq("user_id", uid).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const events = [...(up.data ?? []), ...(past.data ?? [])] as Row[];
  const ids = events.map((e) => String(e.id));
  const venueIds = [...new Set(events.map((e) => s(e.venue_id)).filter((x): x is string => !!x))];
  const [scores, venues] = await Promise.all([
    ids.length ? admin.from("scores").select("event_id, team_score, opponent_score, status").in("event_id", ids) : Promise.resolve({ data: [] as Row[] }),
    venueIds.length ? admin.from("venues").select("id, name").in("id", venueIds) : Promise.resolve({ data: [] as Row[] }),
  ]);
  const game = (e: Row): FanGame => {
    const sc = (scores.data ?? []).find((x: Row) => x.event_id === e.id) as Row | undefined;
    return {
      id: String(e.id),
      startAt: new Date(String(e.start_at)).toISOString(),
      title: s(e.title),
      opponent: s(e.opponent),
      homeAway: (e.home_away as FanGame["homeAway"]) ?? null,
      type: e.type as FanGame["type"],
      locationText: s(e.location_text) ?? (s((venues.data ?? []).find((v: Row) => v.id === e.venue_id)?.name) || null),
      status: e.status as FanGame["status"],
      score: sc && sc.status !== "not_started" ? { us: Number(sc.team_score), them: Number(sc.opponent_score), final: sc.status === "final" } : null,
      tournamentId: s(e.tournament_id),
    };
  };
  const rank = (x: string | null) => (x ? ["diamond", "platinum", "gold", "silver", "bronze"].indexOf(x) : 9);
  return {
    team: {
      id: String(t.id), name: String(t.name), color: s(t.color) ?? "#1D4ED8", colorSecondary: s(t.color_secondary), crest: s(t.logo_path),
      crestUrl: crestUrl(String(t.id), s(t.logo_path)), level: s(t.level), location: s(t.location), clubName: s((club.data as Row | null)?.name), isPublic: !!t.is_public,
    },
    upcoming: (up.data ?? []).map(game),
    results: (past.data ?? []).map(game),
    sponsors: ((spons.data ?? []) as Row[])
      .map((r) => ({ id: String(r.id), name: String(r.name), tier: (s(r.tier) as SponsorTier | null) ?? null, logo: s(r.logo_url), website: s(r.website), blurb: s(r.blurb), scope: r.team_id ? ("team" as const) : ("club" as const) }))
      .sort((a, b) => rank(a.tier) - rank(b.tier) || a.name.localeCompare(b.name)),
    honours: await teamHonours(String(t.id)),
    followers: fol.count ?? 0,
    following: !!mine.data,
    signedIn: !!uid,
    isMember,
  };
}

// ---------------------------------------------------------------------------

export async function getFanPage(teamId: string): Promise<FanPage | null> {
  return LIVE ? livePage(teamId) : memPage(teamId);
}

/** Follow or unfollow a public team. */
export async function setFollow(teamId: string, on: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const page = await getFanPage(teamId);
  if (!page) return { ok: false, error: "That team's page isn't public." };
  if (!page.signedIn) return { ok: false, error: "Sign in to follow teams." };
  if (!LIVE) {
    const { currentUserId } = await import("./data/store");
    const uid = (await currentUserId())!;
    const set = memFollows.get(uid) ?? new Set<string>();
    if (on) set.add(teamId);
    else set.delete(teamId);
    memFollows.set(uid, set);
    return { ok: true };
  }
  const { user, uid } = await clients();
  const res = on ? await user.from("follows").upsert({ user_id: uid, team_id: teamId }) : await user.from("follows").delete().eq("user_id", uid!).eq("team_id", teamId);
  if (res.error) {
    console.error("[fans] follow:", res.error.message);
    return { ok: false, error: "Couldn't update that. Try again." };
  }
  return { ok: true };
}

/** Teams I follow (and aren't a member of), for the Teams page. */
export async function followedTeams(): Promise<{ id: string; name: string; crestUrl: string | null; color: string }[]> {
  if (!LIVE) {
    const { db, currentUserId, isTeamMember } = await import("./data/store");
    const uid = await currentUserId();
    if (!uid) return [];
    return [...(memFollows.get(uid) ?? [])]
      .map((id) => db.teams.find((t) => t.id === id))
      .filter((t): t is NonNullable<typeof t> => !!t && !isTeamMember(uid, t.id))
      .map((t) => ({ id: t.id, name: t.name, crestUrl: crestUrl(t.id, t.settings.crest), color: t.color }));
  }
  const { user, admin, uid } = await clients();
  if (!uid) return [];
  const { data } = await user.from("follows").select("team_id").eq("user_id", uid);
  const ids = (data ?? []).map((r: Row) => String(r.team_id));
  if (!ids.length) return [];
  const { data: ts } = await admin.from("teams").select("id, name, logo_path, color, is_public").in("id", ids).eq("is_public", true);
  return (ts ?? []).map((t: Row) => ({ id: String(t.id), name: String(t.name), crestUrl: crestUrl(String(t.id), s(t.logo_path)), color: s(t.color) ?? "#1D4ED8" }));
}

export const fanPageUrl = (appUrl: string, teamId: string) => `${appUrl.replace(/\/$/, "")}/f/${teamId}`;

// ---------------------------------------------------------------------------
// following like a social app: who I follow, teams to follow, my feed
// ---------------------------------------------------------------------------

export type TeamCard = { id: string; name: string; crestUrl: string | null; color: string; level: string | null; location: string | null; followers: number };

/** For a list of teams: which ones I follow, and how many followers each has. */
export async function followState(teamIds: string[]): Promise<{ mine: Set<string>; counts: Map<string, number> }> {
  const counts = new Map<string, number>();
  if (!teamIds.length) return { mine: new Set(), counts };
  if (!LIVE) {
    const { currentUserId } = await import("./data/store");
    const uid = await currentUserId();
    for (const set of memFollows.values()) for (const id of set) if (teamIds.includes(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
    return { mine: new Set(uid ? [...(memFollows.get(uid) ?? [])] : []), counts };
  }
  const { admin, uid } = await clients();
  const { data } = await admin.from("follows").select("team_id, user_id").in("team_id", teamIds);
  const mine = new Set<string>();
  for (const r of (data ?? []) as Row[]) {
    counts.set(String(r.team_id), (counts.get(String(r.team_id)) ?? 0) + 1);
    if (uid && r.user_id === uid) mine.add(String(r.team_id));
  }
  return { mine, counts };
}

/** Public teams worth following, most-followed first (for Find a team before you search). */
export async function teamsToFollow(limit = 12): Promise<TeamCard[]> {
  let teams: Omit<TeamCard, "followers">[];
  if (!LIVE) {
    const { db } = await import("./data/store");
    teams = db.teams.filter((t) => t.isPublic).map((t) => ({ id: t.id, name: t.name, crestUrl: crestUrl(t.id, t.settings.crest), color: t.color, level: t.level, location: t.location }));
  } else {
    const { admin } = await clients();
    const { data } = await admin.from("teams").select("id, name, logo_path, color, level, location").eq("is_public", true).is("archived_at", null).order("created_at", { ascending: false }).limit(60);
    teams = ((data ?? []) as Row[]).map((t) => ({ id: String(t.id), name: String(t.name), crestUrl: crestUrl(String(t.id), s(t.logo_path)), color: s(t.color) ?? "#1D4ED8", level: s(t.level), location: s(t.location) }));
  }
  const { counts } = await followState(teams.map((t) => t.id));
  return teams
    .map((t) => ({ ...t, followers: counts.get(t.id) ?? 0 }))
    .sort((a, b) => b.followers - a.followers || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export type FeedItem = { team: FanTeam; game: FanGame; kind: "result" | "live" | "next" };

/** Home: the latest results, live scores and next games of the teams I follow. */
export async function followingFeed(): Promise<FeedItem[]> {
  const teams = (await followedTeams()).slice(0, 12);
  const pages = (await Promise.all(teams.map((t) => getFanPage(t.id).catch(() => null)))).filter((p): p is FanPage => !!p);
  const now = Date.now();
  const items: FeedItem[] = [];
  for (const p of pages) {
    for (const g of p.results) if (g.score && now - Date.parse(g.startAt) < 21 * 86_400_000) items.push({ team: p.team, game: g, kind: g.score.final ? "result" : "live" });
    for (const g of p.upcoming) {
      if (g.score && !g.score.final) items.push({ team: p.team, game: g, kind: "live" });
      else if (!g.score && g.status === "active" && Date.parse(g.startAt) - now < 14 * 86_400_000) {
        items.push({ team: p.team, game: g, kind: "next" });
        break; // just their next one
      }
    }
  }
  const order = { live: 0, result: 1, next: 2 };
  return items
    .sort((a, b) => order[a.kind] - order[b.kind] || (a.kind === "next" ? a.game.startAt.localeCompare(b.game.startAt) : b.game.startAt.localeCompare(a.game.startAt)))
    .slice(0, 10);
}
