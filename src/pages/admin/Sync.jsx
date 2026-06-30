import { useState, useRef } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { supabase } from '@/lib/supabase'
import { ExcelConnector } from '@/utils/connectors/excel.connector'
import { computeDiff, summarizeDiff } from '@/utils/sync/diff'
import { applyDiff } from '@/utils/sync/apply'

const STEPS = { idle: 0, parsing: 1, review: 2, applying: 3, done: 4 }
const CHANGE_COLORS = {
  new:       { bg: 'rgba(34,197,94,.12)',  text: '#22c55e', label: 'Nuevo' },
  updated:   { bg: 'rgba(59,130,246,.12)', text: '#3b82f6', label: 'Modificado' },
  deleted:   { bg: 'rgba(239,68,68,.12)',  text: '#ef4444', label: 'Eliminado' },
  no_change: { bg: 'rgba(107,107,115,.1)', text: 'var(--text3)', label: 'Sin cambios' },
  skipped:   { bg: 'rgba(245,166,35,.12)', text: 'var(--amber)', label: 'Omitido' },
  error:     { bg: 'rgba(239,68,68,.12)',  text: '#ef4444', label: 'Error' },
}

export default function Sync() {
  const { membership } = useAuthStore()
  const companyId = membership?.company_id

  const [step, setStep]         = useState(STEPS.idle)
  const [diffRows, setDiffRows] = useState([])
  const [summary, setSummary]   = useState(null)
  const [filter, setFilter]     = useState('all')
  const [execId, setExecId]     = useState(null)
  const [message, setMessage]   = useState('')
  const [fieldMapping, setFieldMapping] = useState(ExcelConnector.getDefaultFieldMapping())
  const fileRef = useRef()

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setStep(STEPS.parsing)
    setMessage('Parseando archivo...')

    try {
      // Parse
      const rows = await ExcelConnector.parse(file, fieldMapping)
      setMessage('Calculando diferencias...')

      // Load current DB state
      const { data: existing } = await supabase
        .from('products')
        .select('id, sku, name, description, active, brand_id, category_id, price, stock')
        .eq('company_id', companyId)
        .is('deleted_at', null)

      // Build lookup maps (name/alias → id)
      const { data: brands } = await supabase.from('brands')
        .select('id, name, aliases').eq('company_id', companyId).is('deleted_at', null)
      const { data: cats } = await supabase.from('categories')
        .select('id, name, aliases').eq('company_id', companyId).is('deleted_at', null)

      const brandMap = buildNameMap(brands ?? [])
      let   catMap   = buildNameMap(cats   ?? [])

      // Auto-create missing categories
      const incomingCats = [...new Set(rows.map(r => r.category).filter(Boolean))]
      const newCats = incomingCats.filter(name => !catMap[name.trim().toLowerCase()])
      if (newCats.length > 0) {
        const { data: created } = await supabase.from('categories').insert(
          newCats.map(name => ({ company_id: companyId, name: name.trim() }))
        ).select('id, name, aliases')
        catMap = buildNameMap([...(cats ?? []), ...(created ?? [])])
      }

      const diff    = computeDiff(rows, existing ?? [], brandMap, catMap)
      const summary = summarizeDiff(diff)

      // Create execution record
      const { data: exec } = await supabase.from('sync_executions').insert({
        company_id:    companyId,
        triggered_by:  (await supabase.auth.getUser()).data.user?.id,
        status:        'awaiting_approval',
        rows_parsed:   rows.length,
        rows_new:      summary.new      ?? 0,
        rows_updated:  summary.updated  ?? 0,
        rows_deleted:  summary.deleted  ?? 0,
        rows_skipped:  summary.skipped  ?? 0,
        rows_errors:   summary.error    ?? 0,
      }).select().single()

      // Persist diff rows
      if (exec?.id) {
        const toInsert = diff.map(r => ({
          execution_id:   exec.id,
          sku:            r.sku,
          change_type:    r.change_type,
          old_data:       r.old_data,
          new_data:       r.new_data,
          changed_fields: r.changed_fields,
        }))
        // Insert in batches of 500
        for (let i = 0; i < toInsert.length; i += 500) {
          await supabase.from('sync_diff_rows').insert(toInsert.slice(i, i + 500))
        }
        setExecId(exec.id)
      }

      setDiffRows(diff)
      setSummary(summary)
      setStep(STEPS.review)
      setMessage('')
    } catch (err) {
      setMessage(`Error: ${err.message}`)
      setStep(STEPS.idle)
    }

    e.target.value = ''
  }

  async function handleApply() {
    setStep(STEPS.applying)
    setMessage('Aplicando cambios...')
    try {
      const toApply = diffRows.filter(r => !r.excluded)
      await applyDiff(execId, companyId, toApply)
      setMessage('¡Sincronización completada!')
      setStep(STEPS.done)
    } catch (err) {
      setMessage(`Error al aplicar: ${err.message}`)
      setStep(STEPS.review)
    }
  }

  function toggleExclude(sku) {
    setDiffRows(prev => prev.map(r => r.sku === sku ? { ...r, excluded: !r.excluded } : r))
  }

  const visible = diffRows.filter(r => filter === 'all' || r.change_type === filter)
  const actionable = diffRows.filter(r => ['new','updated','deleted'].includes(r.change_type) && !r.excluded)

  return (
    <div style={{ padding: 28, overflowY: 'auto', flex: 1 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Sincronizar Empresa</h2>
      <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 24 }}>
        Cargá tu archivo Excel. El sistema comparará cada producto con la base de datos antes de aplicar cambios.
      </p>

      {step === STEPS.idle && (
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            border: '2px dashed var(--border)', borderRadius: 10, padding: '40px 30px',
            textAlign: 'center', cursor: 'pointer', color: 'var(--text3)',
            transition: 'all .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text3)' }}
        >
          <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
          <div style={{ fontWeight: 600 }}>Arrastrá tu Excel aquí o hacé clic para seleccionar</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Formatos: .xlsx, .xls</div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
        </div>
      )}

      {message && (
        <div style={{ margin: '16px 0', color: 'var(--text2)', fontSize: 13 }}>{message}</div>
      )}

      {step === STEPS.review && summary && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            {Object.entries(CHANGE_COLORS).map(([type, style]) => {
              const count = summary[type] ?? 0
              if (count === 0 && type === 'no_change') return null
              return (
                <button key={type}
                  onClick={() => setFilter(filter === type ? 'all' : type)}
                  style={{
                    padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
                    border: `1px solid ${filter === type ? style.text : 'var(--border)'}`,
                    background: filter === type ? style.bg : 'var(--surface)',
                    color: style.text, fontWeight: 600, fontSize: 13,
                  }}>
                  {style.label}: {count}
                </button>
              )
            })}
            <button onClick={() => setFilter('all')} style={{
              padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
              border: '1px solid var(--border)', background: filter === 'all' ? 'var(--surface-h)' : 'var(--surface)',
              color: 'var(--text)', fontSize: 13,
            }}>
              Todos: {diffRows.length}
            </button>
          </div>

          {/* Diff table */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['SKU','Nombre','Tipo','Campos modificados','Excluir'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left', fontSize: 10,
                      fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase',
                      letterSpacing: '.5px', borderBottom: '1px solid var(--border)',
                      background: 'var(--bg-panel)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, 200).map((row, i) => {
                  const cs = CHANGE_COLORS[row.change_type] ?? CHANGE_COLORS.no_change
                  return (
                    <tr key={i} style={{ opacity: row.excluded ? 0.4 : 1 }}>
                      <td style={td}><code style={{ fontSize: 11, color: 'var(--accent)' }}>{row.sku}</code></td>
                      <td style={td}>{row.new_data?.name ?? row.old_data?.name ?? '—'}</td>
                      <td style={td}>
                        <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: cs.bg, color: cs.text }}>
                          {cs.label}
                        </span>
                      </td>
                      <td style={td}>
                        {row.changed_fields?.length > 0
                          ? <span style={{ fontSize: 11, color: 'var(--text2)' }}>{row.changed_fields.join(', ')}</span>
                          : <span style={{ color: 'var(--text3)' }}>—</span>
                        }
                      </td>
                      <td style={td}>
                        {['new','updated','deleted'].includes(row.change_type) && (
                          <button onClick={() => toggleExclude(row.sku)} style={{
                            padding: '3px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
                            border: '1px solid var(--border)', background: row.excluded ? 'var(--surface-h)' : 'transparent',
                            color: 'var(--text2)',
                          }}>
                            {row.excluded ? 'Incluir' : 'Excluir'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {visible.length > 200 && (
              <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text3)' }}>
                Mostrando 200 de {visible.length} filas.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => { setStep(STEPS.idle); setDiffRows([]); setSummary(null) }}
              style={{ padding: '9px 18px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={handleApply} disabled={actionable.length === 0}
              style={{
                padding: '9px 24px', background: 'var(--accent)', color: 'var(--accent-text)',
                border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: 14,
                opacity: actionable.length === 0 ? 0.5 : 1,
              }}>
              Aplicar {actionable.length} cambios
            </button>
          </div>
        </>
      )}

      {step === STEPS.done && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Sincronización completada</h3>
          <p style={{ color: 'var(--text2)', marginBottom: 20, fontSize: 13 }}>{message}</p>
          <button onClick={() => { setStep(STEPS.idle); setDiffRows([]); setSummary(null); setMessage('') }}
            style={{ padding: '9px 20px', background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer' }}>
            Nueva sincronización
          </button>
        </div>
      )}
    </div>
  )
}

function buildNameMap(entities) {
  const map = {}
  for (const e of entities) {
    map[e.name.trim().toLowerCase()] = e.id
    for (const alias of (e.aliases ?? [])) {
      map[alias.trim().toLowerCase()] = e.id
    }
  }
  return map
}

const td = { padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, verticalAlign: 'middle' }
