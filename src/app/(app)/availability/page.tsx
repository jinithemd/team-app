import type { Metadata } from "next";
import { listMyAvailability } from "@/lib/data";
import { Banner, PageHeader } from "@/components/ui";
import { AvailabilityForm, ClearButton } from "./availability-form";

export const metadata: Metadata = { title: "Unavailable dates" };

const KIND = { injured: "Injured", away: "Away", other: "Unavailable" } as const;
const fmt = (d: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(new Date(d + "T12:00:00Z"));

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<{ saved?: string; cleared?: string; edit?: string }> }) {
  const sp = await searchParams;
  const { teams, periods } = await listMyAvailability();
  const editing = periods.find((p) => p.id === sp.edit) ?? null;
  return (
    <main id="main" className="gutter mx-auto grid max-w-2xl gap-6 py-6">
      <PageHeader title="Unavailable dates" subtitle="Injured, away or busy? Mark the dates once instead of answering every event." />
      {sp.saved !== undefined && (
        <Banner>
          Saved. {sp.saved === "0" ? "Nothing is scheduled in those dates yet." : `You're down as can't make it for ${sp.saved} ${sp.saved === "1" ? "event" : "events"}.`}
        </Banner>
      )}
      {sp.cleared && <Banner>Cleared. Welcome back.</Banner>}

      {periods.length > 0 && (
        <section aria-labelledby="cur-h" className="grid gap-2">
          <h2 id="cur-h" className="text-lg font-semibold">
            Coming up
          </h2>
          <ul className="grid gap-2">
            {periods.map((p) => (
              <li key={p.id} className="grid gap-2 rounded-md border border-border p-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">
                    {KIND[p.kind]} · {fmt(p.startsOn)} – {fmt(p.endsOn)}
                  </span>
                  <a href={`/availability?edit=${p.id}#form`} className="text-sm font-semibold text-team-ink">
                    Edit
                  </a>
                </div>
                <p className="text-sm text-muted">{teams.filter((t) => p.teamIds.includes(t.id)).map((t) => t.name).join(", ")}</p>
                {p.note && <p className="text-sm">Note for captains: {p.note}</p>}
                <ClearButton periodId={p.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {teams.length === 0 ? (
        <p className="text-muted">You&apos;re not playing on any team yet.</p>
      ) : (
        <section id="form" aria-labelledby="form-h" className="grid gap-3">
          <h2 id="form-h" className="text-lg font-semibold">
            {editing ? "Change these dates" : "Mark new dates"}
          </h2>
          <AvailabilityForm key={editing?.id ?? "new"} teams={teams} period={editing} />
        </section>
      )}
    </main>
  );
}
