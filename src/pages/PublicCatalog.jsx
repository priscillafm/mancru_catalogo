import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PotatoMark } from '@/components/PotatoLogo'

export default function PublicCatalog() {
  const { id } = useParams()

  const { data: catalog, isLoading, error } = useQuery({
    queryKey: ['public-catalog', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('catalogs')
        .select('id, name, status, snapshot_data, catalog_products(product_snapshot), companies(name, logo_url, website)')
        .eq('id', id)
        .eq('status', 'shared')
        .is('deleted_at', null)
        .single()
      if (error || !data) throw new Error('Catálogo no encontrado')
      return data
    },
  })

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0C0A07' }}>
      <div style={{ color: '#E0B15B', fontFamily: 'system-ui', fontSize: 14 }}>Cargando catálogo...</div>
    </div>
  )

  if (error || !catalog) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0C0A07', gap: 12 }}>
      <div style={{ fontSize: 32, opacity: 0.3 }}>◻</div>
      <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Catálogo no disponible</div>
      <div style={{ color: '#888', fontSize: 13 }}>Este link puede haber vencido o no estar activo.</div>
    </div>
  )

  const snap = catalog.snapshot_data ?? {}
  const brandGroups = snap.brandGroups ?? []
  const company = catalog.companies
  const prices = snap.prices ?? {}

  return (
    <div style={{ minHeight: '100vh', background: '#F4EFE6', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#0C0A07', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          {company?.logo_url ? (
            <img src={company.logo_url} alt={company.name} style={{ height: 32, objectFit: 'contain' }} />
          ) : (
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{company?.name}</div>
          )}
        </div>
        <div style={{ color: '#888', fontSize: 12 }}>{company?.website}</div>
      </div>

      {/* Catalog title */}
      <div style={{ padding: '28px 24px 0' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1208', letterSpacing: '-0.5px', marginBottom: 4 }}>
          {catalog.name}
        </h1>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 28 }}>
          {brandGroups.reduce((n, g) => n + g.products.length, 0)} productos
        </p>
      </div>

      {/* Brand groups */}
      <div style={{ padding: '0 24px 48px' }}>
        {brandGroups.map(({ brand, products }) => (
          <div key={brand.id} style={{ marginBottom: 36 }}>
            {/* Brand header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
              padding: '10px 16px', borderRadius: 10,
              background: brand.color ?? '#6366f1',
            }}>
              {brand.logo_url ? (
                <img src={brand.logo_url} alt={brand.name} style={{ height: 24, objectFit: 'contain' }} />
              ) : (
                <span style={{ fontWeight: 700, fontSize: 14, color: brand.text_color ?? '#fff' }}>{brand.name}</span>
              )}
            </div>

            {/* Products grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
              gap: 12,
            }}>
              {products.map(p => {
                const price = prices[p.id]
                return (
                  <div key={p.id} style={{
                    background: '#fff', borderRadius: 12,
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  }}>
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name}
                        style={{ width: '100%', aspectRatio: '1', objectFit: 'contain', background: '#f8f8f8', display: 'block' }} />
                    ) : (
                      <div style={{ width: '100%', aspectRatio: '1', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 28 }}>◻</div>
                    )}
                    <div style={{ padding: '10px 12px 12px' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4, color: '#111', marginBottom: 7 }}>
                        {p.name}
                      </div>
                      <div style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: 999,
                        fontSize: 10, fontWeight: 700,
                        background: brand.color ?? '#6366f1',
                        color: brand.text_color ?? '#fff',
                      }}>
                        {p.sku}
                      </div>
                      {price && (
                        <div style={{ marginTop: 8, fontWeight: 700, fontSize: 14, color: '#111' }}>
                          {(snap.currency === 'USD' ? 'USD' : '$ UYU')} {price}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #E5DDD0', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' }}>
        <div style={{ fontSize: 12, color: '#888' }}>
          {company?.name} {company?.website && `· ${company.website}`}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#aaa', fontSize: 11 }}>
          <PotatoMark size={14} />
          <span>Hecho con Potato</span>
        </div>
      </div>
    </div>
  )
}
