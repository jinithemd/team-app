import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIVE } from "../mode";
import { pushConfigured, pushToUser } from "./send";

/*
 * A new chat message pings the rest of the chat on their phones: the team chat goes to the
 * active team, the staff chat to staff. Sponsor chats stay quiet. Anyone who turned chat
 * notifications off for the team (Account → Notifications) is skipped.
 */
export async function pushChat(convId: string, senderId: string, body: string) {
  if (!LIVE || !pushConfigured()) return;
  try {
    const { adminClient } = await import("../supabase/server");
    const sb = adminClient() as unknown as SupabaseClient;
    const { data: conv } = await sb.from("conversations").select("id, team_id, kind").eq("id", convId).maybeSingle();
    if (!conv || conv.kind === "sponsors") return;
    const [{ data: team }, { data: me }, { data: roster }, { data: prefs }] = await Promise.all([
      sb.from("teams").select("name").eq("id", conv.team_id).maybeSingle(),
      sb.from("profiles").select("first_name").eq("id", senderId).maybeSingle(),
      sb.from("roster_members").select("user_id, permissions").eq("team_id", conv.team_id).eq("status", "active").not("user_id", "is", null),
      sb.from("notification_prefs").select("user_id, push, chat").eq("team_id", conv.team_id),
    ]);
    const off = new Set(((prefs ?? []) as { user_id: string; push: boolean | null; chat: boolean | null }[]).filter((p) => p.push === false || p.chat === false).map((p) => p.user_id));
    const to = ((roster ?? []) as { user_id: string; permissions: string[] | null }[])
      .filter((r) => r.user_id !== senderId && !off.has(r.user_id) && (conv.kind !== "staff" || (r.permissions ?? []).length > 0))
      .map((r) => r.user_id);
    const title = `${(me as { first_name?: string } | null)?.first_name ?? "Someone"} · ${(team as { name?: string } | null)?.name ?? "Team chat"}${conv.kind === "staff" ? " staff" : ""}`;
    const text = body.replace(/\s+/g, " ").trim() || "Sent a photo";
    const url = `/t/${conv.team_id}/chat${conv.kind === "staff" ? "?room=staff" : ""}`;
    await Promise.all([...new Set(to)].map((uid) => pushToUser(uid, { title, body: text.length > 170 ? `${text.slice(0, 167)}…` : text, url })));
  } catch (e) {
    console.error("[push chat]", (e as Error).message);
  }
}
