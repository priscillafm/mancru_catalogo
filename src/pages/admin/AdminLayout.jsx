import { useState, useEffect } from 'react'
import { NavLink, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
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

const NAV = [
  { to: '',           label: 'Resumen',       Icon: IconDashboard, shapeFill: true },
  { to: 'brands',     label: 'Marcas',        Icon: IconBrands,    shapeFill: true },
  { to: 'products',   label: 'Productos',     Icon: IconProducts,  shapeFill: true },
  { to: 'sync',       label: 'Sincronizar',   Icon: IconSync,      shapeFill: false },
  { to: 'import-ito', label: 'Importar',      Icon: IconImport,    shapeFill: false },
  { to: 'users',      label: 'Usuarios',      Icon: IconUsers,     shapeFill: true },
  { to: 'settings',   label: 'Config',        Icon: IconSettings,  shapeFill: false },
]

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mobile
}

export default function AdminLayout() {
  const membership   = useAuthStore(s => s.membership)
  const company      = membership?.companies
  const isSuperAdmin = membership?.role === 'super_admin'
  const isMobile     = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()

  // Close drawer on route change on mobile
  function handleNav() { if (isMobile) setDrawerOpen(false) }

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>

        {/* Mobile top bar */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px',
          height: 52, borderBottom: '1px solid var(--border)',
          background: 'var(--surface)', flexShrink: 0,
        }}>
          <button onClick={() => setDrawerOpen(true)} style={iconBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1 }}>
            <PotatoMark size={18} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Admin</span>
            <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 4 }}>· {company?.name ?? '—'}</span>
          </div>
          <button onClick={() => navigate('/')} style={{ ...iconBtn, fontSize: 12, padding: '6px 10px', gap: 4 }}>
            ← Catálogo
          </button>
        </header>

        {/* Drawer overlay */}
        {drawerOpen && (
          <div onClick={() => setDrawerOpen(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 40,
          }} />
        )}

        {/* Drawer */}
        <aside style={{
          position: 'fixed', top: 0, left: 0, height: '100%', width: 260,
          background: 'var(--surface)', borderRight: '1px solid var(--border)',
          zIndex: 50, display: 'flex', flexDirection: 'column',
          transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
        }}>
          <div style={{ padding: '16px 16px 14px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <PotatoMark size={22} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Potato Admin</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{company?.name ?? '—'}</div>
          </div>
          <nav style={{ flex: 1, padding: '8px 10px', overflowY: 'auto' }}>
            {NAV.map(({ to, label, Icon, shapeFill }) => (
              <NavLink key={to}
                to={to === '' ? '/admin' : `/admin/${to}`}
                end={to === ''}
                onClick={handleNav}
                style={({ isActive }) => navLinkStyle(isActive)}
              >
                {({ isActive }) => (
                  <><Icon filled={isActive && shapeFill} size={17} /><span>{label}</span></>
                )}
              </NavLink>
            ))}
            {isSuperAdmin && (
              <NavLink to="/admin/super" onClick={handleNav}
                style={({ isActive }) => ({ ...navLinkStyle(isActive), marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 14 })}>
                {() => <><span>🥔</span><span>Potato Admin</span></>}
              </NavLink>
            )}
          </nav>
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <button onClick={() => { navigate('/'); setDrawerOpen(false) }}
              style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              ← Volver al catálogo
            </button>
          </div>
        </aside>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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

  // Desktop layout (unchanged)
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{
        width: 220, minWidth: 220,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}>
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

        <nav style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {NAV.map(({ to, label, Icon, shapeFill }) => (
            <NavLink key={to}
              to={to === '' ? '/admin' : `/admin/${to}`}
              end={to === ''}
              style={({ isActive }) => navLinkStyle(isActive)}
            >
              {({ isActive }) => (
                <><Icon filled={isActive && shapeFill} size={17} /><span>{label}</span></>
              )}
            </NavLink>
          ))}
        </nav>

        {isSuperAdmin && (
          <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)' }}>
            <NavLink to="/admin/super"
              style={({ isActive }) => ({
                ...navLinkStyle(isActive),
                color: isActive ? 'var(--accent)' : 'var(--text3)',
              })}>
              {() => <><span>🥔</span><span>Potato Admin</span></>}
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

const navLinkStyle = (isActive) => ({
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '9px 10px', textDecoration: 'none', borderRadius: 8,
  color: isActive ? 'var(--accent)' : 'var(--text2)',
  background: isActive ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
  fontSize: 13, fontWeight: isActive ? 600 : 400,
  transition: 'all 0.15s',
})

const iconBtn = {
  display: 'flex', alignItems: 'center', padding: '6px',
  background: 'var(--surface-h)', border: '1px solid var(--border)',
  borderRadius: 7, color: 'var(--text2)', cursor: 'pointer', flexShrink: 0,
}
