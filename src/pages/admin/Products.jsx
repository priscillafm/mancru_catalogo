import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'

export default function Products() {
  const companyId = useAuthStore(s => s.membership?.company_id)
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(0)
  const PAGE_SIZE = 50

  const { data, isLoading } = useQuery({
    queryKey: ['admin-products', companyId, search, page],
    queryFn: async () => {
      let q = supabase
        .from('products')
        .select('id, sku, name, active, image_url, brands(name), categories(name)', { count: 'exact' })
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('name')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (search) q = q.ilike('name', `%${search}%`)

      const { data, count } = await q
      return { rows: data ?? [], total: count ?? 0 }
    },
    enabled: !!companyId,
  })

  const rows  = data?.rows  ?? []
  const total = data?.total ?? 0
  const pages = Math.ceil(total / PAGE_SIZE)

  return (
    <div style={{ padding: 28, overflowY: 'auto', flex: 1 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Productos</h2>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <input placeholder="Buscar producto..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            style={{ flex: 1, maxWidth: 320, padding: '7px 11px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, outline: 'none' }} />
          <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 'auto' }}>
            {total} productos
          </span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Img','SKU','Nombre','Marca','Categoría','Estado'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--text3)' }}>Cargando...</td></tr>
            ) : rows.map(p => (
              <tr key={p.id}>
                <td style={tdStyle}>
                  {p.image_url
                    ? <img src={p.image_url} alt="" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 4, background: 'var(--bg-panel)' }} onError={e => e.target.style.display='none'} />
                    : <span style={{ display: 'inline-flex', width: 36, height: 36, background: 'var(--surface-h)', borderRadius: 4, alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 16 }}>📷</span>
                  }
                </td>
                <td style={tdStyle}><code style={{ fontSize: 11, color: 'var(--accent)' }}>{p.sku}</code></td>
                <td style={tdStyle}>{p.name}</td>
                <td style={tdStyle}>{p.brands?.name ?? '—'}</td>
                <td style={tdStyle}>{p.categories?.name ?? '—'}</td>
                <td style={tdStyle}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                    background: p.active ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.1)',
                    color: p.active ? '#22c55e' : '#ef4444',
                  }}>
                    {p.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {pages > 1 && (
          <div style={{ padding: '12px 16px', display: 'flex', gap: 8, alignItems: 'center', borderTop: '1px solid var(--border)' }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={btnPage}>‹ Anterior</button>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Página {page + 1} de {pages}</span>
            <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} style={btnPage}>Siguiente ›</button>
          </div>
        )}
      </div>
    </div>
  )
}

const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }
const tdStyle = { padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, verticalAlign: 'middle' }
const btnPage = { padding: '5px 12px', background: 'var(--surface-h)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }
