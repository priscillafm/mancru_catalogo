import { NavLink, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { PotatoMark } from '@/components/PotatoLogo'
import {
  IconDashboard, IconBrands, IconProducts,
  IconSync, IconImport, IconUsers, IconSettings,
} from '@/components/NavIcons'
import Dashboard from './Dashboard'
import Brands from './Brands'
import Products from './Products'
import Sync from './Sync'
import Users from './Users'
import ImportIto from './ImportIto'
import Settings from './Settings'
import SuperAdmin from './SuperAdmin'

// line-only icons stay outline but get accent color + pill bg when active
const NAV = [
  { to: '',           label: 'Resumen',       Icon: IconDashboard, shapeFill: true },
  { to: 'brands',     label: 'Marcas',        Icon: IconBrands,    shapeFill: true },
  { to: 'products',   label: 'Productos',     Icon: IconProducts,  shapeFill: true },
  { to: 'sync',       label: 'Sincronizar',   Icon: IconSync,      shapeFill: false },
  { to: 'import-ito', label: 'Importar ito',  Icon: IconImport,    shapeFill: false },
  { to: 'users',      label: 'Usuarios',      Icon: IconUsers,     shapeFill: true },
  { to: 'settings',   label: 'Configuración', Icon: IconSettings,  shapeFill: false },
]

export default function AdminLayout() {
  const membership  = useAuthStore(s => s.membership)
  const company     = membership?.companies
  const isSuperAdmin = membership?.role === 'super_admin'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{
        width: 220, minWidth: 220,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Branding */}
        <div style={{ padding: '16px 16px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <PotatoMark size={22} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>Potato</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>
            Empresa
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>
            {company?.name ?? '—'}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {NAV.map(({ to, label, Icon, shapeFill }) => (
            <NavLink
              key={to}
              to={to === '' ? '/admin' : `/admin/${to}`}
              end={to === ''}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', textDecoration: 'none', borderRadius: 8,
                color: isActive ? 'var(--accent)' : 'var(--text2)',
                background: isActive ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                transition: 'all 0.15s',
              })}
            >
              {({ isActive }) => (
                <>
                  <Icon filled={isActive && shapeFill} size={17} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {isSuperAdmin && (
          <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)' }}>
            <NavLink
              to="/admin/super"
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', textDecoration: 'none', borderRadius: 8,
                color: isActive ? 'var(--accent)' : 'var(--text3)',
                background: isActive ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                fontSize: 12, fontWeight: 600,
              })}
            >
              🥔 Potato Admin
            </NavLink>
          </div>
        )}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <NavLink to="/" style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'none' }}>
            ← Volver al catálogo
          </NavLink>
        </div>
      </aside>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="brands"     element={<Brands />} />
          <Route path="products"   element={<Products />} />
          <Route path="sync"       element={<Sync />} />
          <Route path="import-ito" element={<ImportIto />} />
          <Route path="users"      element={<Users />} />
          <Route path="settings"   element={<Settings />} />
          {isSuperAdmin && <Route path="super" element={<SuperAdmin />} />}
          <Route path="*"          element={<Navigate to="/admin" replace />} />
        </Routes>
      </div>
    </div>
  )
}
