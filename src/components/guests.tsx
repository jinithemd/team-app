"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Search, UserPlus, X } from "lucide-react";
import {
  addGuestAction, addGuestToEventAction, findGuestPeopleAction, inviteGuestsAction, removeGuestAction, setGuestAnswerAction, uninviteGuestAction,
} from "@/app/guest-actions";
import { Avatar, buttonClass, inputClass } from "@/components/ui";

/*
 * Guest players on the team's screens: the guest list (Roster), and who's asked to one game
 * (the event page). Adding someone: search a Clbx profile, or type a name (and an email so
 * they get the game by email).
 */

type Picked = { userId?: string; name?: string; email?: string };

/** Search a profile or type a name. Calls onAdd with what was picked. */
export function GuestPicker({ teamId, onAdd, pending, keepBox }: { teamId: string; onAdd: (p: Picked, keep: boolean) => void; pending: boolean; keepBox?: boolean }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ id: string; name: string; hint: string | null }[]>([]);
  const [manual, setManual] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [keep, setKeep] = useState(true);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return setHits([]);
    let live = true;
    const t = setTimeout(() => void findGuestPeopleAction(teamId, term).then((r) => live && setHits(r)), 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, teamId]);

  const reset = () => (setQ(""), setHits([]), setName(""), setEmail(""), setManual(false));

  return (
    <div className="grid gap-2">
      {!manual ? (
        <>
          <label htmlFor="guest-search" className="text-sm font-semibold">
            Find their Clbx profile
          </label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input id="guest-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, or their exact email" autoComplete="off" className={`${inputClass} min-h-11 pl-9`} />
          </div>
          {q.trim().length >= 2 && (
            <ul aria-label="People found" className="grid gap-1">
              {hits.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      onAdd({ userId: h.id }, keep);
                      reset();
                    }}
                    className="flex w-full items-center gap-3 rounded-md border border-border p-2 text-left hover:bg-surface"
                  >
                    <Avatar name={h.name} size={32} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{h.name}</span>
                    {h.hint && <span className="text-xs text-muted">{h.hint}</span>}
                    <span className="text-sm font-semibold text-team-ink">Add</span>
                  </button>
                </li>
              ))}
              {hits.length === 0 && <li className="text-sm text-muted">No one found. Try their exact email, or add them by name.</li>}
            </ul>
          )}
          <button type="button" onClick={() => (setManual(true), setName(q.includes("@") ? "" : q), setEmail(q.includes("@") ? q : ""))} className="justify-self-start text-sm font-semibold text-team-ink underline">
            Not on Clbx? Add them by name
          </button>
        </>
      ) : (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onAdd({ name, email }, keep);
            reset();
          }}
        >
          <label className="grid gap-1 text-sm font-semibold">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoComplete="off" className={`${inputClass} min-h-11 font-normal`} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Email <span className="font-normal text-muted">(optional: so they get the game and can answer)</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" className={`${inputClass} min-h-11 font-normal`} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button disabled={pending || !name.trim()} className={buttonClass("primary", "md")}>
              <UserPlus aria-hidden />
              Add guest
            </button>
            <button type="button" onClick={() => setManual(false)} className={buttonClass("ghost", "md")}>
              Search instead
            </button>
          </div>
        </form>
      )}
      {keepBox && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="size-4" />
          Keep them on our guest list (they&apos;ll get pickup games, matches and events)
        </label>
      )}
    </div>
  );
}

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.error ? { tone: "error", text: r.error } : r.message ? { tone: "ok", text: r.message } : null);
      router.refresh();
    });
  return { pending, msg, run };
}

function Msg({ msg }: { msg: { tone: "ok" | "error"; text: string } | null }) {
  return (
    <p role="status" className={`text-sm ${msg?.tone === "error" ? "text-danger" : "text-success"} ${msg ? "" : "sr-only"}`}>
      {msg?.text ?? ""}
    </p>
  );
}

