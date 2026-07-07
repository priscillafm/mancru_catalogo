import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { signOut } from '@/lib/auth'

export default function ProfilePage() {
  const navigate  = useNavigate()
  const membership = useAuthStore(s => s.membership)
  const user       = useAuthStore(s => s.user)
  const loadMembership = useAuthStore(s => s.loadMembership)

  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass]         = useState('')
  const [confirm, setConfirm]         = useState('')
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState('')
  const [loading, setLoading]         = useState(false)

  const [whatsapp, setWhatsapp]       = useState(user?.whatsapp ?? '')
  const [wappSaving, setWappSaving]   = useState(false)
  const [wappMsg, setWappMsg]         = useState('')

  async function handleSaveWhatsapp(e) {
    e.preventDefault()
    setWappSaving(true); setWappMsg('')
    const { error } = await supabase.from('users').update({ whatsapp: whatsapp.trim() || null }).eq('id', user.id)
    setWappSaving(false)
    if (error) setWappMsg('Error al guardar')
    else { setWappMsg('Guardado'); loadMembership(user.id) }
  }

  const ROLE_LABELS = { super_admin: 'Super Admin', company_admin: 'Administrador', vendor: 'Vendedor' }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (newPass !== confirm) { setError('Las contraseñas no coinciden'); return }
    if (newPass.length < 6)  { setError('Mínimo 6 caracteres'); return }
    setError(''); setSuccess(''); setLoading(true)

    // Re-authenticate first
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user?.email, password: currentPass,
    })
    if (signInErr) { setError('Contraseña actual incorrecta'); setLoading(false); return }

    const { error: updateErr } = await supabase.auth.updateUser({ password: newPass })
    setLoading(false)
    if (updateErr) setError(updateErr.message)
    else { setSuccess('Contraseña actualizada'); setCurrentPass(''); setNewPass(''); setConfirm('') }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', overflowY: 'auto', padding: '32px 16px 48px' }}>
      <div style={{ width: '100%', maxWidth: 440, margin: '0 auto' }}>

        {/* Back */}
        <button onClick={() => navigate('/app')} style={{
          background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13,
          cursor: 'pointer', marginBottom: 16, padding: 0, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          ← Volver al catálogo
        </button>

        {/* Profile card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 28px 24px', boxShadow: 'var(--shadow)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'var(--accent)', color: 'var(--accent-text)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 700, flexShrink: 0,
            }}>
              {(user?.name ?? user?.email ?? '?')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{user?.name ?? user?.email}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{user?.email}</div>
              <span style={{
                display: 'inline-block', marginTop: 5, padding: '2px 8px', borderRadius: 999,
                fontSize: 10, fontWeight: 700, background: 'var(--surface-h)', color: 'var(--text2)',
              }}>
                {ROLE_LABELS[membership?.role] ?? membership?.role}
              </span>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>EMPRESA</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{membership?.companies?.name ?? '—'}</div>
          </div>
        </div>

        {/* WhatsApp */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px', boxShadow: 'var(--shadow)', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>WhatsApp de ventas</h2>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 18 }}>
            Los clientes te contactarán a este número cuando armen un pedido desde el catálogo.
          </p>
          <form onSubmit={handleSaveWhatsapp}>
            <Field label="Número (ej: 59899123456)" type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
            {wappMsg && <p style={{ fontSize: 12, color: wappMsg === 'Guardado' ? 'var(--success)' : 'var(--danger)', marginBottom: 10 }}>{wappMsg === 'Guardado' ? '✓ ' : ''}{wappMsg}</p>}
            <button type="submit" disabled={wappSaving} style={{
              width: '100%', padding: '10px', background: 'var(--accent)', color: 'var(--accent-text)',
              border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13,
              cursor: wappSaving ? 'not-allowed' : 'pointer', opacity: wappSaving ? 0.7 : 1,
            }}>
              {wappSaving ? 'Guardando...' : 'Guardar WhatsApp'}
            </button>
          </form>
        </div>

        {/* Change password */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px', boxShadow: 'var(--shadow)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>Cambiar contraseña</h2>
          <form onSubmit={handleChangePassword}>
            <Field label="Contraseña actual" type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} />
            <Field label="Nueva contraseña" type="password" value={newPass} onChange={e => setNewPass(e.target.value)} />
            <Field label="Confirmar nueva contraseña" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />

            {error   && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>{error}</p>}
            {success && <p style={{ fontSize: 12, color: 'var(--success)', marginBottom: 12 }}>✓ {success}</p>}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '10px', background: 'var(--accent)', color: 'var(--accent-text)',
              border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
            }}>
              {loading ? 'Guardando...' : 'Actualizar contraseña'}
            </button>
          </form>
        </div>

        <button onClick={() => signOut()} style={{
          width: '100%', marginTop: 12, padding: '10px',
          background: 'transparent', border: '1px solid var(--border)',
          borderRadius: 9, color: 'var(--text3)', fontSize: 13, cursor: 'pointer',
        }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

function Field({ label, type, value, onChange }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </label>
      <input type={type} value={value} onChange={onChange} required
        style={{ width: '100%', padding: '10px 13px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)', fontSize: 14, outline: 'none' }}
      />
    </div>
  )
}
