"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { answerAsGuestAction } from "@/app/guest-actions";
import { buttonClass } from "@/components/ui";

const OPTIONS = [
  ["going", "Going"],
  ["maybe", "Maybe"],
  ["not_going", "Can't make it"],
] as const;

export function GuestAnswer({ eventId, current }: { eventId: string; current: "going" | "maybe" | "not_going" | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mine, setMine] = useState(current);
  const [err, setErr] = useState<string | null>(null);
  return (
    <section aria-labelledby="ans-h" className="grid gap-2 rounded-lg border border-border p-4">
      <h2 id="ans-h" className="font-semibold">
        Are you in?
      </h2>
      <div role="radiogroup" aria-label="Your answer" className="grid grid-cols-3 gap-2">
        {OPTIONS.map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={mine === v}
            disabled={pending}
            onClick={() =>
              start(async () => {
                setErr(null);
                const prev = mine;
                setMine(v);
                const r = await answerAsGuestAction(eventId, v);
                if (r.error) {
                  setMine(prev);
                  setErr(r.error);
                }
                router.refresh();
              })
            }
            className={buttonClass(mine === v ? "primary" : "secondary", "md", "w-full")}
          >
            {label}
          </button>
        ))}
      </div>
      {err && (
        <p role="alert" className="text-sm text-danger">
          {err}
        </p>
      )}
    </section>
  );
}
