interface Props {
  size?: number
  variant?: 'mark' | 'inverse'
  className?: string
}

/**
 * Tidings brand mark. Matches the v0.22.4 home-screen / PWA icon:
 *   - rounded square in Tidings amber (#F59E0B — the Gathered "T" chip),
 *     or white in `inverse`
 *   - three concentric sound-wave arcs, white on amber, no speaker
 *
 * The speaker cone the previous design carried is gone — the user wants
 * just the three lines that represent sound. The "Tidings" wordmark
 * continues to appear as adjacent text wherever the logo is used.
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
  // viewBox 0..64; arcs anchored at x=22, centered vertically at y=32.
  // Same geometry the rasterized icon uses, just scaled down 1/8.
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
          d="M22 25.75 A 6.25 6.25 0 0 1 22 38.25"
          fill="none"
          stroke={fg}
          strokeWidth={4.25}
          strokeLinecap="round"
        />
        <path
          d="M22 18.875 A 13.125 13.125 0 0 1 22 45.125"
          fill="none"
          stroke={fg}
          strokeWidth={4.25}
          strokeLinecap="round"
        />
        <path
          d="M22 12 A 20 20 0 0 1 22 52"
          fill="none"
          stroke={fg}
          strokeWidth={4.25}
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}
