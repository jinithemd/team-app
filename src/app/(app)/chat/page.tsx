import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MessageCircle, Shield } from "lucide-react";
import { listConversations } from "@/lib/data";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Chat" };

export default async function ChatListPage() {
  const convos = await listConversations();
  return (
    <main id="main" className="gutter mx-auto grid max-w-3xl gap-5 py-6">
      <PageHeader title="Chat" subtitle="Every team you're on. Captains also get a captains-only room." />
      {convos.length ? (
        <ul className="grid gap-2">
          {convos.map((c) => (
            <li key={c.id} data-team={c.teamId}>
              <Link
                href={c.kind === "staff" ? `/t/${c.teamId}/chat?room=staff` : `/t/${c.teamId}/chat`}
                className="flex min-h-16 items-center gap-3 rounded-lg border border-border p-3 hover:border-border-input focus-visible:outline-2 focus-visible:outline-focus"
              >
                <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-pill ${c.kind === "staff" ? "bg-team-soft text-team-ink" : "bg-team text-on-team"}`}>
                  {c.kind === "staff" ? <Shield className="size-5" /> : <MessageCircle className="size-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold break-words">
                    {c.teamName}
                    {c.kind === "staff" && <span className="font-normal text-muted"> · captains</span>}
                  </span>
                  <span className={`block truncate text-sm ${c.unread ? "font-semibold text-fg" : "text-muted"}`}>{c.last ? `${c.last.who}: ${c.last.text}` : "No messages yet"}</span>
                </span>
                {c.unread > 0 && (
                  <span className="grid h-6 min-w-6 place-items-center rounded-pill bg-danger px-1.5 text-xs font-bold text-on-danger tabular">
                    {c.unread}
                    <span className="sr-only"> unread</span>
                  </span>
                )}
                <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<MessageCircle />} title="No chats yet" hint="Join or start a team to chat with your teammates." />
      )}
    </main>
  );
}
