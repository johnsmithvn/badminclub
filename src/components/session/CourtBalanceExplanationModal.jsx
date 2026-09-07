import { t } from '#i18n'

export default function CourtBalanceExplanationModal({
  courtBalance,
  courtData,
  courtIdx = 0,
  onClose,
  onSwapCourt,
  onLockCourt,
  onAgree,
}) {
  const data = courtBalance || courtData
  if (!data) return null

  const {
    totalScore = 96,
    canRating = { delta: 8, score: 95 },
    partner = { score: 90 },
    opponent = { score: 82 },
    h2h = { score: 88, recentScores: ['21–19', '22–20', '21–15', '19–21', '21–14'] },
    fairness = { score: 90 },
    teamA = [],
    teamB = [],
    ra: initialRa,
    rb: initialRb,
  } = data

  const nameA = teamA.map((p) => (typeof p === 'object' ? p.name : p)).join(' + ') || 'Team A'
  const nameB = teamB.map((p) => (typeof p === 'object' ? p.name : p)).join(' + ') || 'Team B'

  const pA1 = teamA[0] ? (typeof teamA[0] === 'object' ? (teamA[0].effectiveStrength || teamA[0].rating || teamA[0].seedRating || 0) : teamA[0]) : 0
  const pA2 = teamA[1] ? (typeof teamA[1] === 'object' ? (teamA[1].effectiveStrength || teamA[1].rating || teamA[1].seedRating || 0) : teamA[1]) : 0
  const pB1 = teamB[0] ? (typeof teamB[0] === 'object' ? (teamB[0].effectiveStrength || teamB[0].rating || teamB[0].seedRating || 0) : teamB[0]) : 0
  const pB2 = teamB[1] ? (typeof teamB[1] === 'object' ? (teamB[1].effectiveStrength || teamB[1].rating || teamB[1].seedRating || 0) : teamB[1]) : 0

  const calcTotA = (pA1 && pA2) ? (pA1 + pA2) : 0
  const calcTotB = (pB1 && pB2) ? (pB1 + pB2) : 0
  const calcAvgA = teamA.length ? Math.round((calcTotA || pA1) / teamA.length) : 0
  const calcAvgB = teamB.length ? Math.round((calcTotB || pB1) / teamB.length) : 0

  const ra = initialRa || data.ra || data.rA || calcAvgA || 1500
  const rb = initialRb || data.rb || data.rB || calcAvgB || 1500
  const totA = calcTotA || ra
  const totB = calcTotB || rb
  const delta = data.canRating?.delta !== undefined ? data.canRating.delta : Math.abs(ra - rb)
  const scores = (h2h.recentScores && h2h.recentScores.length)
    ? h2h.recentScores
    : ['21–19', '22–20', '21–15', '19–21', '21–14']

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
        data-screen-label="CE2 Giai trinh mot san"
        style={{
          width: 620,
          maxWidth: '100%',
          background: 'var(--surface-overlay, #1A2437)',
          border: '1px solid var(--border-default, #2E3E5C)',
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
            borderBottom: '1px solid var(--border-subtle, #22304A)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ flex: '1 1 0%', minWidth: 0 }}>
            <div style={{ font: '600 16px/1.25 Barlow, sans-serif', color: 'var(--text-primary, #fff)' }}>
              {t('assign.explanationTitle', { court: courtIdx + 1 })}
            </div>
            <div style={{ font: "400 12px/1.4 'IBM Plex Mono', monospace", color: 'var(--text-muted, #8494AA)' }}>
              {nameA} vs {nameB} — {t('assign.explanationScore', { score: totalScore, tA: nameA, tB: nameB })}
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
              color: 'var(--text-muted, #8494AA)',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '16px 18px', display: 'grid', gap: 14, overflowY: 'auto' }}>
          {/* Rating Comparison */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <div
              style={{
                padding: 11,
                borderRadius: 9,
                background: 'var(--surface-sunken, #141D2E)',
                border: '1px solid var(--border-subtle, #22304A)',
                display: 'grid',
                gap: 5,
              }}
            >
              <span style={{ font: "600 13px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-primary, #E9EFF7)' }}>{nameA}</span>
              <span style={{ font: "600 22px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary, #E9EFF7)' }}>{ra}</span>
              <span style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: 'var(--text-muted, #8494AA)' }}>
                {pA1 && pA2
                  ? t('assign.teamRating', { total: totA, p1: pA1, p2: pA2 })
                  : t('season.teamTotal', { n: totA })}
              </span>
            </div>

            <div style={{ display: 'grid', gap: 4, justifyItems: 'center' }}>
              <span style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: '#00B2A9' }}>
                {t('assign.diffElo', { diff: delta, delta })}
              </span>
              <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted, #8494AA)' }}>≈ 51/49</span>
            </div>

            <div
              style={{
                padding: 11,
                borderRadius: 9,
                background: 'var(--surface-sunken, #141D2E)',
                border: '1px solid var(--border-subtle, #22304A)',
                display: 'grid',
                gap: 5,
              }}
            >
              <span style={{ font: "600 13px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-primary, #E9EFF7)' }}>{nameB}</span>
              <span style={{ font: "600 22px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary, #E9EFF7)' }}>{rb}</span>
              <span style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: 'var(--text-muted, #8494AA)' }}>
                {pB1 && pB2
                  ? t('assign.teamRating', { total: totB, p1: pB1, p2: pB2 })
                  : t('season.teamTotal', { n: totB })}
              </span>
            </div>
          </div>

          {/* Breakdown 5 Criteria */}
          <div style={{ display: 'grid', gap: 9 }}>
            <div
              style={{
                font: "600 12px/1.2 'IBM Plex Sans', sans-serif",
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: 'var(--text-muted, #8494AA)',
              }}
            >
              {t('assign.criteriaBreakdown')}
            </div>

            <div style={{ display: 'grid', gap: 6, font: "400 12px/1.35 'IBM Plex Sans', sans-serif" }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '118px minmax(0,1fr) 52px',
                  gap: 10,
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: 7,
                  background: 'var(--surface-sunken, #141D2E)',
                  border: '1px solid var(--border-subtle, #22304A)',
                }}
              >
                <span style={{ color: 'var(--text-secondary, #A8B7CB)' }}>{t('assign.criterionRating')}</span>
                <span style={{ color: 'var(--text-muted, #8494AA)' }}>{t('assign.criterionRatingDesc', { diff: delta, delta })}</span>
                <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#00B2A9' }}>+30</span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '118px minmax(0,1fr) 52px',
                  gap: 10,
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: 7,
                  background: 'var(--surface-sunken, #141D2E)',
                  border: '1px solid var(--border-subtle, #22304A)',
                }}
              >
                <span style={{ color: 'var(--text-secondary, #A8B7CB)' }}>{t('assign.criterionPartner')}</span>
                <span style={{ color: 'var(--text-muted, #8494AA)' }}>{t('assign.criterionPartnerDesc')}</span>
                <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#00B2A9' }}>+20</span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '118px minmax(0,1fr) 52px',
                  gap: 10,
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: 7,
                  background: 'var(--surface-sunken, #141D2E)',
                  border: '1px solid var(--border-subtle, #22304A)',
                }}
              >
                <span style={{ color: 'var(--text-secondary, #A8B7CB)' }}>{t('assign.criterionOpponent')}</span>
                <span style={{ color: 'var(--text-muted, #8494AA)' }}>{t('assign.criterionOpponentDesc')}</span>
                <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: opponent.score < 80 ? 'var(--status-delayed, #F1A79D)' : '#00B2A9' }}>
                  {opponent.score < 80 ? '−6' : '+15'}
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '118px minmax(0,1fr) 52px',
                  gap: 10,
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: 7,
                  background: 'rgba(0,178,169,.08)',
                  border: '1px solid #00786F',
                }}
              >
                <span style={{ color: 'var(--text-secondary, #A8B7CB)' }}>{t('assign.criterionH2H')}</span>
                <span style={{ color: 'var(--text-muted, #8494AA)' }}>{t('assign.criterionH2HDesc')}</span>
                <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#00B2A9' }}>+26</span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '118px minmax(0,1fr) 52px',
                  gap: 10,
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: 7,
                  background: 'var(--surface-sunken, #141D2E)',
                  border: '1px solid var(--border-subtle, #22304A)',
                }}
              >
                <span style={{ color: 'var(--text-secondary, #A8B7CB)' }}>{t('assign.criterionTurns')}</span>
                <span style={{ color: 'var(--text-muted, #8494AA)' }}>{t('assign.criterionTurnsDesc')}</span>
                <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#00B2A9' }}>+26</span>
              </div>
            </div>
          </div>

          {/* Previous Scores Chips */}
          <div style={{ display: 'grid', gap: 9, borderTop: '1px solid var(--border-subtle, #22304A)', paddingTop: 12 }}>
            <div
              style={{
                font: "600 12px/1.2 'IBM Plex Sans', sans-serif",
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: 'var(--text-muted, #8494AA)',
              }}
            >
              {t('assign.recentScoresTitle')}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {scores.map((sc, i) => (
                <span
                  key={i}
                  style={{
                    font: "600 12px/1 'IBM Plex Mono', monospace",
                    padding: '8px 10px',
                    borderRadius: 7,
                    background: 'rgba(0,178,169,.12)',
                    border: '1px solid #00786F',
                    color: '#00B2A9',
                  }}
                >
                  {sc}
                </span>
              ))}
            </div>
            <div style={{ font: "400 12px/1.5 'IBM Plex Sans', sans-serif", color: 'var(--text-muted, #8494AA)' }}>
              {t('assign.h2hNote')}
            </div>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              borderTop: '1px solid var(--border-subtle, #22304A)',
              paddingTop: 12,
            }}
          >
            {onSwapCourt && (
              <button
                type="button"
                onClick={onSwapCourt}
                style={{
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  padding: '10px 14px',
                  borderRadius: 6,
                  background: 'var(--surface-sunken, #1A2437)',
                  border: '1px solid var(--border-default, #2E3E5C)',
                  color: 'var(--text-primary, #E9EFF7)',
                  cursor: 'pointer',
                }}
              >
                {t('assign.swapCourt')}
              </button>
            )}
            {onLockCourt && (
              <button
                type="button"
                onClick={onLockCourt}
                style={{
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  padding: '10px 14px',
                  borderRadius: 6,
                  background: 'var(--surface-sunken, #1A2437)',
                  border: '1px solid var(--border-default, #2E3E5C)',
                  color: 'var(--text-primary, #E9EFF7)',
                  cursor: 'pointer',
                }}
              >
                {t('assign.lockCourtAndRetry')}
              </button>
            )}
            <div style={{ flex: '1 1 0%' }} />
            <button
              type="button"
              onClick={onAgree || onClose}
              style={{
                font: "600 12px/1 'IBM Plex Sans', sans-serif",
                padding: '10px 14px',
                borderRadius: 6,
                background: '#1D50A0',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              {t('assign.agree')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
