import { teamThemeCss } from "@/lib/team-theme";

/**
 * Server-rendered team colour variables for one or more teams, scoped to [data-team="<id>"].
 * Rendered in the page HTML so there's no flash of the default colour.
 * When the viewer has team colours off, nothing is emitted and the app accent is used.
 */
export function TeamThemeStyle({ teams, enabled }: { teams: { id: string; color: string; colorSecondary: string | null }[]; enabled: boolean }) {
  if (!enabled || !teams.length) return null;
  const css = teams.map((t) => teamThemeCss(t.id, t.color, t.colorSecondary)).join("\n");
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
