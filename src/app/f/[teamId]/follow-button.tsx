"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bell, BellOff, Check } from "lucide-react";
import { followTeamAction } from "@/app/actions";

export function FollowButton({ teamId, following, signedIn, member }: { teamId: string; following: boolean; signedIn: boolean; member: boolean }) {
  const [on, setOn] = useState(following);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const cls = "inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-bold";
  if (member && !on)
    return (
      <span className={`${cls} bg-on-team/15`}>
        <Check aria-hidden className="size-4" />
        You&apos;re on this team
      </span>
    );
  if (!signedIn)
    return (
      <Link href={`/login?next=${encodeURIComponent(`/f/${teamId}`)}`} className={`${cls} bg-on-team text-team`}>
        <Bell aria-hidden className="size-4" />
        Follow
      </Link>
    );
  return (
    <span className="grid gap-1">
      <button
        type="button"
        disabled={pending}
        aria-pressed={on}
        onClick={() =>
          start(async () => {
            const next = !on;
            setOn(next);
            const r = await followTeamAction(teamId, next);
            if (r?.error) {
              setOn(!next);
              setErr(r.error);
            } else setErr(null);
          })
        }
        className={`${cls} ${on ? "border-2 border-on-team bg-transparent" : "bg-on-team text-team"}`}
      >
        {on ? <BellOff aria-hidden className="size-4" /> : <Bell aria-hidden className="size-4" />}
        {on ? "Following" : "Follow"}
      </button>
      {err && (
        <span role="alert" className="text-xs">
          {err}
        </span>
      )}
    </span>
  );
}
