import { useState, useMemo } from 'react'
import { Icon, Select, StatCard, Avatar } from '#ds'
import { ConfidenceChip, LevelChip } from '#ui'
import { playerName } from '#lib/money.js'
import { getPlayerRating, rankTierOf, applyInactivityDecay, lastMatchAtOf, getPlayerFormatRatings, getPlayerPartnersAndMatchups, DEFAULT_RATING } from '#lib/rating.js'
import { getMemberBadge, RANK_THEMES } from '#data/rankThemes.js'
import { calculateMemberXp, getMemberXpLedger } from '#lib/xp.js'
import { calculateMemberBadges, TIER_ORDER } from '#lib/badges.js'
import { getSeasonBountyPlayer, getMemberSeasonLedger, seasonConfigOf } from '#lib/season.js'
import RatingLineChart from '#components/challenge/RatingLineChart.jsx'
import PairDetailModal from '#components/leaderboard/PairDetailModal.jsx'
import { useMobile } from '#hooks/useMobile.js'
import cfgApp from '#config/app.json'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { t } from '#i18n'

function alphaColor(color, alphaHex, pct) {
  if (!color) return 'transparent'
  const isVar = typeof color === 'string' && color.startsWith('var(')
  if (!isVar) return `${color}${alphaHex}`
  const p = pct ?? Math.min(100, Math.max(0, Math.round((parseInt(alphaHex, 16) / 255) * 100)))
  return `color-mix(in srgb, ${color} ${p}%, transparent)`
}

function getMemberAvatar(m) {
  if (!m) return ''
  return m.avatar_url || m.avatarUrl || m.avatar || m.profile?.avatar_url || m.profile?.avatarUrl || ''
}

