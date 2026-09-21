import { useMemo } from 'react'
import { Avatar } from '#ds'
import { getMemberSeasonLedger } from '#lib/season.js'
import cfg from '#config/app.json'
import { t } from '#i18n'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { useMobile } from '#hooks/useMobile.js'

function getTierPill(gap, gapText, isDark) {
  const g = typeof gap === 'number' ? gap : 0
  if (g >= 150) {
    return {
      text: t('season.tierPillHeavyFavored', { gap: gapText }),
      color: isDark ? '#5FDBD3' : '#0F766E',
      bg: isDark ? 'rgba(0, 178, 169, 0.20)' : 'rgba(13, 148, 136, 0.14)',
      border: isDark ? '1px solid rgba(0, 178, 169, 0.40)' : '1px solid rgba(13, 148, 136, 0.28)',
    }
  }
  if (g >= 50) {
    return {
      text: t('season.tierPillFavored', { gap: gapText }),
      color: isDark ? '#5FDBD3' : '#0F766E',
      bg: isDark ? 'rgba(0, 178, 169, 0.16)' : 'rgba(13, 148, 136, 0.12)',
      border: isDark ? '1px solid rgba(0, 178, 169, 0.32)' : '1px solid rgba(13, 148, 136, 0.22)',
    }
  }
  if (g > -50) {
    return {
      text: t('season.tierPillBalanced', { gap: gapText }),
      color: isDark ? '#94A3B8' : '#475569',
      bg: isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(148, 163, 184, 0.12)',
      border: isDark ? '1px solid rgba(148, 163, 184, 0.30)' : '1px solid rgba(148, 163, 184, 0.22)',
    }
  }
  if (g > -150) {
    return {
      text: t('season.tierPillUnderdog', { gap: gapText }),
      color: isDark ? '#FB923C' : '#EA580C',
      bg: isDark ? 'rgba(249, 115, 22, 0.18)' : 'rgba(249, 115, 22, 0.12)',
      border: isDark ? '1px solid rgba(249, 115, 22, 0.35)' : '1px solid rgba(249, 115, 22, 0.25)',
    }
  }
  return {
    text: t('season.tierPillDeepUnderdog', { gap: gapText }),
    color: isDark ? '#FF9A8F' : '#DC2626',
    bg: isDark ? 'rgba(225, 68, 52, 0.20)' : 'rgba(220, 38, 38, 0.14)',
    border: isDark ? '1px solid rgba(225, 68, 52, 0.40)' : '1px solid rgba(220, 38, 38, 0.30)',
  }
}

