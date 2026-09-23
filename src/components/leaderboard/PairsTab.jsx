import { useState, useMemo } from 'react'
import { t } from '#i18n'
import { useMobile } from '#hooks/useMobile.js'
import { Icon, Avatar } from '#ds'
import { rankPairs, calcMatchupEdge } from '#lib/rating.js'
import { playerName, shortName } from '#lib/money.js'
import { ConfidenceChip } from '#ui'
import { useTheme } from '#contexts/ThemeContext.jsx'
import PairDetailModal from './PairDetailModal.jsx'
import RatingFormulaModal from './RatingFormulaModal.jsx'
import PairH2HModal from './PairH2HModal.jsx'

// Số trận tối thiểu để một cặp rời nhóm tạm tính — khớp isProvisional() bên rating.js.
const PAIR_OFFICIAL_MIN_GAMES = 5

function ConfidenceExplainerSheet({ onClose }) {
  const { isDark } = useTheme()
  const bgCard = isDark ? '#141D2E' : 'var(--surface-card)'
  const bgSunken = isDark ? '#101927' : 'var(--surface-sunken)'
  const borderCard = isDark ? '#2E3E5C' : 'var(--border-default)'
  const textWhite = isDark ? '#E9EFF7' : 'var(--text-primary)'
  const textSecondary = isDark ? '#A8B7CB' : 'var(--text-secondary)'
  const textMuted = isDark ? '#8494AA' : 'var(--text-muted)'

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
          background: bgCard,
          borderTop: `1px solid ${borderCard}`,
          borderRadius: '16px 16px 0 0',
          padding: '10px 16px 22px',
          display: 'grid',
          gap: 12,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: 36, height: 4, borderRadius: 999, background: isDark ? '#2E3E5C' : 'var(--border-default)', justifySelf: 'center' }} />

        <div style={{ font: '600 17px/1.25 Barlow, sans-serif', color: textWhite }}>
          {t('leaderboard.confidenceExplainerTitle')}
        </div>
        <div style={{ font: "400 13px/1.55 'IBM Plex Sans', sans-serif", color: textSecondary }}>
          {t('leaderboard.confidenceExplainerSub')}
        </div>

        <div style={{ display: 'grid', gap: 7 }}>
          {/* R1 */}
          <div style={{ padding: '11px 12px', borderRadius: 6, background: bgSunken, border: isDark ? '1px solid rgba(225,68,52,.32)' : '1px solid rgba(239,68,68,.25)', display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ font: "600 13px/1 'IBM Plex Mono', monospace", color: isDark ? '#FF9A8F' : '#DC2626' }}>R1 ●○○○</span>
              <div style={{ flex: 1 }} />
              <span style={{ font: "400 12.5px/1 'IBM Plex Mono', monospace", color: textSecondary }}>{t('leaderboard.r1GamesRange')}</span>
            </div>
            <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: textMuted }}>
              {t('leaderboard.r1Desc')}
            </div>
          </div>

          {/* R2 */}
          <div style={{ padding: '11px 12px', borderRadius: 6, background: bgSunken, border: isDark ? '1px solid rgba(224,138,0,.38)' : '1px solid rgba(217,119,6,.25)', display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ font: "600 13px/1 'IBM Plex Mono', monospace", color: isDark ? '#F0B75C' : '#D97706' }}>R2 ●●○○</span>
              <div style={{ flex: 1 }} />
              <span style={{ font: "400 12.5px/1 'IBM Plex Mono', monospace", color: textSecondary }}>{t('leaderboard.r2GamesRange')}</span>
            </div>
            <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: textMuted }}>
              {t('leaderboard.r2Desc')}
            </div>
          </div>

          {/* R3 */}
          <div style={{ padding: '11px 12px', borderRadius: 6, background: bgSunken, border: isDark ? '1px solid #00786F' : '1px solid rgba(13,148,136,.3)', display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ font: "600 13px/1 'IBM Plex Mono', monospace", color: isDark ? '#5FDBD3' : '#0D9488' }}>R3 ●●●○</span>
              <div style={{ flex: 1 }} />
              <span style={{ font: "400 12.5px/1 'IBM Plex Mono', monospace", color: textSecondary }}>{t('leaderboard.r3GamesRange')}</span>
            </div>
            <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: textMuted }}>
              {t('leaderboard.r3Desc')}
            </div>
          </div>

          {/* R4 */}
          <div style={{ padding: '11px 12px', borderRadius: 6, background: bgSunken, border: isDark ? '1px solid #00786F' : '1px solid rgba(13,148,136,.3)', display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ font: "600 13px/1 'IBM Plex Mono', monospace", color: isDark ? '#5FDBD3' : '#0D9488' }}>R4 ●●●●</span>
              <div style={{ flex: 1 }} />
              <span style={{ font: "400 12.5px/1 'IBM Plex Mono', monospace", color: textSecondary }}>{t('leaderboard.r4GamesRange')}</span>
            </div>
            <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: textMuted }}>
              {t('leaderboard.r4Desc')}
            </div>
          </div>
        </div>

        {/* Vì sao phải đọc kèm */}
        <div style={{ padding: '11px 12px', borderRadius: 6, background: bgSunken, border: `1px solid ${borderCard}`, display: 'grid', gap: 6 }}>
          <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '.08em', textTransform: 'uppercase', color: textMuted }}>
            {t('leaderboard.whyReadTogetherTitle')}
          </div>
          <div style={{ font: "400 12.5px/1.55 'IBM Plex Sans', sans-serif", color: textSecondary }}>
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
  onExportCsv: _onExportCsv,
  onViewPairMatches,
  db,
}) {
  const { isDark } = useTheme()
  const isMobile = useMobile()
  const [formatFilter, setFormatFilter] = useState('all') // 'all' | 'MD' | 'WD' | 'XD'
  const [selectedPair, setSelectedPair] = useState(null)
  const [formulaModalOpen, setFormulaModalOpen] = useState(false)
  const [confidenceSheetOpen, setConfidenceSheetOpen] = useState(false)
  const [selectedH2HPair, setSelectedH2HPair] = useState(null)

  const bgOuter = isDark ? '#0B1220' : 'transparent'
  const bgCard = isDark ? '#141D2E' : 'var(--surface-card)'
  const bgSunken = isDark ? '#101927' : 'var(--surface-sunken)'
  const borderCard = isDark ? '#22304A' : 'var(--border-subtle)'
  const borderSunken = isDark ? '#2E3E5C' : 'var(--border-default)'
  const textWhite = isDark ? '#FFFFFF' : 'var(--text-primary)'
  const textMuted = isDark ? '#8494AA' : 'var(--text-muted)'
  const textSecondary = isDark ? '#A8B7CB' : 'var(--text-secondary)'

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

  // Có ít nhất một cặp đủ số trận để lên bảng chính thức. Giá trị chung cho cả danh sách —
  // tính trong vòng map thì mỗi dòng quét lại toàn mảng.
  const hasQualified = useMemo(() => {
    return rankedPairs.some((p) => (p.gamesCount || 0) >= PAIR_OFFICIAL_MIN_GAMES)
  }, [rankedPairs])

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

  /** Nhãn cặp để VẼ — tên đầy đủ đi vào `title`. Tên dài làm tràn cả thẻ cặp đôi. */
  const pairLabel = (pair) => getPairNames(pair).map(shortName).join(' · ')
  const pairTitle = (pair) => getPairNames(pair).join(' · ')

  function getPairMembers(pair) {
    const p1 = pair?.playerA || pair?.memberA?.id
    const p2 = pair?.playerB || pair?.memberB?.id
    const resolve = (id, fallbackName, fallbackMem) => {
      if (!id) return fallbackMem || { id: '', name: fallbackName || '' }
      const fromMap = membersMap?.[id]
      if (fromMap) return fromMap
      if (db) {
        const fromDb = (db.members || []).find((m) => m.id === id) || (db.guests || []).find((g) => g.id === id)
        if (fromDb) return fromDb
      }
      return fallbackMem || { id, name: fallbackName || id }
    }
    const names = getPairNames(pair)
    const m1 = resolve(p1, names[0], pair?.memberA)
    const m2 = resolve(p2, names[1], pair?.memberB)
    return [m1, m2]
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

function getScoreVisuals(score, isTop, isDark = true) {
  if (isTop || score >= 75) {
    return {
      color: isDark ? '#5FDBD3' : '#0D9488',
      textShadow: isDark ? '0 0 16px rgba(95, 219, 211, 0.55), 0 0 4px rgba(95, 219, 211, 0.8)' : 'none',
      bg: isDark ? 'rgba(0, 178, 169, 0.14)' : 'rgba(13, 148, 136, 0.10)',
      border: isDark ? '1px solid rgba(95, 219, 211, 0.35)' : '1px solid rgba(13, 148, 136, 0.30)',
      boxShadow: isDark ? '0 0 12px rgba(95, 219, 211, 0.18)' : 'none',
    }
  }
  if (score >= 65) {
    return {
      color: isDark ? '#5FD9A2' : '#059669',
      textShadow: isDark ? '0 0 14px rgba(95, 217, 162, 0.45)' : 'none',
      bg: isDark ? 'rgba(18, 168, 103, 0.14)' : 'rgba(16, 185, 129, 0.10)',
      border: isDark ? '1px solid rgba(95, 217, 162, 0.30)' : '1px solid rgba(16, 185, 129, 0.25)',
      boxShadow: isDark ? '0 0 10px rgba(95, 217, 162, 0.15)' : 'none',
    }
  }
  if (score >= 50) {
    return {
      color: isDark ? '#F0B75C' : '#D97706',
      textShadow: isDark ? '0 0 10px rgba(240, 183, 92, 0.35)' : 'none',
      bg: isDark ? 'rgba(240, 183, 92, 0.10)' : 'rgba(245, 158, 11, 0.10)',
      border: isDark ? '1px solid rgba(240, 183, 92, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)',
      boxShadow: 'none',
    }
  }
  return {
    color: isDark ? '#FF9A8F' : '#DC2626',
    textShadow: isDark ? '0 0 10px rgba(255, 154, 143, 0.30)' : 'none',
    bg: isDark ? 'rgba(225, 68, 52, 0.10)' : 'rgba(239, 68, 68, 0.10)',
    border: isDark ? '1px solid rgba(255, 154, 143, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)',
    boxShadow: 'none',
  }
}



  return (
    <div
      data-screen-label="AY1 An y va khac che"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        background: bgOuter,
        color: isDark ? '#E9EFF7' : 'var(--text-primary)',
        borderRadius: 12,
        padding: '0 0 20px',
      }}
    >
      {/* Sub-Header */}
      <div
        style={{
          padding: isMobile ? '12px 14px' : '14px 20px',
          borderBottom: `1px solid ${borderCard}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Row 1: Title + Cách tính button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ font: '700 18px/1.25 Barlow, sans-serif', color: textWhite, letterSpacing: '-0.01em' }}>
            {t('leaderboard.tabPairs')}
          </div>

          <button
            type="button"
            onClick={() => setFormulaModalOpen(true)}
            title={t('leaderboard.howCalculated')}
            aria-label={t('leaderboard.howCalculated')}
            style={{
              font: "600 12px/1 'IBM Plex Sans', sans-serif",
              padding: isMobile ? '7px 8px' : '6px 11px',
              borderRadius: 6,
              background: bgCard,
              border: `1px solid ${borderSunken}`,
              color: isDark ? '#5FDBD3' : 'var(--teal-700, #00786F)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
          >
            <Icon name="calculator" size={14} style={{ color: isDark ? '#5FDBD3' : 'var(--teal-700, #00786F)' }} />
            {!isMobile && <span>{t('leaderboard.howCalculated')}</span>}
          </button>
        </div>

        {/* Row 2: Compact Highlighted Metrics */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 9px',
              borderRadius: 6,
              background: isDark ? 'rgba(95,219,211,.08)' : 'var(--surface-accent-soft)',
              border: isDark ? '1px solid rgba(95,219,211,.22)' : '1px solid rgba(0, 120, 111, 0.2)',
              font: "400 12px/1.3 'IBM Plex Sans', sans-serif",
              color: textSecondary,
            }}
          >
            <span style={{ font: "700 13px/1 'IBM Plex Mono', monospace", color: isDark ? '#5FDBD3' : 'var(--teal-700, #00786F)' }}>
              {totalDoublesMatches}
            </span>
            <span>{t('leaderboard.doublesMatchesUnit')}</span>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 9px',
              borderRadius: 6,
              background: isDark ? 'rgba(240,183,92,.08)' : 'var(--surface-warning-soft)',
              border: isDark ? '1px solid rgba(240,183,92,.22)' : '1px solid rgba(180, 83, 9, 0.2)',
              font: "400 12px/1.3 'IBM Plex Sans', sans-serif",
              color: textSecondary,
            }}
          >
            <span style={{ font: "700 13px/1 'IBM Plex Mono', monospace", color: isDark ? '#F0B75C' : 'var(--amber-700, #B45309)' }}>
              {totalPairsCount}
            </span>
            <span>{t('leaderboard.pairsPlayedUnit')}</span>
          </div>
        </div>
      </div>

      {/* Mobile Controls: Format Filter */}
      {isMobile && (
        <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Quick Filters Mobile: Tất cả (Cả nam nữ) / Đôi nam / Đôi nữ / Nam-nữ */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: 2,
              borderRadius: 8,
              background: bgSunken,
              border: `1px solid ${borderCard}`,
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
                    flex: 1,
                    font: "600 11.5px/1 'IBM Plex Sans', sans-serif",
                    padding: '7px 4px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    background: active ? '#1D50A0' : 'transparent',
                    color: active ? '#fff' : textSecondary,
                    boxShadow: active ? '0 2px 6px rgba(29,80,160,0.35)' : 'none',
                    transition: 'all 0.15s ease',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Highlight Card: Cặp bài trùng của mùa */}
      {topPair && (
        <div
          style={{
            padding: isMobile ? '0 14px' : '0 20px',
          }}
        >
          <div
            onClick={() => setSelectedPair(topPair)}
            style={{
              background: isDark ? 'linear-gradient(180deg, rgba(0,178,169,.18), #141D2E)' : 'linear-gradient(180deg, rgba(0,178,169,.12), var(--surface-card))',
              border: '1px solid #00B2A9',
              boxShadow: isDark ? '0 4px 22px rgba(0, 178, 169, 0.16)' : 'var(--shadow-sm)',
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
                padding: '4px 8px',
                borderRadius: 999,
                background: '#00B2A9',
                color: '#04302C',
                justifySelf: 'start',
              }}
            >
              {t('leaderboard.pairBestOfSeason')}
            </span>
            <div style={{ font: '700 20px/1.2 Barlow, sans-serif', color: textWhite }}>
              <span title={pairTitle(topPair)}>{pairLabel(topPair)}</span>
            </div>
            <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: textSecondary }}>
              {topPair.pairImpact < 0
                ? t('leaderboard.pairBestBelowDesc', {
                    pp: Math.abs(topPair.pairImpact),
                    matches: topPair.gamesCount,
                    exp: topPair.expectedWinPct,
                    wins: topPair.wins != null ? topPair.wins : (topPair.winsCount || 0),
                  })
                : t('leaderboard.pairBestDesc', {
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
                borderTop: isDark ? '1px solid #22304A' : '1px solid var(--border-subtle)',
                marginTop: 2,
                flexWrap: 'wrap',
                alignItems: 'flex-end',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{
                    font: '800 24px/1 Barlow, sans-serif',
                    color: isDark ? '#5FDBD3' : 'var(--teal-700, #00786F)',
                    textShadow: isDark ? '0 0 16px rgba(95, 219, 211, 0.6), 0 0 4px rgba(95, 219, 211, 0.9)' : 'none',
                  }}>
                    {topPair.synergyScore}
                  </span>
                  <span style={{ font: "700 14px/1 'IBM Plex Mono', monospace", color: isDark ? '#5FD9A2' : '#047857', textShadow: isDark ? '0 0 8px rgba(95, 217, 162, 0.5)' : 'none' }}>
                    ↑
                  </span>
                </div>
                <div style={{ font: "500 11px/1.3 'IBM Plex Sans', sans-serif", color: isDark ? '#A8B7CB' : 'var(--text-secondary)', marginTop: 2 }}>
                  {t('leaderboard.pairBestFrom', { from: Math.max(50, topPair.synergyScore - 7) })}
                </div>
              </div>

              <div>
                <div style={{
                  font: '800 20px/1 Barlow, sans-serif',
                  color: topPair.pairImpact >= 0 ? (isDark ? '#5FD9A2' : '#047857') : (isDark ? '#FF9A8F' : '#DC2626'),
                  textShadow: isDark && topPair.pairImpact >= 0 ? '0 0 12px rgba(95, 217, 162, 0.4)' : 'none',
                }}>
                  {topPair.pairImpact >= 0 ? `+${topPair.pairImpact}pp` : `${topPair.pairImpact}pp`}
                </div>
                <div style={{ font: "500 11px/1.3 'IBM Plex Sans', sans-serif", color: isDark ? '#A8B7CB' : 'var(--text-secondary)', marginTop: 2 }}>
                  impact
                </div>
              </div>

              <div>
                <div style={{ font: '800 20px/1 Barlow, sans-serif', color: isDark ? '#FFFFFF' : 'var(--text-primary)' }}>
                  {topPair.gamesCount}
                </div>
                <div style={{ font: "500 11px/1.3 'IBM Plex Sans', sans-serif", color: isDark ? '#A8B7CB' : 'var(--text-secondary)', marginTop: 2 }}>
                  {t('leaderboard.games')}
                </div>
              </div>

              <div>
                <div style={{ marginBottom: 2 }}>
                  <ConfidenceChip confidence={getPairConfTier(topPair)} />
                </div>
                <div style={{ font: "500 11px/1.3 'IBM Plex Sans', sans-serif", color: isDark ? '#A8B7CB' : 'var(--text-secondary)', marginTop: 2 }}>
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
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        background: res === 'W'
                          ? (isDark ? 'rgba(18,168,103,.32)' : 'rgba(16,185,129,.16)')
                          : (isDark ? 'rgba(225,68,52,.28)' : 'rgba(239,68,68,.16)'),
                        color: res === 'W' ? (isDark ? '#5FD9A2' : '#047857') : (isDark ? '#FF9A8F' : '#DC2626'),
                        border: res === 'W'
                          ? (isDark ? '1px solid rgba(95,217,162,.4)' : '1px solid rgba(16,185,129,.35)')
                          : (isDark ? '1px solid rgba(255,154,143,.4)' : '1px solid rgba(239,68,68,.35)'),
                        boxShadow: isDark && res === 'W' ? '0 0 8px rgba(95,217,162,.3)' : 'none',
                        font: "700 11px/19px 'IBM Plex Mono', monospace",
                        textAlign: 'center',
                      }}
                    >
                      {res === 'W' ? 'T' : 'B'}
                    </span>
                  ))}
                </span>
                <span style={{ font: "500 11px/1.3 'IBM Plex Sans', sans-serif", color: isDark ? '#A8B7CB' : 'var(--text-secondary)' }}>
                  form 5 · {t('leaderboard.formHot', {
                    w: (topPair.recentResults || []).filter(r => r === 'W').length || (topPair.wins != null ? topPair.wins : 1),
                    l: (topPair.recentResults || []).filter(r => r === 'L').length || (topPair.losses != null ? topPair.losses : 0)
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Giao diện Mobile P1 vs Desktop */}
      {isMobile ? (
        <div data-screen-label="P1 Tab an y v1.1" style={{ display: 'flex', flexDirection: 'column', gap: 11, padding: '0 14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {rankedPairs.length > 0 ? (
              rankedPairs.map((pair, idx) => {
                const isTop = idx === 0
                const isProvisional = (pair.gamesCount || 0) < 5
                const displayScore = typeof pair.synergyScore === 'number' && !isNaN(pair.synergyScore)
                  ? pair.synergyScore
                  : 50
                const confTier = getPairConfTier(pair)
                const trend = pair.trend || 'steady'
                const impactVal = pair.pairImpact || 0
                const impactSign = impactVal > 0 ? `+${impactVal}pp` : `${impactVal}pp`

                const scoreVis = getScoreVisuals(displayScore, isTop, isDark)

                const tagLabel = isTop ? t('leaderboard.tagTop1') : (pair.formKey === 'hot' || trend === 'up' ? t('leaderboard.tagHot') : t('leaderboard.tagStable'))
                const tagStyle = isTop
                  ? { background: isDark ? 'rgba(0, 178, 169, 0.20)' : 'rgba(0, 178, 169, 0.12)', color: isDark ? '#5FDBD3' : 'var(--teal-700, #00786F)', border: isDark ? '1px solid rgba(0, 178, 169, 0.4)' : '1px solid rgba(0, 178, 169, 0.35)' }
                  : tagLabel === t('leaderboard.tagHot')
                  ? { background: isDark ? 'rgba(18, 168, 103, 0.20)' : 'rgba(16, 185, 129, 0.12)', color: isDark ? '#5FD9A2' : '#047857', border: isDark ? '1px solid rgba(18, 168, 103, 0.35)' : '1px solid rgba(16, 185, 129, 0.35)' }
                  : { background: isDark ? 'rgba(148, 164, 186, 0.16)' : 'rgba(60, 116, 196, 0.12)', color: isDark ? '#A8B7CB' : 'var(--navy-600, #143C7D)', border: isDark ? '1px solid rgba(148, 164, 186, 0.25)' : '1px solid rgba(60, 116, 196, 0.25)' }

                const recentResults = pair.recentResults || []
                const form5 = []
                for (let i = 0; i < 5; i++) {
                  form5.push(i < recentResults.length ? recentResults[i] : null)
                }

                const expPct = Math.round(pair.expectedWinPct || 50)
                const actPct = Math.round(pair.actualWinPct || 0)

                const [mA, mB] = getPairMembers(pair)
                const isFirstProvisional = hasQualified && isProvisional && (idx === 0 || (rankedPairs[idx - 1].gamesCount || 0) >= PAIR_OFFICIAL_MIN_GAMES)
                const isFirstOfficial = hasQualified && idx === 0 && !isProvisional

                return (
                  <div key={getPairKey(pair) || idx} style={{ display: 'grid', gap: 8 }}>
                    {isFirstOfficial && (
                      <div style={{
                        padding: '7px 12px',
                        borderRadius: 8,
                        background: isDark ? 'rgba(0,178,169,.1)' : 'rgba(0,178,169,.08)',
                        border: isDark ? '1px solid rgba(0,178,169,.3)' : '1px solid rgba(0,178,169,.25)',
                        font: "600 11.5px/1.3 'IBM Plex Sans', sans-serif",
                        color: isDark ? '#5FDBD3' : 'var(--teal-700, #00786F)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}>
                        <span>★</span>
                        <span>{t('leaderboard.officialPairsSection')}</span>
                      </div>
                    )}
                    {isFirstProvisional && (
                      <div style={{
                        padding: '7px 12px',
                        borderRadius: 8,
                        background: isDark ? 'rgba(240,183,92,.08)' : 'rgba(240,183,92,.08)',
                        border: isDark ? '1px solid rgba(240,183,92,.25)' : '1px solid rgba(180,83,9,.25)',
                        font: "600 11.5px/1.3 'IBM Plex Sans', sans-serif",
                        color: isDark ? '#F0B75C' : 'var(--amber-700, #B45309)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}>
                        <span>~</span>
                        <span>{t('leaderboard.provisionalPairsSection')}</span>
                      </div>
                    )}
                    <div
                      onClick={() => setSelectedPair(pair)}
                      style={{
                        background: isDark
                          ? (isTop
                            ? 'linear-gradient(135deg, rgba(0, 178, 169, 0.12) 0%, #141D2E 100%)'
                            : displayScore >= 65
                            ? 'linear-gradient(135deg, rgba(0, 178, 169, 0.05) 0%, #141D2E 100%)'
                            : '#141D2E')
                          : (isTop
                            ? 'linear-gradient(135deg, rgba(0, 178, 169, 0.08) 0%, var(--surface-card) 100%)'
                            : 'var(--surface-card)'),
                        border: isDark
                          ? (isTop
                            ? '1px solid #00B2A9'
                            : displayScore >= 65
                            ? '1px solid rgba(95, 219, 211, 0.3)'
                            : '1px solid #22304A')
                          : (isTop
                            ? '1px solid var(--teal-600, #00897B)'
                            : '1px solid var(--border-subtle)'),
                        borderRadius: 10,
                        padding: 13,
                        display: 'grid',
                        gap: 10,
                        cursor: 'pointer',
                        boxShadow: isDark
                          ? (isTop
                            ? '0 4px 20px rgba(0, 178, 169, 0.14)'
                            : displayScore >= 65
                            ? '0 2px 12px rgba(95, 219, 211, 0.08)'
                            : 'none')
                          : 'var(--shadow-sm)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {/* Header: Avatar đôi + Tên cặp + Tag */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ display: 'flex', flex: '0 0 auto', alignItems: 'center' }}>
                          <Avatar
                            name={mA.name}
                            src={mA.avatarUrl || mA.avatar}
                            size={24}
                            style={{ border: `2px solid ${bgCard}`, zIndex: 2 }}
                          />
                          <Avatar
                            name={mB.name}
                            src={mB.avatarUrl || mB.avatar}
                            size={24}
                            style={{ border: `2px solid ${bgCard}`, marginLeft: -8, zIndex: 1 }}
                          />
                        </span>
                        <span style={{ flex: 1, font: "600 16px/1.25 'IBM Plex Sans', sans-serif", color: textWhite }}>
                          <span title={pairTitle(pair)}>{pairLabel(pair)}</span>
                        </span>
                        <span
                          style={{
                            font: "600 10.5px/1 'IBM Plex Sans', sans-serif",
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'baseline',
                                gap: 5,
                                padding: '4px 10px',
                                borderRadius: 8,
                                background: scoreVis.bg,
                                border: scoreVis.border,
                                boxShadow: scoreVis.boxShadow,
                              }}
                            >
                              <span
                                style={{
                                  font: '800 28px/1 Barlow, sans-serif',
                                  color: scoreVis.color,
                                  textShadow: scoreVis.textShadow,
                                  letterSpacing: '-0.01em',
                                }}
                              >
                                {displayScore}
                              </span>
                              {isProvisional && (
                                <span
                                  style={{
                                    font: "700 15px/1 'IBM Plex Mono', monospace",
                                    color: isDark ? '#F0B75C' : 'var(--amber-700, #B45309)',
                                    marginRight: 2,
                                  }}
                                >
                                  ~
                                </span>
                              )}
                              <span
                                style={{
                                  font: "700 14px/1 'IBM Plex Mono', monospace",
                                  color: trend === 'up' ? (isDark ? '#5FD9A2' : '#047857') : trend === 'down' ? (isDark ? '#FF9A8F' : '#DC2626') : (isDark ? '#8494AA' : 'var(--text-muted)'),
                                }}
                              >
                                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
                              </span>
                            </div>
                          </div>
                          <div style={{ font: "400 11px/1.4 'IBM Plex Sans', sans-serif", color: isDark ? '#8494AA' : 'var(--text-secondary)', marginTop: 4 }}>
                            {pair.previousScore ? t('leaderboard.synergyFromScore', { prev: pair.previousScore }) : t('leaderboard.synergyCol')}
                          </div>
                        </div>

                        <div style={{ flex: 1 }} />

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ font: "500 13px/1.3 'IBM Plex Mono', monospace", color: textWhite }}>
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
                              marginTop: 3,
                              cursor: 'pointer',
                            }}
                          >
                            <ConfidenceChip confidence={confTier} />
                          </button>
                        </div>
                      </div>

                      {/* Kỳ vọng vs Thực tế bar */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 9, alignItems: 'center' }}>
                        <span style={{ font: "400 12.5px/1 'IBM Plex Mono', monospace", color: isDark ? '#9FC0EA' : 'var(--text-secondary)' }}>
                          {t('leaderboard.expectedCol')} {expPct}%
                        </span>
                        <span style={{ height: 5, borderRadius: 999, background: isDark ? '#22304A' : 'var(--surface-sunken)', overflow: 'hidden', display: 'flex', position: 'relative' }}>
                          <span style={{ width: `${Math.min(100, Math.max(0, expPct))}%`, background: isDark ? '#3C74C4' : 'var(--navy-500, #1D50A0)' }} />
                          <span style={{ position: 'absolute', left: `${Math.min(99, Math.max(1, actPct))}%`, top: -3, width: 2, height: 11, background: isDark ? '#5FD9A2' : '#047857' }} />
                        </span>
                        <span style={{ font: "600 12.5px/1 'IBM Plex Mono', monospace", color: isDark ? '#5FD9A2' : '#047857' }}>
                          {actPct}%
                        </span>
                      </div>

                      {/* Form 5 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span style={{ font: "400 12px/1 'IBM Plex Sans', sans-serif", color: isDark ? '#8494AA' : 'var(--text-secondary)' }}>
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
                                background: res === 'W'
                                  ? (isDark ? 'rgba(18,168,103,.24)' : 'rgba(16, 185, 129, 0.15)')
                                  : res === 'L'
                                  ? (isDark ? 'rgba(225,68,52,.22)' : 'rgba(239, 68, 68, 0.12)')
                                  : (isDark ? 'rgba(255,255,255,.05)' : 'var(--surface-inset)'),
                                color: res === 'W'
                                  ? (isDark ? '#5FD9A2' : '#047857')
                                  : res === 'L'
                                  ? (isDark ? '#FF9A8F' : '#DC2626')
                                  : (isDark ? '#55657E' : 'var(--text-muted)'),
                                font: "600 10px/18px 'IBM Plex Mono', monospace",
                                textAlign: 'center',
                              }}
                            >
                              {res === 'W' ? 'T' : res === 'L' ? 'B' : '—'}
                            </span>
                          ))}
                        </span>
                        <div style={{ flex: 1 }} />
                        <span style={{ font: "600 13px/1 'IBM Plex Mono', monospace", color: impactVal > 0 ? (isDark ? '#5FD9A2' : '#047857') : impactVal < 0 ? (isDark ? '#FF9A8F' : '#DC2626') : (isDark ? '#A8B7CB' : 'var(--text-secondary)') }}>
                          {impactSign}
                        </span>
                      </div>
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
                background: bgSunken,
                border: `1px solid ${borderCard}`,
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
                      color: active ? '#fff' : textSecondary,
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
              background: isDark ? 'linear-gradient(135deg, rgba(0,178,169,.12), #141D2E 62%)' : 'linear-gradient(135deg, rgba(0,178,169,.08), var(--surface-card) 62%)',
              border: `1px solid ${borderCard}`,
              borderRadius: 10,
              padding: '14px 16px',
              display: 'grid',
              gap: 9,
            }}
          >
            <div style={{ font: "600 13px/1.3 'IBM Plex Sans', sans-serif", color: isDark ? '#5FDBD3' : 'var(--teal-700, #00786F)' }}>
              {t('leaderboard.synergyNotWinrate')}
            </div>
            <div
              style={{
                font: "400 13px/1.55 'IBM Plex Sans', sans-serif",
                color: textSecondary,
                maxWidth: 640,
              }}
            >
              {t('leaderboard.synergyNotWinrateDesc')}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 2 }}>
              <span
                style={{
                  font: "400 11px/1.3 'IBM Plex Mono', monospace",
                  color: isDark ? textMuted : 'var(--text-secondary)',
                  padding: '5px 9px',
                  borderRadius: 6,
                  background: bgSunken,
                  border: isDark ? `1px solid ${borderCard}` : '1px solid var(--border-default)',
                }}
              >
                {t('leaderboard.expectedFormulaBadge')}
              </span>
              <span
                style={{
                  font: "400 11px/1.3 'IBM Plex Mono', monospace",
                  color: isDark ? textMuted : 'var(--text-secondary)',
                  padding: '5px 9px',
                  borderRadius: 6,
                  background: bgSunken,
                  border: isDark ? `1px solid ${borderCard}` : '1px solid var(--border-default)',
                }}
              >
                {t('leaderboard.synergyFormulaBadge')}
              </span>
            </div>
          </div>

          {/* Table Bảng Ăn ý - DP1 v1.1 */}
          <div style={{ background: bgCard, border: `1px solid ${borderCard}`, borderRadius: 10, overflow: 'hidden' }}>
            {/* Header Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.35fr) 95px 120px 145px 65px 75px',
                gap: 10,
                padding: '10px 15px',
                background: bgSunken,
                borderBottom: `1px solid ${borderCard}`,
                font: "600 11px/1.2 'IBM Plex Sans', sans-serif",
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: isDark ? textMuted : 'var(--text-secondary)',
                position: 'sticky',
                top: 0,
                zIndex: 2,
              }}
            >
              <span>{t('leaderboard.pairCol')}</span>
              <span>{t('leaderboard.synergyCol')}</span>
              <span>{t('leaderboard.recentForm')}</span>
              <span>{t('leaderboard.expectedCol')} → {t('leaderboard.actualCol')}</span>
              <span style={{ textAlign: 'right' }}>{t('leaderboard.impactCol')}</span>
              <span style={{ textAlign: 'right' }}>{t('leaderboard.confidenceCol')}</span>
            </div>

            {/* Scrollable Rows Container */}
            <div style={{ maxHeight: 560, overflowY: 'auto' }}>
              {rankedPairs.length > 0 ? (
                rankedPairs.map((pair, idx) => {
                  const isTop = idx === 0
                  const isLow = pair.pairImpact <= -10 && pair.gamesCount >= 5
                  const isProvisional = (pair.gamesCount || 0) < 5
                  const scoreVis = getScoreVisuals(pair.synergyScore || 50, isTop, isDark)

                  const impactVal = pair.pairImpact || 0
                  const confTier = getPairConfTier(pair)

                  const rowBg = isTop
                    ? (isDark ? 'rgba(0,178,169,.07)' : 'rgba(0,178,169,.05)')
                    : isLow
                      ? (isDark ? 'rgba(224,138,0,.06)' : 'rgba(224,138,0,.05)')
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

                  const [mA, mB] = getPairMembers(pair)
                  const isFirstProvisional = hasQualified && isProvisional && (idx === 0 || (rankedPairs[idx - 1].gamesCount || 0) >= PAIR_OFFICIAL_MIN_GAMES)
                  const isFirstOfficial = hasQualified && idx === 0 && !isProvisional

                  return (
                    <div key={getPairKey(pair) || idx}>
                      {isFirstOfficial && (
                        <div
                          style={{
                            padding: '7px 15px',
                            background: isDark ? 'rgba(0, 178, 169, 0.08)' : 'rgba(0, 178, 169, 0.06)',
                            borderBottom: `1px solid ${borderCard}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            font: "600 11.5px/1.2 'IBM Plex Sans', sans-serif",
                            color: isDark ? '#5FDBD3' : 'var(--teal-700, #00786F)',
                            letterSpacing: '0.04em',
                          }}
                        >
                          <span>★</span>
                          <span>{t('leaderboard.officialPairsSection')}</span>
                        </div>
                      )}
                      {isFirstProvisional && (
                        <div
                          style={{
                            padding: '7px 15px',
                            background: isDark ? 'rgba(240, 183, 92, 0.08)' : 'rgba(240, 183, 92, 0.06)',
                            borderBottom: `1px solid ${borderCard}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            font: "600 11.5px/1.2 'IBM Plex Sans', sans-serif",
                            color: isDark ? '#F0B75C' : 'var(--amber-700, #B45309)',
                            letterSpacing: '0.04em',
                          }}
                        >
                          <span>~</span>
                          <span>{t('leaderboard.provisionalPairsSection')}</span>
                        </div>
                      )}
                      <div
                        onClick={() => setSelectedPair(pair)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1.35fr) 95px 120px 145px 65px 75px',
                          gap: 10,
                          padding: '12px 15px',
                          borderBottom: `1px solid ${borderCard}`,
                          alignItems: 'center',
                          background: rowBg,
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        {/* Cột 1: Cặp + Tag + Meta */}
                        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 9 }}>
                          <span style={{ display: 'flex', flex: '0 0 auto', alignItems: 'center' }}>
                            <Avatar
                              name={mA.name}
                              src={mA.avatarUrl || mA.avatar}
                              size={26}
                              style={{ border: `2px solid ${bgCard}`, zIndex: 2 }}
                            />
                            <Avatar
                              name={mB.name}
                              src={mB.avatarUrl || mB.avatar}
                              size={26}
                              style={{ border: `2px solid ${bgCard}`, marginLeft: -9, zIndex: 1 }}
                            />
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ font: "600 13.5px/1.25 'IBM Plex Sans', sans-serif", color: textWhite }}>
                                <span title={pairTitle(pair)}>{pairLabel(pair)}</span>
                              </span>
                            {isTop && (
                              <span style={{
                                font: '700 9.5px/1 "IBM Plex Sans", sans-serif',
                                padding: '2px 5px',
                                borderRadius: 4,
                                background: isDark ? 'rgba(0, 178, 169, 0.18)' : 'rgba(0, 178, 169, 0.12)',
                                color: isDark ? '#5FDBD3' : 'var(--teal-700, #00786F)',
                                border: isDark ? '1px solid rgba(0, 178, 169, 0.35)' : '1px solid rgba(0, 178, 169, 0.35)',
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
                                background: isDark ? 'rgba(214, 59, 43, 0.18)' : 'rgba(214, 59, 43, 0.12)',
                                color: isDark ? '#F09A8E' : 'var(--text-danger, #C42B1C)',
                                border: isDark ? '1px solid rgba(214, 59, 43, 0.35)' : '1px solid rgba(214, 59, 43, 0.3)',
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
                                background: isDark ? 'rgba(60, 116, 196, 0.16)' : 'rgba(60, 116, 196, 0.12)',
                                color: isDark ? '#7AA3DC' : 'var(--navy-600, #143C7D)',
                                border: isDark ? '1px solid rgba(60, 116, 196, 0.3)' : '1px solid rgba(60, 116, 196, 0.25)',
                                letterSpacing: '0.04em',
                              }}>
                                {t('leaderboard.tagStable')}
                              </span>
                            )}
                          </div>
                          <div style={{ font: "400 11px/1.35 'IBM Plex Mono', monospace", color: isDark ? '#8494AA' : 'var(--text-muted)' }}>
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
                              font: '800 18px/1 Barlow, sans-serif',
                              color: scoreVis.color,
                              textShadow: scoreVis.textShadow,
                            }}
                          >
                            {pair.synergyScore}
                          </span>
                          {isProvisional && (
                            <span style={{ font: "600 12px/1 'IBM Plex Mono', monospace", color: isDark ? '#F0B75C' : 'var(--amber-700, #B45309)' }}>~</span>
                          )}
                        </div>
                        <div style={{
                          font: "600 10.5px/1.2 'IBM Plex Sans', sans-serif",
                          color: trend === 'up' ? (isDark ? '#5FDBD3' : '#0D9488') : trend === 'down' ? (isDark ? '#F09A8E' : '#DC2626') : (isDark ? '#8494AA' : 'var(--text-muted)'),
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
                                  background: isDark ? 'rgba(14, 122, 77, 0.16)' : 'rgba(16, 185, 129, 0.15)',
                                  color: isDark ? '#5FDBD3' : '#047857',
                                  border: isDark ? '1px solid rgba(14, 122, 77, 0.35)' : '1px solid rgba(16, 185, 129, 0.35)',
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
                                  background: isDark ? 'rgba(214, 59, 43, 0.18)' : 'rgba(239, 68, 68, 0.12)',
                                  color: isDark ? '#F09A8E' : '#DC2626',
                                  border: isDark ? '1px solid rgba(214, 59, 43, 0.35)' : '1px solid rgba(239, 68, 68, 0.3)',
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
                                background: isDark ? 'rgba(255, 255, 255, 0.04)' : 'var(--surface-inset)',
                                color: isDark ? '#50607A' : 'var(--text-muted)',
                                border: isDark ? '1px solid #22304A' : '1px solid var(--border-subtle)',
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
                        const barColor = impactVal >= 0 ? (isDark ? '#00B2A9' : '#0D9488') : (isLow ? (isDark ? '#D63B2B' : '#DC2626') : (isDark ? '#E08A00' : '#D97706'))
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
                              background: isDark ? '#0B1220' : 'var(--surface-sunken)',
                              border: isDark ? '1px solid #22304A' : '1px solid var(--border-subtle)',
                            }}>
                              {/* Segment "đến min(exp,act)" — luôn hiện */}
                              <div style={{
                                position: 'absolute', left: 0, top: 0, bottom: 0,
                                width: `${loFill}%`,
                                borderRadius: '999px 0 0 999px',
                                background: isOver ? (isDark ? '#1A3A55' : 'var(--border-subtle, #CBD5E1)') : barColor,
                              }} />
                              {/* Segment "khoảng lệch" — màu nổi bật */}
                              <div style={{
                                position: 'absolute', left: `${loFill}%`, top: 0, bottom: 0,
                                width: `${hiFill - loFill}%`,
                                borderRadius: loFill === 0 ? '999px 0 0 999px' : '0',
                                background: barColor,
                              }} />
                              {/* Needle kỳ vọng — vạch thẳng đứng */}
                              <div style={{
                                position: 'absolute',
                                left: `${exp}%`,
                                top: -1, bottom: -1,
                                width: 2,
                                marginLeft: -1,
                                background: isDark ? '#fff' : 'var(--text-primary)',
                                borderRadius: 1,
                                opacity: 0.8,
                              }} />
                            </div>
                            {/* Labels */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: isDark ? '#8494AA' : 'var(--text-secondary)' }}>
                                kv {exp}%
                              </span>
                              <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: isDark ? '#8494AA' : 'var(--text-secondary)' }}>·</span>
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
                          color: impactVal >= 0 ? (isDark ? '#5FDBD3' : '#0D9488') : (isLow ? (isDark ? '#F09A8E' : '#DC2626') : (isDark ? '#F0B75C' : '#D97706')),
                        }}>
                          {impactVal >= 0 ? `+${impactVal}` : `${impactVal}`}pp
                        </span>
                      </div>

                      {/* Cột 6: Độ tin cậy */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <ConfidenceChip confidence={confTier} />
                      </div>
                    </div>
                  </div>
                )
                })
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: textMuted, font: "400 13px 'IBM Plex Sans', sans-serif" }}>
                  {t('leaderboard.empty')}
                </div>
              )}
            </div>

            {/* Chú thích đáy bảng DP1 */}
            <div style={{ padding: '10px 15px', background: bgSunken, borderTop: `1px solid ${borderCard}`, font: '400 11.5px/1.4 "IBM Plex Sans", sans-serif', color: isDark ? textMuted : 'var(--text-secondary)' }}>
              {t('leaderboard.dp1FooterNote')}
            </div>
          </div>
        </div>

        {/* Right Side: 2 Rail Cards */}
        <div style={{ display: 'grid', gap: 12 }}>
          {/* Card 1: Dưới kỳ vọng nhiều nhất */}
          <div style={{ background: bgCard, border: isDark ? '1px solid #E08A00' : '1px solid var(--amber-700, #B45309)', borderRadius: 10, overflow: 'hidden' }}>
            <div
              style={{
                padding: '11px 14px',
                background: isDark ? 'rgba(224,138,0,.14)' : 'var(--surface-warning-soft)',
                borderBottom: `1px solid ${borderCard}`,
                font: "600 13px/1.3 'IBM Plex Sans', sans-serif",
                color: isDark ? '#F0B75C' : 'var(--amber-700, #B45309)',
              }}
            >
              {t('leaderboard.underperformingTitle')}
            </div>
            <div style={{ padding: '13px 14px', display: 'grid', gap: 11 }}>
              <div style={{ font: "400 12.5px/1.55 'IBM Plex Sans', sans-serif", color: textSecondary }}>
                {underperformingPair
                  ? t('leaderboard.underperformingLossSummary', {
                      names: pairLabel(underperformingPair),
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
                    <span style={{ color: textSecondary }} title={pairTitle(p)}>{pairLabel(p)}</span>
                    <span style={{ color: p.pairImpact <= -12 ? (isDark ? '#FF9A8F' : '#DC2626') : (isDark ? '#F0B75C' : 'var(--amber-700, #B45309)') }}>
                      {p.pairImpact} {t('leaderboard.pointsPct')}
                    </span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  font: "400 12px/1.5 'IBM Plex Sans', sans-serif",
                  color: isDark ? textMuted : 'var(--text-secondary)',
                  borderTop: `1px solid ${borderCard}`,
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
              background: bgCard,
              border: `1px solid ${borderCard}`,
              borderRadius: 10,
              padding: '13px 15px',
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: textWhite }}>
              {t('leaderboard.provisionalPairsTitle')}
            </div>
            <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: isDark ? textMuted : 'var(--text-secondary)' }}>
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
                    background: bgSunken,
                    border: `1px solid ${borderCard}`,
                  }}
                >
                  <span style={{ font: "600 12.5px/1.3 'IBM Plex Sans', sans-serif", color: textWhite }}>
                    <span title={pairTitle(p)}>{pairLabel(p)}</span>
                  </span>
                  <span style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: isDark ? '#F0B75C' : 'var(--amber-700, #B45309)' }}>
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
                background: isDark ? '#1A2437' : 'var(--surface-sunken)',
                border: isDark ? '1px solid #2E3E5C' : '1px solid var(--border-default)',
                color: isDark ? '#E9EFF7' : 'var(--text-primary)',
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
