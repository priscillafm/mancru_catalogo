#!/usr/bin/env node
/**
 * scrape-images.js
 * Scrapes mancru.com and updates image_url in Supabase for all products.
 *
 * HOW TO RUN:
 *   1. Get your Service Role Key from Supabase → Settings → API → service_role
 *   2. Paste it below where it says PASTE_YOUR_SERVICE_ROLE_KEY
 *   3. Open terminal in this folder and run: node scripts/scrape-images.js
 *   4. Dejalo correr solo — puede tardar 30-60 minutos
 */

const https = require('https')

// ── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL     = 'https://wmzqpblqorfuawubryvt.supabase.co'
const SERVICE_ROLE_KEY = 'PASTE_YOUR_SERVICE_ROLE_KEY'   // ← cambiá esto
const MANCRU_BASE      = 'https://www.mancru.com'
const DELAY_MS         = 700   // ms entre requests (no sobrecargar el servidor)
// ────────────────────────────────────────────────────────────────────────────

// Páginas de categoría a scrapear
const CATEGORY_PATHS = [
  '/catalogo/accesorios/',
  '/catalogo/accesorios/audio/',
  '/catalogo/accesorios/cargadores/',
  '/catalogo/accesorios/cables-y-adaptadores/',
  '/catalogo/accesorios/power-bank-y-power-cases/',
  '/catalogo/accesorios/soportes/',
  '/catalogo/accesorios/tarjetas-de-memoria/',
  '/catalogo/accesorios/otros-accesorios/',
  '/catalogo/accesorios/smartwatch/',
  '/catalogo/informatica/',
  '/catalogo/informatica/computacion/',
  '/catalogo/informatica/monitores/',
  '/catalogo/informatica/perifericos/',
  '/catalogo/informatica/redes/',
  '/catalogo/informatica/impresoras-y-consumibles/',
  '/catalogo/informatica/almacenamiento/',
  '/catalogo/informatica/gaming/',
]

// ── HELPERS ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : require('http')
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-UY,es;q=0.9',
      },
      timeout: 15000,
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : MANCRU_BASE + res.headers.location
        return fetchUrl(redirectUrl).then(resolve).catch(reject)
      }
      let data = ''
      res.setEncoding('utf8')
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
  })
}

async function supabaseRequest(path, method = 'GET', body = null) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`
  const options = {
    method,
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
  }
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null }) }
        catch { resolve({ status: res.statusCode, data }) }
      })
    })
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

// ── SCRAPER ─────────────────────────────────────────────────────────────────

function extractProducts(html) {
  const results = []
  // Match pairs of image URL + SKU code within proximity
  // Pattern: img src near Cod.SKU
  const blocks = html.split(/(?=Cod\.[A-Z]{2,5}\d{5,7})/g)

  for (const block of blocks) {
    const skuMatch = block.match(/Cod\.((?:ACC|INF)[0-9]{5,7})/)
    if (!skuMatch) continue
    const sku = skuMatch[1]

    // Look for image in nearby context (search backwards in original HTML)
    const skuPos = html.indexOf('Cod.' + sku)
    const searchBack = html.substring(Math.max(0, skuPos - 800), skuPos + 200)
    const imgMatch = searchBack.match(/src="([^"]*\/imgs\/productos\/productos31_\d+\.(jpg|png))"/)
    if (!imgMatch) continue

    const imageUrl = imgMatch[1].startsWith('http')
      ? imgMatch[1]
      : MANCRU_BASE + imgMatch[1]

    results.push({ sku, imageUrl })
  }
  return results
}

async function scrapeCategory(path) {
  const url = MANCRU_BASE + path
  try {
    const html = await fetchUrl(url)
    const products = extractProducts(html)
    return products
  } catch (err) {
    console.log(`  ✗ Error fetching ${path}: ${err.message}`)
    return []
  }
}

// ── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🥔 potato — Image Scraper')
  console.log('══════════════════════════════════════')

  if (SERVICE_ROLE_KEY === 'PASTE_YOUR_SERVICE_ROLE_KEY') {
    console.error('\n✗ ERROR: Tenés que pegar tu Service Role Key en el script.')
    console.error('  Supabase → Settings → API → service_role\n')
    process.exit(1)
  }

  // 1. Load all products from Supabase that need images
  console.log('\n1. Cargando productos de Supabase...')
  const { data: products } = await supabaseRequest(
    'products?select=id,sku,image_url&is(deleted_at,null)&limit=10000'
  )
  if (!Array.isArray(products)) {
    console.error('✗ No se pudo conectar a Supabase. Verificá el Service Role Key.')
    process.exit(1)
  }

  const needsImage = products.filter(p => !p.image_url)
  const skuToId = {}
  for (const p of needsImage) skuToId[p.sku.toUpperCase()] = p.id

  console.log(`  Total productos: ${products.length}`)
  console.log(`  Sin imagen: ${needsImage.length}`)

  // 2. Scrape mancru.com categories
  console.log('\n2. Scrapeando mancru.com...')
  const skuImageMap = {}  // sku → imageUrl
  let totalFound = 0

  for (const path of CATEGORY_PATHS) {
    process.stdout.write(`  ${path} ... `)
    const found = await scrapeCategory(path)
    let matched = 0
    for (const { sku, imageUrl } of found) {
      if (!skuImageMap[sku]) {
        skuImageMap[sku] = imageUrl
        if (skuToId[sku.toUpperCase()]) matched++
      }
    }
    console.log(`${found.length} productos encontrados (${matched} matchean con Supabase)`)
    totalFound += found.length
    await sleep(DELAY_MS)
  }

  console.log(`\n  Total en mancru.com: ${totalFound}`)
  console.log(`  Con match en Supabase: ${Object.keys(skuImageMap).filter(s => skuToId[s.toUpperCase()]).length}`)

  // 3. Update Supabase
  console.log('\n3. Actualizando imágenes en Supabase...')
  let updated = 0
  let notFound = 0

  for (const [sku, imageUrl] of Object.entries(skuImageMap)) {
    const id = skuToId[sku.toUpperCase()]
    if (!id) { notFound++; continue }

    const { status } = await supabaseRequest(
      `products?id=eq.${id}`,
      'PATCH',
      { image_url: imageUrl }
    )
    if (status >= 200 && status < 300) {
      updated++
      if (updated % 50 === 0) console.log(`  Actualizados: ${updated}`)
    } else {
      console.log(`  ✗ Error actualizando ${sku} (status ${status})`)
    }
    await sleep(100)
  }

  console.log('\n══════════════════════════════════════')
  console.log(`✅ Listo!`)
  console.log(`   Imágenes actualizadas: ${updated}`)
  console.log(`   SKUs no encontrados en Supabase: ${notFound}`)
  console.log(`   Productos que todavía no tienen imagen: ${needsImage.length - updated}`)
}

main().catch(err => {
  console.error('\n✗ Error inesperado:', err.message)
  process.exit(1)
})
