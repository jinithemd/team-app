import "server-only";
import type { Store } from "../store";
import type { DB } from "../../supabase/server";
import { adminClient } from "../../supabase/server";
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
    rows(t("profiles").select("id, first_name, last_name, email, phone, theme, use_team_colors, updated_at").eq("id", uid)),
  ]);
  const clubIds = uniq([...adminClubs, ...teams.map((r) => r.club_id as string)]);
  const eventIds = uniq(events.map((r) => r.id as string));
  const convIds = uniq(convs.map((r) => r.id as string));
  const feeIds = uniq(fees.map((r) => r.id as string));
  const msgIds = uniq(messages.map((r) => r.id as string));
  const people = uniq([uid, ...roster.map((r) => r.user_id as string), ...joinReqs.map((r) => r.user_id as string)]);
  const byEvent = (table: string, cols = "*") => (eventIds.length ? rows(t(table).select(cols).in("event_id", eventIds)) : none);

  const [clubs, clubAdmins, profiles, rsvps, rsvpsPub, avail, availPub, attendance, playedPub, scores, matchEvents, potm, potmPub, managers, offers, requests, dues, sponsors, chat, reads, recipients] =
    await Promise.all([
      clubIds.length ? rows(t("clubs").select("*").in("id", clubIds)) : none,
      clubIds.length ? rows(t("club_admins").select("*").in("club_id", clubIds)) : none,
      // Not avatar_path: photos are fetched one by one from /api/img/photo.
      rows(t("profiles").select("id, first_name, last_name, email, phone, theme, use_team_colors, updated_at").in("id", people)),
      byEvent("rsvps"),
      byEvent("rsvps_public"),
      rows(t("availability_periods").select("*").in("user_id", people)),
      rows(t("availability_public").select("*").in("user_id", people)),
      byEvent("attendance"),
      byEvent("played_public"),
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

  // Sponsors: the teams I sponsor (not as a member). Only what a sponsor may see: the team's
  // name and colours (never its join code or invite link), the sponsors room and its messages,
  // and people's names as the room shows them ("First L." for members).
  const mySponsorRows = sponsors.filter((x) => x.contact_user_id === uid && x.status === "active" && (!x.ends_on || String(x.ends_on) >= new Date().toISOString().slice(0, 10)));
  const extra = { teams: [] as Row[], clubs: [] as Row[], convs: [] as Row[], chat: [] as Row[], profiles: [] as Row[], sponsors: [] as Row[], reads: [] as Row[] };
  if (mySponsorRows.length) {
    const admin = adminClient();
    const direct = mySponsorRows.map((x) => x.team_id as string).filter(Boolean);
    const viaClub = mySponsorRows.map((x) => x.club_id as string).filter(Boolean);
    const teamCols = "id, club_id, name, sport, level, location, color, color_secondary, logo_path, sponsor_chat, is_public, roster_visible, created_by, created_at";
    const [{ data: t1 }, { data: t2 }] = await Promise.all([
      direct.length ? admin.from("teams").select(teamCols).in("id", direct) : Promise.resolve({ data: [] as Row[] }),
      viaClub.length ? admin.from("teams").select(teamCols).in("club_id", viaClub).is("archived_at", null) : Promise.resolve({ data: [] as Row[] }),
    ]);
    const sTeams = uniqBy([...(t1 ?? []), ...(t2 ?? [])] as Row[], (r) => r.id as string).filter((r) => !teamIds.includes(r.id as string));
    extra.teams = sTeams.map((r) => ({ ...r, join_code: "", _pub: true }));
    const sTeamIds = sTeams.map((r) => r.id as string);
    const sClubIds = uniq([...viaClub, ...sTeams.map((r) => r.club_id as string)]).filter((c) => !clubIds.includes(c));
    if (sClubIds.length) extra.clubs = (await rows(t("clubs").select("*").in("id", sClubIds))).map((r) => ({ ...r, _pub: true }));
    if (sTeamIds.length) {
      extra.convs = await rows(t("conversations").select("*").in("team_id", sTeamIds).eq("kind", "sponsors"));
      const roomIds = extra.convs.map((r) => r.id as string);
      if (roomIds.length) {
        [extra.chat, extra.reads] = await Promise.all([
          rows(t("chat_messages").select("*").in("conversation_id", roomIds).order("created_at")),
          rows(t("chat_reads").select("*").in("conversation_id", roomIds).eq("user_id", uid)),
        ]);
      }
    }
  }
  // The sponsor strip on team pages: active sponsors of my teams and their clubs, without emails.
  const memberClubIds = uniq(teams.map((r) => r.club_id as string));
  const stripRows = teamIds.length
    ? await rows(
        t("sponsors_public")
          .select("*")
          .or([`team_id.in.(${teamIds.join(",")})`, memberClubIds.length && `club_id.in.(${memberClubIds.join(",")})`].filter(Boolean).join(",")),
      )
    : [];
  const knownSponsor = new Set(sponsors.map((r) => r.id as string));
  extra.sponsors.push(...stripRows.filter((r) => !knownSponsor.has(r.id as string)).map((r) => ({ ...r, status: "active", _pub: true })));

  // Every sponsors room (as a member or as a sponsor): names as the room shows them, and which
  // authors speak for a sponsor, from chat_people(). Members can't read sponsors' own rows.
  const sponsorRooms = [...convs.filter((r) => r.kind === "sponsors"), ...extra.convs];
  if (sponsorRooms.length) {
    const known = new Set<string>([uid, ...profiles.map((r) => r.id as string)]);
    const people = await Promise.all(sponsorRooms.map((r) => sb.rpc("chat_people", { c: r.id as string })));
    for (const [i, res] of people.entries()) {
      const room = sponsorRooms[i];
      for (const p of res.data ?? []) {
        if (p.sponsor_name && p.user_id !== uid && !sponsors.some((x) => x.contact_user_id === p.user_id)) {
          // Attach the author to the matching sponsor already on the strip; otherwise add one.
          const match = extra.sponsors.find((x) => x.name === p.sponsor_name && x.tier === p.sponsor_tier && !x.contact_user_id);
          if (match) match.contact_user_id = p.user_id;
          else extra.sponsors.push({ id: `${PUB}${room.id}:${p.user_id}`, team_id: room.team_id, club_id: null, name: p.sponsor_name, tier: p.sponsor_tier, contact_user_id: p.user_id, status: "active", _pub: true });
        }
        if (known.has(p.user_id)) continue;
        known.add(p.user_id);
        const [first, ...rest] = String(p.display_name ?? "").split(" ");
        extra.profiles.push({ id: p.user_id, first_name: first, last_name: rest.join(" "), email: "", _pub: true });
      }
    }
  }
  // Merge what privacy splits in two.
  const fullRsvp = new Set(rsvps.map((r) => `${r.event_id}:${r.user_id}`));
  const allRsvps = [
    ...rsvps,
    ...rsvpsPub.filter((r) => !fullRsvp.has(`${r.event_id}:${r.user_id}`)).map((r) => ({ ...r, id: `${PUB}${r.event_id}:${r.user_id}`, note: null })),
  ];
  const fullAvail = new Set(avail.map((r) => r.id as string));
  const allAvail = [...avail, ...availPub.filter((r) => !fullAvail.has(r.id as string)).map((r) => ({ ...r, id: `${PUB}${r.id}`, kind: "other", note: null }))];
  const fullAtt = new Set(attendance.map((r) => `${r.event_id}:${r.user_id}`));
  const allAttendance = [
    ...attendance,
    ...playedPub.filter((r) => !fullAtt.has(`${r.event_id}:${r.user_id}`)).map((r) => ({ ...r, status: "present", method: "staff", _pub: true })),
  ];
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
    profiles: uniqBy([...me, ...profiles, ...extra.profiles], (r) => r.id as string),
    clubs: [...clubs, ...extra.clubs],
    clubAdmins,
    joinRequests: joinReqs,
    teams: [...extra.teams, ...teams].map((r) => ({ ...r, _invite_token: linkBy.get(r.id as string)?.token ?? null, _needs_approval: linkBy.get(r.id as string)?.needs_approval ?? false })),
    roster,
    venues,
    seasons,
    events,
    rsvps: allRsvps,
    availability: allAvail,
    attendance: allAttendance,
    points,
    scores,
    matchEvents,
    potmVotes: allPotm,
    eventManagers: managers,
    sponsors: [...sponsors, ...extra.sponsors],
    rideOffers: offers,
    rideRequests: requests,
    fees,
    dues,
    payments,
    conversations: [...convs, ...extra.convs],
    chat: [...chat, ...extra.chat],
    reactions,
    pollVotes,
    reads: [...reads, ...extra.reads],
    messages: messages.map((m) => ({ ...m, _recipients: recBy.get(m.id as string) ?? [] })),
    prefs,
  };
  // Events first: ride times are stored as timestamps and shown in the event's time zone.
  const order = ["events", ...TABLES.map((x) => x.key).filter((k) => k !== "events")] as (keyof Store)[];
  for (const key of order) {
    const spec = TABLES.find((x) => x.key === key);
    const list = raw[key];
    if (!spec || !list) continue;
    (store[key] as unknown[]) = list.map((r) => {
      const o = spec.toApp(r, aux) as Record<string, unknown>;
      if (r._pub || String(r.id ?? "").startsWith(PUB) || String(r.voter_id ?? "").startsWith(PUB)) o._pub = true;
      return o;
    });
  }
  store.events.sort((a, b) => a.startAt.localeCompare(b.startAt));
  return { store, aux };
}

function uniqBy<T>(xs: T[], k: (x: T) => string) {
  const seen = new Set<string>();
  return xs.filter((x) => (seen.has(k(x)) ? false : (seen.add(k(x)), true)));
}
