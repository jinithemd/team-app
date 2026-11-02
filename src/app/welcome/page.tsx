import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/brand";

/*
 * clbx.ca for people who aren't signed in: what Clbx is, who it's for, what it costs.
 * Signed-in members never see it ("/" takes them to their teams; see middleware.ts).
 * Screenshots in /public/landing are the real app with sample data.
 */

export const metadata: Metadata = {
  title: { absolute: `${APP_NAME}: the team app for amateur sport` },
  description: "Fixtures, who's coming, team chat, subs, tournaments and drop-in games for amateur teams and clubs. No ads. Free for players.",
  alternates: { canonical: "/" },
};

const INK = "#06080D";
const LIME = "#BAFA10";

function Phone({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`relative mx-auto w-[min(300px,78vw)] shrink-0 rounded-[42px] border-[10px] border-[#1C212B] bg-[#1C212B] shadow-[0_30px_60px_-20px_rgba(0,0,0,.55)] ${className}`}>
      <img src={src} alt={alt} width={780} height={1688} className="block aspect-[390/844] w-full rounded-[32px] object-cover object-top" />
    </div>
  );
}

const JOBS = [
  {
    img: "/landing/schedule.webp",
    alt: "A team's schedule in Clbx, with each game and training and who has answered",
    title: "Know who's coming",
    body: "Every game and training has one-tap answers: going, maybe, can't make it. Clbx nudges the ones who haven't answered, so you're not chasing people the night before.",
    extra: ["Meet time, pitch and kit in one place", "Check in at the pitch, attendance records itself", "Live score, scorers and player of the match"],
  },
  {
    img: "/landing/chat.webp",
    alt: "Team chat in Clbx with reactions and a poll about the end-of-season night",
    title: "Talk in one place",
    body: "Team chat that stays about the team. Run a poll for the end-of-season night, reply to a message, react with a thumbs up. Players who'd rather not use the app get every notice by email instead.",
    extra: ["Polls and reactions", "Unread counts, so nothing gets missed", "Announcements by email for everyone"],
  },
  {
    img: "/landing/payments.webp",
    alt: "The Payments tab in Clbx showing $320 of $560 collected and an e-Transfer to confirm",
    title: "Collect subs without the spreadsheet",
    body: "Set pitch fees or season dues and see who's paid. Players can pay by card, or send an e-Transfer and you confirm it with one tap.",
    extra: ["Reminders for anyone who still owes", "Export to a spreadsheet any time", "Cash and e-Transfer are always free"],
  },
];

const MORE = [
  ["Drop-in games", "Post a pickup session, hold spots for your own players and open the rest to supporters. Weekly sessions post themselves."],
  ["Tournaments", "Groups, fixtures, live tables and knockout rounds, with a public page for fans."],
  ["Player auctions", "Split your club into teams with captains, budgets and a live auction on a big screen."],
  ["Carpools", "Offer seats or ask for a lift to away games."],
  ["Calendar sync", "Fixtures appear in your phone's calendar and update when plans change."],
  ["Clubs", "Run several teams under one club, with a dashboard, sponsors and a public club page."],
];

