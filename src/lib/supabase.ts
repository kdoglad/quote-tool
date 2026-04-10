import { createClient } from '@supabase/supabase-js'

/**
 * True when Supabase is not configured (no .env file yet).
 * In preview mode, auth is bypassed so you can explore the full UI.
 */
export const isPreviewMode = !import.meta.env.VITE_SUPABASE_URL

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'placeholder-key'

if (isPreviewMode) {
  console.info('[SCS] Preview mode — no Supabase configured. Auth bypassed, data queries will fail gracefully.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// Helper to get the current authenticated user's ID
export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}
