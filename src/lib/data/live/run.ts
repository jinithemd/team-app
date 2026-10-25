import "server-only";
import { cache } from "react";
import { userClient } from "../../supabase/server";
import type { Store } from "../store";
import { runLive } from "./context";
import { loadSlice } from "./load";
import { SyncError, syncChanges } from "./sync";

/*
 * Runs a sample-data function on live data: load the signed-in person's slice once per
 * request, run the same logic on it, then write back whatever it changed. Writes are
 * serialised per request and always diffed against the last saved state, so calls made
 * side by side (a layout and a page) never save the same change twice.
 */

const loadForRequest = cache(async () => {
  const sb = await userClient();
  const { data } = await sb.auth.getUser();
  const uid = data.user?.id ?? null;
  const { store, aux } = await loadSlice(sb, uid);
  return { sb, uid, store, aux, saved: structuredClone(store) as Store, lock: Promise.resolve() };
});

function isActionResult(x: unknown): x is { ok: boolean } {
  return !!x && typeof x === "object" && "ok" in x && typeof (x as { ok: unknown }).ok === "boolean";
}

export function onLive<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => Promise<Awaited<R>> {
  return async (...args: A): Promise<Awaited<R>> => {
    const base = await loadForRequest();
    const result: Awaited<R> = await runLive({ sb: base.sb, uid: base.uid, store: base.store }, () => fn(...args));
    const run = base.lock.then(async () => {
      await syncChanges(base.sb, base.saved, base.store, base.aux);
      base.saved = structuredClone(base.store);
    });
    base.lock = run.catch(() => {});
    try {
      await run;
    } catch (e) {
      // Put the slice back to what's actually saved, so the screen doesn't show a change that didn't happen.
      for (const k of Object.keys(base.saved) as (keyof Store)[]) (base.store[k] as unknown) = structuredClone(base.saved[k]);
      const message = e instanceof SyncError ? e.message : "Couldn't save that. Try again.";
      if (isActionResult(result) && result.ok) return { ok: false, error: message } as Awaited<R>;
      throw e;
    }
    return result as Awaited<R>;
  };
}
