import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kvcmjajatbvirespgcvs.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_V0OSsUPhE-bhyhcY63FXKw_vMyQVXOr'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    detectSessionInUrl: true,
    flowType: 'pkce',
    persistSession: true,
  },
})

export const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`
