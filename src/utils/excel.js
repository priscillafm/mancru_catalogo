// Lee un número de una celda de texto respetando formatos latinos ("1.500,50") y anglo ("1,500.50").
export function parseNumber(v) {
  if (typeof v === 'number') return v
  let s = String(v ?? '').replace(/[^\d.,-]/g, '')
  if (!s) return null
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  if (lastDot !== -1 && lastComma !== -1) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (lastComma !== -1) {
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.')
  } else if (lastDot !== -1 && /^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '')
  }
  const n = parseFloat(s)
  return Number.isNaN(n) ? null : n
}

// Texto de una celda de ExcelJS, incluyendo fórmulas y texto enriquecido (value es un objeto).
export function cellText(cell) {
  const v = cell.value
  if (v == null) return ''
  if (typeof v === 'object' && !(v instanceof Date)) return String(cell.text ?? '').trim()
  return String(v).trim()
}

// Devuelve la URL si es http(s) válida; si no, null.
export function cleanUrl(v) {
  const s = String(v ?? '').trim()
  return /^https?:\/\/\S+$/i.test(s) ? s : null
}
