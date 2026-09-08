import { useState, useMemo } from 'react'
import { t } from '#i18n'
import { rankPairs, calcMatchupEdge } from '#lib/rating.js'
import PairDetailModal from './PairDetailModal.jsx'
import RatingFormulaModal from './RatingFormulaModal.jsx'

export default function PairsTab({
  matches = [],
  membersMap = {},
  ratingsMap = {},
  onExportCsv,
  onViewPairMatches,
}) {
  const [formatFilter, setFormatFilter] = useState('all') // 'all' | 'MD' | 'WD' | 'XD'
  const [min5Only, setMin5Only] = useState(false)
  const [selectedPair, setSelectedPair] = useState(null)
  const [formulaModalOpen, setFormulaModalOpen] = useState(false)

  // Tính bảng xếp hạng cặp đôi theo logic core vNext
  const pairsData = useMemo(() => {
    return rankPairs(matches, membersMap, ratingsMap, {
      format: formatFilter,
      minGames: min5Only ? 5 : 1,
    })
  }, [matches, membersMap, ratingsMap, formatFilter, min5Only])

  // Toàn bộ cặp (không lọc format/trận) để tìm top/underperforming và đếm tổng
  const allPairsData = useMemo(() => {
    return rankPairs(matches, membersMap, ratingsMap, {
      format: 'all',
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

  // Dữ liệu mẫu danh sách khắc chế có hướng (Subcard 1)
  const directionalMatchups = useMemo(() => {
    if (rankedPairs.length < 2) return []
    const results = []
    for (let i = 0; i < Math.min(4, rankedPairs.length); i++) {
      for (let j = i + 1; j < Math.min(4, rankedPairs.length); j++) {
        const pA = rankedPairs[i]
        const pB = rankedPairs[j]
        const keysA = pA.key.split(':')
        const keysB = pB.key.split(':')
        const edgeAB = calcMatchupEdge(matches, keysA, keysB, ratingsMap)
        if (edgeAB.games >= 2) {
          const edgeBA = calcMatchupEdge(matches, keysB, keysA, ratingsMap)
          results.push({
            fromName: pA.names.join('·'),
            toName: pB.names.join('·'),
            games: edgeAB.games,
            expected: edgeAB.expectedA,
            actual: edgeAB.actualA,
            score: edgeAB.edgeScore,
          })
          results.push({
            fromName: pB.names.join('·'),
            toName: pA.names.join('·'),
            games: edgeBA.games,
            expected: edgeBA.expectedA,
            actual: edgeBA.actualA,
            score: edgeBA.edgeScore,
          })
        }
      }
    }
    return results.slice(0, 3)
  }, [rankedPairs, matches, ratingsMap])

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

      {/* Quick Filters */}
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
            { key: 'all', label: t('leaderboard.filterAllFormats') },
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

        <button
          type="button"
          onClick={() => setMin5Only(!min5Only)}
          style={{
            font: "600 12px/1 'IBM Plex Sans', sans-serif",
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #22304A',
            cursor: 'pointer',
            background: min5Only ? '#00B2A9' : '#141D2E',
            color: min5Only ? '#04302C' : '#A8B7CB',
            fontWeight: min5Only ? 700 : 600,
          }}
        >
          {t('leaderboard.min5Games')}
        </button>
      </div>

      {/* Main Grid: Left Column & Right Column */}
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

          {/* Table Bảng Ăn ý */}
          <div style={{ background: '#141D2E', border: '1px solid #22304A', borderRadius: 10, overflow: 'hidden' }}>
            {/* Header Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '34px minmax(0,1fr) 52px 66px 62px 116px 68px 74px',
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
              <span>#</span>
              <span>{t('leaderboard.pairCol')}</span>
              <span style={{ textAlign: 'right' }}>{t('leaderboard.games')}</span>
              <span style={{ textAlign: 'right' }}>{t('leaderboard.expectedCol')}</span>
              <span style={{ textAlign: 'right' }}>{t('leaderboard.actualCol')}</span>
              <span style={{ textAlign: 'center' }}>{t('leaderboard.impactCol')}</span>
              <span style={{ textAlign: 'right' }}>{t('leaderboard.synergyCol')}</span>
              <span style={{ textAlign: 'right' }}>{t('leaderboard.confidenceCol')}</span>
            </div>

            {/* Rows */}
            {rankedPairs.length > 0 ? (
              rankedPairs.map((pair, idx) => {
                const isTop = idx === 0 && pair.synergyScore >= 80
                const isLow = pair.pairImpact <= -10 && pair.gamesCount >= 5
                const isProvisional = (pair.gamesCount || 0) < 5

                // Residual bar width and side
                const impactVal = pair.pairImpact || 0
                const absImpact = Math.min(50, Math.abs(impactVal))
                const barWidthPct = Math.round((absImpact / 50) * 45) // scale to max 45% on either side of 50%

                const confBadgeColor =
                  pair.confidence === 'R4' || pair.confidence === 'R3'
                    ? { bg: 'rgba(0,178,169,.16)', text: '#5FDBD3' }
                    : pair.confidence === 'R2'
                      ? { bg: 'rgba(240,183,92,.16)', text: '#F0B75C' }
                      : { bg: 'rgba(214,59,43,.18)', text: '#F09A8E' }

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

                return (
                  <div
                    key={pair.key || idx}
                    onClick={() => setSelectedPair(pair)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '34px minmax(0,1fr) 52px 66px 62px 116px 68px 74px',
                      gap: 10,
                      padding: '12px 15px',
                      borderBottom: '1px solid #22304A',
                      alignItems: 'center',
                      background: rowBg,
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <span
                      style={{
                        font: "600 13px/1 'IBM Plex Mono', monospace",
                        color: isTop ? '#5FDBD3' : '#8494AA',
                      }}
                    >
                      {idx + 1}
                    </span>

                    {/* Pair Avatars + Names */}
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
                        <div style={{ font: "600 14px/1.25 'IBM Plex Sans', sans-serif", color: '#fff' }}>
                          {pair.names.join(' · ')}
                        </div>
                        <div style={{ font: "400 11px/1.35 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                          {pair.combinedRating ? `${pair.combinedRating} · ` : ''}
                          {dateStr}
                        </div>
                      </div>
                    </div>

                    {/* Games */}
                    <span
                      style={{
                        textAlign: 'right',
                        font: "400 13px/1 'IBM Plex Mono', monospace",
                        color: isProvisional ? '#F0B75C' : '#A8B7CB',
                      }}
                    >
                      {pair.gamesCount}
                    </span>

                    {/* Expected Win% */}
                    <span style={{ textAlign: 'right', font: "400 13px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                      {pair.expectedWinPct}%
                    </span>

                    {/* Actual Win% */}
                    <span style={{ textAlign: 'right', font: "600 13px/1 'IBM Plex Mono', monospace", color: '#fff' }}>
                      {pair.actualWinPct}%
                    </span>

                    {/* Bipolar Residual Bar */}
                    <span
                      style={{
                        position: 'relative',
                        height: 9,
                        borderRadius: 999,
                        background: '#0B1220',
                        border: '1px solid #22304A',
                        display: 'block',
                      }}
                    >
                      {/* Center Divider at 50% */}
                      <span style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#2E3E5C' }} />

                      {/* Bar Fill */}
                      {impactVal >= 0 ? (
                        <span
                          style={{
                            position: 'absolute',
                            left: '50%',
                            top: 1,
                            bottom: 1,
                            width: `${barWidthPct}%`,
                            background: '#00B2A9',
                            borderRadius: '0 999px 999px 0',
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            position: 'absolute',
                            right: '50%',
                            top: 1,
                            bottom: 1,
                            width: `${barWidthPct}%`,
                            background: isLow ? '#D63B2B' : '#E08A00',
                            borderRadius: '999px 0 0 999px',
                          }}
                        />
                      )}
                      {isProvisional && (
                        <span
                          style={{
                            position: 'absolute',
                            left: '65%',
                            top: -3,
                            bottom: -3,
                            width: '30%',
                            border: '1px dashed #2E3E5C',
                            borderLeft: 'none',
                            borderRadius: '0 6px 6px 0',
                          }}
                        />
                      )}
                    </span>

                    {/* Synergy Score */}
                    <span
                      style={{
                        textAlign: 'right',
                        font: '700 17px/1 Barlow, sans-serif',
                        color: isTop ? '#5FDBD3' : isLow ? '#F09A8E' : isProvisional ? '#A8B7CB' : '#E9EFF7',
                      }}
                    >
                      {pair.synergyScore}
                      {isProvisional && (
                        <span style={{ font: "600 12px/1 'IBM Plex Mono', monospace", color: '#F0B75C' }}>
                          ~
                        </span>
                      )}
                    </span>

                    {/* Confidence Tag */}
                    <span style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          font: "600 10px/1 'IBM Plex Mono', monospace",
                          padding: '4px 6px',
                          borderRadius: 4,
                          background: confBadgeColor.bg,
                          color: confBadgeColor.text,
                        }}
                      >
                        {pair.confidence} · {t(`rating.confidence.${pair.confidence.toLowerCase()}`)}
                      </span>
                    </span>
                  </div>
                )
              })
            ) : (
              <div style={{ padding: 24, textAlign: 'center', color: '#8494AA', font: "400 13px 'IBM Plex Sans', sans-serif" }}>
                {t('leaderboard.empty')}
              </div>
            )}
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
              <div style={{ display: 'grid', gap: 7 }}>
                {directionalMatchups.length > 0 ? (
                  directionalMatchups.map((mItem, mIdx) => (
                    <div
                      key={mIdx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,1fr) 44px 54px 44px',
                        gap: 8,
                        alignItems: 'center',
                        padding: '8px 10px',
                        borderRadius: 7,
                        background: '#101927',
                        border: '1px solid #22304A',
                      }}
                    >
                      <span style={{ font: "600 12.5px/1.3 'IBM Plex Sans', sans-serif", minWidth: 0, color: '#fff' }}>
                        {mItem.fromName} → {mItem.toName}
                      </span>
                      <span style={{ textAlign: 'right', font: "400 11px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                        {mItem.games} {t('leaderboard.matchesAbbr')}
                      </span>
                      <span style={{ textAlign: 'right', font: "400 11px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                        {mItem.expected}→{mItem.actual}%
                      </span>
                      <span
                        style={{
                          textAlign: 'right',
                          font: '700 15px/1 Barlow, sans-serif',
                          color: mItem.score >= 60 ? '#5FDBD3' : mItem.score >= 45 ? '#F0B75C' : '#F09A8E',
                        }}
                      >
                        {mItem.score}
                      </span>
                    </div>
                  ))
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
                        {topPair.names.join(' · ')}
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
                        conf: topPair.confidence,
                      })}
                    </div>
                  </div>
                )}

                {underperformingPair && underperformingPair.key !== topPair?.key && (
                  <div style={{ display: 'grid', gap: 5, padding: '9px 11px', borderRadius: 7, background: '#101927', border: '1px solid #22304A' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", flex: 1, color: '#fff' }}>
                        {underperformingPair.names.join(' · ')}
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
                        conf: underperformingPair.confidence,
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: 3 Rail Cards */}
        <div style={{ display: 'grid', gap: 12 }}>
          {/* Card 1: Cặp ăn ý nhất mùa */}
          {topPair ? (
            <div
              style={{
                background: 'linear-gradient(180deg, rgba(0,178,169,.16), #141D2E)',
                border: '1px solid #00786F',
                borderRadius: 10,
                padding: 15,
                display: 'grid',
                gap: 9,
              }}
            >
              <span
                style={{
                  font: "600 10px/1 'IBM Plex Mono', monospace",
                  letterSpacing: '.06em',
                  padding: '4px 7px',
                  borderRadius: 999,
                  background: '#00B2A9',
                  color: '#04302C',
                  justifySelf: 'start',
                }}
              >
                {t('leaderboard.pairBestOfSeason')}
              </span>
              <div style={{ font: '700 20px/1.2 Barlow, sans-serif', color: '#fff' }}>
                {topPair.names.join(' · ')}
              </div>
              <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                {t('leaderboard.pairBestDesc', {
                  pp: topPair.pairImpact,
                  matches: topPair.gamesCount,
                  exp: topPair.expectedWinPct,
                  wins: topPair.wins,
                })}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  paddingTop: 4,
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
                  <div style={{ font: "600 14px/1.25 'IBM Plex Mono', monospace", color: '#5FDBD3' }}>
                    {topPair.confidence} ●●●○
                  </div>
                  <div style={{ font: "400 11px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                    {t('rating.confidence.label')}
                  </div>
                </div>

                <div style={{ flex: '1 1 0%' }} />

                <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
                  <span style={{ display: 'flex', gap: 3 }}>
                    {(topPair.recentResults || ['W', 'W', 'L', 'W', 'W']).map((res, rIdx) => (
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
                    form 5 · {t('leaderboard.formHot', { w: 4, l: 1 })}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {/* Card 2: Dưới kỳ vọng nhiều nhất */}
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
                      names: underperformingPair.names.join(' · '),
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
                    <span style={{ color: '#8494AA' }}>{p.names.join(' · ')}</span>
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
              {t('leaderboard.provisionalPairsDesc', { count: provisionalPairs.length || 37 })}
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
                    {p.names.join(' · ')}
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

      {/* Modal AY2: Thẻ chi tiết cặp đôi */}
      {selectedPair && (
        <PairDetailModal
          pair={{ ...selectedPair, membersMap }}
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
    </div>
  )
}
