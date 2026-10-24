import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SponsorForm } from "@/components/sponsor-admin";

export const metadata: Metadata = { title: "Add a club sponsor" };

export default async function NewClubSponsor({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  return (
    <div className="grid gap-5">
      <Link href={`/clubs/${clubId}/sponsors`} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Club sponsors
      </Link>
      <h2 className="text-xl font-bold">Add a club sponsor</h2>
      <SponsorForm scope={{ clubId }} id={null} back={`/clubs/${clubId}/sponsors`} initial={{ name: "", tier: "platinum", website: "", blurb: "", email: "", startsOn: "", endsOn: "", logo: null }} />
    </div>
  );
}
