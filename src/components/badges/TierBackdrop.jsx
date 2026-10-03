import { TIER_FX } from './tierFx.js'

// Vị trí (left %) và bề rộng (px) bốn dải cực quang, theo đúng bản thiết kế.
const CURTAIN_POS = [[18, 90], [40, 120], [64, 100], [86, 80]]

// Bụi sao rải tất định — cùng công thức với bản thiết kế, không random để khỏi nhảy mỗi lần render.
const makeDust = (count, spreadY) => Array.from({ length: count }, (_, i) => ({
  x: `${(i * 83) % 97}%`,
  y: `${(i * 47) % spreadY}%`,
  size: 1 + (i % 3),
  glow: 2 + (i % 3) * 3,
  twinkle: 3 + (i % 5),
  drift: 5 + (i % 4) * 2,
  delay: (i % 7) * 0.4,
}))
const DUST_HERO = makeDust(24, 48)
const DUST_CARD = makeDust(16, 40)

const SHOOTING_STARS = [
  { w: 90, dur: 7, delay: 1 },
  { w: 70, dur: 9, delay: 4.5 },
]

/**
 * Nền hiệu ứng theo bậc: bụi sao + chùm sáng hoặc cực quang (xem `effect` trong tierFx.js).
 * Phủ kín thẻ cha — thẻ cha phải `position: relative` và `overflow: hidden`.
 *
 * - Mặc định: thẻ huy hiệu lớn trong BadgeDetailModal — thêm sao băng, chùm sáng chiếu giữa.
 * - `compact`: thẻ hồ sơ ở màn Bộ sưu tập — ít bụi hơn, chùm sáng lệch trái chiếu xuống
 *   avatar, cực quang thấp hơn để chữ và chỉ số nửa dưới nằm trên nền tối.
 */
export default function TierBackdrop({ tier, compact = false }) {
  const fx = TIER_FX[tier] || TIER_FX.rare
  const rgba = (a) => `rgba(${fx.rgb},${a})`
  const dust = compact ? DUST_CARD : DUST_HERO
  const beam = compact
    ? { left: '30%', width: 240, height: 210 }
    : { left: '50%', width: 270, height: 300 }

  return (
    <div data-badge-fx style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {dust.map((s, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
            borderRadius: 999,
            background: '#FFFFFF',
            opacity: 0.3,
            boxShadow: `0 0 ${s.glow}px rgba(255,255,255,.8)`,
            animation: `bdTwinkle ${s.twinkle}s ease-in-out ${s.delay}s infinite, bdDrift ${s.drift}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}

      {!compact && SHOOTING_STARS.map((s, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: s.w,
            height: 1.5,
            background: 'linear-gradient(90deg,transparent,#FFFFFF)',
            transform: 'rotate(28deg)',
            opacity: 0,
            animation: `bdShoot ${s.dur}s ease-in ${s.delay}s infinite`,
          }}
        />
      ))}

      {fx.effect === 'beam' && (
        <>
          <div
            style={{
              position: 'absolute',
              left: beam.left,
              top: 0,
              width: beam.width,
              height: beam.height,
              marginLeft: -beam.width / 2,
              background: `linear-gradient(180deg,${rgba(0.3)},${rgba(0.08)} 72%,transparent)`,
              clipPath: 'polygon(40% 0,60% 0,100% 100%,0 100%)',
              animation: 'bdBeam 6s ease-in-out infinite',
            }}
          />
          {!compact && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: 120,
                width: 230,
                height: 70,
                marginLeft: -115,
                background: `radial-gradient(50% 50% at 50% 50%,${rgba(0.3)},transparent 70%)`,
              }}
            />
          )}
        </>
      )}

      {fx.effect === 'aurora' && (
        <>
          {fx.curtains.map(([c1, c2], i) => {
            const [left, w] = CURTAIN_POS[i]
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${left}%`,
                  top: -40,
                  width: w,
                  height: compact ? 260 : 400,
                  marginLeft: -w / 2,
                  background: `linear-gradient(180deg,transparent,rgba(${c1},.5) 30%,rgba(${c2},.45) 62%,transparent)`,
                  filter: `blur(${compact ? 20 : 22}px)`,
                  transformOrigin: 'top',
                  mixBlendMode: 'screen',
                  animation: `bdSway ${9 + i * 1.5}s ease-in-out ${-i * 2}s infinite`,
                }}
              />
            )
          })}
          {!compact && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 230,
                height: 140,
                background: 'linear-gradient(180deg,transparent,#06080C)',
              }}
            />
          )}
        </>
      )}
    </div>
  )
}
