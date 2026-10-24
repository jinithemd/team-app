import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { CreateTeamForm } from "./create-team-form";

export const metadata: Metadata = { title: "Start a team" };

export default function NewTeamPage() {
  return (
    <main id="main" className="gutter mx-auto grid max-w-2xl gap-5 py-6">
      <PageHeader title="Start a team" subtitle="You'll be the head coach. Invite players and other staff next." />
      <CreateTeamForm />
    </main>
  );
}
