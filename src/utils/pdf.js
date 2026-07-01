import { jsPDF } from 'jspdf'
import { COVER_STYLES } from './coverStyles'

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
    // If it's an SVG, rasterize via canvas so jsPDF can embed it
    if (b64.startsWith('data:image/svg')) {
      const png = await svgDataUrlToPng(b64)
      imgCache.set(url, png)
      return png
    }
    imgCache.set(url, b64)
    return b64
  } catch {
    return null
  }
}

// Convert an SVG data-URL to a PNG data-URL via off-screen canvas
function svgDataUrlToPng(svgDataUrl, targetW = 600, targetH = 300) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth  || targetW
      const h = img.naturalHeight || targetH
      // Keep aspect ratio but cap at target
      const scale = Math.min(targetW / w, targetH / h, 1)
      const cw = Math.round(w * scale)
      const ch = Math.round(h * scale)
      const canvas = document.createElement('canvas')
      canvas.width  = cw
      canvas.height = ch
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, cw, ch)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = svgDataUrl
  })
}

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  if (h.length === 3) return [parseInt(h[0]+h[0],16), parseInt(h[1]+h[1],16), parseInt(h[2]+h[2],16)]
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
}

// Generate a horizontal gradient bar as a JPEG data-URL (synchronous)
function makeGradientBar(w, h, brandColor) {
  const scale = 3
  const cw = Math.ceil(w * scale)
  const ch = Math.ceil(h * scale)
  const canvas = document.createElement('canvas')
  canvas.width  = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  const [r, g, b] = hexToRgb(brandColor)

  // Dark base
  ctx.fillStyle = '#09090B'
  ctx.fillRect(0, 0, cw, ch)

  // Brand color sweep — peaks at ~40% then fades out to the right
  const grad = ctx.createLinearGradient(0, 0, cw, 0)
  grad.addColorStop(0,    `rgba(${r},${g},${b},0.55)`)
  grad.addColorStop(0.30, `rgba(${r},${g},${b},1)`)
  grad.addColorStop(0.55, `rgba(${r},${g},${b},0.85)`)
  grad.addColorStop(1,    `rgba(${r},${g},${b},0.15)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, cw, ch)

  return canvas.toDataURL('image/jpeg', 0.92)
}

// Cover page
async function addCoverPage(doc, company, coverOptions, isLandscape) {
  const PW = isLandscape ? 297 : 210
  const PH = isLandscape ? 210 : 297

  const color1     = coverOptions?.color1     ?? '#6366f1'
  const color2     = coverOptions?.color2     ?? '#D4FF3F'
  const contacto   = (coverOptions?.contacto  ?? '').trim()
  const clientName = (coverOptions?.clientName ?? '').trim()
  const logoUrl    = (coverOptions?.logoUrl    ?? '').trim()
  const theme      = coverOptions?.theme      ?? 'dark'   // 'dark' | 'light'
  const styleName  = coverOptions?.style      ?? 'corners'

  const isDark = theme === 'dark'
  const bgColor    = isDark ? '#09090B' : '#F8F8F8'
  const gridColor  = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'
  const textWhite  = isDark ? [255,255,255] : [20,20,20]
  const textLabel  = isDark ? [180,180,180] : [100,100,100]
  const textSub    = isDark ? [160,160,160] : [130,130,130]
  const textFaint  = isDark ? [120,120,120] : [160,160,160]
  // Light mode: blobs are less opaque to avoid neon-on-white look
  const blobMult   = isDark ? 1.0 : 0.55

  // ── Background canvas ──
  const scale = 3
  const CW = PW * scale
  const CH = PH * scale
  const canvas = document.createElement('canvas')
  canvas.width  = CW
  canvas.height = CH
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, CW, CH)

  // Draw blobs from style definition
  const styleBlobs = (COVER_STYLES[styleName] ?? COVER_STYLES.corners).blobs
  const [r1, g1r, b1] = hexToRgb(color1)
  const [r2, g2r, b2] = hexToRgb(color2)
  const mr = Math.round((r1+r2)/2), mg = Math.round((g1r+g2r)/2), mb = Math.round((b1+b2)/2)

  for (const blob of styleBlobs) {
    const [br, bg_, bb] = blob.color === 'c1' ? [r1,g1r,b1]
                         : blob.color === 'c2' ? [r2,g2r,b2]
                         : [mr,mg,mb]
    const alpha = blob.alpha * blobMult
    const gx = CW * blob.cx
    const gy = CH * blob.cy
    const gr = CW * blob.r
    const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr)
    grad.addColorStop(0,   `rgba(${br},${bg_},${bb},${alpha})`)
    grad.addColorStop(0.45,`rgba(${br},${bg_},${bb},${(alpha*0.3).toFixed(3)})`)
    grad.addColorStop(1,   `rgba(${br},${bg_},${bb},0)`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, CW, CH)
  }

  // Faint grid lines
  ctx.strokeStyle = gridColor
  ctx.lineWidth = 1
  for (let y = 0; y < CH; y += 28 * scale) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke()
  }

  doc.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, PW, PH)

  const centerX = PW / 2
  const centerY = PH / 2

  // ── Logo ──
  let logoRendered = false
  if (logoUrl) {
    try {
      const logoPng = await loadImageAsBase64(logoUrl)
      if (logoPng) {
        const dims = await new Promise(res => {
          const img = new Image()
          img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight })
          img.onerror = () => res(null)
          img.src = logoPng
        })
        if (dims) {
          const maxW = isLandscape ? 80 : 60
          const maxH = isLandscape ? 28 : 22
          const ratio = dims.w / dims.h
          let w = maxW, h = w / ratio
          if (h > maxH) { h = maxH; w = h * ratio }
          doc.addImage(logoPng, 'PNG', centerX - w/2, centerY - (clientName ? 22 : 16), w, h, undefined, 'NONE')
          logoRendered = true
        }
      }
    } catch { /* fallback to text */ }
  }
  if (!logoRendered) {
    doc.setFontSize(isLandscape ? 26 : 22)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...textWhite)
    doc.text(company?.name ?? '', centerX, centerY - (clientName ? 8 : 4), { align: 'center' })
  }

  // ── "PROPUESTA COMERCIAL" label ──
  const labelY = logoRendered
    ? centerY + (clientName ? 11 : 7)
    : centerY + (clientName ? 4 : 8)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...textLabel)
  doc.setCharSpace(3.5)
  doc.text('PROPUESTA COMERCIAL', centerX, labelY, { align: 'center' })
  doc.setCharSpace(0)

  // ── Client name ──
  const lineColor = isDark ? [255,255,255] : [180,180,180]
  if (clientName) {
    doc.setDrawColor(...lineColor)
    doc.setLineWidth(0.2)
    doc.setLineDashPattern([1, 1.5], 0)
    doc.line(centerX - 28, labelY + 5, centerX + 28, labelY + 5)
    doc.setLineDashPattern([], 0)
    doc.setFontSize(isLandscape ? 13 : 11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...textSub)
    doc.text(clientName, centerX, labelY + 12, { align: 'center' })
  } else {
    doc.setDrawColor(...lineColor)
    doc.setLineWidth(0.2)
    doc.setLineDashPattern([1, 1.5], 0)
    doc.line(centerX - 28, labelY + 4, centerX + 28, labelY + 4)
    doc.setLineDashPattern([], 0)
  }

  // ── Website ──
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...textFaint)
  doc.text(company?.website ?? 'www.mancru.com', centerX, PH - 10, { align: 'center' })

  // ── Contact ──
  if (contacto) {
    doc.setFontSize(7)
    doc.setTextColor(...textFaint)
    doc.text(contacto, 12, PH - 10)
  }
}

/**
 * Generates a multi-brand PDF catalog.
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

  const companyName = company?.name    ?? ''
  const companyWeb  = company?.website ?? ''

  const totalProducts = brandGroups.reduce((n, g) => n + g.products.length, 0)
  let globalIdx = 0

  if (coverOptions?.enabled) {
    await addCoverPage(doc, company, coverOptions, isLandscape)
  }

  let firstContentPage = true

  // Load company logo once for all pages
  let companyLogo = null
  if (company?.logo_url) {
    try { companyLogo = await loadImageAsBase64(company.logo_url) } catch { companyLogo = null }
  }

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

    // Pre-generate gradient bars (sync — canvas.toDataURL is synchronous)
    const headerBarImg = makeGradientBar(PW, HEADER_H, brandColor)
    const footerBarImg = makeGradientBar(PW, FOOTER_H, brandColor)

    const renderHeaderFooter = (pg) => {
      // Gradient header bar (always dark bg)
      doc.addImage(headerBarImg, 'JPEG', 0, 0, PW, HEADER_H)

      // Website — always white since header is always dark
      if (companyWeb) {
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor('#ffffff')
        doc.text(companyWeb, PW - 10, 14, { align: 'right' })
      }

      // Gradient footer
      doc.addImage(footerBarImg, 'JPEG', 0, PH - FOOTER_H, PW, FOOTER_H)
      doc.setFontSize(7)
      doc.setTextColor('#ffffff')
      doc.text(`${brandName}  •  Pág. ${pg + 1}`, PW / 2, PH - 2.5, { align: 'center' })
    }

    // Render company logo (center) or text — called after header so it draws on top
    const renderCompanyCenter = async () => {
      if (companyLogo && typeof companyLogo === 'string' && companyLogo.startsWith('data:image')) {
        try {
          const dims = await new Promise(res => {
            const img = new Image()
            img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight })
            img.onerror = () => res(null)
            img.src = companyLogo
          })
          if (dims) {
            const maxH = HEADER_H - 6
            const maxW = isLandscape ? 60 : 45
            const ratio = dims.w / dims.h
            let w = maxW, h = w / ratio
            if (h > maxH) { h = maxH; w = h * ratio }
            const fmt = companyLogo.startsWith('data:image/png') ? 'PNG' : 'JPEG'
            doc.addImage(companyLogo, fmt, PW / 2 - w / 2, (HEADER_H - h) / 2, w, h, undefined, 'NONE')
            return
          }
        } catch { /* fallback to text */ }
      }
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor('#ffffff')
      doc.text(companyName, PW / 2, 14, { align: 'center' })
    }

    const renderBrandLogo = async () => {
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
            const maxH = HEADER_H - 4
            const maxW = isLandscape ? 42 : 32
            const ratio = dims.w / dims.h
            let w = maxW, h = w / ratio
            if (h > maxH) { h = maxH; w = h * ratio }
            doc.addImage(brandLogo, fmt, 5, (HEADER_H - h) / 2, w, h, undefined, 'NONE')
            return
          }
        } catch { /* skip */ }
      }
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(brandTextClr)
      doc.text(brandName, 10, 14)
    }

    if (!firstContentPage || coverOptions?.enabled) doc.addPage()
    firstContentPage = false
    renderHeaderFooter(pageNum)
    await renderCompanyCenter()
    await renderBrandLogo()

    for (let si = 0; si < sorted.length; si++) {
      const p = sorted[si]

      if (si > 0 && sorted[si].category_id !== sorted[si - 1].category_id) {
        if (slot % COLS_PDF !== 0) slot = Math.ceil(slot / COLS_PDF) * COLS_PDF
      }

      if (slot >= COLS_PDF * ROWS_PDF) {
        slot = 0
        pageNum++
        doc.addPage()
        renderHeaderFooter(pageNum)
        await renderCompanyCenter()
        await renderBrandLogo()
      }

      const col = slot % COLS_PDF
      const row = Math.floor(slot / COLS_PDF)
      const x   = 8 + col * CELL_W
      const y   = CONTENT_TOP + row * CELL_H

      globalIdx++
      onProgress && onProgress(globalIdx, totalProducts)

      const PAD     = 3
      const MARGIN  = 1.5
      const inner_w = CELL_W - PAD * 2

      // ── Card shadow (offset grey rect) ──
      doc.setFillColor('#DDDDDD')
      doc.roundedRect(x + MARGIN + 1.2, y + MARGIN + 1.2, CELL_W - MARGIN * 2, CELL_H - MARGIN * 2, 4, 4, 'F')

      // ── Card white background ──
      doc.setFillColor('#FFFFFF')
      doc.roundedRect(x + MARGIN, y + MARGIN, CELL_W - MARGIN * 2, CELL_H - MARGIN * 2, 4, 4, 'F')

      // ── Image area: white square, fills top portion ──
      const imgAreaH = CELL_H * 0.54
      const imgPad   = 2
      const imgSize  = Math.min(inner_w - imgPad * 2, imgAreaH - imgPad * 2)
      const imgX     = x + (CELL_W - imgSize) / 2
      const imgY     = y + MARGIN + imgPad + 2

      // White bg for image (clip any bg artifacts)
      doc.setFillColor('#FFFFFF')
      doc.rect(x + MARGIN, y + MARGIN, CELL_W - MARGIN * 2, imgAreaH, 'F')

      const b64 = await loadImageAsBase64(p.image_url)
      if (b64) {
        try { doc.addImage(b64, 'JPEG', imgX, imgY, imgSize, imgSize, undefined, 'FAST') }
        catch { drawNoImage(doc, imgX, imgY, imgSize) }
      } else {
        drawNoImage(doc, imgX, imgY, imgSize)
      }

      // Thin separator line below image area
      doc.setDrawColor('#EEEEEE')
      doc.setLineWidth(0.3)
      doc.line(x + MARGIN + 2, y + MARGIN + imgAreaH, x + CELL_W - MARGIN - 2, y + MARGIN + imgAreaH)

      let tY = y + MARGIN + imgAreaH + 4

      // ── SKU badge: pill shape with brand color ──
      const skuText  = String(p.sku ?? '')
      const skuW     = Math.min(inner_w - 4, 28)
      const skuH     = 5
      const skuX     = x + (CELL_W - skuW) / 2
      const [sr, sg, sb] = hexToRgb(brandColor)
      doc.setFillColor(sr, sg, sb)
      doc.roundedRect(skuX, tY, skuW, skuH, 2.5, 2.5, 'F')
      doc.setFontSize(6.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(brandTextClr)
      doc.text(skuText, x + CELL_W / 2, tY + 3.5, { align: 'center' })
      tY += skuH + 3

      // ── Product name ──
      const textW = CELL_W - MARGIN * 2 - PAD * 2
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor('#111111')
      const nameLines = doc.splitTextToSize(String(p.name ?? ''), textW).slice(0, 2)
      doc.text(nameLines, x + CELL_W / 2, tY, { align: 'center' })
      tY += nameLines.length * 4 + 1

      // ── Description ──
      if (tY + 4 < y + CELL_H - 6) {
        doc.setFontSize(6)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor('#999999')
        const descLines = doc.splitTextToSize(String(p.description ?? ''), textW).slice(0, 2)
        doc.text(descLines, x + CELL_W / 2, tY, { align: 'center' })
      }

      // ── Price pinned at bottom ──
      if (p._price) {
        const curLabel = (p._currency ?? '$') === '$' ? '$ UYU' : 'USD'
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor('#111111')
        doc.text(`${curLabel} ${p._price}`, x + CELL_W / 2, y + CELL_H - 3, { align: 'center' })
      }

      slot++
    }
  }

  const date = new Date().toISOString().slice(0, 10)
  const name = brandGroups.length === 1 ? brandGroups[0].brand.name : companyName || 'Catalogo'
  doc.save(`Catalogo_${name.replace(/\s+/g, '_')}_${date}.pdf`)
}

function drawNoImage(doc, x, y, size) {
  doc.setFillColor('#e8e8e8')
  doc.roundedRect(x, y, size, size, 2, 2, 'F')
}
