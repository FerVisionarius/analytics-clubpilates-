import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import { fetchSociosStats, renderSociosPdfSection, isSociosAlert } from '../lib/sociosReport'

function TablaEstadistica({ titulo, filas, columnas, nota }) {
  const total = filas.reduce((sum, f) => sum + f.cantidad, 0)
  return (
    <div className="bg-bg-200 border border-bg-300 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-bg-300">
        <h3 className="text-text-100 font-semibold">{titulo}</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-bg-200 border-b border-bg-300">
          <tr>
            {columnas.map(c => (
              <th key={c} className="text-left text-xs text-primary-300 font-medium px-6 py-3">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => {
            const pct = total > 0 ? (f.cantidad / total) * 100 : null
            const alert = pct !== null && isSociosAlert(f.label, pct)
            return (
            <tr key={i} className="border-b border-bg-300/60 hover:bg-primary-100/40">
              <td className="px-6 py-3 text-text-100">
                <div className="flex items-center gap-2">
                  <span>{f.label}</span>
                  {f.tooltip && (
                    <div className="relative group">
                      <svg className="w-4 h-4 text-primary-300 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="absolute left-6 top-0 z-10 hidden group-hover:block bg-text-100 text-white text-xs rounded-lg px-3 py-2 w-64 shadow-xl">
                        {f.tooltip}
                      </div>
                    </div>
                  )}
                </div>
              </td>
              <td className="px-6 py-3 text-text-100 font-medium">{f.cantidad.toLocaleString('es-ES')}</td>
              <td className={`px-6 py-3 ${alert ? 'font-bold text-red-600' : 'text-text-200'}`}>{pct !== null ? pct.toFixed(2) + '%' : '—'}</td>
              {f.extra !== undefined && (
                <td className="px-6 py-3 text-text-200">{f.extra}</td>
              )}
            </tr>
            )
          })}
          <tr className="bg-primary-100/30">
            <td className="px-6 py-3 text-text-100 font-semibold">Total general</td>
            <td className="px-6 py-3 text-text-100 font-semibold">{total.toLocaleString('es-ES')}</td>
            <td className="px-6 py-3 text-text-100 font-semibold">100.00%</td>
            {filas[0]?.extra !== undefined && <td />}
          </tr>
        </tbody>
      </table>
      {nota && <p className="text-xs text-primary-300 px-6 py-3">{nota}</p>}
    </div>
  )
}

export default function EstadisticasSocios({ branchId }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tipoSuscripcion, setTipoSuscripcion] = useState([])
  const [estadoSocios, setEstadoSocios] = useState([])
  const [tipoSocio, setTipoSocio] = useState([])
  const [sinSuscripcion, setSinSuscripcion] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState(null)

  useEffect(() => {
    fetchData()
  }, [branchId])

  async function fetchData() {
    setLoading(true)
    setError(null)

    const result = await fetchSociosStats(supabase, branchId)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setTipoSuscripcion(result.tipoSuscripcion)
    setEstadoSocios(result.estadoSocios)
    setTipoSocio(result.tipoSocio)
    setSinSuscripcion(result.sinSuscripcion)
    setLoading(false)
  }

  async function exportarPDF() {
    const { data: { user } } = await supabase.auth.getUser()
    const email = user?.email
    if (!email) return

    const { data: branch } = await supabase
      .from('branches')
      .select('name')
      .eq('branch_id', branchId)
      .single()

    const doc = new jsPDF()
    renderSociosPdfSection(doc, { tipoSuscripcion, estadoSocios, tipoSocio, sinSuscripcion, branchName: branch?.name })
    const pdfBase64 = doc.output('datauristring').split(',')[1]

    setExporting(true)
    try {
      await fetch('https://n8n.clubpilatesia.es/webhook/export-socios-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pdfBase64, branchId })
      })
      setExportMsg('Informe enviado')
    } catch (err) {
      setExportMsg('Error al enviar')
    }
    setExporting(false)
    setTimeout(() => setExportMsg(null), 3000)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-text-200 text-sm">Cargando datos...</div>
  )

  if (error) return (
    <p className="text-red-600 text-sm text-center py-12">{error}</p>
  )

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-100">Estadísticas de Socios</h2>
          <p className="text-sm text-text-200 mt-1">Estado actual del centro seleccionado.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportarPDF}
            disabled={exporting}
            className="bg-accent-200 hover:bg-accent-100 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            {exporting ? 'Enviando...' : 'Exportar PDF'}
          </button>
          {exportMsg && (
            <span className="text-sm text-green-600 font-medium">{exportMsg}</span>
          )}
        </div>
      </div>

      <TablaEstadistica
        titulo="Tipo de Suscripción"
        columnas={['Tipo de Suscripción', 'Cantidad de socios', '% del total', 'Clases est. x semana']}
        filas={tipoSuscripcion}
      />

      <TablaEstadistica
        titulo="Estado de Socios"
        columnas={['Estado', 'Cantidad de socios', '% del total']}
        filas={estadoSocios}
        nota="Se recomienda mantener OVERDUE por debajo del 2%"
      />

      <TablaEstadistica
        titulo="Tipo de Socio"
        columnas={['Tipo', 'Cantidad de socios', '% del total']}
        filas={tipoSocio}
        nota="Se recomienda mantener No recurrente por debajo del 10%"
      />
    </div>
  )
}