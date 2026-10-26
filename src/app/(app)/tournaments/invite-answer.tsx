"use client";

import { useState, useTransition } from "react";
import { respondInviteAction } from "@/app/tournament-actions";
import { buttonClass } from "@/components/ui";

export function InviteAnswer({ entryId, teamName }: { entryId: string; teamName: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const answer = (accept: boolean) =>
    start(async () => {
      const r = await respondInviteAction(entryId, accept);
      setMsg(r?.error ?? r?.message ?? null);
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending} onClick={() => answer(true)} className={buttonClass("primary", "sm")} aria-label={`Accept for ${teamName}`}>
        Accept
      </button>
      <button type="button" disabled={pending} onClick={() => answer(false)} className={buttonClass("secondary", "sm")} aria-label={`Decline for ${teamName}`}>
        Decline
      </button>
      {msg && (
        <span role="status" className="text-sm text-muted">
          {msg}
        </span>
      )}
    </div>
  );
}
