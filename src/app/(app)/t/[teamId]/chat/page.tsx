import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getChat } from "@/lib/data";
import { ChatRoom } from "@/components/chat-room";

export const metadata: Metadata = { title: "Team chat" };

// S16: team chat, and a captains-only room for staff.
export default async function TeamChatPage({ params, searchParams }: { params: Promise<{ teamId: string }>; searchParams: Promise<{ room?: string }> }) {
  const { teamId } = await params;
  const { room } = await searchParams;
  const chat = (await getChat(teamId, room === "staff" ? "staff" : "team")) ?? (room === "staff" ? await getChat(teamId, "team") : null);
  if (!chat) notFound();
  return <ChatRoom chat={chat} />;
}
