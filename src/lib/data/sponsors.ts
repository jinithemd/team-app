import "server-only";
import type { ActionResult, ID, PublicSponsor, Sponsor, SponsorTier } from "./types";
import { SPONSOR_TIERS, TIER_LABEL, showsToSponsors } from "./types";
import { APP_URL, EMAIL_RE, canManageSponsors, db, isTeamMember, newId, norm, now, personOf, profileById, queueEmail, requireUser, teamById } from "./store";
import { setSessionUserId } from "./session";
import { sign, verify } from "../tokens";

/*
 * Sponsors: a business backing a team or a whole club, with a tier badge. Sponsors are not
 * team members. They see the team only through getSponsorView, which returns the same
 * sponsor-safe fields as sponsor_feed() / sponsor_news() in the SQL: main events, scores,
 * player of the match and shared news. No rosters, answers, chat, dues, injuries or contacts.
 */

const rank = (t: SponsorTier) => SPONSOR_TIERS.indexOf(t);
const MAX_LOGO = 400_000;
const today = () => now().slice(0, 10);
const live = (s: Sponsor) => s.status === "active" && (!s.endsOn || s.endsOn >= today());
const toPublic = (s: Sponsor): PublicSponsor => ({ id: s.id, name: s.name, tier: s.tier, logo: s.logo, website: s.website, blurb: s.blurb, scope: s.teamId ? "team" : "club" });
const sortTier = (a: Sponsor, b: Sponsor) => rank(a.tier) - rank(b.tier) || a.name.localeCompare(b.name);

/** The sponsor strip: everyone can see this (sponsors_public). Team sponsors plus the club's. */
export function teamSponsors(teamId: ID): PublicSponsor[] {
  const team = teamById(teamId);
  if (!team) return [];
  return db.sponsors.filter((s) => live(s) && (s.teamId === teamId || (!!team.clubId && s.clubId === team.clubId))).sort(sortTier).map(toPublic);
}
export function clubSponsors(clubId: ID): PublicSponsor[] {
  return db.sponsors.filter((s) => live(s) && s.clubId === clubId).sort(sortTier).map(toPublic);
}
export async function listTeamSponsors(teamId: ID) {
  return teamSponsors(teamId);
}

/** Manage screen: every sponsor for this team or club, invited and ended included. */
export async function manageSponsors(scope: { teamId?: ID; clubId?: ID }) {
  const user = await requireUser();
  const canManage = canManageSponsors(user.id, scope);
  if (!canManage && !(scope.teamId && isTeamMember(user.id, scope.teamId))) return null;
  const rows = db.sponsors.filter((s) => (scope.teamId ? s.teamId === scope.teamId : s.clubId === scope.clubId)).sort(sortTier);
  const team = scope.teamId ? teamById(scope.teamId) : undefined;
  return {
    canManage,
    clubSponsors: team?.clubId ? clubSponsors(team.clubId) : [],
    sponsors: rows.map((s) => ({
      ...toPublic(s),
      status: live(s) ? ("active" as const) : s.status === "invited" ? ("invited" as const) : ("ended" as const),
      startsOn: s.startsOn,
      endsOn: s.endsOn,
      // Contact details only for whoever runs the team.
      contact: canManage ? (s.contactUserId ? { name: `${personOf(s.contactUserId).firstName} ${personOf(s.contactUserId).lastName}`, email: profileById(s.contactUserId)?.email ?? "" } : { name: null, email: s.invitedEmail ?? "" }) : null,
    })),
  };
}

export async function getSponsor(id: ID) {
  const user = await requireUser();
  const s = db.sponsors.find((x) => x.id === id);
  if (!s || !canManageSponsors(user.id, s)) return null;
  return { ...s, contactEmail: s.contactUserId ? profileById(s.contactUserId)?.email ?? "" : s.invitedEmail ?? "" };
}

export interface SponsorInput {
  name: string;
  tier: string;
  website?: string;
  blurb?: string;
  email?: string;
  startsOn?: string;
  endsOn?: string;
  logo?: string; // data URL, "" to remove, "keep" to leave as is
}

