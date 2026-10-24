"use client";

import { useActionState, useState } from "react";
import { resendInviteAction, setMemberStatusAction, type FormState } from "@/app/actions";
import { Button, buttonClass } from "@/components/ui";

export function MemberStatusButtons({ teamId, memberId, status }: { teamId: string; memberId: string; status: string }) {
  const [, inactive, p1] = useActionState<FormState, FormData>(setMemberStatusAction.bind(null, teamId, memberId, status === "inactive" ? "active" : "inactive"), null);
  const [removeState, remove, p2] = useActionState<FormState, FormData>(setMemberStatusAction.bind(null, teamId, memberId, "removed"), null);
  const [resendState, resend, p3] = useActionState<FormState, FormData>(resendInviteAction.bind(null, teamId, memberId), null);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      {status === "invited" ? (
        <form action={resend}>
          <button className={buttonClass("secondary")} disabled={p3}>
            {resendState?.message ?? "Send the invite again"}
          </button>
        </form>
      ) : (
        <form action={inactive}>
          <button className={buttonClass("secondary")} disabled={p1}>
            {status === "inactive" ? "Mark active again" : "Mark inactive"}
          </button>
        </form>
      )}
      {!confirm ? (
        <Button variant="secondary" className="text-danger" onClick={() => setConfirm(true)}>
          {status === "invited" ? "Cancel invite" : "Remove from team"}
        </Button>
      ) : (
        <form action={remove} className="flex items-center gap-2">
          <button className={buttonClass("danger")} disabled={p2}>
            Yes, remove
          </button>
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            Keep
          </Button>
        </form>
      )}
      {removeState?.error && <p className="w-full text-sm text-danger">{removeState.error}</p>}
      <p className="w-full text-xs text-muted">Inactive players keep their history but stop getting asked about events.</p>
    </>
  );
}
