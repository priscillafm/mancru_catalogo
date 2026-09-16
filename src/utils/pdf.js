import { jsPDF } from 'jspdf'
import { COVER_STYLES } from './coverStyles'

const imgCache = new Map()

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

function proxyUrl(url) {
  return `${SUPABASE_URL}/functions/v1/img-proxy?url=${encodeURIComponent(url)}`
}

// serif (times) for content, sans (helvetica) for UI chrome, mono (courier) for codes
function setFont(doc, style) {
  const bold = style === 'bold' || style === 'uibold' || style === 'mono' || style === 'bolditalic'
  doc.setFont('helvetica', bold ? 'bold' : 'normal')
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

// Trunca `text` con "…" para que no exceda maxWidth (mm) con la fuente/tamaño actual del doc.
function fitText(doc, text, maxWidth) {
  if (!text) return ''
  if (doc.getTextWidth(text) <= maxWidth) return text
  let t = text
  while (t.length > 1 && doc.getTextWidth(t + '…') > maxWidth) t = t.slice(0, -1)
  return t + '…'
}

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  if (h.length === 3) return [parseInt(h[0]+h[0],16), parseInt(h[1]+h[1],16), parseInt(h[2]+h[2],16)]
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
}

// Cover page
async function addCoverPage(doc, company, coverOptions, isLandscape, stats = null) {
  const PW = isLandscape ? 297 : 210
  const PH = isLandscape ? 210 : 297

  const color1     = coverOptions?.color1     ?? '#6366f1'
  const color2     = coverOptions?.color2     ?? '#D4FF3F'
  const contacto   = (coverOptions?.contacto  ?? '').trim()
  const clientName = (coverOptions?.clientName ?? '').trim()
  const showTagline = coverOptions?.showTagline !== false
  const theme      = coverOptions?.theme      ?? 'dark'   // 'dark' | 'light'
  const isDark = theme === 'dark'
  // Auto-select logo based on theme
  const logoUrl = isDark
    ? (coverOptions?.logoUrlDark ?? coverOptions?.logoUrl ?? '').trim()
    : (coverOptions?.logoUrlLight ?? coverOptions?.logoUrlDark ?? coverOptions?.logoUrl ?? '').trim()
  const styleName  = coverOptions?.style      ?? 'corners'

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
  let logoH = 0
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
          logoH = h
          const logoY = centerY - h / 2 - (clientName ? 14 : 10)
          doc.addImage(logoPng, 'PNG', centerX - w/2, logoY, w, h, undefined, 'NONE')
          logoRendered = true
        }
      }
    } catch { /* fallback to text */ }
  }
  const coverSafeW = (isLandscape ? PW : PW) - 60 // margen seguro a cada lado del centro

  if (!logoRendered) {
    let nameSize = isLandscape ? 26 : 22
    doc.setFontSize(nameSize)
    setFont(doc, 'bold')
    while (nameSize > 12 && doc.getTextWidth(company?.name ?? '') > coverSafeW) {
      nameSize -= 1
      doc.setFontSize(nameSize)
    }
    doc.setTextColor(...textWhite)
    doc.text(fitText(doc, company?.name ?? '', coverSafeW), centerX, centerY - (clientName ? 8 : 4), { align: 'center' })
  }

  // ── "PROPUESTA COMERCIAL" label — 14mm below logo bottom (opcional) ──
  const labelY = logoRendered
    ? centerY - logoH / 2 - (clientName ? 14 : 10) + logoH + 14
    : centerY + (clientName ? 4 : 8)
  if (showTagline) {
    doc.setFontSize(7.5)
    setFont(doc, 'ui')
    doc.setTextColor(...textLabel)
    doc.setCharSpace(4)
    doc.text('PROPUESTA COMERCIAL', centerX, labelY, { align: 'center' })
    doc.setCharSpace(0)
  }

  // ── Client name ──
  const lineColor = isDark ? [255,255,255] : [180,180,180]
  if (clientName) {
    doc.setDrawColor(...lineColor)
    doc.setLineWidth(0.2)
    doc.setLineDashPattern([1, 1.5], 0)
    doc.line(centerX - 28, labelY + 5, centerX + 28, labelY + 5)
    doc.setLineDashPattern([], 0)
    let clientSize = isLandscape ? 13 : 11
    doc.setFontSize(clientSize)
    setFont(doc, 'italic')
    while (clientSize > 8 && doc.getTextWidth(clientName) > coverSafeW) {
      clientSize -= 1
      doc.setFontSize(clientSize)
    }
    doc.setTextColor(...textSub)
    doc.text(fitText(doc, clientName, coverSafeW), centerX, labelY + 12, { align: 'center' })
  } else {
    doc.setDrawColor(...lineColor)
    doc.setLineWidth(0.2)
    doc.setLineDashPattern([1, 1.5], 0)
    doc.line(centerX - 28, labelY + 4, centerX + 28, labelY + 4)
    doc.setLineDashPattern([], 0)
  }

  // ── Stat chips (proveedores / productos / moneda) ──
  if (stats) {
    const chips = [
      { label: stats.brandCount === 1 ? 'PROVEEDOR' : 'PROVEEDORES', value: String(stats.brandCount) },
      { label: 'PRODUCTOS', value: String(stats.totalProducts) },
      { label: 'MONEDA', value: stats.currency },
    ]
    const chipH = 14
    const chipGap = 4
    let chipX = centerX - (isLandscape ? 60 : 45)
    const chipY = PH - 30
    const chipBg = isDark ? [255, 255, 255] : [20, 20, 20]
    for (const chip of chips) {
      doc.setFontSize(6)
      const w = Math.max(doc.getTextWidth(chip.label), doc.getTextWidth(chip.value)) + 10
      doc.setFillColor(chipBg[0], chipBg[1], chipBg[2])
      doc.saveGraphicsState()
      doc.setGState(new doc.GState({ opacity: isDark ? 0.08 : 0.05 }))
      doc.roundedRect(chipX, chipY, w, chipH, 3, 3, 'F')
      doc.restoreGraphicsState()
      setFont(doc, 'ui')
      doc.setCharSpace(1)
      doc.setTextColor(...textFaint)
      doc.text(chip.label, chipX + w / 2, chipY + 5.5, { align: 'center' })
      doc.setCharSpace(0)
      doc.setFontSize(9)
      setFont(doc, 'bold')
      doc.setTextColor(...textWhite)
      doc.text(chip.value, chipX + w / 2, chipY + 11, { align: 'center' })
      chipX += w + chipGap
    }
  }

  // ── Website ──
  doc.setFontSize(8)
  setFont(doc, 'ui')
  doc.setTextColor(...textFaint)
  if (company?.website) doc.text(company.website, centerX, PH - 10, { align: 'center' })

  // ── Contact ──
  if (contacto) {
    doc.setFontSize(7)
    doc.setTextColor(...textFaint)
    doc.text(contacto, 12, PH - 10)
  }
}