export async function saveSponsor(scope: { teamId?: ID; clubId?: ID }, id: ID | null, input: SponsorInput): Promise<ActionResult<Sponsor>> {
  const user = await requireUser();
  const existing = id ? db.sponsors.find((s) => s.id === id) : undefined;
  const sc = existing ? { teamId: existing.teamId, clubId: existing.clubId } : scope;
  if (!canManageSponsors(user.id, sc)) return { ok: false, error: "Only whoever runs the team or club can manage sponsors." };
  const fieldErrors: Record<string, string> = {};
  const name = input.name.trim();
  const tier = SPONSOR_TIERS.find((t) => t === input.tier);
  const website = input.website?.trim() || null;
  const email = input.email ? norm(input.email) : "";
  if (!name) fieldErrors.name = "Add the sponsor's name.";
  if (!tier) fieldErrors.tier = "Pick a tier.";
  if (website && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(website)) fieldErrors.website = "Use a full link like https://cornercafe.ca";
  if (!existing && !EMAIL_RE.test(email)) fieldErrors.email = "Add the email of whoever looks after the sponsorship.";
  if (existing && email && !EMAIL_RE.test(email)) fieldErrors.email = "Enter an email like name@company.ca.";
  for (const k of ["startsOn", "endsOn"] as const) if (input[k] && !/^\d{4}-\d{2}-\d{2}$/.test(input[k]!)) fieldErrors[k] = "Pick a date.";
  if (input.startsOn && input.endsOn && input.endsOn < input.startsOn) fieldErrors.endsOn = "Ends before it starts.";
  if (input.logo && input.logo !== "keep" && (!/^data:image\/(png|jpe?g|webp|svg\+xml);base64,/.test(input.logo) || input.logo.length > MAX_LOGO)) fieldErrors.logo = "Use a PNG, JPG or SVG under 300 KB.";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };

  const s: Sponsor = existing ?? {
    id: newId(), clubId: sc.clubId ?? null, teamId: sc.teamId ?? null, name, tier: tier!, logo: null, website, blurb: null,
    contactUserId: null, invitedEmail: null, status: "invited", startsOn: null, endsOn: null, createdBy: user.id, createdAt: now(),
  };
  Object.assign(s, {
    name: name.slice(0, 80),
    tier,
    website,
    blurb: input.blurb?.trim().slice(0, 200) || null,
    startsOn: input.startsOn || null,
    endsOn: input.endsOn || null,
    ...(input.logo !== undefined && input.logo !== "keep" ? { logo: input.logo || null } : {}),
  });
  if (!existing) db.sponsors.push(s);
  if (s.status === "ended" && (!s.endsOn || s.endsOn >= today())) s.status = s.contactUserId ? "active" : "invited";

  // New contact: invite them. Same email as now: nothing to send.
  const currentEmail = s.contactUserId ? profileById(s.contactUserId)?.email : s.invitedEmail;
  if (email && email !== currentEmail) {
    s.contactUserId = null;
    s.invitedEmail = email;
    s.status = "invited";
    sendInvite(s, `${user.firstName} ${user.lastName}`);
  }
  return { ok: true, data: s };
}

function scopeName(s: Sponsor) {
  return s.teamId ? teamById(s.teamId)!.name : db.clubs.find((c) => c.id === s.clubId)!.name;
}

function sendInvite(s: Sponsor, from: string) {
  const token = sign({ k: "sponsor", s: s.id, e: s.invitedEmail }, 60 * 60 * 24 * 30);
  queueEmail({
    to: s.invitedEmail!,
    subject: `${scopeName(s)} · You're a ${TIER_LABEL[s.tier]} sponsor`,
    text: `${from} added ${s.name} as a ${TIER_LABEL[s.tier]} sponsor of ${scopeName(s)}. Sign in to follow the matches, results and news the team shares with sponsors.`,
    links: [{ label: "Open the sponsor page", href: `${APP_URL}/sponsor-invite/${token}` }],
  });
}

export async function endSponsor(id: ID, end: boolean): Promise<ActionResult> {
  const user = await requireUser();
  const s = db.sponsors.find((x) => x.id === id);
  if (!s || !canManageSponsors(user.id, s)) return { ok: false, error: "Only whoever runs the team or club can manage sponsors." };
  if (end) {
    s.status = "ended";
    s.endsOn = today() > (s.startsOn ?? "") ? new Date(Date.now() - 86400_000).toISOString().slice(0, 10) : s.startsOn;
  } else {
    s.status = s.contactUserId ? "active" : "invited";
    if (s.endsOn && s.endsOn < today()) s.endsOn = null;
  }
  return { ok: true, data: undefined };
}

export async function resendSponsorInvite(id: ID): Promise<ActionResult> {
  const user = await requireUser();
  const s = db.sponsors.find((x) => x.id === id);
  if (!s || !canManageSponsors(user.id, s) || s.status !== "invited" || !s.invitedEmail) return { ok: false, error: "Nothing to resend." };
  sendInvite(s, `${user.firstName} ${user.lastName}`);
  return { ok: true, data: undefined };
}

export async function getSponsorInvite(token: string) {
  const t = verify<{ k: string; s: string; e: string }>(token);
  if (!t || t.k !== "sponsor") return null;
  const s = db.sponsors.find((x) => x.id === t.s);
  if (!s || s.invitedEmail !== t.e) return null;
  const team = s.teamId ? teamById(s.teamId)! : null;
  const club = db.clubs.find((c) => c.id === (team?.clubId ?? s.clubId)) ?? null;
  return {
    sponsor: toPublic(s),
    email: t.e,
    hasAccount: db.profiles.some((p) => p.email === t.e),
    scopeName: scopeName(s),
    color: team?.color ?? club?.color ?? "#2346D8",
    colorSecondary: team?.colorSecondary ?? club?.colorSecondary ?? null,
    themeId: team?.id ?? club?.id ?? s.id,
  };
}

