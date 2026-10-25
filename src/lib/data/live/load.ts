import "server-only";
import type { Store } from "../store";
import type { DB } from "../../supabase/server";
import { TABLES, type Aux, type Row } from "./tables";

/*
 * Loads the signed-in person's slice of the database into the app's store shape:
 * the teams they're on, run, or whose club they run, and everything those teams hold that
 * the database lets them read (RLS decides; this file only narrows the scope).
 * Rows other people's privacy hides from them come from the public views instead
 * (answers without notes, "unavailable" without the reason, vote totals) and carry ids
 * starting with "pub:" so they're never written back.
 */

export const PUB = "pub:";

export function emptyStore(): Store {
  return {
    profiles: [], clubs: [], clubAdmins: [], joinRequests: [], teams: [], roster: [], venues: [], seasons: [],
    events: [], rsvps: [], availability: [], attendance: [], points: [], scores: [], matchEvents: [], potmVotes: [],
    eventManagers: [], calFeedVersions: {}, sponsors: [], rideOffers: [], rideRequests: [], fees: [], dues: [],
    payments: [], conversations: [], chat: [], reactions: [], pollVotes: [], reads: [], messages: [], prefs: [], outbox: [],
  };
}

async function rows(q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row[]> {
  const { data, error } = await q;
  if (error) throw new Error(`Couldn't load data: ${error.message}`);
  return (data as Row[]) ?? [];
}
const uniq = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))];

export interface Loaded {
  store: Store;
  aux: Aux;
}

