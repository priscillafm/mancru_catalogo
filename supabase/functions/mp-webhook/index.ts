// Recibe las notificaciones de Mercado Pago cuando cambia el estado de un
// pago, y actualiza company_subscriptions + companies.plan en consecuencia.
//
// Deploy: supabase functions deploy mp-webhook --no-verify-jwt
// (--no-verify-jwt porque lo llama Mercado Pago, no un usuario logueado)
// Requiere los secretos: MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_WEBHOOK_SECRET
//
// Configurar esta URL como "notification_url" / webhook en el panel de
// Mercado Pago: https://<project-ref>.supabase.co/functions/v1/mp-webhook

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-signature, x-request-id, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

async function verifySignature(req: Request, dataId: string): Promise<boolean> {
  const secret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET')
  if (!secret) return true // no está configurado todavía — no bloquear en desarrollo

  const signatureHeader = req.headers.get('x-signature') ?? ''
  const requestId = req.headers.get('x-request-id') ?? ''
  const parts = Object.fromEntries(signatureHeader.split(',').map(p => {
    const [k, v] = p.split('=')
    return [k.trim(), v?.trim()]
  }))
  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) return false

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest))
  const computed = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
  return computed === v1
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')!
  const admin = createClient(supabaseUrl, serviceKey)

  try {
    const url = new URL(req.url)
    const body = await req.json().catch(() => ({}))
    const dataId = url.searchParams.get('data.id') ?? body?.data?.id
    const type = url.searchParams.get('type') ?? body?.type

    if (!dataId || type !== 'payment') return json({ ok: true }) // ignorar otros topics

    const validSignature = await verifySignature(req, String(dataId))
    if (!validSignature) return json({ error: 'Firma inválida' }, 401)

    const eventId = `payment:${dataId}`
    const { data: existing } = await admin
      .from('payment_events')
      .select('id')
      .eq('mp_event_id', eventId)
      .maybeSingle()
    if (existing) return json({ ok: true }) // ya procesado, idempotente

    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    })
    const payment = await paymentRes.json()
    if (!paymentRes.ok) {
      console.error('No se pudo leer el pago de MP:', payment)
      return json({ error: 'No se pudo verificar el pago' }, 502)
    }

    const [companyId, planId] = String(payment.external_reference ?? '').split(':')

    await admin.from('payment_events').insert({
      mp_event_id: eventId,
      company_id: companyId || null,
      type: `payment.${payment.status}`,
      raw_payload: payment,
      processed_at: new Date().toISOString(),
    })

    if (companyId && payment.status === 'approved') {
      const periodEnd = new Date()
      periodEnd.setMonth(periodEnd.getMonth() + 1)

      await admin.from('company_subscriptions').update({
        status: 'active',
        plan_id: planId || null,
        external_id: String(payment.id),
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd.toISOString(),
      }).eq('company_id', companyId)

      await admin.from('companies').update({ plan: 'pro' }).eq('id', companyId)
    } else if (companyId && ['rejected', 'cancelled'].includes(payment.status)) {
      await admin.from('company_subscriptions').update({ status: 'past_due' }).eq('company_id', companyId)
    }

    return json({ ok: true })
  } catch (err) {
    console.error(err)
    return json({ error: 'Error inesperado' }, 500)
  }
})
