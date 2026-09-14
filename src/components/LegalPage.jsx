import { Link } from 'react-router-dom'
import { PotatoMark } from '@/components/PotatoLogo'

export default function LegalPage({ title, updated, children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <nav style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '16px 32px', borderBottom: '1px solid var(--border)',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: 'var(--text)' }}>
          <PotatoMark size={24} />
          <span style={{ fontSize: 16, fontWeight: 800 }}>Potato</span>
        </Link>
      </nav>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px 80px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>{title}</h1>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 32 }}>Última actualización: {updated}</p>
        <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
