import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PotatoMark } from '@/components/PotatoLogo'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1: cuenta, 2: empresa
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [company, setCompany]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (step === 1) { setStep(2); return }

    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    setLoading(true); setError('')
    try {
      // 1. Crear usuario en Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { company_name: company.trim() } }
      })
      if (authErr) throw authErr

      const userId = authData.user?.id
      if (!userId) throw new Error('No se pudo crear el usuario')

      // Forzar sesión activa haciendo signIn inmediatamente
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInErr) throw new Error('Usuario creado pero no se pudo iniciar sesión: ' + signInErr.message)

      // 2. Crear empresa — generamos el ID acá para no necesitar SELECT después (evita problema de RLS)
      const companyId = crypto.randomUUID()
      const slug = company.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now()
      const { error: companyErr } = await supabase
        .from('companies')
        .insert({ id: companyId, name: company.trim(), slug, plan: 'basic' })
      if (companyErr) throw companyErr

      // 3. Crear usuario en tabla pública
      await supabase.from('users').upsert({
        id: userId,
        email: email.trim(),
        name: email.split('@')[0],
      })

      // 4. Crear membresía
      const { error: memberErr } = await supabase.from('user_memberships').insert({
        user_id:    userId,
        company_id: companyId,
        role:       'company_admin',
        active:     true,
      })
      if (memberErr) throw memberErr

      // Redirigir al onboarding
      navigate('/onboarding')
    } catch (err) {
      setError(err.message ?? 'Error al crear la cuenta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, justifyContent: 'center' }}>
          <PotatoMark size={28} />
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Potato</span>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '32px 28px', boxShadow: 'var(--shadow)',
        }}>
          {/* Progress */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
            {[1, 2].map(s => (
              <div key={s} style={{
                flex: 1, height: 3, borderRadius: 99,
                background: s <= step ? 'var(--accent)' : 'var(--border)',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>

          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
            {step === 1 ? 'Creá tu cuenta' : 'Nombre de tu empresa'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>
            {step === 1
              ? 'Empezá gratis. No necesitás tarjeta de crédito.'
              : 'Así va a aparecer en tus catálogos.'}
          </p>

          <form onSubmit={handleSubmit}>
            {step === 1 ? (
              <>
                <Field label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vos@tuempresa.com" />
                <Field label="Contraseña" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
              </>
            ) : (
              <Field label="Nombre de la empresa" type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="Ej: Distribuidora García" autoFocus />
            )}

            {error && (
              <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 14 }}>{error}</p>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '12px',
              background: 'var(--accent)', color: 'var(--accent-text)',
              border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              marginTop: 4,
            }}>
              {loading ? 'Creando cuenta...' : step === 1 ? 'Continuar →' : 'Crear cuenta gratis'}
            </button>
          </form>

          {step === 1 && (
            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text3)', marginTop: 16 }}>
              ¿Ya tenés cuenta?{' '}
              <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                Iniciá sesión
              </Link>
            </p>
          )}

          {step === 2 && (
            <button onClick={() => setStep(1)} style={{
              width: '100%', marginTop: 10, padding: '10px',
              background: 'transparent', border: 'none',
              color: 'var(--text3)', fontSize: 13, cursor: 'pointer',
            }}>
              ← Volver
            </button>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: 16 }}>
          Al registrarte aceptás los términos de uso y la política de privacidad.
        </p>
      </div>
    </div>
  )
}

function Field({ label, type, value, onChange, placeholder, autoFocus }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block', fontSize: 11, color: 'var(--text3)',
        marginBottom: 6, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        {label}
      </label>
      <input
        type={type} value={value} onChange={onChange}
        placeholder={placeholder} autoFocus={autoFocus} required
        style={{
          width: '100%', padding: '10px 13px',
          background: 'var(--bg-panel)', border: '1px solid var(--border)',
          borderRadius: 9, color: 'var(--text)', fontSize: 14,
          outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.15s',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}
      />
    </div>
  )
}
