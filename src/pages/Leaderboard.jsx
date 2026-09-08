import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Icon, Input, Select, StatCard } from '#ds'
import { LevelChip, Mono, Overline, SearchSelect, TabTrack } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { confidenceOf, computeClubCalibration, rankTopCrossGenderPlayers, getPlayerRating, rankTierOf, applyInactivityDecay, kFactorOf, MIN_RATING, matchCodeOf, rankPairs } from '#lib/rating.js'
import { playerName, courtOf } from '#lib/money.js'
import { dd } from '#utils/dates.js'
import { searchMatches, headToHeadMatrix, neverMetPairs, topDisparatePairs, neverMetWithSessionCount } from '#lib/matchSearch.js'
import { RANK_THEMES, DEFAULT_RANK_THEME } from '#data/rankThemes.js'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }
import EditScoreModal from '#components/challenge/EditScoreModal.jsx'
import CreateChallengeModal from '#components/challenge/CreateChallengeModal.jsx'
import MemberProfileTab from '#components/profile/MemberProfileTab.jsx'
import MatchDetailModal from '#components/challenge/MatchDetailModal.jsx'
import SeasonRaceTab from '#components/leaderboard/SeasonRaceTab.jsx'
import CareerEloTab from '#components/leaderboard/CareerEloTab.jsx'
import PairsTab from '#components/leaderboard/PairsTab.jsx'
import MemberSeasonLedgerModal from '#components/leaderboard/MemberSeasonLedgerModal.jsx'
import QuadrantMapModal from '#components/leaderboard/QuadrantMapModal.jsx'
import EffectiveStrengthModal from '#components/session/EffectiveStrengthModal.jsx'
import SeasonSettingsModal from '#components/session/SeasonSettingsModal.jsx'
import { calculateSeasonLeaderboard } from '#lib/xp.js'

/**
 * Trợ thủ ghép màu kèm độ trong suốt (alpha).
 */
function alphaColor(color, alphaHex, pct) {
  if (!color) return 'transparent'
  const isVar = typeof color === 'string' && color.startsWith('var(')
  if (!isVar) {
    return `${color}${alphaHex}`
  }

  const p = pct ?? Math.min(100, Math.max(0, Math.round((parseInt(alphaHex, 16) / 255) * 100)))
  return `color-mix(in srgb, ${color} ${p}%, transparent)`
}

/**
 * Lấy tên gọi ngắn gọn của thành viên (ưu tiên tên chính, kèm chữ lót nếu trùng)
 * phục vụ hiển thị header ma trận đối đầu trên mobile.
 */
function getShortDisplayName(fullName, allMembers = []) {
  if (!fullName || typeof fullName !== 'string') return ''
  const trimmed = fullName.trim()
  const parts = trimmed.split(/\s+/)
  const lastName = parts[parts.length - 1]
  const duplicates = (allMembers || []).filter((m) => {
    if (!m || !m.name) return false
    const p = m.name.trim().split(/\s+/)
    return p && p[p.length - 1] === lastName
  })
  if (duplicates.length > 1 && parts.length > 1) {
    const prev = parts[parts.length - 2]
    return `${prev[0] ? prev[0] + '.' : ''} ${lastName}`
  }
  return lastName
}

