import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MessageCircle } from "lucide-react";
import { listMyTeams } from "@/lib/data";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Chat" };

export default async function ChatListPage() {
  const teams = await listMyTeams();
  return (
    <main id="main" className="gutter mx-auto grid max-w-3xl gap-5 py-6">
      <PageHeader title="Chat" subtitle="Each team has one group chat for the whole squad." />
      {teams.length ? (
        <ul className="grid gap-2">
          {teams.map((t) => (
            <li key={t.id} data-team={t.id}>
              <Link href={`/t/${t.id}/chat`} className="flex min-h-16 items-center gap-3 rounded-lg border border-border p-3 hover:border-border-input">
                <span aria-hidden className="grid size-10 place-items-center rounded-pill bg-team text-on-team">
                  <MessageCircle className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold break-words">{t.name}</span>
                  <span className="block text-sm text-muted">Team chat opens in the next build</span>
                </span>
                <ChevronRight aria-hidden className="size-5 text-muted" />
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
