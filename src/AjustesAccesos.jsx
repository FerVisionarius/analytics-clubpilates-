import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'

// Herramientas cuyo acceso se gestiona usuario por usuario.
const TOOLS = [
  { id: 'desarrollo', label: 'Desarrollo', desc: 'Panel de pruebas de agentes de chat y Retell (developer.clubpilatesia.es)' },
]

export default function AjustesAccesos() {
  const [users, setUsers] = useState([])
  const [access, setAccess] = useState({}) // `${userId}:${toolId}` -> boolean
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [search, setSearch] = useState('')
  const [toolId, setToolId] = useState(TOOLS[0].id)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)

    const { data: userList } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, role')
      .order('full_name')

    const { data: accessRows } = await supabase
      .from('user_tool_access')
      .select('user_id, tool_id, enabled')

    const accessMap = {}
    ;(accessRows || []).forEach(r => { accessMap[`${r.user_id}:${r.tool_id}`] = r.enabled })

    setUsers(userList || [])
    setAccess(accessMap)
    setLoading(false)
  }

  async function toggle(userId, current) {
    setSaving(userId)
    const newValue = !current

    await supabase
      .from('user_tool_access')
      .upsert(
        { user_id: userId, tool_id: toolId, enabled: newValue },
        { onConflict: 'user_id,tool_id' }
      )

    setAccess(prev => ({ ...prev, [`${userId}:${toolId}`]: newValue }))
    setSaving(null)
  }

  const filteredUsers = users.filter(u =>
    (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  )

  const activeCount = users.filter(u => access[`${u.id}:${toolId}`] || u.role === 'superadmin').length

  return (
    <div>
      <h2 className="text-xl font-bold text-text-100 mb-1">Accesos por usuario</h2>
      <p className="text-text-200 text-sm mb-6">
        Concede acceso a herramientas usuario por usuario, además del control por rol. Los superadmin siempre tienen acceso.
      </p>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-text-200">Herramienta:</span>
        <select
          value={toolId}
          onChange={e => setToolId(e.target.value)}
          className="bg-white border border-primary-200 text-text-100 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent-100"
        >
          {TOOLS.map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        {!loading && <span className="text-xs text-text-200">{activeCount} de {users.length} con acceso</span>}
      </div>

      <p className="text-xs text-text-200 mb-4">{TOOLS.find(t => t.id === toolId)?.desc}</p>

      <div className="bg-bg-200 border border-bg-300 rounded-xl overflow-hidden">
        <div className="px-6 py-3 border-b border-bg-300">
          <input
            type="text"
            placeholder="Buscar usuario..."
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
          <div className="divide-y divide-bg-300 max-h-[28rem] overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <p className="text-sm text-text-200 text-center py-6">Sin resultados</p>
            ) : (
              filteredUsers.map(u => {
                const isSuper = u.role === 'superadmin'
                const enabled = isSuper || access[`${u.id}:${toolId}`] === true
                return (
                  <div key={u.id} className="flex items-center justify-between px-6 py-3">
                    <div>
                      <p className="text-sm text-text-100">{u.full_name || '—'}</p>
                      <p className="text-xs text-text-200">{u.email} · {u.role}</p>
                    </div>
                    {isSuper ? (
                      <span className="text-xs text-text-200 bg-primary-100 border border-primary-200 px-2 py-0.5 rounded-full">Siempre (superadmin)</span>
                    ) : (
                      <button
                        onClick={() => toggle(u.id, enabled)}
                        disabled={saving === u.id}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          enabled ? 'bg-accent-200' : 'bg-primary-200'
                        } disabled:opacity-50`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                            enabled ? 'translate-x-5' : ''
                          }`}
                        />
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
