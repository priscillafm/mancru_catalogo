/**
 * Normalizes a raw row from any data source into a canonical ProductRow.
 * The fieldMapping is { "Source Column Name": "canonical_field" }.
 *
 * canonical_field values: sku | name | description | brand | category |
 *                          price | stock | active | image_ref
 */
export function normalizeRow(rawRow, fieldMapping) {
  const mapped = {}

  // Build a lowercase+no-accents version of the raw row keys for matching
  const normalizeKey = k => k.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // remove accents
    .trim()

  const rawLower = {}
  for (const [k, v] of Object.entries(rawRow)) {
    rawLower[normalizeKey(k)] = v
  }

  for (const [sourceKey, canonicalKey] of Object.entries(fieldMapping)) {
    const value = rawLower[normalizeKey(sourceKey)]
    if (value !== undefined && value !== null) {
      mapped[canonicalKey] = String(value).trim()
    }
  }

  return {
    sku:         mapped.sku         ?? '',
    name:        mapped.name        ?? '',
    description: mapped.description ?? '',
    brand:       mapped.brand       ?? '',
    category:    mapped.category    ?? '',
    price:       mapped.price       ? parseFloat(mapped.price) : null,
    stock:       mapped.stock       ? parseInt(mapped.stock, 10) : null,
    active:      mapped.active !== undefined
                   ? !['false','0','no','inactivo','inactive'].includes(mapped.active.toLowerCase())
                   : true,
    color:       mapped.color ?? null,
    image_ref:   mapped.image_ref   ?? null,   // URL, filename, or null
  }
}

/**
 * Auto-detects what kind of image reference the value is.
 * Returns: 'url' | 'filename' | null
 */
export function detectImageRefType(ref) {
  if (!ref) return null
  if (ref.startsWith('http://') || ref.startsWith('https://')) return 'url'
  if (/\.(jpe?g|png|gif|webp|avif)$/i.test(ref)) return 'filename'
  return null
}
