import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import { fetchLaserrStats, buildLaserrSteps, renderLaserrPdfSection, pct, formatDate } from '../lib/laserrReport'

const today = new Date()
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
const todayStr = today.toISOString().split('T')[0]

const STEP_COLORS = ['bg-accent-100', 'bg-accent-200', 'bg-red-400', 'bg-primary-200', 'bg-orange-400', 'bg-green-500', 'bg-emerald-400', 'bg-red-500', 'bg-amber-500']

const membershipLabel = (type) => {
  if (type === 'time_classes') return 'Suscripción recurrente'
  if (type === 'time') return 'Suscripción recurrente'
  if (type === 'num_classes') return 'Pack de clases'
  if (type === 'payg') return 'Pago por clase'
  return type || '—'
}

export default function Laserr({ branchId }) {
  const [dateFrom, setDateFrom] = useState(() => {
    return sessionStorage.getItem(`laserr_dateFrom_${branchId}`) || firstOfMonth
  })
  const [dateTo, setDateTo] = useState(() => {
    return sessionStorage.getItem(`laserr_dateTo_${branchId}`) || todayStr
  })
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [modal, setModal] = useState(() => {
    const saved = sessionStorage.getItem(`laserr_modal_${branchId}`)
    return saved ? JSON.parse(saved) : null
  })
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState(null)

  useEffect(() => {
    if (branchId) fetchData()
  }, [branchId])

  useEffect(() => {
    sessionStorage.setItem(`laserr_dateFrom_${branchId}`, dateFrom)
  }, [dateFrom, branchId])

  useEffect(() => {
    sessionStorage.setItem(`laserr_dateTo_${branchId}`, dateTo)
  }, [dateTo, branchId])

  useEffect(() => {
    if (modal) {
      sessionStorage.setItem(`laserr_modal_${branchId}`, JSON.stringify(modal))
    } else {
      sessionStorage.removeItem(`laserr_modal_${branchId}`)
    }
  }, [modal, branchId])

  async function fetchData() {
    setLoading(true)
    setStats(null)
    const result = await fetchLaserrStats(supabase, branchId, dateFrom, dateTo)
    setStats(result)
    setLoading(false)
  }

  const steps = buildLaserrSteps(stats).map((step, i) => ({ ...step, color: STEP_COLORS[i] }))

  const maxVal = stats ? Math.max(stats.leads, 1) : 1

  async function exportarPDF() {
    const { data: { user } } = await supabase.auth.getUser()
    const email = user?.email
    if (!email || !stats) return

    const doc = new jsPDF()
    renderLaserrPdfSection(doc, { stats, dateFrom, dateTo })
    const pdfBase64 = doc.output('datauristring').split(',')[1]

    setExporting(true)
    try {
      await fetch('https://n8n.clubpilatesia.es/webhook/export-laserr-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pdfBase64, dateFrom, dateTo, branchId })
      })
      setExportMsg('Informe enviado')
    } catch (err) {
      setExportMsg('Error al enviar')
    }
    setExporting(false)
    setTimeout(() => setExportMsg(null), 3000)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-text-100">Laserr</h2>
          <p className="text-text-200 text-sm mt-0.5">Funnel de conversión de leads</p>
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
        <button
          onClick={exportarPDF}
          disabled={!stats || exporting}
          className="bg-accent-200 hover:bg-accent-100 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
        >
          {exporting ? 'Enviando...' : 'Exportar PDF'}
        </button>
        {exportMsg && (
          <span className="text-sm text-green-600 font-medium">{exportMsg}</span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent-100 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && stats && (
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div
              key={i}
              onClick={() => step.list?.length > 0 && setModal({ title: step.label, people: step.list })}
              className={`bg-bg-200 border border-bg-300 rounded-xl p-4 ${step.list?.length > 0 ? 'cursor-pointer hover:border-primary-200 transition-colors' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-sm font-medium text-text-100">{step.label}</span>
                  <span className="text-xs text-primary-300 ml-2">{step.desc}</span>
                </div>
                <div className="flex items-center gap-3">
                  {step.pct && (
                    <span className="text-xs text-text-200 bg-primary-100 px-2 py-0.5 rounded-full">
                      {step.pct} del paso anterior
                    </span>
                  )}
                  <span className="text-2xl font-bold text-text-100">{step.value}</span>
                </div>
              </div>
              <div className="h-2 bg-primary-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${step.color} rounded-full transition-all duration-500`}
                  style={{ width: `${Math.round((step.value / maxVal) * 100)}%` }}
                />
              </div>
            </div>
          ))}

          <div className="mt-6 bg-bg-200 border border-accent-200/30 rounded-xl p-4">
            <p className="text-xs text-text-200 uppercase tracking-wider mb-3">Conversión total</p>
            <div className="flex items-center gap-8">
              <div>
                <p className="text-3xl font-bold text-text-100">
                  {pct(stats.compraronEnMomento + stats.compraronDespues + stats.sinIntro, stats.leads)}
                </p>
                <p className="text-xs text-text-200 mt-1">leads → membresía</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-text-100">
                  {pct(stats.compraronEnMomento + stats.compraronDespues, stats.asistidos)}
                </p>
                <p className="text-xs text-text-200 mt-1">asistidos → membresía</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-text-100">
                  {stats.compraronEnMomento + stats.compraronDespues + stats.sinIntro}
                </p>
                <p className="text-xs text-text-200 mt-1">total conversiones</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && !stats && (
        <div className="text-center py-20 text-primary-300">
          Selecciona un rango de fechas y pulsa Aplicar
        </div>
      )}

{modal && (
  <div
    className="fixed inset-0 bg-text-100/40 z-50 flex items-center justify-center px-4"
    onClick={() => setModal(null)}
  >
    <div
      className="bg-bg-200 border border-bg-300 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-xl"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-bg-300 flex-shrink-0">
        <h3 className="text-text-100 font-semibold">{modal.title}</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-200">{modal.people.length} personas</span>
          <button
            onClick={() => setModal(null)}
            className="text-text-200 hover:text-text-100 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="overflow-y-scroll overflow-x-auto flex-1">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-bg-200 border-b border-bg-300 z-10">
            <tr>
              <th className="text-left text-xs text-primary-300 font-medium px-6 py-3 whitespace-nowrap">Nombre</th>
              <th className="text-left text-xs text-primary-300 font-medium px-4 py-3 whitespace-nowrap">Email</th>
              <th className="text-left text-xs text-primary-300 font-medium px-4 py-3 whitespace-nowrap">Alta</th>
              <th className="text-left text-xs text-primary-300 font-medium px-4 py-3 whitespace-nowrap">Membresía</th>
              <th className="text-left text-xs text-primary-300 font-medium px-4 py-3 whitespace-nowrap">Compra</th>
            </tr>
          </thead>
          <tbody>
            {modal.people.map((p, i) => (
              <tr key={i} className="border-b border-bg-300/60 hover:bg-primary-100/40">
                <td className="px-6 py-3 text-text-100 font-medium whitespace-nowrap">{p.name || '—'}</td>
                <td className="px-4 py-3 text-text-200 whitespace-nowrap">{p.email || '—'}</td>
                <td className="px-4 py-3 text-text-200 whitespace-nowrap">{formatDate(p.created_at)}</td>
                <td className="px-4 py-3 text-text-200 max-w-xs truncate" title={p.membership_type ? membershipLabel(p.membership_type) : '—'}>
                  {p.membership_type ? membershipLabel(p.membership_type) : '—'}
                </td>
                <td className="px-4 py-3 text-text-200 whitespace-nowrap">{formatDate(p.membership_start_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
)}
    </div>
  )
}