import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = 'https://kvcmjajatbvirespgcvs.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_V0OSsUPhE-bhyhcY63FXKw_vMyQVXOr'

// En producción la sesión se guarda en una cookie compartida bajo
// .clubpilatesia.es para que home/analytics/crm mantengan el mismo login.
// En local (localhost) se omite el domain para que el dev server funcione.
const isSharedAuthDomain = typeof window !== 'undefined' && window.location.hostname.endsWith('clubpilatesia.es')

export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_KEY, {
  cookieOptions: isSharedAuthDomain
    ? { domain: '.clubpilatesia.es', path: '/', sameSite: 'lax', secure: true }
    : undefined,
})

export const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`
