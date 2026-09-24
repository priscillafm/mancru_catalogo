import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PotatoMark } from '@/components/PotatoLogo'
import Icon from '@/components/Icon'

export default function ContactPage() {
  const [params] = useSearchParams()
  const plan = params.get('plan') ?? ''
  const deletion = params.get('asunto') === 'eliminacion'
  const [form, setForm] = useState({ name: '', email: '', company: '', website: '',
    message: deletion ? 'Quiero solicitar la eliminación de mi cuenta y de los datos asociados. El email de mi cuenta es el que dejé arriba.' : '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setSending(true); setError('')
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('contact-form', { body: { ...form, plan } })
      if (fnErr) {
        let msg = ''
        try { msg = (await fnErr.context?.json?.())?.error } catch { /* sin detalle */ }
        throw new Error(msg || 'No pudimos enviar tu consulta. Probá de nuevo en unos minutos.')
      }
      if (data?.error) throw new Error(data.error)
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '16px 32px', borderBottom: '1px solid var(--border)' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: 'var(--text)' }}>
          <PotatoMark size={24} />
          <span style={{ fontSize: 16, fontWeight: 800 }}>Potato</span>
        </Link>
      </nav>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '48px 24px 80px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Contacto</h1>
        <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 28, lineHeight: 1.6 }}>
          {deletion
            ? 'Confirmá el email de tu cuenta y enviá la solicitud: la procesamos dentro de los 30 días.'
            : plan === 'enterprise'
              ? 'Contanos qué necesita tu empresa y armamos un plan a tu medida.'
              : 'Escribinos tu consulta y te respondemos por email lo antes posible.'}
        </p>

        {sent ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--success)', marginBottom: 12 }}>
              <Icon name="check-circle" size={36} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>¡Consulta enviada!</h2>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>Te respondemos al email que dejaste.</p>
            <Link to="/" style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>← Volver al inicio</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px' }}>
            <Field label="Nombre" value={form.name} onChange={set('name')} required maxLength={100} />
            <Field label="Email" type="email" value={form.email} onChange={set('email')} required maxLength={200} />
            <Field label="Empresa (opcional)" value={form.company} onChange={set('company')} maxLength={150} />
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Mensaje</label>
              <textarea value={form.message} onChange={set('message')} required minLength={10} maxLength={3000} rows={5}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'} />
            </div>

            <div aria-hidden="true" inert style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
              <input type="text" name="website" value={form.website} onChange={set('website')} tabIndex={-1} autoComplete="off" />
            </div>

            {error && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 14 }}>{error}</p>}

            <button type="submit" disabled={sending} style={{
              width: '100%', padding: '12px', background: 'var(--accent)', color: 'var(--accent-text)',
              border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14,
              cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1, transition: 'var(--transition)',
            }}>
              {sending ? 'Enviando...' : 'Enviar consulta'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function Field({ label, type = 'text', value, onChange, ...rest }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={onChange} {...rest} style={inputStyle}
        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        onBlur={e => e.target.style.borderColor = 'var(--border)'} />
    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 6,
  fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
}
const inputStyle = {
  width: '100%', padding: '10px 13px', background: 'var(--bg-panel)',
  border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)',
  fontSize: 14, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
}
