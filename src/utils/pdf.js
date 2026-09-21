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

// Conversión de valores del spec de diseño (CSS px @96dpi) a las unidades de jsPDF.
const px  = v => v * 25.4 / 96   // px → mm (unit del doc)
const pxpt = v => v * 0.75       // px → pt (setFontSize/setCharSpace usan pt)

function alphaText(doc, text, x, y, rgb, alpha, opts) {
  doc.saveGraphicsState()
  doc.setGState(new doc.GState({ opacity: alpha }))
  doc.setTextColor(...rgb)
  doc.text(text, x, y, opts)
  doc.restoreGraphicsState()
}

function alphaFill(doc, x, y, w, h, rx, ry, rgb, alpha) {
  doc.saveGraphicsState()
  doc.setGState(new doc.GState({ opacity: alpha }))
  doc.setFillColor(...rgb)
  doc.roundedRect(x, y, w, h, rx, ry, 'F')
  doc.restoreGraphicsState()
}

// Cover page
async function addCoverPage(doc, company, coverOptions, isLandscape, stats = null) {
  const PW = isLandscape ? 297 : 210
  const PH = isLandscape ? 210 : 297

  const color1     = coverOptions?.color1     ?? '#0F4C5C'
  const color2     = coverOptions?.color2     ?? '#E07A28'
  const contacto   = (coverOptions?.contacto  ?? '').trim()
  const clientName = (coverOptions?.clientName ?? '').trim()
  const description = (coverOptions?.description ?? '').trim()
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

  // ── Layout exacto del spec de diseño: padding 64px/72px, columna a la
  // izquierda con marca arriba, título+descripción al medio, stats+contacto abajo ──
  const padLR = px(72)
  const padTB = px(64)
  const fg = isDark ? [247, 245, 240] : [20, 20, 20]
  const titleMaxW = PW - padLR * 2 - (isLandscape ? 70 : 0) // dejar aire al glow de la derecha en horizontal

  // ── Fila 1: marca (logo real si hay, si no inicial + "Tu logo acá") ──
  const logoBoxSize = px(44)
  let logoImgRendered = false
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
          const ratio = dims.w / dims.h
          let w = logoBoxSize * 1.8, h = w / ratio
          if (h > logoBoxSize) { h = logoBoxSize; w = h * ratio }
          doc.addImage(logoPng, 'PNG', padLR, padTB, w, h, undefined, 'NONE')
          logoImgRendered = true
        }
      }
    } catch { /* usa el placeholder */ }
  }
  if (!logoImgRendered) {
    doc.setFillColor(...fg)
    doc.roundedRect(padLR, padTB, logoBoxSize, logoBoxSize, px(14), px(14), 'F')
    doc.setFontSize(pxpt(20))
    setFont(doc, 'title')
    doc.setTextColor(bgColor)
    const initial = (company?.name ?? '?').trim().charAt(0).toUpperCase() || '?'
    doc.text(initial, padLR + logoBoxSize / 2, padTB + logoBoxSize / 2 + px(20) * 0.35, { align: 'center' })
    doc.setFontSize(pxpt(13))
    setFont(doc, 'ui')
    doc.setCharSpace(px(13) * 0.16)
    alphaText(doc, 'TU LOGO ACÁ', padLR + logoBoxSize + px(14), padTB + logoBoxSize / 2 + px(13) * 0.35, fg, 0.62)
    doc.setCharSpace(0)
  }

  // ── Fila 3 (medida primero para poder centrar la fila 2 entre ambas) ──
  const chipH = px(58)
  const bottomRowY = PH - padTB - chipH

  // ── Fila 2: pill + título + descripción, centrada entre fila 1 y fila 3 ──
  const pillH = showTagline ? px(30) : 0
  let titleSize = isLandscape ? 86 : 60
  doc.setFontSize(pxpt(titleSize))
  setFont(doc, 'title')
  const nameStr = company?.name ?? ''
  let titleLines = doc.splitTextToSize(nameStr, titleMaxW)
  while (titleLines.length > 2 && titleSize > 30) {
    titleSize -= 3
    doc.setFontSize(pxpt(titleSize))
    titleLines = doc.splitTextToSize(nameStr, titleMaxW)
  }
  titleLines = titleLines.slice(0, 2)
  const titleLineH = px(titleSize * 0.98)
  const descLineH = px(19 * 1.5)
  let descLines = []
  if (description) {
    doc.setFontSize(pxpt(19))
    setFont(doc, 'ui')
    descLines = doc.splitTextToSize(description, Math.min(titleMaxW, px(560)))
  }
  const clientLineH = clientName ? px(19) : 0

  const middleH = pillH + (pillH ? px(24) : 0) + titleLineH * titleLines.length + px(24) * (descLines.length || clientName ? 1 : 0) + descLineH * descLines.length + clientLineH

  const topOfMiddle = padTB + logoBoxSize
  const gapAvail = Math.max(px(24), (bottomRowY - topOfMiddle - middleH) / 2)
  let cursorY = topOfMiddle + gapAvail

  if (showTagline) {
    doc.setFontSize(pxpt(13))
    setFont(doc, 'ui')
    const trackGap = px(13) * 0.14
    const label = 'PROPUESTA COMERCIAL'
    // getTextWidth no contempla el char-space (letter-spacing) que se aplica
    // recién al dibujar el texto — hay que sumarlo a mano para no cortar el texto.
    const tw = doc.getTextWidth(label) + trackGap * label.length
    const pillPadX = px(18)
    const pillW = tw + pillPadX * 2
    alphaFill(doc, padLR, cursorY, pillW, pillH, pillH / 2, pillH / 2, fg, isDark ? 0.1 : 0.08)
    doc.saveGraphicsState()
    doc.setDrawColor(...fg)
    doc.setGState(new doc.GState({ opacity: isDark ? 0.22 : 0.18 }))
    doc.setLineWidth(0.15)
    doc.roundedRect(padLR, cursorY, pillW, pillH, pillH / 2, pillH / 2, 'S')
    doc.restoreGraphicsState()
    doc.setCharSpace(trackGap)
    alphaText(doc, label, padLR + pillPadX, cursorY + pillH / 2 + px(13) * 0.32, fg, 0.8)
    doc.setCharSpace(0)
    cursorY += pillH + px(24)
  }

  doc.setFontSize(pxpt(titleSize))
  setFont(doc, 'title')
  doc.setCharSpace(-0.03 * pxpt(titleSize) * 0.3528)
  doc.setTextColor(...fg)
  doc.text(titleLines, padLR, cursorY + titleLineH * 0.85, { lineHeightFactor: 0.98 })
  doc.setCharSpace(0)
  cursorY += titleLineH * titleLines.length

  if (descLines.length) {
    cursorY += px(24)
    doc.setFontSize(pxpt(19))
    setFont(doc, 'ui')
    alphaText(doc, descLines, padLR, cursorY + px(19) * 0.85, fg, 0.72, { lineHeightFactor: 1.5 })
    cursorY += descLineH * descLines.length
  } else if (clientName) {
    cursorY += px(24)
    doc.setFontSize(pxpt(15))
    setFont(doc, 'ui')
    alphaText(doc, fitText(doc, `Para ${clientName}`, titleMaxW), padLR, cursorY + px(15) * 0.85, fg, 0.72)
  }

  // ── Fila 3: stats (izq) + contacto (der) ──
  if (stats) {
    const chips = [
      { label: stats.brandCount === 1 ? 'PROVEEDOR' : 'PROVEEDORES', value: String(stats.brandCount) },
      { label: 'PRODUCTOS', value: String(stats.totalProducts) },
      { label: 'MONEDA', value: stats.currency },
    ]
    const chipGap = px(12)
    const chipPadX = px(20)
    let chipX = padLR
    for (const chip of chips) {
      doc.setFontSize(pxpt(11))
      const labelTrackGap = px(11) * 0.14
      const labelW = doc.getTextWidth(chip.label) + labelTrackGap * chip.label.length
      const w = Math.max(labelW, doc.getTextWidth(chip.value) + pxpt(4)) + chipPadX * 2
      alphaFill(doc, chipX, bottomRowY, w, chipH, px(18), px(18), fg, isDark ? 0.08 : 0.06)
      doc.saveGraphicsState()
      doc.setDrawColor(...fg)
      doc.setGState(new doc.GState({ opacity: isDark ? 0.16 : 0.12 }))
      doc.setLineWidth(0.15)
      doc.roundedRect(chipX, bottomRowY, w, chipH, px(18), px(18), 'S')
      doc.restoreGraphicsState()
      setFont(doc, 'ui')
      doc.setCharSpace(px(11) * 0.14)
      alphaText(doc, chip.label, chipX + chipPadX, bottomRowY + px(12) + px(11) * 0.32, fg, 0.55)
      doc.setCharSpace(0)
      doc.setFontSize(pxpt(22))
      setFont(doc, 'title')
      doc.setTextColor(...fg)
      doc.text(chip.value, chipX + chipPadX, bottomRowY + px(12) + px(4) + px(22) * 0.75)
      chipX += w + chipGap
    }
  }

  const rightX = PW - padLR
  if (contacto || company?.website) {
    doc.setFontSize(pxpt(13))
    setFont(doc, 'ui')
    const lines = [contacto, company?.website].filter(Boolean)
    alphaText(doc, lines, rightX, bottomRowY + chipH / 2 - (lines.length - 1) * px(13) * 0.85 + px(13) * 0.3,
      fg, 0.55, { align: 'right', lineHeightFactor: 1.7 })
  }
}

