import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { getTournament } from "@/lib/tournaments/service";
import { FORMAT_LABEL } from "@/lib/tournaments/engine";
import { StatusPill, TournamentLogo, fmtDates } from "@/components/tournament/bits";
import { TournamentTabs } from "@/components/tournament/tabs";
import { ShareLink } from "@/components/tournament/share-link";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const v = await getTournament((await params).id);
  return { title: v?.t.name ?? "Tournament" };
}

export default async function TournamentLayout({ params, children }: { params: Promise<{ id: string }>; children: React.ReactNode }) {
  const { id } = await params;
  const v = await getTournament(id);
  if (!v) notFound();
  const { t } = v;
  const tableLabel = t.format === "knockout" ? "Bracket" : t.format === "groups_knockout" ? "Groups & bracket" : "Table";
  return (
    <div className="min-h-full">
      <header className="gutter border-b border-border bg-surface pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-4">
        <div className="mx-auto grid max-w-3xl gap-3">
          <Link href="/tournaments" className="inline-flex min-h-8 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
            <ArrowLeft aria-hidden className="size-4" />
            Tournaments
          </Link>
          <div className="flex items-center gap-3">
            <TournamentLogo url={v.logoUrl} name={t.name} size={64} />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl leading-tight font-bold break-words uppercase">{t.name}</h1>
              <p className="text-sm text-muted">{[v.clubName, FORMAT_LABEL[t.format], fmtDates(t)].filter(Boolean).join(" · ")}</p>
              {t.venueName && (
                <p className="flex items-center gap-1 text-sm text-muted">
                  <MapPin aria-hidden className="size-3.5 shrink-0" />
                  <span className="truncate">{t.venueName}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={t.status} />
            {v.role !== "viewer" && <span className="text-xs font-semibold text-muted">{v.role === "organizer" ? "You're an organizer" : "You're a match official"}</span>}
            {t.isPublic && (
              <span className="ml-auto flex items-center gap-2">
                <Link href={`/tournament/${t.slug}`} className="text-sm font-semibold text-team-ink underline">
                  Public page
                </Link>
                <ShareLink path={`/tournament/${t.slug}`} title={t.name} />
              </span>
            )}
          </div>
        </div>
      </header>
      <TournamentTabs id={t.id} tableLabel={tableLabel} manage={v.role === "organizer"} />
      <div className="gutter mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-5 py-5">{children}</div>
    </div>
  );
}
