import { useMemo } from 'react'
import { getMemberSeasonLedger } from '#lib/xp.js'
import { t } from '#i18n'

export default function MemberSeasonLedgerModal({
  memberId,
  db,
  seasonConfig,
  onClose,
  onViewCareerElo,
}) {
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
  const pAttendance = Math.round((breakdown.attendancePts / total) * 100)
  const pMatches = Math.round((breakdown.matchPlayPts / total) * 100)
  const pWins = Math.round((breakdown.winPts / total) * 100)
  const pUpsets = Math.max(0, 100 - pAttendance - pMatches - pWins)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,.70)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        data-screen-label="SS3 So diem mua giai"
        style={{
          width: 560,
          maxWidth: '100%',
          background: '#1A2437',
          border: '1px solid #2E3E5C',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(0,0,0,.60)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid #22304A',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ flex: '1 1 0%', minWidth: 0 }}>
            <div style={{ font: '600 16px/1.25 Barlow, sans-serif', color: '#fff' }}>
              {t('season.ledgerTitle', { name: member?.name || '' })}
            </div>
            <div style={{ font: "400 12px/1.4 'IBM Plex Mono', monospace", color: '#8494AA' }}>
              {season?.name || 'Mùa 3 · 2026'} · {t('season.rankOf', { rank, total: totalMembers })}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              font: "600 16px/1 'IBM Plex Mono', monospace",
              color: '#8494AA',
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
            <div style={{ font: "600 40px/1 'IBM Plex Mono', monospace", color: '#E9EFF7' }}>
              {totalPoints.toLocaleString()}
            </div>
            <div style={{ paddingBottom: 6, font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
              {t('season.pointsLabel')} ·{' '}
              <span style={{ color: '#5FDBD3' }}>+{latestSessionPts}</span> {t('season.latestSession')}
              {rank > 1 && (
                <>
                  {' '}· {t('season.distanceToNext')} {rank - 1}{' '}
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#E9EFF7' }}>{ptsToNextRank}</span>
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
              border: '1px solid #22304A',
            }}
          >
            <div
              style={{
                width: `${pAttendance}%`,
                background: '#00B2A9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                font: "600 10px/1 'IBM Plex Mono', monospace",
                color: '#04302C',
              }}
            >
              {breakdown.attendancePts}
            </div>
            <div
              style={{
                width: `${pMatches}%`,
                background: '#1D50A0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                font: "600 10px/1 'IBM Plex Mono', monospace",
                color: '#fff',
              }}
            >
              {breakdown.matchPlayPts}
            </div>
            <div
              style={{
                width: `${pWins}%`,
                background: '#7AA3DC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                font: "600 10px/1 'IBM Plex Mono', monospace",
                color: '#0B1220',
              }}
            >
              {breakdown.winPts}
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
              {breakdown.upsetPts}
            </div>
          </div>

          {/* Stacked Bar Legend */}
          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              font: "400 11px/1.2 'IBM Plex Mono', monospace",
              color: '#A8B7CB',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: '#00B2A9' }} />
              {t('season.legendAttendance')} {Math.round(breakdown.attendancePts / (season?.pointsConfig?.attendance || 30))}×30
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: '#1D50A0' }} />
              {t('season.legendMatches')} {Math.round(breakdown.matchPlayPts / (season?.pointsConfig?.matchPlayed || 10))}×10
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: '#7AA3DC' }} />
              {t('season.legendWins')} {Math.round(breakdown.winPts / (season?.pointsConfig?.matchWon || 15))}×15
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: '#C9A227' }} />
              {t('season.legendUpsets')} {Math.round(breakdown.upsetPts / (season?.pointsConfig?.upsetWon || 25))}×25
            </span>
          </div>

          {/* Audit Events Timeline */}
          <div style={{ borderTop: '1px solid #22304A', paddingTop: 12, display: 'grid', gap: 8 }}>
            <div
              style={{
                font: "600 12px/1.2 'IBM Plex Sans', sans-serif",
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: '#8494AA',
              }}
            >
              {t('season.recentSessionTitle')} · +{latestSessionPts}
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
                      background: ev.isUpsetWon ? 'rgba(201,162,39,.10)' : '#141D2E',
                      border: ev.isUpsetWon ? '1px solid #8A6F16' : '1px solid #22304A',
                      font: "400 12px/1.3 'IBM Plex Sans', sans-serif",
                    }}
                  >
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: ev.isUpsetWon ? '#C6B683' : '#8494AA' }}>
                      {ev.time}
                    </span>
                    <span style={{ color: '#E9EFF7' }}>{ev.title}</span>
                    <span
                      style={{
                        textAlign: 'right',
                        fontFamily: "'IBM Plex Mono', monospace",
                        color: ev.isUpsetWon ? '#F0D26A' : ev.pts > 0 ? '#5FDBD3' : '#8494AA',
                        fontWeight: ev.isUpsetWon ? 600 : 400,
                      }}
                    >
                      +{ev.pts}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ padding: '8px 10px', color: '#8494AA', font: "400 12px/1.4 'IBM Plex Sans', sans-serif" }}>
                  Chưa có trận đấu nào trong mùa này.
                </div>
              )}
            </div>
          </div>

          {/* Footer Notice */}
          <div
            style={{
              borderTop: '1px solid #22304A',
              paddingTop: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                font: "400 12px/1.4 'IBM Plex Sans', sans-serif",
                color: '#8494AA',
                flex: '1 1 180px',
                minWidth: 180,
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
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  padding: '9px 14px',
                  borderRadius: 6,
                  background: '#1A2437',
                  border: '1px solid #2E3E5C',
                  color: '#E9EFF7',
                  cursor: 'pointer',
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
