import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signIn } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { PotatoLockup } from '@/components/PotatoLogo'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [mode, setMode]         = useState('login') // 'login' | 'reset'
  const [resetSent, setResetSent] = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/app')
    } catch (err) {
      setError('Email o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  async function handleReset(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) setError(error.message)
    else setResetSent(true)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg)',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '36px 32px', width: 380,
        boxShadow: 'var(--shadow)',
        animation: 'fadeUp 0.3s ease',
      }}>
        {/* Logo / title */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ marginBottom: 18 }}>
            <PotatoLockup height={34} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
            Catálogos comerciales
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text)' }}>
            {mode === 'login' ? 'Bienvenido' : 'Recuperar contraseña'}
          </h1>
        </div>

        {/* Reset sent */}
        {resetSent ? (
          <div>
            <div style={{
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 10, padding: '14px 16px', marginBottom: 20,
            }}>
              <p style={{ fontSize: 13, color: 'var(--success)', margin: 0, lineHeight: 1.5 }}>
                ✓ Te enviamos un email a <strong>{email}</strong> con el link para restablecer tu contraseña.
              </p>
            </div>
            <button onClick={() => { setMode('login'); setResetSent(false) }} style={linkBtn}>
              ← Volver al login
            </button>
          </div>
        ) : mode === 'login' ? (
          <form onSubmit={handleLogin}>
            <Field label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
            <Field label="Contraseña" type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ marginBottom: 8 }} />

            <div style={{ textAlign: 'right', marginBottom: 20 }}>
              <button type="button" onClick={() => { setMode('reset'); setError('') }} style={linkBtn}>
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {error && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 14 }}>{error}</p>}

            <button type="submit" disabled={loading} style={primaryBtn(loading)}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>

            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text3)', marginTop: 16 }}>
              ¿No tenés cuenta?{' '}
              <Link to="/register" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                Registrarse gratis
              </Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleReset}>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 18, lineHeight: 1.5 }}>
              Ingresá tu email y te enviamos un link para restablecer tu contraseña.
            </p>
            <Field label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus />

            {error && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 14 }}>{error}</p>}

            <button type="submit" disabled={loading} style={primaryBtn(loading)}>
              {loading ? 'Enviando...' : 'Enviar link'}
            </button>
            <button type="button" onClick={() => { setMode('login'); setError('') }}
              style={{ ...primaryBtn(false), marginTop: 8, background: 'var(--surface-h)', color: 'var(--text2)' }}>
              Cancelar
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function Field({ label, type, value, onChange, autoFocus, style: extraStyle }) {
  return (
    <div style={{ marginBottom: 14, ...extraStyle }}>
      <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </label>
      <input type={type} value={value} onChange={onChange} autoFocus={autoFocus} required
        style={{
          width: '100%', padding: '10px 13px',
          background: 'var(--bg-panel)', border: '1px solid var(--border)',
          borderRadius: 9, color: 'var(--text)', fontSize: 14, outline: 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      />
    </div>
  )
}

const primaryBtn = (loading) => ({
  width: '100%', padding: '11px',
  background: 'var(--accent)', color: 'var(--accent-text)',
  border: 'none', borderRadius: 9, fontWeight: 700,
  fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
  opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s',
  display: 'block',
})

const linkBtn = {
  background: 'none', border: 'none', color: 'var(--text3)',
  fontSize: 12, cursor: 'pointer', padding: 0,
  textDecoration: 'underline', textUnderlineOffset: 3,
}
