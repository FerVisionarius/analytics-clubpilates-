import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fetchEventRatings, fetchEventResponses } from '../lib/ratings'
import { fetchInstructorOccupancy } from '../lib/instructoresRanking'

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

const pctFmt = (n) => `${Math.round(n * 100)}%`

function InfoTip({ text }) {
  return (
    <span className="relative group inline-flex align-middle ml-1">
      <svg className="w-3.5 h-3.5 text-primary-300 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="absolute right-0 top-6 z-20 hidden group-hover:block bg-text-100 text-white text-xs font-normal normal-case rounded-lg px-3 py-2 w-60 shadow-xl">
        {text}
      </span>
    </span>
  )
}

export default function Instructores({ branchId, initialTab = 'ocupacion' }) {
  const [tab, setTab] = useState(initialTab)
  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo, setDateTo] = useState(todayStr)
  const [loading, setLoading] = useState(true)

  const [ranking, setRanking] = useState([])              // valoraciones
  const [eventsByTrainer, setEventsByTrainer] = useState({})
  const [ocupacion, setOcupacion] = useState([])          // ocupación/asistencia
  const [trainerModal, setTrainerModal] = useState(null)
  const [eventModal, setEventModal] = useState(null)

  useEffect(() => { setTab(initialTab) }, [initialTab])

  useEffect(() => {
    if (branchId) fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId])

  async function fetchData() {
    setLoading(true)

    let staffQuery = supabase.from('staff').select('glofox_user_id, name').order('name')
    if (branchId) staffQuery = staffQuery.eq('branch_id', branchId)
    const { data: staff } = await staffQuery
    const staffMap = {}
    ;[...new Map((staff || []).map(s => [s.glofox_user_id, s])).values()].forEach(s => { staffMap[s.glofox_user_id] = s.name })

    const [eventRatings, occ] = await Promise.all([
      fetchEventRatings(supabase, branchId, dateFrom, dateTo),
      fetchInstructorOccupancy(supabase, branchId, dateFrom, dateTo),
    ])

    const perTrainer = {}
    const trainerEvents = {}
    eventRatings.forEach(ev => {
      if (!ev.trainerId) return
      const tid = ev.trainerId
      if (!perTrainer[tid]) perTrainer[tid] = { sum: 0, count: 0 }
      perTrainer[tid].sum += ev.avg * ev.count
      perTrainer[tid].count += ev.count
      if (!trainerEvents[tid]) trainerEvents[tid] = []
      trainerEvents[tid].push(ev)
    })

    const rankingList = Object.entries(perTrainer)
      .map(([tid, stats]) => ({
        trainerId: tid,
        name: staffMap[tid] || 'Desconocido',
        avg: stats.sum / stats.count,
        count: stats.count,
      }))
      .filter(r => staffMap[r.trainerId])
      .sort((a, b) => b.avg - a.avg)

    setRanking(rankingList)
    setEventsByTrainer(trainerEvents)
    setOcupacion(occ)
    setLoading(false)
  }

  async function openEventModal(ev) {
    setEventModal({ ev, responses: [], loading: true })
    const responses = await fetchEventResponses(supabase, ev.eventId)
    setEventModal({ ev, responses, loading: false })
  }

  const maxAvg = ranking.length > 0 ? Math.max(...ranking.map(r => r.avg), 1) : 1

  const tabClass = active =>
    `text-sm font-medium px-4 py-2 border-b-2 transition-colors ${
      active ? 'border-accent-200 text-accent-200' : 'border-transparent text-text-200 hover:text-text-100'
    }`

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-100">Ranking de Instructores</h2>
        <p className="text-text-200 text-sm mt-0.5">Por ocupación de sus clases o por valoraciones</p>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
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

      <div className="flex items-center gap-2 mb-6 border-b border-bg-300">
        <button onClick={() => setTab('ocupacion')} className={tabClass(tab === 'ocupacion')}>Ocupación / asistencia</button>
        <button onClick={() => setTab('valoraciones')} className={tabClass(tab === 'valoraciones')}>Valoraciones</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent-100 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === 'ocupacion' ? (
        ocupacion.length === 0 ? (
          <div className="text-center py-20 text-primary-300">No hay clases en este período</div>
        ) : (
          <div className="bg-bg-200 border border-bg-300 rounded-2xl max-w-3xl">
            <table className="w-full text-sm">
              <thead className="bg-bg-200 border-b border-bg-300">
                <tr>
                  <th className="text-left text-xs text-primary-300 font-medium px-6 py-3">Instructor</th>
                  <th className="text-left text-xs text-primary-300 font-medium px-4 py-3">Clases</th>
                  <th className="text-left text-xs text-primary-300 font-medium px-4 py-3">Reservas / Plazas</th>
                  <th className="text-left text-xs text-primary-300 font-medium px-4 py-3 whitespace-nowrap">
                    Ocupación
                    <InfoTip text="Reservas ÷ plazas: qué % de la capacidad de sus clases se llegó a reservar." />
                  </th>
                  <th className="text-left text-xs text-primary-300 font-medium px-4 py-3 whitespace-nowrap">
                    Asistencia
                    <InfoTip text="Asistidos ÷ reservas: de los que reservaron, qué % vino de verdad a clase." />
                  </th>
                </tr>
              </thead>
              <tbody>
                {ocupacion.map(r => (
                  <tr key={r.trainerId} className="border-b border-bg-300/60 hover:bg-primary-100/40">
                    <td className="px-6 py-3 text-text-100 font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-text-200">{r.clases}</td>
                    <td className="px-4 py-3 text-text-200">{r.reservas} / {r.plazas}</td>
                    <td className="px-4 py-3 text-text-100 font-medium">{pctFmt(r.ocupacion)}</td>
                    <td className="px-4 py-3 text-text-200">{pctFmt(r.asistencia)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : ranking.length === 0 ? (
        <div className="text-center py-20 text-primary-300">No hay valoraciones en este período</div>
      ) : (
        <div className="space-y-3">
          {ranking.map(r => (
            <div key={r.trainerId} onClick={() => setTrainerModal(r)}
              className="bg-bg-200 border border-bg-300 rounded-xl p-4 cursor-pointer hover:border-primary-200 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text-100">{r.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-200 bg-primary-100 px-2 py-0.5 rounded-full">{r.count} valoraciones</span>
                  <span className="text-2xl font-bold text-text-100">{r.avg.toFixed(1)} ⭐</span>
                </div>
              </div>
              <div className="h-2 bg-primary-100 rounded-full overflow-hidden">
                <div className="h-full bg-accent-200 rounded-full transition-all duration-500" style={{ width: `${(r.avg / maxAvg) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {trainerModal && (
        <div className="fixed inset-0 bg-text-100/40 z-50 flex items-center justify-center px-4" onClick={() => setTrainerModal(null)}>
          <div className="bg-bg-200 border border-bg-300 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-bg-300">
              <div>
                <h3 className="text-text-100 font-semibold">{trainerModal.name}</h3>
                <p className="text-xs text-text-200 mt-0.5">Media general: {trainerModal.avg.toFixed(1)} ⭐ ({trainerModal.count} valoraciones)</p>
              </div>
              <button onClick={() => setTrainerModal(null)} className="text-text-200 hover:text-text-100 text-lg leading-none">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {(eventsByTrainer[trainerModal.trainerId] || [])
                .sort((a, b) => b.avg - a.avg)
                .map(ev => (
                  <div key={ev.eventId} onClick={() => openEventModal(ev)}
                    className="border border-bg-300 rounded-xl p-3 cursor-pointer hover:border-primary-200 transition-colors flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text-100">{ev.name}</p>
                      <p className="text-xs text-text-200">Última sesión: {formatDateTime(ev.lastScheduledAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-200">{ev.count} valoraciones</span>
                      <span className="text-lg font-bold text-text-100">{ev.avg.toFixed(1)} ⭐</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {eventModal && (
        <div className="fixed inset-0 bg-text-100/40 z-50 flex items-center justify-center px-4" onClick={() => setEventModal(null)}>
          <div className="bg-bg-200 border border-bg-300 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-bg-300">
              <h3 className="text-text-100 font-semibold">Valoraciones — {eventModal.ev.name}</h3>
              <button onClick={() => setEventModal(null)} className="text-text-200 hover:text-text-100 text-lg leading-none">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {eventModal.loading ? (
                <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-accent-100 border-t-transparent rounded-full animate-spin" /></div>
              ) : eventModal.responses.length === 0 ? (
                <p className="text-text-200 text-sm text-center py-12">Sin valoraciones</p>
              ) : (
                eventModal.responses.map(r => (
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
