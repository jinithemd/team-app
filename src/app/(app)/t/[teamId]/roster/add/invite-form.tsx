"use client";

import { useActionState, useState } from "react";
import { ClipboardPaste, Plus, Trash2 } from "lucide-react";
import { invitePeopleAction, type FormState } from "@/app/actions";
import { Button, buttonClass, inputClass } from "@/components/ui";

interface Row {
  key: number;
  firstName: string;
  lastName: string;
  email: string;
  jersey: string;
  position: string;
}

const PERMS: [string, string][] = [
  ["schedule_games", "Schedule games"],
  ["schedule_events", "Schedule practices and events"],
  ["roster", "Manage the roster"],
  ["scoring", "Keep score"],
  ["edit_settings", "Edit team settings"],
  ["manage_permissions", "Manage staff permissions"],
];

let nextKey = 1;
const blank = (): Row => ({ key: nextKey++, firstName: "", lastName: "", email: "", jersey: "", position: "" });

/** Parse pasted lines: "Maya Patel, sam@example.com, 7" (comma or tab separated, any order). */
function parseList(text: string): Row[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\t|,|;/).map((p) => p.trim()).filter(Boolean);
      const email = parts.find((p) => p.includes("@")) ?? "";
      const jersey = parts.find((p) => /^\d{1,3}$/.test(p)) ?? "";
      const nameParts = parts.filter((p) => p !== email && p !== jersey);
      const name = (nameParts[0] ?? "").split(/\s+/);
      const position = nameParts[1] ?? "";
      return { ...blank(), firstName: name[0] ?? "", lastName: name.slice(1).join(" "), email, jersey, position };
    });
}

export function InviteForm({ teamId, kind }: { teamId: string; kind: "player" | "staff" }) {
  const [state, action, pending] = useActionState<FormState, FormData>(invitePeopleAction.bind(null, teamId), null);
  const fe = state?.fieldErrors ?? {};
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState("");

  const update = (i: number, k: keyof Row, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  return (
    <form action={action} className="grid gap-5" noValidate>
      <input type="hidden" name="count" value={rows.length} />
      <input type="hidden" name="kind" value={kind} />

      {kind === "player" && (
        <div className="grid gap-2 rounded-md bg-surface p-3">
          {pasteOpen ? (
            <>
              <label htmlFor="paste" className="text-sm font-semibold">
                Paste your list
              </label>
              <p className="text-xs text-muted">One player per line: name, parent email, number (number optional). Copy straight from a spreadsheet or WhatsApp.</p>
              <textarea
                id="paste"
                rows={5}
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={"Maya Patel, sam.patel@example.com, 7\nArjun Nair, anita.nair@example.com, 11"}
                className={`${inputClass} py-2.5 font-mono text-sm`}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    const parsed = parseList(paste);
                    if (parsed.length) {
                      setRows((rs) => [...rs.filter((r) => r.firstName || r.lastName || r.email), ...parsed]);
                      setPaste("");
                      setPasteOpen(false);
                    }
                  }}
                >
                  Add {parseList(paste).length || ""} to the list
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPasteOpen(false)}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <button type="button" onClick={() => setPasteOpen(true)} className="flex min-h-10 items-center gap-2 text-sm font-semibold text-team-ink">
              <ClipboardPaste aria-hidden className="size-[18px]" />
              Paste a whole list instead
            </button>
          )}
        </div>
      )}

      <ol className="grid gap-4">
        {rows.map((r, i) => (
          <li key={r.key} className="grid gap-3 rounded-lg border border-border p-3.5">
            <div className="flex items-center justify-between">
              <span className="eyebrow">{kind === "staff" ? "Staff member" : "Player"} {i + 1}</span>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                  aria-label={`Remove ${r.firstName || `row ${i + 1}`}`}
                  className="grid size-9 place-items-center rounded-md text-muted hover:bg-sunken hover:text-danger"
                >
                  <Trash2 aria-hidden className="size-[18px]" />
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Cell id={`${i}.firstName`} label="First name" value={r.firstName} onChange={(v) => update(i, "firstName", v)} error={fe[`${i}.firstName`]} autoComplete="off" />
              <Cell id={`${i}.lastName`} label="Last name" value={r.lastName} onChange={(v) => update(i, "lastName", v)} error={fe[`${i}.lastName`]} autoComplete="off" />
            </div>
            <Cell
              id={`${i}.email`}
              label={kind === "staff" ? "Email" : "Parent or guardian email"}
              type="email"
              value={r.email}
              onChange={(v) => update(i, "email", v)}
              error={fe[`${i}.email`]}
              hint={kind === "player" ? "For adult players, use their own email and tick the box below." : undefined}
            />
            {kind === "player" ? (
              <>
                <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
                  <Cell id={`${i}.jersey`} label="Number" inputMode="numeric" maxLength={3} value={r.jersey} onChange={(v) => update(i, "jersey", v)} />
                  <Cell id={`${i}.position`} label="Position" value={r.position} onChange={(v) => update(i, "position", v)} placeholder="Optional" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name={`${i}.emailFor`} value="self" className="size-4 accent-[var(--team)]" />
                  This is the player&apos;s own email (adult player)
                </label>
              </>
            ) : (
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-semibold">Role and permissions</legend>
                <select name={`${i}.staffRole`} defaultValue="assistant_coach" aria-label="Role" className={`${inputClass} sm:max-w-xs`}>
                  <option value="assistant_coach">Assistant coach</option>
                  <option value="manager">Team manager</option>
                  <option value="other">Other staff</option>
                </select>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {PERMS.map(([v, label]) => (
                    <label key={v} className="flex min-h-9 items-center gap-2 text-sm">
                      <input type="checkbox" name={`${i}.perm`} value={v} defaultChecked={["schedule_games", "schedule_events", "scoring"].includes(v)} className="size-4 accent-[var(--team)]" />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </li>
        ))}
      </ol>

      <Button variant="secondary" onClick={() => setRows((rs) => [...rs, blank()])} className="justify-self-start">
        <Plus aria-hidden />
        Add another
      </Button>

      {state?.error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      <button className={buttonClass("primary", "lg", "w-full sm:w-auto sm:justify-self-start")} disabled={pending} aria-busy={pending}>
        {pending ? "Sending invites…" : `Send ${rows.length} ${rows.length === 1 ? "invite" : "invites"}`}
      </button>
    </form>
  );
}

function Cell({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  ...rest
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
} & Omit<React.ComponentProps<"input">, "onChange" | "value" | "id">) {
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={inputClass}
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
