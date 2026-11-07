"use client";

import { useState, useTransition } from "react";
import { Check, Plus } from "lucide-react";
import { followTeamAction } from "@/app/actions";

/** Follow / Following, for team lists (Find a team, teams to follow). */
export function FollowChip({ teamId, name, following }: { teamId: string; name: string; following: boolean }) {
  const [on, setOn] = useState(following);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="grid justify-items-end gap-0.5">
      <button
        type="button"
        disabled={pending}
        aria-pressed={on}
        aria-label={on ? `Following ${name}. Unfollow` : `Follow ${name}`}
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
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-pill px-3.5 text-sm font-bold ${on ? "border border-border-input text-fg" : "bg-fg text-bg"}`}
      >
        {on ? <Check aria-hidden className="size-4" /> : <Plus aria-hidden className="size-4" />}
        {on ? "Following" : "Follow"}
      </button>
      {err && (
        <span role="alert" className="text-xs text-danger">
          {err}
        </span>
      )}
    </span>
  );
}
