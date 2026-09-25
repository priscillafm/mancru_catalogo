import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { plural } from '@/utils/format'
import Icon from '@/components/Icon'

const PLANS = {
  free:       { label: 'Free',       color: '#6b7280' },
  pro:        { label: 'Pro',        color: '#6366f1' },
  enterprise: { label: 'Enterprise', color: '#f59e0b' },
}

const TABS = [
  { key: 'resumen',  label: 'Resumen' },
  { key: 'empresas', label: 'Empresas' },
  { key: 'soporte',  label: 'Soporte' },
]

const daysAgo = (date) => (Date.now() - new Date(date).getTime()) / 86400000
const fmtDate = (date) => new Date(date).toLocaleDateString('es-UY', { day: '2-digit', month: 'short', year: 'numeric' })

export default function SuperAdmin() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('resumen')

  const { data: companies = [], isLoading, error } = useQuery({
    queryKey: ['super-companies'],
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_companies')
      if (error) throw error
      return data ?? []
    },
  })

  const { data: support = [] } = useQuery({
    queryKey: ['super-support'],
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_support_list')
      if (error) throw error
      return data ?? []
    },
  })

  const newSupport = support.filter(m => m.status === 'new').length

  return (
    <div style={{ padding: 28, overflowY: 'auto', flex: 1 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 19, fontWeight: 700 }}>Superadministración</h2>
        <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 3 }}>
          Cómo se usa Potato en general. Solo ves cantidades y nombres de empresa: no los mails, productos ni precios de tus clientes.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 22, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 600, color: tab === t.key ? 'var(--text)' : 'var(--text3)',
            borderBottom: `2px solid ${tab === t.key ? 'var(--accent)' : 'transparent'}`, marginBottom: -1,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {t.label}
            {t.key === 'soporte' && newSupport > 0 && (
              <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '1px 7px' }}>{newSupport}</span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, color: '#ef4444', fontSize: 14, marginBottom: 16 }}>
          No pudimos cargar los datos: {error.message}
        </div>
      )}

      {isLoading ? (
        [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12, marginBottom: 10 }} />)
      ) : tab === 'resumen' ? (
        <Overview companies={companies} support={support} />
      ) : tab === 'empresas' ? (
        <Companies companies={companies} onChanged={() => qc.invalidateQueries({ queryKey: ['super-companies'] })} />
      ) : (
        <Support support={support} onChanged={() => qc.invalidateQueries({ queryKey: ['super-support'] })} />
      )}
    </div>
  )
}

