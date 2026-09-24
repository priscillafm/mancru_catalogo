import Icon from '@/components/Icon'

const DISPLAY = {
  free:       { desc: 'Para empezar', features: ['75 productos', '1 catálogo activo', '1 usuario', 'Link público'] },
  pro:        { desc: 'Para crecer', features: ['5.000 productos', 'Catálogos ilimitados', 'Usuarios ilimitados', 'Soporte prioritario'] },
  enterprise: { desc: 'Sin límites', features: ['Todo ilimitado', 'Integraciones', 'Onboarding dedicado', 'SLA garantizado'] },
}

function priceInfo(plan) {
  if (plan.name === 'free') return { main: '$0', sub: null, strike: null }
  if (plan.name === 'enterprise') return { main: 'A consultar', sub: null, strike: null }
  const promo = plan.promo_price_monthly_uyu
  const base  = plan.price_monthly_uyu
  if (promo != null) return { main: `$${promo} UYU/mes`, sub: plan.promo_label ?? 'Precio de lanzamiento', strike: base }
  return { main: base != null ? `$${base} UYU/mes` : 'Consultar', sub: null, strike: null }
}

/**
 * Renders the pricing cards grid.
 * `renderCta(plan)` returns the JSX for that card's call-to-action button/link —
 * left to the caller because it differs between the anonymous landing page
 * (always → /register) and the logged-in /pricing page (real checkout).
 */
export default function PricingCards({ plans, renderCta }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
      {plans.map(p => {
        const info = DISPLAY[p.name] ?? { desc: '', features: [] }
        const price = priceInfo(p)
        const accent = p.name === 'pro'
        return (
          <div key={p.name} style={{
            background: accent ? 'var(--accent)' : 'var(--surface)',
            border: `1px solid ${accent ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 16, padding: '24px 20px',
            color: accent ? 'var(--accent-text)' : 'var(--text)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {p.display_name ?? p.name}
            </div>
            {price.strike != null && (
              <div style={{ fontSize: 13, opacity: 0.6, textDecoration: 'line-through' }}>${price.strike} UYU/mes</div>
            )}
            <div style={{ fontSize: 26, fontWeight: 700, marginBottom: price.sub ? 2 : 4 }}>{price.main}</div>
            {price.sub && (
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 16, color: accent ? 'var(--accent-text)' : 'var(--accent)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="rocket" size={12} /> {price.sub}</span>
              </div>
            )}
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 20 }}>{info.desc}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', textAlign: 'left' }}>
              {info.features.map(f => (
                <li key={f} style={{ fontSize: 13, padding: '4px 0', opacity: 0.85 }}>✓ {f}</li>
              ))}
            </ul>
            {renderCta(p, accent)}
          </div>
        )
      })}
    </div>
  )
}
