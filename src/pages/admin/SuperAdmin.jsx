import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const PLANS = {
  basic:   { label: 'Basic',   color: '#6b7280' },
  pro:     { label: 'Pro',     color: '#6366f1' },
  empresa: { label: 'Empresa', color: '#f59e0b' },
}

export default function SuperAdmin() {
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPlan, setNewPlan] = useState('basic')
  const [saving, setSaving]   = useState(false)

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['super-companies'],
    queryFn: async () => {
      const { data: comps } = await supabase
        .from('companies')
        .select('id, name, plan, website, logo_url, created_at')
        .order('created_at', { ascending: false })

      if (!comps) return []

      const withStats = await Promise.all(comps.map(async (c) => {
        const [products, catalogs, users, views] = await Promise.all([
          supabase.from('products').select('id', { count: 'exact', head: true }).eq('company_id', c.id).is('deleted_at', null),
          supabase.from('catalogs').select('id, updated_at', { count: 'exact' }).eq('company_id', c.id).order('updated_at', { ascending: false }).limit(1),
          supabase.from('user_memberships').select('id', { count: 'exact', head: true }).eq('company_id', c.id).eq('active', true),
          supabase.from('catalog_views').select('viewed_at').eq('catalog_id', supabase.from('catalogs').select('id').eq('company_id', c.id)).limit(1),
        ])
        return {
          ...c,
          productCount: products.count ?? 0,
          catalogCount: catalogs.count ?? 0,
          userCount:    users.count    ?? 0,
          lastActivity: catalogs.data?.[0]?.updated_at ?? c.created_at,
        }
      }))
      return withStats
    },
  })

  async function changePlan(companyId, plan) {
    await supabase.from('companies').update({ plan }).eq('id', companyId)
    qc.invalidateQueries(['super-companies'])
  }

  async function createCompany() {
    if (!newName.trim()) return
    setSaving(true)
    await supabase.from('companies').insert({ name: newName.trim(), plan: newPlan })
    setSaving(false)
    setNewName(''); setNewPlan('basic'); setShowNew(false)
    qc.invalidateQueries(['super-companies'])
  }

  return (
    <div style={{ padding: 28, overflowY: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Empresas registradas</h2>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>
            {companies.length} empresa{companies.length !== 1 ? 's' : ''} en Potato
          </p>
        </div>
        <button onClick={() => setShowNew(true)} style={{
          padding: '9px 18px', background: 'var(--accent)', color: 'var(--accent-text)',
          border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>
          + Nueva empresa
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total empresas', value: companies.length },
          { label: 'Plan Pro',     value: companies.filter(c => c.plan === 'pro').length },
          { label: 'Plan Empresa', value: companies.filter(c => c.plan === 'empresa').length },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Companies list */}
      {isLoading ? (
        [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12, marginBottom: 10 }} />)
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {companies.map(c => {
            const plan = PLANS[c.plan] ?? PLANS.basic
            return (
              <div key={c.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: 16,
              }}>
                {/* Logo / inicial */}
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: 'var(--surface-h)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontWeight: 700, fontSize: 16, color: 'var(--text2)',
                  overflow: 'hidden',
                }}>
                  {c.logo_url
                    ? <img src={c.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : c.name[0].toUpperCase()
                  }
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3, display: 'flex', gap: 12 }}>
                    <span>{c.productCount} productos</span>
                    <span>{c.catalogCount} catálogos</span>
                    <span>{c.userCount} usuario{c.userCount !== 1 ? 's' : ''}</span>
                    <span>Actividad: {new Date(c.lastActivity).toLocaleDateString('es-UY', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>

                {/* Plan selector */}
                <select
                  value={c.plan ?? 'basic'}
                  onChange={e => changePlan(c.id, e.target.value)}
                  style={{
                    padding: '5px 10px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                    border: `1px solid ${plan.color}44`, background: `${plan.color}11`,
                    color: plan.color, cursor: 'pointer', outline: 'none',
                  }}
                >
                  {Object.entries(PLANS).map(([key, p]) => (
                    <option key={key} value={key}>{p.label}</option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      )}

      {/* New company modal */}
      {showNew && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={e => { if (e.target === e.currentTarget) setShowNew(false) }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 16, padding: '28px',
            width: '100%', maxWidth: 400, border: '1px solid var(--border)',
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Nueva empresa</h3>

            <label style={labelStyle}>Nombre de la empresa</label>
            <input
              autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Ej: Distribuidora García"
              style={inputStyle}
            />

            <label style={{ ...labelStyle, marginTop: 14 }}>Plan</label>
            <select value={newPlan} onChange={e => setNewPlan(e.target.value)} style={inputStyle}>
              {Object.entries(PLANS).map(([key, p]) => (
                <option key={key} value={key}>{p.label}</option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              <button onClick={() => setShowNew(false)} style={{
                flex: 1, padding: '10px', borderRadius: 9,
                background: 'var(--surface-h)', border: '1px solid var(--border)',
                color: 'var(--text2)', fontSize: 13, cursor: 'pointer',
              }}>Cancelar</button>
              <button onClick={createCompany} disabled={saving || !newName.trim()} style={{
                flex: 2, padding: '10px', borderRadius: 9,
                background: 'var(--accent)', border: 'none',
                color: 'var(--accent-text)', fontWeight: 700, fontSize: 13,
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
              }}>
                {saving ? 'Creando...' : 'Crear empresa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 6,
  fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
}
const inputStyle = {
  width: '100%', padding: '10px 13px', background: 'var(--bg-panel)',
  border: '1px solid var(--border)', borderRadius: 9,
  color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
}
