import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { getTournament } from "@/lib/tournaments/service";
import { FORMAT_LABEL } from "@/lib/tournaments/engine";
import { APP_NAME } from "@/lib/brand";
import { TeamCrest } from "@/components/ui";
import { Bracket, ChampionBanner, FixtureList, StandingsTable, StatusPill, TournamentLogo, fmtDates, money } from "@/components/tournament/bits";
import { ShareLink } from "@/components/tournament/share-link";
import { ApplyForm } from "@/components/tournament/entry-actions";

// T7: the public tournament page. Anyone with the link (no account needed) sees fixtures,
// results, the table or bracket and the teams; captains can enter their team.

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const v = await getTournament((await params).slug);
  if (!v) return { title: "Tournament" };
  return {
    title: v.t.name,
    description: `${[v.clubName, FORMAT_LABEL[v.t.format], fmtDates(v.t)].filter(Boolean).join(" · ")}. Fixtures, results and table on ${APP_NAME}.`,
  };
}

export default async function PublicTournament({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const v = await getTournament(slug);
  if (!v) notFound();
  const { t } = v;
  const accepted = v.entries.filter((e) => e.status === "accepted");
  const visible = v.matches.filter((m) => !(m.homeSource === "BYE" && m.awaySource === "BYE"));
  const hasKo = v.matches.some((m) => m.stage === "knockout");
  const sections = [
    { id: "fixtures", label: "Fixtures" },
    ...(v.tables.length || hasKo ? [{ id: "table", label: t.format === "knockout" ? "Bracket" : "Table" }] : []),
    { id: "teams", label: "Teams" },
    { id: "about", label: "About" },
  ];
  return (
    <main className="min-h-dvh bg-bg">
      <header className="gutter border-b border-border bg-surface pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-4">
        <div className="mx-auto grid max-w-3xl gap-3">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="inline-flex rounded-md bg-[#06080D] px-3 py-2">
              <img src="/clbx-logo.png" alt={APP_NAME} width={1077} height={177} className="h-4 w-auto" />
            </Link>
            <ShareLink path={`/tournament/${t.slug}`} title={t.name} />
          </div>
          <div className="flex items-center gap-3">
            <TournamentLogo url={v.logoUrl} name={t.name} size={64} />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl leading-tight font-bold break-words uppercase">{t.name}</h1>
              <p className="text-sm text-muted">{[v.clubName, FORMAT_LABEL[t.format], fmtDates(t)].filter(Boolean).join(" · ")}</p>
              {t.venueName && (
                <p className="flex items-center gap-1 text-sm text-muted">
                  <MapPin aria-hidden className="size-3.5 shrink-0" />
                  <span className="truncate">{t.venueName}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={t.status} />
            {v.role !== "viewer" && (
              <Link href={`/tournaments/${t.id}`} className="text-sm font-semibold text-team-ink underline">
                Open in the app
              </Link>
            )}
          </div>
        </div>
      </header>
      <nav aria-label="Sections" className="gutter sticky top-0 z-10 border-b border-border bg-bg">
        <ul className="mx-auto flex max-w-3xl gap-1 overflow-x-auto">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="inline-flex min-h-12 items-center px-2.5 text-sm font-semibold whitespace-nowrap text-muted hover:text-fg">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="gutter mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-8 py-6">
        <ChampionBanner entry={v.entries.find((e) => e.id === v.championId)} />

        {v.canApplyWith.length > 0 && <ApplyForm id={t.id} teams={v.canApplyWith} />}
        {!v.signedIn && t.registrationOpen && ["draft", "registration"].includes(t.status) && (
          <p className="rounded-lg border-2 border-team p-4 text-sm">
            <strong>Want to enter your team?</strong>{" "}
            <Link href={`/login?next=${encodeURIComponent(`/tournament/${t.slug}`)}`} className="font-semibold text-team-ink underline">
              Sign in to {APP_NAME}
            </Link>{" "}
            as a captain or manager.
          </p>
        )}

        <section id="fixtures" aria-labelledby="fx-h" className="grid scroll-mt-16 gap-3">
          <h2 id="fx-h" className="text-xl font-bold">
            Fixtures and results
          </h2>
          <FixtureList matches={visible} empty="Fixtures will appear here once the organizers make them." />
        </section>

        {(v.tables.length > 0 || hasKo) && (
          <section id="table" aria-labelledby="tb-h" className="grid scroll-mt-16 gap-3">
            <h2 id="tb-h" className="text-xl font-bold">
              {t.format === "knockout" ? "Bracket" : t.format === "groups_knockout" ? "Groups and bracket" : "Table"}
            </h2>
            {v.tables.map((tb) => (
              <StandingsTable key={tb.label ?? "table"} label={tb.label} rows={tb.rows} advance={tb.advance} entries={v.entries} />
            ))}
            {hasKo && <Bracket matches={v.matches} />}
          </section>
        )}

        <section id="teams" aria-labelledby="tm-h" className="grid scroll-mt-16 gap-3">
          <h2 id="tm-h" className="text-xl font-bold">
            Teams <span className="text-base font-normal text-muted">({accepted.length})</span>
          </h2>
          {accepted.length === 0 ? (
            <p className="text-sm text-muted">No teams confirmed yet.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {accepted.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <TeamCrest teamId={e.teamId ?? "guest"} name={e.name} crestUrl={e.crestUrl} size={32} />
                  <span className="min-w-0 flex-1 font-semibold break-words">{e.name}</span>
                  {e.groupLabel && <span className="text-xs font-semibold text-muted">Group {e.groupLabel}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="about" aria-labelledby="ab-h" className="grid scroll-mt-16 gap-3 text-sm">
          <h2 id="ab-h" className="text-xl font-bold">
            About
          </h2>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
            <dt className="text-muted">Hosted by</dt>
            <dd>{v.clubName}</dd>
            <dt className="text-muted">Entry fee</dt>
            <dd>{t.feeCents ? `${money(t.feeCents, t.currency)} per team` : "Free"}</dd>
            {t.venueAddress && (
              <>
                <dt className="text-muted">Where</dt>
                <dd className="break-words">
                  {t.venueLat != null ? (
                    <a className="font-semibold text-team-ink underline" href={`https://www.google.com/maps/search/?api=1&query=${t.venueLat},${t.venueLng}`}>
                      {t.venueAddress}
                    </a>
                  ) : (
                    t.venueAddress
                  )}
                </dd>
              </>
            )}
          </dl>
          {t.rules && (
            <div className="grid gap-1">
              <h3 className="font-semibold">Rules</h3>
              <p className="whitespace-pre-line">{t.rules}</p>
            </div>
          )}
        </section>
        <p className="text-center text-xs text-muted">
          Run on{" "}
          <Link href="/" className="font-semibold underline">
            {APP_NAME}
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="underline">
            Privacy
          </Link>
        </p>
      </div>
    </main>
  );
}
