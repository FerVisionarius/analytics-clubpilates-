import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function Sugerencias({ branchId }) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])

  useEffect(() => {
    if (branchId) fetchData()
  }, [branchId])

  async function fetchData() {
    setLoading(true)

    // Respuestas de texto de la pregunta de sugerencias (no la nota).
    const { data: answers } = await supabase
      .from('class_survey_answers')
      .select('answer_text, class_survey_responses!inner(event_id, submitted_at, user_id)')
      .eq('answer_type', 'text')
      .ilike('question_key', '%sugerencias%')

    const all = (answers || [])
      .map(a => ({
        text: (a.answer_text || '').trim(),
        eventId: a.class_survey_responses?.event_id,
        submittedAt: a.class_survey_responses?.submitted_at,
        userId: a.class_survey_responses?.user_id,
      }))
      .filter(r => r.text !== '')

    // Solo las de clases de este centro.
    const eventIds = [...new Set(all.map(r => r.eventId).filter(Boolean))]
    const classMap = {}
    if (eventIds.length > 0) {
      const { data: classes } = await supabase
        .from('classes')
        .select('event_id, name')
        .eq('branch_id', branchId)
        .in('event_id', eventIds)
      ;(classes || []).forEach(c => { if (!classMap[c.event_id]) classMap[c.event_id] = c })
    }

    const branchRows = all.filter(r => classMap[r.eventId])

    // Datos de la persona.
    const userIds = [...new Set(branchRows.map(r => r.userId).filter(Boolean))]
    const memberMap = {}
    if (userIds.length > 0) {
      const { data: members } = await supabase
        .from('members')
        .select('glofox_member_id, name, email')
        .eq('branch_id', branchId)
        .in('glofox_member_id', userIds)
      ;(members || []).forEach(m => { memberMap[m.glofox_member_id] = m })
    }

    const list = branchRows
      .map(r => ({
        text: r.text,
        submittedAt: r.submittedAt,
        className: classMap[r.eventId]?.name || '—',
        name: memberMap[r.userId]?.name || '—',
        email: memberMap[r.userId]?.email || '—',
      }))
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))

    setRows(list)
    setLoading(false)
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-100">Sugerencias</h2>
        <p className="text-text-200 text-sm mt-0.5">Sugerencias aportadas por los socios en la encuesta de valoración</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent-100 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-20 text-primary-300">
          Todavía no hay sugerencias para este centro
        </div>
      ) : (
        <div className="space-y-3 max-w-3xl">
          {rows.map((r, i) => (
            <div key={i} className="bg-bg-200 border border-bg-300 rounded-xl p-4">
              <p className="text-sm text-text-100 whitespace-pre-wrap">{r.text}</p>
              <div className="flex items-center gap-2 flex-wrap mt-2 text-xs text-text-200">
                <span className="font-medium text-text-100">{r.name}</span>
                {r.email !== '—' && <span>· {r.email}</span>}
                <span>· {r.className}</span>
                <span>· {formatDateTime(r.submittedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
