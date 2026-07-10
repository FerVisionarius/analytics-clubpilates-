import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { useAuth } from './AuthContext'

const CENTROS = [
  { id: '60799c7835b8911c8545f043', name: 'Bonanova' },
  { id: '68d68a5cf7176270040f624a', name: 'Carabanchel' },
  { id: '61c07795f4492f7e61243062', name: 'Eixample' },
  { id: '66deaf61cd10d28f140f5581', name: 'Entenza' },
  { id: '6895fbb175b367c91101f96d', name: 'Goya' },
  { id: '648060a55dbb5018470ba2c7', name: 'Guindalera' },
  { id: '687a31ae3d5a8d28280c13b9', name: 'Imperial' },
  { id: '654a426970c402fc1b0e9785', name: 'Pacífico' },
  { id: '69008f1a0b1641b6a9017cac', name: 'Prosperidad' },
  { id: '67f7a344297706f6bd0ebb76', name: 'Sagrada Familia' },
  { id: '6583196c7e23ac73cf0547e4', name: 'Saint Gervasi' },
]

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-text-100/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-200 border border-bg-300 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-bg-300">
          <h3 className="font-semibold text-text-100">{title}</h3>
          <button onClick={onClose} className="text-text-200 hover:text-text-100 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function CentrosSelector({ selected, onChange }) {
  function toggle(id) {
    if (selected.includes(id)) onChange(selected.filter(x => x !== id))
    else onChange([...selected, id])
  }
  return (
    <div className="grid grid-cols-2 gap-2 mt-2">
      {CENTROS.map(c => (
        <label key={c.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
          selected.includes(c.id)
            ? 'border-accent-100 bg-primary-100 text-text-100'
            : 'border-primary-200 bg-white text-text-200 hover:border-accent-100'
        }`}>
          <input
            type="checkbox"
            checked={selected.includes(c.id)}
            onChange={() => toggle(c.id)}
            className="hidden"
          />
          <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
            selected.includes(c.id) ? 'bg-accent-200' : 'bg-primary-200'
          }`}>
            {selected.includes(c.id) && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
          <span className="text-sm truncate">{c.name}</span>
        </label>
      ))}
    </div>
  )
}


