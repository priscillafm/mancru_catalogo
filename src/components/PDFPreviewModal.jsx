import { useState } from 'react'
import { generateCatalogPDF } from '@/utils/pdf'

export default function PDFPreviewModal({ brandGroups, company, onClose }) {
  const [generating, setGenerating]   = useState(false)
  const [progress, setProgress]       = useState('')
  const [orientation, setOrientation] = useState('landscape')

  const totalProducts = brandGroups.reduce((n, g) => n + g.products.length, 0)

  async function handleDownload() {
    setGenerating(true)
    setProgress('Preparando...')
    try {
      await generateCatalogPDF(
        brandGroups,
        company,
        (current, total) => setProgress(`Procesando imagen ${current} de ${total}...`),
        orientation,
      )
      setProgress('¡Listo!')
    } catch (err) {
      setProgress(`Error: ${err.message}`)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, width: '100%', maxWidth: 960,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px 14px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
        }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Vista previa del catálogo</h3>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
              {brandGroups.length} marca{brandGroups.length !== 1 ? 's' : ''} — {totalProducts} producto{totalProducts !== 1 ? 's' : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', marginRight: 16 }}>
            {['landscape','portrait'].map(o => (
              <button key={o} onClick={() => setOrientation(o)} style={{
                padding: '6px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                border: `1px solid ${orientation === o ? 'var(--accent)' : 'var(--border)'}`,
                background: orientation === o ? 'var(--accent)' : 'var(--surface)',
                color: orientation === o ? 'var(--accent-text)' : 'var(--text2)',
                fontWeight: orientation === o ? 700 : 400,
              }}>
                {o === 'landscape' ? '⬛ Horizontal' : '▯ Vertical'}
              </button>
            ))}
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 20, cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {/* Preview groups */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {brandGroups.map(({ brand, products }) => (
            <div key={brand.id} style={{ marginBottom: 28 }}>
              {/* Brand header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
                paddingBottom: 10, borderBottom: `2px solid ${brand.color}`
              }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: brand.color }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: brand.color }}>{brand.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>{products.length} productos</span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 12,
              }}>
                {products.map(p => (
                  <div key={p.id} style={{
                    background: '#fff', color: '#111', borderRadius: 8,
                    padding: 10, textAlign: 'center', border: '1px solid #eee'
                  }}>
                    {p.image_url ? (
                      <img src={p.image_url} alt=""
                        style={{ width: '100%', aspectRatio: '1', objectFit: 'contain', marginBottom: 8, borderRadius: 4 }}
                        onError={e => { e.target.style.display = 'none' }} />
                    ) : (
                      <div style={{
                        width: '100%', aspectRatio: '1', background: '#f0f0f0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 24, marginBottom: 8, borderRadius: 4
                      }}>📷</div>
                    )}
                    <div style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 6,
                      background: brand.color, color: brand.text_color ?? '#fff',
                      fontSize: 9, fontWeight: 700, marginBottom: 5, fontFamily: 'monospace'
                    }}>
                      {p.sku}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3 }}>{p.name}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
        }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{progress}</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{
              padding: '8px 18px', background: 'var(--surface-h)',
              border: '1px solid var(--border)', color: 'var(--text2)',
              borderRadius: 7, cursor: 'pointer', fontSize: 13
            }}>
              Cerrar
            </button>
            <button onClick={handleDownload} disabled={generating} style={{
              padding: '8px 22px', background: 'var(--accent)', color: 'var(--accent-text)',
              border: 'none', borderRadius: 7, fontWeight: 700,
              cursor: generating ? 'not-allowed' : 'pointer', fontSize: 13,
              opacity: generating ? 0.7 : 1
            }}>
              {generating ? progress || 'Generando...' : '⬇ Descargar PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
