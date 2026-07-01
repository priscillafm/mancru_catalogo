#!/usr/bin/env node
/**
 * scrape-images.cjs
 * Scrapes mancru.com product pages and updates image_url in Supabase.
 * Matches by product name (og:description) since pages don't contain ACC/INF SKUs.
 *
 * HOW TO RUN:
 *   node scripts/scrape-images.cjs
 */

const https = require('https')
const http  = require('http')

// ── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL     = 'https://wmzqpblqorfuawubryvt.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const MANCRU_BASE      = 'https://www.mancru.com'
const DELAY_MS         = 280
const BATCH_UPDATE     = 20
// ────────────────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function fetchUrl(url, retries = 2) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'es-UY,es;q=0.9',
        'Connection': 'keep-alive',
      },
      timeout: 20000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location.startsWith('http')
          ? res.headers.location
          : MANCRU_BASE + res.headers.location
        return fetchUrl(loc, retries).then(resolve).catch(reject)
      }
      let data = ''
      res.setEncoding('utf8')
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', async (err) => {
      if (retries > 0) { await sleep(1000); fetchUrl(url, retries - 1).then(resolve).catch(reject) }
      else reject(err)
    })
    req.on('timeout', () => {
      req.destroy()
      if (retries > 0) fetchUrl(url, retries - 1).then(resolve).catch(reject)
      else reject(new Error('timeout'))
    })
  })
}

