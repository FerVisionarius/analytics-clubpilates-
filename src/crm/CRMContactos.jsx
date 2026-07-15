import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  fetchContacts, upsertContact, deleteContact,
  fetchCustomFieldDefinitions, createCustomFieldDefinition,
  contactFullName,
} from '../lib/crm'

const EMPTY_CONTACT = { id: null, first_name: '', last_name: '', phone: '', email: '', custom_attributes: {} }
const EMPTY_FIELD = { key: '', label: '', field_type: 'text', options: '' }

function ContactModal({ contact, fields, onSave, onClose, saving }) {
  const [form, setForm] = useState(contact)

  function setCustomAttr(key, value) {
    setForm(f => ({ ...f, custom_attributes: { ...f.custom_attributes, [key]: value } }))
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <h3 className="text-white font-semibold">{contact.id ? 'Editar contacto' : 'Nuevo contacto'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="overflow-y-auto flex-1 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre</label>
              <input type="text" value={form.first_name || ''} onChange={e => setForm({ ...form, first_name: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Apellidos</label>
              <input type="text" value={form.last_name || ''} onChange={e => setForm({ ...form, last_name: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Teléfono</label>
            <input type="text" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="+34 600 000 000"
              className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
            <input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
          </div>

          {fields.length > 0 && (
            <div className="pt-2 border-t border-slate-700 space-y-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Atributos personalizados</p>
              {fields.map(f => (
                <div key={f.id}>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">{f.label}</label>
                  {f.field_type === 'list' ? (
                    <select
                      value={form.custom_attributes?.[f.key] || ''}
                      onChange={e => setCustomAttr(f.key, e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                    >
                      <option value="">—</option>
                      {(f.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.field_type === 'number' ? 'number' : 'text'}
                      value={form.custom_attributes?.[f.key] || ''}
                      onChange={e => setCustomAttr(f.key, e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-200 rounded-lg py-2 text-sm transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FieldsModal({ fields, onCreate, onClose, saving }) {
  const [form, setForm] = useState(EMPTY_FIELD)

  function submit(e) {
    e.preventDefault()
    onCreate({
      key: form.key.trim().toLowerCase().replace(/\s+/g, '_'),
      label: form.label.trim(),
      field_type: form.field_type,
      options: form.field_type === 'list' ? form.options.split(',').map(s => s.trim()).filter(Boolean) : null,
    })
    setForm(EMPTY_FIELD)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h3 className="text-white font-semibold">Campos personalizados</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
        </div>
        <div className="p-6 space-y-5">
          {fields.length > 0 && (
            <div className="space-y-1">
              {fields.map(f => (
                <div key={f.id} className="flex items-center justify-between text-sm text-slate-300 bg-slate-900 rounded-lg px-3 py-2">
                  <span>{f.label}</span>
                  <span className="text-xs text-slate-500 capitalize">{f.field_type}</span>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={submit} className="space-y-3 pt-2 border-t border-slate-700">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nuevo campo</p>
            <input type="text" required placeholder="Etiqueta (ej. Objetivo)" value={form.label}
              onChange={e => setForm({ ...form, label: e.target.value, key: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
            <select value={form.field_type} onChange={e => setForm({ ...form, field_type: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
              <option value="text">Texto</option>
              <option value="number">Número</option>
              <option value="list">Lista</option>
            </select>
            {form.field_type === 'list' && (
              <input type="text" placeholder="Opciones separadas por coma" value={form.options}
                onChange={e => setForm({ ...form, options: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
            )}
            <button type="submit" disabled={saving || !form.label}
              className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors">
              {saving ? 'Creando...' : 'Crear campo'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function CRMContactos() {
  const { branchId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [contacts, setContacts] = useState([])
  const [fields, setFields] = useState([])
  const [modalContact, setModalContact] = useState(null)
  const [showFields, setShowFields] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    if (branchId) fetchData()
  }, [branchId])

  async function fetchData() {
    setLoading(true)
    setError(null)
    const [contactsResult, fieldsResult] = await Promise.all([
      fetchContacts(supabase, branchId),
      fetchCustomFieldDefinitions(supabase),
    ])
    if (contactsResult.error) setError(contactsResult.error)
    else setContacts(contactsResult.contacts)
    setFields(fieldsResult.fields || [])
    setLoading(false)
  }

  async function handleSave(form) {
    setSaving(true)
    const { error: saveError } = await upsertContact(supabase, { ...form, branch_id: branchId })
    setSaving(false)
    if (!saveError) {
      setModalContact(null)
      fetchData()
    }
  }

  async function handleDelete(id) {
    setDeletingId(id)
    await deleteContact(supabase, id)
    setDeletingId(null)
    fetchData()
  }

  async function handleCreateField(field) {
    setSaving(true)
    await createCustomFieldDefinition(supabase, field)
    setSaving(false)
    fetchData()
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Contactos</h2>
          <p className="text-slate-400 text-sm mt-0.5">{contacts.length} contactos en este centro</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFields(true)}
            className="text-sm text-slate-300 hover:text-white border border-slate-600 hover:border-slate-500 rounded-lg px-3 py-1.5 transition-colors">
            Campos personalizados
          </button>
          <button onClick={() => setModalContact(EMPTY_CONTACT)}
            className="bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
            + Contacto
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="text-red-400 text-sm text-center py-12">{error}</p>
      ) : contacts.length === 0 ? (
        <div className="text-center py-20 text-slate-500">Todavía no hay contactos en este centro</div>
      ) : (
        <div className="space-y-2">
          {contacts.map(c => (
            <div key={c.id} className="bg-slate-800 border border-slate-700 rounded-xl px-5 py-3 flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center shrink-0 text-sm font-semibold text-teal-400">
                {contactFullName(c)[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{contactFullName(c)}</p>
                <p className="text-xs text-slate-400 truncate">{c.phone || '—'} {c.email ? `· ${c.email}` : ''}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => navigate(`/centro/${branchId}/crm/chat/${c.id}`)}
                  className="text-xs text-teal-400 hover:text-teal-300 border border-slate-600 hover:border-teal-600 rounded-lg px-3 py-1.5 transition-colors">
                  Chat
                </button>
                <button onClick={() => setModalContact(c)}
                  className="text-xs text-slate-300 hover:text-white border border-slate-600 hover:border-slate-500 rounded-lg px-3 py-1.5 transition-colors">
                  Editar
                </button>
                <button onClick={() => handleDelete(c.id)} disabled={deletingId === c.id}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-900 hover:border-red-700 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50">
                  {deletingId === c.id ? '...' : 'Eliminar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalContact && (
        <ContactModal
          contact={modalContact}
          fields={fields}
          saving={saving}
          onSave={handleSave}
          onClose={() => setModalContact(null)}
        />
      )}

      {showFields && (
        <FieldsModal
          fields={fields}
          saving={saving}
          onCreate={handleCreateField}
          onClose={() => setShowFields(false)}
        />
      )}
    </div>
  )
}
