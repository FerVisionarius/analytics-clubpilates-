import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fetchRetencionStats } from '../lib/retencionReport'

const today = new Date()
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
const todayStr = today.toISOString().split('T')[0]

export default function Retencion({ branchId }) {
  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo, setDateTo] = useState(todayStr)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (branchId) fetchData()
  }, [branchId])

  async function fetchData() {
    setLoading(true)
    setError(null)
    const result = await fetchRetencionStats(supabase, branchId, dateFrom, dateTo)
    if (result.error) {
      setError(result.error)
      setStats(null)
    } else {
      setStats(result)
    }
    setLoading(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-text-100">Retención y Churn</h2>
          <p className="text-text-200 text-sm mt-0.5">Altas y bajas de socios en el período</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-200">Desde</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="bg-white border border-primary-200 text-text-100 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent-100"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-200">Hasta</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="bg-white border border-primary-200 text-text-100 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent-100"
          />
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="bg-accent-200 hover:bg-accent-100 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
        >
          {loading ? 'Cargando...' : 'Aplicar'}
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent-100 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <p className="text-red-600 text-sm text-center py-12">{error}</p>
      )}

      {!loading && !error && stats && (
        <div className="space-y-6 max-w-4xl">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-bg-200 border border-bg-300 rounded-2xl p-5">
              <p className="text-xs text-primary-300 mb-1">Miembros totales</p>
              <p className="text-3xl font-bold text-text-100">{stats.totalMiembros}</p>
              <p className="text-xs text-text-200 mt-1">Sin filtro de fecha</p>
            </div>
            <div className="bg-bg-200 border border-bg-300 rounded-2xl p-5">
              <p className="text-xs text-primary-300 mb-1">Nuevos miembros</p>
              <p className="text-3xl font-bold text-green-600">{stats.nuevosMiembros}</p>
              <p className="text-xs text-text-200 mt-1">En el período seleccionado</p>
            </div>
            <div className="bg-bg-200 border border-bg-300 rounded-2xl p-5">
              <p className="text-xs text-primary-300 mb-1">Cancelados</p>
              <p className="text-3xl font-bold text-red-600">{stats.cancelados}</p>
              <p className="text-xs text-text-200 mt-1">En el período seleccionado</p>
            </div>
          </div>

          <div className="bg-bg-200 border border-bg-300 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-bg-300">
              <h3 className="text-text-100 font-semibold">Motivo de cancelación</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-bg-200 border-b border-bg-300">
                <tr>
                  <th className="text-left text-xs text-primary-300 font-medium px-6 py-3">Motivo</th>
                  <th className="text-left text-xs text-primary-300 font-medium px-6 py-3">Cantidad</th>
                  <th className="text-left text-xs text-primary-300 font-medium px-6 py-3">% del total</th>
                </tr>
              </thead>
              <tbody>
                {stats.canceladosPorMotivo.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-6 text-center text-primary-300">
                      Sin cancelaciones en este período
                    </td>
                  </tr>
                ) : (
                  stats.canceladosPorMotivo.map((row, i) => (
                    <tr key={i} className="border-b border-bg-300/60 hover:bg-primary-100/40">
                      <td className="px-6 py-3 text-text-100">{row.label}</td>
                      <td className="px-6 py-3 text-text-100 font-medium">{row.cantidad}</td>
                      <td className="px-6 py-3 text-text-200">
                        {stats.cancelados > 0 ? ((row.cantidad / stats.cancelados) * 100).toFixed(2) + '%' : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !stats && !error && (
        <div className="text-center py-20 text-primary-300">
          Selecciona un rango de fechas y pulsa Aplicar
        </div>
      )}
    </div>
  )
}