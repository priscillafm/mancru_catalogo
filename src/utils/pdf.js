import { jsPDF } from 'jspdf'

const COLS = 4
const ROWS = 2
const PER  = COLS * ROWS

const imgCache = new Map()

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

function proxyUrl(url) {
  return `${SUPABASE_URL}/functions/v1/img-proxy?url=${encodeURIComponent(url)}`
}

async function fetchBlob(url, headers = {}) {
  const resp = await Promise.race([
    fetch(url, { headers }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000))
  ])
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const blob = await resp.blob()
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload  = e => res(e.target.result)
    reader.onerror = rej
    reader.readAsDataURL(blob)
  })
}

async function loadImageAsBase64(url) {
  if (!url) return null
  if (imgCache.has(url)) return imgCache.get(url)
  try {
    const b64 = await fetchBlob(proxyUrl(url), {
      'Authorization': `Bearer ${SUPABASE_ANON}`,
      'apikey': SUPABASE_ANON,
    })
    imgCache.set(url, b64)
    return b64
  } catch {
    return null
  }
}

/**
 * Generates a multi-brand PDF catalog.
 * @param {Array<{brand, products[]}>} brandGroups
 * @param {Object} company
 * @param {Function} onProgress - (current, total) => void
 */
export async function generateCatalogPDF(brandGroups, company, onProgress, orientation = 'landscape') {
  const isLandscape = orientation === 'landscape'
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' })

  const PW = isLandscape ? 297 : 210
  const PH = isLandscape ? 210 : 297
  const HEADER_H    = 22
  const FOOTER_H    = 8
  const CONTENT_TOP = HEADER_H + 6
  const CONTENT_BOT = PH - FOOTER_H - 4
  const COLS_PDF    = isLandscape ? 4 : 3
  const ROWS_PDF    = isLandscape ? 2 : 4
  const CELL_W = (PW - 16) / COLS_PDF
  const CELL_H = (CONTENT_BOT - CONTENT_TOP) / ROWS_PDF
  const PER_PAGE = COLS_PDF * ROWS_PDF

  const companyName = company?.name    ?? ''
  const companyWeb  = company?.website ?? ''

  const totalProducts = brandGroups.reduce((n, g) => n + g.products.length, 0)
  let globalIdx = 0

  let firstPage = true

  for (const { brand, products } of brandGroups) {
    const brandColor   = brand.color      ?? '#6366f1'
    const brandTextClr = brand.text_color ?? '#ffffff'
    const brandName    = brand.name       ?? ''
    let brandLogo = null
    if (brand.logo_url) {
      try { brandLogo = await loadImageAsBase64(brand.logo_url) } catch { brandLogo = null }
    }
    const pages        = Math.ceil(products.length / PER_PAGE)

    for (let pg = 0; pg < pages; pg++) {
      if (!firstPage) doc.addPage()
      firstPage = false

      // ── Header ──────────────────────────────────────
      doc.setFillColor(brandColor)
      doc.rect(0, 0, PW, HEADER_H, 'F')
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(brandTextClr)
      let logoAdded = false
      if (brandLogo && typeof brandLogo === 'string' && brandLogo.startsWith('data:image')) {
        try {
          const fmt = brandLogo.startsWith('data:image/png') ? 'PNG' : 'JPEG'
          // Get natural dimensions to preserve aspect ratio
          const dims = await new Promise(res => {
            const img = new Image()
            img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight })
            img.onerror = () => res(null)
            img.src = brandLogo
          })
          if (dims) {
            const maxH = HEADER_H - 6
            const maxW = 24
            const ratio = dims.w / dims.h
            let w, h
            if (ratio > 1) { w = maxW; h = w / ratio }
            else           { h = maxH; w = h * ratio }
            if (h > maxH)  { h = maxH; w = h * ratio }
            doc.addImage(brandLogo, fmt, 5, (HEADER_H - h) / 2, w, h, undefined, 'FAST')
            logoAdded = w
          }
        } catch { /* skip logo if it fails */ }
      }
      doc.text(brandName, logoAdded ? 5 + logoAdded + 3 : 10, 14)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(companyName, PW / 2, 14, { align: 'center' })
      if (companyWeb) doc.text(companyWeb, PW - 10, 14, { align: 'right' })

      // ── Footer ──────────────────────────────────────
      doc.setFillColor(brandColor)
      doc.rect(0, PH - FOOTER_H, PW, FOOTER_H, 'F')
      doc.setFontSize(7)
      doc.setTextColor(brandTextClr)
      doc.text(`${brandName}  •  Pág. ${pg + 1} / ${pages}`, PW / 2, PH - 2.5, { align: 'center' })

      // ── Products ─────────────────────────────────────
      const batch = products.slice(pg * PER_PAGE, (pg + 1) * PER_PAGE)

      for (let ci = 0; ci < batch.length; ci++) {
        const p   = batch[ci]
        const col = ci % COLS_PDF
        const row = Math.floor(ci / COLS_PDF)

        const x = 8 + col * CELL_W
        const y = CONTENT_TOP + row * CELL_H

        globalIdx++
        onProgress && onProgress(globalIdx, totalProducts)

        const PAD     = 4
        const inner_w = CELL_W - PAD * 2

        // Card background
        doc.setFillColor('#f5f5f5')
        doc.roundedRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2, 3, 3, 'F')

        // Image area: 52% of cell height
        const imgAreaH = CELL_H * 0.52
        const imgSize  = Math.min(inner_w, imgAreaH) - 2
        const imgX     = x + (CELL_W - imgSize) / 2
        const imgY     = y + PAD

        const b64 = await loadImageAsBase64(p.image_url)
        if (b64) {
          try { doc.addImage(b64, 'JPEG', imgX, imgY, imgSize, imgSize, undefined, 'FAST') }
          catch { drawNoImage(doc, imgX, imgY, imgSize) }
        } else {
          drawNoImage(doc, imgX, imgY, imgSize)
        }

        let tY = imgY + imgSize + 3

        // SKU badge
        const SKU_H = 5.5
        doc.setFillColor(brandColor)
        doc.roundedRect(x + PAD, tY, inner_w, SKU_H, 1.5, 1.5, 'F')
        doc.setFontSize(7)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(brandTextClr)
        doc.text(String(p.sku ?? ''), x + CELL_W / 2, tY + 3.7, { align: 'center' })
        tY += SKU_H + 4

        // Product name
        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor('#111111')
        const nameLines = doc.splitTextToSize(String(p.name ?? ''), inner_w).slice(0, 2)
        doc.text(nameLines, x + PAD, tY)
        tY += nameLines.length * 4.2 + 1

        // Description
        if (tY + 5 < y + CELL_H - PAD) {
          doc.setFontSize(6.5)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor('#888888')
          const descLines = doc.splitTextToSize(String(p.description ?? ''), inner_w).slice(0, 2)
          doc.text(descLines, x + PAD, tY)
        }
      }
    }
  }

  const date = new Date().toISOString().slice(0, 10)
  const name = brandGroups.length === 1
    ? brandGroups[0].brand.name
    : companyName || 'Catalogo'
  doc.save(`Catalogo_${name.replace(/\s+/g, '_')}_${date}.pdf`)
}

function drawNoImage(doc, x, y, size) {
  doc.setFillColor('#e8e8e8')
  doc.roundedRect(x, y, size, size, 2, 2, 'F')
}
