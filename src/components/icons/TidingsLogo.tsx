interface Props {
  size?: number
  variant?: 'mark' | 'inverse'
  className?: string
}

/**
 * Tidings brand mark. Matches the v0.21.1 home-screen / PWA icon:
 *   - rounded square in Tidings amber (#F59E0B — the Gathered "T" chip),
 *     or white in `inverse`
 *   - white speech bubble with three dots — reads as "two-way SMS" at a
 *     glance, no letter
 *
 * The white-"T" letterform that used to live here is gone; the suite-wide
 * convention is now "brand color + per-app glyph," with the "Tidings"
 * wordmark appearing as adjacent text wherever the logo is used.
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
  // Glyph fills most of the container — the speech bubble dominates the
  // square the same way the home-screen icon does.
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
        {/* Rounded bubble with a tail dropping bottom-left. */}
        <path
          d="M10 16
             Q10 10 16 10
             L48 10
             Q54 10 54 16
             L54 38
             Q54 44 48 44
             L26 44
             L16 54
             L20 44
             L16 44
             Q10 44 10 38 Z"
          fill={fg}
        />
        <circle cx="22" cy="27" r="3" fill={containerBg} />
        <circle cx="32" cy="27" r="3" fill={containerBg} />
        <circle cx="42" cy="27" r="3" fill={containerBg} />
      </svg>
    </span>
  )
}
