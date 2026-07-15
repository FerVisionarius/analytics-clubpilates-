import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchContacts, fetchCallsForBranch, callsForContact, contactFullName } from '../lib/crm'

function formatRelative(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit' })
}

function callPreview(call) {
  const summary = call.raw_payload?.call_analysis?.call_summary
  if (summary) return summary
  return call.direction === 'inbound' ? '📞 Llamada entrante' : '📞 Llamada saliente'
}

export default function CRMChat() {
  const { branchId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [conversations, setConversations] = useState([])

  useEffect(() => {
    if (branchId) fetchData()
  }, [branchId])

  async function fetchData() {
    setLoading(true)
    const [contactsResult, callsResult] = await Promise.all([
      fetchContacts(supabase, branchId),
      fetchCallsForBranch(supabase, branchId),
    ])

    const contacts = contactsResult.contacts || []
    const calls = callsResult.calls || []

    const rows = contacts.map(contact => {
      const contactCalls = callsForContact(calls, contact)
      const lastCall = contactCalls[0] || null
      return { contact, lastCall, callCount: contactCalls.length }
    })

    rows.sort((a, b) => {
      const ta = a.lastCall?.started_at ? new Date(a.lastCall.started_at).getTime() : 0
      const tb = b.lastCall?.started_at ? new Date(b.lastCall.started_at).getTime() : 0
      return tb - ta
    })

    setConversations(rows)
    setLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">Chat</h2>
        <p className="text-slate-400 text-sm mt-0.5">Una conversación por contacto, con sus llamadas</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-20 text-slate-500">Todavía no hay contactos en este centro</div>
      ) : (
        <div className="space-y-1">
          {conversations.map(({ contact, lastCall, callCount }) => (
            <div
              key={contact.id}
              onClick={() => navigate(`/centro/${branchId}/crm/chat/${contact.id}`)}
              className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer hover:bg-slate-800 transition-colors"
            >
              <div className="w-11 h-11 rounded-full bg-slate-700 flex items-center justify-center shrink-0 text-sm font-semibold text-teal-400">
                {contactFullName(contact)[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white truncate">{contactFullName(contact)}</p>
                  {lastCall && <span className="text-xs text-slate-500 shrink-0">{formatRelative(lastCall.started_at)}</span>}
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  {lastCall ? callPreview(lastCall) : 'Sin llamadas todavía'}
                </p>
              </div>
              {callCount > 0 && (
                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full shrink-0">{callCount}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
