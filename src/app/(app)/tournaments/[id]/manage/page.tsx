import { notFound } from "next/navigation";
import { awardChoices, getTournament, hostableClubs, venueLocked } from "@/lib/tournaments/service";
import { TournamentForm } from "@/components/tournament/tournament-form";
import { AwardsManager, DeleteTournament, Officials, StatusControls } from "./manage-forms";

export default async function ManagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await getTournament(id);
  if (!v) notFound();
  if (v.role !== "organizer") return <p className="text-sm text-muted">Only the tournament&apos;s organizers can change it.</p>;
  const [clubs, choices] = await Promise.all([hostableClubs(), awardChoices(v.t.id)]);
  return (
    <>
      <StatusControls id={v.t.id} status={v.t.status} hasFixtures={v.matches.length > 0} />
      <section aria-labelledby="ed-h" className="grid gap-3">
        <h2 id="ed-h" className="text-lg font-semibold">
          Details
        </h2>
        <TournamentForm clubs={clubs} t={v.t} logoUrl={v.logoUrl} bannerUrl={v.bannerUrl} locked={v.matches.length > 0} venueLocked={venueLocked(v.t)} />
      </section>
      <AwardsManager
        key={v.awards.map((a) => a.id).join(",")}
        id={v.t.id}
        teams={choices ?? []}
        awards={v.awards.map((a) => ({ id: a.id, title: a.title, winner: a.winner, team: a.team }))}
        topScorer={v.topScorers[0] ?? null}
      />
      <Officials id={v.t.id} officials={v.officials} />
      <DeleteTournament id={v.t.id} name={v.t.name} />
    </>
  );
}
