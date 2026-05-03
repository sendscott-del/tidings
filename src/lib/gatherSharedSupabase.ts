import { createClient } from '@supabase/supabase-js'

// Tidings runs on its own Supabase project, but the cross-app access map
// (user_apps + gather_super_admins) lives in the shared "Scott's Apps"
// project. This client is read-only against the shared project — it calls
// the SECURITY DEFINER RPC `gather_apps_for_email` which only returns the
// app_name / role list for the email passed in. No user_id, no PII beyond
// what the caller already knows.
//
// Env vars (set in Vercel + .env.local):
//   VITE_GATHER_SHARED_SUPABASE_URL      — defaults to isogetmvnpimcmouakeg.supabase.co
//   VITE_GATHER_SHARED_SUPABASE_ANON_KEY — required (publishable key)
//
// If the env var is missing, gatherSharedClient is null and the caller
// should fall back gracefully (e.g., show the full catalog).
const url =
  (import.meta.env.VITE_GATHER_SHARED_SUPABASE_URL as string | undefined) ??
  'https://isogetmvnpimcmouakeg.supabase.co'

const anon = import.meta.env.VITE_GATHER_SHARED_SUPABASE_ANON_KEY as
  | string
  | undefined

export const gatherSharedClient =
  url && anon
    ? createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
    : null

export async function fetchGatherAppsForEmail(email: string): Promise<string[] | null> {
  if (!gatherSharedClient) {
    if (typeof window !== 'undefined') {
      console.warn(
        '[Tidings] VITE_GATHER_SHARED_SUPABASE_ANON_KEY is not set — falling back to showing the full Gather app catalog.'
      )
    }
    return null
  }
  const { data, error } = await gatherSharedClient.rpc('gather_apps_for_email', {
    p_email: email,
  })
  if (error) {
    console.warn('[Tidings] gather_apps_for_email RPC error:', error.message)
    return null
  }
  if (!Array.isArray(data)) return null
  return (data as Array<{ app_name: string }>).map(r => r.app_name)
}
