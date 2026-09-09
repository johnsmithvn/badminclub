import { useMemo } from 'react'
import { t } from '#i18n'
import { useMobile } from '#hooks/useMobile.js'
import { calcMatchupEdge } from '#lib/rating.js'
import { playerName } from '#lib/money.js'

export default function PairDetailModal({ pair, onClose, onViewMatches, ratingsMap, matches = [], db, membersMap }) {
  const isMobile = useMobile()
  const {
    names = [],
    gamesCount = 0,
    wins = 0,
    losses = 0,
    actualWinPct = 0,
    expectedWinPct = 50,
    pairImpact = 0,
    synergyScore = 50,
    confidence = 'R1',
    format = 'MD',
    firstMatchDate,
    lastMatchDate,
    key,
  } = pair || {}

  const resolvePlayerName = (id) => {
    if (!id) return ''
    const m = (pair?.membersMap && pair.membersMap[id]) || (membersMap && membersMap[id])
    if (m?.name) return m.name
    if (db) return playerName(db, id)
    return id
  }

  const pairNames = useMemo(() => {
    const p1 = pair?.playerA || pair?.memberA?.id
    const p2 = pair?.playerB || pair?.memberB?.id
    const n1 = (names && names[0]) ? names[0] : resolvePlayerName(p1)
    const n2 = (names && names[1]) ? names[1] : resolvePlayerName(p2)
    const cleanN1 = (n1 && n1.length > 20 && n1.includes('-')) ? resolvePlayerName(p1) : n1
    const cleanN2 = (n2 && n2.length > 20 && n2.includes('-')) ? resolvePlayerName(p2) : n2
    return [cleanN1, cleanN2].filter(Boolean)
  }, [names, pair, db, membersMap])

  const impactSign = pairImpact > 0 ? `+${pairImpact}` : `${pairImpact}`
  const impactColor = pairImpact > 0 ? '#5FDBD3' : pairImpact < 0 ? '#F09A8E' : '#A8B7CB'
  const confTier = typeof confidence === 'string' ? confidence : confidence?.tier || 'R1'
  const confidenceLabel = t(`rating.confidence.${confTier.toLowerCase()}`) || confTier

  const trend = pair?.trend || 'steady'
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'
  const trendColor = trend === 'up' ? '#5FD9A2' : trend === 'down' ? '#FF9A8F' : '#8494AA'

  const recentResults = pair?.recentResults || []
  const form5 = []
  for (let i = 0; i < 5; i++) {
    form5.push(i < recentResults.length ? recentResults[i] : null)
  }
  const recentWins = form5.filter((r) => r === 'W').length
  const recentLosses = form5.filter((r) => r === 'L').length
  const recentTotal = recentWins + recentLosses
  const upsetWins = useMemo(() => {
    return Math.max(0, Math.round((gamesCount || 0) * 0.4))
  }, [gamesCount])

  const formatText =
    format === 'MD'
      ? t('leaderboard.filterMD')
      : format === 'WD'
        ? t('leaderboard.filterWD')
        : t('leaderboard.filterXD')

  const dateSub = useMemo(() => {
    if (firstMatchDate && lastMatchDate) {
      const d1 = new Date(firstMatchDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
      const d2 = new Date(lastMatchDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
      return t('leaderboard.dateRangeFromTo', { format: formatText, games: gamesCount, d1, d2 })
    }
    return t('leaderboard.formatGamesOnly', { format: formatText, games: gamesCount })
  }, [firstMatchDate, lastMatchDate, formatText, gamesCount])

  // Lấy danh sách các cặp đối thủ mà cặp này từng gặp
  const opponentMatchups = useMemo(() => {
    const pairKeyStr = key || pair?.pairKey?.replace('::', ':') || (pair?.playerA && pair?.playerB ? `${pair.playerA}:${pair.playerB}` : '')
    if (!pairKeyStr) return []
    const [p1, p2] = pairKeyStr.split(':')
    if (!p1 || !p2) return []
    const pairKeys = [p1, p2]

    const oppMap = new Map()
    matches.forEach((m) => {
      const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
      const teamB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])
      const inA = teamA.includes(p1) && teamA.includes(p2)
      const inB = teamB.includes(p1) && teamB.includes(p2)
      if (!inA && !inB) return

      const myTeam = inA ? 'A' : 'B'
      const oppKeys = inA ? teamB : teamA
      if (oppKeys.length < 2) return

      const oppKey = [...oppKeys].sort().join(':')
      const cur = oppMap.get(oppKey) || {
        oppKeys,
        matches: [],
        wins: 0,
        losses: 0,
      }
      cur.matches.push(m)
      if (m.winnerTeam === myTeam) cur.wins++
      else cur.losses++
      oppMap.set(oppKey, cur)
    })

    const list = []
    oppMap.forEach((val) => {
      const edge = calcMatchupEdge(matches, pairKeys, val.oppKeys, ratingsMap)
      list.push({
        ...val,
        edge,
      })
    })

    return list.sort((a, b) => b.matches.length - a.matches.length).slice(0, 4)
  }, [key, matches, ratingsMap])

  if (!pair) return null

  // Giao diện P2 Mobile Bottom Sheet
  if (isMobile) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(3,8,17,.68)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}
        onClick={onClose}
      >
        <div
          data-screen-label="P2 Chi tiet cap v1.1"
          style={{
            position: 'relative',
            background: '#141D2E',
            borderTop: '1px solid #2E3E5C',
            borderRadius: '16px 16px 0 0',
            padding: '10px 16px 24px',
            display: 'grid',
            gap: 12,
            maxHeight: '90vh',
            overflowY: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag handle */}
          <div style={{ width: 36, height: 4, borderRadius: 999, background: '#2E3E5C', justifySelf: 'center' }} />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <span style={{ display: 'flex', flex: '0 0 auto' }}>
              <span style={{ width: 32, height: 32, borderRadius: 999, background: '#1D50A0', border: '2px solid #141D2E' }} />
              <span style={{ width: 32, height: 32, borderRadius: 999, background: '#7A3D8F', border: '2px solid #141D2E', marginLeft: -11 }} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '600 17px/1.25 Barlow, sans-serif', color: '#E9EFF7' }}>
                {pairNames.join(' · ')}
              </div>
              <div style={{ font: "400 12px/1.4 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                {t('leaderboard.synergy')} · {gamesCount} {t('units.match')} · {confTier}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ font: '700 26px/1 Barlow, sans-serif', color: '#5FDBD3' }}>
                  {synergyScore}
                </span>
                <span style={{ font: "600 14px/1 'IBM Plex Mono', monospace", color: trendColor }}>
                  {trendIcon}
                </span>
              </div>
              {pair.previousScore && (
                <div style={{ font: "400 10.5px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  {t('leaderboard.fromPreviousScore', { prev: pair.previousScore })}
                </div>
              )}
            </div>
          </div>

          {/* Box 1: Kỳ vọng → thực tế */}
          <div style={{ padding: '12px 13px', borderRadius: 10, background: '#101927', border: '1px solid #22304A', display: 'grid', gap: 10 }}>
            <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '.08em', textTransform: 'uppercase', color: '#8494AA' }}>
              {t('leaderboard.expectationToActual')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ font: "600 20px/1 'IBM Plex Mono', monospace", color: '#9FC0EA' }}>
                {expectedWinPct}%
              </span>
              <span style={{ flex: 1, height: 6, borderRadius: 999, background: '#22304A', overflow: 'hidden', display: 'flex', position: 'relative' }}>
                <span style={{ width: `${Math.min(100, Math.max(0, expectedWinPct))}%`, background: '#3C74C4' }} />
                <span style={{ position: 'absolute', left: `${Math.min(99, Math.max(1, actualWinPct))}%`, top: -3, width: 2, height: 12, background: '#5FD9A2' }} />
              </span>
              <span style={{ font: "600 20px/1 'IBM Plex Mono', monospace", color: '#5FD9A2' }}>
                {actualWinPct}%
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ font: '700 22px/1 Barlow, sans-serif', color: impactColor }}>
                {impactSign}pp
              </span>
              <span style={{ font: "400 12.5px/1.4 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                {pairImpact >= 0 ? t('leaderboard.exceededExpectation') : t('leaderboard.belowExpectation')}
              </span>
            </div>
          </div>

          {/* Box 2: Form 5 trận */}
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '.08em', textTransform: 'uppercase', color: '#8494AA' }}>
                {t('leaderboard.form5Matches')}
              </span>
              <span style={{ font: "500 10.5px/1 'IBM Plex Sans', sans-serif", padding: '5px 8px', borderRadius: 999, background: 'rgba(18,168,103,.20)', color: '#5FD9A2' }}>
                {t('leaderboard.formHotSummary', { w: recentWins, l: recentLosses })}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {form5.map((res, fIdx) => (
                <span
                  key={fIdx}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    font: "600 12px/1 'IBM Plex Mono', monospace",
                    padding: '10px 0',
                    borderRadius: 6,
                    background: res === 'W' ? 'rgba(18,168,103,.20)' : res === 'L' ? 'rgba(225,68,52,.20)' : 'rgba(255,255,255,.05)',
                    color: res === 'W' ? '#5FD9A2' : res === 'L' ? '#FF9A8F' : '#55657E',
                  }}
                >
                  {res === 'W' ? 'T' : res === 'L' ? 'B' : '—'}
                </span>
              ))}
            </div>
          </div>

          {/* Box 3: Tại sao */}
          <div style={{ display: 'grid', gap: 7 }}>
            <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '.08em', textTransform: 'uppercase', color: '#8494AA' }}>
              {t('leaderboard.whyTitle')}
            </div>
            <div style={{ font: "400 13px/1.6 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
              {t('leaderboard.whySynergyCalculated', {
                games: gamesCount,
                recentWins: Math.max(1, recentWins),
                recentTotal: Math.max(1, recentTotal),
                upsetPart: upsetWins > 0 ? t('leaderboard.whyUpsetPart', { n: upsetWins }) : '',
              })}
            </div>
          </div>

          {/* Box 4: Đối đầu */}
          <div style={{ display: 'grid', gap: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '.08em', textTransform: 'uppercase', color: '#8494AA' }}>
                {t('leaderboard.headToHeadTitle')}
              </span>
              <span style={{ font: "400 11.5px/1.3 'IBM Plex Sans', sans-serif", color: '#5B6B81' }}>
                {t('leaderboard.headToHeadHistoricalNotice')}
              </span>
            </div>
            {opponentMatchups.length > 0 ? (
              opponentMatchups.map((opp, oppIdx) => {
                const oppNames = (opp.oppKeys || []).map((k) => resolvePlayerName(k)).join(' · ')
                const oppConf = opp.edge?.confidence || 'R1'
                const oppConfColor = oppConf === 'R4' || oppConf === 'R3' ? '#5FDBD3' : oppConf === 'R2' ? '#F0B75C' : '#FF9A8F'
                return (
                  <div
                    key={oppIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '11px 12px',
                      borderRadius: 6,
                      background: '#101927',
                      border: '1px solid #22304A',
                    }}
                  >
                    <span style={{ flex: 1, font: "400 13.5px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                      vs {oppNames}
                    </span>
                    <span style={{ font: "400 13px/1 'IBM Plex Mono', monospace", color: opp.wins >= opp.losses ? '#5FD9A2' : '#A8B7CB' }}>
                      {opp.wins}T–{opp.losses}B
                    </span>
                    <span style={{ font: "400 12px/1 'IBM Plex Mono', monospace", color: oppConfColor }}>
                      {oppConf}
                    </span>
                  </div>
                )
              })
            ) : (
              <div style={{ padding: '8px 10px', color: '#8494AA', font: "400 12.5px/1.4 'IBM Plex Sans', sans-serif" }}>
                {t('leaderboard.noOpponentHistory')}
              </div>
            )}
          </div>

          {/* CTA Gạ kèo cặp này */}
          <button
            type="button"
            onClick={() => {
              if (onViewMatches) onViewMatches(pair)
              else onClose()
            }}
            style={{
              height: 52,
              borderRadius: 6,
              background: '#1D50A0',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              font: "600 15px/1 'IBM Plex Sans', sans-serif",
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            {t('leaderboard.challengeThisPair')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        data-screen-label="AY2 Chi tiet cap"
        style={{
          width: 660,
          maxWidth: '100%',
          background: '#1A2437',
          border: '1px solid #2E3E5C',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(0,0,0,.60)',
          overflow: 'hidden',
          display: 'grid',
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
          <span style={{ display: 'flex', flex: '0 0 auto' }}>
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                background: '#1D50A0',
                border: '2px solid #1A2437',
              }}
            />
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                background: '#00786F',
                border: '2px solid #1A2437',
                marginLeft: -11,
              }}
            />
          </span>
          <div style={{ flex: '1 1 0%', minWidth: 0 }}>
            <div style={{ font: '600 17px/1.25 Barlow, sans-serif', color: '#fff' }}>
              {pairNames.join(' · ')}
            </div>
            <div style={{ font: "400 13px/1.4 'IBM Plex Mono', monospace", color: '#8494AA' }}>
              {dateSub}
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
              color: 'rgba(255,255,255,.6)',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '16px 18px', display: 'grid', gap: 14 }}>
          {/* 3 Metric Tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            <div
              style={{
                background: 'linear-gradient(180deg, rgba(0,178,169,.16), #141D2E)',
                border: '1px solid #00786F',
                borderRadius: 10,
                padding: 13,
                display: 'grid',
                gap: 4,
              }}
            >
              <div
                style={{
                  font: "600 11px/1.2 'IBM Plex Sans', sans-serif",
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: '#8494AA',
                }}
              >
                {t('leaderboard.synergyCol')}
              </div>
              <div style={{ font: '700 30px/1 Barlow, sans-serif', color: '#5FDBD3' }}>
                {synergyScore}
              </div>
              <div style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#5FDBD3' }}>
                {confTier} · {confidenceLabel}
              </div>
            </div>

            <div
              style={{
                background: '#141D2E',
                border: '1px solid #22304A',
                borderRadius: 10,
                padding: 13,
                display: 'grid',
                gap: 4,
              }}
            >
              <div
                style={{
                  font: "600 11px/1.2 'IBM Plex Sans', sans-serif",
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: '#8494AA',
                }}
              >
                Impact
              </div>
              <div style={{ font: '700 30px/1 Barlow, sans-serif', color: impactColor }}>
                {impactSign}pp
              </div>
              <div style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                {t('leaderboard.expectedToActualPct', { exp: expectedWinPct, act: actualWinPct })}
              </div>
            </div>

            <div
              style={{
                background: '#141D2E',
                border: '1px solid #22304A',
                borderRadius: 10,
                padding: 13,
                display: 'grid',
                gap: 4,
              }}
            >
              <div
                style={{
                  font: "600 11px/1.2 'IBM Plex Sans', sans-serif",
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: '#8494AA',
                }}
              >
                {t('leaderboard.records')}
              </div>
              <div style={{ font: '700 30px/1 Barlow, sans-serif', color: '#fff' }}>
                {wins}
                <span style={{ font: '600 16px/1 Barlow, sans-serif', color: '#8494AA' }}>
                  –{losses}
                </span>
              </div>
              <div style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                {t('leaderboard.recordsFormat', { act: actualWinPct, games: gamesCount })}
              </div>
            </div>
          </div>

          {/* Kỳ vọng vs Thực tế */}
          <div
            style={{
              background: '#141D2E',
              border: '1px solid #22304A',
              borderRadius: 10,
              padding: 14,
              display: 'grid',
              gap: 11,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", flex: 1, color: '#fff' }}>
                {t('leaderboard.synergyVsExpectedTitle')}
              </span>
              <span style={{ font: "400 12px/1.2 'IBM Plex Mono', monospace", color: impactColor }}>
                {pairImpact >= 0
                  ? t('leaderboard.exceedPointsPct', { pp: pairImpact })
                  : t('leaderboard.belowPointsPct', { pp: pairImpact })}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '76px minmax(0,1fr) 44px', gap: 10, alignItems: 'center' }}>
              <span style={{ font: "400 12px/1.2 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                {t('leaderboard.expectedCol')}
              </span>
              <span
                style={{
                  height: 11,
                  borderRadius: 999,
                  background: '#0B1220',
                  border: '1px solid #22304A',
                  overflow: 'hidden',
                  display: 'flex',
                }}
              >
                <span style={{ width: `${expectedWinPct}%`, background: '#2E3E5C' }} />
              </span>
              <span style={{ textAlign: 'right', font: "400 12px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                {expectedWinPct}%
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '76px minmax(0,1fr) 44px', gap: 10, alignItems: 'center' }}>
              <span style={{ font: "600 12px/1.2 'IBM Plex Sans', sans-serif", color: '#fff' }}>
                {t('leaderboard.actualCol')}
              </span>
              <span
                style={{
                  height: 11,
                  borderRadius: 999,
                  background: '#0B1220',
                  border: '1px solid #22304A',
                  overflow: 'hidden',
                  display: 'flex',
                }}
              >
                <span
                  style={{
                    width: `${Math.min(actualWinPct, expectedWinPct)}%`,
                    background: '#00786F',
                  }}
                />
                {actualWinPct > expectedWinPct && (
                  <span
                    style={{
                      width: `${actualWinPct - expectedWinPct}%`,
                      background: '#00B2A9',
                    }}
                  />
                )}
              </span>
              <span style={{ textAlign: 'right', font: "600 12px/1 'IBM Plex Mono', monospace", color: impactColor }}>
                {actualWinPct}%
              </span>
            </div>

            <div
              style={{
                font: "400 12.5px/1.55 'IBM Plex Sans', sans-serif",
                color: '#8494AA',
                borderTop: '1px solid #22304A',
                paddingTop: 10,
              }}
            >
              {pairImpact > 0
                ? t('leaderboard.synergyDetailExplanation', { pp: pairImpact, games: gamesCount })
                : t('leaderboard.belowDetailExplanation', { pp: Math.abs(pairImpact) })}
            </div>
          </div>

          {/* Cặp này gặp ai */}
          <div
            style={{
              background: '#141D2E',
              border: '1px solid #22304A',
              borderRadius: 10,
              padding: 14,
              display: 'grid',
              gap: 11,
            }}
          >
            <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#fff' }}>
              {t('leaderboard.whoPairMeets')}
            </div>
            <div style={{ display: 'grid', gap: 7 }}>
              {opponentMatchups.length > 0 ? (
                opponentMatchups.map((opp, idx) => {
                  const oppEdge = opp.edge
                  const oppExpected = oppEdge?.expectedA || 50
                  const oppActual = oppEdge?.actualA || Math.round((opp.wins / opp.matches.length) * 100)
                  const oppScore = oppEdge?.edgeScore || 50
                  const isLowConf = (opp.matches.length || 0) < 5
                  const oppNames = (opp.oppKeys || []).map((k) => resolvePlayerName(k)).join(' · ')

                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,1fr) 46px 88px 100px 40px',
                        gap: 9,
                        alignItems: 'center',
                        padding: '9px 11px',
                        borderRadius: 7,
                        background: '#101927',
                        border: '1px solid #22304A',
                      }}
                    >
                      <span style={{ font: "600 13px/1.3 'IBM Plex Sans', sans-serif", minWidth: 0, color: '#fff' }}>
                        {oppNames}
                      </span>
                      <span style={{ textAlign: 'right', font: "400 11px/1 'IBM Plex Mono', monospace", color: '#A8B7CB' }}>
                        {opp.wins}–{opp.losses}
                      </span>
                      <span style={{ textAlign: 'right', font: "400 11px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                        {t('leaderboard.oppExpectedPct', { exp: oppExpected })}
                      </span>
                      <span
                        style={{
                          height: 8,
                          borderRadius: 999,
                          background: '#0B1220',
                          overflow: 'hidden',
                          display: 'flex',
                        }}
                      >
                        <span
                          style={{
                            width: `${oppActual}%`,
                            background: oppScore >= 60 ? '#00B2A9' : oppScore >= 45 ? '#E08A00' : '#D63B2B',
                          }}
                        />
                      </span>
                      <span
                        style={{
                          textAlign: 'right',
                          font: '700 15px/1 Barlow, sans-serif',
                          color: oppScore >= 60 ? '#5FDBD3' : oppScore >= 45 ? '#F0B75C' : '#F09A8E',
                        }}
                      >
                        {oppScore}
                        {isLowConf && <span style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: '#F09A8E' }}>~</span>}
                      </span>
                    </div>
                  )
                })
              ) : (
                <div style={{ font: "400 12.5px/1.4 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  {t('leaderboard.noOpponentHistory')}
                </div>
              )}
            </div>
            <div style={{ font: "400 12px/1.5 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
              {t('leaderboard.under5GamesShrinkage')}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 9, paddingTop: 4 }}>
            <button
              type="button"
              onClick={() => {
                if (onViewMatches) onViewMatches(pair)
                onClose()
              }}
              style={{
                flex: 1,
                font: "600 13px/1 'IBM Plex Sans', sans-serif",
                padding: '11px 14px',
                borderRadius: 7,
                background: '#00B2A9',
                color: '#04302C',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              {t('leaderboard.viewPairMatches', { n: gamesCount })}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                font: "600 13px/1 'IBM Plex Sans', sans-serif",
                padding: '11px 18px',
                borderRadius: 7,
                background: '#141D2E',
                border: '1px solid #2E3E5C',
                color: '#E9EFF7',
                cursor: 'pointer',
              }}
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
