const https = require('https')
const fs    = require('fs')
const path  = require('path')

const SUPABASE_URL     = 'https://wmzqpblqorfuawubryvt.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET           = 'product-images'
const COMPANY_ID       = '00000000-0000-0000-0000-000000000001'

const FILE_PATH  = 'C:\\Users\\Priscilla\\Desktop\\logos png\\mancru-white.svg'
const OBJECT_KEY = `${COMPANY_ID}/logos/mancru-white.svg`

async function upload() {
  const fileData = fs.readFileSync(FILE_PATH)
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${OBJECT_KEY}`

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
        'Content-Type': 'image/svg+xml',
        'Content-Length': fileData.length,
        'x-upsert': 'true',
      },
    }, (res) => {
      let body = ''
      res.on('data', c => body += c)
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${OBJECT_KEY}`
          console.log('\n✅ Logo subido!')
          console.log('   URL:', publicUrl)
        } else {
          console.error('✗ Error:', res.statusCode, body)
        }
        resolve()
      })
    })
    req.on('error', reject)
    req.write(fileData)
    req.end()
  })
}

upload().catch(console.error)
