import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { APP_DOMAIN, APP_NAME, MIN_AGE, SUPPORT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="October 25, 2026">
      <p>
        These terms apply when you use {APP_NAME} at {APP_DOMAIN}. By creating an account or using the service, you agree to them. Please also read
        our <Link href="/privacy">privacy policy</Link>.
      </p>

      <h2>1. The service</h2>
      <p>
        {APP_NAME} gives teams and clubs a place for schedules, RSVPs, attendance, dues tracking and team chat. It&apos;s offered free while we
        build it, and features may change, be added or be removed.
      </p>

      <h2>2. Who can use it</h2>
      <p>
        You must be {MIN_AGE} or older to create or use an account. Each account is for one person: don&apos;t share it, and don&apos;t create an
        account for anyone else. Give a real name and an email address you control.
      </p>

      <h2>3. Teams and clubs</h2>
      <p>
        If you start or run a team or club, you&apos;re responsible for who you invite, the permissions you give, and what your team does with
        information in {APP_NAME}. Only invite people who expect to hear from your team. Dues in {APP_NAME} are a record your team keeps; payments
        happen outside the app, between you and your team.
      </p>

      <h2>4. Your content</h2>
      <p>
        You own what you post. You give {APP_NAME} permission to store it and show it to the people it&apos;s shared with, only to run the service.
        Don&apos;t post anything that&apos;s illegal, harassing, hateful, sexual, or that you don&apos;t have the right to share, and don&apos;t post
        other people&apos;s private information without their permission.
      </p>

      <h2>5. Acceptable use</h2>
      <p>
        Don&apos;t try to access teams or data you weren&apos;t invited to, interfere with the service, send spam through it, or use it for anything
        unlawful. Team staff can remove members and posts. We may suspend or delete accounts that break these terms.
      </p>

      <h2>6. Ending your account</h2>
      <p>
        You can delete your account at any time in Account → Delete my account. If you run a team, hand it to another manager first so the team
        isn&apos;t left without one.
      </p>

      <h2>7. No warranty</h2>
      <p>
        {APP_NAME} is provided &quot;as is&quot;. We work to keep it running and accurate, but we can&apos;t promise it will always be available or
        error-free. Always confirm important details, such as a game time or venue, with your team.
      </p>

      <h2>8. Limit of liability</h2>
      <p>
        To the extent the law allows, {APP_NAME} isn&apos;t liable for indirect or consequential losses, or for anything that happens at a team
        activity. Nothing in these terms limits rights you have under consumer protection law that can&apos;t be limited.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these terms. We&apos;ll change the date above and, for important changes, tell you in the app or by email before they take
        effect. Using {APP_NAME} after that means you accept the new terms.
      </p>

      <h2>10. Law</h2>
      <p>These terms are governed by the laws of Ontario and the federal laws of Canada that apply there.</p>

      <h2>Contact</h2>
      <p>
        Questions: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </LegalPage>
  );
}
