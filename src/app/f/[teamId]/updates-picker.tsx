"use client";

import { useState, useTransition } from "react";
import { FAN_UPDATE_LABEL, type FanUpdate } from "@/lib/data/types";
import { setFollowUpdatesAction } from "@/app/actions";

/** A follower picks which of the team's updates they get. */
export function UpdatesPicker({ teamId, offers, chosen }: { teamId: string; offers: FanUpdate[]; chosen: FanUpdate[] }) {
  const [on, setOn] = useState(new Set(chosen));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const toggle = (k: FanUpdate) => {
    const next = new Set(on);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setOn(next);
    start(async () => {
      const r = await setFollowUpdatesAction(teamId, [...next]);
      setMsg(r.error ?? (next.size ? "Saved." : "Saved. You'll still see them on your Home page, just no emails."));
    });
  };
  return (
    <section aria-labelledby="updates-h" className="grid gap-2 rounded-lg border border-border bg-bg p-4">
      <h2 id="updates-h" className="font-display text-lg font-bold">
        Your updates
      </h2>
      <p className="text-sm text-muted">Pick what you&apos;d like to hear about. We&apos;ll email you, or send a notification if you have the app.</p>
      <ul className="grid gap-1">
        {offers.map((k) => (
          <li key={k}>
            <label className="flex min-h-12 cursor-pointer items-start gap-3 py-1.5">
              <input type="checkbox" checked={on.has(k)} disabled={pending} onChange={() => toggle(k)} className="mt-0.5 size-5 shrink-0 accent-[var(--fg)]" />
              <span>
                <span className="block font-semibold">{FAN_UPDATE_LABEL[k].title}</span>
                <span className="block text-sm text-muted">{FAN_UPDATE_LABEL[k].hint}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p role="status" className="min-h-5 text-xs text-muted">
        {msg}
      </p>
    </section>
  );
}
