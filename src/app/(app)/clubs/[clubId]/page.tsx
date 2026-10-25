import { APP_URL } from "@/lib/data/store";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { getClubAdmin } from "@/lib/data";
import { ButtonLink } from "@/components/ui";
import { eventTitle } from "@/lib/event-title";
import { formatDateBlock, formatTime } from "@/lib/time";
import { CopyLink } from "@/app/(app)/calendar/subscribe/feed-bits";

export const metadata: Metadata = { title: "Club" };

const money = (c: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(c / 100);

// Club admin home: every team, this week's matches, join requests and dues at a glance.
export default async function ClubAdminPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const c = (await getClubAdmin(clubId))!;
  const dues = c.dues ?? [];
  const collected = dues.reduce((n, d) => n + d.collected, 0);
  const total = dues.reduce((n, d) => n + d.total, 0);
  const owing = dues.reduce((n, d) => n + d.owing, 0);
  const confirm = dues.reduce((n, d) => n + d.toConfirm, 0);
  return (
    <div className="grid gap-6">
      <ul className="grid grid-cols-3 gap-2" aria-label="Club at a glance">
        {[
          [c.teams.length, "teams"],
          [c.players, "players"],
          [c.requests, c.requests === 1 ? "join request" : "join requests"],
        ].map(([n, l]) => (
          <li key={String(l)} className="rounded-lg bg-team-soft px-3 py-2.5">
            <p className="font-display text-3xl leading-none font-bold text-team-ink tabular">{n}</p>
            <p className="text-xs text-muted">{l}</p>
          </li>
        ))}
      </ul>

      {c.thisWeek.length > 0 && (
        <section aria-labelledby="week-h" className="grid gap-2">
          <h2 id="week-h" className="eyebrow">
            This week across the club
          </h2>
          <ul className="grid gap-1.5 text-sm">
            {c.thisWeek.map((e) => {
              const d = formatDateBlock(e.startAt, e.tz);
              const ok = e.going >= e.needed;
              return (
                <li key={e.id}>
                  <Link href={`/t/${e.teamId}/e/${e.id}`} className="flex justify-between gap-3 py-1 hover:underline">
                    <span className="min-w-0">
                      <strong>
                        {d.dow} {formatTime(e.startAt, e.tz)}
                      </strong>{" "}
                      {e.team.replace(c.club.name.split(" FC")[0], "").trim()} {eventTitle(e)}
                    </span>
                    <span className={`shrink-0 font-semibold tabular ${ok ? "text-success" : "text-warning"}`}>
                      {e.going} of {e.needed} going
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="teams-h" className="grid gap-1">
        <div className="flex items-center justify-between">
          <h2 id="teams-h" className="eyebrow">
            Teams
          </h2>
          {c.canEdit && (
            <ButtonLink href={`/teams/new?club=${clubId}`} size="sm" variant="ghost">
              <Plus aria-hidden />
              New team
            </ButtonLink>
          )}
        </div>
        <ul>
          {c.teams.map((t) => (
            <li key={t.id}>
              <Link href={`/t/${t.id}/roster`} className="flex items-center gap-3 border-b border-border py-3 hover:bg-surface">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t.name}</span>
                  <span className="block text-sm text-muted">
                    {[t.level, t.captains.length ? `Captain ${t.captains.join(" & ")}` : "No captain yet", `${t.players} players`].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {t.requests > 0 && (
                  <span className="rounded-pill bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning">
                    {t.requests} {t.requests === 1 ? "request" : "requests"}
                  </span>
                )}
                <ChevronRight aria-hidden className="size-5 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {total > 0 && (
        <section aria-labelledby="dues-h" className="grid gap-2 rounded-lg bg-surface p-4">
          <h2 id="dues-h" className="font-semibold">
            Dues: {money(collected)} of {money(total)} collected
          </h2>
          <p className="text-sm text-muted">
            {owing} {owing === 1 ? "player still owes" : "players still owe"}
            {confirm ? ` · ${confirm} ${confirm === 1 ? "payment" : "payments"} to confirm` : ""}
          </p>
          <ul className="grid gap-1 text-sm">
            {dues
              .filter((d) => d.total > 0)
              .map((d) => (
                <li key={d.teamId} className="flex justify-between gap-3">
                  <Link href={`/t/${d.teamId}/dues`} className="font-semibold text-team-ink">
                    {d.name}
                  </Link>
                  <span className="tabular text-muted">
                    {money(d.collected)} of {money(d.total)}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="share-h" className="grid gap-2">
        <h2 id="share-h" className="font-semibold">
          Your club link
        </h2>
        <p className="text-sm text-muted">Put it on posters and in WhatsApp. New players see every team and ask to join; captains approve them.</p>
        <CopyLink url={`${APP_URL}/c/${c.club.slug}`} />
      </section>
    </div>
  );
}
