import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LevelChip } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { addMonth, dd, isoOf, todayISO } from '#utils/dates.js'
import { pathOf } from '#routes'

import { myMember, playerName, isPresent, shortName } from '#lib/money.js'
import { getPlayerRating, matchCodeOf } from '#lib/rating.js'
import { matchPrediction, neverMetPairs, neverMetWithSessionCount } from '#lib/matchSearch.js'
import { pickNextSession } from '#lib/homePersonal.js'
import { avgCourtBalance, closeRate, matchMonthOf, monthRivals, neverMetForViewer, pickWatchable, ratingSpread } from '#lib/homeMatch.js'
import UpcomingSessionCard from '#components/home/personal/UpcomingSessionCard.jsx'
import cfg from '#config/app.js'
import { t } from '#i18n'

/**
 * `upcoming`: props thẻ Buổi tới của chính người xem (MyStats dựng). Tab này vẽ thẻ đó và gộp vào phần tóm tắt
 * buổi của CLB (số người, sân, trải rating, cảnh báo lệch trình) — một thẻ thay cho hai.
 */
export default function HomeMatchTab({ upcoming = null }) {
  const { db } = useApp()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const isMobile = useMobile(768)
  const myId = myMember(db)?.id || null
  const month = db.month || todayISO().slice(0, 7)
  const activeMembers = useMemo(() => (db.members || []).filter((m) => m.active !== false), [db.members])
  const matches = useMemo(() => db.matches || [], [db.matches])
  const sessions = useMemo(() => db.sessions || [], [db.sessions])

  // Trận trong tháng (theo giờ địa phương)
  const monthMatches = useMemo(() => matches.filter((m) => matchMonthOf(m) === month), [matches, month])

  const monthSessionsList = useMemo(() => {
    return sessions.filter((s) => (s.date || '').slice(0, 7) === month)
  }, [sessions, month])

  // Rating hiện tại của mọi người (thành viên + khách) — dùng cho điểm chia sân và dự đoán trận
  const ratingsMap = useMemo(() => {
    const map = {}
    ;[...(db.members || []), ...(db.guests || [])].forEach((p) => {
      map[p.id] = getPlayerRating(db.playerRatings, p.id, p, db.levels).rating
    })
    return map
  }, [db.members, db.guests, db.playerRatings, db.levels])

  // 1. Bốn chỉ số StatCard — số thật, không có giá trị dự phòng bịa
  const stats = useMemo(() => {
    const totalMonthMatches = monthMatches.length
    const sessCount = monthSessionsList.length
    const balance = avgCourtBalance(monthMatches, ratingsMap)

    // Số người rating chưa chắc (< 10 trận)
    let uncertainCount = 0
    activeMembers.forEach((m) => {
      const pr = getPlayerRating(db.playerRatings, m.id, m, db.levels)
      if ((pr.gamesCount || 0) < 10) uncertainCount++
    })

    return {
      totalMonthMatches,
      sessCount,
      avgPerSess: sessCount ? Math.round(totalMonthMatches / sessCount) : 0,
      closePct: closeRate(monthMatches),
      prevClosePct: closeRate(matches.filter((m) => matchMonthOf(m) === addMonth(month, -1))),
      balanceScore: balance.score,
      balanceSessions: balance.sessionCount,
      uncertainCount,
    }
  }, [monthMatches, monthSessionsList, matches, month, ratingsMap, activeMembers, db.playerRatings, db.levels])

  // 2. Buổi tiếp theo của CLB: người đã nhận, sân, phân bố rating (cùng luật chọn buổi với thẻ Buổi tới)
  const nextSessionData = useMemo(() => {
    const next = pickNextSession(sessions, db.today || todayISO())
    if (!next) return null

    const group = (db.groups || []).find((g) => g.id === next.groupId)
    const fixedIds = group?.memberIds || []
    const attendMap = db.attendance?.[next.id] || {}
    const goingIds = Object.keys(attendMap).filter((id) => isPresent(attendMap[id]))
    const allRosterIds = Array.from(new Set([...fixedIds, ...goingIds]))
    const ratings = allRosterIds.map((id) => {
      const mem = (db.members || []).find((m) => m.id === id)
      return getPlayerRating(db.playerRatings, id, mem, db.levels).rating
    })

    return {
      session: next,
      rosterCount: allRosterIds.length,
      courtCount: (next.courts || []).filter((c) => !c.sold).length,
      spread: ratingSpread(ratings),
    }
  }, [sessions, db.today, db.groups, db.attendance, db.members, db.playerRatings, db.levels])
  const [spreadOpen, setSpreadOpen] = useState(false)

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

  // 4. Chưa gặp nhau lần nào (kèm số buổi cùng đi): người xem chưa gặp ai lên trước, thiếu mới bù cặp khác
  const neverMet = useMemo(() => {
    const scored = neverMetWithSessionCount(neverMetPairs(activeMembers, matches), { sessions, attendance: db.attendance || {}, matches }, Infinity)
    return neverMetForViewer(scored, myId, cfg.ui.homeCardRows)
  }, [activeMembers, matches, sessions, db.attendance, myId])

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
      .filter((p) => p.matches >= cfg.ui.homeMinPairMatches)
      .map((p) => ({
        ...p,
        winRate: Math.round((p.wins / p.matches) * 100),
      }))
      .sort((a1, b1) => b1.winRate - a1.winRate || b1.matches - a1.matches)
      .slice(0, cfg.ui.homeCardRows)
  }, [monthMatches])

  // 6b. Kình địch nhất tháng: hai người đứng hai bên lưới với nhau nhiều nhất (luật ở #lib/homeMatch.js)
  const rivals = useMemo(
    () => monthRivals(monthMatches, { minMeetings: cfg.ui.homeMinPairMatches, limit: cfg.ui.homeCardRows }),
    [monthMatches],
  )

  // 7. Trận đáng xem trong tháng: trận có video — kèo dưới thắng + trận sát / 3 set (luật ở #lib/homeMatch.js)
  const watchableMatches = useMemo(() => pickWatchable(monthMatches), [monthMatches])
  const ratingOf = (id) => ratingsMap[id] ?? getPlayerRating(db.playerRatings, id, null, db.levels).rating

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
            <span style={{ ...S.statValue, color: '#5FDBD3' }}>{stats.closePct ?? '—'}</span>
            {stats.closePct != null && <span style={S.statUnit}>%</span>}
          </div>
          <span style={S.statSub}>
            {stats.prevClosePct != null ? t('home.tightMatchesSub', { n: cfg.match?.closeMatchMaxDiff ?? 3, pct: stats.prevClosePct }) : t('home.tightMatchesSubNoPrev', { n: cfg.match?.closeMatchMaxDiff ?? 3 })}
          </span>
        </div>

        {/* Card 3 */}
        <div style={S.statCard}>
          <span style={S.statLabel}>{t('home.courtScore')}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ ...S.statValue, color: '#5FD9A2' }}>{stats.balanceScore ?? '—'}</span>
            {stats.balanceScore != null && <span style={S.statUnit}>/100</span>}
          </div>
          <span style={S.statSub}>
            {t('home.courtScoreSub', { n: stats.balanceSessions })}
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

        {/* CARD 1: Buổi tới — thẻ của tôi (giờ, sân, kèo) + tóm tắt buổi của CLB gộp làm một */}
        {upcoming && (
          <UpcomingSessionCard
            {...upcoming}
            club={nextSessionData && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ font: "400 13px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-secondary)' }}>
                    {t('home.nextSessionSub', { rosterCount: nextSessionData.rosterCount, courtCount: nextSessionData.courtCount })}
                  </span>
                  {nextSessionData.spread && (
                    <span style={{ font: "400 13px/1.2 'IBM Plex Mono', monospace", color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {`${nextSessionData.spread.minR} → ${nextSessionData.spread.maxR}`}
                    </span>
                  )}
                </div>

                {/* Lệch trình thật (mạnh nhất – yếu nhất vượt ngưỡng) mới cảnh báo */}
                {nextSessionData.spread?.imbalanced && (
                  <div style={S.alertStrip}>
                    {t('home.nextSessionAlert', { gap: nextSessionData.spread.gap })}
                  </div>
                )}

                {/* Phân bố rating 9 cột — mặc định thu gọn */}
                {nextSessionData.spread && (
                  <div style={S.insetBox}>
                    <button
                      type="button"
                      onClick={() => setSpreadOpen((v) => !v)}
                      aria-expanded={spreadOpen}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, width: '100%', minHeight: isMobile ? 44 : 32, padding: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                    >
                      <span style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {t('home.ratingSpread')}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: "600 12px/1 'IBM Plex Sans', sans-serif", color: 'var(--text-link)' }}>
                        {spreadOpen ? t('scoreModal.collapseChanges') : t('scoreModal.expandChanges')}
                        <span style={{ fontSize: 13, transform: spreadOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>▾</span>
                      </span>
                    </button>
                    {spreadOpen && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 44, paddingTop: 4 }}>
                          {nextSessionData.spread.bins.map((b, idx) => (
                            <div
                              key={idx}
                              title={t('home.histogramTooltip', { min: b.min, max: b.max, count: b.count })}
                              style={{
                                flex: 1,
                                height: `${Math.max(16, Math.round((b.count / nextSessionData.spread.maxBinCount) * 100))}%`,
                                borderRadius: '3px 3px 0 0',
                                background: b === nextSessionData.spread.peak ? '#00B2A9' : 'var(--navy-600, #2E3E5C)',
                                transition: 'height 0.2s ease',
                              }}
                            />
                          ))}
                        </div>
                        <span style={{ font: "400 12.5px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                          {t('home.histogramPeakDesc', { val: `${nextSessionData.spread.peak.min}–${nextSessionData.spread.peak.max}` })}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          />
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
                    <span style={{ width: 22, font: '700 16px/1 Barlow, sans-serif', color: isFirst ? (isDark ? '#5FDBD3' : 'var(--teal-700, #00786F)') : 'var(--text-muted)' }}>
                      {idx + 1}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, font: "600 14px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                      <span title={p.name}>{shortName(p.name)}</span>
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
                        color: isPositive ? (isDark ? '#5FD9A2' : '#0D5E3A') : (isDark ? '#FF8578' : 'var(--text-danger, #C42B1C)'),
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
                {neverMet.some((p) => p.isMine) ? t('home.neverMetSubMine') : t('home.neverMetSubNew')}
              </span>
            </div>
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
                    {pair.isMine
                      ? `${t('home.personal.you')} · ${playerName(db, pair.p1 === myId ? pair.p2 : pair.p1)}`
                      : `${playerName(db, pair.p1)} · ${playerName(db, pair.p2)}`}
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
              onClick={() => navigate(`${pathOf('matches')}?tab=matrix`)}
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

            <div style={{ minWidth: 0, padding: '12px 14px', display: 'grid', gap: 8 }}>
              {unevenPlayData.counts.map((item) => {
                const isZero = item.count === 0
                const isLow = item.count < Math.ceil(unevenPlayData.maxCount / 2)
                const pct = Math.round((item.count / unevenPlayData.maxCount) * 100)
                return (
                  <div key={item.id} style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        width: 68,
                        font: "600 13px/1.3 'IBM Plex Sans', sans-serif",
                        color: isZero ? '#FF9A8F' : 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        minWidth: 0, overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      <span title={item.name}>{item.name}</span>
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
                {t('home.bestPairsSub', { n: cfg.ui.homeMinPairMatches })}
              </span>
            </div>
          </div>

          <div style={{ padding: '12px 14px', display: 'grid', gap: 8 }}>
            {bestPairs.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                {t('home.noTopGainers')}
              </div>
            ) : (
              bestPairs.map((pair, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => navigate(`${pathOf('leaderboard')}?tab=pairs`)}
                  style={{ ...S.rowBtn, border: idx === 0 ? '1px solid #00786F' : S.rowBtn.border }}
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
                      color: pair.winRate >= 65 ? (isDark ? '#5FDBD3' : 'var(--teal-700, #00786F)') : pair.winRate >= 50 ? (isDark ? '#5FD9A2' : '#0D5E3A') : (isDark ? '#FF9A8F' : 'var(--text-danger)'),
                      width: 48,
                      textAlign: 'right',
                    }}
                  >
                    {`${pair.winRate}%`}
                  </span>
                </button>
              ))
            )}
            <div style={S.noteFoot}>
              {t('home.bestPairsNote')}
            </div>
          </div>
        </div>

        {/* CARD 5b: Kình địch nhất tháng — bấm một cặp để xem lịch sử đối đầu của hai người */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ font: "600 16px/1.25 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                {t('home.rivalsTitle')}
              </span>
              <span style={{ font: "400 13px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                {t('home.rivalsSub', { n: cfg.ui.homeMinPairMatches })}
              </span>
            </div>
          </div>

          <div style={{ padding: '12px 14px', display: 'grid', gap: 8 }}>
            {rivals.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                {t('home.noRivals')}
              </div>
            ) : (
              rivals.map((r, idx) => (
                <button
                  type="button"
                  key={`${r.p1}|${r.p2}`}
                  onClick={() => navigate(`${pathOf('matches')}?tab=history&playerA=${r.p1}&playerB=${r.p2}`)}
                  style={{ ...S.rowBtn, border: idx === 0 ? '1px solid #00786F' : S.rowBtn.border }}
                >
                  <span style={{ flex: 1, minWidth: 0, font: "600 14px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                    {`${playerName(db, r.p1)} vs ${playerName(db, r.p2)}`}
                  </span>
                  <span style={{ font: "400 12.5px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {`${r.total} ${t('units.match')}`}
                  </span>
                  <span style={{ font: "700 14px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)', width: 48, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {`${r.w1}–${r.w2}`}
                  </span>
                </button>
              ))
            )}
            <div style={S.noteFoot}>
              {t('home.rivalsNote')}
            </div>
          </div>
        </div>

        {/* CARD 6: Trận đáng xem trong tháng */}
        {watchableMatches.length > 0 && (
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
            </div>

            <div style={{ padding: '12px 14px', display: 'grid', gap: 10 }}>
              {watchableMatches.map(({ match: m, type }) => {
                const isUpset = type === 'upset'
                const pred = matchPrediction(m, ratingOf)
                const playedDate = m.playedAt || m.createdAt || (m.at ? isoOf(new Date(m.at)) : null)
                const winnerIsA = m.winnerTeam === 'A'
                const winTeam = winnerIsA ? m.teamA : m.teamB
                const loseTeam = winnerIsA ? m.teamB : m.teamA
                const winColor = isDark ? '#5FD9A2' : '#0D5E3A'
                const tagBg = isUpset
                  ? (isDark ? 'rgba(225,68,52,.18)' : 'var(--surface-danger-soft, #FCE4E1)')
                  : (isDark ? 'rgba(224,138,0,.18)' : 'var(--surface-warning-soft, #FDF0D9)')
                const tagColor = isUpset
                  ? (isDark ? '#FF9A8F' : 'var(--text-danger, #C42B1C)')
                  : (isDark ? '#F0B75C' : '#B26A00')

                const scoreDisplay = m.scoreText || (m.sets && m.sets.map(([sa, sb]) => `${sa}–${sb}`).join(', ')) || ''

                return (
                  <div
                    key={m.id}
                    onClick={() => navigate(`${pathOf('matches')}?tab=search&matchId=${m.id}`)}
                    style={{
                      ...S.matchBox,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-strong-color)'
                      e.currentTarget.style.boxShadow = 'var(--shadow-xs)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ font: "500 13px/1.2 'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>
                        {`${matchCodeOf(db, m)}${playedDate ? ` · ${dd(playedDate)}` : ''}`}
                      </span>
                      {type !== 'recent' && (
                        <span style={{ font: "600 10.5px/1 'IBM Plex Sans', sans-serif", padding: '3px 8px', borderRadius: 999, background: tagBg, color: tagColor }}>
                          {isUpset ? t('leaderboard.predUpset') : t('leaderboard.predClose')}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        title={(winTeam || []).map((id) => playerName(db, id)).join(' · ')}
                        style={{ flex: 1, minWidth: 0, font: "600 14px/1.3 'IBM Plex Sans', sans-serif", color: winColor, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflowWrap: 'anywhere' }}
                      >
                        {(winTeam || []).map((id) => playerName(db, id)).join(' · ')}
                      </span>
                      <span style={{ font: '700 18px/1 Barlow, sans-serif', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {scoreDisplay}
                      </span>
                      <span
                        title={(loseTeam || []).map((id) => playerName(db, id)).join(' · ')}
                        style={{ flex: 1, minWidth: 0, textAlign: 'right', font: "500 14px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-secondary)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflowWrap: 'anywhere' }}
                      >
                        {(loseTeam || []).map((id) => playerName(db, id)).join(' · ')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ font: "400 12.5px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-secondary)' }}>
                        {isUpset
                          ? t('home.watchablePredUpset', { pct: 100 - pred.predPct })
                          : type === 'close'
                            ? t('home.watchablePredClose', { pct: pred.predPct, other: 100 - pred.predPct })
                            : t('matchVideo.predFormat', { pct: pred.predPct, status: pred.isCorrect ? t('matchVideo.predCorrect') : t('matchVideo.predWrong') })}
                      </span>
                      <span style={{ font: "500 12px/1 'IBM Plex Sans', sans-serif", color: 'var(--text-link)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {t('home.viewMatchHistory')} →
                      </span>
                    </div>
                  </div>
                )
              })}
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
  // Dòng danh sách bấm được (cặp bài trùng, kình địch) — cùng dáng dòng thường, thêm reset của <button>
  rowBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '9px 12px',
    borderRadius: 8,
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    font: 'inherit',
    color: 'inherit',
    textAlign: 'left',
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
