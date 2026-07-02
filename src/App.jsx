import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import LoginPage from '@/pages/Login'
import CatalogPage from '@/pages/Catalog'
import AdminLayout from '@/pages/admin/AdminLayout'
import ResetPasswordPage from '@/pages/ResetPassword'
import ProfilePage from '@/pages/Profile'
import CatalogsPage from '@/pages/Catalogs'
import PublicCatalog from '@/pages/PublicCatalog'

function PrivateRoute({ children, requireAdmin = false }) {
  const { session, membership, loading } = useAuthStore()
  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace />
  if (requireAdmin && !['super_admin','company_admin'].includes(membership?.role)) {
    return <Navigate to="/" replace />
  }
  return children
}

function Spinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ color:'var(--text3)', fontFamily:'monospace' }}>Cargando...</div>
    </div>
  )
}

export default function App() {
  const init = useAuthStore(s => s.init)
  useEffect(() => { init() }, [init])

  return (
    <Routes>
      <Route path="/c/:id"           element={<PublicCatalog />} />
      <Route path="/login"          element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/profile"        element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
      <Route path="/catalogs"       element={<PrivateRoute><CatalogsPage /></PrivateRoute>} />
      <Route path="/" element={
        <PrivateRoute><CatalogPage /></PrivateRoute>
      } />
      <Route path="/admin/*" element={
        <PrivateRoute requireAdmin><AdminLayout /></PrivateRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
