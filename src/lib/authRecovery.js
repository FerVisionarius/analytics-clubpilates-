import { supabase } from './supabase'

export function isAuthRecoveryRoute() {
  const path = window.location.pathname
  return path === '/reset-password' || path === '/set-password'
}

function clearAuthFromUrl() {
  window.history.replaceState({}, document.title, window.location.pathname)
}

export async function establishRecoverySession() {
  const code = new URLSearchParams(window.location.search).get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return { ok: false, error }
    clearAuthFromUrl()
    return { ok: true }
  }

  const hash = window.location.hash.replace(/^#/, '')
  if (hash) {
    const hashParams = new URLSearchParams(hash)
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      if (error) return { ok: false, error }
      clearAuthFromUrl()
      return { ok: true }
    }
  }

  await new Promise(resolve => setTimeout(resolve, 400))
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) return { ok: false, error }
  if (session) {
    if (window.location.hash) clearAuthFromUrl()
    return { ok: true }
  }

  return { ok: false }
}

export function mapPasswordResetEmailError(error, code) {
  if (
    error?.status === 429 ||
    code === 'over_email_send_rate_limit' ||
    error?.message?.toLowerCase().includes('rate limit')
  ) {
    return 'El servicio de emails está saturado (límite del plan de Supabase: ~3 emails/hora para todo el proyecto). Espera unos 60 minutos o configura SMTP/Resend en Supabase.'
  }
  if (error?.message?.toLowerCase().includes('redirect')) {
    return 'La URL de redirección no está autorizada en Supabase. Contacta con el administrador.'
  }
  if (error?.message) return error.message
  return 'No se pudo enviar el email. Inténtalo de nuevo más tarde.'
}