export default function AdminUsuarios() {
  const { isSuperAdmin } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // 'invite' | 'edit' | 'delete'
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  // Form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('manager')
  const [inviteBranches, setInviteBranches] = useState([])
  const [editRole, setEditRole] = useState('manager')
  const [editBranches, setEditBranches] = useState([])

  useEffect(() => { fetchUsuarios() }, [])

  async function fetchUsuarios() {
    setLoading(true)
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, role, branch_ids, status')
      .order('created_at', { ascending: false })
    if (!error) setUsuarios(data || [])
    setLoading(false)
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleInvite(e) {
    e.preventDefault()
    setSaving(true)
    try {
      // Obtener token de sesión actual para pasarlo a la edge function
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No hay sesión activa')

      const response = await fetch('https://kvcmjajatbvirespgcvs.supabase.co/functions/v1/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': 'sb_publishable_V0OSsUPhE-bhyhcY63FXKw_vMyQVXOr',
        },
        body: JSON.stringify({
          email: inviteEmail,
          full_name: inviteName,
          role: inviteRole,
          branch_ids: inviteRole === 'admin' ? [] : inviteBranches,
        })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error al invitar')
      showToast(`Invitación enviada a ${inviteEmail}`)
      setModal(null)
      setInviteEmail(''); setInviteName(''); setInviteRole('manager'); setInviteBranches([])
      fetchUsuarios()
    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    }
    setSaving(false)
  }

  async function handleEdit(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase
      .from('user_profiles')
      .update({
        role: editRole,
        branch_ids: editRole === 'admin' ? [] : editBranches,
      })
      .eq('id', selected.id)
    if (error) showToast('Error al guardar: ' + error.message, 'error')
    else {
      showToast('Usuario actualizado')
      setModal(null)
      fetchUsuarios()
    }
    setSaving(false)
  }

  async function handleDelete() {
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No hay sesión activa')

      const response = await fetch('https://kvcmjajatbvirespgcvs.supabase.co/functions/v1/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': 'sb_publishable_V0OSsUPhE-bhyhcY63FXKw_vMyQVXOr',
        },
        body: JSON.stringify({ userId: selected.id })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error al eliminar')
      showToast('Usuario eliminado')
      setModal(null)
      fetchUsuarios()
    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    }
    setSaving(false)
  }

  function openEdit(u) {
    setSelected(u)
    setEditRole(u.role)
    setEditBranches(u.branch_ids || [])
    setModal('edit')
  }

  function openDelete(u) {
    setSelected(u)
    setModal('delete')
  }

  function getCentroNames(ids) {
    if (!ids || ids.length === 0) return null
    return ids.map(id => CENTROS.find(c => c.id === id)?.name || id)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-text-100">Gestión de usuarios</h2>
          <p className="text-sm text-text-200 mt-0.5">{usuarios.length} usuarios registrados</p>
        </div>
        <button
          onClick={() => setModal('invite')}
          className="flex items-center gap-2 bg-accent-200 hover:bg-accent-100 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Invitar usuario
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-primary-300 text-sm">Cargando...</div>
      ) : (
        <div className="space-y-2">
          {usuarios.map(u => (
            <div key={u.id} className="bg-bg-200 border border-bg-300 rounded-xl px-5 py-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center shrink-0 text-sm font-semibold text-accent-200">
                {(u.full_name || u.email || '?')[0].toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-text-100 truncate">{u.full_name || '—'}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${
                    u.role === 'superadmin'
                      ? 'bg-purple-50 border-purple-200 text-purple-700'
                      : u.role === 'admin'
                        ? 'bg-primary-100 border-primary-200 text-accent-200'
                        : 'bg-white border-primary-200 text-text-200'
                  }`}>
                    {u.role === 'superadmin' ? 'SuperAdmin' : u.role === 'admin' ? 'Admin' : 'Manager'}
                  </span>
                  {u.status === 'pending' && (
                    <span className="text-xs px-2 py-0.5 rounded-full border shrink-0 bg-amber-50 border-amber-200 text-amber-700">
                      ⏳ Pendiente de aceptar
                    </span>
                  )}
                </div>
                <p className="text-xs text-primary-300 truncate mt-0.5">{u.email}</p>
                {u.role === 'manager' && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {getCentroNames(u.branch_ids)?.map(name => (
                      <span key={name} className="text-xs bg-primary-100 text-text-200 px-2 py-0.5 rounded-md">
                        {name}
                      </span>
                    )) || <span className="text-xs text-red-400">Sin centros asignados</span>}
                  </div>
                )}
                    {(u.role === 'admin' || u.role === 'superadmin') && (
                    <p className="text-xs text-primary-300 mt-1">Acceso a todos los centros</p>
                    )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openEdit(u)}
                  className="text-xs text-text-200 hover:text-text-100 border border-primary-200 hover:border-accent-100 rounded-lg px-3 py-1.5 transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => openDelete(u)}
                  className="text-xs text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg px-3 py-1.5 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Invitar */}
      {modal === 'invite' && (
        <Modal title="Invitar nuevo usuario" onClose={() => setModal(null)}>
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-200 mb-1.5">Nombre completo</label>
              <input
                type="text"
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                required
                placeholder="Nombre Manager"
                className="w-full bg-white border border-primary-200 text-text-100 rounded-lg px-3 py-2 text-sm placeholder-primary-200 focus:outline-none focus:border-accent-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-200 mb-1.5">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                required
                placeholder="manager@clubpilates.com"
                className="w-full bg-white border border-primary-200 text-text-100 rounded-lg px-3 py-2 text-sm placeholder-primary-200 focus:outline-none focus:border-accent-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-200 mb-1.5">Rol</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                className="w-full bg-white border border-primary-200 text-text-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-100"
              >
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
                {isSuperAdmin && <option value="superadmin">SuperAdmin</option>}
              </select>
            </div>
            {inviteRole === 'manager' && (
              <div>
                <label className="block text-sm font-medium text-text-200 mb-1.5">Centros asignados</label>
                <CentrosSelector selected={inviteBranches} onChange={setInviteBranches} />
                {inviteBranches.length === 0 && (
                  <p className="text-xs text-amber-400 mt-2">⚠ Selecciona al menos un centro</p>
                )}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setModal(null)}
                className="flex-1 bg-white hover:bg-primary-100 border border-primary-200 text-text-200 rounded-lg py-2 text-sm transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={saving || (inviteRole === 'manager' && inviteBranches.length === 0)}
                className="flex-1 bg-accent-200 hover:bg-accent-100 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors">
                {saving ? 'Enviando...' : 'Enviar invitación'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Editar */}
      {modal === 'edit' && selected && (
        <Modal title={`Editar: ${selected.full_name || selected.email}`} onClose={() => setModal(null)}>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-200 mb-1.5">Rol</label>
              <select
                value={editRole}
                onChange={e => setEditRole(e.target.value)}
                className="w-full bg-white border border-primary-200 text-text-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-100"
              >
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
                {isSuperAdmin && <option value="superadmin">SuperAdmin</option>}
              </select>
            </div>
            {editRole === 'manager' && (
              <div>
                <label className="block text-sm font-medium text-text-200 mb-1.5">Centros asignados</label>
                <CentrosSelector selected={editBranches} onChange={setEditBranches} />
                {editBranches.length === 0 && (
                  <p className="text-xs text-amber-400 mt-2">⚠ Selecciona al menos un centro</p>
                )}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setModal(null)}
                className="flex-1 bg-white hover:bg-primary-100 border border-primary-200 text-text-200 rounded-lg py-2 text-sm transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={saving || (editRole === 'manager' && editBranches.length === 0)}
                className="flex-1 bg-accent-200 hover:bg-accent-100 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors">
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Eliminar */}
      {modal === 'delete' && selected && (
        <Modal title="Eliminar usuario" onClose={() => setModal(null)}>
          <p className="text-text-200 text-sm mb-1">
            ¿Seguro que quieres eliminar a <span className="text-text-100 font-medium">{selected.full_name || selected.email}</span>?
          </p>
          <p className="text-primary-300 text-xs mb-5">
            Se eliminará su perfil y acceso. Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setModal(null)}
              className="flex-1 bg-white hover:bg-primary-100 border border-primary-200 text-text-200 rounded-lg py-2 text-sm transition-colors">
              Cancelar
            </button>
            <button onClick={handleDelete} disabled={saving}
              className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors">
              {saving ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-xl border ${
          toast.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}