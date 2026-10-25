/**
 * Which data the app runs on. "demo" (default): the in-memory sample data with one-tap demo
 * accounts. "supabase": real accounts and the Supabase database (set DATA_SOURCE=supabase plus
 * NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY).
 */
export const LIVE = process.env.DATA_SOURCE === "supabase";
