import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, MapPin, StickyNote, Users, Wallet } from "lucide-react";
import { sessionPage } from "@/lib/sessions/service";
import { teamCollector } from "@/lib/payments/service";
import { priceFor } from "@/lib/payments/pricing";
import { teamThemeCss } from "@/lib/team-theme";
import { APP_NAME } from "@/lib/brand";
import { formatLongDate, formatTimeRange, zoneLabel } from "@/lib/time";
import { Banner, buttonClass } from "@/components/ui";
import { BookButton, CancelBooking, CancelSession, PayLaterButton, StaffRow } from "@/components/session-controls";

// One game session: what, when, where, cost, spots. Book (or join the waitlist), pay, cancel.
// Team staff also see everyone booked and can tick off cash or cancel the session.

export const dynamic = "force-dynamic";

const price = (c: number) => (c ? `$${(c / 100).toFixed(2).replace(/\.00$/, "")}` : "Free");

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await sessionPage((await params).id).catch(() => null);
  if (!p) return { title: "Session" };
  return { title: `${p.s.title} · ${p.team.name}`, description: `${formatLongDate(p.s.startsAt, p.s.tz)} · ${price(p.s.priceCents)} · book a spot on ${APP_NAME}` };
}

export default async function SessionView({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ posted?: string; payment?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const p = await sessionPage(id);
  if (!p) notFound();
  const { s } = p;
  const collect = await teamCollector(s.teamId).catch(() => null);
  const online = !!collect?.active && s.priceCents > 0;
  const cancelled = s.status === "cancelled";
  const booked = p.people.filter((x) => x.status !== "waitlist");
  const waiting = p.people.filter((x) => x.status === "waitlist");
  const spotsLeft = p.member ? p.spots.memberLeft : p.spots.openLeft;
  const back = p.member ? `/t/${s.teamId}/sessions` : `/f/${s.teamId}`;
  const mapsHref = s.venueAddress || s.venueName ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([s.venueName, s.venueAddress].filter(Boolean).join(", "))}` : null;
  return (
    <main className="min-h-dvh bg-surface pb-10">
      <style dangerouslySetInnerHTML={{ __html: teamThemeCss(s.teamId, p.team.color, p.team.colorSecondary) }} />
      <div data-team={s.teamId}>
        <header className="gutter border-b-4 border-team-2 bg-team pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-5 text-on-team">
          <div className="mx-auto grid max-w-2xl gap-3">
            <Link href={back} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold">
              <ArrowLeft aria-hidden className="size-4" />
              {p.team.name}
            </Link>
            <p className="text-xs font-bold tracking-[.08em] uppercase opacity-90">Drop-in session{s.seriesId ? " · every week" : ""}</p>
            <h1 className={`font-display text-display leading-none font-bold break-words uppercase ${cancelled ? "line-through opacity-70" : ""}`}>{s.title}</h1>
          </div>
        </header>

        <div className="gutter mx-auto grid max-w-2xl gap-5 py-5">
          {sp.posted && <Banner>Posted. Your players and supporters have been told.</Banner>}
          {sp.payment === "cancelled" && <Banner tone="warning">Payment cancelled, so the spot wasn&apos;t booked.</Banner>}
          {cancelled && <Banner tone="danger">This session is cancelled.</Banner>}
          {p.manage && Date.parse(s.postAt) > Date.now() && (
            <Banner tone="warning">
              Not posted yet. It goes up {new Date(s.postAt).toLocaleString("en-CA", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: s.tz })} and everyone gets told.
            </Banner>
          )}

          <dl className="grid gap-2.5 rounded-lg border border-border bg-bg p-4 text-sm">
            <div className="flex items-start gap-2.5">
              <dt className="sr-only">When</dt>
              <Clock aria-hidden className="mt-0.5 size-[18px] shrink-0 text-muted" />
              <dd>
                <span className="font-semibold">{formatLongDate(s.startsAt, s.tz)}</span>
                <br />
                {formatTimeRange(s.startsAt, s.endsAt, s.tz)} <span className="text-muted">· {zoneLabel(s.tz)}</span>
              </dd>
            </div>
            {(s.venueName || s.venueAddress) && (
              <div className="flex items-start gap-2.5">
                <dt className="sr-only">Where</dt>
                <MapPin aria-hidden className="mt-0.5 size-[18px] shrink-0 text-muted" />
                <dd className="min-w-0">
                  {s.venueName && <span className="block break-words">{s.venueName}</span>}
                  {s.venueAddress && <span className="block text-muted break-words">{s.venueAddress}</span>}
                  {mapsHref && (
                    <a href={mapsHref} target="_blank" rel="noreferrer" className="font-semibold text-team-ink">
                      Open in Maps
                    </a>
                  )}
                </dd>
              </div>
            )}
            <div className="flex items-start gap-2.5">
              <dt className="sr-only">Cost</dt>
              <Wallet aria-hidden className="mt-0.5 size-[18px] shrink-0 text-muted" />
              <dd>
                <span className="font-semibold">{price(s.priceCents)}</span> {s.priceCents > 0 && <span className="text-muted">per player{online ? `, paid by card when you book (${`$${(priceFor(s.priceCents).total / 100).toFixed(2)}`} with the online fee)` : ", pay at the door or by e-Transfer"}</span>}
              </dd>
            </div>
            <div className="flex items-start gap-2.5">
              <dt className="sr-only">Spots</dt>
              <Users aria-hidden className="mt-0.5 size-[18px] shrink-0 text-muted" />
              <dd>
                <span className={`font-semibold ${spotsLeft ? "" : "text-warning"}`}>{spotsLeft ? `${spotsLeft} of ${s.capacity} spots left` : `Full (${s.capacity} spots)`}</span>
                {p.spots.held > 0 && (
                  <span className="block text-muted">
                    {p.spots.held} kept for {p.team.name} players
                    {s.releaseAt ? ` until ${new Date(s.releaseAt).toLocaleString("en-CA", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: s.tz })}` : ""}
                  </span>
                )}
                {p.spots.waitlist > 0 && <span className="block text-muted">{p.spots.waitlist} on the waitlist</span>}
              </dd>
            </div>
            {s.notes && (
              <div className="flex items-start gap-2.5">
                <dt className="sr-only">Notes</dt>
                <StickyNote aria-hidden className="mt-0.5 size-[18px] shrink-0 text-muted" />
                <dd className="break-words whitespace-pre-line">{s.notes}</dd>
              </div>
            )}
          </dl>

          {!cancelled && (
            <section aria-labelledby="book-h" className="grid gap-3 rounded-lg border border-border bg-bg p-4">
              <h2 id="book-h" className="text-lg font-semibold">
                Your spot
              </h2>
              {!p.signedIn ? (
                <>
                  <p className="text-sm text-muted">Sign in (or make a free account) to book. It takes a minute, no password.</p>
                  <Link href={`/login?next=${encodeURIComponent(`/s/${s.id}`)}`} className={buttonClass("primary", "lg", "w-full")}>
                    Sign in to book
                  </Link>
                </>
              ) : p.mine?.status === "booked" ? (
                <>
                  <p className="text-sm font-semibold text-success">You&apos;re in. See you there!</p>
                  {s.priceCents > 0 && !p.mine.paid && (online ? <PayLaterButton sessionId={s.id} label={`Pay now · $${(priceFor(s.priceCents).total / 100).toFixed(2)}`} /> : <p className="text-sm text-muted">Bring {price(s.priceCents)} or e-Transfer the organiser.</p>)}
                  {p.mine.paid && <p className="text-sm text-muted">Paid{p.mine.paid === "card" ? " by card" : ""}.</p>}
                  {!p.started && <CancelBooking sessionId={s.id} waitlist={false} />}
                </>
              ) : p.mine?.status === "waitlist" ? (
                <>
                  <p className="text-sm font-semibold text-warning">You&apos;re number {p.waitPos} on the waitlist. We&apos;ll email you if a spot opens up.</p>
                  <CancelBooking sessionId={s.id} waitlist />
                </>
              ) : p.canBook ? (
                <>
                  {p.canBook === "member" && p.spots.held > 0 && <p className="text-sm text-muted">You&apos;re on {p.team.name}, so you can use the spots kept for players.</p>}
                  <BookButton
                    sessionId={s.id}
                    waitlist={p.canBook === "waitlist"}
                    label={p.canBook === "waitlist" ? "Join the waitlist" : online ? `Book and pay · $${(priceFor(s.priceCents).total / 100).toFixed(2)}` : "Book a spot"}
                  />
                  {!p.member && <p className="text-xs text-muted">Booking follows {p.team.name}, so you hear about the next sessions.</p>}
                </>
              ) : (
                <p className="text-sm text-muted">{p.started ? "This session has started." : "Bookings are closed."}</p>
              )}
            </section>
          )}

          {p.manage && (
            <section aria-labelledby="who-h" className="grid gap-3 rounded-lg border border-border bg-bg p-4">
              <h2 id="who-h" className="flex items-baseline justify-between gap-2 text-lg font-semibold">
                Who&apos;s coming
                <span className="text-sm font-normal text-muted">
                  {booked.length} of {s.capacity}
                  {s.priceCents > 0 ? ` · ${booked.filter((b) => b.paid).length} paid` : ""}
                </span>
              </h2>
              {booked.length === 0 ? (
                <p className="text-sm text-muted">Nobody yet.</p>
              ) : (
                <ul>
                  {booked.map((b) => (
                    <li key={b.bookingId} className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0">
                      <span className="min-w-0">
                        <span className="block font-semibold">{b.name}</span>
                        <span className="block text-xs text-muted">{[b.member ? "Player" : "Supporter", b.status === "held" ? "paying now" : null].filter(Boolean).join(" · ")}</span>
                      </span>
                      <StaffRow sessionId={s.id} bookingId={b.bookingId} name={b.name} paid={b.paid} priced={s.priceCents > 0} />
                    </li>
                  ))}
                </ul>
              )}
              {waiting.length > 0 && (
                <>
                  <h3 className="eyebrow">Waitlist ({waiting.length})</h3>
                  <ol className="grid gap-1 pl-5 text-sm [list-style:decimal]">
                    {waiting.map((b) => (
                      <li key={b.bookingId}>
                        {b.name} <span className="text-muted">· {b.member ? "Player" : "Supporter"}</span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
              {!cancelled && <CancelSession sessionId={s.id} />}
            </section>
          )}
          <p className="text-center text-xs text-muted">Powered by {APP_NAME}</p>
        </div>
      </div>
    </main>
  );
}
