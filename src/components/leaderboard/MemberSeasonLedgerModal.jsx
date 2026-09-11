import { useMemo } from 'react'
import { Avatar } from '#ds'
import { getMemberSeasonLedger } from '#lib/season.js'
import { t } from '#i18n'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { useMobile } from '#hooks/useMobile.js'

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
                  {' '}· {t('season.distanceToNext')} {rank - 1}{' '}
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-primary)', fontWeight: 600 }}>{ptsToNextRank}</span>
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
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              font: "400 11px/1.2 'IBM Plex Mono', monospace",
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: '#00B2A9' }} />
              {t('season.actMatchPlay')}: {breakdown.matchNetPts ?? 0}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: '#1D50A0' }} />
              {t('season.actStreakMilestones')}: +{breakdown.streakBonusPts ?? 0}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: '#C9A227' }} />
              {t('season.actUpsetMilestone')}: +{breakdown.upsetBonusPts ?? 0}
            </span>
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
                      display: 'grid',
                      gridTemplateColumns: '70px minmax(0,1fr) 56px',
                      gap: 10,
                      alignItems: 'center',
                      padding: '8px 10px',
                      borderRadius: 7,
                      background: ev.isUpset
                        ? (isDark ? 'rgba(201,162,39,.12)' : 'rgba(245,158,11,.10)')
                        : 'var(--surface-inset)',
                      border: ev.isUpset ? '1px solid #C9A227' : '1px solid var(--border-subtle)',
                      font: "400 12px/1.3 'IBM Plex Sans', sans-serif",
                    }}
                  >
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: ev.isUpset ? (isDark ? '#F0D26A' : '#92400E') : 'var(--text-muted)' }}>
                      {ev.time}
                    </span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                      {t(ev.titleKey, { score: ev.scoreText, gap: ev.gapText })}
                      {ev.streakBonus > 0 && (
                        <span style={{ marginLeft: 6, color: isDark ? '#5FDBD3' : '#0D9488', fontWeight: 600 }}>
                          {t('season.ledgerStreakBonus', { pts: ev.streakBonus })}
                        </span>
                      )}
                      {ev.upsetBonus > 0 && (
                        <span style={{ marginLeft: 6, color: isDark ? '#F0D26A' : '#B45309', fontWeight: 600 }}>
                          {t('season.ledgerUpsetBonus', { pts: ev.upsetBonus })}
                        </span>
                      )}
                    </span>
                    <span
                      style={{
                        textAlign: 'right',
                        fontFamily: "'IBM Plex Mono', monospace",
                        color: ev.isUpset
                          ? (isDark ? '#F0D26A' : '#B45309')
                          : (ev.numPts > 0 ? (isDark ? '#5FDBD3' : '#0D9488') : (isDark ? '#F87171' : '#DC2626')),
                        fontWeight: 600,
                      }}
                    >
                      {ev.pts}
                    </span>
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
