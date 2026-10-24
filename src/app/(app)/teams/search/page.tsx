import type { Metadata } from "next";
import { Search } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Find a team" };

// S04: following teams as a fan is a "could" feature, scheduled after the must-haves.
export default function FindTeamPage() {
  return (
    <main id="main" className="gutter mx-auto grid max-w-3xl gap-5 py-6">
      <PageHeader title="Find a team" subtitle="Follow a team's schedule and scores without being on the roster." />
      <EmptyState
        icon={<Search />}
        title="Coming in a later build"
        hint="Search by team name or team code arrives with the fan-following features."
      />
    </main>
  );
}
