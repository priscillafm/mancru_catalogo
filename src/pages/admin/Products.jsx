import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import ImageCropModal from '@/components/ImageCropModal'
import Icon from '@/components/Icon'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import PlanLimitBar from '@/components/PlanLimitBar'

const PAGE_SIZE = 50

export default function Products() {
  const companyId   = useAuthStore(s => s.membership?.company_id)
  const qc          = useQueryClient()
  const { canAddProducts, usage, limits, pctProducts } = usePlanLimits()
  const [search, setSearch]       = useState('')
  const [brandId, setBrandId]     = useState('all')
  const [categoryId, setCategoryId] = useState('all')
  const [page, setPage]           = useState(0)
  const [editing, setEditing]     = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [imgUploading, setImgUploading] = useState(false)
  const [cropFile, setCropFile] = useState(null)  // file pending crop
  const imgFileRef = useRef()

  // Load brands for filter
  const { data: brands = [] } = useQuery({
    queryKey: ['admin-brands', companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('brands').select('id, name, color')
        .eq('company_id', companyId).is('deleted_at', null).order('name')
      return data ?? []
    },
    enabled: !!companyId,
  })

  // Load categories for filter + edit dropdown
  const { data: categories = [] } = useQuery({
    queryKey: ['admin-categories', companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('categories').select('id, name')
        .eq('company_id', companyId).is('deleted_at', null).order('name')
      return data ?? []
    },
    enabled: !!companyId,
  })

  // Load products
  const { data, isLoading } = useQuery({
    queryKey: ['admin-products', companyId, search, brandId, categoryId, page],
    queryFn: async () => {
      let q = supabase
        .from('products')
        .select('id, sku, name, active, image_url, stock, brand_id, category_id, brands(name,color), categories(name)', { count: 'exact' })
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('name', { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (search)              q = q.ilike('name', `%${search}%`)
      if (brandId === 'none')  q = q.is('brand_id', null)
      else if (brandId !== 'all') q = q.eq('brand_id', brandId)
      if (categoryId !== 'all') q = q.eq('category_id', categoryId)

      const { data, count } = await q
      // Ordenar por nombre de marca client-side (null brand = "Sin marca" al final)
      const sorted = (data ?? []).slice().sort((a, b) => {
        const ba = a.brands?.name ?? 'zzz'
        const bb = b.brands?.name ?? 'zzz'
        return ba.localeCompare(bb) || a.name.localeCompare(b.name)
      })
      return { rows: sorted, total: count ?? 0 }
    },
    enabled: !!companyId,
  })

  const rows  = data?.rows  ?? []
  const total = data?.total ?? 0
  const pages = Math.ceil(total / PAGE_SIZE)

  // Mutations
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-products'] })

  const updateProduct = useMutation({
    mutationFn: async (updates) => {
      const { id, ...fields } = updates
      const { error } = await supabase.from('products').update(fields).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { setEditing(null); invalidate() },
  })

  const deleteProduct = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('products')
        .update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { setConfirmDel(null); invalidate() },
  })

  // Step 1: user picks a file → open crop modal
  function handleImgUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''  // allow re-selecting same file
    setCropFile(file)
  }

  // Step 2: user confirms crop → upload the canvas blob
  async function handleCropConfirm(blob) {
    setCropFile(null)
    if (!editing) return
    setImgUploading(true)
    try {
      const path = `${companyId}/products/${editing.sku}.jpg`
      const { error } = await supabase.storage.from('product-images').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path)
      // Add cache-bust so the browser shows the new image immediately
      setEditing(p => ({ ...p, image_url: publicUrl + '?t=' + Date.now() }))
    } catch (err) {
      alert('Error subiendo imagen: ' + err.message)
    } finally {
      setImgUploading(false)
    }
  }

  function resetFilters() {
    setSearch(''); setBrandId('all'); setCategoryId('all'); setPage(0)
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Sidebar: brand filter ── */}
      <div style={{
        width: 200, minWidth: 200, borderRight: '1px solid var(--border)',
        overflowY: 'auto', padding: '16px 0', background: 'var(--bg-bar)',
      }}>
        <div style={{ padding: '0 14px 10px', fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Marcas
        </div>
        <BrandBtn label="Todas" color="var(--accent)" active={brandId === 'all'} onClick={() => { setBrandId('all'); setPage(0) }} />
        {brands.map(b => (
          <BrandBtn key={b.id} label={b.name} color={b.color} active={brandId === b.id}
            onClick={() => { setBrandId(b.id); setPage(0) }} />
        ))}
        <BrandBtn label="Sin marca" color="var(--text3)" active={brandId === 'none'} onClick={() => { setBrandId('none'); setPage(0) }} />
      </div>

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header / filters */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0, background: 'var(--surface)' }}>
          <input
            placeholder="Buscar producto..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            style={inputStyle}
          />
          <select value={categoryId} onChange={e => { setCategoryId(e.target.value); setPage(0) }} style={selectStyle}>
            <option value="all">Todas las categorías</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {(search || brandId !== 'all' || categoryId !== 'all') && (
            <button onClick={resetFilters} style={{ ...btnSecondary, whiteSpace: 'nowrap' }}>✕ Limpiar</button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <PlanLimitBar used={usage.products} max={limits.max_products} label="productos" pct={pctProducts} />
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr>
                {['Img', 'SKU', 'Nombre', 'Categoría', 'Stock', 'Estado', ''].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Cargando...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Sin resultados</td></tr>
              ) : rows.map((p, i) => {
                const prevBrand = i > 0 ? (rows[i-1].brands?.name ?? null) : undefined
                const curBrand  = p.brands?.name ?? null
                const showBrandRow = curBrand !== prevBrand
                return [
                  showBrandRow && (
                    <tr key={`brand-${p.brand_id ?? 'none'}-${i}`}>
                      <td colSpan={7} style={{
                        padding: '8px 14px 4px',
                        fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                        color: p.brands?.color ?? 'var(--text3)',
                        borderBottom: `2px solid ${p.brands?.color ?? 'var(--border)'}22`,
                        background: 'var(--bg-panel)',
                      }}>
                        {curBrand ?? 'Sin marca'}
                      </td>
                    </tr>
                  ),
                  <tr key={p.id} style={{ transition: 'background .1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-h)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={tdStyle}>
                      {p.image_url
                        ? <img src={p.image_url} alt="" style={{ width: 38, height: 38, objectFit: 'contain', borderRadius: 4, background: 'var(--bg-panel)' }} onError={e => e.target.style.display='none'} />
                        : <span style={{ display:'inline-flex', width:38, height:38, background:'var(--surface-h)', borderRadius:4, alignItems:'center', justifyContent:'center', color:'var(--text3)' }}><Icon name="image" size={16} /></span>
                      }
                    </td>
                    <td style={tdStyle}><code style={{ fontSize: 11, color: 'var(--accent)' }}>{p.sku}</code></td>
                    <td style={{ ...tdStyle, maxWidth: 340 }}>
                      <div style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--text)' }}>{p.name}</div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{p.categories?.name ?? '—'}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {p.stock ?? '—'}
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                        background: p.active ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.1)',
                        color: p.active ? '#22c55e' : '#ef4444',
                      }}>
                        {p.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      <button onClick={() => setEditing({ ...p })} style={btnIcon} title="Editar">Editar</button>
                      <button onClick={() => setConfirmDel(p)} style={{ ...btnIcon, marginLeft: 4, color: '#ef4444', borderColor: 'rgba(239,68,68,.3)' }} title="Eliminar">Eliminar</button>
                    </td>
                  </tr>
                ]
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ padding: '10px 18px', display: 'flex', gap: 8, alignItems: 'center', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <button onClick={() => setPage(0)} disabled={page === 0} style={btnPage}>«</button>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={btnPage}>‹ Anterior</button>
            <span style={{ fontSize: 12, color: 'var(--text3)', flex: 1, textAlign: 'center' }}>
              Página {page + 1} de {pages}
            </span>
            <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} style={btnPage}>Siguiente ›</button>
            <button onClick={() => setPage(pages - 1)} disabled={page >= pages - 1} style={btnPage}>»</button>
          </div>
        )}
      </div>

      {/* ── Edit modal ── */}
      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Editar producto</h3>
          <code style={{ fontSize: 11, color: 'var(--accent)' }}>{editing.sku}</code>

          {/* Imagen */}
          <label style={labelStyle}>Imagen</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
            <div style={{ width: 64, height: 64, borderRadius: 8, background: 'var(--bg-panel)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
              {editing.image_url
                ? <img src={editing.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : <span style={{ color: 'var(--text3)' }}><Icon name="image" size={22} /></span>
              }
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input ref={imgFileRef} type="file" accept=".jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={handleImgUpload} />
              <button type="button" onClick={() => imgFileRef.current?.click()} disabled={imgUploading} style={btnSecondary}>
                {imgUploading ? 'Subiendo...' : editing.image_url ? 'Cambiar imagen' : 'Subir imagen'}
              </button>
              {editing.image_url && (
                <button type="button" onClick={() => setEditing(p => ({ ...p, image_url: null }))} style={{ ...btnSecondary, fontSize: 11, color: '#ef4444', borderColor: 'rgba(239,68,68,.3)' }}>
                  Quitar
                </button>
              )}
            </div>
          </div>

          <label style={labelStyle}>Nombre</label>
          <input value={editing.name} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} style={inputFull} />

          <label style={labelStyle}>Marca</label>
          <select value={editing.brand_id ?? ''} onChange={e => setEditing(p => ({ ...p, brand_id: e.target.value || null }))} style={inputFull}>
            <option value="">— Sin marca —</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          <label style={labelStyle}>Categoría</label>
          <select value={editing.category_id ?? ''} onChange={e => setEditing(p => ({ ...p, category_id: e.target.value || null }))} style={inputFull}>
            <option value="">— Sin categoría —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <label style={labelStyle}>Stock</label>
          <input type="number" value={editing.stock ?? ''} onChange={e => setEditing(p => ({ ...p, stock: e.target.value === '' ? null : Number(e.target.value) }))} style={inputFull} />

          <label style={labelStyle}>Estado</label>
          <select value={editing.active ? '1' : '0'} onChange={e => setEditing(p => ({ ...p, active: e.target.value === '1' }))} style={inputFull}>
            <option value="1">Activo</option>
            <option value="0">Inactivo</option>
          </select>

          <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditing(null)} style={btnSecondary}>Cancelar</button>
            <button
              onClick={() => updateProduct.mutate({ id: editing.id, name: editing.name, brand_id: editing.brand_id ?? null, category_id: editing.category_id, stock: editing.stock, active: editing.active, image_url: editing.image_url ?? null })}
              disabled={updateProduct.isPending}
              style={btnPrimary}>
              {updateProduct.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
          {updateProduct.isError && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#ef4444' }}>Error: {updateProduct.error?.message}</div>
          )}
        </Modal>
      )}

      {/* ── Image crop modal ── */}
      {cropFile && (
        <ImageCropModal
          file={cropFile}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropFile(null)}
        />
      )}

      {/* ── Confirm delete modal ── */}
      {confirmDel && (
        <Modal onClose={() => setConfirmDel(null)}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Eliminar producto</h3>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>
            ¿Seguro que querés eliminar este producto?
          </p>
          <div style={{ padding: '10px 12px', background: 'var(--bg-panel)', borderRadius: 8, marginBottom: 20 }}>
            <code style={{ fontSize: 11, color: 'var(--accent)' }}>{confirmDel.sku}</code>
            <div style={{ fontSize: 13, marginTop: 4 }}>{confirmDel.name}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirmDel(null)} style={btnSecondary}>Cancelar</button>
            <button
              onClick={() => deleteProduct.mutate(confirmDel.id)}
              disabled={deleteProduct.isPending}
              style={{ ...btnPrimary, background: '#ef4444' }}>
              {deleteProduct.isPending ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function BrandBtn({ label, color, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8,
      width: '100%', padding: '8px 14px', background: active ? `${color}18` : 'transparent',
      border: 'none', borderLeft: `3px solid ${active ? color : 'transparent'}`,
      color: active ? color : 'var(--text2)', fontSize: 12, cursor: 'pointer',
      textAlign: 'left', transition: 'all .12s',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </button>
  )
}

function Modal({ children, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {children}
      </div>
    </div>
  )
}

const thStyle    = { padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }
const tdStyle    = { padding: '9px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, verticalAlign: 'middle' }
const btnPage    = { padding: '5px 10px', background: 'var(--surface-h)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }
const btnIcon    = { padding: '4px 7px', background: 'var(--surface-h)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 13 }
const inputStyle = { flex: 1, maxWidth: 280, padding: '7px 11px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, outline: 'none' }
const selectStyle= { padding: '7px 10px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer' }
const inputFull  = { width: '100%', padding: '8px 10px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginTop: 4 }
const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 14, display: 'block' }
const btnPrimary = { padding: '8px 20px', background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: 'pointer' }
const btnSecondary = { padding: '8px 16px', background: 'var(--surface-h)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, cursor: 'pointer' }
