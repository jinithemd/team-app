import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { getClubPage } from "@/lib/data";
import { ButtonLink } from "@/components/ui";
import { ClubHeader, PoweredBy } from "./club-header";
import { AskToJoin } from "./ask-to-join";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await getClubPage((await params).slug);
  return c
    ? { title: c.club.name, description: c.club.blurb ?? `${c.club.name}: teams, schedules and how to join.`, manifest: `/c/${c.club.slug}/manifest.webmanifest` }
    : { title: "Club" };
}

// The club's public page: share it on posters and WhatsApp. Anyone can see the teams;
// signed-in players can ask to join one.
export default async function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getClubPage(slug);
  if (!c) notFound();
  return (
    <main className="min-h-dvh bg-surface pb-10">
      <ClubHeader club={c.club}>{c.club.blurb && <p className="mt-2 text-sm opacity-90">{c.club.blurb}</p>}</ClubHeader>
      <div data-team={c.club.id} className="gutter mx-auto grid max-w-2xl gap-4 py-6">
        {c.isAdmin && (
          <Link href={`/clubs/${c.club.id}`} className="justify-self-start text-sm font-semibold text-team-ink">
            Open club admin
          </Link>
        )}
        <h2 className="text-lg font-semibold">
          {c.teams.length} {c.teams.length === 1 ? "team" : "teams"}
        </h2>
        <ul className="grid gap-3">
          {c.teams.map((t) => (
            <li key={t.id} className="grid gap-3 rounded-lg border border-border bg-bg p-4">
              <div className="flex items-start gap-3">
                <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-pill bg-team text-on-team">
                  <Users className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold break-words">{t.name}</p>
                  <p className="text-sm text-muted">
                    {[t.level, `${t.players} players`, t.captains.length ? `Captain ${t.captains.join(" & ")}` : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
              {t.mine === "member" ? (
                <Link href={`/t/${t.id}/schedule`} className="text-sm font-semibold text-team-ink">
                  You&apos;re on this team. Open it
                </Link>
              ) : t.mine === "requested" ? (
                <p className="text-sm font-semibold text-success">Asked to join. The captain will get back to you.</p>
              ) : t.mine === "signed-out" ? (
                c.club.joinOpen && (
                  <ButtonLink href={`/c/${slug}/login`} variant="secondary" size="sm" className="justify-self-start">
                    Sign in to join
                  </ButtonLink>
                )
              ) : c.club.joinOpen ? (
                <AskToJoin teamId={t.id} path={`/c/${slug}`} />
              ) : null}
            </li>
          ))}
        </ul>
        {!c.club.joinOpen && <p className="text-sm text-muted">{c.club.name} isn&apos;t taking new players right now.</p>}
        {!c.signedIn && (
          <p className="text-center text-sm">
            <Link href={`/c/${slug}/login`} className="font-semibold text-team-ink underline">
              Sign in to {c.club.name}
            </Link>
          </p>
        )}
        <PoweredBy />
      </div>
    </main>
  );
}
