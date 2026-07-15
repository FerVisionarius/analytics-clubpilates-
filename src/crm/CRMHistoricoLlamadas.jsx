import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchCallsForBranch, fetchAgentsMap } from '../lib/crm'

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

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatCost(cents) {
  if (cents === null || cents === undefined) return '—'
  return `${(cents / 100).toFixed(2)} €`
}

function callSummary(call) {
  return call.raw_payload?.call_analysis?.call_summary || null
}

const DIRECTION_LABELS = { inbound: 'Entrante', outbound: 'Saliente' }

const EMPTY_AGENT_FORM = { agent_id: '', name: '', phone_number: '', description: '' }

export default function CRMHistoricoLlamadas() {
  const { branchId } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [calls, setCalls] = useState([])
  const [agents, setAgents] = useState({})
  const [callModal, setCallModal] = useState(null)
  const [showAgentForm, setShowAgentForm] = useState(false)
  const [agentForm, setAgentForm] = useState(EMPTY_AGENT_FORM)
  const [savingAgent, setSavingAgent] = useState(false)

  useEffect(() => {
    if (branchId) fetchData()
  }, [branchId])

  async function fetchData() {
    setLoading(true)
    setError(null)

    const [agentsMap, callsResult] = await Promise.all([
      fetchAgentsMap(supabase),
      fetchCallsForBranch(supabase, branchId),
    ])

    setAgents(agentsMap)
    if (callsResult.error) {
      setError(callsResult.error)
    } else {
      setCalls(callsResult.calls)
    }
    setLoading(false)
  }

  async function handleCreateAgent(e) {
    e.preventDefault()
    setSavingAgent(true)
    const { error: insertError } = await supabase
      .schema('crm')
      .from('retell_agents')
      .insert({
        agent_id: agentForm.agent_id,
        name: agentForm.name,
        phone_number: agentForm.phone_number || null,
        description: agentForm.description || null,
      })
    setSavingAgent(false)
    if (!insertError) {
      setShowAgentForm(false)
      setAgentForm(EMPTY_AGENT_FORM)
      fetchData()
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Histórico de llamadas</h2>
          <p className="text-slate-400 text-sm mt-0.5">Llamadas gestionadas por Retell en este centro</p>
        </div>
        <button
          onClick={() => setShowAgentForm(true)}
          className="bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
        >
          + Agente
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="text-red-400 text-sm text-center py-12">{error}</p>
      ) : calls.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          Todavía no hay llamadas registradas para este centro
        </div>
      ) : (
        <div className="space-y-3">
          {calls.map(call => (
            <div
              key={call.id}
              onClick={() => setCallModal(call)}
              className="bg-slate-800 border border-slate-700 rounded-xl p-4 cursor-pointer hover:border-teal-600 transition-colors"
            >
              <div className="flex items-center justify-between gap-3 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    call.direction === 'inbound' ? 'bg-teal-900 text-teal-300' : 'bg-amber-900 text-amber-300'
                  }`}>
                    {DIRECTION_LABELS[call.direction] || call.direction || '—'}
                  </span>
                  <span className="text-sm font-medium text-white truncate">
                    {agents[call.agent_id] || call.agent_id || 'Agente desconocido'}
                  </span>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{formatDateTime(call.started_at)}</span>
              </div>
              <p className="text-xs text-slate-400 truncate">
                {call.from_number || '—'} → {call.to_number || '—'}
              </p>
              {callSummary(call) && (
                <p className="text-sm text-slate-200 mt-2 line-clamp-2">{callSummary(call)}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                <span>⏱ {formatDuration(call.duration_seconds)}</span>
                <span>💶 {formatCost(call.cost_cents)}</span>
                {call.status && <span className="capitalize">{call.status}</span>}
                {call.recording_url && <span>🎧 Audio disponible</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {callModal && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4"
          onClick={() => setCallModal(null)}
        >
          <div
            className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <div>
                <h3 className="text-white font-semibold">{agents[callModal.agent_id] || callModal.agent_id}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(callModal.started_at)}</p>
              </div>
              <button onClick={() => setCallModal(null)} className="text-slate-400 hover:text-white text-lg leading-none">
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm text-slate-200">
                <div><span className="text-slate-400">De:</span> {callModal.from_number || '—'}</div>
                <div><span className="text-slate-400">A:</span> {callModal.to_number || '—'}</div>
                <div><span className="text-slate-400">Duración:</span> {formatDuration(callModal.duration_seconds)}</div>
                <div><span className="text-slate-400">Coste:</span> {formatCost(callModal.cost_cents)}</div>
                <div><span className="text-slate-400">Estado:</span> {callModal.status || '—'}</div>
                <div><span className="text-slate-400">Motivo fin:</span> {callModal.disconnection_reason || '—'}</div>
              </div>

              {callModal.recording_url && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Audio</p>
                  <audio controls src={callModal.recording_url} className="w-full" />
                </div>
              )}

              {callSummary(callModal) && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Resumen</p>
                  <p className="text-sm text-slate-200">{callSummary(callModal)}</p>
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

      {showAgentForm && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4"
          onClick={() => setShowAgentForm(false)}
        >
          <div
            className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h3 className="text-white font-semibold">Nuevo agente Retell</h3>
              <button onClick={() => setShowAgentForm(false)} className="text-slate-400 hover:text-white text-lg leading-none">
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateAgent} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Agent ID (Retell)</label>
                <input
                  type="text"
                  required
                  value={agentForm.agent_id}
                  onChange={e => setAgentForm({ ...agentForm, agent_id: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre</label>
                <input
                  type="text"
                  required
                  value={agentForm.name}
                  onChange={e => setAgentForm({ ...agentForm, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Teléfono</label>
                <input
                  type="text"
                  value={agentForm.phone_number}
                  onChange={e => setAgentForm({ ...agentForm, phone_number: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Descripción</label>
                <textarea
                  value={agentForm.description}
                  onChange={e => setAgentForm({ ...agentForm, description: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAgentForm(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-200 rounded-lg py-2 text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingAgent}
                  className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors"
                >
                  {savingAgent ? 'Guardando...' : 'Crear agente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
