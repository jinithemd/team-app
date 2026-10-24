"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { resetFeedAction } from "@/app/actions";
import { Button } from "@/components/ui";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input readOnly value={url} aria-label="Calendar link" onFocus={(e) => e.target.select()} className="min-h-11 w-full min-w-0 rounded-md border border-border-input bg-surface px-3 font-mono text-xs" />
      <Button
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {}
        }}
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

export function ResetFeed() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" disabled={pending} onClick={() => start(async () => (await resetFeedAction(), setDone(true), router.refresh()))}>
        Reset the link
      </Button>
      {done && <span role="status" className="text-sm text-success">New link ready. Subscribe again with it.</span>}
    </div>
  );
}
