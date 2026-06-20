import { useEffect, useState } from 'react'
import { useParams, useNavigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { supabase } from './lib/supabase'
import logo from './assets/logo-clubpilates.png'

const NAV_ITEMS = [
  { id: 'ocupacion', label: 'Ocupación', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )},
  { id: 'instructores', label: 'Instructores', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )},
  { id: 'miembros', label: 'Miembros', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )},
  { id: 'retencion', label: 'Retención', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  )},
  { id: 'laserr', label: 'Laserr', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )},
]

const ADMIN_NAV_ITEMS = [
  { id: 'usuarios', label: 'Usuarios', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )},
]

const PAGE_TITLES = Object.fromEntries(
  [...NAV_ITEMS, ...ADMIN_NAV_ITEMS].map(item => [item.id, item.label])
)

function buildDocumentTitle(clubName, pageLabel) {
  if (!clubName) return `Club Pilates - ${pageLabel}`
  const name = clubName.trim()
  if (/^club\s+pilates\b/i.test(name)) return `${name} - ${pageLabel}`
  return `Club Pilates ${name} - ${pageLabel}`
}

const navLinkClass = ({ isActive }) =>
  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
    isActive
      ? 'bg-primary-100 text-accent-200 font-medium'
      : 'text-text-200 hover:text-text-100 hover:bg-primary-100/60'
  }`

export default function CentroLayout() {
  const { branchId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, isAdmin, allowedBranchIds, signOut } = useAuth()
  const [branch, setBranch] = useState(null)
  const [allBranches, setAllBranches] = useState([])

  useEffect(() => {
    fetchBranches()
  }, [branchId])

  async function fetchBranches() {
    const { data } = await supabase
      .from('branches')
      .select('branch_id, name')
      .order('name')
    if (data) {
      setAllBranches(data)
      setBranch(data.find(b => b.branch_id === branchId) || null)
    }
  }

  useEffect(() => {
    if (!isAdmin && allowedBranchIds.length > 0 && !allowedBranchIds.includes(branchId)) {
      navigate(`/centro/${allowedBranchIds[0]}`)
    }
  }, [branchId, isAdmin, allowedBranchIds])

  useEffect(() => {
    const segment = location.pathname.split('/').filter(Boolean).pop()
    const pageLabel = PAGE_TITLES[segment]
    if (!pageLabel) return

    const clubName = branch?.name
      || allBranches.find(b => b.branch_id === branchId)?.name

    document.title = buildDocumentTitle(clubName, pageLabel)
  }, [location.pathname, branch, branchId, allBranches])

  const visibleBranches = isAdmin
    ? allBranches
    : allBranches.filter(b => allowedBranchIds.includes(b.branch_id))

  return (
    <div className="min-h-screen bg-bg-100 text-text-100 flex flex-col">
      <header className="border-b border-bg-300 bg-bg-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-25 flex items-center justify-between gap-4">
          <div className="flex items-center shrink-0">
            <img src={logo} alt="Club Pilates España" className="h-35 w-auto" />
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-xs">
            {visibleBranches.length >= 1 ? (
              <select
                value={branchId}
                onChange={e => navigate(`/centro/${e.target.value}`)}
                className="bg-white border border-primary-200 text-text-100 text-sm rounded-lg px-3 py-1.5 w-full focus:outline-none focus:border-accent-100"
              >
                {visibleBranches.map(b => (
                  <option key={b.branch_id} value={b.branch_id}>{b.name}</option>
                ))}
              </select>
            ) : (
              <span className="text-sm font-medium text-text-100">{branch?.name}</span>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isAdmin && (
              <span className="text-xs bg-primary-100 border border-primary-200 text-accent-200 px-2 py-0.5 rounded-full">Admin</span>
            )}
            <span className="text-xs text-text-200 hidden sm:block">{profile?.email}</span>
            <button
              onClick={signOut}
              className="text-xs text-text-200 hover:text-text-100 transition-colors px-2 py-1 rounded hover:bg-primary-100"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-7xl mx-auto w-full">
        <aside className="w-52 shrink-0 border-r border-bg-300 bg-bg-200 py-6 px-3 sticky top-30 h-[calc(100vh-3.5rem)] overflow-y-auto">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-300 px-3 mb-3">Métricas</p>
          <nav className="space-y-0.5">
            {NAV_ITEMS.map(item => (
              <NavLink key={item.id} to={`/centro/${branchId}/${item.id}`} className={navLinkClass}>
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>

          {isAdmin && (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary-300 px-3 mb-3">Administración</p>
              <nav className="space-y-0.5">
                {ADMIN_NAV_ITEMS.map(item => (
                  <NavLink key={item.id} to={`/centro/${branchId}/${item.id}`} className={navLinkClass}>
                    {item.icon}
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          )}
        </aside>

        <main className="flex-1 py-8 px-8 min-w-0 bg-bg-100">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
