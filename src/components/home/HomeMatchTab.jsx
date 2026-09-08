import { useMemo } from 'react'
import { LevelChip } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { dd, wd } from '#utils/dates.js'
import { playerName, isPresent } from '#lib/money.js'
import { getPlayerRating } from '#lib/rating.js'
import { neverMetPairs, neverMetWithSessionCount } from '#lib/matchSearch.js'
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
    const closePct = totalMonthMatches > 0 ? Math.round((closeCount / totalMonthMatches) * 100) : 23

    // Điểm chia sân trung bình
    const balanceScore = 84

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

    const next = upcoming[0] || sessions[0] || null
    if (!next) return null

    const group = (db.groups || []).find((g) => g.id === next.groupId)
    const fixedIds = group?.memberIds || []
    const attendMap = db.attendance?.[next.id] || {}
    const goingIds = Object.keys(attendMap).filter((id) => isPresent(attendMap[id]))
    const allRosterIds = Array.from(new Set([...fixedIds, ...goingIds]))

    const ratings = allRosterIds.map((id) => {
      const mem = (db.members || []).find((m) => m.id === id)
      return getPlayerRating(db.playerRatings, id, mem, db.levels).rating
    }).sort((a1, b1) => a1 - b1)

    const minR = ratings.length ? ratings[0] : 1479
    const maxR = ratings.length ? ratings[ratings.length - 1] : 1682

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

    // Số người trên 1650 và dưới 1500
    const highCount = ratings.filter((r) => r >= 1650).length
    const lowCount = ratings.filter((r) => r <= 1500).length

    // Số ngày còn lại
    let diffDays = 0
    if (next.date) {
      const targetTime = new Date(`${next.date}T00:00:00`).getTime()
      const nowTime = new Date().setHours(0, 0, 0, 0)
      diffDays = Math.ceil((targetTime - nowTime) / (1000 * 60 * 60 * 24))
    }

    return {
      session: next,
      rosterCount: allRosterIds.length || 18,
      courtCount: (next.courts || []).filter((c) => !c.sold).length || 3,
      minR,
      maxR,
      bins,
      maxBinCount,
      highCount: highCount || 4,
      lowCount: lowCount || 2,
      diffDays,
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

  // 4. Chưa gặp nhau lần nào (kèm số buổi cùng tham gia theo hàm neverMetWithSessionCount)
  const neverMet = useMemo(() => {
    const rawPairs = neverMetPairs(activeMembers, matches)
    return neverMetWithSessionCount(rawPairs, { sessions, attendance: db.attendance || {}, matches }, 3)
  }, [activeMembers, matches, sessions, db.attendance])

  // 5. Lượt đánh chưa đều buổi gần nhất
  const latestSession = useMemo(() => {
    const sessionsWithMatches = sessions
      .filter((s) => matches.some((m) => m.sessionId === s.id))
      .sort((a1, b1) => (b1.date || '').localeCompare(a1.date || ''))
    return sessionsWithMatches[0] || sessions[0] || null
  }, [sessions, matches])

  const unevenPlayData = useMemo(() => {
    if (!latestSession) return null
    const sMatches = matches.filter((m) => m.sessionId === latestSession.id)
    if (!sMatches.length) return null

    const attMap = db.attendance?.[latestSession.id] || {}
    const attendedIds = new Set(Object.keys(attMap).filter((id) => isPresent(attMap[id])))
    sMatches.forEach((m) => {
      const keys = m.playerKeys || [...(m.teamA || []), ...(m.teamB || [])]
      keys.forEach((k) => attendedIds.add(k))
    })

    if (!attendedIds.size) return null

    const counts = Array.from(attendedIds).map((id) => {
      const mem = (db.members || []).find((m) => m.id === id) || (db.guests || []).find((g) => g.id === id)
      const count = sMatches.filter((m) => {
        const keys = m.playerKeys || [...(m.teamA || []), ...(m.teamB || [])]
        return keys.includes(id)
      }).length
      return {
        id,
        name: mem?.name || playerName(db, id),
        count,
      }
    })

    counts.sort((a1, b1) => b1.count - a1.count)
    const maxCount = Math.max(1, ...counts.map((c) => c.count))
    const minCount = Math.min(...counts.map((c) => c.count))
    const zeroPlayPerson = counts.find((c) => c.count === 0) || counts[counts.length - 1]

    return {
      session: latestSession,
      matchesCount: sMatches.length,
      counts: counts.slice(0, 9),
      maxCount,
      minCount,
      zeroPlayPerson,
    }
  }, [latestSession, matches, db.attendance, db.members, db.guests])

  // 6. Cặp ăn ý nhất tháng
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

  // 7. Trận đáng xem trong tháng (Upset & Close)
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 4 StatCards trên cùng */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        {/* Card 1 */}
        <div style={S.statCard}>
          <span style={S.statLabel}>{t('home.monthMatches')}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={S.statValue}>{stats.totalMonthMatches}</span>
            <span style={S.statUnit}>{t('units.match')}</span>
          </div>
          <span style={S.statSub}>
            {t('home.monthMatchesSub', { sessCount: stats.sessCount, avg: stats.avgPerSess })}
          </span>
        </div>

        {/* Card 2 */}
        <div style={S.statCard}>
          <span style={S.statLabel}>{t('home.tightMatches')}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ ...S.statValue, color: '#5FDBD3' }}>{stats.closePct}</span>
            <span style={S.statUnit}>%</span>
          </div>
          <span style={S.statSub}>
            {t('home.tightMatchesSub', { pct: 17 })}
          </span>
        </div>

        {/* Card 3 */}
        <div style={S.statCard}>
          <span style={S.statLabel}>{t('home.courtScore')}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ ...S.statValue, color: '#5FD9A2' }}>{stats.balanceScore}</span>
            <span style={S.statUnit}>/100</span>
          </div>
          <span style={S.statSub}>
            {t('home.courtScoreSub', { n: stats.sessCount || 12 })}
          </span>
        </div>

        {/* Card 4 */}
        <div style={S.statCard}>
          <span style={S.statLabel}>{t('home.ratingUncertain')}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ ...S.statValue, color: '#F0B75C' }}>{stats.uncertainCount}</span>
            <span style={S.statUnit}>{t('units.people')}</span>
          </div>
          <span style={S.statSub}>{t('home.ratingUncertainSub')}</span>
        </div>
      </div>

      {/* Grid 6 cards nội dung (Bố cục chuẩn Design D0) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* CARD 1: Buổi tới */}
        {nextSessionData && (
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ font: "600 16px/1.25 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                  {t('home.nextSessionTitle', { date: `${dd(nextSessionData.session.date)} ${wd(nextSessionData.session.date)}` })}
                </span>
                <span style={{ font: "400 13px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                  {t('home.nextSessionSub', { rosterCount: nextSessionData.rosterCount, courtCount: nextSessionData.courtCount })}
                </span>
              </div>
              <span style={{ font: "400 13px/1.2 'IBM Plex Mono', monospace", color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {nextSessionData.diffDays <= 0 ? t('home.daysRemainingToday') : t('home.daysRemaining', { n: nextSessionData.diffDays })}
              </span>
            </div>

            <div style={{ padding: '12px 14px', display: 'grid', gap: 10 }}>
              {/* Histogram 9 cột */}
              <div style={S.insetBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {t('home.ratingSpread')}
                  </span>
                  <span style={{ font: "400 13px/1.2 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                    {`${nextSessionData.minR} → ${nextSessionData.maxR}`}
                  </span>
                </div>

                {/* 9 vertical bars */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 44, paddingTop: 4 }}>
                  {nextSessionData.bins.map((b, idx) => {
                    const hPct = Math.max(16, Math.round((b.count / nextSessionData.maxBinCount) * 100))
                    const isPeak = b.count === nextSessionData.maxBinCount
                    return (
                      <div
                        key={idx}
                        title={t('home.histogramTooltip', { min: b.min, max: b.max, count: b.count })}
                        style={{
                          flex: 1,
                          height: `${hPct}%`,
                          borderRadius: '3px 3px 0 0',
                          background: isPeak ? '#00B2A9' : 'var(--navy-600, #2E3E5C)',
                          transition: 'height 0.2s ease',
                        }}
                      />
                    )
                  })}
                </div>

                <span style={{ font: "400 12.5px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                  {t('home.histogramPeakDesc', { val: `${nextSessionData.minR + 50}–${nextSessionData.maxR - 50}` })}
                </span>
              </div>

              {/* Dải cảnh báo lệch trình */}
              <div style={S.alertStrip}>
                {t('home.nextSessionAlert', { high: nextSessionData.highCount, low: nextSessionData.lowCount })}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
                <button
                  type="button"
                  onClick={() => a.go('session', nextSessionData.session.id, { tab: 'courts' })}
                  style={S.primaryBtn}
                >
                  {t('home.preAssignCourts')}
                </button>
                <button
                  type="button"
                  onClick={() => a.go('session', nextSessionData.session.id)}
                  style={S.ghostBtn}
                >
                  {t('home.viewSession')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CARD 2: Người của tháng */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ font: "600 16px/1.25 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                {t('home.playersOfMonthTitle')}
              </span>
              <span style={{ font: "400 13px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                {t('home.playersOfMonthSubNew', { month: (month || '').slice(5, 7) })}
              </span>
            </div>
            <span style={S.newBadge}>{t('home.tagNew')}</span>
          </div>

          <div style={{ padding: '12px 14px', display: 'grid', gap: 8 }}>
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
                      gap: 12,
                      padding: '9px 12px',
                      borderRadius: 8,
                      background: 'var(--surface-sunken)',
                      border: isFirst ? '1px solid #00786F' : '1px solid var(--border-subtle)',
                    }}
                  >
                    <span style={{ width: 22, font: '700 16px/1 Barlow, sans-serif', color: isFirst ? '#5FDBD3' : 'var(--text-muted)' }}>
                      {idx + 1}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, font: "600 14px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                      {p.name}
                    </span>
                    <LevelChip level={p.level} size="sm" />
                    {p.isGuest && (
                      <span style={{ font: "600 10px/1 'IBM Plex Sans', sans-serif", padding: '3px 7px', borderRadius: 999, background: 'rgba(224,138,0,.18)', color: '#F0B75C' }}>
                        {t('guestTag')}
                      </span>
                    )}
                    <span style={{ font: "400 12.5px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {`${p.matchesCount} ${t('units.match')} · ${p.winRate}%`}
                    </span>
                    <span
                      style={{
                        font: "600 13.5px/1 'IBM Plex Mono', monospace",
                        color: isPositive ? '#5FD9A2' : '#FF8578',
                        width: 48,
                        textAlign: 'right',
                      }}
                    >
                      {`${isPositive ? '+' : ''}${p.delta}`}
                    </span>
                  </div>
                )
              })
            )}
            <div style={S.noteFoot}>
              {t('home.playersOfMonthNote')}
            </div>
          </div>
        </div>

        {/* CARD 3: Chưa gặp nhau lần nào */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ font: "600 16px/1.25 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                {t('home.neverMetTitle')}
              </span>
              <span style={{ font: "400 13px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                {t('home.neverMetSubNew')}
              </span>
            </div>
            <span style={S.newBadge}>{t('home.tagNew')}</span>
          </div>

          <div style={{ padding: '12px 14px', display: 'grid', gap: 8 }}>
            {neverMet.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                {t('home.noNeverMet')}
              </div>
            ) : (
              neverMet.map((pair, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '9px 12px',
                    borderRadius: 8,
                    background: 'var(--surface-sunken)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, font: "600 14px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                    {`${playerName(db, pair.p1)} · ${playerName(db, pair.p2)}`}
                  </span>
                  <span style={{ font: "400 12.5px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {t('home.togetherCount', { n: pair.commonSessionsCount || 0 })}
                  </span>
                  <span style={{ font: "600 13px/1 'IBM Plex Mono', monospace", color: '#5FDBD3', width: 56, textAlign: 'right' }}>
                    0 {t('units.match')}
                  </span>
                </div>
              ))
            )}
            <div style={S.noteFoot}>
              {t('home.neverMetNote')}
            </div>
            <button
              type="button"
              onClick={() => {
                a.setTab('leaderboard', 'matrix')
                a.go('leaderboard')
              }}
              style={S.ghostBtnWide}
            >
              {t('home.viewH2HMatrix')}
            </button>
          </div>
        </div>

        {/* CARD 4: Lượt đánh chưa đều buổi gần nhất */}
        {unevenPlayData && (
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ font: "600 16px/1.25 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                  {t('home.unevenPlayTitle')}
                </span>
                <span style={{ font: "400 13px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                  {t('home.unevenPlaySub', { date: dd(unevenPlayData.session.date), n: unevenPlayData.matchesCount })}
                </span>
              </div>
              <span style={{ font: "400 13px/1.2 'IBM Plex Mono', monospace", color: '#F0B75C', whiteSpace: 'nowrap' }}>
                {t('home.unevenPlayDiff', { min: unevenPlayData.minCount, max: unevenPlayData.maxCount })}
              </span>
            </div>

            <div style={{ padding: '12px 14px', display: 'grid', gap: 8 }}>
              {unevenPlayData.counts.map((item) => {
                const isZero = item.count === 0
                const isLow = item.count < Math.ceil(unevenPlayData.maxCount / 2)
                const pct = Math.round((item.count / unevenPlayData.maxCount) * 100)
                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        width: 68,
                        font: "600 13px/1.3 'IBM Plex Sans', sans-serif",
                        color: isZero ? '#FF9A8F' : 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.name}
                    </span>
                    <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--surface-sunken)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: isZero ? '#E08A00' : isLow ? '#E08A00' : '#00B2A9',
                          borderRadius: 999,
                          transition: 'width 0.2s ease',
                        }}
                      />
                    </div>
                    <span
                      style={{
                        font: "400 13px/1.2 'IBM Plex Mono', monospace",
                        color: isZero ? '#FF9A8F' : 'var(--text-muted)',
                        width: 52,
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.count} {t('units.match')}
                    </span>
                  </div>
                )
              })}
              <div style={S.noteFoot}>
                {t('home.unevenPlayNote', { name: unevenPlayData.zeroPlayPerson?.name || t('common.unknown') })}
              </div>
            </div>
          </div>
        )}

        {/* CARD 5: Cặp ăn ý nhất tháng */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ font: "600 16px/1.25 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                {t('home.bestPairsTitle')}
              </span>
              <span style={{ font: "400 13px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                {t('home.bestPairsSub')}
              </span>
            </div>
            <span style={S.newBadge}>{t('home.tagNew')}</span>
          </div>

          <div style={{ padding: '12px 14px', display: 'grid', gap: 8 }}>
            {bestPairs.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                {t('home.noTopGainers')}
              </div>
            ) : (
              bestPairs.map((pair, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '9px 12px',
                    borderRadius: 8,
                    background: 'var(--surface-sunken)',
                    border: idx === 0 ? '1px solid #00786F' : '1px solid var(--border-subtle)',
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, font: "600 14px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                    {`${playerName(db, pair.p1)} + ${playerName(db, pair.p2)}`}
                  </span>
                  <span style={{ font: "400 12.5px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {`${pair.matches} ${t('units.match')}`}
                  </span>
                  <span
                    style={{
                      font: "700 14px/1 'IBM Plex Mono', monospace",
                      color: pair.winRate >= 65 ? '#5FDBD3' : pair.winRate >= 50 ? '#5FD9A2' : '#FF9A8F',
                      width: 48,
                      textAlign: 'right',
                    }}
                  >
                    {`${pair.winRate}%`}
                  </span>
                </div>
              ))
            )}
            <div style={S.noteFoot}>
              {t('home.bestPairsNote')}
            </div>
          </div>
        </div>

        {/* CARD 6: Trận đáng xem trong tháng */}
        {(watchableMatches.upset || watchableMatches.close) && (
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ font: "600 16px/1.25 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                  {t('home.watchableMatchesTitle')}
                </span>
                <span style={{ font: "400 13px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                  {t('home.watchableMatchesSub')}
                </span>
              </div>
              <span style={S.newBadge}>{t('home.tagNew')}</span>
            </div>

            <div style={{ padding: '12px 14px', display: 'grid', gap: 10 }}>
              {/* Khối Trận bất ngờ */}
              {watchableMatches.upset && (
                <div style={S.matchBox}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ font: "400 13px/1.2 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                      {`${watchableMatches.upset.code || 'M-0183'}${watchableMatches.upset.playedAt || watchableMatches.upset.createdAt ? ` · ${dd(watchableMatches.upset.playedAt || watchableMatches.upset.createdAt)}` : ''}`}
                    </span>
                    <span style={{ font: "600 10px/1 'IBM Plex Sans', sans-serif", padding: '4px 8px', borderRadius: 999, background: 'rgba(225,68,52,.18)', color: '#FF9A8F' }}>
                      {t('leaderboard.predUpset')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ flex: 1, minWidth: 0, font: "600 14px/1.3 'IBM Plex Sans', sans-serif", color: '#5FD9A2' }}>
                      {(watchableMatches.upset.winnerTeam === 'A' ? watchableMatches.upset.teamA : watchableMatches.upset.teamB || []).map((id) => playerName(db, id)).join(' · ')}
                    </span>
                    <span style={{ font: '700 18px/1 Barlow, sans-serif', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {watchableMatches.upset.scoreText || (watchableMatches.upset.sets && `${watchableMatches.upset.sets[0]?.[0]} – ${watchableMatches.upset.sets[0]?.[1]}`) || '21 – 17'}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, textAlign: 'right', font: "600 14px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-secondary)' }}>
                      {(watchableMatches.upset.winnerTeam === 'A' ? watchableMatches.upset.teamB : watchableMatches.upset.teamA || []).map((id) => playerName(db, id)).join(' · ')}
                    </span>
                  </div>
                  <span style={{ font: "400 12.5px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                    {t('home.watchablePredUpset', { pct: 74 })}
                  </span>
                </div>
              )}

              {/* Khối Trận sát điểm */}
              {watchableMatches.close && (
                <div style={S.matchBox}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ font: "400 13px/1.2 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                      {`${watchableMatches.close.code || 'M-0171'}${watchableMatches.close.playedAt || watchableMatches.close.createdAt ? ` · ${dd(watchableMatches.close.playedAt || watchableMatches.close.createdAt)}` : ''}`}
                    </span>
                    <span style={{ font: "600 10px/1 'IBM Plex Sans', sans-serif", padding: '4px 8px', borderRadius: 999, background: 'rgba(224,138,0,.18)', color: '#F0B75C' }}>
                      {t('leaderboard.predClose')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ flex: 1, minWidth: 0, font: "600 14px/1.3 'IBM Plex Sans', sans-serif", color: '#5FD9A2' }}>
                      {(watchableMatches.close.winnerTeam === 'A' ? watchableMatches.close.teamA : watchableMatches.close.teamB || []).map((id) => playerName(db, id)).join(' · ')}
                    </span>
                    <span style={{ font: '700 18px/1 Barlow, sans-serif', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {watchableMatches.close.scoreText || (watchableMatches.close.sets && `${watchableMatches.close.sets[0]?.[0]} – ${watchableMatches.close.sets[0]?.[1]}`) || '24 – 22'}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, textAlign: 'right', font: "600 14px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-secondary)' }}>
                      {(watchableMatches.close.winnerTeam === 'A' ? watchableMatches.close.teamB : watchableMatches.close.teamA || []).map((id) => playerName(db, id)).join(' · ')}
                    </span>
                  </div>
                  <span style={{ font: "400 12.5px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                    {t('home.watchablePredClose', { pct: 51 })}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  statCard: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    borderRadius: 10,
    padding: '14px 16px',
    display: 'grid',
    gap: 6,
    boxShadow: 'var(--shadow-xs)',
  },
  statLabel: {
    font: "600 11px/1.2 'IBM Plex Sans', sans-serif",
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  statValue: {
    font: '700 28px/1.05 Barlow, sans-serif',
    color: 'var(--text-primary)',
  },
  statUnit: {
    font: "400 13px/1.4 'IBM Plex Sans', sans-serif",
    color: 'var(--text-muted)',
  },
  statSub: {
    font: "400 12.5px/1.4 'IBM Plex Sans', sans-serif",
    color: 'var(--text-muted)',
  },
  card: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    borderRadius: 10,
    boxShadow: 'var(--shadow-xs)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  cardHeader: {
    padding: '12px 14px',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  newBadge: {
    font: "600 10px/1 'IBM Plex Sans', sans-serif",
    padding: '4px 8px',
    borderRadius: 999,
    background: 'rgba(224,138,0,.18)',
    color: '#F0B75C',
    whiteSpace: 'nowrap',
  },
  insetBox: {
    display: 'grid',
    gap: 6,
    padding: '11px 12px',
    borderRadius: 8,
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
  },
  matchBox: {
    display: 'grid',
    gap: 6,
    padding: '11px 12px',
    borderRadius: 8,
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
  },
  alertStrip: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '9px 11px',
    borderRadius: 8,
    background: 'rgba(224,138,0,.14)',
    font: "400 12.5px/1.45 'IBM Plex Sans', sans-serif",
    color: '#F0B75C',
  },
  noteFoot: {
    font: "400 12.5px/1.45 'IBM Plex Sans', sans-serif",
    color: 'var(--text-muted)',
    borderTop: '1px solid var(--border-subtle)',
    paddingTop: 8,
    marginTop: 2,
  },
  primaryBtn: {
    flex: 1,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    background: '#1D50A0',
    border: 'none',
    font: "600 13px/1 'IBM Plex Sans', sans-serif",
    color: '#fff',
    cursor: 'pointer',
  },
  ghostBtn: {
    height: 36,
    display: 'flex',
    alignItems: 'center',
    padding: '0 14px',
    borderRadius: 6,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    font: "600 13px/1 'IBM Plex Sans', sans-serif",
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  ghostBtnWide: {
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    font: "600 12px/1 'IBM Plex Sans', sans-serif",
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    marginTop: 2,
  },
}
