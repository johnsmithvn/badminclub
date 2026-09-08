import { useState, useMemo } from 'react'
import { t } from '#i18n'
import { calcMatchupEdge, confidenceLevelOf } from '#lib/rating.js'

export default function CourtBalanceExplanationModal({
  courtBalance,
  courtData,
  courtIdx = 0,
  initialTab = 'pair',
  onClose,
  onSwapCourt,
  onLockCourt,
  onAgree,
}) {
  const data = courtBalance || courtData
  if (!data) return null

  const [activeTab, setActiveTab] = useState(initialTab)

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
    pairAInfo,
    pairBInfo,
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

  // Thông tin tầng cặp & khắc chế EA3
  const nameA1 = (typeof teamA[0] === 'object' ? teamA[0].name : teamA[0]) || 'Người 1' // i18n-ok
  const nameA2 = (typeof teamA[1] === 'object' ? teamA[1].name : teamA[1]) || 'Người 2' // i18n-ok
  const nameB1 = (typeof teamB[0] === 'object' ? teamB[0].name : teamB[0]) || 'Người 3' // i18n-ok
  const nameB2 = (typeof teamB[1] === 'object' ? teamB[1].name : teamB[1]) || 'Người 4' // i18n-ok

  const gamesA = pairAInfo?.gamesCount ?? (data.gamesA ?? 9)
  const synA = pairAInfo?.synergyScore ?? (data.synergyA ?? 52)
  const hasSynA = gamesA >= 5

  const gamesB = pairBInfo?.gamesCount ?? (data.gamesB ?? 1)
  const synB = pairBInfo?.synergyScore ?? (data.synergyB ?? null)
  const hasSynB = gamesB >= 5 && synB != null

  const pairAKeys = teamA.map((p) => (typeof p === 'object' ? (p.key || p.id) : p)).filter(Boolean)
  const pairBKeys = teamB.map((p) => (typeof p === 'object' ? (p.key || p.id) : p)).filter(Boolean)
  const matches = data.matches || []

  const matchup = useMemo(() => {
    if (pairAKeys.length === 2 && pairBKeys.length === 2 && matches.length > 0) {
      return calcMatchupEdge(matches, pairAKeys, pairBKeys)
    }
    return { games: 1, edgeScore: 50, confidence: confidenceLevelOf(1) }
  }, [pairAKeys, pairBKeys, matches])

  const isMatchupIgnored = matchup.games < 5

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
        data-screen-label={activeTab === 'pair' ? 'EA3 Chia san tang cap' : 'CE2 Giai trinh mot san'}
        style={{
          width: activeTab === 'pair' ? 500 : 620,
          maxWidth: '100%',
          background: 'var(--surface-overlay, #1A2437)',
          border: '1px solid var(--border-default, #2E3E5C)',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(0,0,0,.60)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          transition: 'width 0.2s ease',
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
              {activeTab === 'pair'
                ? `${t('session.courtNum', { n: courtIdx + 1 })} · ${t('assign.pairTierTitle')}`
                : t('assign.explanationTitle', { court: courtIdx + 1 })}
            </div>
            <div style={{ font: "400 12px/1.4 'IBM Plex Mono', monospace", color: 'var(--text-muted, #8494AA)' }}>
              {activeTab === 'pair'
                ? `${t('assign.explanationScore', { score: totalScore })} · ${t('assign.diffElo', { diff: delta, delta })}`
                : `${nameA} vs ${nameB} — ${t('assign.explanationScore', { score: totalScore, tA: nameA, tB: nameB })}`}
            </div>
          </div>

          {activeTab === 'pair' && (
            <span
              style={{
                font: "600 11px/1 'IBM Plex Mono', monospace",
                padding: '5px 8px',
                borderRadius: 999,
                background: 'rgba(0,178,169,.16)',
                border: '1px solid #00786F',
                color: '#5FDBD3',
              }}
            >
              {t('assign.suggestedBadge')}
            </span>
          )}

          {/* Tab switch button */}
          <div style={{ display: 'flex', gap: 4, background: '#101927', padding: 3, borderRadius: 7, border: '1px solid #22304A' }}>
            <button
              type="button"
              onClick={() => setActiveTab('pair')}
              style={{
                font: "600 11px/1 'IBM Plex Sans', sans-serif",
                padding: '5px 9px',
                borderRadius: 5,
                background: activeTab === 'pair' ? '#00B2A9' : 'transparent',
                color: activeTab === 'pair' ? '#04302C' : '#8494AA',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {t('assign.pairTierTab')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('criteria')}
              style={{
                font: "600 11px/1 'IBM Plex Sans', sans-serif",
                padding: '5px 9px',
                borderRadius: 5,
                background: activeTab === 'criteria' ? '#00B2A9' : 'transparent',
                color: activeTab === 'criteria' ? '#04302C' : '#8494AA',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {t('assign.criteriaTab')}
            </button>
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

        {/* Content Body: Tab EA3 (Tầng Cặp & Khắc chế) */}
        {activeTab === 'pair' ? (
          <div style={{ padding: '14px 16px', display: 'grid', gap: 12, overflowY: 'auto' }}>
            {/* Pair Cards */}
            <div style={{ display: 'grid', gap: 8 }}>
              {/* Pair A */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: '#141D2E',
                  border: '1px solid #22304A',
                }}
              >
                <span style={{ display: 'flex', flex: '0 0 auto' }}>
                  <span style={{ width: 24, height: 24, borderRadius: 999, background: '#1D50A0', display: 'inline-block' }} />
                  <span style={{ width: 24, height: 24, borderRadius: 999, background: '#7A3D8F', marginLeft: -8, display: 'inline-block' }} />
                </span>
                <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                  <div style={{ font: "600 13px/1.25 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                    {nameA1} · {nameA2}
                  </div>
                  <div style={{ font: "400 11px/1.35 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                    {totA} · {t('leaderboard.synergy')} {hasSynA ? synA : t('assign.synergyNotAvailable')} · {gamesA} {t('leaderboard.matchesShort')}
                  </div>
                </div>
                <span style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: '#A8B7CB' }}>
                  {calcAvgA} {t('assign.averageShort')}
                </span>
              </div>

              <div style={{ textAlign: 'center', font: "600 11px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                vs
              </div>

              {/* Pair B */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: '#141D2E',
                  border: '1px solid #22304A',
                }}
              >
                <span style={{ display: 'flex', flex: '0 0 auto' }}>
                  <span style={{ width: 24, height: 24, borderRadius: 999, background: '#00786F', display: 'inline-block' }} />
                  <span style={{ width: 24, height: 24, borderRadius: 999, background: '#3C74C4', marginLeft: -8, display: 'inline-block' }} />
                </span>
                <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                  <div style={{ font: "600 13px/1.25 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                    {nameB1} · {nameB2}
                  </div>
                  <div style={{ font: "400 11px/1.35 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                    {totB} · {t('leaderboard.synergy')} {hasSynB ? synB : t('assign.synergyNotAvailable')} · {gamesB} {t('leaderboard.matchesShort')}
                  </div>
                </div>
                <span style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: '#A8B7CB' }}>
                  {calcAvgB} {t('assign.averageShort')}
                </span>
              </div>
            </div>

            {/* Vì sao chọn */}
            <div
              style={{
                display: 'grid',
                gap: 8,
                padding: 12,
                borderRadius: 8,
                background: '#101927',
                border: '1px solid #22304A',
              }}
            >
              <div
                style={{
                  font: "600 12px/1.2 'IBM Plex Sans', sans-serif",
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: '#8494AA',
                }}
              >
                {t('assign.whyChosenTitle')}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ width: 5, height: 5, borderRadius: 999, background: '#00B2A9', marginTop: 6, flex: '0 0 auto' }} />
                <span style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                  {t('assign.diffLowestNote', { diff: delta })}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ width: 5, height: 5, borderRadius: 999, background: '#00B2A9', marginTop: 6, flex: '0 0 auto' }} />
                <span style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                  {t('assign.separateRecentPairNote', { p1: nameA1, p2: nameB1, syn: 91, n: 2 })}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ width: 5, height: 5, borderRadius: 999, background: '#3C74C4', marginTop: 6, flex: '0 0 auto' }} />
                <span style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                  {t('assign.exploreNewPairNote', { p1: nameB1, p2: nameB2, n: gamesB })}
                </span>
              </div>
            </div>

            {/* Khắc chế bị bỏ qua cảnh báo */}
            {isMatchupIgnored && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 9,
                  padding: '11px 12px',
                  borderRadius: 8,
                  background: 'rgba(224,138,0,.10)',
                  border: '1px solid #E08A00',
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    flex: '0 0 auto',
                    borderRadius: 999,
                    background: '#E08A00',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    font: '700 11px/1 Barlow, sans-serif',
                    color: '#2A1F00',
                  }}
                >
                  !
                </div>
                <div style={{ flex: '1 1 0%', minWidth: 0, display: 'grid', gap: 3 }}>
                  <div style={{ font: "600 12.5px/1.35 'IBM Plex Sans', sans-serif", color: '#F0B75C' }}>
                    {t('assign.matchupIgnoredTitle')}
                  </div>
                  <div style={{ font: "400 12px/1.5 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                    {t('assign.matchupIgnoredDesc', {
                      pairA: `${nameA1}·${nameA2}`,
                      pairB: `${nameB1}·${nameB2}`,
                      games: matchup.games,
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
              <button
                type="button"
                onClick={onAgree || onClose}
                style={{
                  flex: 1,
                  font: "600 12.5px/1 'IBM Plex Sans', sans-serif",
                  padding: '10px 12px',
                  borderRadius: 7,
                  background: '#00B2A9',
                  border: 'none',
                  color: '#04302C',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                {t('assign.confirmThisCourt')}
              </button>
              <button
                type="button"
                onClick={onSwapCourt || onClose}
                style={{
                  flex: 1,
                  font: "600 12.5px/1 'IBM Plex Sans', sans-serif",
                  padding: '10px 12px',
                  borderRadius: 7,
                  background: '#141D2E',
                  border: '1px solid #2E3E5C',
                  color: '#E9EFF7',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                {t('assign.viewOtherOption')}
              </button>
            </div>
          </div>
        ) : (
          /* Content Body: Tab CE2 (5 Tiêu chí) */
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
        )}
      </div>
    </div>
  )
}
