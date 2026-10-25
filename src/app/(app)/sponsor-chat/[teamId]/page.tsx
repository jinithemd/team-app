import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getChat, mySponsorships, teamLook } from "@/lib/data";
import { ChatRoom } from "@/components/chat-room";
import { teamThemeCss } from "@/lib/team-theme";

export const metadata: Metadata = { title: "Sponsor chat" };

// How a sponsor gets into the room they share with a team. Members use the team's Chat tab.
export default async function SponsorChatPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const [chat, mine, look] = await Promise.all([getChat(teamId, "sponsors"), mySponsorships(), teamLook(teamId)]);
  if (!chat || !look) notFound();
  const back = mine.find((s) => s.scope === "club" || s.scopeName === chat.teamName);
  return (
    <div data-team={teamId} className="min-h-full">
      <style dangerouslySetInnerHTML={{ __html: teamThemeCss(teamId, look.color, look.colorSecondary) }} />
      <header className="gutter border-b-4 border-team-2 bg-team pt-[calc(env(safe-area-inset-top,0px)+20px)] pb-4 text-on-team">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm opacity-90">Sponsor chat</p>
          <h1 className="font-display text-2xl leading-tight font-bold break-words uppercase">{chat.teamName}</h1>
        </div>
      </header>
      <main id="main" className="gutter mx-auto grid max-w-3xl gap-4 py-5">
        {back && (
          <Link href={`/sponsor/${back.id}`} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
            <ArrowLeft aria-hidden className="size-4" />
            Your sponsor page
          </Link>
        )}
        <ChatRoom chat={chat} />
      </main>
    </div>
  );
}
