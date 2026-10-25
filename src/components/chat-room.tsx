"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, ImagePlus, MoreHorizontal, Pin, Reply, Send, Trash2, X } from "lucide-react";
import { chatOpAction, sendChatAction } from "@/app/actions";
import type { ChatView } from "@/lib/data/chat";
import { Avatar } from "@/components/ui";
import { TierBadge } from "@/components/sponsor-badge";

const EMOJI = ["👍", "😂", "❤️", "🔥", "👏"];

function when(iso: string) {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-CA", { weekday: "short", hour: "numeric", minute: "2-digit" });
}

/** Shrink a photo in the browser before sending, so it stays small. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.78);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ChatRoom({ chat }: { chat: ChatView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatView["messages"][number] | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [poll, setPoll] = useState<{ question: string; options: string[]; multi: boolean } | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastId = chat.messages[chat.messages.length - 1]?.id;

  useEffect(() => {
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [router]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lastId]);

  const op = (o: Parameters<typeof chatOpAction>[0]) =>
    start(async () => {
      const r = await chatOpAction(o);
      if (!r.ok) setErr(r.error);
      setOpenMenu(null);
      router.refresh();
    });

  function send() {
    setErr(null);
    start(async () => {
      const r = await sendChatAction(chat.id, { body: text, replyToId: replyTo?.id ?? null, imageUrl: image, poll });
      if (!r.ok) return setErr(r.error);
      setText("");
      setReplyTo(null);
      setImage(null);
      setPoll(null);
      router.refresh();
    });
  }

  return (
    <div className="grid min-w-0 gap-3 [&>*]:min-w-0">
      {!chat.asSponsor && (chat.hasStaffRoom || chat.hasSponsorRoom) && (
        <nav aria-label="Chat rooms" className="inline-flex gap-1 justify-self-start rounded-md bg-sunken p-1">
          {(
            [
              ["team", "Whole team", chat.kind !== "team" ? chat.teamUnread : 0, true],
              ["staff", "Captains only", chat.kind !== "staff" ? chat.staffUnread : 0, chat.hasStaffRoom],
              ["sponsors", "Sponsors", chat.kind !== "sponsors" ? chat.sponsorUnread : 0, chat.hasSponsorRoom],
            ] as const
          ).filter(([, , , show]) => show).map(([k, label, n]) => (
            <Link
              key={k}
              href={k === "team" ? `/t/${chat.teamId}/chat` : `/t/${chat.teamId}/chat?room=${k}`}
              aria-current={chat.kind === k ? "true" : undefined}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-sm px-3 text-sm font-semibold ${chat.kind === k ? "bg-team text-on-team" : "text-muted hover:text-fg"}`}
            >
              {label}
              {n > 0 && <span className="rounded-pill bg-danger px-1.5 text-[10px] font-bold text-on-danger tabular">{n}</span>}
            </Link>
          ))}
        </nav>
      )}
      {chat.kind === "staff" && <p className="text-xs text-muted">Only captains, managers and coaches see this chat.</p>}
      {chat.kind === "sponsors" && (
        <p className="rounded-md bg-surface px-3 py-2 text-xs text-muted">
          {chat.asSponsor
            ? `You're chatting with everyone on ${chat.teamName}. Players show as first name and initial. Please keep it friendly: no selling or spam.`
            : "Everyone on the team and your sponsors can read and post here. Sponsors see your first name and last initial, nothing else about you."}
        </p>
      )}

      {chat.pinned.length > 0 && (
        <section aria-label="Pinned" className="grid gap-1 rounded-md bg-team-soft px-3 py-2">
          {chat.pinned.map((p) => (
            <a key={p.id} href={`#m-${p.id}`} className="flex min-w-0 items-start gap-2 text-sm">
              <Pin aria-hidden className="mt-0.5 size-4 shrink-0 text-team-ink" />
              <span className="line-clamp-2 min-w-0 flex-1 break-words">
                <strong>{p.who}:</strong> {p.text}
              </span>
            </a>
          ))}
        </section>
      )}

      <ol aria-label="Messages" aria-live="polite" className="grid gap-3">
        {chat.messages.length === 0 && <li className="py-8 text-center text-sm text-muted">No messages yet. Say hello.</li>}
        {chat.messages.map((m, i) => {
          const prev = chat.messages[i - 1];
          const grouped = prev && prev.author.id === m.author.id && Date.parse(m.createdAt) - Date.parse(prev.createdAt) < 5 * 60_000;
          const name = m.authorName;
          const first = name.split(" ")[0];
          return (
            <li key={m.id} id={`m-${m.id}`} className={`flex gap-2 ${m.mine ? "flex-row-reverse" : ""} ${grouped ? "-mt-2" : ""}`}>
              <span className={`shrink-0 ${grouped || m.mine ? "invisible" : ""}`} aria-hidden={grouped || m.mine}>
                <Avatar name={name} size={32} />
              </span>
              <div className={`grid max-w-[82%] min-w-0 gap-1 ${m.mine ? "justify-items-end" : "justify-items-start"}`}>
                {!grouped && (
                  <p className="text-xs text-muted">
                    {!m.mine && <strong className="text-fg">{chat.asSponsor || m.authorSponsor ? name : first} </strong>}
                    {m.authorSponsor && (
                      <span className="mr-1 inline-flex items-center gap-1 align-middle">
                        <span className="text-fg">{m.authorSponsor.name}</span> <TierBadge tier={m.authorSponsor.tier} />
                      </span>
                    )}
                    {when(m.createdAt)}
                    {m.pinned && " · pinned"}
                  </p>
                )}
                <div className={`grid gap-1.5 rounded-lg px-3 py-2 text-[15px] leading-snug break-words ${m.deleted ? "bg-sunken italic text-muted" : m.mine ? "bg-team text-on-team" : "bg-surface"}`}>
                  {m.replyTo && (
                    <a href={`#m-${m.replyTo.id}`} className={`block border-l-2 pl-2 text-xs ${m.mine ? "border-on-team/60 opacity-90" : "border-team text-muted"}`}>
                      <strong>{m.replyTo.who}</strong>: {m.replyTo.text}
                    </a>
                  )}
                  {m.imageUrl && <img src={m.imageUrl} alt={`Photo from ${first}`} className="max-h-72 rounded-md object-cover" />}
                  {m.poll ? (
                    <div className="grid gap-1.5" role="group" aria-label={`Poll: ${m.poll.question}`}>
                      <p className="font-semibold">{m.poll.question}</p>
                      {m.poll.options.map((o, k) => {
                        const n = m.poll!.counts[k];
                        const pct = m.poll!.voters ? Math.round((n / m.poll!.voters) * 100) : 0;
                        const on = m.poll!.myVotes.includes(k);
                        return (
                          <button
                            key={k}
                            type="button"
                            aria-pressed={on}
                            onClick={() => op({ kind: "vote", messageId: m.id, option: k })}
                            className={`relative overflow-hidden rounded-md border px-2.5 py-1.5 text-left text-sm ${m.mine ? "border-on-team/40" : "border-border-input bg-bg"} ${on ? "font-semibold" : ""}`}
                          >
                            <span aria-hidden className={`absolute inset-y-0 left-0 ${m.mine ? "bg-on-team/20" : "bg-team-soft"}`} style={{ width: `${pct}%` }} />
                            <span className="relative flex justify-between gap-3">
                              <span>
                                {on ? "✓ " : ""}
                                {o}
                              </span>
                              <span className="tabular">{n}</span>
                            </span>
                          </button>
                        );
                      })}
                      <p className="text-xs opacity-80">
                        {m.poll.voters} voted{m.poll.multi ? " · pick any" : ""}
                      </p>
                    </div>
                  ) : (
                    m.body && <p className="whitespace-pre-line">{m.deleted ? "Message deleted" : m.body}</p>
                  )}
                  {m.deleted && !m.body && <p>Message deleted</p>}
                </div>
                {(m.reactions.length > 0 || !m.deleted) && (
                  <div className={`flex flex-wrap items-center gap-1 ${m.mine ? "flex-row-reverse" : ""}`}>
                    {m.reactions.map((r) => (
                      <button
                        key={r.emoji}
                        type="button"
                        aria-pressed={r.mine}
                        aria-label={`${r.emoji} ${r.count}${r.mine ? ", including you" : ""}`}
                        onClick={() => op({ kind: "react", messageId: m.id, emoji: r.emoji })}
                        className={`inline-flex min-h-7 items-center gap-1 rounded-pill border px-2 text-xs tabular ${r.mine ? "border-team bg-team-soft" : "border-border"}`}
                      >
                        {r.emoji} {r.count}
                      </button>
                    ))}
                    {!m.deleted && (
                      <button
                        type="button"
                        aria-label={`More for ${first}'s message`}
                        aria-expanded={openMenu === m.id}
                        onClick={() => setOpenMenu(openMenu === m.id ? null : m.id)}
                        className="grid size-7 place-items-center rounded-pill text-muted hover:bg-sunken"
                      >
                        <MoreHorizontal aria-hidden className="size-4" />
                      </button>
                    )}
                  </div>
                )}
                {openMenu === m.id && (
                  <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-bg p-1 shadow-card">
                    {EMOJI.map((e) => (
                      <button key={e} type="button" aria-label={`React ${e}`} onClick={() => op({ kind: "react", messageId: m.id, emoji: e })} className="grid size-9 place-items-center rounded-md text-lg hover:bg-sunken">
                        {e}
                      </button>
                    ))}
                    <button type="button" onClick={() => (setReplyTo(m), setOpenMenu(null))} className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm font-semibold hover:bg-sunken">
                      <Reply aria-hidden className="size-4" />
                      Reply
                    </button>
                    {chat.canModerate && (
                      <button type="button" onClick={() => op({ kind: m.pinned ? "unpin" : "pin", messageId: m.id })} className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm font-semibold hover:bg-sunken">
                        <Pin aria-hidden className="size-4" />
                        {m.pinned ? "Unpin" : "Pin"}
                      </button>
                    )}
                    {(m.mine || chat.canModerate) && (
                      <button type="button" onClick={() => op({ kind: "delete", messageId: m.id })} className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm font-semibold text-danger hover:bg-danger-soft">
                        <Trash2 aria-hidden className="size-4" />
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div ref={endRef} />

      {chat.canPost ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="sticky bottom-[calc(64px+env(safe-area-inset-bottom,0px))] grid gap-2 border-t border-border bg-bg pt-3 pb-2 lg:bottom-0"
        >
          {replyTo && (
            <div className="flex items-center justify-between gap-2 rounded-md bg-surface px-3 py-1.5 text-xs">
              <span className="min-w-0 truncate">
                Replying to <strong>{replyTo.authorName.split(" ")[0]}</strong>: {replyTo.body || "photo"}
              </span>
              <button type="button" aria-label="Cancel reply" onClick={() => setReplyTo(null)} className="grid size-7 place-items-center">
                <X aria-hidden className="size-4" />
              </button>
            </div>
          )}
          {image && (
            <div className="relative justify-self-start">
              <img src={image} alt="Photo to send" className="h-24 rounded-md object-cover" />
              <button type="button" aria-label="Remove photo" onClick={() => setImage(null)} className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-pill bg-fg text-bg">
                <X aria-hidden className="size-4" />
              </button>
            </div>
          )}
          {poll && (
            <fieldset className="grid gap-2 rounded-md border border-border p-3">
              <legend className="px-1 text-sm font-semibold">New poll</legend>
              <input aria-label="Poll question" value={poll.question} onChange={(e) => setPoll({ ...poll, question: e.target.value })} placeholder="Ask the team…" className="min-h-10 rounded-md border border-border-input bg-bg px-3 text-sm" />
              {poll.options.map((o, k) => (
                <input
                  key={k}
                  aria-label={`Option ${k + 1}`}
                  value={o}
                  onChange={(e) => setPoll({ ...poll, options: poll.options.map((x, j) => (j === k ? e.target.value : x)) })}
                  placeholder={`Option ${k + 1}`}
                  className="min-h-10 rounded-md border border-border-input bg-bg px-3 text-sm"
                />
              ))}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {poll.options.length < 6 && (
                  <button type="button" className="font-semibold text-team-ink" onClick={() => setPoll({ ...poll, options: [...poll.options, ""] })}>
                    + Option
                  </button>
                )}
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={poll.multi} onChange={(e) => setPoll({ ...poll, multi: e.target.checked })} className="size-4 accent-[var(--team)]" />
                  People can pick more than one
                </label>
                <button type="button" className="ml-auto font-semibold text-muted" onClick={() => setPoll(null)}>
                  Cancel poll
                </button>
              </div>
            </fieldset>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="Add a photo"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setImage(await shrink(f));
                e.target.value = "";
              }}
            />
            <button type="button" aria-label="Add a photo" onClick={() => fileRef.current?.click()} className="grid size-11 shrink-0 place-items-center rounded-md text-muted hover:bg-sunken">
              <ImagePlus aria-hidden className="size-5" />
            </button>
            <button type="button" aria-label="Start a poll" onClick={() => setPoll(poll ?? { question: "", options: ["", ""], multi: false })} className="grid size-11 shrink-0 place-items-center rounded-md text-muted hover:bg-sunken">
              <BarChart3 aria-hidden className="size-5" />
            </button>
            {!poll && (
              <textarea
                aria-label="Message"
                value={text}
                rows={1}
                maxLength={2000}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={chat.kind === "sponsors" ? (chat.asSponsor ? "Message the team" : "Message the team and sponsors") : "Message the team"}
                className="max-h-32 min-h-11 w-0 min-w-0 flex-1 resize-none rounded-md border border-border-input bg-bg px-3 py-2.5 text-base focus:outline-2 focus:outline-focus"
              />
            )}
            <button type="submit" aria-label={poll ? "Post poll" : "Send"} disabled={pending} className={`grid size-11 shrink-0 place-items-center rounded-md bg-team text-on-team disabled:opacity-50 ${poll ? "ml-auto" : ""}`}>
              <Send aria-hidden className="size-5" />
            </button>
          </div>
          {err && (
            <p role="alert" className="text-sm font-medium text-danger">
              {err}
            </p>
          )}
        </form>
      ) : (
        <p className="rounded-md bg-surface px-3 py-2 text-sm text-muted">Only captains can post here. You can still react and vote in polls.</p>
      )}
    </div>
  );
}
