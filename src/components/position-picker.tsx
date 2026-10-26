"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui";
import { MAX_POSITIONS, joinPositions, positionsFor, splitPositions } from "@/lib/positions";

/**
 * Pick up to three positions from the team's sport, as tap-to-toggle chips. Anything saved
 * earlier that isn't on the list (typed before the list existed) stays as its own chip.
 * Sports without a list get a text box. Submits one hidden "position" field.
 */
export function PositionPicker({ sport, initial, onChange }: { sport: string; initial: string; onChange?: (value: string) => void }) {
  const list = positionsFor(sport);
  const [picked, setPicked] = useState<string[]>(splitPositions(initial));
  const [text, setText] = useState(initial);

  if (!list.length)
    return (
      <div className="grid gap-1.5">
        <label htmlFor="position" className="text-sm font-semibold">
          Position
        </label>
        <Input
          id="position"
          name="position"
          maxLength={60}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onChange?.(e.target.value);
          }}
          placeholder="Optional"
        />
      </div>
    );

  const extras = picked.filter((p) => !list.includes(p));
  const options = [...list, ...extras];
  const full = picked.length >= MAX_POSITIONS;
  const toggle = (p: string) => {
    const next = picked.includes(p) ? picked.filter((x) => x !== p) : full ? picked : [...picked, p];
    // Keep them in the list's order so "Goalkeeper, Striker" reads the same for everyone.
    const ordered = options.filter((o) => next.includes(o));
    setPicked(ordered);
    onChange?.(joinPositions(ordered));
  };

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-semibold">
        Position <span className="font-normal text-muted">· pick up to {MAX_POSITIONS}</span>
      </legend>
      <input type="hidden" name="position" value={joinPositions(picked)} />
      <div className="flex flex-wrap gap-2">
        {options.map((p) => {
          const on = picked.includes(p);
          return (
            <button
              key={p}
              type="button"
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => toggle(p)}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-pill border px-3.5 text-sm font-semibold disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                on ? "border-team bg-team text-on-team" : "border-border-input bg-bg"
              }`}
            >
              {on && <Check aria-hidden className="size-4" />}
              {p}
            </button>
          );
        })}
      </div>
      {full && <p className="text-xs text-muted">That&apos;s {MAX_POSITIONS}. Tap one to swap it.</p>}
    </fieldset>
  );
}
