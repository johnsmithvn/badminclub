import React from 'react'
import { t } from '#i18n'
import BadgeHex from './BadgeHex.jsx'
import { ANIME_TIERS, NOTCH_CLIP, NOTCH_S_CLIP } from '#lib/badges.js'
import { useMobile } from '#hooks/useMobile.js'
import badgesConfig from '#config/badges.json'

/**
 * Màn A3 (Desktop) & AM3 (Mobile): Tab Bảng treo thưởng (Bảng truy nã).
 * Banner Hero mục tiêu số 1 + Danh sách 4 mục tiêu đang mở + Luật treo thưởng,
 * Huy hiệu thợ săn, và Lưu ý bảo toàn Elo.
 */
export default function BountyBoardTab({
  bounties = [],
  onChallenge,
  onViewBadge,
  seasonTag,
  hideHeader = false,
  isMobile: isMobileProp,
}) {
  const isMobileHook = useMobile(768)
  const isMobile = isMobileProp !== undefined ? isMobileProp : isMobileHook
  const cfg = badgesConfig.bounty || {}

  // 5 Luật treo thưởng từ config
  const rulesList = cfg.rules || []

  // 2 huy hiệu chỉ thợ săn mới có đọc từ config
  const hunterBadges = badgesConfig.hunterBadges || []

  // Bounties từ DB thật
  const activeBounties = bounties || []
  const heroBounty = activeBounties.length > 0 ? activeBounties[0] : null
  // Bắt đầu từ index 1: activeBounties[0] đã được vẽ to ở hero card phía trên.
  const displayBounties = activeBounties.slice(1, 5)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? 14 : 20,
        position: 'relative',
        width: '100%',
      }}
    >
      {/* ═══ Header Bảng truy nã (ẩn trên Mobile AM3 vì Badges.jsx đã render header tab) ═══ */}
      {!hideHeader && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: isMobile ? 12 : 16,
            borderBottom: '1px solid #2A1145',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2
            style={{
              margin: 0,
              font: `700 ${isMobile ? '22px' : '26px'}/1 Oswald, sans-serif`,
              letterSpacing: '.03em',
              textTransform: 'uppercase',
              color: '#FFFFFF',
            }}
          >
            {t('badges.bountyBoard.title')}
          </h2>
          <div
            style={{
              font: "400 11.5px/1.4 'IBM Plex Mono', monospace",
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
            padding: '8px 12px',
            clipPath: NOTCH_S_CLIP,
            background: 'rgba(255,46,126,.18)',
            borderTop: '1px solid #FF2E7E',
            color: '#FFC46B',
          }}
        >
          {seasonTag || t('badges.bountyBoard.seasonTag')}
        </span>
      </div>
    )}

      {/* ═══ Bố cục chính: Cột trái (Banner + Mục tiêu) & Cột phải (Luật & Huy hiệu thợ săn) ═══ */}
      <div
        style={{
          display: isMobile ? 'flex' : 'grid',
          flexDirection: isMobile ? 'column' : undefined,
          gridTemplateColumns: isMobile ? undefined : 'minmax(0, 1fr) 372px',
          gap: isMobile ? 16 : 18,
          alignItems: 'start',
        }}
      >
        {/* Cột trái: Banner Hero Poster + Grid 4 mục tiêu */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, width: '100%' }}>
          {/* 1. Banner Hero Poster nổi bật trên cùng (AM3 / A3) */}
          {heroBounty && (
            <div
              style={{
                flex: '0 0 auto',
                padding: 1,
                clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
                background: 'linear-gradient(120deg, #FF2E7E, #FFE24B 60%, #6D14FF)',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
                  background: 'linear-gradient(120deg, #2B0617, #3D0722 60%, #17022B)',
                  padding: isMobile ? '16px 14px' : '20px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {/* Tia sáng quét và đường tốc độ speed lines anime */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: 'repeating-linear-gradient(100deg, rgba(255,255,255,.07) 0 2px, transparent 2px 10px)',
                    animation: 'aSpeed 1.6s linear infinite',
                    opacity: 0.5,
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: 140,
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.16), transparent)',
                    animation: 'aSweep 6s ease-in-out infinite',
                    pointerEvents: 'none',
                  }}
                />

                {/* Hàng 1: BadgeHex + Nhãn ĐANG BỊ TREO THƯỞNG + Tên VĐV */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <BadgeHex
                    tier={heroBounty.tier || 'legend'}
                    glyph={heroBounty.glyph || (heroBounty.hot ? 'flame' : 'thunder')}
                    size={isMobile ? 56 : 66}
                    spin
                    pulse
                  />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span
                      style={{
                        font: "700 9.5px/1 'Oswald', sans-serif",
                        letterSpacing: '.16em',
                        color: '#140109',
                        background: 'linear-gradient(135deg, #FFE24B, #FF7A18)',
                        padding: '4px 8px',
                        alignSelf: 'flex-start',
                        clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                      }}
                    >
                      {t('badges.bountyBoard.heroWantedTag')}
                    </span>
                    <span
                      style={{
                        font: `700 ${isMobile ? '18px' : '22px'}/1.15 'Oswald', sans-serif`,
                        letterSpacing: '.02em',
                        textTransform: 'uppercase',
                        color: '#FFFFFF',
                        textShadow: '0 2px 0 #7A0A2E',
                      }}
                    >
                      {t('badges.bountyBoard.heroWinStreak', { name: heroBounty.name, streak: heroBounty.streak })}
                    </span>
                  </div>
                </div>

                {/* Hàng 2: Thanh tiến trình chuỗi */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ font: "600 10px/1 'Oswald', sans-serif", letterSpacing: '.14em', color: '#FFC46B' }}>
                    {t('badges.bountyBoard.heroStreakLabel')}
                  </span>
                  <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,.1)', borderRadius: 2, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, Math.round((heroBounty.streak / 10) * 100))}%`,
                        background: 'linear-gradient(90deg, #FF2E7E, #FFE24B)',
                      }}
                    />
                  </div>
                  <span style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: '#FFE24B' }}>
                    {heroBounty.streak} / 10
                  </span>
                </div>

                {/* Hàng 3: Thỏi thưởng XP & SP */}
                <div style={{ position: 'relative', display: 'flex', gap: 8 }}>
                  <span
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      font: "700 13px/1 'Oswald', sans-serif",
                      letterSpacing: '.05em',
                      color: '#FFC46B',
                      background: 'rgba(20,1,9,.6)',
                      borderTop: '1px solid #FF7A18',
                      padding: '9px 6px',
                      clipPath: NOTCH_S_CLIP,
                    }}
                  >
                    +{heroBounty.xp || 100} XP
                  </span>
                  <span
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      font: "700 13px/1 'Oswald', sans-serif",
                      letterSpacing: '.05em',
                      color: '#5FEBD0',
                      background: 'rgba(1,19,15,.6)',
                      borderTop: '1px solid #0E9F8E',
                      padding: '9px 6px',
                      clipPath: NOTCH_S_CLIP,
                    }}
                  >
                    +{heroBounty.sp || 15} {t('badges.collectorProfile.seasonPoints')}
                  </span>
                </div>

                {/* Hàng 4: Nút GẠ KÈO NGAY */}
                <button
                  type="button"
                  onClick={() => onChallenge && onChallenge(heroBounty)}
                  style={{
                    position: 'relative',
                    textAlign: 'center',
                    font: "700 12.5px/1 'Oswald', sans-serif",
                    letterSpacing: '.14em',
                    color: '#140109',
                    background: 'linear-gradient(135deg, #FFE24B, #FF7A18)',
                    padding: '13px',
                    clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'filter 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.15)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)' }}
                >
                  {t('badges.bountyBoard.challengeNow')}
                </button>
              </div>
            </div>
          )}

          {/* 2. Danh sách 4 Mục tiêu đang mở (Lưới 2 cột trên Desktop, Dọc trên Mobile) */}
          <div
            style={{
              display: isMobile ? 'flex' : 'grid',
              flexDirection: isMobile ? 'column' : undefined,
              gridTemplateColumns: isMobile ? undefined : 'repeat(2, minmax(0, 1fr))',
              gap: isMobile ? 12 : 16,
              alignContent: 'start',
            }}
          >
            {displayBounties.length === 0 ? (
              <div
                style={{
                  gridColumn: isMobile ? undefined : '1 / -1',
                  padding: '40px 20px',
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
              displayBounties.map((b) => {
                const tTier = ANIME_TIERS[b.tier] || ANIME_TIERS.rare
                const pct = Math.min(100, Math.round((b.streak / 10) * 100))

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
                          size={54}
                          spin={b.tier === 'legend'}
                          pulse={b.hot}
                        />

                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                          }}
                        >
                          <span
                            style={{
                              font: `700 ${isMobile ? '17px' : '20px'}/1 Oswald, sans-serif`,
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
                              font: "400 11px/1.3 'IBM Plex Mono', monospace",
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
                            padding: '4px 8px',
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
                          gap: 10,
                        }}
                      >
                        <span
                          style={{
                            font: '600 10px/1 Oswald, sans-serif',
                            letterSpacing: '.14em',
                            color: '#9C8ABE',
                          }}
                        >
                          {t('badges.streak')}
                        </span>
                        <div
                          style={{
                            flex: 1,
                            height: 7,
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
                            font: "600 11.5px/1 'IBM Plex Mono', monospace",
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
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            font: '700 12px/1 Oswald, sans-serif',
                            letterSpacing: '.06em',
                            color: '#FFC46B',
                            background: 'rgba(20,1,9,.5)',
                            borderTop: '1px solid #FF7A18',
                            padding: '8px 10px',
                            clipPath: NOTCH_S_CLIP,
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                        >
                          +{b.xp || 100} XP
                        </span>
                        <span
                          style={{
                            font: '700 12px/1 Oswald, sans-serif',
                            letterSpacing: '.06em',
                            color: '#5FEBD0',
                            background: 'rgba(1,19,15,.5)',
                            borderTop: '1px solid #0E9F8E',
                            padding: '8px 10px',
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
                            font: "400 10.5px/1 'IBM Plex Mono', monospace",
                            color: '#7E6FA0',
                          }}
                        >
                          {t('badges.bountyBoard.triesCount', { count: b.tries || 0 })}
                        </span>
                      </div>

                      {/* Nút Call-To-Action: GẠ KÈO */}
                      <button
                        type="button"
                        onClick={() => onChallenge && onChallenge(b)}
                        style={{
                          position: 'relative',
                          textAlign: 'center',
                          padding: '10px 14px',
                          clipPath: NOTCH_S_CLIP,
                          font: '600 12px/1 Oswald, sans-serif',
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
                        onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.2)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)' }}
                      >
                        {b.hot ? t('badges.bountyBoard.challengeNow') : t('badges.bountyBoard.challenge')}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Cột phải (hoặc bên dưới trên mobile): 3 khối thông tin đặc trưng */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
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

