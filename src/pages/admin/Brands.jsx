import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function Brands() {
  const companyId   = useAuthStore(s => s.membership?.company_id)
  const qc          = useQueryClient()
  const [modal, setModal]     = useState(null)
  const [search, setSearch]   = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  const { data: brands = [] } = useQuery({
    queryKey: ['brands', companyId],
    queryFn: async () => {
      const { data } = await supabase.from('brands')
        .select('id, name, color, text_color, logo_url, aliases')
        .eq('company_id', companyId).is('deleted_at', null).order('sort_order')
      return data ?? []
    },
    enabled: !!companyId,
  })

  const save = useMutation({
    mutationFn: async (form) => {
      const payload = {
        company_id: companyId, name: form.name,
        slug: slugify(form.name), color: form.color, text_color: form.textColor,
        logo_url: form.logoUrl || null,
      }
      if (form.id) {
        await supabase.from('brands').update(payload).eq('id', form.id)
      } else {
        await supabase.from('brands').insert(payload)
      }
    },
    onSuccess: () => { qc.invalidateQueries(['brands', companyId]); setModal(null) },
  })

  const remove = useMutation({
    mutationFn: async (id) => {
      await supabase.from('brands').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries(['brands', companyId]),
  })

  async function handleLogoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `logos/${slugify(modal.name || 'brand')}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path)
      setModal(m => ({ ...m, logoUrl: publicUrl }))
    } catch (err) {
      alert('Error subiendo logo: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const filtered = brands.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ padding: 28, overflowY: 'auto', flex: 1 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Marcas</h2>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, maxWidth: 260, padding: '7px 11px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, outline: 'none' }} />
          <button onClick={() => setModal({ name: '', color: '#6366f1', textColor: '#ffffff' })} style={btnPrimary}>
            + Nueva marca
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Color', 'Nombre', 'Acciones'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(b => (
              <tr key={b.id} style={{ ':hover': { background: 'var(--surface-h)' } }}>
                <td style={tdStyle}>
                  <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 4, background: b.color, border: '1px solid rgba(255,255,255,.1)', verticalAlign: 'middle', marginRight: 8 }} />
                  <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>{b.color}</span>
                </td>
                <td style={tdStyle}><strong>{b.name}</strong></td>
                <td style={tdStyle}>
                  <button onClick={() => setModal({ id: b.id, name: b.name, color: b.color, textColor: b.text_color, logoUrl: b.logo_url || '' })} style={btnSm}>Editar</button>
                  <button onClick={() => { if (confirm('¿Eliminar esta marca?')) remove.mutate(b.id) }} style={{ ...btnSm, color: '#ef4444', borderColor: 'rgba(239,68,68,.3)', marginLeft: 6 }}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal.id ? 'Editar Marca' : 'Nueva Marca'} onClose={() => setModal(null)}>
          <Field label="Nombre">
            <input value={modal.name} onChange={e => setModal(m => ({ ...m, name: e.target.value }))} style={inputStyle} autoFocus />
          </Field>
          <Field label="Color de fondo">
            <input type="color" value={modal.color} onChange={e => setModal(m => ({ ...m, color: e.target.value }))} style={{ ...inputStyle, height: 40, padding: 4 }} />
          </Field>
          <Field label="Color de texto">
            <input type="color" value={modal.textColor} onChange={e => setModal(m => ({ ...m, textColor: e.target.value }))} style={{ ...inputStyle, height: 40, padding: 4 }} />
          </Field>
          <Field label="Logo">
            <input ref={fileRef} type="file" accept=".svg,.png,.jpg,.jpeg,.webp" style={{ display: 'none' }} onChange={handleLogoUpload} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {modal.logoUrl
                ? <img src={modal.logoUrl} alt="logo" style={{ height: 36, maxWidth: 80, objectFit: 'contain', background: modal.color, borderRadius: 6, padding: 4 }} />
                : <div style={{ width: 52, height: 36, background: 'var(--bg-panel)', borderRadius: 6, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🖼️</div>
              }
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                style={{ ...btnSm, padding: '6px 14px' }}>
                {uploading ? 'Subiendo...' : modal.logoUrl ? 'Cambiar logo' : 'Subir logo'}
              </button>
              {modal.logoUrl && (
                <button type="button" onClick={() => setModal(m => ({ ...m, logoUrl: '' }))}
                  style={{ ...btnSm, color: '#ef4444', borderColor: 'rgba(239,68,68,.3)' }}>
                  Quitar
                </button>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>SVG, PNG o JPG — se guarda en Supabase</div>
          </Field>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
            <button onClick={() => setModal(null)} style={btnSm}>Cancelar</button>
            <button onClick={() => save.mutate(modal)} disabled={!modal.name || save.isPending} style={btnPrimary}>
              {save.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, width: '100%', maxWidth: 460 }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}

const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }
const tdStyle = { padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, verticalAlign: 'middle' }
const btnPrimary = { padding: '7px 16px', background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }
const btnSm = { padding: '4px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface-h)', color: 'var(--text2)' }
const inputStyle = { width: '100%', padding: '8px 12px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none' }
