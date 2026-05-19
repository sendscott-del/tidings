interface Props {
  size?: number
  variant?: 'mark' | 'inverse'
  className?: string
}

/**
 * Tidings brand mark. Matches the v0.22.3 home-screen / PWA icon:
 *   - rounded square in Tidings amber (#F59E0B — the Gathered "T" chip),
 *     or white in `inverse`
 *   - white speaker with three sound-wave arcs — the original Tidings
 *     glyph the user requested we return to
 *
 * The "Tidings" wordmark continues to appear as adjacent text wherever
 * the logo is used.
 */
export function TidingsLogo({ size = 44, variant = 'mark', className }: Props) {
  const isInverse = variant === 'inverse'
  const containerBg = isInverse ? '#FFFFFF' : '#F59E0B'
  const fg = isInverse ? '#F59E0B' : '#FFFFFF'
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
  const glyph = Math.round(size * 0.78)
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
        {/* Speaker cone — small rectangle on the left, flaring up + down
            to a vertical edge on the right. */}
        <path
          d="M15 27 L23 27 L33 18 L33 46 L23 37 L15 37 Z"
          fill={fg}
          stroke={fg}
          strokeWidth={1}
          strokeLinejoin="round"
        />
        {/* Three sound-wave arcs, increasing radius. */}
        <path d="M37.5 25 Q42 32 37.5 39" fill="none" stroke={fg} strokeWidth={2.8} strokeLinecap="round" />
        <path d="M42.5 20 Q50 32 42.5 44" fill="none" stroke={fg} strokeWidth={2.8} strokeLinecap="round" />
        <path d="M47.5 15 Q58 32 47.5 49" fill="none" stroke={fg} strokeWidth={2.8} strokeLinecap="round" />
      </svg>
    </span>
  )
}
