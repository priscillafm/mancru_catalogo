import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { useNavigate } from 'react-router-dom'
import { signOut } from '@/lib/auth'
import PDFPreviewModal from '@/components/PDFPreviewModal'
import { PotatoMark } from '@/components/PotatoLogo'

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mobile
}

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') ?? 'dark')
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])
  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  return { theme, toggle }
}

export default function CatalogPage() {
  const membership = useAuthStore(s => s.membership)
  const companyId  = membership?.company_id
  const isAdmin    = ['super_admin','company_admin'].includes(membership?.role)
  const navigate   = useNavigate()
  const { theme, toggle: toggleTheme } = useTheme()

  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const [activeBrandId, setActiveBrandId] = useState(null)
  const [activeCatId, setActiveCatId]     = useState(null)
  const [search, setSearch]               = useState('')
  const [selectedMap, setSelectedMap]     = useState({})
  const [showPDF, setShowPDF]             = useState(false)

  const { data: brands = [], isLoading: brandsLoading } = useQuery({
    queryKey: ['brands', companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('brands')
        .select('id, name, color, text_color, logo_url')
        .eq('company_id', companyId)
        .eq('active', true)
        .is('deleted_at', null)
        .order('sort_order')
      return data ?? []
    },
    enabled: !!companyId,
  })

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products', companyId, activeBrandId, activeCatId, search],
    queryFn: async () => {
      let q = supabase
        .from('products')
        .select('id, sku, name, description, image_url, category_id, brand_id, categories(name)')
        .eq('company_id', companyId)
        .eq('active', true)
        .is('deleted_at', null)
      if (activeBrandId) q = q.eq('brand_id', activeBrandId)
      if (activeCatId)   q = q.eq('category_id', activeCatId)
      if (search)        q = q.ilike('name', `%${search}%`)
      const { data } = await q.order('category_id', { nullsFirst: false }).order('name').limit(500)
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
      return (data ?? []).map(p => p.categories).filter(c => c && !seen.has(c.id) && seen.add(c.id))
    },
    enabled: !!companyId && !!activeBrandId,
  })

  function toggleSelect(product) {
    setSelectedMap(prev => {
      const next = { ...prev }
      if (next[product.id]) delete next[product.id]
      else next[product.id] = product
      return next
    })
  }

  function selectAll() {
    setSelectedMap(prev => { const n = {...prev}; products.forEach(p => n[p.id]=p); return n })
  }
  function deselectAll() {
    setSelectedMap(prev => { const n = {...prev}; products.forEach(p => delete n[p.id]); return n })
  }
  function clearAll() { setSelectedMap({}) }

  const activeBrand   = brands.find(b => b.id === activeBrandId)
  const totalSelected = Object.keys(selectedMap).length
  const allSelected   = products.length > 0 && products.every(p => selectedMap[p.id])

  function buildBrandGroups() {
    return brands
      .map(brand => ({ brand, products: Object.values(selectedMap).filter(p => p.brand_id === brand.id) }))
      .filter(g => g.products.length > 0)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 19,
        }} />
      )}

      {/* ── Sidebar ── */}
      <aside className="glass" style={{
        width: 248, minWidth: 248,
        display: 'flex', flexDirection: 'column',
        position: isMobile ? 'fixed' : 'relative',
        top: 0, left: 0, height: '100%',
        zIndex: isMobile ? 20 : 10,
        transform: isMobile && !sidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
        transition: 'transform 0.25s ease',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 16px 14px', borderBottom: '1px solid var(--border)' }}>
          {/* Potato branding */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <PotatoMark size={20} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>Potato</span>
            </div>
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 9px', borderRadius: 20,
                background: 'var(--surface-h)', border: '1px solid var(--border)',
                color: 'var(--text3)', fontSize: 11, cursor: 'pointer',
                letterSpacing: '0.02em', fontWeight: 500,
              }}
            >
              {theme === 'dark' ? '☀ Claro' : '☾ Oscuro'}
            </button>
          </div>
          {/* Company + page title */}
          <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>
            {membership?.companies?.name ?? '—'}
          </div>
          <h1 style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px' }}>Catálogos</h1>
        </div>

        {/* Brand list */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
          {brandsLoading ? (
            [1,2,3].map(i => (
              <div key={i} className="skeleton" style={{ height: 38, margin: '3px 10px', borderRadius: 8 }} />
            ))
          ) : brands.map(brand => {
            const isActive = brand.id === activeBrandId
            const count = Object.values(selectedMap).filter(p => p.brand_id === brand.id).length
            return (
              <button key={brand.id} className={`brand-btn ${isActive ? 'active' : ''}`}
                style={{ borderLeftColor: isActive ? brand.color : 'transparent' }}
                onClick={() => { setActiveBrandId(brand.id); setActiveCatId(null); setSearch(''); if (isMobile) setSidebarOpen(false) }}>
                <span style={{
                  width: 9, height: 9, borderRadius: '50%',
                  background: brand.color, flexShrink: 0,
                  boxShadow: isActive ? `0 0 8px ${brand.color}88` : 'none',
                  transition: 'box-shadow 0.2s',
                }} />
                <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, flex: 1 }}>{brand.name}</span>
                {count > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999,
                    background: brand.color, color: '#000', flexShrink: 0,
                    animation: 'popIn 0.2s ease',
                  }}>{count}</span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{
          padding: '10px 12px', borderTop: '1px solid var(--border)',
          display: 'flex', gap: 6, alignItems: 'center',
        }}>
          <button onClick={() => navigate('/catalogs')} style={sideBtn} title="Mis catálogos guardados">📄</button>
          {isAdmin && (
            <button onClick={() => navigate('/admin')} style={sideBtn}>Admin</button>
          )}
          <button onClick={() => navigate('/profile')} style={{ ...sideBtn, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }} title="Mi perfil">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            Perfil
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Toolbar */}
        <div style={{
          minHeight: 58, padding: '0 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--bg-bar)',
          backdropFilter: 'blur(20px)',
          flexWrap: 'wrap', rowGap: 8, paddingTop: 8, paddingBottom: 8,
        }}>
          {isMobile && (
            <button onClick={() => setSidebarOpen(true)} style={{ ...toolBtn, padding: '7px 10px', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
          )}

          {activeBrand && (
            <span style={{
              fontSize: 14, fontWeight: 700, color: activeBrand.color,
              letterSpacing: '-0.3px', flexShrink: 0,
            }}>
              {activeBrand.name}
            </span>
          )}

          <div style={{ position: 'relative', flex: 1, maxWidth: 260 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 13 }}>⌕</span>
            <input
              type="text" placeholder="Buscar producto..."
              value={search} onChange={e => setSearch(e.target.value)}
              disabled={!activeBrandId}
              style={{
                width: '100%', padding: '7px 12px 7px 28px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none',
              }}
            />
          </div>

          {categories.length > 0 && (
            <select value={activeCatId ?? ''} onChange={e => setActiveCatId(e.target.value || null)}
              style={{
                padding: '7px 10px', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 8,
                color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer',
              }}>
              <option value="">Todas las categorías</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}

          {activeBrandId && products.length > 0 && (
            <button onClick={allSelected ? deselectAll : selectAll} style={toolBtn}>
              {allSelected ? 'Deseleccionar todos' : `Seleccionar todos (${products.length})`}
            </button>
          )}

          {totalSelected > 0 && (
            <button onClick={clearAll} style={toolBtn}>✕ Limpiar</button>
          )}
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 80px' }}>
          {!activeBrandId ? (
            <CatalogInstructions />
          ) : productsLoading ? (
            <SkeletonGrid />
          ) : products.length === 0 ? (
            <EmptyState icon="○" message="Sin resultados" sub="Probá con otro término o categoría" />
          ) : (
            <ProductGrid products={products} selectedMap={selectedMap} brandColor={activeBrand?.color} onToggle={toggleSelect} />
          )}
        </div>
      </main>

      {/* ── Floating PDF pill ── */}
      <button
        className={`pdf-pill ${totalSelected > 0 ? 'visible' : ''}`}
        onClick={() => totalSelected > 0 && setShowPDF(true)}
      >
        ↓ Generar PDF
        <span className="pill-count">{totalSelected}</span>
      </button>

      {showPDF && (
        <PDFPreviewModal
          brandGroups={buildBrandGroups()}
          company={membership?.companies}
          onClose={() => setShowPDF(false)}
          onSaved={() => setShowPDF(false)}
        />
      )}
    </div>
  )
}

function ProductGrid({ products, selectedMap, brandColor, onToggle }) {
  const groups = []
  let lastCatId = undefined
  for (const p of products) {
    if (p.category_id !== lastCatId) {
      groups.push({ catName: p.categories?.name ?? null, items: [] })
      lastCatId = p.category_id
    }
    groups[groups.length - 1].items.push(p)
  }

  return (
    <div className="fade-up">
      {groups.map((g, gi) => (
        <div key={gi} style={{ marginBottom: 28 }}>
          {g.catName && <div className="cat-divider">{g.catName}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 12 }}>
            {g.items.map(product => (
              <ProductCard key={product.id} product={product}
                selected={!!selectedMap[product.id]}
                brandColor={brandColor}
                onClick={() => onToggle(product)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ProductCard({ product, selected, brandColor, onClick }) {
  return (
    <div onClick={onClick} className={`product-card ${selected ? 'selected' : ''}`}>
      {selected && (
        <div className="check-badge" style={{ background: brandColor }}>✓</div>
      )}
      {product.image_url ? (
        <img src={product.image_url} alt=""
          style={{ width: '100%', aspectRatio: '1', objectFit: 'contain', background: 'var(--bg-panel)', display: 'block', transition: 'transform 0.2s' }}
          onError={e => { e.target.style.display = 'none' }} />
      ) : (
        <div style={{ width: '100%', aspectRatio: '1', background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 26 }}>
          ◻
        </div>
      )}
      <div style={{ padding: '10px 11px 12px' }}>
        {product.categories?.name && (
          <span style={{
            display: 'inline-block', padding: '2px 7px', borderRadius: 999,
            fontSize: 9, fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em',
            background: 'var(--surface-h)', color: 'var(--text3)', textTransform: 'uppercase',
          }}>
            {product.categories.name}
          </span>
        )}
        <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4, marginBottom: 8, color: 'var(--text)' }}>
          {product.name}
        </div>
        <div style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: 999,
          fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
          background: brandColor ?? 'var(--accent)', color: '#fff',
        }}>
          {product.sku}
        </div>
      </div>
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 12 }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="skeleton" style={{ borderRadius: 12, aspectRatio: '0.75' }} />
      ))}
    </div>
  )
}

function CatalogInstructions() {
  const steps = [
    { n: '1', title: 'Elegí una marca', desc: 'Seleccioná una marca del panel izquierdo para ver sus productos.' },
    { n: '2', title: 'Seleccioná productos', desc: 'Hacé clic en los productos que querés incluir en el catálogo. Podés filtrar por categoría o buscar por nombre.' },
    { n: '3', title: 'Ajustá los precios', desc: 'Con productos seleccionados, editá los precios directamente en el panel de exportación.' },
    { n: '4', title: 'Exportá el PDF', desc: 'Configurá la portada, el tema y el formato, y descargá el catálogo listo para compartir.' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 340, padding: '0 48px' }}>
      <div style={{ maxWidth: 480, width: '100%' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 20 }}>Cómo armar tu catálogo</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {steps.map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent)', color: 'var(--accent-text)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
              }}>{s.n}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ icon, message, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300 }}>
      <div style={{ textAlign: 'center', color: 'var(--text3)' }}>
        <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3, fontWeight: 200 }}>{icon}</div>
        <p style={{ fontWeight: 600, color: 'var(--text2)', margin: 0 }}>{message}</p>
        {sub && <p style={{ fontSize: 12, marginTop: 4, margin: '4px 0 0' }}>{sub}</p>}
      </div>
    </div>
  )
}

const sideBtn = {
  padding: '6px 12px', background: 'var(--surface)',
  border: '1px solid var(--border)', color: 'var(--text2)',
  borderRadius: 7, fontSize: 11, cursor: 'pointer',
  transition: 'all 0.15s',
}

const toolBtn = {
  padding: '7px 12px', background: 'var(--surface)',
  border: '1px solid var(--border)', color: 'var(--text2)',
  borderRadius: 8, fontSize: 12, cursor: 'pointer', flexShrink: 0,
  transition: 'all 0.15s',
}
