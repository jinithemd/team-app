import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { APP_DOMAIN, APP_NAME, MIN_AGE, SUPPORT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="October 25, 2026">
      <p>
        {APP_NAME} ({APP_DOMAIN}) helps amateur and youth clubs run their teams: schedules, RSVPs, attendance and team chat. This policy explains what
        we collect, why, who helps us run the service, and the choices you have. {APP_NAME} is based in Kingston, Ontario, and follows Canada&apos;s
        Personal Information Protection and Electronic Documents Act (PIPEDA).
      </p>

      <h2>Who can use {APP_NAME}</h2>
      <p>
        You need to be {MIN_AGE} or older to create an account. Every player has their own account; we don&apos;t create profiles for children or
        let anyone sign up on someone else&apos;s behalf. If you believe someone under {MIN_AGE} has an account, email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we&apos;ll remove it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your name and email address, and a phone number if you add one. You sign in with a link we email you, so
          we never store a password.
        </li>
        <li>
          <strong>Team activity:</strong> the teams and clubs you belong to and your roles, the events on your schedule, your RSVPs and notes,
          dates you&apos;re unavailable, attendance, points, scores and match events, player-of-the-match votes, carpool offers and seats, and dues
          your team records (whether a fee was paid; we never handle card or bank details).
        </li>
        <li>
          <strong>Messages:</strong> team chat messages, photos, reactions, poll votes and team announcements you send or receive.
        </li>
        <li>
          <strong>Check-in location:</strong> only if your team turns on check-in and you tap &quot;I&apos;m here&quot;. Your phone sends one location
          reading; we keep only how far you were from the venue and how accurate the reading was, never your coordinates.
        </li>
        <li>
          <strong>Technical data:</strong> a sign-in cookie that keeps you signed in, your light/dark and team-colour settings, notification
          settings, and standard server logs (such as IP address and browser) kept for security and troubleshooting.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run the service: show your team its schedule, roster and chat, and let staff manage the team.</li>
        <li>To send you email you need or asked for: sign-in links, invites, new or changed events, reminders. You can turn reminder emails off in Notifications.</li>
        <li>To keep the service secure and fix problems.</li>
      </ul>
      <p>We don&apos;t sell your information, show ads, or use it to build advertising profiles. We don&apos;t use analytics or tracking cookies.</p>

      <h2>Who sees your information</h2>
      <p>
        Your teammates and team staff see what a team needs: your name, RSVPs, and what you post. Team and club staff also see attendance, dues and
        your contact details. If your team has sponsors, they see only what the team chooses to share with them. Each team controls whether its roster
        is visible to its members and whether its schedule and scores are public.
      </p>

      <h2>Service providers</h2>
      <p>We use these companies to run {APP_NAME}. They process data only on our instructions:</p>
      <ul>
        <li>
          <strong>Supabase</strong>: database and sign-in. Your data is stored in Canada (Montréal region).
        </li>
        <li>
          <strong>Vercel</strong>: hosts the website and runs the app. Requests are processed in the United States.
        </li>
        <li>
          <strong>Resend</strong>: sends our emails, from the United States.
        </li>
        <li>
          <strong>Google</strong>: only if you choose &quot;Continue with Google&quot; to sign in.
        </li>
      </ul>
      <p>
        Because some providers are in the United States, your information may be processed there and be subject to US law. We may also disclose
        information if the law requires it.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your information while your account is open. When you delete your account, we delete your profile and personal data straight away.
        Messages you posted in team chat stay for the team but no longer show your name. Copies in our providers&apos; backups are overwritten within
        their normal backup cycle.
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>See your details and roles in Account. To correct anything, email us.</li>
        <li>Turn emails off in Account → Notifications.</li>
        <li>Delete your account at any time in Account → Delete my account.</li>
        <li>
          Ask for a copy of your information, or ask questions or complain about how we handle it, by emailing{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We&apos;ll reply within 30 days. If you&apos;re not satisfied, you can contact
          the Office of the Privacy Commissioner of Canada.
        </li>
      </ul>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit and at rest, access is limited by role (a player can&apos;t see what only staff can), and sign-in links expire
        after one use. No system is perfectly secure; if a breach puts you at real risk of significant harm, we&apos;ll tell you.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy, we&apos;ll update the date above, and for important changes we&apos;ll tell you in the app or by email first.
      </p>

      <h2>Contact</h2>
      <p>
        Privacy questions: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </LegalPage>
  );
}
