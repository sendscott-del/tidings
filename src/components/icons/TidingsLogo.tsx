interface Props {
  size?: number
  variant?: 'mark' | 'inverse'
  className?: string
}

/**
 * Tidings brand mark. Renders the user-supplied trumpet PNG (the same
 * artwork served as the home-screen / PWA icon at /apple-touch-icon.png).
 *
 * Why a PNG and not a hand-coded SVG: the design has organic curves that
 * are difficult to reproduce exactly in path commands. The source PNG
 * lives at public/icon-source.png and is the single source of truth for
 * every icon size the app serves.
 *
 * Inverse variant intentionally renders on a white container (no
 * recolor), since the artwork already includes its own amber background.
 */
export function TidingsLogo({ size = 44, variant = 'mark', className }: Props) {
  const isInverse = variant === 'inverse'
  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: Math.round(size * 0.225),
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: isInverse ? '#FFFFFF' : 'transparent',
    border: isInverse ? '1px solid #E5E7EB' : 'none',
    flexShrink: 0,
  }
  return (
    <span style={containerStyle} className={className}>
      <img
        src="/apple-touch-icon.png"
        alt="Tidings"
        width={size}
        height={size}
        style={{ display: 'block', width: size, height: size }}
      />
    </span>
  )
}
