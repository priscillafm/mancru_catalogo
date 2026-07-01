import { jsPDF } from 'jspdf'

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

// Parse hex color → [r, g, b] 0-255
function hexToRgb(hex) {
  const h = hex.replace('#', '')
  if (h.length === 3) {
    return [parseInt(h[0]+h[0], 16), parseInt(h[1]+h[1], 16), parseInt(h[2]+h[2], 16)]
  }
  return [parseInt(h.slice(0,2), 16), parseInt(h.slice(2,4), 16), parseInt(h.slice(4,6), 16)]
}

// Build the cover page as a canvas → base64 and embed
async function addCoverPage(doc, company, coverOptions, isLandscape) {
  const PW = isLandscape ? 297 : 210
  const PH = isLandscape ? 210 : 297

  const color1 = coverOptions?.color1 ?? '#6366f1'
  const color2 = coverOptions?.color2 ?? '#D4FF3F'
  const contacto = (coverOptions?.contacto ?? '').trim()

  // High-DPI canvas (3× for sharpness at PDF scale)
  const scale = 3
  const CW = PW * scale
  const CH = PH * scale

  const canvas = document.createElement('canvas')
  canvas.width  = CW
  canvas.height = CH
  const ctx = canvas.getContext('2d')

  // Dark background
  ctx.fillStyle = '#09090B'
  ctx.fillRect(0, 0, CW, CH)

  // ── Glow blobs (tech difuminado) ──
  // Blob 1: top-left area, color1
  const g1 = ctx.createRadialGradient(CW * 0.18, CH * 0.28, 0, CW * 0.18, CH * 0.28, CW * 0.55)
  const [r1, g1r, b1] = hexToRgb(color1)
  g1.addColorStop(0,   `rgba(${r1},${g1r},${b1},0.55)`)
  g1.addColorStop(0.5, `rgba(${r1},${g1r},${b1},0.15)`)
  g1.addColorStop(1,   `rgba(${r1},${g1r},${b1},0)`)
  ctx.fillStyle = g1
  ctx.fillRect(0, 0, CW, CH)

  // Blob 2: bottom-right area, color2
  const g2 = ctx.createRadialGradient(CW * 0.82, CH * 0.78, 0, CW * 0.82, CH * 0.78, CW * 0.5)
  const [r2, g2r, b2] = hexToRgb(color2)
  g2.addColorStop(0,   `rgba(${r2},${g2r},${b2},0.45)`)
  g2.addColorStop(0.5, `rgba(${r2},${g2r},${b2},0.12)`)
  g2.addColorStop(1,   `rgba(${r2},${g2r},${b2},0)`)
  ctx.fillStyle = g2
  ctx.fillRect(0, 0, CW, CH)

  // Blob 3: subtle center accent (mix of both colors, faint)
  const g3 = ctx.createRadialGradient(CW * 0.5, CH * 0.5, 0, CW * 0.5, CH * 0.5, CW * 0.35)
  g3.addColorStop(0,   `rgba(${Math.round((r1+r2)/2)},${Math.round((g1r+g2r)/2)},${Math.round((b1+b2)/2)},0.10)`)
  g3.addColorStop(1,   `rgba(0,0,0,0)`)
  ctx.fillStyle = g3
  ctx.fillRect(0, 0, CW, CH)

  // Subtle noise-like horizontal lines (very faint grid feel)
  ctx.strokeStyle = 'rgba(255,255,255,0.03)'
  ctx.lineWidth = 1
  for (let y = 0; y < CH; y += 28 * scale) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke()
  }

  const imgData = canvas.toDataURL('image/jpeg', 0.94)
  doc.addImage(imgData, 'JPEG', 0, 0, PW, PH)

  // ── Text overlay ──
  const centerX = PW / 2
  const centerY = PH / 2

  // "PROPUESTA COMERCIAL" label
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(200, 200, 200)
  doc.setCharSpace(3)
  doc.text('PROPUESTA COMERCIAL', centerX, centerY - 14, { align: 'center' })
  doc.setCharSpace(0)

  // Separator line
  const lineW = 60
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.3)
  doc.setLineDashPattern([1, 1.5], 0)
  doc.line(centerX - lineW / 2, centerY - 8, centerX + lineW / 2, centerY - 8)
  doc.setLineDashPattern([], 0)

  // Company name — large
  const companyName = company?.name ?? ''
  doc.setFontSize(isLandscape ? 26 : 22)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(companyName, centerX, centerY + 4, { align: 'center' })

  // Website at bottom center
  const website = company?.website ?? 'www.mancru.com'
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 180, 180)
  doc.text(website, centerX, PH - 10, { align: 'center' })

  // Separator line above footer text
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.2)
  doc.line(centerX - 30, PH - 13, centerX + 30, PH - 13)

  // Contact info — subtle, bottom-left
  if (contacto) {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(140, 140, 140)
    doc.text(contacto, 12, PH - 10)
  }
}

