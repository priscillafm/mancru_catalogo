import { useState, useRef } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { supabase } from '@/lib/supabase'
import ExcelJS from 'exceljs'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import Icon from '@/components/Icon'
import { parseNumber, cellText, cleanUrl } from '@/utils/excel'
import { plural } from '@/utils/format'

/**
 * Importación genérica desde Excel.
 * Columnas esperadas (flexible):
 *   Col A: SKU
 *   Col B o C: Nombre del producto
 *   Col D, E o F: Stock (busca el primer número en esas columnas)
 *   Col G o H: Precio (opcional)
 *   Col I: Marca (opcional — si no está, se agrupa en "Sin marca")
 *
 * La primera fila se trata como encabezado y se ignora.
 */

function downloadSkipped(skipped) {
  const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"'
  const csv = ['Fila,Motivo,SKU,Nombre', ...skipped.map(s => [s.row, esc(s.reason), esc(s.sku), esc(s.name)].join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
  a.download = 'filas-omitidas.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}

async function downloadTemplate() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Productos')
  ws.columns = [
    { header: 'SKU', key: 'sku', width: 14 },
    { header: 'Nombre', key: 'nombre', width: 32 },
    { header: 'Stock', key: 'stock', width: 10 },
    { header: 'Precio', key: 'precio', width: 12 },
    { header: 'Marca', key: 'marca', width: 20 },
    { header: 'imagen_url', key: 'imagen', width: 40 },
  ]
  ws.getRow(1).font = { bold: true }
  ws.addRow({ sku: 'ABC-001', nombre: 'Producto de ejemplo 1', stock: 25, precio: 1500, marca: 'Mi Marca', imagen: 'https://tusitio.com/fotos/abc-001.jpg' })
  ws.addRow({ sku: 'ABC-002', nombre: 'Producto de ejemplo 2', stock: 8,  precio: 2200, marca: 'Mi Marca' })
  ws.addRow({ sku: 'XYZ-010', nombre: 'Producto sin marca (queda en "Sin marca")', stock: 40, precio: '', marca: '' })
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantilla-productos-potato.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const DEFAULT_COLORS = [
  '#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6',
  '#ec4899','#14b8a6','#f97316','#06b6d4','#84cc16','#a855f7',
]

function parseRow(row) {
  const cell = (n) => String(row.getCell(n).value ?? '').trim()
  const num  = (n) => { const v = parseFloat(cell(n)); return isNaN(v) ? null : v }

  const sku   = cell(1)
  if (!sku) return null

  // Nombre: col B o C (la más larga)
  const nameB = cell(2)
  const nameC = cell(3)
  const name  = nameB.length >= nameC.length ? nameB : nameC
  if (!name) return null

  // Stock: primer número encontrado entre col 4-7
  const stock = num(4) ?? num(5) ?? num(6) ?? num(7) ?? 0

  // Precio: col 7 o 8
  const price = num(7) ?? num(8)

  // Marca: col 9 o 10
  const brand = cell(9) || cell(10) || null

  return { sku, name, stock, price, brand }
}

export default function ImportExcel() {
  const companyId = useAuthStore(s => s.membership?.company_id)
  const fileRef   = useRef()
  const { canAddProducts, usage, limits } = usePlanLimits()

  const [step, setStep]       = useState('idle')
  const [rows, setRows]       = useState([])
  const [summary, setSummary] = useState(null)
  const [log, setLog]         = useState([])
  const [error, setError]     = useState('')
  const [colMap, setColMap]   = useState({ sku: 1, name: 3, stock: 6, price: null, brand: null })
  const [headers, setHeaders] = useState([])

  function reset() {
    setStep('idle'); setRows([]); setSummary(null); setLog([]); setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setStep('parsing'); setError(''); setLog([])

    try {
      const buffer = await file.arrayBuffer()
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buffer)
      const ws = wb.worksheets[0]

      // Read headers from row 1
      const hdrs = []
      ws.getRow(1).eachCell((cell, col) => {
        hdrs[col] = String(cell.value ?? '').trim()
      })
      setHeaders(hdrs)

      // Auto-detect columns from headers
      const autoMap = { sku: 1, name: 3, stock: 6, price: null, brand: null, image: null }
      const found = { sku: false, name: false, stock: false, price: false, brand: false, image: false }
      const detect = (key, i) => { autoMap[key] = i; found[key] = true }
      hdrs.forEach((h, i) => {
        const l = h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        if (l.includes('sku') || l.includes('cod'))           detect('sku', i)
        if (l.includes('nombre') || l.includes('descrip') || l.includes('product')) detect('name', i)
        if (l.includes('stock') || l.includes('cant'))        detect('stock', i)
        if (l.includes('precio') || l.includes('price'))      detect('price', i)
        if (l.includes('marca') || l.includes('brand'))       detect('brand', i)
        if (l.includes('imagen') || l.includes('image') || l.includes('foto')) detect('image', i)
      })
      setColMap(autoMap)

      const bySku = new Map()
      const skipped = []
      let duplicates = 0
      let badImages = 0
      ws.eachRow((row, i) => {
        if (i === 1) return
        const get = (col) => col ? cellText(row.getCell(col)) : ''
        const raw = (col) => {
          if (!col) return null
          const c = row.getCell(col)
          const v = c.value
          return (v && typeof v === 'object' && !(v instanceof Date)) ? (v.result ?? c.text) : v
        }
        const sku  = get(autoMap.sku)
        const name = get(autoMap.name)
        if (!sku && !name) return
        if (!sku)  { skipped.push({ row: i, reason: 'Falta el SKU', sku, name }); return }
        if (!name) { skipped.push({ row: i, reason: 'Falta el nombre', sku, name }); return }
        const key = sku.toUpperCase()
        if (bySku.has(key)) duplicates++
        const imageRaw = get(autoMap.image)
        const image = cleanUrl(imageRaw)
        if (imageRaw && !image) badImages++
        bySku.set(key, { sku, name, stock: found.stock ? (parseNumber(raw(autoMap.stock)) ?? 0) : null, price: parseNumber(raw(autoMap.price)), brand: get(autoMap.brand) || null, image })
      })
      const parsed = [...bySku.values()]

      const byBrand = {}
      for (const p of parsed) {
        const key = p.brand ?? '(sin marca)'
        byBrand[key] = (byBrand[key] ?? 0) + 1
      }

      const mapping = Object.fromEntries(Object.keys(autoMap).map(k => [k, found[k] ? hdrs[autoMap[k]] : null]))
      setRows(parsed)
      setSummary({
        total: parsed.length,
        byBrand: Object.entries(byBrand).sort((a, b) => b[1] - a[1]),
        skipped, duplicates, mapping, found, badImages,
        withImage: parsed.filter(p => p.image).length,
        sample: parsed.slice(0, 8),
      })
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
      // Existing brands
      const { data: existingBrands } = await supabase
        .from('brands').select('id, name').eq('company_id', companyId).is('deleted_at', null)
      const brandMap = {}
      for (const b of existingBrands ?? []) brandMap[b.name.toLowerCase()] = b.id

      // Create missing brands
      const neededBrands = [...new Set(rows.map(r => r.brand).filter(Boolean))]
      const toCreate = neededBrands.filter(n => !brandMap[n.toLowerCase()])

      if (toCreate.length > 0) {
        addLog(`Creando ${toCreate.length} marca${toCreate.length !== 1 ? 's' : ''} nueva${toCreate.length !== 1 ? 's' : ''}...`)
        for (let i = 0; i < toCreate.length; i++) {
          const name = toCreate[i]
          const color = DEFAULT_COLORS[i % DEFAULT_COLORS.length]
          const { data, error } = await supabase.from('brands').insert({
            company_id: companyId, name, slug: slugify(name), color, text_color: '#ffffff', active: true,
          }).select('id').single()
          if (error) { addLog(`  ✗ Error creando "${name}": ${error.message}`); continue }
          brandMap[name.toLowerCase()] = data.id
          addLog(`  ✓ Marca: ${name}`)
        }
      }

      // Existing products
      addLog('Verificando productos existentes...')
      const { data: existingProds } = await supabase
        .from('products').select('id, sku').eq('company_id', companyId).is('deleted_at', null)
      const skuMap = {}
      for (const p of existingProds ?? []) skuMap[p.sku.toUpperCase()] = p.id

      const toInsert = []
      const toUpdate = []
      let skipped = 0

      for (const row of rows) {
        const brandId   = row.brand ? brandMap[row.brand.toLowerCase()] : null
        const existingId = skuMap[row.sku.toUpperCase()]

        if (existingId) {
          toUpdate.push({ id: existingId, name: row.name,
            ...(row.stock !== null ? { stock: row.stock } : {}),
            ...(row.price !== null ? { price: row.price } : {}),
            ...(row.image ? { image_url: row.image } : {}),
            ...(brandId ? { brand_id: brandId } : {}) })
        } else {
          toInsert.push({ company_id: companyId, sku: row.sku, name: row.name, stock: row.stock ?? 0,
            brand_id: brandId ?? null, active: true,
            ...(row.price !== null ? { price: row.price } : {}),
            ...(row.image ? { image_url: row.image } : {}) })
        }
      }

      // Enforce plan limit
      const remaining = limits.max_products === null ? Infinity : Math.max(0, limits.max_products - usage.products)
      let skippedByPlan = 0
      if (toInsert.length > remaining) {
        skippedByPlan = toInsert.length - remaining
        toInsert.splice(remaining)
        addLog(`Aviso — límite del plan: quedan afuera ${plural(skippedByPlan, 'producto nuevo', 'productos nuevos')}. Las actualizaciones continúan igual.`)
      }

      const sinMarca = rows.filter(r => !r.brand).length
      addLog(`${toInsert.length} nuevos · ${toUpdate.length} a actualizar${sinMarca ? ` · ${sinMarca} sin marca` : ''}${skippedByPlan ? ` · ${skippedByPlan} omitidos por plan` : ''}`)

      const BATCH = 100
      let inserted = 0
      for (let i = 0; i < toInsert.length; i += BATCH) {
        const { error } = await supabase.from('products').insert(toInsert.slice(i, i + BATCH))
        if (error) { addLog(`  ✗ Error lote ${i}: ${error.message}`); continue }
        inserted += Math.min(BATCH, toInsert.length - i)
        addLog(`  Insertados ${inserted} / ${toInsert.length}...`)
      }

      let updated = 0
      for (let i = 0; i < toUpdate.length; i += BATCH) {
        for (const p of toUpdate.slice(i, i + BATCH)) {
          const { id, ...data } = p
          await supabase.from('products').update(data).eq('id', id)
        }
        updated += Math.min(BATCH, toUpdate.length - i)
        addLog(`  Actualizados ${updated} / ${toUpdate.length}...`)
      }

      addLog(`Listo. ${inserted} creados · ${updated} actualizados${skippedByPlan ? ` · ${skippedByPlan} omitidos por límite de plan` : ''}`)
      setStep('done')
    } catch (err) {
      addLog('✗ Error inesperado: ' + err.message)
      setStep('done')
    }
  }

  const newCount = summary?.total ?? 0
  const remaining = limits.max_products !== null ? Math.max(0, limits.max_products - usage.products) : Infinity

  return (
    <div style={{ padding: 28, overflowY: 'auto', flex: 1 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Importar productos desde Excel</h2>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>
        Usá esto para la <strong>carga inicial</strong> de tu catálogo. Subí tu lista en formato .xlsx con la primera fila como encabezado.
      </p>
      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
        Columnas detectadas automáticamente por su encabezado: <strong>SKU</strong>, <strong>Nombre</strong>, <strong>Stock</strong>, <strong>Precio</strong> (opcional), <strong>Marca</strong> (opcional) e <strong>imagen_url</strong> (opcional).
      </p>
      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
        ¿Ya tenés productos cargados y solo querés actualizar stock o precios? Usá{' '}
        <strong>Sincronizar</strong> en su lugar — compara tu Excel contra lo que ya está guardado antes de aplicar cambios.
      </p>
      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, lineHeight: 1.6 }}>
        <strong>Fotos:</strong> agregá una columna <code>imagen_url</code> con el link completo de cada foto (empieza con https://, por ejemplo https://tusitio.com/fotos/abc-001.jpg) y se vincula al SKU. También podés subirlas una por una desde Productos. Antes de importar vas a ver una muestra de las filas, cuántas fotos se vinculan y cuáles filas se omiten (podés descargar el detalle en CSV).
      </p>
      <button onClick={downloadTemplate} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
        background: 'var(--surface-h)', border: '1px solid var(--border)', borderRadius: 8,
        color: 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 24,
      }}>
        ↓ Descargar plantilla de ejemplo (.xlsx)
      </button>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {step === 'idle' && (
        <div onClick={() => fileRef.current?.click()} style={{
          border: '2px dashed var(--border)', borderRadius: 12,
          padding: '56px 24px', textAlign: 'center', cursor: 'pointer', transition: 'border-color .15s',
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          <div style={{ color: 'var(--text3)', marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Icon name="import" size={36} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Seleccioná tu archivo Excel</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Formatos: .xlsx · .xls</div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
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
            <Stat label="Total detectados" value={summary.total} color="var(--accent)" />
            <Stat label="Marcas" value={summary.byBrand.filter(([b]) => b !== '(sin marca)').length} color="#3b82f6" />
            <Stat label="Sin marca" value={summary.byBrand.find(([b]) => b === '(sin marca)')?.[1] ?? 0} color="#f97316" />
          </div>

          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 14, lineHeight: 1.8 }}>
            {[['SKU', 'sku'], ['Nombre', 'name'], ['Stock', 'stock'], ['Precio', 'price'], ['Marca', 'brand'], ['Imagen', 'image']].map(([label, k]) => (
              <span key={k} style={{ marginRight: 16, whiteSpace: 'nowrap' }}>
                <strong>{label}</strong> → {summary.mapping[k] ? '«' + summary.mapping[k] + '»' : <span style={{ color: 'var(--text3)' }}>no detectada</span>}
              </span>
            ))}
          </div>

          {(!summary.found.sku || !summary.found.name) && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, fontSize: 13, color: '#ef4444', marginBottom: 14 }}>
              No encontramos por encabezado la columna de {!summary.found.sku ? 'SKU' : 'Nombre'}, así que usamos una posición por defecto. Revisá la muestra de abajo antes de importar; si está mal, corregí los encabezados del Excel (SKU, Nombre) o descargá la plantilla.
            </div>
          )}
          {!summary.found.price && (
            <div style={{ padding: '8px 14px', background: 'var(--surface-h)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text2)', marginBottom: 14 }}>
              No detectamos una columna de Precio: los productos se van a importar sin precio.
            </div>
          )}
          {summary.found.image && (
            <div style={{ padding: '8px 14px', background: 'var(--surface-h)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text2)', marginBottom: 14 }}>
              {summary.withImage} de {plural(summary.total, 'producto')} con foto vinculada{summary.badImages > 0 ? '; ' + plural(summary.badImages, 'URL de imagen no es válida', 'URLs de imagen no son válidas') + ' (deben empezar con http:// o https://) y se ignoran' : ''}.
            </div>
          )}
          {summary.duplicates > 0 && (
            <div style={{ padding: '8px 14px', background: 'rgba(249,115,22,.1)', border: '1px solid rgba(249,115,22,.3)', borderRadius: 8, fontSize: 12, color: '#f97316', marginBottom: 14 }}>
              {plural(summary.duplicates, 'fila repite', 'filas repiten')} un SKU que ya estaba en el archivo; se usa la última.
            </div>
          )}
          {summary.skipped.length > 0 && (
            <div style={{ padding: '8px 14px', background: 'rgba(249,115,22,.1)', border: '1px solid rgba(249,115,22,.3)', borderRadius: 8, fontSize: 12, color: '#f97316', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span>{plural(summary.skipped.length, 'fila se omite', 'filas se omiten')} por datos incompletos (por ejemplo, fila {summary.skipped[0].row}: {summary.skipped[0].reason.toLowerCase()}).</span>
              <button onClick={() => downloadSkipped(summary.skipped)} style={{ ...btnSecondary, padding: '4px 10px', fontSize: 11 }}>Descargar detalle (.csv)</button>
            </div>
          )}

          {summary.total === 0 && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, fontSize: 13, color: '#ef4444', marginBottom: 14 }}>
              No encontramos productos válidos en el archivo. Cada fila necesita al menos SKU y nombre.
            </div>
          )}

          {summary.sample.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Muestra ({summary.sample.length} de {summary.total})
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>{['SKU', 'Nombre', 'Marca', 'Precio', 'Stock', 'Foto'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {summary.sample.map(r => (
                      <tr key={r.sku}>
                        <td style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}><code style={{ color: 'var(--accent)' }}>{r.sku}</code></td>
                        <td style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>{r.name}</td>
                        <td style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', color: r.brand ? 'var(--text)' : 'var(--text3)' }}>{r.brand ?? '—'}</td>
                        <td style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>{r.price ?? '—'}</td>
                        <td style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>{r.stock ?? '—'}</td>
                        <td style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', color: r.image ? '#22c55e' : 'var(--text3)' }}>{r.image ? 'Sí' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {limits.max_products !== null && newCount > remaining && (
            <div style={{ padding: '10px 14px', background: 'rgba(249,115,22,.1)', border: '1px solid rgba(249,115,22,.3)', borderRadius: 8, fontSize: 13, color: '#f97316', marginBottom: 16 }}>
              <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 6 }}><Icon name="alert" size={14} /></span>Tu plan permite {plural(limits.max_products, 'producto')} y ya tenés {usage.products}: si son todos nuevos, solo se importarán {remaining} de los {newCount}.
            </div>
          )}

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Resumen por marca
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {summary.byBrand.map(([brand, count]) => (
                <div key={brand} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 16px', borderBottom: '1px solid var(--border)',
                  opacity: brand === '(sin marca)' ? 0.5 : 1,
                }}>
                  <span style={{ fontSize: 13 }}>
                    {brand === '(sin marca)' ? 'Sin marca' : brand}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={reset} style={btnSecondary}>Cancelar</button>
            <button onClick={handleImport} disabled={summary.total === 0} style={{ ...btnPrimary, opacity: summary.total === 0 ? 0.5 : 1 }}>
              Importar {plural(summary.total, 'producto')}
            </button>
          </div>
        </div>
      )}

      {(step === 'importing' || step === 'done') && (
        <div>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
            padding: 16, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)',
            maxHeight: 400, overflowY: 'auto', lineHeight: 1.8,
          }}>
            {log.map((l, i) => <div key={i}>{l}</div>)}
            {step === 'importing' && <div style={{ color: 'var(--accent)' }}>Procesando...</div>}
          </div>
          {step === 'done' && (
            <button onClick={reset} style={{ ...btnPrimary, marginTop: 16 }}>
              Importar otro archivo
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', minWidth: 100 }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

const btnPrimary   = { padding: '9px 22px', background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: 13 }
const btnSecondary = { padding: '9px 16px', background: 'var(--surface-h)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, cursor: 'pointer' }