// Raster con las mismas manchas de color difuminadas que usa la portada real
// (ver addCoverPage) pero a tamaño mini, para que el mockup se vea como una
// portada de verdad y no como círculos sueltos.
function makeCoverThumbRaster(color1, color2, isDark) {
  const scale = 4
  const cw = 240 * scale, ch = 163 * scale
  const canvas = document.createElement('canvas')
  canvas.width = cw; canvas.height = ch
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = isDark ? '#09090B' : '#F8F8F8'
  ctx.fillRect(0, 0, cw, ch)

  const blobs = [
    { color: color1, cx: 0.22, cy: 0.32, r: 0.55 },
    { color: color2, cx: 0.75, cy: 0.62, r: 0.5 },
  ]
  for (const b of blobs) {
    const [r, g, bl] = hexToRgb(b.color)
    const gx = cw * b.cx, gy = ch * b.cy, gr = cw * b.r
    const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr)
    grad.addColorStop(0,    `rgba(${r},${g},${bl},0.9)`)
    grad.addColorStop(0.45, `rgba(${r},${g},${bl},0.28)`)
    grad.addColorStop(1,    `rgba(${r},${g},${bl},0)`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, cw, ch)
  }
  return canvas.toDataURL('image/jpeg', 0.92)
}

// Mini-mockup de una portada (para la página de "personalizá tu catálogo")
function drawCoverThumb(doc, x, y, w, h, { color1, color2, isDark, label }) {
  const raster = makeCoverThumbRaster(color1, color2, isDark)
  doc.addImage(raster, 'JPEG', x, y, w, h, undefined, 'FAST')
  doc.setDrawColor(isDark ? '#333333' : '#CCCCCC')
  doc.setLineWidth(0.15)
  doc.roundedRect(x, y, w, h, 2, 2, 'S')

  doc.setFontSize(6.5)
  setFont(doc, 'bold')
  doc.setTextColor(isDark ? '#FFFFFF' : '#1A1208')
  doc.text('Tu Marca', x + w / 2, y + h / 2, { align: 'center' })
  doc.setFontSize(6.5)
  setFont(doc, 'ui')
  doc.setTextColor('#666666')
  doc.text(label, x + w / 2, y + h + 5, { align: 'center' })
}

