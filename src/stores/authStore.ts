import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import type { UserProfile, UserRole } from '../types/domain.types'
import { supabase, isPreviewMode } from '../lib/supabase'

interface AuthState {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean
  // Actions
  setSession: (session: Session | null) => void
  setProfile: (profile: UserProfile | null) => void
  setLoading: (loading: boolean) => void
  signOut: () => Promise<void>
  // Role helpers
  role: UserRole | null
  isAdmin: boolean
  isEngineer: boolean
  isSales: boolean
  canEditPrices: boolean
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,

  setSession: (session) =>
    set({ session, user: session?.user ?? null }),

  setProfile: (profile) => {
    const role = profile?.role ?? null
    set({
      profile,
      role,
      isAdmin: role === 'admin',
      isEngineer: role === 'engineer',
      isSales: role === 'sales',
      canEditPrices: role === 'admin' || role === 'engineer',
    })
  },

  setLoading: (loading) => set({ loading }),

  signOut: async () => {
    await supabase.auth.signOut()
    set({
      session: null,
      user: null,
      profile: null,
      role: null,
      isAdmin: false,
      isEngineer: false,
      isSales: false,
      canEditPrices: false,
    })
  },

  role: null,
  isAdmin: false,
  isEngineer: false,
  isSales: false,
  canEditPrices: false,
}))

// Initialise auth listener — call this once at app startup
export function initAuthListener() {
  const { setSession, setProfile, setLoading } = useAuthStore.getState()

  // Skip Supabase entirely in preview mode (no VITE_SUPABASE_URL set)
  if (isPreviewMode) {
    setLoading(false)
    return
  }

  // Safety net: if getSession() stalls (e.g. expired token refresh timing out),
  // unblock the UI after 6 seconds rather than spinning forever, and clear cache
  // to escape the stale token lock.
  const timeoutId = setTimeout(() => {
    if (useAuthStore.getState().loading) {
      console.warn('[SCS] Auth init timed out — clearing stale session and showing login page')
      localStorage.clear()
      sessionStorage.clear()
      setSession(null)
      setProfile(null)
      setLoading(false)
    }
  }, 6000)

  supabase.auth.getSession()
    .then(async ({ data: { session }, error }) => {
      clearTimeout(timeoutId)
      if (error) {
        setLoading(false)
        return
      }
      setSession(session)
      if (session?.user) {
        const { data } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        setProfile(data ?? null)
      }
      setLoading(false)
    })
    .catch(() => {
      clearTimeout(timeoutId)
      setLoading(false)
    })

  // Listen for subsequent auth state changes (login, logout, token refresh)
  supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session)
    if (session?.user) {
      supabase
        .from('user_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
        .then(({ data }) => {
          setProfile(data ?? null)
          setLoading(false)
        })
    } else {
      setProfile(null)
      setLoading(false)
    }
  })
}
