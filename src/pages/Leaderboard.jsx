import { useState, useMemo } from 'react'
import { Button, Card, Icon, Input, Select, StatCard } from '#ds'
import { LevelChip, Mono, Overline, SearchSelect } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { confidenceOf, confidenceProgress, computeClubCalibration, getPlayerRating, rankTierOf, applyInactivityDecay, kFactorOf, MIN_RATING } from '#lib/rating.js'
import { playerName } from '#lib/money.js'
import { searchMatches, headToHeadMatrix, neverMetPairs } from '#lib/matchSearch.js'
import { RANK_THEMES, DEFAULT_RANK_THEME, getMemberBadge } from '#data/rankThemes.js'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }
import EditScoreModal from '#components/challenge/EditScoreModal.jsx'
import CreateChallengeModal from '#components/challenge/CreateChallengeModal.jsx'
import RatingLineChart from '#components/challenge/RatingLineChart.jsx'

/**
 * Trợ thủ ghép màu kèm độ trong suốt (alpha).
 * - Nếu là hex (#RRGGBB): nối chuỗi hex (#RRGGBBAA) — tương thích mọi trình duyệt từ 2016+.
 * - Nếu là CSS variable (var(--token, #hex)):
 *   + Trình duyệt hiện đại hỗ trợ color-mix(): dùng color-mix(in srgb, var(...) pct%, transparent).
 *   + Trình duyệt cũ hơn (chưa có color-mix): trích xuất hex fallback (#hex) rồi ghép hex (#hex + alphaHex)
 *     để nền và border không bị mất hoàn toàn (graceful degradation).
 * - Bảo vệ chống "mìn" vỡ CSS khi token hóa badge.color / tier.color sau này.
 */
function alphaColor(color, alphaHex, pct) {
  if (!color) return 'transparent'
  const isVar = typeof color === 'string' && color.startsWith('var(')
  if (!isVar) {
    return `${color}${alphaHex}`
  }

  const p = pct ?? Math.min(100, Math.max(0, Math.round((parseInt(alphaHex, 16) / 255) * 100)))

  // Trình duyệt không hỗ trợ color-mix() -> degrade an toàn về hex fallback nếu có
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    if (!CSS.supports('color', 'color-mix(in srgb, red, blue)')) {
      const fallbackMatch = color.match(/#[0-9a-fA-F]{6}\b/)
      if (fallbackMatch) return `${fallbackMatch[0]}${alphaHex}`
    }
  }

  return `color-mix(in srgb, ${color} ${p}%, transparent)`
}

