import BadgeHex from './BadgeHex.jsx'
import { NOTCH_CLIP, NOTCH_S_CLIP } from '#lib/badges.js'
import { t } from '#i18n'

/**
 * Thẻ danh hiệu trong lưới bộ sưu tập (Màn A1).
 */
export default function BadgeCard({ badge, onClick }) {
  const meta = badge.tierMeta || {}
  const isHidden = badge.tier === 'hidden' && !badge.unlocked
  const badgeName = t(`badges.items.${badge.id}.name`, { defaultValue: badge.name || '???' })
  const badgeCond = t(`badges.items.${badge.id}.cond`, { defaultValue: badge.cond || '' })

  return (
    <div
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
        background: meta.edge || 'rgba(255,255,255,.1)',
        opacity: badge.unlocked ? 1 : 0.76,
        cursor: 'pointer',
        transition: 'transform 0.15s ease, opacity 0.15s ease',
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
        <BadgeHex
          tier={badge.tier}
          glyph={badge.glyph}
          size={76}
          dim={isHidden}
          spin={badge.tier === 'legend'}
        />

        {/* 2. Tên danh hiệu */}
        <span
          style={{
            font: "700 13.5px/1.25 'Be Vietnam Pro', sans-serif",
            textAlign: 'center',
            color: isHidden ? '#9C8ABE' : '#FFFFFF',
          }}
        >
          {isHidden ? '???' : badgeName}
        </span>

        {/* 3. Chip phân bậc */}
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
          {meta.name}
        </span>

        {/* 4. Điều kiện mở khóa / Gợi ý */}
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
          {badgeCond}
        </span>

        <div style={{ flex: '1 1 auto' }} />

        {/* 5. Tiến độ (nếu chưa mở) hoặc Dấu tích đã mở */}
        {badge.unlocked ? (
          <span
            style={{
              font: "600 11px/1 'IBM Plex Mono', monospace",
              color: '#5FEBD0',
              paddingTop: 4,
            }}
          >
            {t('badges.openedStatus')}
          </span>
        ) : badge.pct > 0 && !isHidden ? (
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
