import { jsPDF } from 'jspdf'
import { COVER_STYLES } from './coverStyles'

const imgCache = new Map()
const fontCache = new Map()

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

function proxyUrl(url) {
  return `${SUPABASE_URL}/functions/v1/img-proxy?url=${encodeURIComponent(url)}`
}

// Fuentes del spec de diseño: Outfit (títulos, 600) + IBM Plex Sans (texto, 400/600)
const FONT_FILES = [
  { file: '/fonts/Outfit-SemiBold.ttf',       vfsName: 'Outfit-SemiBold.ttf',       family: 'Outfit',      style: 'bold'   },
  { file: '/fonts/IBMPlexSans-Regular.ttf',   vfsName: 'IBMPlexSans-Regular.ttf',   family: 'IBMPlexSans', style: 'normal' },
  { file: '/fonts/IBMPlexSans-SemiBold.ttf',  vfsName: 'IBMPlexSans-SemiBold.ttf',  family: 'IBMPlexSans', style: 'bold'   },
]

async function loadFontBase64(url) {
  if (fontCache.has(url)) return fontCache.get(url)
  const buf = await fetch(url).then(r => r.arrayBuffer())
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  const b64 = btoa(binary)
  fontCache.set(url, b64)
  return b64
}

// Registra Outfit + IBM Plex Sans en esta instancia de jsPDF (addFont es por-instancia).
// Si falla (ej. fetch bloqueado), se sigue con helvetica como fallback silencioso.
async function ensureFonts(doc) {
  try {
    for (const f of FONT_FILES) {
      const b64 = await loadFontBase64(f.file)
      doc.addFileToVFS(f.vfsName, b64)
      doc.addFont(f.vfsName, f.family, f.style)
    }
    doc.__customFontsLoaded = true
  } catch {
    doc.__customFontsLoaded = false
  }
}

