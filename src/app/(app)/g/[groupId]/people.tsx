"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus } from "lucide-react";
import { addToGroupAction, deleteGroupAction, editGroupAction, findGroupPeopleAction, removeFromGroupAction } from "@/app/group-actions";
import { ConfirmButton } from "@/components/confirm-button";
import { Avatar, Button, Field, Input, buttonClass, inputClass } from "@/components/ui";

type Person = { id: string; name: string; you?: boolean };

/** Who's in the group. Staff add and take people out; anyone can leave. */
export function GroupPeople({ groupId, members, manage, member, roster }: { groupId: string; members: Person[]; manage: boolean; member: boolean; roster: Person[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const add = (ids: string[]) =>
    start(async () => {
      const r = await addToGroupAction(groupId, ids);
      setMsg(r.error ?? `Added ${r.added} ${r.added === 1 ? "person" : "people"}.`);
      router.refresh();
    });
  const me = members.find((m) => m.you);
  return (
    <div className="grid gap-5">
      {manage && <AddPeople groupId={groupId} roster={roster} onAdd={add} pending={pending} />}
      <p role="status" className="min-h-5 text-sm text-muted">
        {msg}
      </p>
      <section aria-labelledby="gm-h" className="grid gap-2">
        <h2 id="gm-h" className="eyebrow">
          In this group
        </h2>
        <ul className="grid">
          {members.map((m) => (
            <li key={m.id} className="flex min-h-14 items-center gap-3 border-b border-border py-2 last:border-0">
              <Avatar name={m.name} size={40} />
              <span className="min-w-0 flex-1 font-medium break-words">
                {m.name}
                {m.you && <span className="text-muted"> (you)</span>}
              </span>
              {manage && !m.you && (
                <ConfirmButton
                  disabled={pending}
                  ariaLabel={`Remove ${m.name}`}
                  question={`Take ${m.name} out of the group?`}
                  yes="Remove"
                  no="Keep"
                  onConfirm={() =>
                    start(async () => {
                      const r = await removeFromGroupAction(groupId, m.id);
                      setMsg(r.error ?? `${m.name} is out of the group.`);
                      router.refresh();
                    })
                  }
                  className="min-h-9 px-2 text-sm font-semibold text-danger"
                >
                  Remove
                </ConfirmButton>
              )}
            </li>
          ))}
        </ul>
      </section>
      {member && me && (
        <ConfirmButton
          disabled={pending}
          question="Leave this group? You'll stop getting its messages and games."
          yes="Leave group"
          no="Stay"
          onConfirm={() => start(async () => void (await removeFromGroupAction(groupId, me.id, true)))}
          className="min-h-10 justify-self-start text-sm font-semibold text-danger underline"
        >
          Leave group
        </ConfirmButton>
      )}
    </div>
  );
}

function AddPeople({ groupId, roster, onAdd, pending }: { groupId: string; roster: Person[]; onAdd: (ids: string[]) => void; pending: boolean }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ id: string; name: string; hint: string | null }[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return setHits([]);
    const t = setTimeout(async () => {
      const r = await findGroupPeopleAction(groupId, term);
      setHits(r.ok ? r.data : []);
    }, 250);
    return () => clearTimeout(t);
  }, [q, groupId]);
  return (
    <section aria-labelledby="ga-h" className="grid gap-3 rounded-lg border border-border p-4">
      <h2 id="ga-h" className="flex items-center gap-2 font-semibold">
        <UserPlus aria-hidden className="size-5" />
        Add people
      </h2>
      <div className="relative">
        <label htmlFor="gp-q" className="sr-only">
          Search by name or email
        </label>
        <Search aria-hidden className="pointer-events-none absolute top-3 left-3 size-5 text-muted" />
        <input id="gp-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email" autoComplete="off" className={`${inputClass} pl-10`} />
      </div>
      <p className="text-xs text-muted">Search your players, guest players and followers by name, or anyone with a Clbx account by their exact email.</p>
      {hits.length > 0 && (
        <ul aria-label="Search results" className="grid">
          {hits.map((h) => (
            <li key={h.id} className="flex min-h-12 items-center justify-between gap-2 border-b border-border last:border-0">
              <span>
                {h.name}
                {h.hint && <span className="text-sm text-muted"> · {h.hint}</span>}
              </span>
              <button
                type="button"
                disabled={pending}
                aria-label={`Add ${h.name}`}
                onClick={() => {
                  onAdd([h.id]);
                  setQ("");
                }}
                className={buttonClass("secondary", "sm")}
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && hits.length === 0 && <p className="text-sm text-muted">No one found. For someone new, ask them to sign up to Clbx (it&apos;s free), then search their email.</p>}
      {roster.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold text-team-ink">Add from your team ({roster.length})</summary>
          <fieldset className="mt-2 grid gap-1">
            <legend className="sr-only">Players on the team</legend>
            <label className="flex min-h-11 items-center gap-3 font-semibold">
              <input
                type="checkbox"
                checked={picked.size === roster.length}
                onChange={(e) => setPicked(e.target.checked ? new Set(roster.map((r) => r.id)) : new Set())}
                className="size-5 accent-[var(--fg)]"
              />
              Everyone
            </label>
            {roster.map((r) => (
              <label key={r.id} className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  checked={picked.has(r.id)}
                  onChange={() => {
                    const n = new Set(picked);
                    if (n.has(r.id)) n.delete(r.id);
                    else n.add(r.id);
                    setPicked(n);
                  }}
                  className="size-5 accent-[var(--fg)]"
                />
                {r.name}
              </label>
            ))}
            <Button
              type="button"
              disabled={pending || !picked.size}
              onClick={() => {
                onAdd([...picked]);
                setPicked(new Set());
              }}
              className="mt-2 justify-self-start"
            >
              Add {picked.size || ""} to the group
            </Button>
          </fieldset>
        </details>
      )}
    </section>
  );
}

/** Rename or delete the group (staff). */
export function GroupSettings({ groupId, name, about }: { groupId: string; name: string; about: string | null }) {
  const [state, act, pending] = useActionState(editGroupAction.bind(null, groupId), null);
  const [del, startDel] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <details className="rounded-lg border border-border p-4">
      <summary className="cursor-pointer font-semibold">Group settings</summary>
      <form action={act} className="mt-3 grid gap-3">
        <Field label="Name" id="g-name">
          <Input id="g-name" name="name" defaultValue={name} required maxLength={60} />
        </Field>
        <Field label="What it's for" id="g-about">
          <Input id="g-about" name="about" defaultValue={about ?? ""} maxLength={300} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            Save
          </Button>
          <p role="status" className={`text-sm ${state?.error ? "text-danger" : "text-muted"}`}>
            {state?.error ?? state?.message}
          </p>
        </div>
      </form>
      <div className="mt-4 border-t border-border pt-4">
        <ConfirmButton
          disabled={del}
          question="Delete this group and its chat for good? Drop-in games posted to it stay on the schedule."
          yes="Yes, delete it"
          onConfirm={() =>
            startDel(async () => {
              const r = await deleteGroupAction(groupId);
              if (r?.error) setErr(r.error);
            })
          }
          className="min-h-10 text-sm font-semibold text-danger underline"
        >
          Delete group
        </ConfirmButton>
        {err && (
          <p role="alert" className="text-sm text-danger">
            {err}
          </p>
        )}
      </div>
    </details>
  );
}
