/**
 * Compact usage bar: "68 / 75 productos ▓▓▓▓▓▓▓▓░░"
 * Props: used, max (null = unlimited), label, pct (0-100)
 */
export default function PlanLimitBar({ used, max, label, pct }) {
  if (max === null) {
    return (
      <span style={{ fontSize: 12, color: 'var(--text3)' }}>
        {used} {label}
      </span>
    )
  }

  const color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f97316' : 'var(--accent)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: pct >= 90 ? '#ef4444' : 'var(--text3)', whiteSpace: 'nowrap' }}>
        {used} / {max} {label}
      </span>
      <div style={{
        width: 80, height: 4, borderRadius: 99,
        background: 'var(--border)', overflow: 'hidden', flexShrink: 0,
      }}>
        <div style={{
          height: '100%', borderRadius: 99,
          width: `${Math.min(100, pct)}%`,
          background: color,
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  )
}
