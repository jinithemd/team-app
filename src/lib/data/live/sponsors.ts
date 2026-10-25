import "server-only";
import type { ActionResult, ID, PublicSponsor, SponsorTier } from "../types";
import { SPONSOR_TIERS } from "../types";
import { adminClient, userClient } from "../../supabase/server";
import { verify } from "../../tokens";
import { canManageSponsors, db } from "../store";
import { onLive } from "./run";

/*
 * Sponsors in the live build. A sponsor isn't on the team, so their page is built from the
 * database's sponsor-safe functions (sponsor_feed, sponsor_news): main events, scores, player of
 * the match and the news the team chose to share. The invite is read with the server key
 * because the person opening it isn't anyone yet.
 */

const rank = (t: string) => SPONSOR_TIERS.indexOf(t as SponsorTier);
const pub = (r: { id: string | null; name: string | null; tier: string | null; logo_url: string | null; website: string | null; blurb: string | null; team_id: string | null }): PublicSponsor => ({
  id: r.id!, name: r.name!, tier: r.tier as SponsorTier, logo: r.logo_url, website: r.website, blurb: r.blurb, scope: r.team_id ? "team" : "club",
});

export async function getSponsorInvite(token: string) {
  const t = verify<{ k: string; s: string; e: string }>(token);
  if (!t || t.k !== "sponsor") return null;
  const admin = adminClient();
  const { data: s } = await admin.from("sponsors").select("*").eq("id", t.s).maybeSingle();
  if (!s || s.invited_email !== t.e) return null;
  const { data: team } = s.team_id ? await admin.from("teams").select("id, name, color, color_secondary, club_id").eq("id", s.team_id).maybeSingle() : { data: null };
  const { data: club } = await admin.from("clubs").select("id, name, color, color_secondary").eq("id", team?.club_id ?? s.club_id ?? "").maybeSingle();
  const { data: prof } = await admin.from("profiles").select("id").eq("email", t.e).maybeSingle();
  return {
    sponsor: pub(s),
    email: t.e,
    hasAccount: !!prof,
    scopeName: team?.name ?? club?.name ?? "",
    color: team?.color ?? club?.color ?? "#2346D8",
    colorSecondary: team?.color_secondary ?? club?.color_secondary ?? null,
    themeId: team?.id ?? club?.id ?? s.id,
  };
}

/** Signed in with the invited address: that account becomes the sponsor's contact. */
export async function acceptSponsorInvite(token: string): Promise<ActionResult<{ sponsorId: ID }>> {
  const t = verify<{ k: string; s: string; e: string }>(token);
  if (!t || t.k !== "sponsor") return { ok: false, error: "This sponsor link has expired. Ask the team for a new one." };
  const sb = await userClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sign in first." };
  if ((auth.user.email ?? "").toLowerCase() !== t.e) return { ok: false, error: `This invite is for ${t.e}. Sign out, then open the link again.` };
  const admin = adminClient();
  const { data, error } = await admin
    .from("sponsors")
    .update({ contact_user_id: auth.user.id, invited_email: null, status: "active" })
    .eq("id", t.s)
    .eq("invited_email", t.e)
    .select("id");
  if (error || !data?.length) {
    const { data: s } = await admin.from("sponsors").select("id, contact_user_id").eq("id", t.s).maybeSingle();
    if (s?.contact_user_id === auth.user.id) return { ok: true, data: { sponsorId: s.id } };
    return { ok: false, error: "This sponsor link has expired. Ask the team for a new one." };
  }
  return { ok: true, data: { sponsorId: t.s } };
}

type FeedRow = {
  event_id: string; type: string; title: string | null; opponent: string | null; home_away: string | null; competition: string | null;
  start_at: string; end_at: string; tz: string; venue_name: string | null; status: string;
  team_score: number | null; opponent_score: number | null; score_status: string | null; player_of_match: string | null;
};

