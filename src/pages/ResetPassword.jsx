import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [done, setDone]           = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 6)  { setError('Mínimo 6 caracteres'); return }
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) setError(error.message)
    else setDone(true)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '36px 32px', width: 380, boxShadow: 'var(--shadow)',
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Nueva contraseña</h1>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>Elegí una contraseña segura.</p>

        {done ? (
          <div>
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: 'var(--success)', margin: 0 }}>✓ Contraseña actualizada correctamente.</p>
            </div>
            <button onClick={() => navigate('/app')} style={primaryBtn}>Ir al catálogo</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Nueva contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus style={inputStyle} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Confirmar contraseña</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={inputStyle} />
            </div>
            {error && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 14 }}>{error}</p>}
            <button type="submit" disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }
const inputStyle = { width: '100%', padding: '10px 13px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)', fontSize: 14, outline: 'none' }
const primaryBtn = { width: '100%', padding: '11px', background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'block' }
