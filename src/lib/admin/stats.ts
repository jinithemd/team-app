import "server-only";
import { LIVE } from "../mode";

/*
 * The owner dashboard (/admin): how Clbx is doing across every team. Only the people listed in
 * CLBX_ADMIN_EMAILS (comma-separated, set in Vercel) can open it. Read-only.
 */

export interface AdminStats {
  totals: {
    accounts: number;
    active7: number;
    teams: number;
    clubs: number;
    players: number;
    events: number;
    upcoming7: number;
    rsvps30: number;
    chat30: number;
    tournaments: number;
    auctions: number;
    dropIns: number;
    followers: number;
    sponsors: number;
    pushPhones: number;
  };
  email: { sent: number; waiting: number; failed: number; lastError: string | null };
  money: { payments: number; totalCents: number; feeCents: number };
  weeks: { start: string; signups: number; events: number; rsvps: number }[];
  people: { name: string; email: string; joined: string | null; lastSignIn: string | null; teams: number }[];
  teams: { id: string; name: string; club: string | null; members: number; events: number; nextEvent: string | null; created: string | null; archived: boolean }[];
  generatedAt: string;
}

export async function isOwner(email: string | null | undefined, id?: string): Promise<boolean> {
  const list = (process.env.CLBX_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (email && list.includes(email.toLowerCase())) return true;
  // The sample build (tests, demos) lets the sample club owner in.
  return !LIVE && list.length === 0 && id === "u-dan";
}

const DAY = 86_400_000;
const WEEKS = 12;

/** Monday 00:00 (UTC) of the week a date falls in. */
function weekStart(t: number) {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
}

function buckets(now: number, series: { signups: (string | null)[]; events: (string | null)[]; rsvps: (string | null)[] }) {
  const first = weekStart(now) - (WEEKS - 1) * 7 * DAY;
  const weeks = Array.from({ length: WEEKS }, (_, i) => ({ start: new Date(first + i * 7 * DAY).toISOString(), signups: 0, events: 0, rsvps: 0 }));
  for (const key of ["signups", "events", "rsvps"] as const)
    for (const at of series[key]) {
      if (!at) continue;
      const i = Math.floor((weekStart(Date.parse(at)) - first) / (7 * DAY));
      if (i >= 0 && i < WEEKS) weeks[i][key]++;
    }
  return weeks;
}

export async function adminStats(): Promise<AdminStats> {
  return LIVE ? liveStats() : sampleStats();
}

// ---------------------------------------------------------------------------

async function liveStats(): Promise<AdminStats> {
  const { adminClient } = await import("../supabase/server");
  const sb = adminClient();
  const now = Date.now();
  const since = (days: number) => new Date(now - days * DAY).toISOString();
  const count = async (table: string, f?: (q: ReturnType<typeof head>) => ReturnType<typeof head>) => {
    const q = head(table);
    const { count: n } = await (f ? f(q) : q);
    return n ?? 0;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const head = (table: string) => (sb.from(table as any) as any).select("*", { count: "exact", head: true });
  type R = Record<string, unknown>;
  const rows = async (table: string, cols: string, f?: (q: ReturnType<typeof head>) => ReturnType<typeof head>): Promise<R[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb.from(table as any) as any).select(cols).limit(10000);
    if (f) q = f(q);
    const { data } = await q;
    return (data ?? []) as R[];
  };

  const [users, profiles, teams, clubs, roster, events, rsvps] = await Promise.all([
    sb.auth.admin.listUsers({ perPage: 1000 }).then((r) => r.data?.users ?? []),
    rows("profiles", "id, first_name, last_name, email, created_at"),
    rows("teams", "id, name, club_id, created_at, archived_at"),
    rows("clubs", "id, name"),
    rows("roster_members", "team_id, user_id, status, is_player", (q) => q.eq("status", "active")),
    rows("events", "team_id, start_at, created_at, status"),
    rows("rsvps", "created_at", (q) => q.gte("created_at", since(WEEKS * 7 + 7))),
  ]);
  const [rsvps30, chat30, tournaments, auctions, dropIns, followers, sponsors, pushPhones, sent, waiting, failed] = await Promise.all([
    count("rsvps", (q) => q.gte("updated_at", since(30))),
    count("chat_messages", (q) => q.gte("created_at", since(30))),
    count("tournaments"),
    count("auctions"),
    count("game_sessions"),
    count("follows"),
    count("sponsors", (q) => q.eq("status", "active")),
    count("push_devices"),
    count("outbox", (q) => q.eq("status", "sent")),
    count("outbox", (q) => q.eq("status", "pending")),
    count("outbox", (q) => q.eq("status", "failed")),
  ]);
  const lastFail = await rows("outbox", "last_error", (q) => q.eq("status", "failed").order("updated_at", { ascending: false }).limit(1));
  const paid = await rows("online_payments", "total_cents, fee_cents", (q) => q.eq("status", "paid"));

  const signIn = new Map(users.map((u) => [u.id, u.last_sign_in_at ?? null]));
  const clubName = new Map(clubs.map((c) => [String(c.id), String(c.name)]));
  const teamsOf = new Map<string, number>();
  const membersOf = new Map<string, number>();
  for (const r of roster) {
    if (r.user_id) teamsOf.set(String(r.user_id), (teamsOf.get(String(r.user_id)) ?? 0) + 1);
    membersOf.set(String(r.team_id), (membersOf.get(String(r.team_id)) ?? 0) + 1);
  }
  const live = events.filter((e) => e.status !== "cancelled");
  const eventsOf = new Map<string, number>();
  const nextOf = new Map<string, string>();
  for (const e of live) {
    const t = String(e.team_id);
    eventsOf.set(t, (eventsOf.get(t) ?? 0) + 1);
    const at = String(e.start_at);
    if (Date.parse(at) >= now && (!nextOf.has(t) || at < nextOf.get(t)!)) nextOf.set(t, at);
  }

  return {
    totals: {
      accounts: users.length,
      active7: users.filter((u) => u.last_sign_in_at && Date.parse(u.last_sign_in_at) > now - 7 * DAY).length,
      teams: teams.filter((t) => !t.archived_at).length,
      clubs: clubs.length,
      players: roster.filter((r) => r.is_player).length,
      events: live.length,
      upcoming7: live.filter((e) => {
        const t = Date.parse(String(e.start_at));
        return t >= now && t < now + 7 * DAY;
      }).length,
      rsvps30,
      chat30,
      tournaments,
      auctions,
      dropIns,
      followers,
      sponsors,
      pushPhones,
    },
    email: { sent, waiting, failed, lastError: lastFail[0]?.last_error ? String(lastFail[0].last_error).slice(0, 200) : null },
    money: {
      payments: paid.length,
      totalCents: paid.reduce((s, p) => s + Number(p.total_cents ?? 0), 0),
      feeCents: paid.reduce((s, p) => s + Number(p.fee_cents ?? 0), 0),
    },
    weeks: buckets(now, {
      signups: users.map((u) => u.created_at ?? null),
      events: events.map((e) => (e.created_at ? String(e.created_at) : null)),
      rsvps: rsvps.map((r) => (r.created_at ? String(r.created_at) : null)),
    }),
    people: profiles
      .map((p) => ({
        name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "(no name)",
        email: String(p.email ?? ""),
        joined: p.created_at ? String(p.created_at) : null,
        lastSignIn: signIn.get(String(p.id)) ?? null,
        teams: teamsOf.get(String(p.id)) ?? 0,
      }))
      .sort((a, b) => (b.joined ?? "").localeCompare(a.joined ?? ""))
      .slice(0, 50),
    teams: teams
      .map((t) => ({
        id: String(t.id),
        name: String(t.name),
        club: t.club_id ? clubName.get(String(t.club_id)) ?? null : null,
        members: membersOf.get(String(t.id)) ?? 0,
        events: eventsOf.get(String(t.id)) ?? 0,
        nextEvent: nextOf.get(String(t.id)) ?? null,
        created: t.created_at ? String(t.created_at) : null,
        archived: !!t.archived_at,
      }))
      .sort((a, b) => (b.created ?? "").localeCompare(a.created ?? "")),
    generatedAt: new Date(now).toISOString(),
  };
}

// ---------------------------------------------------------------------------

async function sampleStats(): Promise<AdminStats> {
  const { db } = await import("../data/store");
  const now = Date.now();
  const active = db.roster.filter((r) => r.status === "active");
  const live = db.events.filter((e) => e.status !== "cancelled");
  const g = globalThis as unknown as { __clbxAuctions?: { auctions: unknown[] }; __clbxSessions?: { sessions: unknown[] } };
  return {
    totals: {
      accounts: db.profiles.length,
      active7: db.profiles.length,
      teams: db.teams.length,
      clubs: db.clubs.length,
      players: active.filter((r) => r.isPlayer).length,
      events: live.length,
      upcoming7: live.filter((e) => Date.parse(e.startAt) >= now && Date.parse(e.startAt) < now + 7 * DAY).length,
      rsvps30: db.rsvps.filter((r) => Date.parse(r.updatedAt) > now - 30 * DAY).length,
      chat30: db.chat.filter((c) => Date.parse(c.createdAt) > now - 30 * DAY).length,
      tournaments: 0,
      auctions: g.__clbxAuctions?.auctions.length ?? 0,
      dropIns: g.__clbxSessions?.sessions.length ?? 0,
      followers: 0,
      sponsors: db.sponsors.filter((s) => s.status === "active").length,
      pushPhones: 0,
    },
    email: { sent: db.outbox.length, waiting: 0, failed: 0, lastError: null },
    money: { payments: 0, totalCents: 0, feeCents: 0 },
    weeks: buckets(now, { signups: [], events: live.map((e) => e.startAt), rsvps: db.rsvps.map((r) => r.updatedAt) }),
    people: db.profiles.map((p) => ({
      name: `${p.firstName} ${p.lastName}`,
      email: p.email,
      joined: null,
      lastSignIn: null,
      teams: active.filter((r) => r.userId === p.id).length,
    })),
    teams: db.teams.map((t) => ({
      id: t.id,
      name: t.name,
      club: db.clubs.find((c) => c.id === t.clubId)?.name ?? null,
      members: active.filter((r) => r.teamId === t.id).length,
      events: live.filter((e) => e.teamId === t.id).length,
      nextEvent: live.filter((e) => e.teamId === t.id && Date.parse(e.startAt) >= now).map((e) => e.startAt).sort()[0] ?? null,
      created: t.createdAt,
      archived: false,
    })),
    generatedAt: new Date(now).toISOString(),
  };
}
