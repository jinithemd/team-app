import type { Metadata } from "next";
import { DEFAULT_TZ } from "@/lib/time";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays, MapPin, Megaphone, MessageCircle, Trophy } from "lucide-react";
import { getSponsorView } from "@/lib/data";
import { Banner, EmptyState } from "@/components/ui";
import { SponsorMark, SponsorStrip, TierBadge } from "@/components/sponsor-badge";
import { teamThemeCss } from "@/lib/team-theme";
import { eventTitle } from "@/lib/event-title";
import { formatDateBlock, formatLongDate, formatTime } from "@/lib/time";
import { EVENT_TYPE_LABEL } from "@/lib/data/types";

export const metadata: Metadata = { title: "Sponsor page" };

// What a sponsor sees: main events, results and news the team shares. Built only from
// getSponsorView, which never returns rosters, answers, chat, dues or contacts.
export default async function SponsorView({ params, searchParams }: { params: Promise<{ sponsorId: string }>; searchParams: Promise<{ welcome?: string }> }) {
  const { sponsorId } = await params;
  const sp = await searchParams;
  const v = await getSponsorView(sponsorId);
  if (!v) notFound();
  const lead = v.teams[0]?.team;
  const themeId = v.club?.id ?? lead?.id ?? v.sponsor.id;
  const color = v.club && v.sponsor.scope === "club" ? v.club.color : lead?.color ?? "#2346D8";
  const color2 = v.club && v.sponsor.scope === "club" ? v.club.colorSecondary : lead?.colorSecondary ?? null;
  return (
    <div data-team={themeId} className="min-h-full">
      <style dangerouslySetInnerHTML={{ __html: teamThemeCss(themeId, color, color2) }} />
      <header className="gutter border-b-4 border-team-2 bg-team pt-[calc(env(safe-area-inset-top,0px)+20px)] pb-5 text-on-team">
        <div className="mx-auto grid max-w-3xl gap-3">
          <div className="flex items-center gap-3">
            <SponsorMark s={v.sponsor} big />
            <div className="min-w-0">
              <p className="text-sm opacity-90">Sponsor of</p>
              <h1 className="font-display text-2xl leading-tight font-bold break-words uppercase">{v.scopeName}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{v.sponsor.name}</span>
            <TierBadge tier={v.sponsor.tier} size="lg" />
          </div>
        </div>
      </header>
      <main id="main" className="gutter mx-auto grid max-w-3xl gap-6 py-6">
        {v.preview && <Banner tone="warning">This is what {v.sponsor.name} sees. You&apos;re looking because you run the team.</Banner>}
        {sp.welcome && <Banner>Welcome. You&apos;ll see the matches, results and news the team shares with its sponsors.</Banner>}

        {v.teams.map((t) => (
          <section key={t.team.id} aria-labelledby={`t-${t.team.id}`} className="grid gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`t-${t.team.id}`} className="text-xl font-bold">
                {t.team.name}
              </h2>
              {t.record.w + t.record.d + t.record.l > 0 && (
                <p className="text-sm text-muted tabular">
                  Lately: {t.record.w} won · {t.record.d} drawn · {t.record.l} lost
                </p>
              )}
            </div>
            {t.chat && (
              <Link href={`/sponsor-chat/${t.team.id}`} className="flex items-center gap-3 rounded-lg bg-team-soft p-3.5 font-semibold text-team-ink hover:underline">
                <MessageCircle aria-hidden className="size-5 shrink-0" />
                <span className="flex-1">Chat with the team</span>
              </Link>
            )}

            {t.results.length > 0 && (
              <div className="grid gap-2">
                <h3 className="eyebrow">Results</h3>
                <ul className="grid gap-2">
                  {t.results.map((e) => {
                    const r = e.score!;
                    const res = r.status === "live" ? "Live" : r.us > r.them ? "Win" : r.us < r.them ? "Loss" : "Draw";
                    return (
                      <li key={e.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                        <span className="w-16 shrink-0 text-center font-display text-2xl font-bold tabular">
                          {r.us}–{r.them}
                        </span>
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="block font-semibold">
                            {res} {eventTitle(e)}
                          </span>
                          <span className="block text-muted">
                            {formatLongDate(e.startAt, e.tz)}
                            {e.playerOfMatch && (
                              <>
                                {" · "}
                                <Trophy aria-hidden className="inline size-3.5 align-[-2px]" /> {e.playerOfMatch}
                              </>
                            )}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="grid gap-2">
              <h3 className="eyebrow">Coming up</h3>
              {t.upcoming.length === 0 ? (
                <p className="text-sm text-muted">Nothing on the calendar yet.</p>
              ) : (
                <ul className="grid gap-2">
                  {t.upcoming.map((e) => {
                    const d = formatDateBlock(e.startAt, e.tz);
                    return (
                      <li key={e.id} className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 rounded-lg border border-border p-3">
                        <div className="text-center">
                          <div className="eyebrow">{d.dow}</div>
                          <div className="font-display text-2xl leading-none font-bold">{d.day}</div>
                          <div className="text-[11px] text-muted">{d.month}</div>
                        </div>
                        <div className="min-w-0 text-sm">
                          <p className={`font-semibold ${e.status === "cancelled" ? "text-muted line-through" : ""}`}>{eventTitle(e)}</p>
                          <p className="text-muted">
                            {EVENT_TYPE_LABEL[e.type]}
                            {e.competition ? ` · ${e.competition[0].toUpperCase()}${e.competition.slice(1)}` : ""} · {formatTime(e.startAt, e.tz)}
                            {e.status !== "active" ? ` · ${e.status}` : ""}
                          </p>
                          {e.venue && (
                            <p className="flex items-center gap-1 text-muted">
                              <MapPin aria-hidden className="size-3.5 shrink-0" />
                              {e.venue}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {t.news.length > 0 && (
              <div className="grid gap-2">
                <h3 className="eyebrow">News from the team</h3>
                <ul className="grid gap-2">
                  {t.news.map((n) => (
                    <li key={n.id} className="rounded-lg bg-surface p-3.5">
                      <p className="flex items-center gap-2 font-semibold">
                        <Megaphone aria-hidden className="size-4 shrink-0 text-team-ink" />
                        {n.subject}
                      </p>
                      <p className="mt-1 text-sm whitespace-pre-line">{n.body}</p>
                      <p className="mt-1 text-xs text-muted">{new Date(n.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: DEFAULT_TZ })}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}
        {v.teams.length === 0 && <EmptyState icon={<CalendarDays />} title="No teams yet" />}

        {v.fellows.length > 0 && <SponsorStrip sponsors={v.fellows} title="Fellow sponsors" />}
        <p className="text-xs text-muted">Sponsors see fixtures, results and shared news. Players&apos; details, chat and answers stay with the team.</p>
      </main>
    </div>
  );
}
