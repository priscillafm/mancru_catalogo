#!/usr/bin/env node
/**
 * Fetches a few mancru product pages and prints what the HTML contains,
 * so we can fix the regex patterns in scrape-images.cjs
 *
 * Usage: node scripts/debug-page.cjs
 */
const https = require('https')
const http  = require('http')

const MANCRU_BASE = 'https://www.mancru.com'

function fetchUrl(url, retries = 2) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'es-UY,es;q=0.9',
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
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
  })
}

async function debugPage(url) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`URL: ${url}`)
  try {
    const { status, body } = await fetchUrl(url)
    console.log(`Status: ${status}  |  Length: ${body.length} chars`)

    // Show first 200 chars to check if it's HTML or redirect
    if (body.length < 500) {
      console.log('BODY (short):\n', body)
      return
    }

    // Try current SKU regex
    const skuMatch1 = body.match(/\b((?:ACC|INF)\d{5,7})\b/i)
    console.log('SKU regex (ACC|INF + 5-7 digits):', skuMatch1?.[1] ?? 'NO MATCH')

    // Try broader SKU regex
    const skuMatch2 = body.match(/\b((?:ACC|INF)\d{4,10})\b/i)
    console.log('SKU regex (ACC|INF + 4-10 digits):', skuMatch2?.[1] ?? 'NO MATCH')

    // Try any ACC/INF occurrence
    const allSkus = [...body.matchAll(/\b((?:ACC|INF)\d+)\b/gi)].map(m => m[1])
    console.log('All ACC/INF matches:', allSkus.length > 0 ? [...new Set(allSkus)].slice(0, 5).join(', ') : 'NONE')

    // Try current image regex
    const imgMatch1 = body.match(/src=["']([^"']*\/imgs\/productos\/productos31_\d+\.(?:jpg|png))["']/i)
    console.log('Image regex (productos31_):', imgMatch1?.[1] ?? 'NO MATCH')

    // Try broader image regex - any imgs/productos path
    const imgMatch2 = body.match(/src=["']([^"']*\/imgs\/productos\/[^"']+\.(?:jpg|png|webp))["']/i)
    console.log('Image regex (any imgs/productos):', imgMatch2?.[1] ?? 'NO MATCH')

    // Find all image src values
    const allImgs = [...body.matchAll(/src=["']([^"']*\.(?:jpg|png|webp|gif))["']/gi)]
      .map(m => m[1])
      .filter(s => s.includes('product') || s.includes('imagen') || s.includes('foto') || s.includes('img'))
    if (allImgs.length > 0) {
      console.log('Product-looking images:', allImgs.slice(0, 5))
    }

    // Show a snippet around "ACC" or "INF" if found
    const idx = body.search(/ACC|INF/i)
    if (idx >= 0) {
      console.log(`\nContext around first ACC/INF (chars ${idx-50} to ${idx+100}):`)
      console.log(body.slice(Math.max(0, idx-50), idx+100).replace(/\s+/g, ' '))
    }

    // Show a snippet around img src
    const imgIdx = body.search(/imgs\/productos/i)
    if (imgIdx >= 0) {
      console.log(`\nContext around imgs/productos:`)
      console.log(body.slice(Math.max(0, imgIdx-30), imgIdx+120).replace(/\s+/g, ' '))
    } else {
      // Show all img src patterns
      const imgSrcs = [...body.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]).slice(0, 8)
      console.log('All img src values:', imgSrcs)
    }

  } catch (e) {
    console.log('ERROR:', e.message)
  }
}

async function main() {
  // Grab a few pages from different parts of the sitemap
  // First get the sitemap to pick a sample
  console.log('Fetching sitemap to get sample URLs...')
  const r = await fetchUrl('https://www.mancru.com/sitemap.xml')

  const urls = []
  const re = /<loc>(https?:\/\/www\.mancru\.com\/productos\/productos_masinfo\.php\?[^<]+)<\/loc>/g
  let m
  while ((m = re.exec(r.body)) !== null) {
    urls.push(m[1].replace(/&amp;/g, '&'))
    if (urls.length >= 200) break
  }

  // Sample: first, middle, last of our batch
  const samples = [
    urls[0],
    urls[50],
    urls[100],
    urls[150],
    urls[199],
  ].filter(Boolean)

  console.log(`Testing ${samples.length} sample pages from ${urls.length} found in sitemap...\n`)
  for (const url of samples) {
    await debugPage(url)
    await new Promise(r => setTimeout(r, 400))
  }
}

main().catch(e => console.error(e))