export default function Leaderboard() {
  const { db } = useApp()
  const isMobile = useMobile()
  const [activeTab, setActiveTab] = useState('season') // 'season' | 'chart' | 'search' | 'matrix' | 'cross'
  const yearFilter = '2026'
  const [searchName, setSearchName] = useState('')
  const [activeFilter, setActiveFilter] = useState('all') // 'all' | 'active'
  const [rankTheme, setRankTheme] = useState(DEFAULT_RANK_THEME)

  // State cho Tab 2 (Biểu đồ / Profile)
  const [selectedMemberId, setSelectedMemberId] = useState(null)

  // State cho Tab 3 (Tìm trận)
  const [playerA, setPlayerA] = useState('')
  const [playerB, setPlayerB] = useState('')
  const [searchMode, setSearchMode] = useState('vs') // 'vs' | 'team'
  const [qualityFilter, setQualityFilter] = useState('all') // 'all' | 'close' | 'upset'
  const [editingMatch, setEditingMatch] = useState(null)

  // State cho Gạ kèo (K6)
  const [challengeModalOpen, setChallengeModalOpen] = useState(false)
  const [initialTeamA, setInitialTeamA] = useState([])
  const [initialTeamB, setInitialTeamB] = useState([])

  const activeMembers = useMemo(() => {
    return (db.members || []).filter((m) => m.active !== false)
  }, [db.members])

  const memberMap = useMemo(() => {
    const map = {}
    activeMembers.forEach((m) => { map[m.id] = m })
    return map
  }, [activeMembers])

  const memberNameOf = (id) => playerName(db, id)

  // -------------------------------------------------------------
  // TAB 1: Dữ liệu Bảng xếp hạng Mùa giải
  // -------------------------------------------------------------
  const leaderboardData = useMemo(() => {
    const matches = db.matches || []
    return activeMembers.map((m) => {
      const pr = getPlayerRating(db.playerRatings, m.id, m, db.levels)
      const gamesCount = pr.gamesCount
      const confidence = pr.confidence || confidenceOf(gamesCount)

      // Tính thắng thua từ matches (hỗ trợ cả teamA/teamB lẫn playerKeys)
      let wins = 0
      let losses = 0
      const myMatches = []
      matches.forEach((mt) => {
        const teamA = mt.teamA || (mt.playerKeys ? mt.playerKeys.slice(0, 2) : [])
        const teamB = mt.teamB || (mt.playerKeys ? mt.playerKeys.slice(2, 4) : [])
        const inA = teamA.includes(m.id)
        const inB = teamB.includes(m.id)
        if (inA || inB) {
          const won = (inA && mt.winnerTeam === 'A') || (inB && mt.winnerTeam === 'B')
          if (won) wins++
          else losses++
          myMatches.push({ ...mt, won, at: mt.at || (mt.playedAt ? Date.parse(mt.playedAt) : 0) })
        }
      })

      // Form 5 trận gần nhất (sắp xếp theo thời gian mới nhất trước)
      myMatches.sort((a, b) => (b.at || 0) - (a.at || 0))
      const form = myMatches.slice(0, 5).map((x) => (x.won ? 'W' : 'L')).reverse()

      const totalGames = wins + losses
      const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0

      const lastMatchDate = myMatches[0]?.at ? new Date(myMatches[0].at).toISOString() : (pr.lastMatchAt || null)
      const decay = applyInactivityDecay(pr.rating, lastMatchDate)
      const displayRating = Math.max(MIN_RATING, decay.rating)
      const tier = rankTierOf(displayRating, rankTheme)
      const k = kFactorOf(totalGames || gamesCount)

      return {
        id: m.id,
        name: m.name,
        gender: m.gender,
        level: m.level,
        rating: pr.rating,
        displayRating,
        tier,
        isInactive: decay.isInactive,
        daysInactive: decay.daysInactive,
        decayAmount: decay.decayAmount,
        k,
        gamesCount: totalGames || gamesCount,
        wins,
        losses,
        winRate,
        confidence,
        form,
      }
    }).filter((row) => {
      if (activeFilter === 'active' && row.isInactive) return false
      if (!searchName.trim()) return true
      return row.name.toLowerCase().includes(searchName.toLowerCase())
    }).sort((a, b) => b.displayRating - a.displayRating)
  }, [activeMembers, db.playerRatings, db.matches, searchName, activeFilter, rankTheme, db.levels])

  // -------------------------------------------------------------
  // TAB 2: Biểu đồ & Phân rã ngữ cảnh của 1 thành viên
  // -------------------------------------------------------------
  const currentMember = useMemo(() => {
    const targetId = selectedMemberId || leaderboardData[0]?.id || activeMembers[0]?.id
    return activeMembers.find((m) => m.id === targetId) || null
  }, [selectedMemberId, leaderboardData, activeMembers])

  const profileContext = useMemo(() => {
    if (!currentMember) return null
    const mid = currentMember.id
    const matches = db.matches || []
    
    let vsMaleWins = 0, vsMaleLoss = 0
    let vsFemaleWins = 0, vsFemaleLoss = 0
    let doublesWins = 0, doublesLoss = 0
    let singlesWins = 0, singlesLoss = 0

    matches.forEach((mt) => {
      const teamA = mt.teamA || (mt.playerKeys ? mt.playerKeys.slice(0, 2) : [])
      const teamB = mt.teamB || (mt.playerKeys ? mt.playerKeys.slice(2, 4) : [])
      const inA = teamA.includes(mid)
      const inB = teamB.includes(mid)
      if (!inA && !inB) return

      const won = (inA && mt.winnerTeam === 'A') || (inB && mt.winnerTeam === 'B')
      const oppTeam = inA ? teamB : teamA
      const hasFemaleOpp = oppTeam.some((id) => (memberMap[id]?.gender || '').toLowerCase() === 'nu')
      const hasMaleOpp = oppTeam.some((id) => (memberMap[id]?.gender || '').toLowerCase() === 'nam')

      if (hasMaleOpp) {
        if (won) vsMaleWins++
        else vsMaleLoss++
      }
      if (hasFemaleOpp) {
        if (won) vsFemaleWins++
        else vsFemaleLoss++
      }

      const isDoubles = (teamA.length === 2 && teamB.length === 2)
      if (isDoubles) {
        if (won) doublesWins++
        else doublesLoss++
      } else {
        if (won) singlesWins++
        else singlesLoss++
      }
    })

    const overallRating = getPlayerRating(db.playerRatings, mid, memberMap[mid], db.levels).rating
    const totalG = vsMaleWins + vsMaleLoss + vsFemaleWins + vsFemaleLoss
    const overallConf = confidenceOf(totalG)

    return {
      overallRating,
      overallConf,
      vsMale: { wins: vsMaleWins, loss: vsMaleLoss, total: vsMaleWins + vsMaleLoss, conf: confidenceOf(vsMaleWins + vsMaleLoss) },
      vsFemale: { wins: vsFemaleWins, loss: vsFemaleLoss, total: vsFemaleWins + vsFemaleLoss, conf: confidenceOf(vsFemaleWins + vsFemaleLoss) },
      doubles: { wins: doublesWins, loss: doublesLoss, total: doublesWins + doublesLoss, conf: confidenceOf(doublesWins + doublesLoss) },
      singles: { wins: singlesWins, loss: singlesLoss, total: singlesWins + singlesLoss, conf: confidenceOf(singlesWins + singlesLoss) },
    }
  }, [currentMember, db.matches, memberMap, db.playerRatings, db.levels])

  // -------------------------------------------------------------
  // TAB 3: Dữ liệu Tìm trận
  // -------------------------------------------------------------
  const searchResults = useMemo(() => {
    const ratingsMap = {}
    activeMembers.forEach((m) => {
      ratingsMap[m.id] = getPlayerRating(db.playerRatings, m.id, m, db.levels).rating
    })

    return searchMatches(db.matches || [], {
      playerA: playerA || null,
      playerB: playerB || null,
      mode: searchMode,
      quality: qualityFilter,
      ratingsMap,
    })
  }, [db.matches, playerA, playerB, searchMode, qualityFilter, db.playerRatings, activeMembers, db.levels])

  // -------------------------------------------------------------
  // TAB 4: Ma trận Đối đầu H2H
  // -------------------------------------------------------------
  const topMembersForMatrix = useMemo(() => {
    const sorted = [...activeMembers].sort((a, b) => {
      const ra = getPlayerRating(db.playerRatings, a.id, a, db.levels).rating
      const rb = getPlayerRating(db.playerRatings, b.id, b, db.levels).rating
      return rb - ra
    })
    const limit = cfg.rating?.h2hMatrixLimit ?? 8
    return sorted.slice(0, limit)
  }, [activeMembers, db.playerRatings, db.levels])
  const matrixData = useMemo(() => {
    return headToHeadMatrix(topMembersForMatrix, db.matches || [])
  }, [topMembersForMatrix, db.matches])

  const neverMetList = useMemo(() => {
    return neverMetPairs(activeMembers, db.matches || [])
  }, [activeMembers, db.matches])

  // -------------------------------------------------------------
  // TAB 5: Thống kê Hiệu chỉnh chéo giới (Calibration)
  // -------------------------------------------------------------
  const calibrationStats = useMemo(() => {
    return computeClubCalibration(db.matches || [], memberMap)
  }, [db.matches, memberMap])

  // Thống kê Mùa giải cho Tab 1
  const seasonStats = useMemo(() => {
    const matches = db.matches || []
    const totalMatches = matches.length
    const ratedPlayersCount = leaderboardData.filter((r) => r.gamesCount > 0).length

    let upsetMatchesCount = 0
    matches.forEach((m) => {
      const ra = m.initialRatingA || 0
      const rb = m.initialRatingB || 0
      if (Math.abs(ra - rb) > 100 && ((ra < rb && m.winnerTeam === 'A') || (rb < ra && m.winnerTeam === 'B'))) {
        upsetMatchesCount++
      }
    })

    // Tìm người có chuỗi thắng (streak W) dài nhất hiện tại
    let maxStreak = 0
    let bountyPlayer = null
    leaderboardData.forEach((row) => {
      let streak = 0
      for (let i = row.form.length - 1; i >= 0; i--) {
        if (row.form[i] === 'W') streak++
        else break
      }
      if (streak >= 3 && streak > maxStreak) {
        maxStreak = streak
        bountyPlayer = { ...row, streak }
      }
    })

    return {
      totalMatches,
      ratedPlayersCount,
      upsetMatchesCount,
      bountyPlayer,
    }
  }, [db.matches, leaderboardData])

  // Thống kê Đối đầu H2H chi tiết giữa Player A và Player B cho Tab 3
  const h2hSummary = useMemo(() => {
    if (!playerA || !playerB || playerA === playerB) return null
    const all = db.matches || []
    const vsMatches = all.filter((m) => {
      const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
      const teamB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])
      const aIn1 = teamA.includes(playerA) && teamB.includes(playerB)
      const aIn2 = teamB.includes(playerA) && teamA.includes(playerB)
      return aIn1 || aIn2
    })
    const teamMatches = all.filter((m) => {
      const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
      const teamB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])
      const same1 = teamA.includes(playerA) && teamA.includes(playerB)
      const same2 = teamB.includes(playerA) && teamB.includes(playerB)
      return same1 || same2
    })

    let aWins = 0
    let bWins = 0
    let closeCount = 0
    let upsetCount = 0
    let challengeCount = 0
    let netDelta = 0

    vsMatches.forEach((m) => {
      const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
      const inA = teamA.includes(playerA)
      const aWon = (inA && m.winnerTeam === 'A') || (!inA && m.winnerTeam === 'B')
      if (aWon) aWins++
      else bWins++

      const delta = m.eloDelta || 0
      netDelta += (aWon ? delta : -delta)

      if (m.challengeId || m.sourceType === 'challenge') challengeCount++

      const sets = m.sets || []
      const isClose = sets.some((s) => s && s[0] != null && s[1] != null && Math.abs(s[0] - s[1]) <= 3)
      if (isClose) closeCount++

      const ra = m.initialRatingA || 0
      const rb = m.initialRatingB || 0
      if (Math.abs(ra - rb) > 100 && ((ra < rb && m.winnerTeam === 'A') || (rb < ra && m.winnerTeam === 'B'))) {
        upsetCount++
      }
    })

    let tmWins = 0
    let tmLoss = 0
    let lastDate = null
    let lastWon = false
    const sortedTm = [...teamMatches].sort((x, y) => (y.at || 0) - (x.at || 0))
    sortedTm.forEach((m, idx) => {
      const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
      const inA = teamA.includes(playerA)
      const won = (inA && m.winnerTeam === 'A') || (!inA && m.winnerTeam === 'B')
      if (won) tmWins++
      else tmLoss++
      if (idx === 0) {
        lastDate = m.createdAt ? `${m.createdAt.slice(8, 10)}/${m.createdAt.slice(5, 7)}` : null
        lastWon = won
      }
    })

    const totalVs = aWins + bWins
    const aWinRate = totalVs > 0 ? ((aWins / totalVs) * 100).toFixed(1) : '0.0'
    const bWinRate = totalVs > 0 ? ((bWins / totalVs) * 100).toFixed(1) : '0.0'
    const tmTotal = tmWins + tmLoss
    const tmWinRate = tmTotal > 0 ? ((tmWins / tmTotal) * 100).toFixed(1) : '0.0'

    return {
      totalVs,
      aWins,
      bWins,
      aWinRate,
      bWinRate,
      closeCount,
      upsetCount,
      challengeCount,
      netDelta,
      relationshipTone: aWins > bWins ? 'easy' : bWins > aWins ? 'tough' : 'balanced',
      tmTotal,
      tmWins,
      tmLoss,
      tmWinRate,
      lastDate,
      lastWon,
    }
  }, [playerA, playerB, db.matches])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* ---------------- 1. Tab Bar chính của Leaderboard ---------------- */}
      <div style={S.tabBarWrap}>
        <div style={S.tabTrack}>
          <button
            type="button"
            onClick={() => setActiveTab('season')}
            style={{ ...S.tabBtn, ...(activeTab === 'season' ? S.tabBtnActive : {}) }}
          >
            {t('leaderboard.tabSeason', { year: yearFilter })}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chart')}
            style={{ ...S.tabBtn, ...(activeTab === 'chart' ? S.tabBtnActive : {}) }}
          >
            {t('leaderboard.tabChart')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            style={{ ...S.tabBtn, ...(activeTab === 'search' ? S.tabBtnActive : {}) }}
          >
            {t('leaderboard.tabSearch')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            style={{ ...S.tabBtn, ...(activeTab === 'matrix' ? S.tabBtnActive : {}) }}
          >
            {t('leaderboard.tabMatrix')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cross')}
            style={{ ...S.tabBtn, ...(activeTab === 'cross' ? S.tabBtnActive : {}) }}
          >
            {t('leaderboard.tabCross')}
          </button>
        </div>
      </div>

      {/* ---------------- TAB 1: Bảng xếp hạng Mùa giải ---------------- */}
      {activeTab === 'season' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* 4 StatCards Mùa giải */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <StatCard
              label={t('leaderboard.statCurrentSeason')}
              value={t('leaderboard.season', { year: yearFilter })}
              sub={t('leaderboard.statSeasonRange')}
            />
            <StatCard
              label={t('leaderboard.statTotalMatches')}
              value={seasonStats.totalMatches}
              sub={t('leaderboard.statMatchesDesc')}
            />
            <StatCard
              label={t('leaderboard.statRatedPlayers')}
              value={`${seasonStats.ratedPlayersCount}/${activeMembers.length}`}
              sub={t('leaderboard.statPlayersDesc')}
            />
            <StatCard
              label={t('leaderboard.statUpsetMatches')}
              value={seasonStats.upsetMatchesCount}
              sub={t('leaderboard.statUpsetDesc')}
            />
          </div>

          {/* Banner Treo thưởng nếu có người streak thắng >= 3 */}
          {seasonStats.bountyPlayer && (
            <div style={S.bountyBanner}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={S.bountyIconWrap}>🎯</div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={S.bountyTitle}>{t('leaderboard.seasonBounty')}</span>
                    <span style={S.bountyBadge}>{t('leaderboard.bountyReward')}</span>
                  </div>
                  <div style={S.bountyDesc}>
                    {t('leaderboard.bountyDesc', { name: seasonStats.bountyPlayer.name, streak: seasonStats.bountyPlayer.streak })}
                  </div>
                </div>
              </div>
              <button
                type="button"
                style={S.challengeBtn}
                onClick={() => {
                  setInitialTeamA([])
                  setInitialTeamB([seasonStats.bountyPlayer.id])
                  setChallengeModalOpen(true)
                }}
              >
                ⚔️ {t('leaderboard.challengeMember', { name: seasonStats.bountyPlayer.name })}
              </button>
            </div>
          )}

          <div style={S.card}>
            {/* Header & Bộ lọc */}
            <div style={S.cardHead}>
              <div style={{ flex: 1, minWidth: 200, display: 'grid', gap: 2 }}>
                <div style={S.cardTitle}>{t('leaderboard.title')} · {t('leaderboard.season', { year: yearFilter })}</div>
                <div style={S.cardSub}>{t('leaderboard.sub')}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', width: isMobile ? '100%' : 'auto' }}>
                <Select
                  size="sm"
                  value={rankTheme}
                  onChange={(e) => setRankTheme(e.target.value)}
                  options={RANK_THEMES.map((th) => ({
                    value: th.key,
                    label: th.label,
                  }))}
                  style={{ width: isMobile ? '100%' : 175 }}
                  title={t('leaderboard.themeHint')}
                />
                <Select
                  size="sm"
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value)}
                  options={[
                    { value: 'all', label: t('leaderboard.filterAll') },
                    { value: 'active', label: t('leaderboard.filterActiveOnly') },
                  ]}
                  style={{ width: isMobile ? '100%' : 150 }}
                />
                <Input
                  size="sm"
                  placeholder={t('leaderboard.searchPlaceholder')}
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  style={{ width: isMobile ? '100%' : 170 }}
                />
              </div>
            </div>

            {/* Bọc bảng có thanh cuộn ngang an toàn cho mobile 390px */}
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <div style={{ minWidth: 720 }}>
                {/* Header Bảng */}
                <div style={S.seasonTableHead}>
                  <div style={S.thCell}>{t('leaderboard.rank')}</div>
                  <div style={S.thCell}>{t('leaderboard.player')}</div>
                  <div style={S.thCell}>{t('leaderboard.tierCol')}</div>
                  <div style={{ ...S.thCell, textAlign: 'right' }}>{t('rating.elo')}</div>
                  <div style={S.thCell}>{t('rating.confidence.label')}</div>
                  <div style={{ ...S.thCell, textAlign: 'center' }}>{t('leaderboard.winLoss')}</div>
                  <div style={{ ...S.thCell, textAlign: 'right' }}>{t('leaderboard.winRate')}</div>
                  <div style={{ ...S.thCell, textAlign: 'center' }}>{t('leaderboard.recentForm')}</div>
                </div>

                {/* Danh sách thành viên */}
                <div style={{ display: 'grid' }}>
                  {leaderboardData.map((row, idx) => {
                    const rank = idx + 1
                    const rankColor = rank === 1 ? 'var(--podium-gold, #F0B75C)' : rank === 2 ? 'var(--podium-silver, #C0D8F8)' : rank === 3 ? 'var(--podium-bronze, #CD7F32)' : 'var(--text-muted, #8494AA)'
                    const confLabel = t('rating.confidence.' + (row.confidence || 'low'))
                    const confPct = row.confidence === 'very_high' ? 100 : row.confidence === 'high' ? 75 : row.confidence === 'medium' ? 50 : 25

                    return (
                      <div key={row.id} style={S.seasonTableRow}>
                        {/* Cột Hạng */}
                        <div style={S.tdCell}>
                          <span style={{ font: '700 16px/1 Barlow, sans-serif', color: rankColor }}>
                            #{rank}
                          </span>
                        </div>

                        {/* Cột Tên & Trình độ */}
                        <div style={{ ...S.tdCell, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ font: '600 14px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary, #E9EFF7)' }}>
                            {row.name}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted, #8494AA)' }}>({row.gender})</span>
                          <LevelChip level={row.level} levels={db.levels} />
                          {row.isInactive && (
                            <span
                              style={{
                                fontSize: 10,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: 'var(--amber-950, #2D1F10)',
                                color: 'var(--status-delayed-fg, #F0B75C)',
                                border: '1px solid var(--amber-700, #784A15)',
                              }}
                              title={t('rating.inactivity.days', { n: row.daysInactive })}
                            >
                              {t('leaderboard.inactiveBadge')}
                            </span>
                          )}
                        </div>

                        {/* Cột Cấp bậc Rank */}
                        <div style={S.tdCell}>
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 7 }}
                            title={rankTheme === 'comedy' ? row.tier.quip : undefined}
                          >
                            <span style={{
                              width: 22,
                              height: 22,
                              borderRadius: 5,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: alphaColor(row.tier.color, '1E', 12),
                              border: `1px solid ${alphaColor(row.tier.color, '66', 40)}`,
                              color: row.tier.color,
                              boxShadow: `0 0 8px ${alphaColor(row.tier.color, '25', 15)}`,
                              flexShrink: 0,
                            }}>
                              <Icon name={row.tier.icon} size={12} />
                            </span>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: row.tier.color }}>
                              {row.tier.label}
                            </span>
                          </div>
                        </div>

                        {/* Cột Elo */}
                        <div style={{ ...S.tdCell, textAlign: 'right' }}>
                          <span style={{ font: '700 15px/1 "IBM Plex Mono", monospace', color: 'var(--status-transit-fg, #5FDBD3)' }}>
                            {row.displayRating}
                          </span>
                        </div>

                        {/* Cột Độ tin cậy */}
                        <div style={S.tdCell}>
                          <div style={{ display: 'grid', gap: 3, maxWidth: 100 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary, #A8B7CB)', fontWeight: 500 }}>{confLabel}</span>
                            <div style={{ height: 4, borderRadius: 999, background: 'var(--surface-page, #0B1220)', overflow: 'hidden' }}>
                              <div style={{ width: `${confPct}%`, height: '100%', background: 'var(--teal-500, #00B2A9)' }} />
                            </div>
                          </div>
                        </div>

                        {/* Cột Thắng - Thua */}
                        <div style={{ ...S.tdCell, textAlign: 'center' }}>
                          <span style={{ font: '500 13px/1 "IBM Plex Mono", monospace', color: 'var(--text-primary, #E9EFF7)' }}>
                            {row.wins} – {row.losses}
                          </span>
                        </div>

                        {/* Cột Tỷ lệ thắng */}
                        <div style={{ ...S.tdCell, textAlign: 'right' }}>
                          <span style={{ font: '600 13px/1 "IBM Plex Mono", monospace', color: row.winRate >= 60 ? 'var(--status-delivered-fg, #5FD9A2)' : 'var(--text-primary, #E9EFF7)' }}>
                            {row.winRate}%
                          </span>
                        </div>

                        {/* Cột Phong độ Form W/L */}
                        <div style={{ ...S.tdCell, display: 'flex', justifyContent: 'center', gap: 4 }}>
                          {row.form.length > 0 ? (
                            row.form.map((res, i) => (
                              <span
                                key={i}
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: 999,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  background: res === 'W' ? 'rgba(18,168,103,.2)' : 'rgba(225,68,52,.2)',
                                  color: res === 'W' ? 'var(--status-delivered-fg, #5FD9A2)' : 'var(--status-incident-fg, #FF9A8F)',
                                  border: `1px solid ${res === 'W' ? 'var(--green-600, #00875A)' : 'rgba(225,68,52,.4)'}`,
                                }}
                              >
                                {res}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-muted, #8494AA)' }}>—</span>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {leaderboardData.length === 0 && (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted, #8494AA)', fontSize: 13 }}>
                      {t('leaderboard.empty')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB 2: Biểu đồ & Phân rã ngữ cảnh ---------------- */}
      {activeTab === 'chart' && currentMember && profileContext && (() => {
        const totalMemberGames = profileContext.vsMale.total + profileContext.vsFemale.total
        const confProg = confidenceProgress(totalMemberGames)

        return (
          <div style={{ display: 'grid', gap: 16 }}>
            {/* Header chọn thành viên & Tổng quan Profile */}
            <div style={S.card}>
              <div style={{ padding: '16px', display: 'grid', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ font: '600 18px/1.25 "IBM Plex Sans", sans-serif', color: 'var(--text-primary, #E9EFF7)' }}>
                      {t('leaderboard.profileRating')}: {currentMember.name}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted, #8494AA)' }}>({currentMember.gender})</span>
                    <LevelChip level={currentMember.level} levels={db.levels} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
                    <Select
                      value={currentMember.id}
                      options={activeMembers.map((m) => ({ value: m.id, label: m.name }))}
                      onChange={(e) => setSelectedMemberId(e.target.value)}
                      style={{ width: isMobile ? '100%' : 180 }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setInitialTeamA([])
                        setInitialTeamB([currentMember.id])
                        setChallengeModalOpen(true)
                      }}
                      style={{ ...S.challengeBtn, width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}
                    >
                      ⚔️ {t('leaderboard.challengeMember', { name: currentMember.name })}
                    </button>
                  </div>
                </div>

                {/* Card tiến trình độ tin cậy Rating R1 -> R5 & Rank Tier */}
                {(() => {
                  const pr = getPlayerRating(db.playerRatings, currentMember.id, currentMember, db.levels)
                  const memberTier = rankTierOf(profileContext.overallRating, rankTheme)
                  const memberK = kFactorOf(pr.gamesCount)
                  const memberMatches = (db.matches || []).filter(
                    (mt) =>
                      (mt.playerKeys || []).includes(currentMember.id) ||
                      (mt.teamA || []).includes(currentMember.id) ||
                      (mt.teamB || []).includes(currentMember.id)
                  )
                  const sortedMemberMatches = [...memberMatches].sort((a, b) => (b.at || 0) - (a.at || 0))
                  const lastMatchDate = sortedMemberMatches[0]?.at ? new Date(sortedMemberMatches[0].at).toISOString() : (pr.lastMatchAt || null)
                  const decayInfo = applyInactivityDecay(pr.rating, lastMatchDate)

                  return (
                    <div style={{ padding: '14px 16px', borderRadius: 8, background: 'var(--surface-inset, #101927)', border: '1px solid var(--border-subtle, #22304A)', display: 'grid', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ font: '700 28px/1 "IBM Plex Mono", monospace', color: 'var(--status-transit-fg, #5FDBD3)' }}>
                            {decayInfo.rating}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted, #8494AA)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Elo {t('rating.breakdown.overall')}
                          </span>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: 6,
                            background: alphaColor(memberTier.color, '1E', 12),
                            border: `1px solid ${memberTier.color}`,
                            boxShadow: `0 0 10px ${alphaColor(memberTier.color, '30', 19)}`,
                            color: memberTier.color,
                            fontSize: 12,
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}>
                            <Icon name={memberTier.icon} size={13} />
                            <span>{memberTier.label}</span>
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--status-transit-fg, #5FDBD3)', fontFamily: '"IBM Plex Mono", monospace' }}>
                            {t('rating.kFactor', { k: memberK })}
                          </span>
                          {decayInfo.isInactive && (
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--amber-950, #2D1F10)', color: 'var(--status-delayed-fg, #F0B75C)', border: '1px solid var(--amber-700, #784A15)' }}>
                              {t('rating.inactivity.days', { n: decayInfo.daysInactive })}
                              {decayInfo.decayAmount > 0 && ` (${t('rating.inactivity.decayed', { amount: decayInfo.decayAmount })})`}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: 999,
                            background: 'rgba(0,178,169,0.15)',
                            border: '1px solid var(--teal-700, #00786F)',
                            color: 'var(--status-transit-fg, #5FDBD3)',
                            fontSize: 12,
                            fontWeight: 700,
                          }}>
                            {t('rating.confidence.levelR', { num: confProg.levelNum })}
                          </span>
                          <span style={{ fontSize: 13, color: 'var(--text-secondary, #A8B7CB)', fontWeight: 500 }}>
                            {t('rating.confidence.' + profileContext.overallConf)}
                          </span>
                        </div>
                      </div>

                      {rankTheme === 'comedy' && memberTier.quip && (
                        <div style={{
                          fontStyle: 'italic',
                          fontSize: 12.5,
                          color: 'var(--text-secondary, #A8B7CB)',
                          background: 'rgba(255,255,255,0.03)',
                          padding: '8px 14px',
                          borderRadius: 6,
                          borderLeft: `3px solid ${memberTier.color}`,
                        }}>
                          "{memberTier.quip}"
                        </div>
                      )}

                      {/* Thanh tiến trình Progress Bar */}
                      <div style={{ display: 'grid', gap: 5 }}>
                        <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-page, #0B1220)', overflow: 'hidden', border: '1px solid var(--surface-raised, #1A2437)' }}>
                          <div style={{
                            width: `${confProg.pct}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, var(--teal-700, #00786F), var(--teal-500, #00B2A9))',
                            transition: 'width 0.3s ease',
                          }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-muted, #8494AA)' }}>
                          <span>
                            {confProg.isMax
                              ? t('rating.confidence.maxReached')
                              : t('rating.confidence.progress', { needed: confProg.needed, nextLevel: confProg.nextLevel })}
                          </span>
                          <span style={{ fontFamily: '"IBM Plex Mono", monospace' }}>
                            {confProg.current}/{confProg.target} ({confProg.pct}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Playstyle Badge & Quip Card */}
            {(() => {
              const badge = getMemberBadge(currentMember.id)
              return (
                <div style={{
                  padding: '16px 20px',
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, rgba(16, 25, 39, 0.95) 0%, rgba(10, 16, 26, 0.95) 100%)',
                  border: `1px solid ${alphaColor(badge.color, '40', 25)}`,
                  boxShadow: `0 4px 20px ${alphaColor(badge.color, '15', 8)}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: `linear-gradient(135deg, ${alphaColor(badge.color, '25', 15)} 0%, ${alphaColor(badge.color, '0A', 4)} 100%)`,
                      border: `1.5px solid ${badge.color}`,
                      boxShadow: `0 0 14px ${alphaColor(badge.color, '35', 21)}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: badge.color,
                      flexShrink: 0,
                    }}>
                      <Icon name={badge.icon} size={20} />
                    </div>
                    <div style={{ display: 'grid', gap: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: alphaColor(badge.color, '22', 13),
                          border: `1px solid ${alphaColor(badge.color, '55', 33)}`,
                          color: badge.color,
                          fontSize: 10.5,
                          fontFamily: '"IBM Plex Mono", monospace',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                        }}>
                          [{badge.tag}]
                        </span>
                        <span style={{ font: '700 14px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary, #E9EFF7)' }}>
                          {badge.name}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary, #A8B7CB)', fontStyle: 'italic' }}>
                        "{badge.desc}"
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: isMobile ? '100%' : 'auto' }}>
                    <Select
                      size="sm"
                      value={rankTheme}
                      onChange={(e) => setRankTheme(e.target.value)}
                      options={RANK_THEMES.map((th) => ({
                        value: th.key,
                        label: th.label,
                      }))}
                      style={{ width: isMobile ? '100%' : 165 }}
                      title={t('leaderboard.themeHint')}
                    />
                  </div>
                </div>
              )
            })()}

            {/* Biểu đồ Rating SVG với dải tin cậy và bộ lọc 5 ngữ cảnh */}
            <RatingLineChart
              member={currentMember}
              matches={db.matches || []}
              matchEdits={db.matchEdits || []}
              sessions={db.sessions || []}
              levels={db.levels || []}
              isMobile={isMobile}
            />

            {/* 4 Card Ngữ cảnh */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              <div style={S.contextCard}>
                <div style={S.contextHead}>{t('rating.breakdown.vsMale')}</div>
                <div style={S.contextScore}>{profileContext.vsMale.wins}W – {profileContext.vsMale.loss}L</div>
                <div style={S.contextMeta}>{t('leaderboard.totalGamesMeta', { n: profileContext.vsMale.total, conf: t('rating.confidence.' + profileContext.vsMale.conf) })}</div>
              </div>
              <div style={S.contextCard}>
                <div style={S.contextHead}>{t('rating.breakdown.vsFemale')}</div>
                <div style={S.contextScore}>{profileContext.vsFemale.wins}W – {profileContext.vsFemale.loss}L</div>
                <div style={S.contextMeta}>{t('leaderboard.totalGamesMeta', { n: profileContext.vsFemale.total, conf: t('rating.confidence.' + profileContext.vsFemale.conf) })}</div>
              </div>
              <div style={S.contextCard}>
                <div style={S.contextHead}>{t('rating.breakdown.doubles')}</div>
                <div style={S.contextScore}>{profileContext.doubles.wins}W – {profileContext.doubles.loss}L</div>
                <div style={S.contextMeta}>{t('leaderboard.totalGamesMeta', { n: profileContext.doubles.total, conf: t('rating.confidence.' + profileContext.doubles.conf) })}</div>
              </div>
              <div style={S.contextCard}>
                <div style={S.contextHead}>{t('rating.breakdown.singles')}</div>
                <div style={S.contextScore}>{profileContext.singles.wins}W – {profileContext.singles.loss}L</div>
                <div style={S.contextMeta}>{t('leaderboard.totalGamesMeta', { n: profileContext.singles.total, conf: t('rating.confidence.' + profileContext.singles.conf) })}</div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ---------------- TAB 3: Tìm trận & Sửa tỷ số inline ---------------- */}
      {activeTab === 'search' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Bộ lọc Tìm trận */}
          <div style={S.card}>
            <div style={{ padding: '14px 16px', display: 'grid', gap: 12 }}>
              <div style={S.cardTitle}>{t('matchSearch.title')}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <Select
                  value={playerA}
                  options={[{ value: '', label: `-- ${t('matchSearch.playerA')} --` }, ...activeMembers.map((m) => ({ value: m.id, label: m.name }))]}
                  onChange={(e) => setPlayerA(e.target.value)}
                  style={{ width: isMobile ? '100%' : 170 }}
                />
                <Select
                  value={searchMode}
                  options={[
                    { value: 'vs', label: t('matchSearch.modeH2H') },
                    { value: 'team', label: t('matchSearch.modeTeammate') },
                  ]}
                  onChange={(e) => setSearchMode(e.target.value)}
                  style={{ width: isMobile ? '100%' : 120 }}
                />
                <Select
                  value={playerB}
                  options={[{ value: '', label: `-- ${t('matchSearch.playerB')} --` }, ...activeMembers.map((m) => ({ value: m.id, label: m.name }))]}
                  onChange={(e) => setPlayerB(e.target.value)}
                  style={{ width: isMobile ? '100%' : 170 }}
                />
                <Select
                  value={qualityFilter}
                  options={[
                    { value: 'all', label: t('matchSearch.qualityAll') },
                    { value: 'close', label: t('matchSearch.qualityClose') },
                    { value: 'upset', label: t('matchSearch.qualityUpset') },
                  ]}
                  onChange={(e) => setQualityFilter(e.target.value)}
                  style={{ width: isMobile ? '100%' : 180 }}
                />
                {/* Nút Gạ kèo giữa 2 người chơi khi đã chọn cả 2 */}
                {playerA && playerB && playerA !== playerB && (
                  <button
                    type="button"
                    onClick={() => {
                      setInitialTeamA([playerA])
                      setInitialTeamB([playerB])
                      setChallengeModalOpen(true)
                    }}
                    style={{ ...S.challengeBtn, width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}
                  >
                    ⚔️ {t('matchSearch.challengeBetween')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Cột kép: Bảng tìm trận bên trái & Tóm tắt H2H bên phải */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: (!isMobile && h2hSummary) ? 'minmax(0, 1fr) 340px' : '1fr',
            gap: 16,
            alignItems: 'start',
          }}>
            {/* Bảng kết quả tìm trận có scroll ngang an toàn trên mobile */}
            <div style={S.card}>
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <div style={{ minWidth: 780 }}>
                  <div style={S.searchTableHead}>
                    <div style={S.thCell}>{t('matchSearch.colCode')}</div>
                    <div style={S.thCell}>{t('matchSearch.colWhen')}</div>
                    <div style={S.thCell}>{t('matchSearch.colWinner')}</div>
                    <div style={{ ...S.thCell, textAlign: 'center' }}>{t('matchSearch.colScore')}</div>
                    <div style={S.thCell}>{t('matchSearch.colLoser')}</div>
                    <div style={{ ...S.thCell, textAlign: 'center' }}>Elo</div>
                    <div style={{ ...S.thCell, textAlign: 'center' }}>{t('leaderboard.predLabel')}</div>
                    <div style={S.thCell}>{t('matchSearch.colSource')}</div>
                    <div style={{ ...S.thCell, textAlign: 'center' }}>{t('matchSearch.colAction')}</div>
                  </div>

                  <div style={{ display: 'grid' }}>
                    {searchResults.map((m) => {
                      const teamA = m.teamA || []
                      const teamB = m.teamB || []
                      const aWon = m.winnerTeam === 'A'
                      const winnerNames = (aWon ? teamA : teamB).map(memberNameOf).join(' · ')
                      const loserNames = (aWon ? teamB : teamA).map(memberNameOf).join(' · ')
                      const scoreStr = (m.sets || []).map(([a, b]) => `${a}-${b}`).join(', ')
                      const isChallenge = Boolean(m.challengeId || m.sourceType === 'challenge')
                      const delta = m.eloDelta || 0
                      const ra = m.initialRatingA || 0
                      const rb = m.initialRatingB || 0
                      const isUpset = Math.abs(ra - rb) > 100 && ((ra < rb && aWon) || (rb < ra && !aWon))
                      const isClose = (m.sets || []).some((s) => s && s[0] != null && s[1] != null && Math.abs(s[0] - s[1]) <= 3)

                      return (
                        <div key={m.id} style={S.searchTableRow}>
                          <div style={S.tdCell}>
                            <span style={S.monoCode}>{m.code || 'M-000'}</span>
                          </div>
                          <div style={S.tdCell}>
                            <span style={S.monoMeta}>{m.createdAt?.slice(0, 10) || ''}</span>
                          </div>
                          <div style={{ ...S.tdCell, minWidth: 0 }}>
                            <span style={{ font: '600 13.5px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--status-delivered-fg, #5FD9A2)' }}>
                              {winnerNames}
                            </span>
                          </div>
                          <div style={{ ...S.tdCell, display: 'flex', justifyContent: 'center' }}>
                            <span style={{ font: '700 15px/1 Barlow, sans-serif', color: 'var(--text-primary, #E9EFF7)', whiteSpace: 'nowrap' }}>
                              {scoreStr}
                            </span>
                          </div>
                          <div style={{ ...S.tdCell, minWidth: 0 }}>
                            <span style={{ font: '600 13.5px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary, #A8B7CB)' }}>
                              {loserNames}
                            </span>
                          </div>
                          {/* Cột Delta Elo (+ / -) */}
                          <div style={{ ...S.tdCell, textAlign: 'center' }}>
                            {delta > 0 ? (
                              <span style={{ font: '600 12px "IBM Plex Mono", monospace', color: 'var(--status-delivered-fg, #5FD9A2)' }}>
                                +{delta} / -{delta}
                              </span>
                            ) : (
                              <span style={{ font: '400 12px "IBM Plex Mono", monospace', color: 'var(--text-muted, #8494AA)' }}>—</span>
                            )}
                          </div>
                          {/* Cột Dự đoán */}
                          <div style={{ ...S.tdCell, textAlign: 'center' }}>
                            {isUpset ? (
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(240,183,92,.18)', color: 'var(--status-delayed-fg, #F0B75C)', border: '1px solid rgba(240,183,92,.4)' }}>
                                {t('leaderboard.predUpset')}
                              </span>
                            ) : isClose ? (
                              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'rgba(95,219,211,.14)', color: 'var(--status-transit-fg, #5FDBD3)', border: '1px solid rgba(95,219,211,.3)' }}>
                                {t('leaderboard.predClose')}
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--text-muted, #8494AA)' }}>
                                {t('leaderboard.predCorrect')}
                              </span>
                            )}
                          </div>
                          <div style={S.tdCell}>
                            <span style={{
                              ...S.sourcePill,
                              background: isChallenge ? 'rgba(0,178,169,.14)' : 'rgba(255,255,255,.06)',
                              borderColor: isChallenge ? 'var(--teal-700, #00786F)' : 'var(--border-subtle, #22304A)',
                              color: isChallenge ? 'var(--status-transit-fg, #5FDBD3)' : 'var(--text-muted, #8494AA)',
                            }}>
                              {isChallenge ? t('challenge.challenge') : t('challenge.fromCourt')}
                            </span>
                          </div>
                          <div style={{ ...S.tdCell, display: 'flex', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setEditingMatch(m)}
                              style={S.editBtn}
                            >
                              {t('matchSearch.btnEdit')}
                            </button>
                          </div>
                        </div>
                      )
                    })}

                    {searchResults.length === 0 && (
                      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted, #8494AA)', fontSize: 13 }}>
                        {t('matchSearch.emptySearch')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Cột phải: Thẻ tóm tắt Đối đầu H2H (nếu chọn đủ 2 người) */}
            {h2hSummary && (
              <div style={S.card}>
                <div style={{ padding: '16px', display: 'grid', gap: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={S.cardTitle}>
                        {t('leaderboard.h2hTitle', { nameA: memberNameOf(playerA), nameB: memberNameOf(playerB) })}
                      </div>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: h2hSummary.relationshipTone === 'tough' ? 'rgba(225,68,52,.15)' : h2hSummary.relationshipTone === 'easy' ? 'rgba(18,168,103,.15)' : 'rgba(255,255,255,.08)',
                        color: h2hSummary.relationshipTone === 'tough' ? 'var(--status-incident-fg, #FF9A8F)' : h2hSummary.relationshipTone === 'easy' ? 'var(--status-delivered-fg, #5FD9A2)' : 'var(--text-secondary, #A8B7CB)',
                        border: `1px solid ${h2hSummary.relationshipTone === 'tough' ? 'rgba(225,68,52,.4)' : h2hSummary.relationshipTone === 'easy' ? 'rgba(18,168,103,.4)' : 'var(--border-subtle, #22304A)'}`,
                      }}>
                        {h2hSummary.relationshipTone === 'tough' ? t('leaderboard.toughOpponent') : h2hSummary.relationshipTone === 'easy' ? t('leaderboard.easyOpponent') : t('leaderboard.balancedOpponent')}
                      </span>
                    </div>
                    <div style={S.cardSub}>{t('leaderboard.h2hSubtitle')}</div>
                  </div>

                  {/* Tỷ số H2H to */}
                  <div style={S.h2hScoreBig}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted, #8494AA)', marginBottom: 2 }}>{memberNameOf(playerA)}</div>
                      <div style={{ font: '700 28px/1 "IBM Plex Mono", monospace', color: 'var(--status-delivered-fg, #5FD9A2)' }}>{h2hSummary.aWins}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted, #8494AA)' }}>{h2hSummary.aWinRate}%</div>
                    </div>
                    <div style={{ font: '700 20px/1 "IBM Plex Mono", monospace', color: 'var(--text-muted, #8494AA)' }}>:</div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted, #8494AA)', marginBottom: 2 }}>{memberNameOf(playerB)}</div>
                      <div style={{ font: '700 28px/1 "IBM Plex Mono", monospace', color: 'var(--status-transit-fg, #5FDBD3)' }}>{h2hSummary.bWins}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted, #8494AA)' }}>{h2hSummary.bWinRate}%</div>
                    </div>
                  </div>

                  {/* Rating ròng */}
                  <div style={S.h2hStatRow}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-secondary, #A8B7CB)' }}>{t('leaderboard.netRating')}</span>
                    <span style={{ font: '700 13px "IBM Plex Mono", monospace', color: h2hSummary.netDelta >= 0 ? 'var(--status-delivered-fg, #5FD9A2)' : 'var(--status-incident-fg, #FF9A8F)' }}>
                      {h2hSummary.netDelta >= 0 ? `+${h2hSummary.netDelta}` : h2hSummary.netDelta}
                    </span>
                  </div>

                  {/* Chi tiết trận */}
                  <div style={S.h2hStatsBox}>
                    <div style={S.h2hStatRow}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted, #8494AA)' }}>{t('matchSearch.qualityClose')}</span>
                      <span style={{ font: '600 12px "IBM Plex Mono", monospace', color: 'var(--text-primary, #E9EFF7)' }}>{h2hSummary.closeCount}</span>
                    </div>
                    <div style={S.h2hStatRow}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted, #8494AA)' }}>{t('matchSearch.qualityUpset')}</span>
                      <span style={{ font: '600 12px "IBM Plex Mono", monospace', color: 'var(--text-primary, #E9EFF7)' }}>{h2hSummary.upsetCount}</span>
                    </div>
                    <div style={S.h2hStatRow}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted, #8494AA)' }}>{t('challenge.challenge')}</span>
                      <span style={{ font: '600 12px "IBM Plex Mono", monospace', color: 'var(--text-primary, #E9EFF7)' }}>{h2hSummary.challengeCount}</span>
                    </div>
                  </div>

                  {/* Khi cùng đội */}
                  <div style={{ ...S.h2hStatsBox, background: 'var(--surface-inset, #101927)' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary, #E9EFF7)', marginBottom: 2 }}>
                      {t('leaderboard.whenTeammates')}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted, #8494AA)', marginBottom: 8 }}>
                      {t('leaderboard.teammateSubtitle', { total: h2hSummary.tmTotal, nameA: memberNameOf(playerA), nameB: memberNameOf(playerB) })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ font: '700 16px "IBM Plex Mono", monospace', color: 'var(--status-delivered-fg, #5FD9A2)' }}>
                        {h2hSummary.tmWins}W – {h2hSummary.tmLoss}L
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted, #8494AA)' }}>
                        {t('leaderboard.winRateLabel')}: <strong style={{ color: 'var(--text-primary, #E9EFF7)' }}>{h2hSummary.tmWinRate}%</strong>
                      </span>
                    </div>
                    {h2hSummary.lastDate && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted, #8494AA)', marginTop: 6 }}>
                        {t('leaderboard.lastTeammateMatch')}: {h2hSummary.lastDate} ({h2hSummary.lastWon ? t('leaderboard.wonStatus') : t('leaderboard.lostStatus')})
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- TAB 4: Ma trận Đối đầu H2H ---------------- */}
      {activeTab === 'matrix' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={S.card}>
            <div style={S.cardHead}>
              <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
                <div style={S.cardTitle}>{t('matchSearch.matrixTitle')}</div>
                <div style={S.cardSub}>{t('matchSearch.matrixDesc')}</div>
              </div>
            </div>

            <div style={{ padding: 16, overflowX: 'auto' }}>
              <table style={S.matrixTable}>
                <thead>
                  <tr>
                    <th style={S.matrixTh}>VS</th>
                    {topMembersForMatrix.map((m) => (
                      <th key={m.id} style={S.matrixTh}>{m.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topMembersForMatrix.map((p1) => (
                    <tr key={p1.id}>
                      <td style={S.matrixRowLabel}>{p1.name}</td>
                      {topMembersForMatrix.map((p2) => {
                        if (p1.id === p2.id) {
                          return <td key={p2.id} style={S.matrixSelfCell}>—</td>
                        }
                        const cell = matrixData[p1.id]?.[p2.id] || { wins: 0, losses: 0 }
                        const net = cell.wins - cell.losses
                        const cellColor = net > 0 ? 'var(--status-delivered-fg, #5FD9A2)' : net < 0 ? 'var(--status-incident-fg, #FF9A8F)' : 'var(--text-muted, #8494AA)'
                        const cellBg = net > 0 ? 'rgba(18,168,103,.12)' : net < 0 ? 'rgba(225,68,52,.12)' : 'transparent'
                        return (
                          <td key={p2.id} style={{ ...S.matrixCell, color: cellColor, background: cellBg }}>
                            {cell.wins}-{cell.losses}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cặp chưa từng gặp nhau */}
          <div style={S.card}>
            <div style={{ padding: '14px 16px', display: 'grid', gap: 8 }}>
              <div style={{ font: '600 14px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary, #E9EFF7)' }}>
                {t('matchSearch.neverMet')} ({neverMetList.length} {t('matchSearch.pairs')})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {neverMetList.slice(0, 15).map(([id1, id2], idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setInitialTeamA([id1])
                      setInitialTeamB([id2])
                      setChallengeModalOpen(true)
                    }}
                    style={{ ...S.pairBadge, cursor: 'pointer' }}
                    title={t('leaderboard.challengePair')}
                  >
                    ⚔️ {memberNameOf(id1)} · {memberNameOf(id2)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB 5: Thống kê hiệu chỉnh chéo giới ---------------- */}
      {activeTab === 'cross' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={S.card}>
            <div style={S.cardHead}>
              <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
                <div style={S.cardTitle}>{t('rating.calibration.title')}</div>
                <div style={S.cardSub}>{t('rating.calibration.desc')}</div>
              </div>
            </div>

            <div style={{ padding: 16, display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {Object.entries(calibrationStats.buckets).map(([bucketKey, data]) => {
                  const winRatePct = data.sampleSize > 0 ? Math.round((data.femaleWins / data.sampleSize) * 100) : 0
                  return (
                    <div key={bucketKey} style={S.bucketCard}>
                      <div style={S.bucketHead}>{t('leaderboard.gapBucket', { bucket: bucketKey })}</div>
                      <div style={{ font: '700 24px/1 Barlow, sans-serif', color: 'var(--status-transit-fg, #5FDBD3)', margin: '4px 0' }}>
                        {winRatePct}%
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted, #8494AA)' }}>
                        {t('leaderboard.crossStats', { wins: data.femaleWins, total: data.sampleSize })}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ font: '400 13px/1.5 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary, #A8B7CB)', marginTop: 8 }}>
                💡 <em>{t('rating.calibration.desc')}</em>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal sửa điểm inline */}
      {editingMatch && (
        <EditScoreModal
          match={editingMatch}
          onClose={() => setEditingMatch(null)}
          onSaved={() => setEditingMatch(null)}
        />
      )}

      {/* Modal tạo kèo / gạ kèo (K6) */}
      {challengeModalOpen && (
        <CreateChallengeModal
          onClose={() => setChallengeModalOpen(false)}
          onCreated={() => setChallengeModalOpen(false)}
          initialTeamA={initialTeamA}
          initialTeamB={initialTeamB}
        />
      )}
    </div>
  )
}

const S = {
  tabBarWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  tabTrack: {
    display: 'flex',
    padding: 3,
    borderRadius: 8,
    background: 'var(--surface-inset, #101927)',
    border: '1px solid var(--border-subtle, #22304A)',
    gap: 2,
    overflowX: 'auto',
  },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 34,
    padding: '0 14px',
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    font: '600 13px/1 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted, #8494AA)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    background: 'var(--surface-card, #141D2E)',
    color: 'var(--text-primary, #E9EFF7)',
    boxShadow: '0 1px 1px rgba(0,0,0,.30)',
  },
  card: {
    background: 'var(--surface-card, #141D2E)',
    border: '1px solid var(--border-subtle, #22304A)',
    borderRadius: 10,
    boxShadow: '0 1px 1px rgba(0,0,0,.30)',
    overflow: 'hidden',
  },
  cardHead: {
    padding: '14px 16px',
    borderBottom: '1px solid var(--border-subtle, #22304A)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  cardTitle: {
    font: '600 16px/1.25 "IBM Plex Sans", sans-serif',
    color: 'var(--text-primary, #E9EFF7)',
  },
  cardSub: {
    font: '400 13px/1.4 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted, #8494AA)',
  },
  seasonTableHead: {
    display: 'grid',
    gridTemplateColumns: '60px minmax(170px, 1.5fr) 110px 90px 130px 100px 90px 120px',
    background: 'var(--surface-inset, #101927)',
    borderBottom: '1px solid var(--border-subtle, #22304A)',
  },
  seasonTableRow: {
    display: 'grid',
    gridTemplateColumns: '60px minmax(170px, 1.5fr) 110px 90px 130px 100px 90px 120px',
    borderBottom: '1px solid var(--border-subtle, #22304A)',
    minHeight: 48,
    alignItems: 'center',
  },
  searchTableHead: {
    display: 'grid',
    gridTemplateColumns: '75px 80px 1.2fr 90px 1.2fr 75px 75px 80px 70px',
    background: 'var(--surface-inset, #101927)',
    borderBottom: '1px solid var(--border-subtle, #22304A)',
  },
  searchTableRow: {
    display: 'grid',
    gridTemplateColumns: '75px 80px 1.2fr 90px 1.2fr 75px 75px 80px 70px',
    borderBottom: '1px solid var(--border-subtle, #22304A)',
    minHeight: 50,
    alignItems: 'center',
  },
  thCell: {
    padding: '0 12px',
    minHeight: 38,
    display: 'flex',
    alignItems: 'center',
    font: '600 11px/1.2 "IBM Plex Sans", sans-serif',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted, #8494AA)',
  },
  tdCell: {
    padding: '0 12px',
  },
  monoCode: {
    font: '600 12.5px/1.3 "IBM Plex Mono", monospace',
    color: 'var(--status-transit-fg, #5FDBD3)',
  },
  monoMeta: {
    font: '400 12px/1.4 "IBM Plex Mono", monospace',
    color: 'var(--text-muted, #8494AA)',
  },
  sourcePill: {
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 4,
    border: '1px solid',
  },
  editBtn: {
    padding: '4px 10px',
    borderRadius: 4,
    background: 'var(--surface-raised, #1A2437)',
    border: '1px solid var(--border-default, #2E3E5C)',
    color: 'var(--status-transit-fg, #5FDBD3)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  contextCard: {
    padding: '14px 16px',
    borderRadius: 8,
    background: 'var(--surface-inset, #101927)',
    border: '1px solid var(--border-subtle, #22304A)',
    display: 'grid',
    gap: 4,
  },
  contextHead: {
    font: '600 12px/1.2 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted, #8494AA)',
    textTransform: 'uppercase',
  },
  contextScore: {
    font: '700 20px/1.2 "IBM Plex Mono", monospace',
    color: 'var(--text-primary, #E9EFF7)',
  },
  contextMeta: {
    font: '400 12px/1.4 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted, #8494AA)',
  },
  matrixTable: {
    borderCollapse: 'collapse',
    fontSize: 13,
    width: '100%',
  },
  matrixTh: {
    padding: '8px 12px',
    border: '1px solid var(--border-subtle, #22304A)',
    background: 'var(--surface-inset, #101927)',
    color: 'var(--text-muted, #8494AA)',
    fontWeight: 600,
    textAlign: 'center',
  },
  matrixRowLabel: {
    padding: '8px 12px',
    border: '1px solid var(--border-subtle, #22304A)',
    background: 'var(--surface-inset, #101927)',
    color: 'var(--text-primary, #E9EFF7)',
    fontWeight: 600,
  },
  matrixCell: {
    padding: '8px 12px',
    border: '1px solid var(--border-subtle, #22304A)',
    textAlign: 'center',
    fontFamily: '"IBM Plex Mono", monospace',
    fontWeight: 600,
  },
  matrixSelfCell: {
    padding: '8px 12px',
    border: '1px solid var(--border-subtle, #22304A)',
    textAlign: 'center',
    color: 'var(--text-disabled, #5B6B81)',
    background: 'var(--surface-page, #0B1220)',
  },
  pairBadge: {
    padding: '4px 10px',
    borderRadius: 6,
    background: 'var(--surface-inset, #101927)',
    border: '1px solid var(--border-subtle, #22304A)',
    fontSize: 12,
    color: 'var(--text-secondary, #A8B7CB)',
  },
  bucketCard: {
    padding: '14px 16px',
    borderRadius: 8,
    background: 'var(--surface-inset, #101927)',
    border: '1px solid var(--border-subtle, #22304A)',
  },
  bucketHead: {
    font: '600 12px/1.2 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted, #8494AA)',
    textTransform: 'uppercase',
  },
  challengeBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    borderRadius: 6,
    background: 'linear-gradient(135deg, var(--teal-500, #00B2A9), var(--teal-700, #00786F))',
    color: 'var(--gray-0, #FFFFFF)',
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0,178,169,0.3)',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  bountyBanner: {
    padding: '14px 18px',
    borderRadius: 8,
    background: 'linear-gradient(135deg, rgba(240,183,92,.12) 0%, rgba(205,127,50,.10) 100%)',
    border: '1px solid rgba(240,183,92,.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    flexWrap: 'wrap',
  },
  bountyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 8,
    background: 'rgba(240,183,92,.2)',
    border: '1px solid rgba(240,183,92,.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    flexShrink: 0,
  },
  bountyTitle: {
    font: '700 14px "IBM Plex Sans", sans-serif',
    color: 'var(--status-delayed-fg, #F0B75C)',
  },
  bountyBadge: {
    padding: '2px 8px',
    borderRadius: 4,
    background: 'rgba(240,183,92,.25)',
    border: '1px solid var(--status-delayed-fg, #F0B75C)',
    color: 'var(--status-delayed-fg, #F0B75C)',
    fontSize: 11,
    fontWeight: 700,
  },
  bountyDesc: {
    fontSize: 12.5,
    color: 'var(--text-secondary, #A8B7CB)',
    marginTop: 2,
  },
  h2hScoreBig: {
    padding: '14px',
    borderRadius: 8,
    background: 'var(--surface-inset, #101927)',
    border: '1px solid var(--border-subtle, #22304A)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: 8,
  },
  h2hStatsBox: {
    padding: '12px 14px',
    borderRadius: 8,
    border: '1px solid var(--border-subtle, #22304A)',
    display: 'grid',
    gap: 6,
  },
  h2hStatRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
}
