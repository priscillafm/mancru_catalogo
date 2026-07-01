#!/usr/bin/env node
/**
 * assign-categories.cjs
 * Crea categorías faltantes y asigna category_id a todos los productos
 * que no tienen categoría, usando keywords en el nombre del producto.
 *
 * HOW TO RUN:
 *   node scripts/assign-categories.cjs
 */

const https = require('https')

const SUPABASE_URL     = process.env.SUPABASE_URL     || 'https://wmzqpblqorfuawubryvt.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// ── CATEGORY RULES (order matters — first match wins) ───────────────────────
// Each rule: { name, slug, keywords[] }
// Keywords are checked against lowercase product name
const CATEGORY_RULES = [
  {
    name: 'Auriculares',
    slug: 'auriculares',
    keywords: ['auricular', 'manos libres', 'earphone', 'headphone', 'tws', 'audífono'],
  },
  {
    name: 'Parlantes',
    slug: 'parlantes',
    keywords: ['parlante', 'barra de sonido', 'soundbar', 'altavoz'],
  },
  {
    name: 'Cargadores',
    slug: 'cargadores',
    keywords: ['cargador', 'cargadora', 'carga inalámbrica', 'cargador inalámbrico', 'cargador inalambrico', 'qi '],
  },
  {
    name: 'Cables de datos',
    slug: 'cables-de-datos',
    keywords: ['cable de datos', 'cable auxiliar', 'cable hdmi', 'cable usb', 'cable tipo c', 'cable lightning', 'cable micro'],
  },
  {
    name: 'Power Banks',
    slug: 'power-banks',
    keywords: ['power bank', 'powerbank', 'batería portatil', 'bateria portatil', 'batería portátil'],
  },
  {
    name: 'Baterías',
    slug: 'baterias',
    keywords: ['batería roca', 'bateria roca', 'batería para ', 'bateria para '],
  },
  {
    name: 'Smartwatch',
    slug: 'smartwatch',
    keywords: ['smartwatch', 'smart watch', 'reloj inteligente', 'correa smartwatch', 'correa para smartwatch', 'mibro watch', 'mibro lite', 'mibro air', 'exhibidor mibro'],
  },
  {
    name: 'Vidrio Templado',
    slug: 'vidrio-templado',
    keywords: ['vidrio templado', '9d vidrio', 'protector de pantalla', 'screen protector', 'glass '],
  },
  {
    name: 'Acc. Auto',
    slug: 'acc-auto',
    keywords: ['soporte vehicular', 'soporte auto', 'cargador auto', 'cargador para auto', 'soporte para auto'],
  },
  {
    name: 'Adaptadores',
    slug: 'adaptadores',
    keywords: ['adaptador', '2in1 nsc', 'hub usb', 'lector de tarjeta', 'otg'],
  },
  {
    name: 'Box',
    slug: 'box',
    keywords: ['caja bloox', 'box bloox', 'case 2in1', 'tpu solid', 'funda ', 'cover ', 'case para'],
  },
  {
    name: 'Iluminación',
    slug: 'iluminacion',
    keywords: ['aro de luz', 'ring light', 'luz led', 'tira led', 'lampara', 'lámpara'],
  },
  {
    name: 'Impresión 3D',
    slug: 'impresion-3d',
    keywords: ['filamento', 'impresora 3d', 'bambu lab', 'bambu'],
  },
  {
    name: 'Filamentos',
    slug: 'filamentos',
    keywords: ['filamento'],
  },
  {
    name: 'Mouse',
    slug: 'mouse',
    keywords: ['mouse '],
  },
  {
    name: 'Teclados',
    slug: 'teclados',
    keywords: ['teclado'],
  },
  {
    name: 'Periféricos',
    slug: 'perifericos',
    keywords: ['mousepad', 'webcam', 'micrófono', 'microfono', 'auricular gamer', 'headset gamer', 'gamepad', 'joystick'],
  },
  {
    name: 'Informática',
    slug: 'informatica',
    keywords: ['monitor ', 'notebook', 'laptop', 'disco duro', 'ssd ', 'memoria ram', 'pendrive', 'switch de red', 'router', 'access point', 'ups '],
  },
]
// ─────────────────────────────────────────────────────────────────────────────

