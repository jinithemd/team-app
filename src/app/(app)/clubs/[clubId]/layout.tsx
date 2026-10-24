import Link from "next/link";
import { notFound } from "next/navigation";
import { getClubAdmin } from "@/lib/data";
import { CLUB_ROLE_LABEL } from "@/lib/data/types";
import { teamThemeCss } from "@/lib/team-theme";

export default async function ClubLayout({ children, params }: { children: React.ReactNode; params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const c = await getClubAdmin(clubId);
  if (!c) notFound();
  const initials = c.club.name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div data-team={c.club.id} className="min-h-full">
      <style dangerouslySetInnerHTML={{ __html: teamThemeCss(c.club.id, c.club.color, c.club.colorSecondary) }} />
      <header className="gutter border-b-4 border-team-2 bg-team pt-[calc(env(safe-area-inset-top,0px)+20px)] pb-4 text-on-team">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {c.club.logo ? (
            <img src={c.club.logo} alt="" className="size-12 shrink-0 rounded-lg bg-bg object-contain p-0.5" />
          ) : (
            <span aria-hidden className="grid size-12 shrink-0 place-items-center bg-team-2 pb-1.5 font-display text-lg font-bold text-on-team-2 [clip-path:polygon(0_0,100%_0,100%_62%,50%_100%,0_62%)]">
              {initials}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-2xl leading-tight font-bold break-words uppercase">{c.club.name}</h1>
            <p className="text-sm opacity-90">You&apos;re the {CLUB_ROLE_LABEL[c.myRole].toLowerCase()}</p>
          </div>
        </div>
      </header>
      <nav aria-label="Club sections" className="gutter border-b border-border bg-bg">
        <ul className="mx-auto flex max-w-3xl gap-1 overflow-x-auto">
          {[
            [`/clubs/${clubId}`, "Club"],
            [`/clubs/${clubId}/stats`, "Stats"],
            ...(c.canEdit ? [[`/clubs/${clubId}/sponsors`, "Sponsors"]] : []),
            ...(c.canEdit ? [[`/clubs/${clubId}/settings`, "Settings"]] : []),
            [`/c/${c.club.slug}`, "Public page"],
          ].map(([href, label]) => (
            <li key={href}>
              <Link href={href} className="inline-flex min-h-12 items-center px-2.5 text-sm font-semibold whitespace-nowrap text-muted hover:text-fg">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <main id="main" className="gutter mx-auto max-w-3xl py-5">
        {children}
      </main>
    </div>
  );
}
