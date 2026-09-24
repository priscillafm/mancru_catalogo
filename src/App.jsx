import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import LandingPage from '@/pages/Landing'
const LoginPage = lazy(() => import('@/pages/Login'))
const RegisterPage = lazy(() => import('@/pages/Register'))
const OnboardingPage = lazy(() => import('@/pages/Onboarding'))
const CatalogPage = lazy(() => import('@/pages/Catalog'))
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'))
const ResetPasswordPage = lazy(() => import('@/pages/ResetPassword'))
const ProfilePage = lazy(() => import('@/pages/Profile'))
const CatalogsPage = lazy(() => import('@/pages/Catalogs'))
const PublicCatalog = lazy(() => import('@/pages/PublicCatalog'))
const PricingPage = lazy(() => import('@/pages/Pricing'))
const CheckoutReturn = lazy(() => import('@/pages/CheckoutReturn'))
const TermsPage = lazy(() => import('@/pages/Terms'))
const PrivacyPage = lazy(() => import('@/pages/Privacy'))
const ContactPage = lazy(() => import('@/pages/Contact'))

function PrivateRoute({ children, requireAdmin = false }) {
  const { session, membership, loading } = useAuthStore()
  if (loading) return <Spinner />
  if (!session) return <Navigate to="/" replace />
  if (requireAdmin && !['super_admin','company_admin'].includes(membership?.role)) {
    return <Navigate to="/app" replace />
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
    <Suspense fallback={<Spinner />}>
    <Routes>
      <Route path="/"               element={<LandingPage />} />
      <Route path="/c/:id"          element={<PublicCatalog />} />
      <Route path="/login"          element={<LoginPage />} />
      <Route path="/register"       element={<RegisterPage />} />
      <Route path="/onboarding"     element={<PrivateRoute><OnboardingPage /></PrivateRoute>} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/profile"        element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
      <Route path="/catalogs"       element={<PrivateRoute><CatalogsPage /></PrivateRoute>} />
      <Route path="/app"            element={<PrivateRoute><CatalogPage /></PrivateRoute>} />
      <Route path="/pricing"        element={<PrivateRoute><PricingPage /></PrivateRoute>} />
      <Route path="/checkout/retorno" element={<PrivateRoute><CheckoutReturn /></PrivateRoute>} />
      <Route path="/terms"          element={<TermsPage />} />
      <Route path="/privacy"        element={<PrivacyPage />} />
      <Route path="/contacto"       element={<ContactPage />} />
      <Route path="/admin/*"        element={<PrivateRoute requireAdmin><AdminLayout /></PrivateRoute>} />
      <Route path="*"               element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}
