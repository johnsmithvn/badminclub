import React from 'react'
import { t } from '#i18n'
import BadgeHex from './BadgeHex.jsx'
import { ANIME_TIERS, NOTCH_S_CLIP } from '#lib/badges.js'
import { useMobile } from '#hooks/useMobile.js'

/**
 * Màn A4 (Desktop) & AM4 (Mobile): Fanfare Modal Mở khóa Danh hiệu.
 * Hiển thị hiệu ứng anime rực rỡ (speed lines, tia conic quay, badge lấp lánh,
 * các mốc thưởng +XP, +Điểm mùa, +Elo và nút thao tác gắn lên kệ ngay).
 * - Trên Mobile (AM4): Full màn hình (100vw/100vh), 2 nút hành động xếp dọc.
 * - Trên Desktop (A4): Modal nổi ở giữa 660px, 2 nút hành động xếp ngang.
 */
export default function BadgeUnlockModal({
  badge,
  onClose,
  onEquipShelf,
  onViewCollection,
  shelfCount = 3,
  shelfIsFull = true,
  isMobile: isMobileProp,
}) {
  const isMobileHook = useMobile(768)
  const isMobile = isMobileProp !== undefined ? isMobileProp : isMobileHook

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

  // Câu chuyện / mô tả chiến tích
  const storyText =
    badge.victim && badge.streak
      ? t('badges.unlockModal.brokeStreakStory', { victim: badge.victim, streak: badge.streak })
      : badge.story || badge.cond || badge.desc || t('badges.unlockModal.congratsDesc')

  // Chú thích kệ: nếu đã đầy 3 ô thì báo thay ô cuối, nếu còn trống thì báo còn bao nhiêu ô
  const shelfNote = shelfIsFull
    ? t('badges.unlockModal.shelfReplaceNote')
    : t('badges.unlockModal.shelfAvailableNote', { count: Math.max(1, 3 - shelfCount) })

  // ══════════════════════════════════════════════════════════════════
  // GIAO DIỆN AM4 MOBILE: FULL MÀN HÌNH (100% Viewport)
  // ══════════════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={badge.name || t('badges.unlockModal.title')}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          width: '100vw',
          height: '100vh',
          background: '#07030F',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Nền hiệu ứng Anime AM4 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(70% 40% at 50% 40%, rgba(109,20,255,.32), transparent 72%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px)',
            backgroundSize: '9px 9px',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'repeating-linear-gradient(96deg, rgba(255,255,255,.05) 0 2px, transparent 2px 12px)',
            animation: 'aSpeed 1.4s linear infinite',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '34%',
            left: '50%',
            width: 760,
            height: 760,
            margin: '-380px 0 0 -380px',
            background: 'repeating-conic-gradient(from 0deg, rgba(255,226,75,.12) 0deg 3deg, transparent 3deg 12deg)',
            animation: 'aSpin 40s linear infinite',
            pointerEvents: 'none',
          }}
        />

        {/* Nút đóng góc trên bên phải */}
        <button
          type="button"
          aria-label={t('common.close')}
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 'calc(14px + env(safe-area-inset-top, 0px))',
            right: 16,
            zIndex: 20,
            background: 'rgba(255,255,255,.08)',
            border: '1px solid #4C2673',
            borderRadius: '50%',
            width: 36,
            height: 36,
            color: '#FFFFFF',
            fontSize: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>

        {/* Nội dung trung tâm cuộn được trên màn hình nhỏ */}
        <div
          style={{
            position: 'relative',
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 'calc(36px + env(safe-area-inset-top, 0px)) 22px calc(24px + env(safe-area-inset-bottom, 0px))',
            width: '100%',
            maxWidth: 420,
            margin: '0 auto',
            boxSizing: 'border-box',
          }}
        >
          {/* Nhãn mở khóa danh hiệu */}
          <span
            style={{
              font: "700 10.5px/1 'Oswald', sans-serif",
              letterSpacing: '.26em',
              color: '#FFE24B',
              textTransform: 'uppercase',
            }}
          >
            {t('badges.unlockModal.title')}
          </span>

          {/* Badge to 150px với hiệu ứng spinning conic và sao lấp lánh */}
          <div style={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
            <div
              style={{
                position: 'absolute',
                inset: '-32%',
                background: 'repeating-conic-gradient(from 0deg, rgba(255,46,126,.3) 0deg 5deg, transparent 5deg 15deg)',
                animation: 'aSpinBack 18s linear infinite',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: '-24%',
                background: 'radial-gradient(50% 50% at 50% 50%, rgba(255,226,75,.5), transparent 70%)',
                animation: 'aPulse 2.4s ease-in-out infinite',
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
            <div
              style={{
                position: 'absolute',
                top: '-5%',
                left: '-3%',
                width: 14,
                height: 14,
                background: '#FFE24B',
                clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                animation: 'aTwinkle 2.2s ease-in-out infinite',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: '2%',
                right: '-6%',
                width: 11,
                height: 11,
                background: '#FF6BE0',
                clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                animation: 'aTwinkle 2.8s ease-in-out .6s infinite',
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* Tên danh hiệu */}
          <span
            style={{
              font: "700 30px/1.05 'Oswald', sans-serif",
              letterSpacing: '.02em',
              textTransform: 'uppercase',
              textAlign: 'center',
              color: '#FFFFFF',
              textShadow: `0 3px 0 #4A0A5A, 0 0 28px ${tTier.aura || 'rgba(192,75,255,.7)'}`,
            }}
          >
            {badge.name}
          </span>

          {/* Tag độ hiếm */}
          <span
            style={{
              font: "700 9.5px/1 'Oswald', sans-serif",
              letterSpacing: '.18em',
              padding: '6px 12px',
              clipPath: 'polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px)',
              background: tTier.tagBg || 'rgba(139,43,255,.2)',
              borderTop: `1px solid ${tTier.tagBd || '#8B2BFF'}`,
              color: tTier.tagColor || '#D9A8FF',
              textTransform: 'uppercase',
            }}
          >
            {tTier.name} · {pts} {t('badges.unlockModal.ptsUnit')}
          </span>

          {/* Mô tả / Chiến tích */}
          <span
            style={{
              font: "400 13px/1.55 'Be Vietnam Pro', sans-serif",
              textAlign: 'center',
              color: '#C9B8E6',
              maxWidth: 360,
              padding: '0 4px',
            }}
          >
            {storyText}
          </span>

          {/* 3 Thỏi thưởng: XP, Mùa, Elo */}
          <div style={{ width: '100%', display: 'flex', gap: 8 }}>
            <span
              style={{
                flex: 1,
                textAlign: 'center',
                font: "700 14px/1 'Oswald', sans-serif",
                letterSpacing: '.04em',
                color: '#FFC46B',
                background: 'rgba(20,1,9,.6)',
                borderTop: '1px solid #FF7A18',
                padding: '12px 6px',
                clipPath: NOTCH_S_CLIP,
              }}
            >
              +{xpReward} XP
            </span>
            <span
              style={{
                flex: 1,
                textAlign: 'center',
                font: "700 14px/1 'Oswald', sans-serif",
                letterSpacing: '.04em',
                color: '#5FEBD0',
                background: 'rgba(1,19,15,.6)',
                borderTop: '1px solid #0E9F8E',
                padding: '12px 6px',
                clipPath: NOTCH_S_CLIP,
              }}
            >
              +{spReward} {t('badges.unlockModal.seasonShortUnit')}
            </span>
            <span
              style={{
                flex: 1,
                textAlign: 'center',
                font: "700 14px/1 'Oswald', sans-serif",
                letterSpacing: '.04em',
                color: '#7FE7FF',
                background: 'rgba(1,16,31,.6)',
                borderTop: '1px solid #1B7BE0',
                padding: '12px 6px',
                clipPath: NOTCH_S_CLIP,
              }}
            >
              ELO +{eloReward}
            </span>
          </div>

          {/* 2 Nút hành động dọc */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              onClick={() => onEquipShelf && onEquipShelf(badge)}
              style={{
                textAlign: 'center',
                font: "700 12.5px/1 'Oswald', sans-serif",
                letterSpacing: '.14em',
                color: '#140109',
                background: 'linear-gradient(135deg, #FFE24B, #FF7A18)',
                padding: '14px',
                clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                border: 'none',
                cursor: 'pointer',
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
                textAlign: 'center',
                font: "700 12.5px/1 'Oswald', sans-serif",
                letterSpacing: '.14em',
                color: '#D9A8FF',
                background: 'rgba(255,255,255,.06)',
                borderTop: '1px solid #8B2BFF',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                padding: '14px',
                clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                cursor: 'pointer',
              }}
            >
              {t('badges.unlockModal.viewCollectionBtn')}
            </button>
            <span
              style={{
                textAlign: 'center',
                font: "400 10.5px/1.4 'IBM Plex Mono', monospace",
                color: '#7E6FA0',
                marginTop: 2,
              }}
            >
              {shelfNote}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════
  // GIAO DIỆN A4 DESKTOP: MODAL NỔI GIỮA MÀN HÌNH (660px)
  // ══════════════════════════════════════════════════════════════════
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
        padding: '24px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose && onClose()
      }}
    >
      {/* Hiệu ứng Anime Background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(60% 50% at 50% 42%, rgba(109,20,255,.32), transparent 72%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px)',
          backgroundSize: '9px 9px',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'repeating-linear-gradient(96deg, rgba(255,255,255,.06) 0 2px, transparent 2px 12px)',
          animation: 'aSpeed 1.4s linear infinite',
          pointerEvents: 'none',
        }}
      />
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

      {/* Khung Modal Trung Tâm (Notch clip viền gradient) */}
      <div
        style={{
          position: 'relative',
          width: 660,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 40px)',
          padding: 1,
          clipPath: 'polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)',
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
            clipPath: 'polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)',
            background: 'linear-gradient(170deg, #2B0617, #12021C 70%)',
            padding: '42px 46px 34px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
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
              top: 14,
              right: 16,
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
              font: "700 12px/1 'Oswald', sans-serif",
              letterSpacing: '.28em',
              color: '#FFE24B',
              textTransform: 'uppercase',
            }}
          >
            {t('badges.unlockModal.title')}
          </span>

          {/* Huy hiệu Fanfare to với spinning conic phụ trợ */}
          <div style={{ position: 'relative', width: 190, height: 190, margin: '6px 0' }}>
            <div
              style={{
                position: 'absolute',
                inset: '-34%',
                background: 'repeating-conic-gradient(from 0deg, rgba(255,46,126,.3) 0deg 5deg, transparent 5deg 15deg)',
                animation: 'aSpinBack 18s linear infinite',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: '-26%',
                background: 'radial-gradient(50% 50% at 50% 50%, rgba(255,226,75,.5), transparent 70%)',
                animation: 'aPulse 2.4s ease-in-out infinite',
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
                pointerEvents: 'none',
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
                animation: 'aTwinkle 2.8s ease-in-out .6s infinite',
                pointerEvents: 'none',
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
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* Tên danh hiệu + Tag bậc + Mô tả */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 11,
              width: '100%',
            }}
          >
            <span
              style={{
                font: "700 40px/1 'Oswald', sans-serif",
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
                font: "700 10.5px/1 'Oswald', sans-serif",
                letterSpacing: '.2em',
                padding: '6px 12px',
                clipPath: 'polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)',
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
                font: "400 14px/1.55 'Be Vietnam Pro', sans-serif",
                textAlign: 'center',
                color: '#C9B8E6',
                maxWidth: 440,
              }}
            >
              {storyText}
            </span>
          </div>

          {/* 3 Thỏi thưởng: +XP, +Điểm mùa, ELO + */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              gap: 11,
            }}
          >
            <span
              style={{
                font: "700 17px/1 'Oswald', sans-serif",
                letterSpacing: '.06em',
                color: '#FFC46B',
                background: 'rgba(20,1,9,.6)',
                borderTop: '1px solid #FF7A18',
                padding: '13px 20px',
                clipPath: 'polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)',
              }}
            >
              +{xpReward} XP
            </span>
            <span
              style={{
                font: "700 17px/1 'Oswald', sans-serif",
                letterSpacing: '.06em',
                color: '#5FEBD0',
                background: 'rgba(1,19,15,.6)',
                borderTop: '1px solid #0E9F8E',
                padding: '13px 20px',
                clipPath: 'polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)',
              }}
            >
              +{spReward} {t('badges.unlockModal.seasonPointsUnit')}
            </span>
            <span
              style={{
                font: "700 17px/1 'Oswald', sans-serif",
                letterSpacing: '.06em',
                color: '#7FE7FF',
                background: 'rgba(1,16,31,.6)',
                borderTop: '1px solid #1B7BE0',
                padding: '13px 20px',
                clipPath: 'polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)',
              }}
            >
              ELO +{eloReward}
            </span>
          </div>

          {/* Các nút hành động A4: row ngang */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              display: 'flex',
              gap: 11,
            }}
          >
            <button
              type="button"
              onClick={() => onEquipShelf && onEquipShelf(badge)}
              style={{
                flex: 1,
                textAlign: 'center',
                font: "700 13px/1 'Oswald', sans-serif",
                letterSpacing: '.14em',
                color: '#140109',
                background: 'linear-gradient(135deg, #FFE24B, #FF7A18)',
                padding: '15px 16px',
                clipPath: 'polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)',
                border: 'none',
                cursor: 'pointer',
                transition: 'filter 0.15s ease',
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
                font: "700 13px/1 'Oswald', sans-serif",
                letterSpacing: '.14em',
                color: '#D9A8FF',
                background: 'rgba(255,255,255,.06)',
                borderTop: '1px solid #8B2BFF',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                padding: '15px 16px',
                clipPath: 'polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)',
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
              font: "400 11.5px/1.4 'IBM Plex Mono', monospace",
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
