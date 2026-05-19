interface Props {
  size?: number
  variant?: 'mark' | 'inverse'
  className?: string
}

/**
 * Tidings brand mark. Matches the v0.22.7 home-screen / PWA icon:
 *   - rounded square in Tidings amber (#F59E0B — the Gathered "T" chip),
 *     or white in `inverse`
 *   - white trumpet at ~20° with three visible valve casings on the body
 *   - mouthpiece lower-left, bell flared upper-right — reads as
 *     "declare glad tidings of great joy" (D&C 31:3)
 *
 * Geometry mirrors the rasterized icon, scaled 1/8 to fit a 0..64
 * viewBox.
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
          <ellipse cx="11" cy="32" rx="2.75" ry="3.25" />
          {/* Body tube */}
          <rect x="12.5" y="30.5" width="25" height="3" rx="0.75" />
          {/* Three valve casings */}
          <rect x="18.75" y="26" width="2.5" height="5" rx="0.625" />
          <rect x="23" y="26" width="2.5" height="5" rx="0.625" />
          <rect x="27.25" y="26" width="2.5" height="5" rx="0.625" />
          {/* Bell flared up-right */}
          <path
            d="M37.5 28.25
               L 54 17.25
               Q 55.75 17.25 55.75 19
               L 55.75 45
               Q 55.75 46.75 54 46.75
               L 37.5 35.75 Z"
          />
        </g>
      </svg>
    </span>
  )
}
