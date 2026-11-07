"use client";

import { useEffect, useRef, useState } from "react";

/*
 * A button that asks "are you sure?" right where it is, instead of a browser confirm() pop-up.
 * Pop-ups are unreliable in phone apps and home-screen web apps (some never show, and then
 * the answer is always "no"), so nothing happened when people tapped Delete.
 */
export function ConfirmButton({
  children,
  question,
  yes,
  no = "Keep it",
  onConfirm,
  disabled,
  className,
  ariaLabel,
}: {
  children: React.ReactNode;
  question: string;
  yes: string;
  no?: string;
  onConfirm: () => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [asking, setAsking] = useState(false);
  const yesRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (asking) yesRef.current?.focus();
  }, [asking]);

  if (!asking)
    return (
      <button type="button" disabled={disabled} aria-label={ariaLabel} onClick={() => setAsking(true)} className={className}>
        {children}
      </button>
    );
  return (
    <div role="group" aria-label={question} className="grid w-full gap-2 rounded-md border border-danger bg-danger-soft p-3">
      <p className="text-sm">{question}</p>
      <div className="flex flex-wrap gap-2">
        <button
          ref={yesRef}
          type="button"
          disabled={disabled}
          onClick={() => {
            setAsking(false);
            onConfirm();
          }}
          className="min-h-10 rounded-md bg-danger px-3 text-sm font-semibold text-on-danger disabled:opacity-50"
        >
          {yes}
        </button>
        <button type="button" onClick={() => setAsking(false)} className="min-h-10 rounded-md border border-border px-3 text-sm font-semibold">
          {no}
        </button>
      </div>
    </div>
  );
}