/** Roster: the team's guest list. */
export function GuestList({ teamId, guests, manage }: { teamId: string; guests: { id: string; name: string; email: string | null; hasAccount: boolean; games: number }[]; manage: boolean }) {
  const { pending, msg, run } = useRun();
  const [adding, setAdding] = useState(false);
  if (!manage && guests.length === 0) return null;
  return (
    <section aria-labelledby="guests-h" className="grid gap-2 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="guests-h" className="eyebrow">
          Guest players ({guests.length})
        </h2>
        {manage && !adding && (
          <button type="button" onClick={() => setAdding(true)} className="text-sm font-semibold text-team-ink">
            Add a guest player
          </button>
        )}
      </div>
      <p className="text-sm text-muted">Not on the roster, but they play some games. They get pickup games, matches, tournaments and events you send them, and never see team chat, payments or the roster.</p>
      {guests.length > 0 && (
        <ul aria-label="Guest players" className="grid">
          {guests.map((x) => (
            <li key={x.id} className="flex items-center gap-3 border-b border-border py-2 last:border-0">
              <Avatar name={x.name} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{x.name}</span>
                <span className="block truncate text-xs text-muted">
                  {[x.email ?? (manage && !x.hasAccount ? "No email: they won't get emails" : null), x.games ? `${x.games} ${x.games === 1 ? "game" : "games"}` : null].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="shrink-0 rounded-pill bg-sunken px-2 py-0.5 text-[11px] font-bold tracking-[.05em] text-muted uppercase">Guest</span>
              {manage && (
                <button type="button" disabled={pending} onClick={() => run(() => removeGuestAction(teamId, x.id))} aria-label={`Take ${x.name} off the guest list`} className="grid size-9 shrink-0 place-items-center rounded-pill text-muted hover:bg-surface hover:text-danger">
                  <X aria-hidden className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {manage && adding && (
        <div className="grid gap-2 rounded-md bg-surface p-3">
          <GuestPicker teamId={teamId} pending={pending} onAdd={(p) => run(() => addGuestAction(teamId, p))} />
          <button type="button" onClick={() => setAdding(false)} className="justify-self-start text-sm font-semibold text-muted">
            Done
          </button>
        </div>
      )}
      <Msg msg={msg} />
    </section>
  );
}

const ANSWER: Record<string, string> = { going: "Going", maybe: "Maybe", not_going: "Can't make it" };

/** Event page: the guests asked to this game, their answers, and asking more. */
export function EventGuests({
  teamId, eventId, invited, others, manage, cancelled,
}: {
  teamId: string;
  eventId: string;
  invited: { id: string; name: string; response: "going" | "maybe" | "not_going" | null; hasAccount: boolean; onList: boolean }[];
  others: { id: string; name: string }[];
  manage: boolean;
  cancelled: boolean;
}) {
  const { pending, msg, run } = useRun();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  if (!manage && invited.length === 0) return null;
  const going = invited.filter((x) => x.response === "going").length;
  return (
    <section aria-labelledby="eg-h" className="grid gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="eg-h" className="eyebrow">
          Guest players{invited.length ? ` · ${going} of ${invited.length} going` : ""}
        </h2>
        {manage && !cancelled && !open && (
          <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-team-ink">
            Add guest players
          </button>
        )}
      </div>
      {invited.length === 0 ? (
        <p className="text-sm text-muted">No guests asked to this one.</p>
      ) : (
        <ul aria-label="Guests asked" className="grid">
          {invited.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border py-2 last:border-0">
              <Avatar name={x.name} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{x.name}</span>
                <span className="block text-xs text-muted">Guest{!x.onList ? " · just this game" : ""}</span>
              </span>
              {manage ? (
                <label className="order-last basis-full pl-11 sm:order-none sm:basis-auto sm:pl-0">
                  <span className="sr-only">{x.name}&apos;s answer</span>
                  <select
                    value={x.response ?? ""}
                    disabled={pending || cancelled}
                    onChange={(e) => e.target.value && run(() => setGuestAnswerAction(teamId, eventId, x.id, e.target.value as "going"))}
                    className={`${inputClass} min-h-9 py-1 text-sm sm:w-auto`}
                  >
                    <option value="">No answer yet</option>
                    <option value="going">Going</option>
                    <option value="maybe">Maybe</option>
                    <option value="not_going">Can&apos;t make it</option>
                  </select>
                </label>
              ) : (
                <span className={`shrink-0 text-sm font-semibold ${x.response === "going" ? "text-success" : x.response === "not_going" ? "text-danger" : "text-muted"}`}>{x.response ? ANSWER[x.response] : "No answer yet"}</span>
              )}
              {manage && (
                <button type="button" disabled={pending} onClick={() => run(() => uninviteGuestAction(teamId, eventId, x.id))} aria-label={`Don't ask ${x.name} to this one`} className="grid size-9 shrink-0 place-items-center rounded-pill text-muted hover:bg-surface hover:text-danger">
                  <X aria-hidden className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {manage && open && (
        <div className="grid gap-3 rounded-md bg-surface p-3">
          {others.length > 0 && (
            <fieldset className="grid gap-1.5">
              <legend className="mb-1 text-sm font-semibold">From your guest list</legend>
              {others.map((x) => (
                <label key={x.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4" checked={chosen.includes(x.id)} onChange={(e) => setChosen((c) => (e.target.checked ? [...c, x.id] : c.filter((y) => y !== x.id)))} />
                  {x.name}
                </label>
              ))}
              <div className="mt-1 flex flex-wrap gap-2">
                <button type="button" disabled={pending || !chosen.length} onClick={() => run(async () => { const r = await inviteGuestsAction(teamId, eventId, chosen); setChosen([]); return r; })} className={buttonClass("primary", "sm")}>
                  <Check aria-hidden />
                  Ask {chosen.length || ""} {chosen.length === 1 ? "guest" : "guests"}
                </button>
                <button type="button" disabled={pending} onClick={() => run(() => inviteGuestsAction(teamId, eventId, "all"))} className={buttonClass("secondary", "sm")}>
                  Ask all {others.length}
                </button>
              </div>
            </fieldset>
          )}
          <div className="grid gap-2 border-t border-border pt-3 first:border-0 first:pt-0">
            <p className="text-sm font-semibold">Someone new</p>
            <GuestPicker teamId={teamId} pending={pending} keepBox onAdd={(p, keep) => run(() => addGuestToEventAction(teamId, eventId, p, keep))} />
          </div>
          <button type="button" onClick={() => setOpen(false)} className="justify-self-start text-sm font-semibold text-muted">
            Done
          </button>
        </div>
      )}
      <Msg msg={msg} />
    </section>
  );
}
