import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fetchLaserrClassBreakdown } from '../lib/laserrReport'
import { fetchEventResponses } from '../lib/ratings'

const today = new Date()
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
const todayStr = today.toISOString().split('T')[0]

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function KpiTable({ titulo, columnas, filas, renderRow, onRowClick }) {
  return (
    <div className="bg-bg-200 border border-bg-300 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-bg-300">
        <h3 className="text-text-100 font-semibold">{titulo}</h3>
      </div>
      {filas.length === 0 ? (
        <p className="text-sm text-text-200 text-center py-6">Sin clases de intro en este período</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-200 border-b border-bg-300">
              <tr>
                {columnas.map(c => (
                  <th key={c} className="text-left text-xs text-primary-300 font-medium px-6 py-3 whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr
                  key={i}
                  onClick={() => onRowClick?.(f)}
                  className={`border-b border-bg-300/60 hover:bg-primary-100/40 ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {renderRow(f)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function LaserrClases({ branchId }) {
  const [dateFrom, setDateFrom] = useState(() => sessionStorage.getItem(`laserr_dateFrom_${branchId}`) || firstOfMonth)
  const [dateTo, setDateTo] = useState(() => sessionStorage.getItem(`laserr_dateTo_${branchId}`) || todayStr)
  const [loading, setLoading] = useState(false)
  const [classBreakdown, setClassBreakdown] = useState(null)
  const [classModal, setClassModal] = useState(null)
  const [ratingsModal, setRatingsModal] = useState(null)

  useEffect(() => {
    if (branchId) fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId])

  useEffect(() => { sessionStorage.setItem(`laserr_dateFrom_${branchId}`, dateFrom) }, [dateFrom, branchId])
  useEffect(() => { sessionStorage.setItem(`laserr_dateTo_${branchId}`, dateTo) }, [dateTo, branchId])

  async function fetchData() {
    setLoading(true)
    setClassBreakdown(null)
    const breakdown = await fetchLaserrClassBreakdown(supabase, branchId, dateFrom, dateTo)
    setClassBreakdown(breakdown)
    setLoading(false)
  }

  async function openRatings(clase) {
    setRatingsModal({ clase, responses: [], loading: true })
    const responses = await fetchEventResponses(supabase, clase.eventId)
    setRatingsModal({ clase, responses, loading: false })
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-100">LASERR · Clases de intro</h2>
        <p className="text-text-200 text-sm mt-0.5">Desglose de las clases de introducción por día e instructor</p>
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

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent-100 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && classBreakdown && (
        <div className="space-y-6">
          <KpiTable
            titulo="Clases de intro por día de la semana"
            columnas={['Día', 'Nº clases', 'Instructor', 'Apuntados', 'Asistidos', 'Cancelados', '% asistencia']}
            filas={classBreakdown.porDia}
            onRowClick={f => setClassModal({ title: `Clases de intro — ${f.dia}`, classes: f.classList })}
            renderRow={f => (
              <>
                <td className="px-6 py-3 text-text-100 font-medium whitespace-nowrap">{f.dia}</td>
                <td className="px-6 py-3 text-text-100">{f.clases}</td>
                <td className="px-6 py-3 text-text-200">{f.instructores}</td>
                <td className="px-6 py-3 text-text-200">{f.apuntados}</td>
                <td className="px-6 py-3 text-text-200">{f.asistidos}</td>
                <td className="px-6 py-3 text-text-200">{f.cancelados}</td>
                <td className="px-6 py-3 text-text-200">{f.tasaAsistencia}</td>
              </>
            )}
          />

          <KpiTable
            titulo="Clases de intro por instructor"
            columnas={['Instructor', 'Nº clases', 'Apuntados', 'Asistidos', 'Cancelados', '% asistencia', 'Compraron', 'Retención']}
            filas={classBreakdown.porInstructor}
            onRowClick={f => setClassModal({ title: `Clases de intro — ${f.instructor}`, classes: f.classList })}
            renderRow={f => (
              <>
                <td className="px-6 py-3 text-text-100 font-medium whitespace-nowrap">{f.instructor}</td>
                <td className="px-6 py-3 text-text-100">{f.clases}</td>
                <td className="px-6 py-3 text-text-200">{f.apuntados}</td>
                <td className="px-6 py-3 text-text-200">{f.asistidos}</td>
                <td className="px-6 py-3 text-text-200">{f.cancelados}</td>
                <td className="px-6 py-3 text-text-200">{f.tasaAsistencia}</td>
                <td className="px-6 py-3 text-text-200">{f.comprados}</td>
                <td className="px-6 py-3 text-text-100 font-medium">{f.retencion}</td>
              </>
            )}
          />
        </div>
      )}

      {!loading && !classBreakdown && (
        <div className="text-center py-20 text-primary-300">Selecciona un rango de fechas y pulsa Aplicar</div>
      )}

      {classModal && (
        <div className="fixed inset-0 bg-text-100/40 z-50 flex items-center justify-center px-4" onClick={() => setClassModal(null)}>
          <div className="bg-bg-200 border border-bg-300 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-bg-300 flex-shrink-0">
              <h3 className="text-text-100 font-semibold">{classModal.title}</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-200">{classModal.classes.length} clases</span>
                <button onClick={() => setClassModal(null)} className="text-text-200 hover:text-text-100 transition-colors text-lg leading-none">✕</button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {classModal.classes.map(clase => (
                <div
                  key={clase.eventId}
                  onClick={() => clase.ratingCount > 0 && openRatings(clase)}
                  className={`border border-bg-300 rounded-xl p-3 ${clase.ratingCount > 0 ? 'cursor-pointer hover:border-primary-200 transition-colors' : ''}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-text-100">{formatDateTime(clase.scheduledAt)}</p>
                      <p className="text-xs text-text-200 mt-0.5">{clase.instructor}</p>
                    </div>
                    {clase.ratingCount > 0 ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-text-200">{clase.ratingCount} valoraciones</span>
                        <span className="text-lg font-bold text-text-100">{clase.ratingAvg.toFixed(1)} ⭐</span>
                      </div>
                    ) : (
                      <span className="text-xs text-primary-300 shrink-0">Sin valoraciones</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-text-200">
                    <span>Apuntados: {clase.apuntados}</span>
                    <span>Asistidos: {clase.asistidos}</span>
                    <span>Cancelados: {clase.cancelados}{clase.cancelados > 0 ? ` (${clase.canceladosNormal} normal · ${clase.canceladosTardia} tardía)` : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {ratingsModal && (
        <div className="fixed inset-0 bg-text-100/40 z-50 flex items-center justify-center px-4" onClick={() => setRatingsModal(null)}>
          <div className="bg-bg-200 border border-bg-300 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-bg-300">
              <h3 className="text-text-100 font-semibold">Valoraciones — {formatDateTime(ratingsModal.clase.scheduledAt)}</h3>
              <button onClick={() => setRatingsModal(null)} className="text-text-200 hover:text-text-100 text-lg leading-none">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {ratingsModal.loading ? (
                <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-accent-100 border-t-transparent rounded-full animate-spin" /></div>
              ) : ratingsModal.responses.length === 0 ? (
                <p className="text-text-200 text-sm text-center py-12">Sin valoraciones</p>
              ) : (
                ratingsModal.responses.map(r => (
                  <div key={r.id} className="border border-bg-300 rounded-xl p-4">
                    <p className="text-xs text-text-200 mb-2">{formatDateTime(r.submitted_at)}</p>
                    {r.class_survey_answers.map((a, i) => (
                      <p key={i} className="text-sm text-text-100 mb-1">
                        <span className="font-medium">{a.question_label}:</span>{' '}
                        {a.answer_type === 'numeric' ? `${a.answer_numeric} (${a.answer_text})` : a.answer_text}
                      </p>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
