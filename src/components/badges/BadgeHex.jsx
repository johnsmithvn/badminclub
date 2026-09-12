import { ANIME_TIERS, ANIME_GLYPHS, HEX_CLIP } from '#lib/badges.js'

/**
 * Component render Huy hiệu Lục giác phong cách Anime.
 * Hỗ trợ mọi kích thước từ mini 24px, 34px, 44px, 54px, 62px, 76px, 124px, 180px đến 190px.
 */
export default function BadgeHex({
  tier = 'rare',
  glyph = 'crystal',
  size = 54,
  spin = false,
  float = false,
  pulse = false,
  twinkle = false,
  dim = false,
  style = {},
}) {
  const t = ANIME_TIERS[tier] || ANIME_TIERS.rare
  const isSpin = spin || t.spin
  const isPulse = pulse || (size >= 40 && !dim)
  const isDim = dim || t.dim
  const gPath = ANIME_GLYPHS[glyph] || ANIME_GLYPHS.crystal

  // Kích thước lề đệm theo size
  const pad = size >= 80 ? 4 : size >= 44 ? 3 : 2
  const gh = Math.round(size * 0.40)
  const gw = Math.round(gh * 0.9)

  const wrapStyle = {
    position: 'relative',
    width: size,
    height: size,
    flex: '0 0 auto',
    animation: float ? 'aFloat 6s ease-in-out infinite' : undefined,
    ...style,
  }

  return (
    <div style={wrapStyle}>
      {/* 1. Hào quang tỏa sáng (Aura Glow) */}
      {isPulse && !isDim && size >= 36 && (
        <div
          style={{
            position: 'absolute',
            inset: '-26%',
            background: `radial-gradient(50% 50% at 50% 50%, ${t.aura || 'rgba(255,46,126,.4)'}, transparent 72%)`,
            animation: `aPulse ${isSpin ? '2.8s' : '4.2s'} ease-in-out infinite`,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* 2. Khung viền lục giác neon (Frame) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: HEX_CLIP,
          background: t.ring,
          animation: isSpin && size >= 40 ? 'aSpin 7s linear infinite' : undefined,
        }}
      />

      {/* 3. Lõi nền sẫm màu (Dark Core) */}
      <div
        style={{
          position: 'absolute',
          inset: pad,
          clipPath: HEX_CLIP,
          background: t.core,
        }}
      />

      {/* 4. Hình học Glyph hoặc dấu hỏi ? cho danh hiệu ẩn */}
      {isDim ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            font: `700 ${Math.round(size * 0.38)}px/1 Oswald, sans-serif`,
            color: '#6B5C8C',
          }}
        >
          ?
        </div>
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div
            style={{
              width: gw,
              height: gh,
              background: `linear-gradient(180deg, ${t.g1}, ${t.g2} 52%, ${t.g3})`,
              clipPath: gPath,
              filter: size >= 70 ? `drop-shadow(0 0 10px ${t.aura})` : undefined,
            }}
          />
        </div>
      )}

      {/* 5. Các hạt sao lấp lánh (nếu bật twinkle trong modal chúc mừng) */}
      {twinkle && (
        <>
          <div
            style={{
              position: 'absolute',
              top: '-6%',
              left: '-2%',
              width: 16,
              height: 16,
              background: '#FFE24B',
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
              animation: 'aTwinkle 2.2s ease-in-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '2%',
              right: '-6%',
              width: 12,
              height: 12,
              background: '#FF6BE0',
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
              animation: 'aTwinkle 2.8s ease-in-out 0.6s infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '36%',
              right: '-12%',
              width: 9,
              height: 9,
              background: '#7FE7FF',
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
              animation: 'aTwinkle 3.2s ease-in-out 1.1s infinite',
            }}
          />
        </>
      )}
    </div>
  )
}
