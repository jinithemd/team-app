import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { Store } from "../store";
import type { DB } from "../../supabase/server";

/** The signed-in person's slice of the database, loaded for one data call. */
export interface LiveCtx {
  sb: DB;
  uid: string | null;
  store: Store;
}

const als = new AsyncLocalStorage<LiveCtx>();
export const liveContext = () => als.getStore();
export const runLive = <T>(ctx: LiveCtx, fn: () => T) => als.run(ctx, fn);
