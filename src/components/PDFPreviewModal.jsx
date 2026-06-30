import { useState } from 'react'
import { generateCatalogPDF } from '@/utils/pdf'

export default function PDFPreviewModal({ products, brand, company, onClose }) {
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress]     = useState('')

  async function handleDownload() {
    setGenerating(true)
    setProgress('Preparando...')
    try {
      await generateCatalogPDF(
        products,
        brand,
        company,
        (current, total) => setProgress(`Procesando imagen ${current} de ${total}...`)
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
        borderRadius: 14, width: '100%', maxWidth: 900,
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
              {brand?.name} — {products.length} producto{products.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 20, cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {/* Preview grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 14,
          }}>
            {products.map(p => (
              <div key={p.id} style={{
                background: '#fff', color: '#111', borderRadius: 8,
                padding: 12, textAlign: 'center',
                border: '1px solid #eee'
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
                  background: brand?.color ?? '#6366f1',
                  color: brand?.text_color ?? '#fff',
                  fontSize: 9, fontWeight: 700, marginBottom: 5, fontFamily: 'monospace'
                }}>
                  {p.sku}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 3, lineHeight: 1.3 }}>{p.name}</div>
                <div style={{ fontSize: 10, color: '#666', lineHeight: 1.3 }}>{p.description}</div>
              </div>
            ))}
          </div>
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