// ── Resumen: números clave, embudo de activación y oportunidades de mejora ──
function Overview({ companies, support }) {
  const total = companies.length
  const recent = companies.filter(c => daysAgo(c.created_at) <= 7).length
  const paid = companies.filter(c => c.plan === 'pro' || c.plan === 'enterprise').length
  const views = companies.reduce((n, c) => n + c.views_30d, 0)
  const orders = companies.reduce((n, c) => n + c.orders_30d, 0)
  const unanswered = support.filter(m => m.status === 'new').length

  const funnel = [
    { label: 'Empresas registradas', n: total },
    { label: 'Cargaron productos', n: companies.filter(c => c.products_count > 0).length },
    { label: 'Armaron un catálogo', n: companies.filter(c => c.catalogs_count > 0).length },
    { label: 'Compartieron un link', n: companies.filter(c => c.shared_catalogs > 0).length },
    { label: 'Recibieron visitas (30 días)', n: companies.filter(c => c.views_30d > 0).length },
    { label: 'Recibieron pedidos (30 días)', n: companies.filter(c => c.orders_30d > 0).length },
  ]

  const names = (list) => list.slice(0, 4).map(c => c.company_name).join(', ') + (list.length > 4 ? ' y ' + (list.length - 4) + ' más' : '')
  const insights = [
    { list: companies.filter(c => c.products_count === 0 && daysAgo(c.created_at) > 2),
      text: 'se registraron hace más de 2 días y no cargaron ningún producto', hint: 'Revisá si el alta o la carga inicial se traba.' },
    { list: companies.filter(c => c.products_count > 0 && c.catalogs_count === 0),
      text: 'tienen productos pero no armaron ningún catálogo', hint: 'Puede que no encuentren cómo armar el catálogo.' },
    { list: companies.filter(c => c.catalogs_count > 0 && c.shared_catalogs === 0),
      text: 'armaron un catálogo pero no lo compartieron', hint: 'Puede que "Guardar borrador" y "Compartir link" no queden claros.' },
    { list: companies.filter(c => !c.has_whatsapp),
      text: 'no configuraron WhatsApp para recibir pedidos', hint: 'Sus clientes solo pueden pedir por email.' },
    { list: companies.filter(c => c.shared_catalogs > 0 && c.views_30d === 0),
      text: 'compartieron un link pero nadie lo abrió en 30 días', hint: 'Quizás no saben cómo enviarlo a sus clientes.' },
    { list: companies.filter(c => c.views_30d > 0 && c.orders_30d === 0),
      text: 'reciben visitas pero ningún pedido', hint: 'Mirá si el flujo del pedido en el celular es claro.' },
    { list: companies.filter(c => c.products_count >= 5 && c.products_with_image / c.products_count < 0.5),
      text: 'tienen menos de la mitad de sus productos con foto', hint: 'Los catálogos sin fotos venden menos.' },
  ].filter(i => i.list.length > 0)

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Empresas', value: total, sub: recent + ' nuevas en 7 días' },
          { label: 'Planes pagos', value: paid, sub: 'Pro o Enterprise' },
          { label: 'Visitas (30 días)', value: views },
          { label: 'Pedidos (30 días)', value: orders },
          { label: 'Consultas sin responder', value: unanswered, alert: unanswered > 0 },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid ' + (s.alert ? 'var(--danger)' : 'var(--border)'), borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 27, fontWeight: 700 }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      <h3 style={sectionTitle}>Embudo de activación</h3>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 24 }}>
        {funnel.map(step => (
          <div key={step.label} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: 'var(--text2)' }}>{step.label}</span>
              <span style={{ fontWeight: 700 }}>{step.n}</span>
            </div>
            <div style={{ height: 6, background: 'var(--bg-panel)', borderRadius: 99 }}>
              <div style={{ height: '100%', width: (total ? Math.round((step.n / total) * 100) : 0) + '%', background: 'var(--accent)', borderRadius: 99, transition: 'width .4s' }} />
            </div>
          </div>
        ))}
      </div>

      <h3 style={sectionTitle}>Oportunidades de mejora</h3>
      {insights.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--text3)' }}>Por ahora no hay nada para señalar. Cuando se registren más empresas, acá vas a ver dónde se traba la gente.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {insights.map(i => (
            <div key={i.text} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ color: '#f97316', display: 'flex', marginTop: 2 }}><Icon name="alert" size={16} /></span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{plural(i.list.length, 'empresa')}: {i.text}</div>
                <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>{names(i.list)}. {i.hint}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ── Empresas: uso agregado, sin datos personales ──
