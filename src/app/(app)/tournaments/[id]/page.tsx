import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournament } from "@/lib/tournaments/service";
import { Banner, buttonClass } from "@/components/ui";
import { AwardsBoard, ChampionBanner, FixtureList, fmtKickoff, money } from "@/components/tournament/bits";
import { ApplyForm, WithdrawButton } from "@/components/tournament/entry-actions";
import { tournamentCollector } from "@/lib/payments/service";
import { priceFor } from "@/lib/payments/pricing";
import { PayButton } from "@/components/payments";

export default async function TournamentOverview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ payment?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const v = await getTournament(id);
  if (!v) notFound();
  const { t } = v;
  const manage = v.role !== "viewer";
  const accepted = v.entries.filter((e) => e.status === "accepted");
  const live = v.matches.filter((m) => m.status === "live");
  const upcoming = v.matches.filter((m) => m.status === "scheduled" && m.home && m.away).slice(0, 4);
  const recent = v.matches.filter((m) => m.status === "finished" && m.homeSource !== "BYE" && m.awaySource !== "BYE").slice(-4).reverse();
  const mine = v.entries.filter((e) => e.mine);
  const owing = t.feeCents > 0 && mine.some((e) => e.status === "accepted" && !e.paid);
  const online = owing ? (await tournamentCollector(t.id))?.active ?? false : false;
  const hrefFor = manage ? (m: { id: string }) => `/tournaments/${t.id}/matches/${m.id}` : undefined;
  return (
    <>
      {sp.payment === "cancelled" && <Banner tone="warning">Payment cancelled. Nothing was charged.</Banner>}
      <ChampionBanner entry={v.entries.find((e) => e.id === v.championId)} />
      {(v.awards.length > 0 || v.topScorers.length > 0) && (
        <section aria-labelledby="awards-h" className="grid gap-3">
          <h2 id="awards-h" className="text-lg font-semibold">
            Awards
          </h2>
          <AwardsBoard awards={v.awards} topScorers={v.topScorers} />
        </section>
      )}

      {v.role === "organizer" && !v.matches.length && (
        <Banner>
          {accepted.length < 2 ? (
            <>
              Next: add teams.{" "}
              <Link href={`/tournaments/${t.id}/teams`} className="font-semibold text-team-ink underline">
                Invite or add teams
              </Link>
            </>
          ) : (
            <>
              {accepted.length} teams are in. When everyone&apos;s in,{" "}
              <Link href={`/tournaments/${t.id}/teams#fixtures`} className="font-semibold text-team-ink underline">
                make the fixtures
              </Link>
              .
            </>
          )}
        </Banner>
      )}

      {mine.length > 0 && (
        <section aria-labelledby="mine-h" className="grid gap-2">
          <h2 id="mine-h" className="eyebrow">
            Your teams
          </h2>
          <ul className="grid gap-2">
            {mine.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                <span>
                  <strong>{e.name}</strong>{" "}
                  <span className="text-muted">
                    {e.status === "accepted" ? "is in" : e.status === "applied" ? "· waiting for the organizers" : e.status === "invited" ? "· invited (answer in Tournaments)" : `· ${e.status}`}
                    {t.feeCents > 0 && e.status === "accepted" ? (e.paid ? " · fee paid" : ` · fee ${money(t.feeCents, t.currency)} not paid yet`) : ""}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {online && e.status === "accepted" && !e.paid && (
                    <PayButton kind="tournament" refId={e.id} scopeId={t.id} price={priceFor(t.feeCents)} label="Pay entry fee" />
                  )}
                  {e.status === "accepted" && (
                    <Link href={`/tournaments/${t.id}/teams/${e.id}`} className={buttonClass(e.rosterSubmittedAt ? "secondary" : "primary", "sm")}>
                      {e.rosterSubmittedAt ? "Roster submitted" : "Add your roster"}
                    </Link>
                  )}
                  {["accepted", "applied", "invited"].includes(e.status) && !v.matches.length && <WithdrawButton id={t.id} entryId={e.id} />}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {v.canApplyWith.length > 0 && <ApplyForm id={t.id} teams={v.canApplyWith} />}

      {live.length > 0 && (
        <section aria-labelledby="live-h" className="grid gap-2">
          <h2 id="live-h" className="eyebrow text-danger">
            Live now
          </h2>
          <FixtureList matches={live} hrefFor={hrefFor} empty="" byStage={false} />
        </section>
      )}
      {upcoming.length > 0 && (
        <section aria-labelledby="next-h" className="grid gap-2">
          <h2 id="next-h" className="eyebrow">
            Coming up
          </h2>
          <FixtureList matches={upcoming} hrefFor={hrefFor} empty="" byStage={false} />
        </section>
      )}
      {recent.length > 0 && (
        <section aria-labelledby="res-h" className="grid gap-2">
          <h2 id="res-h" className="eyebrow">
            Latest results
          </h2>
          <FixtureList matches={recent} hrefFor={hrefFor} empty="" byStage={false} />
        </section>
      )}

      <section aria-labelledby="about-h" className="grid gap-3 rounded-lg border border-border p-4 text-sm">
        <h2 id="about-h" className="text-lg font-semibold">
          About
        </h2>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
          <dt className="text-muted">Teams</dt>
          <dd>
            {accepted.length}
            {t.maxTeams ? ` of ${t.maxTeams}` : ""}
          </dd>
          <dt className="text-muted">Entry fee</dt>
          <dd>{t.feeCents ? `${money(t.feeCents, t.currency)} per team` : "Free"}</dd>
          {t.feeCents > 0 && t.payTo && (
            <>
              <dt className="text-muted">How to pay</dt>
              <dd className="break-words">{t.payTo}</dd>
            </>
          )}
          <dt className="text-muted">Rosters</dt>
          <dd>
            {[t.rosterMax ? `Up to ${t.rosterMax} players` : "Any number of players", t.rosterMin ? `at least ${t.rosterMin}` : null, "plus a manager and a coach"].filter(Boolean).join(", ")}
            {t.rosterDeadline ? `. Due ${fmtKickoff(t.rosterDeadline)}` : ". Due before each team's first game"}
          </dd>
          {t.rosterRules && (
            <>
              <dt className="text-muted">Player criteria</dt>
              <dd className="break-words whitespace-pre-line">{t.rosterRules}</dd>
            </>
          )}
          <dt className="text-muted">Points</dt>
          <dd>
            Win {t.pointsWin} · Draw {t.pointsDraw} · Loss {t.pointsLoss}
          </dd>
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
            <p className="whitespace-pre-line text-fg">{t.rules}</p>
          </div>
        )}
      </section>
    </>
  );
}
