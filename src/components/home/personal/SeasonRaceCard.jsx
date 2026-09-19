import { useState, useMemo } from 'react'
import { t } from '#i18n'
import { SearchSelect } from '#ui'
import { calcSeasonRaceHistory, getClubEloLeaderboard } from '#lib/homePersonal.js'
import { calculateSeasonLeaderboard } from '#lib/season.js'

export default function SeasonRaceCard({
  db,
  memberId,
  defaultRivalId = null,
  rivalOptions = [],
  raceData,
  data,
}) {
  const [mode, setMode] = useState('season') // 'season' | 'elo'
  const isSeason = mode === 'season'

  // Danh sách ứng viên đối thủ hiển thị trong dropdown, tự động sắp xếp theo mode (mùa giải / Elo)
  const memberOptions = useMemo(() => {
    if (rivalOptions && rivalOptions.length > 0 && !db) {
      return rivalOptions
    }
    if (!db) return []
    if (isSeason) {
      try {
        const sData = calculateSeasonLeaderboard(db)
        const sList = (sData?.leaderboard || [])
          .filter((m) => m.id !== memberId)
          .map((m) => ({
            id: m.id,
            name: m.name,
            rank: m.rank,
          }))
        if (sList.length > 0) return sList
      } catch { /* không dựng được BXH mùa: rơi sang BXH Elo bên dưới */ }
    }
    const eloList = getClubEloLeaderboard(db)
    return eloList
      .filter((m) => m.id !== memberId)
      .map((m) => ({
        id: m.id,
        name: m.name,
        rank: m.rank,
      }))
  }, [db, memberId, isSeason, rivalOptions])

  const initialRivalIds = useMemo(() => {
    if (Array.isArray(defaultRivalId)) return defaultRivalId
    if (defaultRivalId) return [defaultRivalId]
    if (Array.isArray(raceData?.rivalIds)) return raceData.rivalIds
    if (raceData?.rivalId) return [raceData.rivalId]
    return []
  }, [defaultRivalId, raceData])

  const [selectedRivalIds, setSelectedRivalIds] = useState(initialRivalIds)

  // Nếu selectedRivalIds chưa được chọn thì lấy người đầu tiên trong danh sách (hoặc defaultRivalId)
  const currentRivalIds = useMemo(() => {
    if (selectedRivalIds.length > 0) return selectedRivalIds
    if (memberOptions[0]?.id) return [memberOptions[0].id]
    return []
  }, [selectedRivalIds, memberOptions])

  const selectOptions = useMemo(() => {
    return memberOptions.map((opt) => ({
      value: opt.id,
      label: `${opt.rank ? `#${opt.rank} · ` : ''}${opt.name}`,
    }))
  }, [memberOptions])

  const activeData = useMemo(() => {
    if (db && memberId) {
      return calcSeasonRaceHistory(db, memberId, currentRivalIds, 6, mode)
    }
    return raceData || data
  }, [db, memberId, currentRivalIds, mode, raceData, data])

  if (!activeData || activeData.empty) {
    return (
      <div style={S.card}>
        <div style={S.headerRow}>
          <span style={S.title}>
            {isSeason
              ? t('home.personal.seasonRaceTitle', { weeks: activeData?.weeks || 6 })
              : t('home.personal.eloRaceTitle', { weeks: activeData?.weeks || 6 })}
          </span>
          <div style={S.modeToggle}>
            <button
              type="button"
              onClick={() => setMode('season')}
              style={isSeason ? S.modeBtnActive : S.modeBtn}
            >
              {t('home.personal.seasonTab')}
            </button>
            <button
              type="button"
              onClick={() => setMode('elo')}
              style={!isSeason ? S.modeBtnActive : S.modeBtn}
            >
              {t('home.personal.eloTab')}
            </button>
          </div>
        </div>
        <div style={S.emptyState}>{t('home.personal.emptyMatches')}</div>
      </div>
    )
  }

  const {
    weeks = 6,
    startVal = 0,
    currentVal = 0,
    deltaVal = 0,
    startElo = 0,
    currentElo = 0,
    deltaElo = 0,
    rivals = [],
    rivalName = '',
    rivalRank = 1,
    svgPointsMy = '',
    svgPointsRival = '',
    hasRivalTrajectory = false,
    latestMyX = 640,
    latestMyY = 22,
    gapNoteKey = null,
    gapFrom = null,
    gapTo = null,
    gapWeeks = null,
  } = activeData

  const displayStart = startVal ?? startElo
  const displayCurrent = currentVal ?? currentElo
  const displayDelta = deltaVal ?? deltaElo
  const sign = displayDelta >= 0 ? '+' : ''

  return (
    <div style={S.card}>
      <div style={S.headerRow}>
        <div style={S.leftHeaderGroup}>
          <span style={S.title}>
            {isSeason
              ? t('home.personal.seasonRaceTitle', { weeks })
              : t('home.personal.eloRaceTitle', { weeks })}
          </span>

          <div style={S.actionsRow}>
            {/* Toggle Mùa giải | Elo */}
            <div style={S.modeToggle}>
              <button
                type="button"
                onClick={() => setMode('season')}
                style={isSeason ? S.modeBtnActive : S.modeBtn}
              >
                {t('home.personal.seasonTab')}
              </button>
              <button
                type="button"
                onClick={() => setMode('elo')}
                style={!isSeason ? S.modeBtnActive : S.modeBtn}
              >
                {t('home.personal.eloTab')}
              </button>
            </div>

            {/* Select Multiple Rivals với SearchSelect có sẵn */}
            {memberOptions.length > 0 && (
              <div style={S.selectWrapper}>
                <SearchSelect
                  options={selectOptions}
                  value={currentRivalIds}
                  onChange={(nextVals) => {
                    const arr = Array.isArray(nextVals) ? nextVals : [nextVals].filter(Boolean)
                    setSelectedRivalIds(arr)
                  }}
                  multiple={true}
                  size="sm"
                  placeholder={t('home.personal.compareWith')}
                  menuWidth={260}
                  style={{ minWidth: 160, maxWidth: 320 }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Dải số bên phải header: 1.246 → 1.284  +38 */}
        <div style={S.rightHeaderGroup}>
          <span style={S.rangeMono}>
            {Number(displayStart || 0).toLocaleString('vi-VN')} → {Number(displayCurrent || 0).toLocaleString('vi-VN')}
          </span>
          <span style={displayDelta >= 0 ? S.deltaGreen : S.deltaRed}>
            {sign}{Math.abs(displayDelta).toLocaleString('vi-VN')}
          </span>
        </div>
      </div>

      <div style={S.chartContainer}>
        <svg viewBox="0 0 660 96" preserveAspectRatio="none" style={S.svg}>
          <line x1="0" y1="24" x2="660" y2="24" stroke="var(--border-subtle)" strokeWidth="1" />
          <line x1="0" y1="60" x2="660" y2="60" stroke="var(--border-subtle)" strokeWidth="1" />

          {/* Đường của các đối thủ với màu sắc riêng biệt */}
          {rivals.length > 0 ? (
            rivals.map((rival) => (
              rival.hasTrajectory && rival.svgPoints && (
                <polyline
                  key={rival.id}
                  points={rival.svgPoints}
                  fill="none"
                  stroke={rival.color}
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
              )
            ))
          ) : (
            hasRivalTrajectory && svgPointsRival && (
              <polyline
                points={svgPointsRival}
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            )
          )}

          {/* Đường của bạn: nét liền dày */}
          {svgPointsMy && (
            <polyline
              points={svgPointsMy}
              fill="none"
              stroke="var(--action-accent-bg)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {latestMyX > 0 && (
            <circle cx={latestMyX} cy={latestMyY} r="4.5" fill="var(--status-delivered-fg)" />
          )}
        </svg>
      </div>

      <div style={S.legendRow}>
        <div style={S.legendLeft}>
          <div style={S.myLegend}>
            <span style={S.myBar} />
            <span>{isSeason ? t('home.personal.mySeasonLegend') : t('home.personal.myEloLegend')}</span>
          </div>

          {/* Legend từng đối thủ với màu tương ứng */}
          {rivals.length > 0 ? (
            rivals.map((rival) => (
              rival.hasTrajectory && (
                <div key={rival.id} style={S.rivalLegend}>
                  <span style={{ ...S.rivalBar, background: rival.color }} />
                  <span>{t('home.personal.rivalEloLegend', { name: rival.name, rank: rival.rank })}</span>
                </div>
              )
            ))
          ) : (
            hasRivalTrajectory && svgPointsRival && rivalName && (
              <div style={S.rivalLegend}>
                <span style={S.rivalBar} />
                <span>{t('home.personal.rivalEloLegend', { name: rivalName, rank: rivalRank })}</span>
              </div>
            )
          )}
        </div>

        {gapNoteKey && (
          <div style={S.trendNote}>
            {t(`home.personal.${gapNoteKey}`, { from: gapFrom, to: gapTo, weeks: gapWeeks })}
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  card: {
    padding: '16px 17px',
    borderRadius: 14,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  leftHeaderGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  rightHeaderGroup: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
  },
  actionsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    font: '600 11px/1 var(--font-sans)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  rangeMono: {
    font: '500 12px/1 var(--font-mono)',
    color: 'var(--text-secondary)',
  },
  deltaGreen: {
    font: '700 13px/1 var(--font-mono)',
    color: 'var(--status-delivered-fg)',
  },
  deltaRed: {
    font: '700 13px/1 var(--font-mono)',
    color: 'var(--status-incident-fg)',
  },
  modeToggle: {
    display: 'inline-flex',
    padding: 2,
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    gap: 2,
  },
  modeBtn: {
    background: 'none',
    border: 'none',
    padding: '3px 8px',
    borderRadius: 6,
    font: '600 11px/1 var(--font-sans)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  modeBtnActive: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    padding: '3px 8px',
    borderRadius: 6,
    font: '600 11px/1 var(--font-sans)',
    color: 'var(--text-primary)',
    boxShadow: 'var(--shadow-sm)',
    cursor: 'default',
  },
  selectWrapper: {
    display: 'inline-flex',
    alignItems: 'center',
  },
  select: {
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    padding: '4px 8px',
    font: '500 11.5px/1.2 var(--font-sans)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    outline: 'none',
  },
  chartContainer: {
    width: '100%',
    overflowX: 'auto',
  },
  svg: {
    width: '100%',
    height: 'auto',
    display: 'block',
  },
  legendRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  trendNote: {
    font: '400 11.5px/1.3 var(--font-sans)',
    color: 'var(--text-muted)',
    textAlign: 'right',
  },
  myLegend: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    font: '400 11.5px/1 var(--font-mono)',
    color: 'var(--text-secondary)',
  },
  myBar: {
    width: 14,
    height: 2.5,
    borderRadius: 999,
    background: 'var(--action-accent-bg)',
  },
  rivalLegend: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    font: '400 11.5px/1 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  rivalBar: {
    width: 14,
    height: 2,
    borderRadius: 999,
    background: 'var(--text-muted)',
  },
  emptyState: {
    padding: '24px 0',
    textAlign: 'center',
    font: '400 13px/1.4 var(--font-sans)',
    color: 'var(--text-muted)',
  },
}
