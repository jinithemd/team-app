"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { deleteGroupMessageAction, sendGroupMessageAction } from "@/app/group-actions";

type Msg = { id: string; author: string; authorId: string | null; body: string; at: string; mine: boolean };

const time = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return new Intl.DateTimeFormat("en-CA", today ? { hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
};

/** The group's chat. Refreshes every few seconds while it's on screen. */
export function GroupChat({ groupId, messages, manage }: { groupId: string; messages: Msg[]; manage: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), 6000);
    const back = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", back);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", back);
    };
  }, [router]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    start(async () => {
      const r = await sendGroupMessageAction(groupId, body);
      if (r.error) setErr(r.error);
      else {
        setErr(null);
        setText("");
        router.refresh();
      }
    });
  }

  return (
    <section aria-label="Group chat" className="grid gap-3">
      {messages.length === 0 ? (
        <p className="rounded-lg bg-surface p-4 text-center text-sm text-muted">No messages yet. Say hi, or ask who&apos;s in for Sunday.</p>
      ) : (
        <ol className="grid gap-2.5">
          {messages.map((m, i) => {
            const first = i === 0 || messages[i - 1].authorId !== m.authorId;
            return (
              <li key={m.id} className={`grid max-w-[85%] gap-0.5 ${m.mine ? "justify-self-end text-right" : "justify-self-start"}`}>
                {first && !m.mine && <span className="px-1 text-xs font-semibold text-muted">{m.author}</span>}
                <div className={`rounded-xl px-3 py-2 text-left break-words whitespace-pre-wrap ${m.mine ? "bg-fg text-bg" : "bg-surface"}`}>{m.body}</div>
                <span className="flex items-center gap-2 px-1 text-[11px] text-muted">
                  {time(m.at)}
                  {(m.mine || manage) && (
                    <button
                      type="button"
                      aria-label={`Delete message: ${m.body.slice(0, 40)}`}
                      onClick={() =>
                        start(async () => {
                          await deleteGroupMessageAction(groupId, m.id);
                          router.refresh();
                        })
                      }
                      className="font-semibold underline"
                    >
                      Delete
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <div ref={end} />
      <form onSubmit={send} className="sticky bottom-[calc(var(--nav-h,64px)+8px)] flex items-end gap-2 rounded-xl border border-border bg-bg p-2 shadow-sm">
        <label htmlFor="group-msg" className="sr-only">
          Message
        </label>
        <textarea
          id="group-msg"
          rows={1}
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) send(e);
          }}
          placeholder="Message the group"
          className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-base outline-none"
        />
        <button type="submit" disabled={pending || !text.trim()} aria-label="Send" className="grid size-11 shrink-0 place-items-center rounded-pill bg-fg text-bg disabled:opacity-40">
          <Send aria-hidden className="size-5" />
        </button>
      </form>
      {err && (
        <p role="alert" className="text-sm text-danger">
          {err}
        </p>
      )}
    </section>
  );
}
