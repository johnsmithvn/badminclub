import { useState, useMemo } from 'react'
import { dd } from '#utils/dates.js'
import { playerName } from '#lib/money.js'
import { t } from '#i18n'

export default function SessionStatsSheet({
  open,
  onClose,
  session,
  players = [],
  sessionMatches = [],
  matchCountMap = {},
  ratingsMap = {},
  db,
}) {
  const [activeTab, setActiveTab] = useState('matches') // 'matches' | 'waiting' | 'pairs'

  // Thống kê Số trận
  const statsMatches = useMemo(() => {
    if (!players.length) return { avg: 0, min: 0, max: 0, list: [] }
    const list = players.map((p) => {
      const count = matchCountMap[p.key] || 0
      return {
        key: p.key,
        name: p.name,
        count,
        gender: p.gender,
        level: p.level,
      }
    })

    list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi'))

    const counts = list.map((x) => x.count)
    const min = Math.min(...counts)
    const max = Math.max(...counts)
    const sum = counts.reduce((acc, c) => acc + c, 0)
    const avg = (sum / Math.max(1, list.length)).toFixed(1).replace('.', ',')

    return { avg, min, max, list }
  }, [players, matchCountMap])

  // Thống kê Phút chờ
  const statsWaiting = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    const list = players.map((p) => {
      // Tìm trận gần nhất của p
      let lastMatchTime = null
      for (const m of sessionMatches) {
        const keys = m.playerKeys || [...(m.teamA || []), ...(m.teamB || [])]
        if (keys.includes(p.key)) {
          lastMatchTime = m.at || m.createdAt || null
          break
        }
      }

      let waitMin = 0
      let statusText = ''
      if (!lastMatchTime) {
        waitMin = 999 // Chưa vào sân trận nào, ưu tiên cao nhất
        statusText = t('assign.notPlayedYet')
      } else {
        waitMin = Math.max(0, Math.round((now - lastMatchTime) / 60000))
        if (waitMin < 5) {
          statusText = t('assign.justFinished')
        } else {
          statusText = t('assign.waitingMinutes', { m: waitMin })
        }
      }

      return {
        key: p.key,
        name: p.name,
        waitMin,
        statusText,
        count: matchCountMap[p.key] || 0,
      }
    })

    list.sort((a, b) => b.waitMin - a.waitMin || a.name.localeCompare(b.name, 'vi'))
    return list
  }, [players, sessionMatches, matchCountMap])

  // Thống kê Cặp đã đánh
  const statsPairs = useMemo(() => {
    const pairCounts = {}
    const pairLastAt = {}
    const pairRatings = {}

    sessionMatches.forEach((m) => {
      const handleTeam = (teamKeys) => {
        if (Array.isArray(teamKeys) && teamKeys.length === 2) {
          const [k1, k2] = [...teamKeys].sort()
          const pairKey = `${k1}__${k2}`
          pairCounts[pairKey] = (pairCounts[pairKey] || 0) + 1
          if (!pairLastAt[pairKey]) {
            pairLastAt[pairKey] = m.at || null
          }
          if (!pairRatings[pairKey]) {
            const r1 = ratingsMap[k1] || 1500
            const r2 = ratingsMap[k2] || 1500
            pairRatings[pairKey] = Math.round((r1 + r2) / 2)
          }
        }
      }
      handleTeam(m.teamA)
      handleTeam(m.teamB)
    })

    const list = Object.entries(pairCounts).map(([pairKey, count]) => {
      const [k1, k2] = pairKey.split('__')
      const name1 = playerName(db, k1)
      const name2 = playerName(db, k2)
      return {
        key: pairKey,
        name1,
        name2,
        count,
        lastAt: pairLastAt[pairKey],
        avgRating: pairRatings[pairKey] || 1500,
      }
    })

    list.sort((a, b) => b.count - a.count)
    return list
  }, [sessionMatches, db, ratingsMap])

  const dateStr = session ? dd(session.date) : ''

  if (!open) return null

  return (
    <div
      style={S.backdrop}
      onClick={onClose}
    >
      <div
        style={S.sheet}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Thanh kéo trên cùng */}
        <div style={S.dragHandle} />

        {/* Header sheet */}
        <div style={S.headerRow}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.title}>
              {t('assign.statsSheetTitle', { date: dateStr })}
            </div>
            <div style={S.subtitle}>
              {t('assign.statsSheetSub')}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={S.closeBtn}
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>

        {/* 3 Tab điều hướng */}
        <div style={S.tabsTrack}>
          <button
            type="button"
            onClick={() => setActiveTab('matches')}
            style={{
              ...S.tabBtn,
              ...(activeTab === 'matches' ? S.tabBtnActive : {}),
            }}
          >
            {t('assign.tabMatches')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('waiting')}
            style={{
              ...S.tabBtn,
              ...(activeTab === 'waiting' ? S.tabBtnActive : {}),
            }}
          >
            {t('assign.tabWaiting')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pairs')}
            style={{
              ...S.tabBtn,
              ...(activeTab === 'pairs' ? S.tabBtnActive : {}),
            }}
          >
            {t('assign.tabPairs')}
          </button>
        </div>

        {/* TAB 1: SỐ TRẬN */}
        {activeTab === 'matches' && (
          <div style={S.tabContent}>
            {/* 2 thẻ tóm tắt */}
            <div style={S.statBoxesRow}>
              <div style={S.statBox}>
                <div style={S.statBoxLabel}>{t('assign.statsAvg')}</div>
                <div style={S.statBoxValue}>{t('assign.statsAvgUnit', { n: statsMatches.avg })}</div>
              </div>
              <div style={{ ...S.statBox, ...S.statBoxAlert }}>
                <div style={S.statBoxLabelAlert}>{t('assign.statsMaxDiff')}</div>
                <div style={S.statBoxValueAlert}>{statsMatches.min} ↔ {statsMatches.max}</div>
              </div>
            </div>

            {/* Danh sách thành viên kèm progress bar */}
            <div style={S.playerBarsList}>
              {statsMatches.list.map((item) => {
                const maxVal = Math.max(1, statsMatches.max)
                const pct = Math.round((item.count / maxVal) * 100)
                let barColor = '#5B6B81'
                if (item.count === statsMatches.min && item.count < statsMatches.max) {
                  barColor = '#F0B75C' // ít trận nhất
                } else if (item.count > statsMatches.min && item.count < statsMatches.max) {
                  barColor = '#00B2A9' // mức trung
                }

                return (
                  <div key={item.key} style={S.playerBarRow}>
                    <div style={S.playerBarName} title={item.name}>
                      {item.name}
                    </div>
                    <div style={S.barTrack}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: barColor,
                          borderRadius: 999,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    <div style={{ ...S.playerBarVal, color: barColor }}>
                      {item.count}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* TAB 2: PHÚT CHỜ */}
        {activeTab === 'waiting' && (
          <div style={S.tabContent}>
            <div style={S.waitingList}>
              {statsWaiting.map((item) => (
                <div key={item.key} style={S.waitingRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.waitingName}>{item.name}</div>
                    <div style={S.waitingMeta}>
                      {item.count} {t('units.match')}
                    </div>
                  </div>
                  <span
                    style={{
                      ...S.waitingBadge,
                      ...(item.waitMin > 20 || item.waitMin === 999 ? S.waitingBadgeUrgent : {}),
                    }}
                  >
                    {item.statusText}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: CẶP ĐÃ ĐÁNH */}
        {activeTab === 'pairs' && (
          <div style={S.tabContent}>
            {statsPairs.length === 0 ? (
              <div style={S.emptyNotice}>
                {t('assign.noPairsYet')}
              </div>
            ) : (
              <div style={S.pairsList}>
                {statsPairs.map((p) => (
                  <div key={p.key} style={S.pairRow}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.pairNames}>
                        {p.name1} · {p.name2}
                      </div>
                      <div style={S.pairMeta}>
                        {t('assign.avgRatingLabel')} {p.avgRating}
                      </div>
                    </div>
                    <span style={S.pairCountBadge}>
                      ×{p.count} {t('assign.turnCount')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Nút Đóng */}
        <button
          type="button"
          onClick={onClose}
          style={S.closeBottomBtn}
        >
          {t('assign.closeBackToWait')}
        </button>
      </div>
    </div>
  )
}

const S = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: 'rgba(3,8,17,.68)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sheet: {
    width: 480,
    maxWidth: '100%',
    background: '#141D2E',
    borderTop: '1px solid #2E3E5C',
    borderRadius: '18px 18px 0 0',
    padding: '12px 16px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    boxShadow: '0 -12px 30px rgba(0,0,0,.45)',
    maxHeight: '85vh',
    overflowY: 'auto',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    background: '#2E3E5C',
    alignSelf: 'center',
    marginBottom: 4,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  title: {
    font: '600 17px/1.2 Barlow, sans-serif',
    color: '#E9EFF7',
  },
  subtitle: {
    font: '400 12px/1.45 "IBM Plex Sans", sans-serif',
    color: '#8494AA',
    marginTop: 2,
  },
  closeBtn: {
    font: '600 14px/1 "IBM Plex Mono", monospace',
    color: '#8494AA',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 6px',
  },
  tabsTrack: {
    display: 'flex',
    padding: 3,
    borderRadius: 8,
    background: '#101927',
    border: '1px solid #22304A',
    gap: 2,
  },
  tabBtn: {
    flex: 1,
    minHeight: 38,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    font: '600 12px/1 "IBM Plex Sans", sans-serif',
    color: '#A8B7CB',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    background: '#1A2437',
    border: '1px solid #2E3E5C',
    color: '#E9EFF7',
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  statBoxesRow: {
    display: 'flex',
    gap: 8,
  },
  statBox: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 10,
    background: '#101927',
    border: '1px solid #22304A',
  },
  statBoxAlert: {
    background: 'rgba(224,138,0,.10)',
    border: '1px solid rgba(224,138,0,.35)',
  },
  statBoxLabel: {
    font: '400 11px/1.3 "IBM Plex Sans", sans-serif',
    color: '#8494AA',
  },
  statBoxValue: {
    font: '700 20px/1.15 Barlow, sans-serif',
    color: '#E9EFF7',
    marginTop: 2,
  },
  statBoxLabelAlert: {
    font: '400 11px/1.3 "IBM Plex Sans", sans-serif',
    color: '#A8B7CB',
  },
  statBoxValueAlert: {
    font: '700 20px/1.15 Barlow, sans-serif',
    color: '#F0B75C',
    marginTop: 2,
  },
  playerBarsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: 320,
    overflowY: 'auto',
    paddingRight: 4,
  },
  playerBarRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  playerBarName: {
    width: 88,
    flex: '0 0 auto',
    font: '600 13px/1.2 "IBM Plex Sans", sans-serif',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: '#E9EFF7',
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    background: '#101927',
    border: '1px solid #22304A',
    overflow: 'hidden',
  },
  playerBarVal: {
    width: 30,
    flex: '0 0 auto',
    textAlign: 'right',
    font: '600 13px/1 "IBM Plex Mono", monospace',
  },
  waitingList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: 360,
    overflowY: 'auto',
  },
  waitingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderRadius: 8,
    background: '#101927',
    border: '1px solid #22304A',
  },
  waitingName: {
    font: '600 14px/1.2 "IBM Plex Sans", sans-serif',
    color: '#E9EFF7',
  },
  waitingMeta: {
    font: '400 11px/1.3 "IBM Plex Mono", monospace',
    color: '#8494AA',
    marginTop: 2,
  },
  waitingBadge: {
    font: '600 11px/1 "IBM Plex Mono", monospace',
    padding: '4px 8px',
    borderRadius: 999,
    background: 'rgba(0,178,169,.14)',
    color: '#5FDBD3',
  },
  waitingBadgeUrgent: {
    background: 'rgba(224,138,0,.18)',
    color: '#F0B75C',
  },
  pairsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: 360,
    overflowY: 'auto',
  },
  pairRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderRadius: 8,
    background: '#101927',
    border: '1px solid #22304A',
  },
  pairNames: {
    font: '600 14px/1.3 "IBM Plex Sans", sans-serif',
    color: '#E9EFF7',
  },
  pairMeta: {
    font: '400 11px/1.3 "IBM Plex Mono", monospace',
    color: '#8494AA',
    marginTop: 2,
  },
  pairCountBadge: {
    font: '600 12px/1 "IBM Plex Mono", monospace',
    padding: '4px 8px',
    borderRadius: 999,
    background: 'rgba(224,138,0,.18)',
    color: '#F0B75C',
    whiteSpace: 'nowrap',
  },
  emptyNotice: {
    textAlign: 'center',
    padding: '24px 16px',
    color: '#8494AA',
    fontSize: 13,
  },
  closeBottomBtn: {
    minHeight: 46,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    background: '#1A2437',
    border: '1px solid #2E3E5C',
    font: '600 13px/1 "IBM Plex Sans", sans-serif',
    color: '#E9EFF7',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    marginTop: 6,
  },
}
