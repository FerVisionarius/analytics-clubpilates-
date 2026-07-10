import { useEffect, useState } from 'react'
import { useParams, useNavigate, NavLink, Outlet, useLocation, Link } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { supabase } from './lib/supabase'
import logo from './assets/logo-clubpilates.png'
import { NAV_ITEMS, ADMIN_NAV_ITEMS, ADVANCED_NAV_ITEMS, SUPERADMIN_NAV_ITEMS, PAGE_TITLES, buildDocumentTitle } from './navConfig'

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
  const { profile, isAdmin, isSuperAdmin, allowedBranchIds, signOut } = useAuth()
  const [branch, setBranch] = useState(null)
  const [allBranches, setAllBranches] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const isHome = location.pathname.endsWith('/home')

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
      navigate(`/centro/${allowedBranchIds[0]}/home`)
    }
  }, [branchId, isAdmin, allowedBranchIds, navigate])

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

  function onBranchChange(newBranchId) {
    const segment = isHome ? 'home' : location.pathname.split('/').filter(Boolean).pop()
    navigate(`/centro/${newBranchId}/${segment}`)
  }

  return (
    <div className="min-h-screen bg-bg-100 text-text-100 flex flex-col">
      <header className="border-b border-bg-300 bg-bg-100 sticky top-0 z-30">
        <div className="w-full px-6 h-25 flex items-center justify-between gap-4">
          <Link to={`/centro/${branchId}/home`} className="flex items-center shrink-0">
            <img src={logo} alt="Club Pilates España" className="h-35 w-auto" />
          </Link>

          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <span className="text-sm text-text-200 shrink-0 hidden sm:inline">Centro:</span>
            {visibleBranches.length >= 1 ? (
              <select
                value={branchId}
                onChange={e => onBranchChange(e.target.value)}
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

      <div className="flex flex-1 w-full min-h-0 relative">
        {!isHome && (
          <aside
            className={`shrink-0 sticky top-25 self-start h-[calc(100vh-6.25rem)] overflow-hidden border-r border-bg-300 bg-bg-200 transition-[width,opacity] duration-500 ease-in-out ${
              sidebarOpen ? 'w-52 opacity-100' : 'w-0 opacity-0 border-r-0'
            }`}
          >
            <div className="w-52 h-full overflow-y-auto py-6 px-3">
              <div className="flex items-center justify-between px-3 mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary-300">Menú</p>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-primary-300 hover:text-text-100 p-1 rounded hover:bg-primary-100/60 transition-colors"
                  title="Ocultar menú"
                  aria-label="Ocultar menú"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>

              <nav className="space-y-0.5 mb-4">
                <NavLink to={`/centro/${branchId}/home`} className={navLinkClass}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Inicio
                </NavLink>
              </nav>

              <p className="text-xs font-semibold uppercase tracking-wider text-primary-300 px-3 mb-3">Métricas</p>
              <nav className="space-y-0.5">
                {NAV_ITEMS.map(item => (
                  <NavLink key={item.id} to={`/centro/${branchId}/${item.id}`} className={navLinkClass}>
                    {item.sidebarIcon}
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              {isAdmin && (
                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary-300 px-3 mb-3">Métricas Avanzadas</p>
                  <nav className="space-y-0.5">
                    {ADVANCED_NAV_ITEMS.map(item => (
                      <NavLink key={item.id} to={`/centro/${branchId}/${item.id}`} className={navLinkClass}>
                        {item.sidebarIcon}
                        {item.label}
                      </NavLink>
                    ))}
                  </nav>
                </div>
              )}

              {isAdmin && (
                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary-300 px-3 mb-3">Administración</p>
                  <nav className="space-y-0.5">
                    {ADMIN_NAV_ITEMS.map(item => (
                      <NavLink key={item.id} to={`/centro/${branchId}/${item.id}`} className={navLinkClass}>
                        {item.sidebarIcon}
                        {item.label}
                      </NavLink>
                    ))}
                  </nav>
                </div>
              )}

              {isSuperAdmin && (
                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary-300 px-3 mb-3">Ajustes</p>
                  <nav className="space-y-0.5">
                    {SUPERADMIN_NAV_ITEMS.map(item => (
                      <NavLink key={item.id} to={`/centro/${branchId}/${item.id}`} className={navLinkClass}>
                        {item.sidebarIcon}
                        {item.label}
                      </NavLink>
                    ))}
                  </nav>
                </div>
              )}
            </div>
          </aside>
        )}

        {!isHome && !sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="fixed left-0 top-1/2 -translate-y-1/2 z-20 bg-bg-200 border border-bg-300 border-l-0 rounded-r-lg px-1.5 py-3 text-primary-300 hover:text-accent-200 hover:bg-primary-100/60 transition-all duration-300 shadow-sm"
            title="Mostrar menú"
            aria-label="Mostrar menú"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        <main
          className={`flex-1 py-8 px-6 sm:px-8 min-w-0 bg-bg-100 transition-all duration-500 ease-in-out ${
            isHome || !sidebarOpen ? 'max-w-6xl mx-auto w-full' : ''
          }`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}