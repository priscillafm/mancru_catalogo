// Potato app mark — the potato shape with eyes
export function PotatoMark({ size = 32, className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 190"
      width={size}
      height={size * (190 / 200)}
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <path
        d="M24 102 C22 74 40 52 60 46 C76 41 86 40 102 40 C124 40 138 42 146 48 C164 60 176 78 176 100 C176 122 166 138 150 144 C130 152 118 151 100 150 C80 149 66 150 50 143 C34 137 26 122 24 102 Z"
        fill="#E0B15B"
      />
      <circle cx="78" cy="91" r="7.5" fill="#141210" />
      <circle cx="126" cy="91" r="7.5" fill="#141210" />
    </svg>
  )
}

// Potato lockup — potato mark + "Potato" wordmark side by side
export function PotatoLockup({ height = 36 }) {
  const markH = height
  const markW = markH * (200 / 190)
  const fontSize = height * 0.72
  const totalW = markW + 12 + fontSize * 3.2 // rough estimate for "Potato"

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${totalW} ${height}`}
      height={height}
      width={totalW}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* Mark */}
      <g transform={`scale(${markH / 190})`}>
        <path
          d="M24 102 C22 74 40 52 60 46 C76 41 86 40 102 40 C124 40 138 42 146 48 C164 60 176 78 176 100 C176 122 166 138 150 144 C130 152 118 151 100 150 C80 149 66 150 50 143 C34 137 26 122 24 102 Z"
          fill="#E0B15B"
        />
        <circle cx="78" cy="91" r="7.5" fill="#141210" />
        <circle cx="126" cy="91" r="7.5" fill="#141210" />
      </g>
      {/* Wordmark */}
      <text
        x={markW + 10}
        y={height * 0.76}
        fontSize={fontSize}
        fontWeight="600"
        fontFamily="Sora, Inter, system-ui, sans-serif"
        letterSpacing="-0.03em"
        fill="var(--text)"
      >
        Potato
      </text>
    </svg>
  )
}