/**
 * Generates a multi-brand PDF catalog.
 * @param {Array<{brand, products[]}>} brandGroups
 * @param {Object} company
 * @param {Function} onProgress - (current, total) => void
 * @param {'landscape'|'portrait'} orientation
 * @param {Object|null} coverOptions - { enabled, color1, color2, contacto }
 */
export async function generateCatalogPDF(brandGroups, company, onProgress, orientation = 'landscape', coverOptions = null) {
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

  // Cover page (first page of the doc)
  if (coverOptions?.enabled) {
    await addCoverPage(doc, company, coverOptions, isLandscape)
  }

  let firstContentPage = true

  for (const { brand, products } of brandGroups) {
    const brandColor   = brand.color      ?? '#6366f1'
    const brandTextClr = brand.text_color ?? '#ffffff'
    const brandName    = brand.name       ?? ''
    let brandLogo = null
    if (brand.logo_url) {
      try { brandLogo = await loadImageAsBase64(brand.logo_url) } catch { brandLogo = null }
    }

    const sorted = [...products].sort((a, b) => {
      const catA = a.categories?.name ?? '￿'
      const catB = b.categories?.name ?? '￿'
      return catA.localeCompare(catB, 'es') || (a.name ?? '').localeCompare(b.name ?? '', 'es')
    })

    let slot = 0
    let pageNum = 0

    const renderHeaderFooter = (pg) => {
      doc.setFillColor(brandColor)
      doc.rect(0, 0, PW, HEADER_H, 'F')
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(brandTextClr)
      doc.text(companyName, PW / 2, 14, { align: 'center' })
      if (companyWeb) doc.text(companyWeb, PW - 10, 14, { align: 'right' })
      doc.setFillColor(brandColor)
      doc.rect(0, PH - FOOTER_H, PW, FOOTER_H, 'F')
      doc.setFontSize(7)
      doc.setTextColor(brandTextClr)
      doc.text(`${brandName}  •  Pág. ${pg + 1}`, PW / 2, PH - 2.5, { align: 'center' })
    }

    const renderLogo = async () => {
      if (brandLogo && typeof brandLogo === 'string' && brandLogo.startsWith('data:image')) {
        try {
          const fmt = brandLogo.startsWith('data:image/png') ? 'PNG' : 'JPEG'
          const dims = await new Promise(res => {
            const img = new Image()
            img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight })
            img.onerror = () => res(null)
            img.src = brandLogo
          })
          if (dims) {
            const maxH = HEADER_H - 6, maxW = 24
            const ratio = dims.w / dims.h
            let w = maxW, h = w / ratio
            if (h > maxH) { h = maxH; w = h * ratio }
            doc.addImage(brandLogo, fmt, 5, (HEADER_H - h) / 2, w, h, undefined, 'NONE')
            return
          }
        } catch { /* skip */ }
      }
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(brandTextClr)
      doc.text(brandName, 10, 14)
    }

    if (!firstContentPage || coverOptions?.enabled) doc.addPage()
    firstContentPage = false
    renderHeaderFooter(pageNum)
    await renderLogo()

    for (let si = 0; si < sorted.length; si++) {
      const p = sorted[si]

      if (si > 0 && sorted[si].category_id !== sorted[si - 1].category_id) {
        if (slot % COLS_PDF !== 0) {
          slot = Math.ceil(slot / COLS_PDF) * COLS_PDF
        }
      }

      if (slot >= PER_PAGE) {
        slot = 0
        pageNum++
        doc.addPage()
        renderHeaderFooter(pageNum)
        await renderLogo()
      }

      const col = slot % COLS_PDF
      const row = Math.floor(slot / COLS_PDF)
      const x   = 8 + col * CELL_W
      const y   = CONTENT_TOP + row * CELL_H

      globalIdx++
      onProgress && onProgress(globalIdx, totalProducts)

      const PAD     = 4
      const inner_w = CELL_W - PAD * 2

      doc.setFillColor('#f5f5f5')
      doc.roundedRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2, 3, 3, 'F')

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

      const SKU_H = 5.5
      doc.setFillColor(brandColor)
      doc.roundedRect(x + PAD, tY, inner_w, SKU_H, 1.5, 1.5, 'F')
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(brandTextClr)
      doc.text(String(p.sku ?? ''), x + CELL_W / 2, tY + 3.7, { align: 'center' })
      tY += SKU_H + 4

      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor('#111111')
      const nameLines = doc.splitTextToSize(String(p.name ?? ''), inner_w).slice(0, 2)
      doc.text(nameLines, x + PAD, tY)
      tY += nameLines.length * 4.2 + 1

      if (tY + 5 < y + CELL_H - PAD) {
        doc.setFontSize(6.5)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor('#888888')
        const descLines = doc.splitTextToSize(String(p.description ?? ''), inner_w).slice(0, 2)
        doc.text(descLines, x + PAD, tY)
      }

      if (p._price) {
        const curLabel = (p._currency ?? '$') === '$' ? '$ UYU' : 'USD'
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor('#111111')
        doc.text(`${curLabel} ${p._price}`, x + CELL_W / 2, y + CELL_H - 4, { align: 'center' })
      }

      slot++
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