// (x, yCenter) es el borde izquierdo del track y su centro vertical
function drawToggle(doc, x, yCenter, on) {
  const w = px(32), h = px(18)
  const y = yCenter - h / 2
  doc.setFillColor(on ? '#0F4C5C' : '#E1DDD4')
  doc.roundedRect(x, y, w, h, h / 2, h / 2, 'F')
  doc.setFillColor('#FFFFFF')
  doc.circle(on ? x + w - h / 2 : x + h / 2, yCenter, h / 2 - px(2), 'F')
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
  doc.setFillColor('#FFFFFF')
  doc.rect(0, 0, PW, PH, 'F')

  const marginL = px(56)
  const marginR = PW - px(56)
  const headerTop = px(48)

  doc.setFontSize(pxpt(11))
  setFont(doc, 'ui')
  doc.setCharSpace(pxpt(11) * 0.16 * 0.3528)
  doc.setTextColor('#7A857F')
  doc.text('ESTO ES SOLO UN EJEMPLO', marginL, headerTop)
  doc.setCharSpace(0)

  doc.setFontSize(pxpt(38))
  setFont(doc, 'title')
  doc.setCharSpace(-0.02 * pxpt(38) * 0.3528)
  doc.setTextColor('#0E1A1E')
  doc.text('Cómo personalizás tu catálogo', marginL, headerTop + px(36))
  doc.setCharSpace(0)

  doc.setFontSize(pxpt(13.5))
  setFont(doc, 'ui')
  doc.setTextColor('#6E7A76')
  const descLines = doc.splitTextToSize('Cada vez que exportás, elegís portada, colores, orientación y qué datos se muestran. Nada de esto queda fijo.', px(360))
  doc.text(descLines, marginR, headerTop - px(6), { align: 'right', lineHeightFactor: 1.55 })

  const headerLineY = headerTop + px(36) + px(8)
  doc.setDrawColor('#E7E3DA')
  doc.setLineWidth(0.3)
  doc.line(marginL, headerLineY, marginR, headerLineY)

  const cols = 3
  const gap = px(16)
  const cardW = (marginR - marginL - gap * (cols - 1)) / cols
  const cardH = (PH - px(34) - px(14) - px(11.5 * 1.3) - headerLineY - px(22) - gap) / 2
  const startY = headerLineY + px(22)

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
        const rowH = px(28), rowGap = px(7), toggleW = px(32)
        opts.forEach(([label, on], i) => {
          const rowY = y + i * (rowH + rowGap)
          doc.setFontSize(px(12)); setFont(doc, 'ui'); doc.setTextColor('#4A5551')
          doc.text(label, x + px(12), rowY + rowH / 2 + px(12) * 0.32)
          drawToggle(doc, x + w - toggleW - px(12), rowY + rowH / 2, on)
        })
      },
    },
    {
      num: 6, badge: '#FFFFFF', dark: true, title: 'Filtrá y exportá',
      desc: 'Seleccionás proveedores y categorías, ordenás por precio o por nombre, y exportás el PDF. Cada proveedor arranca en página nueva.',
      visual: (x, y) => {
        const pills = ['Bebidas del Sur', 'Snacks Andinos']
        const padX = px(13), padY = px(7)
        const pillH = padY * 2 + px(12)
        let curX = x
        doc.setFontSize(px(12)); setFont(doc, 'bold')
        for (const p of pills) {
          const w = doc.getTextWidth(p) + padX * 2
          doc.setFillColor('#FFFFFF')
          doc.roundedRect(curX, y, w, pillH, pillH / 2, pillH / 2, 'F')
          doc.setTextColor('#0B2A31')
          doc.text(p, curX + w / 2, y + pillH / 2 + px(12) * 0.32, { align: 'center' })
          curX += w + px(7)
        }
        const sortW = doc.getTextWidth('Ordenar: A–Z') + padX * 2
        const sortY = y + pillH + px(7)
        doc.saveGraphicsState()
        doc.setGState(new doc.GState({ opacity: 0.5 }))
        doc.setFillColor('#FFFFFF')
        doc.roundedRect(x, sortY, sortW, pillH, pillH / 2, pillH / 2, 'F')
        doc.restoreGraphicsState()
        doc.setTextColor('#FFFFFF')
        doc.text('Ordenar: A–Z', x + sortW / 2, sortY + pillH / 2 + px(12) * 0.32, { align: 'center' })
      },
    },
  ]

  cards.forEach((card, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = marginL + col * (cardW + gap)
    const y = startY + row * (cardH + gap)

    const cardRadius = px(26)
    if (card.dark) {
      doc.setFillColor('#0B2A31')
      doc.roundedRect(x, y, cardW, cardH, cardRadius, cardRadius, 'F')
    } else {
      doc.setFillColor('#FAF8F4')
      doc.setDrawColor('#EDE9E0')
      doc.setLineWidth(0.25)
      doc.roundedRect(x, y, cardW, cardH, cardRadius, cardRadius, 'FD')
    }

    const pad = px(22)
    const circleSize = px(28)
    const [br, bgc, bb] = hexToRgb(card.badge)
    doc.setFillColor(br, bgc, bb)
    doc.circle(x + pad + circleSize / 2, y + pad + circleSize / 2, circleSize / 2, 'F')
    doc.setFontSize(pxpt(14))
    setFont(doc, 'title')
    doc.setTextColor(card.dark ? '#0B2A31' : '#FFFFFF')
    doc.text(String(card.num), x + pad + circleSize / 2, y + pad + circleSize / 2 + px(14) * 0.32, { align: 'center' })

    doc.setFontSize(pxpt(18))
    setFont(doc, 'title')
    doc.setCharSpace(-0.01 * pxpt(18) * 0.3528)
    doc.setTextColor(card.dark ? '#FFFFFF' : '#0E1A1E')
    doc.text(card.title, x + pad + circleSize + px(10), y + pad + circleSize / 2 + px(18) * 0.32)
    doc.setCharSpace(0)

    doc.setFontSize(pxpt(13))
    setFont(doc, 'ui')
    doc.setTextColor(card.dark ? '#C9D3D6' : '#6E7A76')
    const lines = doc.splitTextToSize(card.desc, cardW - pad * 2)
    doc.text(lines, x + pad, y + pad + circleSize + px(14), { lineHeightFactor: 1.55 })

    card.visual(x + pad, y + cardH - px(70), cardW - pad * 2)
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
  // Valores exactos del spec de diseño (padding: 48px 56px 34px)
  const SIDE_MARGIN  = px(56)
  const PAD_TOP      = px(48)
  const PAD_BOTTOM   = px(34)
  const HEADER_ROW_H = px(44)  // alto de la barra de acento / nombre de marca
  const HEADER_GAP_B = px(20)  // padding-bottom del header hasta la línea divisoria
  const GRID_PAD     = px(22)  // aire entre las líneas divisorias y la grilla
  const FOOTER_GAP_T = px(14)  // padding-top del footer
  const FOOTER_TEXT_H = px(11.5 * 1.3)
  const GAP           = px(16)
  const HEADER_LINE_Y = PAD_TOP + HEADER_ROW_H + HEADER_GAP_B
  const FOOTER_LINE_Y = PH - PAD_BOTTOM - FOOTER_TEXT_H - FOOTER_GAP_T
  const CONTENT_TOP = HEADER_LINE_Y + GRID_PAD
  const CONTENT_BOT = FOOTER_LINE_Y - GRID_PAD
  const COLS_PDF    = isLandscape ? 3 : 2
  const ROWS_PDF    = isLandscape ? 3 : 4
  const CELL_W = (PW - SIDE_MARGIN * 2 - GAP * (COLS_PDF - 1)) / COLS_PDF
  const CELL_H = (CONTENT_BOT - CONTENT_TOP - GAP * (ROWS_PDF - 1)) / ROWS_PDF

  // Texto de chip más oscuro que el color de marca cuando éste es muy claro
  // (ej. naranja), para que siga siendo legible sobre el fondo tintado — igual
  // que el spec, que usa #B35E12 (no el naranja crudo) sobre fondo #FAEEE3.
  function chipTextColor(r, g, b) {
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    return lum > 120 ? [Math.round(r * 0.72), Math.round(g * 0.72), Math.round(b * 0.72)] : [r, g, b]
  }

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
    const chipTextRgb = chipTextColor(br, bg, bb)

    const renderHeaderFooter = () => {
      // Fondo crema para el cuerpo de la página (look más cálido/premium que blanco puro)
      doc.setFillColor('#FAF8F4')
      doc.rect(0, 0, PW, PH, 'F')

      // Barra de acento (pill vertical) + "PROVEEDOR" + nombre de marca
      const barW = px(10)
      doc.setFillColor(br, bg, bb)
      doc.roundedRect(SIDE_MARGIN, PAD_TOP, barW, HEADER_ROW_H, barW / 2, barW / 2, 'F')
      const textLeft = SIDE_MARGIN + barW + px(16)
      doc.setFontSize(pxpt(11))
      setFont(doc, 'ui')
      doc.setCharSpace(pxpt(11) * 0.16 * 0.3528)
      doc.setTextColor('#7A857F')
      doc.text('PROVEEDOR', textLeft, PAD_TOP + px(14))
      doc.setCharSpace(0)

      // Chips "N productos" + "Precios sin/con IVA" arriba a la derecha, en ese
      // orden de izquierda a derecha (se calculan antes para saber cuánto
      // espacio le queda al nombre de marca). Mismo tinte que el fondo/texto
      // de marca en ambos chips.
      const chipY = PAD_TOP + (HEADER_ROW_H - px(8) * 2 - pxpt(12.5) * 0.3528) / 2 - px(2)
      const chipH = px(8) * 2 + pxpt(12.5) * 0.3528
      const chipPadX = px(16)
      const chipText = `${products.length} producto${products.length !== 1 ? 's' : ''}`
      doc.setFontSize(pxpt(12.5))
      setFont(doc, 'ui')
      const ivaChipW = ivaLabel ? doc.getTextWidth(ivaLabel) + chipPadX * 2 : 0
      const ivaChipX = PW - SIDE_MARGIN - ivaChipW
      const chipW = doc.getTextWidth(chipText) + chipPadX * 2
      const chipGap = px(10)
      const chipX = ivaLabel ? ivaChipX - chipW - chipGap : PW - SIDE_MARGIN - chipW

      if (ivaLabel) {
        doc.setFillColor(tint(0.93))
        doc.roundedRect(ivaChipX, chipY, ivaChipW, chipH, chipH / 2, chipH / 2, 'F')
        doc.setTextColor(...chipTextRgb)
        doc.text(ivaLabel, ivaChipX + ivaChipW / 2, chipY + chipH / 2 + px(12.5) * 0.32, { align: 'center' })
      }

      doc.setFontSize(pxpt(34))
      setFont(doc, 'title')
      doc.setCharSpace(-0.02 * pxpt(34) * 0.3528)
      doc.setTextColor('#0E1A1E')
      const brandNameFit = fitText(doc, brandName, chipX - textLeft - px(10))
      doc.text(brandNameFit, textLeft, PAD_TOP + HEADER_ROW_H * 0.82)
      doc.setCharSpace(0)

      doc.setFontSize(pxpt(12.5))
      setFont(doc, 'ui')
      doc.setFillColor(tint(0.93))
      doc.roundedRect(chipX, chipY, chipW, chipH, chipH / 2, chipH / 2, 'F')
      doc.setTextColor(...chipTextRgb)
      doc.text(chipText, chipX + chipW / 2, chipY + chipH / 2 + px(12.5) * 0.32, { align: 'center' })

      // Línea divisoria bajo el header
      doc.setDrawColor('#E3DFD5')
      doc.setLineWidth(0.3)
      doc.line(SIDE_MARGIN, HEADER_LINE_Y, PW - SIDE_MARGIN, HEADER_LINE_Y)

      // Footer: empresa · web (izq) — marca — página (der)
      doc.setDrawColor('#E3DFD5')
      doc.line(SIDE_MARGIN, FOOTER_LINE_Y, PW - SIDE_MARGIN, FOOTER_LINE_Y)
      doc.setFontSize(pxpt(11.5))
      setFont(doc, 'ui')
      doc.setTextColor('#9AA29D')
      const footerY = FOOTER_LINE_Y + FOOTER_GAP_T + px(11.5) * 0.32
      const footerHalfW = (PW - SIDE_MARGIN * 2) / 2 - px(4)
      const footerLeft  = fitText(doc, [companyName, companyWeb].filter(Boolean).join(' · '), footerHalfW)
      const footerRight = fitText(doc, `${brandName} — ${String(globalPageNum).padStart(2, '0')}`, footerHalfW)
      doc.text(footerLeft, SIDE_MARGIN, footerY)
      doc.text(footerRight, PW - SIDE_MARGIN, footerY, { align: 'right' })
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

      const CARD_PAD = px(16)
      const CARD_GAP = px(16)
      const CARD_RADIUS = px(26)

      // ── Card: borde suave, sin sombra dura ──
      doc.setDrawColor('#E7E3DA')
      doc.setLineWidth(0.25)
      doc.setFillColor('#FFFFFF')
      doc.roundedRect(x, y, CELL_W, CELL_H, CARD_RADIUS, CARD_RADIUS, 'FD')

      // ── Cuadrado a la izquierda: foto real o inicial con color de marca ──
      const monoSize = Math.min(CELL_H - CARD_PAD * 2, px(96))
      const monoRadius = monoSize * (px(20) / px(96))
      const monoX = x + CARD_PAD
      const monoY = y + (CELL_H - monoSize) / 2

      const b64 = await loadImageAsBase64(p.image_url)
      if (b64) {
        try { doc.addImage(b64, 'JPEG', monoX, monoY, monoSize, monoSize, undefined, 'FAST') }
        catch { drawMonogram(doc, monoX, monoY, monoSize, monoRadius, p.name, brandColor) }
      } else {
        drawMonogram(doc, monoX, monoY, monoSize, monoRadius, p.name, brandColor)
      }

      // ── Bloque de texto a la derecha ──
      const textX = monoX + monoSize + CARD_GAP
      const textW = x + CELL_W - CARD_PAD - textX

      doc.setFontSize(pxpt(16.5))
      setFont(doc, 'title')
      doc.setCharSpace(-0.01 * pxpt(16.5) * 0.3528)
      doc.setTextColor('#0E1A1E')
      const nameLines = doc.splitTextToSize(String(p.name ?? ''), textW).slice(0, 2)
      const nameLineH = px(16.5 * 1.2)
      const nameTop = y + CARD_PAD
      doc.text(nameLines, textX, nameTop + nameLineH * 0.8, { lineHeightFactor: 1.2 })
      doc.setCharSpace(0)
      // Debajo de TODO el bloque del nombre (todas sus líneas), + margin-bottom:5px del spec
      let cursorY = nameTop + nameLineH * nameLines.length + px(5)

      if (p.description) {
        doc.setFontSize(pxpt(12.5))
        setFont(doc, 'ui')
        doc.setTextColor('#6E7A76')
        const descLines = doc.splitTextToSize(String(p.description), textW).slice(0, 2)
        doc.text(descLines, textX, cursorY + px(12.5) * 0.8, { lineHeightFactor: 1.4 })
      }

      // SKU pill (abajo-izq del bloque) + precio (abajo-der), alineados al piso de la tarjeta
      const bottomY = y + CELL_H - CARD_PAD

      const skuText = String(p.sku ?? '')
      doc.setFontSize(pxpt(11))
      setFont(doc, 'bold')
      const skuTrackGap = pxpt(11) * 0.06 * 0.3528
      doc.setCharSpace(skuTrackGap)
      const skuPadX = px(11)
      const skuH = px(5) * 2 + pxpt(11) * 0.3528
      const skuW = doc.getTextWidth(skuText) + skuTrackGap * skuText.length + skuPadX * 2
      doc.setFillColor('#F3F1EB')
      doc.roundedRect(textX, bottomY - skuH, skuW, skuH, skuH / 2, skuH / 2, 'F')
      doc.setTextColor('#8A938E')
      doc.text(skuText, textX + skuW / 2, bottomY - skuH / 2 + px(11) * 0.32, { align: 'center' })
      doc.setCharSpace(0)

      if (p._price) {
        const curLabel = (p._currency ?? '$') === '$' ? '$' : p._currency
        doc.setFontSize(pxpt(21))
        setFont(doc, 'title')
        doc.setTextColor('#0F4C5C')
        doc.text(`${curLabel} ${p._price}`, x + CELL_W - CARD_PAD, bottomY - px(2), { align: 'right' })
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
function drawMonogram(doc, x, y, size, radius, name, brandColor) {
  const [r, g, b] = hexToRgb(brandColor)
  const bgT = (v, c) => Math.round(v + (255 - v) * c)
  doc.setFillColor(bgT(r, 0.9), bgT(g, 0.9), bgT(b, 0.9))
  doc.roundedRect(x, y, size, size, radius, radius, 'F')
  const letter = String(name ?? '?').trim().charAt(0).toUpperCase() || '?'
  doc.setFontSize(pxpt(38))
  setFont(doc, 'title')
  doc.setTextColor(bgT(r, 0.7), bgT(g, 0.7), bgT(b, 0.7))
  doc.text(letter, x + size / 2, y + size / 2 + pxpt(38) * 0.35 * 0.3528, { align: 'center' })
}
