import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { messageRecipients } from "@/lib/data";
import { ComposeForm } from "./compose-form";

export const metadata: Metadata = { title: "New message" };

export default async function ComposePage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const people = await messageRecipients(teamId);
  if (!people)
    return (
      <div className="grid gap-2">
        <h2 className="text-xl font-bold">Only captains and managers can send messages</h2>
        <p className="text-muted">Use the team chat instead.</p>
      </div>
    );
  return (
    <div className="grid gap-5">
      <Link href={`/t/${teamId}/messages`} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Messages
      </Link>
      <h2 className="text-xl font-bold">New message</h2>
      <ComposeForm teamId={teamId} people={people.map((p) => ({ id: p.userId, name: `${p.person.firstName} ${p.person.lastName}`, staff: p.staff }))} />
    </div>
  );
}
