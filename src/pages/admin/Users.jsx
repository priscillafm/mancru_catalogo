import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'

export default function Users() {
  const companyId = useAuthStore(s => s.membership?.company_id)

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_memberships')
        .select('id, role, active, joined_at, users(id, name, email)')
        .eq('company_id', companyId)
        .order('joined_at')
      return data ?? []
    },
    enabled: !!companyId,
  })

  const ROLE_LABELS = { super_admin: 'Super Admin', company_admin: 'Administrador', vendor: 'Vendedor' }
  const ROLE_COLORS = { super_admin: '#ef4444', company_admin: '#3b82f6', vendor: '#22c55e' }

  return (
    <div style={{ padding: 28, overflowY: 'auto', flex: 1 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Usuarios</h2>
      <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>
        Los usuarios se crean desde el panel Super Admin o mediante invitación por email.
      </p>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Nombre','Email','Rol','Estado','Ingresó'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--text3)' }}>Cargando...</td></tr>
            ) : members.map(m => (
              <tr key={m.id}>
                <td style={tdStyle}><strong>{m.users?.name ?? '—'}</strong></td>
                <td style={tdStyle}><span style={{ color: 'var(--text2)' }}>{m.users?.email ?? '—'}</span></td>
                <td style={tdStyle}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                    background: `${ROLE_COLORS[m.role]}22`,
                    color: ROLE_COLORS[m.role],
                  }}>
                    {ROLE_LABELS[m.role] ?? m.role}
                  </span>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }
const tdStyle = { padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, verticalAlign: 'middle' }
