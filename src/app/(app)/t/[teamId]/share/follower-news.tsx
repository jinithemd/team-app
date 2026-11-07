"use client";

import { useActionState, useRef, useEffect } from "react";
import { postFollowerNewsAction } from "@/app/actions";
import { Button } from "@/components/ui";

/** Staff post news to the followers who asked for it. */
export function FollowerNews({ teamId, followers }: { teamId: string; followers: number }) {
  const [state, act, pending] = useActionState(postFollowerNewsAction.bind(null, teamId), {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <section aria-labelledby="news-h" className="grid gap-3">
      <div className="grid gap-1">
        <h2 id="news-h" className="text-xl font-bold">
          Post to your followers
        </h2>
        <p className="text-sm text-muted">
          Team news for the {followers} {followers === 1 ? "person" : "people"} following you: a big win, a new kit, a trial day. It goes to followers who picked Team news. Your players already get your team messages.
        </p>
      </div>
      <form ref={form} action={act} className="grid gap-2">
        <label htmlFor="news" className="sr-only">
          Your news
        </label>
        <textarea id="news" name="news" rows={4} maxLength={1000} required placeholder="e.g. We're champions! Thanks to everyone who came out to cheer." className="w-full rounded-md border border-border-input bg-bg p-3 text-base" />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Sending…" : "Send to followers"}
          </Button>
          <p role="status" className={`text-sm ${state?.error ? "text-danger" : "text-muted"}`}>
            {state?.error ?? state?.message}
          </p>
        </div>
      </form>
    </section>
  );
}
