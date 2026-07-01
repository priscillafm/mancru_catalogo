import { useState } from 'react'
import { generateCatalogPDF } from '@/utils/pdf'
import { COVER_STYLES } from '@/utils/coverStyles'
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

  // Cover page options
  const [coverEnabled, setCoverEnabled] = useState(true)
  const [coverTheme, setCoverTheme]     = useState('dark')  // 'dark' | 'light'
  const [coverStyle, setCoverStyle]     = useState('corners')
  const [coverColor1, setCoverColor1]   = useState('#6366f1')
  const [coverColor2, setCoverColor2]   = useState('#D4FF3F')
  const [contacto, setContacto]         = useState('')
  const [clientName, setClientName]     = useState('')
  const [logoUrlDark, setLogoUrlDark]   = useState('https://www.mancru.com/artworks/artworks_mancru2021comuy/logo.svg')
  const [logoUrlLight, setLogoUrlLight] = useState('')
  const [showCoverPanel, setShowCoverPanel] = useState(false)

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
      const coverOptions = coverEnabled
        ? { enabled: true, theme: coverTheme, style: coverStyle, color1: coverColor1, color2: coverColor2, contacto, clientName, logoUrlDark, logoUrlLight }
        : null
      await generateCatalogPDF(
        buildGroupsWithPrices(),
        company,
        (current, total) => setProgress(`Procesando imagen ${current} de ${total}...`),
        orientation,
        coverOptions,
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

          {/* Cover panel */}
          {step === 'preview' && (
            <div style={{ marginBottom: 20 }}>
              <button
                onClick={() => setShowCoverPanel(p => !p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, background: 'none',
                  border: '1px solid var(--border)', borderRadius: 9, padding: '8px 14px',
                  color: 'var(--text2)', fontSize: 12, cursor: 'pointer', width: '100%',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 28, height: 18, borderRadius: 4, flexShrink: 0,
                    background: `linear-gradient(135deg, ${coverColor1}cc, ${coverColor2}88)`,
                    border: '1px solid rgba(255,255,255,0.1)',
                  }} />
                  <span style={{ fontWeight: 600 }}>Portada del catálogo</span>
                  {coverEnabled
                    ? <span style={{ fontSize: 10, color: 'var(--success)', fontWeight: 600 }}>✓ Activa</span>
                    : <span style={{ fontSize: 10, color: 'var(--text3)' }}>Desactivada</span>}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>{showCoverPanel ? '▲' : '▼'}</span>
              </button>

              {showCoverPanel && (
                <div style={{
                  marginTop: 10, padding: '16px 18px',
                  background: 'var(--bg-panel)', border: '1px solid var(--border)',
                  borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 14,
                }}>
                  {/* Enable toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={coverEnabled} onChange={e => setCoverEnabled(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>Incluir portada en el PDF</span>
                  </label>

                  {coverEnabled && (
                    <>
                      {/* ── Mini preview ── */}
                      <CoverPreview
                        theme={coverTheme} style={coverStyle}
                        color1={coverColor1} color2={coverColor2}
                        logoUrl={coverTheme === 'dark' ? logoUrlDark : (logoUrlLight || logoUrlDark)}
                        clientName={clientName}
                        companyName={company?.name}
                        website={company?.website ?? 'www.mancru.com'}
                      />

                      {/* ── Dark / Light toggle ── */}
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 7, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Tema de la portada</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {[
                            { key: 'dark',  label: '● Oscura', bg: '#09090B', fg: '#fff' },
                            { key: 'light', label: '○ Clara',  bg: '#F8F8F8', fg: '#111' },
                          ].map(t => (
                            <button key={t.key} onClick={() => setCoverTheme(t.key)} style={{
                              flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                              background: t.bg, color: t.fg,
                              border: coverTheme === t.key ? `2px solid ${coverColor1}` : '2px solid var(--border)',
                              transition: 'border-color 0.15s',
                            }}>
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* ── Style selector ── */}
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 7, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Estilo de difuminado</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                          {Object.entries(COVER_STYLES).map(([key, cfg]) => (
                            <button key={key} onClick={() => setCoverStyle(key)} style={{
                              padding: 0, borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                              border: coverStyle === key ? `2px solid ${coverColor1}` : '2px solid var(--border)',
                              transition: 'border-color 0.15s',
                            }}>
                              <StyleThumb styleKey={key} blobs={cfg.blobs} color1={coverColor1} color2={coverColor2} theme={coverTheme} />
                              <div style={{
                                fontSize: 10, fontWeight: 600, padding: '4px 0',
                                background: 'var(--surface-h)', color: 'var(--text2)',
                              }}>{cfg.label}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* ── Colors + presets ── */}
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 7, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Colores</div>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
                            <input type="color" value={coverColor1} onChange={e => setCoverColor1(e.target.value)}
                              style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer' }} />
                            Color 1
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
                            <input type="color" value={coverColor2} onChange={e => setCoverColor2(e.target.value)}
                              style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer' }} />
                            Color 2
                          </label>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {[
                              { label: 'Índigo', c1: '#6366f1', c2: '#D4FF3F' },
                              { label: 'Sunset', c1: '#f97316', c2: '#ec4899' },
                              { label: 'Ocean',  c1: '#06b6d4', c2: '#6366f1' },
                              { label: 'Forest', c1: '#22c55e', c2: '#06b6d4' },
                              { label: 'Rose',   c1: '#f43f5e', c2: '#a855f7' },
                              { label: 'Mono',   c1: '#ffffff', c2: '#888888' },
                            ].map(p => (
                              <button key={p.label} onClick={() => { setCoverColor1(p.c1); setCoverColor2(p.c2) }}
                                style={{
                                  width: 22, height: 22, borderRadius: 5, padding: 0, cursor: 'pointer',
                                  border: '1.5px solid rgba(128,128,128,0.3)',
                                  background: `linear-gradient(135deg, ${p.c1}, ${p.c2})`,
                                }}
                                title={p.label}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* ── Logo URLs ── */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                          <label style={labelStyle}>Logo fondo oscuro (blanco / claro)</label>
                          <input type="text" placeholder="https://..." value={logoUrlDark}
                            onChange={e => setLogoUrlDark(e.target.value)} style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Logo fondo claro (color / oscuro) — opcional</label>
                          <input type="text" placeholder="Usa el mismo si no tenés versión clara" value={logoUrlLight}
                            onChange={e => setLogoUrlLight(e.target.value)} style={inputStyle} />
                        </div>
                      </div>

                      {/* ── Client name ── */}
                      <div>
                        <label style={labelStyle}>Presentado a (opcional)</label>
                        <input type="text" placeholder="Ej: Empresa XYZ" value={clientName}
                          onChange={e => setClientName(e.target.value)} style={inputStyle} />
                      </div>

                      {/* ── Contact ── */}
                      <div>
                        <label style={labelStyle}>Contacto (opcional — aparece sutil en la portada)</label>
                        <input type="text" placeholder="Ej: María González · 099 123 456" value={contacto}
                          onChange={e => setContacto(e.target.value)} style={inputStyle} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

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

const labelStyle = {
  display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 5,
  fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
}
const inputStyle = {
  width: '100%', padding: '8px 12px',
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text)', fontSize: 12, outline: 'none',
}

// ── Mini live preview of the cover ──
function CoverPreview({ theme, style, color1, color2, logoUrl, clientName, companyName, website }) {
  const isDark = theme === 'dark'
  const bg   = isDark ? '#09090B' : '#F8F8F8'
  const textMain  = isDark ? '#fff'          : '#111'
  const textLabel = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)'
  const textSub   = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)'
  const textWeb   = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'
  const mult = isDark ? 1 : 0.45

  return (
    <div style={{ width: '100%', height: 110, borderRadius: 8, overflow: 'hidden', position: 'relative', background: bg, border: '1px solid var(--border)' }}>
      {/* Blobs */}
      <StyleBlobs styleKey={style} color1={color1} color2={color2} mult={mult} />
      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 3, padding: '0 10px' }}>
        {logoUrl
          ? <img src={logoUrl} alt="" style={{ height: 22, maxWidth: 90, objectFit: 'contain' }} onError={e => { e.target.style.display='none' }} />
          : <span style={{ fontSize: 14, fontWeight: 700, color: textMain }}>{companyName ?? 'Empresa'}</span>
        }
        <span style={{ fontSize: 6.5, letterSpacing: '0.22em', color: textLabel, textTransform: 'uppercase', marginTop: 2 }}>Propuesta Comercial</span>
        {clientName && <span style={{ fontSize: 9, color: textSub, marginTop: 1 }}>{clientName}</span>}
        <span style={{ fontSize: 6.5, color: textWeb, marginTop: 3 }}>{website}</span>
      </div>
    </div>
  )
}

// CSS blobs for the live preview
function StyleBlobs({ styleKey, color1, color2, mult }) {
  const styles = {
    corners: [
      { left:'-10%', top:'-15%',  w:'65%', h:'70%', c: color1, a: 0.55 },
      { right:'-5%', bottom:'-10%', w:'60%', h:'65%', c: color2, a: 0.45 },
    ],
    aurora: [
      { left:'-5%',  top:'15%', w:'50%', h:'70%', c: color1, a: 0.50 },
      { left:'25%',  top:'10%', w:'50%', h:'70%', c: `#${blendHex(color1,color2)}`, a: 0.40 },
      { right:'-5%', top:'15%', w:'50%', h:'70%', c: color2, a: 0.45 },
    ],
    vortex: [
      { left:'-10%',  top:'-15%', w:'55%', h:'55%', c: color1, a: 0.42 },
      { right:'-10%', top:'-15%', w:'55%', h:'55%', c: color2, a: 0.38 },
      { left:'-10%',  bottom:'-15%', w:'55%', h:'55%', c: color2, a: 0.35 },
      { right:'-10%', bottom:'-15%', w:'55%', h:'55%', c: color1, a: 0.42 },
    ],
    sweep: [
      { left:'-20%',  bottom:'-20%', w:'80%', h:'80%', c: color1, a: 0.55 },
      { right:'-20%', top:'-20%',    w:'80%', h:'80%', c: color2, a: 0.50 },
    ],
  }
  const blobs = styles[styleKey] ?? styles.corners
  return (
    <>
      {blobs.map((b, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: b.w, height: b.h,
          ...(b.left !== undefined   ? { left: b.left }   : {}),
          ...(b.right !== undefined  ? { right: b.right }  : {}),
          ...(b.top !== undefined    ? { top: b.top }    : {}),
          ...(b.bottom !== undefined ? { bottom: b.bottom } : {}),
          borderRadius: '50%',
          background: `radial-gradient(circle, ${b.c}${alphaHex(b.a * mult)} 0%, transparent 70%)`,
        }} />
      ))}
    </>
  )
}

// Thumbnail for style selector
function StyleThumb({ styleKey, blobs: _blobs, color1, color2, theme }) {
  const bg = theme === 'dark' ? '#09090B' : '#F8F8F8'
  const mult = theme === 'dark' ? 1 : 0.45
  return (
    <div style={{ height: 44, position: 'relative', background: bg, overflow: 'hidden' }}>
      <StyleBlobs styleKey={styleKey} color1={color1} color2={color2} mult={mult} />
    </div>
  )
}

// helpers
function alphaHex(a) {
  return Math.round(Math.min(1, Math.max(0, a)) * 255).toString(16).padStart(2, '0')
}
function blendHex(h1, h2) {
  const p = (h, i) => parseInt(h.replace('#','').slice(i*2,i*2+2), 16)
  return [0,1,2].map(i => Math.round((p(h1,i)+p(h2,i))/2).toString(16).padStart(2,'0')).join('')
}
