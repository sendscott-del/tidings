interface Props {
  size?: number
  variant?: 'mark' | 'inverse'
  className?: string
}

/**
 * Tidings brand mark. Matches the v0.22.9 home-screen / PWA icon:
 *   - rounded square in Tidings amber (#F59E0B), or white in `inverse`
 *   - coiled trumpet: pill loop in the middle, smooth lead pipe up to
 *     a flared bell at the upper-right, mouthpiece bulb on the left
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
        {/* Pill loop */}
        <rect
          x="12.5"
          y="36.25"
          width="30"
          height="8.75"
          rx="4.375"
          fill="none"
          stroke={fg}
          strokeWidth="3.75"
        />
        {/* Lead pipe up to the bell */}
        <path
          d="M 39.75 38.125 C 43.75 35 44.375 30 43.75 25"
          stroke={fg}
          strokeWidth="3.75"
          fill="none"
          strokeLinecap="round"
        />
        {/* Bell, rotated to point up-right */}
        <g transform="rotate(-40 45 22.5)">
          <path
            d="M 42.5 20.625
               L 58.75 16.25
               Q 61 16.25 61 18.5
               L 61 26.5
               Q 61 28.75 58.75 28.75
               L 42.5 24.375 Z"
            fill={fg}
          />
          <ellipse cx="61" cy="22.5" rx="1" ry="6.5" fill={fg} />
        </g>
        {/* Mouthpiece bowl on the left */}
        <ellipse cx="9.75" cy="40.625" rx="2.25" ry="2.75" fill={fg} />
      </svg>
    </span>
  )
}
