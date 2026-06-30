import { supabase } from '@/lib/supabase'
import { detectImageRefType } from '@/utils/connectors/normalize'

/**
 * Resolves image references for a list of products after sync.
 *
 * For each product with an image_ref:
 *   1. Check image_mappings for a confirmed mapping → use resolved_url
 *   2. Detect if ref is a URL (Mode A) → store directly
 *   3. Try exact SKU match on filename (Mode B auto)
 *   4. Try fuzzy filename match
 *   5. Leave unresolved → queued for manual mapping (Mode C)
 */
export async function resolveImageRefs(companyId, products) {
  const { data: existingMappings } = await supabase
    .from('image_mappings')
    .select('source_key, product_sku, resolved_url, confirmed')
    .eq('company_id', companyId)

  const mappingByKey = Object.fromEntries(
    (existingMappings ?? []).map(m => [m.source_key.toLowerCase(), m])
  )

  const results = []

  for (const product of products) {
    const ref = product.image_ref
    if (!ref) continue

    const refLower = ref.toLowerCase()
    const existing = mappingByKey[refLower]

    // Already confirmed mapping
    if (existing?.confirmed) {
      results.push({ sku: product.sku, resolved_url: existing.resolved_url,
        method: 'confirmed_mapping' })
      continue
    }

    const refType = detectImageRefType(ref)

    // Mode A: direct URL
    if (refType === 'url') {
      results.push({ sku: product.sku, resolved_url: ref, method: 'url_field',
        source_key: ref })
      continue
    }

    // Mode B/C: filename reference
    if (refType === 'filename') {
      // Try exact SKU match: "ACC001.jpg" matches SKU "ACC001" or "ACC-001"
      const basename = ref.replace(/\.[^.]+$/, '').toUpperCase()
      const skuNorm = product.sku.replace(/[^A-Z0-9]/g, '').toUpperCase()

      if (basename === skuNorm || basename === product.sku.toUpperCase()) {
        results.push({ sku: product.sku, source_key: ref,
          resolved_url: null,   // URL will be set after file upload
          method: 'exact_sku', confidence: 0.95 })
      } else {
        // Leave for manual resolution
        results.push({ sku: product.sku, source_key: ref,
          resolved_url: null, method: 'fuzzy_filename', confidence: 0.0 })
      }
    }
  }

  return results
}

/**
 * Uploads a batch of image files to Supabase Storage and
 * upserts image_mappings with the resulting URLs.
 *
 * @param {string}   companyId
 * @param {File[]}   files
 * @param {Object[]} products     - array of { sku, ... }
 */
export async function uploadImageBatch(companyId, files, products) {
  const skuByNorm = Object.fromEntries(
    products.map(p => [p.sku.replace(/[^A-Z0-9]/gi, '').toUpperCase(), p.sku])
  )

  const results = { matched: 0, uploaded: 0, unmatched: [] }

  for (const file of files) {
    const basename = file.name.replace(/\.[^.]+$/, '')
    const norm = basename.replace(/[^A-Z0-9]/gi, '').toUpperCase()
    const matchedSku = skuByNorm[norm] ?? skuByNorm[basename.toUpperCase()]

    if (!matchedSku) {
      results.unmatched.push(file.name)
      continue
    }

    const ext = file.name.split('.').pop()
    const path = `${companyId}/${matchedSku}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      results.unmatched.push(file.name)
      continue
    }

    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(path)

    // Upsert image_mapping
    await supabase.from('image_mappings').upsert({
      company_id:   companyId,
      source_key:   file.name,
      product_sku:  matchedSku,
      resolved_url: publicUrl,
      match_method: 'exact_sku',
      confidence:   0.95,
      confirmed:    true,
    }, { onConflict: 'company_id,source_key' })

    // Update product image_url
    await supabase.from('products')
      .update({ image_url: publicUrl, image_source: 'storage' })
      .eq('company_id', companyId)
      .eq('sku', matchedSku)

    results.matched++
    results.uploaded++
  }

  return results
}
