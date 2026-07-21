import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No autorizado')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await supabaseUser.auth.getUser()
    if (!user) throw new Error('No autenticado')

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') throw new Error('Solo admins pueden invitar usuarios')

    const { email, full_name, role, branch_ids, redirectTo } = await req.json()

    const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: redirectTo ? { redirectTo } : undefined,
    })
    if (inviteError) throw inviteError

    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({ id: invited.user.id, email, full_name, role, branch_ids: branch_ids || [] })
    if (profileError) throw profileError

    const actionLink = invited.properties.action_link
    const resendKey = (Deno.env.get('RESEND_API_KEY') ?? '').trim()
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Club Pilates <onboarding@resend.dev>'

    if (!resendKey.startsWith('re_')) {
      console.error('RESEND_API_KEY inválida o no configurada')
      throw new Error('RESEND_API_KEY no configurada correctamente en Supabase')
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: 'Has sido invitado a Club Pilates Analytics',
        html: `
          <div style="background-color:#f5f4f1;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <div style="max-width:480px;margin:0 auto;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6e4df;">
              <div style="padding:32px 32px 8px;text-align:center;">
                <img src="https://analytics.clubpilatesia.es/logo-clubpilates.png" alt="Club Pilates" width="88" height="88" style="display:block;margin:0 auto;" />
              </div>
              <div style="padding:8px 32px 36px;text-align:center;">
                <h1 style="margin:16px 0 8px;font-size:20px;line-height:1.3;color:#1a1a1a;">
                  ${full_name ? `Hola ${full_name} 👋` : 'Has sido invitado'}
                </h1>
                <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#5a5a5a;">
                  Te han dado acceso a <strong>Club Pilates Analytics</strong>, el panel de métricas de tu centro.
                  Crea tu contraseña para empezar.
                </p>
                <a href="${actionLink}"
                  style="display:inline-block;background-color:#00668c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 28px;border-radius:10px;">
                  Crear mi contraseña
                </a>
                <p style="margin:28px 0 0;font-size:12px;line-height:1.5;color:#a3a3a3;">
                  Si no esperabas esta invitación, puedes ignorar este email.
                </p>
              </div>
            </div>
          </div>
        `,
      }),
    })

    const resBody = await res.text()
    if (!res.ok) {
      console.error('Resend falló:', res.status, resBody)
      throw new Error(`Error al enviar email: ${resBody}`)
    }
    console.log('Email de invitación enviado vía Resend:', { email, resendId: resBody })

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
