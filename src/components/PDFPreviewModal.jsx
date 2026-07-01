import { useState } from 'react'
import { generateCatalogPDF } from '@/utils/pdf'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'

export default function PDFPreviewModal({
  brandGroups,
  company,
  onClose,
  // Saved-catalog props (optional)
  initialPrices = {},
  catalogId     = null,   // null = new catalog
  catalogName   = '',
  onSaved       = null,   // callback after saving
}) {
  const membership = useAuthStore(s => s.membership)

  const [generating, setGenerating] = useState(false)
  const [progress, setProgress]     = useState('')
  const [orientation, setOrientation] = useState('landscape')
  const [step, setStep] = useState('preview') // 'preview' | 'pricing' | 'saving'

  // Pre-populate prices from saved catalog
  const [prices, setPrices] = useState(() => {
    const init = {}
    for (const [id, val] of Object.entries(initialPrices)) {
      init[id] = typeof val === 'object' ? val : { amount: val, currency: '$' }
    }
    return init
  })

  // Save-dialog state
  const [saveName, setSaveName] = useState(catalogName)
  const [saving, setSaving]     = useState(false)
  const [saveErr, setSaveErr]   = useState('')

  const totalProducts = brandGroups.reduce((n, g) => n + g.products.length, 0)
  const allProducts   = brandGroups.flatMap(g => g.products)

  function setPrice(id, field, value) {
    setPrices(prev => ({ ...prev, [id]: { currency: '$', ...prev[id], [field]: value } }))
  }

  function setAllCurrency(currency) {
    setPrices(prev => {
      const next = { ...prev }
      for (const p of allProducts) {
        next[p.id] = { ...next[p.id], currency, amount: next[p.id]?.amount ?? '' }
      }
      return next
    })
  }

  function buildGroupsWithPrices() {
    return brandGroups.map(g => ({
      ...g,
      products: g.products.map(p => ({
        ...p,
        _price:    prices[p.id]?.amount   ?? '',
        _currency: prices[p.id]?.currency ?? '$',
      }))
    }))
  }

  async function handleDownload() {
    setGenerating(true)
    setProgress('Preparando...')
    try {
      await generateCatalogPDF(
        buildGroupsWithPrices(),
        company,
        (current, total) => setProgress(`Procesando imagen ${current} de ${total}...`),
        orientation,
      )
      setProgress('¡Listo!')
    } catch (err) {
      setProgress(`Error: ${err.message}`)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!saveName.trim()) { setSaveErr('Ingresá un nombre para el catálogo'); return }
    setSaving(true); setSaveErr('')

    const companyId = membership?.company_id
    const userId    = membership?.user_id

    // snapshot_data stores brandGroups + prices
    const snapshotData = {
      brandGroups,
      prices,
      orientation,
    }

    try {
      let cid = catalogId

      if (!cid) {
        // Create new catalog
        const { data, error } = await supabase.from('catalogs').insert({
          company_id:    companyId,
          created_by:    userId,
          name:          saveName.trim(),
          status:        'draft',
          snapshot_data: snapshotData,
        }).select('id').single()
        if (error) throw error
        cid = data.id
      } else {
        // Update existing
        const { error } = await supabase.from('catalogs').update({
          name:          saveName.trim(),
          status:        'draft',
          snapshot_data: snapshotData,
          updated_at:    new Date().toISOString(),
        }).eq('id', cid)
        if (error) throw error
      }

      // Upsert catalog_products rows
      await supabase.from('catalog_products').delete().eq('catalog_id', cid)
      const cpRows = allProducts.map((p, i) => ({
        catalog_id:       cid,
        product_id:       p.id,
        sort_order:       i,
        product_snapshot: { sku: p.sku, name: p.name, image_url: p.image_url, brand_id: p.brand_id, category: p.categories?.name },
      }))
      if (cpRows.length > 0) {
        const { error } = await supabase.from('catalog_products').insert(cpRows)
        if (error) throw error
      }

      onSaved?.()
    } catch (err) {
      setSaveErr(err.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, width: '100%', maxWidth: 960,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px 14px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
        }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>
              {step === 'preview' ? 'Vista previa del catálogo'
               : step === 'pricing' ? 'Precios (opcional)'
               : 'Guardar catálogo'}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
              {brandGroups.length} marca{brandGroups.length !== 1 ? 's' : ''} — {totalProducts} producto{totalProducts !== 1 ? 's' : ''}
            </p>
          </div>
          {step === 'preview' && (
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', marginRight: 16 }}>
              {['landscape','portrait'].map(o => (
                <button key={o} onClick={() => setOrientation(o)} style={{
                  padding: '6px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                  border: `1px solid ${orientation === o ? 'var(--accent)' : 'var(--border)'}`,
                  background: orientation === o ? 'var(--accent)' : 'var(--surface)',
                  color: orientation === o ? 'var(--accent-text)' : 'var(--text2)',
                  fontWeight: orientation === o ? 700 : 400,
                }}>
                  {o === 'landscape' ? '⬛ Horizontal' : '▯ Vertical'}
                </button>
              ))}
            </div>
          )}
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 20, cursor: 'pointer', marginLeft: step !== 'preview' ? 'auto' : 0 }}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

          {/* Preview */}
          {step === 'preview' && brandGroups.map(({ brand, products }) => (
            <div key={brand.id} style={{ marginBottom: 28 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
                paddingBottom: 10, borderBottom: `2px solid ${brand.color}`
              }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: brand.color }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: brand.color }}>{brand.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>{products.length} productos</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                {products.map(p => (
                  <div key={p.id} style={{
                    background: '#fff', color: '#111', borderRadius: 8,
                    padding: 10, textAlign: 'center', border: '1px solid #eee'
                  }}>
                    {p.image_url
                      ? <img src={p.image_url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'contain', marginBottom: 8, borderRadius: 4 }} onError={e => { e.target.style.display = 'none' }} />
                      : <div style={{ width: '100%', aspectRatio: '1', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 8, borderRadius: 4 }}>📷</div>
                    }
                    <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, background: brand.color, color: brand.text_color ?? '#fff', fontSize: 9, fontWeight: 700, marginBottom: 5, fontFamily: 'monospace' }}>
                      {p.sku}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3 }}>{p.name}</div>
                    {prices[p.id]?.amount && (
                      <div style={{ marginTop: 4, fontSize: 11, color: '#333', fontWeight: 700 }}>
                        {prices[p.id].currency} {prices[p.id].amount}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Pricing */}
          {step === 'pricing' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>Moneda global:</span>
                {['$', 'USD'].map(cur => (
                  <button key={cur} onClick={() => setAllCurrency(cur)} style={{
                    padding: '5px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600,
                    border: '1px solid var(--border)', background: 'var(--surface-h)', color: 'var(--text2)',
                  }}>
                    Todo {cur === '$' ? '$ UYU' : 'USD'}
                  </button>
                ))}
                <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>Dejá el precio en blanco para no imprimirlo.</span>
              </div>
              {brandGroups.map(({ brand, products }) => (
                <div key={brand.id} style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: brand.color, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${brand.color}44` }}>
                    {brand.name}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {products.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-panel)', borderRadius: 8 }}>
                        <span style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{p.name}</span>
                        <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{p.sku}</span>
                        <select
                          value={prices[p.id]?.currency ?? '$'}
                          onChange={e => setPrice(p.id, 'currency', e.target.value)}
                          style={{ padding: '5px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, cursor: 'pointer', outline: 'none' }}>
                          <option value="$">$ UYU</option>
                          <option value="USD">USD</option>
                        </select>
                        <input
                          type="number"
                          placeholder="Precio"
                          value={prices[p.id]?.amount ?? ''}
                          onChange={e => setPrice(p.id, 'amount', e.target.value)}
                          style={{ width: 100, padding: '5px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, outline: 'none', textAlign: 'right' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Save dialog */}
          {step === 'saving' && (
            <div style={{ maxWidth: 480, margin: '0 auto', paddingTop: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
                Guardá este catálogo para poder volver a abrirlo, modificar precios y regenerar el PDF sin tener que seleccionar los productos de nuevo.
              </p>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Nombre del catálogo
              </label>
              <input
                autoFocus
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                placeholder="Ej: Catálogo Verano 2025"
                style={{
                  width: '100%', padding: '10px 13px',
                  background: 'var(--bg-panel)', border: '1px solid var(--border)',
                  borderRadius: 9, color: 'var(--text)', fontSize: 14, outline: 'none',
                  marginBottom: saveErr ? 8 : 0,
                }}
              />
              {saveErr && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{saveErr}</p>}

              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button onClick={() => { setStep('preview'); setSaveErr('') }} style={{
                  flex: 1, padding: '10px', borderRadius: 9, cursor: 'pointer',
                  background: 'var(--surface-h)', border: '1px solid var(--border)', color: 'var(--text2)', fontSize: 13,
                }}>
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving} style={{
                  flex: 2, padding: '10px', borderRadius: 9, cursor: saving ? 'not-allowed' : 'pointer',
                  background: 'var(--accent)', border: 'none', color: 'var(--accent-text)',
                  fontWeight: 700, fontSize: 13, opacity: saving ? 0.7 : 1,
                }}>
                  {saving ? 'Guardando...' : catalogId ? 'Actualizar catálogo' : 'Guardar catálogo'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'saving' && (
          <div style={{
            padding: '14px 20px', borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
          }}>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{progress}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={secondaryBtn}>Cerrar</button>

              {step === 'preview' && (
                <button onClick={() => setStep('pricing')} style={secondaryBtn}>
                  $ Agregar precios
                </button>
              )}
              {step === 'pricing' && (
                <button onClick={() => setStep('preview')} style={secondaryBtn}>
                  ← Volver
                </button>
              )}

              {/* Save button — only when onSaved is provided */}
              {onSaved && (
                <button onClick={() => { setSaveName(catalogName); setStep('saving') }} style={secondaryBtn}>
                  💾 {catalogId ? 'Actualizar' : 'Guardar'}
                </button>
              )}

              <button onClick={handleDownload} disabled={generating} style={{
                padding: '8px 22px', background: 'var(--accent)', color: 'var(--accent-text)',
                border: 'none', borderRadius: 7, fontWeight: 700,
                cursor: generating ? 'not-allowed' : 'pointer', fontSize: 13,
                opacity: generating ? 0.7 : 1
              }}>
                {generating ? progress || 'Generando...' : '⬇ Descargar PDF'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const secondaryBtn = {
  padding: '8px 16px', background: 'var(--surface-h)',
  border: '1px solid var(--border)', color: 'var(--text2)',
  borderRadius: 7, cursor: 'pointer', fontSize: 13,
}
