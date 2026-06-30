/**
 * Computes the diff between incoming normalized rows and existing DB products.
 *
 * @param {NormalizedProductRow[]} incoming  - rows from the connector
 * @param {Object[]} existing                - current products from DB
 * @param {Object} brandMap                  - { name/alias → brand_id }
 * @param {Object} categoryMap               - { name/alias → category_id }
 *
 * @returns {DiffRow[]}
 */
export function computeDiff(incoming, existing, brandMap, categoryMap) {
  const existingBySku = Object.fromEntries(
    existing.map(p => [p.sku.toUpperCase(), p])
  )
  const incomingSkus = new Set()
  const rows = []
  const seenSkus = new Set()

  for (const row of incoming) {
    const sku = (row.sku || '').toUpperCase()

    if (!sku) {
      rows.push({ sku: '(vacío)', change_type: 'error', old_data: null,
        new_data: row, changed_fields: [], error: 'SKU vacío' })
      continue
    }

    if (seenSkus.has(sku)) {
      rows.push({ sku, change_type: 'skipped', old_data: null,
        new_data: row, changed_fields: [], error: 'SKU duplicado en el archivo' })
      continue
    }

    seenSkus.add(sku)
    incomingSkus.add(sku)

    const current = existingBySku[sku]

    if (!current) {
      rows.push({
        sku,
        change_type: 'new',
        old_data: null,
        new_data: enrichRow(row, brandMap, categoryMap),
        changed_fields: [],
      })
    } else {
      const enriched = enrichRow(row, brandMap, categoryMap)
      const changed = detectChangedFields(current, enriched)

      rows.push({
        sku,
        change_type: changed.length > 0 ? 'updated' : 'no_change',
        old_data: pick(current, TRACKED_FIELDS),
        new_data: enriched,
        changed_fields: changed,
      })
    }
  }

  // Products in DB but not in incoming file → marked as deleted
  for (const [sku, product] of Object.entries(existingBySku)) {
    if (!incomingSkus.has(sku) && !product.deleted_at) {
      rows.push({
        sku,
        change_type: 'deleted',
        old_data: pick(product, TRACKED_FIELDS),
        new_data: null,
        changed_fields: [],
      })
    }
  }

  return rows
}

const TRACKED_FIELDS = ['sku','name','description','active','brand_id','category_id','price','stock','image_ref']

function enrichRow(row, brandMap, categoryMap) {
  return {
    ...row,
    brand_id:    resolveName(row.brand, brandMap),
    category_id: resolveName(row.category, categoryMap),
  }
}

function resolveName(name, map) {
  if (!name) return null
  const key = name.trim().toLowerCase()
  return map[key] ?? null
}

function detectChangedFields(current, incoming) {
  const fields = []
  const compare = [
    ['name',        current.name,        incoming.name],
    ['description', current.description, incoming.description],
    ['active',      current.active,      incoming.active],
    ['brand_id',    current.brand_id,    incoming.brand_id],
    ['category_id', current.category_id, incoming.category_id],
    ['price',       current.price,       incoming.price],
    ['stock',       current.stock,       incoming.stock],
  ]
  for (const [field, a, b] of compare) {
    // eslint-disable-next-line eqeqeq
    if (a != b) fields.push(field)
  }
  return fields
}

function pick(obj, keys) {
  return Object.fromEntries(keys.filter(k => k in obj).map(k => [k, obj[k]]))
}

/**
 * Summarizes diff rows into counts by change_type.
 */
export function summarizeDiff(rows) {
  return rows.reduce((acc, r) => {
    acc[r.change_type] = (acc[r.change_type] ?? 0) + 1
    return acc
  }, {})
}
