import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, MapPin, Medal, Trophy } from "lucide-react";
import { getFanPage, type FanGame } from "@/lib/fans";
import { teamThemeCss } from "@/lib/team-theme";
import { APP_NAME } from "@/lib/brand";
import { APP_URL } from "@/lib/data/store";
import { formatDateBlock, formatTime } from "@/lib/time";
import { SponsorStrip } from "@/components/sponsor-badge";
import { ShareLink } from "@/components/tournament/share-link";
import { FollowButton } from "./follow-button";

// A team's fan page: what the QR poster points to. Games, results, sponsors and trophies,
// and a Follow button. Nothing about people.

const TZ = "America/Toronto";

export async function generateMetadata({ params }: { params: Promise<{ teamId: string }> }): Promise<Metadata> {
  const v = await getFanPage((await params).teamId);
  if (!v) return { title: "Team" };
  return {
    title: v.team.name,
    description: `Follow ${v.team.name} on ${APP_NAME}: fixtures, results and news.`,
    openGraph: { images: [{ url: `${APP_URL}/api/share/follow/${v.team.id}` }] },
  };
}

function Game({ g, past }: { g: FanGame; past?: boolean }) {
  const d = formatDateBlock(g.startAt, TZ);
  const label = g.type === "tournament" ? g.title ?? "Tournament" : g.opponent ? `vs ${g.opponent}` : g.title ?? "Match";
  const res = g.score ? (g.score.us > g.score.them ? "W" : g.score.us < g.score.them ? "L" : "D") : null;
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-bg p-3">
      <span className="grid w-12 shrink-0 justify-items-center leading-tight">
        <span className="text-[11px] font-semibold text-muted uppercase">{d.dow}</span>
        <span className="font-display text-xl font-bold">{d.day}</span>
        <span className="text-[11px] text-muted">{d.month}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-semibold break-words ${g.status === "cancelled" ? "text-muted line-through" : ""}`}>{label}</span>
        <span className="block text-xs text-muted">
          {[g.type === "tournament" ? "Tournament" : g.homeAway === "home" ? "Home" : g.homeAway === "away" ? "Away" : null, past ? null : formatTime(g.startAt, TZ), g.locationText]
            .filter(Boolean)
            .join(" · ")}
          {g.status !== "active" && <span className="font-semibold text-danger"> · {g.status === "cancelled" ? "Cancelled" : "Postponed"}</span>}
        </span>
      </span>
      {g.score && (
        <span className="grid shrink-0 justify-items-end">
          <span className="font-display text-lg font-bold tabular">
            {g.score.us}–{g.score.them}
          </span>
          {res && g.score.final && <span className={`text-xs font-bold ${res === "W" ? "text-success" : res === "L" ? "text-danger" : "text-muted"}`}>{res}</span>}
          {!g.score.final && <span className="text-xs font-bold text-danger">Live</span>}
        </span>
      )}
      {g.tournamentId && !g.score && (
        <Link href={`/tournaments/${g.tournamentId}`} className="shrink-0 text-xs font-semibold text-team-ink">
          Details
        </Link>
      )}
    </li>
  );
}

export default async function FanPageView({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const v = await getFanPage(teamId);
  if (!v) notFound();
  const { team } = v;
  const initials = team.name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const wins = v.honours.filter((h) => h.place === "champions").length;
  return (
    <main className="min-h-dvh bg-surface pb-10">
      <style dangerouslySetInnerHTML={{ __html: teamThemeCss(team.id, team.color, team.colorSecondary) }} />
      <div data-team={team.id}>
        <header className="gutter border-b-4 border-team-2 bg-team pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-6 text-on-team">
          <div className="mx-auto grid max-w-2xl gap-4">
            <div className="flex items-center justify-between gap-3">
              <Link href="/" className="inline-flex rounded-md bg-[#06080D] px-3 py-2">
                <img src="/clbx-logo.png" alt={APP_NAME} width={1077} height={177} className="h-4 w-auto" />
              </Link>
              <ShareLink path={`/f/${team.id}`} title={team.name} />
            </div>
            <div className="flex items-center gap-4">
              {team.crestUrl ? (
                <img src={team.crestUrl} alt="" className="size-20 shrink-0 rounded-xl bg-bg object-cover ring-2 ring-on-team/40" />
              ) : (
                <span aria-hidden className="grid size-20 shrink-0 place-items-center rounded-pill border-2 border-on-team font-display text-3xl font-bold">
                  {initials}
                </span>
              )}
              <div className="min-w-0">
                <h1 className="font-display text-display leading-none font-bold break-words uppercase">{team.name}</h1>
                <p className="mt-1 text-sm opacity-90">{[team.clubName, team.level, team.location].filter(Boolean).join(" · ")}</p>
                {v.honours.length > 0 && (
                  <p className="mt-1.5 inline-flex items-center gap-1 rounded-pill bg-on-team px-2.5 py-0.5 text-xs font-bold text-team">
                    <Trophy aria-hidden className="size-3.5" />
                    {wins > 0 ? `${wins}× Champions` : `${v.honours.length}× Runners-up`}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <FollowButton teamId={team.id} following={v.following} signedIn={v.signedIn} member={v.isMember} />
              <span className="text-sm opacity-90">
                {v.followers} {v.followers === 1 ? "follower" : "followers"}
              </span>
            </div>
          </div>
        </header>

        <div className="gutter mx-auto grid max-w-2xl gap-5 py-5">
          {!team.isPublic && (
            <p className="flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm">
              <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
              Only your team can see this page right now. Turn on &ldquo;Public team&rdquo; in the team&apos;s settings so fans can find and follow you.
            </p>
          )}

          <section aria-labelledby="next-h" className="grid gap-2">
            <h2 id="next-h" className="eyebrow">
              Coming up
            </h2>
            {v.upcoming.length ? (
              <ul className="grid gap-2">
                {v.upcoming.map((g) => (
                  <Game key={g.id} g={g} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No games scheduled yet.</p>
            )}
          </section>

          {v.results.length > 0 && (
            <section aria-labelledby="res-h" className="grid gap-2">
              <h2 id="res-h" className="eyebrow">
                Results
              </h2>
              <ul className="grid gap-2">
                {v.results.map((g) => (
                  <Game key={g.id} g={g} past />
                ))}
              </ul>
            </section>
          )}

          {v.honours.length > 0 && (
            <section aria-labelledby="hon-h" className="grid gap-2">
              <h2 id="hon-h" className="eyebrow">
                Trophies
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {v.honours.map((h) => (
                  <li key={`${h.tournamentId}-${h.place}`} className={`flex items-center gap-3 rounded-lg border-2 p-3 ${h.place === "champions" ? "border-warning bg-warning-soft" : "border-border bg-bg"}`}>
                    {h.place === "champions" ? <Trophy aria-hidden className="size-6 shrink-0" /> : <Medal aria-hidden className="size-6 shrink-0" />}
                    <span className="min-w-0">
                      <span className="block text-xs font-bold uppercase">{h.place === "champions" ? "Champions" : "Runners-up"} · {h.year}</span>
                      <span className="block font-semibold break-words">{h.name}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {v.sponsors.length > 0 && <SponsorStrip sponsors={v.sponsors} title="Our sponsors" />}

          {v.isMember && (
            <Link href={`/t/${team.id}/share`} className="justify-self-start text-sm font-semibold text-team-ink">
              Get the QR poster for this page
            </Link>
          )}
          <p className="flex items-center justify-center gap-1 text-center text-xs text-muted">
            <MapPin aria-hidden className="size-3" />
            Times shown in Toronto time · Powered by {APP_NAME}
          </p>
        </div>
      </div>
    </main>
  );
}
