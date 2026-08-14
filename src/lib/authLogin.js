// Login a través de la edge function `login`, que bloquea la cuenta tras 3
// intentos fallidos. Si la función no responde (5xx o sin red), cae a login
// directo para no dejar a nadie fuera por una caída del servicio.
export async function signInWithLockout(supabase, functionsUrl, apikey, email, password, captchaToken) {
  const directo = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password, options: captchaToken ? { captchaToken } : undefined })
    return { error: error ? { message: 'Email o contraseña incorrectos' } : null }
  }

  try {
    const res = await fetch(`${functionsUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey },
      body: JSON.stringify({ email, password, captchaToken }),
    })

    if (res.status >= 500) return directo()

    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      if (body.error === 'account_locked') {
        return { error: { code: 'account_locked', message: 'Cuenta bloqueada por seguridad tras varios intentos fallidos. Recupera tu contraseña para desbloquearla.' } }
      }
      const left = typeof body.attemptsLeft === 'number' ? body.attemptsLeft : null
      const msg = left !== null
        ? `Email o contraseña incorrectos. Te ${left === 1 ? 'queda' : 'quedan'} ${left} ${left === 1 ? 'intento' : 'intentos'} antes de bloquear la cuenta.`
        : 'Email o contraseña incorrectos'
      return { error: { code: 'invalid_credentials', message: msg } }
    }

    const { error } = await supabase.auth.setSession({
      access_token: body.access_token,
      refresh_token: body.refresh_token,
    })
    // La contraseña ya se validó en servidor; si setSession fallara, login directo.
    if (error) return directo()
    return { error: null }
  } catch {
    return directo()
  }
}
