// Copia de seguridad de las tablas de Potato a archivos JSON en ./backups/<fecha>/
//
// Uso:   npm run backup
// Lee SUPABASE_SERVICE_ROLE_KEY y VITE_SUPABASE_URL del archivo .env local (o del entorno).
// La carpeta backups/ está en .gitignore: contiene datos de clientes y NO debe subirse a GitHub.
// Guardá una copia en un lugar privado (disco externo o nube personal).

import fs from 'node:fs'
import path from 'node:path'

function loadEnv() {
  const env = { ...process.env }
  try {
    for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* sin .env: se usa solo el entorno */ }
  return env
}

const env = loadEnv()
const URL_BASE = env.VITE_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_BASE || !KEY) {
  console.error('Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el archivo .env')
  process.exit(1)
}

const TABLES = [
  'companies', 'users', 'user_memberships', 'plans', 'company_subscriptions', 'payment_events',
  'brands', 'categories', 'products', 'catalogs', 'catalog_products', 'catalog_views',
  'orders', 'notifications', 'contact_messages', 'sync_executions', 'sync_diff_rows',
]
const PAGE = 1000
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
const dir = path.join('backups', stamp)
fs.mkdirSync(dir, { recursive: true })

const headers = { apikey: KEY, Authorization: 'Bearer ' + KEY }
let failed = 0

for (const table of TABLES) {
  const rows = []
  try {
    for (let offset = 0; ; offset += PAGE) {
      const res = await fetch(`${URL_BASE}/rest/v1/${table}?select=*&order=created_at.asc.nullsfirst&limit=${PAGE}&offset=${offset}`, { headers })
      if (!res.ok) {
        // algunas tablas no tienen created_at: reintentar sin orden
        const retry = await fetch(`${URL_BASE}/rest/v1/${table}?select=*&limit=${PAGE}&offset=${offset}`, { headers })
        if (!retry.ok) throw new Error(`HTTP ${retry.status}`)
        const data = await retry.json()
        rows.push(...data)
        if (data.length < PAGE) break
        continue
      }
      const data = await res.json()
      rows.push(...data)
      if (data.length < PAGE) break
    }
    fs.writeFileSync(path.join(dir, table + '.json'), JSON.stringify(rows, null, 2))
    console.log(`  ${table.padEnd(24)} ${String(rows.length).padStart(6)} filas`)
  } catch (err) {
    failed++
    console.error(`  ${table.padEnd(24)} ERROR: ${err.message}`)
  }
}

console.log(failed ? `\nTerminó con ${failed} tabla(s) con error.` : `\nListo. Copia guardada en ${dir}`)
process.exit(failed ? 1 : 0)
