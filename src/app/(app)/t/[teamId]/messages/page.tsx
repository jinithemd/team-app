import type { Metadata } from "next";
import { DEFAULT_TZ } from "@/lib/time";
import { Mail, PenSquare } from "lucide-react";
import { listTeamMessages } from "@/lib/data";
import { Banner, ButtonLink, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Messages" };

// S17: subject-line messages to the whole team or chosen people. Arrive by email too.
export default async function TeamMessagesPage({ params, searchParams }: { params: Promise<{ teamId: string }>; searchParams: Promise<{ sent?: string }> }) {
  const { teamId } = await params;
  const sp = await searchParams;
  const m = await listTeamMessages(teamId);
  if (!m) return null;
  return (
    <div className="grid gap-5">
      {sp.sent && <Banner>Sent to {sp.sent} {sp.sent === "1" ? "person" : "people"}. They get it by email too.</Banner>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Messages</h2>
        {m.canSend && (
          <ButtonLink href={`/t/${teamId}/messages/new`} size="sm">
            <PenSquare aria-hidden />
            New message
          </ButtonLink>
        )}
      </div>
      {m.messages.length === 0 ? (
        <EmptyState icon={<Mail />} title="No messages yet" hint={m.canSend ? "For things that shouldn't get lost in chat: kit orders, cup draws, AGM notices." : "Announcements from your captains show up here and in your email."} />
      ) : (
        <ul className="grid gap-3">
          {m.messages.map((x) => (
            <li key={x.id}>
              <details className="group rounded-lg border border-border p-4 open:bg-surface">
                <summary className="cursor-pointer list-none">
                  <p className="font-semibold break-words">{x.subject}</p>
                  <p className="text-sm text-muted">
                    From {x.from.firstName} {x.from.lastName} · {new Date(x.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: DEFAULT_TZ })} · to {x.recipients} {x.recipients === 1 ? "person" : "people"}
                  </p>
                </summary>
                <p className="mt-3 whitespace-pre-line break-words">{x.body}</p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
