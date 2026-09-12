import BadgeHex from './BadgeHex.jsx'
import { NOTCH_CLIP, NOTCH_S_CLIP, ANIME_TIERS } from '#lib/badges.js'
import { t } from '#i18n'

/**
 * Kệ danh hiệu của tôi (3 ô - Màn A1 & A5).
 * Cho phép xem và chọn huy hiệu gắn lên kệ.
 */
export default function BadgeShelf({ shelf = [], onSlotClick }) {
  const slots = [0, 1, 2].map((idx) => shelf[idx] || null)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 12,
      }}
    >
      {slots.map((badge, idx) => {
        if (!badge) {
          return (
            <div
              key={`empty_${idx}`}
              role="button"
              tabIndex={0}
              onClick={() => onSlotClick && onSlotClick(idx, null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSlotClick && onSlotClick(idx, null)
                }
              }}
              style={{
                padding: 1,
                clipPath: NOTCH_CLIP,
                background: 'rgba(255,255,255,.08)',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
            >
              <div
                style={{
                  clipPath: NOTCH_CLIP,
                  background: '#0D061A',
                  border: '1px dashed #3B2560',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 13,
                  minHeight: 78,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    clipPath: 'polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)',
                    background: 'rgba(255,255,255,.04)',
                    border: '1px dashed #4E3F6B',
                    display: 'grid',
                    placeItems: 'center',
                    font: '700 18px/1 Oswald, sans-serif',
                    color: '#6B5C8C',
                  }}
                >
                  +
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ font: "600 13px/1 'Be Vietnam Pro', sans-serif", color: '#9C8ABE' }}>
                    {t('badges.shelfEmptySlot')} #{idx + 1}
                  </span>
                  <span style={{ font: "400 11px/1 'Be Vietnam Pro', sans-serif", color: '#6B5C8C' }}>
                    {t('badges.shelfEmptySlotHint')}
                  </span>
                </div>
              </div>
            </div>
          )
        }

        const tierMeta = badge.tierMeta || ANIME_TIERS[badge.tier] || ANIME_TIERS.rare
        const badgeName = t(`badges.items.${badge.id}.name`, { defaultValue: badge.name })

        return (
          <div
            key={badge.id || idx}
            role="button"
            tabIndex={0}
            onClick={() => onSlotClick && onSlotClick(idx, badge)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSlotClick && onSlotClick(idx, badge)
              }
            }}
            style={{
              position: 'relative',
              padding: 1,
              clipPath: NOTCH_CLIP,
              background: tierMeta.edge || 'linear-gradient(135deg,#FF2E7E,#FFE24B)',
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <div
              style={{
                clipPath: NOTCH_CLIP,
                background: tierMeta.panel || '#1A0310',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 13,
                minHeight: 78,
              }}
            >
              <BadgeHex
                tier={badge.tier}
                glyph={badge.glyph}
                size={52}
                spin={badge.tier === 'legend'}
              />
              <div style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span
                  style={{
                    font: "700 14px/1.2 'Be Vietnam Pro', sans-serif",
                    color: '#FFFFFF',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {badgeName}
                </span>
                <span
                  style={{
                    alignSelf: 'flex-start',
                    font: '600 9px/1 Oswald, sans-serif',
                    letterSpacing: '.14em',
                    padding: '3px 7px',
                    clipPath: NOTCH_S_CLIP,
                    background: tierMeta.chipBg,
                    color: tierMeta.ink,
                    borderTop: `1px solid ${tierMeta.bd || 'transparent'}`,
                  }}
                >
                  {tierMeta.name}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
