import BadgeHex from './BadgeHex.jsx'
import { NOTCH_CLIP, NOTCH_S_CLIP } from '#lib/badges.js'
import { t } from '#i18n'

/**
 * Thẻ danh hiệu trong lưới bộ sưu tập (Màn A1).
 */
export default function BadgeCard({ badge, isHighlighted = false, onClick }) {
  const meta = badge.tierMeta || {}
  const isHidden = badge.tier === 'hidden' && !badge.unlocked

  // Xử lý hiển thị họ danh hiệu (Family Evolving Badge) vs Danh hiệu đơn lẻ
  const isFamily = !!badge.isFamily
  const displayName = isFamily
    ? t(`badges.families.${badge.familyKey}.name`, { defaultValue: badge.name || '???' })
    : t(`badges.items.${badge.id}.name`, { defaultValue: badge.name || '???' })

  let displayCond = ''
  if (isFamily) {
    if (badge.isAllUnlocked) {
      displayCond = t('badges.maxTierAchieved', { total: badge.totalTiers })
    } else if (badge.nextTarget) {
      const nextCond = t(`badges.items.${badge.nextTarget.id}.cond`, { defaultValue: badge.nextTarget.cond || '' })
      displayCond = t('badges.nextTierLabel', { target: nextCond })
    } else {
      displayCond = t(`badges.items.${badge.tiers[0]?.id}.cond`, { defaultValue: badge.tiers[0]?.cond || '' })
    }
  } else {
    displayCond = t(`badges.items.${badge.id}.cond`, { defaultValue: badge.cond || '' })
  }

  // Mốc tiến độ đang theo đuổi
  const targetForProgress = isFamily ? badge.nextTarget : badge
  const hasProgress = targetForProgress && targetForProgress.pct > 0 && !isHidden

  return (
    <div
      id={`badge-card-${badge.id}`}
      role="button"
      tabIndex={0}
      onClick={() => onClick && onClick(badge)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick && onClick(badge)
        }
      }}
      style={{
        position: 'relative',
        padding: 1,
        clipPath: NOTCH_CLIP,
        background: isHighlighted
          ? 'linear-gradient(135deg, #FFE24B, #FF2E7E 50%, #2EE9FF)'
          : (meta.edge || 'rgba(255,255,255,.1)'),
        opacity: badge.unlocked ? 1 : 0.76,
        cursor: 'pointer',
        transition: 'transform 0.2s ease, opacity 0.15s ease, box-shadow 0.3s ease',
        boxShadow: isHighlighted
          ? '0 0 24px rgba(255, 226, 75, 0.9), 0 0 45px rgba(255, 46, 126, 0.6)'
          : 'none',
        transform: isHighlighted ? 'scale(1.03) translateY(-4px)' : undefined,
        zIndex: isHighlighted ? 10 : 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.opacity = '1'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.opacity = badge.unlocked ? '1' : '0.76'
      }}
    >
      <div
        style={{
          position: 'relative',
          clipPath: NOTCH_CLIP,
          background: meta.panel || '#0A0514',
          padding: '16px 13px 14px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 9,
          height: '100%',
        }}
      >
        {/* 1. Huy hiệu lục giác */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <BadgeHex
            tier={badge.tier}
            glyph={badge.glyph}
            size={76}
            dim={isHidden}
            spin={badge.tier === 'legend'}
          />
        </div>

        {/* 2. Tên danh hiệu */}
        <span
          style={{
            font: "700 13.5px/1.25 'Be Vietnam Pro', sans-serif",
            textAlign: 'center',
            color: isHidden ? '#9C8ABE' : '#FFFFFF',
          }}
        >
          {isHidden ? '???' : displayName}
        </span>

        {/* 3. Chip phân bậc + Chỉ báo cấp độ chuỗi */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              font: '600 9.5px/1 Oswald, sans-serif',
              letterSpacing: '.14em',
              padding: '4px 8px',
              clipPath: NOTCH_S_CLIP,
              background: meta.chipBg || 'rgba(255,255,255,.08)',
              color: meta.ink || '#FFFFFF',
              borderTop: `1px solid ${meta.bd || 'transparent'}`,
            }}
          >
            {isFamily
              ? `${t('badges.tierLevel', { current: badge.unlockedTiersCount || 1, total: badge.totalTiers })} · ${meta.name}`
              : meta.name}
          </span>

          {/* Dấu chấm tiến trình các mốc trong họ */}
          {isFamily && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {badge.tiers.map((tr, idx) => (
                <span
                  key={tr.id || idx}
                  title={tr.name}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 999,
                    background: tr.unlocked ? (meta.ink || '#5FEBD0') : 'rgba(255,255,255,.16)',
                    boxShadow: tr.unlocked ? `0 0 6px ${meta.ink || '#5FEBD0'}` : 'none',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* 4. Điều kiện mở khóa / Gợi ý mốc tiếp theo */}
        <span
          style={{
            font: "400 11px/1.4 'Be Vietnam Pro', sans-serif",
            textAlign: 'center',
            color: '#9C8ABE',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {displayCond}
        </span>

        <div style={{ flex: '1 1 auto' }} />

        {/* 5. Tiến độ / Trạng thái đã mở */}
        {isFamily ? (
          badge.isAllUnlocked ? (
            <span
              style={{
                font: "600 11px/1 'IBM Plex Mono', monospace",
                color: '#5FEBD0',
                paddingTop: 4,
              }}
            >
              ✓ {t('badges.maxTierAchieved', { total: badge.totalTiers })}
            </span>
          ) : hasProgress ? (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center' }}>
              <span style={{ font: "600 10.5px/1 'IBM Plex Mono', monospace", color: meta.ink || '#FFFFFF' }}>
                {targetForProgress.progressStr}
              </span>
              <div
                style={{
                  width: '100%',
                  height: 5,
                  clipPath: NOTCH_S_CLIP,
                  background: 'rgba(255,255,255,.08)',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${targetForProgress.pct}%`,
                    background: meta.edge || 'linear-gradient(90deg, #0B63FF, #2EE9FF)',
                  }}
                />
              </div>
            </div>
          ) : badge.unlocked ? (
            <span
              style={{
                font: "600 11px/1 'IBM Plex Mono', monospace",
                color: '#5FEBD0',
                paddingTop: 4,
              }}
            >
              ✓ {t('badges.openedStatus')} ({badge.unlockedTiersCount}/{badge.totalTiers})
            </span>
          ) : (
            <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: '#6B5C8C' }}>
              {t('badges.lockedStatus')}
            </span>
          )
        ) : badge.unlocked ? (
          <span
            style={{
              font: "600 11px/1 'IBM Plex Mono', monospace",
              color: '#5FEBD0',
              paddingTop: 4,
            }}
          >
            {t('badges.openedStatus')}
          </span>
        ) : hasProgress ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center' }}>
            <span style={{ font: "600 10.5px/1 'IBM Plex Mono', monospace", color: meta.ink || '#FFFFFF' }}>
              {badge.progressStr}
            </span>
            <div
              style={{
                width: '100%',
                height: 5,
                clipPath: NOTCH_S_CLIP,
                background: 'rgba(255,255,255,.08)',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${badge.pct}%`,
                  background: meta.edge || 'linear-gradient(90deg, #0B63FF, #2EE9FF)',
                }}
              />
            </div>
          </div>
        ) : (
          <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: '#6B5C8C' }}>
            {isHidden ? '???' : t('badges.lockedStatus')}
          </span>
        )}
      </div>
    </div>
  )
}
