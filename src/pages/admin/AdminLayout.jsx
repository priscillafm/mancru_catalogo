import { NavLink, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import Dashboard from './Dashboard'
import Brands from './Brands'
import Products from './Products'
import Sync from './Sync'
import Users from './Users'
import ImportIto from './ImportIto'
import Settings from './Settings'

const NAV = [
  { to: '', label: 'Resumen',       icon: '📊' },
  { to: 'brands', label: 'Marcas',  icon: '🏷️' },
  { to: 'products', label: 'Productos', icon: '📦' },
  { to: 'sync', label: 'Sincronizar', icon: '🔄' },
  { to: 'import-ito', label: 'Importar ito', icon: '⬇️' },
  { to: 'users', label: 'Usuarios', icon: '👥' },
  { to: 'settings', label: 'Configuración', icon: '⚙️' },
]

export default function AdminLayout() {
  const membership = useAuthStore(s => s.membership)
  const company    = membership?.companies

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{
        width: 220, minWidth: 220, background: 'var(--bg-bar)',
        borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.1em', marginBottom: 3, textTransform: 'uppercase' }}>
            Panel Admin
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            {company?.name ?? '—'}
          </div>
        </div>

        <nav style={{ flex: 1, padding: '10px 0' }}>
          {NAV.map(({ to, label, icon }) => (
            <NavLink key={to} to={to === '' ? '/admin' : `/admin/${to}`} end={to === ''}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 16px', textDecoration: 'none',
                color: isActive ? 'var(--accent)' : 'var(--text2)',
                borderLeft: `3px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                background: isActive ? 'rgba(212,255,63,0.06)' : 'transparent',
                fontSize: 13, transition: 'all 0.15s',
              })}>
              <span>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
          <NavLink to="/" style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'none' }}>
            ← Volver al catálogo
          </NavLink>
        </div>
      </aside>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="brands"   element={<Brands />} />
          <Route path="products" element={<Products />} />
          <Route path="sync"       element={<Sync />} />
          <Route path="import-ito" element={<ImportIto />} />
          <Route path="users"      element={<Users />} />
          <Route path="settings"   element={<Settings />} />
          <Route path="*"        element={<Navigate to="/admin" replace />} />
        </Routes>
      </div>
    </div>
  )
}
