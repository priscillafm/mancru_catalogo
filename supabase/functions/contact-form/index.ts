// Recibe las consultas del formulario público /contacto, las guarda en
// contact_messages y (si está configurado) las reenvía por email vía Resend.
//
// Deploy: supabase functions deploy contact-form --no-verify-jwt
// (--no-verify-jwt porque lo llama un visitante sin sesión)
// Secretos opcionales para el email:
//   supabase secrets set RESEND_API_KEY=... CONTACT_TO_EMAIL=tu@email.com
// Sin esos secretos la consulta igual se guarda en la tabla.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const body = await req.json().catch(() => ({}))

    // Campo trampa: un humano no lo ve ni lo completa.
    if (clean(body.website, 200)) return json({ ok: true })

    const name    = clean(body.name, 100)
    const email   = clean(body.email, 200)
    const company = clean(body.company, 150)
    const plan    = clean(body.plan, 40)
    const message = clean(body.message, 3000)

    if (!name) return json({ error: 'Ingresá tu nombre.' }, 400)
    if (!EMAIL_RE.test(email)) return json({ error: 'Ingresá un email válido.' }, 400)
    if (message.length < 10) return json({ error: 'El mensaje es muy corto.' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await admin.from('contact_messages')
      .select('id', { count: 'exact', head: true })
      .eq('email', email).gte('created_at', since)
    if ((count ?? 0) >= 3) return json({ error: 'Ya recibimos varias consultas tuyas. Te respondemos a la brevedad.' }, 429)

    const { data: row, error: insertErr } = await admin.from('contact_messages')
      .insert({ name, email, company: company || null, plan: plan || null, message })
      .select('id').single()
    if (insertErr) {
      console.error(insertErr)
      return json({ error: 'No pudimos enviar tu consulta. Probá de nuevo en unos minutos.' }, 500)
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    const to = Deno.env.get('CONTACT_TO_EMAIL')
    if (resendKey && to) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: Deno.env.get('CONTACT_FROM_EMAIL') ?? 'Potato <onboarding@resend.dev>',
          to: [to],
          reply_to: email,
          subject: `Consulta en Potato — ${name}${plan ? ` (${plan})` : ''}`,
          text: `Nombre: ${name}\nEmail: ${email}\nEmpresa: ${company || '-'}\nPlan de interés: ${plan || '-'}\n\n${message}`,
        }),
      })
      if (res.ok) await admin.from('contact_messages').update({ emailed: true }).eq('id', row.id)
      else console.error('Resend error:', res.status, await res.text())
    }

    return json({ ok: true })
  } catch (err) {
    console.error(err)
    return json({ error: 'Error inesperado' }, 500)
  }
})
