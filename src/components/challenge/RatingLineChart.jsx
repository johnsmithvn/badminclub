import { useState, useMemo } from 'react'
import { t } from '#i18n'
import { initialRatingOf, confidenceProgress } from '#lib/rating.js'
import cfg from '#config/app.json' with { type: 'json' }

/**
 * Biểu đồ SVG đường rating qua các buổi tập kèm dải mờ độ tin cậy (Confidence Interval).
 * Chuẩn theo đặc tả Design Handoff GD3 & RD4.
 */
export default function RatingLineChart({
  member,
  matches = [],
  matchEdits = [],
  sessions = [],
  levels = [],
  isMobile = false,
}) {
  const [filter, setFilter] = useState('overall') // 'overall' | 'doubles' | 'singles' | 'vsMale' | 'vsFemale'

  const memberId = member?.id

  // 1. Lọc và sắp xếp các trận đấu của member theo context
  const filteredMatches = useMemo(() => {
    if (!memberId) return []
    return (matches || [])
      .filter((m) => {
        const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
        const teamB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])
        const inA = teamA.includes(memberId)
        const inB = teamB.includes(memberId)
        if (!inA && !inB) return false

        if (filter === 'doubles') {
          if (teamA.length < 2 && teamB.length < 2) return false
        } else if (filter === 'singles') {
          if (teamA.length !== 1 || teamB.length !== 1) return false
        } else if (filter === 'vsMale') {
          const opp = inA ? teamB : teamA
          // Đối thủ có ít nhất 1 nam (hoặc mặc định nam)
          const hasMale = opp.some((id) => (m.genders?.[id] || 'nam').toLowerCase() !== 'nu')
          if (!hasMale) return false
        } else if (filter === 'vsFemale') {
          const opp = inA ? teamB : teamA
          const hasFemale = opp.some((id) => (m.genders?.[id] || '').toLowerCase() === 'nu')
          if (!hasFemale) return false
        }

        return true
      })
      .slice()
      .sort((a, b) => (a.at || 0) - (b.at || 0))
  }, [matches, memberId, filter])

  // 2. Gom theo buổi hoặc mốc trận đấu (tối đa 14 buổi gần nhất)
  const chartData = useMemo(() => {
    if (!member) return { points: [], delta: 0, sessionsCount: 0, latestRating: 0, band: 8, confLevel: 'R5' }

    const seed = member.level ? initialRatingOf(member.level, levels) : (cfg.rating?.defaultRating ?? 0)

    if (filteredMatches.length === 0) {
      return {
        points: [{ label: t('common.today'), rating: seed, band: 120, isEdited: false }],
        delta: 0,
        sessionsCount: 0,
        latestRating: seed,
        band: 120,
        confLevel: 'R1',
      }
    }

    // Gom nhóm theo buổi (sessionId hoặc ngày)
    const sessionMap = new Map()
    let runningRating = seed
    let runningGames = 0

    filteredMatches.forEach((m) => {
      const inA = (m.teamA || []).includes(memberId)
      const won = (inA && m.winnerTeam === 'A') || (!inA && m.winnerTeam === 'B')
      const dVal = m.eloDelta || 0
      const delta = won ? dVal : -dVal
      if (m.ratingEnabled !== false) {
        runningRating += delta
      }
      runningGames++

      const sKey = m.sessionId || (m.createdAt ? m.createdAt.slice(0, 10) : new Date(m.at || Date.now()).toISOString().slice(0, 10))
      
      const sObj = sessions.find((s) => s.id === m.sessionId)
      const dateStr = sObj?.date
        ? `${sObj.date.slice(8, 10)}/${sObj.date.slice(5, 7)}`
        : m.createdAt
          ? `${m.createdAt.slice(8, 10)}/${m.createdAt.slice(5, 7)}`
          : '—'

      const isEdited = (matchEdits || []).some((ed) => ed.matchId === m.id) || Boolean(m.editedAt || m.editReason)

      sessionMap.set(sKey, {
        dateStr,
        rating: runningRating,
        games: runningGames,
        isEdited: (sessionMap.get(sKey)?.isEdited || false) || isEdited,
      })
    })

    const rawPoints = Array.from(sessionMap.values())
    // Lấy tối đa 14 buổi gần nhất
    const recentPoints = rawPoints.slice(-14)

    // Tính band margin theo bậc tin cậy
    const points = recentPoints.map((pt) => {
      let b = 120
      if (pt.games >= 50) b = 8
      else if (pt.games >= 30) b = 15
      else if (pt.games >= 15) b = 30
      else if (pt.games >= 5) b = 60
      return {
        label: pt.dateStr,
        rating: pt.rating,
        band: b,
        isEdited: pt.isEdited,
      }
    })

    const firstRating = points[0]?.rating || seed
    const latestRating = points[points.length - 1]?.rating || seed
    const delta = latestRating - firstRating
    const latestBand = points[points.length - 1]?.band || 8
    const confProg = confidenceProgress(runningGames)

    return {
      points,
      delta,
      sessionsCount: points.length,
      latestRating,
      band: latestBand,
      confLevel: `R${confProg.levelNum}`,
    }
  }, [filteredMatches, member, levels, sessions, matchEdits, memberId])

  const { points, delta, sessionsCount, latestRating, band, confLevel } = chartData

  // 3. Tính toán tọa độ SVG Line Chart
  const svgMetrics = useMemo(() => {
    if (points.length === 0) return null

    const ratings = points.map((p) => p.rating)
    const uppers = points.map((p) => p.rating + p.band)
    const lowers = points.map((p) => Math.max(0, p.rating - p.band))

    const rawMin = Math.min(...lowers, ...ratings)
    const rawMax = Math.max(...uppers, ...ratings)

    // Làm tròn khoảng rating cho thang đo (mỗi bước 50 hoặc 100)
    const step = 50
    const minR = Math.max(0, Math.floor((rawMin - 20) / step) * step)
    const maxR = Math.max(minR + 100, Math.ceil((rawMax + 20) / step) * step)
    const midR = Math.round((minR + maxR) / 2)

    const svgW = 840
    const svgH = 240
    const padL = 44
    const padR = 40
    const padT = 24
    const padB = 40

    const plotW = svgW - padL - padR
    const plotH = svgH - padT - padB

    const getX = (idx) => {
      if (points.length === 1) return padL + plotW / 2
      return padL + (idx / (points.length - 1)) * plotW
    }

    const getY = (val) => {
      const pct = (val - minR) / (maxR - minR || 1)
      return padT + plotH * (1 - Math.max(0, Math.min(1, pct)))
    }

    // Tọa độ các điểm chính
    const coords = points.map((p, i) => ({
      x: getX(i),
      y: getY(p.rating),
      yUpper: getY(p.rating + p.band),
      yLower: getY(Math.max(0, p.rating - p.band)),
      isEdited: p.isEdited,
      label: p.label,
      rating: p.rating,
    }))

    // Đường line chính
    const polylinePts = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')

    // Đa giác dải mờ (Confidence Interval Band)
    const upperPts = coords.map((c) => `L ${c.x.toFixed(1)} ${c.yUpper.toFixed(1)}`).join(' ')
    const lowerPts = [...coords].reverse().map((c) => `L ${c.x.toFixed(1)} ${c.yLower.toFixed(1)}`).join(' ')
    const bandPath = `M ${coords[0].x.toFixed(1)} ${coords[0].yUpper.toFixed(1)} ${upperPts} ${lowerPts} Z`

    return {
      svgW,
      svgH,
      minR,
      midR,
      maxR,
      coords,
      polylinePts,
      bandPath,
      yTop: padT,
      yMid: padT + plotH / 2,
      yBot: padT + plotH,
    }
  }, [points])

  return (
    <div style={S.container}>
      {/* Header chọn bộ lọc ngữ cảnh */}
      <div style={S.headerRow}>
        <div style={{ flex: 1, minWidth: 200, display: 'grid', gap: 2 }}>
          <div style={S.title}>
            {t('leaderboard.chartTitle', { name: member?.name || '' })}
          </div>
          <div style={S.subtitle}>
            {t('leaderboard.chartSubtitle', { sessions: sessionsCount })}
          </div>
        </div>

        {/* Nút lọc [Tổng] [Đôi] [Đơn] [Gặp nam] [Gặp nữ] */}
        <div style={S.filterGroup}>
          {[
            { id: 'overall', label: t('leaderboard.filterOverall') },
            { id: 'doubles', label: t('leaderboard.filterDoubles') },
            { id: 'singles', label: t('leaderboard.filterSingles') },
            { id: 'vsMale', label: t('leaderboard.filterVsMale') },
            { id: 'vsFemale', label: t('leaderboard.filterVsFemale') },
          ].map((btn) => {
            const active = filter === btn.id
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => setFilter(btn.id)}
                style={{
                  ...S.filterBtn,
                  background: active ? 'var(--action-primary-bg)' : 'transparent',
                  color: active ? 'var(--gray-0)' : 'var(--text-secondary)',
                  boxShadow: active ? '0 1px 2px rgba(0,0,0,0.25)' : 'none',
                }}
              >
                {btn.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Thẻ hiển thị số liệu & Biểu đồ SVG */}
      <div style={S.chartCard}>
        <div style={S.metricsRow}>
          <span style={S.bigRating}>{latestRating}</span>
          <span
            style={{
              ...S.deltaBadge,
              color: delta >= 0 ? 'var(--status-delivered-fg)' : 'var(--status-incident-fg)',
            }}
          >
            {t('leaderboard.ratingDeltaMeta', {
              sign: delta >= 0 ? '+' : '',
              delta,
              sessions: sessionsCount,
            })}
          </span>
          <span style={S.confidenceMeta}>
            {t('leaderboard.chartConfidenceMeta', { conf: confLevel, band })}
          </span>
        </div>

        {/* SVG Canvas */}
        {svgMetrics ? (
          <svg
            viewBox={`0 0 ${svgMetrics.svgW} ${svgMetrics.svgH}`}
            width="100%"
            height={isMobile ? 190 : 240}
            role="img"
            aria-label={t('leaderboard.chartAriaLabel', { name: member?.name })}
            style={{ display: 'block', overflow: 'visible' }}
          >
            {/* Lưới ngang Grid Lines */}
            <g stroke="var(--border-subtle)" strokeWidth="1">
              <line x1="40" y1={svgMetrics.yTop} x2="810" y2={svgMetrics.yTop} />
              <line x1="40" y1={svgMetrics.yMid} x2="810" y2={svgMetrics.yMid} strokeDasharray="3 3" />
              <line x1="40" y1={svgMetrics.yBot} x2="810" y2={svgMetrics.yBot} />
            </g>

            {/* Nhãn trục Y */}
            <g fill="var(--text-muted)" fontFamily="var(--font-mono)" fontSize="11">
              <text x="2" y={svgMetrics.yTop + 4}>{svgMetrics.maxR}</text>
              <text x="2" y={svgMetrics.yMid + 4}>{svgMetrics.midR}</text>
              <text x="2" y={svgMetrics.yBot + 4}>{svgMetrics.minR}</text>
            </g>

            {/* Dải mờ Confidence Interval Band */}
            <path d={svgMetrics.bandPath} fill="var(--border-focus-color)" fillOpacity="0.16" />

            {/* Đường polyline rating chính */}
            <polyline
              points={svgMetrics.polylinePts}
              fill="none"
              stroke="var(--status-transit-fg)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Các điểm tròn trên đường */}
            {svgMetrics.coords.map((c, i) => {
              const isLast = i === svgMetrics.coords.length - 1
              if (c.isEdited) {
                return (
                  <circle
                    key={i}
                    cx={c.x}
                    cy={c.y}
                    r="5"
                    fill="var(--surface-page)"
                    stroke="var(--status-delayed-fg)"
                    strokeWidth="2"
                  >
                    <title>{`${c.label}: ${c.rating} (${t('leaderboard.chartLegendEdited')})`}</title>
                  </circle>
                )
              }
              return (
                <circle
                  key={i}
                  cx={c.x}
                  cy={c.y}
                  r={isLast ? '4.5' : '3.5'}
                  fill={isLast ? 'var(--status-transit-fg)' : 'var(--surface-page)'}
                  stroke="var(--status-transit-fg)"
                  strokeWidth="2"
                >
                  <title>{`${c.label}: ${c.rating}`}</title>
                </circle>
              )
            })}

            {/* Nhãn trục X mốc ngày */}
            <g fill="var(--text-muted)" fontFamily="var(--font-sans)" fontSize="11">
              {svgMetrics.coords.map((c, i) => {
                // Chỉ hiện một số mốc ngày để không bị đè chữ
                const shouldShow =
                  i === 0 ||
                  i === svgMetrics.coords.length - 1 ||
                  i === Math.floor(svgMetrics.coords.length / 3) ||
                  i === Math.floor((svgMetrics.coords.length * 2) / 3)
                if (!shouldShow) return null
                return (
                  <text key={i} x={c.x - 12} y={svgMetrics.svgH - 8}>
                    {c.label}
                  </text>
                )
              })}
            </g>
          </svg>
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {t('leaderboard.chartNoData')}
          </div>
        )}

        {/* Chú thích Legend bên dưới */}
        <div style={S.legendRow}>
          <span style={S.legendItem}>
            <span style={{ width: 16, height: 2.5, background: 'var(--status-transit-fg)', borderRadius: 999 }} />
            {t('leaderboard.chartLegendLine')}
          </span>
          <span style={S.legendItem}>
            <span style={{ width: 16, height: 9, background: 'rgba(60,116,196,0.30)', borderRadius: 2 }} />
            {t('leaderboard.chartLegendBand')}
          </span>
          <span style={S.legendItem}>
            <span style={{ width: 9, height: 9, borderRadius: 999, border: '2px solid var(--status-delayed-fg)' }} />
            {t('leaderboard.chartLegendEdited')}
          </span>
        </div>
      </div>
    </div>
  )
}

const S = {
  container: {
    display: 'grid',
    gap: 12,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  title: {
    font: '600 18px/1.25 Barlow, sans-serif',
    color: 'var(--text-primary)',
  },
  subtitle: {
    font: '400 13px/1.4 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
  },
  filterGroup: {
    display: 'flex',
    gap: 4,
    padding: 3,
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    flexWrap: 'wrap',
  },
  filterBtn: {
    border: 'none',
    padding: '7px 11px',
    borderRadius: 6,
    font: '600 12px/1 "IBM Plex Sans", sans-serif',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  chartCard: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 10,
    boxShadow: 'var(--shadow-xs)',
    padding: 16,
    display: 'grid',
    gap: 14,
  },
  metricsRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 14,
    flexWrap: 'wrap',
  },
  bigRating: {
    font: '700 34px/1 Barlow, sans-serif',
    color: 'var(--text-primary)',
  },
  deltaBadge: {
    font: '600 14px/1 "IBM Plex Mono", monospace',
  },
  confidenceMeta: {
    font: '400 13px/1.4 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
  },
  legendRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 18,
    flexWrap: 'wrap',
    paddingTop: 8,
    borderTop: '1px solid var(--border-subtle)',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    font: '400 12px/1 "IBM Plex Sans", sans-serif',
    color: 'var(--text-secondary)',
  },
}
