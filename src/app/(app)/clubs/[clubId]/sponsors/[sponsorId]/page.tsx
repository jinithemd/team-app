import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSponsor } from "@/lib/data";
import { SponsorForm } from "@/components/sponsor-admin";

export const metadata: Metadata = { title: "Edit sponsor" };

export default async function EditClubSponsor({ params }: { params: Promise<{ clubId: string; sponsorId: string }> }) {
  const { clubId, sponsorId } = await params;
  const s = await getSponsor(sponsorId);
  if (!s || s.clubId !== clubId) notFound();
  return (
    <div className="grid gap-5">
      <Link href={`/clubs/${clubId}/sponsors`} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Club sponsors
      </Link>
      <h2 className="text-xl font-bold">{s.name}</h2>
      <SponsorForm scope={{ clubId }} id={s.id} back={`/clubs/${clubId}/sponsors`} initial={{ name: s.name, tier: s.tier, website: s.website ?? "", blurb: s.blurb ?? "", email: s.contactEmail, startsOn: s.startsOn ?? "", endsOn: s.endsOn ?? "", logo: s.logo }} />
    </div>
  );
}
