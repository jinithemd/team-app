import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIVE } from "../mode";
import { getAvailability, getEvent, getTeam, myPerms } from "../data";
import { eventTitle } from "../event-title";
import { FORMATIONS, autoPick, isFormation, lineOf, sizeOf, type Line } from "./formations";

/*
 * Team sheets. A captain (or anyone who can schedule games) picks a formation, puts players in
 * it and names the subs; every member of the team can see it. Stored one row per event
 * (event_lineups), read and written by the server after checking the person's permissions.
 */

export interface Lineup {
  formation: string;
  slots: (string | null)[];
  subs: string[];
  updatedAt: string | null;
}

export interface LineupPlayer {
  id: string;
  name: string;
  short: string;
  jersey: string | null;
  position: string | null;
  line: Line | null;
  response: "going" | "maybe" | "not_going" | null;
  photo: string | null;
}

type Row = Record<string, unknown>;
const mem = ((globalThis as unknown as { __clbxLineups?: Map<string, Lineup & { teamId: string }> }).__clbxLineups ??= new Map());

async function admin(): Promise<SupabaseClient> {
  const { adminClient } = await import("../supabase/server");
  return adminClient() as unknown as SupabaseClient;
}

async function load(eventId: string): Promise<Lineup | null> {
  if (!LIVE) return mem.get(eventId) ?? null;
  const { data } = await (await admin()).from("event_lineups").select("formation, slots, subs, updated_at").eq("event_id", eventId).maybeSingle();
  if (!data) return null;
  const r = data as Row;
  return { formation: String(r.formation), slots: (r.slots as (string | null)[]) ?? [], subs: (r.subs as string[]) ?? [], updatedAt: r.updated_at ? String(r.updated_at) : null };
}

/** Roster positions (Availability has names and shirt numbers, not positions). */
async function positions(teamId: string): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  if (!LIVE) {
    const { db } = await import("../data/store");
    for (const r of db.roster.filter((x) => x.teamId === teamId && x.userId)) out.set(r.userId!, r.position ?? null);
    return out;
  }
  const { data } = await (await admin()).from("roster_members").select("user_id, position").eq("team_id", teamId).eq("status", "active").not("user_id", "is", null);
  for (const r of (data ?? []) as Row[]) out.set(String(r.user_id), (r.position as string | null) ?? null);
  return out;
}

/** The squad size says how many play (14 in the squad is still 11-a-side); otherwise go by who's in. */
function defaultFormation(squad: number | null, playersIn: number) {
  const n = squad ?? (playersIn >= 5 ? playersIn : 11);
  const side = Object.keys(FORMATIONS).map(Number).filter((k) => k <= Math.max(5, n)).sort((a, b) => b - a)[0] ?? 11;
  return FORMATIONS[side][0];
}

/** Everything the team sheet page needs, or null if you can't see this event. */
export async function lineupPage(eventId: string) {
  const e = await getEvent(eventId);
  if (!e) return null;
  const [team, av, perms, saved, pos] = await Promise.all([getTeam(e.teamId), getAvailability(eventId), myPerms(e.teamId), load(eventId), positions(e.teamId)]);
  if (!team || !av) return null;
  const players: LineupPlayer[] = av.rows.map((r) => {
    const position = pos.get(r.person.id) ?? null;
    return {
      id: r.person.id,
      name: `${r.person.firstName} ${r.person.lastName}`.trim(),
      short: r.person.firstName || r.person.lastName,
      jersey: r.jersey,
      position,
      line: lineOf(position),
      response: r.response,
      photo: r.person.photo ?? null,
    };
  });
  const order = { going: 0, maybe: 1, null: 2, not_going: 3 } as const;
  players.sort((a, b) => order[String(a.response) as keyof typeof order] - order[String(b.response) as keyof typeof order] || a.name.localeCompare(b.name));
  const going = players.filter((p) => p.response === "going");
  const lineup: Lineup =
    saved ??
    (() => {
      const formation = defaultFormation(e.squadSize ?? null, going.length);
      return { formation, ...autoPick(formation, going), updatedAt: null };
    })();
  return {
    event: e,
    title: eventTitle(e),
    team: { id: team.id, name: team.name, color: team.color },
    canEdit: perms.staff || perms.games,
    players,
    lineup,
    saved: !!saved,
  };
}

export async function saveLineup(eventId: string, input: { formation: string; slots: (string | null)[]; subs: string[] }): Promise<{ ok: true } | { ok: false; error: string }> {
  const e = await getEvent(eventId);
  if (!e) return { ok: false, error: "That event no longer exists." };
  const perms = await myPerms(e.teamId);
  if (!(perms.staff || perms.games)) return { ok: false, error: "Only captains and managers can pick the team." };
  if (!isFormation(input.formation)) return { ok: false, error: "Pick a formation." };
  const av = await getAvailability(eventId);
  const ids = new Set(av?.rows.map((r) => r.person.id) ?? []);
  const n = sizeOf(input.formation);
  const slots = Array.from({ length: n }, (_, i) => {
    const id = input.slots[i] ?? null;
    return id && ids.has(id) ? id : null;
  });
  const used = new Set(slots.filter(Boolean));
  if (used.size !== slots.filter(Boolean).length) return { ok: false, error: "Someone is in two places at once." };
  const subs = [...new Set(input.subs)].filter((id) => ids.has(id) && !used.has(id)).slice(0, 12);
  const updatedAt = new Date().toISOString();
  if (!LIVE) {
    mem.set(eventId, { teamId: e.teamId, formation: input.formation, slots, subs, updatedAt });
    return { ok: true };
  }
  const { error } = await (await admin())
    .from("event_lineups")
    .upsert({ event_id: eventId, team_id: e.teamId, formation: input.formation, slots, subs, updated_by: perms.userId, updated_at: updatedAt }, { onConflict: "event_id" });
  if (error) {
    console.error("[lineups] save:", error.message);
    return { ok: false, error: "Couldn't save the team. Try again." };
  }
  return { ok: true };
}

/** For the shareable image: the saved team sheet, for members of the team only. */
export async function lineupForImage(eventId: string) {
  const page = await lineupPage(eventId).catch(() => null);
  if (!page || !page.saved) return null;
  return page;
}

/** Whether a team sheet has been saved for this event (for the link on the event page). */
export async function hasLineup(eventId: string) {
  return !!(await load(eventId).catch(() => null));
}
