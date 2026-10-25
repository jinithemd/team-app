"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, QrCode, RotateCcw, Share2 } from "lucide-react";
import { resetInviteLinkAction, setLinkApprovalAction } from "@/app/actions";
import { buttonClass, inputClass } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";

export function InviteLink({ teamId, teamName, url, needsApproval, qrSvg }: { teamId: string; teamName: string; url: string; needsApproval: boolean; qrSvg: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [approval, setApproval] = useState(needsApproval);
  const text = `Join ${teamName} on ${APP_NAME}: ${url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy. Press and hold the link to copy it.");
    }
  }
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${teamName}`, text: `Join ${teamName} on ${APP_NAME}`, url });
      } catch {
        /* closed the share sheet */
      }
    } else copy();
  }
  function reset() {
    start(async () => {
      const r = await resetInviteLinkAction(teamId);
      setConfirmReset(false);
      if (!r.ok) return setError(r.error);
      setError(null);
      setNote("New link made. The old one no longer works.");
      router.refresh();
    });
  }
  function toggleApproval(on: boolean) {
    setApproval(on);
    start(async () => {
      const r = await setLinkApprovalAction(teamId, on);
      if (!r.ok) {
        setApproval(!on);
        return setError(r.error);
      }
      setError(null);
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="link-h" className="grid gap-3 rounded-lg border border-border bg-bg p-4">
      <div className="flex items-start gap-2">
        <Link2 aria-hidden className="mt-0.5 size-5 shrink-0 text-team-ink" />
        <div className="min-w-0">
          <h3 id="link-h" className="font-semibold">Invite link</h3>
          <p className="text-sm text-muted">Drop it in the team group chat. Anyone who opens it can make an account and join as a player.</p>
        </div>
      </div>
      <label htmlFor="invite-url" className="sr-only">Invite link</label>
      <input id="invite-url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} className={`${inputClass} w-full min-w-0 font-mono text-sm`} />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className={buttonClass("primary", "sm")}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <button type="button" onClick={share} className={buttonClass("secondary", "sm")}>
          <Share2 aria-hidden />
          Share
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
          WhatsApp
        </a>
      </div>

      <details className="group rounded-md bg-surface px-3 py-2">
        <summary className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-semibold">
          <QrCode aria-hidden className="size-4" />
          Show QR code
        </summary>
        <div className="grid justify-items-center gap-2 py-3">
          {/* Always dark-on-white so phone cameras read it in dark mode too. */}
          <div role="img" aria-label={`QR code for the ${teamName} invite link`} className="w-56 max-w-full rounded-md bg-white p-2 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <p className="text-xs text-muted">Show it at training. Players point their camera at it.</p>
        </div>
      </details>

      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 size-5 accent-[var(--team)]" checked={approval} onChange={(e) => toggleApproval(e.target.checked)} />
        <span>
          <span className="block font-semibold">Approve each person first</span>
          <span className="block text-muted">{approval ? "People who open the link ask to join. You let them in from the roster." : "Off: people who open the link join straight away."}</span>
        </span>
      </label>

      {confirmReset ? (
        <div className="grid gap-2 rounded-md bg-warning-soft p-3 text-sm">
          <p>The old link stops working for anyone who hasn&apos;t joined yet. People already on the team stay on it.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={reset} disabled={pending} className={buttonClass("primary", "sm")}>
              {pending ? "Resetting…" : "Reset link"}
            </button>
            <button type="button" onClick={() => setConfirmReset(false)} className={buttonClass("secondary", "sm")}>
              Keep this link
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmReset(true)} className="inline-flex min-h-9 items-center gap-1.5 justify-self-start text-sm font-semibold text-team-ink">
          <RotateCcw aria-hidden className="size-4" />
          Reset link
        </button>
      )}
      {note && <p role="status" className="text-sm font-medium">{note}</p>}
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
    </section>
  );
}
