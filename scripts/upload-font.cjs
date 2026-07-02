// Downloads Sora TTF from Google Fonts and uploads to Supabase Storage
const https = require('https')
const http  = require('http')

const SUPABASE_URL     = 'https://wmzqpblqorfuawubryvt.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET           = 'product-images'

function fetchBinary(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const req = mod.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return fetchBinary(res.headers.location).then(resolve).catch(reject)
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, buffer: Buffer.concat(chunks), type: res.headers['content-type'] }))
    })
    req.on('error', reject)
  })
}

async function uploadToSupabase(key, buffer, contentType) {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${key}`
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
        'Content-Type': contentType,
        'Content-Length': buffer.length,
        'x-upsert': 'true',
      },
    }, res => {
      let body = ''
      res.on('data', c => body += c)
      res.on('end', () => resolve({ status: res.statusCode, body }))
    })
    req.on('error', reject)
    req.write(buffer)
    req.end()
  })
}

async function main() {
  // Get font CSS with old UA → Google returns TTF URLs
  console.log('Fetching Sora font CSS...')
  const cssUrl = 'https://fonts.googleapis.com/css?family=Sora:400,600,700'
  const css = await fetchBinary(cssUrl)
  const cssText = css.buffer.toString('utf8')

  // Extract TTF URLs
  const ttfUrls = [...cssText.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/g)].map(m => m[1])
  // Also try woff/woff2 as fallback label
  const allUrls = [...cssText.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1])

  if (ttfUrls.length === 0) {
    // Try requesting with Android 4 UA to force TTF
    console.log('No TTF found, trying Android UA...')
    const css2 = await fetchBinary(cssUrl + '&subset=latin')
    const cssText2 = css2.buffer.toString('utf8')
    const urls2 = [...cssText2.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1])
    console.log('All font URLs found:', urls2.slice(0, 3))
  }

  console.log('All font URLs found:', allUrls.slice(0, 6))

  const variants = [
    { weight: 400, label: 'regular' },
    { weight: 600, label: 'semibold' },
    { weight: 700, label: 'bold' },
  ]

  for (const { weight, label } of variants) {
    // Fetch with weight-specific request
    const weightCss = await fetchBinary(`https://fonts.googleapis.com/css?family=Sora:${weight}`)
    const weightText = weightCss.buffer.toString('utf8')
    const fontUrls = [...weightText.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1])

    if (fontUrls.length === 0) {
      console.log(`  ✗ No URL found for weight ${weight}`)
      continue
    }

    const fontUrl = fontUrls[0]
    const ext = fontUrl.split('.').pop().split('?')[0]
    console.log(`  Downloading Sora ${label} (${weight}) from ${fontUrl.slice(0,60)}...`)

    const font = await fetchBinary(fontUrl)
    const key  = `fonts/sora-${label}.${ext}`
    const ct   = ext === 'ttf' ? 'font/ttf' : ext === 'woff2' ? 'font/woff2' : 'font/woff'

    const up = await uploadToSupabase(key, font.buffer, ct)
    if (up.status >= 200 && up.status < 300) {
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`
      console.log(`  ✅ ${label}: ${publicUrl}`)
    } else {
      console.log(`  ✗ Upload failed (${up.status}): ${up.body}`)
    }
  }
}

main().catch(console.error)
