import { useState, useRef, useEffect } from 'react'
import { generateCatalogPDF } from '@/utils/pdf'
import { COVER_STYLES } from '@/utils/coverStyles'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import Icon from '@/components/Icon'

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mobile
}

export default function PDFPreviewModal({
  brandGroups,
  company,
  onClose,
  // Saved-catalog props (optional)
  initialPrices = {},
  catalogId     = null,   // null = new catalog
  catalogName   = '',
  catalogStatus = null,   // 'draft' | 'shared' — para no cambiar el estado al guardar
  onSaved       = null,   // callback after saving
}) {
  const membership = useAuthStore(s => s.membership)
  const authUser   = useAuthStore(s => s.user)
  const isMobile   = useIsMobile()

  const [generating, setGenerating] = useState(false)
  const [progress, setProgress]     = useState('')
  const [orientation, setOrientation] = useState('landscape')
  const [step, setStep] = useState('preview') // 'preview' | 'pricing' | 'saving'

  // Cover page options
  const [coverEnabled, setCoverEnabled] = useState(true)
  const [coverTheme, setCoverTheme]     = useState('dark')  // 'dark' | 'light'
  const [coverStyle, setCoverStyle]     = useState('corners')
  const [coverColor1, setCoverColor1]   = useState('#0F4C5C')
  const [coverColor2, setCoverColor2]   = useState('#E07A28')
  const [contacto, setContacto]         = useState('')
  const [clientName, setClientName]     = useState('')
  const [coverDescription, setCoverDescription] = useState('')
  const [showTagline, setShowTagline]   = useState(true)
  const [ivaMode, setIvaMode]           = useState('sin_iva') // 'sin_iva' | 'con_iva' | 'ninguno'
  const companyLogoUrl = company?.logo_url ?? ''
  const [logoUrlDark, setLogoUrlDark]   = useState(companyLogoUrl)
  const [logoUrlLight, setLogoUrlLight] = useState(companyLogoUrl)
  const [showCoverPanel, setShowCoverPanel] = useState(false)
  const [unbrandedColor, setUnbrandedColor] = useState('#6366f1')
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoUploadErr, setLogoUploadErr] = useState('')
  const logoFileRef = useRef()

  const MAX_LOGO_BYTES = 3 * 1024 * 1024
  const ALLOWED_LOGO_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp']

  async function handleCoverLogoUpload(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    const companyId = membership?.company_id
    if (!companyId) { setLogoUploadErr('Tu empresa todavía se está cargando, esperá unos segundos.'); return }
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) { setLogoUploadErr('Formato no soportado. Usá PNG, SVG, JPG o WEBP.'); return }
    if (file.size > MAX_LOGO_BYTES) { setLogoUploadErr(`El archivo pesa demasiado (máximo ${MAX_LOGO_BYTES / 1024 / 1024}MB).`); return }

    setLogoUploadErr(''); setLogoUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${companyId}/cover-logo-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path)
      setLogoUrlDark(publicUrl); setLogoUrlLight(publicUrl)
    } catch (err) {
      setLogoUploadErr('Error subiendo el logo: ' + err.message)
    } finally {
      setLogoUploading(false)
    }
  }

  // Pre-populate prices from saved catalog
  const [prices, setPrices] = useState(() => {
    const init = {}
    for (const g of brandGroups) {
      for (const p of g.products) {
        if (p.price != null && p.price !== '') init[p.id] = { amount: String(p.price), currency: '$' }
      }
    }
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
      brand: g.brand.id === null ? { ...g.brand, color: unbrandedColor } : g.brand,
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
        ? { enabled: true, theme: coverTheme, style: coverStyle, color1: coverColor1, color2: coverColor2, contacto, clientName, logoUrlDark, logoUrlLight, showTagline, description: coverDescription }
        : null
      await generateCatalogPDF(
        buildGroupsWithPrices(),
        company,
        (current, total) => setProgress(`Procesando imagen ${current} de ${total}...`),
        orientation,
        coverOptions,
        false,
        ivaMode === 'con_iva' ? 'Precios con IVA' : ivaMode === 'sin_iva' ? 'Precios sin IVA' : '',
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
      vendorWhatsapp: authUser?.whatsapp ?? null,
      vendorEmail: authUser?.email ?? null,
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
        // No se toca el estado: un catálogo compartido sigue compartido después de guardar cambios.
        const { error } = await supabase.from('catalogs').update({
          name:          saveName.trim(),
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
    <div className="modal-overlay-in" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 0 : 20
    }}>
      <div className="modal-pop-in" style={{
        background: 'var(--surface)', border: isMobile ? 'none' : '1px solid var(--border)',
        borderRadius: isMobile ? 0 : 14, width: '100%', maxWidth: 960,
        height: isMobile ? '100%' : undefined, maxHeight: isMobile ? '100%' : '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: isMobile ? '14px 16px 12px' : '18px 20px 14px', borderBottom: '1px solid var(--border)',
          display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 0,
          alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <h3 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700 }}>
                {step === 'preview' ? 'Vista previa del catálogo'
                 : step === 'pricing' ? 'Precios (opcional)'
                 : 'Guardar catálogo'}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 3 }}>
                {brandGroups.length} marca{brandGroups.length !== 1 ? 's' : ''} — {totalProducts} producto{totalProducts !== 1 ? 's' : ''}
              </p>
            </div>
            {isMobile && (
              <button onClick={onClose}
                style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 22, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>
                ✕
              </button>
            )}
          </div>
          {step === 'preview' && (
            <div style={{
              display: 'flex', gap: 6, alignItems: 'center', flexWrap: isMobile ? 'wrap' : 'nowrap',
              marginLeft: isMobile ? 0 : 'auto', marginRight: isMobile ? 0 : 16,
            }}>
              <select value={ivaMode} onChange={e => setIvaMode(e.target.value)} style={{
                padding: '6px 10px', borderRadius: 7, fontSize: 14, cursor: 'pointer',
                border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)',
                flex: isMobile ? '1 1 100%' : 'none',
              }}>
                <option value="sin_iva">Precios sin IVA</option>
                <option value="con_iva">Precios con IVA</option>
                <option value="ninguno">No indicar IVA</option>
              </select>
              {['landscape','portrait'].map(o => (
                <button key={o} onClick={() => setOrientation(o)} style={{
                  padding: '6px 14px', borderRadius: 7, fontSize: 14, cursor: 'pointer',
                  border: `1px solid ${orientation === o ? 'var(--accent)' : 'var(--border)'}`,
                  background: orientation === o ? 'var(--accent)' : 'var(--surface)',
                  color: orientation === o ? 'var(--accent-text)' : 'var(--text2)',
                  fontWeight: orientation === o ? 700 : 400,
                  flex: isMobile ? 1 : 'none',
                }}>
                  {o === 'landscape' ? <><Icon name="landscape" size={13} /> Horizontal</> : <><Icon name="portrait" size={13} /> Vertical</>}
                </button>
              ))}
            </div>
          )}
          {!isMobile && (
            <button onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 21, cursor: 'pointer', marginLeft: step !== 'preview' ? 'auto' : 0 }}>
              ✕
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : 24 }}>

          {/* Cover panel */}
          {step === 'preview' && (
            <div style={{ marginBottom: 20 }}>
              <button
                onClick={() => setShowCoverPanel(p => !p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, background: 'none',
                  border: '1px solid var(--border)', borderRadius: 9, padding: '8px 14px',
                  color: 'var(--text2)', fontSize: 13, cursor: 'pointer', width: '100%',
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
                    ? <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>✓ Activa</span>
                    : <span style={{ fontSize: 11, color: 'var(--text3)' }}>Desactivada</span>}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{showCoverPanel ? '▲' : '▼'}</span>
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
                    <span style={{ fontSize: 14, fontWeight: 500 }}>Incluir portada en el PDF</span>
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
                        website={company?.website ?? ''}
                        showTagline={showTagline}
                      />

                      {/* ── Mostrar/ocultar "Propuesta Comercial" ── */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                        <input type="checkbox" checked={showTagline} onChange={e => setShowTagline(e.target.checked)}
                          style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                        <span style={{ fontSize: 14, fontWeight: 500 }}>Mostrar "Propuesta Comercial" en la portada</span>
                      </label>

                      {/* ── Dark / Light toggle ── */}
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 7, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Tema de la portada</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {[
                            { key: 'dark',  label: '● Oscura', bg: '#09090B', fg: '#fff' },
                            { key: 'light', label: '○ Clara',  bg: '#F8F8F8', fg: '#111' },
                          ].map(t => (
                            <button key={t.key} onClick={() => setCoverTheme(t.key)} style={{
                              flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
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
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 7, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Estilo de difuminado</div>
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 3 : 4}, 1fr)`, gap: 8 }}>
                          {Object.entries(COVER_STYLES).map(([key, cfg]) => (
                            <button key={key} onClick={() => setCoverStyle(key)} style={{
                              padding: 0, borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                              border: coverStyle === key ? `2px solid ${coverColor1}` : '2px solid var(--border)',
                              transition: 'var(--transition)',
                            }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                              <StyleThumb styleKey={key} blobs={cfg.blobs} color1={coverColor1} color2={coverColor2} theme={coverTheme} />
                              <div style={{
                                fontSize: 11, fontWeight: 600, padding: '4px 0',
                                background: 'var(--surface-h)', color: 'var(--text2)',
                              }}>{cfg.label}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* ── Colors + presets ── */}
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 7, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Colores</div>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
                            <input type="color" value={coverColor1} onChange={e => setCoverColor1(e.target.value)}
                              style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer' }} />
                            Color 1
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
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
                                  transition: 'var(--transition)',
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.18)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                title={p.label}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* ── Logo ── */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <label style={labelStyle}>Logo</label>
                            {company?.logo_url && (
                              <button
                                onClick={() => { setLogoUrlDark(company.logo_url); setLogoUrlLight(company.logo_url) }}
                                style={presetBtn}
                                title="Usar logo configurado en Ajustes"
                              >Usar mi logo</button>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input type="text" placeholder="https://... (dejá vacío para omitir logo)" value={logoUrlDark}
                              onChange={e => { setLogoUrlDark(e.target.value); setLogoUrlLight(e.target.value) }} style={{ ...inputStyle, flex: 1 }} />
                            <input ref={logoFileRef} type="file" accept=".png,.svg,.jpg,.jpeg,.webp" style={{ display: 'none' }} onChange={handleCoverLogoUpload} />
                            <button
                              type="button" onClick={() => logoFileRef.current?.click()} disabled={logoUploading}
                              style={{ ...presetBtn, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', flexShrink: 0, transition: 'var(--transition)' }}
                              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                            >
                              <Icon name="upload" size={13} />
                              {logoUploading ? 'Subiendo...' : 'Subir'}
                            </button>
                          </div>
                          <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 5 }}>
                            Para que se vea mejor, subilo en <strong>PNG sin fondo</strong> (transparente).
                          </p>
                          {logoUploadErr && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{logoUploadErr}</p>}
                        </div>
                      </div>

                      {/* ── Description ── */}
                      <div>
                        <label style={labelStyle}>Descripción / subtítulo (opcional)</label>
                        <textarea placeholder="Ej: Catálogo mayorista de bebidas y snacks. Precios en pesos, vigentes al..."
                          value={coverDescription} onChange={e => setCoverDescription(e.target.value)}
                          rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
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
          {step === 'preview' && brandGroups.map(({ brand, products }) => {
            const isUnbranded = brand.id === null
            const displayColor = isUnbranded ? unbrandedColor : brand.color
            return (
              <div key={brand.id ?? 'unbranded'} style={{ marginBottom: 28 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
                  paddingBottom: 10, borderBottom: `2px solid ${displayColor}`
                }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: displayColor, flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: 15, color: displayColor }}>{brand.name}</span>
                  <span style={{ fontSize: 13, color: 'var(--text3)' }}>{products.length} producto{products.length !== 1 ? 's' : ''}</span>
                  {isUnbranded && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', cursor: 'pointer', fontSize: 13, color: 'var(--text3)' }}>
                      Color
                      <input
                        type="color"
                        value={unbrandedColor}
                        onChange={e => setUnbrandedColor(e.target.value)}
                        style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', padding: 2 }}
                      />
                    </label>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                  {products.map(p => (
                    <div key={p.id} style={{
                      background: '#fff', color: '#111', borderRadius: 8,
                      padding: 10, textAlign: 'center', border: '1px solid #eee'
                    }}>
                      {p.image_url
                        ? <img src={p.image_url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'contain', marginBottom: 8, borderRadius: 4 }} onError={e => { e.target.style.display = 'none' }} />
                        : <div style={{ width: '100%', aspectRatio: '1', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', marginBottom: 8, borderRadius: 4 }}><Icon name="image" size={24} /></div>
                      }
                      <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, background: displayColor, color: '#fff', fontSize: 10, fontWeight: 700, marginBottom: 5, fontFamily: 'monospace' }}>
                        {p.sku}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>{p.name}</div>
                      {prices[p.id]?.amount && (
                        <div style={{ marginTop: 4, fontSize: 12, color: '#333', fontWeight: 700 }}>
                          {prices[p.id].currency} {prices[p.id].amount}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Pricing */}
          {step === 'pricing' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>Moneda global:</span>
                {['$', 'USD'].map(cur => (
                  <button key={cur} onClick={() => setAllCurrency(cur)} style={{
                    padding: '5px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600,
                    border: '1px solid var(--border)', background: 'var(--surface-h)', color: 'var(--text2)',
                  }}>
                    Todo {cur === '$' ? '$ UYU' : 'USD'}
                  </button>
                ))}
                <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 4 }}>Dejá el precio en blanco para no imprimirlo. Cargamos el precio guardado de cada producto; si lo cambiás acá, vale solo para este catálogo.</span>
              </div>
              {brandGroups.map(({ brand, products }) => (
                <div key={brand.id} style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: brand.color, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${brand.color}44` }}>
                    {brand.name}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {products.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 12px', background: 'var(--bg-panel)', borderRadius: 8 }}>
                        <span style={{ flex: '1 1 140px', fontSize: 14, color: 'var(--text)' }}>{p.name}</span>
                        <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{p.sku}</span>
                        <select
                          value={prices[p.id]?.currency ?? '$'}
                          onChange={e => setPrice(p.id, 'currency', e.target.value)}
                          style={{ padding: '5px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 14, cursor: 'pointer', outline: 'none' }}>
                          <option value="$">$ UYU</option>
                          <option value="USD">USD</option>
                        </select>
                        <input
                          type="number"
                          placeholder="Precio"
                          value={prices[p.id]?.amount ?? ''}
                          onChange={e => setPrice(p.id, 'amount', e.target.value)}
                          style={{ width: 100, padding: '5px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, outline: 'none', textAlign: 'right' }}
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
              <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 20 }}>
                {catalogStatus === 'shared' ? 'Este catálogo ya está compartido: al guardar, los cambios se ven enseguida en el link que ya enviaste. No hace falta volver a publicarlo.' : 'Se guarda como borrador: podés volver a abrirlo, cambiar precios y regenerar el PDF. Para que tus clientes lo vean, después usá «Compartir link» en Mis catálogos.'}
              </p>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text3)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
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
                  borderRadius: 9, color: 'var(--text)', fontSize: 15, outline: 'none',
                  marginBottom: saveErr ? 8 : 0,
                }}
              />
              {saveErr && <p style={{ fontSize: 13, color: 'var(--danger)', marginTop: 6 }}>{saveErr}</p>}

              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button onClick={() => { setStep('preview'); setSaveErr('') }} style={{
                  flex: 1, padding: '10px', borderRadius: 9, cursor: 'pointer',
                  background: 'var(--surface-h)', border: '1px solid var(--border)', color: 'var(--text2)', fontSize: 14,
                }}>
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving} style={{
                  flex: 2, padding: '10px', borderRadius: 9, cursor: saving ? 'not-allowed' : 'pointer',
                  background: 'var(--accent)', border: 'none', color: 'var(--accent-text)',
                  fontWeight: 700, fontSize: 14, opacity: saving ? 0.7 : 1,
                }}>
                  {saving ? 'Guardando...' : catalogId ? (catalogStatus === 'shared' ? 'Guardar cambios' : 'Actualizar borrador') : 'Guardar borrador'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'saving' && (
          <div style={{
            padding: isMobile ? '12px 16px' : '14px 20px', borderTop: '1px solid var(--border)',
            display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 8 : 0,
            alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', flexShrink: 0
          }}>
            {progress && <span style={{ fontSize: 14, color: 'var(--text3)' }}>{progress}</span>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: isMobile ? 'stretch' : 'flex-end' }}>
              <button onClick={onClose} style={{ ...secondaryBtn, flex: isMobile ? '1 1 auto' : 'none' }}>Cerrar</button>

              {step === 'preview' && (
                <button onClick={() => setStep('pricing')} style={{ ...secondaryBtn, flex: isMobile ? '1 1 auto' : 'none' }}>
                  $ Agregar precios
                </button>
              )}
              {step === 'pricing' && (
                <button onClick={() => setStep('preview')} style={{ ...secondaryBtn, flex: isMobile ? '1 1 auto' : 'none' }}>
                  ← Volver
                </button>
              )}

              {/* Save button — only when onSaved is provided */}
              {onSaved && (
                <button onClick={() => { setSaveName(catalogName); setStep('saving') }}
                  style={{ ...secondaryBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flex: isMobile ? '1 1 auto' : 'none' }}>
                  <Icon name="save" size={14} />
                  {catalogId ? (catalogStatus === 'shared' ? 'Guardar cambios' : 'Actualizar borrador') : 'Guardar borrador'}
                </button>
              )}

              <button onClick={handleDownload} disabled={generating} style={{
                padding: '8px 22px', background: 'var(--accent)', color: 'var(--accent-text)',
                border: 'none', borderRadius: 7, fontWeight: 700,
                cursor: generating ? 'not-allowed' : 'pointer', fontSize: 14,
                opacity: generating ? 0.7 : 1, transition: 'var(--transition)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                flex: isMobile ? '1 1 100%' : 'none',
              }}
              onMouseEnter={e => { if (!generating) e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
              >
                {generating ? progress || 'Generando...' : <><Icon name="download" size={14} /> Descargar PDF</>}
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
  borderRadius: 7, cursor: 'pointer', fontSize: 14,
}

const labelStyle = {
  display: 'block', fontSize: 12, color: 'var(--text3)', marginBottom: 5,
  fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
}
const inputStyle = {
  width: '100%', padding: '8px 12px',
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none',
}
const presetBtn = {
  padding: '3px 9px', fontSize: 12, fontWeight: 600,
  background: 'var(--surface-h)', border: '1px solid var(--border)',
  borderRadius: 6, color: 'var(--text2)', cursor: 'pointer',
}

// ── Mini live preview of the cover ──
function CoverPreview({ theme, style, color1, color2, logoUrl, clientName, companyName, website, showTagline = true }) {
  const isDark = theme === 'dark'
  const bg   = isDark ? '#09090B' : '#F8F8F8'
  const textMain  = isDark ? '#fff'          : '#111'
  const textLabel = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)'
  const textSub   = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)'
  const textWeb   = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'
  const mult = isDark ? 1 : 0.45
  const ellipsis = { maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }

  return (
    <div style={{ width: '100%', minHeight: 110, borderRadius: 8, overflow: 'hidden', position: 'relative', background: bg, border: '1px solid var(--border)' }}>
      {/* Blobs */}
      <StyleBlobs styleKey={style} color1={color1} color2={color2} mult={mult} />
      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 110, gap: 3, padding: '10px 14px' }}>
        {logoUrl
          ? <img src={logoUrl} alt="" style={{ height: 22, maxWidth: '80%', objectFit: 'contain' }} onError={e => { e.target.style.display='none' }} />
          : <span style={{ fontSize: 14, fontWeight: 700, color: textMain, ...ellipsis }}>{companyName ?? 'Empresa'}</span>
        }
        {showTagline && <span style={{ fontSize: 6.5, letterSpacing: '0.22em', color: textLabel, textTransform: 'uppercase', marginTop: 2 }}>Propuesta Comercial</span>}
        {clientName && <span style={{ fontSize: 9, color: textSub, marginTop: 1, ...ellipsis }}>{clientName}</span>}
        <span style={{ fontSize: 6.5, color: textWeb, marginTop: 3, ...ellipsis }}>{website}</span>
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
    bloom: [
      { left:'15%', top:'-25%', w:'70%', h:'70%', c: color1, a: 0.48 },
      { left:'28%', top:'-8%',  w:'44%', h:'44%', c: `#${blendHex(color1,color2)}`, a: 0.32 },
    ],
    spotlight: [
      { left:'-18%', top:'-22%', w:'58%', h:'58%', c: color1, a: 0.65 },
      { left:'-4%',  top:'-8%',  w:'34%', h:'34%', c: color2, a: 0.45 },
    ],
    mesh: [
      { left:'-10%',  top:'-12%',    w:'42%', h:'42%', c: color1, a: 0.42 },
      { left:'35%',   top:'-18%',    w:'40%', h:'40%', c: `#${blendHex(color1,color2)}`, a: 0.32 },
      { right:'-10%', top:'5%',      w:'44%', h:'44%', c: color2, a: 0.38 },
      { left:'0%',    bottom:'-18%', w:'38%', h:'38%', c: color2, a: 0.28 },
      { right:'0%',   bottom:'-12%', w:'40%', h:'40%', c: color1, a: 0.28 },
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
