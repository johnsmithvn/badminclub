import { useMemo } from 'react'
import { t } from '#i18n'
import { calcMatchupEdge, confidenceLevelOf } from '#lib/rating.js'

export default function CourtPairBreakdownModal({
  courtBalance,
  courtData,
  courtIdx = 0,
  planNumber = '12/80',
  onClose,
  onSwapCourt,
  onAgree,
}) {
  const data = courtBalance || courtData

  const {
    totalScore = 86,
    teamA = [],
    teamB = [],
    canRating = {},
    pairAInfo,
    pairBInfo,
  } = data

  const delta = canRating.delta !== undefined ? canRating.delta : (data.delta || 22)

  // Tên và rating của đội A
  const pA1Obj = teamA[0] || {}
  const pA2Obj = teamA[1] || {}
  const nameA1 = (typeof pA1Obj === 'object' ? pA1Obj.name : pA1Obj) || 'Người 1' // i18n-ok
  const nameA2 = (typeof pA2Obj === 'object' ? pA2Obj.name : pA2Obj) || 'Người 2' // i18n-ok
  const rA1 = typeof pA1Obj === 'object' ? (pA1Obj.effectiveStrength || pA1Obj.rating || 1500) : 1500
  const rA2 = typeof pA2Obj === 'object' ? (pA2Obj.effectiveStrength || pA2Obj.rating || 1500) : 1500
  const totA = rA1 + rA2
  const avgA = Math.round(totA / 2)

  // Tên và rating của đội B
  const pB1Obj = teamB[0] || {}
  const pB2Obj = teamB[1] || {}
  const nameB1 = (typeof pB1Obj === 'object' ? pB1Obj.name : pB1Obj) || 'Người 3' // i18n-ok
  const nameB2 = (typeof pB2Obj === 'object' ? pB2Obj.name : pB2Obj) || 'Người 4' // i18n-ok
  const rB1 = typeof pB1Obj === 'object' ? (pB1Obj.effectiveStrength || pB1Obj.rating || 1500) : 1500
  const rB2 = typeof pB2Obj === 'object' ? (pB2Obj.effectiveStrength || pB2Obj.rating || 1500) : 1500
  const totB = rB1 + rB2
  const avgB = Math.round(totB / 2)

  // Ăn ý cặp A và B
  const gamesA = pairAInfo?.gamesCount ?? (data.gamesA ?? 9)
  const synA = pairAInfo?.synergyScore ?? (data.synergyA ?? 52)
  const hasSynA = gamesA >= 5

  const gamesB = pairBInfo?.gamesCount ?? (data.gamesB ?? 1)
  const synB = pairBInfo?.synergyScore ?? (data.synergyB ?? null)
  const hasSynB = gamesB >= 5 && synB != null

  // Khắc chế cặp A vs cặp B
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

  if (!data) return null

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
      {/* ═══ EA3 · CHIA SÂN ĐỌC ĂN Ý NHƯ DỮ LIỆU ═══ */}
      <div
        data-screen-label="EA3 Chia san tang cap"
        style={{
          width: 480,
          maxWidth: '100%',
          background: '#1A2437',
          border: '1px solid #2E3E5C',
          borderRadius: 12,
          boxShadow: '0 20px 48px rgba(0,0,0,.55)',
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
            padding: '13px 15px',
            borderBottom: '1px solid #22304A',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ flex: '1 1 0%', minWidth: 0 }}>
            <div style={{ font: '600 15px/1.25 Barlow, sans-serif', color: '#FFFFFF' }}>
              {t('session.courtNum', { n: courtIdx + 1 })} · {t('assign.explanationScore', { score: totalScore })}
            </div>
            <div style={{ font: "400 12px/1.4 'IBM Plex Mono', monospace", color: '#8494AA' }}>
              {t('assign.explanationScore', { score: totalScore })} · {t('assign.diffElo', { diff: delta, delta })}
            </div>
          </div>
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
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              font: "600 16px/1 'IBM Plex Mono', monospace",
              color: '#8494AA',
              marginLeft: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '14px 15px', display: 'grid', gap: 12, overflowY: 'auto' }}>
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
                {avgA} {t('assign.averageShort')}
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
                {avgB} {t('assign.averageShort')}
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
      </div>
    </div>
  )
}
