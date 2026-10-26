import "server-only";
import type { Store } from "../store";
import type * as T from "../types";
import { DEFAULT_POINTS_RULES } from "../types";
import { utcToZoned, zonedToUtc } from "../../time";

/*
 * How each collection of the app's store maps to a Supabase table, both ways.
 * Reads (live/load.ts) turn rows into app objects; writes (live/sync.ts) turn app objects back
 * into rows and send only what changed. Access is still decided by the database (RLS).
 */

type Row = Record<string, unknown>;
type Aux = { store: Store; pollOptions: Map<string, string[]> };

export interface TableSpec {
  key: keyof Store;
  table: string;
  /** Columns that identify a row. */
  pk: string[];
  toApp(row: Row, aux: Aux): unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toDb(obj: any, aux: Aux): Row;
  /** Written with the server key instead of the person's own access (the email outbox). */
  admin?: boolean;
  /** Never written back from a snapshot (changed through dedicated functions instead). */
  readOnly?: boolean;
}

const s = (v: unknown) => (v == null ? null : String(v));
const n = (v: unknown) => (v == null ? null : Number(v));

function splitName(full: unknown) {
  const t = String(full ?? "").trim();
  const i = t.indexOf(" ");
  return i < 0 ? { firstName: t, lastName: "" } : { firstName: t.slice(0, i), lastName: t.slice(i + 1) };
}

function eventOf(aux: Aux, id: unknown) {
  return aux.store.events.find((e) => e.id === id);
}

