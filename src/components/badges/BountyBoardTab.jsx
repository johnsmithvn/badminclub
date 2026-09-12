import React from 'react'
import { t } from '#i18n'
import BadgeHex from './BadgeHex.jsx'
import { ANIME_TIERS, NOTCH_CLIP, NOTCH_S_CLIP } from '#lib/badges.js'
import badgesConfig from '#config/badges.json'

/**
 * Màn A3: Tab Bảng treo thưởng (Bảng truy nã).
 * Hiển thị các mục tiêu đang có chuỗi thắng cao bị treo thưởng,
 * luật treo thưởng, các huy hiệu độc quyền thợ săn, và lưu ý bảo toàn Elo.
 */
export default function BountyBoardTab({
  bounties = [],
  onChallenge,
  onViewBadge,
  seasonTag,
}) {
  const cfg = badgesConfig.bounty || {}

  // 5 Luật treo thưởng từ config
  const rulesList = cfg.rules || []

  // 2 huy hiệu chỉ thợ săn mới có đọc từ config
  const hunterBadges = badgesConfig.hunterBadges || []

  // Bounties từ DB thật (không dùng demo fallback)
  const activeBounties = bounties || []

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        position: 'relative',
      }}
    >
      {/* ═══ Header Bảng truy nã ═══ */}
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
            {t('badges.bountyBoard.title')}
          </h2>
          <div
            style={{
              font: "400 12.5px/1.4 'IBM Plex Mono', monospace",
              color: '#9C8ABE',
            }}
          >
            {t('badges.bountyBoard.sub', { count: activeBounties.length })}
          </div>
        </div>

        <span
          style={{
            font: '700 11px/1 Oswald, sans-serif',
            letterSpacing: '.16em',
            padding: '9px 13px',
            clipPath: NOTCH_S_CLIP,
            background: 'rgba(255,46,126,.18)',
            borderTop: '1px solid #FF2E7E',
            color: '#FFC46B',
          }}
        >
          {seasonTag || t('badges.bountyBoard.seasonTag')}
        </span>
      </div>

      {/* ═══ Nội dung 2 cột: Danh sách Poster truy nã & Khối thông tin luật ═══ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 372px',
          gap: 18,
          alignItems: 'start',
        }}
      >
        {/* Cột trái: 2x2 Grid Bounty Posters */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
            alignContent: 'start',
          }}
        >
          {activeBounties.length === 0 ? (
            <div
              style={{
                gridColumn: '1 / -1',
                padding: '44px 20px',
                textAlign: 'center',
                borderRadius: 12,
                background: 'rgba(23,10,39,.6)',
                border: '1px dashed #4C2673',
                display: 'grid',
                gap: 8,
                justifyItems: 'center',
              }}
            >
              <span style={{ fontSize: 32 }}>🎯</span>
              <span
                style={{
                  font: '700 16px/1.2 Oswald, sans-serif',
                  letterSpacing: '.04em',
                  textTransform: 'uppercase',
                  color: '#FFFFFF',
                }}
              >
                {t('badges.bountyBoard.emptyTitle')}
              </span>
              <span
                style={{
                  font: "400 13px/1.5 'IBM Plex Sans', sans-serif",
                  color: '#9C8ABE',
                  maxWidth: 380,
                }}
              >
                {t('badges.bountyBoard.emptyDesc')}
              </span>
            </div>
          ) : (
            activeBounties.map((b) => {
              const tTier = ANIME_TIERS[b.tier] || ANIME_TIERS.rare
              const pct = Math.min(100, Math.round((b.streak / 10) * 100))

              // Text meta hiển thị chuẩn xác
              const metaText = b.streakDate
                ? t('badges.bountyBoard.openStreakSince', { date: b.streakDate })
                : b.winRate
                  ? t('badges.bountyBoard.pairMeta', { rate: b.winRate })
                  : b.meta || t('badges.bountyBoard.streakMetaFallback', { streak: b.streak })

            return (
              <div
                key={b.id}
                style={{
                  position: 'relative',
                  padding: 1,
                  clipPath: NOTCH_CLIP,
                  background: tTier.edge || tTier.ring,
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    clipPath: NOTCH_CLIP,
                    background: tTier.panel,
                    padding: '16px 18px 15px',
                    display: 'grid',
                    gap: 12,
                  }}
                >
                  {/* Tia sáng conic xoay ngược tạo chiều sâu anime */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '-60%',
                      right: '-30%',
                      width: 420,
                      height: 420,
                      background: `repeating-conic-gradient(from 0deg, ${tTier.aura} 0deg 5deg, transparent 5deg 14deg)`,
                      animation: 'aSpinBack 26s linear infinite',
                      opacity: 0.5,
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Header thẻ: Badge Lục giác + Tên đối tượng + Tag bậc */}
                  <div
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                    }}
                  >
                    <BadgeHex
                      tier={b.tier}
                      glyph={b.glyph || (b.hot ? 'flame' : 'thunder')}
                      size={62}
                      spin={b.tier === 'legend'}
                      pulse={b.hot}
                    />

                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          font: '700 22px/1 Oswald, sans-serif',
                          letterSpacing: '.04em',
                          textTransform: 'uppercase',
                          color: '#FFFFFF',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {b.name}
                      </span>
                      <span
                        style={{
                          font: "400 11.5px/1.3 'IBM Plex Mono', monospace",
                          color: '#9C8ABE',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {metaText}
                      </span>
                    </div>

                    <span
                      style={{
                        font: '600 9.5px/1 Oswald, sans-serif',
                        letterSpacing: '.14em',
                        padding: '5px 9px',
                        clipPath: NOTCH_S_CLIP,
                        background: tTier.chipBg,
                        borderTop: `1px solid ${tTier.bd}`,
                        color: tTier.ink,
                        flexShrink: 0,
                      }}
                    >
                      {tTier.name}
                    </span>
                  </div>

                  {/* Thanh tiến trình chuỗi thắng */}
                  <div
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 11,
                    }}
                  >
                    <span
                      style={{
                        font: '600 10.5px/1 Oswald, sans-serif',
                        letterSpacing: '.14em',
                        color: '#9C8ABE',
                      }}
                    >
                      {t('badges.streak')}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 8,
                        clipPath: NOTCH_S_CLIP,
                        background: 'rgba(255,255,255,.08)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: tTier.edge || tTier.ring,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    <span
                      style={{
                        font: "600 12px/1 'IBM Plex Mono', monospace",
                        color: '#FFE24B',
                      }}
                    >
                      {b.streak} / 10
                    </span>
                  </div>

                  {/* Tag phần thưởng treo & lượt thử */}
                  <div
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        font: '700 13px/1 Oswald, sans-serif',
                        letterSpacing: '.06em',
                        color: '#FFC46B',
                        background: 'rgba(20,1,9,.5)',
                        borderTop: '1px solid #FF7A18',
                        padding: '9px 12px',
                        clipPath: NOTCH_S_CLIP,
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      +{b.xp || 100} XP
                    </span>
                    <span
                      style={{
                        font: '700 13px/1 Oswald, sans-serif',
                        letterSpacing: '.06em',
                        color: '#5FEBD0',
                        background: 'rgba(1,19,15,.5)',
                        borderTop: '1px solid #0E9F8E',
                        padding: '9px 12px',
                        clipPath: NOTCH_S_CLIP,
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      +{b.sp || 15} {t('badges.collectorProfile.seasonPoints')}
                    </span>
                    <div style={{ flex: 1 }} />
                    <span
                      style={{
                        font: "400 11px/1 'IBM Plex Mono', monospace",
                        color: '#7E6FA0',
                      }}
                    >
                      {t('badges.bountyBoard.triesCount', { count: b.tries || 0 })}
                    </span>
                  </div>

                  {/* Nút Call-To-Action: GẠ KÈO NGAY hoặc GẠ KÈO */}
                  <button
                    type="button"
                    onClick={() => onChallenge && onChallenge(b)}
                    style={{
                      position: 'relative',
                      textAlign: 'center',
                      padding: '11px 16px',
                      clipPath: NOTCH_S_CLIP,
                      font: '600 12.5px/1 Oswald, sans-serif',
                      letterSpacing: '.12em',
                      cursor: 'pointer',
                      border: 'none',
                      outline: 'none',
                      color: b.hot ? '#140109' : tTier.ink || '#FFFFFF',
                      background: b.hot
                        ? tTier.edge || 'linear-gradient(135deg, #FF2E7E, #FFE24B 70%)'
                        : 'rgba(255,255,255,.06)',
                      borderTop: b.hot ? undefined : `1px solid ${tTier.bd || '#6D14FF'}`,
                      transition: 'transform 0.15s ease, filter 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.filter = 'brightness(1.2)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.filter = 'brightness(1)'
                    }}
                  >
                    {b.hot ? t('badges.challengeNow') : t('badges.challenge')}
                  </button>
                </div>
              </div>
            )
          }))}
        </div>

        {/* Cột phải: Luật treo thưởng & 2 Huy hiệu Thợ săn & Elo Integrity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 1. Luật treo thưởng */}
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
              {t('badges.bountyBoard.rulesTitle')}
            </div>

            {rulesList.map((rule, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    flex: '0 0 auto',
                    marginTop: 6,
                    clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                    background: 'linear-gradient(135deg,#FF2E7E,#FFE24B)',
                  }}
                />
                <span
                  style={{
                    font: "400 12.5px/1.5 'Be Vietnam Pro', sans-serif",
                    color: '#C9B8E6',
                  }}
                >
                  {rule}
                </span>
              </div>
            ))}
          </div>

          {/* 2. Huy hiệu chỉ thợ săn mới có */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                font: '700 13px/1 Oswald, sans-serif',
                letterSpacing: '.12em',
                color: '#FFFFFF',
              }}
            >
              {t('badges.bountyBoard.hunterBadgesTitle')}
            </div>

            {hunterBadges.map((hb) => {
              const tTier = ANIME_TIERS[hb.tier] || ANIME_TIERS.rare
              const hbName = t(`badges.items.${hb.id}.name`, { defaultValue: hb.name })
              const hbCond = t(`badges.items.${hb.id}.cond`, { defaultValue: hb.cond })

              return (
                <div
                  key={hb.id}
                  onClick={() => onViewBadge && onViewBadge(hb)}
                  style={{
                    position: 'relative',
                    padding: 1,
                    clipPath: NOTCH_CLIP,
                    background: tTier.edge || tTier.ring,
                    cursor: onViewBadge ? 'pointer' : 'default',
                  }}
                >
                  <div
                    style={{
                      clipPath: NOTCH_CLIP,
                      background: tTier.panel,
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                    }}
                  >
                    <BadgeHex
                      tier={hb.tier}
                      glyph={hb.glyph || (hb.tier === 'legend' ? 'flame' : 'thunder')}
                      size={52}
                      spin={hb.tier === 'legend'}
                    />
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          font: "700 15px/1.2 'Be Vietnam Pro', sans-serif",
                          color: '#FFFFFF',
                        }}
                      >
                        {hbName}
                      </span>
                      <span
                        style={{
                          font: "400 11.5px/1.4 'Be Vietnam Pro', sans-serif",
                          color: '#9C8ABE',
                        }}
                      >
                        {hbCond}
                      </span>
                    </div>
                    <span
                      style={{
                        font: '600 9.5px/1 Oswald, sans-serif',
                        letterSpacing: '.14em',
                        padding: '5px 9px',
                        clipPath: NOTCH_S_CLIP,
                        background: tTier.chipBg,
                        borderTop: `1px solid ${tTier.bd}`,
                        color: tTier.ink,
                        flexShrink: 0,
                      }}
                    >
                      {tTier.name}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 3. Lưu ý bảo toàn Elo */}
          <div
            style={{
              padding: '16px 19px',
              clipPath: NOTCH_CLIP,
              background: 'rgba(46,233,255,.07)',
              borderTop: '1px solid #1B7BE0',
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
            }}
          >
            <span
              style={{
                font: '700 12px/1 Oswald, sans-serif',
                letterSpacing: '.14em',
                color: '#7FE7FF',
              }}
            >
              {t('badges.bountyBoard.eloIntegrityTitle')}
            </span>
            <span
              style={{
                font: "400 12.5px/1.5 'Be Vietnam Pro', sans-serif",
                color: '#C9B8E6',
              }}
            >
              {t('badges.bountyBoard.eloIntegrityDesc')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
