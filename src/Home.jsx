import { Link, useParams } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { NAV_ITEMS, ADMIN_NAV_ITEMS, ADVANCED_NAV_ITEMS } from './navConfig'

function HomeCard({ to, icon, label, desc }) {
  return (
    <Link
      to={to}
      className="group bg-bg-200 border border-bg-300 rounded-2xl p-6 flex flex-col gap-3 hover:border-accent-100 hover:shadow-md transition-all"
    >
      <div className="w-12 h-12 rounded-xl bg-primary-100 text-accent-200 flex items-center justify-center group-hover:bg-accent-200 group-hover:text-white transition-colors">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-text-100">{label}</p>
        <p className="text-sm text-text-200 mt-0.5">{desc}</p>
      </div>
    </Link>
  )
}

export default function Home() {
  const { branchId } = useParams()
  const { isAdmin } = useAuth()
  const base = `/centro/${branchId}`

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-100">¿Qué quieres consultar?</h1>
        <p className="text-text-200 text-sm mt-1">Acceso directo a cada métrica del centro</p>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wider text-primary-300 mb-3">Métricas</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {NAV_ITEMS.map(item => (
          <HomeCard
            key={item.id}
            to={`${base}/${item.id}`}
            icon={item.icon}
            label={item.label}
            desc={item.desc}
          />
        ))}
      </div>

      {isAdmin && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-300 mb-3">Métricas Avanzadas</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {ADVANCED_NAV_ITEMS.map(item => (
              <HomeCard
                key={item.id}
                to={`${base}/${item.id}`}
                icon={item.icon}
                label={item.label}
                desc={item.desc}
              />
            ))}
          </div>

          <p className="text-xs font-semibold uppercase tracking-wider text-primary-300 mb-3">Administración</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ADMIN_NAV_ITEMS.map(item => (
              <HomeCard
                key={item.id}
                to={`${base}/${item.id}`}
                icon={item.icon}
                label={item.label}
                desc={item.desc}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
