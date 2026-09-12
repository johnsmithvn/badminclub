import React from 'react'
import { t } from '#i18n'
import BadgeHex from './BadgeHex.jsx'
import { ANIME_TIERS, NOTCH_S_CLIP } from '#lib/badges.js'
import { useMobile } from '#hooks/useMobile.js'

/**
 * Màn A4 (Desktop) & AM4 (Mobile): Fanfare Modal Mở khóa Danh hiệu.
 * Hiển thị hiệu ứng anime rực rỡ (speed lines, tia conic quay, badge lấp lánh,
 * các mốc thưởng +XP, +Điểm mùa, +Elo và nút thao tác gắn lên kệ ngay).
 */
export default function BadgeUnlockModal({
  badge,
  onClose,
  onEquipShelf,
  onViewCollection,
  shelfCount = 3,
  shelfIsFull = true,
}) {
  const isMobile = useMobile(640)

  if (!badge) return null

  const tier = badge.tier || 'epic'
  const tTier = ANIME_TIERS[tier] || ANIME_TIERS.epic
  const glyph = badge.glyph || 'flame'
  const pts = tTier.pts || badge.points || 60

  // Thưởng mặc định theo bậc nếu không khai báo cụ thể
  const defaultRewards = {
    common: { xp: 20, sp: 5, elo: 5 },
    rare: { xp: 50, sp: 10, elo: 10 },
    epic: { xp: 100, sp: 15, elo: 18 },
    legendary: { xp: 200, sp: 25, elo: 25 },
    mythic: { xp: 500, sp: 50, elo: 35 },
    fun: { xp: 10, sp: 2, elo: 0 },
  }[tier] || { xp: 100, sp: 15, elo: 18 }

  const xpReward = badge.xp ?? defaultRewards.xp
  const spReward = badge.seasonPoints ?? badge.sp ?? defaultRewards.sp
  const eloReward = badge.elo ?? defaultRewards.elo

  const badgeSize = isMobile ? 150 : 190

  // Chú thích kệ: nếu đã đầy 3 ô thì báo thay ô cuối, nếu còn trống thì báo còn bao nhiêu ô
  const shelfNote = shelfIsFull
    ? t('badges.unlockModal.shelfReplaceNote')
    : t('badges.unlockModal.shelfAvailableNote', { count: Math.max(1, 3 - shelfCount) })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={badge.name || t('badges.unlockModal.title')}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'rgba(4,2,10,.86)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        padding: isMobile ? '16px' : '24px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose && onClose()
      }}
    >
      {/* ═══ Hiệu ứng Anime Background ═══ */}
      {/* 1. Gradient tím phát xạ */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(60% 50% at 50% 42%, rgba(109,20,255,.32), transparent 72%)',
          pointerEvents: 'none',
        }}
      />
      {/* 2. Grid chấm */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px)',
          backgroundSize: '9px 9px',
          pointerEvents: 'none',
        }}
      />
      {/* 3. Speed lines anime */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'repeating-linear-gradient(96deg, rgba(255,255,255,.06) 0 2px, transparent 2px 12px)',
          animation: 'aSpeed 1.4s linear infinite',
          pointerEvents: 'none',
        }}
      />
      {/* 4. Conic rays xoay 40s */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: isMobile ? 760 : 1100,
          height: isMobile ? 760 : 1100,
          margin: isMobile ? '-380px 0 0 -380px' : '-550px 0 0 -550px',
          background: 'repeating-conic-gradient(from 0deg, rgba(255,226,75,.14) 0deg 3deg, transparent 3deg 12deg)',
          animation: 'aSpin 40s linear infinite',
          pointerEvents: 'none',
        }}
      />

      {/* ═══ Khung Modal Trung Tâm (Notch clip viền gradient) ═══ */}
      <div
        style={{
          position: 'relative',
          width: isMobile ? 390 : 660,
          maxWidth: 'calc(100vw - 24px)',
          maxHeight: 'calc(100vh - 32px)',
          padding: 1,
          clipPath: 'polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)',
          background: 'linear-gradient(135deg, #FF2E7E, #FFE24B 50%, #6D14FF)',
          boxShadow: '0 0 60px rgba(109,20,255,.5), 0 0 100px rgba(255,46,126,.3)',
          animation: 'aFloat 7s ease-in-out infinite',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            clipPath: 'polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)',
            background: 'linear-gradient(170deg, #2B0617, #12021C 70%)',
            padding: isMobile ? '28px 20px 22px' : '38px 40px 30px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: isMobile ? 14 : 18,
          }}
        >
          {/* Vệt sáng quét ngang qua hộp */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 160,
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.14), transparent)',
              animation: 'aSweep 4.5s ease-in-out infinite',
              pointerEvents: 'none',
            }}
          />

          {/* Nút đóng góc phải */}
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 12,
              right: 14,
              background: 'transparent',
              border: 'none',
              color: '#9C8ABE',
              fontSize: 22,
              lineHeight: 1,
              cursor: 'pointer',
              padding: 6,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.15s ease, transform 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#FFFFFF'
              e.currentTarget.style.transform = 'scale(1.15)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#9C8ABE'
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            ✕
          </button>

          {/* Subtitle Mở khóa danh hiệu */}
          <span
            style={{
              position: 'relative',
              font: `700 ${isMobile ? '10px' : '12px'}/1 Oswald, sans-serif`,
              letterSpacing: isMobile ? '.24em' : '.28em',
              color: '#FFE24B',
              textTransform: 'uppercase',
            }}
          >
            {t('badges.unlockModal.title')}
          </span>

          {/* Huy hiệu Fanfare to với spinning conic phụ trợ */}
          <div style={{ position: 'relative', margin: isMobile ? '4px 0' : '6px 0' }}>
            <div
              style={{
                position: 'absolute',
                inset: '-32%',
                background: 'repeating-conic-gradient(from 0deg, rgba(255,46,126,.3) 0deg 5deg, transparent 5deg 15deg)',
                animation: 'aSpinBack 18s linear infinite',
                pointerEvents: 'none',
              }}
            />
            <BadgeHex
              tier={tier}
              glyph={glyph}
              size={badgeSize}
              spin={true}
              twinkle={true}
              pulse={true}
            />
          </div>

          {/* Tên danh hiệu + Tag bậc + Mô tả */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: isMobile ? 8 : 10,
              width: '100%',
            }}
          >
            <span
              style={{
                font: `700 ${isMobile ? '28px' : '38px'}/1.1 Oswald, sans-serif`,
                letterSpacing: '.03em',
                textTransform: 'uppercase',
                color: '#FFFFFF',
                textAlign: 'center',
                textShadow: `0 3px 0 #4A0A5A, 0 0 32px ${tTier.aura || 'rgba(192,75,255,.7)'}`,
              }}
            >
              {badge.name}
            </span>

            <span
              style={{
                font: `700 ${isMobile ? '9.5px' : '11px'}/1 Oswald, sans-serif`,
                letterSpacing: '.18em',
                padding: isMobile ? '5px 10px' : '6px 14px',
                clipPath: NOTCH_S_CLIP,
                background: tTier.tagBg || 'rgba(139,43,255,.2)',
                borderTop: `1px solid ${tTier.tagBd || '#8B2BFF'}`,
                color: tTier.tagColor || '#D9A8FF',
                textTransform: 'uppercase',
              }}
            >
              {tTier.name} · {pts} {t('badges.unlockModal.ptsUnit')}
            </span>

            <span
              style={{
                font: `400 ${isMobile ? '13px' : '14px'}/1.55 'Be Vietnam Pro', sans-serif`,
                textAlign: 'center',
                color: '#C9B8E6',
                maxWidth: 480,
                padding: '0 8px',
              }}
            >
              {badge.story || badge.desc || badge.cond || t('badges.unlockModal.congratsDesc')}
            </span>
          </div>

          {/* 3 Thỏi thưởng: +XP, +Điểm mùa, ELO + */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              gap: isMobile ? 8 : 11,
              width: '100%',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                flex: 1,
                textAlign: 'center',
                font: `700 ${isMobile ? '14px' : '17px'}/1 Oswald, sans-serif`,
                letterSpacing: '.04em',
                color: '#FFC46B',
                background: 'rgba(20,1,9,.6)',
                borderTop: '1px solid #FF7A18',
                padding: isMobile ? '10px 4px' : '12px 18px',
                clipPath: NOTCH_S_CLIP,
              }}
            >
              +{xpReward} XP
            </span>
            <span
              style={{
                flex: 1,
                textAlign: 'center',
                font: `700 ${isMobile ? '14px' : '17px'}/1 Oswald, sans-serif`,
                letterSpacing: '.04em',
                color: '#5FEBD0',
                background: 'rgba(1,19,15,.6)',
                borderTop: '1px solid #0E9F8E',
                padding: isMobile ? '10px 4px' : '12px 18px',
                clipPath: NOTCH_S_CLIP,
              }}
            >
              +{spReward} {t('badges.unlockModal.seasonPointsUnit')}
            </span>
            <span
              style={{
                flex: 1,
                textAlign: 'center',
                font: `700 ${isMobile ? '14px' : '17px'}/1 Oswald, sans-serif`,
                letterSpacing: '.04em',
                color: '#7FE7FF',
                background: 'rgba(1,16,31,.6)',
                borderTop: '1px solid #1B7BE0',
                padding: isMobile ? '10px 4px' : '12px 18px',
                clipPath: NOTCH_S_CLIP,
              }}
            >
              ELO +{eloReward}
            </span>
          </div>

          {/* Các nút hành động (AM4: column dọc, A4: row ngang) */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: isMobile ? 8 : 12,
              marginTop: 4,
            }}
          >
            <button
              type="button"
              onClick={() => onEquipShelf && onEquipShelf(badge)}
              style={{
                flex: 1,
                textAlign: 'center',
                font: `700 ${isMobile ? '12.5px' : '13px'}/1 Oswald, sans-serif`,
                letterSpacing: '.14em',
                color: '#140109',
                background: 'linear-gradient(135deg, #FFE24B, #FF7A18)',
                padding: isMobile ? '13px 14px' : '15px 16px',
                clipPath: NOTCH_S_CLIP,
                border: 'none',
                cursor: 'pointer',
                transition: 'filter 0.15s ease, transform 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = 'brightness(1.15)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'brightness(1)'
              }}
            >
              {t('badges.unlockModal.equipShelfBtn')}
            </button>

            <button
              type="button"
              onClick={() => {
                if (onViewCollection) onViewCollection(badge)
                else if (onClose) onClose()
              }}
              style={{
                flex: 1,
                textAlign: 'center',
                font: `700 ${isMobile ? '12.5px' : '13px'}/1 Oswald, sans-serif`,
                letterSpacing: '.14em',
                color: '#D9A8FF',
                background: 'rgba(255,255,255,.06)',
                borderTop: '1px solid #8B2BFF',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                padding: isMobile ? '13px 14px' : '15px 16px',
                clipPath: NOTCH_S_CLIP,
                cursor: 'pointer',
                transition: 'filter 0.15s ease, background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = 'brightness(1.2)'
                e.currentTarget.style.background = 'rgba(255,255,255,.12)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'brightness(1)'
                e.currentTarget.style.background = 'rgba(255,255,255,.06)'
              }}
            >
              {t('badges.unlockModal.viewCollectionBtn')}
            </button>
          </div>

          {/* Ghi chú trạng thái kệ 3 ô */}
          <span
            style={{
              position: 'relative',
              font: `400 ${isMobile ? '10.5px' : '11.5px'}/1.4 'IBM Plex Mono', monospace`,
              color: '#7E6FA0',
              textAlign: 'center',
            }}
          >
            {shelfNote}
          </span>
        </div>
      </div>
    </div>
  )
}
