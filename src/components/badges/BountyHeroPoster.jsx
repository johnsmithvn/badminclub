import { Avatar } from '#ds'
import BadgeHex from './BadgeHex.jsx'
import TierBackdrop from './TierBackdrop.jsx'
import { TIER_FX } from './tierFx.js'
import { HEX_CLIP } from '#lib/badges.js'
import { t } from '#i18n'
import { useMobile } from '#hooks/useMobile.js'

const GOLD = '#F6C945'

const CARD = {
  position: 'relative',
  borderRadius: 16,
  overflow: 'hidden',
  background: '#080615',
}

/**
 * Poster truy nã Hero banner ở đầu màn A1.
 * Cùng hệ hiệu ứng với thẻ hồ sơ: nền cực quang theo bậc truy nã (getActiveBounties gán
 * Huyền thoại khi chuỗi đang nóng, Sử thi khi thường), chữ và chỉ số nằm trên nền tối.
 * Dùng ở đầu màn Bộ sưu tập cả desktop lẫn mobile — trang Truy nã riêng đã bỏ.
 * Điện thoại: avatar nhỏ đứng cạnh tiêu đề, cụm thưởng + nút trải hết chiều ngang.
 */
export default function BountyHeroPoster({ bounty, onChallenge }) {
  const isMobile = useMobile(768)

  if (!bounty) {
    return (
      <div
        style={{
          ...CARD,
          border: '1px solid #221A3A',
          background: 'linear-gradient(150deg,rgba(255,255,255,.045),rgba(255,255,255,.015)), #080615',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <BadgeHex tier="elite" glyph="shuriken" size={68} />
        <div style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ font: "700 11px/1 'Oswald', sans-serif", letterSpacing: '.18em', color: '#7CC0FF' }}>
            {t('badges.wantedTag')} · {t('badges.bountyBoard.seasonTag')}
          </span>
          <div style={{ font: "700 22px/1.2 'Oswald', sans-serif", color: '#FFFFFF' }}>
            {t('badges.noBountyHeadline')}
          </div>
          <div style={{ font: '400 13px/1.4 var(--font-sans)', color: '#C9BFDC' }}>
            {t('badges.noBountyDesc')}
          </div>
        </div>
      </div>
    )
  }

  const tier = bounty.tier || 'legend'
  const fx = TIER_FX[tier] || TIER_FX.legend
  const rgba = (a) => `rgba(${fx.rgb},${a})`
  const streak = bounty.streak || 5
  const pct = Math.min(100, Math.round((streak / 10) * 100))

  return (
    <div style={{ ...CARD, border: `1px solid ${rgba(0.55)}` }}>
      <TierBackdrop tier={tier} compact />

      <div
        style={{
          position: 'relative',
          padding: isMobile ? 16 : '22px 26px',
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? 14 : 24,
          flexWrap: 'wrap',
          // Nền tối dần sang phải để tiêu đề và chỉ số không chìm vào cực quang
          background: isMobile
            ? 'linear-gradient(180deg,transparent,rgba(6,4,16,.82) 45%)'
            : 'linear-gradient(90deg,transparent,rgba(6,4,16,.78) 45%)',
        }}
      >
        {/* Cụm avatar người bị truy nã bên trái */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              position: 'relative',
              width: isMobile ? 66 : 96,
              height: isMobile ? 72 : 106,
              filter: `drop-shadow(0 0 18px ${rgba(0.5)})`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                clipPath: HEX_CLIP,
                background: `linear-gradient(160deg,${fx.light},${fx.acc} 55%,${fx.mid})`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 3,
                clipPath: HEX_CLIP,
                background: fx.well,
                display: 'grid',
                placeItems: 'center',
                overflow: 'hidden',
              }}
            >
              <Avatar name={bounty.name} src={bounty.avatarUrl} size={isMobile ? 62 : 92} />
            </div>
          </div>
          <span style={{ font: "700 11px/1 'Oswald', sans-serif", letterSpacing: '.2em', color: fx.acc }}>
            {t('badges.wantedTag')}
          </span>
        </div>

        {/* Cụm thông tin tiêu đề và chuỗi ở giữa */}
        <div style={{ flex: isMobile ? '1 1 0%' : '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span
              style={{
                font: "700 11px/1 'Oswald', sans-serif",
                letterSpacing: '.18em',
                color: '#1A0F00',
                background: 'linear-gradient(90deg,#F6C945,#FF9A3D)',
                padding: '6px 11px',
                borderRadius: 4,
              }}
            >
              {t('badges.bountyActive')}
            </span>

          </div>

          <div
            style={{
              font: `700 ${isMobile ? 20 : 30}px/1.12 'Oswald', sans-serif`,
              letterSpacing: '.01em',
              textTransform: 'uppercase',
              color: '#FFFFFF',
              textShadow: `0 0 26px ${rgba(0.5)}`,
            }}
          >
            {t('badges.bountyHeadline', { name: bounty.name, streak })}
          </div>

          {/* Thanh tiến độ chuỗi */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ font: "700 11px/1 'Oswald', sans-serif", letterSpacing: '.16em', color: fx.acc }}>
              {t('badges.streak')}
            </span>
            <div
              style={{
                flex: '1 1 auto',
                maxWidth: 420,
                height: 8,
                borderRadius: 999,
                background: 'rgba(255,255,255,.1)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: `linear-gradient(90deg,${fx.mid},${fx.acc})`,
                }}
              />
            </div>
            <span style={{ font: '600 13px/1 var(--font-mono)', color: GOLD }}>{streak} / 10</span>
          </div>


        </div>

        {/* Cụm phần thưởng và nút GẠ KÈO bên phải */}
        <div style={{ width: isMobile ? '100%' : 228, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <span
              style={{
                flex: '1 1 0%',
                textAlign: 'center',
                font: '700 15px/1 var(--font-display)',
                padding: '11px 8px',
                borderRadius: 8,
                background: 'rgba(246,201,69,.12)',
                border: '1px solid rgba(246,201,69,.4)',
                color: GOLD,
              }}
            >
              +{bounty.xp || 100} XP
            </span>
            <span
              style={{
                flex: '1 1 0%',
                textAlign: 'center',
                font: '700 15px/1 var(--font-display)',
                padding: '11px 8px',
                borderRadius: 8,
                background: rgba(0.12),
                border: `1px solid ${rgba(0.45)}`,
                color: fx.acc,
              }}
            >
              +{bounty.sp || 15} SP
            </span>
          </div>

          <button
            type="button"
            onClick={() => onChallenge && onChallenge(bounty)}
            style={{
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
              textAlign: 'center',
              font: "700 14px/1 'Oswald', sans-serif",
              letterSpacing: '.14em',
              color: '#1A0F00',
              background: 'linear-gradient(90deg,#F6C945,#FF9A3D)',
              padding: '15px 16px',
              transition: 'filter 140ms cubic-bezier(.2,.8,.2,1)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.12)' }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = 'none' }}
          >
            {t('badges.challengeNow')}
          </button>


        </div>
      </div>
    </div>
  )
}
