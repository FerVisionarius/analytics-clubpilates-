import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'

export default function ResetPassword({ isInvite = false }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        // listo para cambiar contraseña
      }
    })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) return setError('Mínimo 6 caracteres')
    if (password !== confirm) return setError('Las contraseñas no coinciden')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError('Error al actualizar: ' + error.message)
    } else {
      setDone(true)
      setTimeout(() => navigate('/'), 2000)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-bg-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent-200 mb-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-100">
            {isInvite ? 'Configura tu contraseña' : 'Restablecer contraseña'}
          </h1>
          <p className="text-text-200 text-sm mt-1">Club Pilates España · Analytics</p>
        </div>

        <div className="bg-bg-200 border border-bg-300 rounded-2xl p-6">
          {done ? (
            <div className="text-center py-4">
              <div className="text-green-700 text-lg font-medium mb-2">✓ Contraseña actualizada</div>
              <p className="text-text-200 text-sm">Redirigiendo al dashboard...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-200 mb-1.5">Nueva contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-white border border-primary-200 text-text-100 rounded-lg px-3 py-2.5 text-sm placeholder-primary-200 focus:outline-none focus:border-accent-100 focus:ring-1 focus:ring-accent-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-200 mb-1.5">Confirmar contraseña</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  placeholder="Repite la contraseña"
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
                {loading ? 'Guardando...' : 'Guardar contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