// Títulos (portada, encabezado de marca) → Outfit 600. Todo lo demás → IBM Plex Sans.
function setFont(doc, style) {
  const bold = style === 'bold' || style === 'uibold' || style === 'mono' || style === 'bolditalic' || style === 'title'
  if (doc.__customFontsLoaded) {
    if (style === 'title') { doc.setFont('Outfit', 'bold'); return }
    doc.setFont('IBMPlexSans', bold ? 'bold' : 'normal')
    return
  }
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

  const color1     = coverOptions?.color1     ?? '#0F4C5C'
  const color2     = coverOptions?.color2     ?? '#E07A28'
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

  const bgColor    = isDark ? '#0B2A31' : '#F8F8F8'
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

  // ── Layout alineado a la izquierda (spec de diseño) ──
  const marginL   = 15
  const titleMaxW = PW - marginL - (isLandscape ? 85 : 40) // deja espacio al glow de la derecha
  let cursorY = 20

  // ── Marca: logo chico (si hay) o nombre de empresa como texto ──
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
          const maxW = 34, maxH = 14
          const ratio = dims.w / dims.h
          let w = maxW, h = w / ratio
          if (h > maxH) { h = maxH; w = h * ratio }
          logoH = h
          doc.addImage(logoPng, 'PNG', marginL, cursorY, w, h, undefined, 'NONE')
          logoRendered = true
        }
      }
    } catch { /* fallback: sin logo, el título grande alcanza */ }
  }
  if (logoRendered) cursorY += logoH + 10

  // ── "PROPUESTA COMERCIAL" — pill (opcional) ──
  if (showTagline) {
    doc.setFontSize(7.5)
    setFont(doc, 'ui')
    doc.setCharSpace(3)
    const label = 'PROPUESTA COMERCIAL'
    const tw = doc.getTextWidth(label)
    doc.setCharSpace(0)
    const pillW = tw + 16, pillH = 7.5
    doc.saveGraphicsState()
    doc.setGState(new doc.GState({ opacity: isDark ? 0.12 : 0.08 }))
    doc.setFillColor(...textWhite)
    doc.roundedRect(marginL, cursorY, pillW, pillH, pillH / 2, pillH / 2, 'F')
    doc.restoreGraphicsState()
    doc.setCharSpace(3)
    doc.setTextColor(...textLabel)
    doc.text(label, marginL + 8, cursorY + pillH / 2 + 1.3)
    doc.setCharSpace(0)
    cursorY += pillH + 10
  }

  // ── Título grande: nombre de la empresa ──
  let nameSize = isLandscape ? 46 : 32
  doc.setFontSize(nameSize)
  setFont(doc, 'title')
  const nameStr = company?.name ?? ''
  let titleLines = doc.splitTextToSize(nameStr, titleMaxW)
  while (titleLines.length > 2 && nameSize > 20) {
    nameSize -= 2
    doc.setFontSize(nameSize)
    titleLines = doc.splitTextToSize(nameStr, titleMaxW)
  }
  titleLines = titleLines.slice(0, 2)
  doc.setTextColor(...textWhite)
  const lineH = nameSize * 0.3528 * 1.12 // pt → mm, con interlineado ~1.12
  doc.text(titleLines, marginL, cursorY + nameSize * 0.3528 * 0.78, { lineHeightFactor: 1.12 })
  cursorY += lineH * titleLines.length + 6

  // ── Cliente (opcional) ──
  if (clientName) {
    doc.setFontSize(isLandscape ? 12 : 10)
    setFont(doc, 'ui')
    doc.setTextColor(...textSub)
    doc.text(fitText(doc, `Para ${clientName}`, titleMaxW), marginL, cursorY)
  }

  // ── Stat chips (proveedores / productos / moneda) — abajo a la izquierda ──
  if (stats) {
    const chips = [
      { label: stats.brandCount === 1 ? 'PROVEEDOR' : 'PROVEEDORES', value: String(stats.brandCount) },
      { label: 'PRODUCTOS', value: String(stats.totalProducts) },
      { label: 'MONEDA', value: stats.currency },
    ]
    const chipH = 14
    const chipGap = 4
    let chipX = marginL
    const chipY = PH - 26
    for (const chip of chips) {
      doc.setFontSize(6)
      const w = Math.max(doc.getTextWidth(chip.label), doc.getTextWidth(chip.value)) + 10
      doc.saveGraphicsState()
      doc.setGState(new doc.GState({ opacity: isDark ? 0.1 : 0.06 }))
      doc.setFillColor(...textWhite)
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

  // ── Contacto — abajo a la derecha ──
  const rightX = PW - marginL
  let contactY = PH - 10
  if (contacto) {
    doc.setFontSize(7)
    setFont(doc, 'ui')
    doc.setTextColor(...textFaint)
    doc.text(contacto, rightX, contactY, { align: 'right' })
    contactY -= 5
  }
  if (company?.website) {
    doc.setFontSize(8)
    setFont(doc, 'ui')
    doc.setTextColor(...textFaint)
    doc.text(company.website, rightX, contactY, { align: 'right' })
  }
}

function drawToggle(doc, x, y, on) {
  const w = 11, h = 5.5
  doc.setFillColor(on ? '#0F4C5C' : '#E7E3DA')
  doc.roundedRect(x, y, w, h, h / 2, h / 2, 'F')
  doc.setFillColor('#FFFFFF')
  doc.circle(on ? x + w - h / 2 : x + h / 2, y + h / 2, h / 2 - 0.8, 'F')
}

function drawGridIcon(doc, x, y, cols, rows, cell, gap, color) {
  const [r, g, b] = hexToRgb(color)
  doc.setFillColor(r, g, b)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      doc.roundedRect(x + col * (cell + gap), y + row * (cell + gap), cell, cell, 0.4, 0.4, 'F')
    }
  }
}

