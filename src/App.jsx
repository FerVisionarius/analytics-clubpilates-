import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import LoginPage from './LoginPage'
import CentroLayout from './CentroLayout'
import Home from './Home'
import HeatmapOcupacion from './components/HeatmapOcupacion'
import Laserr from './components/Laserr'
import ComingSoon from './ComingSoon'
import ResetPassword from './ResetPassword'
import AdminUsuarios from './AdminUsuarios'

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
  const isPublicRoute = ['/login', '/reset-password', '/set-password'].includes(location.pathname)

  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=invite') || hash.includes('type=signup')) {
      window.location.replace('/set-password' + hash)
    }
  }, [])

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
        <Route path="instructores" element={<ComingSoon titulo="Ranking de Instructores" />} />
        <Route path="miembros" element={<ComingSoon titulo="Métricas de Miembros" />} />
        <Route path="retencion" element={<ComingSoon titulo="Retención y Churn" />} />
        <Route path="laserr" element={<LaserrPage />} />
        <Route path="usuarios" element={<AdminUsuariosPage />} />
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

function AdminUsuariosPage() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  useEffect(() => { if (!isAdmin) navigate('/') }, [isAdmin])
  if (!isAdmin) return null
  return <AdminUsuarios />
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