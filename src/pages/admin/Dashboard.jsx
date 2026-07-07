import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { usePlanLimits } from '@/hooks/usePlanLimits'

export default function Dashboard() {
  const membership = useAuthStore(s => s.membership)
  const companyId  = membership?.company_id
  const navigate   = useNavigate()
  const { usage, limits, pctProducts, plan } = usePlanLimits()

  // Stats + top catalogs + recent activity
  const { data: stats } = useQuery({
    queryKey: ['admin-stats', companyId],
    queryFn: async () => {
      const [products, brands, catalogs, sharedCatalogs] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('deleted_at', null),
        supabase.from('brands').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('deleted_at', null),
        supabase.from('catalogs').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('deleted_at', null),
        supabase.from('catalogs').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'shared').is('deleted_at', null),
      ])
      return {
        products:       products.count   ?? 0,
        brands:         brands.count     ?? 0,
        catalogs:       catalogs.count   ?? 0,
        sharedCatalogs: sharedCatalogs.count ?? 0,
      }
    },
    enabled: !!companyId,
  })

  // Top catalogs by views
  const { data: topCatalogs = [] } = useQuery({
    queryKey: ['top-catalogs', companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('catalogs')
        .select(`
          id, name, status, updated_at,
          users!catalogs_created_by_fkey(name, email),
          catalog_views(viewed_at),
          catalog_products(product_id)
        `)
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(10)
      if (!data) return []
      return data
        .map(c => ({
          ...c,
          viewCount: c.catalog_views?.length ?? 0,
          productCount: c.catalog_products?.length ?? 0,
          lastView: c.catalog_views?.length
            ? new Date(Math.max(...c.catalog_views.map(v => new Date(v.viewed_at))))
            : null,
        }))
        .sort((a, b) => b.viewCount - a.viewCount)
        .slice(0, 5)
    },
    enabled: !!companyId,
  })

  // Total views this month
  const { data: viewsThisMonth = 0 } = useQuery({
    queryKey: ['views-month', companyId],
    queryFn: async () => {
      const start = new Date()
      start.setDate(1); start.setHours(0, 0, 0, 0)
      const { data: cats } = await supabase
        .from('catalogs')
        .select('id')
        .eq('company_id', companyId)
        .is('deleted_at', null)
      if (!cats?.length) return 0
      const ids = cats.map(c => c.id)
      const { count } = await supabase
        .from('catalog_views')
        .select('id', { count: 'exact', head: true })
        .in('catalog_id', ids)
        .gte('viewed_at', start.toISOString())
      return count ?? 0
    },
    enabled: !!companyId,
  })

  const planColor = plan === 'enterprise' ? '#f59e0b' : plan === 'pro' ? '#6366f1' : 'var(--text3)'
  const productPct = limits.max_products ? Math.min(100, Math.round((usage.products / limits.max_products) * 100)) : 0

  return (
    <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1, maxWidth: 900 }}>

      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          Hola, {membership?.users?.name ?? membership?.companies?.name ?? 'bienvenido'} 👋
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>
          Acá tenés un resumen de la actividad de tu empresa.
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Productos" value={stats?.products ?? '—'} sub={limits.max_products ? `de ${limits.max_products} disponibles` : 'sin límite'} icon="📦" onClick={() => navigate('/admin/products')} />
        <StatCard label="Marcas" value={stats?.brands ?? '—'} icon="🏷" onClick={() => navigate('/admin/brands')} />
        <StatCard label="Catálogos" value={stats?.catalogs ?? '—'} sub={`${stats?.sharedCatalogs ?? 0} activos`} icon="📄" onClick={() => navigate('/catalogs')} />
        <StatCard label="Vistas este mes" value={viewsThisMonth} icon="👁" accent />
      </div>

      {/* Plan usage */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '16px 20px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Plan</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${planColor}20`, color: planColor, textTransform: 'capitalize' }}>
              {plan}
            </span>
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>Productos</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: productPct >= 90 ? '#ef4444' : 'var(--text2)' }}>
                {usage.products} / {limits.max_products ?? '∞'}
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                width: `${productPct}%`,
                background: productPct >= 90 ? '#ef4444' : productPct >= 70 ? '#f97316' : 'var(--accent)',
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
          <div style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>Catálogos activos</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>
                {usage.catalogs_active} / {limits.max_catalogs_active ?? '∞'}
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                width: `${limits.max_catalogs_active ? Math.min(100, Math.round((usage.catalogs_active / limits.max_catalogs_active) * 100)) : 0}%`,
                background: 'var(--accent)', transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        </div>
        {plan === 'free' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Más productos,<br />más catálogos</p>
            <button onClick={() => {}} style={{
              padding: '8px 16px', background: 'var(--accent)', color: 'var(--accent-text)',
              border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer',
            }}>
              Ver planes →
            </button>
          </div>
        )}
      </div>

      {/* Top catalogs by views */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Catálogos más vistos</h3>
          <button onClick={() => navigate('/catalogs')} style={linkBtn}>Ver todos →</button>
        </div>

        {topCatalogs.length === 0 ? (
          <EmptyCard icon="👁" message="Compartí un catálogo para ver estadísticas de visitas" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topCatalogs.map((cat, i) => (
              <div key={cat.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', width: 18, flexShrink: 0 }}>
                  #{i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {cat.name ?? 'Sin nombre'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                    {cat.productCount} producto{cat.productCount !== 1 ? 's' : ''}
                    {cat.lastView && ` · última vista ${timeAgo(cat.lastView)}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: cat.viewCount > 0 ? 'var(--accent)' : 'var(--text3)' }}>
                    {cat.viewCount}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>vista{cat.viewCount !== 1 ? 's' : ''}</div>
                </div>
                <StatusBadge status={cat.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Acciones rápidas</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <QuickAction icon="📄" label="Nuevo catálogo" onClick={() => navigate('/app')} primary />
          <QuickAction icon="📦" label="Ver productos"  onClick={() => navigate('/admin/products')} />
          <QuickAction icon="📥" label="Importar Excel" onClick={() => navigate('/admin/import')} />
          <QuickAction icon="👥" label="Usuarios"       onClick={() => navigate('/admin/users')} />
        </div>
      </div>

    </div>
  )
}

function StatCard({ label, value, sub, icon, accent, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '16px 18px', cursor: onClick ? 'pointer' : 'default',
      transition: 'border-color 0.15s, transform 0.15s',
    }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: accent ? 'var(--accent)' : 'var(--text)' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function QuickAction({ icon, label, onClick, primary }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 16px', borderRadius: 9, cursor: 'pointer',
      background: primary ? 'var(--accent)' : 'var(--surface)',
      color: primary ? 'var(--accent-text)' : 'var(--text2)',
      border: primary ? 'none' : '1px solid var(--border)',
      fontWeight: 600, fontSize: 13, transition: 'all 0.15s',
    }}
      onMouseEnter={e => { if (!primary) e.currentTarget.style.borderColor = 'var(--accent)' }}
      onMouseLeave={e => { if (!primary) e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      <span>{icon}</span> {label}
    </button>
  )
}

function StatusBadge({ status }) {
  const map = { shared: ['Activo', '#22c55e'], generated: ['Generado', '#3b82f6'], draft: ['Borrador', 'var(--text3)'] }
  const [label, color] = map[status] ?? map.draft
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${color}20`, color, flexShrink: 0 }}>
      {label}
    </span>
  )
}

function EmptyCard({ icon, message }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '2px dashed var(--border)',
      borderRadius: 12, padding: '28px 20px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>{icon}</div>
      <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>{message}</p>
    </div>
  )
}

function timeAgo(date) {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `hace ${days}d`
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

const linkBtn = {
  background: 'none', border: 'none', color: 'var(--accent)',
  fontSize: 12, cursor: 'pointer', fontWeight: 600, padding: 0,
}
