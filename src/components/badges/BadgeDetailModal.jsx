import BadgeHex from './BadgeHex.jsx'
import { NOTCH_CLIP, NOTCH_S_CLIP, HEX_CLIP, ANIME_TIERS } from '#lib/badges.js'
import { t } from '#i18n'

/**
 * Màn A2 · Chi tiết một danh hiệu · điều kiện · chuỗi hiện tại · ai đã có · ai đang đuổi.
 * Thiết kế phong cách Anime với conic rays, floating hex badge, dot grid, notch clips.
 */
export default function BadgeDetailModal({
  badge,
  streakTimeline = [],
  owners = [],
  chasers = [],
  onClose,
  onShowUnlock,
}) {
  if (!badge) return null

  const meta = badge.tierMeta || ANIME_TIERS[badge.tier] || ANIME_TIERS.rare
  const isHidden = badge.tier === 'hidden' && !badge.unlocked
  const badgeName = t(`badges.items.${badge.id}.name`, { defaultValue: badge.name || '???' })
  const badgeCond = t(`badges.items.${badge.id}.cond`, { defaultValue: badge.cond || '' })

  const isWinStreak = badge.checkType === 'win_streak'
  const isHolding = isWinStreak ? Number(badge.currentVal) > 0 : badge.pct > 0

  const conditions = [
    {
      ok: badge.unlocked,
      text: badgeCond,
      val: badge.unlocked ? t('badges.detail.statusAchieved') : (badge.progressStr || `${badge.pct}%`),
    },
    {
      ok: true,
      text: t('badges.detail.condScoreLogged'),
      val: t('badges.detail.statusOk'),
    },
    {
      ok: badge.unlocked || isHolding,
      text: t('badges.detail.condNoLoss'),
      val: badge.unlocked
        ? t('badges.detail.statusAchieved')
        : isHolding
          ? t('badges.detail.statusHolding')
          : t('badges.detail.statusBroken'),
    },
    {
      ok: true,
      text: t('badges.detail.condSeason'),
      val: t('badges.seasonLabel'),
    },
  ]

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(5, 2, 12, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        overflowY: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose && onClose()
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 1080,
          background: '#07030F',
          border: '1px solid #2A1145',
          borderRadius: 14,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(109, 20, 255, 0.25)',
        }}
      >
        {/* Glow nền mờ 2 quầng radial gradient anime */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(60% 50% at 28% 8%, rgba(255,46,126,.2), transparent 70%), radial-gradient(56% 46% at 92% 90%, rgba(109,20,255,.22), transparent 72%)',
            pointerEvents: 'none',
          }}
        />
        {/* Lớp dot grid anime 9px x 9px */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px)',
            backgroundSize: '9px 9px',
            pointerEvents: 'none',
          }}
        />

        {/* 1. Header & Breadcrumb */}
        <div
          style={{
            padding: '14px 24px',
            borderBottom: '1px solid #2A1145',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            position: 'relative',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              font: '600 12px/1 Oswald, sans-serif',
              letterSpacing: '.14em',
              color: '#9C8ABE',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {t('badges.detail.back')}
          </button>
          <span style={{ font: "400 12px/1 'IBM Plex Mono', monospace", color: '#4E3F6B' }}>/</span>
          <span
            style={{
              font: '600 12px/1 Oswald, sans-serif',
              letterSpacing: '.14em',
              color: '#FFFFFF',
              textTransform: 'uppercase',
            }}
          >
            {isHidden ? '???' : badgeName}
          </span>
          <div style={{ flex: '1 1 0%' }} />
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'rgba(255,255,255,.06)',
              color: '#9C8ABE',
              cursor: 'pointer',
              padding: '6px 12px',
              clipPath: NOTCH_S_CLIP,
              font: '700 12px/1 Oswald, sans-serif',
            }}
          >
            {t('badges.closeBtn')}
          </button>
        </div>

        {/* 2. Grid Nội Dung Chính: 2 Cột chuẩn Figma/Anime */}
        <div
          style={{
            padding: '26px 24px',
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 400px) minmax(0, 1fr)',
            gap: 22,
            position: 'relative',
            alignContent: 'start',
          }}
        >
          {/* CỘT TRÁI: HUY HIỆU KHỔNG LỒ & TIẾN ĐỘ */}
          <div
            style={{
              position: 'relative',
              padding: 1,
              clipPath: NOTCH_CLIP,
              background: meta.edge || 'linear-gradient(135deg, #FF2E7E, #FFE24B 70%)',
            }}
          >
            <div
              style={{
                position: 'relative',
                overflow: 'hidden',
                clipPath: NOTCH_CLIP,
                background: meta.panel || 'linear-gradient(160deg,#2B0617,#110208)',
                padding: '30px 26px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 18,
                height: '100%',
              }}
            >
              {/* Conic ray spinning backdrop */}
              <div
                style={{
                  position: 'absolute',
                  top: '-28%',
                  left: '-22%',
                  width: 620,
                  height: 620,
                  background: `repeating-conic-gradient(from 0deg, ${meta.aura || 'rgba(255,46,126,.18)'} 0deg 4deg, transparent 4deg 13deg)`,
                  animation: 'aSpin 34s linear infinite',
                  pointerEvents: 'none',
                }}
              />

              {/* Huy hiệu lục giác lớn 180px bồng bềnh */}
              <BadgeHex
                tier={badge.tier}
                glyph={badge.glyph}
                size={180}
                float
                pulse
                spin={badge.tier === 'legend'}
                dim={isHidden}
              />

              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    font: '700 30px/1 Oswald, sans-serif',
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                    color: '#FFFFFF',
                    textAlign: 'center',
                    textShadow: `0 0 22px ${meta.aura || 'rgba(255,46,126,.6)'}`,
                  }}
                >
                  {isHidden ? '???' : badgeName}
                </span>

                <span
                  style={{
                    font: '700 10.5px/1 Oswald, sans-serif',
                    letterSpacing: '.2em',
                    padding: '6px 12px',
                    clipPath: NOTCH_S_CLIP,
                    background: meta.chipBg,
                    borderTop: `1px solid ${meta.bd || '#FF2E7E'}`,
                    color: meta.ink,
                  }}
                >
                  {meta.name} · {meta.pts} {t('badges.pointsLabel')}
                </span>

                <span
                  style={{
                    font: "400 13px/1.55 'Be Vietnam Pro', sans-serif",
                    textAlign: 'center',
                    color: '#C9B8E6',
                  }}
                >
                  {badgeCond}
                </span>
              </div>

              {/* Tiến độ cá nhân của bạn */}
              <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ font: '600 10.5px/1 Oswald, sans-serif', letterSpacing: '.16em', color: '#FFC46B' }}>
                    {t('badges.detail.yourProgress')}
                  </span>
                  <span style={{ font: '700 22px/1 Oswald, sans-serif', color: '#FFE24B' }}>
                    {badge.unlocked ? t('badges.detail.statusAchieved') : badge.progressStr || `${badge.pct}%`}
                  </span>
                </div>
                <div
                  style={{
                    height: 12,
                    clipPath: NOTCH_S_CLIP,
                    background: 'rgba(255,255,255,.1)',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${badge.pct}%`,
                      background: meta.edge || 'linear-gradient(90deg, #FF2E7E, #FFE24B)',
                    }}
                  />
                </div>
                <span style={{ font: "400 11.5px/1.4 'IBM Plex Mono', monospace", color: '#9C8ABE' }}>
                  {badge.unlocked
                    ? t('badges.detail.completedDesc')
                    : isWinStreak && Number(badge.currentVal) === 0
                      ? t('badges.detail.streakResetHint')
                      : isWinStreak && Number(badge.currentVal) > 0
                        ? t('badges.detail.remainingStreakHint', {
                            current: badge.currentVal,
                            remain: Math.max(1, (badge.threshold || 10) - Number(badge.currentVal)),
                          })
                        : t('badges.detail.remainingHint', {
                            remain: Math.max(1, (badge.threshold || 10) - (badge.currentVal || 0)),
                          })}
                </span>
                {badge.unlocked && onShowUnlock && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose && onClose()
                      onShowUnlock(badge)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '11px 14px',
                      background: 'linear-gradient(135deg, rgba(255,46,126,.25), rgba(255,226,75,.25))',
                      border: '1px solid #FFE24B',
                      clipPath: NOTCH_S_CLIP,
                      color: '#FFE24B',
                      font: '700 12px/1 Oswald, sans-serif',
                      letterSpacing: '.12em',
                      cursor: 'pointer',
                      marginTop: 10,
                      transition: 'filter 0.15s ease, transform 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.filter = 'brightness(1.2)'
                      e.currentTarget.style.transform = 'translateY(-1px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.filter = 'brightness(1)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    ✨ {t('badges.detail.viewUnlockFanfare')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: ĐIỀU KIỆN · CHUỖI · AI ĐÃ CÓ · AI ĐANG ĐUỔI */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 1. Checklist Điều kiện */}
            <div
              style={{
                padding: '17px 19px',
                clipPath: NOTCH_CLIP,
                background: 'rgba(255,255,255,.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: 13,
              }}
            >
              <div style={{ font: '700 14px/1 Oswald, sans-serif', letterSpacing: '.12em', color: '#FFFFFF' }}>
                {t('badges.detail.conditionsTitle')}
              </div>
              {conditions.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      flex: '0 0 auto',
                      clipPath: HEX_CLIP,
                      display: 'grid',
                      placeItems: 'center',
                      font: '700 12px/1 Oswald, sans-serif',
                      background: c.ok ? 'linear-gradient(135deg,#00776B,#2EE9C0)' : '#241640',
                      color: c.ok ? '#01130F' : '#9C8ABE',
                    }}
                  >
                    {c.ok ? '✓' : '·'}
                  </div>
                  <span style={{ flex: '1 1 0%', minWidth: 0, font: "400 13px/1.4 'Be Vietnam Pro', sans-serif", color: '#C9B8E6' }}>
                    {c.text}
                  </span>
                  <span style={{ flex: '0 0 auto', font: "600 12.5px/1 'IBM Plex Mono', monospace", color: c.ok ? '#5FEBD0' : '#C9B8E6' }}>
                    {c.val}
                  </span>
                </div>
              ))}
            </div>

            {/* 2. Chuỗi 10 ô W/L */}
            <div
              style={{
                padding: '17px 19px',
                clipPath: NOTCH_CLIP,
                background: 'rgba(255,255,255,.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ font: '700 14px/1 Oswald, sans-serif', letterSpacing: '.12em', color: '#FFFFFF' }}>
                  {t('badges.detail.currentStreakTitle')}
                </span>
                <span style={{ font: "400 11.5px/1 'IBM Plex Mono', monospace", color: '#9C8ABE' }}>
                  {t('badges.detail.streakHint')}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 7 }}>
                {streakTimeline.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      flex: '1 1 0%',
                      height: 44,
                      clipPath: NOTCH_S_CLIP,
                      display: 'grid',
                      placeItems: 'center',
                      font: '700 15px/1 Oswald, sans-serif',
                      background: s.won
                        ? 'linear-gradient(165deg,#FF2E7E,#7A0A2E)'
                        : 'rgba(255,255,255,.05)',
                      color: s.won ? '#FFFBEA' : '#6B5C8C',
                    }}
                  >
                    {s.label}
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Split: Ai đã có & Ai đang đuổi */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
              {/* Ai đã có */}
              <div
                style={{
                  padding: '17px 19px',
                  clipPath: NOTCH_CLIP,
                  background: 'rgba(255,255,255,.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ font: '700 14px/1 Oswald, sans-serif', letterSpacing: '.12em', color: '#FFFFFF' }}>
                  {t('badges.detail.ownersTitle', { count: owners.length })}
                </div>
                {owners.length === 0 ? (
                  <span style={{ font: "400 12px/1.4 'Be Vietnam Pro', sans-serif", color: '#7E6FA0' }}>
                    {t('badges.detail.noOwners')}
                  </span>
                ) : (
                  owners.map((o) => {
                    const noteText = o.checkType === 'win_streak'
                      ? t('badges.detail.ownersStreakNote', { streak: o.streak, season: t('badges.seasonLabel') })
                      : t('badges.detail.ownersCondNote', { val: o.streak || o.threshold || 1 })

                    return (
                      <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            flex: '0 0 auto',
                            clipPath: HEX_CLIP,
                            background: 'linear-gradient(135deg,#FF2E7E,#6D14FF)',
                            display: 'grid',
                            placeItems: 'center',
                            font: '700 14px/1 Oswald, sans-serif',
                            color: '#FFFBEA',
                            overflow: 'hidden',
                          }}
                        >
                          {o.avatarUrl ? (
                            <img src={o.avatarUrl} alt={o.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            o.initial
                          )}
                        </div>
                        <div style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ font: "600 13px/1.2 'Be Vietnam Pro', sans-serif", color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {o.name}
                          </span>
                          <span style={{ font: "400 11px/1.2 'IBM Plex Mono', monospace", color: '#7E6FA0' }}>
                            {noteText}
                          </span>
                        </div>
                        <span style={{ font: "600 11.5px/1 'IBM Plex Mono', monospace", color: '#9C8ABE' }}>
                          {o.at}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Ai đang đuổi */}
              <div
                style={{
                  padding: '17px 19px',
                  clipPath: NOTCH_CLIP,
                  background: 'rgba(255,255,255,.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ font: '700 14px/1 Oswald, sans-serif', letterSpacing: '.12em', color: '#FFFFFF' }}>
                  {t('badges.detail.chasersTitle')}
                </div>
                {chasers.length === 0 ? (
                  <span style={{ font: "400 12px/1.4 'Be Vietnam Pro', sans-serif", color: '#7E6FA0' }}>
                    {t('badges.detail.noChasers')}
                  </span>
                ) : (
                  chasers.map((c) => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 20, flex: '0 0 auto', font: "600 11.5px/1 'IBM Plex Mono', monospace", color: '#7E6FA0' }}>
                        {c.rank}
                      </span>
                      <span
                        style={{
                          flex: '1 1 0%',
                          minWidth: 0,
                          font: `${c.isMe ? 700 : 500} 12.5px/1 'Be Vietnam Pro', sans-serif`,
                          color: c.isMe ? '#FFE24B' : '#C9B8E6',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {c.isMe ? t('badges.detail.you') : c.name}
                      </span>
                      <div
                        style={{
                          flex: '2 1 0%',
                          height: 7,
                          clipPath: NOTCH_S_CLIP,
                          background: 'rgba(255,255,255,.08)',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${c.pct}%`,
                            background: c.isMe ? 'linear-gradient(90deg,#FF2E7E,#FFE24B)' : 'linear-gradient(90deg,#6D14FF,#C04BFF)',
                          }}
                        />
                      </div>
                      <span style={{ width: 22, flex: '0 0 auto', textAlign: 'right', font: "600 12px/1 'IBM Plex Mono', monospace", color: '#C9B8E6' }}>
                        {c.val}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
