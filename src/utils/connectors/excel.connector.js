import * as XLSX from 'xlsx'
import { normalizeRow } from './normalize'

/**
 * Excel connector — one implementation of the DataSource interface.
 *
 * Interface contract (all connectors must implement):
 *   parse(input, fieldMapping) → Promise<NormalizedProductRow[]>
 *   getDefaultFieldMapping()   → Record<string, string>
 *   getSampleHeaders(input)    → Promise<string[]>
 */
export const ExcelConnector = {
  /**
   * Parses an Excel File object into normalized product rows.
   * @param {File} file
   * @param {Object} fieldMapping  { "Source Column": "canonical_field" }
   */
  async parse(file, fieldMapping) {
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]

    // Read as array of arrays to find the real header row
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    // Find the row index where the actual headers are
    // (the row that contains 'MARCA' or 'marca' or 'CÓDIGO')
    let headerRow = 0
    for (let i = 0; i < Math.min(10, raw.length); i++) {
      const rowStr = raw[i].join('|').toLowerCase()
      if (rowStr.includes('marca') && (rowStr.includes('código') || rowStr.includes('codigo') || rowStr.includes('nombre'))) {
        headerRow = i
        break
      }
    }

    // Re-parse using the detected header row
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', range: headerRow })
    console.log('Header row detected at index:', headerRow)
    console.log('First raw row:', raw[headerRow])
    console.log('First parsed row:', rows[0])
    return rows.map(row => normalizeRow(row, fieldMapping))
  },

  /** Returns the headers from the first sheet without parsing data. */
  async getSampleHeaders(file) {
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    return rows[0] ?? []
  },

  /**
   * Opinionated default mapping for the Mancru-style Excel format.
   * Companies can override this per connector configuration.
   */
  getDefaultFieldMapping() {
    return {
      // Mancru format
      'marca':              'brand',
      'código':             'sku',
      'codigo':             'sku',
      'nombre_producto':    'name',
      'nombre':             'name',
      'categoría':          'category',
      'categoria':          'category',
      'descripción':        'description',
      'descripcion':        'description',
      'color / variante':   'color',
      'color':              'color',
      'url_imagen':         'image_ref',
      'url':                'image_ref',
      'imagen':             'image_ref',
      'activo':             'active',
      'precio':             'price',
      'stock':              'stock',
    }
  },
}
