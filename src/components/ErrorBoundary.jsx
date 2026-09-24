import { Component } from 'react'

// Si algo falla al dibujar (por ejemplo, una pestaña vieja que pide archivos de una versión
// anterior), mostramos un mensaje claro con un botón para recargar en vez de dejar la pantalla negra.
export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error(error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center',
        background: 'var(--bg)', color: 'var(--text)',
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Hay una versión nueva de Potato</h1>
        <p style={{ fontSize: 14, color: 'var(--text2)', maxWidth: 360, lineHeight: 1.6 }}>
          Recargá la página para seguir. Tu trabajo guardado no se pierde.
        </p>
        <button onClick={() => window.location.reload()} style={{
          padding: '10px 22px', background: 'var(--accent)', color: 'var(--accent-text)',
          border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
        }}>
          Recargar
        </button>
      </div>
    )
  }
}
