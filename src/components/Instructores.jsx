import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Instructores({ branchId }) {
  const [loading, setLoading] = useState(true)
  const [ranking, setRanking] = useState([])
  const [eventsByTrainer, setEventsByTrainer] = useState({})
  const [trainerModal, setTrainerModal] = useState(null)
  const [eventModal, setEventModal] = useState(null)

  useEffect(() => {
    if (branchId) fetchData()
  }, [branchId])

  async function fetchData() {
    setLoading(true)

    let staffQuery = supabase
      .from('staff')
      .select('glofox_user_id, name')
      .order('name')
    if (branchId) staffQuery = staffQuery.eq('branch_id', branchId)
    const { data: staff } = await staffQuery

    const uniqueStaff = [...new Map((staff || []).map(s => [s.glofox_user_id, s])).values()]
    const staffMap = {}
    uniqueStaff.forEach(s => { staffMap[s.glofox_user_id] = s.name })

    let classesQuery = supabase
      .from('classes')
      .select('event_id, trainer_id, name, scheduled_at')
      .eq('branch_id', branchId)
      .not('event_id', 'is', null)
      .order('scheduled_at', { ascending: false })

    const { data: classes } = await classesQuery

    const eventInfo = {}
    ;(classes || []).forEach(c => {
      if (!eventInfo[c.event_id]) {
        eventInfo[c.event_id] = {
          trainerId: c.trainer_id,
          name: c.name,
          lastScheduledAt: c.scheduled_at,
        }
      }
    })

    const eventIds = Object.keys(eventInfo)
    if (eventIds.length === 0) {
      setRanking([])
      setEventsByTrainer({})
      setLoading(false)
      return
    }

    const { data: answers } = await supabase
      .from('class_survey_answers')
      .select('answer_numeric, response_id, class_survey_responses!inner(event_id)')
      .eq('answer_type', 'numeric')
      .in('class_survey_responses.event_id', eventIds)

    const perEvent = {}
    ;(answers || []).forEach(a => {
      const eid = a.class_survey_responses.event_id
      if (!perEvent[eid]) perEvent[eid] = { sum: 0, count: 0 }
      perEvent[eid].sum += a.answer_numeric
      perEvent[eid].count += 1
    })

    const perTrainer = {}
    const trainerEvents = {}

    Object.entries(perEvent).forEach(([eid, stats]) => {
      const info = eventInfo[eid]
      if (!info || !info.trainerId) return

      const tid = info.trainerId
      if (!perTrainer[tid]) perTrainer[tid] = { sum: 0, count: 0 }
      perTrainer[tid].sum += stats.sum
      perTrainer[tid].count += stats.count

      if (!trainerEvents[tid]) trainerEvents[tid] = []
      trainerEvents[tid].push({
        eventId: eid,
        name: info.name,
        lastScheduledAt: info.lastScheduledAt,
        avg: stats.sum / stats.count,
        count: stats.count,
      })
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
    setLoading(false)
  }

  async function openEventModal(ev) {
    setEventModal({ ev, responses: [], loading: true })

    const { data: responses } = await supabase
      .from('class_survey_responses')
      .select('id, user_id, submitted_at, class_survey_answers(question_key, question_label, answer_type, answer_numeric, answer_text)')
      .eq('event_id', ev.eventId)
      .order('submitted_at', { ascending: false })

    setEventModal({ ev, responses: responses || [], loading: false })
  }

  const maxAvg = ranking.length > 0 ? Math.max(...ranking.map(r => r.avg), 1) : 1

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-100">Ranking de Instructores</h2>
        <p className="text-text-200 text-sm mt-0.5">Media de valoraciones por instructor</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent-100 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : ranking.length === 0 ? (
        <div className="text-center py-20 text-primary-300">
          Todavía no hay valoraciones para este centro
        </div>
      ) : (
        <div className="space-y-3">
          {ranking.map(r => (
            <div
              key={r.trainerId}
              onClick={() => setTrainerModal(r)}
              className="bg-bg-200 border border-bg-300 rounded-xl p-4 cursor-pointer hover:border-primary-200 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text-100">{r.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-200 bg-primary-100 px-2 py-0.5 rounded-full">
                    {r.count} valoraciones
                  </span>
                  <span className="text-2xl font-bold text-text-100">{r.avg.toFixed(1)} ⭐</span>
                </div>
              </div>
              <div className="h-2 bg-primary-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-200 rounded-full transition-all duration-500"
                  style={{ width: `${(r.avg / maxAvg) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {trainerModal && (
        <div
          className="fixed inset-0 bg-text-100/40 z-50 flex items-center justify-center px-4"
          onClick={() => setTrainerModal(null)}
        >
          <div
            className="bg-bg-200 border border-bg-300 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-bg-300">
              <div>
                <h3 className="text-text-100 font-semibold">{trainerModal.name}</h3>
                <p className="text-xs text-text-200 mt-0.5">
                  Media general: {trainerModal.avg.toFixed(1)} ⭐ ({trainerModal.count} valoraciones)
                </p>
              </div>
              <button
                onClick={() => setTrainerModal(null)}
                className="text-text-200 hover:text-text-100 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {(eventsByTrainer[trainerModal.trainerId] || [])
                .sort((a, b) => b.avg - a.avg)
                .map(ev => (
                  <div
                    key={ev.eventId}
                    onClick={() => openEventModal(ev)}
                    className="border border-bg-300 rounded-xl p-3 cursor-pointer hover:border-primary-200 transition-colors flex items-center justify-between"
                  >
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
        <div
          className="fixed inset-0 bg-text-100/40 z-50 flex items-center justify-center px-4"
          onClick={() => setEventModal(null)}
        >
          <div
            className="bg-bg-200 border border-bg-300 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-bg-300">
              <h3 className="text-text-100 font-semibold">Valoraciones — {eventModal.ev.name}</h3>
              <button
                onClick={() => setEventModal(null)}
                className="text-text-200 hover:text-text-100 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {eventModal.loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 border-2 border-accent-100 border-t-transparent rounded-full animate-spin" />
                </div>
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