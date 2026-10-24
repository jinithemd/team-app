"use client";

import { useActionState, useState } from "react";
import { BellRing } from "lucide-react";
import { nudgeAction, setEventStatusAction, type FormState } from "@/app/actions";
import { Button, Field, buttonClass, inputClass } from "@/components/ui";

export function StaffEventActions({
  eventId,
  teamId,
  status,
  noReply,
  past,
}: {
  eventId: string;
  teamId: string;
  status: "active" | "postponed" | "cancelled";
  noReply: number;
  past: boolean;
}) {
  const [statusState, statusAction, statusPending] = useActionState<FormState, FormData>(setEventStatusAction.bind(null, eventId, teamId), null);
  const [nudgeState, nudge, nudgePending] = useActionState<FormState, FormData>(nudgeAction.bind(null, eventId), null);
  const [mode, setMode] = useState<null | "cancelled" | "postponed">(null);

  if (past) return null;
  return (
    <section aria-labelledby="staff-h" className="grid gap-3 rounded-lg border border-dashed border-border-input p-4">
      <h2 id="staff-h" className="text-sm font-semibold">
        Staff tools
      </h2>

      {status === "active" && noReply > 0 && (
        <form action={nudge} className="flex flex-wrap items-center gap-3">
          <button className={buttonClass("secondary", "sm")} disabled={nudgePending} aria-busy={nudgePending}>
            <BellRing aria-hidden />
            {nudgePending ? "Sending…" : `Remind ${noReply} who haven't answered`}
          </button>
          <span role="status" className={`text-sm ${nudgeState?.error ? "text-danger" : "text-muted"}`}>
            {nudgeState?.error ?? nudgeState?.message}
          </span>
        </form>
      )}

      {status === "active" ? (
        mode ? (
          <form action={statusAction} className="grid gap-3">
            <input type="hidden" name="status" value={mode} />
            <Field id="reason" label={mode === "cancelled" ? "Why is it cancelled?" : "Why is it postponed?"} hint="Players see this in the email and on the schedule.">
              <input id="reason" name="reason" maxLength={140} placeholder={mode === "cancelled" ? "e.g. Field closed for frost" : "e.g. Waiting on a new field booking"} className={inputClass} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button className={buttonClass(mode === "cancelled" ? "danger" : "primary", "sm")} disabled={statusPending} aria-busy={statusPending}>
                {statusPending ? "Saving…" : mode === "cancelled" ? "Cancel and tell the team" : "Postpone and tell the team"}
              </button>
              <Button variant="ghost" size="sm" onClick={() => setMode(null)}>
                Keep it on
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setMode("postponed")}>
              Postpone
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setMode("cancelled")} className="text-danger">
              Cancel event
            </Button>
          </div>
        )
      ) : (
        <form action={statusAction}>
          <input type="hidden" name="status" value="active" />
          <button className={buttonClass("secondary", "sm")} disabled={statusPending}>
            Put it back on the schedule
          </button>
        </form>
      )}
      {(statusState?.error || statusState?.message) && (
        <p role="status" className={`text-sm ${statusState.error ? "text-danger" : "text-muted"}`}>
          {statusState.error ?? statusState.message}
        </p>
      )}
    </section>
  );
}
