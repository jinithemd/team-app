import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTeam, myPerms } from "@/lib/data";
import { utcToZoned } from "@/lib/time";
import { SessionForm } from "./session-form";

export const metadata: Metadata = { title: "New session" };

export default async function NewSessionPage({ params, searchParams }: { params: Promise<{ teamId: string }>; searchParams: Promise<{ weekly?: string }> }) {
  const { teamId } = await params;
  const weekly = (await searchParams).weekly === "1";
  const [team, perms] = await Promise.all([getTeam(teamId), myPerms(teamId)]);
  if (!team || !(perms.events || perms.staff)) notFound();
  return (
    <div className="grid gap-5">
      <Link href={`/t/${teamId}/sessions`} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Sessions
      </Link>
      <div className="grid gap-1">
        <h2 className="text-xl font-bold">{weekly ? "New weekly session" : "New session"}</h2>
        <p className="text-sm text-muted">
          {weekly ? "Same day and time every week, posted automatically." : "A one-off game for your players and supporters."}{" "}
          <Link href={weekly ? `/t/${teamId}/sessions/new` : `/t/${teamId}/sessions/new?weekly=1`} className="font-semibold text-team-ink underline">
            {weekly ? "Just one date instead" : "Make it weekly instead"}
          </Link>
        </p>
      </div>
      <SessionForm teamId={teamId} weekly={weekly} today={utcToZoned(new Date().toISOString(), "America/Toronto").date} teamName={team.name} />
    </div>
  );
}