function Companies({ companies, onChanged }) {
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPlan, setNewPlan] = useState('free')
  const [saving, setSaving]   = useState(false)

  async function changePlan(companyId, plan) {
    await supabase.from('companies').update({ plan }).eq('id', companyId)
    onChanged()
  }

  async function createCompany() {
    if (!newName.trim()) return
    setSaving(true)
    await supabase.from('companies').insert({ name: newName.trim(), plan: newPlan })
    setSaving(false)
    setNewName(''); setNewPlan('free'); setShowNew(false)
    onChanged()
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ fontSize: 14, color: 'var(--text3)' }}>{plural(companies.length, 'empresa')} en Potato</p>
        <button onClick={() => setShowNew(true)} style={primaryBtn}>+ Nueva empresa</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {companies.map(c => {
          const plan = PLANS[c.plan] ?? PLANS.free
          return (
            <div key={c.company_id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{c.company_name}</div>
                <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span>{plural(c.users_count, 'usuario')}</span>
                  <span>{plural(c.products_count, 'producto')} ({c.products_with_image} con foto, {c.products_with_price} con precio)</span>
                  <span>{plural(c.catalogs_count, 'catálogo')} ({c.shared_catalogs} compartidos)</span>
                  <span>{plural(c.views_30d, 'visita')} · {plural(c.orders_30d, 'pedido')} (30 días)</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ color: c.has_whatsapp ? '#22c55e' : '#f97316' }}>{c.has_whatsapp ? 'WhatsApp configurado' : 'Sin WhatsApp'}</span>
                  <span>Alta: {fmtDate(c.created_at)}</span>
                  <span>Última actividad: {fmtDate(c.last_activity)}</span>
                </div>
              </div>
              <select value={c.plan ?? 'free'} onChange={e => changePlan(c.company_id, e.target.value)} style={{
                padding: '5px 10px', borderRadius: 7, fontSize: 13, fontWeight: 700,
                border: '1px solid ' + plan.color + '44', background: plan.color + '11', color: plan.color, cursor: 'pointer', outline: 'none',
              }}>
                {Object.entries(PLANS).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}
              </select>
            </div>
          )
        })}
      </div>

      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowNew(false) }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400, border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Nueva empresa</h3>
            <label style={labelStyle}>Nombre de la empresa</label>
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: Distribuidora García" style={inputStyle} />
            <label style={{ ...labelStyle, marginTop: 14 }}>Plan</label>
            <select value={newPlan} onChange={e => setNewPlan(e.target.value)} style={inputStyle}>
              {Object.entries(PLANS).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              <button onClick={() => setShowNew(false)} style={{ ...secondaryBtn, flex: 1 }}>Cancelar</button>
              <button onClick={createCompany} disabled={saving || !newName.trim()} style={{ ...primaryBtn, flex: 2, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Creando...' : 'Crear empresa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Soporte: consultas del formulario de contacto ──
const STATUS_LABEL = { new: 'Nueva', answered: 'Respondida', archived: 'Archivada' }

function Support({ support, onChanged }) {
  const [filter, setFilter] = useState('new')
  const visible = filter === 'all' ? support : support.filter(m => m.status === filter)

  async function setStatus(id, status) {
    await supabase.rpc('admin_support_set_status', { p_id: id, p_status: status })
    onChanged()
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['new', 'Nuevas'], ['answered', 'Respondidas'], ['archived', 'Archivadas'], ['all', 'Todas']].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} style={{
            padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: '1px solid ' + (filter === key ? 'var(--accent)' : 'var(--border)'),
            background: filter === key ? 'var(--accent)' : 'var(--surface)',
            color: filter === key ? 'var(--accent-text)' : 'var(--text2)',
          }}>
            {label} {key !== 'all' && '(' + support.filter(m => m.status === key).length + ')'}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--text3)' }}>No hay consultas en esta lista. Las que llegan por el formulario de contacto aparecen acá y también te llegan por mail.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map(m => (
            <div key={m.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</span>
                  <span style={{ fontSize: 13, color: 'var(--text3)', marginLeft: 8 }}>{m.email}{m.company ? ' · ' + m.company : ''}{m.plan ? ' · interés: ' + m.plan : ''}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{STATUS_LABEL[m.status]} · {fmtDate(m.created_at)}</div>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 12 }}>{m.message}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a href={'mailto:' + m.email + '?subject=' + encodeURIComponent('Re: tu consulta en Potato')} style={{ ...secondaryBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="mail" size={13} /> Responder por email
                </a>
                {m.status !== 'answered' && <button onClick={() => setStatus(m.id, 'answered')} style={secondaryBtn}>Marcar respondida</button>}
                {m.status !== 'archived' && <button onClick={() => setStatus(m.id, 'archived')} style={secondaryBtn}>Archivar</button>}
                {m.status !== 'new' && <button onClick={() => setStatus(m.id, 'new')} style={secondaryBtn}>Reabrir</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

const sectionTitle = { fontSize: 14, fontWeight: 700, marginBottom: 10 }
const labelStyle = {
  display: 'block', fontSize: 12, color: 'var(--text3)', marginBottom: 6,
  fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
}
const inputStyle = {
  width: '100%', padding: '10px 13px', background: 'var(--bg-panel)',
  border: '1px solid var(--border)', borderRadius: 9,
  color: 'var(--text)', fontSize: 15, outline: 'none', boxSizing: 'border-box',
}
const primaryBtn = {
  padding: '9px 18px', background: 'var(--accent)', color: 'var(--accent-text)',
  border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer',
}
const secondaryBtn = {
  padding: '7px 14px', background: 'var(--surface-h)', color: 'var(--text2)',
  border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
