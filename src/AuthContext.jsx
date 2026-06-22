import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { isAuthRecoveryRoute } from './lib/authRecovery'

const AuthContext = createContext(null)
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutos
const AUTH_INIT_TIMEOUT_MS = 8 * 1000

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const inactivityTimerRef = useRef(null)

  async function fetchProfile() {
    const { data, error } = await supabase.rpc('get_my_profile')
    if (!error && data) {
      setProfile(data)
      if (data.status === 'pending') {
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (currentUser) {
          await supabase
            .from('user_profiles')
            .update({ status: 'active' })
            .eq('id', currentUser.id)
        }
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false

    const initTimeout = setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, AUTH_INIT_TIMEOUT_MS)

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (cancelled) return
        clearTimeout(initTimeout)
        setUser(session?.user ?? null)
        if (session?.user) {
          if (isAuthRecoveryRoute()) setLoading(false)
          else fetchProfile()
        } else {
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearTimeout(initTimeout)
          setLoading(false)
        }
      })

    // Diferir callbacks async evita deadlock con signInWithPassword (documentado por Supabase)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setTimeout(() => {
        if (cancelled) return
        setUser(session?.user ?? null)
        if (session?.user) {
          if (event === 'PASSWORD_RECOVERY' || isAuthRecoveryRoute()) {
            setLoading(false)
            return
          }
          setLoading(true)
          fetchProfile()
        } else {
          setProfile(null)
          setLoading(false)
        }
      }, 0)
    })

    return () => {
      cancelled = true
      clearTimeout(initTimeout)
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    inactivityTimerRef.current = setTimeout(() => {
      supabase.auth.signOut()
    }, INACTIVITY_TIMEOUT_MS)
  }, [])

  useEffect(() => {
    if (!user || isAuthRecoveryRoute()) {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
        inactivityTimerRef.current = null
      }
      return
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(e => window.addEventListener(e, resetInactivityTimer, { passive: true }))
    resetInactivityTimer()

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
      events.forEach(e => window.removeEventListener(e, resetInactivityTimer))
    }
  }, [user, resetInactivityTimer])

  const isAdmin = profile?.role === 'admin'
  const allowedBranchIds = profile?.branch_ids ?? []

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, allowedBranchIds, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