function supabaseRequest(path, method = 'GET', body = null) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null
    const opts = {
      method,
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
      },
    }
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

function detectCategory(name) {
  const lower = name.toLowerCase()
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some(k => lower.includes(k))) return rule
  }
  return null
}

async function main() {
  console.log('🥔 potato — Asignar Categorías')
  console.log('══════════════════════════════════════')

  // 1. Load existing categories
  console.log('\n1. Cargando categorías existentes...')
  const { data: existingCats } = await supabaseRequest(
    'categories?select=id,name,slug&is(deleted_at,null)'
  )
  const catMap = {} // slug → id
  for (const c of existingCats ?? []) catMap[c.slug] = c.id
  console.log(`   Categorías existentes: ${Object.keys(catMap).length}`)

  // 2. Create missing categories
  const needed = CATEGORY_RULES.filter(r => !catMap[r.slug])
  if (needed.length > 0) {
    console.log(`\n2. Creando ${needed.length} categorías nuevas...`)
    for (const rule of needed) {
      const { status, data } = await supabaseRequest('categories', 'POST', {
        name: rule.name,
        slug: rule.slug,
        active: true,
        company_id: '00000000-0000-0000-0000-000000000001',
      })
      if (status >= 200 && status < 300) {
        const id = Array.isArray(data) ? data[0]?.id : data?.id
        if (id) {
          catMap[rule.slug] = id
          console.log(`   ✓ Creada: ${rule.name}`)
        }
      } else {
        console.log(`   ✗ Error creando "${rule.name}": status ${status}`)
      }
    }
  } else {
    console.log('\n2. Todas las categorías ya existen.')
  }

  // 3. Load products without category
  console.log('\n3. Cargando productos sin categoría...')
  const { data: products } = await supabaseRequest(
    'products?select=id,name&is(deleted_at,null)&is(category_id,null)&limit=5000'
  )
  if (!Array.isArray(products)) {
    console.error('   ✗ Error conectando a Supabase')
    process.exit(1)
  }
  console.log(`   Productos sin categoría: ${products.length}`)

  // 4. Assign categories
  console.log('\n4. Asignando categorías...')
  const stats = {}   // slug → count
  let assigned = 0
  let skipped = 0
  const updates = []

  for (const p of products) {
    const rule = detectCategory(p.name)
    if (!rule) { skipped++; continue }
    const catId = catMap[rule.slug]
    if (!catId) { skipped++; continue }
    updates.push({ id: p.id, category_id: catId, slug: rule.slug })
    stats[rule.name] = (stats[rule.name] || 0) + 1
  }

  // Update in batches of 50 (individual updates, Supabase doesn't support bulk update with different values)
  const BATCH = 50
  for (let i = 0; i < updates.length; i++) {
    const { id, category_id } = updates[i]
    const { status } = await supabaseRequest(
      `products?id=eq.${id}`,
      'PATCH',
      { category_id }
    )
    if (status >= 200 && status < 300) {
      assigned++
    } else {
      console.log(`   ✗ Error actualizando producto ${id}`)
    }
    if ((i + 1) % BATCH === 0) {
      console.log(`   Actualizados ${i + 1} / ${updates.length}...`)
    }
  }

  // 5. Summary
  console.log('\n══════════════════════════════════════')
  console.log('✅ Listo!')
  console.log(`   Productos asignados: ${assigned}`)
  console.log(`   Sin categoría detectada: ${skipped}`)
  console.log('\n   Por categoría:')
  for (const [name, count] of Object.entries(stats).sort((a,b) => b[1]-a[1])) {
    console.log(`     ${count.toString().padStart(4)}  ${name}`)
  }

  if (skipped > 0) {
    console.log(`\n   Muestra de productos sin categoría detectada:`)
    let shown = 0
    for (const p of products) {
      if (!detectCategory(p.name)) {
        console.log(`     ${p.name.substring(0, 80)}`)
        if (++shown >= 20) break
      }
    }
  }
}

main().catch(err => {
  console.error('\n✗ Error inesperado:', err.message)
  process.exit(1)
})
