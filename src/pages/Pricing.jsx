import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { usePlans } from '@/hooks/usePlans'
import PricingCards from '@/components/PricingCards'
import { PotatoMark } from '@/components/PotatoLogo'

export default function PricingPage() {
  const navigate = useNavigate()
  const { session, membership } = useAuthStore()
  const { data: plans = [], isLoading } = usePlans()
  const [loadingPlan, setLoadingPlan] = useState(null)
  const [error, setError] = useState('')

  const currentPlan = membership?.companies?.plan ?? 'free'

  async function subscribe(plan) {
    if (!membership?.company_id || !session?.access_token) {
      setError('Todavía estamos cargando tu cuenta — esperá un segundo y probá de nuevo.')
      return
    }
    setError('')
    setLoadingPlan(plan.name)
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mp-create-preference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ company_id: membership.company_id, plan_id: plan.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo iniciar el pago')
      window.location.href = data.init_point
    } catch (err) {
      setError(err.message ?? 'No se pudo iniciar el pago')
      setLoadingPlan(null)
    }
  }

  function ctaStyle(accent) {
    return {
      display: 'block', width: '100%', padding: '10px', borderRadius: 9,
      background: accent ? 'rgba(0,0,0,0.2)' : 'var(--accent)',
      color: 'var(--accent-text)', textDecoration: 'none', fontWeight: 700,
      fontSize: 13, border: accent ? '1px solid rgba(255,255,255,0.2)' : 'none',
      cursor: 'pointer',
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '16px 32px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 14 }}>
          ← Volver
        </button>
      </nav>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '48px 24px 80px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><PotatoMark size={40} /></div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.5px' }}>Elegí tu plan</h1>
        <p style={{ fontSize: 15, color: 'var(--text2)', marginBottom: 32 }}>
          Podés cambiar o cancelar cuando quieras.
        </p>

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 20 }}>{error}</p>
        )}

        {!isLoading && (
          <PricingCards
            plans={plans}
            renderCta={(p, accent) => {
              const isCurrent = p.name === currentPlan
              if (p.name === 'enterprise') {
                return (
                  <Link to="/contacto?plan=enterprise" style={ctaStyle(accent)}>
                    Contactar
                  </Link>
                )
              }
              if (isCurrent) {
                return (
                  <button disabled style={{ ...ctaStyle(accent), opacity: 0.6, cursor: 'default' }}>
                    Plan actual
                  </button>
                )
              }
              if (p.name === 'free') {
                return (
                  <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>
                    Cancelá tu suscripción en Mercado Pago para volver a Free
                  </p>
                )
              }
              return (
                <button onClick={() => subscribe(p)} disabled={loadingPlan === p.name} style={ctaStyle(accent)}>
                  {loadingPlan === p.name ? 'Redirigiendo...' : 'Suscribirme'}
                </button>
              )
            }}
          />
        )}
      </div>
    </div>
  )
}
