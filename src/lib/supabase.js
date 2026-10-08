import { createClient } from '@supabase/supabase-js';

/**
 * supabase.js
 * ─────────────────────────────────────────────────────────────
 * The client for the SkoulHub project.
 *
 * Only the anon key belongs here: it is designed to be public and is
 * powerless on its own, because every table is protected by Row Level
 * Security keyed to the signed-in user. The service_role key must never
 * reach the browser — it bypasses RLS entirely.
 *
 * If the environment is not configured the app degrades to its
 * offline demo store rather than crashing, so a missing .env does not
 * produce a blank page.
 * ─────────────────────────────────────────────────────────────
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'skoulhub.auth',
      },
    })
  : null;

/** True when the app is running against the real backend. */
export const usingBackend = () => isSupabaseConfigured;
