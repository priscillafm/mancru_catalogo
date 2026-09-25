import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mobile
}

export default function Settings() {
  const isMobile    = useIsMobile()
  const membership  = useAuthStore(s => s.membership)
  const companyId   = membership?.company_id
  const fileRef     = useRef()

  const [form, setForm]         = useState({ name: '', website: '', logo_url: '' })
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (!companyId) return
    supabase.from('companies').select('name, website, logo_url').eq('id', companyId).single()
      .then(({ data }) => { if (data) setForm({ name: data.name ?? '', website: data.website ?? '', logo_url: data.logo_url ?? '' }) })
  }, [companyId])

  const MAX_LOGO_BYTES = 3 * 1024 * 1024 // 3MB
  const ALLOWED_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp']

  async function handleLogoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setError('')

    if (!companyId) {
      setError('Tu perfil de empresa todavía se está cargando. Esperá unos segundos y volvé a intentar.')
      e.target.value = ''
      return
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(`Formato no soportado (${file.type || 'desconocido'}). Usá SVG, PNG, JPG o WEBP.`)
      e.target.value = ''
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError(`El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)}MB — el máximo permitido es ${MAX_LOGO_BYTES / 1024 / 1024}MB.`)
      e.target.value = ''
      return
    }

    setUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${companyId}/company-logo.${ext}`
      const { error: upErr } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path)
      setForm(f => ({ ...f, logo_url: publicUrl }))
    } catch (err) {
      if (/row-level security/i.test(err.message)) {
        setError('No tenés permisos para subir archivos a esta empresa. Cerrá sesión y volvé a entrar; si el problema persiste, contactá a soporte.')
      } else {
        setError('Error subiendo logo: ' + err.message)
      }
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const { error: err } = await supabase.from('companies')
        .update({ name: form.name, website: form.website, logo_url: form.logo_url || null })
        .eq('id', companyId)
      if (err) throw err
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError('Error guardando: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: isMobile ? 16 : 28, overflowY: 'auto', flex: 1, maxWidth: 560 }}>
      <h2 style={{ fontSize: 19, fontWeight: 700, marginBottom: 6 }}>Configuración de empresa</h2>
      <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 28 }}>
        Estos datos aparecen en el encabezado del catálogo PDF.
      </p>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, color: '#ef4444', fontSize: 14, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Logo */}
        <div>
          <label style={labelStyle}>Logo de empresa</label>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
            Se muestra en el centro del encabezado del PDF. SVG blanco recomendado.
            Cualquier forma sirve (cuadrado o rectangular) — se adapta solo, sin deformarse.
          </p>
          <input ref={fileRef} type="file" accept=".svg,.png,.jpg,.jpeg,.webp" style={{ display: 'none' }} onChange={handleLogoUpload} />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{
              width: 120, height: 48, background: '#09090B', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--border)', flexShrink: 0,
            }}>
              {form.logo_url
                ? <img src={form.logo_url} alt="logo" style={{ maxWidth: 110, maxHeight: 40, objectFit: 'contain' }} />
                : <span style={{ fontSize: 12, color: '#555' }}>Sin logo</span>
              }
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={() => fileRef.current?.click()} disabled={uploading} style={btnSecondary}>
                {uploading ? 'Subiendo...' : form.logo_url ? 'Cambiar logo' : 'Subir logo'}
              </button>
              {form.logo_url && (
                <button onClick={() => setForm(f => ({ ...f, logo_url: '' }))} style={{ ...btnSecondary, color: '#ef4444', borderColor: 'rgba(239,68,68,.3)', fontSize: 12 }}>
                  Quitar logo
                </button>
              )}
            </div>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />

        {/* Name */}
        <div>
          <label style={labelStyle}>Nombre de empresa</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            style={inputStyle} placeholder="Mi empresa" />
        </div>

        {/* Website */}
        <div>
          <label style={labelStyle}>Sitio web</label>
          <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
            style={inputStyle} placeholder="www.tuempresa.com" />
          <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
            Aparece en la esquina derecha del encabezado PDF.
          </p>
        </div>

        <button onClick={handleSave} disabled={saving} style={btnPrimary}>
          {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}

const labelStyle   = { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }
const inputStyle   = { width: '100%', padding: '9px 12px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
const btnPrimary   = { padding: '10px 22px', background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 14, cursor: 'pointer', alignSelf: 'flex-start' }
const btnSecondary = { padding: '7px 14px', background: 'var(--surface-h)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, cursor: 'pointer' }
