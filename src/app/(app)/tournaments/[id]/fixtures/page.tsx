import { notFound } from "next/navigation";
import { getTournament } from "@/lib/tournaments/service";
import { Banner } from "@/components/ui";
import { FixtureList } from "@/components/tournament/bits";

export default async function FixturesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ made?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const v = await getTournament(id);
  if (!v) notFound();
  const manage = v.role !== "viewer";
  const visible = v.matches.filter((m) => !(m.homeSource === "BYE" && m.awaySource === "BYE"));
  return (
    <>
      {sp.made && <Banner>{sp.made} fixtures made. Tap any one to set its time and field, and to enter the score.</Banner>}
      {manage && visible.length > 0 && <p className="text-sm text-muted">Tap a match to set the time and field or enter the result.</p>}
      <FixtureList
        matches={visible}
        hrefFor={manage ? (m) => `/tournaments/${v.t.id}/matches/${m.id}` : undefined}
        empty={v.role === "organizer" ? "No fixtures yet. Once your teams are in, make them on the Teams tab." : "Fixtures appear here once the organizers make them."}
      />
    </>
  );
}
