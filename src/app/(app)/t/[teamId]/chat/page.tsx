import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Team chat" };

// S16: real-time team chat is next on the must-have list (needs Supabase Realtime from replica-backend).
export default function TeamChatPage() {
  return (
    <EmptyState
      icon={<MessageCircle />}
      title="Team chat is coming next"
      hint="Real-time chat with photos, reactions and pinned messages lands once the live backend is connected."
    />
  );
}
