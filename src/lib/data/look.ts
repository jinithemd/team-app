import "server-only";
import { cache } from "react";
import { LIVE } from "../mode";
import { authUser, userClient } from "../supabase/server";
import * as demo from "./demo";

export type Look = { signedIn: boolean; theme: "light" | "dark" | undefined; useTeamColors: boolean };

/**
 * Just enough about the signed-in person to draw the app frame (signed in? light or dark?
 * team colours?), in one small query, so the frame and a loading screen reach the phone
 * before the person's full data has loaded.
 */
export const myLook = cache(async (): Promise<Look> => {
  if (!LIVE) {
    const u = await demo.getSessionUser();
    return { signedIn: !!u, theme: u?.theme && u.theme !== "system" ? u.theme : undefined, useTeamColors: u?.useTeamColors ?? true };
  }
  const u = await authUser();
  if (!u) return { signedIn: false, theme: undefined, useTeamColors: true };
  const { data } = await (await userClient()).from("profiles").select("theme, use_team_colors").eq("id", u.id).maybeSingle();
  const theme = data?.theme === "light" || data?.theme === "dark" ? data.theme : undefined;
  return { signedIn: true, theme, useTeamColors: data?.use_team_colors ?? true };
});
