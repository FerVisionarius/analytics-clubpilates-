import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fetchLaserrGlobal } from '../lib/laserrReport'

const today = new Date()
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
const todayStr = today.toISOString().split('T')[0]

// Filas del embudo (mismas que LASERR); indent marca los sub-pasos de "Asistieron".
const ROWS = [
  { label: 'Leads totales', field: 'leads' },
  { label: 'Apuntados a intro', field: 'apuntados' },
  { label: 'Asistieron', field: 'asistidos' },
  { label: 'Compraron en el momento', field: 'compraronEnMomento', indent: true },
  { label: 'Compraron después', field: 'compraronDespues', indent: true },
  { label: 'No compraron', field: 'noCompraron', indent: true },
  { label: 'No asistieron', field: 'noAsistieron' },
  { label: 'Cancelados', field: 'cancelados' },
  { label: 'Nuevos miembros sin intro', field: 'sinIntro' },
]

export default function LaserrGlobal() {
  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo, setDateTo] = useState(todayStr)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchData() {
    setLoading(true)
    setData(null)
    const result = await fetchLaserrGlobal(supabase, dateFrom, dateTo)
    setData(result)
    setLoading(false)
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-100">LASERR global</h2>
        <p className="text-text-200 text-sm mt-0.5">Funnel sumado de todos los clubes, separando abiertos y cerrados</p>
      </div>

      <div className="flex items-center gap-3 mb-8 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-200">Desde</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="bg-white border border-primary-200 text-text-100 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent-100" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-200">Hasta</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="bg-white border border-primary-200 text-text-100 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent-100" />
        </div>
        <button onClick={fetchData} disabled={loading}
          className="bg-accent-200 hover:bg-accent-100 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
          {loading ? 'Cargando...' : 'Aplicar'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent-100 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data && (
        <div className="max-w-2xl">
          <div className="bg-bg-200 border border-bg-300 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-200 border-b border-bg-300">
                <tr>
                  <th className="text-left text-xs text-primary-300 font-medium px-6 py-3">Paso</th>
                  <th className="text-right text-xs text-primary-300 font-medium px-4 py-3 whitespace-nowrap">
                    Abiertos<span className="block text-[10px] text-primary-300 font-normal">{data.abiertosCount} clubes</span>
                  </th>
                  <th className="text-right text-xs text-primary-300 font-medium px-4 py-3 whitespace-nowrap">
                    Cerrados<span className="block text-[10px] text-primary-300 font-normal">{data.cerradosCount} clubes</span>
                  </th>
                  <th className="text-right text-xs text-primary-300 font-medium px-6 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(r => (
                  <tr key={r.field} className="border-b border-bg-300/60">
                    <td className={`px-6 py-3 text-text-100 ${r.indent ? 'pl-12 text-text-200' : 'font-medium'}`}>{r.label}</td>
                    <td className="px-4 py-3 text-right text-text-200">{data.abiertos[r.field].toLocaleString('es-ES')}</td>
                    <td className="px-4 py-3 text-right text-text-200">{data.cerrados[r.field].toLocaleString('es-ES')}</td>
                    <td className="px-6 py-3 text-right text-text-100 font-medium">{data.total[r.field].toLocaleString('es-ES')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-text-200 mt-3">Un club se considera "abierto" si tiene clases en su calendario.</p>
        </div>
      )}
    </div>
  )
}
