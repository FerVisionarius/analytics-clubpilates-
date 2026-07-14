import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { NAV_ITEMS, ADMIN_NAV_ITEMS, ADVANCED_NAV_ITEMS, SUPERADMIN_NAV_ITEMS } from './navConfig'

function HomeCard({ to, icon, label, desc, editMode, hidden, onToggleHide }) {
  const content = (
    <>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
        hidden ? 'bg-primary-100 text-primary-300' : 'bg-primary-100 text-accent-200 group-hover:bg-accent-200 group-hover:text-white'
      }`}>
        {icon}
      </div>
      <div>
        <p className={`font-semibold ${hidden ? 'text-text-200' : 'text-text-100'}`}>{label}</p>
        <p className="text-sm text-text-200 mt-0.5">{desc}</p>
      </div>
    </>
  )

  if (editMode) {
    return (
      <div className={`relative rounded-2xl p-6 flex flex-col gap-3 border ${
        hidden ? 'bg-bg-100 border-dashed border-bg-300 opacity-60' : 'bg-bg-200 border-bg-300'
      }`}>
        <button
          onClick={onToggleHide}
          title={hidden ? 'Mostrar en mi vista' : 'Ocultar de mi vista'}
          className={`absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-sm transition-colors ${
            hidden ? 'bg-accent-200 text-white hover:bg-accent-100' : 'bg-primary-100 text-text-200 hover:bg-red-100 hover:text-red-600'
          }`}
        >
          {hidden ? '+' : '✕'}
        </button>
        {content}
      </div>
    )
  }

  return (
    <Link
      to={to}
      className="group bg-bg-200 border border-bg-300 rounded-2xl p-6 flex flex-col gap-3 hover:border-accent-100 hover:shadow-md transition-all"
    >
      {content}
    </Link>
  )
}

function HomeSection({ title, items, base, editMode, hiddenNavItems, setNavItemHidden }) {
  const visible = editMode ? items : items.filter(item => !hiddenNavItems.includes(item.id))
  if (visible.length === 0) return null

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-primary-300 mb-3">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {visible.map(item => (
          <HomeCard
            key={item.id}
            to={`${base}/${item.id}`}
            icon={item.icon}
            label={item.label}
            desc={item.desc}
            editMode={editMode}
            hidden={hiddenNavItems.includes(item.id)}
            onToggleHide={() => setNavItemHidden(item.id, !hiddenNavItems.includes(item.id))}
          />
        ))}
      </div>
    </>
  )
}

export default function Home() {
  const { branchId } = useParams()
  const { isAdmin, profile, hiddenNavItems, setNavItemHidden } = useAuth()
  const base = `/centro/${branchId}`
  const [editMode, setEditMode] = useState(false)

  const visibleNavItems = NAV_ITEMS.filter(item => item.id !== 'miembros' || profile?.role !== 'manager')

  const sectionProps = { base, editMode, hiddenNavItems, setNavItemHidden }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-100">¿Qué quieres consultar?</h1>
          <p className="text-text-200 text-sm mt-1">
            {editMode ? 'Elegí qué tarjetas ocultar de tu vista. Los cambios se guardan al instante.' : 'Acceso directo a cada métrica del centro'}
          </p>
        </div>
        <button
          onClick={() => setEditMode(!editMode)}
          className={`shrink-0 text-sm font-medium px-4 py-1.5 rounded-lg transition-colors ${
            editMode ? 'bg-accent-200 text-white hover:bg-accent-100' : 'bg-primary-100 text-text-100 hover:bg-primary-200'
          }`}
        >
          {editMode ? 'Listo' : 'Personalizar vista'}
        </button>
      </div>

      <HomeSection title="Métricas" items={visibleNavItems} {...sectionProps} />

      {isAdmin && (
        <>
          <HomeSection title="Métricas Avanzadas" items={ADVANCED_NAV_ITEMS} {...sectionProps} />
          <HomeSection title="Administración" items={ADMIN_NAV_ITEMS} {...sectionProps} />
          <HomeSection title="Ajustes" items={SUPERADMIN_NAV_ITEMS} {...sectionProps} />
        </>
      )}
    </div>
  )
}