export default function Leaderboard() {
  const { db, a } = useApp()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const isMobile = useMobile()
  const [activeTab, setActiveTab] = useState('season') // 'season' | 'chart' | 'search' | 'matrix' | 'cross'
  const yearFilter = '2026'
  const [searchName, setSearchName] = useState('')
  const [activeFilter, setActiveFilter] = useState('all') // 'all' | 'active'
  const [guestFilter, setGuestFilter] = useState('members') // 'members' | 'all'
  const [rankTheme, setRankTheme] = useState(DEFAULT_RANK_THEME)

  // State cho Tab 2 (Biểu đồ / Profile)
  const [selectedMemberId, setSelectedMemberId] = useState(null)

  // State cho Tab 3 (Tìm trận)
  const [playerA, setPlayerA] = useState('')
  const [playerB, setPlayerB] = useState('')
  const [searchMode, setSearchMode] = useState('vs') // 'vs' | 'team'
  const [qualityFilter, setQualityFilter] = useState('all') // 'all' | 'close' | 'upset'
  const [editingMatch, setEditingMatch] = useState(null)
  const [viewingMatch, setViewingMatch] = useState(null)
  const [searchCardLimit, setSearchCardLimit] = useState(10)

  // State cho Gạ kèo (K6)
  const [challengeModalOpen, setChallengeModalOpen] = useState(false)
  const [initialTeamA, setInitialTeamA] = useState([])
  const [initialTeamB, setInitialTeamB] = useState([])

  // State cho Hệ 3 tầng (Season & Elo & Matchmaking)
  const [ledgerMemberId, setLedgerMemberId] = useState(null)
  const [quadrantModalOpen, setQuadrantModalOpen] = useState(false)
  const [effectiveStrengthPlayer, setEffectiveStrengthPlayer] = useState(null)
  const [seasonSettingsOpen, setSeasonSettingsOpen] = useState(false)

  const activeMembers = useMemo(() => {
    return (db.members || []).filter((m) => m.active !== false)
  }, [db.members])

  const seasonLeaderboardData = useMemo(() => {
    const raw = calculateSeasonLeaderboard(db, cfg.season)
    const enrichedList = (raw.leaderboard || []).map((row) => {
      const pr = getPlayerRating(db.playerRatings, row.id, row.member || row, db.levels)
      const elo = pr.displayRating || pr.rating || 1500
      const isProv = pr.isProvisional || (pr.gamesCount || 0) < 5
      return {
        ...row,
        rating: elo,
        displayRating: elo,
        gamesCount: pr.gamesCount || 0,
        isProvisional: isProv,
        confidence: pr.confidence || 'low',
      }
    })
    return {
      ...raw,
      leaderboard: enrichedList,
    }
  }, [db])

  const seasonMedianElo = useMemo(() => {
    const list = (seasonLeaderboardData?.leaderboard || [])
      .map((r) => r.displayRating || r.rating || 1500)
      .sort((a, b) => a - b)
    if (!list.length) return 1596
    const mid = Math.floor(list.length / 2)
    return list.length % 2 !== 0
      ? list[mid]
      : Math.round(((list[mid - 1] || 1500) + (list[mid] || 1500)) / 2) || 1500
  }, [seasonLeaderboardData])

  const handleExportCsv = () => {
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF'
    if (activeTab === 'season') {
      csvContent += 'Thứ hạng,Thành viên,Điểm mùa,Số buổi,Số trận,Thắng,Upset\n' // i18n-ok: csv header
      const rows = seasonLeaderboardData?.leaderboard || []
      rows.forEach((r) => {
        csvContent += `"${r.rank}","${r.name}","${r.totalSeasonPoints}","${r.attendedCount || 0}","${r.matchesCount || 0}","${r.winsCount || 0}","${r.upsetsCount || 0}"\n`
      })
    } else if (activeTab === 'pairs') {
      csvContent += 'Thứ hạng,Cặp,Số trận,Kỳ vọng %,Thực tế %,Lệch (pp),Ăn ý,Độ tin cậy\n' // i18n-ok: csv header
      const pData = rankPairs(db.matches || [], memberMap, db.playerRatings || {}, { format: 'all', minGames: 1 })
      ;(pData.rankedPairs || []).forEach((r, idx) => {
        csvContent += `"${idx + 1}","${r.names.join(' - ')}","${r.gamesCount}","${r.expectedWinPct}%","${r.actualWinPct}%","${r.pairImpact}","${r.synergyScore}","${r.confidence}"\n`
      })
    } else {
      csvContent += 'Thứ hạng,Thành viên,Elo,Số trận,Độ tin cậy,Thắng %,30 ngày\n' // i18n-ok: csv header
      leaderboardData.forEach((r) => {
        csvContent += `"${r.rank}","${r.name}","${r.rating}","${r.gamesCount}","${r.confidence}","${r.winRate}%","${r.delta30Days || 0}"\n`
      })
    }
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `badminclub_${activeTab}_leaderboard.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

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
    const memberRows = activeMembers.map((m) => {
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

      // Streak (tính chuỗi thắng liên tiếp từ trận mới nhất)
      let streak = 0
      for (const match of myMatches) {
        if (match.won) streak++
        else break
      }

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
        isGuest: false,
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
        streak,
        lastMatchDate,
      }
    }).sort((a, b) => b.displayRating - a.displayRating)

    // Đánh số thứ hạng 1..N cho thành viên chính thức
    memberRows.forEach((row, idx) => {
      row.rank = idx + 1
    })

    let combined = memberRows

    if (guestFilter === 'all') {
      const guests = db.guests || []
      const guestRows = guests.map((g) => {
        const pr = getPlayerRating(db.playerRatings, g.id, g, db.levels)
        let wins = 0
        let losses = 0
        const guestMatches = []
        matches.forEach((mt) => {
          const teamA = mt.teamA || (mt.playerKeys ? mt.playerKeys.slice(0, 2) : [])
          const teamB = mt.teamB || (mt.playerKeys ? mt.playerKeys.slice(2, 4) : [])
          const inA = teamA.includes(g.id)
          const inB = teamB.includes(g.id)
          if (inA || inB) {
            const won = (inA && mt.winnerTeam === 'A') || (inB && mt.winnerTeam === 'B')
            if (won) wins++
            else losses++
            guestMatches.push({ ...mt, won, at: mt.at || (mt.playedAt ? Date.parse(mt.playedAt) : 0) })
          }
        })
        guestMatches.sort((a, b) => (b.at || 0) - (a.at || 0))
        const form = guestMatches.slice(0, 5).map((x) => (x.won ? 'W' : 'L')).reverse()
        const totalGames = wins + losses
        const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0
        const tier = rankTierOf(pr.rating, rankTheme)

        return {
          id: g.id,
          name: g.name,
          gender: g.gender || 'Nam',
          level: g.level || 'TB',
          rating: pr.rating,
          displayRating: pr.rating,
          tier,
          isGuest: true,
          rank: '—',
          isInactive: false,
          daysInactive: 0,
          decayAmount: 0,
          k: 32,
          gamesCount: totalGames || pr.gamesCount || 0,
          wins,
          losses,
          winRate,
          confidence: 'low',
          form,
        }
      })

      combined = [...memberRows, ...guestRows].sort((a, b) => b.displayRating - a.displayRating)
    }

    return combined.filter((row) => {
      if (activeFilter === 'active' && row.isInactive) return false
      if (!searchName.trim()) return true
      return row.name.toLowerCase().includes(searchName.toLowerCase())
    })
  }, [activeMembers, db.guests, db.playerRatings, db.matches, searchName, activeFilter, guestFilter, rankTheme, db.levels])

  // -------------------------------------------------------------
  // TAB 2: Thành viên hiện tại được chọn cho Profile
  // -------------------------------------------------------------
  const currentMember = useMemo(() => {
    const targetId = selectedMemberId || leaderboardData[0]?.id || activeMembers[0]?.id
    return activeMembers.find((m) => m.id === targetId) || null
  }, [selectedMemberId, leaderboardData, activeMembers])

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
  const [matrixMemberLimit, setMatrixMemberLimit] = useState(() => (isMobile ? 5 : 8))

  // Đếm số trận đối đầu của từng thành viên với các thành viên khác trong CLB
  const memberH2HCounts = useMemo(() => {
    const counts = {}
    const activeIds = new Set((activeMembers || []).map((m) => m.id))
    activeIds.forEach((id) => { counts[id] = 0 })

    ;(db.matches || []).forEach((m) => {
      const teamA = (m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])).filter((id) => activeIds.has(id))
      const teamB = (m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])).filter((id) => activeIds.has(id))
      if (teamA.length && teamB.length && m.winnerTeam) {
        teamA.forEach((idA) => {
          teamB.forEach((idB) => {
            counts[idA] = (counts[idA] || 0) + 1
            counts[idB] = (counts[idB] || 0) + 1
          })
        })
      }
    })
    return counts
  }, [activeMembers, db.matches])

  const topMembersForMatrix = useMemo(() => {
    const sorted = [...activeMembers].filter(Boolean).sort((a, b) => {
      // 1. Ưu tiên thành viên có nhiều trận đối đầu với người khác nhất (chuẩn "hay gặp nhau nhất")
      const countA = memberH2HCounts[a.id] || 0
      const countB = memberH2HCounts[b.id] || 0
      if (countB !== countA) return countB - countA
      // 2. Thứ nhì là rating Elo
      const ra = getPlayerRating(db.playerRatings, a.id, a, db.levels).rating
      const rb = getPlayerRating(db.playerRatings, b.id, b, db.levels).rating
      return rb - ra
    })
    const limit = matrixMemberLimit === 999 ? sorted.length : matrixMemberLimit
    return sorted.slice(0, limit)
  }, [activeMembers, memberH2HCounts, db.playerRatings, db.levels, matrixMemberLimit])

  const matrixData = useMemo(() => {
    return headToHeadMatrix(topMembersForMatrix, db.matches || []) || {}
  }, [topMembersForMatrix, db.matches])

  const fullClubMatrix = useMemo(() => {
    return headToHeadMatrix(activeMembers, db.matches || []) || {}
  }, [activeMembers, db.matches])

  const neverMetList = useMemo(() => {
    return neverMetPairs(activeMembers, db.matches || [])
  }, [activeMembers, db.matches])

  const disparatePairsList = useMemo(() => {
    const raw = topDisparatePairs(fullClubMatrix, activeMembers, 5)
    return (raw || []).map((item) => {
      const p1Obj = memberMap[item.p1] || (db.members || []).find((m) => m.id === item.p1) || { id: item.p1, name: item.p1 }
      const p2Obj = memberMap[item.p2] || (db.members || []).find((m) => m.id === item.p2) || { id: item.p2, name: item.p2 }
      return {
        ...item,
        player1: p1Obj,
        player2: p2Obj,
        wins: item.wins1 ?? 0,
        losses: item.wins2 ?? 0,
      }
    })
  }, [fullClubMatrix, activeMembers, memberMap, db.members])

  const neverMetSessionScored = useMemo(() => {
    const raw = neverMetWithSessionCount(neverMetList, {
      sessions: db.sessions || [],
      attendance: db.attendance || {},
      matches: db.matches || [],
    }, 6)
    return (raw || []).map((item) => {
      const m1 = memberMap[item.p1] || (db.members || []).find((m) => m.id === item.p1) || { id: item.p1, name: item.p1 }
      const m2 = memberMap[item.p2] || (db.members || []).find((m) => m.id === item.p2) || { id: item.p2, name: item.p2 }
      return {
        ...item,
        p1: m1,
        p2: m2,
        commonSessions: item.commonSessionsCount || 0,
      }
    })
  }, [neverMetList, db.sessions, db.attendance, db.matches, memberMap, db.members])

  const editedMatchesCount = useMemo(() => {
    const matchEdits = db.matchEdits || []
    const editedIds = new Set(matchEdits.map((e) => e.matchId))
    return searchResults.filter((m) => editedIds.has(m.id)).length
  }, [db.matchEdits, searchResults])

  const searchHeaderTitle = useMemo(() => {
    if (playerA && playerB) {
      return t('matchSearch.matchesSummary', {
        count: searchResults.length,
        nameA: memberNameOf(playerA),
        nameB: memberNameOf(playerB),
      })
    }
    if (playerA) {
      return t('matchSearch.matchesSummarySingle', {
        count: searchResults.length,
        name: memberNameOf(playerA),
      })
    }
    if (playerB) {
      return t('matchSearch.matchesSummarySingle', {
        count: searchResults.length,
        name: memberNameOf(playerB),
      })
    }
    return t('matchSearch.matchesSummaryAll', { count: searchResults.length })
  }, [playerA, playerB, searchResults.length, db.members])

  const handleExportFilteredMatchesCsv = () => {
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF'
    csvContent += 'Mã trận,Thời gian,Đội thắng,Tỷ số,Đội thua,Dự đoán,Nguồn\n' // i18n-ok: csv header
    searchResults.forEach((m) => {
      const teamA = m.teamA || []
      const teamB = m.teamB || []
      const aWon = m.winnerTeam === 'A'
      const winnerTeam = aWon ? teamA : teamB
      const loserTeam = aWon ? teamB : teamA
      const winnerNames = winnerTeam.map(memberNameOf).join(' · ')
      const loserNames = loserTeam.map(memberNameOf).join(' · ')
      const scoreSets = (m.sets || []).map(([a, b]) => `${aWon ? a : b}-${aWon ? b : a}`).join('; ')
      const source = (m.challengeId || m.sourceType === 'challenge') ? 'Kèo' : 'Buổi CLB' // i18n-ok: csv source
      const time = m.at ? new Date(m.at).toLocaleString('vi-VN') : ''
      csvContent += `"${matchCodeOf(db, m)}","${time}","${winnerNames}","${scoreSets}","${loserNames}","${m.predictedWinner || ''}","${source}"\n`
    })
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `badminclub_tim_tran_${searchResults.length}_tran.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleExportMatrixCsv = () => {
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF'
    const names = topMembersForMatrix.map((m) => m.name)
    csvContent += `Thành viên,${names.map((n) => `"${n}"`).join(',')}\n` // i18n-ok: csv header
    topMembersForMatrix.forEach((p1) => {
      const rowCells = topMembersForMatrix.map((p2) => {
        if (p1.id === p2.id) return '"—"'
        const cell = matrixData[p1.id]?.[p2.id] || { wins: 0, losses: 0 }
        return `"${cell.wins}-${cell.losses}"`
      })
      csvContent += `"${p1.name}",${rowCells.join(',')}\n`
    })
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', 'badminclub_ma_tran_doi_dau.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // -------------------------------------------------------------
  // TAB 5: Thống kê Hiệu chỉnh chéo giới (Calibration)
  // -------------------------------------------------------------
  const calibrationStats = useMemo(() => {
    return computeClubCalibration(db.matches || [], memberMap)
  }, [db.matches, memberMap])

  const topCrossPlayers = useMemo(() => {
    return rankTopCrossGenderPlayers(calibrationStats.topCrossGenderPlayers, memberMap, 8)
  }, [calibrationStats.topCrossGenderPlayers, memberMap])

  const crossOverall = useMemo(() => {
    const buckets = calibrationStats.buckets || {}
    let totalSample = 0
    let totalFemaleWins = 0
    Object.values(buckets).forEach((b) => {
      totalSample += b.sampleSize || 0
      totalFemaleWins += b.femaleWins || 0
    })
    const winRate = totalSample > 0 ? Math.round((totalFemaleWins / totalSample) * 100) : 0
    return {
      totalSample,
      totalFemaleWins,
      winRate,
    }
  }, [calibrationStats.buckets])

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

    // Tìm người có chuỗi thắng (streak W) dài nhất hiện tại (chỉ thành viên chính thức)
    let maxStreak = 0
    let bountyPlayer = null
    leaderboardData.forEach((row) => {
      if (row.isGuest) return
      const streak = row.streak || 0
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

  // Top người có rating biến động nhiều nhất (Card vệ tinh 2 của Tab 1) - CHỈ THÀNH VIÊN, KHÔNG TÍNH KHÁCH
  const topRatingChanges = useMemo(() => {
    const matches = (db.matches || []).slice().sort((a, b) => (b.at || 0) - (a.at || 0))
    const recentMatches = matches.slice(0, 10)
    const memberDeltaMap = new Map()

    recentMatches.forEach((m) => {
      const d = Math.abs(m.eloDelta || 0)
      if (!d) return
      const wonA = m.winnerTeam === 'A'

      const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
      const teamB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])

      teamA.forEach((pid) => {
        const mem = memberMap[pid] || (db.members || []).find((x) => x.id === pid)
        if (!mem || mem.active === false) return
        const cur = memberDeltaMap.get(pid) || { delta: 0, wins: 0, losses: 0, matches: 0, mem }
        memberDeltaMap.set(pid, {
          ...cur,
          delta: cur.delta + (wonA ? d : -d),
          wins: cur.wins + (wonA ? 1 : 0),
          losses: cur.losses + (wonA ? 0 : 1),
          matches: cur.matches + 1,
        })
      })

      teamB.forEach((pid) => {
        const mem = memberMap[pid] || (db.members || []).find((x) => x.id === pid)
        if (!mem || mem.active === false) return
        const cur = memberDeltaMap.get(pid) || { delta: 0, wins: 0, losses: 0, matches: 0, mem }
        memberDeltaMap.set(pid, {
          ...cur,
          delta: cur.delta + (!wonA ? d : -d),
          wins: cur.wins + (!wonA ? 1 : 0),
          losses: cur.losses + (!wonA ? 0 : 1),
          matches: cur.matches + 1,
        })
      })
    })

    const arr = Array.from(memberDeltaMap.entries()).map(([pid, val]) => {
      return {
        id: pid,
        name: val.mem.name,
        gender: val.mem.gender === 'Nữ' || val.mem.gender === 'F' ? 'F' : 'M', // i18n-ok: gender check
        delta: val.delta,
        wins: val.wins,
        losses: val.losses,
        matches: val.matches,
      }
    }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 4)

    return arr
  }, [db.matches, memberMap, db.members])

  // Thành tựu mới trong mùa giải (Card vệ tinh 3 của Tab 1) - CHỈ TÍNH TỪ DATA THỰC TẾ CLB
  const recentSeasonAchievements = useMemo(() => {
    const achs = []
    // 1. Chuỗi thắng >= 3 từ thành viên
    if (seasonStats.bountyPlayer) {
      const p = seasonStats.bountyPlayer
      const dateStr = p.lastMatchDate ? new Date(p.lastMatchDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : ''
      achs.push({
        name: p.name,
        title: t('leaderboard.achieveStreak', { n: p.streak }),
        date: dateStr,
      })
    }

    // 2. Cột mốc số trận đấu của thành viên (>= 50 trận)
    leaderboardData.forEach((row) => {
      if (!row.isGuest && row.gamesCount >= 50 && achs.length < 3) {
        const dateStr = row.lastMatchDate ? new Date(row.lastMatchDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : ''
        achs.push({
          name: row.name,
          title: t('leaderboard.achieveMatches', { n: row.gamesCount }),
          date: dateStr,
        })
      }
    })

    // 3. Trận thắng bất ngờ gần đây (upset) từ thành viên
    const matches = (db.matches || []).slice().sort((a, b) => (b.at || 0) - (a.at || 0))
    for (const m of matches) {
      if (achs.length >= 4) break
      const ra = m.initialRatingA || 0
      const rb = m.initialRatingB || 0
      const wonA = m.winnerTeam === 'A'
      const isUpset = Math.abs(ra - rb) > 100 && ((ra < rb && wonA) || (rb < ra && !wonA))
      if (isUpset) {
        const winningPids = wonA ? (m.teamA || []) : (m.teamB || [])
        for (const pid of winningPids) {
          const mem = memberMap[pid] || (db.members || []).find((x) => x.id === pid)
          if (mem && mem.active !== false && !achs.some((a) => a.name === mem.name && a.title === t('leaderboard.achieveBeatStronger'))) {
            const dateStr = m.at ? new Date(m.at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : ''
            achs.push({
              name: mem.name,
              title: t('leaderboard.achieveBeatStronger'),
              date: dateStr,
            })
            break
          }
        }
      }
    }

    return achs.slice(0, 4)
  }, [seasonStats.bountyPlayer, leaderboardData, db.matches, memberMap, db.members])

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

      const delta = Math.abs(m.eloDelta || 0)
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
      {/* ---------------- Header trang Bảng xếp hạng (Duy nhất) ---------------- */}
      <div
        style={{
          padding: isMobile ? '12px 16px' : '14px 20px',
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <h1 style={{ font: "700 20px/1.25 Barlow, sans-serif", color: 'var(--text-primary)', margin: 0 }}>
            {t('leaderboard.title')}
          </h1>
          <div style={{ font: "400 13px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
            {activeTab === 'season'
              ? t('season.headerSub')
              : activeTab === 'elo'
              ? t('season.eloHeaderSub')
              : activeTab === 'search'
              ? t('matchSearch.searchHeaderSub')
              : activeTab === 'matrix'
              ? (matrixMemberLimit === 5
                  ? t('matchSearch.matrixSubMobile5')
                  : matrixMemberLimit === 999
                  ? t('matchSearch.matrixHeaderSub', { count: activeMembers.length })
                  : t('matchSearch.matrixSubTopN', { count: matrixMemberLimit }))
              : t('leaderboard.sub')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? t('common.themeLight') : t('common.themeDark')}
            aria-label={isDark ? t('common.themeLight') : t('common.themeDark')}
            style={{
              font: "600 12px/1 'IBM Plex Sans', sans-serif",
              padding: isMobile ? '8px 10px' : '8px 12px',
              borderRadius: 6,
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <Icon name={isDark ? 'sun' : 'moon'} size={15} />
            {!isMobile && <span>{isDark ? t('common.themeLight') : t('common.themeDark')}</span>}
          </button>

          {activeTab === 'search' ? (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('matrix')}
                title={t('leaderboard.tabMatrix')}
                style={{
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  padding: isMobile ? '8px 10px' : '8px 14px',
                  borderRadius: 6,
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon name="grid" size={14} />
                <span>{t('leaderboard.tabMatrix')}</span>
              </button>
              <button
                type="button"
                onClick={handleExportFilteredMatchesCsv}
                title={t('matchSearch.exportFilteredCsv', { count: searchResults.length })}
                style={{
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  padding: isMobile ? '8px 10px' : '8px 14px',
                  borderRadius: 6,
                  background: '#1D50A0',
                  border: 'none',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon name="download" size={14} />
                <span>{t('matchSearch.exportFilteredCsv', { count: searchResults.length })}</span>
              </button>
            </>
          ) : activeTab === 'matrix' ? (
            <>
              <div style={{
                display: 'flex',
                padding: 2,
                borderRadius: 6,
                background: 'var(--surface-inset)',
                border: '1px solid var(--border-subtle)',
                alignItems: 'center',
              }}>
                {[5, 8, 12, 999].map((limit) => (
                  <button
                    key={limit}
                    type="button"
                    onClick={() => setMatrixMemberLimit(limit)}
                    style={{
                      padding: isMobile ? '5px 8px' : '5px 10px',
                      borderRadius: 4,
                      border: 'none',
                      background: matrixMemberLimit === limit ? 'var(--surface-card)' : 'transparent',
                      color: matrixMemberLimit === limit ? 'var(--text-primary)' : 'var(--text-muted)',
                      font: "600 11.5px/1 'IBM Plex Sans', sans-serif",
                      cursor: 'pointer',
                      boxShadow: matrixMemberLimit === limit ? 'var(--shadow-xs)' : 'none',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {limit === 999
                      ? t('matchSearch.clubAll')
                      : isMobile
                      ? limit
                      : `Top ${limit}`}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleExportMatrixCsv}
                title={t('common.exportCsv')}
                aria-label={t('common.exportCsv')}
                style={{
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  padding: isMobile ? '8px 10px' : '8px 14px',
                  borderRadius: 6,
                  background: '#1D50A0',
                  border: 'none',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon name="download" size={14} />
                {!isMobile && <span>{t('common.exportCsv')}</span>}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleExportCsv}
                title={t('common.exportCsv')}
                aria-label={t('common.exportCsv')}
                style={{
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  padding: isMobile ? '8px 10px' : '8px 14px',
                  borderRadius: 6,
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon name="download" size={14} />
                <span>{t('common.exportCsv')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(t('leaderboard.recalcConfirmMsg'))) {
                    a.recalcAllRatings?.()
                  }
                }}
                title={t('leaderboard.recalcHint')}
                aria-label={t('leaderboard.btnRecalc')}
                style={{
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  padding: isMobile ? '8px 10px' : '8px 14px',
                  borderRadius: 6,
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon name="rotate-ccw" size={14} />
                <span>{t('leaderboard.btnRecalc')}</span>
              </button>
              <button
                type="button"
                onClick={() => setSeasonSettingsOpen(true)}
                title={t('season.settingsBtn')}
                aria-label={t('season.settingsBtn')}
                style={{
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  padding: isMobile ? '8px 10px' : '8px 14px',
                  borderRadius: 6,
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon name="settings" size={14} />
                <span>{t('season.settingsBtn')}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ---------------- 1. Tab Bar chính của Leaderboard ---------------- */}
      <TabTrack style={{ marginBottom: 4 }}>
        <div style={S.tabTrack}>
          <button
            type="button"
            onClick={() => setActiveTab('season')}
            style={{
              ...S.tabBtn,
              ...(activeTab === 'season'
                ? { ...S.tabBtnActive, background: '#00B2A9', color: '#04302C', fontWeight: 700 }
                : {}),
            }}
          >
            {t('season.raceTab')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('elo')}
            style={{
              ...S.tabBtn,
              ...(activeTab === 'elo'
                ? { ...S.tabBtnActive, background: '#1D50A0', color: '#fff', fontWeight: 700 }
                : {}),
            }}
          >
            {t('season.careerEloTab')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pairs')}
            style={{
              ...S.tabBtn,
              ...(activeTab === 'pairs'
                ? { ...S.tabBtnActive, background: '#00B2A9', color: '#04302C', fontWeight: 700 }
                : {}),
            }}
          >
            {t('leaderboard.tabPairs')}
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
            onClick={() => setActiveTab('search')}
            style={{ ...S.tabBtn, ...(activeTab === 'search' ? S.tabBtnActive : {}) }}
          >
            {t('leaderboard.tabSearch')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cross')}
            style={{ ...S.tabBtn, ...(activeTab === 'cross' ? S.tabBtnActive : {}) }}
          >
            {t('leaderboard.tabCross')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chart')}
            style={{ ...S.tabBtn, ...(activeTab === 'chart' ? S.tabBtnActive : {}) }}
          >
            {t('leaderboard.tabChart')}
          </button>
        </div>
      </TabTrack>

      {/* ---------------- TAB 1: Đua Top Mùa Giải (Screen SS1) ---------------- */}
      {activeTab === 'season' && (
        <SeasonRaceTab
          seasonLeaderboardData={seasonLeaderboardData}
          onOpenLedger={(m) => setLedgerMemberId(m?.id || m)}
          onOpenQuadrantMap={() => setQuadrantModalOpen(true)}
          isMobile={isMobile}
        />
      )}

      {/* ---------------- TAB 2: Bảng Đẳng Cấp Elo (Screen SS2) ---------------- */}
      {activeTab === 'elo' && (
        <CareerEloTab
          db={db}
          members={activeMembers}
          playerRatings={db.playerRatings}
          matches={db.matches || []}
          levels={db.levels}
          onOpenEffectiveStrengthModal={(player) => setEffectiveStrengthPlayer(player)}
          isMobile={isMobile}
        />
      )}

      {/* ---------------- TAB PAIRS: Ăn ý & Khắc chế (Screen AY1) ---------------- */}
      {activeTab === 'pairs' && (
        <PairsTab
          matches={db.matches || []}
          membersMap={memberMap}
          ratingsMap={db.playerRatings || {}}
          onExportCsv={handleExportCsv}
          onViewPairMatches={(pair) => {
            const pairKey = pair?.key || (pair?.playerA && pair?.playerB ? `${pair.playerA}:${pair.playerB}` : '')
            const [p1, p2] = pairKey.split(':')
            setPlayerA(p1 || '')
            setPlayerB(p2 || '')
            setSearchMode('team')
            setActiveTab('search')
          }}
        />
      )}

      {/* ---------------- TAB 2: Thành tích & Đối đầu & XP (Screens 04, 05, 07) ---------------- */}
      {activeTab === 'chart' && currentMember && (
        <MemberProfileTab
          member={currentMember}
          allMembers={activeMembers}
          onSelectMember={(id) => setSelectedMemberId(id)}
          db={db}
          rankTheme={rankTheme}
          onSelectTheme={(themeKey) => setRankTheme(themeKey)}
          isMobile={isMobile}
          onChallenge={(targetId) => {
            setInitialTeamA([])
            setInitialTeamB([targetId])
            setChallengeModalOpen(true)
          }}
        />
      )}

      {/* ---------------- TAB 3: Tìm trận & Sửa tỷ số inline ---------------- */}
      {activeTab === 'search' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Bộ lọc Tìm trận */}
          <div style={S.card}>
            <div style={{ padding: '14px 16px', display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={S.cardTitle}>{t('matchSearch.title')}</div>
                  <div style={S.cardSub}>{t('matchSearch.sub')}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <Select
                  value={playerA}
                  options={[
                    { value: '', label: `-- ${t('matchSearch.playerA')} --` },
                    ...activeMembers.map((m) => {
                      const pr = getPlayerRating(db.playerRatings, m.id, m, db.levels)
                      const elo = pr.displayRating || pr.rating || 1500
                      return { value: m.id, label: `${m.name} (${elo})` }
                    }),
                  ]}
                  onChange={(e) => setPlayerA(e.target.value)}
                  style={{ width: isMobile ? '100%' : 190 }}
                />
                <Select
                  value={searchMode}
                  options={[
                    {
                      value: 'vs',
                      label: h2hSummary
                        ? `${t('matchSearch.modeH2H')} (${h2hSummary.totalVs})`
                        : t('matchSearch.modeH2H'),
                    },
                    {
                      value: 'team',
                      label: h2hSummary
                        ? `${t('matchSearch.modeTeammate')} (${h2hSummary.tmTotal})`
                        : t('matchSearch.modeTeammate'),
                    },
                  ]}
                  onChange={(e) => setSearchMode(e.target.value)}
                  style={{ width: isMobile ? '100%' : 150 }}
                />
                <Select
                  value={playerB}
                  options={[
                    { value: '', label: `-- ${t('matchSearch.playerB')} --` },
                    ...activeMembers.map((m) => {
                      const pr = getPlayerRating(db.playerRatings, m.id, m, db.levels)
                      const elo = pr.displayRating || pr.rating || 1500
                      return { value: m.id, label: `${m.name} (${elo})` }
                    }),
                  ]}
                  onChange={(e) => setPlayerB(e.target.value)}
                  style={{ width: isMobile ? '100%' : 190 }}
                />
                <Select
                  value={qualityFilter}
                  options={[
                    { value: 'all', label: t('matchSearch.qualityAll') },
                    { value: 'close', label: t('matchSearch.qualityClose') },
                    { value: 'upset', label: t('matchSearch.qualityUpset') },
                  ]}
                  onChange={(e) => setQualityFilter(e.target.value)}
                  style={{ width: isMobile ? '100%' : 170 }}
                />
                {(playerA || playerB || qualityFilter !== 'all' || searchMode !== 'vs') && (
                  <button
                    type="button"
                    onClick={() => {
                      setPlayerA('')
                      setPlayerB('')
                      setSearchMode('vs')
                      setQualityFilter('all')
                    }}
                    style={{
                      font: "500 12.5px/1 'IBM Plex Sans', sans-serif",
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: 'transparent',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                    title={t('matchSearch.resetFilter')}
                  >
                    <Icon name="x" size={13} />
                    <span>{t('matchSearch.resetFilter')}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Mobile view (Screen S1) vs Desktop view */}
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Tóm tắt H2H compact trên Mobile khi chọn đủ 2 người (Screen S1 lines 955-960) */}
              {h2hSummary && (
                <div style={{
                  background: 'var(--surface-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  boxShadow: '0 1px 2px rgba(0,0,0,.25)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 9,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{
                      font: '600 11px/1.2 "IBM Plex Sans", sans-serif',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                    }}>
                      {t('matchSearch.cardH2HTitle', { nameA: memberNameOf(playerA), nameB: memberNameOf(playerB) })}
                    </div>
                    <span style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                      {h2hSummary.totalVs} {t('units.match')}
                    </span>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    font: '700 28px/1 Barlow, sans-serif',
                  }}>
                    <span style={{ color: 'var(--status-incident-fg)' }}>{h2hSummary.aWins}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 15 }}>–</span>
                    <span style={{ color: 'var(--text-primary)' }}>{h2hSummary.bWins}</span>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    font: '400 12px/1.3 "IBM Plex Mono", monospace',
                    color: 'var(--text-muted)',
                  }}>
                    <span>{memberNameOf(playerA)} {t('matchSearch.won')} {h2hSummary.aWinRate}%</span>
                    <span>{h2hSummary.lastDate ? t('matchSearch.lastMatchOn', { date: h2hSummary.lastDate }) : ''}</span>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      font: '600 10px/1 "IBM Plex Sans", sans-serif',
                      padding: '4px 8px',
                      borderRadius: 999,
                      background: 'rgba(224,138,0,.18)',
                      color: 'var(--status-delayed-fg)',
                      whiteSpace: 'nowrap',
                    }}>
                      {h2hSummary.closeCount} {t('matchSearch.closePill')}
                    </span>
                    <span style={{
                      font: '600 10px/1 "IBM Plex Sans", sans-serif',
                      padding: '4px 8px',
                      borderRadius: 999,
                      background: 'rgba(225,68,52,.18)',
                      color: 'var(--status-incident-fg)',
                      whiteSpace: 'nowrap',
                    }}>
                      {h2hSummary.upsetCount} {t('matchSearch.upsetPill')}
                    </span>
                    <span style={{
                      font: '600 10px/1 "IBM Plex Sans", sans-serif',
                      padding: '4px 8px',
                      borderRadius: 999,
                      background: 'rgba(0,178,169,.18)',
                      color: '#5FDBD3',
                      whiteSpace: 'nowrap',
                    }}>
                      {h2hSummary.challengeCount} {t('matchSearch.fromChallengePill')}
                    </span>
                  </div>
                </div>
              )}

              {/* Danh sách thẻ trận đấu (Screen S1) */}
              {searchResults.slice(0, searchCardLimit).map((m) => {
                const teamA = m.teamA || []
                const teamB = m.teamB || []
                const aWon = m.winnerTeam === 'A'
                const winnerTeam = aWon ? teamA : teamB
                const loserTeam = aWon ? teamB : teamA
                const winnerNames = winnerTeam.map(memberNameOf).join(' · ')
                const loserNames = loserTeam.map(memberNameOf).join(' · ')

                const scoreSets = (m.sets || []).map(([a, b]) => ({
                  winPts: aWon ? a : b,
                  losePts: aWon ? b : a,
                }))
                const isChallenge = Boolean(m.challengeId || m.sourceType === 'challenge')
                const absDelta = Math.abs(m.eloDelta != null ? m.eloDelta : 8)
                const isRated = m.ratingEnabled !== false
                const winnerDeltaStr = isRated ? (winnerTeam.length > 1 ? `+${absDelta} · +${absDelta}` : `+${absDelta}`) : t('challenge.casual')
                const loserDeltaStr = isRated ? (loserTeam.length > 1 ? `−${absDelta} · −${absDelta}` : `−${absDelta}`) : t('challenge.casual')
                const ra = m.initialRatingA || 0
                const rb = m.initialRatingB || 0
                const isUpset = Math.abs(ra - rb) > 100 && ((ra < rb && aWon) || (rb < ra && !aWon))
                const isClose = (m.sets || []).some((s) => s && s[0] != null && s[1] != null && Math.abs(s[0] - s[1]) <= 3)

                const s = (db.sessions || []).find((x) => x.id === m.sessionId)
                const courtObj = s?.courts?.[m.courtIdx]
                const courtLabel = courtObj?.label || (courtObj ? t('session.courtNum', { n: (m.courtIdx ?? 0) + 1 }) : '')
                const dateStr = s?.date ? dd(s.date) : (m.at ? new Date(m.at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '')
                const matchTime = courtObj?.from || (m.at ? new Date(m.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '')
                const courtTimeStr = courtLabel
                  ? `${dateStr ? dateStr + ' · ' : ''}${courtLabel}${matchTime ? ' · ' + matchTime : ''}`
                  : (dateStr || '—')

                const displayScore = scoreSets.length > 0 ? `${scoreSets[0].winPts} – ${scoreSets[0].losePts}` : '21 – 19'
                const predStr = isUpset ? '71%' : isClose ? '52%' : '50%'

                return (
                  <div
                    key={m.id}
                    style={{
                      background: 'var(--surface-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 10,
                      boxShadow: '0 1px 2px rgba(0,0,0,.25)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Header: mã trận + tag chất lượng */}
                    <div style={{
                      padding: '10px 13px',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--surface-inset)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setViewingMatch(m)}
                          style={{
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--surface-card)',
                            padding: '2px 7px',
                            borderRadius: 'var(--radius-sm)',
                            font: '600 12.5px/1 "IBM Plex Mono", monospace',
                            color: 'var(--status-transit-fg)',
                            cursor: 'pointer',
                          }}
                          title={t('matchDetail.title')}
                        >
                          {matchCodeOf(db, m)}
                        </button>
                        <span>·</span>
                        {s?.id ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/buoi-tap/${s.id}?tab=matches&matchId=${m.id}`)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              padding: 0,
                              font: '500 12.5px/1 "IBM Plex Sans", sans-serif',
                              color: 'var(--text-link)',
                              textDecoration: 'underline',
                              cursor: 'pointer',
                            }}
                            title={t('pages.sessions.title')}
                          >
                            {courtTimeStr}
                          </button>
                        ) : (
                          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{courtTimeStr}</span>
                        )}
                      </div>

                      <span style={{
                        font: '600 10px/1 "IBM Plex Sans", sans-serif',
                        padding: '4px 8px',
                        borderRadius: 999,
                        background: isClose ? 'rgba(224,138,0,.18)' : isUpset ? 'rgba(225,68,52,.18)' : 'rgba(0,178,169,.18)',
                        color: isClose ? 'var(--status-delayed-fg)' : isUpset ? 'var(--status-incident-fg)' : '#5FDBD3',
                        whiteSpace: 'nowrap',
                      }}>
                        {isClose ? t('matchSearch.qualityClose') : isUpset ? t('matchSearch.qualityUpset') : t('matchSearch.balancedPill')}
                      </span>
                    </div>

                    {/* Body: Hai đội và tỷ số */}
                    <div style={{ padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ font: '600 14px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--status-delivered-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {winnerNames}
                          </span>
                          <span style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: 'var(--status-delivered-fg)' }}>
                            {winnerDeltaStr}
                          </span>
                        </div>

                        <span style={{ font: '700 18px/1 Barlow, sans-serif', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          {displayScore}
                        </span>

                        <div style={{ flex: 1, minWidth: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ font: '600 14px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {loserNames}
                          </span>
                          <span style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: 'var(--status-incident-fg)' }}>
                            {loserDeltaStr}
                          </span>
                        </div>
                      </div>

                      {/* Footer thẻ: Dự đoán, Nguồn, và Nút Sửa */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 2 }}>
                        <span style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                          {scoreSets.length > 1
                            ? scoreSets.map((s) => `${s.winPts}–${s.losePts}`).join(' · ')
                            : t('matchSearch.setDetail', { count: 1, pred: predStr })
                          }
                        </span>

                        <div style={{ flex: 1 }} />

                        <span style={{
                          font: '600 10px/1 "IBM Plex Sans", sans-serif',
                          padding: '4px 8px',
                          borderRadius: 999,
                          background: isChallenge ? 'var(--status-transit-bg)' : 'var(--surface-sunken)',
                          color: isChallenge ? 'var(--status-transit-fg)' : 'var(--text-secondary)',
                          whiteSpace: 'nowrap',
                        }}>
                          {isChallenge ? t('leaderboard.codeChallenge', { code: 'C-0125' }) : t('challenge.fromCourt')}
                        </span>

                        <button
                          type="button"
                          onClick={() => setEditingMatch(m)}
                          style={{
                            border: '1px solid var(--border-default)',
                            background: 'var(--surface-raised)',
                            padding: '4px 10px',
                            borderRadius: 4,
                            font: '600 12px/1 "IBM Plex Sans", sans-serif',
                            color: 'var(--status-transit-fg)',
                            cursor: 'pointer',
                          }}
                        >
                          {t('matchSearch.btnEdit')}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {searchResults.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  {t('matchSearch.emptySearch')}
                </div>
              )}

              {searchResults.length > searchCardLimit && (
                <Button
                  variant="secondary"
                  block
                  onClick={() => setSearchCardLimit((prev) => prev + 10)}
                  style={{ minHeight: 44 }}
                >
                  {t('matchSearch.viewMoreMatches', { n: searchResults.length - searchCardLimit })}
                </Button>
              )}
            </div>
          ) : (
            /* Desktop view: Cột kép bảng tìm trận + thẻ H2H bên phải */
            <div style={{
              display: 'grid',
              gridTemplateColumns: h2hSummary ? 'minmax(0, 1fr) 340px' : '1fr',
              gap: 16,
              alignItems: 'start',
            }}>
              <div style={S.card}>
                <div style={{ ...S.cardHead, padding: '12px 14px' }}>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={S.cardTitle}>
                      {searchHeaderTitle}
                    </div>
                    <div style={S.cardSub}>
                      {t('matchSearch.matchesSub')}
                    </div>
                  </div>
                  {editedMatchesCount > 0 && (
                    <span style={{
                      font: '600 10px/1 "IBM Plex Sans", sans-serif',
                      padding: '5px 9px',
                      borderRadius: 999,
                      background: 'rgba(224,138,0,.18)',
                      color: 'var(--status-delayed-fg)',
                      whiteSpace: 'nowrap',
                    }}>
                      {t('matchSearch.editedMatchesCount', { count: editedMatchesCount })}
                    </span>
                  )}
                </div>

                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <div style={{ minWidth: 860 }}>
                    <div style={S.searchTableHead}>
                      <div style={S.thCell}>{t('matchSearch.colCode')}</div>
                      <div style={S.thCell}>{t('matchSearch.colWhen')}</div>
                      <div style={S.thCell}>{t('matchSearch.colWinner')}</div>
                      <div style={{ ...S.thCell, textAlign: 'center', justifyContent: 'center' }}>{t('matchSearch.colScore')}</div>
                      <div style={S.thCell}>{t('matchSearch.colLoser')}</div>
                      <div style={{ ...S.thCell, textAlign: 'center', justifyContent: 'center' }}>{t('leaderboard.predLabel')}</div>
                      <div style={{ ...S.thCell, textAlign: 'center', justifyContent: 'center' }}>{t('matchSearch.colSource')}</div>
                    </div>

                    <div style={{ display: 'grid' }}>
                      {searchResults.slice(0, searchCardLimit).map((m) => {
                        const teamA = m.teamA || []
                        const teamB = m.teamB || []
                        const aWon = m.winnerTeam === 'A'
                        const winnerTeam = aWon ? teamA : teamB
                        const loserTeam = aWon ? teamB : teamA
                        const winnerNames = winnerTeam.map(memberNameOf).join(' · ')
                        const loserNames = loserTeam.map(memberNameOf).join(' · ')

                        const scoreSets = (m.sets || []).map(([a, b]) => ({
                          winPts: aWon ? a : b,
                          losePts: aWon ? b : a,
                        }))
                        const isChallenge = Boolean(m.challengeId || m.sourceType === 'challenge')
                        const absDelta = Math.abs(m.eloDelta != null ? m.eloDelta : 8)
                        const isRated = m.ratingEnabled !== false
                        const winnerDeltaStr = isRated ? (winnerTeam.length > 1 ? `+${absDelta} · +${absDelta}` : `+${absDelta}`) : t('challenge.casual')
                        const loserDeltaStr = isRated ? (loserTeam.length > 1 ? `−${absDelta} · −${absDelta}` : `−${absDelta}`) : t('challenge.casual')
                        const ra = m.initialRatingA || 0
                        const rb = m.initialRatingB || 0
                        const isUpset = Math.abs(ra - rb) > 100 && ((ra < rb && aWon) || (rb < ra && !aWon))
                        const isClose = (m.sets || []).some((s) => s && s[0] != null && s[1] != null && Math.abs(s[0] - s[1]) <= 3)

                        const s = (db.sessions || []).find((x) => x.id === m.sessionId)
                        const courtObj = s?.courts?.[m.courtIdx]
                        const venue = courtObj ? courtOf(db, courtObj.courtId) : null
                        const courtLabel = courtObj?.label || (courtObj ? t('session.courtNum', { n: (m.courtIdx ?? 0) + 1 }) : '')
                        const dateStr = s?.date ? dd(s.date) : (m.at ? new Date(m.at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '')
                        const matchTime = courtObj?.from || (m.at ? new Date(m.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '')
                        const courtTimeStr = courtLabel
                          ? `${dateStr ? dateStr + ' · ' : ''}${courtLabel}${matchTime ? ' · ' + matchTime : ''}`
                          : (dateStr || '—')
                        const tooltipWhen = `${venue?.name || ''}${courtObj?.from ? ` · ${courtObj.from} → ${courtObj.to}` : ''}`

                        return (
                          <div
                            key={m.id}
                            onClick={() => setViewingMatch(m)}
                            style={S.searchTableRow}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--action-ghost-bg-hover)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                            title={t('matchDetail.title')}
                          >
                            {/* Cột 1: Mã trận (click xem chi tiết) & Nút Sửa */}
                            <div style={{ ...S.tdCell, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setViewingMatch(m)
                                }}
                                style={{
                                  border: '1px solid var(--border-subtle)',
                                  background: 'var(--surface-sunken)',
                                  padding: '3px 8px',
                                  borderRadius: 'var(--radius-sm)',
                                  font: '600 12.5px/1 "IBM Plex Mono", monospace',
                                  color: 'var(--status-transit-fg)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                                title={t('matchDetail.title')}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'var(--surface-brand-soft)'
                                  e.currentTarget.style.borderColor = 'var(--teal-500)'
                                  e.currentTarget.style.textDecoration = 'underline'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'var(--surface-sunken)'
                                  e.currentTarget.style.borderColor = 'var(--border-subtle)'
                                  e.currentTarget.style.textDecoration = 'none'
                                }}
                              >
                                {matchCodeOf(db, m)}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingMatch(m)
                                }}
                                style={S.editBtn}
                                title={t('matchSearch.btnEdit')}
                              >
                                {t('matchSearch.btnEdit')}
                              </button>
                            </div>

                            {/* Cột 2: Ngày · Sân (link thẳng tới buổi & trận đó) */}
                            <div style={{ ...S.tdCell, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s?.id ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    navigate(`/buoi-tap/${s.id}?tab=matches&matchId=${m.id}`)
                                  }}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    padding: 0,
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    font: 'inherit',
                                    maxWidth: '100%',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={tooltipWhen ? `${tooltipWhen} · ${t('pages.sessions.title')}` : t('pages.sessions.title')}
                                >
                                  <span
                                    style={{
                                      ...S.monoMeta,
                                      color: 'var(--text-link)',
                                      textDecoration: 'underline',
                                      textUnderlineOffset: 3,
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--teal-600)' }}
                                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-link)' }}
                                  >
                                    {courtTimeStr}
                                  </span>
                                </button>
                              ) : (
                                <span style={S.monoMeta} title={tooltipWhen}>{courtTimeStr}</span>
                              )}
                            </div>

                            {/* Cột 3: Đội thắng + delta rating */}
                            <div style={{ ...S.tdCell, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                              <span style={{ font: '600 14px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--status-delivered-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {winnerNames}
                              </span>
                              <span style={{ font: '400 13px/1.2 "IBM Plex Mono", monospace', color: 'var(--status-delivered-fg)' }}>
                                {winnerDeltaStr}
                              </span>
                            </div>

                            {/* Cột 4: Tỷ số to nằm giữa */}
                            <div style={{ ...S.tdCell, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 17px/1 Barlow, sans-serif', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                              {scoreSets.length > 0 ? `${scoreSets[0].winPts} – ${scoreSets[0].losePts}` : '21 – 19'}
                            </div>

                            {/* Cột 5: Đội thua + delta rating */}
                            <div style={{ ...S.tdCell, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                              <span style={{ font: '600 14px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {loserNames}
                              </span>
                              <span style={{ font: '400 13px/1.2 "IBM Plex Mono", monospace', color: 'var(--status-incident-fg)' }}>
                                {loserDeltaStr}
                              </span>
                            </div>

                            {/* Cột 6: Dự đoán */}
                            <div style={{ ...S.tdCell, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 0 }}>
                              <span style={{ font: '600 13px/1.2 "IBM Plex Mono", monospace', color: 'var(--text-secondary)' }}>
                                {isUpset ? '71%' : isClose ? '52%' : '50%'}
                              </span>
                              <span style={{ font: '400 12px/1.2 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                                {isUpset ? t('leaderboard.predUpset') : isClose ? t('leaderboard.predClose') : t('leaderboard.predCorrect')}
                              </span>
                            </div>

                            {/* Cột 7: Nguồn trận */}
                            <div style={{ ...S.tdCell, display: 'flex', justifyContent: 'center' }}>
                              <span style={{
                                font: '600 10px/1 "IBM Plex Sans", sans-serif',
                                padding: '5px 9px',
                                borderRadius: 999,
                                background: isChallenge ? 'var(--status-transit-bg)' : 'var(--surface-sunken)',
                                color: isChallenge ? 'var(--status-transit-fg)' : 'var(--text-secondary)',
                                whiteSpace: 'nowrap',
                              }}>
                                {isChallenge ? t('leaderboard.codeChallenge', { code: 'C-0125' }) : t('challenge.fromCourt')}
                              </span>
                            </div>
                          </div>
                        )
                      })}

                      {searchResults.length === 0 && (
                        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                          {t('matchSearch.emptySearch')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Table footer with count & view more */}
                <div style={{
                  padding: '12px 14px',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}>
                  <span style={{ font: '400 13px/1.4 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                    {t('common.showingOf', { n: Math.min(searchCardLimit, searchResults.length), total: searchResults.length })}
                  </span>
                  {searchResults.length > searchCardLimit && (
                    <Button
                      variant="secondary"
                      onClick={() => setSearchCardLimit((prev) => prev + 10)}
                      style={{ minHeight: 34 }}
                    >
                      {t('matchSearch.viewMoreMatches', { n: Math.min(10, searchResults.length - searchCardLimit) })}
                    </Button>
                  )}
                </div>
              </div>

              {/* Cột phải: 2 Thẻ tóm tắt Đối đầu H2H chuẩn DS1 (nếu chọn đủ 2 người) */}
              {h2hSummary && (
                <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
                  {/* Card 1: Đối đầu H2H */}
                  <div style={S.card}>
                    <div style={{ ...S.cardHead, padding: '12px 14px' }}>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={S.cardTitle}>
                          {t('leaderboard.h2hTitle', { nameA: memberNameOf(playerA), nameB: memberNameOf(playerB) })}
                        </div>
                        <div style={S.cardSub}>{t('leaderboard.h2hSubtitle')}</div>
                      </div>
                      <span style={{
                        font: '600 10px/1 "IBM Plex Sans", sans-serif',
                        padding: '5px 9px',
                        borderRadius: 999,
                        background: h2hSummary.relationshipTone === 'tough' ? 'var(--status-incident-bg)' : 'var(--status-transit-bg)',
                        color: h2hSummary.relationshipTone === 'tough' ? 'var(--status-incident-fg)' : 'var(--status-delivered-fg)',
                        whiteSpace: 'nowrap',
                      }}>
                        {h2hSummary.relationshipTone === 'tough' ? t('leaderboard.toughOpponent') : h2hSummary.relationshipTone === 'easy' ? t('leaderboard.easyOpponent') : t('leaderboard.balancedOpponent')}
                      </span>
                    </div>
                    <div style={{ padding: 14, display: 'grid', gap: 10 }}>
                      {/* Tỷ số to khổng lồ ở giữa */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, font: '700 32px/1 Barlow, sans-serif' }}>
                        <span style={{ color: 'var(--status-incident-fg)' }}>{h2hSummary.aWins}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 17 }}>–</span>
                        <span style={{ color: 'var(--text-primary)' }}>{h2hSummary.bWins}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, font: '400 13px/1.4 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                        <span>{memberNameOf(playerA)} {h2hSummary.aWinRate}%</span>
                        <span>{memberNameOf(playerB)} {h2hSummary.bWinRate}%</span>
                      </div>
                      {/* Inset Box */}
                      <div style={{ display: 'grid', gap: 8, padding: '11px 13px', borderRadius: 8, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, font: '400 13px/1.5 "IBM Plex Mono", monospace' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{t('matchSearch.qualityClose')}</span>
                          <span style={{ color: 'var(--status-delayed-fg)' }}>{h2hSummary.closeCount} {t('units.match')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, font: '400 13px/1.5 "IBM Plex Mono", monospace' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{t('matchSearch.qualityUpset')}</span>
                          <span style={{ color: 'var(--status-incident-fg)' }}>{h2hSummary.upsetCount} {t('units.match')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, font: '400 13px/1.5 "IBM Plex Mono", monospace' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{t('challenge.challenge')}</span>
                          <span style={{ color: 'var(--status-transit-fg)' }}>{h2hSummary.challengeCount} {t('units.match')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, font: '400 13px/1.5 "IBM Plex Mono", monospace' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{t('leaderboard.netRating')}</span>
                          <span style={{ color: 'var(--text-primary)' }}>{h2hSummary.netDelta >= 0 ? `+${h2hSummary.netDelta}` : h2hSummary.netDelta}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Khi cùng đội */}
                  <div style={S.card}>
                    <div style={{ ...S.cardHead, padding: '12px 14px' }}>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={S.cardTitle}>{t('leaderboard.whenTeammates')}</div>
                        <div style={S.cardSub}>
                          {t('leaderboard.teammateSubtitle', { total: h2hSummary.tmTotal, nameA: memberNameOf(playerA), nameB: memberNameOf(playerB) })}
                        </div>
                      </div>
                      <span style={{
                        font: '600 10px/1 "IBM Plex Sans", sans-serif',
                        padding: '5px 9px',
                        borderRadius: 999,
                        background: 'var(--status-transit-bg)',
                        color: 'var(--status-transit-fg)',
                        whiteSpace: 'nowrap',
                      }}>
                        {t('leaderboard.wonCount', { n: h2hSummary.tmWins })}
                      </span>
                    </div>
                    <div style={{ padding: 14, display: 'grid', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, font: '400 13px/1.5 "IBM Plex Mono", monospace' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{t('leaderboard.winLoss')}</span>
                        <span style={{ color: 'var(--status-delivered-fg)' }}>{h2hSummary.tmWins} – {h2hSummary.tmLoss}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, font: '400 13px/1.5 "IBM Plex Mono", monospace' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{t('leaderboard.winRateLabel')}</span>
                        <span style={{ color: 'var(--status-delivered-fg)' }}>{h2hSummary.tmWinRate}%</span>
                      </div>
                      {h2hSummary.lastDate && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          {t('leaderboard.lastTeammateMatch')}: {h2hSummary.lastDate} ({h2hSummary.lastWon ? t('leaderboard.wonStatus') : t('leaderboard.lostStatus')})
                        </div>
                      )}
                      <Button
                        variant="secondary"
                        block
                        onClick={() => setSearchMode('team')}
                        style={{ marginTop: 4, fontSize: 12.5 }}
                      >
                        {t('matchSearch.switchTeammateBtn', { count: h2hSummary.tmTotal })}
                      </Button>
                      <Button
                        variant="primary"
                        block
                        icon="target"
                        style={{ marginTop: 6 }}
                        onClick={() => {
                          setInitialTeamA([playerA])
                          setInitialTeamB([playerB])
                          setChallengeModalOpen(true)
                        }}
                      >
                        {t('matchSearch.challengeBetween')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---------------- TAB 4: Ma trận Đối đầu H2H (DS3) ---------------- */}
      {activeTab === 'matrix' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 340px',
          gap: 16,
          alignItems: 'start',
          minWidth: 0,
          maxWidth: '100%',
        }}>
          {/* Cột trái: Ma trận */}
          <div style={{ ...S.card, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
            <div style={{ ...S.cardHead, padding: isMobile ? '12px 14px' : '14px 16px', gap: 10 }}>
              <div style={{ flex: '1 1 180px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={S.cardTitle}>{t('matchSearch.matrixTitle')}</div>
                <div style={S.cardSub}>
                  {matrixMemberLimit === 5
                    ? t('matchSearch.matrixSubMobile5')
                    : matrixMemberLimit === 999
                    ? t('matchSearch.matrixHeaderSub', { count: activeMembers.length })
                    : t('matchSearch.matrixSubTopN', { count: matrixMemberLimit })}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{
                  display: 'flex',
                  padding: 2,
                  borderRadius: 6,
                  background: 'var(--surface-inset)',
                  border: '1px solid var(--border-subtle)',
                  alignItems: 'center',
                }}>
                  {[5, 8, 12, 999].map((limit) => (
                    <button
                      key={limit}
                      type="button"
                      onClick={() => setMatrixMemberLimit(limit)}
                      style={{
                        padding: isMobile ? '4px 7px' : '4px 9px',
                        borderRadius: 4,
                        border: 'none',
                        background: matrixMemberLimit === limit ? 'var(--surface-card)' : 'transparent',
                        color: matrixMemberLimit === limit ? 'var(--text-primary)' : 'var(--text-muted)',
                        font: "600 11px/1 'IBM Plex Sans', sans-serif",
                        cursor: 'pointer',
                        boxShadow: matrixMemberLimit === limit ? 'var(--shadow-xs)' : 'none',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {limit === 999 ? t('matchSearch.clubAll') : limit}
                    </button>
                  ))}
                </div>
                <span style={{
                  font: '600 10px/1 "IBM Plex Sans", sans-serif',
                  padding: '5px 9px',
                  borderRadius: 999,
                  background: 'rgba(0,178,169,.18)',
                  color: isDark ? '#5FDBD3' : 'var(--teal-700)',
                  whiteSpace: 'nowrap',
                }}>
                  {t('matchSearch.matrixReadByRow')}
                </span>
              </div>
            </div>

            <div style={{
              padding: isMobile ? '12px 14px' : 16,
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              minWidth: 0,
              maxWidth: '100%',
            }}>
              <table style={{
                borderCollapse: isMobile ? 'separate' : 'collapse',
                borderSpacing: isMobile ? '4px 4px' : 0,
                width: isMobile ? 'auto' : '100%',
                minWidth: isMobile ? 'max-content' : '100%',
                fontSize: isMobile ? 12 : 13,
              }}>
                <thead>
                  <tr>
                    <th style={{
                      ...S.matrixTh,
                      ...(isMobile ? {
                        position: 'sticky',
                        left: 0,
                        zIndex: 3,
                        background: 'var(--surface-card)',
                        boxShadow: '2px 0 4px rgba(0,0,0,0.12)',
                        width: 44,
                        minWidth: 44,
                        maxWidth: 48,
                        padding: '6px 4px',
                        border: 'none',
                      } : {})
                    }}>
                      VS
                    </th>
                    {topMembersForMatrix.map((m) => (
                      <th
                        key={m.id}
                        title={m.name}
                        style={{
                          ...S.matrixTh,
                          ...(isMobile ? {
                            width: 52,
                            minWidth: 52,
                            maxWidth: 56,
                            padding: '6px 2px',
                            border: 'none',
                            font: '600 11px/1.2 "IBM Plex Sans", sans-serif',
                            color: 'var(--text-muted)',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          } : {})
                        }}
                      >
                        {isMobile ? getShortDisplayName(m.name, topMembersForMatrix) : m.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topMembersForMatrix.map((p1) => (
                    <tr key={p1.id}>
                      <td
                        title={p1.name}
                        style={{
                          ...S.matrixRowLabel,
                          ...(isMobile ? {
                            position: 'sticky',
                            left: 0,
                            zIndex: 2,
                            background: 'var(--surface-card)',
                            boxShadow: '2px 0 4px rgba(0,0,0,0.12)',
                            width: 44,
                            minWidth: 44,
                            maxWidth: 48,
                            padding: '6px 4px',
                            border: 'none',
                            font: '600 13px/1.2 "IBM Plex Sans", sans-serif',
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          } : {})
                        }}
                      >
                        {isMobile ? getShortDisplayName(p1.name, topMembersForMatrix) : p1.name}
                      </td>
                      {topMembersForMatrix.map((p2) => {
                        if (p1.id === p2.id) {
                          return (
                            <td
                              key={p2.id}
                              style={{
                                ...S.matrixSelfCell,
                                ...(isMobile ? {
                                  width: 52,
                                  minWidth: 52,
                                  height: 38,
                                  borderRadius: 6,
                                  border: 'none',
                                  background: isDark ? '#0B1220' : 'var(--surface-inset)',
                                  color: isDark ? '#2E3E5C' : 'var(--text-disabled)',
                                  font: '600 12px/1 "IBM Plex Mono", monospace',
                                  padding: 0,
                                } : {})
                              }}
                            >
                              —
                            </td>
                          )
                        }
                        const cell = matrixData[p1.id]?.[p2.id] || { wins: 0, losses: 0 }
                        const net = cell.wins - cell.losses
                        const total = cell.wins + cell.losses
                        const isDisparate = Math.abs(net) >= 4
                        const cellColor = net > 0
                          ? (isDark ? '#5FD9A2' : 'var(--status-delivered-fg)')
                          : net < 0
                          ? (isDark ? '#FF9A8F' : 'var(--status-incident-fg)')
                          : 'var(--text-muted)'
                        const cellBg = net > 0
                          ? 'rgba(18,168,103,.18)'
                          : net < 0
                          ? 'rgba(225,68,52,.18)'
                          : isMobile ? 'var(--surface-inset)' : 'transparent'
                        const borderStyle = isMobile
                          ? (isDisparate
                              ? (net > 0 ? (isDark ? '1.5px solid #5FD9A2' : '1.5px solid var(--status-delivered-fg)') : (isDark ? '1.5px solid #FF9A8F' : '1.5px solid var(--status-incident-fg)'))
                              : 'none')
                          : (isDisparate
                              ? (net > 0 ? '2px solid #5FD9A2' : '2px solid #FF9A8F')
                              : '1px solid var(--border-subtle)')

                        return (
                          <td
                            key={p2.id}
                            onClick={() => {
                              if (total > 0) {
                                setPlayerA(p1.id)
                                setPlayerB(p2.id)
                                setSearchMode('vs')
                                setActiveTab('search')
                              }
                            }}
                            title={total > 0 ? `${p1.name} vs ${p2.name}: ${cell.wins}-${cell.losses} (${t('matchSearch.title')})` : undefined}
                            style={{
                              ...S.matrixCell,
                              color: cellColor,
                              background: cellBg,
                              border: borderStyle,
                              cursor: total > 0 ? 'pointer' : 'default',
                              transition: 'all 0.15s ease',
                              padding: isMobile ? '0' : '6px 8px',
                              ...(isMobile ? {
                                width: 52,
                                minWidth: 52,
                                height: 38,
                                borderRadius: 6,
                              } : {}),
                            }}
                          >
                            {isMobile ? (
                              <div style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                font: '600 12px/1 "IBM Plex Mono", monospace',
                              }}>
                                {total > 0 ? `${cell.wins}-${cell.losses}` : '—'}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                <span style={{ font: '600 13px/1 "IBM Plex Mono", monospace' }}>{cell.wins}-{cell.losses}</span>
                                {total > 0 && (
                                  <span style={{ font: '400 10px/1 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                                    {total}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Legend underneath matrix */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                paddingTop: 14,
                flexWrap: 'wrap',
                font: '400 12px/1.3 "IBM Plex Mono", monospace',
                color: 'var(--text-muted)',
              }}>
                <span style={{
                  font: '600 10px/1 "IBM Plex Sans", sans-serif',
                  padding: '5px 9px',
                  borderRadius: 999,
                  background: 'rgba(18,168,103,.18)',
                  color: isDark ? '#5FD9A2' : 'var(--status-delivered-fg)',
                  whiteSpace: 'nowrap',
                }}>
                  {t('matchSearch.legendMoreWins')}
                </span>
                <span style={{
                  font: '600 10px/1 "IBM Plex Sans", sans-serif',
                  padding: '5px 9px',
                  borderRadius: 999,
                  background: 'rgba(225,68,52,.18)',
                  color: isDark ? '#FF9A8F' : 'var(--status-incident-fg)',
                  whiteSpace: 'nowrap',
                }}>
                  {t('matchSearch.legendMoreLosses')}
                </span>
                {!isMobile && (
                  <span style={{
                    font: '600 10px/1 "IBM Plex Sans", sans-serif',
                    padding: '5px 9px',
                    borderRadius: 999,
                    background: 'var(--surface-inset)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border-subtle)',
                    whiteSpace: 'nowrap',
                  }}>
                    {t('matchSearch.legendBalanced')}
                  </span>
                )}
                <span>{t('matchSearch.matrixReadByRow')}</span>
                {!isMobile && (
                  <span style={{ font: '400 12px/1.4 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                    {t('matchSearch.legendDisparateBorder')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Cột phải / Dưới: 2 Thẻ (Đáng chú ý & Chưa gặp nhau) */}
          <div style={{ display: 'grid', gap: 16, alignContent: 'start', minWidth: 0, maxWidth: '100%' }}>
            {/* Card 1: Đáng chú ý / Cặp lệch nhất */}
            <div style={{ ...S.card, minWidth: 0, maxWidth: '100%' }}>
              <div style={{ ...S.cardHead, padding: isMobile ? '12px 14px' : '14px 16px' }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={isMobile ? { font: '600 11px/1.2 "IBM Plex Sans", sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' } : S.cardTitle}>
                    {isMobile ? t('matchSearch.notableTitle') : t('matchSearch.disparateTitle')}
                  </div>
                  {!isMobile && <div style={S.cardSub}>{t('matchSearch.disparateSub')}</div>}
                </div>
              </div>
              <div style={{ padding: isMobile ? '12px 14px' : 14, display: 'grid', gap: 8 }}>
                {disparatePairsList.length === 0 ? (
                  <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    {t('common.noData')}
                  </div>
                ) : (
                  disparatePairsList.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setPlayerA(item.player1.id)
                        setPlayerB(item.player2.id)
                        setSearchMode('vs')
                        setActiveTab('search')
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: isMobile ? '11px 13px' : '10px 12px',
                        borderRadius: 8,
                        background: 'var(--surface-inset)',
                        border: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--teal-500)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
                      title={t('matchSearch.title')}
                    >
                      <span style={{ flex: 1, minWidth: 0, font: '600 14px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t('matchSearch.cardH2HTitle', { nameA: item.player1.name, nameB: item.player2.name })}
                      </span>
                      <span style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {item.total} {t('units.match')}
                      </span>
                      <span style={{
                        font: '600 13px/1.3 "IBM Plex Mono", monospace',
                        color: item.wins > item.losses
                          ? (isDark ? '#5FD9A2' : 'var(--status-delivered-fg)')
                          : (isDark ? '#FF9A8F' : 'var(--status-incident-fg)'),
                        whiteSpace: 'nowrap',
                      }}>
                        {item.wins}-{item.losses}
                      </span>
                    </div>
                  ))
                )}
                <span style={{ font: '400 13px/1.45 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                  {t('matchSearch.tapCellHint')}
                </span>
              </div>
            </div>

            {/* Card 2: Chưa gặp nhau */}
            <div style={{ ...S.card, minWidth: 0, maxWidth: '100%' }}>
              <div style={{ ...S.cardHead, padding: isMobile ? '12px 14px' : '14px 16px' }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={S.cardTitle}>{t('matchSearch.neverMet')}</div>
                  <div style={S.cardSub}>{t('matchSearch.neverMetSub')}</div>
                </div>
                <span style={{
                  font: '600 10px/1 "IBM Plex Sans", sans-serif',
                  padding: '5px 9px',
                  borderRadius: 999,
                  background: 'rgba(224,138,0,.18)',
                  color: 'var(--status-delayed-fg)',
                  whiteSpace: 'nowrap',
                }}>
                  {neverMetSessionScored.length} {t('matchSearch.pairs')}
                </span>
              </div>
              <div style={{ padding: isMobile ? '12px 14px' : 14, display: 'grid', gap: 8 }}>
                {neverMetSessionScored.length === 0 ? (
                  <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    {t('common.noData')}
                  </div>
                ) : (
                  neverMetSessionScored.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: 'var(--surface-inset)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span style={{ font: '600 13.5px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.p1.name} · {item.p2.name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ font: '400 12.5px/1.4 "IBM Plex Mono", monospace', color: 'var(--status-delayed-fg)', whiteSpace: 'nowrap' }}>
                          {t('matchSearch.commonSessions', { count: item.commonSessions })}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setInitialTeamA([item.p1.id])
                            setInitialTeamB([item.p2.id])
                            setChallengeModalOpen(true)
                          }}
                          style={{
                            border: '1px solid var(--border-default)',
                            background: 'var(--surface-card)',
                            color: 'var(--status-transit-fg)',
                            padding: '3px 8px',
                            borderRadius: 4,
                            font: '600 11px/1 "IBM Plex Sans", sans-serif',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          title={t('challenge.challenge')}
                        >
                          <Icon name="target" size={11} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
                <span style={{ font: '400 12.5px/1.4 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)', marginTop: 4 }}>
                  {t('matchSearch.neverMetPriorityNotice')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB 5: Thống kê hiệu chỉnh chéo giới (RD5) ---------------- */}
      {activeTab === 'cross' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 380px',
          gap: 16,
          alignItems: 'start',
        }}>
          {/* Cột trái: Tỷ lệ nữ thắng & Phân rã theo mức chênh Elo */}
          <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
            {/* Card 1: Tổng quan Nữ thắng khi gặp nam */}
            {(() => {
              const hasCrossData = crossOverall.totalSample > 0
              return (
                <div style={{
                  ...S.card,
                  padding: 16,
                  display: 'grid',
                  gap: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: 11,
                      fontWeight: 600,
                      lineHeight: 1.2,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                    }}>
                      {t('rating.calibration.femaleVsMale')}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 30,
                      fontWeight: 700,
                      lineHeight: 1,
                      color: hasCrossData ? 'var(--status-delayed-fg)' : 'var(--text-muted)',
                    }}>
                      {hasCrossData ? `${crossOverall.winRate}%` : '—'}
                    </span>
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 13,
                    lineHeight: 1.45,
                    color: 'var(--text-secondary)',
                  }}>
                    {hasCrossData ? (
                      t('rating.calibration.overallDesc', {
                        wins: crossOverall.totalFemaleWins,
                        total: crossOverall.totalSample,
                        note: t('rating.calibration.learnedNote'),
                      })
                    ) : (
                      t('rating.calibration.emptyCross')
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Card 2: Bảng theo mức chênh rating */}
            <div style={{ ...S.card, overflow: 'hidden' }}>
              <div style={S.cardHead}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={S.cardTitle}>{t('rating.calibration.byGapTitle')}</div>
                  <div style={S.cardSub}>{t('rating.calibration.byGapSub')}</div>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                background: 'var(--surface-inset)',
                borderBottom: '1px solid var(--border-subtle)',
              }}>
                <div style={S.thCell}>{t('rating.calibration.colGap')}</div>
                <div style={S.thCell}>{t('rating.calibration.femaleVsMale')}</div>
                <div style={S.thCell}>{t('rating.calibration.colSample')}</div>
              </div>

              {calibrationStats.map((item, idx) => {
                const isLast = idx === calibrationStats.length - 1
                const hasData = item.sampleSize > 0
                const winRatePct = hasData ? Math.round(item.observedWinRate * 100) : null
                const rateColor = !hasData
                  ? 'var(--text-muted)'
                  : winRatePct >= 40
                    ? 'var(--status-delivered-fg)'
                    : winRatePct >= 20
                      ? 'var(--status-delayed-fg)'
                      : 'var(--status-incident-fg)'
                const gapLabel = item.bucket === '<100'
                  ? t('rating.calibration.gapUnder100')
                  : item.bucket === '100-300'
                    ? t('rating.calibration.gap100to300')
                    : t('rating.calibration.gapOver300')

                return (
                  <div
                    key={item.bucket}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
                      minHeight: 52,
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ padding: '0 14px' }}>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {gapLabel}
                      </span>
                    </div>
                    <div style={{ padding: '0 14px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600, color: rateColor }}>
                        {hasData ? `${winRatePct}%` : '—'}
                      </span>
                    </div>
                    <div style={{ padding: '0 14px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>
                        {t('rating.calibration.matchCount', { n: item.sampleSize })}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Cột phải: Top thành viên đấu chéo & Thẻ hướng dẫn Cách dùng số này */}
          <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
            {/* Card 3: Top chéo giới */}
            <div style={{ ...S.card, overflow: 'hidden' }}>
              <div style={S.cardHead}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={S.cardTitle}>{t('rating.calibration.topCross')}</div>
                  <div style={S.cardSub}>{t('rating.calibration.topCrossSub')}</div>
                </div>
              </div>

              <div style={{ padding: 14, display: 'grid', gap: 8 }}>
                {topCrossPlayers.length === 0 ? (
                  <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
                    {t('rating.calibration.emptyCross')}
                  </div>
                ) : (
                  topCrossPlayers.map((p) => {
                    const badgeToken = p.confidence === 'very_high'
                      ? { bg: 'var(--status-delivered-bg)', color: 'var(--status-delivered-fg)' }
                      : p.confidence === 'high'
                        ? { bg: 'var(--status-transit-bg)', color: 'var(--status-transit-fg)' }
                        : p.confidence === 'medium'
                          ? { bg: 'var(--status-delayed-bg)', color: 'var(--status-delayed-fg)' }
                          : { bg: 'var(--status-incident-bg)', color: 'var(--status-incident-fg)' }

                    return (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '11px 13px',
                          borderRadius: 8,
                          background: 'var(--surface-inset)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <span style={{
                          flex: 1,
                          minWidth: 0,
                          fontFamily: 'var(--font-sans)',
                          fontWeight: 600,
                          fontSize: 14,
                          lineHeight: 1.3,
                          color: 'var(--text-primary)',
                        }}>
                          {p.name}
                        </span>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 400,
                          fontSize: 13,
                          lineHeight: 1.4,
                          color: 'var(--text-muted)',
                        }}>
                          {t('rating.calibration.crossMatchesCount', { n: p.count })}
                        </span>
                        <span style={{
                          fontFamily: 'var(--font-sans)',
                          fontWeight: 600,
                          fontSize: 10,
                          lineHeight: 1,
                          padding: '5px 9px',
                          borderRadius: 999,
                          background: badgeToken.bg,
                          color: badgeToken.color,
                          whiteSpace: 'nowrap',
                        }}>
                          {t('rating.confidence.' + p.confidence)}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Card 4: Cách dùng số này */}
            <div style={{
              ...S.card,
              padding: 14,
              display: 'grid',
              gap: 8,
            }}>
              <span style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 11,
                fontWeight: 600,
                lineHeight: 1.2,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}>
                {t('rating.calibration.howToUse')}
              </span>
              <span style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                lineHeight: 1.5,
                color: 'var(--text-secondary)',
              }}>
                {crossOverall.totalSample > 0
                  ? t('rating.calibration.howToUseDesc', { rate: crossOverall.winRate })
                  : t('rating.calibration.desc')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal chi tiết trận đấu (Screen S3) */}
      {viewingMatch && (
        <MatchDetailModal
          match={viewingMatch}
          onClose={() => setViewingMatch(null)}
          onEdit={(m) => {
            setViewingMatch(null)
            setEditingMatch(m)
          }}
        />
      )}

      {/* Modal sửa điểm inline */}
      {editingMatch && (
        <EditScoreModal
          match={editingMatch}
          allMatches={searchResults}
          onNavigateMatch={(nextM) => setEditingMatch(nextM)}
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

      {/* Sổ điểm chi tiết mùa giải VĐV (Screen SS3) */}
      {ledgerMemberId && (
        <MemberSeasonLedgerModal
          memberId={ledgerMemberId}
          db={db}
          seasonConfig={cfg.season}
          onClose={() => setLedgerMemberId(null)}
          onViewCareerElo={() => {
            setLedgerMemberId(null)
            setActiveTab('elo')
          }}
        />
      )}

      {/* Bản đồ 4 góc CLB (Screen SS4) */}
      {quadrantModalOpen && (
        <QuadrantMapModal
          leaderboardRows={seasonLeaderboardData?.leaderboard || []}
          medianElo={seasonMedianElo}
          seasonName={seasonLeaderboardData?.season?.name || cfg.season?.name || ''}
          onClose={() => setQuadrantModalOpen(false)}
          onSelectMember={(m) => {
            setQuadrantModalOpen(false)
            setLedgerMemberId(m?.id || m)
          }}
        />
      )}

      {/* Modal Thẩm định / Effective Strength (Screen CE3) */}
      {effectiveStrengthPlayer && (
        <EffectiveStrengthModal
          player={effectiveStrengthPlayer}
          onClose={() => setEffectiveStrengthPlayer(null)}
        />
      )}

      {/* Modal Cài đặt Mùa giải & Chốt mùa (Screen CE4) */}
      {seasonSettingsOpen && (
        <SeasonSettingsModal
          season={db.settings?.season || cfg.season}
          onClose={() => setSeasonSettingsOpen(false)}
          onSaveSeason={(newSeason) => {
            a.setSeasonConfig?.(newSeason)
            setSeasonSettingsOpen(false)
          }}
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
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
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
    color: 'var(--text-muted)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    background: 'var(--surface-card)',
    color: 'var(--text-primary)',
    boxShadow: 'var(--shadow-xs)',
  },
  card: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 10,
    boxShadow: 'var(--shadow-xs)',
    overflow: 'hidden',
  },
  cardHead: {
    padding: '14px 16px',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  cardTitle: {
    font: '600 16px/1.25 "IBM Plex Sans", sans-serif',
    color: 'var(--text-primary)',
  },
  cardSub: {
    font: '400 13px/1.4 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
  },
  statCardBox: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 10,
    boxShadow: 'var(--shadow-xs)',
    padding: '14px 16px',
    display: 'grid',
    gap: 6,
    alignContent: 'start',
  },
  statCardLabel: {
    font: '600 11px/1.2 "IBM Plex Sans", sans-serif',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  statCardSub: {
    font: '400 13px/1.4 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
  },
  seasonTableHead: {
    display: 'grid',
    gridTemplateColumns: '44px minmax(160px, 1fr) 120px 75px 95px 75px 85px 95px',
    background: 'var(--surface-inset)',
    borderBottom: '1px solid var(--border-subtle)',
  },
  seasonTableRow: {
    display: 'grid',
    gridTemplateColumns: '44px minmax(160px, 1fr) 120px 75px 95px 75px 85px 95px',
    borderBottom: '1px solid var(--border-subtle)',
    minHeight: 52,
    alignItems: 'center',
  },
  searchTableHead: {
    display: 'grid',
    gridTemplateColumns: '96px 165px 1.15fr 76px 1.15fr 88px 84px',
    background: 'var(--surface-inset)',
    borderBottom: '1px solid var(--border-subtle)',
  },
  searchTableRow: {
    display: 'grid',
    gridTemplateColumns: '96px 165px 1.15fr 76px 1.15fr 88px 84px',
    borderBottom: '1px solid var(--border-subtle)',
    minHeight: 52,
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
  thCell: {
    padding: '0 12px',
    minHeight: 38,
    display: 'flex',
    alignItems: 'center',
    font: '600 11px/1.2 "IBM Plex Sans", sans-serif',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
  },
  tdCell: {
    padding: '0 12px',
  },
  monoCode: {
    font: '600 12.5px/1.3 "IBM Plex Mono", monospace',
    color: 'var(--status-transit-fg)',
  },
  monoMeta: {
    font: '400 12px/1.4 "IBM Plex Mono", monospace',
    color: 'var(--text-muted)',
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
    background: 'var(--surface-raised)',
    border: '1px solid var(--border-default)',
    color: 'var(--status-transit-fg)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  contextCard: {
    padding: '14px 16px',
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    display: 'grid',
    gap: 4,
  },
  contextCardBox: {
    display: 'grid',
    gap: 6,
    padding: '11px 13px',
    borderRadius: 8,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
  },
  contextCardLabel: {
    font: '600 12px/1.3 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
  },
  contextHead: {
    font: '600 12px/1.2 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  contextScore: {
    font: '700 20px/1.2 "IBM Plex Mono", monospace',
    color: 'var(--text-primary)',
  },
  contextMeta: {
    font: '400 12px/1.4 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
  },
  matrixTable: {
    borderCollapse: 'collapse',
    fontSize: 13,
    width: '100%',
  },
  matrixTh: {
    padding: '8px 12px',
    border: '1px solid var(--border-subtle)',
    background: 'var(--surface-inset)',
    color: 'var(--text-muted)',
    fontWeight: 600,
    textAlign: 'center',
  },
  matrixRowLabel: {
    padding: '8px 12px',
    border: '1px solid var(--border-subtle)',
    background: 'var(--surface-inset)',
    color: 'var(--text-primary)',
    fontWeight: 600,
  },
  matrixCell: {
    padding: '8px 12px',
    border: '1px solid var(--border-subtle)',
    textAlign: 'center',
    fontFamily: '"IBM Plex Mono", monospace',
    fontWeight: 600,
  },
  matrixSelfCell: {
    padding: '8px 12px',
    border: '1px solid var(--border-subtle)',
    textAlign: 'center',
    color: 'var(--text-disabled)',
    background: 'var(--surface-page)',
  },
  pairBadge: {
    padding: '4px 10px',
    borderRadius: 6,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  bucketCard: {
    padding: '14px 16px',
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
  },
  bucketHead: {
    font: '600 12px/1.2 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  challengeBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    borderRadius: 6,
    background: 'linear-gradient(135deg, var(--teal-500), var(--teal-700))',
    color: 'var(--gray-0)',
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-xs)',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  bountyBanner: {
    padding: '14px 18px',
    borderRadius: 8,
    background: 'var(--status-delayed-bg)',
    border: '1px solid var(--border-subtle)',
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
    background: 'var(--status-delayed-bg)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    flexShrink: 0,
  },
  bountyTitle: {
    font: '700 14px "IBM Plex Sans", sans-serif',
    color: 'var(--status-delayed-fg)',
  },
  bountyBadge: {
    padding: '2px 8px',
    borderRadius: 4,
    background: 'var(--status-delayed-bg)',
    border: '1px solid var(--status-delayed-fg)',
    color: 'var(--status-delayed-fg)',
    fontSize: 11,
    fontWeight: 700,
  },
  bountyDesc: {
    fontSize: 12.5,
    color: 'var(--text-secondary)',
    marginTop: 2,
  },
  h2hScoreBig: {
    padding: '14px',
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: 8,
  },
  h2hStatsBox: {
    padding: '12px 14px',
    borderRadius: 8,
    border: '1px solid var(--border-subtle)',
    display: 'grid',
    gap: 6,
  },
  h2hStatRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
}
