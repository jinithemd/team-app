import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

export type DB = SupabaseClient<Database>;

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * The signed-in person's client: every query runs with their access rules (RLS).
 * Use this for everything a person does in the app.
 */
export async function userClient(): Promise<DB> {
  const jar = await cookies();
  return createServerClient<Database>(URL, ANON, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) jar.set(name, value, options);
        } catch {
          // Called from a server component: the middleware refreshes the cookie instead.
        }
      },
    },
  });
}

let adminSingleton: DB | null = null;
/**
 * Server-only client that skips access rules. Only for work no person does directly:
 * writing the email outbox, one-tap RSVP links from emails, scheduled jobs.
 */
export function adminClient(): DB {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  adminSingleton ??= createClient<Database>(URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return adminSingleton;
}
