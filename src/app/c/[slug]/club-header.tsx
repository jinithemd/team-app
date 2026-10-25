import type { Club } from "@/lib/data/types";
import { teamThemeCss } from "@/lib/team-theme";
import { APP_NAME } from "@/lib/brand";

/** The club's own look: crest, name and colours. "Powered by" stays small. */
export function ClubHeader({ club, title, children }: { club: Club; title?: string; children?: React.ReactNode }) {
  const initials = club.name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: teamThemeCss(club.id, club.color, club.colorSecondary) }} />
      <div data-team={club.id} className="gutter border-b-4 border-team-2 bg-team pt-[calc(env(safe-area-inset-top,0px)+28px)] pb-6 text-on-team">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          {club.logo ? (
            <img src={club.logo} alt="" className="size-16 shrink-0 rounded-lg bg-bg object-contain p-1" />
          ) : (
            <span aria-hidden className="grid size-16 shrink-0 place-items-center bg-team-2 font-display text-2xl font-bold text-on-team-2 [clip-path:polygon(0_0,100%_0,100%_62%,50%_100%,0_62%)]">
              {initials}
            </span>
          )}
          <div className="min-w-0">
            {title && <p className="text-sm opacity-90">{title}</p>}
            <h1 className="font-display text-display leading-none font-bold break-words uppercase">{club.name}</h1>
            {children}
          </div>
        </div>
      </div>
    </>
  );
}

export function PoweredBy() {
  return <p className="text-center text-xs text-muted">Powered by {APP_NAME}</p>;
}
