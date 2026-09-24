// Crea una preferencia de pago de Mercado Pago para que una empresa se
// suscriba (o renueve) el plan Pro. Devuelve la URL de checkout hospedado
// (init_point) para que el frontend redirija.
//
// Deploy: supabase functions deploy mp-create-preference
// Requiere el secreto: supabase secrets set MERCADOPAGO_ACCESS_TOKEN=...

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '')
    if (!jwt) return json({ error: 'No autenticado' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')

    if (!mpToken) return json({ error: 'Mercado Pago no está configurado todavía' }, 500)

    // Cliente con el JWT del usuario: respeta RLS, sirve para confirmar
    // que quien llama es realmente admin de esa empresa.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'No autenticado' }, 401)

    const { company_id, plan_id } = await req.json()
    if (!company_id || !plan_id) return json({ error: 'Falta company_id o plan_id' }, 400)

    const { data: membership } = await userClient
      .from('user_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('company_id', company_id)
      .eq('active', true)
      .single()
    if (!membership || !['company_admin', 'super_admin'].includes(membership.role)) {
      return json({ error: 'No tenés permiso para modificar el plan de esta empresa' }, 403)
    }

    const { data: plan } = await userClient
      .from('plans')
      .select('id, name, price_monthly_uyu, promo_price_monthly_uyu')
      .eq('id', plan_id)
      .single()
    if (!plan) return json({ error: 'Plan no encontrado' }, 404)

    const amount = plan.promo_price_monthly_uyu ?? plan.price_monthly_uyu
    if (!amount) return json({ error: 'Este plan no tiene un precio configurado' }, 400)

    // Mercado Pago exige que back_urls sean https públicas para poder usar
    // auto_return — un origin de localhost (probando en dev) las rompe con
    // un error de PolicyAgent poco claro, así que en ese caso usamos
    // siempre la URL real de producción.
    const requestOrigin = req.headers.get('origin')
    const origin = requestOrigin && /^https:\/\//.test(requestOrigin)
      ? requestOrigin
      : 'https://potatoui.com'
    const externalReference = `${company_id}:${plan_id}`

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mpToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{
          title: `Potato — Plan ${plan.name}`,
          quantity: 1,
          currency_id: 'UYU',
          unit_price: amount,
        }],
        external_reference: externalReference,
        back_urls: {
          success: `${origin}/checkout/retorno`,
          pending: `${origin}/checkout/retorno`,
          failure: `${origin}/checkout/retorno`,
        },
        auto_return: 'approved',
        notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
      }),
    })

    const mpData = await mpRes.json()
    if (!mpRes.ok) {
      console.error('Mercado Pago error:', mpData)
      return json({ error: 'No se pudo crear la preferencia de pago' }, 502)
    }

    // Registrar de una la referencia en company_subscriptions (estado pending)
    // usando la service-role key, para que el webhook tenga algo a lo que
    // hacer match incluso si llega antes de que el usuario vuelva a la app.
    const adminClient = createClient(supabaseUrl, serviceKey)
    await adminClient.from('company_subscriptions').upsert({
      company_id,
      plan_id,
      status: 'trialing',
      metadata: { last_preference_id: mpData.id, external_reference: externalReference },
    }, { onConflict: 'company_id' })

    return json({ init_point: mpData.init_point })
  } catch (err) {
    console.error(err)
    return json({ error: 'Error inesperado' }, 500)
  }
})