// Página final del PDF de ejemplo: muestra qué se puede personalizar
// (portadas, orientación) sin necesidad de generar 4 catálogos completos.
function addShowcasePage(doc, isLandscape) {
  const PW = isLandscape ? 297 : 210
  const PH = isLandscape ? 210 : 297
  doc.addPage()
  doc.setFillColor('#F4EFE6')
  doc.rect(0, 0, PW, PH, 'F')

  doc.setFontSize(16)
  setFont(doc, 'bold')
  doc.setTextColor('#1A1208')
  doc.text('Personalizá tu catálogo', PW / 2, 22, { align: 'center' })
  doc.setFontSize(9)
  setFont(doc, 'ui')
  doc.setTextColor('#888888')
  doc.text('Elegís portada, colores y orientación cada vez que exportás — esto es solo un ejemplo.', PW / 2, 30, { align: 'center' })

  const thumbW = isLandscape ? 55 : 70
  const thumbH = thumbW * 0.68
  const gap = 16
  const totalW = thumbW * 2 + gap
  const startX = (PW - totalW) / 2
  const rowY = 50

  drawCoverThumb(doc, startX, rowY, thumbW, thumbH, {
    isDark: true, color1: '#8B7FE8', color2: '#4FC3B0', label: 'Portada oscura',
  })
  drawCoverThumb(doc, startX + thumbW + gap, rowY, thumbW, thumbH, {
    isDark: false, color1: '#5B6EE8', color2: '#E8506B', label: 'Portada clara',
  })

  const row2Y = rowY + thumbH + 28
  drawCoverThumb(doc, startX, row2Y, thumbW, thumbH * 0.72, {
    isDark: true, color1: '#C864D8', color2: '#8B7FE8', label: 'Horizontal (A4)',
  })
  drawCoverThumb(doc, startX + thumbW + gap, row2Y, thumbW * 0.72, thumbH,
    { isDark: true, color1: '#5B6EE8', color2: '#C864D8', label: 'Vertical (A4)' })
}

/**
 * Generates a multi-brand PDF catalog.
 */
