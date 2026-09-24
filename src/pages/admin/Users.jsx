import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import Icon from '@/components/Icon'

const ROLE_LABELS = { super_admin: 'Super Admin', company_admin: 'Administrador', vendor: 'Colaborador' }
const ROLE_COLORS = { super_admin: '#ef4444', company_admin: '#3b82f6', vendor: '#22c55e' }

export default function Users() {
  const companyId = useAuthStore(s => s.membership?.company_id)
  const qc = useQueryClient()
  const { canAddUser, usage, limits } = usePlanLimits()

  const [newEmail, setNewEmail]   = useState('')
  const [newPass, setNewPass]     = useState('')
  const [newRole, setNewRole]     = useState('vendor')
  const [inviteMsg, setInviteMsg] = useState('')
  const [inviting, setInviting]   = useState(false)

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_memberships')
        .select('id, role, active, joined_at, users!user_memberships_user_id_fkey(id, name, email)')
        .eq('company_id', companyId)
        .order('joined_at')
      return data ?? []
    },
    enabled: !!companyId,
  })

  async function handleInvite(e) {
    e.preventDefault()
    if (!newEmail.trim() || !newPass.trim()) return
    setInviting(true)
    setInviteMsg('')

    const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
    const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'apikey': SUPABASE_ANON,
      },
      body: JSON.stringify({
        email:      newEmail.trim(),
        password:   newPass.trim(),
        company_id: companyId,
        role:       newRole,
      }),
    })

    const result = await resp.json()
    if (result.error) {
      setInviteMsg(`Error: ${result.error}`)
    } else {
      setInviteMsg(`✓ Usuario creado — puede ingresar con ${newEmail.trim()}`)
      setNewEmail('')
      setNewPass('')
      qc.invalidateQueries(['members', companyId])
    }
    setInviting(false)
  }

  async function deleteUser(userId, memberId) {
    if (isLastActiveAdmin(memberId)) {
      alert('No podés eliminar a este usuario: es el único administrador activo de la empresa.')
      return
    }
    if (!confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return
    const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
    const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/delete-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'apikey': SUPABASE_ANON,
      },
      body: JSON.stringify({ user_id: userId }),
    })
    const result = await resp.json()
    if (result.error) {
      alert(`Error: ${result.error}`)
    } else {
      qc.invalidateQueries(['members', companyId])
    }
  }

  function isLastActiveAdmin(memberId) {
    const target = members.find(m => m.id === memberId)
    if (!target || !target.active || !['super_admin', 'company_admin'].includes(target.role)) return false
    const otherAdmins = members.filter(m =>
      m.id !== memberId && m.active && ['super_admin', 'company_admin'].includes(m.role)
    )
    return otherAdmins.length === 0
  }

  async function changeRole(memberId, newRole) {
    if (newRole !== 'company_admin' && newRole !== 'super_admin' && isLastActiveAdmin(memberId)) {
      alert('No podés quitarte (o quitarle) el rol de Administrador: es el único admin activo de la empresa. Primero asigná el rol de Administrador a otro usuario.')
      qc.invalidateQueries(['members', companyId])
      return
    }
    await supabase.from('user_memberships').update({ role: newRole }).eq('id', memberId)
    qc.invalidateQueries(['members', companyId])
  }

  async function toggleActive(memberId, current) {
    if (current && isLastActiveAdmin(memberId)) {
      alert('No podés desactivar a este usuario: es el único administrador activo de la empresa.')
      return
    }
    await supabase.from('user_memberships').update({ active: !current }).eq('id', memberId)
    qc.invalidateQueries(['members', companyId])
  }

  return (
    <div style={{ padding: 28, overflowY: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Usuarios</h2>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>
          {usage.users}/{limits.max_users === null ? '∞' : limits.max_users} usuario{limits.max_users === 1 ? '' : 's'}
        </span>
      </div>
      <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 24 }}>
        Invitá usuarios por email. Recibirán un link para ingresar a la plataforma.
      </p>

      {/* Invite form */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 20, marginBottom: 28,
        opacity: canAddUser ? 1 : 0.6,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Crear usuario</h3>
        {!canAddUser && (
          <p style={{ fontSize: 12, color: '#f97316', marginBottom: 12 }}>
            <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 6 }}><Icon name="alert" size={14} /></span>Alcanzaste el límite de {limits.max_users} usuario{limits.max_users !== 1 ? 's' : ''} de tu plan.{' '}
            <Link to="/pricing" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Actualizar plan →</Link>
          </p>
        )}
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14, lineHeight: 1.5 }}>
          Creás el usuario con una contraseña inicial y se la pasás a la persona; después puede cambiarla desde su perfil.
        </p>
        <fieldset disabled={!canAddUser} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
        <form onSubmit={e => { if (!canAddUser) { e.preventDefault(); return }; handleInvite(e) }} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>EMAIL</label>
            <input
              type="email" value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              required
              style={fieldStyle}
            />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>CONTRASEÑA</label>
            <input
              type="text" value={newPass}
              onChange={e => setNewPass(e.target.value)}
              placeholder="Contraseña inicial"
              required
              style={fieldStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>ROL</label>
            <select value={newRole} onChange={e => setNewRole(e.target.value)}
              style={{
                padding: '9px 12px', background: 'var(--bg)',
                border: '1px solid var(--border)', borderRadius: 7,
                color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer',
              }}>
              <option value="vendor">Colaborador</option>
              <option value="company_admin">Administrador</option>
            </select>
          </div>
          <button type="submit" disabled={inviting} style={{
            padding: '9px 22px', background: 'var(--accent)', color: 'var(--accent-text)',
            border: 'none', borderRadius: 7, fontWeight: 700, cursor: inviting ? 'not-allowed' : 'pointer',
            fontSize: 13, opacity: inviting ? 0.7 : 1,
          }}>
            {inviting ? 'Creando...' : 'Crear usuario'}
          </button>
        </form>
        </fieldset>
        {inviteMsg && (
          <p style={{ marginTop: 12, fontSize: 13, color: inviteMsg.startsWith('✓') ? '#22c55e' : '#ef4444' }}>
            {inviteMsg}
          </p>
        )}
      </div>

      {/* Members table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Nombre','Email','Rol','Estado','Ingresó','Acciones'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--text3)' }}>Cargando...</td></tr>
            ) : members.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--text3)' }}>Sin usuarios</td></tr>
            ) : members.map(m => (
              <tr key={m.id} style={{ opacity: m.active ? 1 : 0.5 }}>
                <td style={tdStyle}><strong>{m.users?.name ?? '—'}</strong></td>
                <td style={tdStyle}><span style={{ color: 'var(--text2)', fontSize: 12 }}>{m.users?.email ?? '—'}</span></td>
                <td style={tdStyle}>
                  <select value={m.role} onChange={e => changeRole(m.id, e.target.value)}
                    style={{
                      padding: '3px 8px', background: `${ROLE_COLORS[m.role]}22`,
                      border: `1px solid ${ROLE_COLORS[m.role]}44`,
                      borderRadius: 6, color: ROLE_COLORS[m.role],
                      fontSize: 11, fontWeight: 600, cursor: 'pointer', outline: 'none',
                    }}>
                    {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'super_admin').map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </td>
                <td style={tdStyle}>
                  <span style={{ fontSize: 12, color: m.active ? '#22c55e' : '#ef4444' }}>
                    {m.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {new Date(m.joined_at).toLocaleDateString('es-AR')}
                  </span>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => toggleActive(m.id, m.active)} style={{
                      padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                      border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)',
                    }}>
                      {m.active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button onClick={() => deleteUser(m.users?.id, m.id)} style={{
                      padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                      border: '1px solid #ef444444', background: 'transparent', color: '#ef4444',
                    }}>
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const fieldStyle = {
  width: '100%', padding: '9px 12px',
  background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none',
  boxSizing: 'border-box',
}

const thStyle = {
  padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600,
  color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px',
  borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)',
}
const tdStyle = {
  padding: '10px 14px', borderBottom: '1px solid var(--border)',
  fontSize: 13, verticalAlign: 'middle',
}
