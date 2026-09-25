import { useEffect, useState, useCallback } from 'react'
import { useTourStore } from '@/store/tour.store'

const TOUR_STEPS = [
  { target: 'nav-resumen',   title: 'Resumen',      desc: 'El estado de tu cuenta de un vistazo: qué te falta cargar (WhatsApp, productos, fotos, precios) y los números clave.' },
  { target: 'nav-brands',    title: 'Marcas',        desc: 'Organizá tus productos por marca o proveedor. Cada marca arranca en una página nueva del catálogo.' },
  { target: 'nav-products',  title: 'Productos',     desc: 'Cargá productos a mano o desde un Excel: foto, SKU, precio y stock.' },
  { target: 'nav-sync',      title: 'Sincronizar',   desc: 'Subí un Excel actualizado y Potato te muestra qué cambió antes de aplicar nada.' },
  { target: 'nav-import',    title: 'Importar',      desc: 'La primera carga masiva de productos, con vista previa de cada fila antes de confirmar.' },
  { target: 'nav-users',     title: 'Usuarios',      desc: 'Invitá a tu equipo. Cada uno puede tener un rol distinto (admin o colaborador).' },
  { target: 'nav-settings',  title: 'Config',        desc: 'Tu logo, nombre de empresa y WhatsApp para recibir pedidos.' },
  { target: 'nav-guide',     title: 'Guía',          desc: 'Cuando quieras repasar cómo funciona todo esto, volvé a este botón.' },
]

function getRect(target) {
  const el = document.querySelector(`[data-tour="${target}"]`)
  return el ? el.getBoundingClientRect() : null
}

export default function AdminTour() {
  const active = useTourStore(s => s.active)
  const stop   = useTourStore(s => s.stop)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState(null)

  const recompute = useCallback(() => {
    setRect(getRect(TOUR_STEPS[step].target))
  }, [step])

  useEffect(() => {
    if (!active) return
    setStep(0)
  }, [active])

  useEffect(() => {
    if (!active) return
    recompute()
    window.addEventListener('resize', recompute)
    return () => window.removeEventListener('resize', recompute)
  }, [active, recompute])

  if (!active) return null

  const current = TOUR_STEPS[step]
  const isLast  = step === TOUR_STEPS.length - 1

  // Tooltip position: to the right of the target if there's room, otherwise below it
  const spaceRight = rect ? window.innerWidth - rect.right : 0
  const placeRight = spaceRight > 320
  const boxTop  = rect ? Math.min(rect.top, window.innerHeight - 220) : 80
  const boxLeft = rect
    ? (placeRight ? rect.right + 16 : Math.min(rect.left, window.innerWidth - 320))
    : 80
  const tooltipTop = rect && !placeRight ? rect.bottom + 12 : boxTop

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500 }}>
      <div onClick={stop} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)' }} />

      {rect && (
        <div style={{
          position: 'absolute',
          top: rect.top - 6, left: rect.left - 6,
          width: rect.width + 12, height: rect.height + 12,
          borderRadius: 12,
          boxShadow: '0 0 0 3px var(--accent), 0 0 0 9999px rgba(0,0,0,.55)',
          background: 'transparent',
          pointerEvents: 'none',
          transition: 'top 0.2s, left 0.2s, width 0.2s, height 0.2s',
        }} />
      )}

      <div style={{
        position: 'absolute',
        top: Math.max(12, tooltipTop),
        left: Math.max(12, boxLeft),
        width: 290,
        background: 'var(--surface)',
        border: '1px solid var(--border-str)',
        borderRadius: 12,
        padding: 16,
        boxShadow: '0 12px 40px rgba(0,0,0,.5)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>
          {step + 1} / {TOUR_STEPS.length}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{current.title}</div>
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.45, margin: 0 }}>{current.desc}</p>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
          <button onClick={stop} style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Saltar
          </button>
          <div style={{ flex: 1 }} />
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={btnGhost}>Atrás</button>
          )}
          <button onClick={() => isLast ? stop() : setStep(s => s + 1)} style={btnAccent}>
            {isLast ? 'Listo' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  )
}

const btnGhost = {
  padding: '6px 12px', background: 'var(--surface-h)', color: 'var(--text2)',
  border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, cursor: 'pointer',
}
const btnAccent = {
  padding: '6px 14px', background: 'var(--accent)', color: 'var(--accent-text)',
  border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
}
