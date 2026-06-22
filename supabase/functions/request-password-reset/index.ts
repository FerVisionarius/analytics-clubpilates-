import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { email, redirectTo } = await req.json()
    if (!email || !redirectTo) throw new Error('Email y redirectTo son obligatorios')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    })

    // Por seguridad respondemos ok aunque el usuario no exista
    if (error || !data?.properties?.action_link) {
      console.error('generateLink falló:', error?.message ?? 'sin action_link', { email })
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const actionLink = data.properties.action_link
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Club Pilates <onboarding@resend.dev>'

    if (resendKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: 'Restablecer contraseña - Club Pilates Analytics',
          html: `
            <p>Hola,</p>
            <p>Has solicitado restablecer tu contraseña en Club Pilates Analytics.</p>
            <p><a href="${actionLink}">Haz clic aquí para crear una nueva contraseña</a></p>
            <p>Si no has solicitado esto, ignora este email.</p>
            <p>El enlace caduca en 1 hora.</p>
          `,
        }),
      })

      const resBody = await res.text()
      if (!res.ok) {
        console.error('Resend falló:', res.status, resBody)
        throw new Error(`Error al enviar email: ${resBody}`)
      }
      console.log('Email enviado vía Resend:', { email, resendId: resBody })
    } else {
      // Sin Resend: usar SMTP de Supabase (sujeto a límite del plan)
      const { error: recoverError } = await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo })
      if (recoverError) throw recoverError
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    const isRateLimit = message.toLowerCase().includes('rate limit')
    return new Response(JSON.stringify({
      error: message,
      code: isRateLimit ? 'over_email_send_rate_limit' : 'request_failed',
    }), {
      status: isRateLimit ? 429 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
