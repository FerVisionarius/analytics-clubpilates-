import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { fetchAllRolePermissions, upsertRolePermission } from './lib/permissions'
import { NAV_ITEMS, ADVANCED_NAV_ITEMS, ADMIN_NAV_ITEMS, SUPERADMIN_NAV_ITEMS, EXTERNAL_TOOL_ITEMS } from './navConfig'

const ROLES = [
  { key: 'manager', label: 'Manager' },
  { key: 'admin', label: 'Admin' },
  { key: 'superadmin', label: 'Superadmin' },
]

const SECTIONS = [
  { label: 'Métricas', items: NAV_ITEMS },
  { label: 'Métricas Avanzadas', items: ADVANCED_NAV_ITEMS },
  { label: 'Administración', items: ADMIN_NAV_ITEMS },
  { label: 'Ajustes', items: SUPERADMIN_NAV_ITEMS },
  { label: 'Herramientas externas', items: EXTERNAL_TOOL_ITEMS },
]

export default function AjustesPermisos() {
  const [role, setRole] = useState('manager')
  const [permissions, setPermissions] = useState({ manager: {}, admin: {}, superadmin: {} })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const map = await fetchAllRolePermissions(supabase)
    setPermissions(map)
    setLoading(false)
  }

  function isEnabled(itemId) {
    return permissions[role]?.[itemId] !== false
  }

  async function toggle(itemId) {
    if (role === 'superadmin' && itemId === 'ajustes') return
    const newValue = !isEnabled(itemId)
    setSaving(itemId)
    await upsertRolePermission(supabase, role, itemId, newValue)
    setPermissions(prev => ({ ...prev, [role]: { ...prev[role], [itemId]: newValue } }))
    setSaving(null)
  }

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-6 h-6 border-2 border-accent-100 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div>
      <p className="text-sm text-text-200 mb-4">
        Elige qué paneles puede ver cada rol. Los cambios se guardan al instante.
      </p>

      <div className="flex gap-2 mb-6">
        {ROLES.map(r => (
          <button
            key={r.key}
            onClick={() => setRole(r.key)}
            className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors ${
              role === r.key ? 'bg-accent-200 text-white' : 'bg-primary-100 text-text-200 hover:bg-primary-200'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {SECTIONS.map(section => (
          <div key={section.label} className="bg-bg-200 border border-bg-300 rounded-xl overflow-hidden">
            <div className="px-6 py-3 border-b border-bg-300 bg-bg-100/50">
              <p className="text-sm font-semibold text-text-100">{section.label}</p>
            </div>
            <div className="divide-y divide-bg-300">
              {section.items.map(item => {
                const locked = role === 'superadmin' && item.id === 'ajustes'
                const enabled = isEnabled(item.id)
                return (
                  <div key={item.id} className="flex items-center justify-between px-6 py-3">
                    <div>
                      <span className="text-sm text-text-100">{item.label}</span>
                      {locked && (
                        <span className="text-xs text-primary-300 block mt-0.5">
                          No se puede desactivar (evitaría bloquear el acceso a este panel)
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => toggle(item.id)}
                      disabled={locked || saving === item.id}
                      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                        enabled ? 'bg-accent-200' : 'bg-primary-200'
                      } disabled:opacity-50 ${locked ? 'cursor-not-allowed' : ''}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          enabled ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
