"use client";

import { useId, useOptimistic, useState, useTransition } from "react";
import { Check, HelpCircle, X } from "lucide-react";
import { setRsvpAction } from "@/app/actions";
import type { RsvpResponse } from "@/lib/data/types";

const OPTIONS: { v: RsvpResponse; label: string; icon: React.ReactNode; on: string }[] = [
  { v: "going", label: "Going", icon: <Check aria-hidden />, on: "bg-success border-success text-on-success" },
  { v: "maybe", label: "Maybe", icon: <HelpCircle aria-hidden />, on: "bg-warning border-warning text-on-warning" },
  { v: "not_going", label: "Can't make it", icon: <X aria-hidden />, on: "bg-danger border-danger text-on-danger" },
];

/**
 * Three-way answer for one player, with an optional private note to the captains.
 * Optimistic: the choice fills immediately and reverts with a message if saving fails.
 */
export function RsvpControl({
  eventId,
  userId,
  personName,
  showName,
  initial,
  initialNote,
  locked,
  size = "md",
}: {
  eventId: string;
  userId: string;
  personName: string;
  showName?: boolean;
  initial: RsvpResponse | null;
  initialNote: string | null;
  locked?: string;
  size?: "sm" | "md";
}) {
  const [saved, setSaved] = useState(initial);
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [note, setNote] = useState(initialNote ?? "");
  const [noteOpen, setNoteOpen] = useState(!!initialNote);
  const [noteSaved, setNoteSaved] = useState(initialNote ?? "");
  const labelId = useId();
  const noteId = useId();

  function choose(v: RsvpResponse) {
    if (locked) return;
    start(async () => {
      setOptimistic(v);
      setStatus(null);
      const res = await setRsvpAction(eventId, userId, v);
      if (res.ok) {
        setSaved(res.data.response);
        setStatus({ tone: "ok", text: "Saved" });
      } else {
        setStatus({ tone: "error", text: res.error });
      }
    });
  }

  function saveNote() {
    const choice = optimistic ?? "going";
    start(async () => {
      const res = await setRsvpAction(eventId, userId, choice, note);
      if (res.ok) {
        setSaved(res.data.response);
        setNoteSaved(res.data.note ?? "");
        setStatus({ tone: "ok", text: note.trim() ? "Note sent to your captains" : "Note removed" });
      } else setStatus({ tone: "error", text: res.error });
    });
  }

  const h = size === "sm" ? "min-h-10 text-xs" : "min-h-12 text-sm";
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span id={labelId} className={showName ? "text-sm font-semibold" : "sr-only"}>
          {showName ? personName : `Answer for ${personName}`}
        </span>
        <span role="status" aria-live="polite" className={`text-xs font-medium ${status?.tone === "error" ? "text-danger" : "text-muted"}`}>
          {pending ? "Saving…" : status?.text}
        </span>
      </div>
      <div role="group" aria-labelledby={labelId} className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => {
          const on = optimistic === o.v;
          return (
            <button
              key={o.v}
              type="button"
              aria-pressed={on}
              disabled={!!locked}
              onClick={() => choose(o.v)}
              className={`flex items-center justify-center gap-1.5 rounded-md border px-1.5 leading-tight font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50 [&_svg]:size-[18px] [&_svg]:shrink-0 ${h} ${
                on ? o.on : "border-border-input bg-bg text-fg hover:bg-surface"
              }`}
            >
              {o.icon}
              {o.label}
            </button>
          );
        })}
      </div>
      {locked ? (
        <p className="text-xs text-muted">{locked}</p>
      ) : noteOpen ? (
        <div className="grid gap-1.5">
          <label htmlFor={noteId} className="text-xs font-semibold text-muted">
            Note for your captains (only they see it)
          </label>
          <div className="flex gap-2">
            <input
              id={noteId}
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), saveNote())}
              placeholder="e.g. Might be 10 minutes late"
              className="min-h-10 w-full min-w-0 rounded-md border border-border-input bg-bg px-3 text-sm focus:outline-2 focus:-outline-offset-1 focus:outline-focus"
            />
            <button
              type="button"
              onClick={saveNote}
              disabled={pending || note === noteSaved}
              className="min-h-10 shrink-0 rounded-md bg-surface px-3 text-sm font-semibold text-fg border border-border disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setNoteOpen(true)} className="justify-self-start text-sm font-semibold text-team-ink min-h-8">
          + Add a note for your captains
        </button>
      )}
    </div>
  );
}
