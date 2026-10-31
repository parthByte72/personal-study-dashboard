import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && key);

export function createClient() {
  if (!url || !key) throw new Error("Add your Supabase URL and publishable/anon key to .env.local");
  return createBrowserClient(url, key);
}