// Página final del PDF de ejemplo: explica qué se puede personalizar al exportar
// (spec de diseño: 6 tarjetas numeradas con mini-mockup de cada opción).
function addShowcasePage(doc, isLandscape) {
  const PW = isLandscape ? 297 : 210
  const PH = isLandscape ? 210 : 297
  doc.addPage()
  doc.setFillColor('#FAF8F4')
  doc.rect(0, 0, PW, PH, 'F')

  const marginL = 15
  const marginR = PW - 15

  doc.setFontSize(7.5)
  setFont(doc, 'ui')
  doc.setCharSpace(2)
  doc.setTextColor('#6E7A76')
  doc.text('ESTO ES SOLO UN EJEMPLO', marginL, 18)
  doc.setCharSpace(0)

  doc.setFontSize(18)
  setFont(doc, 'title')
  doc.setTextColor('#0E1A1E')
  doc.text('Cómo personalizás tu catálogo', marginL, 27)

  doc.setFontSize(8.5)
  setFont(doc, 'ui')
  doc.setTextColor('#6E7A76')
  const descLines = doc.splitTextToSize('Cada vez que exportás, elegís portada, colores, orientación y qué datos se muestran. Nada de esto queda fijo.', PW - marginR + 90)
  doc.text(descLines, marginR, 15, { align: 'right', lineHeightFactor: 1.35 })

  doc.setDrawColor('#E7E3DA')
  doc.setLineWidth(0.3)
  doc.line(marginL, 33, marginR, 33)

  const cols = 3
  const gap = 8
  const cardW = (marginR - marginL - gap * (cols - 1)) / cols
  const cardH = isLandscape ? 78 : 60
  const startY = 40

  const cards = [
    {
      num: 1, badge: '#0F4C5C', title: 'Subí tu marca',
      desc: 'Cargás tu logo (PNG o SVG), el nombre comercial y los datos de contacto. Se aplican a la portada y al pie de todas las páginas.',
      visual: (x, y, w) => {
        doc.setFillColor('#0F4C5C')
        doc.circle(x + 5, y + 5, 4, 'F')
        doc.setFontSize(7); setFont(doc, 'bold'); doc.setTextColor('#FFFFFF')
        doc.text('D', x + 5, y + 6.5, { align: 'center' })
        doc.setFillColor('#E7E3DA')
        doc.roundedRect(x + 13, y + 3, w - 13, 2, 1, 1, 'F')
        doc.roundedRect(x + 13, y + 7, (w - 13) * 0.6, 2, 1, 1, 'F')
      },
    },
    {
      num: 2, badge: '#0F4C5C', title: 'Elegí la portada',
      desc: 'Oscura, clara o con una foto tuya de fondo. Podés sumar un subtítulo, la fecha de vigencia y la lista de precios que aplica.',
      visual: (x, y) => {
        doc.setFillColor('#0B2A31'); doc.roundedRect(x, y, 14, 10, 1.5, 1.5, 'F')
        doc.setFillColor('#FFFFFF'); doc.setDrawColor('#E7E3DA'); doc.setLineWidth(0.2)
        doc.roundedRect(x + 17, y, 14, 10, 1.5, 1.5, 'FD')
        doc.setFillColor('#D8D4C8')
        doc.roundedRect(x + 34, y, 14, 10, 1.5, 1.5, 'F')
      },
    },
    {
      num: 3, badge: '#0F4C5C', title: 'Horizontal o vertical',
      desc: 'A4 horizontal entra 9 productos por página en grilla 3×3. A4 vertical entra 8, en 2×4. La grilla se reacomoda sola.',
      visual: (x, y) => {
        drawGridIcon(doc, x, y, 3, 3, 2.6, 1, '#E7E3DA')
        drawGridIcon(doc, x + 15, y, 2, 4, 2.6, 1, '#E7E3DA')
      },
    },
    {
      num: 4, badge: '#E07A28', title: 'Personalizá los colores',
      desc: 'Elegís un color de acento y un fondo. Títulos, precios, chips y separadores se recalculan manteniendo el contraste legible.',
      visual: (x, y) => {
        const swatches = ['#0F4C5C', '#E07A28', '#1F6B4A', '#6B4FB8']
        swatches.forEach((c, i) => {
          const [r, g, b] = hexToRgb(c)
          doc.setFillColor(r, g, b)
          doc.circle(x + 4 + i * 9, y + 4, 4, 'F')
        })
        doc.setFillColor('#FFFFFF'); doc.setDrawColor('#E7E3DA'); doc.setLineWidth(0.3)
        doc.circle(x + 4 + 4 * 9, y + 4, 4, 'FD')
      },
    },
    {
      num: 5, badge: '#E07A28', title: 'Decidí qué se muestra',
      desc: 'Activás o desactivás cada dato de la ficha: código, descripción, precio, IVA, moneda y stock.',
      visual: (x, y, w) => {
        const opts = [['Mostrar código', true], ['Precio con IVA', false], ['Stock disponible', false]]
        opts.forEach(([label, on], i) => {
          doc.setFontSize(6); setFont(doc, 'ui'); doc.setTextColor('#6E7A76')
          doc.text(label, x, y + i * 6 + 3)
          drawToggle(doc, x + w - 12, y + i * 6, on)
        })
      },
    },
    {
      num: 6, badge: '#FFFFFF', dark: true, title: 'Filtrá y exportá',
      desc: 'Seleccionás proveedores y categorías, ordenás por precio o por nombre, y exportás el PDF. Cada proveedor arranca en página nueva.',
      visual: (x, y) => {
        const pills = ['Bebidas del Sur', 'Snacks Andinos']
        let px = x
        doc.setFontSize(6.5); setFont(doc, 'bold')
        for (const p of pills) {
          const w = doc.getTextWidth(p) + 8
          doc.setFillColor('#FFFFFF')
          doc.roundedRect(px, y, w, 6, 3, 3, 'F')
          doc.setTextColor('#0B2A31')
          doc.text(p, px + w / 2, y + 4, { align: 'center' })
          px += w + 3
        }
        const sortW = doc.getTextWidth('Ordenar: A–Z') + 8
        doc.saveGraphicsState()
        doc.setGState(new doc.GState({ opacity: 0.5 }))
        doc.setFillColor('#FFFFFF')
        doc.roundedRect(x, y + 9, sortW, 6, 3, 3, 'F')
        doc.restoreGraphicsState()
        doc.setTextColor('#FFFFFF')
        doc.text('Ordenar: A–Z', x + sortW / 2, y + 13, { align: 'center' })
      },
    },
  ]

  cards.forEach((card, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = marginL + col * (cardW + gap)
    const y = startY + row * (cardH + gap)

    if (card.dark) {
      doc.setFillColor('#0B2A31')
      doc.roundedRect(x, y, cardW, cardH, 3, 3, 'F')
    } else {
      doc.setFillColor('#FFFFFF')
      doc.setDrawColor('#E7E3DA')
      doc.setLineWidth(0.25)
      doc.roundedRect(x, y, cardW, cardH, 3, 3, 'FD')
    }

    const pad = 6
    const [br, bgc, bb] = hexToRgb(card.badge)
    doc.setFillColor(br, bgc, bb)
    doc.circle(x + pad + 3, y + pad + 3, 3.4, 'F')
    doc.setFontSize(7)
    setFont(doc, 'bold')
    doc.setTextColor(card.dark ? '#0B2A31' : '#FFFFFF')
    doc.text(String(card.num), x + pad + 3, y + pad + 4.3, { align: 'center' })

    doc.setFontSize(10.5)
    setFont(doc, 'bold')
    doc.setTextColor(card.dark ? '#FFFFFF' : '#0E1A1E')
    doc.text(card.title, x + pad + 9, y + pad + 4.3)

    doc.setFontSize(7.5)
    setFont(doc, 'ui')
    doc.setTextColor(card.dark ? '#C9D3D6' : '#6E7A76')
    const lines = doc.splitTextToSize(card.desc, cardW - pad * 2)
    doc.text(lines, x + pad, y + pad + 12, { lineHeightFactor: 1.4 })

    card.visual(x + pad, y + cardH - 20, cardW - pad * 2)
  })
}

