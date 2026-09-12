import React from 'react'
import { t } from '#i18n'
import BadgeHex from './BadgeHex.jsx'
import { ANIME_TIERS, HEX_CLIP, NOTCH_CLIP, NOTCH_S_CLIP } from '#lib/badges.js'
import badgesConfig from '#config/badges.json'

/**
 * Màn A5: Tab Xếp hạng Sưu tập (Collector Leaderboard).
 * Hiển thị bảng xếp hạng các nhà sưu tập danh hiệu trong CLB,
 * kệ 3 ô đang gắn của từng thành viên, top huy hiệu hiếm nhất và quy tắc tính điểm.
 */
export default function CollectorLeaderboardTab({
  collectors = [],
  rarestBadges = [],
  onSelectMember,
  onViewBadge,
}) {

  // Dữ liệu thật từ DB (không dùng demo fallback)
  const collectorList = collectors || []

  // Top huy hiệu hiếm nhất CLB từ DB thật (không dùng demo fallback)
  const rarestList = rarestBadges || []

  // Bảng điểm theo tier
  const scoringTiers = [
    { key: 'legend', pts: badgesConfig.tierPoints?.legend || 120 },
    { key: 'epic', pts: badgesConfig.tierPoints?.epic || 60 },
    { key: 'elite', pts: badgesConfig.tierPoints?.elite || 30 },
    { key: 'rare', pts: badgesConfig.tierPoints?.rare || 15 },
    { key: 'fun', pts: badgesConfig.tierPoints?.fun || 0 },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ═══ Header Tab Xếp hạng Sưu tập ═══ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 16,
          borderBottom: '1px solid #2A1145',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2
            style={{
              margin: 0,
              font: '700 26px/1 Oswald, sans-serif',
              letterSpacing: '.03em',
              textTransform: 'uppercase',
              color: '#FFFFFF',
            }}
          >
            {t('badges.leaderboard.title')}
          </h2>
          <div
            style={{
              font: "400 12.5px/1.4 'IBM Plex Mono', monospace",
              color: '#9C8ABE',
            }}
          >
            {t('badges.leaderboard.sub')}
          </div>
        </div>
      </div>

      {/* ═══ Nội dung 2 cột: Bảng Collector & Cột Phụ (Hiếm nhất CLB + Cách tính điểm) ═══ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 344px',
          gap: 18,
          alignItems: 'start',
        }}
      >
        {/* Cột trái: Bảng xếp hạng Collector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Header các cột của bảng */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '56px minmax(0, 1fr) 176px 104px 128px',
              gap: 14,
              padding: '0 16px',
            }}
          >
            <span
              style={{
                font: '600 10px/1 Oswald, sans-serif',
                letterSpacing: '.16em',
                color: '#7E6FA0',
              }}
            >
              {t('badges.leaderboard.colRank')}
            </span>
            <span
              style={{
                font: '600 10px/1 Oswald, sans-serif',
                letterSpacing: '.16em',
                color: '#7E6FA0',
              }}
            >
              {t('badges.leaderboard.colMember')}
            </span>
            <span
              style={{
                font: '600 10px/1 Oswald, sans-serif',
                letterSpacing: '.16em',
                color: '#7E6FA0',
              }}
            >
              {t('badges.leaderboard.colShelf')}
            </span>
            <span
              style={{
                font: '600 10px/1 Oswald, sans-serif',
                letterSpacing: '.16em',
                color: '#7E6FA0',
              }}
            >
              {t('badges.leaderboard.colCount')}
            </span>
            <span
              style={{
                textAlign: 'right',
                font: '600 10px/1 Oswald, sans-serif',
                letterSpacing: '.16em',
                color: '#7E6FA0',
              }}
            >
              {t('badges.leaderboard.colScore')}
            </span>
          </div>

          {/* Danh sách thành viên */}
          {collectorList.length === 0 ? (
            <div
              style={{
                padding: '36px 16px',
                textAlign: 'center',
                borderRadius: 12,
                background: 'rgba(23,10,39,.6)',
                border: '1px dashed #4C2673',
                color: '#9C8ABE',
                font: "400 13px/1.5 'IBM Plex Sans', sans-serif",
              }}
            >
              {t('badges.leaderboard.emptyList')}
            </div>
          ) : (
            collectorList.map((c, i) => {
            const isTop1 = c.rank === 1
            const isTop3 = c.rank <= 3
            const initial = c.name ? c.name.charAt(0).toUpperCase() : '?'
            const sigText = c.signature ? `“${c.signature}”` : ''

            return (
              <div
                key={c.id || i}
                onClick={() => onSelectMember && onSelectMember(c)}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'grid',
                  gridTemplateColumns: '56px minmax(0, 1fr) 176px 104px 128px',
                  gap: 14,
                  alignItems: 'center',
                  padding: '13px 16px',
                  clipPath: NOTCH_S_CLIP,
                  background: isTop1
                    ? 'linear-gradient(100deg, #2B0617, #160B26 60%)'
                    : 'rgba(255,255,255,.035)',
                  borderTop: isTop1 ? '1px solid #FF2E7E' : '1px solid transparent',
                  cursor: onSelectMember ? 'pointer' : 'default',
                  transition: 'background 0.15s ease',
                }}
              >
                {/* Vệt quét ánh sáng cho Top 1 */}
                {isTop1 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: 70,
                      height: '100%',
                      background:
                        'linear-gradient(90deg, transparent, rgba(255,226,75,.22), transparent)',
                      animation: 'aSweep 5s ease-in-out infinite',
                      pointerEvents: 'none',
                    }}
                  />
                )}

                {/* Cột 1: Plate Hạng lục giác */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    clipPath: HEX_CLIP,
                    display: 'grid',
                    placeItems: 'center',
                    font: '700 17px/1 Oswald, sans-serif',
                    background: isTop1
                      ? 'linear-gradient(135deg, #FF2E7E, #FFE24B)'
                      : isTop3
                        ? 'linear-gradient(135deg, #6D14FF, #C04BFF)'
                        : '#241640',
                    color: isTop1 ? '#140109' : isTop3 ? '#FBF0FF' : '#9C8ABE',
                  }}
                >
                  {c.rank}
                </div>

                {/* Cột 2: Avatar + Tên + Chữ ký */}
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      flex: '0 0 auto',
                      clipPath: HEX_CLIP,
                      display: 'grid',
                      placeItems: 'center',
                      font: '700 14px/1 Oswald, sans-serif',
                      background: '#241640',
                      color: '#C9B8E6',
                    }}
                  >
                    {initial}
                  </div>
                  <div
                    style={{
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                    }}
                  >
                    <span
                      style={{
                        font: "700 14px/1.2 'Be Vietnam Pro', sans-serif",
                        color: '#FFFFFF',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.name}
                    </span>
                    <span
                      style={{
                        font: "400 11px/1.2 'Be Vietnam Pro', sans-serif",
                        color: '#7E6FA0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {sigText}
                    </span>
                  </div>
                </div>

                {/* Cột 3: Kệ đang gắn (3 ô lục giác mini) */}
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                  }}
                >
                  {[0, 1, 2].map((slotIdx) => {
                    const item = c.shelf && c.shelf[slotIdx]
                    if (!item) {
                      return (
                        <div
                          key={slotIdx}
                          style={{
                            width: 34,
                            height: 34,
                            clipPath: HEX_CLIP,
                            background: 'rgba(255,255,255,.05)',
                            display: 'grid',
                            placeItems: 'center',
                          }}
                        >
                          <span style={{ fontSize: 10, color: '#4A3B66' }}>·</span>
                        </div>
                      )
                    }
                    return (
                      <BadgeHex
                        key={slotIdx}
                        tier={item.tier || 'rare'}
                        glyph={item.glyph || 'crystal'}
                        size={34}
                      />
                    )
                  })}
                </div>

                {/* Cột 4: Số huy hiệu */}
                <span
                  style={{
                    position: 'relative',
                    font: "400 12px/1 'IBM Plex Mono', monospace",
                    color: '#C9B8E6',
                  }}
                >
                  {c.count}
                </span>

                {/* Cột 5: Điểm sưu tập */}
                <span
                  style={{
                    textAlign: 'right',
                    font: '700 19px/1 Oswald, sans-serif',
                    color: isTop1 ? '#FFE24B' : '#FFFFFF',
                  }}
                >
                  {c.score}
                </span>
                </div>
              )
            })
          )}
        </div>

        {/* Cột phải: 1. Hiếm nhất CLB & 2. Cách tính điểm */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 1. Hiếm nhất CLB */}
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
            <div
              style={{
                font: '700 14px/1 Oswald, sans-serif',
                letterSpacing: '.12em',
                color: '#FFFFFF',
              }}
            >
              {t('badges.leaderboard.rarestTitle')}
            </div>

            {rarestList.length === 0 ? (
              <div
                style={{
                  padding: '16px',
                  textAlign: 'center',
                  color: '#9C8ABE',
                  font: "400 12.5px 'IBM Plex Sans', sans-serif",
                }}
              >
                {t('badges.leaderboard.emptyRarest')}
              </div>
            ) : (
              rarestList.map((r) => {
                return (
                  <div
                    key={r.id}
                    onClick={() => onViewBadge && onViewBadge(r)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: onViewBadge ? 'pointer' : 'default',
                    }}
                  >
                    <BadgeHex
                      tier={r.tier}
                      glyph={r.glyph || 'crystal'}
                      size={34}
                      spin={r.tier === 'legend'}
                    />
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        font: "600 13px/1.25 'Be Vietnam Pro', sans-serif",
                        color: '#FFFFFF',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.name}
                    </span>
                    <span
                      style={{
                        flex: '0 0 auto',
                        font: "600 11.5px/1 'IBM Plex Mono', monospace",
                        color: '#FFE24B',
                      }}
                    >
                      {r.own}
                    </span>
                  </div>
                )
              })
            )}
          </div>

          {/* 2. Cách tính điểm */}
          <div
            style={{
              padding: '17px 19px',
              clipPath: NOTCH_CLIP,
              background: 'rgba(255,255,255,.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: 11,
            }}
          >
            <div
              style={{
                font: '700 14px/1 Oswald, sans-serif',
                letterSpacing: '.12em',
                color: '#FFFFFF',
              }}
            >
              {t('badges.leaderboard.scoringTitle')}
            </div>

            {scoringTiers.map((s) => {
              const tTier = ANIME_TIERS[s.key] || ANIME_TIERS.rare
              return (
                <div
                  key={s.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      flex: '0 0 auto',
                      clipPath: HEX_CLIP,
                      background: tTier.ring,
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      font: '600 12px/1 Oswald, sans-serif',
                      letterSpacing: '.1em',
                      color: '#C9B8E6',
                    }}
                  >
                    {tTier.name}
                  </span>
                  <span
                    style={{
                      font: "600 12.5px/1 'IBM Plex Mono', monospace",
                      color: '#FFFFFF',
                    }}
                  >
                    {s.pts}
                  </span>
                </div>
              )
            })}

            <span
              style={{
                marginTop: 4,
                font: "400 11.5px/1.45 'Be Vietnam Pro', sans-serif",
                color: '#7E6FA0',
              }}
            >
              {t('badges.leaderboard.scoringNote')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