/** What a sponsor sees (whoever runs the team can preview it). Sponsor-safe fields only. */
export const getSponsorView = onLive(async (sponsorId: ID) => {
  const sb = await userClient();
  const { data: auth } = await sb.auth.getUser();
  const uid = auth.user?.id;
  const s = db.sponsors.find((x) => x.id === sponsorId && !(x as { _pub?: boolean })._pub);
  if (!uid || !s) return null;
  const today = new Date().toISOString().slice(0, 10);
  const live = s.status === "active" && (!s.endsOn || s.endsOn >= today);
  const isContact = s.contactUserId === uid && live;
  const preview = canManageSponsors(uid, s);
  if (!isContact && !preview) return null;
  const admin = adminClient();
  const teamCols = "id, name, level, color, color_secondary, logo_path, sponsor_chat, club_id";
  const { data: teamRows } = s.teamId
    ? await admin.from("teams").select(teamCols).eq("id", s.teamId)
    : await admin.from("teams").select(teamCols).eq("club_id", s.clubId!).is("archived_at", null).order("name");
  const teams = teamRows ?? [];
  const clubId = s.clubId ?? teams[0]?.club_id ?? null;
  const { data: club } = clubId ? await admin.from("clubs").select("id, name, color, color_secondary, logo_path").eq("id", clubId).maybeSingle() : { data: null };
  const since = Date.now() - 120 * 86400_000;
  const perTeam = await Promise.all(
    teams.map(async (t) => {
      const [{ data: feed }, { data: news }] = await Promise.all([sb.rpc("sponsor_feed", { p_team: t.id }), sb.rpc("sponsor_news", { p_team: t.id })]);
      const view = ((feed ?? []) as FeedRow[])
        .filter((e) => Date.parse(e.start_at) > since)
        .map((e) => {
          const hasScore = e.score_status && e.score_status !== "not_started";
          return {
            id: e.event_id, type: e.type as never, title: e.title, opponent: e.opponent, homeAway: e.home_away as never, competition: e.competition as never,
            startAt: new Date(e.start_at).toISOString(), endAt: new Date(e.end_at).toISOString(), tz: e.tz, venue: e.venue_name, status: e.status as never,
            score: hasScore ? { us: e.team_score ?? 0, them: e.opponent_score ?? 0, status: e.score_status as "live" | "final" } : null,
            playerOfMatch: e.score_status === "final" ? e.player_of_match : null,
          };
        });
      const finals = view.filter((e) => e.score?.status === "final");
      return {
        team: { id: t.id, name: t.name, level: t.level, color: t.color, colorSecondary: t.color_secondary, crest: t.logo_path },
        chat: t.sponsor_chat !== false && isContact,
        record: { w: finals.filter((e) => e.score!.us > e.score!.them).length, d: finals.filter((e) => e.score!.us === e.score!.them).length, l: finals.filter((e) => e.score!.us < e.score!.them).length },
        upcoming: view.filter((e) => Date.parse(e.endAt) >= Date.now()).slice(0, 8),
        results: view.filter((e) => e.score && (e.score.status === "final" || e.score.status === "live")).reverse().slice(0, 6),
        news: (news ?? []).slice(0, 10).map((m) => ({ id: m.message_id, subject: m.subject, body: m.body, createdAt: new Date(m.created_at).toISOString() })),
      };
    }),
  );
  const { data: fellows } = await admin.from("sponsors_public").select("*").or(s.teamId ? `team_id.eq.${s.teamId}${clubId ? `,club_id.eq.${clubId}` : ""}` : `club_id.eq.${s.clubId}`);
  return {
    sponsor: { id: s.id, name: s.name, tier: s.tier, logo: s.logo, website: s.website, blurb: s.blurb, scope: s.teamId ? ("team" as const) : ("club" as const) },
    preview: preview && !isContact,
    scopeName: s.teamId ? teams[0]?.name ?? "" : club?.name ?? "",
    club: club ? { id: club.id, name: club.name, color: club.color, colorSecondary: club.color_secondary, logo: club.logo_path } : null,
    teams: perTeam,
    fellows: (fellows ?? [])
      .filter((f) => f.id !== s.id && (s.teamId ? true : !f.team_id))
      .map(pub)
      .sort((a, b) => rank(a.tier) - rank(b.tier) || a.name.localeCompare(b.name)),
  };
});
