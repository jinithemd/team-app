import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, QrCode, Users } from "lucide-react";
import { getTeam, listTeamSponsors, myPerms } from "@/lib/data";
import { getFanPage } from "@/lib/fans";
import { ShareLink } from "@/components/tournament/share-link";
import { ShareImage } from "./share-image";

// Ready-made posts for the team's socials: a QR poster that brings fans to the fan page,
// a grid of every sponsor, and a welcome post for each sponsor.

export default async function SharePage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const [team, fan, sponsors, perms] = await Promise.all([getTeam(teamId), getFanPage(teamId), listTeamSponsors(teamId), myPerms(teamId)]);
  if (!team || !fan) notFound();
  const v = Date.now().toString(36);
  const slug = team.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "team";
  return (
    <div className="grid gap-6">
      <section aria-labelledby="fans-h" className="grid gap-3">
        <div className="grid gap-1">
          <h2 id="fans-h" className="flex items-center gap-2 text-xl font-bold">
            <QrCode aria-hidden className="size-5" />
            Bring in your fans
          </h2>
          <p className="text-sm text-muted">
            Post this on Instagram, WhatsApp or a poster at the pitch. Fans scan it to open your fan page and tap Follow to keep up with your games, results and trophies. They never see your roster, chat or anyone&apos;s details.
          </p>
        </div>
        {!team.isPublic && (
          <p className="flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm">
            <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              Your team is private, so only members can open the fan page.{" "}
              {perms.settings ? (
                <Link href={`/t/${teamId}/settings`} className="font-semibold underline">
                  Turn on &ldquo;Public team&rdquo; in Settings
                </Link>
              ) : (
                "Ask your captain to make the team public in Settings"
              )}{" "}
              before you post it.
            </span>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href={`/f/${teamId}`} className="font-semibold text-team-ink underline">
            Open your fan page
          </Link>
          <ShareLink path={`/f/${teamId}`} title={`Follow ${team.name}`} />
          <span className="inline-flex items-center gap-1 text-muted">
            <Users aria-hidden className="size-4" />
            {fan.followers} {fan.followers === 1 ? "follower" : "followers"}
          </span>
        </div>
        <ShareImage
          src={`/api/share/follow/${teamId}?v=${v}`}
          file={`${slug}-follow-us.png`}
          title={`Follow ${team.name}`}
          text={`Follow ${team.name} for our games, results and news!`}
          alt={`QR poster: follow ${team.name}`}
        />
      </section>

      <section aria-labelledby="sp-h" className="grid gap-3">
        <div className="grid gap-1">
          <h2 id="sp-h" className="text-xl font-bold">
            Sponsor posts
          </h2>
          <p className="text-sm text-muted">Thank your sponsors in public: one post with all of them, or a welcome post for each.</p>
        </div>
        {sponsors.length === 0 ? (
          <p className="text-sm text-muted">
            No sponsors yet.{" "}
            {perms.staff && (
              <Link href={`/t/${teamId}/sponsors/new`} className="font-semibold text-team-ink underline">
                Add a sponsor
              </Link>
            )}
          </p>
        ) : (
          <>
            <ShareImage
              src={`/api/share/sponsors/${teamId}?v=${v}`}
              file={`${slug}-sponsors.png`}
              title={`${team.name} sponsors`}
              text={`Proudly supported by ${sponsors.map((s) => s.name).join(", ")}. Thank you!`}
              alt={`All of ${team.name}'s sponsors`}
            />
            <details className="rounded-lg border border-border">
              <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold">Welcome posts for each sponsor ({sponsors.length})</summary>
              <ul className="grid gap-6 border-t border-border p-4">
                {sponsors.map((s) => (
                  <li key={s.id} className="grid gap-2">
                    <p className="font-semibold">{s.name}</p>
                    <ShareImage
                      square
                      src={`/api/share/sponsor/${teamId}?s=${s.id}&v=${v}`}
                      file={`${slug}-welcome-${s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`}
                      title={`Welcome ${s.name}`}
                      text={`Welcome to the team, ${s.name}! Thank you for supporting ${team.name}.`}
                      alt={`Welcome post for ${s.name}`}
                    />
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </section>
    </div>
  );
}