export async function acceptSponsorInvite(token: string, profile: { firstName: string; lastName: string }): Promise<ActionResult<{ sponsorId: ID }>> {
  const t = verify<{ k: string; s: string; e: string }>(token);
  const s = t && t.k === "sponsor" ? db.sponsors.find((x) => x.id === t.s && x.invitedEmail === t.e) : undefined;
  if (!t || !s) return { ok: false, error: "This sponsor link has expired. Ask the team for a new one." };
  let user = db.profiles.find((p) => p.email === t.e);
  if (!user) {
    if (!profile.firstName.trim() || !profile.lastName.trim()) return { ok: false, error: "Add your name." };
    user = { id: newId(), firstName: profile.firstName.trim(), lastName: profile.lastName.trim(), email: t.e, theme: "system", useTeamColors: true };
    db.profiles.push(user);
  }
  s.contactUserId = user.id;
  s.invitedEmail = null;
  s.status = "active";
  await setSessionUserId(user.id);
  return { ok: true, data: { sponsorId: s.id } };
}

/** The sponsorships I look after, for Home. */
export async function mySponsorships() {
  const user = await requireUser();
  return db.sponsors
    .filter((s) => s.contactUserId === user.id && live(s))
    .sort(sortTier)
    .map((s) => ({ ...toPublic(s), scopeName: scopeName(s) }));
}

/**
 * What a sponsor sees. Whoever runs the team can open it too ("see what sponsors see").
 * Only sponsor-safe fields: no notes, answers, squads, chat, dues or contacts.
 */
export async function getSponsorView(sponsorId: ID) {
  const user = await requireUser();
  const s = db.sponsors.find((x) => x.id === sponsorId);
  if (!s) return null;
  const isContact = s.contactUserId === user.id && live(s);
  const preview = canManageSponsors(user.id, s);
  if (!isContact && !preview) return null;
  const teams = s.teamId ? [teamById(s.teamId)!] : db.teams.filter((t) => t.clubId === s.clubId);
  const club = db.clubs.find((c) => c.id === (s.clubId ?? teams[0]?.clubId)) ?? null;
  const since = Date.now() - 120 * 86400_000;
  const potmOf = (eventId: ID) => {
    const e = db.events.find((x) => x.id === eventId)!;
    if (e.potmOpen) return null;
    const tally = new Map<ID, number>();
    db.potmVotes.filter((v) => v.eventId === eventId).forEach((v) => tally.set(v.nomineeId, (tally.get(v.nomineeId) ?? 0) + 1));
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? `${personOf(top[0]).firstName} ${personOf(top[0]).lastName}` : null;
  };
  const perTeam = teams.map((t) => {
    const evs = db.events.filter((e) => e.teamId === t.id && showsToSponsors(e) && Date.parse(e.startAt) > since).sort((a, b) => a.startAt.localeCompare(b.startAt));
    const view = evs.map((e) => {
      const sc = db.scores.find((x) => x.eventId === e.id);
      const venue = e.venueId ? db.venues.find((v) => v.id === e.venueId) : undefined;
      return {
        id: e.id, type: e.type, title: e.title, opponent: e.opponent, homeAway: e.homeAway, competition: e.competition,
        startAt: e.startAt, endAt: e.endAt, tz: e.tz, venue: venue?.name ?? e.locationText, status: e.status,
        score: sc && sc.status !== "not_started" ? { us: sc.us, them: sc.them, status: sc.status } : null,
        playerOfMatch: sc?.status === "final" ? potmOf(e.id) : null,
      };
    });
    const finals = view.filter((e) => e.score?.status === "final");
    return {
      team: { id: t.id, name: t.name, level: t.level, color: t.color, colorSecondary: t.colorSecondary, crest: t.settings.crest },
      chat: t.settings.sponsorChat !== false && isContact,
      record: { w: finals.filter((e) => e.score!.us > e.score!.them).length, d: finals.filter((e) => e.score!.us === e.score!.them).length, l: finals.filter((e) => e.score!.us < e.score!.them).length },
      upcoming: view.filter((e) => Date.parse(e.endAt) >= Date.now()).slice(0, 8),
      results: view.filter((e) => e.score && (e.score.status === "final" || e.score.status === "live")).reverse().slice(0, 6),
      news: db.messages
        .filter((m) => m.teamId === t.id && m.toSponsors)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 10)
        .map((m) => ({ id: m.id, subject: m.subject, body: m.body, createdAt: m.createdAt })),
    };
  });
  return {
    sponsor: toPublic(s),
    preview: preview && !isContact,
    scopeName: scopeName(s),
    club: club ? { id: club.id, name: club.name, color: club.color, colorSecondary: club.colorSecondary, logo: club.logo } : null,
    teams: perTeam,
    fellows: (s.teamId ? teamSponsors(s.teamId) : clubSponsors(s.clubId!)).filter((x) => x.id !== s.id),
  };
}


/** A team's name and colours, for pages a sponsor can open (no other team data). */
export async function teamLook(teamId: ID) {
  const user = await requireUser();
  const t = teamById(teamId);
  if (!t) return null;
  const allowed = isTeamMember(user.id, teamId) || db.sponsors.some((s) => s.contactUserId === user.id && live(s) && (s.teamId === teamId || (!!s.clubId && s.clubId === t.clubId)));
  return allowed ? { name: t.name, color: t.color, colorSecondary: t.colorSecondary } : null;
}
