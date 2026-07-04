// Supabase connection config, shared by the browser and server clients.
//
// The URL + publishable (anon) key are safe to expose to the browser — they are
// gated by Row-Level Security (see supabase/migrations). Only VITE_-prefixed env
// vars are inlined into the client bundle by Vite; the service/secret key must
// NEVER be referenced here.
//
// Local defaults point at the standard `supabase start` stack so the app works
// out of the box in development; production sets the VITE_SUPABASE_* vars.

const DEFAULT_LOCAL_URL = "http://127.0.0.1:54321";
const DEFAULT_LOCAL_PUBLISHABLE_KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

interface SupabaseEnv {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

export function resolveSupabaseUrl(env: SupabaseEnv): string {
  const value = env.VITE_SUPABASE_URL?.trim();
  return value && value.length > 0 ? value : DEFAULT_LOCAL_URL;
}

export function resolveSupabaseAnonKey(env: SupabaseEnv): string {
  const value = env.VITE_SUPABASE_ANON_KEY?.trim();
  return value && value.length > 0 ? value : DEFAULT_LOCAL_PUBLISHABLE_KEY;
}

const env = import.meta.env as SupabaseEnv;

export const SUPABASE_URL = resolveSupabaseUrl(env);
export const SUPABASE_ANON_KEY = resolveSupabaseAnonKey(env);
