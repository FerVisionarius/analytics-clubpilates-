import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import LoginPage from './LoginPage'
import CentroLayout from './CentroLayout'
import Home from './Home'
import HeatmapOcupacion from './components/HeatmapOcupacion'
import Laserr from './components/Laserr'
import OcupacionPromedio from './components/OcupacionPromedio'
import ComingSoon from './ComingSoon'
import ResetPassword from './ResetPassword'
import ForgotPassword from './ForgotPassword'
import AdminUsuarios from './AdminUsuarios'
import EstadisticasSocios from './components/EstadisticasSocios'
import Instructores from './components/Instructores'
import Valoraciones from './components/Valoraciones'
import Ajustes from './Ajustes'
import Informes from './Informes'

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-24 px-4">
      <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center mb-2">
        <svg className="w-6 h-6 text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <p className="text-text-100 font-medium">Tu perfil no tiene los permisos necesarios para acceder a esta herramienta.</p>
    </div>
  )
}

function SociosPage() {
  const { branchId } = useParams()
  const { allowedNavItemIds } = useAuth()
  if (!allowedNavItemIds.includes('miembros')) return <AccessDenied />
  return <EstadisticasSocios branchId={branchId} />
}

function AjustesPage() {
  const { isSuperAdmin, allowedNavItemIds } = useAuth()
  if (!allowedNavItemIds.includes('ajustes')) return <AccessDenied />
  return <Ajustes readOnly={!isSuperAdmin} />
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-bg-100 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-accent-100 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RootRedirect() {
  const { isAdmin, allowedBranchIds, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (isAdmin || allowedBranchIds.length > 0) {
      const firstBranch = allowedBranchIds[0]
      if (firstBranch) navigate(`/centro/${firstBranch}/home`, { replace: true })
    }
  }, [loading, isAdmin, allowedBranchIds])

  return (
    <div className="min-h-screen bg-bg-100 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-accent-100 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function AdminRootRedirect() {
  const { isAdmin, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (isAdmin) {
      import('./lib/supabase').then(({ supabase }) => {
        supabase.from('branches').select('branch_id').order('name').limit(1)
          .then(({ data }) => {
            if (data?.[0]) navigate(`/centro/${data[0].branch_id}/home`, { replace: true })
          })
      })
    }
  }, [loading, isAdmin])

  return (
    <div className="min-h-screen bg-bg-100 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-accent-100 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function AppRoutes() {
  const { user, loading, isAdmin, allowedBranchIds } = useAuth()
  const location = useLocation()
  const isPublicRoute = ['/login', '/forgot-password', '/reset-password', '/set-password'].includes(location.pathname)

  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=invite') || hash.includes('type=signup')) {
      window.location.replace('/set-password' + hash)
    } else if (hash.includes('type=recovery') && location.pathname !== '/reset-password') {
      window.location.replace('/reset-password' + hash)
    }
    const code = new URLSearchParams(window.location.search).get('code')
    if (code && location.pathname !== '/reset-password' && location.pathname !== '/set-password') {
      window.location.replace('/reset-password' + window.location.search)
    }
  }, [location.pathname])

  if (loading && !isPublicRoute) {
    return (
      <div className="min-h-screen bg-bg-100 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent-100 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/set-password" element={<ResetPassword isInvite />} />

      <Route path="/" element={
        <ProtectedRoute>
          {isAdmin ? <AdminRootRedirect /> : <RootRedirect />}
        </ProtectedRoute>
      } />

      <Route path="/centro/:branchId" element={
        <ProtectedRoute><CentroLayout /></ProtectedRoute>
      }>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<Home />} />
        <Route path="ocupacion" element={<OcupacionPage />} />
        <Route path="instructores" element={<InstructoresPage />} />
        <Route path="valoraciones" element={<ValoracionesPage />} />
        <Route path="miembros" element={<SociosPage />} />
        <Route path="retencion" element={<ComingSoon titulo="Retención y Churn" />} />
        <Route path="laserr" element={<LaserrPage />} />
        <Route path="ocupacion-promedio" element={<OcupacionPromedioPage />} />
        <Route path="usuarios" element={<AdminUsuariosPage />} />
        <Route path="informes" element={<InformesPage />} />
        <Route path="ajustes" element={<AjustesPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function OcupacionPage() {
  const { branchId } = useParams()
  return (
    <div>
      <h2 className="text-xl font-bold text-text-100 mb-6">Ocupación de clases</h2>
      <HeatmapOcupacion branchId={branchId} />
    </div>
  )
}

function LaserrPage() {
  const { branchId } = useParams()
  return <Laserr branchId={branchId} />
}

function InstructoresPage() {
  const { branchId } = useParams()
  return <Instructores branchId={branchId} />
}

function ValoracionesPage() {
  const { branchId } = useParams()
  return <Valoraciones branchId={branchId} />
}

function OcupacionPromedioPage() {
  const { branchId } = useParams()
  const { allowedNavItemIds } = useAuth()
  if (!allowedNavItemIds.includes('ocupacion-promedio')) return <AccessDenied />
  return <OcupacionPromedio branchId={branchId} />
}

function AdminUsuariosPage() {
  const { allowedNavItemIds } = useAuth()
  if (!allowedNavItemIds.includes('usuarios')) return <AccessDenied />
  return <AdminUsuarios />
}

function InformesPage() {
  const { allowedNavItemIds } = useAuth()
  if (!allowedNavItemIds.includes('informes')) return <AccessDenied />
  return <Informes />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}