import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { useNavigate } from 'react-router-dom'
import { signOut } from '@/lib/auth'
import PDFPreviewModal from '@/components/PDFPreviewModal'

export default function CatalogPage() {
  const membership = useAuthStore(s => s.membership)
  const companyId  = membership?.company_id
  const isAdmin    = ['super_admin','company_admin'].includes(membership?.role)
  const navigate   = useNavigate()

  const [activeBrandId, setActiveBrandId] = useState(null)
  const [activeCatId, setActiveCatId]     = useState(null)
  const [search, setSearch]               = useState('')
  const [selected, setSelected]           = useState([])
  const [showPDF, setShowPDF]             = useState(false)

  const { data: brands = [] } = useQuery({
    queryKey: ['brands', companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('brands')
        .select('id, name, color, text_color')
        .eq('company_id', companyId)
        .eq('active', true)
        .is('deleted_at', null)
        .order('sort_order')
      return data ?? []
    },
    enabled: !!companyId,
  })

  const { data: products = [] } = useQuery({
    queryKey: ['products', companyId, activeBrandId, activeCatId, search],
    queryFn: async () => {
      let q = supabase
        .from('products')
        .select('id, sku, name, description, image_url, category_id, categories(name)')
        .eq('company_id', companyId)
        .eq('active', true)
        .is('deleted_at', null)
      if (activeBrandId) q = q.eq('brand_id', activeBrandId)
      if (activeCatId)   q = q.eq('category_id', activeCatId)
      if (search)        q = q.ilike('name', `%${search}%`)
      const { data } = await q.order('name').limit(500)
      return data ?? []
    },
    enabled: !!companyId && !!activeBrandId,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories-for-brand', companyId, activeBrandId],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('category_id, categories(id, name)')
        .eq('company_id', companyId)
        .eq('brand_id', activeBrandId)
        .eq('active', true)
        .is('deleted_at', null)
        .not('category_id', 'is', null)
      const seen = new Set()
      return (data ?? [])
        .map(p => p.categories)
        .filter(c => c && !seen.has(c.id) && seen.add(c.id))
    },
    enabled: !!companyId && !!activeBrandId,
  })

  function toggleSelect(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const activeBrand = brands.find(b => b.id === activeBrandId)
  const selectedProducts = products.filter(p => selected.includes(p.id))

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Sidebar */}
      <aside style={{
        width: 250, minWidth: 250, background: 'var(--bg-bar)',
        borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: '0.1em', marginBottom: 4 }}>
            {membership?.companies?.name ?? '—'}
          </div>
          <h1 style={{ fontSize: 16, fontWeight: 700 }}>Catálogos</h1>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          {brands.map(brand => {
            const isActive = brand.id === activeBrandId
            return (
              <button key={brand.id}
                onClick={() => { setActiveBrandId(brand.id); setActiveCatId(null); setSelected([]) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 16px',
                  background: isActive ? 'var(--surface-h)' : 'transparent',
                  border: 'none', borderLeft: `3px solid ${isActive ? brand.color : 'transparent'}`,
                  color: isActive ? 'var(--text)' : 'var(--text2)',
                  cursor: 'pointer', textAlign: 'left',
                }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: brand.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{brand.name}</span>
              </button>
            )
          })}
        </nav>

        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
          {isAdmin && (
            <button onClick={() => navigate('/admin')} style={smallBtn}>Admin</button>
          )}
          <button onClick={() => signOut()} style={{ ...smallBtn, marginLeft: 'auto' }}>Salir</button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          height: 60, padding: '0 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-bar)'
        }}>
          {activeBrand && (
            <span style={{ fontSize: 15, fontWeight: 700, color: activeBrand.color }}>
              {activeBrand.name}
            </span>
          )}
          <input
            type="text" placeholder="Buscar producto..."
            value={search} onChange={e => setSearch(e.target.value)}
            disabled={!activeBrandId}
            style={{
              flex: 1, maxWidth: 300, padding: '7px 12px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none',
            }}
          />
          {categories.length > 0 && (
            <select value={activeCatId ?? ''}
              onChange={e => setActiveCatId(e.target.value || null)}
              style={{
                padding: '7px 10px', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 7,
                color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer',
              }}>
              <option value="">Todas las categorías</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {selected.length > 0 && (
            <>
              <button onClick={() => setSelected([])} style={smallBtn}>✕ Limpiar</button>
              <button onClick={() => setShowPDF(true)} style={{
                padding: '7px 16px', background: 'var(--accent)', color: 'var(--accent-text)',
                border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>
                Generar PDF ({selected.length})
              </button>
            </>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {!activeBrandId ? (
            <EmptyState icon="👈" message="Seleccioná una marca del panel izquierdo" />
          ) : products.length === 0 ? (
            <EmptyState icon="🔍" message="Sin resultados" />
          ) : (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14
            }}>
              {products.map(product => (
                <ProductCard key={product.id} product={product}
                  selected={selected.includes(product.id)}
                  brandColor={activeBrand?.color}
                  onClick={() => toggleSelect(product.id)} />
              ))}
            </div>
          )}
        </div>
      </main>

      {showPDF && (
        <PDFPreviewModal
          products={selectedProducts}
          brand={activeBrand}
          company={membership?.companies}
          onClose={() => setShowPDF(false)}
        />
      )}
    </div>
  )
}

function ProductCard({ product, selected, brandColor, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--surface)', border: `1px solid ${selected ? brandColor : 'var(--border)'}`,
      boxShadow: selected ? `0 0 0 1px ${brandColor}` : 'none',
      borderRadius: 13, cursor: 'pointer', overflow: 'hidden', position: 'relative',
      transition: 'border-color 0.15s, transform 0.15s',
    }}>
      {selected && (
        <div style={{
          position: 'absolute', top: 7, left: 7, width: 20, height: 20,
          borderRadius: '50%', background: brandColor, display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800,
        }}>✓</div>
      )}
      {product.image_url ? (
        <img src={product.image_url} alt=""
          style={{ width: '100%', aspectRatio: '1', objectFit: 'contain', background: 'var(--bg-panel)', display: 'block' }}
          onError={e => { e.target.style.display = 'none' }} />
      ) : (
        <div style={{ width: '100%', aspectRatio: '1', background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 28 }}>
          📷
        </div>
      )}
      <div style={{ padding: '10px 11px 11px' }}>
        {product.categories?.name && (
          <span style={{
            display: 'inline-block', padding: '2px 7px', borderRadius: 10,
            fontSize: 10, fontWeight: 600, marginBottom: 5,
            background: 'var(--surface-h)', color: 'var(--text2)',
          }}>
            {product.categories.name}
          </span>
        )}
        <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.35, marginBottom: 3, color: 'var(--text)' }}>
          {product.name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'monospace', fontWeight: 500 }}>
          {product.sku}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ icon, message }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ textAlign: 'center', color: 'var(--text3)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
        <p>{message}</p>
      </div>
    </div>
  )
}

const smallBtn = {
  padding: '7px 12px', background: 'var(--surface)',
  border: '1px solid var(--border)', color: 'var(--text2)',
  borderRadius: 7, fontSize: 12, cursor: 'pointer',
}
