import React from 'react'
import { t } from '#i18n'
import BadgeHex from './BadgeHex.jsx'
import { ANIME_TIERS, NOTCH_S_CLIP } from '#lib/badges.js'

/**
 * Màn A4: Fanfare Modal Mở khóa Danh hiệu.
 * Hiển thị hiệu ứng anime rực rỡ (speed lines, tia conic quay, badge 190px lấp lánh,
 * các mốc thưởng +XP, +Điểm mùa, +Elo và nút thao tác gắn lên kệ ngay).
 */
export default function BadgeUnlockModal({
  badge,
  onClose,
  onEquipShelf,
  onViewCollection,
  shelfIsFull = true,
}) {

  if (!badge) return null

  const tier = badge.tier || 'epic'
  const tTier = ANIME_TIERS[tier] || ANIME_TIERS.epic
  const glyph = badge.glyph || 'flame'
  const pts = tTier.pts || 60

  const xpReward = badge.xp || 100
  const spReward = badge.seasonPoints || 15
  const eloReward = badge.elo || 18

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'rgba(4,2,10,.82)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
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
      {/* 3. Speed lines */}
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
          width: 1100,
          height: 1100,
          margin: '-550px 0 0 -550px',
          background: 'repeating-conic-gradient(from 0deg, rgba(255,226,75,.14) 0deg 3deg, transparent 3deg 12deg)',
          animation: 'aSpin 40s linear infinite',
          pointerEvents: 'none',
        }}
      />

      {/* ═══ Khung Modal Trung Tâm ═══ */}
      <div
        style={{
          position: 'relative',
          width: 660,
          maxWidth: 'calc(100vw - 32px)',
          padding: 1,
          clipPath: 'polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)',
          background: 'linear-gradient(135deg, #FF2E7E, #FFE24B 50%, #6D14FF)',
          boxShadow: '0 0 60px rgba(109,20,255,.5), 0 0 100px rgba(255,46,126,.3)',
          animation: 'aFloat 7s ease-in-out infinite',
        }}
      >
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            clipPath: 'polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)',
            background: 'linear-gradient(170deg, #2B0617, #12021C 70%)',
            padding: '38px 36px 30px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 18,
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
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 14,
              right: 18,
              background: 'transparent',
              border: 'none',
              color: '#9C8ABE',
              fontSize: 22,
              lineHeight: 1,
              cursor: 'pointer',
              padding: 6,
              zIndex: 2,
            }}
          >
            ✕
          </button>

          {/* Subtitle mừng rỡ */}
          <span
            style={{
              position: 'relative',
              font: '700 12px/1 Oswald, sans-serif',
              letterSpacing: '.28em',
              color: '#FFE24B',
              textTransform: 'uppercase',
            }}
          >
            {t('badges.unlockModal.title')}
          </span>

          {/* Huy hiệu 190px Fanfare với 3 ngôi sao twinkle lấp lánh */}
          <div style={{ position: 'relative', margin: '6px 0' }}>
            {/* Spinning conic phụ trợ */}
            <div
              style={{
                position: 'absolute',
                inset: '-34%',
                background: 'repeating-conic-gradient(from 0deg, rgba(255,46,126,.3) 0deg 5deg, transparent 5deg 15deg)',
                animation: 'aSpinBack 18s linear infinite',
                pointerEvents: 'none',
              }}
            />
            <BadgeHex
              tier={tier}
              glyph={glyph}
              size={190}
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
              gap: 10,
            }}
          >
            <span
              style={{
                font: '700 38px/1.1 Oswald, sans-serif',
                letterSpacing: '.03em',
                textTransform: 'uppercase',
                color: '#FFFFFF',
                textAlign: 'center',
                textShadow: `0 3px 0 #4A0A5A, 0 0 34px ${tTier.aura || 'rgba(192,75,255,.7)'}`,
              }}
            >
              {badge.name}
            </span>

            <span
              style={{
                font: '700 11px/1 Oswald, sans-serif',
                letterSpacing: '.2em',
                padding: '6px 14px',
                clipPath: NOTCH_S_CLIP,
                background: tTier.tagBg || 'rgba(139,43,255,.2)',
                borderTop: `1px solid ${tTier.tagBd || '#8B2BFF'}`,
                color: tTier.tagColor || '#D9A8FF',
                textTransform: 'uppercase',
              }}
            >
              {tTier.name} · {pts}
            </span>

            <span
              style={{
                font: "400 14px/1.55 'Be Vietnam Pro', sans-serif",
                textAlign: 'center',
                color: '#C9B8E6',
                maxWidth: 460,
              }}
            >
              {badge.story || badge.cond || t('badges.unlockModal.congratsDesc')}
            </span>
          </div>

          {/* 3 Thỏi thưởng: +XP, +Điểm mùa, Elo + */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              gap: 11,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                font: '700 17px/1 Oswald, sans-serif',
                letterSpacing: '.06em',
                color: '#FFC46B',
                background: 'rgba(20,1,9,.6)',
                borderTop: '1px solid #FF7A18',
                padding: '12px 20px',
                clipPath: NOTCH_S_CLIP,
              }}
            >
              +{xpReward} XP
            </span>
            <span
              style={{
                font: '700 17px/1 Oswald, sans-serif',
                letterSpacing: '.06em',
                color: '#5FEBD0',
                background: 'rgba(1,19,15,.6)',
                borderTop: '1px solid #0E9F8E',
                padding: '12px 20px',
                clipPath: NOTCH_S_CLIP,
              }}
            >
              +{spReward} SP
            </span>
            <span
              style={{
                font: '700 17px/1 Oswald, sans-serif',
                letterSpacing: '.06em',
                color: '#7FE7FF',
                background: 'rgba(1,16,31,.6)',
                borderTop: '1px solid #1B7BE0',
                padding: '12px 20px',
                clipPath: NOTCH_S_CLIP,
              }}
            >
              ELO +{eloReward}
            </span>
          </div>

          {/* Các nút hành động */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              display: 'flex',
              gap: 12,
              marginTop: 6,
            }}
          >
            <button
              type="button"
              onClick={() => onEquipShelf && onEquipShelf(badge)}
              style={{
                flex: 1,
                textAlign: 'center',
                font: '700 13px/1 Oswald, sans-serif',
                letterSpacing: '.14em',
                color: '#140109',
                background: 'linear-gradient(135deg, #FFE24B, #FF7A18)',
                padding: '15px 16px',
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
                if (onViewCollection) onViewCollection()
                else if (onClose) onClose()
              }}
              style={{
                flex: 1,
                textAlign: 'center',
                font: '700 13px/1 Oswald, sans-serif',
                letterSpacing: '.14em',
                color: '#D9A8FF',
                background: 'rgba(255,255,255,.06)',
                borderTop: '1px solid #8B2BFF',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                padding: '15px 16px',
                clipPath: NOTCH_S_CLIP,
                cursor: 'pointer',
                transition: 'filter 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = 'brightness(1.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'brightness(1)'
              }}
            >
              {t('badges.unlockModal.viewCollectionBtn')}
            </button>
          </div>

          {/* Ghi chú kệ */}
          <span
            style={{
              position: 'relative',
              font: "400 11.5px/1.4 'IBM Plex Mono', monospace",
              color: '#7E6FA0',
            }}
          >
            {shelfIsFull
              ? t('badges.unlockModal.shelfReplaceNote')
              : t('badges.unlockModal.shelfAttachNote')}
          </span>
        </div>
      </div>
    </div>
  )
}