export default function Welcome() {
  return (
    <div className="bg-[#FFFFFF] text-[#1A1F29]">
      {/* Hero */}
      <header className="relative overflow-hidden text-[#FFFFFF]" style={{ background: INK }}>
        <div className="gutter mx-auto flex max-w-6xl items-center justify-between pt-[calc(env(safe-area-inset-top,0px)+20px)]">
          <img src="/clbx-logo.png" alt={APP_NAME} width={1077} height={177} className="h-7 w-auto" />
          <Link href="/login" className="rounded-md px-3 py-2 text-sm font-semibold text-[rgba(255,255,255,0.85)] hover:text-[#FFFFFF] focus-visible:outline-2 focus-visible:outline-[#BAFA10]">
            Sign in
          </Link>
        </div>

        <div className="gutter mx-auto grid max-w-6xl items-center gap-8 pt-12 pb-0 md:gap-12 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:pt-20">
          <div className="md:pb-16">
            <h1 className="font-display text-[clamp(4rem,13vw,9.5rem)] leading-[0.84] font-bold tracking-[-0.01em] uppercase">
              Sunday 9am.
              <br />
              Who&apos;s in?
            </h1>
            <p className="mt-7 max-w-[34rem] text-lg leading-relaxed text-[rgba(255,255,255,0.8)]">
              Clbx runs your amateur team or club: the fixtures, who&apos;s coming, the team chat, the subs and the tournaments. No ads, and nothing locked away from players.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login#new-h"
                className="inline-flex min-h-13 items-center rounded-md px-6 text-base font-bold text-[#06080D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                style={{ background: LIME }}
              >
                Start your team
              </Link>
              <Link href="/login" className="inline-flex min-h-13 items-center rounded-md border border-[rgba(255,255,255,0.25)] px-6 text-base font-semibold hover:bg-[rgba(255,255,255,0.1)] focus-visible:outline-2 focus-visible:outline-[#BAFA10]">
                Sign in
              </Link>
            </div>
            <p className="mt-5 text-sm text-[rgba(255,255,255,0.55)]">Free for players. Works in any browser; phone apps are on the way.</p>
          </div>
          {/* The phone sits on the bottom edge of the dark band, like a phone on a kit bag. */}
          <div className="relative self-end">
            <div aria-hidden className="absolute inset-x-[8%] bottom-0 h-[70%] rounded-t-full blur-3xl" style={{ background: "rgba(186,250,16,.18)" }} />
            <Phone src="/landing/match.webp" alt="A match in Clbx showing who's coming: 4 going, 1 maybe, 1 can't" className="relative mb-12 md:mb-16" />
          </div>
        </div>
      </header>

      <main>
        {/* What it handles */}
        <section aria-labelledby="jobs-h" className="gutter mx-auto max-w-6xl pt-20 pb-16 md:pt-28">
          <h2 id="jobs-h" className="max-w-2xl font-display text-[clamp(2.4rem,6vw,4rem)] leading-[0.95] font-bold uppercase">
            Everything a captain ends up chasing
          </h2>
          <p className="mt-4 max-w-xl text-lg text-[#4B5563]">Built for adult and amateur sport: Sunday league, rec nights, club sides and the pickup game that&apos;s been running for years.</p>

          <div className="mt-16 grid gap-24">
            {JOBS.map((j, i) => (
              <article key={j.title} className={`grid items-center gap-10 md:grid-cols-2 ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`}>
                <Phone src={j.img} alt={j.alt} />
                <div className="max-w-md">
                  <h3 className="font-display text-[clamp(2rem,4.5vw,3rem)] leading-none font-bold uppercase">{j.title}</h3>
                  <p className="mt-4 text-lg leading-relaxed text-[#4B5563]">{j.body}</p>
                  <ul className="mt-6 grid gap-2.5">
                    {j.extra.map((x) => (
                      <li key={x} className="flex gap-3 text-base">
                        <span aria-hidden className="mt-[0.55em] size-2 shrink-0 rounded-full" style={{ background: INK }} />
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Auction night: the one wide picture */}
        <section aria-labelledby="auction-h" className="text-[#FFFFFF]" style={{ background: INK }}>
          <div className="gutter mx-auto grid max-w-6xl gap-10 py-20 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:items-center">
            <div>
              <h2 id="auction-h" className="font-display text-[clamp(2.2rem,5vw,3.5rem)] leading-[0.95] font-bold uppercase">
                Auction night on the big screen
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-[rgba(255,255,255,0.75)]">
                Running an internal tournament? Captains bid for players from their phones while the whole club watches it live on a TV or projector.
              </p>
            </div>
            <img src="/landing/auction.webp" alt="The Clbx auction big screen: a player up for bidding, the current bid, the clock and each team's points" width={1920} height={595} className="w-full rounded-xl ring-1 ring-[rgba(255,255,255,0.1)]" />
          </div>
        </section>

        {/* The rest */}
        <section aria-labelledby="more-h" className="gutter mx-auto max-w-6xl py-20">
          <h2 id="more-h" className="font-display text-[clamp(2.2rem,5vw,3.5rem)] leading-[0.95] font-bold uppercase">
            And the rest of the season
          </h2>
          <dl className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {MORE.map(([t, d]) => (
              <div key={t} className="border-t-2 pt-4" style={{ borderColor: INK }}>
                <dt className="text-lg font-bold">{t}</dt>
                <dd className="mt-1.5 text-[#4B5563]">{d}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Promises and price */}
        <section aria-labelledby="deal-h" className="bg-[#ECEFF3]">
          <div className="gutter mx-auto grid max-w-6xl gap-12 py-20 md:grid-cols-2">
            <div>
              <h2 id="deal-h" className="font-display text-[clamp(2.2rem,5vw,3.5rem)] leading-[0.95] font-bold uppercase">
                The deal
              </h2>
              <ul className="mt-8 grid gap-5 text-lg">
                <li>
                  <strong>No ads.</strong> Not in the app, not in the emails, not ever.
                </li>
                <li>
                  <strong>Free for players.</strong> Answering, chatting, checking the table: none of it costs your players anything.
                </li>
                <li>
                  <strong>No app required.</strong> Players who don&apos;t want another app answer from the email with one tap.
                </li>
                <li>
                  <strong>Your data is yours.</strong> Export your roster and payments to a spreadsheet whenever you like, and delete your account yourself.
                </li>
              </ul>
            </div>
            <div className="self-start rounded-2xl p-8 text-[#FFFFFF] md:mt-4" style={{ background: INK }}>
              <h3 className="font-display text-3xl font-bold uppercase">What it costs</h3>
              <p className="mt-4 text-lg text-[rgba(255,255,255,0.8)]">Setting up a team or club is free.</p>
              <p className="mt-3 text-lg text-[rgba(255,255,255,0.8)]">
                If you collect money by card, the player sees a small fee added at checkout (3.2% + 90¢), and your club gets the full amount. Cash and e-Transfer stay free.
              </p>
              <Link
                href="/login#new-h"
                className="mt-7 inline-flex min-h-12 items-center rounded-md px-6 font-bold text-[#06080D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                style={{ background: LIME }}
              >
                Start your team
              </Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="local-h" className="gutter mx-auto max-w-6xl py-20">
          <h2 id="local-h" className="max-w-3xl font-display text-[clamp(2.2rem,5vw,3.5rem)] leading-[0.95] font-bold uppercase">
            Made in Kingston, Ontario
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#4B5563]">
            Clbx is built by people who run amateur football teams themselves, and it&apos;s used by our own clubs every week.
          </p>
        </section>
      </main>

      <footer className="text-[rgba(255,255,255,0.7)]" style={{ background: INK }}>
        <div className="gutter mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 pt-10 pb-[calc(env(safe-area-inset-bottom,0px)+40px)]">
          <img src="/clbx-logo.png" alt={APP_NAME} width={1077} height={177} className="h-6 w-auto" />
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/login" className="hover:text-[#FFFFFF]">
              Sign in
            </Link>
            <Link href="/terms" className="hover:text-[#FFFFFF]">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-[#FFFFFF]">
              Privacy
            </Link>
          </nav>
          <p className="w-full text-sm text-[rgba(255,255,255,0.45)]">Clbx, Kingston, Ontario</p>
        </div>
      </footer>
    </div>
  );
}
