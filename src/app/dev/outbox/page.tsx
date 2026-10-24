import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { listOutbox } from "@/lib/data";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Sample inbox" };
export const dynamic = "force-dynamic";

// Sample-data build only: every email the app would have sent. Removed when Resend is connected.
export default async function OutboxPage() {
  const mail = await listOutbox();
  const base = process.env.APP_URL || "http://localhost:3000";
  const local = (href: string) => (href.startsWith(base) ? href.slice(base.length) || "/" : href);
  return (
    <main className="gutter mx-auto grid max-w-2xl gap-5 py-8">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-bold">Sample inbox</h1>
        <Link href="/" className="text-sm font-semibold text-team-ink">
          Back to the app
        </Link>
      </div>
      <p className="text-sm text-muted">Emails the app would send. Links work, so you can join a team or answer from here the way a parent would.</p>
      {mail.length === 0 ? (
        <EmptyState icon={<Mail />} title="No emails yet" hint="Invite someone or add a game with “Tell the team” on." />
      ) : (
        <ul className="grid gap-3">
          {mail.map((m) => (
            <li key={m.id} className="grid gap-2 rounded-lg border border-border p-4">
              <p className="text-xs text-muted">
                To <span className="font-semibold break-all text-fg">{m.to}</span> ·{" "}
                {new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" }).format(new Date(m.createdAt))}
              </p>
              <h2 className="font-semibold break-words">{m.subject}</h2>
              <p className="text-sm break-words whitespace-pre-line">{m.text}</p>
              <div className="flex flex-wrap gap-2">
                {m.links.map((l) => (
                  <Link key={l.href} href={local(l.href)} className="inline-flex min-h-9 items-center rounded-md border border-border-input px-3 text-sm font-semibold hover:bg-surface">
                    {l.label}
                  </Link>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
