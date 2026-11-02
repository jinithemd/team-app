"use server";

import { revalidatePath } from "next/cache";
import { saveLineup } from "@/lib/lineups/service";

export async function saveLineupAction(teamId: string, eventId: string, input: { formation: string; slots: (string | null)[]; subs: string[] }) {
  const r = await saveLineup(eventId, input);
  if (r.ok) revalidatePath(`/t/${teamId}/e/${eventId}/lineup`);
  return r;
}
