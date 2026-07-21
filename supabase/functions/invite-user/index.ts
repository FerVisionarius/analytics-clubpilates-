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

    if (profile?.role !== 'admin') throw new Error('Solo admins pueden invitar usuarios')

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
          <p>Hola${full_name ? ' ' + full_name : ''},</p>
          <p>Has sido invitado a unirte a Club Pilates Analytics.</p>
          <p><a href="${actionLink}">Haz clic aquí para crear tu contraseña y acceder</a></p>
          <p>Si no esperabas esta invitación, puedes ignorar este email.</p>
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
