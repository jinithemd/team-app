import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Messages" };

// S17: subject-line messages to selected families ("should" feature).
export default function TeamMessagesPage() {
  return (
    <EmptyState
      icon={<Mail />}
      title="Messages are on the way"
      hint="Send an email-style message to the whole team or chosen players. Arrives after team chat."
    />
  );
}