function getTierPill(gap, gapText, isDark) {
  const g = typeof gap === 'number' ? gap : 0
  if (g >= 150) {
    return {
      text: t('season.tierPillHeavyFavored', { gap: gapText }),
      color: isDark ? '#5FDBD3' : '#0F766E',
      bg: isDark ? 'rgba(0, 178, 169, 0.20)' : 'rgba(13, 148, 136, 0.14)',
      border: isDark ? '1px solid rgba(0, 178, 169, 0.40)' : '1px solid rgba(13, 148, 136, 0.28)',
    }
  }
  if (g >= 50) {
    return {
      text: t('season.tierPillFavored', { gap: gapText }),
      color: isDark ? '#5FDBD3' : '#0F766E',
      bg: isDark ? 'rgba(0, 178, 169, 0.16)' : 'rgba(13, 148, 136, 0.12)',
      border: isDark ? '1px solid rgba(0, 178, 169, 0.32)' : '1px solid rgba(13, 148, 136, 0.22)',
    }
  }
  if (g > -50) {
    return {
      text: t('season.tierPillBalanced', { gap: gapText }),
      color: isDark ? '#94A3B8' : '#475569',
      bg: isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(148, 163, 184, 0.12)',
      border: isDark ? '1px solid rgba(148, 163, 184, 0.30)' : '1px solid rgba(148, 163, 184, 0.22)',
    }
  }
  if (g > -150) {
    return {
      text: t('season.tierPillUnderdog', { gap: gapText }),
      color: isDark ? '#FB923C' : '#EA580C',
      bg: isDark ? 'rgba(249, 115, 22, 0.18)' : 'rgba(249, 115, 22, 0.12)',
      border: isDark ? '1px solid rgba(249, 115, 22, 0.35)' : '1px solid rgba(249, 115, 22, 0.25)',
    }
  }
  return {
    text: t('season.tierPillDeepUnderdog', { gap: gapText }),
    color: isDark ? '#FF9A8F' : '#DC2626',
    bg: isDark ? 'rgba(225, 68, 52, 0.20)' : 'rgba(220, 38, 38, 0.14)',
    border: isDark ? '1px solid rgba(225, 68, 52, 0.40)' : '1px solid rgba(220, 38, 38, 0.30)',
  }
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
  initialSubTab = 'overview',
  seasonConfig,
}) {
  const isMobileHook = useMobile()
  const isMobile = propIsMobile !== undefined ? Boolean(propIsMobile) : isMobileHook
  const { isDark } = useTheme()
  const [subTab, setSubTab] = useState(initialSubTab || 'overview')
  const [inspectingPair, setInspectingPair] = useState(null)

  const [prevProps, setPrevProps] = useState({ initialSubTab, memberId: member?.id })
  if (prevProps.initialSubTab !== initialSubTab || prevProps.memberId !== member?.id) {
    setPrevProps({ initialSubTab, memberId: member?.id })
    if (initialSubTab) {
      setSubTab(initialSubTab)
    }
  }

  const matches = useMemo(() => db.matches || [], [db.matches])
  const mid = member?.id

  const ledgerData = useMemo(() => {
    if (!mid || !db) return null
    return getMemberSeasonLedger(mid, db, seasonConfig || seasonConfigOf(db))
  }, [mid, db, seasonConfig])

  // Tỷ lệ thanh phân bổ Stacked Bar cho Điểm mùa
  // Hệ số điểm mùa của kèo — hiện thẳng trên tag, cùng cách với MemberSeasonLedgerModal.
  const chalMult = Number(ledgerData?.season?.challengeMultiplier ?? cfgApp?.season?.challengeMultiplier ?? 1) || 1
  const seasonTotal = Math.max(1, ledgerData?.totalPoints ?? 0)
  const seasonBreakdown = ledgerData?.breakdown || {}
  const pMatchNet = Math.round((Math.max(0, seasonBreakdown.matchNetPts ?? seasonBreakdown.winPts ?? 0) / seasonTotal) * 100)
  const pStreak = Math.round(((seasonBreakdown.streakBonusPts ?? 0) / seasonTotal) * 100)
  const pUpsets = Math.max(0, 100 - pMatchNet - pStreak)

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
          at: m.at || (m.playedAt ? Date.parse(m.playedAt) : (m.createdAt ? Date.parse(m.createdAt) : 0)),
        })
      }
    })

    return list.sort((a, b) => (b.at || 0) - (a.at || 0) || String(b.id || '').localeCompare(String(a.id || '')))
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

    // 10 trận gần nhất: lấy 10 trận mới nhất, sau đó đảo ngược để hiển thị Cũ (bên trái) → Mới nhất (bên phải)
    // khớp với trục thời gian của biểu đồ bên dưới và nhãn t('profile.form10OldestLeft')
    const recent10Desc = memberMatches.slice(0, 10)
    const wins10 = recent10Desc.filter((m) => m.won).length
    const losses10 = recent10Desc.length - wins10
    const last10 = [...recent10Desc].reverse()

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

  // 4. XP (Screen 07) — chỉ trục GẮN BÓ, không hỏi thắng thua
  const xpData = useMemo(() => calculateMemberXp(mid, db), [mid, db])
  const xpLedger = useMemo(() => getMemberXpLedger(mid, db), [mid, db])
  const seasonBounty = useMemo(() => getSeasonBountyPlayer(db), [db])

  // 4b. Thành tựu = DANH HIỆU THẬT từ `#lib/badges.js`, một nguồn sự thật duy nhất với
  // trang Danh hiệu. Trước đây khối này đọc `getMemberAchievements()` của xp.js — bộ 4 mốc
  // viết cứng, đếm all-time, nên hồ sơ và trang Danh hiệu báo lệch nhau.
  // Ưu tiên danh hiệu đang gần đạt nhất, thiếu thì lấp bằng danh hiệu bậc cao đã mở.
  const achievements = useMemo(() => {
    if (!mid) return []
    const res = calculateMemberBadges(mid, db)
    const chasing = [...(res.inProgress || [])].sort((a, b) => b.pct - a.pct)
    const owned = [...(res.officialUnlocked || [])].sort(
      (a, b) => (TIER_ORDER[b.tier] || 0) - (TIER_ORDER[a.tier] || 0)
    )
    return [...chasing, ...owned].slice(0, 4).map((b) => ({
      id: b.id,
      title: t(`badges.items.${b.id}.name`, { defaultValue: b.id }),
      achieved: !!b.unlocked,
      progressText: b.unlocked ? t('badges.openedStatus') : b.progressStr,
    }))
  }, [mid, db])

  // 5. Rating & Inactivity
  const pr = getPlayerRating(db.playerRatings, mid, member, db.levels)
  const lastMatchIso = lastMatchAtOf(matches, mid)
  const decayInfo = applyInactivityDecay(pr.rating, lastMatchIso)

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* HEADER HỒ SƠ VĐV */}
      <div style={S.card}>
        <div style={{ padding: 18, background: 'var(--surface-sunken)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', paddingRight: isMobile ? 36 : 42 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Avatar
                name={member.name}
                src={getMemberAvatar(member)}
                size={56}
                style={{ flexShrink: 0, border: '1px solid var(--border-subtle)' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <div style={{ font: '700 22px/1.2 Barlow, sans-serif', color: 'var(--text-primary)' }}>
                  {member.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <LevelChip level={member.level} levels={db.levels} />
                  <span style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
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
              <span style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: isDark ? '#5FD9A2' : '#059669' }}>
                {pr.deltaToday ? `${pr.deltaToday > 0 ? '+' : ''}${pr.deltaToday}` : `+${stats.currentStreak * 2}`}
              </span>
            </div>

            <div style={S.statCardMini}>
              <span style={S.statMiniLabel}>{t('leaderboard.winRate')}</span>
              <span style={{ font: '700 26px/1.05 Barlow, sans-serif', color: 'var(--text-primary)' }}>
                {stats.winRate}%
              </span>
              <span style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                {stats.wins}/{stats.totalMatches}
              </span>
            </div>

            <div style={S.statCardMini}>
              <span style={S.statMiniLabel}>{t('leaderboard.recentForm')}</span>
              <span style={{ font: '700 26px/1.05 Barlow, sans-serif', color: isDark ? '#5FDBD3' : 'var(--text-accent)' }}>
                {stats.currentStreak}W
              </span>
              <span style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                {stats.maxStreak}W max
              </span>
            </div>
          </div>
        </div>

        {/* 4 SUB-TABS TRONG PROFILE */}
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)' }}>
          <div
            style={{
              display: 'flex',
              gap: 6,
              padding: 5,
              background: 'var(--surface-inset)',
              borderRadius: 12,
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => setSubTab('overview')}
              style={{
                ...S.subTabBtn,
                ...(subTab === 'overview' ? S.subTabBtnActive : {}),
                fontSize: isMobile ? 12 : 13,
                padding: isMobile ? '0 6px' : '0 12px',
              }}
            >
              <Icon name="activity" size={isMobile ? 13 : 14} />
              <span>{t('home.tabs.overview')}</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('season')}
              style={{
                ...S.subTabBtn,
                ...(subTab === 'season' ? S.subTabBtnActive : {}),
                fontSize: isMobile ? 12 : 13,
                padding: isMobile ? '0 6px' : '0 12px',
              }}
            >
              <Icon name="trophy" size={isMobile ? 13 : 14} />
              <span>{t('leaderboard.tabSeasonPoints')}</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('h2h')}
              style={{
                ...S.subTabBtn,
                ...(subTab === 'h2h' ? S.subTabBtnActive : {}),
                fontSize: isMobile ? 12 : 13,
                padding: isMobile ? '0 6px' : '0 12px',
              }}
            >
              <Icon name="swords" size={isMobile ? 13 : 14} />
              <span>{t('leaderboard.tabH2H')}</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('xp')}
              style={{
                ...S.subTabBtn,
                ...(subTab === 'xp' ? S.subTabBtnActive : {}),
                fontSize: isMobile ? 12 : 13,
                padding: isMobile ? '0 6px' : '0 12px',
              }}
            >
              <Icon name="sparkles" size={isMobile ? 13 : 14} />
              <span>{t('leaderboard.xpTitle')}</span>
            </button>
          </div>
        </div>

        {/* NỘI DUNG THEO SUB-TAB */}
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* TAB 1: OVERVIEW (Screen 04) */}
          {subTab === 'overview' && (
            <>
              {/* Dải 10 trận gần nhất */}
              <div style={S.cardBox}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={S.cardBoxLabel}>{t('leaderboard.last10Title')}</span>
                    <span style={{ font: '400 11px/1 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                      ({t('profile.form10OldestLeft')})
                    </span>
                  </div>
                  <span style={{ font: '600 13px/1.3 "IBM Plex Mono", monospace', color: isDark ? '#5FD9A2' : '#059669' }}>
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
                          borderRadius: 6,
                          background: m.won
                            ? (isDark ? 'rgba(18,168,103,.20)' : 'rgba(16,185,129,.14)')
                            : (isDark ? 'rgba(225,68,52,.20)' : 'rgba(239,68,68,.14)'),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          font: '600 12px/1 "IBM Plex Mono", monospace',
                          color: m.won ? (isDark ? '#5FD9A2' : '#047857') : (isDark ? '#FF9A8F' : '#DC2626'),
                          border: m.won
                            ? (isDark ? '1px solid rgba(18,168,103,.35)' : '1px solid rgba(16,185,129,.30)')
                            : (isDark ? '1px solid rgba(225,68,52,.35)' : '1px solid rgba(239,68,68,.30)'),
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
                    <span style={{ font: '700 20px/1.05 Barlow, sans-serif', color: isDark ? '#5FDBD3' : 'var(--text-accent)' }}>
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
                <div style={{ font: '400 13px/1.5 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                  {t('leaderboard.tightWinDesc', { pct: stats.tightWinRate })}
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

          {/* TAB 2: SEASON POINTS (Sổ điểm mùa giải) */}
          {subTab === 'season' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {!ledgerData ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', font: "400 13px/1.4 'IBM Plex Sans', sans-serif" }}>
                  {t('season.noMatchesInSeason')}
                </div>
              ) : (
                <>
                  {/* Season Name & Rank */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ font: "600 13px/1.3 'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>
                      {(ledgerData.season?.name ? `${ledgerData.season.name} · ` : '') + t('season.rankOf', { rank: ledgerData.rank, total: ledgerData.totalMembers })}
                    </span>
                  </div>

                  {/* Big Score Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ font: "600 40px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                      {(ledgerData.totalPoints || 0).toLocaleString()}
                    </div>
                    <div style={{ paddingBottom: 6, font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                      {t('season.pointsLabel')} ·{' '}
                      <span style={{ color: isDark ? '#5FDBD3' : 'var(--teal-700)', fontWeight: 600 }}>+{(ledgerData.latestSessionPts ?? 0)}</span> {t('season.latestSession')}
                      {ledgerData.rank > 1 && (
                        <>
                          {' '}· {t('season.distanceToNext', { rank: ledgerData.rank - 1, pts: ledgerData.ptsToNextRank })}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Stacked Progress Bar */}
                  <div
                    style={{
                      height: 26,
                      borderRadius: 6,
                      overflow: 'hidden',
                      display: 'flex',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div
                      style={{
                        width: `${pMatchNet}%`,
                        background: '#00B2A9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        font: "600 10px/1 'IBM Plex Mono', monospace",
                        color: '#fff',
                      }}
                    >
                      {seasonBreakdown.matchNetPts ?? 0}
                    </div>
                    <div
                      style={{
                        width: `${pStreak}%`,
                        background: '#1D50A0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        font: "600 10px/1 'IBM Plex Mono', monospace",
                        color: '#fff',
                      }}
                    >
                      {seasonBreakdown.streakBonusPts ?? 0}
                    </div>
                    <div
                      style={{
                        width: `${pUpsets}%`,
                        background: '#C9A227',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        font: "600 10px/1 'IBM Plex Mono', monospace",
                        color: '#2A1F00',
                      }}
                    >
                      {seasonBreakdown.upsetBonusPts ?? 0}
                    </div>
                  </div>

                  {/* Stacked Bar Legend */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
                      gap: 8,
                      font: "500 11.5px/1.2 'IBM Plex Mono', monospace",
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        background: 'var(--surface-inset)',
                        borderRadius: 6,
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: '#00B2A9', flexShrink: 0 }} />
                        <span>{t('season.actMatchPlay')}</span>
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {seasonBreakdown.matchNetPts ?? 0}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        background: 'var(--surface-inset)',
                        borderRadius: 6,
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: '#1D50A0', flexShrink: 0 }} />
                        <span>{t('season.actStreakMilestones')}</span>
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        +{seasonBreakdown.streakBonusPts ?? 0}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        background: 'var(--surface-inset)',
                        borderRadius: 6,
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: '#C9A227', flexShrink: 0 }} />
                        <span>{t('season.actUpsetMilestone')}</span>
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        +{seasonBreakdown.upsetBonusPts ?? 0}
                      </span>
                    </div>
                  </div>

                  {/* Audit Events Timeline */}
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12, display: 'grid', gap: 8 }}>
                    <div
                      style={{
                        font: "600 12px/1.2 'IBM Plex Sans', sans-serif",
                        letterSpacing: '.06em',
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {t('season.recentSessionTitle')} · {(ledgerData.latestSessionPts ?? 0) >= 0 ? `+${ledgerData.latestSessionPts ?? 0}` : `${ledgerData.latestSessionPts}`}
                    </div>

                    <div style={{ display: 'grid', gap: 6 }}>
                      {ledgerData.recentEvents && ledgerData.recentEvents.length > 0 ? (
                        ledgerData.recentEvents.map((ev, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6,
                              padding: '9px 12px',
                              borderRadius: 8,
                              background: ev.isUpset
                                ? (isDark ? 'rgba(201,162,39,.12)' : 'rgba(245,158,11,.10)')
                                : 'var(--surface-inset)',
                              border: ev.isUpset ? '1px solid #C9A227' : '1px solid var(--border-subtle)',
                              font: "400 12px/1.3 'IBM Plex Sans', sans-serif",
                            }}
                          >
                            {/* Hàng 1: Thời gian · Tag Trận/Kèo · Highlight Pill Elo Gap · Điểm số +/- */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: ev.isUpset ? (isDark ? '#F0D26A' : '#92400E') : 'var(--text-muted)' }}>
                                  {ev.time}
                                </span>

                                {/* Tag Trận vs Kèo */}
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    font: "600 10.5px/1 'IBM Plex Sans', sans-serif",
                                    background: ev.isChallenge
                                      ? (isDark ? 'rgba(249, 115, 22, 0.2)' : 'rgba(249, 115, 22, 0.12)')
                                      : (isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(14, 165, 233, 0.12)'),
                                    color: ev.isChallenge ? (isDark ? '#FB923C' : '#EA580C') : (isDark ? '#38BDF8' : '#0284C7'),
                                    border: ev.isChallenge
                                      ? '1px solid rgba(249, 115, 22, 0.35)'
                                      : '1px solid rgba(56, 189, 248, 0.25)',
                                  }}
                                  title={(ev.isChallenge && chalMult > 1) ? t('season.tagChallengeMultHint', { mult: chalMult }) : undefined}
                                >
                                  {ev.isChallenge
                                    ? (chalMult > 1 ? t('season.tagChallengeMult', { mult: chalMult }) : t('season.tagChallenge'))
                                    : t('season.tagMatch')}
                                </span>

                                {/* Highlight Pill Elo Gap: Kèo trên / Kèo cân / Kèo dưới */}
                                {ev.gapText && (() => {
                                  const pill = getTierPill(ev.gap, ev.gapText, isDark)
                                  return (
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        padding: '2px 7px',
                                        borderRadius: 4,
                                        font: "600 11px/1.2 'IBM Plex Sans', sans-serif",
                                        background: pill.bg,
                                        color: pill.color,
                                        border: pill.border,
                                      }}
                                    >
                                      {pill.text}
                                    </span>
                                  )
                                })()}

                                {ev.streakBonus > 0 && (
                                  <span
                                    style={{
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      font: "600 10.5px/1 'IBM Plex Sans', sans-serif",
                                      background: isDark ? 'rgba(95, 219, 211, 0.2)' : 'rgba(13, 148, 136, 0.15)',
                                      color: isDark ? '#5FDBD3' : '#0D9488',
                                    }}
                                  >
                                    {t('season.ledgerStreakBonus', { pts: ev.streakBonus })}
                                  </span>
                                )}

                                {ev.upsetBonus > 0 && (
                                  <span
                                    style={{
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      font: "600 10.5px/1 'IBM Plex Sans', sans-serif",
                                      background: isDark ? 'rgba(201, 162, 39, 0.25)' : 'rgba(217, 119, 6, 0.18)',
                                      color: isDark ? '#F0D26A' : '#B45309',
                                    }}
                                  >
                                    {t('season.ledgerUpsetBonus', { pts: ev.upsetBonus })}
                                  </span>
                                )}
                              </div>

                              {/* Season Points Delta */}
                              <span
                                style={{
                                  fontFamily: "'IBM Plex Mono', monospace",
                                  fontSize: 14,
                                  color: ev.isUpset
                                    ? (isDark ? '#F0D26A' : '#B45309')
                                    : (ev.numPts > 0 ? (isDark ? '#5FDBD3' : '#0D9488') : (ev.numPts < 0 ? (isDark ? '#F87171' : '#DC2626') : 'var(--text-muted)')),
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                              >
                                {ev.pts}
                              </span>
                            </div>

                            {/* Hàng 2: Kết quả & Tỷ số + Ai với ai */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
                              <span
                                style={{
                                  fontWeight: 600,
                                  color: ev.type === 'win'
                                    ? (isDark ? '#5FDBD3' : '#0D9488')
                                    : (isDark ? '#F87171' : '#DC2626'),
                                }}
                              >
                                {ev.type === 'win'
                                  ? (ev.scoreText ? t('season.winScore', { score: ev.scoreText }) : t('season.matchWin'))
                                  : (ev.scoreText ? t('season.lossScore', { score: ev.scoreText }) : t('season.matchLoss'))}
                              </span>

                              {(ev.oppNamesStr || ev.partnerName) && (
                                <>
                                  <span style={{ color: 'var(--text-muted)' }}>·</span>
                                  <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {ev.partnerName
                                      ? t('season.matchWithPartnerVs', { partner: ev.partnerName, opponents: ev.oppNamesStr })
                                      : t('season.matchVsOpponents', { opponents: ev.oppNamesStr })}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '8px 10px', color: 'var(--text-muted)', font: "400 12px/1.4 'IBM Plex Sans', sans-serif" }}>
                          {t('season.noMatchesInSeason')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer Notice */}
                  <div
                    style={{
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: 12,
                    }}
                  >
                    <span
                      style={{
                        font: "400 12px/1.45 'IBM Plex Sans', sans-serif",
                        color: 'var(--text-muted)',
                        display: 'block',
                      }}
                    >
                      {t('season.ledgerFooterNote', { name: member?.name || '' })}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: ĐỐI ĐẦU & PARTNER (Bao gồm Sức mạnh theo nội dung, Ăn ý & Lịch sử H2H) */}
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
                    background: isDark ? '#141D2E' : 'var(--surface-card)',
                    border: isDark ? '1px solid #22304A' : '1px solid var(--border-subtle)',
                    borderRadius: 12,
                    padding: 16,
                    display: 'grid',
                    gap: 14,
                    minWidth: 0,
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ font: "600 15px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                      {t('profile.formatRatingsTitle')}
                    </span>
                    <span style={{ font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                      {t('profile.formatRatingsSubtitle')}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '160px minmax(0,1fr)', gap: 16, alignItems: 'center' }}>
                    {/* Elo tổng */}
                    <div
                      style={{
                        background: isDark
                          ? 'linear-gradient(180deg, rgba(29,80,160,.24), #101927)'
                          : 'linear-gradient(180deg, rgba(59,130,246,.08), var(--surface-sunken))',
                        border: isDark ? '1px solid #3C74C4' : '1px solid rgba(59,130,246,.3)',
                        borderRadius: 10,
                        padding: 14,
                        display: 'grid',
                        gap: 4,
                      }}
                    >
                      <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '.06em', textTransform: 'uppercase', color: isDark ? '#8494AA' : 'var(--text-muted)' }}>
                        {t('profile.careerElo')}
                      </div>
                      <div style={{ font: '700 34px/1 Barlow, sans-serif', color: 'var(--text-primary)' }}>
                        {formatRatings?.overall?.rating ?? DEFAULT_RATING}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: "400 11px/1.3 'IBM Plex Mono', monospace", color: isDark ? '#7AA3DC' : '#2563EB' }}>
                        <span>{formatRatings?.overall?.gamesCount || 0} {t('leaderboard.matchesAbbr')}</span>
                        <ConfidenceChip confidence={formatRatings?.overall?.confidence} games={formatRatings?.overall?.gamesCount} dots={false} />
                      </div>
                    </div>

                    {/* 3 Thanh rating theo nội dung */}
                    <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
                      {/* Đôi nam */}
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '76px minmax(0,1fr) 48px' : '92px minmax(0,1fr) 52px 64px', gap: isMobile ? 8 : 10, alignItems: 'center' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ font: "600 12.5px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t('profile.doublesFormat')}
                          </div>
                          {isMobile && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, font: "400 10.5px/1.2 'IBM Plex Mono', monospace", color: isDark ? '#5FDBD3' : 'var(--text-accent)' }}>
                              <span>{formatRatings?.doubles?.gamesCount || 0} {t('leaderboard.matchesAbbr')}</span>
                              <ConfidenceChip confidence={formatRatings?.doubles?.confidence} games={formatRatings?.doubles?.gamesCount} dots={false} />
                            </div>
                          )}
                        </div>
                        <span style={{ height: 9, borderRadius: 999, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', overflow: 'hidden', display: 'flex' }}>
                          <span style={{ width: `${Math.min(100, Math.max(10, Math.round(((formatRatings?.doubles?.rating ?? DEFAULT_RATING) - 1000) / 12)))}%`, background: '#00B2A9' }} />
                        </span>
                        <span style={{ textAlign: 'right', font: "600 13px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                          {formatRatings?.doubles?.rating ?? DEFAULT_RATING}
                        </span>
                        {!isMobile && (
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, font: "400 11px/1 'IBM Plex Mono', monospace", color: isDark ? '#5FDBD3' : 'var(--text-accent)' }}>
                            <span>{formatRatings?.doubles?.gamesCount || 0} {t('leaderboard.matchesAbbr')}</span>
                            <ConfidenceChip confidence={formatRatings?.doubles?.confidence} games={formatRatings?.doubles?.gamesCount} dots={false} />
                          </span>
                        )}
                      </div>

                      {/* Nam-nữ */}
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '76px minmax(0,1fr) 48px' : '92px minmax(0,1fr) 52px 64px', gap: isMobile ? 8 : 10, alignItems: 'center' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ font: "600 12.5px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t('profile.mixedFormat')}
                          </div>
                          {isMobile && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, font: "400 10.5px/1.2 'IBM Plex Mono', monospace", color: '#3C74C4' }}>
                              <span>{formatRatings?.mixed?.gamesCount || 0} {t('leaderboard.matchesAbbr')}</span>
                              <ConfidenceChip confidence={formatRatings?.mixed?.confidence} games={formatRatings?.mixed?.gamesCount} dots={false} />
                            </div>
                          )}
                        </div>
                        <span style={{ height: 9, borderRadius: 999, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', overflow: 'hidden', display: 'flex' }}>
                          <span style={{ width: `${Math.min(100, Math.max(10, Math.round(((formatRatings?.mixed?.rating ?? DEFAULT_RATING) - 1000) / 12)))}%`, background: '#3C74C4' }} />
                        </span>
                        <span style={{ textAlign: 'right', font: "600 13px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                          {formatRatings?.mixed?.rating ?? DEFAULT_RATING}
                        </span>
                        {!isMobile && (
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, font: "400 11px/1 'IBM Plex Mono', monospace", color: '#3C74C4' }}>
                            <span>{formatRatings?.mixed?.gamesCount || 0} {t('leaderboard.matchesAbbr')}</span>
                            <ConfidenceChip confidence={formatRatings?.mixed?.confidence} games={formatRatings?.mixed?.gamesCount} dots={false} />
                          </span>
                        )}
                      </div>

                      {/* Đơn nam */}
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '76px minmax(0,1fr) 48px' : '92px minmax(0,1fr) 52px 64px', gap: isMobile ? 8 : 10, alignItems: 'center' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ font: "600 12.5px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t('profile.singlesFormat')}
                          </div>
                          {isMobile && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, font: "400 10.5px/1.2 'IBM Plex Mono', monospace", color: isDark ? '#F0B75C' : '#D97706' }}>
                              <span>{formatRatings?.singles?.gamesCount || 0} {t('leaderboard.matchesAbbr')}</span>
                              <ConfidenceChip confidence={formatRatings?.singles?.confidence} games={formatRatings?.singles?.gamesCount} dots={false} />
                            </div>
                          )}
                        </div>
                        <span style={{ height: 9, borderRadius: 999, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', overflow: 'hidden', display: 'flex' }}>
                          <span style={{ width: `${Math.min(100, Math.max(10, Math.round(((formatRatings?.singles?.rating ?? DEFAULT_RATING) - 1000) / 12)))}%`, background: isDark ? '#475569' : '#94A3B8' }} />
                        </span>
                        <span style={{ textAlign: 'right', font: "600 13px/1 'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>
                          ~{formatRatings?.singles?.rating ?? DEFAULT_RATING}
                        </span>
                        {!isMobile && (
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, font: "400 11px/1 'IBM Plex Mono', monospace", color: isDark ? '#F0B75C' : '#D97706' }}>
                            <span>{formatRatings?.singles?.gamesCount || 0} {t('leaderboard.matchesAbbr')}</span>
                            <ConfidenceChip confidence={formatRatings?.singles?.confidence} games={formatRatings?.singles?.gamesCount} dots={false} />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {formatRatings?.insight && (
                    <div
                      style={{
                        font: "400 12.5px/1.55 'IBM Plex Sans', sans-serif",
                        color: 'var(--text-muted)',
                        borderTop: '1px solid var(--border-subtle)',
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
                    background: isDark ? '#141D2E' : 'var(--surface-card)',
                    border: isDark ? '1px solid #22304A' : '1px solid var(--border-subtle)',
                    borderRadius: 12,
                    padding: 16,
                    display: 'grid',
                    gap: 14,
                    minWidth: 0,
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ font: "600 15px/1.2 'IBM Plex Sans', sans-serif", flex: '1 1 auto', color: 'var(--text-primary)' }}>
                      {t('profile.whoSynergizes', { name: member.name })}
                    </span>
                    <span style={{ font: "400 12px/1.2 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
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
                        const partMember = membersMap[part.id] || part.partner
                        const pAvatar = getMemberAvatar(partMember)

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
                              background: isTopPartner
                                ? (isDark ? 'rgba(0,178,169,.12)' : 'rgba(13,148,136,.08)')
                                : isLowPartner
                                  ? (isDark ? 'rgba(224,138,0,.10)' : 'rgba(217,119,6,.06)')
                                  : (isDark ? '#101927' : 'var(--surface-sunken)'),
                              border: isTopPartner
                                ? (isDark ? '1px solid #00786F' : '1px solid rgba(13,148,136,.35)')
                                : (isDark ? '1px solid #22304A' : '1px solid var(--border-subtle)'),
                              cursor: 'pointer',
                              minWidth: 0,
                            }}
                          >
                            {/* Hàng 1: Avatar + Tên + (Thể thức · Số trận) bên trái | W-L + Synergy bên phải */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: '1 1 auto' }}>
                                <Avatar name={part.name} src={pAvatar} size={26} />
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ font: "600 13.5px/1.25 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {part.name}
                                  </div>
                                  <div style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                                    {part.format === 'XD' ? t('leaderboard.filterXD') : t('leaderboard.filterMD')} · {part.games} {t('leaderboard.matchesAbbr')}
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                <span style={{ textAlign: 'right', font: "400 12px/1 'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>
                                  {part.wins}–{part.losses}
                                </span>
                                <span
                                  style={{
                                    textAlign: 'right',
                                    font: '700 17px/1 Barlow, sans-serif',
                                    color: isTopPartner
                                      ? (isDark ? '#5FDBD3' : '#0D9488')
                                      : isLowPartner
                                        ? (isDark ? '#F09A8E' : '#DC2626')
                                        : (part.synergyScore >= 50 ? 'var(--text-primary)' : (isDark ? '#F0B75C' : '#D97706')),
                                    minWidth: 26,
                                  }}
                                >
                                  {part.synergyScore}
                                </span>
                              </div>
                            </div>

                            {/* Hàng 2: Kỳ vọng vs Thực tế + Thanh Pair Impact */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
                              <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {part.expectedWinPct}% → {part.actualWinPct}%
                              </span>
                              <span style={{ position: 'relative', height: 7, flex: 1, borderRadius: 999, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                                <span style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--border-subtle)' }} />
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
                              gridTemplateColumns: '28px minmax(80px,1fr) 42px 96px 100px 38px',
                              gap: 8,
                              alignItems: 'center',
                              padding: '10px 12px',
                              borderRadius: 8,
                              background: isTopPartner
                                ? (isDark ? 'rgba(0,178,169,.12)' : 'rgba(13,148,136,.08)')
                                : isLowPartner
                                  ? (isDark ? 'rgba(224,138,0,.10)' : 'rgba(217,119,6,.06)')
                                  : (isDark ? '#101927' : 'var(--surface-sunken)'),
                              border: isTopPartner
                                ? (isDark ? '1px solid #00786F' : '1px solid rgba(13,148,136,.35)')
                                : (isDark ? '1px solid #22304A' : '1px solid var(--border-subtle)'),
                              cursor: 'pointer',
                              minWidth: 0,
                            }}
                          >
                            <Avatar name={part.name} src={pAvatar} size={26} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ font: "600 13.5px/1.25 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {part.name}
                              </div>
                              <div style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {part.format === 'XD' ? t('leaderboard.filterXD') : t('leaderboard.filterMD')} · {part.games} {t('leaderboard.matchesAbbr')}
                              </div>
                            </div>
                            <span style={{ textAlign: 'right', font: "400 12px/1 'IBM Plex Mono', monospace", color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              {part.wins}–{part.losses}
                            </span>
                            <span style={{ textAlign: 'right', font: "400 11px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {part.expectedWinPct}% → {part.actualWinPct}%
                            </span>
                            <span style={{ position: 'relative', height: 9, borderRadius: 999, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', display: 'block' }}>
                              <span style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--border-subtle)' }} />
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
                                color: isTopPartner
                                  ? (isDark ? '#5FDBD3' : '#0D9488')
                                  : isLowPartner
                                    ? (isDark ? '#F09A8E' : '#DC2626')
                                    : (part.synergyScore >= 50 ? 'var(--text-primary)' : (isDark ? '#F0B75C' : '#D97706')),
                              }}
                            >
                              {part.synergyScore}
                            </span>
                          </div>
                        )
                      })
                    ) : (
                      <div style={{ font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                        {t('common.noData')}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Đồng đội tốt nhất, Khắc chế & kỵ giơ, Phân tích dưới kỳ vọng, Phong độ 10 trận */}
              <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
                {/* Đồng đội tốt nhất */}
                {partnersAndMatchups?.bestPartner && (() => {
                  const bestPartMember = membersMap[partnersAndMatchups.bestPartner.id] || partnersAndMatchups.bestPartner.partner
                  const bpAvatar = getMemberAvatar(bestPartMember)
                  return (
                    <div
                      style={{
                        background: isDark
                          ? 'linear-gradient(180deg, rgba(0,178,169,.16), #141D2E)'
                          : 'linear-gradient(180deg, rgba(13,148,136,.12), var(--surface-card))',
                        border: isDark ? '1px solid #00786F' : '1px solid rgba(13,148,136,.35)',
                        borderRadius: 12,
                        padding: 16,
                        display: 'grid',
                        gap: 10,
                        minWidth: 0,
                        boxShadow: 'var(--shadow-xs)',
                      }}
                    >
                      <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '.06em', textTransform: 'uppercase', color: isDark ? '#5FDBD3' : '#0D9488' }}>
                        {t('profile.bestPartnerBox')}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={partnersAndMatchups.bestPartner.name} src={bpAvatar} size={36} />
                        <div style={{ font: '700 20px/1.2 Barlow, sans-serif', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                          {partnersAndMatchups.bestPartner.name}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ font: '700 26px/1 Barlow, sans-serif', color: isDark ? '#5FDBD3' : '#0D9488' }}>
                          {partnersAndMatchups.bestPartner.synergyScore}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                          <span>{t('leaderboard.synergyCol')} · {partnersAndMatchups.bestPartner.games} {t('leaderboard.matchesAbbr')}</span>
                          <ConfidenceChip games={partnersAndMatchups.bestPartner.games} dots={false} />
                        </span>
                      </div>
                    </div>
                  )
                })()}

                {/* Khắc chế & kỵ giơ */}
                <div style={{ background: isDark ? '#141D2E' : 'var(--surface-card)', border: isDark ? '1px solid #22304A' : '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden', minWidth: 0, boxShadow: 'var(--shadow-xs)' }}>
                  <div style={{ padding: '11px 14px', background: 'var(--surface-sunken)', borderBottom: '1px solid var(--border-subtle)', font: "600 13px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                    {t('profile.matchupSection')}
                  </div>
                  <div style={{ padding: '13px 14px', display: 'grid', gap: 12 }}>
                    {/* Thích gặp */}
                    <div style={{ display: 'grid', gap: 7, minWidth: 0 }}>
                      <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '.06em', textTransform: 'uppercase', color: isDark ? '#5FDBD3' : '#0D9488' }}>
                        {t('profile.favoriteMatchup')}
                      </div>
                      {(partnersAndMatchups?.matchups?.favorite || []).length > 0 ? (
                        (partnersAndMatchups?.matchups?.favorite || []).map((fav, fIdx) => {
                          const favMember = membersMap[fav.oppId] || fav.opponent
                          const fAvatar = getMemberAvatar(favMember)
                          return (
                            <div
                              key={fIdx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 8,
                                padding: '8px 10px',
                                borderRadius: 6,
                                background: isDark ? 'rgba(0,178,169,.09)' : 'rgba(13,148,136,.08)',
                                font: "400 12.5px/1.4 'IBM Plex Sans', sans-serif",
                                color: 'var(--text-primary)',
                                minWidth: 0,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                                <Avatar name={fav.oppName} src={fAvatar} size={20} />
                                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>vs {fav.oppName}</span>
                              </div>
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: isDark ? '#5FDBD3' : '#0D9488', fontWeight: 600, flexShrink: 0 }}>{fav.winRate}%</span>
                            </div>
                          )
                        })
                      ) : (
                        <div style={{ font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>{t('common.noData')}</div>
                      )}
                    </div>

                    {/* Kỵ giơ */}
                    <div style={{ display: 'grid', gap: 7, borderTop: '1px solid var(--border-subtle)', paddingTop: 11, minWidth: 0 }}>
                      <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '.06em', textTransform: 'uppercase', color: isDark ? '#F0B75C' : '#B45309' }}>
                        {t('profile.nemesisMatchup')}
                      </div>
                      {(partnersAndMatchups?.matchups?.nemesis || []).length > 0 ? (
                        (partnersAndMatchups?.matchups?.nemesis || []).map((nem, nIdx) => {
                          const nemMember = membersMap[nem.oppId] || nem.opponent
                          const nAvatar = getMemberAvatar(nemMember)
                          return (
                            <div
                              key={nIdx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 8,
                                padding: '8px 10px',
                                borderRadius: 6,
                                background: isDark ? 'rgba(224,138,0,.10)' : 'rgba(217,119,6,.08)',
                                font: "400 12.5px/1.4 'IBM Plex Sans', sans-serif",
                                color: 'var(--text-primary)',
                                minWidth: 0,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                                <Avatar name={nem.oppName} src={nAvatar} size={20} />
                                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>vs {nem.oppName}</span>
                              </div>
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: isDark ? '#F0B75C' : '#B45309', fontWeight: 600, flexShrink: 0 }}>{nem.winRate}%</span>
                            </div>
                          )
                        })
                      ) : (
                        <div style={{ font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>{t('common.noData')}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Vì sao dưới kỳ vọng */}
                {partnersAndMatchups?.matchups?.underperformingAnalysis && (
                  <div style={{ background: isDark ? '#141D2E' : 'rgba(245, 158, 11, 0.06)', border: isDark ? '1px solid #E08A00' : '1px solid rgba(245, 158, 11, 0.35)', borderRadius: 12, padding: 14, display: 'grid', gap: 9 }}>
                    <div style={{ font: "600 13px/1.3 'IBM Plex Sans', sans-serif", color: isDark ? '#F0B75C' : '#B45309' }}>
                      {t('profile.whyUnderperforming', {
                        name: member.name,
                        partner: partnersAndMatchups.matchups.underperformingAnalysis.partnerName || '',
                      })}
                    </div>
                    <div style={{ font: "400 12.5px/1.55 'IBM Plex Sans', sans-serif", color: 'var(--text-secondary)' }}>
                      {partnersAndMatchups.matchups.underperformingAnalysis.analysisText}
                    </div>
                    <div style={{ font: "400 12px/1.5 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: 9 }}>
                      {t('leaderboard.underperformingDisclaimer')}
                    </div>
                  </div>
                )}

                {/* Phong độ 10 trận */}
                <div style={{ background: isDark ? '#141D2E' : 'var(--surface-card)', border: isDark ? '1px solid #22304A' : '1px solid var(--border-subtle)', borderRadius: 12, padding: 14, display: 'grid', gap: 8, boxShadow: 'var(--shadow-xs)' }}>
                  <div style={{ font: "600 13px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
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
                          background: (typeof item === 'object' ? item.won : item === 'W')
                            ? '#00B2A9'
                            : (isDark ? '#2E3E5C' : 'var(--surface-inset)'),
                          border: (typeof item === 'object' ? item.won : item === 'W')
                            ? 'none'
                            : '1px solid var(--border-subtle)',
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ font: "400 12px/1.4 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                    {stats.wins10}T – {stats.losses10}B · {t('profile.form10OldestLeft')}
                  </div>
                </div>
              </div>
            </div>

            {/* Thống kê đối đầu trực tiếp H2H */}
            {/* Gặp nhiều nhất */}
              {h2hData.mostMet ? (() => {
                const oppMember = membersMap[h2hData.mostMet.id]
                const oppAvatar = getMemberAvatar(oppMember)
                return (
                  <div style={{ ...S.cardBox, gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={S.cardBoxLabel}>{t('leaderboard.h2hMostMet')}</span>
                      <span style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                        {h2hData.mostMet.total} {t('units.match')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={member.name} src={getMemberAvatar(member)} size={32} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                          <span style={{ font: '600 15px/1.25 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {member.name}
                          </span>
                          <span style={{ font: '700 22px/1.05 Barlow, sans-serif', color: isDark ? '#5FD9A2' : '#059669' }}>
                            {h2hData.mostMet.wins}
                          </span>
                        </div>
                      </div>
                      <span style={{ font: '600 12px/1 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>VS</span>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end', minWidth: 0 }}>
                          <span style={{ font: '600 15px/1.25 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {playerName(db, h2hData.mostMet.id)}
                          </span>
                          <span style={{ font: '700 22px/1.05 Barlow, sans-serif', color: 'var(--text-secondary)' }}>
                            {h2hData.mostMet.total - h2hData.mostMet.wins}
                          </span>
                        </div>
                        <Avatar name={playerName(db, h2hData.mostMet.id)} src={oppAvatar} size={32} />
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
                )
              })() : (
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
                    h2hData.toughest.map((op) => {
                      const opMember = membersMap[op.id]
                      const opAvatar = getMemberAvatar(opMember)
                      return (
                        <div key={op.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                          <Avatar name={playerName(db, op.id)} src={opAvatar} size={26} />
                          <span style={{ flex: 1, font: '600 14px/1.3 "IBM Plex Sans", sans-serif', minWidth: 0, color: 'var(--text-primary)' }}>
                            {playerName(db, op.id)}
                            {op.isGuest && (
                              <span style={{ marginLeft: 6, font: '600 10px/1 "IBM Plex Sans", sans-serif', padding: '2px 6px', borderRadius: 999, background: 'rgba(224,138,0,.18)', color: isDark ? '#F0B75C' : '#B45309' }}>
                                {t('leaderboard.guestTag')}
                              </span>
                            )}
                          </span>
                          <span style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                            {op.total} {t('units.match')}
                          </span>
                          <span style={{ font: '600 14px/1.3 "IBM Plex Mono", monospace', color: isDark ? '#FF8578' : '#DC2626', width: 56, textAlign: 'right' }}>
                            {op.winRate}%
                          </span>
                        </div>
                      )
                    })
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
                    h2hData.bestPartners.map((pt) => {
                      const ptMember = membersMap[pt.id]
                      const ptAvatar = getMemberAvatar(ptMember)
                      return (
                        <div key={pt.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: isDark ? 'rgba(0,178,169,.14)' : 'rgba(13,148,136,.08)', border: isDark ? '1px solid #00786F' : '1px solid rgba(13,148,136,.3)' }}>
                          <Avatar name={playerName(db, pt.id)} src={ptAvatar} size={26} />
                          <span style={{ flex: 1, font: '600 14px/1.3 "IBM Plex Sans", sans-serif', minWidth: 0, color: isDark ? '#5FDBD3' : '#0F766E' }}>
                            {member.name} + {playerName(db, pt.id)}
                          </span>
                          <span style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                            {pt.total} {t('units.match')}
                          </span>
                          <span style={{ font: '600 14px/1.3 "IBM Plex Mono", monospace', color: isDark ? '#5FDBD3' : '#0F766E', width: 56, textAlign: 'right' }}>
                            {pt.winRate}%
                          </span>
                        </div>
                      )
                    })
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
                    <span style={{ color: isDark ? '#5FDBD3' : 'var(--text-accent)', fontWeight: 600 }}>{xpData.totalXp.toLocaleString()} XP</span>
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
                        <span style={{ color: isDark ? '#5FDBD3' : 'var(--text-accent)', fontWeight: 600 }}>+{r.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Đang bị treo thưởng (Bounty) */}
              {seasonBounty && (
                <div style={{ background: isDark ? 'rgba(224,138,0,.14)' : 'rgba(217,119,6,.08)', border: isDark ? '1px solid #B26A00' : '1px solid rgba(217,119,6,.3)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ font: '600 11px/1.2 "IBM Plex Sans", sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: isDark ? '#F0B75C' : '#B45309' }}>
                      {t('leaderboard.xpBountyTitle')}
                    </span>
                    <span style={{ font: '600 13px/1.3 "IBM Plex Mono", monospace', color: isDark ? '#F0B75C' : '#B45309' }}>
                      +40 XP
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 8, background: isDark ? 'rgba(224,138,0,.22)' : 'rgba(217,119,6,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 16px/1 Barlow, sans-serif', color: isDark ? '#F0B75C' : '#B45309', flexShrink: 0 }}>
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
                        <span style={{ font: '600 14px/1.3 "IBM Plex Mono", monospace', color: isDark ? '#5FD9A2' : '#059669' }}>
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
                {achievements.length === 0 ? (
                  <span style={{ font: '400 13px/1.5 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                    {t('common.empty')}
                  </span>
                ) : (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 9 }}>
                  {achievements.map((ach) => (
                    <div
                      key={ach.id}
                      style={{
                        background: ach.achieved ? 'var(--surface-card)' : 'var(--surface-sunken)',
                        border: ach.achieved ? (isDark ? '1px solid #00786F' : '1px solid rgba(13,148,136,.4)') : '1px dashed var(--border-default)',
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
                      <span style={{ font: '400 12px/1.4 "IBM Plex Mono", monospace', color: ach.achieved ? (isDark ? '#5FDBD3' : 'var(--text-accent)') : 'var(--text-muted)' }}>
                        {ach.progressText}
                      </span>
                    </div>
                  ))}
                </div>
                )}
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
    gap: 7,
    padding: '8px 18px',
    borderRadius: 999,
    background: 'linear-gradient(135deg, #FF6B00 0%, #EA580C 100%)',
    color: '#FFFFFF',
    border: 'none',
    font: '700 13px/1 "IBM Plex Sans", sans-serif',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(234, 88, 12, 0.35)',
    transition: 'all 0.15s ease',
    flexShrink: 0,
  },
  subTabBtn: {
    flex: 1,
    minHeight: 38,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '0 10px',
    borderRadius: 8,
    background: 'transparent',
    border: '1px solid transparent',
    font: '600 13px/1 "IBM Plex Sans", sans-serif',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  subTabBtnActive: {
    background: 'var(--surface-card)',
    borderColor: 'var(--border-subtle)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    color: 'var(--text-accent)',
    fontWeight: 700,
  },
}
