import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getClubPage, getSessionUser } from "@/lib/data";
import { SignUpForm } from "@/app/login/sign-up-form";
import { ClubHeader, PoweredBy } from "../club-header";

export const metadata: Metadata = { title: "Sign in" };

// The club's own sign-in: their name and colours, same account as everywhere else.
export default async function ClubSignIn({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getClubPage(slug);
  if (!c) notFound();
  if (await getSessionUser()) redirect(`/c/${slug}`);
  return (
    <main className="min-h-dvh bg-surface pb-10">
      <ClubHeader club={c.club} title="Sign in to" />
      <div data-team={c.club.id} className="gutter mx-auto grid max-w-md gap-5 py-6">
        <p className="text-muted">{c.teams.length} teams, one club. Schedules, answers, dues and chat for every player.</p>
        <section className="grid gap-3 rounded-lg border border-border bg-bg p-4">
          <h2 className="text-lg font-semibold">Your name and email</h2>
          <SignUpForm next={`/c/${slug}`} />
        </section>
        <p className="text-center text-sm">
          <Link href={`/c/${slug}`} className="font-semibold text-team-ink">
            New to the club? See our teams
          </Link>
        </p>
        <PoweredBy />
      </div>
    </main>
  );
}
