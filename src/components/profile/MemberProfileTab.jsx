import { useState, useMemo } from 'react'
import { Icon, Select, StatCard } from '#ds'
import { LevelChip } from '#ui'
import { playerName } from '#lib/money.js'
import { getPlayerRating, rankTierOf, applyInactivityDecay, lastMatchAtOf, getPlayerFormatRatings, getPlayerPartnersAndMatchups, DEFAULT_RATING } from '#lib/rating.js'
import { getMemberBadge, RANK_THEMES } from '#data/rankThemes.js'
import { calculateMemberXp, getMemberXpLedger, getMemberAchievements } from '#lib/xp.js'
import { getSeasonBountyPlayer } from '#lib/season.js'
import RatingLineChart from '#components/challenge/RatingLineChart.jsx'
import PairDetailModal from '#components/leaderboard/PairDetailModal.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'

function alphaColor(color, alphaHex, pct) {
  if (!color) return 'transparent'
  const isVar = typeof color === 'string' && color.startsWith('var(')
  if (!isVar) return `${color}${alphaHex}`
  const p = pct ?? Math.min(100, Math.max(0, Math.round((parseInt(alphaHex, 16) / 255) * 100)))
  return `color-mix(in srgb, ${color} ${p}%, transparent)`
}

export default function MemberProfileTab({
  member,
  allMembers,
  onSelectMember,
  db,
  rankTheme,
  onSelectTheme,
  isMobile: propIsMobile,
  onChallenge,
}) {
  const isMobileHook = useMobile()
  const isMobile = propIsMobile !== undefined ? Boolean(propIsMobile) : isMobileHook
  const [subTab, setSubTab] = useState('overview') // 'overview' | 'ratings' | 'h2h' | 'xp'
  const [inspectingPair, setInspectingPair] = useState(null)

  const matches = useMemo(() => db.matches || [], [db.matches])
  const mid = member?.id

  const membersMap = useMemo(() => {
    const map = {}
    ;(db?.members || []).forEach((m) => { if (m?.id) map[m.id] = m })
    ;(db?.guests || []).forEach((g) => { if (g?.id) map[g.id] = g })
    ;(db?.sessionGuests || []).forEach((sg) => {
      if (sg.guestId) {
        const g = (db?.guests || []).find((x) => x.id === sg.guestId)
        if (g) map[sg.id] = g
      }
      if (sg.memberId) {
        const m = (db?.members || []).find((x) => x.id === sg.memberId)
        if (m) map[sg.id] = m
      }
      if (!map[sg.id] && sg.id) {
        map[sg.id] = { id: sg.id, name: sg.name || playerName(db, sg.id) || sg.id }
      }
    })
    ;(allMembers || []).forEach((m) => { if (m?.id) map[m.id] = m })
    return map
  }, [allMembers, db?.members, db?.guests, db?.sessionGuests, db])

  const confTierOf = (c) => (typeof c === 'string' ? c : c?.tier || 'R1')

  const formatRatings = useMemo(() => {
    if (!mid) return null
    return getPlayerFormatRatings(matches, mid, db.playerRatings || {}, membersMap)
  }, [matches, mid, db.playerRatings, membersMap])

  const partnersAndMatchups = useMemo(() => {
    if (!mid) return null
    return getPlayerPartnersAndMatchups(matches, mid, membersMap, db.playerRatings || {})
  }, [matches, mid, membersMap, db.playerRatings])

  // 1. Lọc và chuẩn hóa toàn bộ trận của VĐV này
  const memberMatches = useMemo(() => {
    if (!mid) return []
    const list = []
    matches.forEach((m) => {
      const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
      const teamB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])
      const inA = teamA.includes(mid)
      const inB = teamB.includes(mid)
      if (inA || inB) {
        const won = (inA && m.winnerTeam === 'A') || (inB && m.winnerTeam === 'B')
        const teammates = (inA ? teamA : teamB).filter((id) => id !== mid)
        const opponents = inA ? teamB : teamA
        const sets = m.sets || []
        const isThreeSets = sets.length >= 3

        let myPoints = 0
        let oppPoints = 0
        let isTight = false

        sets.forEach(([sa, sb]) => {
          if (sa != null && sb != null) {
            const myScore = inA ? sa : sb
            const oppScore = inA ? sb : sa
            myPoints += myScore
            oppPoints += oppScore
            if (Math.abs(sa - sb) <= 3) isTight = true
          }
        })

        list.push({
          ...m,
          won,
          teammates,
          opponents,
          sets,
          isThreeSets,
          myPoints,
          oppPoints,
          isTight,
          setCount: sets.length,
          at: m.at || (m.createdAt ? Date.parse(m.createdAt) : 0),
        })
      }
    })

    return list.sort((a, b) => (b.at || 0) - (a.at || 0))
  }, [matches, mid])

  // 2. Thống kê tổng quan & Phong độ chuỗi thắng
  const stats = useMemo(() => {
    const totalMatches = memberMatches.length
    const wins = memberMatches.filter((m) => m.won).length
    const losses = totalMatches - wins
    const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0

    // Chuỗi thắng hiện tại và tốt nhất
    let currentStreak = 0
    let streakBroken = false
    let maxStreak = 0
    let tempStreak = 0

    // Duyệt từ cũ đến mới để tìm max streak
    const chronological = [...memberMatches].reverse()
    chronological.forEach((m) => {
      if (m.won) {
        tempStreak++
        if (tempStreak > maxStreak) maxStreak = tempStreak
      } else {
        tempStreak = 0
      }
    })

    // Duyệt từ mới đến cũ để tìm current streak
    memberMatches.forEach((m) => {
      if (!streakBroken) {
        if (m.won) currentStreak++
        else streakBroken = true
      }
    })

    // 10 trận gần nhất
    const last10 = memberMatches.slice(0, 10)
    const wins10 = last10.filter((m) => m.won).length
    const losses10 = last10.length - wins10

    // Chất lượng trận
    let totalSets = 0
    let totalMyPts = 0
    let totalOppPts = 0
    let tightCount = 0
    let tightWins = 0
    let threeSetCount = 0

    memberMatches.forEach((m) => {
      totalSets += m.setCount
      totalMyPts += m.myPoints
      totalOppPts += m.oppPoints
      if (m.isThreeSets) threeSetCount++
      if (m.isTight) {
        tightCount++
        if (m.won) tightWins++
      }
    })

    const avgMyPts = totalSets > 0 ? (totalMyPts / totalSets).toFixed(1) : '21.0'
    const avgOppPts = totalSets > 0 ? (totalOppPts / totalSets).toFixed(1) : '18.0'
    const tightWinRate = tightCount > 0 ? Math.round((tightWins / tightCount) * 100) : 50

    return {
      totalMatches,
      wins,
      losses,
      winRate,
      currentStreak,
      maxStreak,
      last10,
      wins10,
      losses10,
      avgMyPts,
      avgOppPts,
      tightWinRate,
      threeSetCount,
    }
  }, [memberMatches])

  // 3. Phân tích đối đầu (Screen 05)
  const h2hData = useMemo(() => {
    if (!mid) return { mostMet: null, toughest: [], bestPartners: [], pairVsPair: null }

    const oppMap = {}
    const partnerMap = {}

    memberMatches.forEach((m) => {
      m.opponents.forEach((opId) => {
        if (!oppMap[opId]) oppMap[opId] = { id: opId, total: 0, wins: 0 }
        oppMap[opId].total++
        if (m.won) oppMap[opId].wins++
      })

      m.teammates.forEach((ptId) => {
        if (!partnerMap[ptId]) partnerMap[ptId] = { id: ptId, total: 0, wins: 0 }
        partnerMap[ptId].total++
        if (m.won) partnerMap[ptId].wins++
      })
    })

    // Đối thủ gặp nhiều nhất
    const oppList = Object.values(oppMap).map((o) => ({
      ...o,
      winRate: Math.round((o.wins / o.total) * 100),
      isGuest: !(db.members || []).some((mem) => mem.id === o.id),
    }))

    oppList.sort((a, b) => b.total - a.total)
    const mostMet = oppList[0] || null

    // Đối thủ khó nhất (gặp >= 3 trận, winrate thấp nhất)
    const toughest = [...oppList]
      .filter((o) => o.total >= 3)
      .sort((a, b) => a.winRate - b.winRate || b.total - a.total)
      .slice(0, 3)

    // Partner hợp nhất (cùng team >= 3 trận, winrate cao nhất)
    const partnerList = Object.values(partnerMap).map((p) => ({
      ...p,
      winRate: Math.round((p.wins / p.total) * 100),
      isGuest: !(db.members || []).some((mem) => mem.id === p.id),
    }))

    const bestPartners = [...partnerList]
      .filter((p) => p.total >= 3)
      .sort((a, b) => b.winRate - a.winRate || b.total - a.total)
      .slice(0, 3)

    return {
      mostMet,
      toughest,
      bestPartners,
    }
  }, [memberMatches, mid, db.members])

  // 4. XP & Thành tựu (Screen 07)
  const xpData = useMemo(() => calculateMemberXp(mid, db), [mid, db])
  const xpLedger = useMemo(() => getMemberXpLedger(mid, db), [mid, db])
  const achievements = useMemo(() => getMemberAchievements(mid, db), [mid, db])
  const seasonBounty = useMemo(() => getSeasonBountyPlayer(db), [db])

  // 5. Rating & Tier & Inactivity
  const pr = getPlayerRating(db.playerRatings, mid, member, db.levels)
  const lastMatchIso = lastMatchAtOf(matches, mid)
  const decayInfo = applyInactivityDecay(pr.rating, lastMatchIso)
  const tier = rankTierOf(decayInfo.rating, rankTheme)
  const badge = getMemberBadge(mid)

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* HEADER HỒ SƠ VĐV */}
      <div style={S.card}>
        <div style={{ padding: 18, background: 'var(--surface-sunken)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                background: '#1A2437',
                border: '1px solid #2E3E5C',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                font: '700 20px/1 Barlow, sans-serif',
                color: '#A8B7CB',
                flexShrink: 0,
              }}>
                {(member.name || '').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <div style={{ font: '700 22px/1.2 Barlow, sans-serif', color: 'var(--text-primary)' }}>
                  {member.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <LevelChip level={member.level} levels={db.levels} />
                  <span style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: '#8494AA' }}>
                    {member.gender} · {member.group || 'CLB'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
              <Select
                value={member.id}
                options={allMembers.map((m) => ({ value: m.id, label: m.name }))}
                onChange={(e) => onSelectMember(e.target.value)}
                style={{ width: isMobile ? '100%' : 160 }}
              />
              <button
                type="button"
                onClick={() => onChallenge && onChallenge(member.id)}
                style={S.challengeBtn}
              >
                <Icon name="target" size={14} />
                <span>{t('leaderboard.challengePrompt')}</span>
              </button>
            </div>
          </div>

          {/* 3 THẺ STATCARD MINI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div style={S.statCardMini}>
              <span style={S.statMiniLabel}>Rating</span>
              <span style={{ font: '700 26px/1.05 Barlow, sans-serif', color: 'var(--text-primary)' }}>
                {decayInfo.rating}
              </span>
              <span style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: '#5FD9A2' }}>
                {pr.deltaToday ? `${pr.deltaToday > 0 ? '+' : ''}${pr.deltaToday}` : `+${stats.currentStreak * 2}`}
              </span>
            </div>

            <div style={S.statCardMini}>
              <span style={S.statMiniLabel}>{t('leaderboard.winRate')}</span>
              <span style={{ font: '700 26px/1.05 Barlow, sans-serif', color: 'var(--text-primary)' }}>
                {stats.winRate}%
              </span>
              <span style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: '#8494AA' }}>
                {stats.wins}/{stats.totalMatches}
              </span>
            </div>

            <div style={S.statCardMini}>
              <span style={S.statMiniLabel}>{t('leaderboard.recentForm')}</span>
              <span style={{ font: '700 26px/1.05 Barlow, sans-serif', color: '#5FDBD3' }}>
                {stats.currentStreak}W
              </span>
              <span style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: '#8494AA' }}>
                {stats.maxStreak}W max
              </span>
            </div>
          </div>
        </div>

        {/* 4 SUB-TABS TRONG PROFILE */}
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setSubTab('overview')}
            style={{
              ...S.subTabBtn,
              ...(subTab === 'overview' ? S.subTabBtnActive : {}),
            }}
          >
            {t('home.tabs.overview')}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('h2h')}
            style={{
              ...S.subTabBtn,
              ...(subTab === 'h2h' ? S.subTabBtnActive : {}),
            }}
          >
            {t('leaderboard.tabH2H')}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('xp')}
            style={{
              ...S.subTabBtn,
              ...(subTab === 'xp' ? S.subTabBtnActive : {}),
            }}
          >
            {t('leaderboard.xpTitle')}
          </button>
        </div>

        {/* NỘI DUNG THEO SUB-TAB */}
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* TAB 1: OVERVIEW (Screen 04) */}
          {subTab === 'overview' && (
            <>
              {/* Dải 10 trận gần nhất */}
              <div style={S.cardBox}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={S.cardBoxLabel}>{t('leaderboard.last10Title')}</span>
                  <span style={{ font: '600 13px/1.3 "IBM Plex Mono", monospace', color: '#5FD9A2' }}>
                    {stats.wins10}T · {stats.losses10}B
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {stats.last10.length === 0 ? (
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.noData')}</span>
                  ) : (
                    stats.last10.map((m, idx) => (
                      <div
                        key={idx}
                        style={{
                          flex: 1,
                          minHeight: 32,
                          borderRadius: 5,
                          background: m.won ? 'rgba(18,168,103,.18)' : 'rgba(225,68,52,.18)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          font: '600 12px/1 "IBM Plex Mono", monospace',
                          color: m.won ? '#5FD9A2' : '#FF9A8F',
                        }}
                      >
                        {m.won ? 'T' : 'B'}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 4 Ô Chất lượng trận */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={S.cardBoxLabel}>{t('leaderboard.matchQualityTitle')}</span>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 9 }}>
                  <div style={S.cardBox}>
                    <span style={{ font: '700 20px/1.05 Barlow, sans-serif', color: 'var(--text-primary)' }}>
                      {stats.avgMyPts}
                    </span>
                    <span style={S.caption}>{t('leaderboard.ptsPerSet')}</span>
                  </div>
                  <div style={S.cardBox}>
                    <span style={{ font: '700 20px/1.05 Barlow, sans-serif', color: 'var(--text-primary)' }}>
                      {stats.avgOppPts}
                    </span>
                    <span style={S.caption}>{t('leaderboard.ptsConceded')}</span>
                  </div>
                  <div style={S.cardBox}>
                    <span style={{ font: '700 20px/1.05 Barlow, sans-serif', color: '#5FDBD3' }}>
                      {stats.tightWinRate}%
                    </span>
                    <span style={S.caption}>{t('leaderboard.tightWinRate')}</span>
                  </div>
                  <div style={S.cardBox}>
                    <span style={{ font: '700 20px/1.05 Barlow, sans-serif', color: 'var(--text-primary)' }}>
                      {stats.threeSetCount}
                    </span>
                    <span style={S.caption}>{t('leaderboard.threeSetMatches')}</span>
                  </div>
                </div>
                <div style={{ font: '400 13px/1.5 "IBM Plex Sans", sans-serif', color: '#8494AA' }}>
                  {t('leaderboard.tightWinDesc', { pct: stats.tightWinRate })}
                </div>
              </div>

              {/* Huy hiệu phong cách chơi (Playstyle Badge) */}
              <div style={{ ...S.cardBox, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <span style={S.cardBoxLabel}>{t('leaderboard.playstyleTitle')}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('leaderboard.themeLabel')}:</span>
                    <Select
                      size="sm"
                      value={rankTheme}
                      onChange={(e) => onSelectTheme(e.target.value)}
                      options={RANK_THEMES.map((th) => ({ value: th.key, label: th.label }))}
                      style={{ width: 160 }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: alphaColor(badge.color, '22', 15),
                    border: `1px solid ${badge.color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: badge.color,
                    flexShrink: 0,
                  }}>
                    <Icon name={badge.icon || 'zap'} size={20} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: alphaColor(badge.color, '1E', 12),
                        border: `1px solid ${alphaColor(badge.color, '55', 33)}`,
                        color: badge.color,
                        fontSize: 11,
                        fontFamily: '"IBM Plex Mono", monospace',
                        fontWeight: 700,
                      }}>
                        [{badge.tag}]
                      </span>
                      <span style={{ font: '600 15px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                        {badge.name}
                      </span>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: alphaColor(tier.color, '18', 10),
                        color: tier.color,
                        fontSize: 11,
                        fontWeight: 600,
                      }}>
                        {tier.label}
                      </span>
                    </div>
                    <span style={{ font: '400 13px/1.4 "IBM Plex Sans", sans-serif', color: '#8494AA' }}>
                      "{badge.desc}" · {t('leaderboard.playstyleSystemAssigned')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Biểu đồ Rating SVG */}
              <RatingLineChart
                member={member}
                members={db?.members || allMembers || []}
                matches={db.matches || []}
                matchEdits={db.matchEdits || []}
                sessions={db.sessions || []}
                levels={db.levels || []}
                isMobile={isMobile}
              />
            </>
          )}

          {/* TAB 2: ĐỐI ĐẦU & PARTNER (Bao gồm Sức mạnh theo nội dung, Ăn ý & Lịch sử H2H) */}
          {subTab === 'h2h' && (
            <>
              <div
                data-screen-label="AY3 Ho so noi dung & H2H"
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1fr) 380px',
                gap: 16,
                alignItems: 'start',
              }}
            >
              {/* Left Column: Sức mạnh theo nội dung + Ai hợp với VĐV */}
              <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
                {/* Card Sức mạnh theo nội dung */}
                <div
                  style={{
                    background: '#141D2E',
                    border: '1px solid #22304A',
                    borderRadius: 10,
                    padding: 15,
                    display: 'grid',
                    gap: 12,
                    minWidth: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ font: "600 15px/1.2 'IBM Plex Sans', sans-serif", color: '#fff' }}>
                      {t('profile.formatRatingsTitle')}
                    </span>
                    <span style={{ font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                      {t('profile.formatRatingsSubtitle')}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '160px minmax(0,1fr)', gap: 16, alignItems: 'center' }}>
                    {/* Elo tổng */}
                    <div
                      style={{
                        background: 'linear-gradient(180deg, rgba(29,80,160,.24), #101927)',
                        border: '1px solid #3C74C4',
                        borderRadius: 10,
                        padding: 14,
                        display: 'grid',
                        gap: 4,
                      }}
                    >
                      <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '.06em', textTransform: 'uppercase', color: '#8494AA' }}>
                        {t('profile.careerElo')}
                      </div>
                      <div style={{ font: '700 34px/1 Barlow, sans-serif', color: '#fff' }}>
                        {formatRatings?.overall?.rating ?? DEFAULT_RATING}
                      </div>
                      <div style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#7AA3DC' }}>
                        {formatRatings?.overall?.gamesCount || 0} {t('leaderboard.matchesAbbr')} · {confTierOf(formatRatings?.overall?.confidence)}
                      </div>
                    </div>

                    {/* 3 Thanh rating theo nội dung */}
                    <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
                      {/* Đôi nam */}
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '76px minmax(0,1fr) 48px' : '92px minmax(0,1fr) 52px 64px', gap: isMobile ? 8 : 10, alignItems: 'center' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ font: "600 12.5px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t('profile.doublesFormat')}
                          </div>
                          {isMobile && (
                            <div style={{ font: "400 10.5px/1.2 'IBM Plex Mono', monospace", color: '#5FDBD3' }}>
                              {formatRatings?.doubles?.gamesCount || 0} {t('leaderboard.matchesAbbr')} · {confTierOf(formatRatings?.doubles?.confidence)}
                            </div>
                          )}
                        </div>
                        <span style={{ height: 9, borderRadius: 999, background: '#0B1220', border: '1px solid #22304A', overflow: 'hidden', display: 'flex' }}>
                          <span style={{ width: `${Math.min(100, Math.max(10, Math.round(((formatRatings?.doubles?.rating ?? DEFAULT_RATING) - 1000) / 12)))}%`, background: '#00B2A9' }} />
                        </span>
                        <span style={{ textAlign: 'right', font: "600 13px/1 'IBM Plex Mono', monospace", color: '#fff' }}>
                          {formatRatings?.doubles?.rating ?? DEFAULT_RATING}
                        </span>
                        {!isMobile && (
                          <span style={{ textAlign: 'right', font: "400 11px/1 'IBM Plex Mono', monospace", color: '#5FDBD3' }}>
                            {formatRatings?.doubles?.gamesCount || 0} {t('leaderboard.matchesAbbr')} · {confTierOf(formatRatings?.doubles?.confidence)}
                          </span>
                        )}
                      </div>

                      {/* Nam-nữ */}
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '76px minmax(0,1fr) 48px' : '92px minmax(0,1fr) 52px 64px', gap: isMobile ? 8 : 10, alignItems: 'center' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ font: "600 12.5px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t('profile.mixedFormat')}
                          </div>
                          {isMobile && (
                            <div style={{ font: "400 10.5px/1.2 'IBM Plex Mono', monospace", color: '#5FDBD3' }}>
                              {formatRatings?.mixed?.gamesCount || 0} {t('leaderboard.matchesAbbr')} · {confTierOf(formatRatings?.mixed?.confidence)}
                            </div>
                          )}
                        </div>
                        <span style={{ height: 9, borderRadius: 999, background: '#0B1220', border: '1px solid #22304A', overflow: 'hidden', display: 'flex' }}>
                          <span style={{ width: `${Math.min(100, Math.max(10, Math.round(((formatRatings?.mixed?.rating ?? DEFAULT_RATING) - 1000) / 12)))}%`, background: '#3C74C4' }} />
                        </span>
                        <span style={{ textAlign: 'right', font: "600 13px/1 'IBM Plex Mono', monospace", color: '#fff' }}>
                          {formatRatings?.mixed?.rating ?? DEFAULT_RATING}
                        </span>
                        {!isMobile && (
                          <span style={{ textAlign: 'right', font: "400 11px/1 'IBM Plex Mono', monospace", color: '#5FDBD3' }}>
                            {formatRatings?.mixed?.gamesCount || 0} {t('leaderboard.matchesAbbr')} · {confTierOf(formatRatings?.mixed?.confidence)}
                          </span>
                        )}
                      </div>

                      {/* Đơn nam */}
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '76px minmax(0,1fr) 48px' : '92px minmax(0,1fr) 52px 64px', gap: isMobile ? 8 : 10, alignItems: 'center' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ font: "600 12.5px/1.3 'IBM Plex Sans', sans-serif", color: '#A8B7CB', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t('profile.singlesFormat')}
                          </div>
                          {isMobile && (
                            <div style={{ font: "400 10.5px/1.2 'IBM Plex Mono', monospace", color: '#F0B75C' }}>
                              {formatRatings?.singles?.gamesCount || 0} {t('leaderboard.matchesAbbr')} · {confTierOf(formatRatings?.singles?.confidence)}
                            </div>
                          )}
                        </div>
                        <span style={{ height: 9, borderRadius: 999, background: '#0B1220', border: '1px solid #22304A', overflow: 'hidden', display: 'flex' }}>
                          <span style={{ width: `${Math.min(100, Math.max(10, Math.round(((formatRatings?.singles?.rating ?? DEFAULT_RATING) - 1000) / 12)))}%`, background: '#2E3E5C' }} />
                        </span>
                        <span style={{ textAlign: 'right', font: "600 13px/1 'IBM Plex Mono', monospace", color: '#A8B7CB' }}>
                          ~{formatRatings?.singles?.rating ?? DEFAULT_RATING}
                        </span>
                        {!isMobile && (
                          <span style={{ textAlign: 'right', font: "400 11px/1 'IBM Plex Mono', monospace", color: '#F0B75C' }}>
                            {formatRatings?.singles?.gamesCount || 0} {t('leaderboard.matchesAbbr')} · {confTierOf(formatRatings?.singles?.confidence)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {formatRatings?.insight && (
                    <div
                      style={{
                        font: "400 12.5px/1.55 'IBM Plex Sans', sans-serif",
                        color: '#8494AA',
                        borderTop: '1px solid #22304A',
                        paddingTop: 11,
                      }}
                    >
                      {formatRatings.insight}
                    </div>
                  )}
                </div>

                {/* Card Ai hợp với VĐV */}
                <div
                  style={{
                    background: '#141D2E',
                    border: '1px solid #22304A',
                    borderRadius: 10,
                    padding: 15,
                    display: 'grid',
                    gap: 12,
                    minWidth: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ font: "600 15px/1.2 'IBM Plex Sans', sans-serif", flex: '1 1 auto', color: '#fff' }}>
                      {t('profile.whoSynergizes', { name: member.name })}
                    </span>
                    <span style={{ font: "400 12px/1.2 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                      {t('profile.partnerFilterMin5', { count: (partnersAndMatchups?.partners || []).length })}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
                    {(partnersAndMatchups?.partners || []).length > 0 ? (
                      (partnersAndMatchups?.partners || []).map((part, pIdx) => {
                        const isTopPartner = pIdx === 0 && part.synergyScore >= 80
                        const isLowPartner = part.pairImpact <= -10 && part.games >= 5
                        const absImpact = Math.min(50, Math.abs(part.pairImpact || 0))
                        const barWidthPct = Math.round((absImpact / 50) * 45)

                        return isMobile ? (
                          /* Mobile Layout: 2 tầng co giãn tự nhiên, không bao giờ tràn ngang */
                          <div
                            key={part.id || pIdx}
                            onClick={() => {
                              const pairKey = [mid, part.id].sort().join(':')
                              setInspectingPair({
                                key: pairKey,
                                names: [member.name, part.name],
                                gamesCount: part.games,
                                wins: part.wins,
                                losses: part.losses,
                                actualWinPct: part.actualWinPct,
                                expectedWinPct: part.expectedWinPct,
                                pairImpact: part.pairImpact,
                                synergyScore: part.synergyScore,
                                confidence: part.games >= 30 ? 'R4' : part.games >= 12 ? 'R3' : part.games >= 5 ? 'R2' : 'R1',
                                format: part.format || 'MD',
                              })
                            }}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 8,
                              padding: '10px 12px',
                              borderRadius: 8,
                              background: isTopPartner ? 'rgba(0,178,169,.09)' : isLowPartner ? 'rgba(224,138,0,.07)' : '#101927',
                              border: isTopPartner ? '1px solid #00786F' : '1px solid #22304A',
                              cursor: 'pointer',
                              minWidth: 0,
                            }}
                          >
                            {/* Hàng 1: Avatar + Tên + (Thể thức · Số trận) bên trái | W-L + Synergy bên phải */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: '1 1 auto' }}>
                                <span style={{ width: 24, height: 24, borderRadius: 999, background: isTopPartner ? '#00786F' : '#1D50A0', flexShrink: 0 }} />
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ font: "600 13.5px/1.25 'IBM Plex Sans', sans-serif", color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {part.name}
                                  </div>
                                  <div style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                                    {part.format === 'XD' ? t('leaderboard.filterXD') : t('leaderboard.filterMD')} · {part.games} {t('leaderboard.matchesAbbr')}
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                <span style={{ textAlign: 'right', font: "400 12px/1 'IBM Plex Mono', monospace", color: '#A8B7CB' }}>
                                  {part.wins}–{part.losses}
                                </span>
                                <span
                                  style={{
                                    textAlign: 'right',
                                    font: '700 17px/1 Barlow, sans-serif',
                                    color: isTopPartner ? '#5FDBD3' : isLowPartner ? '#F09A8E' : part.synergyScore >= 50 ? '#fff' : '#F0B75C',
                                    minWidth: 26,
                                  }}
                                >
                                  {part.synergyScore}
                                </span>
                              </div>
                            </div>

                            {/* Hàng 2: Kỳ vọng vs Thực tế + Thanh Pair Impact */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                              <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: '#8494AA', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {part.expectedWinPct}% → {part.actualWinPct}%
                              </span>
                              <span style={{ position: 'relative', height: 7, flex: 1, borderRadius: 999, background: '#0B1220', border: '1px solid #22304A', overflow: 'hidden' }}>
                                <span style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#2E3E5C' }} />
                                {part.pairImpact >= 0 ? (
                                  <span style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: `${barWidthPct}%`, background: '#00B2A9', borderRadius: '0 999px 999px 0' }} />
                                ) : (
                                  <span style={{ position: 'absolute', right: '50%', top: 0, bottom: 0, width: `${barWidthPct}%`, background: '#D63B2B', borderRadius: '999px 0 0 999px' }} />
                                )}
                              </span>
                            </div>
                          </div>
                        ) : (
                          /* Desktop Layout: Hàng 6 cột cân đối, không tràn */
                          <div
                            key={part.id || pIdx}
                            onClick={() => {
                              const pairKey = [mid, part.id].sort().join(':')
                              setInspectingPair({
                                key: pairKey,
                                names: [member.name, part.name],
                                gamesCount: part.games,
                                wins: part.wins,
                                losses: part.losses,
                                actualWinPct: part.actualWinPct,
                                expectedWinPct: part.expectedWinPct,
                                pairImpact: part.pairImpact,
                                synergyScore: part.synergyScore,
                                confidence: part.games >= 30 ? 'R4' : part.games >= 12 ? 'R3' : part.games >= 5 ? 'R2' : 'R1',
                                format: part.format || 'MD',
                              })
                            }}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '26px minmax(80px,1fr) 42px 96px 100px 38px',
                              gap: 8,
                              alignItems: 'center',
                              padding: '10px 12px',
                              borderRadius: 8,
                              background: isTopPartner ? 'rgba(0,178,169,.09)' : isLowPartner ? 'rgba(224,138,0,.07)' : '#101927',
                              border: isTopPartner ? '1px solid #00786F' : '1px solid #22304A',
                              cursor: 'pointer',
                              minWidth: 0,
                            }}
                          >
                            <span style={{ width: 26, height: 26, borderRadius: 999, background: isTopPartner ? '#00786F' : '#1D50A0', flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ font: "600 13.5px/1.25 'IBM Plex Sans', sans-serif", color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {part.name}
                              </div>
                              <div style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#8494AA', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {part.format === 'XD' ? t('leaderboard.filterXD') : t('leaderboard.filterMD')} · {part.games} {t('leaderboard.matchesAbbr')}
                              </div>
                            </div>
                            <span style={{ textAlign: 'right', font: "400 12px/1 'IBM Plex Mono', monospace", color: '#A8B7CB', whiteSpace: 'nowrap' }}>
                              {part.wins}–{part.losses}
                            </span>
                            <span style={{ textAlign: 'right', font: "400 11px/1 'IBM Plex Mono', monospace", color: '#8494AA', whiteSpace: 'nowrap' }}>
                              {part.expectedWinPct}% → {part.actualWinPct}%
                            </span>
                            <span style={{ position: 'relative', height: 9, borderRadius: 999, background: '#0B1220', border: '1px solid #22304A', display: 'block' }}>
                              <span style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#2E3E5C' }} />
                              {part.pairImpact >= 0 ? (
                                <span style={{ position: 'absolute', left: '50%', top: 1, bottom: 1, width: `${barWidthPct}%`, background: '#00B2A9', borderRadius: '0 999px 999px 0' }} />
                              ) : (
                                <span style={{ position: 'absolute', right: '50%', top: 1, bottom: 1, width: `${barWidthPct}%`, background: '#D63B2B', borderRadius: '999px 0 0 999px' }} />
                              )}
                            </span>
                            <span
                              style={{
                                textAlign: 'right',
                                font: '700 16px/1 Barlow, sans-serif',
                                color: isTopPartner ? '#5FDBD3' : isLowPartner ? '#F09A8E' : part.synergyScore >= 50 ? '#fff' : '#F0B75C',
                              }}
                            >
                              {part.synergyScore}
                            </span>
                          </div>
                        )
                      })
                    ) : (
                      <div style={{ font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                        {t('common.noData')}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Đồng đội tốt nhất, Khắc chế & kỵ giơ, Phân tích dưới kỳ vọng, Phong độ 10 trận */}
              <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
                {/* Đồng đội tốt nhất */}
                {partnersAndMatchups?.bestPartner && (
                  <div
                    style={{
                      background: 'linear-gradient(180deg, rgba(0,178,169,.14), #141D2E)',
                      border: '1px solid #00786F',
                      borderRadius: 10,
                      padding: 15,
                      display: 'grid',
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '.06em', textTransform: 'uppercase', color: '#8494AA' }}>
                      {t('profile.bestPartnerBox')}
                    </div>
                    <div style={{ font: '700 22px/1.2 Barlow, sans-serif', color: '#fff', wordBreak: 'break-word' }}>
                      {partnersAndMatchups.bestPartner.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ font: '700 26px/1 Barlow, sans-serif', color: '#5FDBD3' }}>
                        {partnersAndMatchups.bestPartner.synergyScore}
                      </span>
                      <span style={{ font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                        {t('leaderboard.synergyCol')} · {partnersAndMatchups.bestPartner.games} {t('leaderboard.matchesAbbr')} · {t('rating.confidence.high')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Khắc chế & kỵ giơ */}
                <div style={{ background: '#141D2E', border: '1px solid #22304A', borderRadius: 10, overflow: 'hidden', minWidth: 0 }}>
                  <div style={{ padding: '11px 14px', background: '#101927', borderBottom: '1px solid #22304A', font: "600 13px/1.3 'IBM Plex Sans', sans-serif", color: '#fff' }}>
                    {t('profile.matchupSection')}
                  </div>
                  <div style={{ padding: '13px 14px', display: 'grid', gap: 12 }}>
                    {/* Thích gặp */}
                    <div style={{ display: 'grid', gap: 7, minWidth: 0 }}>
                      <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '.06em', textTransform: 'uppercase', color: '#5FDBD3' }}>
                        {t('profile.favoriteMatchup')}
                      </div>
                      {(partnersAndMatchups?.matchups?.favorite || []).length > 0 ? (
                        (partnersAndMatchups?.matchups?.favorite || []).map((fav, fIdx) => (
                          <div
                            key={fIdx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 8,
                              padding: '8px 10px',
                              borderRadius: 6,
                              background: 'rgba(0,178,169,.09)',
                              font: "400 12.5px/1.4 'IBM Plex Sans', sans-serif",
                              color: '#fff',
                              minWidth: 0,
                            }}
                          >
                            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>vs {fav.oppName}</span>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#5FDBD3', flexShrink: 0 }}>{fav.winRate}%</span>
                          </div>
                        ))
                      ) : (
                        <div style={{ font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>{t('common.noData')}</div>
                      )}
                    </div>

                    {/* Kỵ giơ */}
                    <div style={{ display: 'grid', gap: 7, borderTop: '1px solid #22304A', paddingTop: 11, minWidth: 0 }}>
                      <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '.06em', textTransform: 'uppercase', color: '#F0B75C' }}>
                        {t('profile.nemesisMatchup')}
                      </div>
                      {(partnersAndMatchups?.matchups?.nemesis || []).length > 0 ? (
                        (partnersAndMatchups?.matchups?.nemesis || []).map((nem, nIdx) => (
                          <div
                            key={nIdx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 8,
                              padding: '8px 10px',
                              borderRadius: 6,
                              background: 'rgba(224,138,0,.10)',
                              font: "400 12.5px/1.4 'IBM Plex Sans', sans-serif",
                              color: '#fff',
                              minWidth: 0,
                            }}
                          >
                            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>vs {nem.oppName}</span>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#F0B75C', flexShrink: 0 }}>{nem.winRate}%</span>
                          </div>
                        ))
                      ) : (
                        <div style={{ font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>{t('common.noData')}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Vì sao dưới kỳ vọng */}
                {partnersAndMatchups?.matchups?.underperformingAnalysis && (
                  <div style={{ background: '#141D2E', border: '1px solid #E08A00', borderRadius: 10, padding: 14, display: 'grid', gap: 9 }}>
                    <div style={{ font: "600 13px/1.3 'IBM Plex Sans', sans-serif", color: '#F0B75C' }}>
                      {t('profile.whyUnderperforming', {
                        name: member.name,
                        partner: partnersAndMatchups.matchups.underperformingAnalysis.partnerName || '',
                      })}
                    </div>
                    <div style={{ font: "400 12.5px/1.55 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                      {partnersAndMatchups.matchups.underperformingAnalysis.analysisText}
                    </div>
                    <div style={{ font: "400 12px/1.5 'IBM Plex Sans', sans-serif", color: '#8494AA', borderTop: '1px solid #22304A', paddingTop: 9 }}>
                      {t('leaderboard.underperformingDisclaimer')}
                    </div>
                  </div>
                )}

                {/* Phong độ 10 trận */}
                <div style={{ background: '#141D2E', border: '1px solid #22304A', borderRadius: 10, padding: 14, display: 'grid', gap: 8 }}>
                  <div style={{ font: "600 13px/1.3 'IBM Plex Sans', sans-serif", color: '#fff' }}>
                    {t('profile.form10Title')}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(partnersAndMatchups?.last10Form || stats.last10 || []).map((item, idx) => (
                      <span
                        key={idx}
                        style={{
                          flex: 1,
                          height: 26,
                          borderRadius: 4,
                          background: (typeof item === 'object' ? item.won : item === 'W') ? '#00B2A9' : '#2E3E5C',
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ font: "400 12px/1.4 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                    {stats.wins10}T – {stats.losses10}B · {t('profile.form10OldestLeft')}
                  </div>
                </div>
              </div>
            </div>

            {/* Thống kê đối đầu trực tiếp H2H */}
            {/* Gặp nhiều nhất */}
              {h2hData.mostMet ? (
                <div style={{ ...S.cardBox, gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={S.cardBoxLabel}>{t('leaderboard.h2hMostMet')}</span>
                    <span style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: '#8494AA' }}>
                      {h2hData.mostMet.total} {t('units.match')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ font: '600 16px/1.25 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                        {member.name}
                      </span>
                      <span style={{ font: '700 24px/1.05 Barlow, sans-serif', color: '#5FD9A2' }}>
                        {h2hData.mostMet.wins}
                      </span>
                    </div>
                    <span style={{ font: '600 12px/1 "IBM Plex Mono", monospace', color: '#5B6B81' }}>VS</span>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
                      <span style={{ font: '600 16px/1.25 "IBM Plex Sans", sans-serif', color: '#A8B7CB' }}>
                        {playerName(db, h2hData.mostMet.id)}
                      </span>
                      <span style={{ font: '700 24px/1.05 Barlow, sans-serif', color: '#A8B7CB' }}>
                        {h2hData.mostMet.total - h2hData.mostMet.wins}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-inset)' }}>
                    <div style={{ width: `${h2hData.mostMet.winRate}%`, background: '#12A867' }} />
                    <div style={{ flex: 1, background: 'var(--border-subtle)' }} />
                  </div>
                  <div style={{ font: '400 13px/1.45 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                    {t('leaderboard.winRate')}: {h2hData.mostMet.winRate}%.
                  </div>
                </div>
              ) : (
                <div style={S.cardBox}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.noData')}</span>
                </div>
              )}

              {/* Đối thủ khó nhất */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={S.cardBoxLabel}>{t('leaderboard.h2hToughest')}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {h2hData.toughest.length === 0 ? (
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.noData')}</span>
                  ) : (
                    h2hData.toughest.map((op) => (
                      <div key={op.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 8, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                        <span style={{ flex: 1, font: '600 15px/1.3 "IBM Plex Sans", sans-serif', minWidth: 0, color: 'var(--text-primary)' }}>
                          {playerName(db, op.id)}
                          {op.isGuest && (
                            <span style={{ marginLeft: 6, font: '600 10px/1 "IBM Plex Sans", sans-serif', padding: '3px 7px', borderRadius: 999, background: 'rgba(224,138,0,.18)', color: '#F0B75C' }}>
                              {t('leaderboard.guestTag')}
                            </span>
                          )}
                        </span>
                        <span style={{ font: '400 13px/1.3 "IBM Plex Mono", monospace', color: '#8494AA' }}>
                          {op.total} {t('units.match')}
                        </span>
                        <span style={{ font: '600 14px/1.3 "IBM Plex Mono", monospace', color: '#FF8578', width: 56, textAlign: 'right' }}>
                          {op.winRate}%
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Partner hợp nhất */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={S.cardBoxLabel}>{t('leaderboard.h2hBestPartner')}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {h2hData.bestPartners.length === 0 ? (
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.noData')}</span>
                  ) : (
                    h2hData.bestPartners.map((pt) => (
                      <div key={pt.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 8, background: 'rgba(0,178,169,.14)', border: '1px solid #00786F' }}>
                        <span style={{ flex: 1, font: '600 15px/1.3 "IBM Plex Sans", sans-serif', minWidth: 0, color: '#5FDBD3' }}>
                          {member.name} + {playerName(db, pt.id)}
                        </span>
                        <span style={{ font: '400 13px/1.3 "IBM Plex Mono", monospace', color: '#8494AA' }}>
                          {pt.total} {t('units.match')}
                        </span>
                        <span style={{ font: '600 14px/1.3 "IBM Plex Mono", monospace', color: '#5FDBD3', width: 56, textAlign: 'right' }}>
                          {pt.winRate}%
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* TAB 3: XP & THÀNH TỰU (Screen 07) */}
          {subTab === 'xp' && (
            <>
              {/* Header XP & Level */}
              <div style={{ ...S.cardBox, gap: 12, background: 'var(--surface-sunken)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ font: '600 18px/1.25 Barlow, sans-serif', color: 'var(--text-primary)' }}>
                      {t('leaderboard.xpTitle')}
                    </span>
                    <span style={{ font: '400 13px/1.4 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                      {member.name} · {xpData.sessionCount} {t('units.session')} · {xpData.matchCount} {t('units.match')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    <span style={{ font: '700 24px/1.05 Barlow, sans-serif', color: 'var(--status-transit-fg)' }}>
                      Lv {xpData.level}
                    </span>
                    <span style={{ font: '400 12px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                      {xpData.title}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', font: '400 13px/1.4 "IBM Plex Mono", monospace' }}>
                    <span style={{ color: '#5FDBD3' }}>{xpData.totalXp.toLocaleString()} XP</span>
                    <span style={{ color: 'var(--text-muted)' }}>{t('leaderboard.xpNextAt', { level: xpData.level + 1, xp: xpData.nextLevelXp.toLocaleString() })}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-inset)', overflow: 'hidden' }}>
                    <div style={{ width: `${xpData.levelProgressPct}%`, height: '100%', background: '#00B2A9', transition: 'width 0.3s ease' }} />
                  </div>
                  <span style={{ font: '400 13px/1.45 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                    {t('leaderboard.xpProgressDesc')}
                  </span>

                  {/* Cơ cấu XP: 4 nguồn của trục GẮN BÓ, không có khoản nào hỏi thắng thua */}
                  <div style={{ display: 'grid', gap: 4, marginTop: 4 }}>
                    <span style={{ font: '600 11px/1 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                      {t('leaderboard.xpBreakdownTitle')}
                    </span>
                    {[
                      { k: 'xpFromSessions', n: xpData.sessionCount, v: xpData.breakdown?.sessionXp },
                      { k: 'xpFromMatches', n: xpData.matchCount, v: xpData.breakdown?.matchXp },
                      { k: 'xpFromTenure', n: xpData.tenureMonths, v: xpData.breakdown?.tenureXp },
                      { k: 'xpFromInvites', n: xpData.invitedCount, v: xpData.breakdown?.inviteXp },
                    ].filter((r) => (r.v || 0) > 0).map((r) => (
                      <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', font: '400 12.5px/1.5 "IBM Plex Mono", monospace' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{t(`leaderboard.${r.k}`, { n: r.n })}</span>
                        <span style={{ color: '#5FDBD3' }}>+{r.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Đang bị treo thưởng (Bounty) */}
              {seasonBounty && (
                <div style={{ background: 'rgba(224,138,0,.14)', border: '1px solid #B26A00', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ font: '600 11px/1.2 "IBM Plex Sans", sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#F0B75C' }}>
                      {t('leaderboard.xpBountyTitle')}
                    </span>
                    <span style={{ font: '600 13px/1.3 "IBM Plex Mono", monospace', color: '#F0B75C' }}>
                      +40 XP
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(224,138,0,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 16px/1 Barlow, sans-serif', color: '#F0B75C', flexShrink: 0 }}>
                      {seasonBounty.streak}W
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span style={{ font: '600 15px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                        {t('leaderboard.xpBountyDesc', { name: seasonBounty.member.name, streak: seasonBounty.streak })}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sổ XP */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={S.cardBoxLabel}>{t('leaderboard.xpLedgerTitle')}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
                  {xpLedger.length === 0 ? (
                    <div style={{ padding: 14, background: 'var(--surface-card)', fontSize: 13, color: 'var(--text-muted)' }}>
                      {t('common.noData')}
                    </div>
                  ) : (
                    xpLedger.map((row) => (
                      <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--surface-card)' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                          <span style={{ font: '600 14px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                            {t(`leaderboard.${row.titleKey}`)}
                          </span>
                          <span style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                            {row.source}
                          </span>
                        </div>
                        <span style={{ font: '600 14px/1.3 "IBM Plex Mono", monospace', color: '#5FD9A2' }}>
                          +{row.amount}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                <span style={{ font: '400 13px/1.5 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                  {t('leaderboard.xpLedgerNote')}
                </span>
              </div>

              {/* Thành tựu */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={S.cardBoxLabel}>{t('leaderboard.achievementsTitle')}</span>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 9 }}>
                  {achievements.map((ach) => (
                    <div
                      key={ach.id}
                      style={{
                        background: ach.achieved ? 'var(--surface-card)' : 'var(--surface-sunken)',
                        border: ach.achieved ? '1px solid #00786F' : '1px dashed var(--border-default)',
                        borderRadius: 10,
                        padding: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <span style={{ font: '600 14px/1.3 "IBM Plex Sans", sans-serif', color: ach.achieved ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {ach.title}
                      </span>
                      <span style={{ font: '400 12px/1.4 "IBM Plex Mono", monospace', color: ach.achieved ? '#5FDBD3' : 'var(--text-muted)' }}>
                        {ach.progressText}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal AY2: Chi tiết cặp từ hồ sơ */}
      {inspectingPair && (
        <PairDetailModal
          pair={{ ...inspectingPair, membersMap }}
          onClose={() => setInspectingPair(null)}
          ratingsMap={db.playerRatings || {}}
          matches={matches}
        />
      )}
    </div>
  )
}

const S = {
  card: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 22,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  cardBox: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 10,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  cardBoxLabel: {
    font: '600 11px/1.2 "IBM Plex Sans", sans-serif',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  statCardMini: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 10,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  statMiniLabel: {
    font: '600 10px/1.2 "IBM Plex Sans", sans-serif',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  caption: {
    font: '400 13px/1.35 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
  },
  challengeBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 8,
    background: 'var(--action-primary-bg)',
    color: 'var(--action-primary-fg)',
    border: 'none',
    font: '600 13px/1 "IBM Plex Sans", sans-serif',
    cursor: 'pointer',
  },
  subTabBtn: {
    flex: 1,
    minHeight: 38,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    background: 'transparent',
    border: 'none',
    font: '600 13px/1 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  subTabBtnActive: {
    background: 'var(--surface-card)',
    boxShadow: 'var(--shadow-xs)',
    color: 'var(--text-primary)',
  },
}
