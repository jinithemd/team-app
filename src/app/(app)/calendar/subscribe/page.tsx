import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { myCalendarFeed } from "@/lib/data";
import { PageHeader, buttonClass } from "@/components/ui";
import { CopyLink, ResetFeed } from "./feed-bits";

export const metadata: Metadata = { title: "Add to your calendar" };

// S19: subscribe to every team's schedule in the phone's own calendar app.
export default async function SubscribePage() {
  const feed = await myCalendarFeed();
  return (
    <main id="main" className="gutter mx-auto grid max-w-2xl gap-5 py-6">
      <Link href="/calendar" className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Calendar
      </Link>
      <PageHeader title="Add to your calendar" subtitle="Games, trainings and events from all your teams show up in your phone's calendar and stay up to date. Cancellations update too." />
      <div className="grid gap-2 sm:grid-cols-2">
        <a href={feed.webcal} className={buttonClass("primary", "lg")}>
          iPhone or Mac calendar
        </a>
        <a href={feed.google} target="_blank" rel="noreferrer" className={buttonClass("secondary", "lg")}>
          Google Calendar
        </a>
      </div>
      <section className="grid gap-2 rounded-lg border border-border p-4">
        <h2 className="font-semibold">Outlook or something else</h2>
        <p className="text-sm text-muted">Choose &quot;Subscribe from web&quot; or &quot;Add calendar from URL&quot; and paste this link.</p>
        <CopyLink url={feed.https} />
      </section>
      <section className="grid gap-2">
        <p className="text-sm text-muted">Anyone with this link can see your schedule. If you shared it by mistake, reset it: the old link stops working.</p>
        <ResetFeed />
      </section>
    </main>
  );
}
