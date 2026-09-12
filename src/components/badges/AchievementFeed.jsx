import React from 'react'
import { t } from '#i18n'
import { NOTCH_S_CLIP } from '#lib/badges.js'

/**
 * Component Bảng Tin Thành Tích & Tương Tác CLB (Achievement Feed)
 * Phong cách Anime Cyberpunk vát góc, đường viền năng lượng neon.
 * Vinh danh ngắt chuỗi, cột mốc chuỗi thắng, mốc Elo, trận cầu nghẹt thở.
 */
export default function AchievementFeed({ feed = [] }) {

  const getEventText = (item) => {
    switch (item.type) {
      case 'bounty_break':
        return t('badges.feed.bountyBreak', {
          actor: item.actorName,
          target: item.targetName,
          streak: item.streakBroken,
          score: item.score,
        })
      case 'streak_milestone':
        return t('badges.feed.streakMilestone', {
          actor: item.actorName,
          streak: item.streakCount,
        })
      case 'elo_milestone':
        return t('badges.feed.eloMilestone', {
          actor: item.actorName,
          elo: item.elo,
        })
      case 'clutch_win':
        return t('badges.feed.clutchWin', {
          actor: item.actorName,
          target: item.targetName,
          score: item.score,
        })
      default:
        return item.actorName || ''
    }
  }

  const renderIcon = (icon, color) => {
    if (icon === 'flame') {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill={color}>
          <path d="M12 2C9.5 7 5 9 5 14c0 3.86 3.14 7 7 7s7-3.14 7-7c0-5-4.5-7-7-12zm0 16c-1.66 0-3-1.34-3-3 0-2.2 2-3.5 3-5 1 1.5 3 2.8 3 5 0 1.66-1.34 3-3 3z" />
        </svg>
      )
    }
    if (icon === 'trophy') {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill={color}>
          <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
        </svg>
      )
    }
    if (icon === 'crown') {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill={color}>
          <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .55-.45 1-1 1H6c-.55 0-1-.45-1-1v-1h14v1z" />
        </svg>
      )
    }
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill={color}>
        <path d="M19.5 3.5L18 2l-4.5 4.5L15 8l4.5-4.5zm-8.25 8.25l-2.12-2.12-5.66 5.66 2.12 2.12 5.66-5.66zM21 7.5L16.5 3l-1.41 1.41 4.5 4.5L21 7.5z" />
      </svg>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Header Bảng Tin */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div>
          <div
            style={{
              font: '700 24px/1 Oswald, sans-serif',
              letterSpacing: '.06em',
              color: '#FFFFFF',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ color: '#FF2E7E' }}>⚡</span>
            <span>{t('badges.feed.title')}</span>
          </div>
          <div
            style={{
              font: "400 13px/1.4 'Be Vietnam Pro', sans-serif",
              color: '#9C8ABE',
              marginTop: 4,
            }}
          >
            {t('badges.feed.sub')}
          </div>
        </div>
      </div>

      {/* Danh sách thẻ sự kiện */}
      {feed.length === 0 ? (
        <div
          style={{
            padding: '36px 20px',
            textAlign: 'center',
            background: 'rgba(25, 12, 45, 0.45)',
            border: '1px dashed rgba(156, 138, 190, 0.25)',
            clipPath: NOTCH_S_CLIP,
            font: "400 14px/1.4 'Be Vietnam Pro', sans-serif",
            color: '#7E6FA0',
          }}
        >
          {t('badges.feed.emptyFeed')}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {feed.map((item) => {
            const accentColor = item.color || '#FFE24B'

            return (
              <div
                key={item.id}
                style={{
                  clipPath: NOTCH_S_CLIP,
                  background: 'linear-gradient(135deg, rgba(29, 13, 53, 0.92), rgba(18, 6, 36, 0.95))',
                  border: `1px solid ${accentColor}33`,
                  borderLeft: `4px solid ${accentColor}`,
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  transition: 'transform .15s ease, box-shadow .15s ease',
                  boxShadow: `0 4px 18px rgba(0, 0, 0, 0.35)`,
                }}
              >
                {/* Cột trái: Icon + Nội dung sự kiện */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: `${accentColor}18`,
                      border: `1px solid ${accentColor}44`,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      boxShadow: `0 0 12px ${accentColor}33`,
                    }}
                  >
                    {renderIcon(item.eventIcon || item.icon, accentColor)}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        font: "600 14.5px/1.4 'Be Vietnam Pro', sans-serif",
                        color: '#FFFFFF',
                        wordBreak: 'break-word',
                      }}
                    >
                      {getEventText(item)}
                    </span>

                    {item.type === 'bounty_break' && (
                      <span
                        style={{
                          font: '700 10px/1 Oswald, sans-serif',
                          letterSpacing: '.12em',
                          color: '#FF2E7E',
                          textTransform: 'uppercase',
                        }}
                      >
                        {t('badges.feed.bountyReward')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Cột phải: Tag thời gian */}
                <div
                  style={{
                    font: '600 11px/1 Oswald, sans-serif',
                    letterSpacing: '.1em',
                    color: '#7E6FA0',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {item.timestamp}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
