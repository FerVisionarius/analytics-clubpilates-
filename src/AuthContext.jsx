import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from './lib/supabase'

const AuthContext = createContext(null)
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutos cierra sesion

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const inactivityTimerRef = useRef(null)

  useEffect(() => {
    // Sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile()
      else setLoading(false)
    })

    // Escuchar cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile()
      else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile() {
    const { data, error } = await supabase.rpc('get_my_profile')
    if (!error && data) {
      setProfile(data)
      // Si el usuario acaba de aceptar la invitación, marcar como activo
      if (data.status === 'pending') {
        await supabase
          .from('user_profiles')
          .update({ status: 'active' })
          .eq('id', (await supabase.auth.getUser()).data.user?.id)
      }
    }
    setLoading(false)
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }
// BLOQUE DE CERRAR SESION POR INACTIVIDAD  
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    inactivityTimerRef.current = setTimeout(() => {
      supabase.auth.signOut()
    }, INACTIVITY_TIMEOUT_MS)
  }, [])

  useEffect(() => {
    if (!user) {
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