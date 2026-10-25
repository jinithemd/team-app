import type { Metadata } from "next";
import Link from "next/link";
import { accountDeletionBlockers, getSessionUser } from "@/lib/data";
import { APP_NAME } from "@/lib/brand";
import { Banner, PageHeader, buttonClass } from "@/components/ui";
import { DeleteAccountForm } from "./delete-form";

export const metadata: Metadata = { title: "Delete account" };

export default async function DeleteAccountPage() {
  const [user, blockers] = await Promise.all([getSessionUser(), accountDeletionBlockers()]);
  return (
    <main id="main" className="gutter mx-auto grid max-w-2xl gap-6 py-6">
      <PageHeader title="Delete account" />
      <section className="grid gap-3 text-sm">
        <p>This permanently deletes your {APP_NAME} account and your personal data. It can&apos;t be undone.</p>
        <ul className="grid list-disc gap-1 pl-5">
          <li>Your profile and contact details are deleted.</li>
          <li>You&apos;re removed from every team and club, with your RSVPs, attendance, points, votes and carpool seats.</li>
          <li>Chat messages and posts you wrote stay for your team but no longer show your name.</li>
          <li>Teams you started are handed to another manager. Teams with nobody else in them are deleted.</li>
        </ul>
      </section>
      {blockers.length ? (
        <>
          <Banner tone="warning">
            <p className="font-semibold">Before you can delete your account</p>
            <ul className="mt-1 grid list-disc gap-1 pl-5">
              {blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </Banner>
          <Link href="/account" className={buttonClass("secondary", "md", "justify-self-start")}>
            Back to account
          </Link>
        </>
      ) : (
        <DeleteAccountForm email={user!.email} />
      )}
    </main>
  );
}
