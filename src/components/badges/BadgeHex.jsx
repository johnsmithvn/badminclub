import { BADGE_GLYPHS, HEX_CLIP } from '#lib/badges.js'
import { TIER_FX } from './tierFx.js'

/**
 * Hiệu ứng ghép theo bậc (thiết kế "Hiệu ứng cho icon huy hiệu", hàng Gợi ý) — bậc càng cao
 * càng nổi. Hiếm đứng yên, chỉ có quầng sáng tĩnh. Tự phong không có trong thiết kế, đi cùng
 * Tinh anh.
 */
const TIER_MOTION = {
  rare: {},
  elite: { sheen: true },
  epic: { sheen: true, pulse: true, sparkle: true },
  legend: { spin: true, pulse: true, orbit: true, sparkle: true },
  fun: { sheen: true },
  hidden: {},
}

// Ngôi sao bốn cánh của hiệu ứng lấp lánh.
const SPARK_CLIP = 'polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%)'

// Dưới cỡ này icon nằm lẫn trong dòng chữ / bảng — chuyển động ở đó chỉ gây rối mắt.
const MIN_MOTION_SIZE = 30

/**
 * Icon huy hiệu lục giác — dùng ở MỌI nơi hiện huy hiệu.
 *
 * Mọi số đo lấy theo bản thiết kế (hình lục giác 76×84 trong ô 96×104) rồi nhân theo `size`:
 * `size` là chiều cao hình lục giác, khung chiếm chỗ vẫn vuông size×size như trước để không xô
 * lệch bố cục nơi gọi; quầng, hạt bay và sao lấp lánh tràn ra ngoài khung.
 *
 * - `dim`: huy hiệu chưa mở (hoặc bậc Ẩn) — viền mờ, dấu "?", không chuyển động.
 * - `still`: vẫn hiện glyph nhưng đứng yên — cho chỗ cần khoe hình huy hiệu chưa mở.
 */
export default function BadgeHex({
  tier = 'rare',
  glyph = 'crystal',
  size = 54,
  dim = false,
  still = false,
  style = {},
}) {
  const fx = TIER_FX[tier] || TIER_FX.rare
  const isLocked = dim || tier === 'hidden'
  const motion = isLocked || still || size < MIN_MOTION_SIZE ? {} : (TIER_MOTION[tier] || {})

  const k = size / 84
  const hexW = Math.round(size * (76 / 84))
  const pad = size >= 60 ? 3 : size >= 30 ? 2.5 : size >= 20 ? 2 : 1.5
  const glow = `rgba(${fx.rgb},.5)`

  return (
    <div
      data-badge-hex
      style={{ position: 'relative', width: size, height: size, flex: '0 0 auto', ...style }}
    >
      {/* Ô hiệu ứng 96×104 bao quanh hình lục giác 76×84, tràn 10 đơn vị mỗi bên */}
      {(motion.pulse || motion.orbit || motion.sparkle) && (
        <div style={{ position: 'absolute', left: -6 * k, top: -10 * k, width: 96 * k, height: 104 * k, pointerEvents: 'none' }}>
          {motion.pulse && (
            <div
              style={{
                position: 'absolute',
                inset: 6 * k,
                borderRadius: 999,
                background: `radial-gradient(circle,${glow},transparent 70%)`,
                filter: `blur(${8 * k}px)`,
                animation: 'bhPulse 3.2s ease-in-out infinite',
              }}
            />
          )}
          {motion.orbit && (
            <div style={{ position: 'absolute', inset: 0, animation: 'badgeSpin 7s linear infinite' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: -k,
                  width: Math.max(3, 6 * k),
                  height: Math.max(3, 6 * k),
                  transform: 'translateX(-50%)',
                  borderRadius: 999,
                  background: fx.light,
                  boxShadow: `0 0 ${8 * k}px ${2 * k}px ${glow}`,
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: -k,
                  width: Math.max(2, 4 * k),
                  height: Math.max(2, 4 * k),
                  transform: 'translateX(-50%)',
                  borderRadius: 999,
                  background: fx.light,
                  boxShadow: `0 0 ${6 * k}px ${k}px ${glow}`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Hình lục giác: viền → lòng → glyph → vệt sáng quét */}
      <div
        style={{
          position: 'absolute',
          left: (size - hexW) / 2,
          top: 0,
          width: hexW,
          height: size,
          filter: isLocked ? undefined : `drop-shadow(0 0 ${10 * k}px ${glow})`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            clipPath: HEX_CLIP,
            overflow: 'hidden',
            background: isLocked ? `rgba(${fx.rgb},.35)` : `linear-gradient(160deg,${fx.light},${fx.acc} 55%,${fx.mid})`,
          }}
        >
          {motion.spin && fx.conic && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: '200%',
                height: '200%',
                margin: '-100% 0 0 -100%',
                background: `conic-gradient(${fx.conic})`,
                animation: 'badgeSpin 4s linear infinite',
              }}
            />
          )}
        </div>
        <div
          style={{
            position: 'absolute',
            inset: pad,
            clipPath: HEX_CLIP,
            background: isLocked ? '#0B0818' : fx.well,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {isLocked ? (
            <span style={{ font: `700 ${Math.round(size * 0.28)}px/1 var(--font-display)`, color: fx.acc }}>?</span>
          ) : (
            <span
              style={{
                width: 34 * k,
                height: 30 * k,
                clipPath: BADGE_GLYPHS[glyph] || BADGE_GLYPHS.crystal,
                background: `linear-gradient(180deg,${fx.light},${fx.acc})`,
              }}
            />
          )}
        </div>
        {motion.sheen && (
          <div
            style={{
              position: 'absolute',
              inset: pad,
              clipPath: HEX_CLIP,
              background: 'linear-gradient(115deg,transparent 40%,rgba(255,255,255,.45) 50%,transparent 60%)',
              backgroundSize: '250% 100%',
              animation: 'bhSheen 3.6s ease-in-out infinite',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>

      {/* Ba sao lấp lánh lệch nhịp ở rìa — nằm trên hình lục giác */}
      {motion.sparkle && (
        <div style={{ position: 'absolute', left: -6 * k, top: -10 * k, width: 96 * k, height: 104 * k, pointerEvents: 'none' }}>
          <span
            style={{
              position: 'absolute', left: 4 * k, top: 14 * k, width: 12 * k, height: 12 * k,
              clipPath: SPARK_CLIP, background: '#FFFFFF', opacity: 0,
              animation: 'bhSpark 2.8s ease-in-out infinite',
            }}
          />
          <span
            style={{
              position: 'absolute', right: 2 * k, top: 40 * k, width: 9 * k, height: 9 * k,
              clipPath: SPARK_CLIP, background: fx.light, opacity: 0,
              animation: 'bhSpark 2.8s ease-in-out .9s infinite',
            }}
          />
          <span
            style={{
              position: 'absolute', left: 16 * k, bottom: 6 * k, width: 8 * k, height: 8 * k,
              clipPath: SPARK_CLIP, background: '#FFFFFF', opacity: 0,
              animation: 'bhSpark 2.8s ease-in-out 1.7s infinite',
            }}
          />
        </div>
      )}
    </div>
  )
}
