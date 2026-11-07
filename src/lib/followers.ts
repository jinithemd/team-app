import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIVE } from "./mode";
import { FAN_UPDATES, type FanUpdate } from "./data/types";

/*
 * Followers pick their updates. A team says what it shares with followers (Settings), and each
 * follower picks from that on the team's fan page. Members get every team update anyway, so
 * these go to followers who aren't on the team. Missing choices mean "all of it".
 * Sample build: in memory. Live: teams.fan_updates and follows.updates.
 */

type Row = Record<string, unknown>;
const ALL = [...FAN_UPDATES];
const clean = (v: unknown): FanUpdate[] | null => (Array.isArray(v) ? (v as string[]).filter((x): x is FanUpdate => (FAN_UPDATES as readonly string[]).includes(x)) : null);

const g = globalThis as unknown as { __clbxFollows?: Map<string, Set<string>>; __clbxFollowPrefs?: Map<string, FanUpdate[]> };
const memPrefs = (): Map<string, FanUpdate[]> => (g.__clbxFollowPrefs ??= new Map());

async function admin() {
  const { adminClient } = await import("./supabase/server");
  return adminClient() as unknown as SupabaseClient;
}

/** What a team shares with its followers. Nothing if it isn't public. */
export async function teamOffers(teamId: string): Promise<FanUpdate[]> {
  if (!LIVE) {
    const { db } = await import("./data/store");
    const t = db.teams.find((x) => x.id === teamId);
    return t?.isPublic ? (t.settings.fanUpdates ?? ALL) : [];
  }
  const { data } = await (await admin()).from("teams").select("is_public, fan_updates").eq("id", teamId).maybeSingle();
  return data?.is_public ? (clean(data.fan_updates) ?? ALL) : [];
}

/** My follow of a team: whether I follow it, what I get, and what the team offers. */
export async function myFollow(teamId: string): Promise<{ following: boolean; updates: FanUpdate[]; offers: FanUpdate[] }> {
  const offers = await teamOffers(teamId);
  if (!LIVE) {
    const { currentUserId } = await import("./data/store");
    const uid = await currentUserId();
    const following = !!uid && !!g.__clbxFollows?.get(uid)?.has(teamId);
    const mine: FanUpdate[] | undefined = uid ? memPrefs().get(`${uid}:${teamId}`) : undefined;
    return { following, updates: (mine ?? ALL).filter((x) => offers.includes(x)), offers };
  }
  const { authUser } = await import("./supabase/server");
  const u = await authUser();
  if (!u) return { following: false, updates: offers, offers };
  const { data } = await (await admin()).from("follows").select("updates").eq("team_id", teamId).eq("user_id", u.id).maybeSingle();
  return { following: !!data, updates: (clean(data?.updates) ?? ALL).filter((x) => offers.includes(x)), offers };
}

/** A follower picks their updates (following the team if they weren't already). */
export async function setMyUpdates(teamId: string, updates: FanUpdate[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const picked = ALL.filter((x) => updates.includes(x));
  if (!LIVE) {
    const { currentUserId } = await import("./data/store");
    const uid = await currentUserId();
    if (!uid) return { ok: false, error: "Sign in first." };
    const follows = (g.__clbxFollows ??= new Map());
    if (!follows.has(uid)) follows.set(uid, new Set());
    follows.get(uid)!.add(teamId);
    memPrefs().set(`${uid}:${teamId}`, picked);
    return { ok: true };
  }
  const { authUser, userClient } = await import("./supabase/server");
  const u = await authUser();
  if (!u) return { ok: false, error: "Sign in first." };
  const { error } = await ((await userClient()) as unknown as SupabaseClient).from("follows").upsert({ user_id: u.id, team_id: teamId, updates: picked });
  return error ? { ok: false, error: "Couldn't save that. Try again." } : { ok: true };
}

/** Followers (not on the team) who get this kind of update from the team. */
export async function followersFor(teamId: string, kind: FanUpdate): Promise<string[]> {
  if (!(await teamOffers(teamId)).includes(kind)) return [];
  const { teamMemberIds } = await import("./sessions/store");
  const members = new Set(await teamMemberIds(teamId));
  let rows: { uid: string; updates: FanUpdate[] | null }[];
  if (!LIVE) {
    rows = [...(g.__clbxFollows ?? new Map<string, Set<string>>()).entries()].filter(([, set]) => set.has(teamId)).map(([uid]) => ({ uid, updates: memPrefs().get(`${uid}:${teamId}`) ?? null }));
  } else {
    const { data } = await (await admin()).from("follows").select("user_id, updates").eq("team_id", teamId);
    rows = ((data ?? []) as Row[]).map((r) => ({ uid: String(r.user_id), updates: clean(r.updates) }));
  }
  return rows.filter((r) => !members.has(r.uid) && (r.updates ?? ALL).includes(kind)).map((r) => r.uid);
}

/** Emails (and pushes, through the outbox) one update to the followers who asked for it. */
export async function tellFollowers(teamId: string, kind: FanUpdate, m: { key: string; subject: string; text: string; link: { label: string; href: string } }, except: string[] = []) {
  const ids = (await followersFor(teamId, kind)).filter((id) => !except.includes(id));
  if (!ids.length) return 0;
  const st = await import("./sessions/store");
  const who = await st.people(ids);
  const { APP_URL } = await import("./data/store");
  const settings = { label: "Choose your updates", href: `${APP_URL}/f/${teamId}#updates-h` };
  await st.sendEmails(
    [...who.values()].filter((p) => p.email).map((p) => ({ key: `${m.key}:${p.id}`, to: p.email, subject: m.subject, text: m.text, links: [m.link, settings] })),
  );
  return ids.length;
}
