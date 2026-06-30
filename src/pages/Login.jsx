import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn } from '@/lib/auth'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg)'
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '32px 28px', width: 360
      }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>
          Iniciar sesión
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 24 }}>
          Plataforma de catálogos comerciales
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 5 }}>
              Email
            </label>
            <input
              type="email" required autoFocus
              value={email} onChange={e => setEmail(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 5 }}>
              Contraseña
            </label>
            <input
              type="password" required
              value={password} onChange={e => setPassword(e.target.value)}
              style={inputStyle}
            />
          </div>

          {error && (
            <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 14 }}>{error}</p>
          )}

          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '8px 12px',
  background: 'var(--bg-panel)', border: '1px solid var(--border)',
  borderRadius: 7, color: 'var(--text)', fontSize: 14, outline: 'none',
}

const btnStyle = {
  width: '100%', padding: '10px',
  background: 'var(--accent)', color: 'var(--accent-text)',
  border: 'none', borderRadius: 7, fontWeight: 700,
  fontSize: 14, cursor: 'pointer',
}
