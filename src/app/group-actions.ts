"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as svc from "@/lib/groups/service";

type FormState = { ok?: boolean; error?: string; message?: string } | null;
const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function createGroupAction(teamId: string, _: FormState, f: FormData): Promise<FormState> {
  const r = await svc.createGroup(teamId, { name: str(f, "name"), about: str(f, "about") });
  if (!r.ok) return { error: r.error };
  revalidatePath(`/t/${teamId}`, "layout");
  redirect(`/g/${r.data.id}?new=1`);
}

export async function editGroupAction(groupId: string, _: FormState, f: FormData): Promise<FormState> {
  const r = await svc.editGroup(groupId, { name: str(f, "name"), about: str(f, "about") });
  revalidatePath(`/g/${groupId}`);
  return r.ok ? { ok: true, message: "Saved." } : { error: r.error };
}

export async function deleteGroupAction(groupId: string): Promise<{ error?: string }> {
  const r = await svc.removeGroup(groupId);
  if (!r.ok) return { error: r.error };
  revalidatePath(`/t/${r.data.teamId}`, "layout");
  redirect(`/t/${r.data.teamId}/groups?deleted=1`);
}

export async function findGroupPeopleAction(groupId: string, q: string) {
  return svc.findPeople(groupId, q);
}

export async function addToGroupAction(groupId: string, userIds: string[]): Promise<{ error?: string; added?: number }> {
  const r = await svc.addToGroup(groupId, userIds);
  revalidatePath(`/g/${groupId}`);
  return r.ok ? { added: r.data.added } : { error: r.error };
}

export async function removeFromGroupAction(groupId: string, userId: string, leaving = false): Promise<{ error?: string }> {
  const r = await svc.removeFromGroup(groupId, userId);
  if (!r.ok) return { error: r.error };
  revalidatePath(`/g/${groupId}`);
  revalidatePath("/chat");
  if (leaving) redirect("/chat?left=1");
  return {};
}

export async function sendGroupMessageAction(groupId: string, body: string): Promise<{ error?: string }> {
  const r = await svc.sendMessage(groupId, body);
  revalidatePath(`/g/${groupId}`);
  return r.ok ? {} : { error: r.error };
}

export async function deleteGroupMessageAction(groupId: string, messageId: string): Promise<{ error?: string }> {
  const r = await svc.deleteMessage(groupId, messageId);
  revalidatePath(`/g/${groupId}`);
  return r.ok ? {} : { error: r.error };
}
