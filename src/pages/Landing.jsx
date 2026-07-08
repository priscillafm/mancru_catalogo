import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { PotatoMark } from '@/components/PotatoLogo'

export default function LandingPage() {
  const { session, loading } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && session) navigate('/app', { replace: true })
  }, [session, loading, navigate])

  if (loading) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>

      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 32px', borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, background: 'var(--bg)',
        backdropFilter: 'blur(20px)', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <PotatoMark size={26} />
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px' }}>Potato</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link to="/login" style={navLink}>Ingresar</Link>
          <Link to="/register" style={ctaBtn}>Empezar gratis →</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '80px 24px 60px', maxWidth: 700, margin: '0 auto' }}>
        <div style={{
          display: 'inline-block', padding: '5px 14px', borderRadius: 999,
          background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
          color: 'var(--accent)', fontSize: 12, fontWeight: 700,
          letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 24,
        }}>
          Para distribuidores y mayoristas
        </div>
        <h1 style={{ fontSize: 'clamp(32px, 6vw, 54px)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-1.5px', marginBottom: 20 }}>
          Catálogos profesionales<br />
          <span style={{ color: 'var(--accent)' }}>listos en 5 minutos</span>
        </h1>
        <p style={{ fontSize: 18, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 36, maxWidth: 520, margin: '0 auto 36px' }}>
          Cargá tus productos, elegí los que querés mostrar, compartí el link con tu cliente.
          El pedido llega directo a tu WhatsApp.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" style={{ ...ctaBtn, fontSize: 15, padding: '13px 28px' }}>
            Crear cuenta gratis
          </Link>
          <a href="#como-funciona" style={{ ...navLink, fontSize: 15, padding: '13px 20px' }}>
            Ver cómo funciona ↓
          </a>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 16 }}>
          Sin tarjeta de crédito · Plan gratuito permanente
        </p>
      </section>

      {/* Demo visual */}
      <section style={{ padding: '0 24px 80px', maxWidth: 860, margin: '0 auto' }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '32px', display: 'flex', gap: 24,
          alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center',
        }}>
          {[
            { n: '1', title: 'Cargás tus productos', desc: 'Desde un Excel o uno por uno. Con foto, SKU y precio.' },
            { n: '2', title: 'Armás el catálogo', desc: 'Seleccionás los productos, ajustás precios y lo nombrás.' },
            { n: '3', title: 'Compartís el link', desc: 'Tu cliente abre el catálogo desde su celular.' },
            { n: '4', title: 'El pedido llega', desc: 'El cliente selecciona y te manda el pedido por WhatsApp.' },
          ].map(s => (
            <div key={s.n} style={{ textAlign: 'center', width: 160 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                color: 'var(--accent)', fontSize: 18, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                {s.n}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="como-funciona" style={{ padding: '0 24px 80px', maxWidth: 860, margin: '0 auto' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, textAlign: 'center', marginBottom: 40, letterSpacing: '-0.5px' }}>
          Todo lo que necesitás para vender mejor
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {[
            { icon: 'document', title: 'PDF profesional', desc: 'Generá catálogos con logo, precios y tu marca en segundos.' },
            { icon: 'link',     title: 'Link público', desc: 'Compartí un link que cualquiera puede ver sin crear cuenta.' },
            { icon: 'message',  title: 'Pedidos por WhatsApp', desc: 'El cliente selecciona y te manda la lista directo a tu número.' },
            { icon: 'view',     title: 'Seguimiento de vistas', desc: 'Sabé cuándo tu cliente abrió el catálogo y cuántas veces.' },
            { icon: 'tag',      title: 'Múltiples marcas', desc: 'Organizá tus productos por marca y armá catálogos combinados.' },
            { icon: 'table',    title: 'Importar desde Excel', desc: 'Subí tu lista de precios y la convertimos en catálogo automáticamente.' },
          ].map(f => (
            <div key={f.title} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '20px 22px',
            }}>
              <div style={{ marginBottom: 10, color: 'var(--accent)' }}>
                <LandingIcon name={f.icon} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: '0 24px 80px', maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.5px' }}>Precios simples</h2>
        <p style={{ fontSize: 15, color: 'var(--text2)', marginBottom: 40 }}>Empezá gratis, crecé cuando lo necesites.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {[
            { name: 'Free', price: '$0', desc: 'Para empezar', features: ['75 productos', '1 catálogo activo', '1 usuario', 'Link público'], cta: 'Empezar gratis', accent: false },
            { name: 'Pro', price: '$29/mes', desc: 'Para crecer', features: ['5.000 productos', '50 catálogos', 'Usuarios ilimitados', 'Soporte prioritario'], cta: 'Empezar Pro', accent: true },
            { name: 'Enterprise', price: 'A consultar', desc: 'Sin límites', features: ['Todo ilimitado', 'Integraciones', 'Onboarding dedicado', 'SLA garantizado'], cta: 'Contactar', accent: false },
          ].map(p => (
            <div key={p.name} style={{
              background: p.accent ? 'var(--accent)' : 'var(--surface)',
              border: `1px solid ${p.accent ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 16, padding: '24px 20px',
              color: p.accent ? 'var(--accent-text)' : 'var(--text)',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p.name}</div>
              <div style={{ fontSize: 26, fontWeight: 900, marginBottom: 4 }}>{p.price}</div>
              <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 20 }}>{p.desc}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', textAlign: 'left' }}>
                {p.features.map(f => (
                  <li key={f} style={{ fontSize: 13, padding: '4px 0', opacity: 0.85 }}>✓ {f}</li>
                ))}
              </ul>
              <Link to="/register" style={{
                display: 'block', padding: '10px', borderRadius: 9,
                background: p.accent ? 'rgba(0,0,0,0.2)' : 'var(--accent)',
                color: p.accent ? 'var(--accent-text)' : 'var(--accent-text)',
                textDecoration: 'none', fontWeight: 700, fontSize: 13,
                border: p.accent ? '1px solid rgba(255,255,255,0.2)' : 'none',
              }}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section style={{ textAlign: 'center', padding: '0 24px 80px' }}>
        <div style={{
          maxWidth: 500, margin: '0 auto',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '48px 32px',
        }}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}><PotatoMark size={48} /></div>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 10, letterSpacing: '-0.5px' }}>
            Tu primer catálogo en 5 minutos
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 28, lineHeight: 1.6 }}>
            Sin tarjeta de crédito. Sin instalaciones. Solo registrate y empezá.
          </p>
          <Link to="/register" style={{ ...ctaBtn, fontSize: 15, padding: '13px 32px', display: 'inline-block' }}>
            Crear cuenta gratis →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '24px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text3)' }}>
        © 2026 Potato · Para distribuidores de Latam
      </footer>
    </div>
  )
}

const navLink = {
  color: 'var(--text2)', textDecoration: 'none', fontSize: 14,
  fontWeight: 500, padding: '8px 12px', borderRadius: 8,
}
const ctaBtn = {
  background: 'var(--accent)', color: 'var(--accent-text)',
  textDecoration: 'none', fontWeight: 700, fontSize: 13,
  padding: '9px 18px', borderRadius: 9, display: 'inline-block',
}

const svgProps = {
  width: 24, height: 24, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor', strokeWidth: '2',
  strokeLinecap: 'round', strokeLinejoin: 'round',
}

function LandingIcon({ name }) {
  const icons = {
    document: <svg {...svgProps}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>,
    link:     <svg {...svgProps}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    message:  <svg {...svgProps}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>,
    view:     <svg {...svgProps}><path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/></svg>,
    tag:      <svg {...svgProps}><path d="M9.5 2H4a2 2 0 0 0-2 2v5.5l9.8 9.8a2 2 0 0 0 2.83 0l5.17-5.17a2 2 0 0 0 0-2.83z"/><circle cx="6.5" cy="6.5" r="1.5"/></svg>,
    table:    <svg {...svgProps}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/></svg>,
  }
  return icons[name] ?? null
}
