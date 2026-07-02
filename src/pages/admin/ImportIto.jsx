import { useState, useRef } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { supabase } from '@/lib/supabase'
import ExcelJS from 'exceljs'
import { usePlanLimits } from '@/hooks/usePlanLimits'

// Order matters: more specific first (e.g. "Bloox to Go" before "Bloox")
const BRAND_PATTERNS = [
  { name: 'Bloox to Go',  keywords: ['bloox to go', 'bloox2go'] },
  { name: 'Bloox',        keywords: ['bloox'] },
  { name: 'Roca to Go',   keywords: ['roca to go', 'roca2go'] },
  { name: 'Roca EV',      keywords: ['roca ev'] },
  { name: 'ROCA',         keywords: ['roca mobile', ' roca ', 'roca|', '| roca', 'cable roca', 'cargador roca', 'auricular roca'] },
  { name: 'Xiaomi',       keywords: ['xiaomi', 'redmi', 'mi band', 'mi smart'] },
  { name: 'JBL',          keywords: ['jbl'] },
  { name: 'Genius',       keywords: ['genius'] },
  { name: 'X-Lizzard',   keywords: ['x-lizzard', 'x lizzard', 'xlizzard'] },
  { name: 'Lenovo',       keywords: ['lenovo'] },
  { name: 'Eko-vi',       keywords: ['eko-vi', 'eko vi', 'ekovi'] },
  { name: 'Bambu Lab',    keywords: ['bambu lab', 'bambu'] },
  { name: 'Engino',       keywords: ['engino'] },
  { name: 'LDNIO',        keywords: ['ldnio'] },
  { name: 'Gorssun',      keywords: ['gorssun'] },
  { name: 'Mibro',        keywords: ['mibro'] },
  { name: 'QCY',          keywords: ['qcy'] },
  { name: 'Rockspace',    keywords: ['rockspace'] },
  { name: 'Shelly',       keywords: ['shelly'] },
  { name: 'Usamas',       keywords: ['usamas'] },
  { name: 'Atom',         keywords: ['atom'] },
  { name: 'Vanyko',       keywords: ['vanyko'] },
  { name: 'Auzren',       keywords: ['auzren'] },
  { name: 'AOC',          keywords: [' aoc ', 'monitor aoc', 'aoc '] },
  { name: 'Exofiz',       keywords: ['exofiz'] },
  { name: 'Marvo',        keywords: ['marvo'] },
]

