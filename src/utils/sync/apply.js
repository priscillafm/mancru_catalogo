import { supabase } from '@/lib/supabase'

/**
 * Applies approved diff rows to the database.
 * Called after the user reviews and confirms the sync.
 *
 * @param {string}   executionId
 * @param {string}   companyId
 * @param {DiffRow[]} rows        - only non-excluded rows will be applied
 */
export async function applyDiff(executionId, companyId, rows) {
  const toApply = rows.filter(r => !r.excluded && r.change_type !== 'no_change'
    && r.change_type !== 'error' && r.change_type !== 'skipped')

  const inserts = []
  const updates = []
  const softDeletes = []

  for (const row of toApply) {
    if (row.change_type === 'new') {
      inserts.push(buildProductRecord(row.new_data, companyId))
    } else if (row.change_type === 'updated') {
      updates.push({ sku: row.sku, data: buildProductRecord(row.new_data, companyId) })
    } else if (row.change_type === 'deleted') {
      softDeletes.push(row.sku)
    }
  }

  // Upsert new products
  if (inserts.length > 0) {
    const { error } = await supabase.from('products').insert(inserts)
    if (error) throw new Error(`Insert failed: ${error.message}`)
  }

  // Update modified products
  for (const { sku, data } of updates) {
    const { error } = await supabase
      .from('products')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .eq('sku', sku)
      .is('deleted_at', null)
    if (error) throw new Error(`Update ${sku} failed: ${error.message}`)
  }

  // Soft-delete removed products
  if (softDeletes.length > 0) {
    const { error } = await supabase
      .from('products')
      .update({ deleted_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .in('sku', softDeletes)
    if (error) throw new Error(`Soft delete failed: ${error.message}`)
  }

  // Mark execution as completed
  const { error: execError } = await supabase
    .from('sync_executions')
    .update({
      status: 'completed',
      rows_new: inserts.length,
      rows_updated: updates.length,
      rows_deleted: softDeletes.length,
      completed_at: new Date().toISOString(),
    })
    .eq('id', executionId)

  if (execError) throw new Error(`Execution update failed: ${execError.message}`)
}

function buildProductRecord(row, companyId) {
  const imageRef = row.image_ref ?? null
  const isUrl = imageRef && (imageRef.startsWith('http://') || imageRef.startsWith('https://'))

  return {
    company_id:   companyId,
    sku:          row.sku,
    name:         row.name,
    description:  row.description ?? '',
    brand_id:     row.brand_id    ?? null,
    category_id:  row.category_id ?? null,
    active:       row.active      ?? true,
    price:        row.price       ?? null,
    stock:        row.stock       ?? null,
    image_url:    isUrl ? imageRef : null,
    image_source: isUrl ? 'external' : null,
  }
}
