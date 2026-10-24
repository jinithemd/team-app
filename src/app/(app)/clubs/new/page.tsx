import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { CreateClubForm } from "./create-club-form";

export const metadata: Metadata = { title: "Set up a club" };

export default function NewClubPage() {
  return (
    <main id="main" className="gutter mx-auto grid max-w-2xl gap-5 py-6">
      <PageHeader title="Set up a club" subtitle="You'll be the club's owner. You can still play for and captain any of its teams." />
      <CreateClubForm />
    </main>
  );
}