export async function generateCatalogPDF(brandGroups, company, onProgress, orientation = 'landscape', coverOptions = null, showcase = false, ivaLabel = 'Precios sin IVA') {
  const isLandscape = orientation === 'landscape'
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' })

  const PW = isLandscape ? 297 : 210
  const PH = isLandscape ? 210 : 297
  const SIDE_MARGIN = 12
  const GAP         = 6
  const HEADER_H    = 26
  const FOOTER_H    = 12
  const CONTENT_TOP = HEADER_H + 2
  const CONTENT_BOT = PH - FOOTER_H
  const COLS_PDF    = isLandscape ? 3 : 2
  const ROWS_PDF    = isLandscape ? 3 : 4
  const CELL_W = (PW - SIDE_MARGIN * 2 - GAP * (COLS_PDF - 1)) / COLS_PDF
  const CELL_H = (CONTENT_BOT - CONTENT_TOP - GAP * (ROWS_PDF - 1)) / ROWS_PDF

  const companyName = company?.name    ?? ''
  const companyWeb  = company?.website ?? ''

  const totalProducts = brandGroups.reduce((n, g) => n + g.products.length, 0)
  let globalIdx = 0
  let globalPageNum = 0

  if (coverOptions?.enabled) {
    const firstPriced = brandGroups.flatMap(g => g.products).find(p => p._currency)
    const stats = {
      totalProducts,
      brandCount: brandGroups.length,
      currency: firstPriced?._currency && firstPriced._currency !== '$' ? firstPriced._currency : 'UYU',
    }
    await addCoverPage(doc, company, coverOptions, isLandscape, stats)
  }

  let firstContentPage = true

  for (const { brand, products } of brandGroups) {
    const brandColor = brand.color ?? '#6366f1'
    const brandName  = brand.name  ?? ''

    const sorted = [...products].sort((a, b) => {
      const catA = a.categories?.name ?? '￿'
      const catB = b.categories?.name ?? '￿'
      return catA.localeCompare(catB, 'es') || (a.name ?? '').localeCompare(b.name ?? '', 'es')
    })

    let slot = 0
    const [br, bg, bb] = hexToRgb(brandColor)
    const tint = (pct) => `rgb(${Math.round(br + (255 - br) * pct)}, ${Math.round(bg + (255 - bg) * pct)}, ${Math.round(bb + (255 - bb) * pct)})`

    const renderHeaderFooter = () => {
      // Fondo crema para el cuerpo de la página (look más cálido/premium que blanco puro)
      doc.setFillColor('#FAF8F4')
      doc.rect(0, 0, PW, PH, 'F')

      // Barra de color de marca + "PROVEEDOR" + nombre
      doc.setFillColor(br, bg, bb)
      doc.rect(SIDE_MARGIN, 8, 1.3, 10, 'F')
      doc.setFontSize(6.5)
      setFont(doc, 'ui')
      doc.setCharSpace(1.2)
      doc.setTextColor('#8A8580')
      doc.text('PROVEEDOR', SIDE_MARGIN + 5, 11)
      doc.setCharSpace(0)

      // Chips "N productos" + "Precios sin/con IVA" arriba a la derecha (se
      // calculan antes para saber cuánto espacio le queda al nombre de marca)
      const chipText = `${products.length} producto${products.length !== 1 ? 's' : ''}`
      doc.setFontSize(7.5)
      setFont(doc, 'bold')
      const chipW = doc.getTextWidth(chipText) + 10
      const chipX = PW - SIDE_MARGIN - chipW

      let ivaChipX = chipX
      if (ivaLabel) {
        const ivaChipW = doc.getTextWidth(ivaLabel) + 10
        ivaChipX = chipX - ivaChipW - 4
        doc.setFillColor('#F0EEE8')
        doc.roundedRect(ivaChipX, 10, ivaChipW, 7.5, 3.75, 3.75, 'F')
        doc.setTextColor('#6E7A76')
        doc.text(ivaLabel, ivaChipX + ivaChipW / 2, 15, { align: 'center' })
      }

      doc.setFontSize(16)
      setFont(doc, 'bold')
      doc.setTextColor('#171310')
      const brandNameFit = fitText(doc, brandName, ivaChipX - (SIDE_MARGIN + 5) - 6)
      doc.text(brandNameFit, SIDE_MARGIN + 5, 19)

      doc.setFontSize(7.5)
      setFont(doc, 'bold')
      doc.setFillColor(tint(0.88))
      doc.roundedRect(chipX, 10, chipW, 7.5, 3.75, 3.75, 'F')
      doc.setTextColor(br, bg, bb)
      doc.text(chipText, chipX + chipW / 2, 15, { align: 'center' })

      // Línea divisoria bajo el header
      doc.setDrawColor('#E7E3DA')
      doc.setLineWidth(0.3)
      doc.line(SIDE_MARGIN, HEADER_H - 3, PW - SIDE_MARGIN, HEADER_H - 3)

      // Footer: empresa · web (izq) — marca — página (der)
      doc.setDrawColor('#E7E3DA')
      doc.line(SIDE_MARGIN, PH - FOOTER_H + 4, PW - SIDE_MARGIN, PH - FOOTER_H + 4)
      doc.setFontSize(7)
      setFont(doc, 'ui')
      doc.setTextColor('#9C948A')
      const footerHalfW = (PW - SIDE_MARGIN * 2) / 2 - 4
      const footerLeft  = fitText(doc, [companyName, companyWeb].filter(Boolean).join(' · '), footerHalfW)
      const footerRight = fitText(doc, `${brandName} — ${String(globalPageNum).padStart(2, '0')}`, footerHalfW)
      doc.text(footerLeft, SIDE_MARGIN, PH - 6)
      doc.text(footerRight, PW - SIDE_MARGIN, PH - 6, { align: 'right' })
    }

    if (!firstContentPage || coverOptions?.enabled) doc.addPage()
    firstContentPage = false
    globalPageNum++
    renderHeaderFooter()

    for (let si = 0; si < sorted.length; si++) {
      const p = sorted[si]

      if (si > 0 && sorted[si].category_id !== sorted[si - 1].category_id) {
        if (slot % COLS_PDF !== 0) slot = Math.ceil(slot / COLS_PDF) * COLS_PDF
      }

      if (slot >= COLS_PDF * ROWS_PDF) {
        slot = 0
        doc.addPage()
        globalPageNum++
        renderHeaderFooter()
      }

      const col = slot % COLS_PDF
      const row = Math.floor(slot / COLS_PDF)
      const x   = SIDE_MARGIN + col * (CELL_W + GAP)
      const y   = CONTENT_TOP + row * (CELL_H + GAP)

      globalIdx++
      onProgress && onProgress(globalIdx, totalProducts)

      const CARD_PAD = 4

      // ── Card: borde suave, sin sombra dura ──
      doc.setDrawColor('#E7E3DA')
      doc.setLineWidth(0.25)
      doc.setFillColor('#FFFFFF')
      doc.roundedRect(x, y, CELL_W, CELL_H, 4, 4, 'FD')

      // ── Cuadrado a la izquierda: foto real o inicial con color de marca ──
      const monoSize = Math.min(CELL_H - CARD_PAD * 2, 26)
      const monoX = x + CARD_PAD
      const monoY = y + (CELL_H - monoSize) / 2

      const b64 = await loadImageAsBase64(p.image_url)
      if (b64) {
        try { doc.addImage(b64, 'JPEG', monoX, monoY, monoSize, monoSize, undefined, 'FAST') }
        catch { drawMonogram(doc, monoX, monoY, monoSize, p.name, brandColor) }
      } else {
        drawMonogram(doc, monoX, monoY, monoSize, p.name, brandColor)
      }

      // ── Bloque de texto a la derecha ──
      const textX = monoX + monoSize + 5
      const textW = x + CELL_W - CARD_PAD - textX

      doc.setFontSize(9.5)
      setFont(doc, 'bold')
      doc.setTextColor('#171310')
      const nameLines = doc.splitTextToSize(String(p.name ?? ''), textW).slice(0, 2)
      doc.text(nameLines, textX, y + CARD_PAD + 3.5, { lineHeightFactor: 1.3 })
      let cursorY = y + CARD_PAD + 3.5 + nameLines.length * 4.2

      if (p.description) {
        doc.setFontSize(7)
        setFont(doc, 'ui')
        doc.setTextColor('#8A8580')
        const descLines = doc.splitTextToSize(String(p.description), textW).slice(0, 2)
        doc.text(descLines, textX, cursorY + 2.5, { lineHeightFactor: 1.3 })
      }

      // SKU pill (abajo-izq del bloque) + precio (abajo-der), alineados al piso de la tarjeta
      const bottomY = y + CELL_H - CARD_PAD

      const skuText = String(p.sku ?? '')
      doc.setFontSize(6.5)
      setFont(doc, 'bold')
      const skuW = doc.getTextWidth(skuText) + 8
      doc.setFillColor(tint(0.9))
      doc.roundedRect(textX, bottomY - 5.5, skuW, 5.5, 2.75, 2.75, 'F')
      doc.setTextColor('#6E6A62')
      doc.text(skuText, textX + skuW / 2, bottomY - 1.8, { align: 'center' })

      if (p._price) {
        const curLabel = (p._currency ?? '$') === '$' ? '$' : p._currency
        doc.setFontSize(11)
        setFont(doc, 'bold')
        doc.setTextColor(br, bg, bb)
        doc.text(`${curLabel} ${p._price}`, x + CELL_W - CARD_PAD, bottomY - 1, { align: 'right' })
      }

      slot++
    }
  }

  if (showcase) addShowcasePage(doc, isLandscape)

  const date = new Date().toISOString().slice(0, 10)
  const name = brandGroups.length === 1 ? brandGroups[0].brand.name : companyName || 'Catalogo'
  doc.save(`Catalogo_${name.replace(/\s+/g, '_')}_${date}.pdf`)
}

// Placeholder cuando el producto no tiene foto: un cuadrado con la
// inicial del nombre, en vez de un bloque gris vacío.
function drawMonogram(doc, x, y, size, name, brandColor) {
  const [r, g, b] = hexToRgb(brandColor)
  doc.setFillColor(Math.round(r + (255 - r) * 0.86), Math.round(g + (255 - g) * 0.86), Math.round(b + (255 - b) * 0.86))
  doc.roundedRect(x, y, size, size, 3, 3, 'F')
  const letter = String(name ?? '?').trim().charAt(0).toUpperCase() || '?'
  doc.setFontSize(size * 0.9)
  setFont(doc, 'bold')
  doc.setTextColor(r, g, b)
  doc.text(letter, x + size / 2, y + size / 2 + size * 0.16, { align: 'center' })
}
