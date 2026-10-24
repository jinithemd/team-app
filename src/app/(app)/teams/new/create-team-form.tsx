"use client";

import { useActionState, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { createTeamAction, type FormState } from "@/app/actions";
import { Field, Input, buttonClass, inputClass } from "@/components/ui";
import { deriveTeamTheme, teamThemeVars, type Mode } from "@/lib/team-theme";

const SPORTS = ["Soccer", "Cricket", "Basketball", "Hockey", "Baseball", "Volleyball", "Rugby", "Lacrosse", "Football", "Other"];

export const PRESETS: [string, string][] = [
  ["Deep purple", "#2D0A3E"],
  ["Navy", "#0B1F4B"],
  ["Royal blue", "#1D4ED8"],
  ["Sky blue", "#5EB8FF"],
  ["Red", "#C8102E"],
  ["Maroon", "#6D1A2A"],
  ["Orange", "#FF7A00"],
  ["Gold", "#E4B23A"],
  ["Yellow", "#FFE600"],
  ["Green", "#1B7A3A"],
  ["Black", "#000000"],
  ["White", "#FFFFFF"],
];

type ClubOption = { id: string; name: string; color: string; colorSecondary: string | null };

export function CreateTeamForm({ clubs, defaultClubId }: { clubs: ClubOption[]; defaultClubId?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createTeamAction, null);
  const fe = state?.fieldErrors ?? {};
  const startClub = clubs.find((c) => c.id === defaultClubId);
  const [clubId, setClubId] = useState(startClub?.id ?? "");
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(startClub?.color ?? PRESETS[0][1]);
  const [secondary, setSecondary] = useState<string | null>(startClub ? startClub.colorSecondary : "#B8964A");

  function pickClub(cid: string) {
    setClubId(cid);
    const c = clubs.find((x) => x.id === cid);
    if (c) {
      setColor(c.color);
      setSecondary(c.colorSecondary);
    }
  }

  return (
    <form action={action} className="grid gap-6" noValidate>
      <fieldset className="grid gap-4">
        <legend className="sr-only">Team details</legend>
        {clubs.length > 0 && (
          <Field id="clubId" label="Part of a club?" error={fe.clubId} hint="Club teams use the club's colours and show under the club.">
            <select id="clubId" name="clubId" value={clubId} onChange={(e) => pickClub(e.target.value)} className={inputClass}>
              <option value="">No, an independent team</option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field id="name" label="Team name" error={fe.name}>
          <Input id="name" name="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder={clubId ? "e.g. First Team, Reserves, Over-35s" : "e.g. Kingston Strikers"} error={fe.name} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="sport" label="Sport" error={fe.sport}>
            <select id="sport" name="sport" defaultValue="Soccer" className={inputClass}>
              {SPORTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field id="level" label="Level or league" hint="Optional, like Sunday league or Division 2">
            <Input id="level" name="level" maxLength={40} />
          </Field>
          <Field id="location" label="Where you play" hint="City or area">
            <Input id="location" name="location" maxLength={60} placeholder="Kingston, ON" />
          </Field>
        </div>
      </fieldset>

      <ColorField label="Team colour" name="color" value={color} onChange={(v) => v && setColor(v)} error={fe.color} />
      <ColorField label="Second colour" name="colorSecondary" value={secondary} onChange={setSecondary} optional />

      <Preview name={name || "Your team"} color={color} secondary={secondary} />

      {state?.error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      <button className={buttonClass("primary", "lg", "w-full sm:w-auto sm:justify-self-start")} disabled={pending} aria-busy={pending}>
        {pending ? "Creating…" : "Create team"}
      </button>
    </form>
  );
}

export function ColorField({
  label,
  name,
  value,
  onChange,
  optional,
  error,
}: {
  label: string;
  name: string;
  value: string | null;
  onChange: (v: string | null) => void;
  optional?: boolean;
  error?: string;
}) {
  const labelId = `${name}-label`;
  return (
    <fieldset className="grid gap-2.5">
      <legend id={labelId} className="text-sm font-semibold">
        {label}
        {optional && <span className="font-normal text-muted"> (optional, for stripes and number badges)</span>}
      </legend>
      <input type="hidden" name={name} value={value ?? ""} />
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {optional && (
          <button
            type="button"
            role="radio"
            aria-checked={value === null}
            onClick={() => onChange(null)}
            className={`min-h-9 rounded-pill border border-border-input px-3 text-xs font-semibold ${value === null ? "outline-2 outline-offset-2 outline-fg" : ""}`}
          >
            None
          </button>
        )}
        {PRESETS.map(([n, hex]) => (
          <button
            key={hex}
            type="button"
            role="radio"
            aria-checked={value?.toUpperCase() === hex}
            aria-label={n}
            onClick={() => onChange(hex)}
            style={{ background: hex }}
            className={`grid size-9 place-items-center rounded-pill border border-border-input ${
              value?.toUpperCase() === hex ? "outline-2 outline-offset-2 outline-fg" : ""
            }`}
          >
            {value?.toUpperCase() === hex && <Check aria-hidden className="size-4" style={{ color: deriveTeamTheme(hex, "light").onTeam }} />}
          </button>
        ))}
        <label className="flex min-h-9 items-center gap-2 rounded-pill border border-border-input pr-3 pl-1 text-xs font-semibold">
          <input
            type="color"
            value={(value ?? "#2D0A3E").toLowerCase()}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="size-7 cursor-pointer rounded-pill border-0 bg-transparent p-0"
          />
          Custom
        </label>
      </div>
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </fieldset>
  );
}

function Preview({ name, color, secondary }: { name: string; color: string; secondary: string | null }) {
  const modes: Mode[] = ["light", "dark"];
  const adjusted = useMemo(() => {
    const out: string[] = [];
    for (const m of modes) {
      const t = deriveTeamTheme(color, m);
      if (t.team !== color.toUpperCase() || t.teamInk !== color.toUpperCase()) out.push(m);
    }
    return out;
  }, [color]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section aria-labelledby="preview-h" className="grid gap-2.5">
      <h2 id="preview-h" className="text-sm font-semibold">
        Preview
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {modes.map((m) => {
          const v = teamThemeVars(color, secondary, m);
          const page = m === "light" ? { bg: "#FFFFFF", fg: "#12151A", muted: "#5A6270" } : { bg: "#0E1116", fg: "#F2F4F7", muted: "#A2AAB7" };
          return (
            <div
              key={m}
              aria-label={`${m} mode preview`}
              style={{ background: page.bg, color: page.fg }}
              className="overflow-hidden rounded-lg border border-border"
            >
              <div style={{ background: v["--team"], color: v["--on-team"], borderBottom: `4px solid ${v["--team-2"] ?? v["--team"]}` }} className="px-3.5 py-3">
                <p className="truncate font-display text-xl font-bold uppercase">{name}</p>
                <p className="text-xs opacity-90">{m === "light" ? "Light mode" : "Dark mode"}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 px-3.5 py-3">
                <span style={{ background: v["--team"], color: v["--on-team"] }} className="rounded-md px-3 py-2 text-sm font-semibold">
                  New event
                </span>
                <span style={{ color: v["--team-ink"] }} className="text-sm font-semibold">
                  See all
                </span>
                <span style={{ background: v["--team-soft"], color: page.fg }} className="rounded-md px-2.5 py-1.5 text-xs">
                  Today
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted" aria-live="polite">
        {adjusted.length
          ? `We'll adjust the shade a little in ${adjusted.join(" and ")} mode so text stays easy to read.`
          : "This colour works as it is in both light and dark mode."}
      </p>
    </section>
  );
}
