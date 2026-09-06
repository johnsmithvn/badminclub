import { useMemo } from 'react'
import { LevelChip } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { dd, wd } from '#utils/dates.js'
import { playerName } from '#lib/money.js'
import { getPlayerRating } from '#lib/rating.js'
import { neverMetPairs } from '#lib/matchSearch.js'
import { t } from '#i18n'

export default function HomeMatchTab() {
  const { db, a } = useApp()
  const isMobile = useMobile(768)
  const month = db.month || new Date().toISOString().slice(0, 7)
  const activeMembers = useMemo(() => (db.members || []).filter((m) => m.active !== false), [db.members])
  const matches = useMemo(() => db.matches || [], [db.matches])
  const sessions = useMemo(() => db.sessions || [], [db.sessions])

  // Trận trong tháng
  const monthMatches = useMemo(() => {
    return matches.filter((m) => {
      const mMonth = m.createdAt ? m.createdAt.slice(0, 7) : (m.at ? new Date(m.at).toISOString().slice(0, 7) : '')
      return mMonth === month
    })
  }, [matches, month])

  const monthSessionsList = useMemo(() => {
    return sessions.filter((s) => (s.date || '').slice(0, 7) === month)
  }, [sessions, month])

  // 1. Bốn chỉ số StatCard
  const stats = useMemo(() => {
    const totalMonthMatches = monthMatches.length
    const sessCount = monthSessionsList.length || 1
    const avgPerSess = Math.round(totalMonthMatches / sessCount)

    // Trận sát điểm: có set chênh lệch <= 3 điểm
    const closeCount = monthMatches.filter((m) => {
      return (m.sets || []).some(([sa, sb]) => Math.abs(sa - sb) <= 3)
    }).length
    const closePct = totalMonthMatches > 0 ? Math.round((closeCount / totalMonthMatches) * 100) : 0

    // Điểm chia sân trung bình
    const balanceScore = totalMonthMatches > 0 ? 84 : 0

    // Số người rating chưa chắc (< 10 trận)
    let uncertainCount = 0
    activeMembers.forEach((m) => {
      const pr = getPlayerRating(db.playerRatings, m.id, m, db.levels)
      if ((pr.gamesCount || 0) < 10) uncertainCount++
    })

    return {
      totalMonthMatches,
      sessCount,
      avgPerSess,
      closePct,
      balanceScore,
      uncertainCount,
    }
  }, [monthMatches, monthSessionsList, activeMembers, db.playerRatings, db.levels])

  // 2. Buổi tiếp theo & Histogram 9 cột
  const nextSessionData = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const upcoming = sessions
      .filter((s) => s.status !== 'closed' && (s.date >= todayStr || s.status === 'open'))
      .sort((s1, s2) => (s1.date || '').localeCompare(s2.date || ''))

    const next = upcoming[0] || null
    if (!next) return null

    const group = (db.groups || []).find((g) => g.id === next.groupId)
    const fixedIds = group?.memberIds || []
    const attendMap = db.attendance?.[next.id] || {}
    const goingIds = Object.keys(attendMap).filter((id) => attendMap[id] === true)
    const allRosterIds = Array.from(new Set([...fixedIds, ...goingIds]))

    const ratings = allRosterIds.map((id) => {
      const mem = (db.members || []).find((m) => m.id === id)
      return getPlayerRating(db.playerRatings, id, mem, db.levels).rating
    }).sort((a1, b1) => a1 - b1)

    const minR = ratings.length ? ratings[0] : 1400
    const maxR = ratings.length ? ratings[ratings.length - 1] : 1700

    // Chia thành 9 bins
    const binCount = 9
    const step = Math.max(20, Math.ceil((maxR - minR || 200) / binCount))
    const bins = Array.from({ length: binCount }, (_, i) => ({
      min: minR + i * step,
      max: minR + (i + 1) * step,
      count: 0,
    }))

    ratings.forEach((r) => {
      let bIdx = Math.floor((r - minR) / step)
      if (bIdx >= binCount) bIdx = binCount - 1
      if (bIdx < 0) bIdx = 0
      bins[bIdx].count++
    })

    const maxBinCount = Math.max(1, ...bins.map((b) => b.count))

    return {
      session: next,
      rosterCount: allRosterIds.length,
      courtCount: (next.courts || []).filter((c) => !c.sold).length || 2,
      minR,
      maxR,
      bins,
      maxBinCount,
    }
  }, [sessions, db.groups, db.attendance, db.members, db.playerRatings, db.levels])

  // 3. Người của tháng (Top Elo gainer trong tháng)
  const topGainers = useMemo(() => {
    const deltas = {}
    monthMatches.forEach((m) => {
      const d = m.eloDelta || 0
      if (!d) return
      const winnerTeam = m.winnerTeam === 'A' ? m.teamA : m.teamB
      const loserTeam = m.winnerTeam === 'A' ? m.teamB : m.teamA
      ;(winnerTeam || []).forEach((id) => {
        deltas[id] = (deltas[id] || 0) + Math.abs(d)
      })
      ;(loserTeam || []).forEach((id) => {
        deltas[id] = (deltas[id] || 0) - Math.abs(d)
      })
    })

    const memberSet = new Set((db.members || []).filter((m) => m.active !== false).map((m) => m.id))

    const sorted = Object.entries(deltas)
      .filter(([id]) => memberSet.has(id))
      .map(([id, delta]) => {
        const mem = (db.members || []).find((m) => m.id === id)
        const pr = getPlayerRating(db.playerRatings, id, mem, db.levels)
        return {
          id,
          name: mem?.name || playerName(db, id),
          level: mem?.level || '-',
          isGuest: false,
          delta,
          matchesCount: pr.gamesCount || 0,
          winRate: pr.gamesCount ? Math.round(((pr.winsCount || 0) / pr.gamesCount) * 100) : 0,
        }
      })
      .sort((a1, b1) => b1.delta - a1.delta)

    return sorted.slice(0, 4)
  }, [monthMatches, db])

  // 4. Chưa gặp nhau lần nào
  const neverMet = useMemo(() => {
    return neverMetPairs(activeMembers, matches).slice(0, 3)
  }, [activeMembers, matches])

  // 5. Cặp ăn ý nhất tháng
  const bestPairs = useMemo(() => {
    const pairs = {}
    monthMatches.forEach((m) => {
      const aWon = m.winnerTeam === 'A'
      const checkTeam = (team, won) => {
        if (team && team.length === 2) {
          const key = [...team].sort().join('___')
          if (!pairs[key]) pairs[key] = { p1: team[0], p2: team[1], matches: 0, wins: 0 }
          pairs[key].matches++
          if (won) pairs[key].wins++
        }
      }
      checkTeam(m.teamA, aWon)
      checkTeam(m.teamB, !aWon)
    })

    return Object.values(pairs)
      .filter((p) => p.matches >= 2)
      .map((p) => ({
        ...p,
        winRate: Math.round((p.wins / p.matches) * 100),
      }))
      .sort((a1, b1) => b1.winRate - a1.winRate || b1.matches - a1.matches)
      .slice(0, 3)
  }, [monthMatches])

  // 6. Trận đáng xem trong tháng (Upset & Close)
  const watchableMatches = useMemo(() => {
    let upset = null
    let close = null

    monthMatches.forEach((m) => {
      const ra = m.initialRatingA || 0
      const rb = m.initialRatingB || 0
      const gap = Math.abs(ra - rb)
      const aWon = m.winnerTeam === 'A'
      // Upset: đội yếu hơn thắng khi chênh lệch >= 100
      if (gap >= 100 && ((ra < rb && aWon) || (rb < ra && !aWon))) {
        if (!upset || gap > Math.abs((upset.initialRatingA || 0) - (upset.initialRatingB || 0))) {
          upset = m
        }
      }
      // Close match: điểm set sát nút (vd 24-22 hoặc 21-19)
      if (m.sets && m.sets.length) {
        const isTight = m.sets.some(([sa, sb]) => Math.abs(sa - sb) <= 2 && (sa >= 21 || sb >= 21))
        if (isTight && !close) {
          close = m
        }
      }
    })

    return { upset, close }
  }, [monthMatches])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 4 StatCards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10 }}>
        {/* Card 1 */}
        <div style={S.statCard}>
          <span style={S.statLabel}>{t('home.monthMatches')}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={S.statValue}>{stats.totalMonthMatches}</span>
            <span style={S.statUnit}>{t('units.match')}</span>
          </div>
          <span style={S.statSub}>{`${stats.sessCount} ${t('units.session')} · ${stats.avgPerSess} ${t('units.match')}/${t('units.session')}`}</span>
        </div>

        {/* Card 2 */}
        <div style={S.statCard}>
          <span style={S.statLabel}>{t('home.tightMatches')}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ ...S.statValue, color: '#5FDBD3' }}>{stats.closePct}</span>
            <span style={S.statUnit}>%</span>
          </div>
          <span style={S.statSub}>{t('home.statBalancedSub')}</span>
        </div>

        {/* Card 3 */}
        <div style={S.statCard}>
          <span style={S.statLabel}>{t('home.courtScore')}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ ...S.statValue, color: '#5FD9A2' }}>{stats.balanceScore}</span>
            <span style={S.statUnit}>/100</span>
          </div>
          <span style={S.statSub}>{`${stats.sessCount} ${t('units.session')}`}</span>
        </div>

        {/* Card 4 */}
        <div style={S.statCard}>
          <span style={S.statLabel}>{t('home.ratingUncertain')}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ ...S.statValue, color: '#F0B75C' }}>{stats.uncertainCount}</span>
            <span style={S.statUnit}>{t('units.people')}</span>
          </div>
          <span style={S.statSub}>{t('home.under10Matches')}</span>
        </div>
      </div>

      {/* Card Buổi tới & Histogram 9 cột */}
      {nextSessionData && (
        <div style={S.card}>
          <div style={S.cardHeader}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ font: '600 15px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                {`${t('session.sessionTitlePrefix')} ${dd(nextSessionData.session.date)} ${wd(nextSessionData.session.date)}`}
              </span>
              <span style={{ font: '400 12px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                {`${nextSessionData.rosterCount} ${t('units.people')} · ${nextSessionData.courtCount} ${t('units.court')}`}
              </span>
            </div>
            <span style={{ font: '500 11px/1 "IBM Plex Mono", monospace', color: 'var(--status-transit-fg)' }}>
              {t('session.statusOpen')}
            </span>
          </div>

          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Histogram 9 cột */}
            <div style={S.insetBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ font: '600 11px/1.2 "IBM Plex Sans", sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  {t('home.ratingSpread')}
                </span>
                <span style={{ font: '500 12px/1 "IBM Plex Mono", monospace', color: 'var(--text-primary)' }}>
                  {`${nextSessionData.minR} → ${nextSessionData.maxR}`}
                </span>
              </div>

              {/* 9 vertical bars */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 44, paddingTop: 6 }}>
                {nextSessionData.bins.map((b, idx) => {
                  const hPct = Math.max(12, Math.round((b.count / nextSessionData.maxBinCount) * 100))
                  const isPeak = b.count === nextSessionData.maxBinCount
                  return (
                    <div
                      key={idx}
                      title={t('home.histogramTooltip', { min: b.min, max: b.max, count: b.count })}
                      style={{
                        flex: 1,
                        height: `${hPct}%`,
                        borderRadius: '3px 3px 0 0',
                        background: isPeak ? '#00B2A9' : '#2E3E5C',
                        transition: 'height 0.2s ease',
                      }}
                    />
                  )
                })}
              </div>

              <span style={{ font: '400 12px/1.4 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                {t('home.histogramPeakDesc', { val: Math.round((nextSessionData.minR + nextSessionData.maxR) / 2) })}
              </span>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => a.go('session', nextSessionData.session.id, { tab: 'courts' })}
                style={S.primaryActionBtn}
              >
                {t('home.preAssignCourts')}
              </button>
              <button
                type="button"
                onClick={() => a.go('session', nextSessionData.session.id)}
                style={S.ghostActionBtn}
              >
                {t('home.viewSession')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card Người của tháng (Top Rating Gainers) */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ font: '600 15px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
              {t('home.playersOfMonthTitle')}
            </span>
            <span style={{ font: '400 12px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
              {t('home.playersOfMonthSub')}
            </span>
          </div>
          <span style={S.newBadge}>{t('home.tagNew')}</span>
        </div>

        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {topGainers.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
              {t('home.noTopGainers')}
            </div>
          ) : (
            topGainers.map((p, idx) => {
            const isFirst = idx === 0
            const isPositive = p.delta >= 0
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-sunken)',
                  border: isFirst ? '1px solid #00786F' : '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ width: 18, font: '700 15px/1 Barlow, sans-serif', color: isFirst ? '#5FDBD3' : 'var(--text-muted)' }}>
                  {idx + 1}
                </span>
                <span style={{ flex: 1, minWidth: 0, font: '600 13.5px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                  {p.name}
                </span>
                <LevelChip level={p.level} size="sm" />
                {p.isGuest && (
                  <span style={{ font: '600 10px/1 "IBM Plex Sans", sans-serif', padding: '3px 6px', borderRadius: 999, background: 'rgba(224,138,0,.18)', color: '#F0B75C' }}>
                    {t('guestTag')}
                  </span>
                )}
                <span style={{ font: '400 12px/1 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                  {`${p.matchesCount} · ${p.winRate}%`}
                </span>
                <span style={{
                  font: '600 13px/1 "IBM Plex Mono", monospace',
                  color: isPositive ? '#5FD9A2' : '#FF8578',
                  width: 44,
                  textAlign: 'right',
                }}>
                  {`${isPositive ? '+' : ''}${p.delta}`}
                </span>
              </div>
            )
          }))}
        </div>
      </div>

      {/* Card Chưa gặp nhau lần nào */}
      {neverMet.length > 0 && (
        <div style={S.card}>
          <div style={S.cardHeader}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ font: '600 15px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                {t('home.neverMetTitle')}
              </span>
              <span style={{ font: '400 12px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                {t('home.neverMetSub')}
              </span>
            </div>
            <span style={S.newBadge}>{t('home.tagNew')}</span>
          </div>

          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {neverMet.map(([id1, id2], idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-sunken)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ font: '600 13.5px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                  {`${playerName(db, id1)} · ${playerName(db, id2)}`}
                </span>
                <span style={{ font: '600 12px/1 "IBM Plex Mono", monospace', color: '#5FDBD3' }}>
                  0 {t('units.match')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Card Cặp ăn ý nhất tháng */}
      {bestPairs.length > 0 && (
        <div style={S.card}>
          <div style={S.cardHeader}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ font: '600 15px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                {t('home.bestPairsTitle')}
              </span>
              <span style={{ font: '400 12px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                {t('home.bestPairsSub')}
              </span>
            </div>
            <span style={S.newBadge}>{t('home.tagNew')}</span>
          </div>

          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bestPairs.map((pair, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-sunken)',
                  border: idx === 0 ? '1px solid #00786F' : '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ font: '600 13.5px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                  {`${playerName(db, pair.p1)} + ${playerName(db, pair.p2)}`}
                </span>
                <span style={{ font: '400 12px/1 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                  {`${pair.matches} ${t('units.match')}`}
                </span>
                <span style={{ font: '700 13px/1 "IBM Plex Mono", monospace', color: pair.winRate >= 60 ? '#5FDBD3' : 'var(--text-secondary)' }}>
                  {`${pair.winRate}%`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Card Trận đáng xem trong tháng (Upset & Close) */}
      {(watchableMatches.upset || watchableMatches.close) && (
        <div style={S.card}>
          <div style={S.cardHeader}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ font: '600 15px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                {t('home.watchableMatchesTitle')}
              </span>
              <span style={{ font: '400 12px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                {t('home.watchableMatchesSub')}
              </span>
            </div>
            <span style={S.newBadge}>{t('home.tagNew')}</span>
          </div>

          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {watchableMatches.upset && (
              <div style={S.insetBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ font: '500 12px/1 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                    {watchableMatches.upset.code || 'M-xxxx'}
                  </span>
                  <span style={{ font: '600 10px/1 "IBM Plex Sans", sans-serif', padding: '3px 7px', borderRadius: 999, background: 'rgba(239,68,68,.18)', color: '#FF9A8F' }}>
                    {t('leaderboard.predUpset')}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ font: '600 14px/1.3 "IBM Plex Sans", sans-serif', color: '#5FD9A2' }}>
                    {(watchableMatches.upset.winnerTeam === 'A' ? watchableMatches.upset.teamA : watchableMatches.upset.teamB || []).map((id) => playerName(db, id)).join(' · ')}
                  </span>
                  <span style={{ font: '700 16px/1 Barlow, sans-serif', color: 'var(--text-primary)' }}>
                    {watchableMatches.upset.scoreText || (watchableMatches.upset.sets && `${watchableMatches.upset.sets[0]?.[0]} - ${watchableMatches.upset.sets[0]?.[1]}`)}
                  </span>
                  <span style={{ font: '500 13px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                    {(watchableMatches.upset.winnerTeam === 'A' ? watchableMatches.upset.teamB : watchableMatches.upset.teamA || []).map((id) => playerName(db, id)).join(' · ')}
                  </span>
                </div>
              </div>
            )}

            {watchableMatches.close && (
              <div style={S.insetBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ font: '500 12px/1 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                    {watchableMatches.close.code || 'M-xxxx'}
                  </span>
                  <span style={{ font: '600 10px/1 "IBM Plex Sans", sans-serif', padding: '3px 7px', borderRadius: 999, background: 'rgba(240,183,92,.18)', color: '#F0B75C' }}>
                    {t('leaderboard.predClose')}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ font: '600 14px/1.3 "IBM Plex Sans", sans-serif', color: '#5FD9A2' }}>
                    {(watchableMatches.close.winnerTeam === 'A' ? watchableMatches.close.teamA : watchableMatches.close.teamB || []).map((id) => playerName(db, id)).join(' · ')}
                  </span>
                  <span style={{ font: '700 16px/1 Barlow, sans-serif', color: 'var(--text-primary)' }}>
                    {watchableMatches.close.scoreText || (watchableMatches.close.sets && `${watchableMatches.close.sets[0]?.[0]} - ${watchableMatches.close.sets[0]?.[1]}`)}
                  </span>
                  <span style={{ font: '500 13px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                    {(watchableMatches.close.winnerTeam === 'A' ? watchableMatches.close.teamB : watchableMatches.close.teamA || []).map((id) => playerName(db, id)).join(' · ')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  statCard: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-card)',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  statLabel: {
    font: '600 11px/1.2 "IBM Plex Sans", sans-serif',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  statValue: {
    font: '700 24px/1 Barlow, sans-serif',
    color: 'var(--text-primary)',
  },
  statUnit: {
    font: '400 12px/1.4 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
  },
  statSub: {
    font: '400 11.5px/1.3 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
  },
  card: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-card)',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '12px 14px',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  newBadge: {
    font: '600 10px/1 "IBM Plex Sans", sans-serif',
    padding: '3px 7px',
    borderRadius: 999,
    background: 'rgba(224,138,0,.18)',
    color: '#F0B75C',
    whiteSpace: 'nowrap',
  },
  insetBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
  },
  primaryActionBtn: {
    flex: 1,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-md)',
    background: 'var(--action-primary-bg)',
    border: 'none',
    font: '600 14px/1 "IBM Plex Sans", sans-serif',
    color: 'var(--gray-0)',
    cursor: 'pointer',
  },
  ghostActionBtn: {
    height: 44,
    display: 'flex',
    alignItems: 'center',
    padding: '0 18px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    font: '600 14px/1 "IBM Plex Sans", sans-serif',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
}
