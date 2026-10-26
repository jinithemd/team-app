import { notFound } from "next/navigation";
import { getTournament } from "@/lib/tournaments/service";
import { Bracket, ChampionBanner, StandingsTable } from "@/components/tournament/bits";

export default async function TablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await getTournament(id);
  if (!v) notFound();
  const manage = v.role !== "viewer";
  const hrefFor = manage ? (m: { id: string }) => `/tournaments/${v.t.id}/matches/${m.id}` : undefined;
  const hasKo = v.matches.some((m) => m.stage === "knockout");
  if (!v.matches.length) return <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">The table and bracket appear once fixtures are made.</p>;
  return (
    <>
      <ChampionBanner entry={v.entries.find((e) => e.id === v.championId)} />
      {v.tables.map((tb) => (
        <StandingsTable key={tb.label ?? "table"} label={tb.label} rows={tb.rows} advance={tb.advance} entries={v.entries} />
      ))}
      {hasKo && (
        <section aria-labelledby="ko-h" className="grid gap-2">
          <h2 id="ko-h" className="text-lg font-semibold">
            Knockout
          </h2>
          {v.t.format === "groups_knockout" && <p className="text-sm text-muted">Teams fill in when each group has played all its games.</p>}
          <Bracket matches={v.matches} hrefFor={hrefFor} />
        </section>
      )}
    </>
  );
}
