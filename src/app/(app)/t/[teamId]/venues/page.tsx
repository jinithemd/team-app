import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { getTeam, listVenues, myPerms } from "@/lib/data";
import { Banner, EmptyState } from "@/components/ui";
import { VenueForm } from "./venue-form";

export const metadata: Metadata = { title: "Venues" };

export default async function VenuesPage({ params, searchParams }: { params: Promise<{ teamId: string }>; searchParams: Promise<{ saved?: string; edit?: string }> }) {
  const { teamId } = await params;
  const sp = await searchParams;
  const [team, venues, perms] = await Promise.all([getTeam(teamId), listVenues(teamId), myPerms(teamId)]);
  if (!team) return null;
  const canEdit = perms.events || perms.games;
  const editing = venues.find((v) => v.id === sp.edit);
  return (
    <div className="grid gap-5">
      <Link href={`/t/${teamId}/settings`} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Team settings
      </Link>
      <div>
        <h2 className="text-xl font-bold">Venues</h2>
        <p className="text-sm text-muted">Save the places you play. A map pin lets players check in and get directions.</p>
      </div>
      {sp.saved && <Banner>Venue saved.</Banner>}
      {venues.length === 0 ? (
        <EmptyState icon={<MapPin />} title="No venues yet" hint="Add your home pitch and training ground." />
      ) : (
        <ul className="grid gap-2">
          {venues.map((v) => (
            <li key={v.id} className="flex items-center gap-3 rounded-md border border-border p-3">
              <MapPin aria-hidden className="size-5 shrink-0 text-team-ink" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold break-words">{v.name}</p>
                <p className="text-sm text-muted">
                  {v.lat != null ? `Pinned · check-in within ${v.radiusM} m` : "No map pin yet, so no check-in here"}
                </p>
              </div>
              {canEdit && (
                <Link href={`/t/${teamId}/venues?edit=${v.id}#venue-form`} className="text-sm font-semibold text-team-ink">
                  Edit
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <section id="venue-form" aria-labelledby="vf-h" className="grid gap-3 rounded-lg border border-border p-4">
          <h3 id="vf-h" className="text-lg font-semibold">
            {editing ? `Edit ${editing.name}` : "Add a venue"}
          </h3>
          <VenueForm key={editing?.id ?? "new"} teamId={teamId} venue={editing ?? null} />
        </section>
      )}
    </div>
  );
}
