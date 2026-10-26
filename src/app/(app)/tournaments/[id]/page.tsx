import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournament } from "@/lib/tournaments/service";
import { Banner } from "@/components/ui";
import { ChampionBanner, FixtureList, money } from "@/components/tournament/bits";
import { ApplyForm, WithdrawButton } from "@/components/tournament/entry-actions";

export default async function TournamentOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await getTournament(id);
  if (!v) notFound();
  const { t } = v;
  const manage = v.role !== "viewer";
  const accepted = v.entries.filter((e) => e.status === "accepted");
  const live = v.matches.filter((m) => m.status === "live");
  const upcoming = v.matches.filter((m) => m.status === "scheduled" && m.home && m.away).slice(0, 4);
  const recent = v.matches.filter((m) => m.status === "finished" && m.homeSource !== "BYE" && m.awaySource !== "BYE").slice(-4).reverse();
  const mine = v.entries.filter((e) => e.mine);
  const hrefFor = manage ? (m: { id: string }) => `/tournaments/${t.id}/matches/${m.id}` : undefined;
  return (
    <>
      <ChampionBanner entry={v.entries.find((e) => e.id === v.championId)} />

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
                {["accepted", "applied", "invited"].includes(e.status) && !v.matches.length && <WithdrawButton id={t.id} entryId={e.id} />}
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
