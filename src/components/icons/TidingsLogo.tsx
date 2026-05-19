interface Props {
  size?: number
  variant?: 'mark' | 'inverse'
  className?: string
}

/**
 * Tidings brand mark. Matches the v0.22.8 home-screen / PWA icon:
 *   - rounded square in Tidings amber (#F59E0B — the Gathered "T" chip),
 *     or white in `inverse`
 *   - white herald / fanfare trumpet with the bell pointing up-LEFT
 *     and the J-hook + mouthpiece on the lower-right
 *
 * Construction mirrors the rasterized icon: trumpet drawn horizontally
 * with bell on the right and mouthpiece on the left, then flipped
 * around x=32 and rotated +30° to lift the bell up-left.
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
        <g
          transform="rotate(30 32 32) matrix(-1 0 0 1 64 0)"
          fill={fg}
        >
          {/* Bell */}
          <path
            d="M 42.5 27.25
               L 59 16.5
               Q 61 16.5 61 18.5
               L 61 45.5
               Q 61 47.5 59 47.5
               L 42.5 36.75 Z"
          />
          {/* Body tube */}
          <rect x="18.75" y="29" width="24.5" height="2.75" rx="0.5" />
          {/* J-hook */}
          <path
            d="M 19.5 31.75
               L 19.5 35.25
               Q 19.5 38.25 22.5 38.25
               L 32 38.25
               Q 35.25 38.25 35.25 35.25
               L 35.25 31.75"
            fill="none"
            stroke={fg}
            strokeWidth="2.75"
            strokeLinejoin="round"
          />
          {/* Mouthpiece bowl */}
          <ellipse cx="35.25" cy="30.5" rx="1.75" ry="2" />
        </g>
      </svg>
    </span>
  )
}
