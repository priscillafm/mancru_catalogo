import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { PotatoMark } from '@/components/PotatoLogo'
import { usePlans } from '@/hooks/usePlans'
import PricingCards from '@/components/PricingCards'
import { DEMO_CATALOG_ID } from '@/utils/demoCatalog'

export default function LandingPage() {
  const { session, loading } = useAuthStore()
  const navigate = useNavigate()
  const { data: plans = [] } = usePlans()

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
        position: 'sticky', top: 0, background: 'var(--bg-bar)',
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
      <section style={{ position: 'relative', overflow: 'hidden', background: 'var(--bg)' }}>
        {/* Formas difuminadas decorativas */}
        <div aria-hidden="true" style={{
          position: 'absolute', top: '-120px', left: '-80px', width: 380, height: 380,
          borderRadius: '50%', background: 'var(--violet)', opacity: 0.22, filter: 'blur(90px)',
        }} />
        <div aria-hidden="true" style={{
          position: 'absolute', top: '-40px', right: '-100px', width: 420, height: 420,
          borderRadius: '50%', background: 'var(--indigo)', opacity: 0.16, filter: 'blur(100px)',
        }} />
        <div aria-hidden="true" style={{
          position: 'absolute', bottom: '-160px', left: '30%', width: 460, height: 460,
          borderRadius: '50%', background: 'var(--magenta)', opacity: 0.12, filter: 'blur(110px)',
        }} />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '80px 24px 60px', maxWidth: 700, margin: '0 auto' }}>
          <div style={{
            display: 'inline-block', padding: '5px 14px', borderRadius: 999,
            background: 'color-mix(in srgb, var(--violet) 15%, transparent)',
            border: '1px solid color-mix(in srgb, var(--violet) 30%, transparent)',
            color: 'var(--violet)', fontSize: 12, fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 24,
          }}>
            Para distribuidores y mayoristas
          </div>
          <h1 style={{
            fontFamily: "'Space Grotesk', var(--font)", fontSize: 'clamp(32px, 6vw, 54px)',
            fontWeight: 700, lineHeight: 1.1, letterSpacing: '-1.5px', marginBottom: 20,
          }}>
            Catálogos profesionales<br />
            <span style={{
              color: '#fff',
              textShadow: `
                0 0 2px #fff, 0 0 6px #fff,
                0 0 14px var(--violet), 0 0 28px var(--violet),
                0 0 46px var(--magenta)
              `,
            }}>listos en 5 minutos</span>
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
          <p style={{ marginTop: 14 }}>
            <Link to={`/c/${DEMO_CATALOG_ID}`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              fontFamily: 'var(--font-light)', fontWeight: 400, fontSize: 13.5,
              color: 'var(--indigo)', textDecoration: 'none',
              padding: '6px 14px', borderRadius: 999,
              border: '1px dashed color-mix(in srgb, var(--indigo) 45%, transparent)',
              background: 'color-mix(in srgb, var(--indigo) 8%, transparent)',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--indigo)', boxShadow: '0 0 6px var(--indigo)' }} />
              Ver catálogo de ejemplo →
            </Link>
          </p>
        </div>
      </section>

      <div style={{ fontFamily: 'var(--font-light)', fontWeight: 300 }}>

      {/* Demo visual */}
      <section style={{ padding: '0 24px 80px', maxWidth: 860, margin: '0 auto' }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '32px', display: 'flex', gap: 24,
          alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center',
        }}>
          {[
            { n: '1', title: 'Cargás tus productos', desc: 'Desde un Excel o uno por uno. Con foto, SKU y precio.', color: 'var(--violet)' },
            { n: '2', title: 'Armás el catálogo', desc: 'Seleccionás los productos, ajustás precios y lo nombrás.', color: 'var(--indigo)' },
            { n: '3', title: 'Compartís el link', desc: 'Tu cliente abre el catálogo desde su celular.', color: 'var(--magenta)' },
            { n: '4', title: 'El pedido llega', desc: 'El cliente selecciona y te manda el pedido por WhatsApp.', color: 'var(--flame)' },
          ].map(s => (
            <div key={s.n} style={{ textAlign: 'center', width: 160 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: `color-mix(in srgb, ${s.color} 15%, transparent)`,
                color: s.color, fontSize: 18, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                {s.n}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="como-funciona" style={{ padding: '0 24px 80px', maxWidth: 860, margin: '0 auto' }}>
        <h2 style={{ fontSize: 28, fontWeight: 600, textAlign: 'center', marginBottom: 40, letterSpacing: '-0.5px' }}>
          Todo lo que necesitás para vender mejor
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {[
            { icon: 'document', title: 'PDF profesional', desc: 'Generá catálogos con logo, precios y tu marca en segundos.', color: 'var(--violet)' },
            { icon: 'link',     title: 'Link público', desc: 'Compartí un link que cualquiera puede ver sin crear cuenta.', color: 'var(--indigo)' },
            { icon: 'message',  title: 'Pedidos por WhatsApp', desc: 'El cliente selecciona y te manda la lista directo a tu número.', color: 'var(--magenta)' },
            { icon: 'view',     title: 'Seguimiento de vistas', desc: 'Sabé cuándo tu cliente abrió el catálogo y cuántas veces.', color: 'var(--flame)' },
            { icon: 'tag',      title: 'Múltiples marcas', desc: 'Organizá tus productos por marca y armá catálogos combinados.', color: 'var(--indigo)' },
            { icon: 'table',    title: 'Importar desde Excel', desc: 'Subí tu lista de precios y la convertimos en catálogo automáticamente.', color: 'var(--violet)' },
          ].map(f => (
            <div key={f.title} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '20px 22px', borderTop: `2px solid ${f.color}`,
              transition: 'transform 0.18s ease',
            }}>
              <div style={{
                marginBottom: 12, color: f.color, width: 36, height: 36, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `color-mix(in srgb, ${f.color} 14%, transparent)`,
              }}>
                <LandingIcon name={f.icon} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: '0 24px 80px', maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8, letterSpacing: '-0.5px' }}>Precios simples</h2>
        <p style={{ fontSize: 15, color: 'var(--text2)', marginBottom: 40 }}>Empezá gratis, crecé cuando lo necesites.</p>
        {plans.length > 0 && (
          <PricingCards
            plans={plans}
            renderCta={(p, accent) => (
              <Link to={p.name === 'enterprise' ? '/contacto?plan=enterprise' : '/register'} style={{
                display: 'block', padding: '10px', borderRadius: 9,
                background: accent ? 'rgba(0,0,0,0.2)' : 'var(--accent)',
                color: 'var(--accent-text)',
                textDecoration: 'none', fontWeight: 700, fontSize: 13,
                border: accent ? '1px solid rgba(255,255,255,0.2)' : 'none',
              }}>
                {p.name === 'free' ? 'Empezar gratis' : p.name === 'enterprise' ? 'Contactar' : 'Empezar Pro'}
              </Link>
            )}
          />
        )}
      </section>

      {/* CTA final */}
      <section style={{ textAlign: 'center', padding: '0 24px 80px', position: 'relative' }}>
        <div style={{
          maxWidth: 500, margin: '0 auto', position: 'relative', overflow: 'hidden',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '48px 32px',
        }}>
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.5, pointerEvents: 'none',
            background: 'radial-gradient(80% 100% at 50% 0%, color-mix(in srgb, var(--violet) 16%, transparent) 0%, transparent 60%)',
          }} />
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}><PotatoMark size={48} /></div>
          <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 10, letterSpacing: '-0.5px' }}>
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
        {' · '}
        <Link to="/terms" style={{ color: 'var(--text3)' }}>Términos</Link>
        {' · '}
        <Link to="/privacy" style={{ color: 'var(--text3)' }}>Privacidad</Link>
        {' · '}
        <Link to="/contacto" style={{ color: 'var(--text3)' }}>Contacto</Link>
      </footer>
      </div>
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
  width: 19, height: 19, viewBox: '0 0 24 24',
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