export default function MemberSeasonLedgerModal({
  memberId,
  db,
  seasonConfig,
  onClose,
  onViewCareerElo,
  isMobile: isMobileProp,
}) {
  const { isDark } = useTheme()
  const isMobileHook = useMobile()
  const isMobile = isMobileProp !== undefined ? isMobileProp : isMobileHook

  const ledgerData = useMemo(() => {
    if (!memberId || !db) return null
    return getMemberSeasonLedger(memberId, db, seasonConfig)
  }, [memberId, db, seasonConfig])

  if (!memberId || !ledgerData) return null

  const {
    season,
    member,
    totalPoints,
    rank,
    totalMembers,
    latestSessionPts,
    ptsToNextRank,
    breakdown,
    recentEvents,
  } = ledgerData

  // Hệ số điểm mùa của kèo — hiện thẳng trên tag để người chơi thấy phần thưởng, không phải đoán
  // vì sao cùng một dải Elo mà trận này ăn gấp đôi trận kia.
  const chalMult = Number(season?.challengeMultiplier ?? cfg?.season?.challengeMultiplier ?? 1) || 1

  // Tỷ lệ thanh phân bổ Stacked Bar
  const total = Math.max(1, totalPoints)
  const pMatchNet = Math.round((Math.max(0, breakdown.matchNetPts ?? breakdown.winPts ?? 0) / total) * 100)
  const pStreak = Math.round(((breakdown.streakBonusPts ?? 0) / total) * 100)
  const pUpsets = Math.max(0, 100 - pMatchNet - pStreak)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : 16,
      }}
      onClick={onClose}
    >
      <div
        data-screen-label={isMobile ? 'SS3-M So diem mua giai' : 'SS3 So diem mua giai'}
        style={{
          width: isMobile ? '100%' : 560,
          maxWidth: '100%',
          background: 'var(--surface-overlay)',
          border: isMobile ? 'none' : '1px solid var(--border-default)',
          borderTop: '1px solid var(--border-default)',
          borderRadius: isMobile ? '18px 18px 0 0' : 12,
          boxShadow: isMobile ? '0 -18px 44px rgba(0,0,0,.55)' : 'var(--shadow-overlay)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: isMobile ? '88vh' : '90vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle on mobile */}
        {isMobile && (
          <div style={{ padding: '10px 0 0', display: 'flex', justifyContent: 'center' }}>
            <span style={{ width: 38, height: 4, borderRadius: 999, background: 'var(--border-default)' }} />
          </div>
        )}

        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Avatar name={member?.name} src={member?.avatarUrl || member?.avatar} size={36} />
          <div style={{ flex: '1 1 0%', minWidth: 0 }}>
            <div style={{ font: '600 16px/1.25 Barlow, sans-serif', color: 'var(--text-primary)' }}>
              {t('season.ledgerTitle', { name: member?.name || '' })}
            </div>
            <div style={{ font: "400 12px/1.4 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
              {(season?.name ? `${season.name} · ` : '') + t('season.rankOf', { rank, total: totalMembers })}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              font: "600 16px/1 'IBM Plex Mono', monospace",
              color: 'var(--text-muted)',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '16px 18px', display: 'grid', gap: 14, overflowY: 'auto' }}>
          {/* Big Score Header */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ font: "600 40px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
              {totalPoints.toLocaleString()}
            </div>
            <div style={{ paddingBottom: 6, font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
              {t('season.pointsLabel')} ·{' '}
              <span style={{ color: isDark ? '#5FDBD3' : 'var(--teal-700)', fontWeight: 600 }}>+{latestSessionPts}</span> {t('season.latestSession')}
              {rank > 1 && (
                <>
                  {' '}· {t('season.distanceToNext', { rank: rank - 1, pts: ptsToNextRank })}
                </>
              )}
            </div>
          </div>

          {/* Stacked Progress Bar */}
          <div
            style={{
              height: 26,
              borderRadius: 6,
              overflow: 'hidden',
              display: 'flex',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div
              style={{
                width: `${pMatchNet}%`,
                background: '#00B2A9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                font: "600 10px/1 'IBM Plex Mono', monospace",
                color: '#fff',
              }}
            >
              {breakdown.matchNetPts ?? 0}
            </div>
            <div
              style={{
                width: `${pStreak}%`,
                background: '#1D50A0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                font: "600 10px/1 'IBM Plex Mono', monospace",
                color: '#fff',
              }}
            >
              {breakdown.streakBonusPts ?? 0}
            </div>
            <div
              style={{
                width: `${pUpsets}%`,
                background: '#C9A227',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                font: "600 10px/1 'IBM Plex Mono', monospace",
                color: '#2A1F00',
              }}
            >
              {breakdown.upsetBonusPts ?? 0}
            </div>
          </div>

          {/* Stacked Bar Legend */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
              gap: 8,
              font: "500 11.5px/1.2 'IBM Plex Mono', monospace",
              color: 'var(--text-secondary)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 10px',
                background: 'var(--surface-inset)',
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#00B2A9', flexShrink: 0 }} />
                <span>{t('season.actMatchPlay')}</span>
              </span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                {breakdown.matchNetPts ?? 0}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 10px',
                background: 'var(--surface-inset)',
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#1D50A0', flexShrink: 0 }} />
                <span>{t('season.actStreakMilestones')}</span>
              </span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                +{breakdown.streakBonusPts ?? 0}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 10px',
                background: 'var(--surface-inset)',
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#C9A227', flexShrink: 0 }} />
                <span>{t('season.actUpsetMilestone')}</span>
              </span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                +{breakdown.upsetBonusPts ?? 0}
              </span>
            </div>
          </div>

          {/* Audit Events Timeline */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12, display: 'grid', gap: 8 }}>
            <div
              style={{
                font: "600 12px/1.2 'IBM Plex Sans', sans-serif",
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}
            >
              {t('season.recentSessionTitle')} · {latestSessionPts >= 0 ? `+${latestSessionPts}` : `${latestSessionPts}`}
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              {recentEvents && recentEvents.length > 0 ? (
                recentEvents.map((ev, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      padding: '9px 12px',
                      borderRadius: 8,
                      background: ev.isUpset
                        ? (isDark ? 'rgba(201,162,39,.12)' : 'rgba(245,158,11,.10)')
                        : 'var(--surface-inset)',
                      border: ev.isUpset ? '1px solid #C9A227' : '1px solid var(--border-subtle)',
                      font: "400 12px/1.3 'IBM Plex Sans', sans-serif",
                    }}
                  >
                    {/* Hàng 1: Thời gian · Tag Trận/Kèo · Highlight Pill Elo Gap · Điểm số +/- */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: ev.isUpset ? (isDark ? '#F0D26A' : '#92400E') : 'var(--text-muted)' }}>
                          {ev.time}
                        </span>

                        {/* Tag Trận vs Kèo */}
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            padding: '2px 6px',
                            borderRadius: 4,
                            font: "600 10.5px/1 'IBM Plex Sans', sans-serif",
                            background: ev.isChallenge
                              ? (isDark ? 'rgba(249, 115, 22, 0.2)' : 'rgba(249, 115, 22, 0.12)')
                              : (isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(14, 165, 233, 0.12)'),
                            color: ev.isChallenge ? (isDark ? '#FB923C' : '#EA580C') : (isDark ? '#38BDF8' : '#0284C7'),
                            border: ev.isChallenge
                              ? '1px solid rgba(249, 115, 22, 0.35)'
                              : '1px solid rgba(56, 189, 248, 0.25)',
                          }}
                          title={(ev.isChallenge && chalMult > 1) ? t('season.tagChallengeMultHint', { mult: chalMult }) : undefined}
                        >
                          {ev.isChallenge
                            ? (chalMult > 1 ? t('season.tagChallengeMult', { mult: chalMult }) : t('season.tagChallenge'))
                            : t('season.tagMatch')}
                        </span>

                        {/* Highlight Pill Elo Gap: Kèo trên / Kèo cân / Kèo dưới */}
                        {ev.gapText && (() => {
                          const pill = getTierPill(ev.gap, ev.gapText, isDark)
                          return (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '2px 7px',
                                borderRadius: 4,
                                font: "600 11px/1.2 'IBM Plex Sans', sans-serif",
                                background: pill.bg,
                                color: pill.color,
                                border: pill.border,
                              }}
                            >
                              {pill.text}
                            </span>
                          )
                        })()}

                        {ev.streakBonus > 0 && (
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: 4,
                              font: "600 10.5px/1 'IBM Plex Sans', sans-serif",
                              background: isDark ? 'rgba(95, 219, 211, 0.2)' : 'rgba(13, 148, 136, 0.15)',
                              color: isDark ? '#5FDBD3' : '#0D9488',
                            }}
                          >
                            {t('season.ledgerStreakBonus', { pts: ev.streakBonus })}
                          </span>
                        )}

                        {ev.upsetBonus > 0 && (
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: 4,
                              font: "600 10.5px/1 'IBM Plex Sans', sans-serif",
                              background: isDark ? 'rgba(201, 162, 39, 0.25)' : 'rgba(217, 119, 6, 0.18)',
                              color: isDark ? '#F0D26A' : '#B45309',
                            }}
                          >
                            {t('season.ledgerUpsetBonus', { pts: ev.upsetBonus })}
                          </span>
                        )}
                      </div>

                      {/* Season Points Delta */}
                      <span
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: 14,
                          color: ev.isUpset
                            ? (isDark ? '#F0D26A' : '#B45309')
                            : (ev.numPts > 0 ? (isDark ? '#5FDBD3' : '#0D9488') : (ev.numPts < 0 ? (isDark ? '#F87171' : '#DC2626') : 'var(--text-muted)')),
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {ev.pts}
                      </span>
                    </div>

                    {/* Hàng 2: Kết quả & Tỷ số + Ai với ai */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
                      <span
                        style={{
                          fontWeight: 600,
                          color: ev.type === 'win'
                            ? (isDark ? '#5FDBD3' : '#0D9488')
                            : (isDark ? '#F87171' : '#DC2626'),
                        }}
                      >
                        {ev.type === 'win'
                          ? (ev.scoreText ? t('season.winScore', { score: ev.scoreText }) : t('season.matchWin'))
                          : (ev.scoreText ? t('season.lossScore', { score: ev.scoreText }) : t('season.matchLoss'))}
                      </span>

                      {(ev.oppNamesStr || ev.partnerName) && (
                        <>
                          <span style={{ color: 'var(--text-muted)' }}>·</span>
                          <span style={{ color: 'var(--text-secondary)', flex: '1 1 auto', minWidth: 0, overflowWrap: 'anywhere' }}>
                            {ev.partnerName
                              ? t('season.matchWithPartnerVs', { partner: ev.partnerName, opponents: ev.oppNamesStr })
                              : t('season.matchVsOpponents', { opponents: ev.oppNamesStr })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '8px 10px', color: 'var(--text-muted)', font: "400 12px/1.4 'IBM Plex Sans', sans-serif" }}>
                  {t('season.noMatchesInSeason')}
                </div>
              )}
            </div>
          </div>

          {/* Footer Notice */}
          <div
            style={{
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 12,
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'stretch' : 'center',
              gap: 10,
            }}
          >
            <span
              style={{
                font: "400 12px/1.45 'IBM Plex Sans', sans-serif",
                color: 'var(--text-muted)',
                flex: isMobile ? 'none' : '1 1 180px',
                minWidth: isMobile ? 'auto' : 180,
              }}
            >
              {t('season.ledgerFooterNote', { name: member?.name || '' })}
            </span>
            {onViewCareerElo && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onViewCareerElo(memberId)
                }}
                style={{
                  font: "600 13px/1 'IBM Plex Sans', sans-serif",
                  padding: isMobile ? '13px 14px' : '9px 14px',
                  borderRadius: isMobile ? 8 : 6,
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  width: isMobile ? '100%' : 'auto',
                  transition: 'all 0.15s ease',
                }}
              >
                {t('season.viewCareerElo')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
