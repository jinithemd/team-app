"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import { rsvpFromLinkAction } from "@/app/actions";

type Result = Awaited<ReturnType<typeof rsvpFromLinkAction>>;

const COPY = {
  going: { icon: CheckCircle2, cls: "text-success", text: (n: string) => `You're in, ${n}` },
  maybe: { icon: HelpCircle, cls: "text-warning", text: (n: string) => `Marked as maybe, ${n}` },
  not_going: { icon: XCircle, cls: "text-danger", text: (n: string) => `Got it, ${n}: you can't make it` },
};

export function AutoRsvp({ token }: { token: string }) {
  const [res, setRes] = useState<Result | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    rsvpFromLinkAction(token).then(setRes, () => setRes({ ok: false, error: "We couldn't save that. Check your connection and try again." }));
  }, [token]);

  if (!res)
    return (
      <p role="status" className="text-lg font-semibold">
        Saving your answer…
      </p>
    );
  if (!res.ok)
    return (
      <div role="alert" className="grid gap-2">
        <h1 className="text-xl font-bold">That didn&apos;t save</h1>
        <p className="text-muted">{res.error}</p>
      </div>
    );
  const c = COPY[res.response];
  const Icon = c.icon;
  return (
    <div role="status" className="grid gap-3">
      <Icon aria-hidden className={`size-12 ${c.cls}`} />
      <h1 className="text-2xl font-bold">{c.text(res.personName)}</h1>
      <p className="text-muted">Thanks. Your captains can see your answer. Tap another button in the email any time to change it.</p>
      <a href={`/t/${res.teamId}/e/${res.eventId}`} className="justify-self-start font-semibold text-team-ink underline">
        See the event and add a note
      </a>
    </div>
  );
}
