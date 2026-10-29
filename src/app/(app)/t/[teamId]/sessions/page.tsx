import { redirect } from "next/navigation";

// Drop-in games live on the Schedule now, next to matches and trainings.
export default async function SessionsTab({ params }: { params: Promise<{ teamId: string }> }) {
  redirect(`/t/${(await params).teamId}/schedule`);
}
