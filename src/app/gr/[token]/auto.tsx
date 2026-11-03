"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import { guestAnswerFromLinkAction } from "@/app/guest-actions";

type Result = Awaited<ReturnType<typeof guestAnswerFromLinkAction>>;

const COPY = {
  going: { icon: CheckCircle2, cls: "text-success", text: (n: string) => `You're in, ${n}` },
  maybe: { icon: HelpCircle, cls: "text-warning", text: (n: string) => `Marked as maybe, ${n}` },
  not_going: { icon: XCircle, cls: "text-danger", text: (n: string) => `Got it, ${n}: you can't make it` },
};

export function GuestAutoAnswer({ token }: { token: string }) {
  const [res, setRes] = useState<Result | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    guestAnswerFromLinkAction(token).then(setRes, () => setRes({ ok: false, error: "We couldn't save that. Check your connection and try again." }));
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
      <h1 className="text-2xl font-bold">{c.text(res.name.split(/\s+/)[0])}</h1>
      <p className="text-lg font-semibold">
        {res.team} · {res.title}
      </p>
      <p className="text-muted">{res.when}</p>
      <p className="text-sm text-muted">The captain can see your answer. Tap another button in the email any time to change it.</p>
    </div>
  );
}
