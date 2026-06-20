import { useState } from 'react'
import { useAuth } from './AuthContext'
import logo from './assets/logo-clubpilates.png'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError('Email o contraseña incorrectos')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-bg-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={logo} alt="Club Pilates España" className="max-h-28 w-auto object-contain mx-auto mb-6" />
        </div>

        <div className="bg-bg-200 border border-bg-300 rounded-2xl p-6">
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
            <div>
              <label className="block text-sm font-medium text-text-200 mb-1.5">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
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
              {loading ? 'Iniciando sesión....' : 'Iniciar sesión'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
