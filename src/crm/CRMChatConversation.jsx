import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchContacts, fetchCallsForBranch, fetchAgentsMap, callsForContact, contactFullName } from '../lib/crm'

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' })
}

function formatDay(iso) {
  return new Date(iso).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: 'long', year: 'numeric' })
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function CallBubble({ call, agentName, onOpen }) {
  const fromUs = call.direction === 'outbound'
  const summary = call.raw_payload?.call_analysis?.call_summary

  return (
    <div className={`flex ${fromUs ? 'justify-end' : 'justify-start'}`}>
      <button
        onClick={() => onOpen(call)}
        className={`max-w-[75%] text-left rounded-2xl px-4 py-3 ${
          fromUs ? 'bg-teal-700 text-white rounded-br-sm' : 'bg-slate-700 text-slate-100 rounded-bl-sm'
        }`}
      >
        <div className="flex items-center gap-2 text-xs opacity-80 mb-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          {fromUs ? `Llamada de ${agentName || 'agente'}` : 'Llamada del contacto'} · {formatDuration(call.duration_seconds)}
        </div>
        {summary ? (
          <p className="text-sm line-clamp-3">{summary}</p>
        ) : (
          <p className="text-sm italic opacity-70">Sin resumen todavía</p>
        )}
        <p className="text-[11px] opacity-60 mt-1 text-right">{formatTime(call.started_at)}</p>
      </button>
    </div>
  )
}

export default function CRMChatConversation() {
  const { branchId, contactId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [contact, setContact] = useState(null)
  const [calls, setCalls] = useState([])
  const [agents, setAgents] = useState({})
  const [callModal, setCallModal] = useState(null)

  useEffect(() => {
    if (branchId && contactId) fetchData()
  }, [branchId, contactId])

  async function fetchData() {
    setLoading(true)
    const [contactsResult, callsResult, agentsMap] = await Promise.all([
      fetchContacts(supabase, branchId),
      fetchCallsForBranch(supabase, branchId),
      fetchAgentsMap(supabase),
    ])

    const foundContact = (contactsResult.contacts || []).find(c => c.id === contactId) || null
    setContact(foundContact)
    setAgents(agentsMap)
    setCalls(foundContact ? callsForContact(callsResult.calls || [], foundContact).slice().reverse() : [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="text-center py-20 text-slate-500">
        Contacto no encontrado.{' '}
        <Link to={`/centro/${branchId}/crm/chat`} className="text-teal-400 hover:underline">Volver al chat</Link>
      </div>
    )
  }

  let lastDay = null

  return (
    <div className="max-w-2xl mx-auto h-full flex flex-col">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700 shrink-0">
        <button onClick={() => navigate(`/centro/${branchId}/crm/chat`)} className="text-slate-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center shrink-0 text-sm font-semibold text-teal-400">
          {contactFullName(contact)[0]?.toUpperCase() || '?'}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{contactFullName(contact)}</p>
          <p className="text-xs text-slate-400 truncate">{contact.phone || '—'}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-3">
        {calls.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-12">Todavía no hay llamadas con este contacto</p>
        ) : (
          calls.map(call => {
            const day = formatDay(call.started_at)
            const showDaySeparator = day !== lastDay
            lastDay = day
            return (
              <div key={call.id}>
                {showDaySeparator && (
                  <div className="flex justify-center my-4">
                    <span className="text-xs text-slate-500 bg-slate-800 px-3 py-1 rounded-full">{day}</span>
                  </div>
                )}
                <CallBubble call={call} agentName={agents[call.agent_id]} onOpen={setCallModal} />
              </div>
            )
          })
        )}
      </div>

      <div className="px-6 py-4 border-t border-slate-700 shrink-0">
        <input
          disabled
          placeholder="Los mensajes de Chatwoot aparecerán aquí próximamente"
          className="w-full bg-slate-800 border border-slate-700 text-slate-500 rounded-lg px-4 py-2.5 text-sm cursor-not-allowed"
        />
      </div>

      {callModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onClick={() => setCallModal(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <div>
                <h3 className="text-white font-semibold">{agents[callModal.agent_id] || callModal.agent_id}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{formatDay(callModal.started_at)} · {formatTime(callModal.started_at)}</p>
              </div>
              <button onClick={() => setCallModal(null)} className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              {callModal.recording_url && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Audio</p>
                  <audio controls src={callModal.recording_url} className="w-full" />
                </div>
              )}
              {callModal.raw_payload?.call_analysis?.call_summary && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Resumen</p>
                  <p className="text-sm text-slate-200">{callModal.raw_payload.call_analysis.call_summary}</p>
                </div>
              )}
              {callModal.transcript && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Transcripción</p>
                  <p className="text-sm text-slate-200 whitespace-pre-wrap">{callModal.transcript}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
