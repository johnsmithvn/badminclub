import BadgeHex from './BadgeHex.jsx'
import { NOTCH_CLIP, NOTCH_S_CLIP } from '#lib/badges.js'
import { t } from '#i18n'

/**
 * Poster truy nã Hero banner ở đầu màn A1.
 */
export default function BountyHeroPoster({ bounty, onChallenge }) {
  if (!bounty) {
    return (
      <div
        style={{
          position: 'relative',
          padding: 1,
          clipPath: NOTCH_CLIP,
          background: 'linear-gradient(120deg, #6D14FF, #2EE9FF 70%)',
        }}
      >
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            clipPath: NOTCH_CLIP,
            background: 'linear-gradient(110deg, #100620 0%, #1A0B35 100%)',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <BadgeHex tier="elite" glyph="shuriken" size={68} />
          <div style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: '700 11px/1 Oswald, sans-serif', letterSpacing: '.18em', color: '#7FE7FF' }}>
              {t('badges.wantedTag')} · {t('badges.bountyBoard.seasonTag')}
            </span>
            <div style={{ font: '700 22px/1.2 Oswald, sans-serif', color: '#FFFFFF' }}>
              {t('badges.noBountyHeadline')}
            </div>
            <div style={{ font: "400 13px/1.4 'Be Vietnam Pro', sans-serif", color: '#C9B8E6' }}>
              {t('badges.noBountyDesc')}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const streak = bounty.streak || 5
  const pct = Math.min(100, Math.round((streak / 10) * 100))

  return (
    <div
      style={{
        position: 'relative',
        padding: 1,
        clipPath: NOTCH_CLIP,
        background: 'linear-gradient(120deg, #FF2E7E, #FFE24B 55%, #6D14FF)',
      }}
    >
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          clipPath: NOTCH_CLIP,
          background: 'linear-gradient(110deg, #1A0310 0%, #2B0617 42%, #3D0722 68%, #17022B 100%)',
          padding: '22px 26px',
        }}
      >
        {/* Vòng xoay tia sáng background */}
        <div
          style={{
            position: 'absolute',
            top: '-120%',
            right: '-6%',
            width: 620,
            height: 620,
            background: 'repeating-conic-gradient(from 0deg, rgba(255,226,75,.16) 0deg 4deg, transparent 4deg 13deg)',
            animation: 'aSpin 30s linear infinite',
            pointerEvents: 'none',
          }}
        />

        {/* Speed lines chạy liên tục */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'repeating-linear-gradient(100deg, rgba(255,255,255,.07) 0 2px, transparent 2px 10px)',
            animation: 'aSpeed 1.6s linear infinite',
            opacity: 0.5,
            pointerEvents: 'none',
          }}
        />

        {/* Vệt sáng quét ngang sweep */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 130,
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.16), transparent)',
            animation: 'aSweep 6s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          {/* Cụm avatar huy hiệu truy nã lớn bên trái */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}>
            <BadgeHex
              tier="legend"
              glyph="flame"
              size={104}
              spin
              pulse
            />
            <span
              style={{
                font: '700 11px/1 Oswald, sans-serif',
                letterSpacing: '.2em',
                color: '#FFC46B',
              }}
            >
              {t('badges.wantedTag')}
            </span>
          </div>

          {/* Cụm thông tin tiêu đề và chuỗi ở giữa */}
          <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span
                style={{
                  font: '700 11px/1 Oswald, sans-serif',
                  letterSpacing: '.18em',
                  color: '#140109',
                  background: 'linear-gradient(135deg, #FFE24B, #FF7A18)',
                  padding: '6px 11px',
                  clipPath: NOTCH_S_CLIP,
                }}
              >
                {t('badges.bountyActive')}
              </span>
              <span style={{ font: "400 12px/1 'IBM Plex Mono', monospace", color: '#FFC9A0' }}>
                {t('badges.bountyOpenedMeta', { time: t('badges.seasonLabel'), tries: bounty.tries || 2 })}
              </span>
            </div>

            <div
              style={{
                font: '700 30px/1.12 Oswald, sans-serif',
                letterSpacing: '.01em',
                textTransform: 'uppercase',
                color: '#FFFFFF',
                textShadow: '0 2px 0 #7A0A2E, 0 0 30px rgba(255,46,126,.55)',
              }}
            >
              {t('badges.bountyHeadline', { name: bounty.name, streak })}
            </div>

            {/* Thanh tiến độ chuỗi */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ font: '600 10.5px/1 Oswald, sans-serif', letterSpacing: '.16em', color: '#FFC46B' }}>
                {t('badges.streak')}
              </span>
              <div
                style={{
                  flex: '1 1 auto',
                  maxWidth: 420,
                  height: 10,
                  clipPath: NOTCH_S_CLIP,
                  background: 'rgba(255,255,255,.1)',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: 'linear-gradient(90deg, #FF2E7E, #FFE24B)',
                  }}
                />
              </div>
              <span style={{ font: "600 13px/1 'IBM Plex Mono', monospace", color: '#FFE24B' }}>
                {streak} / 10
              </span>
            </div>

            <div style={{ font: "400 13px/1.5 'Be Vietnam Pro', sans-serif", color: '#E6CFDE' }}>
              {t('badges.bountyNotice')}
            </div>
          </div>

          {/* Cụm phần thưởng và nút GẠ KÈO bên phải */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              alignItems: 'stretch',
              width: 228,
            }}
          >
            <div style={{ display: 'flex', gap: 9 }}>
              <span
                style={{
                  flex: '1 1 0%',
                  textAlign: 'center',
                  font: '700 15px/1 Oswald, sans-serif',
                  letterSpacing: '.06em',
                  color: '#FFC46B',
                  background: 'rgba(20,1,9,.6)',
                  borderTop: '1px solid #FF7A18',
                  padding: '11px 8px',
                  clipPath: NOTCH_S_CLIP,
                }}
              >
                +{bounty.xp || 100} XP
              </span>
              <span
                style={{
                  flex: '1 1 0%',
                  textAlign: 'center',
                  font: '700 15px/1 Oswald, sans-serif',
                  letterSpacing: '.06em',
                  color: '#5FEBD0',
                  background: 'rgba(1,19,15,.6)',
                  borderTop: '1px solid #0E9F8E',
                  padding: '11px 8px',
                  clipPath: NOTCH_S_CLIP,
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
                cursor: 'pointer',
                textAlign: 'center',
                font: '700 14px/1 Oswald, sans-serif',
                letterSpacing: '.14em',
                color: '#140109',
                background: 'linear-gradient(135deg, #FFE24B, #FF7A18)',
                padding: '15px 16px',
                clipPath: NOTCH_S_CLIP,
                transition: 'filter 0.15s ease, transform 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = 'brightness(1.1)'
                e.currentTarget.style.transform = 'scale(1.02)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'none'
                e.currentTarget.style.transform = 'none'
              }}
            >
              {t('badges.challengeNow')}
            </button>

            <span
              style={{
                textAlign: 'center',
                font: "400 11px/1.4 'IBM Plex Mono', monospace",
                color: '#9C8ABE',
              }}
            >
              {t('badges.streakMoreBountyHint')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
