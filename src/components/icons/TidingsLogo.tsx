interface Props {
  size?: number
  variant?: 'mark' | 'inverse'
  className?: string
}

// "T" letterform with gold "signal sweep" arcs off the upper-right —
// suggesting transmission / sending word. Sits inside a rounded navy
// square (or white square in inverse).
export function TidingsLogo({ size = 44, variant = 'mark', className }: Props) {
  const isInverse = variant === 'inverse'
  const containerBg = isInverse ? '#FFFFFF' : '#1B3A6B'
  const stroke = isInverse ? '#1B3A6B' : '#FFFFFF'
  const accent = '#C9A84C'
  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: Math.round(size * 0.225),
    background: containerBg,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: isInverse ? '1px solid #E5E7EB' : 'none',
    flexShrink: 0,
  }
  const glyph = Math.round(size * 0.6)
  return (
    <span style={containerStyle} className={className}>
      <svg
        width={glyph}
        height={glyph}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Tidings"
      >
        <path
          d="M14 16 L50 16 M32 16 L32 50"
          stroke={stroke}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M52 14 C 56 16, 56 22, 53 25"
          stroke={accent}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M55 10 C 61 13, 61 24, 56 28"
          stroke={accent}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
          opacity={0.55}
        />
      </svg>
    </span>
  )
}
