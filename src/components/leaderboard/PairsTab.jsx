import { useState, useMemo } from 'react'
import { t } from '#i18n'
import { useMobile } from '#hooks/useMobile.js'
import { rankPairs, calcMatchupEdge } from '#lib/rating.js'
import { playerName } from '#lib/money.js'
import { ConfidenceChip } from '#ui'
import PairDetailModal from './PairDetailModal.jsx'
import RatingFormulaModal from './RatingFormulaModal.jsx'
import PairH2HModal from './PairH2HModal.jsx'

function ConfidenceExplainerSheet({ onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(3,8,17,.68)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        data-screen-label="P4 Sheet do tin cay"
        style={{
          background: '#141D2E',
          borderTop: '1px solid #2E3E5C',
          borderRadius: '16px 16px 0 0',
          padding: '10px 16px 22px',
          display: 'grid',
          gap: 12,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: 36, height: 4, borderRadius: 999, background: '#2E3E5C', justifySelf: 'center' }} />

        <div style={{ font: '600 17px/1.25 Barlow, sans-serif', color: '#E9EFF7' }}>
          {t('leaderboard.confidenceExplainerTitle')}
        </div>
        <div style={{ font: "400 13px/1.55 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
          {t('leaderboard.confidenceExplainerSub')}
        </div>

        <div style={{ display: 'grid', gap: 7 }}>
          {/* R1 */}
          <div style={{ padding: '11px 12px', borderRadius: 6, background: '#101927', border: '1px solid rgba(225,68,52,.32)', display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ font: "600 13px/1 'IBM Plex Mono', monospace", color: '#FF9A8F' }}>R1 ●○○○</span>
              <div style={{ flex: 1 }} />
              <span style={{ font: "400 12.5px/1 'IBM Plex Mono', monospace", color: '#A8B7CB' }}>{t('leaderboard.r1GamesRange')}</span>
            </div>
            <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
              {t('leaderboard.r1Desc')}
            </div>
          </div>

          {/* R2 */}
          <div style={{ padding: '11px 12px', borderRadius: 6, background: '#101927', border: '1px solid rgba(224,138,0,.38)', display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ font: "600 13px/1 'IBM Plex Mono', monospace", color: '#F0B75C' }}>R2 ●●○○</span>
              <div style={{ flex: 1 }} />
              <span style={{ font: "400 12.5px/1 'IBM Plex Mono', monospace", color: '#A8B7CB' }}>{t('leaderboard.r2GamesRange')}</span>
            </div>
            <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
              {t('leaderboard.r2Desc')}
            </div>
          </div>

          {/* R3 */}
          <div style={{ padding: '11px 12px', borderRadius: 6, background: '#101927', border: '1px solid #00786F', display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ font: "600 13px/1 'IBM Plex Mono', monospace", color: '#5FDBD3' }}>R3 ●●●○</span>
              <div style={{ flex: 1 }} />
              <span style={{ font: "400 12.5px/1 'IBM Plex Mono', monospace", color: '#A8B7CB' }}>{t('leaderboard.r3GamesRange')}</span>
            </div>
            <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
              {t('leaderboard.r3Desc')}
            </div>
          </div>

          {/* R4 */}
          <div style={{ padding: '11px 12px', borderRadius: 6, background: '#101927', border: '1px solid #00786F', display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ font: "600 13px/1 'IBM Plex Mono', monospace", color: '#5FDBD3' }}>R4 ●●●●</span>
              <div style={{ flex: 1 }} />
              <span style={{ font: "400 12.5px/1 'IBM Plex Mono', monospace", color: '#A8B7CB' }}>{t('leaderboard.r4GamesRange')}</span>
            </div>
            <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
              {t('leaderboard.r4Desc')}
            </div>
          </div>
        </div>

        {/* Vì sao phải đọc kèm */}
        <div style={{ padding: '11px 12px', borderRadius: 6, background: '#101927', border: '1px solid #22304A', display: 'grid', gap: 6 }}>
          <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '.08em', textTransform: 'uppercase', color: '#8494AA' }}>
            {t('leaderboard.whyReadTogetherTitle')}
          </div>
          <div style={{ font: "400 12.5px/1.55 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
            {t('leaderboard.whyReadTogetherDesc')}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
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
          {t('leaderboard.understoodBtn')}
        </button>
      </div>
    </div>
  )
}

export default function PairsTab({
  matches = [],
  membersMap = {},
  ratingsMap = {},
  onExportCsv,
  onViewPairMatches,
  db,
}) {
  const isMobile = useMobile()
  const [formatFilter, setFormatFilter] = useState('MD') // 'MD' | 'WD' | 'XD'
  const [selectedPair, setSelectedPair] = useState(null)
  const [formulaModalOpen, setFormulaModalOpen] = useState(false)
  const [confidenceSheetOpen, setConfidenceSheetOpen] = useState(false)
  const [mobileSubTab, setMobileSubTab] = useState('pairs') // 'pairs' | 'h2h'
  const [selectedH2HPair, setSelectedH2HPair] = useState(null)

  // Tính bảng xếp hạng cặp đôi theo logic core vNext
  const pairsData = useMemo(() => {
    return rankPairs(matches, membersMap, ratingsMap, {
      format: formatFilter,
      formatFilter,
      minGames: 1,
    })
  }, [matches, membersMap, ratingsMap, formatFilter])

  // Toàn bộ cặp (không lọc format/trận) để tìm top/underperforming và đếm tổng
  const allPairsData = useMemo(() => {
    return rankPairs(matches, membersMap, ratingsMap, {
      format: 'all',
      formatFilter: 'all',
      minGames: 1,
    })
  }, [matches, membersMap, ratingsMap])

  const {
    rankedPairs = [],
    topPair: filteredTopPair,
    underperformingPair: filteredUnderPair,
    provisionalPairs = [],
  } = pairsData

  const topPair = filteredTopPair || allPairsData.topPair
  const underperformingPair = filteredUnderPair || allPairsData.underperformingPair
  const totalDoublesMatches = useMemo(() => {
    return (matches || []).filter((m) => {
      const a = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
      const b = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])
      return a.length >= 2 && b.length >= 2
    }).length
  }, [matches])

  const totalPairsCount = allPairsData.rankedPairs?.length || 0

  // 3 Cặp dưới kỳ vọng nhiều nhất (để hiển thị ở card vệ tinh phải)
  const topUnderperformingList = useMemo(() => {
    const list = (allPairsData.rankedPairs || [])
      .filter((p) => p.pairImpact < 0 && p.gamesCount >= 3)
      .sort((a, b) => a.pairImpact - b.pairImpact)
      .slice(0, 3)
    return list
  }, [allPairsData.rankedPairs])

  function getPairNames(pair) {
    const p1 = pair?.playerA || pair?.memberA?.id
    const p2 = pair?.playerB || pair?.memberB?.id
    const resolve = (n, id) => {
      if (!n || (typeof n === 'string' && n.length > 20 && n.includes('-'))) {
        const fromMap = membersMap?.[id]?.name
        if (fromMap) return fromMap
        if (db) {
          const fromDb = playerName(db, id)
          if (fromDb && fromDb !== id) return fromDb
        }
      }
      return n || '—'
    }

    if (Array.isArray(pair?.names) && pair.names.length >= 2) {
      return [resolve(pair.names[0], p1), resolve(pair.names[1], p2)]
    }
    const a = resolve(pair?.memberA?.name, p1)
    const b = resolve(pair?.memberB?.name, p2)
    return [a, b]
  }

function getPairKey(pair) {
  if (pair?.key) return pair.key
  if (pair?.playerA && pair?.playerB) return `${pair.playerA}:${pair.playerB}`
  if (pair?.pairKey) return pair.pairKey.replace('::', ':')
  return ''
}

function getPairConfTier(pair) {
  if (typeof pair?.confidence === 'string') return pair.confidence
  return pair?.confidence?.tier || 'R1'
}


  // Tính toán tất cả các cặp đối đầu (kình địch) trong CLB từ lịch sử trận đấu
  const clubRivalries = useMemo(() => {
    if (!matches || matches.length === 0) return []
    const matchupMap = new Map()

    for (const m of matches) {
      if (!m || !m.winnerTeam || m.ratingEnabled === false) continue
      const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
      const teamB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])
      if (teamA.length < 2 || teamB.length < 2) continue

      const pA = [...teamA].sort()
      const pB = [...teamB].sort()
      const keyA = pA.join(':')
      const keyB = pB.join(':')
      if (keyA === keyB) continue

      const comboKey = keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`
      if (!matchupMap.has(comboKey)) {
        matchupMap.set(comboKey, { pA, pB })
      }
    }

    const results = []
    for (const item of matchupMap.values()) {
      const edgeAB = calcMatchupEdge(matches, item.pA, item.pB, ratingsMap)
      const games = edgeAB.gamesCount != null ? edgeAB.gamesCount : (edgeAB.games || 0)
      if (games < 1) continue

      const edgeBA = calcMatchupEdge(matches, item.pB, item.pA, ratingsMap)

      const namesA = item.pA.map((id) => membersMap?.[id]?.name || (db ? playerName(db, id) : id) || id).join(' · ')
      const namesB = item.pB.map((id) => membersMap?.[id]?.name || (db ? playerName(db, id) : id) || id).join(' · ')

      const aAdvantage = (edgeAB.advantageScore || 50) >= (edgeBA.advantageScore || 50)
      const dominant = aAdvantage ? edgeAB : edgeBA
      const fromKeys = aAdvantage ? item.pA : item.pB
      const toKeys = aAdvantage ? item.pB : item.pA
      const fromName = aAdvantage ? namesA : namesB
      const toName = aAdvantage ? namesB : namesA

      const score = dominant.advantageScore != null ? dominant.advantageScore : 50
      const impact = dominant.matchupImpact != null ? dominant.matchupImpact : (dominant.actualWinPct - dominant.expectedWinPct)
      const wins = dominant.winsCount != null ? dominant.winsCount : 0
      const losses = games - wins
      const expected = dominant.expectedWinPct != null ? dominant.expectedWinPct : 50
      const actual = dominant.actualWinPct != null ? dominant.actualWinPct : 50

      const intensity = games * 15 + Math.abs(score - 50) * 1.8

      results.push({
        pairA: fromKeys,
        pairB: toKeys,
        fromName,
        toName,
        games,
        wins,
        losses,
        score,
        impact: Math.round(impact),
        expected: Math.round(expected),
        actual: Math.round(actual),
        avgScoreDiff: dominant.avgScoreDiff != null ? dominant.avgScoreDiff : '0.0',
        intensity,
        confidence: dominant.confidence?.tier || 'R1',
        recentScores: dominant.recentScores || [],
      })
    }

    results.sort((a, b) => b.intensity - a.intensity)
    return results
  }, [matches, membersMap, ratingsMap, db])

  const topRivalry = clubRivalries[0] || null
  const directionalMatchups = clubRivalries.slice(0, 4)

  return (
    <div
      data-screen-label="AY1 An y va khac che"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        background: '#0B1220',
        color: '#E9EFF7',
        borderRadius: 12,
        padding: '0 0 20px',
      }}
    >
      {/* Sub-Header */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid rgba(255,255,255,.10)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: '1 1 0%', minWidth: 200, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ font: '600 18px/1.25 Barlow, sans-serif', color: '#fff' }}>
            {t('leaderboard.tabPairs')}
          </div>
          <div style={{ font: "400 13px/1.4 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
            {t('leaderboard.doublesMatchesCount', {
              matches: totalDoublesMatches,
              pairs: totalPairsCount,
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={onExportCsv}
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
          {t('leaderboard.exportCsv')}
        </button>

        <button
          type="button"
          onClick={() => setFormulaModalOpen(true)}
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
          {t('leaderboard.howCalculated')}
        </button>
      </div>

      {/* 2 Highlight Cards: Hiển thị trên cả Mobile và Desktop */}
      <div
        style={{
          padding: isMobile ? '0 14px' : '0 20px',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
          gap: 14,
        }}
      >
        {/* Card 1: Cặp bài trùng của mùa (Cyan #00B2A9) */}
        {topPair ? (
          <div
            onClick={() => setSelectedPair(topPair)}
            style={{
              background: 'linear-gradient(180deg, rgba(0,178,169,.16), #141D2E)',
              border: '1px solid #00786F',
              boxShadow: '0 4px 20px rgba(0, 178, 169, 0.08)',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'grid',
              gap: 9,
              cursor: 'pointer',
              transition: 'transform 0.15s ease, border-color 0.15s ease',
            }}
          >
            <span
              style={{
                font: "600 10px/1 'IBM Plex Mono', monospace",
                letterSpacing: '.06em',
                padding: '4px 8px',
                borderRadius: 999,
                background: '#00B2A9',
                color: '#04302C',
                justifySelf: 'start',
              }}
            >
              {t('leaderboard.pairBestOfSeason')}
            </span>
            <div style={{ font: '700 20px/1.2 Barlow, sans-serif', color: '#fff' }}>
              {getPairNames(topPair).join(' · ')}
            </div>
            <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
              {t('leaderboard.pairBestDesc', {
                pp: topPair.pairImpact,
                matches: topPair.gamesCount,
                exp: topPair.expectedWinPct,
                wins: topPair.wins != null ? topPair.wins : (topPair.winsCount || 0),
              })}
            </div>

            <div
              style={{
                display: 'flex',
                gap: 16,
                paddingTop: 8,
                borderTop: '1px solid #22304A',
                marginTop: 2,
                flexWrap: 'wrap',
                alignItems: 'flex-end',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ font: '700 18px/1 Barlow, sans-serif', color: '#5FDBD3' }}>
                    {topPair.synergyScore}
                  </span>
                  <span style={{ font: "600 12px/1 'IBM Plex Mono', monospace", color: '#5FD9A2' }}>
                    ↑
                  </span>
                </div>
                <div style={{ font: "400 11px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  {t('leaderboard.pairBestFrom', { from: Math.max(50, topPair.synergyScore - 7) })}
                </div>
              </div>

              <div>
                <div style={{ font: '700 18px/1 Barlow, sans-serif', color: '#fff' }}>
                  +{topPair.pairImpact}pp
                </div>
                <div style={{ font: "400 11px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  impact
                </div>
              </div>

              <div>
                <div style={{ font: '700 18px/1 Barlow, sans-serif', color: '#fff' }}>
                  {topPair.gamesCount}
                </div>
                <div style={{ font: "400 11px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  {t('leaderboard.games')}
                </div>
              </div>

              <div>
                <div style={{ marginBottom: 2 }}>
                  <ConfidenceChip confidence={getPairConfTier(topPair)} />
                </div>
                <div style={{ font: "400 11px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  {t('rating.confidence.label')}
                </div>
              </div>

              <div style={{ flex: '1 1 0%' }} />

              <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
                <span style={{ display: 'flex', gap: 3 }}>
                  {(topPair.recentResults || ['W', 'W', 'W']).map((res, rIdx) => (
                    <span
                      key={rIdx}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 3,
                        background: res === 'W' ? 'rgba(18,168,103,.24)' : 'rgba(225,68,52,.22)',
                        color: res === 'W' ? '#5FD9A2' : '#FF9A8F',
                        font: "600 10px/18px 'IBM Plex Mono', monospace",
                        textAlign: 'center',
                      }}
                    >
                      {res === 'W' ? 'T' : 'B'}
                    </span>
                  ))}
                </span>
                <span style={{ font: "400 11px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  form 5 · {t('leaderboard.formHot', {
                    w: (topPair.recentResults || []).filter(r => r === 'W').length || (topPair.wins != null ? topPair.wins : 1),
                    l: (topPair.recentResults || []).filter(r => r === 'L').length || (topPair.losses != null ? topPair.losses : 0)
                  })}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Card 2: Kình địch tiêu biểu (Hiệu ứng rực cháy 🔥) */}
        {topRivalry ? (
          <div
            onClick={() => setSelectedH2HPair({ pairA: topRivalry.pairA, pairB: topRivalry.pairB })}
            style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.20) 0%, rgba(245, 158, 11, 0.14) 50%, #141D2E 100%)',
              border: '1px solid rgba(245, 158, 11, 0.45)',
              boxShadow: '0 4px 22px rgba(239, 68, 68, 0.12)',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'grid',
              gap: 9,
              cursor: 'pointer',
              transition: 'transform 0.15s ease, border-color 0.15s ease',
            }}
          >
            <span
              style={{
                font: "700 10px/1 'IBM Plex Mono', monospace",
                letterSpacing: '.06em',
                padding: '4px 9px',
                borderRadius: 999,
                background: 'linear-gradient(90deg, #FF5722 0%, #FF9800 100%)',
                color: '#FFFFFF',
                boxShadow: '0 2px 8px rgba(255, 87, 34, 0.35)',
                justifySelf: 'start',
              }}
            >
              {t('leaderboard.topRivalryBadge')}
            </span>

            <div style={{ font: '700 20px/1.2 Barlow, sans-serif', color: '#fff', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>{topRivalry.fromName}</span>
              <span style={{ font: "600 14px/1 'IBM Plex Mono', monospace", color: '#FF7A45' }}>⚔️</span>
              <span style={{ color: '#E9EFF7' }}>{topRivalry.toName}</span>
            </div>

            <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
              {t('leaderboard.topRivalryDesc', {
                from: topRivalry.fromName,
                to: topRivalry.toName,
                score: topRivalry.score,
                games: topRivalry.games,
                exp: topRivalry.expected,
                wins: topRivalry.wins,
              })}
            </div>

            <div
              style={{
                display: 'flex',
                gap: 16,
                paddingTop: 8,
                borderTop: '1px solid #22304A',
                marginTop: 2,
                flexWrap: 'wrap',
                alignItems: 'flex-end',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ font: '700 18px/1 Barlow, sans-serif', color: '#FF7A45' }}>
                    {topRivalry.score}
                  </span>
                  <span style={{ font: "600 12px/1 'IBM Plex Mono', monospace", color: '#FFA940' }}>
                    🔥
                  </span>
                </div>
                <div style={{ font: "400 11px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  {t('leaderboard.rivalryAdvantage')}
                </div>
              </div>

              <div>
                <div style={{ font: '700 18px/1 Barlow, sans-serif', color: '#fff' }}>
                  {topRivalry.impact >= 0 ? `+${topRivalry.impact}pp` : `${topRivalry.impact}pp`}
                </div>
                <div style={{ font: "400 11px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  {t('leaderboard.advantageEdge')}
                </div>
              </div>

              <div>
                <div style={{ font: '700 18px/1 Barlow, sans-serif', color: '#fff' }}>
                  {topRivalry.games}
                </div>
                <div style={{ font: "400 11px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  {t('leaderboard.games')}
                </div>
              </div>

              <div>
                <div style={{ font: "600 14px/1 'IBM Plex Mono', monospace", color: '#5FD9A2', marginBottom: 2 }}>
                  {topRivalry.wins}T – {topRivalry.losses}B
                </div>
                <div style={{ font: "400 11px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  {t('leaderboard.h2hRecord')}
                </div>
              </div>

              <div style={{ flex: '1 1 0%' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ font: "500 11px/1.3 'IBM Plex Sans', sans-serif", color: '#F0B75C' }}>
                  {t('leaderboard.viewH2HDetail')} →
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: '#141D2E',
              border: '1px dashed #2E3E5C',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'grid',
              gap: 8,
              alignContent: 'center',
            }}
          >
            <span
              style={{
                font: "600 10px/1 'IBM Plex Mono', monospace",
                letterSpacing: '.06em',
                padding: '3px 8px',
                borderRadius: 999,
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#F0B75C',
                justifySelf: 'start',
              }}
            >
              {t('leaderboard.topRivalryBadge')}
            </span>
            <div style={{ font: '600 16px/1.2 Barlow, sans-serif', color: '#E9EFF7' }}>
              {t('leaderboard.topRivalryEmptyTitle')}
            </div>
            <div style={{ font: "400 12px/1.45 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
              {t('leaderboard.topRivalryEmptyDesc')}
            </div>
          </div>
        )}
      </div>

      {/* Giao diện Mobile P1 vs Desktop */}
      {isMobile ? (
        <div data-screen-label="P1 Tab an y v1.1" style={{ display: 'flex', flexDirection: 'column', gap: 11, padding: '0 14px' }}>
          {/* Segmented Switch */}
          <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 8, background: '#101927', border: '1px solid #22304A' }}>
            <button
              type="button"
              onClick={() => setMobileSubTab('pairs')}
              style={{
                flex: 1,
                textAlign: 'center',
                font: "600 13px/1 'IBM Plex Sans', sans-serif",
                padding: '10px 4px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                background: mobileSubTab === 'pairs' ? '#141D2E' : 'transparent',
                color: mobileSubTab === 'pairs' ? '#E9EFF7' : '#8494AA',
              }}
            >
              {t('leaderboard.subtabPairs')}
            </button>
            <button
              type="button"
              onClick={() => setMobileSubTab('h2h')}
              style={{
                flex: 1,
                textAlign: 'center',
                font: "600 13px/1 'IBM Plex Sans', sans-serif",
                padding: '10px 4px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                background: mobileSubTab === 'h2h' ? '#141D2E' : 'transparent',
                color: mobileSubTab === 'h2h' ? '#E9EFF7' : '#8494AA',
              }}
            >
              {t('leaderboard.subtabH2H')}
            </button>
          </div>

          {/* Quick Filters Mobile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                gap: 4,
                padding: 2,
                borderRadius: 8,
                background: '#141D2E',
                border: '1px solid #22304A',
              }}
            >
              {[
                { key: 'MD', label: t('leaderboard.filterMD') },
                { key: 'WD', label: t('leaderboard.filterWD') },
                { key: 'XD', label: t('leaderboard.filterXD') },
              ].map((item) => {
                const active = formatFilter === item.key
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setFormatFilter(item.key)}
                    style={{
                      font: "600 11px/1 'IBM Plex Sans', sans-serif",
                      padding: '6px 9px',
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      background: active ? '#1D50A0' : 'transparent',
                      color: active ? '#fff' : '#A8B7CB',
                    }}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>

          {mobileSubTab === 'pairs' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {rankedPairs.length > 0 ? (
                rankedPairs.map((pair, idx) => {
                  const isTop = idx === 0 && (pair.synergyScore || 50) >= 80
                  const isProvisional = (pair.gamesCount || 0) < 5
                  const displayScore = typeof pair.synergyScore === 'number' && !isNaN(pair.synergyScore)
                    ? pair.synergyScore
                    : 50
                  const confTier = getPairConfTier(pair)
                  const trend = pair.trend || 'steady'
                  const impactVal = pair.pairImpact || 0
                  const impactSign = impactVal > 0 ? `+${impactVal}pp` : `${impactVal}pp`

                  const tagLabel = isTop ? t('leaderboard.tagTop1') : (pair.formKey === 'hot' || trend === 'up' ? t('leaderboard.tagHot') : t('leaderboard.tagStable'))
                  const tagStyle = isTop
                    ? { background: 'rgba(0, 178, 169, 0.20)', color: '#5FDBD3' }
                    : tagLabel === t('leaderboard.tagHot')
                    ? { background: 'rgba(18, 168, 103, 0.20)', color: '#5FD9A2' }
                    : { background: 'rgba(148, 164, 186, 0.16)', color: '#A8B7CB' }

                  const recentResults = pair.recentResults || []
                  const form5 = []
                  for (let i = 0; i < 5; i++) {
                    form5.push(i < recentResults.length ? recentResults[i] : null)
                  }

                  const expPct = Math.round(pair.expectedWinPct || 50)
                  const actPct = Math.round(pair.actualWinPct || 0)

                  return (
                    <div
                      key={getPairKey(pair) || idx}
                      onClick={() => setSelectedPair(pair)}
                      style={{
                        background: '#141D2E',
                        border: isTop ? '1px solid #00786F' : '1px solid #22304A',
                        borderRadius: 10,
                        padding: 13,
                        display: 'grid',
                        gap: 10,
                        cursor: 'pointer',
                      }}
                    >
                      {/* Header: Tên cặp + Tag */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ flex: 1, font: "600 16px/1.25 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                          {getPairNames(pair).join(' · ')}
                        </span>
                        <span
                          style={{
                            font: "500 10.5px/1 'IBM Plex Sans', sans-serif",
                            padding: '5px 8px',
                            borderRadius: 999,
                            ...tagStyle,
                          }}
                        >
                          {tagLabel}
                        </span>
                      </div>

                      {/* Điểm ăn ý + trend + số trận + confidence */}
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                            <span style={{ font: '700 30px/1 Barlow, sans-serif', color: isTop ? '#5FDBD3' : isProvisional ? '#A8B7CB' : '#E9EFF7' }}>
                              {displayScore}
                            </span>
                            {isProvisional && (
                              <span
                                style={{
                                  font: "600 16px/1 'IBM Plex Mono', monospace",
                                  color: '#F0B75C',
                                  marginRight: 2,
                                }}
                              >
                                ~
                              </span>
                            )}
                            <span style={{ font: "600 15px/1 'IBM Plex Mono', monospace", color: trend === 'up' ? '#5FD9A2' : trend === 'down' ? '#FF9A8F' : '#8494AA' }}>
                              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
                            </span>
                          </div>
                          <div style={{ font: "400 11px/1.4 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                            {pair.previousScore ? t('leaderboard.synergyFromScore', { prev: pair.previousScore }) : t('leaderboard.synergyCol')}
                          </div>
                        </div>

                        <div style={{ flex: 1 }} />

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ font: "400 13px/1.3 'IBM Plex Mono', monospace", color: '#A8B7CB' }}>
                            {t('leaderboard.gamesCountShort', { n: pair.gamesCount })}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setConfidenceSheetOpen(true)
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              padding: 0,
                              marginTop: 2,
                              cursor: 'pointer',
                            }}
                          >
                            <ConfidenceChip confidence={confTier} />
                          </button>
                        </div>
                      </div>

                      {/* Kỳ vọng vs Thực tế bar */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 9, alignItems: 'center' }}>
                        <span style={{ font: "400 12.5px/1 'IBM Plex Mono', monospace", color: '#9FC0EA' }}>
                          {t('leaderboard.expectedCol')} {expPct}%
                        </span>
                        <span style={{ height: 5, borderRadius: 999, background: '#22304A', overflow: 'hidden', display: 'flex', position: 'relative' }}>
                          <span style={{ width: `${Math.min(100, Math.max(0, expPct))}%`, background: '#3C74C4' }} />
                          <span style={{ position: 'absolute', left: `${Math.min(99, Math.max(1, actPct))}%`, top: -3, width: 2, height: 11, background: '#5FD9A2' }} />
                        </span>
                        <span style={{ font: "400 12.5px/1 'IBM Plex Mono', monospace", color: '#5FD9A2' }}>
                          {actPct}%
                        </span>
                      </div>

                      {/* Form 5 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span style={{ font: "400 12px/1 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                          {t('leaderboard.form5Matches')}
                        </span>
                        <span style={{ display: 'flex', gap: 3 }}>
                          {form5.map((res, fIdx) => (
                            <span
                              key={fIdx}
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 3,
                                background: res === 'W' ? 'rgba(18,168,103,.24)' : res === 'L' ? 'rgba(225,68,52,.22)' : 'rgba(255,255,255,.05)',
                                color: res === 'W' ? '#5FD9A2' : res === 'L' ? '#FF9A8F' : '#55657E',
                                font: "600 10px/18px 'IBM Plex Mono', monospace",
                                textAlign: 'center',
                              }}
                            >
                              {res === 'W' ? 'T' : res === 'L' ? 'B' : '—'}
                            </span>
                          ))}
                        </span>
                        <div style={{ flex: 1 }} />
                        <span style={{ font: "600 13px/1 'IBM Plex Mono', monospace", color: impactVal > 0 ? '#5FD9A2' : impactVal < 0 ? '#FF9A8F' : '#A8B7CB' }}>
                          {impactSign}
                        </span>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: '#8494AA', font: "400 13px/1.4 'IBM Plex Sans', sans-serif" }}>
                  {t('leaderboard.noPairsFound')}
                </div>
              )}

              <div style={{ font: "400 12px/1.55 'IBM Plex Sans', sans-serif", color: '#8494AA', padding: '4px 0 12px' }}>
                {t('leaderboard.dp1FooterNote')}
              </div>
            </div>
          ) : (
            /* Subtab H2H trên Mobile */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {clubRivalries.length > 0 ? (
                clubRivalries.map((m, mIdx) => {
                  const isDominant = m.score >= 60
                  return (
                    <div
                      key={mIdx}
                      onClick={() => setSelectedH2HPair({ pairA: m.pairA, pairB: m.pairB })}
                      style={{
                        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(245, 158, 11, 0.08) 50%, #141D2E 100%)',
                        border: mIdx === 0 ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid #22304A',
                        borderRadius: 10,
                        padding: 13,
                        display: 'grid',
                        gap: 8,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ font: "600 14px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7', flex: 1, minWidth: 0 }}>
                          {m.fromName} ⚔️ {m.toName}
                        </span>
                        <span
                          style={{
                            font: "700 10px/1 'IBM Plex Sans', sans-serif",
                            letterSpacing: '0.04em',
                            padding: '3px 7px',
                            borderRadius: 4,
                            background: isDominant ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                            color: isDominant ? '#FF7A45' : '#F0B75C',
                            border: `1px solid ${isDominant ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isDominant ? t('leaderboard.rivalryDominant') : t('leaderboard.rivalryAdvantageBadge')}
                        </span>
                        <span style={{ font: "700 15px/1 Barlow, sans-serif", color: '#FF7A45', whiteSpace: 'nowrap' }}>
                          {m.score} 🔥
                        </span>
                      </div>
                      <div style={{ font: "400 11.5px/1.45 'IBM Plex Mono', monospace", color: '#8494AA', display: 'flex', flexWrap: 'wrap', gap: '4px 8px', alignItems: 'center' }}>
                        <span style={{ color: '#C5D3E8' }}>
                          {t('leaderboard.rivalryStats', { wins: m.wins, losses: m.losses, games: m.games })}
                        </span>
                        <span style={{ color: '#5B6B81' }}>•</span>
                        <span style={{ color: m.impact >= 0 ? '#5FD9A2' : '#FF9A8F' }}>
                          {m.impact >= 0 ? `+${m.impact}pp` : `${m.impact}pp`} {t('leaderboard.advantageEdge')}
                        </span>
                        <span style={{ color: '#5B6B81' }}>•</span>
                        <span>
                          {t('leaderboard.expToActual', { exp: m.expected, actual: m.actual })}
                        </span>
                        {m.avgScoreDiff && m.avgScoreDiff !== '0.0' && (
                          <>
                            <span style={{ color: '#5B6B81' }}>•</span>
                            <span style={{ color: m.avgScoreDiff.startsWith('+') ? '#5FD9A2' : '#FF9A8F' }}>
                              {t('leaderboard.scoreDiffPerSet', { diff: m.avgScoreDiff })}
                            </span>
                          </>
                        )}
                      </div>
                      {m.recentScores?.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 2 }}>
                          <span style={{ font: "400 11px/1 'IBM Plex Sans', sans-serif", color: '#5B6B81' }}>
                            {t('leaderboard.recentSets')}:
                          </span>
                          {m.recentScores.slice(-3).map((sc, scIdx) => (
                            <span
                              key={scIdx}
                              style={{
                                font: "500 11px/1 'IBM Plex Mono', monospace",
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: '#101927',
                                border: '1px solid #22304A',
                                color: '#A8B7CB',
                              }}
                            >
                              {sc}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                <div style={{ padding: 20, textAlign: 'center', color: '#8494AA', font: "400 13px/1.4 'IBM Plex Sans', sans-serif" }}>
                  {t('leaderboard.noCrossMatchupHistory')}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Quick Filters Desktop */}
          <div style={{ padding: '0 20px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                gap: 6,
                padding: 3,
                borderRadius: 8,
                background: '#141D2E',
                border: '1px solid #22304A',
              }}
            >
              {[
                { key: 'MD', label: t('leaderboard.filterMD') },
                { key: 'WD', label: t('leaderboard.filterWD') },
                { key: 'XD', label: t('leaderboard.filterXD') },
              ].map((item) => {
                const active = formatFilter === item.key
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setFormatFilter(item.key)}
                    style={{
                      font: "600 12px/1 'IBM Plex Sans', sans-serif",
                      padding: '7px 12px',
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      background: active ? '#1D50A0' : 'transparent',
                      color: active ? '#fff' : '#A8B7CB',
                    }}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Main Grid: Left Column & Right Column Desktop */}
          <div
            style={{
              padding: '0 20px',
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1fr) 348px',
              gap: 16,
              alignItems: 'start',
            }}
          >
        {/* Left Side: Banner + Table + 2 Subcards */}
        <div style={{ display: 'grid', gap: 12 }}>
          {/* Banner "Ăn ý không phải tỷ lệ thắng" */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(0,178,169,.12), #141D2E 62%)',
              border: '1px solid #22304A',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'grid',
              gap: 9,
            }}
          >
            <div style={{ font: "600 13px/1.3 'IBM Plex Sans', sans-serif", color: '#5FDBD3' }}>
              {t('leaderboard.synergyNotWinrate')}
            </div>
            <div
              style={{
                font: "400 13px/1.55 'IBM Plex Sans', sans-serif",
                color: '#A8B7CB',
                maxWidth: 640,
              }}
            >
              {t('leaderboard.synergyNotWinrateDesc')}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 2 }}>
              <span
                style={{
                  font: "400 11px/1.3 'IBM Plex Mono', monospace",
                  color: '#8494AA',
                  padding: '5px 9px',
                  borderRadius: 6,
                  background: '#0B1220',
                  border: '1px solid #22304A',
                }}
              >
                {t('leaderboard.expectedFormulaBadge')}
              </span>
              <span
                style={{
                  font: "400 11px/1.3 'IBM Plex Mono', monospace",
                  color: '#8494AA',
                  padding: '5px 9px',
                  borderRadius: 6,
                  background: '#0B1220',
                  border: '1px solid #22304A',
                }}
              >
                {t('leaderboard.synergyFormulaBadge')}
              </span>
            </div>
          </div>

          {/* Table Bảng Ăn ý - DP1 v1.1 */}
          <div style={{ background: '#141D2E', border: '1px solid #22304A', borderRadius: 10, overflow: 'hidden' }}>
            {/* Header Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.35fr) 95px 120px 145px 65px 75px',
                gap: 10,
                padding: '10px 15px',
                background: '#101927',
                borderBottom: '1px solid #22304A',
                font: "600 11px/1.2 'IBM Plex Sans', sans-serif",
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#8494AA',
              }}
            >
              <span>{t('leaderboard.pairCol')}</span>
              <span>{t('leaderboard.synergyCol')}</span>
              <span>{t('leaderboard.recentForm')}</span>
              <span>{t('leaderboard.expectedCol')} → {t('leaderboard.actualCol')}</span>
              <span style={{ textAlign: 'right' }}>{t('leaderboard.impactCol')}</span>
              <span style={{ textAlign: 'right' }}>{t('leaderboard.confidenceCol')}</span>
            </div>

            {/* Rows */}
            {rankedPairs.length > 0 ? (
              rankedPairs.map((pair, idx) => {
                const isTop = idx === 0 && pair.synergyScore >= 80
                const isLow = pair.pairImpact <= -10 && pair.gamesCount >= 5
                const isProvisional = (pair.gamesCount || 0) < 5

                const impactVal = pair.pairImpact || 0
                const confTier = getPairConfTier(pair)

                const rowBg = isTop
                  ? 'rgba(0,178,169,.07)'
                  : isLow
                    ? 'rgba(224,138,0,.06)'
                    : 'transparent'

                const dateStr = pair.lastMatchDate
                  ? t('leaderboard.recentDate', { date: new Date(pair.lastMatchDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) })
                  : pair.format === 'XD'
                    ? t('leaderboard.mixedFormatShort')
                    : t('leaderboard.newlyPaired')

                const trend = pair.trend || 'steady'

                // Form 5 trận gần nhất
                const recentResults = pair.recentResults || []
                const form5 = []
                for (let i = 0; i < 5; i++) {
                  form5.push(i < recentResults.length ? recentResults[i] : null)
                }

                return (
                  <div
                    key={getPairKey(pair) || idx}
                    onClick={() => setSelectedPair(pair)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1.35fr) 95px 120px 145px 65px 75px',
                      gap: 10,
                      padding: '12px 15px',
                      borderBottom: '1px solid #22304A',
                      alignItems: 'center',
                      background: rowBg,
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {/* Cột 1: Cặp + Tag + Meta */}
                    <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ display: 'flex', flex: '0 0 auto' }}>
                        <span
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 999,
                            background: isTop ? '#1D50A0' : '#3C74C4',
                            border: '2px solid #141D2E',
                          }}
                        />
                        <span
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 999,
                            background: isTop ? '#00786F' : '#7AA3DC',
                            border: '2px solid #141D2E',
                            marginLeft: -9,
                          }}
                        />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ font: "600 13.5px/1.25 'IBM Plex Sans', sans-serif", color: '#fff' }}>
                            {getPairNames(pair).join(' · ')}
                          </span>
                          {isTop && (
                            <span style={{
                              font: '700 9.5px/1 "IBM Plex Sans", sans-serif',
                              padding: '2px 5px',
                              borderRadius: 4,
                              background: 'rgba(0, 178, 169, 0.18)',
                              color: '#5FDBD3',
                              border: '1px solid rgba(0, 178, 169, 0.35)',
                              letterSpacing: '0.04em',
                            }}>
                              {t('leaderboard.tagTop1')}
                            </span>
                          )}
                          {!isTop && pair.formKey === 'hot' && (
                            <span style={{
                              font: '700 9.5px/1 "IBM Plex Sans", sans-serif',
                              padding: '2px 5px',
                              borderRadius: 4,
                              background: 'rgba(214, 59, 43, 0.18)',
                              color: '#F09A8E',
                              border: '1px solid rgba(214, 59, 43, 0.35)',
                              letterSpacing: '0.04em',
                            }}>
                              {t('leaderboard.tagHot')}
                            </span>
                          )}
                          {!isTop && pair.formKey === 'stable' && (pair.gamesCount || 0) >= 5 && (
                            <span style={{
                              font: '600 9.5px/1 "IBM Plex Sans", sans-serif',
                              padding: '2px 5px',
                              borderRadius: 4,
                              background: 'rgba(60, 116, 196, 0.16)',
                              color: '#7AA3DC',
                              border: '1px solid rgba(60, 116, 196, 0.3)',
                              letterSpacing: '0.04em',
                            }}>
                              {t('leaderboard.tagStable')}
                            </span>
                          )}
                        </div>
                        <div style={{ font: "400 11px/1.35 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                          {typeof pair.combinedRating === 'number' && !isNaN(pair.combinedRating) ? `${t('leaderboard.pairCombinedElo', { n: pair.combinedRating })} · ` : ''}
                          {pair.gamesCount} {t('units.match')} · {dateStr}
                        </div>
                      </div>
                    </div>

                    {/* Cột 2: Ăn ý + Trend */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                        <span
                          style={{
                            font: '700 17px/1 Barlow, sans-serif',
                            color: isTop ? '#5FDBD3' : isLow ? '#F09A8E' : isProvisional ? '#A8B7CB' : '#E9EFF7',
                          }}
                        >
                          {pair.synergyScore}
                        </span>
                        {isProvisional && (
                          <span style={{ font: "600 12px/1 'IBM Plex Mono', monospace", color: '#F0B75C' }}>~</span>
                        )}
                      </div>
                      <div style={{
                        font: "600 10.5px/1.2 'IBM Plex Sans', sans-serif",
                        color: trend === 'up' ? '#5FDBD3' : trend === 'down' ? '#F09A8E' : '#8494AA',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        marginTop: 2,
                      }}>
                        <span>{trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}</span>
                        <span>
                          {trend === 'up'
                            ? t('leaderboard.trendUp')
                            : trend === 'down'
                            ? t('leaderboard.trendDown')
                            : t('leaderboard.trendSteady')}
                        </span>
                      </div>
                    </div>

                    {/* Cột 3: Form 5 trận */}
                    <div style={{ display: 'flex', gap: 3 }}>
                      {form5.map((res, fIdx) => {
                        if (res === 'W') {
                          return (
                            <span
                              key={fIdx}
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 3,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                font: '700 10px/1 "IBM Plex Sans", sans-serif',
                                background: 'rgba(14, 122, 77, 0.16)',
                                color: '#5FDBD3',
                                border: '1px solid rgba(14, 122, 77, 0.35)',
                              }}
                            >
                              T
                            </span>
                          )
                        }
                        if (res === 'L') {
                          return (
                            <span
                              key={fIdx}
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 3,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                font: '700 10px/1 "IBM Plex Sans", sans-serif',
                                background: 'rgba(214, 59, 43, 0.18)',
                                color: '#F09A8E',
                                border: '1px solid rgba(214, 59, 43, 0.35)',
                              }}
                            >
                              B
                            </span>
                          )
                        }
                        return (
                          <span
                            key={fIdx}
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 3,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              font: '400 10px/1 "IBM Plex Mono", monospace',
                              background: 'rgba(255, 255, 255, 0.04)',
                              color: '#50607A',
                              border: '1px solid #22304A',
                            }}
                          >
                            —
                          </span>
                        )
                      })}
                    </div>

                    {/* Cột 4: Kỳ vọng → Thực tế */}
                    {(() => {
                      const exp = pair.expectedWinPct ?? 50
                      const act = pair.actualWinPct ?? 50
                      const barColor = impactVal >= 0 ? '#00B2A9' : (isLow ? '#D63B2B' : '#E08A00')
                      const loFill = Math.min(exp, act)
                      const hiFill = Math.max(exp, act)
                      const isOver = act >= exp
                      return (
                        <div style={{ display: 'grid', gap: 4, width: '100%' }}>
                          {/* Track */}
                          <div style={{
                            position: 'relative',
                            height: 8,
                            borderRadius: 999,
                            background: '#0B1220',
                            border: '1px solid #22304A',
                          }}>
                            {/* Segment "đến min(exp,act)" — luôn hiện */}
                            <div style={{
                              position: 'absolute', left: 0, top: 0, bottom: 0,
                              width: `${loFill}%`,
                              borderRadius: '999px 0 0 999px',
                              background: isOver ? '#1A3A55' : barColor,
                            }} />
                            {/* Segment "khoảng lệch" — màu nổi bật */}
                            <div style={{
                              position: 'absolute', left: `${loFill}%`, top: 0, bottom: 0,
                              width: `${hiFill - loFill}%`,
                              borderRadius: loFill === 0 ? '999px 0 0 999px' : '0',
                              background: barColor,
                            }} />
                            {/* Needle kỳ vọng — vạch trắng thẳng đứng */}
                            <div style={{
                              position: 'absolute',
                              left: `${exp}%`,
                              top: -1, bottom: -1,
                              width: 2,
                              marginLeft: -1,
                              background: '#fff',
                              borderRadius: 1,
                              opacity: 0.7,
                            }} />
                          </div>
                          {/* Labels */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: '#5B6B81' }}>
                              kv {exp}%
                            </span>
                            <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: '#5B6B81' }}>·</span>
                            <span style={{ font: "600 10.5px/1 'IBM Plex Mono', monospace", color: barColor }}>
                              tt {act}%
                            </span>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Cột 5: Lệch pp */}
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        font: "700 13px/1 'IBM Plex Mono', monospace",
                        color: impactVal >= 0 ? '#5FDBD3' : (isLow ? '#F09A8E' : '#F0B75C'),
                      }}>
                        {impactVal >= 0 ? `+${impactVal}` : `${impactVal}`}pp
                      </span>
                    </div>

                    {/* Cột 6: Độ tin cậy */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <ConfidenceChip confidence={confTier} />
                    </div>
                  </div>
                )
              })
            ) : (
              <div style={{ padding: 24, textAlign: 'center', color: '#8494AA', font: "400 13px 'IBM Plex Sans', sans-serif" }}>
                {t('leaderboard.empty')}
              </div>
            )}

            {/* Chú thích đáy bảng DP1 */}
            <div style={{ padding: '10px 15px', background: '#101927', borderTop: '1px solid #22304A', font: '400 11.5px/1.4 "IBM Plex Sans", sans-serif', color: '#8494AA' }}>
              {t('leaderboard.dp1FooterNote')}
            </div>
          </div>

          {/* 2 Subcards below table */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            {/* Subcard 1: Khắc chế có hướng */}
            <div
              style={{
                background: '#141D2E',
                border: '1px solid #22304A',
                borderRadius: 10,
                padding: '13px 15px',
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#fff' }}>
                {t('leaderboard.directionalMatchupTitle')}
              </div>
              <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                {t('leaderboard.directionalMatchupDesc')}
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {directionalMatchups.length > 0 ? (
                  directionalMatchups.map((mItem, mIdx) => {
                    const isDominant = mItem.score >= 60
                    return (
                      <div
                        key={mIdx}
                        onClick={() => setSelectedH2HPair({ pairA: mItem.pairA, pairB: mItem.pairB })}
                        title={t('leaderboard.viewH2HDetail')}
                        style={{
                          display: 'grid',
                          gap: 6,
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: '#101927',
                          border: '1px solid #22304A',
                          cursor: 'pointer',
                          transition: 'border-color 0.15s ease, background 0.15s ease',
                        }}
                      >
                        {/* Dòng 1: Cặp A ⚔️ Cặp B + Tag + Điểm kình địch */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ font: "600 13px/1.3 'IBM Plex Sans', sans-serif", color: '#fff', flex: 1, minWidth: 0 }}>
                            {mItem.fromName} ⚔️ {mItem.toName}
                          </span>
                          <span
                            style={{
                              font: "700 9.5px/1 'IBM Plex Sans', sans-serif",
                              letterSpacing: '0.04em',
                              padding: '2.5px 6px',
                              borderRadius: 4,
                              background: isDominant ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                              color: isDominant ? '#FF7A45' : '#F0B75C',
                              border: `1px solid ${isDominant ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {isDominant ? t('leaderboard.rivalryDominant') : t('leaderboard.rivalryAdvantageBadge')}
                          </span>
                          <span
                            style={{
                              font: '700 15px/1 Barlow, sans-serif',
                              color: mItem.score >= 60 ? '#FF7A45' : mItem.score >= 45 ? '#F0B75C' : '#8494AA',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {mItem.score} 🔥
                          </span>
                        </div>

                        {/* Dòng 2: Chi tiết chỉ số */}
                        <div style={{ font: "400 11px/1.4 'IBM Plex Mono', monospace", color: '#8494AA', display: 'flex', flexWrap: 'wrap', gap: '3px 8px', alignItems: 'center' }}>
                          <span style={{ color: '#C5D3E8' }}>
                            {t('leaderboard.rivalryStats', { wins: mItem.wins, losses: mItem.losses, games: mItem.games })}
                          </span>
                          <span style={{ color: '#5B6B81' }}>•</span>
                          <span style={{ color: mItem.impact >= 0 ? '#5FD9A2' : '#FF9A8F' }}>
                            {mItem.impact >= 0 ? `+${mItem.impact}pp` : `${mItem.impact}pp`} {t('leaderboard.advantageEdge')}
                          </span>
                          <span style={{ color: '#5B6B81' }}>•</span>
                          <span>
                            {t('leaderboard.expToActual', { exp: mItem.expected, actual: mItem.actual })}
                          </span>
                          {mItem.avgScoreDiff && mItem.avgScoreDiff !== '0.0' && (
                            <>
                              <span style={{ color: '#5B6B81' }}>•</span>
                              <span style={{ color: mItem.avgScoreDiff.startsWith('+') ? '#5FD9A2' : '#FF9A8F' }}>
                                {t('leaderboard.scoreDiffPerSet', { diff: mItem.avgScoreDiff })}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Dòng 3: Set gần nhất (nếu có) */}
                        {mItem.recentScores?.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', paddingTop: 2 }}>
                            <span style={{ font: "400 10.5px/1 'IBM Plex Sans', sans-serif", color: '#5B6B81' }}>
                              {t('leaderboard.recentSets')}:
                            </span>
                            {mItem.recentScores.slice(-3).map((sc, scIdx) => (
                              <span
                                key={scIdx}
                                style={{
                                  font: "500 10.5px/1 'IBM Plex Mono', monospace",
                                  padding: '1.5px 5px',
                                  borderRadius: 4,
                                  background: '#141D2E',
                                  border: '1px solid #22304A',
                                  color: '#A8B7CB',
                                }}
                              >
                                {sc}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <div style={{ font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                    {t('leaderboard.noCrossMatchupHistory')}
                  </div>
                )}
              </div>
            </div>

            {/* Subcard 2: Ăn ý so với kỳ vọng */}
            <div
              style={{
                background: '#141D2E',
                border: '1px solid #22304A',
                borderRadius: 10,
                padding: '13px 15px',
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#fff' }}>
                {t('leaderboard.synergyVsExpectedTitle')}
              </div>
              <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                {t('leaderboard.synergyVsExpectedDesc')}
              </div>
              <div style={{ display: 'grid', gap: 9 }}>
                {topPair && (
                  <div style={{ display: 'grid', gap: 5, padding: '9px 11px', borderRadius: 7, background: '#101927', border: '1px solid #22304A' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", flex: 1, color: '#fff' }}>
                        {getPairNames(topPair).join(' · ')}
                      </span>
                      <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                        {t('leaderboard.oppExpectedPct', { exp: topPair.expectedWinPct })}
                      </span>
                      <span style={{ font: "600 13px/1 'IBM Plex Mono', monospace", color: '#5FDBD3' }}>
                        {topPair.actualWinPct}%
                      </span>
                    </div>
                    <div style={{ height: 7, borderRadius: 999, background: '#0B1220', overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: `${topPair.expectedWinPct}%`, background: '#2E3E5C' }} />
                      <div style={{ width: `${Math.max(0, topPair.actualWinPct - topPair.expectedWinPct)}%`, background: '#00B2A9' }} />
                    </div>
                    <div style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: '#5FDBD3' }}>
                      {t('leaderboard.impactSummary', {
                        sign: '+',
                        pp: topPair.pairImpact,
                        games: topPair.gamesCount,
                        conf: getPairConfTier(topPair),
                      })}
                    </div>
                  </div>
                )}

                {underperformingPair && getPairKey(underperformingPair) !== getPairKey(topPair) && (
                  <div style={{ display: 'grid', gap: 5, padding: '9px 11px', borderRadius: 7, background: '#101927', border: '1px solid #22304A' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", flex: 1, color: '#fff' }}>
                        {getPairNames(underperformingPair).join(' · ')}
                      </span>
                      <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                        {t('leaderboard.oppExpectedPct', { exp: underperformingPair.expectedWinPct })}
                      </span>
                      <span style={{ font: "600 13px/1 'IBM Plex Mono', monospace", color: '#F09A8E' }}>
                        {underperformingPair.actualWinPct}%
                      </span>
                    </div>
                    <div style={{ height: 7, borderRadius: 999, background: '#0B1220', overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: `${underperformingPair.actualWinPct}%`, background: '#2E3E5C' }} />
                      <div style={{ width: `${Math.max(0, underperformingPair.expectedWinPct - underperformingPair.actualWinPct)}%`, background: '#D63B2B' }} />
                    </div>
                    <div style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: '#F09A8E' }}>
                      {t('leaderboard.impactSummary', {
                        sign: '',
                        pp: underperformingPair.pairImpact,
                        games: underperformingPair.gamesCount,
                        conf: getPairConfTier(underperformingPair),
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: 2 Rail Cards */}
        <div style={{ display: 'grid', gap: 12 }}>
          {/* Card 1: Dưới kỳ vọng nhiều nhất */}
          <div style={{ background: '#141D2E', border: '1px solid #E08A00', borderRadius: 10, overflow: 'hidden' }}>
            <div
              style={{
                padding: '11px 14px',
                background: 'rgba(224,138,0,.14)',
                borderBottom: '1px solid #22304A',
                font: "600 13px/1.3 'IBM Plex Sans', sans-serif",
                color: '#F0B75C',
              }}
            >
              {t('leaderboard.underperformingTitle')}
            </div>
            <div style={{ padding: '13px 14px', display: 'grid', gap: 11 }}>
              <div style={{ font: "400 12.5px/1.55 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                {underperformingPair
                  ? t('leaderboard.underperformingLossSummary', {
                      names: getPairNames(underperformingPair).join(' · '),
                      losses: underperformingPair.losses,
                      games: underperformingPair.gamesCount,
                      exp: underperformingPair.expectedWinPct,
                    })
                  : t('leaderboard.underperformingDesc')}
              </div>

              <div style={{ display: 'grid', gap: 7 }}>
                {topUnderperformingList.map((p, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      font: "400 12px/1.4 'IBM Plex Mono', monospace",
                    }}
                  >
                    <span style={{ color: '#8494AA' }}>{getPairNames(p).join(' · ')}</span>
                    <span style={{ color: p.pairImpact <= -12 ? '#F09A8E' : '#F0B75C' }}>
                      {p.pairImpact} {t('leaderboard.pointsPct')}
                    </span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  font: "400 12px/1.5 'IBM Plex Sans', sans-serif",
                  color: '#8494AA',
                  borderTop: '1px solid #22304A',
                  paddingTop: 9,
                }}
              >
                {t('leaderboard.underperformingDisclaimer')}
              </div>
            </div>
          </div>

          {/* Card 3: Chưa đủ dữ liệu */}
          <div
            style={{
              background: '#141D2E',
              border: '1px solid #22304A',
              borderRadius: 10,
              padding: '13px 15px',
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#fff' }}>
              {t('leaderboard.provisionalPairsTitle')}
            </div>
            <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
              {t('leaderboard.provisionalPairsDesc', { count: provisionalPairs.length })}
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {provisionalPairs.slice(0, 3).map((p, pIdx) => (
                <div
                  key={pIdx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0,1fr) auto',
                    gap: 8,
                    alignItems: 'center',
                    padding: '7px 10px',
                    borderRadius: 6,
                    background: '#101927',
                    border: '1px solid #22304A',
                  }}
                >
                  <span style={{ font: "600 12.5px/1.3 'IBM Plex Sans', sans-serif", color: '#fff' }}>
                    {getPairNames(p).join(' · ')}
                  </span>
                  <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: '#F0B75C' }}>
                    {p.gamesCount}/5 {t('leaderboard.matchesAbbr')}
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              style={{
                font: "600 12px/1 'IBM Plex Sans', sans-serif",
                padding: '9px 12px',
                borderRadius: 6,
                background: '#1A2437',
                border: '1px solid #2E3E5C',
                color: '#E9EFF7',
                textAlign: 'center',
                cursor: 'pointer',
              }}
            >
              {t('leaderboard.prioritizePairTonight')}
            </button>
          </div>
        </div>
      </div>
    </>
  )}

      {/* Modal AY2: Thẻ chi tiết cặp đôi */}
      {selectedPair && (
        <PairDetailModal
          pair={{ ...selectedPair, membersMap: selectedPair.membersMap || membersMap }}
          db={db}
          membersMap={membersMap}
          onClose={() => setSelectedPair(null)}
          onViewMatches={onViewPairMatches}
          ratingsMap={ratingsMap}
          matches={matches}
        />
      )}

      {/* Modal EA2: Công thức rating & biên thắng */}
      {formulaModalOpen && (
        <RatingFormulaModal
          onClose={() => setFormulaModalOpen(false)}
          totalMatches={totalDoublesMatches}
        />
      )}

      {/* Sheet P4: Giải thích Độ tin cậy R1-R4 */}
      {confidenceSheetOpen && (
        <ConfidenceExplainerSheet
          onClose={() => setConfidenceSheetOpen(false)}
        />
      )}

      {/* Modal P6: Sheet đối đầu hai cặp */}
      {selectedH2HPair && (
        <PairH2HModal
          pairA={selectedH2HPair.pairA}
          pairB={selectedH2HPair.pairB}
          matches={matches}
          membersMap={membersMap}
          ratingsMap={ratingsMap}
          onClose={() => setSelectedH2HPair(null)}
        />
      )}
    </div>
  )
}
