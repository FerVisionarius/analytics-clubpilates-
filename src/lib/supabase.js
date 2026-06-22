import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kvcmjajatbvirespgcvs.supabase.co'
const SUPABASE_KEY = 'sb_publishable_V0OSsUPhE-bhyhcY63FXKw_vMyQVXOr'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    detectSessionInUrl: true,
    // Los emails de recuperación de Supabase envían tokens en el hash (#access_token=...)
    flowType: 'implicit',
  },
})