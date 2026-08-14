import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_ATTEMPTS = 3

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { email, password, captchaToken } = await req.json()
    const emailNorm = (email ?? '').trim().toLowerCase()
    if (!emailNorm || !password) return json({ error: 'missing_fields' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // ¿Cuenta bloqueada?
    const { data: lock } = await admin
      .from('login_lockouts')
      .select('attempts, locked')
      .eq('email', emailNorm)
      .maybeSingle()

    if (lock?.locked) {
      return json({ error: 'account_locked', locked: true }, 423)
    }

    // Intento de login en servidor.
    const anon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )
    const { data, error } = await anon.auth.signInWithPassword({
      email: emailNorm,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    })

    if (error || !data?.session) {
      const attempts = (lock?.attempts ?? 0) + 1
      const locked = attempts >= MAX_ATTEMPTS
      await admin
        .from('login_lockouts')
        .upsert({ email: emailNorm, attempts, locked, updated_at: new Date().toISOString() }, { onConflict: 'email' })
      return json(
        { error: locked ? 'account_locked' : 'invalid_credentials', locked, attemptsLeft: Math.max(0, MAX_ATTEMPTS - attempts) },
        locked ? 423 : 401,
      )
    }

    // Éxito: limpiar contador y devolver la sesión.
    await admin.from('login_lockouts').delete().eq('email', emailNorm)
    return json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    })
  } catch (err) {
    return json({ error: 'server_error', message: err instanceof Error ? err.message : 'error' }, 500)
  }
})
