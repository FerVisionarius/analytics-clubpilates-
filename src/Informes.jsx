import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import jsPDF from 'jspdf'
import { supabase } from './lib/supabase'
import { fetchLaserrStats, renderLaserrPdfSection } from './lib/laserrReport'
import { fetchSociosStats, renderSociosPdfSection } from './lib/sociosReport'

const today = new Date()
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
const todayStr = today.toISOString().split('T')[0]

function InformeCard({ to, title, desc, icon }) {
  return (
    <Link
      to={to}
      className="bg-bg-200 border border-bg-300 rounded-2xl p-5 flex items-center gap-4 hover:border-accent-100 transition-colors"
    >
      <div className="w-10 h-10 rounded-xl bg-primary-100 text-accent-200 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-text-100">{title}</p>
        <p className="text-xs text-text-200 mt-0.5">{desc}</p>
      </div>
    </Link>
  )
}

export default function Informes() {
  const { branchId } = useParams()
  const [showModal, setShowModal] = useState(false)
  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo, setDateTo] = useState(todayStr)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState(null)

  async function generarExportacionCompleta() {
    setGenerating(true)
    setMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const email = user?.email

      const [laserrStats, sociosStats] = await Promise.all([
        fetchLaserrStats(supabase, branchId, dateFrom, dateTo),
        fetchSociosStats(supabase, branchId),
      ])

      if (!email || !laserrStats || sociosStats.error) {
        setMessage('Error al generar el informe')
        setGenerating(false)
        return
      }

      const doc = new jsPDF()
      renderLaserrPdfSection(doc, { stats: laserrStats, dateFrom, dateTo })
      doc.addPage()
      renderSociosPdfSection(doc, sociosStats)
      const pdfBase64 = doc.output('datauristring').split(',')[1]

      await fetch('https://n8n.clubpilatesia.es/webhook/export-general-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pdfBase64, branchId, dateFrom, dateTo })
      })

      setMessage('Informe enviado')
      setShowModal(false)
    } catch (err) {
      setMessage('Error al enviar')
    }
    setGenerating(false)
    setTimeout(() => setMessage(null), 3000)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-text-100">Informes</h2>
        <p className="text-sm text-text-200 mt-1">Acceso directo a los informes y exportación combinada.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <InformeCard
          to={`/centro/${branchId}/laserr`}
          title="Exportar Laserr"
          desc="Funnel de conversión de leads"
          icon={(
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        />
        <InformeCard
          to={`/centro/${branchId}/miembros`}
          title="Exportar Socios"
          desc="Estadísticas de socios"
          icon={(
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          )}
        />
      </div>

      <div className="bg-bg-200 border border-accent-200/30 rounded-2xl p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-text-100">Exportación completa</p>
          <p className="text-xs text-text-200 mt-0.5">Genera y envía por email el informe de Laserr y el de Socios juntos.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowModal(true)}
            className="bg-accent-200 hover:bg-accent-100 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            Exportar todo
          </button>
          {message && (
            <span className="text-sm text-green-600 font-medium">{message}</span>
          )}
        </div>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 bg-text-100/40 z-50 flex items-center justify-center px-4"
          onClick={() => !generating && setShowModal(false)}
        >
          <div
            className="bg-bg-200 border border-bg-300 rounded-2xl w-full max-w-sm shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-bg-300">
              <h3 className="text-text-100 font-semibold">Selección fecha Laserr</h3>
              <button
                onClick={() => !generating && setShowModal(false)}
                className="text-text-200 hover:text-text-100 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-xs text-text-200">El rango de fechas aplica solo al informe de Laserr. Socios siempre refleja el estado actual.</p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs text-text-200 block mb-1">Desde</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="w-full bg-white border border-primary-200 text-text-100 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent-100"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-text-200 block mb-1">Hasta</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="w-full bg-white border border-primary-200 text-text-100 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent-100"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  disabled={generating}
                  className="text-text-200 hover:text-text-100 disabled:opacity-50 text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={generarExportacionCompleta}
                  disabled={generating}
                  className="bg-accent-200 hover:bg-accent-100 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
                >
                  {generating ? 'Generando...' : 'Generar y enviar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
