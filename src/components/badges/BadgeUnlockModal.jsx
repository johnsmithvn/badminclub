import { t } from '#i18n'
import BadgeHex from './BadgeHex.jsx'
import TierBackdrop from './TierBackdrop.jsx'
import { TIER_FX } from './tierFx.js'
import { BADGE_TIERS } from '#lib/badges.js'
import { useMobile } from '#hooks/useMobile.js'

const GOLD = '#F6C945'

/**
 * Màn A4 (Desktop) & AM4 (Mobile): Fanfare Modal Mở khóa Danh hiệu.
 * Cùng hệ hiệu ứng với modal chi tiết: nền bụi sao + sao băng + chùm sáng (Hiếm / Tinh anh /
 * Tự phong) hoặc cực quang (Sử thi / Huyền thoại) theo bậc của danh hiệu vừa mở, icon dùng hiệu
 * ứng ghép theo bậc của BadgeHex.
 * - Trên Mobile (AM4): Full màn hình, 2 nút hành động xếp dọc dán đáy.
 * - Trên Desktop (A4): Modal nổi ở giữa 560px, 2 nút hành động xếp ngang.
 */
export default function BadgeUnlockModal({
  badge,
  onClose,
  onEquipShelf,
  onViewCollection,
  shelfCount = 0,
  shelfIsFull = false,
  isMobile: isMobileProp,
}) {
  const isMobileHook = useMobile(768)
  const isMobile = isMobileProp !== undefined ? isMobileProp : isMobileHook

  if (!badge) return null

  const tier = badge.tier || 'epic'
  const tTier = BADGE_TIERS[tier] || BADGE_TIERS.epic
  const fx = TIER_FX[tier] || TIER_FX.epic
  const rgba = (a) => `rgba(${fx.rgb},${a})`
  const glyph = badge.glyph || 'flame'
  const pts = tTier.pts || badge.points || 60

  // Phần thưởng THẬT. ScoreModal tự tính sẵn xp / sp (từ `reward` trong cấu hình) và elo (Elo của
  // trận vừa đánh); GlobalBadgeUnlockHost truyền thẳng bản catalog nên đọc `reward`.
  // Bản trước rơi về một bảng mặc định có khoá sai tên bậc (common/legendary/mythic) — mọi danh
  // hiệu Tinh anh / Huyền thoại đều hiện "+100 XP · +15 · ELO +18" bất kể cấu hình, và danh
  // hiệu không hề cộng Elo. Không có số thật thì không vẽ chip, không bịa.
  const xpReward = badge.xp ?? badge.reward?.xp ?? 0
  const spReward = badge.seasonPoints ?? badge.sp ?? badge.reward?.seasonPts ?? 0
  const eloReward = badge.elo

  // Tên và điều kiện LUÔN tra từ i18n theo id, giống mọi màn danh hiệu khác.
  // Catalog trong `badges.json` không có field `name`/`cond`, nên đọc thẳng `badge.name` là
  // tiêu đề modal chúc mừng bỏ trống (đường GlobalBadgeUnlockHost) hoặc hiện id thô kiểu
  // `bat_bai_v` (đường ScoreModal). Vẫn nhận `badge.name` làm dự phòng cho người gọi đã tự dịch.
  const badgeName = t(`badges.items.${badge.id}.name`, { defaultValue: badge.name || '' })
  const badgeCond = t(`badges.items.${badge.id}.cond`, { defaultValue: badge.cond || '' })

  // Câu chuyện / mô tả chiến tích
  const storyText =
    badge.victim && badge.streak
      ? t('badges.unlockModal.brokeStreakStory', { victim: badge.victim, streak: badge.streak })
      : badge.story || badgeCond || badge.desc || t('badges.unlockModal.congratsDesc')

  // Chú thích kệ: nếu đã đầy 3 ô thì báo thay ô cuối, nếu còn trống thì báo còn bao nhiêu ô
  const shelfNote = shelfIsFull
    ? t('badges.unlockModal.shelfReplaceNote')
    : t('badges.unlockModal.shelfAvailableNote', { count: Math.max(1, 3 - shelfCount) })

  const rewardChips = [
    xpReward > 0 && {
      key: 'xp',
      text: `+${xpReward} XP`,
      color: GOLD,
      bg: 'rgba(246,201,69,.12)',
      bd: 'rgba(246,201,69,.4)',
    },
    spReward > 0 && {
      key: 'sp',
      text: `+${spReward} ${t(isMobile ? 'badges.unlockModal.seasonShortUnit' : 'badges.unlockModal.seasonPointsUnit')}`,
      color: fx.acc,
      bg: rgba(0.12),
      bd: rgba(0.45),
    },
    Number.isFinite(eloReward) && eloReward !== 0 && {
      key: 'elo',
      text: `ELO ${eloReward > 0 ? '+' : ''}${eloReward}`,
      color: '#7CC0FF',
      bg: 'rgba(58,160,255,.12)',
      bd: 'rgba(58,160,255,.4)',
    },
  ].filter(Boolean)

  const btnBase = {
    textAlign: 'center',
    font: "700 13px/1 'Oswald', sans-serif",
    letterSpacing: '.14em',
    padding: '15px 16px',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'filter 140ms cubic-bezier(.2,.8,.2,1)',
  }
  const hoverOn = (e) => { e.currentTarget.style.filter = 'brightness(1.15)' }
  const hoverOff = (e) => { e.currentTarget.style.filter = 'none' }

  const closeBtn = (
    <button
      type="button"
      aria-label={t('common.close')}
      onClick={onClose}
      style={{
        position: 'absolute',
        top: isMobile ? 'calc(14px + env(safe-area-inset-top, 0px))' : 14,
        right: isMobile ? 16 : 14,
        zIndex: 3,
        width: 40,
        height: 40,
        borderRadius: 10,
        border: 'none',
        background: '#161026',
        color: '#C9BFDC',
        font: '600 16px/1 var(--font-sans)',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        transition: 'background 140ms cubic-bezier(.2,.8,.2,1)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#201838' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#161026' }}
    >
      ✕
    </button>
  )

  const body = (
    <>
      <span
        style={{
          font: `700 ${isMobile ? 11 : 12}px/1 'Oswald', sans-serif`,
          letterSpacing: '.26em',
          textTransform: 'uppercase',
          color: GOLD,
        }}
      >
        {t('badges.unlockModal.title')}
      </span>

      {/* Huy hiệu nằm ngay dưới chùm sáng / cực quang của TierBackdrop */}
      <BadgeHex
        tier={tier}
        glyph={glyph}
        size={isMobile ? 150 : 170}
        style={{ margin: isMobile ? '34px 0 10px' : '38px 0 12px' }}
      />

      <span
        style={{
          maxWidth: '100%',
          font: `700 ${isMobile ? 32 : 40}px/1.05 'Oswald', sans-serif`,
          letterSpacing: '.04em',
          textTransform: 'uppercase',
          textAlign: 'center',
          color: '#FFFFFF',
          textShadow: `0 0 26px ${rgba(0.5)}`,
          overflowWrap: 'anywhere',
        }}
      >
        {badgeName}
      </span>

      <span
        style={{
          font: `600 ${isMobile ? 10.5 : 11}px/1 'Oswald', sans-serif`,
          letterSpacing: '.22em',
          textTransform: 'uppercase',
          padding: '6px 12px',
          borderRadius: 6,
          background: rgba(0.12),
          borderTop: `1px solid ${rgba(0.45)}`,
          color: fx.acc,
        }}
      >
        {tTier.name} · {pts} {t('badges.unlockModal.ptsUnit')}
      </span>

      <span
        style={{
          maxWidth: 440,
          font: `400 ${isMobile ? 14 : 15}px/1.5 var(--font-sans)`,
          textAlign: 'center',
          color: '#E3DCEE',
        }}
      >
        {storyText}
      </span>

      {rewardChips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 2 }}>
          {rewardChips.map((c) => (
            <span
              key={c.key}
              style={{
                font: `700 ${isMobile ? 14 : 15}px/1 var(--font-display)`,
                padding: '9px 14px',
                borderRadius: 8,
                background: c.bg,
                border: `1px solid ${c.bd}`,
                color: c.color,
              }}
            >
              {c.text}
            </span>
          ))}
        </div>
      )}

      {/* Hành động: mobile xếp dọc và dán đáy (gần ngón cái), desktop xếp ngang */}
      <div
        style={{
          alignSelf: 'stretch',
          marginTop: isMobile ? 'auto' : 10,
          paddingTop: isMobile ? 18 : 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 8 : 10 }}>
          <button
            type="button"
            onClick={() => onEquipShelf && onEquipShelf(badge)}
            style={{
              ...btnBase,
              flex: 1,
              border: 'none',
              background: 'linear-gradient(90deg,#F6C945,#FF9A3D)',
              color: '#1A0F00',
            }}
            onMouseEnter={hoverOn}
            onMouseLeave={hoverOff}
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
              ...btnBase,
              flex: 1,
              border: '1px solid #2E2447',
              background: 'rgba(255,255,255,.06)',
              color: '#C9BFDC',
            }}
            onMouseEnter={hoverOn}
            onMouseLeave={hoverOff}
          >
            {t('badges.unlockModal.viewCollectionBtn')}
          </button>
        </div>
        <span style={{ textAlign: 'center', font: '400 11px/1.4 var(--font-mono)', color: '#8E83A8' }}>
          {shelfNote}
        </span>
      </div>
    </>
  )

  // ══════════════════════════════════════════════════════════════════
  // AM4 MOBILE: FULL MÀN HÌNH
  // ══════════════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={badgeName || t('badges.unlockModal.title')}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: '#06080C',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <TierBackdrop tier={tier} />
        {closeBtn}

        <div
          style={{
            position: 'relative',
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            width: '100%',
            maxWidth: 420,
            margin: '0 auto',
            boxSizing: 'border-box',
            padding: 'calc(40px + env(safe-area-inset-top, 0px)) 22px calc(24px + env(safe-area-inset-bottom, 0px))',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {body}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════
  // A4 DESKTOP: MODAL NỔI GIỮA MÀN HÌNH
  // ══════════════════════════════════════════════════════════════════
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={badgeName || t('badges.unlockModal.title')}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'rgba(5,3,9,.86)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose && onClose()
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 560,
          maxWidth: '100%',
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
          borderRadius: 22,
          border: `1px solid ${rgba(0.45)}`,
          background: '#06080C',
          boxShadow: `0 24px 70px rgba(0,0,0,.75), 0 0 60px ${rgba(0.22)}`,
        }}
      >
        <TierBackdrop tier={tier} />
        {closeBtn}

        <div
          style={{
            position: 'relative',
            padding: '34px 40px 30px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {body}
        </div>
      </div>
    </div>
  )
}
