import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fetchEventRatings, fetchEventResponses } from '../lib/ratings'

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

export default function Valoraciones({ branchId }) {
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState([])
  const [eventModal, setEventModal] = useState(null)

  useEffect(() => {
    if (branchId) fetchData()
  }, [branchId])

  async function fetchData() {
    setLoading(true)

    let staffQuery = supabase.from('staff').select('glofox_user_id, name')
    if (branchId) staffQuery = staffQuery.eq('branch_id', branchId)
    const { data: staff } = await staffQuery

    const staffMap = {}
    ;(staff || []).forEach(s => { staffMap[s.glofox_user_id] = s.name })

    const eventRatings = await fetchEventRatings(supabase, branchId)
    const classesList = eventRatings
      .map(ev => ({ ...ev, trainerName: staffMap[ev.trainerId] || 'Desconocido' }))
      .sort((a, b) => new Date(b.lastScheduledAt) - new Date(a.lastScheduledAt))

    setClasses(classesList)
    setLoading(false)
  }

  async function openEventModal(ev) {
    setEventModal({ ev, responses: [], loading: true })
    const responses = await fetchEventResponses(supabase, ev.eventId)
    setEventModal({ ev, responses, loading: false })
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-100">Valoraciones</h2>
        <p className="text-text-200 text-sm mt-0.5">Clases que recibieron valoraciones de socios</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent-100 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-20 text-primary-300">
          Todavía no hay valoraciones para este centro
        </div>
      ) : (
        <div className="space-y-3">
          {classes.map(c => (
            <div
              key={c.eventId}
              onClick={() => openEventModal(c)}
              className="bg-bg-200 border border-bg-300 rounded-xl p-4 cursor-pointer hover:border-primary-200 transition-colors flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium text-text-100">{c.name}</p>
                <p className="text-xs text-text-200 mt-0.5">
                  {c.trainerName} · Última sesión: {formatDateTime(c.lastScheduledAt)}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-text-200 bg-primary-100 px-2 py-0.5 rounded-full">
                  {c.count} valoraciones
                </span>
                <span className="text-2xl font-bold text-text-100">{c.avg.toFixed(1)} ⭐</span>
              </div>
            </div>
          ))}
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