export const TABLES: TableSpec[] = [
  {
    key: "profiles",
    table: "profiles",
    pk: ["id"],
    toApp: (r) => ({ id: s(r.id)!, firstName: s(r.first_name)!, lastName: s(r.last_name) ?? "", email: s(r.email) ?? "", phone: s(r.phone) ?? undefined, theme: (r.theme as T.Profile["theme"]) ?? "system", useTeamColors: r.use_team_colors !== false, photoV: s(r.updated_at) ?? "0", photoMaybe: true }),
    toDb: (p: T.Profile) => ({ id: p.id, first_name: p.firstName, last_name: p.lastName, email: p.email, phone: p.phone ?? null, theme: p.theme, use_team_colors: p.useTeamColors }),
  },
  {
    key: "clubs",
    table: "clubs",
    pk: ["id"],
    toApp: (r) => ({ id: s(r.id)!, name: s(r.name)!, slug: s(r.slug)!, color: s(r.color)!, colorSecondary: s(r.color_secondary), logo: s(r.logo_path), blurb: s(r.blurb), joinOpen: r.join_open !== false, createdBy: s(r.created_by)!, createdAt: s(r.created_at)! }),
    toDb: (c: T.Club) => ({ id: c.id, name: c.name, slug: c.slug, color: c.color, color_secondary: c.colorSecondary, logo_path: c.logo, blurb: c.blurb, join_open: c.joinOpen, created_by: c.createdBy }),
  },
  {
    key: "clubAdmins",
    table: "club_admins",
    pk: ["club_id", "user_id"],
    toApp: (r) => ({ clubId: s(r.club_id)!, userId: s(r.user_id)!, role: r.role as T.ClubRole }),
    toDb: (a: T.ClubAdmin) => ({ club_id: a.clubId, user_id: a.userId, role: a.role }),
  },
  {
    key: "teams",
    table: "teams",
    pk: ["id"],
    toApp: (r) => ({
      id: s(r.id)!,
      clubId: s(r.club_id),
      name: s(r.name)!,
      sport: s(r.sport)!,
      level: s(r.level),
      location: s(r.location),
      color: s(r.color)!,
      colorSecondary: s(r.color_secondary),
      joinCode: s(r.join_code)!,
      inviteToken: s(r._invite_token) ?? "",
      isPublic: r.is_public !== false,
      rosterVisible: r.roster_visible !== false,
      createdBy: s(r.created_by)!,
      createdAt: s(r.created_at)!,
      settings: {
        crest: s(r.logo_path),
        pointsEnabled: !!r.points_enabled,
        pointsPublic: r.points_public !== false,
        pointsRules: { ...DEFAULT_POINTS_RULES, ...((r.points_rules as object) ?? {}) },
        geoCheckinEnabled: !!r.geo_checkin_enabled,
        membersCanPost: r.members_can_post !== false,
        sponsorChat: r.sponsor_chat !== false,
        linkNeedsApproval: !!r._needs_approval,
        payTo: s(r.pay_to),
      },
    }),
    toDb: (t: T.Team) => ({
      id: t.id,
      club_id: t.clubId,
      name: t.name,
      sport: t.sport,
      level: t.level,
      location: t.location,
      color: t.color,
      color_secondary: t.colorSecondary,
      join_code: t.joinCode,
      is_public: t.isPublic,
      roster_visible: t.rosterVisible,
      created_by: t.createdBy,
      logo_path: t.settings.crest,
      points_enabled: t.settings.pointsEnabled,
      points_public: t.settings.pointsPublic,
      points_rules: t.settings.pointsRules,
      geo_checkin_enabled: t.settings.geoCheckinEnabled,
      members_can_post: t.settings.membersCanPost,
      sponsor_chat: t.settings.sponsorChat !== false,
      pay_to: t.settings.payTo ?? null,
    }),
  },
  {
    key: "roster",
    table: "roster_members",
    pk: ["id"],
    toApp: (r) => ({
      id: s(r.id)!,
      teamId: s(r.team_id)!,
      userId: s(r.user_id),
      invitedEmail: s(r.invited_email),
      invitedName: r.invited_name ? splitName(r.invited_name) : null,
      isPlayer: r.is_player !== false,
      roles: (r.roles as T.TeamRole[]) ?? [],
      jersey: s(r.jersey),
      position: s(r.position),
      permissions: (r.permissions as T.TeamPermission[]) ?? [],
      status: r.status as T.RosterMember["status"],
    }),
    toDb: (m: T.RosterMember) => ({
      id: m.id,
      team_id: m.teamId,
      user_id: m.userId,
      invited_email: m.invitedEmail,
      invited_name: m.invitedName ? `${m.invitedName.firstName} ${m.invitedName.lastName}`.trim() : null,
      is_player: m.isPlayer,
      roles: m.roles,
      jersey: m.jersey,
      position: m.position,
      permissions: m.permissions,
      status: m.status,
    }),
  },
  {
    key: "joinRequests",
    table: "join_requests",
    pk: ["id"],
    toApp: (r) => ({ id: s(r.id)!, teamId: s(r.team_id)!, userId: s(r.user_id)!, message: s(r.message), status: r.status as T.JoinRequest["status"], createdAt: s(r.created_at)! }),
    toDb: (j: T.JoinRequest) => ({ id: j.id, team_id: j.teamId, user_id: j.userId, message: j.message, status: j.status }),
    readOnly: true, // asked and decided through request_to_join / decide_join_request
  },
  {
    key: "venues",
    table: "venues",
    pk: ["id"],
    toApp: (r) => ({ id: s(r.id)!, teamId: s(r.team_id)!, name: s(r.name)!, address: s(r.address), lat: n(r.lat), lng: n(r.lng), radiusM: n(r.check_in_radius_m) ?? 150 }),
    toDb: (v: T.Venue) => ({ id: v.id, team_id: v.teamId, name: v.name, address: v.address, lat: v.lat, lng: v.lng, check_in_radius_m: v.radiusM }),
  },
  {
    key: "seasons",
    table: "seasons",
    pk: ["id"],
    toApp: (r) => ({ id: s(r.id)!, teamId: s(r.team_id)!, name: s(r.name)!, startsOn: s(r.starts_on)!, endsOn: s(r.ends_on), closedAt: s(r.closed_at) }),
    toDb: (x: T.Season) => ({ id: x.id, team_id: x.teamId, name: x.name, starts_on: x.startsOn, ends_on: x.endsOn, closed_at: x.closedAt }),
  },
  {
    key: "events",
    table: "events",
    pk: ["id"],
    toApp: (r) => ({
      id: s(r.id)!,
      teamId: s(r.team_id)!,
      seasonId: s(r.season_id),
      seriesId: s(r.series_id),
      type: r.type as T.EventType,
      competition: (r.competition as T.Competition) ?? null,
      title: s(r.title),
      startAt: new Date(String(r.start_at)).toISOString(),
      endAt: new Date(String(r.end_at)).toISOString(),
      meetAt: r.meet_at ? new Date(String(r.meet_at)).toISOString() : null,
      tz: s(r.tz)!,
      venueId: s(r.venue_id),
      locationText: s(r.location_text),
      opponent: s(r.opponent),
      homeAway: (r.home_away as T.TeamEvent["homeAway"]) ?? null,
      notes: s(r.notes),
      squadSize: n(r.squad_size),
      status: r.status as T.EventStatus,
      statusReason: s(r.status_reason),
      potmOpen: !!r.potm_open,
      sponsorVisible: (r.sponsor_visible as boolean | null) ?? null,
      createdBy: s(r.created_by),
    }),
    toDb: (e: T.TeamEvent) => ({
      id: e.id,
      team_id: e.teamId,
      season_id: e.seasonId,
      series_id: e.seriesId,
      type: e.type,
      competition: e.competition,
      title: e.title,
      start_at: e.startAt,
      end_at: e.endAt,
      meet_at: e.meetAt,
      tz: e.tz,
      venue_id: e.venueId,
      location_text: e.locationText,
      opponent: e.opponent,
      home_away: e.homeAway,
      notes: e.notes,
      squad_size: e.squadSize,
      status: e.status,
      status_reason: e.statusReason,
      potm_open: e.potmOpen,
      sponsor_visible: e.sponsorVisible ?? null,
      created_by: e.createdBy,
    }),
  },
  {
    key: "rsvps",
    table: "rsvps",
    pk: ["id"],
    toApp: (r) => ({ id: s(r.id)!, eventId: s(r.event_id)!, userId: s(r.user_id)!, response: r.response as T.RsvpResponse, note: s(r.note), respondedBy: s(r.responded_by), updatedAt: s(r.updated_at) ?? new Date().toISOString() }),
    toDb: (x: T.Rsvp) => ({ id: x.id, event_id: x.eventId, user_id: x.userId, response: x.response, note: x.note, responded_by: x.respondedBy }),
  },
  {
    key: "availability",
    table: "availability_periods",
    pk: ["id"],
    toApp: (r) => ({
      id: s(r.id)!,
      userId: s(r.user_id)!,
      teamIds: ((r.team_ids as string[]) ?? []).length ? (r.team_ids as string[]) : r.team_id ? [String(r.team_id)] : [],
      kind: (r.kind ?? "other") as T.UnavailableKind,
      startsOn: s(r.starts_on)!,
      endsOn: s(r.ends_on) ?? s(r.starts_on)!,
      note: s(r.note),
      createdAt: s(r.created_at) ?? "",
    }),
    toDb: (a: T.AvailabilityPeriod) => ({ id: a.id, user_id: a.userId, team_ids: a.teamIds, team_id: a.teamIds.length === 1 ? a.teamIds[0] : null, kind: a.kind, starts_on: a.startsOn, ends_on: a.endsOn, note: a.note }),
  },
  {
    key: "attendance",
    table: "attendance",
    pk: ["event_id", "user_id"],
    toApp: (r) => ({ eventId: s(r.event_id)!, userId: s(r.user_id)!, status: r.status as T.AttendanceStatus, minutesLate: n(r.minutes_late), method: r.method as "staff" | "geo", checkedInAt: s(r.checked_in_at), distanceM: n(r.distance_m), accuracyM: n(r.accuracy_m), recordedBy: s(r.recorded_by), updatedAt: s(r.updated_at) ?? "" }),
    toDb: (a: T.Attendance) => ({ event_id: a.eventId, user_id: a.userId, status: a.status, minutes_late: a.minutesLate, method: a.method, checked_in_at: a.checkedInAt, distance_m: a.distanceM, accuracy_m: a.accuracyM, recorded_by: a.recordedBy }),
  },
  {
    key: "points",
    table: "points_ledger",
    pk: ["id"],
    toApp: (r) => ({ id: s(r.id)!, teamId: s(r.team_id)!, seasonId: s(r.season_id), userId: s(r.user_id)!, eventId: s(r.event_id), points: Number(r.points), reason: r.reason as T.PointsReason, note: s(r.note), createdBy: s(r.created_by), createdAt: s(r.created_at) ?? "" }),
    toDb: (p: T.PointsEntry) => ({ id: p.id, team_id: p.teamId, season_id: p.seasonId, user_id: p.userId, event_id: p.eventId, points: p.points, reason: p.reason, note: p.note, created_by: p.createdBy }),
  },
  {
    key: "scores",
    table: "scores",
    pk: ["event_id"],
    toApp: (r) => ({ eventId: s(r.event_id)!, us: Number(r.team_score), them: Number(r.opponent_score), status: r.status as T.Score["status"], period: s(r.period), version: Number(r.version ?? 0), updatedAt: s(r.updated_at) ?? "" }),
    toDb: (x: T.Score) => ({ event_id: x.eventId, team_score: x.us, opponent_score: x.them, status: x.status, period: x.period, version: x.version }),
  },
  {
    key: "matchEvents",
    table: "match_events",
    pk: ["id"],
    toApp: (r) => ({ id: s(r.id)!, eventId: s(r.event_id)!, minute: n(r.minute), kind: r.kind as T.MatchEventKind, side: r.side as "us" | "them", userId: s(r.user_id), assistId: s(r.assist_id), note: s(r.note), createdAt: s(r.created_at) ?? "" }),
    toDb: (m: T.MatchEvent) => ({ id: m.id, event_id: m.eventId, minute: m.minute, kind: m.kind, side: m.side, user_id: m.userId, assist_id: m.assistId, note: m.note }),
  },
  {
    key: "potmVotes",
    table: "potm_votes",
    pk: ["event_id", "voter_id"],
    toApp: (r) => ({ eventId: s(r.event_id)!, voterId: s(r.voter_id)!, nomineeId: s(r.nominee_id)! }),
    toDb: (v: T.PotmVote) => ({ event_id: v.eventId, voter_id: v.voterId, nominee_id: v.nomineeId }),
  },
  {
    key: "eventManagers",
    table: "event_managers",
    pk: ["event_id", "user_id"],
    toApp: (r) => ({ eventId: s(r.event_id)!, userId: s(r.user_id)!, permissions: (r.permissions as T.EventPermission[]) ?? [] }),
    toDb: (m: T.EventManager) => ({ event_id: m.eventId, user_id: m.userId, permissions: m.permissions }),
  },
  {
    key: "sponsors",
    table: "sponsors",
    pk: ["id"],
    toApp: (r) => ({ id: s(r.id)!, clubId: s(r.club_id), teamId: s(r.team_id), name: s(r.name)!, tier: r.tier as T.SponsorTier, logo: s(r.logo_url), website: s(r.website), blurb: s(r.blurb), contactUserId: s(r.contact_user_id), invitedEmail: s(r.invited_email), status: r.status as T.Sponsor["status"], startsOn: s(r.starts_on), endsOn: s(r.ends_on), createdBy: s(r.created_by), createdAt: s(r.created_at) ?? "" }),
    toDb: (x: T.Sponsor) => ({ id: x.id, club_id: x.clubId, team_id: x.teamId, name: x.name, tier: x.tier, logo_url: x.logo, website: x.website, blurb: x.blurb, contact_user_id: x.contactUserId, invited_email: x.invitedEmail, status: x.status, starts_on: x.startsOn, ends_on: x.endsOn, created_by: x.createdBy }),
  },
  {
    key: "rideOffers",
    table: "ride_offers",
    pk: ["id"],
    toApp: (r, aux) => {
      const e = eventOf(aux, r.event_id);
      return { id: s(r.id)!, eventId: s(r.event_id)!, driverId: s(r.driver_id)!, seats: Number(r.seats), leavesAt: r.leaves_at && e ? utcToZoned(String(r.leaves_at), e.tz).time : "", from: s(r.leaves_from) ?? "", note: s(r.note) };
    },
    toDb: (o: T.RideOffer, aux) => {
      const e = eventOf(aux, o.eventId);
      const leaves = o.leavesAt && e ? zonedToUtc(utcToZoned(e.startAt, e.tz).date, o.leavesAt, e.tz) : null;
      return { id: o.id, event_id: o.eventId, driver_id: o.driverId, seats: o.seats, leaves_at: leaves, leaves_from: o.from, note: o.note };
    },
  },
  {
    key: "rideRequests",
    table: "ride_requests",
    pk: ["id"],
    toApp: (r) => ({ id: s(r.id)!, eventId: s(r.event_id)!, userId: s(r.rider_id)!, from: s(r.pickup_area), offerId: s(r.offer_id) }),
    toDb: (q: T.RideRequest) => ({ id: q.id, event_id: q.eventId, rider_id: q.userId, pickup_area: q.from, offer_id: q.offerId, status: q.offerId ? "matched" : "looking" }),
  },
  {
    key: "fees",
    table: "fees",
    pk: ["id"],
    toApp: (r) => ({ id: s(r.id)!, teamId: s(r.team_id)!, seasonId: s(r.season_id), name: s(r.name)!, amountCents: Number(r.amount_cents), dueOn: s(r.due_on), createdAt: s(r.created_at) ?? "" }),
    toDb: (f: T.Fee) => ({ id: f.id, team_id: f.teamId, season_id: f.seasonId, name: f.name, amount_cents: f.amountCents, due_on: f.dueOn }),
  },
  {
    key: "dues",
    table: "dues",
    pk: ["id"],
    toApp: (r) => ({ id: s(r.id)!, feeId: s(r.fee_id)!, userId: s(r.user_id)!, amountCents: Number(r.amount_cents) }),
    toDb: (d: T.Due) => ({ id: d.id, fee_id: d.feeId, user_id: d.userId, amount_cents: d.amountCents }),
  },
  {
    key: "payments",
    table: "payments",
    pk: ["id"],
    toApp: (r) => ({ id: s(r.id)!, dueId: s(r.due_id)!, amountCents: Number(r.amount_cents), method: r.method as T.PaymentMethod, ref: s(r.reference), paidOn: s(r.paid_on)!, reportedBy: s(r.reported_by) ?? "", verifiedBy: s(r.verified_by), verifiedAt: s(r.verified_at), createdAt: s(r.created_at) ?? "" }),
    toDb: (p: T.Payment) => ({ id: p.id, due_id: p.dueId, amount_cents: p.amountCents, method: p.method, reference: p.ref, paid_on: p.paidOn, reported_by: p.reportedBy || null, verified_by: p.verifiedBy, verified_at: p.verifiedAt }),
  },
  {
    key: "conversations",
    table: "conversations",
    pk: ["id"],
    toApp: (r) => ({ id: s(r.id)!, teamId: s(r.team_id)!, kind: r.kind as T.Conversation["kind"] }),
    toDb: (c: T.Conversation) => ({ id: c.id, team_id: c.teamId, kind: c.kind }),
  },
  {
    key: "chat",
    table: "chat_messages",
    pk: ["id"],
    toApp: (r, aux) => {
      const att = (r.attachments as { type?: string; url?: string }[]) ?? [];
      const opts = aux.pollOptions.get(String(r.id));
      return {
        id: s(r.id)!,
        conversationId: s(r.conversation_id)!,
        userId: s(r.author_id) ?? "",
        body: s(r.body) ?? "",
        imageUrl: att.find((a) => a.type === "image")?.url ?? null,
        replyToId: s(r.reply_to),
        poll: r.kind === "poll" ? { question: s(r.body) ?? "", options: (opts ?? []).map((o) => o.split("\u0000")[1] ?? ""), multi: !!r.poll_multi } : null,
        pinned: !!r.pinned_at,
        createdAt: s(r.created_at)!,
        deletedAt: s(r.deleted_at),
      };
    },
    toDb: (m: T.ChatMessage) => ({
      id: m.id,
      client_id: m.id,
      conversation_id: m.conversationId,
      author_id: m.userId || null,
      body: m.poll ? m.poll.question : m.body,
      kind: m.poll ? "poll" : "text",
      poll_multi: m.poll?.multi ?? false,
      attachments: m.imageUrl ? [{ type: "image", url: m.imageUrl }] : [],
      reply_to: m.replyToId,
      pinned_at: m.pinned ? new Date().toISOString() : null,
      deleted_at: m.deletedAt,
    }),
  },
  {
    key: "reactions",
    table: "chat_reactions",
    pk: ["message_id", "user_id", "emoji"],
    toApp: (r) => ({ messageId: s(r.message_id)!, userId: s(r.user_id)!, emoji: s(r.emoji)! }),
    toDb: (x: T.Reaction) => ({ message_id: x.messageId, user_id: x.userId, emoji: x.emoji }),
  },
  {
    key: "pollVotes",
    table: "poll_votes",
    pk: ["option_id", "user_id"],
    toApp: (r, aux) => {
      const opts = aux.pollOptions.get(String(r.message_id)) ?? [];
      return { messageId: s(r.message_id)!, userId: s(r.user_id)!, option: opts.findIndex((o) => o.startsWith(`${r.option_id}\u0000`)) };
    },
    toDb: (v: T.PollVote, aux) => {
      const opt = (aux.pollOptions.get(v.messageId) ?? [])[v.option] ?? "";
      return { message_id: v.messageId, user_id: v.userId, option_id: opt.split("\u0000")[0] || null };
    },
  },
  {
    key: "reads",
    table: "chat_reads",
    pk: ["conversation_id", "user_id"],
    toApp: (r) => ({ conversationId: s(r.conversation_id)!, userId: s(r.user_id)!, lastReadAt: s(r.last_read_at)! }),
    toDb: (x: T.ReadMark) => ({ conversation_id: x.conversationId, user_id: x.userId, last_read_at: x.lastReadAt }),
  },
  {
    key: "messages",
    table: "messages",
    pk: ["id"],
    toApp: (r) => ({ id: s(r.id)!, teamId: s(r.team_id)!, fromId: s(r.author_id) ?? "", subject: s(r.subject)!, body: s(r.body)!, recipientIds: (r._recipients as string[]) ?? [], createdAt: s(r.created_at)!, toSponsors: !!r.to_sponsors }),
    toDb: (m: T.TeamMessage) => ({ id: m.id, team_id: m.teamId, author_id: m.fromId || null, subject: m.subject, body: m.body, to_all: false, to_sponsors: !!m.toSponsors }),
  },
  {
    key: "prefs",
    table: "notification_prefs",
    pk: ["user_id", "team_id"],
    toApp: (r) => ({ userId: s(r.user_id)!, teamId: s(r.team_id)!, newEvents: r.new_events !== false, changes: r.changes !== false, reminders: r.reminders !== false, chat: (r.chat as T.NotificationPrefs["chat"]) ?? "all", email: r.email !== false, push: !!r.push }),
    toDb: (p: T.NotificationPrefs) => ({ user_id: p.userId, team_id: p.teamId, new_events: p.newEvents, changes: p.changes, reminders: p.reminders, chat: p.chat, email: p.email, push: p.push }),
  },
  {
    key: "outbox",
    table: "outbox",
    pk: ["id"],
    admin: true,
    toApp: (r) => {
      const p = (r.payload as { to?: string; subject?: string; text?: string; links?: { label: string; href: string }[] }) ?? {};
      return { id: s(r.id)!, to: p.to ?? "", subject: p.subject ?? "", text: p.text ?? "", links: p.links ?? [], createdAt: s(r.created_at) ?? "" };
    },
    toDb: (m: T.OutboxEmail) => ({ id: m.id, kind: "email", channel: "email", payload: { to: m.to, subject: m.subject, text: m.text, links: m.links }, dedupe_key: `email:${m.id}` }),
  },
];

export const SPEC = Object.fromEntries(TABLES.map((t) => [t.key, t])) as Record<keyof Store, TableSpec | undefined>;
export type { Aux, Row };
