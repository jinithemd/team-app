import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getChat } from "@/lib/data";
import { ChatRoom } from "@/components/chat-room";

export const metadata: Metadata = { title: "Team chat" };

// S16: team chat, a captains-only room for staff, and a room shared with the team's sponsors.
export default async function TeamChatPage({ params, searchParams }: { params: Promise<{ teamId: string }>; searchParams: Promise<{ room?: string }> }) {
  const { teamId } = await params;
  const { room } = await searchParams;
  const kind = room === "staff" ? "staff" : room === "sponsors" ? "sponsors" : "team";
  const chat = (await getChat(teamId, kind)) ?? (kind !== "team" ? await getChat(teamId, "team") : null);
  if (!chat) notFound();
  return <ChatRoom chat={chat} />;
}
