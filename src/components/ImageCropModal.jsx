import { useState, useRef, useEffect, useCallback } from 'react'

const SIZE = 400   // canvas preview size (px)
const MIN_SCALE = 0.2
const MAX_SCALE = 4

export default function ImageCropModal({ file, onConfirm, onCancel }) {
  const canvasRef  = useRef()
  const [img, setImg]       = useState(null)
  const [scale, setScale]   = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef(null)  // { startX, startY, ox, oy }

  // Load image from file
  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      // Fit image to fill the square initially
      const fitScale = Math.max(SIZE / image.naturalWidth, SIZE / image.naturalHeight)
      setScale(fitScale)
      setOffset({ x: 0, y: 0 })
      setImg(image)
      URL.revokeObjectURL(url)
    }
    image.src = url
  }, [file])

  // Draw on canvas whenever img/scale/offset changes
  useEffect(() => {
    if (!img || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    ctx.clearRect(0, 0, SIZE, SIZE)
    const w = img.naturalWidth  * scale
    const h = img.naturalHeight * scale
    const x = SIZE / 2 - w / 2 + offset.x
    const y = SIZE / 2 - h / 2 + offset.y
    ctx.drawImage(img, x, y, w, h)
  }, [img, scale, offset])

  // Mouse drag
  const onMouseDown = useCallback((e) => {
    drag.current = { startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y }
    e.preventDefault()
  }, [offset])

  const onMouseMove = useCallback((e) => {
    if (!drag.current) return
    setOffset({
      x: drag.current.ox + (e.clientX - drag.current.startX),
      y: drag.current.oy + (e.clientY - drag.current.startY),
    })
  }, [])

  const onMouseUp = useCallback(() => { drag.current = null }, [])

  // Touch drag
  const onTouchStart = useCallback((e) => {
    const t = e.touches[0]
    drag.current = { startX: t.clientX, startY: t.clientY, ox: offset.x, oy: offset.y }
  }, [offset])

  const onTouchMove = useCallback((e) => {
    if (!drag.current) return
    const t = e.touches[0]
    setOffset({
      x: drag.current.ox + (t.clientX - drag.current.startX),
      y: drag.current.oy + (t.clientY - drag.current.startY),
    })
    e.preventDefault()
  }, [])

  // Wheel zoom
  const onWheel = useCallback((e) => {
    e.preventDefault()
    setScale(s => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * (e.deltaY < 0 ? 1.08 : 0.93))))
  }, [])

  // Export canvas as blob → pass to parent
  async function handleConfirm() {
    const canvas = canvasRef.current
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92))
    onConfirm(blob)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)',
      zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 24, width: 460,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Ajustar imagen</h3>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>
            Arrastrá para reposicionar · scroll para hacer zoom
          </p>
        </div>

        {/* Canvas */}
        <div style={{ position: 'relative', alignSelf: 'center' }}>
          <canvas
            ref={canvasRef}
            width={SIZE} height={SIZE}
            style={{
              width: SIZE, height: SIZE,
              borderRadius: 10, cursor: 'grab', display: 'block',
              background: '#f0f0f0',
              userSelect: 'none',
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onMouseUp}
            onWheel={onWheel}
          />
          {/* Corner guides */}
          {['0,0', '0,auto', 'auto,0', 'auto,auto'].map((pos, i) => {
            const [t, b] = pos.split(',')
            return (
              <div key={i} style={{
                position: 'absolute',
                top: t === '0' ? 8 : 'auto', bottom: t === 'auto' ? 8 : 'auto',
                left: b === '0' ? 8 : 'auto', right: b === 'auto' ? 8 : 'auto',
                width: 16, height: 16,
                borderTop: t === '0' ? '2px solid rgba(255,255,255,0.7)' : 'none',
                borderBottom: t === 'auto' ? '2px solid rgba(255,255,255,0.7)' : 'none',
                borderLeft: b === '0' ? '2px solid rgba(255,255,255,0.7)' : 'none',
                borderRight: b === 'auto' ? '2px solid rgba(255,255,255,0.7)' : 'none',
                pointerEvents: 'none',
              }} />
            )
          })}
        </div>

        {/* Zoom slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)', width: 28, textAlign: 'center' }}>−</span>
          <input
            type="range" min={MIN_SCALE * 100} max={MAX_SCALE * 100} step={1}
            value={Math.round(scale * 100)}
            onChange={e => setScale(Number(e.target.value) / 100)}
            style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 12, color: 'var(--text3)', width: 28, textAlign: 'center' }}>+</span>
          <span style={{ fontSize: 11, color: 'var(--text3)', width: 36 }}>{Math.round(scale * 100)}%</span>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnSecondary}>Cancelar</button>
          <button onClick={handleConfirm} style={btnPrimary}>Confirmar y subir</button>
        </div>
      </div>
    </div>
  )
}

const btnPrimary   = { padding: '8px 20px', background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: 'pointer' }
const btnSecondary = { padding: '8px 16px', background: 'var(--surface-h)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, cursor: 'pointer' }
