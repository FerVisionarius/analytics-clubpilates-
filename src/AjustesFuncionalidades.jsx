import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'

export default function AjustesFuncionalidades({ readOnly = false }) {
  const [branches, setBranches] = useState([])
  const [flags, setFlags] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState('')

  const FEATURE_KEY = 'envio_encuesta_manual'

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)

    const { data: branchList } = await supabase
      .from('branches')
      .select('branch_id, name')
      .order('name')

    const { data: featureFlags } = await supabase
      .from('branch_features')
      .select('branch_id, enabled')
      .eq('feature_key', FEATURE_KEY)

    const flagsMap = {}
    ;(featureFlags || []).forEach(f => { flagsMap[f.branch_id] = f.enabled })

    setBranches(branchList || [])
    setFlags(flagsMap)
    setLoading(false)
  }

  async function toggleFlag(branchId, current) {
    if (readOnly) return
    setSaving(branchId)
    const newValue = !current

    await supabase
      .from('branch_features')
      .upsert(
        { branch_id: branchId, feature_key: FEATURE_KEY, enabled: newValue },
        { onConflict: 'branch_id,feature_key' }
      )

    setFlags(prev => ({ ...prev, [branchId]: newValue }))
    setSaving(null)
  }

  const activeCount = Object.values(flags).filter(Boolean).length
  const filteredBranches = branches.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <h2 className="text-xl font-bold text-text-100 mb-1">Funcionalidades</h2>
      <p className="text-text-200 text-sm mb-6">
        Activa o desactiva funciones por centro
        {readOnly && <span className="text-amber-600"> · Solo lectura</span>}
      </p>

      <div className="bg-bg-200 border border-bg-300 rounded-xl overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-6 py-3 border-b border-bg-300 bg-bg-100/50 hover:bg-bg-100 transition-colors"
        >
          <div className="text-left">
            <p className="text-sm font-semibold text-text-100">Envío de encuesta manual</p>
            <p className="text-xs text-text-200 mt-0.5">
              Permite mandar la encuesta de satisfacción manualmente desde el calendario de ocupación
              {!loading && ` · ${activeCount} de ${branches.length} centros activos`}
            </p>
          </div>
          <svg
            className={`w-5 h-5 text-primary-300 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expanded && (
          <>
            <div className="px-6 py-3 border-b border-bg-300">
              <input
                type="text"
                placeholder="Buscar centro..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white border border-primary-200 text-text-100 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent-100"
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-accent-100 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="divide-y divide-bg-300 max-h-96 overflow-y-auto">
                {filteredBranches.length === 0 ? (
                  <p className="text-sm text-text-200 text-center py-6">Sin resultados</p>
                ) : (
                  filteredBranches.map(b => (
                    <div key={b.branch_id} className="flex items-center justify-between px-6 py-3">
                      <span className="text-sm text-text-100">{b.name}</span>
                      <button
                        onClick={() => toggleFlag(b.branch_id, flags[b.branch_id])}
                        disabled={readOnly || saving === b.branch_id}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          flags[b.branch_id] ? 'bg-accent-200' : 'bg-primary-200'
                        } disabled:opacity-50 ${readOnly ? 'cursor-not-allowed' : ''}`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                            flags[b.branch_id] ? 'translate-x-5' : ''
                          }`}
                        />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}