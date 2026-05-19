interface Props {
  size?: number
  variant?: 'mark' | 'inverse'
  className?: string
}

/**
 * Tidings brand mark. Matches the v0.22.5 home-screen / PWA icon:
 *   - rounded square in Tidings amber (#F59E0B — the Gathered "T" chip),
 *     or white in `inverse`
 *   - three white sound-wave curves emanating outward; quadratic Bezier
 *     arcs that fan outward (not nested half-circles), so the glyph
 *     clearly reads as sound rather than a target
 *
 * The wordmark "Tidings" continues to appear as adjacent text wherever
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
  const glyph = Math.round(size * 0.82)
  // viewBox 0..64; same geometry the rasterized icon uses, scaled down 1/8.
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
          d="M22.5 26.875 Q27.5 32 22.5 37.125"
          fill="none"
          stroke={fg}
          strokeWidth={4}
          strokeLinecap="round"
        />
        <path
          d="M20 20 Q40 32 20 44"
          fill="none"
          stroke={fg}
          strokeWidth={4}
          strokeLinecap="round"
        />
        <path
          d="M17.5 13.125 Q52.5 32 17.5 50.875"
          fill="none"
          stroke={fg}
          strokeWidth={4}
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}