function detectBrand(name) {
  const lower = (' ' + name + ' ').toLowerCase()
  for (const { name: brand, keywords } of BRAND_PATTERNS) {
    if (keywords.some(k => lower.includes(k))) return brand
  }
  return null
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const DEFAULT_COLORS = [
  '#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6',
  '#ec4899','#14b8a6','#f97316','#06b6d4','#84cc16','#a855f7',
]

export default function ImportIto() {
  const companyId = useAuthStore(s => s.membership?.company_id)
  const fileRef   = useRef()
  const { canAddProducts, usage, limits } = usePlanLimits()

  const [step, setStep]       = useState('idle') // idle | parsing | preview | importing | done
  const [rows, setRows]       = useState([])
  const [summary, setSummary] = useState(null)
  const [log, setLog]         = useState([])
  const [error, setError]     = useState('')

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setStep('parsing')
    setError('')
    setLog([])

    try {
      const buffer = await file.arrayBuffer()
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buffer)
      const ws = wb.worksheets[0]

      const parsed = []
      ws.eachRow((row, i) => {
        if (i === 1) return // header
        const sku  = String(row.getCell(1).value ?? '').trim()
        const name = String(row.getCell(3).value ?? '').trim()
        const stockTotal = Number(row.getCell(6).value ?? 0)

        // Include only ACC* and INF* — exclude SACC, SINF, HER, REP
        if (!sku) return
        if (/^(SACC|SINF|HER|REP)/i.test(sku)) return
        if (!/^(ACC|INF)/i.test(sku)) return

        const brand = detectBrand(name)
        parsed.push({ sku, name, stock: stockTotal, brand })
      })

      // Group summary
      const byBrand = {}
      for (const p of parsed) {
        const key = p.brand ?? '(sin marca detectada)'
        if (!byBrand[key]) byBrand[key] = 0
        byBrand[key]++
      }
      const sortedBrands = Object.entries(byBrand).sort((a, b) => b[1] - a[1])

      setRows(parsed)
      setSummary({ total: parsed.length, byBrand: sortedBrands })
      setStep('preview')
    } catch (err) {
      setError('Error al leer el archivo: ' + err.message)
      setStep('idle')
    }
  }

  async function handleImport() {
    setStep('importing')
    const logs = []
    const addLog = (msg) => { logs.push(msg); setLog([...logs]) }

    try {
      // Load existing brands
      const { data: existingBrands } = await supabase
        .from('brands').select('id, name').eq('company_id', companyId).is('deleted_at', null)

      const brandMap = {} // name → id
      for (const b of existingBrands ?? []) brandMap[b.name] = b.id

      // Detect which brands we need to create
      const neededBrands = [...new Set(rows.map(r => r.brand).filter(Boolean))]
      const toCreate = neededBrands.filter(n => !brandMap[n])

      if (toCreate.length > 0) {
        addLog(`Creando ${toCreate.length} marcas nuevas...`)
        for (let i = 0; i < toCreate.length; i++) {
          const name = toCreate[i]
          const color = DEFAULT_COLORS[i % DEFAULT_COLORS.length]
          const { data, error } = await supabase.from('brands').insert({
            company_id: companyId,
            name,
            slug: slugify(name),
            color,
            text_color: '#ffffff',
            active: true,
          }).select('id').single()
          if (error) { addLog(`  ✗ Error creando "${name}": ${error.message}`); continue }
          brandMap[name] = data.id
          addLog(`  ✓ Marca creada: ${name}`)
        }
      }

      // Load existing products (by SKU)
      addLog('Cargando productos existentes...')
      const { data: existingProds } = await supabase
        .from('products').select('id, sku').eq('company_id', companyId).is('deleted_at', null)
      const existingSkuMap = {}
      for (const p of existingProds ?? []) existingSkuMap[p.sku.toUpperCase()] = p.id

      // Split rows into new vs update, skip rows without brand
      const toInsert = []
      const toUpdate = []
      let skipped = 0

      for (const row of rows) {
        const brandId = row.brand ? brandMap[row.brand] : null
        const existingId = existingSkuMap[row.sku.toUpperCase()]

        if (existingId) {
          // Update: only touch stock and name — never overwrite brand/category/image
          toUpdate.push({ id: existingId, name: row.name, stock: row.stock, active: true })
        } else {
          // New product: requires a brand to be inserted
          if (!brandId) { skipped++; continue }
          toInsert.push({
            company_id: companyId,
            sku:        row.sku,
            name:       row.name,
            stock:      row.stock,
            brand_id:   brandId,
            active:     true,
          })
        }
      }

      // Enforce plan limit: only insert up to the remaining quota
      const remaining = limits.max_products === null ? Infinity : Math.max(0, limits.max_products - usage.products)
      if (toInsert.length > remaining) {
        const trimmed = toInsert.length - remaining
        toInsert.splice(remaining)
        addLog(`⚠️ Límite del plan: se omiten ${trimmed} productos nuevos (cupo lleno). Actualizaciones continúan.`)
      }

      addLog(`${toInsert.length} nuevos · ${toUpdate.length} a actualizar · ${skipped} sin marca (omitidos)`)

      // Insert in batches of 100
      const BATCH = 100
      let inserted = 0
      for (let i = 0; i < toInsert.length; i += BATCH) {
        const batch = toInsert.slice(i, i + BATCH)
        const { error } = await supabase.from('products').insert(batch)
        if (error) { addLog(`  ✗ Error insertando lote ${i}-${i+BATCH}: ${error.message}`); continue }
        inserted += batch.length
        addLog(`  Insertados ${inserted} / ${toInsert.length}...`)
      }

      // Update in batches
      let updated = 0
      for (let i = 0; i < toUpdate.length; i += BATCH) {
        const batch = toUpdate.slice(i, i + BATCH)
        for (const p of batch) {
          const { id, ...data } = p
          await supabase.from('products').update(data).eq('id', id)
        }
        updated += batch.length
        addLog(`  Actualizados ${updated} / ${toUpdate.length}...`)
      }

      addLog(`✅ Listo. ${inserted} creados · ${updated} actualizados · ${skipped} omitidos (sin marca)`)
      setStep('done')
    } catch (err) {
      addLog('✗ Error inesperado: ' + err.message)
      setStep('done')
    }
  }

  return (
    <div style={{ padding: 28, overflowY: 'auto', flex: 1 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Importar desde ito</h2>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24 }}>
        Subí el reporte de stock de ito (.xlsx). Se importan solo ACC* e INF* — se excluyen SACC, SINF, HER, REP.
      </p>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {step === 'idle' && (
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            border: '2px dashed var(--border)', borderRadius: 12,
            padding: '48px 24px', textAlign: 'center', cursor: 'pointer',
            transition: 'border-color .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          <div style={{ fontSize: 32, marginBottom: 10 }}>📂</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Seleccioná el Excel de ito</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>reporte_stock_YYYY-MM-DD.xlsx</div>
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleFile} />
        </div>
      )}

      {step === 'parsing' && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text2)' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>
          Leyendo archivo...
        </div>
      )}

      {step === 'preview' && summary && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <Stat label="Total a importar" value={summary.total} color="var(--accent)" />
            <Stat label="Marcas detectadas" value={summary.byBrand.filter(([b]) => b !== '(sin marca detectada)').length} color="#3b82f6" />
            <Stat label="Sin marca (se omiten)" value={summary.byBrand.find(([b]) => b === '(sin marca detectada)')?.[1] ?? 0} color="#ef4444" />
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Productos por marca
            </div>
            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              {summary.byBrand.map(([brand, count]) => (
                <div key={brand} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 16px', borderBottom: '1px solid var(--border)',
                  opacity: brand === '(sin marca detectada)' ? 0.5 : 1,
                }}>
                  <span style={{ fontSize: 13, color: brand === '(sin marca detectada)' ? 'var(--text3)' : 'var(--text)' }}>
                    {brand === '(sin marca detectada)' ? '⚠️ ' : ''}{brand}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {limits.max_products !== null && (() => {
            const newCount = summary.byBrand
              .filter(([b]) => b !== '(sin marca detectada)')
              .reduce((acc, [, c]) => acc + c, 0)
            const remaining = Math.max(0, limits.max_products - usage.products)
            if (newCount > remaining) return (
              <div style={{
                padding: '10px 14px', marginBottom: 14,
                background: 'rgba(249,115,22,.1)', border: '1px solid rgba(249,115,22,.3)',
                borderRadius: 8, fontSize: 13, color: '#f97316',
              }}>
                ⚠️ Tu plan permite {limits.max_products} productos en total. Tenés {usage.products} cargados — solo se importarán {remaining} de los {newCount} nuevos. Las actualizaciones de stock no tienen límite.
              </div>
            )
            return null
          })()}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setStep('idle'); setRows([]); setSummary(null); fileRef.current.value = '' }}
              style={btnSecondary}>
              Cancelar
            </button>
            <button onClick={handleImport} style={btnPrimary}>
              Importar {summary.total - (summary.byBrand.find(([b]) => b === '(sin marca detectada)')?.[1] ?? 0)} productos
            </button>
          </div>
        </div>
      )}

      {(step === 'importing' || step === 'done') && (
        <div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)', maxHeight: 400, overflowY: 'auto', lineHeight: 1.8 }}>
            {log.map((l, i) => <div key={i}>{l}</div>)}
            {step === 'importing' && <div style={{ color: 'var(--accent)' }}>Procesando...</div>}
          </div>
          {step === 'done' && (
            <button onClick={() => { setStep('idle'); setRows([]); setSummary(null); setLog([]) }}
              style={{ ...btnPrimary, marginTop: 16 }}>
              Nueva importación
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 20px', minWidth: 140 }}>
      <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

const btnPrimary   = { padding: '9px 22px', background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: 'pointer' }
const btnSecondary = { padding: '9px 18px', background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, cursor: 'pointer' }