export async function loadSlice(sb: DB, uid: string | null): Promise<Loaded> {
  const store = emptyStore();
  const aux: Aux = { store, pollOptions: new Map() };
  if (!uid) return { store, aux };
  const t = (name: string) => sb.from(name as never) as unknown as ReturnType<DB["from"]>;

  // 1. Which teams and clubs are mine.
  const [myRows, created, adminOf] = await Promise.all([
    rows(t("roster_members").select("team_id").eq("user_id", uid).neq("status", "removed")),
    rows(t("teams").select("id").eq("created_by", uid)),
    rows(t("club_admins").select("club_id").eq("user_id", uid)),
  ]);
  const adminClubs = uniq(adminOf.map((r) => r.club_id as string));
  const clubTeams = adminClubs.length ? await rows(t("teams").select("id").in("club_id", adminClubs)) : [];
  const teamIds = uniq([...myRows, ...created, ...clubTeams].map((r) => (r.team_id ?? r.id) as string));

  // 2. The teams and what hangs off them.
  const none = Promise.resolve([] as Row[]);
  const byTeam = (table: string, cols = "*") => (teamIds.length ? rows(t(table).select(cols).in("team_id", teamIds)) : none);
  const [teams, links, roster, venues, seasons, events, convs, fees, joinReqs, messages, points, prefs, me] = await Promise.all([
    teamIds.length ? rows(t("teams").select("*").in("id", teamIds)) : none,
    byTeam("team_invite_links"),
    byTeam("roster_members"),
    byTeam("venues"),
    byTeam("seasons"),
    byTeam("events"),
    byTeam("conversations"),
    byTeam("fees"),
    byTeam("join_requests"),
    byTeam("messages"),
    byTeam("points_ledger"),
    rows(t("notification_prefs").select("*").eq("user_id", uid)),
    rows(t("profiles").select("*").eq("id", uid)),
  ]);
  const clubIds = uniq([...adminClubs, ...teams.map((r) => r.club_id as string)]);
  const eventIds = uniq(events.map((r) => r.id as string));
  const convIds = uniq(convs.map((r) => r.id as string));
  const feeIds = uniq(fees.map((r) => r.id as string));
  const msgIds = uniq(messages.map((r) => r.id as string));
  const people = uniq([uid, ...roster.map((r) => r.user_id as string), ...joinReqs.map((r) => r.user_id as string)]);
  const byEvent = (table: string, cols = "*") => (eventIds.length ? rows(t(table).select(cols).in("event_id", eventIds)) : none);

  const [clubs, clubAdmins, profiles, rsvps, rsvpsPub, avail, availPub, attendance, scores, matchEvents, potm, potmPub, managers, offers, requests, dues, sponsors, chat, reads, recipients] =
    await Promise.all([
      clubIds.length ? rows(t("clubs").select("*").in("id", clubIds)) : none,
      clubIds.length ? rows(t("club_admins").select("*").in("club_id", clubIds)) : none,
      rows(t("profiles").select("*").in("id", people)),
      byEvent("rsvps"),
      byEvent("rsvps_public"),
      rows(t("availability_periods").select("*").in("user_id", people)),
      rows(t("availability_public").select("*").in("user_id", people)),
      byEvent("attendance"),
      byEvent("scores"),
      byEvent("match_events"),
      byEvent("potm_votes"),
      byEvent("potm_results"),
      byEvent("event_managers"),
      byEvent("ride_offers"),
      byEvent("ride_requests"),
      feeIds.length ? rows(t("dues").select("*").in("fee_id", feeIds)) : none,
      rows(
        t("sponsors")
          .select("*")
          .or([teamIds.length && `team_id.in.(${teamIds.join(",")})`, clubIds.length && `club_id.in.(${clubIds.join(",")})`, `contact_user_id.eq.${uid}`].filter(Boolean).join(",")),
      ),
      convIds.length ? rows(t("chat_messages").select("*").in("conversation_id", convIds).order("created_at")) : none,
      convIds.length ? rows(t("chat_reads").select("*").in("conversation_id", convIds)) : none,
      msgIds.length ? rows(t("message_recipients").select("*").in("message_id", msgIds)) : none,
    ]);
  const chatIds = uniq(chat.map((r) => r.id as string));
  const dueIds = uniq(dues.map((r) => r.id as string));
  const [payments, reactions, pollOptions, pollVotes] = await Promise.all([
    dueIds.length ? rows(t("payments").select("*").in("due_id", dueIds)) : none,
    chatIds.length ? rows(t("chat_reactions").select("*").in("message_id", chatIds)) : none,
    chatIds.length ? rows(t("poll_options").select("*").in("message_id", chatIds).order("position")) : none,
    chatIds.length ? rows(t("poll_votes").select("*").in("message_id", chatIds)) : none,
  ]);

  // Merge what privacy splits in two.
  const fullRsvp = new Set(rsvps.map((r) => `${r.event_id}:${r.user_id}`));
  const allRsvps = [
    ...rsvps,
    ...rsvpsPub.filter((r) => !fullRsvp.has(`${r.event_id}:${r.user_id}`)).map((r) => ({ ...r, id: `${PUB}${r.event_id}:${r.user_id}`, note: null })),
  ];
  const fullAvail = new Set(avail.map((r) => r.id as string));
  const allAvail = [...avail, ...availPub.filter((r) => !fullAvail.has(r.id as string)).map((r) => ({ ...r, id: `${PUB}${r.id}`, kind: "other", note: null }))];
  const myVotes = new Set(potm.map((r) => `${r.event_id}:${r.voter_id}`));
  const allPotm = [...potm];
  if (!potm.some((r) => r.voter_id !== uid)) {
    // Not staff: rebuild the totals from the results view so counts match.
    for (const r of potmPub)
      for (let i = 0; i < Number(r.votes); i++) allPotm.push({ event_id: r.event_id, voter_id: `${PUB}${r.event_id}:${r.nominee_id}:${i}`, nominee_id: r.nominee_id });
    // My own vote is already counted in the totals.
    for (const v of potm) {
      const k = allPotm.findIndex((x) => String(x.voter_id).startsWith(`${PUB}${v.event_id}:${v.nominee_id}:`));
      if (k >= 0 && myVotes.has(`${v.event_id}:${uid}`)) allPotm.splice(k, 1);
    }
  }
  for (const o of pollOptions) {
    const list = aux.pollOptions.get(o.message_id as string) ?? [];
    list.push(`${o.id}\u0000${o.label}`);
    aux.pollOptions.set(o.message_id as string, list);
  }
  const linkBy = new Map(links.map((l) => [l.team_id as string, l]));
  const recBy = new Map<string, string[]>();
  for (const r of recipients) recBy.set(r.message_id as string, [...(recBy.get(r.message_id as string) ?? []), r.user_id as string]);

  const raw: Partial<Record<keyof Store, Row[]>> = {
    profiles: uniqBy([...me, ...profiles], (r) => r.id as string),
    clubs,
    clubAdmins,
    joinRequests: joinReqs,
    teams: teams.map((r) => ({ ...r, _invite_token: linkBy.get(r.id as string)?.token ?? null, _needs_approval: linkBy.get(r.id as string)?.needs_approval ?? false })),
    roster,
    venues,
    seasons,
    events,
    rsvps: allRsvps,
    availability: allAvail,
    attendance,
    points,
    scores,
    matchEvents,
    potmVotes: allPotm,
    eventManagers: managers,
    sponsors,
    rideOffers: offers,
    rideRequests: requests,
    fees,
    dues,
    payments,
    conversations: convs,
    chat,
    reactions,
    pollVotes,
    reads,
    messages: messages.map((m) => ({ ...m, _recipients: recBy.get(m.id as string) ?? [] })),
    prefs,
  };
  // Events first: ride times are stored as timestamps and shown in the event's time zone.
  const order = ["events", ...TABLES.map((x) => x.key).filter((k) => k !== "events")] as (keyof Store)[];
  for (const key of order) {
    const spec = TABLES.find((x) => x.key === key);
    const list = raw[key];
    if (!spec || !list) continue;
    (store[key] as unknown[]) = list.map((r) => spec.toApp(r, aux));
  }
  store.events.sort((a, b) => a.startAt.localeCompare(b.startAt));
  return { store, aux };
}

function uniqBy<T>(xs: T[], k: (x: T) => string) {
  const seen = new Set<string>();
  return xs.filter((x) => (seen.has(k(x)) ? false : (seen.add(k(x)), true)));
}
