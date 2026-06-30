import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'

export default function Dashboard() {
  const companyId = useAuthStore(s => s.membership?.company_id)

  const { data: stats } = useQuery({
    queryKey: ['admin-stats', companyId],
    queryFn: async () => {
      const [products, brands, categories, syncs] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('deleted_at', null),
        supabase.from('brands').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('deleted_at', null),
        supabase.from('categories').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('deleted_at', null),
        supabase.from('sync_executions').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'completed'),
      ])
      return {
        products: products.count ?? 0,
        brands:   brands.count ?? 0,
        categories: categories.count ?? 0,
        syncs:    syncs.count ?? 0,
      }
    },
    enabled: !!companyId,
  })

  const cards = [
    { label: 'Productos',    value: stats?.products   ?? '—' },
    { label: 'Marcas',       value: stats?.brands     ?? '—' },
    { label: 'Categorías',   value: stats?.categories ?? '—' },
    { label: 'Sincronizaciones', value: stats?.syncs ?? '—' },
  ]

  return (
    <div style={{ padding: 28, overflowY: 'auto', flex: 1 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Resumen</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
        {cards.map(c => (
          <div key={c.label} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 18,
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{c.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, fontFamily: 'monospace' }}>{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
