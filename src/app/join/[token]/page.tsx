import type { Metadata } from "next";
import Link from "next/link";
import { getJoinPage } from "@/lib/data";
import { teamThemeCss } from "@/lib/team-theme";
import { APP_NAME } from "@/lib/brand";
import { buttonClass } from "@/components/ui";
import { SignUpForm } from "@/app/login/sign-up-form";
import { JoinButton } from "./join-button";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const p = await getJoinPage(token);
  // Shown in the WhatsApp / iMessage link preview.
  return p
    ? { title: `Join ${p.team.name}`, description: `You're invited to join ${p.team.name}${p.club ? ` (${p.club.name})` : ""} on ${APP_NAME}.`, robots: { index: false } }
    : { title: "Invite link", robots: { index: false } };
}

function initials(name: string) {
  return name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await getJoinPage(token);
  if (!p)
    return (
      <main className="gutter mx-auto grid max-w-md gap-3 py-12">
        <h1 className="text-xl font-bold">This invite link doesn&apos;t work any more</h1>
        <p className="text-muted">The captain may have reset it. Ask them for the new link, or for the team code.</p>
        <Link href="/" className={buttonClass("secondary", "md", "justify-self-start")}>
          Go to {APP_NAME}
        </Link>
      </main>
    );
  const { team, club } = p;
  const here = `/join/${token}`;
  return (
    <main data-team={team.id} className="min-h-dvh bg-surface">
      <style dangerouslySetInnerHTML={{ __html: teamThemeCss(team.id, team.color, team.colorSecondary) }} />
      <div className="gutter border-b-4 border-team-2 bg-team pt-[calc(env(safe-area-inset-top,0px)+28px)] pb-6 text-on-team">
        <div className="mx-auto grid max-w-md gap-3">
          <p className="text-sm opacity-90">You&apos;re invited to join</p>
          <div className="flex items-center gap-3">
            {team.crest ? (
              <img src={team.crest} alt="" className="size-14 shrink-0 rounded-lg bg-bg object-cover ring-2 ring-on-team/40" />
            ) : (
              <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-pill border-2 border-on-team font-display text-xl font-bold">
                {initials(team.name)}
              </span>
            )}
            <h1 className="min-w-0 font-display text-display leading-none font-bold break-words uppercase">{team.name}</h1>
          </div>
          <p className="text-sm opacity-90">
            {[club?.name, team.level, team.location, `${p.players} ${p.players === 1 ? "player" : "players"}`].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <div className="gutter mx-auto grid max-w-md gap-4 py-6">
        {p.me === "member" ? (
          <div className="grid gap-3 rounded-lg border border-border bg-bg p-4">
            <p className="font-semibold">You&apos;re already on {team.name}.</p>
            <Link href={`/t/${team.id}/schedule`} className={buttonClass("primary", "lg", "w-full")}>
              Open the team
            </Link>
          </div>
        ) : p.me === "requested" ? (
          <div role="status" className="grid gap-1 rounded-lg border border-border bg-bg p-4">
            <p className="font-semibold">Asked to join</p>
            <p className="text-sm text-muted">The captain will let you in soon. You&apos;ll get an email when they do.</p>
          </div>
        ) : p.me === "none" ? (
          <div className="grid gap-3 rounded-lg border border-border bg-bg p-4">
            <p className="text-sm">
              {p.needsApproval
                ? "Ask to join. You'll be on the team once the captain says yes."
                : "Join as a player to see the schedule, answer for games and chat with the team."}
            </p>
            <JoinButton token={token} label={p.needsApproval ? "Ask to join" : `Join ${team.name}`} />
          </div>
        ) : (
          <>
            <section aria-labelledby="new-h" className="grid gap-3 rounded-lg border border-border bg-bg p-4">
              <div>
                <h2 id="new-h" className="text-lg font-semibold">Create your account</h2>
                <p className="text-sm text-muted">Then you&apos;ll come straight back here to join.</p>
              </div>
              <SignUpForm next={here} />
            </section>
            <p className="text-center text-sm">
              Already have an account?{" "}
              <Link href={`/login?next=${encodeURIComponent(here)}`} className="font-semibold text-team-ink underline">
                Sign in
              </Link>
            </p>
          </>
        )}
        <p className="text-center text-xs text-muted">Powered by {APP_NAME}</p>
      </div>
    </main>
  );
}