/**
 * Generates a multi-brand PDF catalog.
 */
export async function generateCatalogPDF(brandGroups, company, onProgress, orientation = 'landscape', coverOptions = null, showcase = false, ivaLabel = 'Precios sin IVA') {
  const isLandscape = orientation === 'landscape'
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  await ensureFonts(doc)

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
      doc.setTextColor('#6E7A76')
      doc.text('PROVEEDOR', SIDE_MARGIN + 5, 11)
      doc.setCharSpace(0)

      // Chips "N productos" + "Precios sin/con IVA" arriba a la derecha, en ese
      // orden de izquierda a derecha (se calculan antes para saber cuánto
      // espacio le queda al nombre de marca)
      const chipText = `${products.length} producto${products.length !== 1 ? 's' : ''}`
      doc.setFontSize(7.5)
      setFont(doc, 'bold')
      const ivaChipW = ivaLabel ? doc.getTextWidth(ivaLabel) + 10 : 0
      const ivaChipX = PW - SIDE_MARGIN - ivaChipW
      const chipW = doc.getTextWidth(chipText) + 10
      const chipX = ivaLabel ? ivaChipX - chipW - 4 : PW - SIDE_MARGIN - chipW

      if (ivaLabel) {
        doc.setFillColor('#F0EEE8')
        doc.roundedRect(ivaChipX, 10, ivaChipW, 7.5, 3.75, 3.75, 'F')
        doc.setTextColor('#6E7A76')
        doc.text(ivaLabel, ivaChipX + ivaChipW / 2, 15, { align: 'center' })
      }

      doc.setFontSize(21)
      setFont(doc, 'title')
      doc.setTextColor('#0E1A1E')
      const brandNameFit = fitText(doc, brandName, chipX - (SIDE_MARGIN + 5) - 6)
      doc.text(brandNameFit, SIDE_MARGIN + 5, 20)

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
      doc.setTextColor('#6E7A76')
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
      doc.setTextColor('#0E1A1E')
      const nameLines = doc.splitTextToSize(String(p.name ?? ''), textW).slice(0, 2)
      doc.text(nameLines, textX, y + CARD_PAD + 3.5, { lineHeightFactor: 1.3 })
      let cursorY = y + CARD_PAD + 3.5 + nameLines.length * 4.2

      if (p.description) {
        doc.setFontSize(7)
        setFont(doc, 'ui')
        doc.setTextColor('#6E7A76')
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
      doc.setTextColor('#6E7A76')
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
