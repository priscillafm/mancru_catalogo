import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'

export default function Dashboard() {
  const membership  = useAuthStore(s => s.membership)
  const companyId   = membership?.company_id
  const userId      = membership?.user_id

  const { data: stats } = useQuery({
    queryKey: ['admin-stats', companyId],
    queryFn: async () => {
      const [products, brands, categories, syncs, catalogs, myCatalogs] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('deleted_at', null),
        supabase.from('brands').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('deleted_at', null),
        supabase.from('categories').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('deleted_at', null),
        supabase.from('sync_executions').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'completed'),
        supabase.from('catalogs').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('catalogs').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('created_by', userId),
      ])
      return {
        products:   products.count   ?? 0,
        brands:     brands.count     ?? 0,
        categories: categories.count ?? 0,
        syncs:      syncs.count      ?? 0,
        catalogs:   catalogs.count   ?? 0,
        myCatalogs: myCatalogs.count ?? 0,
      }
    },
    enabled: !!companyId,
  })

  const { data: recentCatalogs } = useQuery({
    queryKey: ['recent-catalogs', companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('catalogs')
        .select('id, name, created_at, users!catalogs_created_by_fkey(name, email)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(5)
      return data ?? []
    },
    enabled: !!companyId,
  })

  const topCards = [
    { label: 'Productos',    value: stats?.products   ?? '—', icon: '□' },
    { label: 'Marcas',       value: stats?.brands     ?? '—', icon: '◈' },
    { label: 'Categorías',   value: stats?.categories ?? '—', icon: '≡' },
    { label: 'Catálogos',    value: stats?.catalogs   ?? '—', icon: '⬡' },
  ]

  return (
    <div style={{ padding: 28, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Resumen</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {topCards.map(c => (
            <div key={c.label} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '16px 18px',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{c.label}</div>
              <div style={{ fontSize: 30, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{c.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* My activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Mis catálogos</div>
          <div style={{ fontSize: 30, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{stats?.myCatalogs ?? '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>catálogos generados por vos</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Sincronizaciones</div>
          <div style={{ fontSize: 30, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{stats?.syncs ?? '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>actualizaciones completadas</div>
        </div>
      </div>

      {/* Recent catalogs */}
      {recentCatalogs && recentCatalogs.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text2)' }}>Catálogos recientes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {recentCatalogs.map((c, i) => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: 'var(--surface)',
                borderTop: i > 0 ? '1px solid var(--border)' : 'none',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name ?? 'Sin nombre'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                    {c.users?.name ?? c.users?.email ?? 'Desconocido'}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {new Date(c.created_at).toLocaleDateString('es-UY', { day: '2-digit', month: 'short' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
