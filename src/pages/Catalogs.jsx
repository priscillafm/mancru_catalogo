import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import PDFPreviewModal from '@/components/PDFPreviewModal'

export default function CatalogsPage() {
  const membership  = useAuthStore(s => s.membership)
  const companyId   = membership?.company_id
  const navigate    = useNavigate()
  const qc          = useQueryClient()

  const [openCatalog, setOpenCatalog] = useState(null) // catalog to reopen in PDF modal

  const { data: catalogs = [], isLoading } = useQuery({
    queryKey: ['catalogs', companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('catalogs')
        .select(`
          id, name, status, created_at, updated_at, snapshot_data,
          users!catalogs_created_by_fkey(name, email),
          catalog_products(product_id, sort_order, product_snapshot)
        `)
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
      return data ?? []
    },
    enabled: !!companyId,
  })

  async function deleteCatalog(id) {
    if (!confirm('¿Eliminar este catálogo?')) return
    await supabase.from('catalogs').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    qc.invalidateQueries(['catalogs', companyId])
  }

  function handleOpen(catalog) {
    // Rebuild brandGroups from snapshot_data
    const snap = catalog.snapshot_data ?? {}
    const brandGroups = snap.brandGroups ?? []
    setOpenCatalog({ ...catalog, brandGroups })
  }

  const STATUS = {
    draft:     { label: 'Borrador',  color: 'var(--text3)' },
    generated: { label: 'Generado', color: 'var(--success)' },
    shared:    { label: 'Compartido', color: 'var(--accent)' },
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Sidebar mínimo */}
      <aside className="glass" style={{ width: 248, minWidth: 248, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
            {membership?.companies?.name ?? '—'}
          </div>
          <h1 style={{ fontSize: 15, fontWeight: 700 }}>Mis catálogos</h1>
        </div>
        <nav style={{ flex: 1, padding: '8px 6px' }}>
          <button className="brand-btn" onClick={() => navigate('/')}>
            ← Volver al catálogo
          </button>
        </nav>
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
          <button onClick={() => navigate('/profile')} style={sideBtn}>Mi perfil</button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '32px 32px' }}>
        <div style={{ maxWidth: 800 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.4px' }}>Catálogos guardados</h2>
              <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
                Abrí un catálogo para modificar precios o regenerar el PDF.
              </p>
            </div>
            <button onClick={() => navigate('/')} style={{
              padding: '9px 18px', background: 'var(--accent)', color: 'var(--accent-text)',
              border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>
              + Nuevo catálogo
            </button>
          </div>

          {isLoading ? (
            [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12, marginBottom: 10 }} />)
          ) : catalogs.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 20px',
              border: '2px dashed var(--border)', borderRadius: 14, color: 'var(--text3)',
            }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>◻</div>
              <p style={{ fontWeight: 600, color: 'var(--text2)', margin: 0 }}>Sin catálogos guardados</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Generá un PDF desde el catálogo y guardalo para verlo acá.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {catalogs.map(cat => {
                const st = STATUS[cat.status] ?? STATUS.draft
                const productCount = cat.catalog_products?.length ?? 0
                const snap = cat.snapshot_data ?? {}
                const brandNames = (snap.brandGroups ?? []).map(g => g.brand?.name).filter(Boolean)

                return (
                  <div key={cat.id} style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 12, padding: '16px 20px',
                    display: 'flex', alignItems: 'center', gap: 16,
                    transition: 'border-color 0.15s, transform 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-str)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                      background: 'var(--surface-h)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 20,
                    }}>📄</div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{cat.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span>{productCount} producto{productCount !== 1 ? 's' : ''}</span>
                        {brandNames.length > 0 && <span>{brandNames.join(' · ')}</span>}
                        <span>{new Date(cat.updated_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>

                    {/* Status */}
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px',
                      borderRadius: 999, background: 'var(--surface-h)', color: st.color, flexShrink: 0,
                    }}>{st.label}</span>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button onClick={() => handleOpen(cat)} style={actionBtn('#3b82f6')}>
                        Abrir
                      </button>
                      <button onClick={() => deleteCatalog(cat.id)} style={actionBtn('var(--danger)')}>
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {openCatalog && (
        <PDFPreviewModal
          brandGroups={openCatalog.brandGroups}
          company={membership?.companies}
          initialPrices={openCatalog.snapshot_data?.prices ?? {}}
          catalogId={openCatalog.id}
          catalogName={openCatalog.name}
          onClose={() => setOpenCatalog(null)}
          onSaved={() => { qc.invalidateQueries(['catalogs', companyId]); setOpenCatalog(null) }}
        />
      )}
    </div>
  )
}

const sideBtn = {
  padding: '6px 12px', background: 'var(--surface)', border: '1px solid var(--border)',
  color: 'var(--text2)', borderRadius: 7, fontSize: 11, cursor: 'pointer',
}

const actionBtn = (color) => ({
  padding: '6px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontWeight: 600,
  border: `1px solid ${color}44`, background: `${color}11`, color,
  transition: 'all 0.15s',
})
