import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/brand";
import "./welcome.css";

/*
 * clbx.ca for people who aren't signed in: what Clbx is, who it's for, what it costs.
 * Signed-in members never see it ("/" takes them to their teams; see middleware.ts).
 * Screenshots in /public/landing are the real app with sample data. Styles: welcome.css
 * (a Hallmark redesign; every colour and face is a token at the top of that file).
 */

export const metadata: Metadata = {
  title: { absolute: `${APP_NAME}: the team app for amateur sport` },
  description: "Fixtures, who's coming, team chat, subs, tournaments and drop-in games for amateur teams and clubs. No ads. Free for players.",
  alternates: { canonical: "/" },
};

function Capture({ src, alt, className = "", caption }: { src: string; alt: string; className?: string; caption?: string }) {
  return (
    <figure className="capture">
      <div className={`shot ${className}`} data-kind="product">
        <img src={src} alt={alt} width={780} height={1688} loading="lazy" />
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

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
    <div className="hm">
      <header className="night">
        <div className="container">
          <nav className="nav" aria-label="Clbx">
            <Link href="/" aria-label={`${APP_NAME} home`}>
              <img src="/clbx-logo-white.png" alt={APP_NAME} width={480} height={79} />
            </Link>
            <Link href="/login" className="link">
              Sign in
            </Link>
          </nav>

          <div className="hero">
            <div className="intro">
              <h1>
                Sunday 9am.
                <br />
                Who&apos;s in?
              </h1>
              <p className="lead">Clbx runs your amateur team or club: the fixtures, who&apos;s coming, the team chat, the subs and the tournaments.</p>
              <div className="hero-actions">
                <Link href="/login#new-h" className="btn btn-primary">
                  Start your team
                </Link>
                <Link href="/login" className="btn btn-secondary">
                  Sign in
                </Link>
              </div>
              <p className="small">
                No ads, and nothing locked away from players.
                <br />
                Free for players. Works in any browser; phone apps are on the way.
              </p>
            </div>
            <figure className="capture hero-visual">
              <div className="shot" data-kind="product">
                <img src="/landing/match.webp" alt="A match in Clbx showing who's coming: 4 going, 1 maybe, 1 can't" width={780} height={1688} fetchPriority="high" />
              </div>
            </figure>
          </div>
        </div>
      </header>

      <main>
        {/* What it handles: the first job as a split. */}
        <section aria-labelledby="jobs-h" className="sec">
          <div className="container">
            <div className="cols show-head">
              <h2 id="jobs-h">Everything a captain ends up chasing</h2>
              <p className="lead">Built for adult and amateur sport: Sunday league, rec nights, club sides and the pickup game that&apos;s been running for years.</p>
            </div>
            <article className="cols split">
              <Capture src="/landing/schedule.webp" alt="A team's schedule in Clbx, with each game and training and who has answered" className="shot-phone" />
              <div className="split-text">
                <h3>Know who&apos;s coming</h3>
                <p className="body">Every game and training has one-tap answers: going, maybe, can&apos;t make it. Clbx nudges the ones who haven&apos;t answered, so you&apos;re not chasing people the night before.</p>
                <ul className="facts">
                  <li>Meet time, pitch and kit in one place</li>
                  <li>Check in at the pitch, attendance records itself</li>
                  <li>Live score, scorers and player of the match</li>
                </ul>
              </div>
            </article>
          </div>
        </section>

        {/* Jobs two and three, side by side on the well. */}
        <section aria-label="Chat and subs" className="well band">
          <div className="container pair">
            <article>
              <div className="shot shot-phone" data-kind="product">
                <img src="/landing/chat.webp" alt="Team chat in Clbx with reactions and a poll about the end-of-season night" width={780} height={1688} loading="lazy" />
              </div>
              <h3>Talk in one place</h3>
              <p className="body">Team chat that stays about the team. Run a poll for the end-of-season night, reply to a message, react with a thumbs up. Players who&apos;d rather not use the app get every notice by email instead.</p>
              <ul className="facts">
                <li>Polls and reactions</li>
                <li>Unread counts, so nothing gets missed</li>
                <li>Announcements by email for everyone</li>
              </ul>
            </article>
            <article>
              <div className="shot shot-phone" data-kind="product">
                <img src="/landing/payments.webp" alt="The Payments tab in Clbx showing $320 of $560 collected and an e-Transfer to confirm" width={780} height={1688} loading="lazy" />
              </div>
              <h3>Collect subs without the spreadsheet</h3>
              <p className="body">Set pitch fees or season dues and see who&apos;s paid. Players can pay by card, or send an e-Transfer and you confirm it with one tap.</p>
              <ul className="facts">
                <li>Reminders for anyone who still owes</li>
                <li>Export to a spreadsheet any time</li>
                <li>Cash and e-Transfer are always free</li>
              </ul>
            </article>
          </div>
        </section>

        {/* Auction night: the one wide picture, on the night band. */}
        <section aria-labelledby="auction-h" className="night band">
          <div className="container">
            <div className="cols show-head">
              <h2 id="auction-h">Auction night on the big screen</h2>
              <p className="lead">Running an internal tournament? Captains bid for players from their phones while the whole club watches it live on a TV or projector.</p>
            </div>
            <div className="show">
              <div className="shot" data-kind="product">
                <img src="/landing/auction.webp" alt="The Clbx auction big screen: a player up for bidding, the current bid, the clock and each team's points" width={1920} height={878} loading="lazy" />
              </div>
            </div>
          </div>
        </section>

        {/* The rest: rows beside a held head. */}
        <section aria-labelledby="more-h" className="sec-l">
          <div className="container cols">
            <h2 id="more-h" className="rows-head">
              And the rest of the season
            </h2>
            <dl className="rows">
              {MORE.map(([t, d]) => (
                <div key={t}>
                  <dt>{t}</dt>
                  <dd>{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Promises and price: the close. */}
        <section aria-labelledby="deal-h" className="well band">
          <div className="container cols deal">
            <div className="head">
              <h2 id="deal-h">The deal</h2>
            </div>
            <ul className="promises">
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
            <div className="costs">
              <h3>What it costs</h3>
              <table>
                <thead>
                  <tr>
                    <th scope="col">What</th>
                    <th scope="col">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Setting up a team or club</th>
                    <td>Free</td>
                  </tr>
                  <tr>
                    <th scope="row">Collecting money by card</th>
                    <td>The player sees a small fee added at checkout (3.2% + 90¢), and your club gets the full amount</td>
                  </tr>
                  <tr>
                    <th scope="row">Cash and e-Transfer</th>
                    <td>Free</td>
                  </tr>
                </tbody>
              </table>
              <Link href="/login#new-h" className="btn btn-primary">
                Start your team
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="night foot">
        <div className="container">
          <div className="foot-text">
            <h2 id="local-h">Made in Ontario</h2>
            <p>Clbx is built by people who run amateur football teams themselves, and it&apos;s used by our own clubs every week.</p>
          </div>
          <div className="foot-bar">
            <img src="/clbx-logo-white.png" alt={APP_NAME} width={480} height={79} />
            <nav aria-label="Footer">
              <Link href="/login" className="link">
                Sign in
              </Link>
              <Link href="/terms" className="link">
                Terms
              </Link>
              <Link href="/privacy" className="link">
                Privacy
              </Link>
            </nav>
            <p className="small">Clbx, Ontario, Canada</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