function supabaseRequest(path, method = 'GET', body = null) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`
  return new Promise((resolve, reject) => {
    const opts = {
      method,
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
    }
    const bodyStr = body ? JSON.stringify(body) : null
    if (bodyStr) opts.headers['Content-Length'] = Buffer.byteLength(bodyStr)
    const req = https.request(url, opts, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null }) }
        catch { resolve({ status: res.statusCode, data }) }
      })
    })
    req.on('error', reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

// Normalize a product name for fuzzy matching
// "Touch Screen Alcatel OT6050 Blanco" → "touch screen alcatel ot6050 blanco"
function normalizeName(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// How many leading words to use for the index key (fewer = more lenient matching)
function nameKey(normalized, words = 5) {
  return normalized.split(' ').slice(0, words).join(' ')
}

function extractFromPage(html) {
  // Image: prefer productos31_ (bigger version), fallback to other imgs/productos
  const img31 = html.match(/src=["']((?:https?:\/\/[^"']*)?\/imgs\/productos\/productos31_\d+\.(?:jpg|png))["']/i)
  const imgAny = html.match(/src=["']((?:https?:\/\/[^"']*)?\/imgs\/productos\/[^"']+\.(?:jpg|png|webp))["']/i)
  let imageUrl = null
  const rawImg = img31?.[1] ?? imgAny?.[1] ?? null
  if (rawImg) {
    imageUrl = rawImg.startsWith('http') ? rawImg : MANCRU_BASE + rawImg
  }

  // Product name: from og:description (most reliable, has full name)
  const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
             ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i)
  // Also try og:title and page title as fallback
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
               ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)
  const pageTitle = html.match(/<title>([^<]+)<\/title>/i)

  const rawName = ogDesc?.[1] ?? ogTitle?.[1] ?? pageTitle?.[1] ?? ''
  const pageName = rawName.replace(/\s*[-|].*$/, '').trim() // strip "| Mancru" suffixes

  return { imageUrl, pageName }
}

async function main() {
  if (!SERVICE_ROLE_KEY) {
    console.error('✗ Falta variable de entorno SUPABASE_SERVICE_ROLE_KEY')
    console.error('  Correlo así: SUPABASE_SERVICE_ROLE_KEY=sb_secret_... node scripts/scrape-images.cjs')
    process.exit(1)
  }

  console.log('🥔 potato — Image Scraper (name-match mode)')
  console.log('═══════════════════════════════════════════════')

  // 1. Load products from Supabase
  console.log('\n1. Cargando productos de Supabase...')
  const { data: products } = await supabaseRequest(
    'products?select=id,sku,name,image_url&is(deleted_at,null)&limit=10000'
  )
  if (!Array.isArray(products)) {
    console.error('✗ No se pudo conectar a Supabase.')
    process.exit(1)
  }

  const needsImage = products.filter(p => !p.image_url)
  console.log(`  Total productos: ${products.length}`)
  console.log(`  Sin imagen: ${needsImage.length}`)

  if (needsImage.length === 0) {
    console.log('\n✅ Todos los productos ya tienen imagen.')
    return
  }

  // Build name index: normalized 5-word key → [{id, sku, fullNorm}]
  // Multiple products may share a prefix, so we store all candidates
  const nameIndex5 = new Map() // 5-word key → [{id, sku, norm}]
  const nameIndex4 = new Map() // 4-word key
  const nameIndex3 = new Map() // 3-word key (fallback for short names)

  for (const p of needsImage) {
    const norm = normalizeName(p.name)
    const entry = { id: p.id, sku: p.sku, norm }
    for (const [map, words] of [[nameIndex5, 5], [nameIndex4, 4], [nameIndex3, 3]]) {
      const key = nameKey(norm, words)
      if (!key) continue
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(entry)
    }
  }

  console.log(`  Índice de nombres: ${nameIndex5.size} claves (5 palabras)`)

  // 2. Parse sitemap
  console.log('\n2. Leyendo sitemap de mancru.com...')
  let sitemapBody
  try {
    const r = await fetchUrl('https://www.mancru.com/sitemap.xml')
    sitemapBody = r.body
  } catch (e) {
    console.error('✗ No se pudo leer el sitemap:', e.message)
    process.exit(1)
  }

  const masinfoUrls = []
  const masinfoRe = /<loc>(https?:\/\/www\.mancru\.com\/productos\/productos_masinfo\.php\?[^<]+)<\/loc>/g
  let m
  while ((m = masinfoRe.exec(sitemapBody)) !== null) {
    masinfoUrls.push(m[1].replace(/&amp;/g, '&'))
  }
  console.log(`  Páginas en sitemap: ${masinfoUrls.length}`)

  // 3. Scrape
  console.log(`\n3. Scrapeando páginas (${DELAY_MS}ms entre requests)...`)
  console.log(`   Tiempo estimado: ~${Math.round(masinfoUrls.length * DELAY_MS / 60000)} minutos\n`)

  const matched = new Map() // id → imageUrl (deduplication)
  let checked = 0
  let pendingUpdates = []
  let ambiguous = 0
  let noImage = 0

  async function flushUpdates() {
    if (pendingUpdates.length === 0) return
    for (const { id, imageUrl, sku } of pendingUpdates) {
      const { status } = await supabaseRequest(
        `products?id=eq.${id}`, 'PATCH', { image_url: imageUrl }
      )
      if (status < 200 || status >= 300) {
        console.log(`  ✗ Error actualizando ${sku} (status ${status})`)
      }
    }
    pendingUpdates = []
  }

  for (let i = 0; i < masinfoUrls.length; i++) {
    const url = masinfoUrls[i]
    try {
      const { status, body } = await fetchUrl(url)
      checked++

      if (status === 200) {
        const { imageUrl, pageName } = extractFromPage(body)

        if (!imageUrl) { noImage++; }
        else if (pageName) {
          const pageNorm = normalizeName(pageName)

          // Try matching with 5, 4, then 3 words
          let candidates = null
          for (const [map, words] of [[nameIndex5, 5], [nameIndex4, 4], [nameIndex3, 3]]) {
            const key = nameKey(pageNorm, words)
            const c = map.get(key)
            if (c && c.length > 0) { candidates = c; break }
          }

          if (candidates && candidates.length === 1) {
            const { id, sku } = candidates[0]
            if (!matched.has(id)) {
              matched.set(id, imageUrl)
              pendingUpdates.push({ id, imageUrl, sku })
              process.stdout.write(`  ✓ ${sku} — "${pageName.slice(0, 40)}" (${matched.size}/${needsImage.length})\n`)
              if (pendingUpdates.length >= BATCH_UPDATE) await flushUpdates()
            }
          } else if (candidates && candidates.length > 1) {
            // Multiple products with same prefix — try full name match
            const exact = candidates.find(c => c.norm === pageNorm)
            if (exact && !matched.has(exact.id)) {
              matched.set(exact.id, imageUrl)
              pendingUpdates.push({ id: exact.id, imageUrl, sku: exact.sku })
              process.stdout.write(`  ✓ ${exact.sku} (exact) — "${pageName.slice(0, 40)}" (${matched.size}/${needsImage.length})\n`)
              if (pendingUpdates.length >= BATCH_UPDATE) await flushUpdates()
            } else {
              ambiguous++
            }
          }
        }
      }

      if (checked % 100 === 0) {
        console.log(`  [${checked}/${masinfoUrls.length}] ${matched.size} encontradas — faltan ${needsImage.length - matched.size} | ambiguas: ${ambiguous} | sin imagen: ${noImage}`)
      }

      if (matched.size >= needsImage.length) {
        console.log(`\n  ✅ ¡Todas las imágenes encontradas! Parando en página ${checked}.`)
        break
      }

    } catch { /* skip failed pages */ }

    await sleep(DELAY_MS)
  }

  await flushUpdates()

  const stillMissing = needsImage.length - matched.size
  console.log('\n═══════════════════════════════════════════════')
  console.log('✅ Listo!')
  console.log(`   Páginas revisadas:      ${checked} / ${masinfoUrls.length}`)
  console.log(`   Imágenes actualizadas:  ${matched.size}`)
  console.log(`   Matches ambiguos:       ${ambiguous}`)
  console.log(`   Páginas sin imagen:     ${noImage}`)
  console.log(`   Todavía sin imagen:     ${stillMissing}`)

  if (stillMissing > 0 && stillMissing <= 100) {
    console.log('\n   SKUs sin imagen:')
    for (const p of needsImage) {
      if (!matched.has(p.id)) console.log(`     ${p.sku}  ${p.name}`)
    }
  }
}

main().catch(err => {
  console.error('\n✗ Error inesperado:', err.message)
  process.exit(1)
})
