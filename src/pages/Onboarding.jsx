import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { PotatoMark } from '@/components/PotatoLogo'
import Icon from '@/components/Icon'

const STEPS = [
  { id: 1, label: 'Bienvenida' },
  { id: 2, label: 'Tu marca' },
  { id: 3, label: 'Primer producto' },
  { id: 4, label: 'Listo' },
]

export default function OnboardingPage() {
  const navigate   = useNavigate()
  const membership = useAuthStore(s => s.membership)

  const [step, setStep]           = useState(1)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [companyId, setCompanyId] = useState(membership?.company_id ?? null)
  const [loadingMembership, setLoadingMembership] = useState(!membership?.company_id)

  // Query directa: el store puede tener membership null si onAuthStateChange
  // corrió antes de que Register insertara la membresía
  useEffect(() => {
    if (membership?.company_id) {
      setCompanyId(membership.company_id)
      setLoadingMembership(false)
      return
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoadingMembership(false); return }
      supabase
        .from('user_memberships')
        .select('company_id')
        .eq('user_id', user.id)
        .eq('active', true)
        .limit(1)
        .single()
        .then(({ data }) => {
          if (data?.company_id) setCompanyId(data.company_id)
          setLoadingMembership(false)
        })
    })
  }, [])

  // Step 2 — marca
  const [brandName, setBrandName]   = useState('')
  const [brandColor, setBrandColor] = useState('#6366f1')

  // Step 3 — producto
  const [productName, setProductName] = useState('')
  const [productSku, setProductSku]   = useState('')
  const [productPrice, setProductPrice] = useState('')

  if (loadingMembership) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text3)', fontSize: 14 }}>
      Cargando...
    </div>
  )

  async function handleStep2() {
    if (!companyId) { setError('Error: no se encontró la empresa. Recargá la página.'); return }
    // Si hay nombre de marca, la crea; si no, pasa igual (productos genéricos)
    if (brandName.trim()) {
      setSaving(true); setError('')
      const slug = brandName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now()
      const { error: err } = await supabase.from('brands').insert({
        company_id: companyId,
        name:       brandName.trim(),
        slug,
        color:      brandColor,
        active:     true,
      })
      setSaving(false)
      if (err) { setError(err.message); return }
    }
    setStep(3)
  }

  async function handleStep3() {
    if (!productName.trim()) { setError('Ingresá el nombre del producto'); return }
    setSaving(true); setError('')

    // Si el usuario creó una marca en el paso 2, la asociamos
    let brandId = null
    if (brandName.trim()) {
      const { data: brand } = await supabase
        .from('brands')
        .select('id')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      brandId = brand?.id ?? null
    }

    const { error: err } = await supabase.from('products').insert({
      company_id: companyId,
      brand_id:   brandId,
      name:       productName.trim(),
      sku:        productSku.trim() || `SKU-${Date.now()}`,
      price:      parseFloat(productPrice) || null,
      active:     true,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setStep(4)
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, justifyContent: 'center' }}>
          <PotatoMark size={24} />
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Potato</span>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
          {STEPS.map(s => (
            <div key={s.id} style={{
              flex: 1, height: 3, borderRadius: 99,
              background: s.id <= step ? 'var(--accent)' : 'var(--border)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '32px 28px', boxShadow: 'var(--shadow)',
        }}>

          {/* Step 1 — Bienvenida */}
          {step === 1 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 16, color: 'var(--accent)' }}><Icon name="welcome" size={48} /></div>
              <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
                Bienvenido a Potato
              </h1>
              <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 28 }}>
                En menos de 5 minutos vas a tener tu primer catálogo listo para compartir.
                <br /><br />
                Empezamos con lo básico: tu marca y un producto.
              </p>
              <button onClick={() => setStep(2)} style={primaryBtn}>
                Empezar →
              </button>
            </div>
          )}

          {/* Step 2 — Marca */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Tu primera marca <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text3)' }}>(opcional)</span></h2>
              <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>
                Si vendés productos de varias marcas, podés organizarlos así. Si preferís productos genéricos, dejalo en blanco.
              </p>

              <Field label="Nombre de la marca" value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="Ej: Nike, Línea Premium, Marca XYZ" autoFocus />

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Color de la marca</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)}
                    style={{ width: 44, height: 44, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', padding: 2 }} />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {['#6366f1','#f97316','#22c55e','#ec4899','#06b6d4','#f59e0b','#111827'].map(c => (
                      <button key={c} onClick={() => setBrandColor(c)} style={{
                        width: 24, height: 24, borderRadius: 6, border: brandColor === c ? '2px solid var(--text)' : '2px solid transparent',
                        background: c, cursor: 'pointer', padding: 0,
                      }} />
                    ))}
                  </div>
                </div>
              </div>

              {error && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>{error}</p>}

              <button onClick={handleStep2} disabled={saving} style={primaryBtn}>
                {saving ? 'Guardando...' : brandName.trim() ? 'Crear marca y continuar →' : 'Continuar sin marca →'}
              </button>
            </div>
          )}

          {/* Step 3 — Producto */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Tu primer producto</h2>
              <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>
                Solo lo básico. Después podés cargar todos desde un Excel.
              </p>

              <Field label="Nombre del producto" value={productName} onChange={e => setProductName(e.target.value)} placeholder="Ej: Remera Básica Blanca" autoFocus />
              <Field label="SKU (opcional)" value={productSku} onChange={e => setProductSku(e.target.value)} placeholder="Ej: REM-001" />
              <Field label="Precio (opcional)" value={productPrice} onChange={e => setProductPrice(e.target.value)} placeholder="Ej: 1500" type="number" />

              {error && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>{error}</p>}

              <button onClick={handleStep3} disabled={saving} style={primaryBtn}>
                {saving ? 'Guardando...' : 'Continuar →'}
              </button>
              <button onClick={() => setStep(4)} style={skipBtn}>
                Saltar por ahora
              </button>
            </div>
          )}

          {/* Step 4 — Listo */}
          {step === 4 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 16, color: 'var(--accent)' }}><Icon name="celebrate" size={48} /></div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
                ¡Todo listo!
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 28 }}>
                Ya tenés tu primera marca y producto cargados.
                Ahora creá tu primer catálogo y compartilo con un cliente.
              </p>
              <button onClick={() => navigate('/app')} style={primaryBtn}>
                Ir al catálogo →
              </button>
              <button onClick={() => navigate('/admin/products')} style={skipBtn}>
                Cargar más productos
              </button>
            </div>
          )}
        </div>

        {step > 1 && step < 4 && (
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text3)', marginTop: 16 }}>
            Paso {step} de {STEPS.length}
          </p>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, autoFocus, type = 'text' }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type} value={value} onChange={onChange}
        placeholder={placeholder} autoFocus={autoFocus}
        style={{
          width: '100%', padding: '10px 13px',
          background: 'var(--bg-panel)', border: '1px solid var(--border)',
          borderRadius: 9, color: 'var(--text)', fontSize: 14,
          outline: 'none', boxSizing: 'border-box',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}
      />
    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: 11, color: 'var(--text3)',
  marginBottom: 6, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
}
const primaryBtn = {
  width: '100%', padding: '12px', background: 'var(--accent)',
  color: 'var(--accent-text)', border: 'none', borderRadius: 10,
  fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'block',
}
const skipBtn = {
  width: '100%', marginTop: 10, padding: '10px',
  background: 'transparent', border: 'none',
  color: 'var(--text3)', fontSize: 13, cursor: 'pointer',
}
