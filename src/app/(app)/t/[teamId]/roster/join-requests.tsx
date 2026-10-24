"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideJoinAction } from "@/app/actions";
import { Button } from "@/components/ui";

export function JoinRequests({ teamId, requests }: { teamId: string; requests: { id: string; name: string; email: string; message: string | null; when: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  if (!requests.length) return null;
  return (
    <section aria-labelledby="jr-h" className="grid gap-2 rounded-lg bg-warning-soft p-3.5">
      <h2 id="jr-h" className="eyebrow">
        {requests.length} {requests.length === 1 ? "person wants" : "people want"} to join
      </h2>
      {requests.map((r) => (
        <div key={r.id} className="grid gap-2 border-t border-border/60 pt-2 first-of-type:border-0 first-of-type:pt-0">
          <p className="text-sm">
            <strong>{r.name}</strong> <span className="break-all text-muted">· {r.email} · {r.when}</span>
          </p>
          {r.message && <p className="text-sm">&ldquo;{r.message}&rdquo;</p>}
          <div className="flex gap-2">
            <Button size="sm" disabled={pending} onClick={() => start(async () => { const x = await decideJoinAction(teamId, r.id, true); if (!x.ok) setErr(x.error); router.refresh(); })}>
              Add to the team
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const x = await decideJoinAction(teamId, r.id, false); if (!x.ok) setErr(x.error); router.refresh(); })}>
              Not now
            </Button>
          </div>
        </div>
      ))}
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
    </section>
  );
}
