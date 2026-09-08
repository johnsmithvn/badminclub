import { useMemo } from 'react'
import { t } from '#i18n'
import { calcMatchupEdge } from '#lib/rating.js'

export default function PairDetailModal({ pair, onClose, onViewMatches, ratingsMap, matches = [] }) {
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

  const impactSign = pairImpact > 0 ? `+${pairImpact}` : `${pairImpact}`
  const impactColor = pairImpact > 0 ? '#5FDBD3' : pairImpact < 0 ? '#F09A8E' : '#A8B7CB'
  const confidenceLabel = t(`rating.confidence.${confidence.toLowerCase()}`) || confidence

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
    if (!key) return []
    const [p1, p2] = key.split(':')
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
              {names.join(' · ')}
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
                {confidence} · {confidenceLabel}
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
                  const oppNames = (opp.oppKeys || []).map((k) => {
                    const m = (pair?.membersMap && pair.membersMap[k]) || null
                    return m?.name || k
                  }).join(' · ')

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
