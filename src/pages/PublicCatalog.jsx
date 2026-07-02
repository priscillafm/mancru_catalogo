import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PotatoMark } from '@/components/PotatoLogo'

export default function PublicCatalog() {
  const { id } = useParams()
  const [quantities, setQuantities] = useState({})
  const [showModal, setShowModal]   = useState(false)
  const [clientName, setClientName] = useState('')

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
      console.log('[PublicCatalog] data:', data, 'error:', error)
      if (error || !data) throw new Error(error?.message ?? 'Catálogo no encontrado')
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
  const vendorWhatsapp = snap.vendorWhatsapp ?? null

  const allProducts = brandGroups.flatMap(g => g.products.map(p => ({ ...p, brand: g.brand })))
  const selectedItems = allProducts.filter(p => quantities[p.id] > 0)
  const totalSelected = selectedItems.reduce((n, p) => n + (quantities[p.id] || 0), 0)

  function setQty(id, val) {
    const n = Math.max(0, parseInt(val) || 0)
    setQuantities(prev => ({ ...prev, [id]: n }))
  }

  function buildOrderText() {
    const lines = selectedItems.map(p => {
      const qty      = quantities[p.id]
      const priceObj = prices[p.id]
      const amount   = typeof priceObj === 'object' ? priceObj?.amount   : priceObj
      const cur      = typeof priceObj === 'object' ? priceObj?.currency : (snap.currency === 'USD' ? 'USD' : '$')
      const priceStr = amount ? ` · ${cur} ${amount}` : ''
      return `• ${p.sku} — ${p.name} x${qty}${priceStr}`
    })
    const header = clientName.trim() ? `Pedido de: ${clientName.trim()}\nCatálogo: ${catalog.name}` : `Pedido — ${catalog.name}`
    return `${header}\n\n${lines.join('\n')}\n\nTotal: ${totalSelected} unidades`
  }

  function handleSendWhatsApp() {
    const text = encodeURIComponent(buildOrderText())
    const phone = vendorWhatsapp ? vendorWhatsapp.replace(/\D/g, '') : ''
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank')
  }

  function handleCopyOrder() {
    navigator.clipboard.writeText(buildOrderText())
    alert('Pedido copiado al portapapeles')
  }

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
                const priceObj = prices[p.id]
                const priceAmount   = typeof priceObj === 'object' ? priceObj?.amount   : priceObj
                const priceCurrency = typeof priceObj === 'object' ? priceObj?.currency : (snap.currency === 'USD' ? 'USD' : '$')
                const qty   = quantities[p.id] || 0
                const selected = qty > 0
                return (
                  <div key={p.id} style={{
                    background: '#fff', borderRadius: 12,
                    overflow: 'hidden',
                    boxShadow: selected ? `0 0 0 2px ${brand.color ?? '#6366f1'}` : '0 1px 3px rgba(0,0,0,0.08)',
                    transition: 'box-shadow 0.15s',
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
                      {priceAmount && (
                        <div style={{ marginTop: 8, fontWeight: 700, fontSize: 14, color: '#111' }}>
                          {priceCurrency} {priceAmount}
                        </div>
                      )}
                      {/* Quantity selector */}
                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button onClick={() => setQty(p.id, qty - 1)} style={qtyBtn(brand.color)}>−</button>
                        <input
                          type="number" min="0" value={qty || ''}
                          placeholder="0"
                          onChange={e => setQty(p.id, e.target.value)}
                          style={{ width: 44, textAlign: 'center', border: '1px solid #bbb', borderRadius: 6, padding: '4px 0', fontSize: 13, fontWeight: 700, outline: 'none', color: '#111', background: '#fff' }}
                        />
                        <button onClick={() => setQty(p.id, qty + 1)} style={qtyBtn(brand.color)}>+</button>
                      </div>
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

      {/* Floating order bar */}
      {totalSelected > 0 && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#1A1208', borderRadius: 14, padding: '12px 20px',
          display: 'flex', alignItems: 'center', gap: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          zIndex: 100, minWidth: 300,
        }}>
          <div style={{ flex: 1, color: '#fff', fontSize: 13, fontWeight: 600 }}>
            {selectedItems.length} producto{selectedItems.length !== 1 ? 's' : ''} · {totalSelected} unid.
          </div>
          <button onClick={() => setShowModal(true)} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            background: '#25D366', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 700,
          }}>
            Ver pedido →
          </button>
        </div>
      )}

      {/* Order modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          padding: '0 0 0 0',
        }} onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div style={{
            background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 560,
            padding: '24px 24px calc(40px + env(safe-area-inset-bottom, 16px))', maxHeight: '85vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>Tu pedido</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>✕</button>
            </div>

            {/* Product list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {selectedItems.map(p => {
                const priceObj = prices[p.id]
                const amount   = typeof priceObj === 'object' ? priceObj?.amount   : priceObj
                const cur      = typeof priceObj === 'object' ? priceObj?.currency : '$'
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f8f8f8', borderRadius: 10 }}>
                    {p.image_url && <img src={p.image_url} alt="" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 6, background: '#fff' }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111', lineHeight: 1.3 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{p.sku}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>x{quantities[p.id]}</div>
                      {amount && <div style={{ fontSize: 11, color: '#555' }}>{cur} {amount}</div>}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Name field */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Tu nombre (opcional)
              </label>
              <input
                type="text" placeholder="Ej: Juan García"
                value={clientName} onChange={e => setClientName(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: 10, fontSize: 14, outline: 'none', color: '#111', boxSizing: 'border-box' }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {vendorWhatsapp && (
                <button onClick={handleSendWhatsApp} style={{
                  padding: '13px', borderRadius: 12, border: 'none',
                  background: '#25D366', color: '#fff', fontSize: 15, cursor: 'pointer', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Enviar pedido por WhatsApp
                </button>
              )}
              <button onClick={handleCopyOrder} style={{
                padding: '11px', borderRadius: 12, border: '1px solid #ddd',
                background: '#fff', color: '#333', fontSize: 14, cursor: 'pointer', fontWeight: 600,
              }}>
                Copiar pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const qtyBtn = (color) => ({
  width: 26, height: 26, borderRadius: 6, border: `1px solid ${color ?? '#6366f1'}33`,
  background: `${color ?? '#6366f1'}11`, color: color ?? '#6366f1',
  fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
})
