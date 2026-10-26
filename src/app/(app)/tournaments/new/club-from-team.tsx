"use client";

import { useState, useTransition } from "react";
import { clubFromTeamAction } from "@/app/tournament-actions";
import { buttonClass } from "@/components/ui";

export function ClubFromTeam({ teams }: { teams: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="grid gap-2">
      {teams.map((t) => (
        <button
          key={t.id}
          type="button"
          disabled={pending}
          onClick={() => start(async () => setErr((await clubFromTeamAction(t.id))?.error ?? null))}
          className={buttonClass("primary", "lg", "w-full sm:w-auto sm:justify-self-start")}
        >
          {pending ? "Setting up…" : `Make ${t.name} a club and host`}
        </button>
      ))}
      {err && (
        <p role="alert" className="text-sm text-danger">
          {err}
        </p>
      )}
    </div>
  );
}
