import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listMyPrefs } from "@/lib/data";
import { EmptyState, PageHeader } from "@/components/ui";
import { Bell } from "lucide-react";
import { PrefsForm } from "./prefs-form";

export const metadata: Metadata = { title: "Notifications" };

// S22: per-team notification settings.
export default async function NotificationsPage() {
  const teams = await listMyPrefs();
  return (
    <main id="main" className="gutter mx-auto grid max-w-2xl gap-5 py-6">
      <Link href="/account" className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Account
      </Link>
      <PageHeader title="Notifications" subtitle="Set these for each team. Cancellations always reach you." />
      {teams.length === 0 ? (
        <EmptyState icon={<Bell />} title="Not on a team yet" />
      ) : (
        teams.map((t) => (
          <section key={t.teamId} data-team={t.teamId} aria-label={t.teamName} className="grid gap-3 rounded-lg border border-border p-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <span aria-hidden className="size-3 rounded-pill bg-team ring-1 ring-border" />
              {t.teamName}
            </h2>
            <PrefsForm teamId={t.teamId} prefs={t.prefs} />
          </section>
        ))
      )}
    </main>
  );
}
