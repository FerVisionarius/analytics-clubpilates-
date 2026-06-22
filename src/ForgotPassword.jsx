import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import logo from './assets/logo-clubpilates.png'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    document.title = 'Club Pilates - Recuperar contraseña'
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      if (
        error.status === 429 ||
        error.code === 'over_email_send_rate_limit' ||
        error.message?.toLowerCase().includes('rate limit')
      ) {
        setError('Has solicitado demasiados enlaces. Supabase limita los envíos: espera unos 60 minutos e inténtalo de nuevo.')
      } else if (error.message?.toLowerCase().includes('redirect')) {
        setError('Error de configuración del enlace de recuperación. Contacta con el administrador.')
      } else {
        setError(`No se pudo enviar el email: ${error.message}`)
      }
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-bg-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={logo} alt="Club Pilates España" className="h-65 w-auto mx-auto mb-6" />
        </div>

        <div className="bg-bg-200 border border-bg-300 rounded-2xl p-6">
          {sent ? (
            <div className="text-center py-2">
              <p className="text-text-100 font-medium mb-2">Revisa tu email</p>
              <p className="text-text-200 text-sm mb-4">
                Si existe una cuenta con <span className="text-text-100">{email}</span>, recibirás un enlace para restablecer tu contraseña.
              </p>
              <Link
                to="/login"
                className="text-sm text-accent-200 hover:text-accent-100 transition-colors"
              >
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <p className="text-text-200 text-sm mb-4">
                Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-200 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="tu@email.com"
                    className="w-full bg-white border border-primary-200 text-text-100 rounded-lg px-3 py-2.5 text-sm placeholder-primary-200 focus:outline-none focus:border-accent-100 focus:ring-1 focus:ring-accent-100"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-accent-200 hover:bg-accent-100 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
                >
                  {loading ? 'Enviando...' : 'Enviar enlace'}
                </button>
              </form>

              <div className="text-center mt-4">
                <Link
                  to="/login"
                  className="text-sm text-accent-200 hover:text-accent-100 transition-colors"
                >
                  Volver al inicio de sesión
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
