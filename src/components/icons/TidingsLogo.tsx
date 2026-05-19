interface Props {
  size?: number
  variant?: 'mark' | 'inverse'
  className?: string
}

/**
 * Tidings brand mark. Matches the v0.22.6 home-screen / PWA icon:
 *   - rounded square in Tidings amber (#F59E0B — the Gathered "T" chip),
 *     or white in `inverse`
 *   - white fanfare bugle pointing up-right at ~20° — mouthpiece on
 *     the lower-left, body, flared bell on the upper-right. Reads as
 *     "declare glad tidings" (D&C 31:3).
 *
 * Geometry mirrors the rasterized icon, just scaled 1/8 to fit a
 * 0..64 viewBox.
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
  const glyph = Math.round(size * 0.86)
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
        <g fill={fg} transform="rotate(-20 32 32)">
          {/* Mouthpiece bowl */}
          <ellipse cx="10.5" cy="32" rx="3" ry="3.5" />
          {/* Body tube */}
          <rect x="12.5" y="29" width="27.75" height="6" rx="1.5" />
          {/* Bell flared up-right */}
          <path
            d="M40.25 26.5
               L 55.75 15
               Q 57.5 15 57.5 16.75
               L 57.5 47.25
               Q 57.5 49 55.75 49
               L 40.25 37.5 Z"
          />
        </g>
      </svg>
    </span>
  )
}
