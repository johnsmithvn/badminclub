import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Avatar, Button, Card, Dialog, Icon, Input, Select, StatCard } from '#ds'
import { LevelChip, Mono, Overline, SearchSelect, TabTrack } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { confidenceOf, getPlayerRating, rankTierOf, applyInactivityDecay, lastMatchAtOf, kFactorOf, MIN_RATING, DEFAULT_RATING, matchCodeOf, rankPairs } from '#lib/rating.js'
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
import PairH2HTab from '#components/leaderboard/PairH2HTab.jsx'
import MemberSeasonLedgerModal from '#components/leaderboard/MemberSeasonLedgerModal.jsx'
import EffectiveStrengthModal from '#components/session/EffectiveStrengthModal.jsx'
import SeasonSettingsModal from '#components/session/SeasonSettingsModal.jsx'
import { calculateSeasonLeaderboard } from '#lib/season.js'
import { buildPlayableVideoUrl, formatGapMinutes, parseVideoProvider } from '#utils/videoUtils.js'
import AttachVideoModal, { MatchVideoInlineExpander } from '#components/challenge/AttachVideoModal.jsx'

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
  const { isDark, toggleTheme, isGlamorous, toggleThemeMode } = useTheme()
  const navigate = useNavigate()
  const isMobile = useMobile()
  const [activeTab, setActiveTab] = useState('season') // 'season' | 'elo' | 'pairs' | 'matrix' | 'search'
  const [genderFilter, setGenderFilter] = useState('all') // 'all' | 'nam' | 'nu'
  const [rankTheme, setRankTheme] = useState(DEFAULT_RANK_THEME)

  // State cho Tab 2 (Biểu đồ / Profile)
  const [selectedMemberId, setSelectedMemberId] = useState(null)

  // State cho Tab 3 (Tìm trận)
  const [playerA, setPlayerA] = useState('')
  const [playerB, setPlayerB] = useState('')
  const [searchMode, setSearchMode] = useState('vs') // 'vs' | 'team'
  const [qualityFilter, setQualityFilter] = useState('all') // 'all' | 'close' | 'upset'
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [seasonFilter, setSeasonFilter] = useState('all')
  const [courtFilter, setCourtFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [onlyVideoFilter, setOnlyVideoFilter] = useState(false)
  const [sortOption, setSortOption] = useState('latest') // 'latest' | 'dramatic' | 'elo_swing'
  const [editingMatch, setEditingMatch] = useState(null)
  const [viewingMatch, setViewingMatch] = useState(null)
  const [searchCardLimit, setSearchCardLimit] = useState(10)
  const [expandedVideoMatchId, setExpandedVideoMatchId] = useState(null)

  // State cho Gạ kèo (K6)
  const [challengeModalOpen, setChallengeModalOpen] = useState(false)
  const [initialTeamA, setInitialTeamA] = useState([])
  const [initialTeamB, setInitialTeamB] = useState([])

  // State cho Hệ 3 tầng (Season & Elo & Matchmaking)
  const [ledgerMemberId, setLedgerMemberId] = useState(null)
  const [effectiveStrengthPlayer, setEffectiveStrengthPlayer] = useState(null)
  const [seasonSettingsOpen, setSeasonSettingsOpen] = useState(false)
  const [recalcConfirmOpen, setRecalcConfirmOpen] = useState(false)

  const activeMembers = useMemo(() => {
    return (db.members || []).filter((m) => m.active !== false)
  }, [db.members])

  const seasonLeaderboardData = useMemo(() => {
    const raw = calculateSeasonLeaderboard(db, cfg.season)
    const enrichedList = (raw.leaderboard || []).map((row) => {
      const pr = getPlayerRating(db.playerRatings, row.id, row.member || row, db.levels)
      const elo = pr.displayRating ?? pr.rating ?? DEFAULT_RATING
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

  const handleExportCsv = () => {
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF'
    if (activeTab === 'season') {
      csvContent += 'Thứ hạng,Thành viên,Giới tính,Điểm mùa,Số buổi,Số trận,Thắng,Upset\n' // i18n-ok: csv header
      const rawRows = seasonLeaderboardData?.leaderboard || []
      const filtered = genderFilter === 'all'
        ? rawRows
        : rawRows.filter((r) => (r.gender || 'nam') === genderFilter)
      filtered.forEach((r, idx) => {
        const displayRank = genderFilter === 'all' ? r.rank : idx + 1
        const gTxt = t(r.gender === 'nu' ? 'gender.nu' : 'gender.nam')
        csvContent += `"${displayRank}","${r.name}","${gTxt}","${r.totalSeasonPoints}","${r.attendedCount || 0}","${r.matchesCount || 0}","${r.winsCount || 0}","${r.upsetsCount || 0}"\n`
      })
    } else if (activeTab === 'pairs') {
      csvContent += 'Thứ hạng,Cặp,Số trận,Kỳ vọng %,Thực tế %,Lệch (pp),Độ hợp cạ,Độ tin cậy\n' // i18n-ok: csv header
      const pData = rankPairs(db.matches || [], memberMap, db.playerRatings || {}, { format: 'all', minGames: 1 })
        ; (pData.rankedPairs || []).forEach((r, idx) => {
          csvContent += `"${idx + 1}","${r.names.join(' - ')}","${r.gamesCount}","${r.expectedWinPct}%","${r.actualWinPct}%","${r.pairImpact}","${r.synergyScore}","${r.confidence}"\n`
        })
    } else {
      csvContent += 'Thứ hạng,Thành viên,Giới tính,Elo,Số trận,Độ tin cậy\n' // i18n-ok: csv header
      const rawRows = activeMembers
        .map((m) => {
          const pr = getPlayerRating(db.playerRatings, m.id, m, db.levels)
          return {
            id: m.id,
            name: m.name,
            gender: m.gender || 'nam',
            rating: pr.displayRating ?? pr.rating ?? DEFAULT_RATING,
            gamesCount: pr.gamesCount || 0,
            confidence: pr.confidence || 'low',
          }
        })
        .sort((a, b) => b.rating - a.rating)
      const filtered = genderFilter === 'all'
        ? rawRows
        : rawRows.filter((r) => (r.gender || 'nam') === genderFilter)
      filtered.forEach((r, idx) => {
        const displayRank = idx + 1
        const gTxt = t(r.gender === 'nu' ? 'gender.nu' : 'gender.nam')
        csvContent += `"${displayRank}","${r.name}","${gTxt}","${r.rating}","${r.gamesCount}","${r.confidence}"\n`
      })
    }
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `badminclub_${activeTab}_${genderFilter}_leaderboard.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const memberMap = useMemo(() => {
    const map = {}
      ; (db?.members || []).forEach((m) => { if (m?.id) map[m.id] = m })
      ; (db?.guests || []).forEach((g) => { if (g?.id) map[g.id] = g })
      ; (db?.sessionGuests || []).forEach((sg) => {
        if (sg.guestId) {
          const g = (db?.guests || []).find((x) => x.id === sg.guestId)
          if (g) map[sg.id] = { ...g, ...sg, gender: g.gender || sg.gender }
        }
        if (sg.memberId) {
          const m = (db?.members || []).find((x) => x.id === sg.memberId)
          if (m) map[sg.id] = { ...m, ...sg, gender: m.gender || sg.gender }
        }
        if (!map[sg.id] && sg.id) {
          map[sg.id] = { id: sg.id, name: sg.name || playerName(db, sg.id) || sg.id, gender: sg.gender }
        }
      })
    return map
  }, [db])

  const normalizedRatingsMap = useMemo(() => {
    const map = {}
      ; (db?.members || []).forEach((m) => {
        if (m?.id) {
          const pr = getPlayerRating(db.playerRatings, m.id, m, db.levels)
          map[m.id] = pr.rating
        }
      })
      ; (db?.guests || []).forEach((g) => {
        if (g?.id) {
          const pr = getPlayerRating(db.playerRatings, g.id, g, db.levels)
          map[g.id] = pr.rating
        }
      })
      ; (db?.sessionGuests || []).forEach((sg) => {
        if (sg?.id && !map[sg.id]) {
          const realId = sg.guestId || sg.memberId || sg.id
          const pr = getPlayerRating(db.playerRatings, realId, sg, db.levels)
          map[sg.id] = pr.rating
        }
      })
    return map
  }, [db?.members, db?.guests, db?.sessionGuests, db?.playerRatings, db?.levels])

  const memberNameOf = useCallback((id) => playerName(db, id), [db])

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

      const lastMatchDate = lastMatchAtOf(db.matches || [], m.id)
      const decay = applyInactivityDecay(pr.rating, lastMatchDate)
      const displayRating = Math.max(MIN_RATING, decay.rating)
      const tier = rankTierOf(displayRating, rankTheme)
      const k = kFactorOf(totalGames || gamesCount)

      return {
        id: m.id,
        name: m.name,
        avatarUrl: m.avatarUrl || m.avatar || '',
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

    return memberRows
  }, [activeMembers, db.playerRatings, db.matches, rankTheme, db.levels])

  // -------------------------------------------------------------
  // Thành viên được chọn để mở Modal Hồ sơ / Biểu đồ Elo
  // -------------------------------------------------------------
  const currentMember = useMemo(() => {
    if (!selectedMemberId) return null
    return (
      activeMembers.find((m) => m.id === selectedMemberId) ||
      (db?.members || []).find((m) => m.id === selectedMemberId) ||
      (db?.guests || []).find((g) => g.id === selectedMemberId) ||
      null
    )
  }, [selectedMemberId, activeMembers, db?.members, db?.guests])

  // -------------------------------------------------------------
  // TAB 3: Dữ liệu Tìm trận
  // -------------------------------------------------------------
  const searchResults = useMemo(() => {
    const ratingsMap = {}
    activeMembers.forEach((m) => {
      ratingsMap[m.id] = getPlayerRating(db.playerRatings, m.id, m, db.levels).rating
    })

    let list = searchMatches(db.matches || [], {
      playerA: playerA || null,
      playerB: playerB || null,
      mode: searchMode,
      quality: qualityFilter,
      ratingsMap,
    })

    if (onlyVideoFilter) {
      list = list.filter((m) => Boolean(m.videoUrl))
    }
    if (courtFilter !== 'all') {
      list = list.filter((m) => {
        const s = (db.sessions || []).find((x) => x.id === m.sessionId)
        const courtObj = s?.courts?.[m.courtIdx]
        return courtObj?.courtId === courtFilter || String(m.courtIdx) === courtFilter
      })
    }
    if (sourceFilter !== 'all') {
      list = list.filter((m) => {
        const isFromChal = Boolean(m.challengeId || m.sourceType === 'challenge')
        return sourceFilter === 'challenge' ? isFromChal : !isFromChal
      })
    }

    // Sắp xếp
    if (sortOption === 'dramatic') {
      list.sort((a, b) => {
        const aSets = a.sets || []
        const bSets = b.sets || []
        const aDiff = aSets.length ? Math.min(...aSets.map(([s1, s2]) => Math.abs(s1 - s2))) : 99
        const bDiff = bSets.length ? Math.min(...bSets.map(([s1, s2]) => Math.abs(s1 - s2))) : 99
        return aDiff - bDiff
      })
    } else if (sortOption === 'elo_swing') {
      list.sort((a, b) => Math.abs(b.eloDelta || 0) - Math.abs(a.eloDelta || 0))
    } else {
      list.sort((a, b) => (b.at || 0) - (a.at || 0))
    }

    return list
  }, [db.matches, playerA, playerB, searchMode, qualityFilter, onlyVideoFilter, courtFilter, sourceFilter, sortOption, db.playerRatings, activeMembers, db.levels, db.sessions])

  const dayGroups = useMemo(() => {
    const groups = []
    const dayMap = new Map()

    searchResults.slice(0, searchCardLimit).forEach((m) => {
      const s = (db.sessions || []).find((x) => x.id === m.sessionId)
      const dateKey = s?.date ? s.date : (m.at ? new Date(m.at).toISOString().slice(0, 10) : 'unknown')
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, [])
      }
      dayMap.get(dateKey).push(m)
    })

    const todayStr = new Date().toISOString().slice(0, 10)
    const yesterdayDate = new Date(Date.now() - 86400000)
    const yesterdayStr = yesterdayDate.toISOString().slice(0, 10)

    for (const [dateKey, matchesInDay] of dayMap.entries()) {
      matchesInDay.sort((a, b) => (b.at || 0) - (a.at || 0))

      const earliestAt = Math.min(...matchesInDay.map((m) => m.at || 0).filter(Boolean))
      const latestAt = Math.max(...matchesInDay.map((m) => m.at || 0).filter(Boolean))

      const startTimeStr = earliestAt ? new Date(earliestAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '19:00'
      const endTimeStr = latestAt ? new Date(latestAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '21:40'
      const timeRange = `${startTimeStr} → ${endTimeStr}`

      let durationText = ''
      if (earliestAt && latestAt && latestAt > earliestAt) {
        const totalMins = Math.round((latestAt - earliestAt) / 60000)
        const hrs = Math.floor(totalMins / 60)
        const mins = totalMins % 60
        durationText = hrs > 0 ? `${hrs}h${mins > 0 ? mins + '′' : ''}` : `${mins}′`
      }

      let dateLabel = dateKey
      if (dateKey !== 'unknown') {
        const dObj = new Date(dateKey)
        const dStr = dd(dateKey)
        if (dateKey === todayStr) {
          dateLabel = `${t('matchVideo.today')} · ${dStr}`
        } else if (dateKey === yesterdayStr) {
          dateLabel = `${t('matchVideo.yesterday')} · ${dStr}`
        } else {
          const daysOfWeek = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'] // i18n-ok: day names array
          const dayName = daysOfWeek[dObj.getDay()] || ''
          dateLabel = `${dayName} · ${dStr}`
        }
      }

      const videoCount = matchesInDay.filter((m) => Boolean(m.videoUrl)).length

      const matchesWithMeta = matchesInDay.map((m, idx) => {
        const prevMatch = matchesInDay.slice(idx + 1).find((other) => other.at && m.at && other.at < m.at)
        const gapText = formatGapMinutes(m.at, prevMatch?.at)
        return {
          ...m,
          gapText: prevMatch ? gapText : (idx === matchesInDay.length - 1 ? t('matchVideo.sessionOpen') : gapText),
        }
      })

      groups.push({
        dateKey,
        dateLabel,
        timeRange,
        durationText,
        videoCount,
        totalMatches: matchesInDay.length,
        matches: matchesWithMeta,
      })
    }

    return groups
  }, [searchResults, searchCardLimit, db.sessions])

  // -------------------------------------------------------------
  // TAB 4: Ma trận Đối đầu H2H
  // -------------------------------------------------------------
  const [matrixMemberLimit, setMatrixMemberLimit] = useState(() => (isMobile ? 5 : 8))

  // Đếm số trận đối đầu của từng thành viên với các thành viên khác trong CLB
  const memberH2HCounts = useMemo(() => {
    const counts = {}
    const activeIds = new Set((activeMembers || []).map((m) => m.id))
    activeIds.forEach((id) => { counts[id] = 0 })

      ; (db.matches || []).forEach((m) => {
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
  }, [playerA, playerB, searchResults.length, memberNameOf])

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

  const headerSubText = activeTab === 'season'
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
          : t('leaderboard.sub')

  const headerActionButtons = (
    <>
      <button
        type="button"
        onClick={toggleTheme}
        title={isDark ? t('common.themeLight') : t('common.themeDark')}
        aria-label={isDark ? t('common.themeLight') : t('common.themeDark')}
        style={{
          font: "600 12px/1 'IBM Plex Sans', sans-serif",
          width: isMobile ? 32 : undefined,
          height: isMobile ? 32 : undefined,
          padding: isMobile ? 0 : '8px 12px',
          borderRadius: 6,
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          transition: 'all 0.15s ease',
          flexShrink: 0,
        }}
      >
        <Icon name={isDark ? 'sun' : 'moon'} size={15} />
        {!isMobile && <span>{isDark ? t('common.themeLight') : t('common.themeDark')}</span>}
      </button>

      <button
        type="button"
        onClick={toggleThemeMode}
        title={isGlamorous ? t('settings.themeModeSimple') : t('settings.themeModeGlamorous')}
        aria-label={isGlamorous ? t('settings.themeModeSimple') : t('settings.themeModeGlamorous')}
        style={{
          font: "600 12px/1 'IBM Plex Sans', sans-serif",
          height: isMobile ? 32 : undefined,
          padding: isMobile ? '0 8px' : '8px 12px',
          borderRadius: 6,
          background: isGlamorous ? 'linear-gradient(135deg, #FFE24B, #FF9E00)' : 'var(--surface-raised)',
          border: isGlamorous ? '1px solid #D4A836' : '1px solid var(--border-default)',
          color: isGlamorous ? '#140109' : 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          transition: 'all 0.15s ease',
          flexShrink: 0,
        }}
      >
        <Icon name="sparkles" size={15} />
        {!isMobile && <span>{isGlamorous ? t('settings.themeModeGlamorous') : t('settings.themeModeSimple')}</span>}
      </button>

      {activeTab === 'search' ? (
        <>
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            title={t('leaderboard.tabMatrix')}
            aria-label={t('leaderboard.tabMatrix')}
            style={{
              font: "600 12px/1 'IBM Plex Sans', sans-serif",
              width: isMobile ? 32 : undefined,
              height: isMobile ? 32 : undefined,
              padding: isMobile ? 0 : '8px 14px',
              borderRadius: 6,
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
          >
            <Icon name="grid" size={14} />
            {!isMobile && <span>{t('leaderboard.tabMatrix')}</span>}
          </button>
          <button
            type="button"
            onClick={handleExportFilteredMatchesCsv}
            title={t('matchSearch.exportFilteredCsv', { count: searchResults.length })}
            aria-label={t('matchSearch.exportFilteredCsv', { count: searchResults.length })}
            style={{
              font: "600 12px/1 'IBM Plex Sans', sans-serif",
              width: isMobile ? 32 : undefined,
              height: isMobile ? 32 : undefined,
              padding: isMobile ? 0 : '8px 14px',
              borderRadius: 6,
              background: '#1D50A0',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
          >
            <Icon name="download" size={14} />
            {!isMobile && <span>{t('matchSearch.exportFilteredCsv', { count: searchResults.length })}</span>}
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
                  padding: isMobile ? '4px 7px' : '5px 10px',
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
              width: isMobile ? 32 : undefined,
              height: isMobile ? 32 : undefined,
              padding: isMobile ? 0 : '8px 14px',
              borderRadius: 6,
              background: '#1D50A0',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
              flexShrink: 0,
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
              width: isMobile ? 32 : undefined,
              height: isMobile ? 32 : undefined,
              padding: isMobile ? 0 : '8px 14px',
              borderRadius: 6,
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
          >
            <Icon name="download" size={14} />
            {!isMobile && <span>{t('common.exportCsv')}</span>}
          </button>
          <button
            type="button"
            onClick={() => setRecalcConfirmOpen(true)}
            title={t('leaderboard.recalcHint')}
            aria-label={t('leaderboard.btnRecalc')}
            style={{
              font: "600 12px/1 'IBM Plex Sans', sans-serif",
              width: isMobile ? 32 : undefined,
              height: isMobile ? 32 : undefined,
              padding: isMobile ? 0 : '8px 14px',
              borderRadius: 6,
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
          >
            <Icon name="rotate-ccw" size={14} />
            {!isMobile && <span>{t('leaderboard.btnRecalc')}</span>}
          </button>
          <button
            type="button"
            onClick={() => setSeasonSettingsOpen(true)}
            title={t('season.settingsBtn')}
            aria-label={t('season.settingsBtn')}
            style={{
              font: "600 12px/1 'IBM Plex Sans', sans-serif",
              width: isMobile ? 32 : undefined,
              height: isMobile ? 32 : undefined,
              padding: isMobile ? 0 : '8px 14px',
              borderRadius: 6,
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
          >
            <Icon name="settings" size={14} />
            {!isMobile && <span>{t('season.settingsBtn')}</span>}
          </button>
        </>
      )}
    </>
  )

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* ---------------- Header trang Bảng xếp hạng (Duy nhất) ---------------- */}
      <div
        style={{
          padding: isMobile ? '12px 14px' : '14px 20px',
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: isMobile ? 8 : 14,
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: isMobile ? 'nowrap' : 'wrap',
            minWidth: 0,
            flex: isMobile ? undefined : '1 1 240px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            <h1 style={{ font: isMobile ? "700 18px/1.2 Barlow, sans-serif" : "700 20px/1.25 Barlow, sans-serif", color: 'var(--text-primary)', margin: 0 }}>
              {t('leaderboard.title')}
            </h1>
            {!isMobile && (
              <div style={{ font: "400 13px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                {headerSubText}
              </div>
            )}
          </div>
          {isMobile && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
              {headerActionButtons}
            </div>
          )}
        </div>

        {isMobile && (
          <div style={{ font: "400 12.5px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
            {headerSubText}
          </div>
        )}

        {!isMobile && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {headerActionButtons}
          </div>
        )}
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
            onClick={() => setActiveTab('h2h')}
            style={{
              ...S.tabBtn,
              ...(activeTab === 'h2h'
                ? { ...S.tabBtnActive, background: '#7C3AED', color: '#fff', fontWeight: 700 }
                : {}),
            }}
          >
            {t('leaderboard.tabH2H')}
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
        </div>
      </TabTrack>

      {/* ---------------- TAB 1: Đua Top Mùa Giải (Screen SS1) ---------------- */}
      {activeTab === 'season' && (
        <SeasonRaceTab
          seasonLeaderboardData={seasonLeaderboardData}
          onOpenLedger={(m) => setLedgerMemberId(m?.id || m)}
          isMobile={isMobile}
          genderFilter={genderFilter}
          onGenderFilterChange={setGenderFilter}
        />
      )}

      {/* ---------------- TAB 2: Bảng co (Screen SS2) ---------------- */}
      {activeTab === 'elo' && (
        <CareerEloTab
          db={db}
          members={activeMembers}
          playerRatings={db.playerRatings}
          matches={db.matches || []}
          levels={db.levels}
          onOpenEffectiveStrengthModal={(player) => setEffectiveStrengthPlayer(player)}
          onSelectMember={(player) => setSelectedMemberId(player?.id || player)}
          isMobile={isMobile}
          genderFilter={genderFilter}
          onGenderFilterChange={setGenderFilter}
        />
      )}

      {/* ---------------- TAB PAIRS: Ăn ý & Khắc chế (Screen AY1) ---------------- */}
      {activeTab === 'pairs' && (
        <PairsTab
          db={db}
          matches={db.matches || []}
          membersMap={memberMap}
          ratingsMap={normalizedRatingsMap}
          onExportCsv={handleExportCsv}
          onViewPairMatches={(pair) => {
            const pairKey = pair?.key || (pair?.playerA && pair?.playerB ? `${pair.playerA}:${pair.playerB}` : '')
            const [p1, p2] = pairKey.split(':')
            setPlayerA(p1 || '')
            setPlayerB(p2 || '')
            setActiveTab('search')
          }}
          onOpenChallengeModal={(p1, p2) => {
            setInitialTeamA([p1])
            setInitialTeamB([p2])
            setChallengeModalOpen(true)
          }}
        />
      )}

      {/* ---------------- TAB 3: Tìm trận & Lịch sử đấu + Video ---------------- */}
      {activeTab === 'search' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div
            style={{
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
              overflow: 'hidden',
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            {/* 1. Thanh Tìm trận thu gọn 1 dòng 34px (tiết kiệm ~82px so với card cũ) */}
            <div
              style={{
                padding: '11px 14px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                flexWrap: 'wrap',
                background: 'var(--surface-inset)',
              }}
            >
              {/* Cụm gộp Người chơi A ⇄ Người chơi B */}
              <div
                style={{
                  height: 34,
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 7,
                  background: 'var(--field-bg)',
                  border: '1px solid var(--border-default)',
                  overflow: 'hidden',
                }}
              >
                <div style={{ width: isMobile ? 110 : 138, height: 32 }}>
                  <select
                    value={playerA}
                    onChange={(e) => setPlayerA(e.target.value)}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      background: 'transparent',
                      color: playerA ? 'var(--text-primary)' : 'var(--text-muted)',
                      font: "500 12.5px/1 'IBM Plex Sans', sans-serif",
                      padding: '0 8px',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">A · {t('matchSearch.playerA')}</option>
                    {activeMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const temp = playerA
                    setPlayerA(playerB)
                    setPlayerB(temp)
                  }}
                  style={{
                    width: 30,
                    height: 32,
                    border: 'none',
                    borderLeft: '1px solid var(--border-subtle)',
                    borderRight: '1px solid var(--border-subtle)',
                    background: 'transparent',
                    color: 'var(--teal-500)',
                    font: "600 13px/1 'IBM Plex Mono', monospace",
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title={t('common.swap')}
                >
                  ⇄
                </button>

                <div style={{ width: isMobile ? 110 : 138, height: 32 }}>
                  <select
                    value={playerB}
                    onChange={(e) => setPlayerB(e.target.value)}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      background: 'transparent',
                      color: playerB ? 'var(--text-primary)' : 'var(--text-muted)',
                      font: "500 12.5px/1 'IBM Plex Sans', sans-serif",
                      padding: '0 8px',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">B · {t('matchSearch.playerB')}</option>
                    {activeMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Chế độ đối đầu / cùng đội */}
              <div
                style={{
                  height: 34,
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 7,
                  background: 'var(--field-bg)',
                  border: '1px solid var(--border-default)',
                  padding: '0 4px',
                }}
              >
                <select
                  value={searchMode}
                  onChange={(e) => setSearchMode(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    font: "500 12.5px/1 'IBM Plex Sans', sans-serif",
                    padding: '0 6px',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="vs">{t('matchSearch.modeH2H')}</option>
                  <option value="team">{t('matchSearch.modeTeammate')}</option>
                </select>
              </div>

              {/* Dropdown kịch tính */}
              <div
                style={{
                  height: 34,
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 7,
                  background: 'var(--field-bg)',
                  border: '1px solid var(--border-default)',
                  padding: '0 4px',
                }}
              >
                <select
                  value={qualityFilter}
                  onChange={(e) => setQualityFilter(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    font: "500 12.5px/1 'IBM Plex Sans', sans-serif",
                    padding: '0 6px',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="all">{t('matchSearch.qualityAll')}</option>
                  <option value="close">{t('matchSearch.qualityClose')}</option>
                  <option value="upset">{t('matchSearch.qualityUpset')}</option>
                </select>
              </div>

              {/* Nút Lọc thêm */}
              <button
                type="button"
                onClick={() => setShowMoreFilters((prev) => !prev)}
                style={{
                  height: 34,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0 11px',
                  borderRadius: 7,
                  border: '1px solid var(--border-subtle)',
                  background: showMoreFilters ? 'var(--surface-sunken)' : 'transparent',
                  font: "500 12.5px/1 'IBM Plex Sans', sans-serif",
                  color: showMoreFilters ? 'var(--teal-500)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <span>{t('matchVideo.moreFilters')}</span>
                <span style={{ font: "400 9px/1 'IBM Plex Mono', monospace", color: 'var(--teal-500)' }}>
                  {showMoreFilters ? '▲' : '▾'}
                </span>
              </button>

              {/* Nút Xoá lọc */}
              {(playerA || playerB || qualityFilter !== 'all' || searchMode !== 'vs' || onlyVideoFilter || courtFilter !== 'all' || sourceFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setPlayerA('')
                    setPlayerB('')
                    setSearchMode('vs')
                    setQualityFilter('all')
                    setOnlyVideoFilter(false)
                    setCourtFilter('all')
                    setSourceFilter('all')
                  }}
                  style={{
                    height: 30,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 10px',
                    borderRadius: 7,
                    border: 'none',
                    background: 'transparent',
                    font: "600 12px/1 'IBM Plex Sans', sans-serif",
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {t('matchVideo.clearFilters')}
                </button>
              )}

              <div style={{ flex: 1, minWidth: 20 }} />

              {/* Bộ chọn Sắp xếp */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: 3,
                  borderRadius: 8,
                  background: 'var(--field-bg)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {[
                  { id: 'latest', label: t('matchVideo.sortLatest') },
                  { id: 'dramatic', label: t('matchVideo.sortDramatic') },
                  { id: 'elo_swing', label: t('matchVideo.sortEloSwing') },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSortOption(opt.id)}
                    style={{
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 10px',
                      borderRadius: 6,
                      border: 'none',
                      background: sortOption === opt.id ? 'var(--surface-card)' : 'transparent',
                      font: sortOption === opt.id ? "600 12px/1 'IBM Plex Sans', sans-serif" : "500 12px/1 'IBM Plex Sans', sans-serif",
                      color: sortOption === opt.id ? 'var(--text-primary)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      boxShadow: sortOption === opt.id ? 'var(--shadow-xs)' : 'none',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hàng lọc thứ 2 (Lọc thêm) */}
            {showMoreFilters && (
              <div
                style={{
                  padding: '9px 14px',
                  background: 'var(--surface-inset)',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <div
                  style={{
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                    borderRadius: 6,
                    background: 'var(--field-bg)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <select
                    value={seasonFilter}
                    onChange={(e) => setSeasonFilter(e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      font: "500 12px/1 'IBM Plex Sans', sans-serif",
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="all">{t('matchVideo.filterSeason', { season: '2026' })}</option>
                  </select>
                </div>

                <div
                  style={{
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                    borderRadius: 6,
                    background: 'var(--field-bg)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <select
                    value={courtFilter}
                    onChange={(e) => setCourtFilter(e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      font: "500 12px/1 'IBM Plex Sans', sans-serif",
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="all">{t('matchVideo.filterAllCourts')}</option>
                    {(db.courts || []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  style={{
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                    borderRadius: 6,
                    background: 'var(--field-bg)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      font: "500 12px/1 'IBM Plex Sans', sans-serif",
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="all">{t('matchVideo.filterAllSources')}</option>
                    <option value="session">{t('challenge.fromCourt')}</option>
                    <option value="challenge">{t('challenge.challenge')}</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setOnlyVideoFilter((prev) => !prev)}
                  style={{
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 10px',
                    borderRadius: 6,
                    border: '1px solid',
                    borderColor: onlyVideoFilter ? 'var(--teal-500)' : 'var(--border-subtle)',
                    background: onlyVideoFilter ? 'var(--surface-brand-soft, rgba(0,178,169,.14))' : 'var(--field-bg)',
                    color: onlyVideoFilter ? 'var(--teal-500)' : 'var(--text-secondary)',
                    font: "600 12px/1 'IBM Plex Sans', sans-serif",
                    cursor: 'pointer',
                  }}
                >
                  {t('matchVideo.onlyHasVideo')}
                </button>
              </div>
            )}

            {/* Thanh đối đầu H2H trực quan khi chọn đủ 2 người */}
            {h2hSummary && playerA && playerB && (
              <div
                style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  flexWrap: 'wrap',
                  background: 'var(--surface-card)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 200 }}>
                  <div style={{ font: "600 14px/1.25 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                    {t('matchVideo.h2hMeetingTitle', { nameA: memberNameOf(playerA), nameB: memberNameOf(playerB), matches: h2hSummary.totalVs })}
                  </div>
                  <div style={{ font: "400 11.5px/1.3 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                    {t('matchVideo.h2hWinsLosses', { wins: h2hSummary.aWins, losses: h2hSummary.bWins, videos: searchResults.filter((m) => Boolean(m.videoUrl)).length })}
                    {h2hSummary.lastDate ? t('matchVideo.h2hLastMet', { date: h2hSummary.lastDate }) : ''}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 120,
                        height: 7,
                        borderRadius: 999,
                        background: 'var(--surface-sunken)',
                        overflow: 'hidden',
                        display: 'flex',
                      }}
                    >
                      <div style={{ width: `${Math.max(5, Math.min(95, Number(h2hSummary.aWinRate) || 50))}%`, background: 'var(--teal-500)' }} />
                      <div style={{ flex: 1, background: 'var(--navy-700, #3B4C6B)' }} />
                    </div>
                    <div style={{ font: "600 12px/1 'IBM Plex Mono', monospace", color: 'var(--teal-500)' }}>
                      {h2hSummary.aWinRate}%
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setInitialTeamA([playerA])
                      setInitialTeamB([playerB])
                      setChallengeModalOpen(true)
                    }}
                    style={{
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '0 10px',
                      borderRadius: 6,
                      background: 'var(--surface-brand-soft, rgba(0,178,169,.14))',
                      border: '1px solid var(--teal-500)',
                      color: 'var(--teal-500)',
                      font: "600 11.5px/1 'IBM Plex Sans', sans-serif",
                      cursor: 'pointer',
                    }}
                  >
                    <span>🎯</span>
                    <span>{t('matchSearch.challengeBetween')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Thanh tiêu đề thống kê & pills */}
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                flexWrap: 'wrap',
                background: 'var(--surface-card)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 180 }}>
                <div style={{ font: "600 15px/1.25 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                  {t('matchVideo.recentMatchesHeader', { n: searchResults.length })}
                </div>
                <div style={{ font: "400 11.5px/1.3 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                  {t('matchVideo.recentMatchesSub')}
                </div>
              </div>

              <div
                style={{
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 10px',
                  borderRadius: 999,
                  background: 'rgba(0,178,169,.14)',
                  border: '1px solid rgba(0,178,169,.42)',
                  font: "600 11.5px/1 'IBM Plex Sans', sans-serif",
                  color: '#5FDBD3',
                }}
              >
                {t('matchVideo.hasVideoCount', { n: searchResults.filter((m) => Boolean(m.videoUrl)).length })}
              </div>

              <div
                style={{
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 10px',
                  borderRadius: 999,
                  background: 'var(--surface-inset)',
                  border: '1px solid var(--border-subtle)',
                  font: "500 11.5px/1 'IBM Plex Sans', sans-serif",
                  color: 'var(--text-secondary)',
                }}
              >
                {t('matchVideo.tagClose')} {searchResults.filter((m) => (m.sets || []).some((s) => s && s[0] != null && s[1] != null && Math.abs(s[0] - s[1]) <= 3)).length}
              </div>

              <div
                style={{
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 10px',
                  borderRadius: 999,
                  background: 'var(--surface-inset)',
                  border: '1px solid var(--border-subtle)',
                  font: "500 11.5px/1 'IBM Plex Sans', sans-serif",
                  color: 'var(--text-secondary)',
                }}
              >
                {t('matchVideo.tagUpset')} {searchResults.filter((m) => {
                  const ra = m.initialRatingA || 0
                  const rb = m.initialRatingB || 0
                  const aWon = m.winnerTeam === 'A'
                  return Math.abs(ra - rb) > 100 && ((ra < rb && aWon) || (rb < ra && !aWon))
                }).length}
              </div>

              {editedMatchesCount > 0 && (
                <div
                  style={{
                    height: 26,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 10px',
                    borderRadius: 999,
                    background: 'rgba(240,183,92,.16)',
                    border: '1px solid rgba(240,183,92,.4)',
                    font: "600 11.5px/1 'IBM Plex Sans', sans-serif",
                    color: 'var(--status-delayed-fg)',
                  }}
                >
                  {t('matchSearch.editedMatchesCount', { count: editedMatchesCount })}
                </div>
              )}
            </div>

            {/* BẢNG LỊCH SỬ TRẬN ĐẤU 10 CỘT */}
            <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ minWidth: 960 }}>
                {/* Header Cột */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '50px 44px 62px 68px minmax(0,1fr) 88px minmax(0,1fr) 100px 98px 68px',
                    background: 'var(--surface-inset)',
                    borderBottom: '1px solid var(--border-subtle)',
                    font: "600 10px/1.2 'IBM Plex Sans', sans-serif",
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                  }}
                >
                  <div style={{ padding: '9px 0 9px 14px' }}>{t('matchVideo.colCode')}</div>
                  <div style={{ padding: '9px 2px' }} />
                  <div style={{ padding: '9px 6px' }}>{t('matchVideo.colTime')}</div>
                  <div style={{ padding: '9px 6px' }}>{t('matchVideo.colCourt')}</div>
                  <div style={{ padding: '9px 8px' }}>{t('matchVideo.colWinner')}</div>
                  <div style={{ padding: '9px 8px', textAlign: 'center' }}>{t('matchVideo.colScore')}</div>
                  <div style={{ padding: '9px 8px' }}>{t('matchVideo.colLoser')}</div>
                  <div style={{ padding: '9px 6px', textAlign: 'center' }}>{t('matchVideo.colPrediction')}</div>
                  <div style={{ padding: '9px 6px', textAlign: 'center' }}>{t('matchVideo.colVideo')}</div>
                  <div style={{ padding: '9px 14px 9px 6px', textAlign: 'right' }}>{t('matchVideo.colSource')}</div>
                </div>

                {/* Danh sách nhóm theo ngày */}
                {dayGroups.map((group) => (
                  <div key={group.dateKey}>
                    {/* Dòng Header Ngày */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        minHeight: 36,
                        padding: '0 14px',
                        background: 'rgba(0,178,169,.06)',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          background: 'var(--teal-500)',
                        }}
                      />
                      <div style={{ font: "600 12px/1 'IBM Plex Sans', sans-serif", color: 'var(--teal-500)' }}>
                        {group.dateLabel}
                      </div>
                      <div style={{ font: "400 11.5px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                        {t('matchVideo.subDaySummary', { range: group.timeRange, matches: group.totalMatches, videos: group.videoCount })}
                      </div>
                      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(0,178,169,.25), rgba(0,178,169,0))' }} />
                      {group.durationText && (
                        <div style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                          {group.durationText}
                        </div>
                      )}
                    </div>

                    {/* Các dòng trận trong ngày */}
                    {group.matches.map((m) => {
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
                      const isMultiSet = scoreSets.length > 1
                      const winSetsCount = isMultiSet ? scoreSets.filter((s) => s.winPts > s.losePts).length : 0
                      const loseSetsCount = isMultiSet ? scoreSets.filter((s) => s.losePts > s.winPts).length : 0
                      const fullScoreStr = isMultiSet
                        ? `${winSetsCount}–${loseSetsCount} (${scoreSets.map((s) => `${s.winPts}-${s.losePts}`).join(', ')})`
                        : (scoreSets.length > 0 ? `${scoreSets[0].winPts} – ${scoreSets[0].losePts}` : '')

                      const absDelta = Math.abs(m.eloDelta != null ? m.eloDelta : 8)
                      const isRated = m.ratingEnabled !== false
                      const winnerDeltaStr = isRated ? (winnerTeam.length > 1 ? `+${absDelta} · +${absDelta}` : `+${absDelta}`) : t('challenge.casual')
                      const loserDeltaStr = isRated ? (loserTeam.length > 1 ? `−${absDelta} · −${absDelta}` : `−${absDelta}`) : t('challenge.casual')

                      const ra = m.initialRatingA || 0
                      const rb = m.initialRatingB || 0
                      const isUpset = Math.abs(ra - rb) > 100 && ((ra < rb && aWon) || (rb < ra && !aWon))
                      const isClose = (m.sets || []).some((s) => s && s[0] != null && s[1] != null && Math.abs(s[0] - s[1]) <= 3)
                      const isStreak = (m.brokenStreak || 0) >= 3

                      const s = (db.sessions || []).find((x) => x.id === m.sessionId)
                      const courtObj = s?.courts?.[m.courtIdx]
                      const venue = courtObj ? courtOf(db, courtObj.courtId) : null
                      const courtLabel = courtObj?.label || (courtObj ? t('session.courtNum', { n: (m.courtIdx ?? 0) + 1 }) : '')
                      const matchTime = m.at ? new Date(m.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : (courtObj?.from || '19:00')
                      const matchCode = matchCodeOf(db, m)

                      // Vạch màu trái và background
                      let leftBorderColor = 'transparent'
                      let rowBg = 'transparent'
                      let tagLabel = t('matchVideo.tagCorrect')
                      let tagBg = 'var(--surface-inset)'
                      let tagColor = 'var(--text-secondary)'

                      if (isUpset) {
                        leftBorderColor = '#E14434'
                        rowBg = 'rgba(225,68,52,.07)'
                        tagLabel = t('matchVideo.tagUpset')
                        tagBg = 'rgba(225,68,52,.24)'
                        tagColor = '#FFB0A5'
                      } else if (isClose) {
                        leftBorderColor = '#E08A00'
                        rowBg = 'rgba(224,138,0,.07)'
                        tagLabel = t('matchVideo.tagClose')
                        tagBg = 'rgba(224,138,0,.22)'
                        tagColor = '#FFCB77'
                      } else if (isStreak) {
                        leftBorderColor = '#00B2A9'
                        rowBg = 'rgba(0,178,169,.06)'
                        tagLabel = t('matchVideo.tagStreak', { n: m.brokenStreak })
                        tagBg = 'rgba(0,178,169,.22)'
                        tagColor = '#7FE6DF'
                      }

                      const isChallenge = Boolean(m.challengeId || m.sourceType === 'challenge')
                      const predPct = isUpset ? '34%' : isClose ? '52%' : '50%'
                      const hasVideo = Boolean(m.videoUrl)
                      const vProvider = parseVideoProvider(m.videoUrl)
                      const videoTagLabel = vProvider === 'youtube' ? 'YouTube' : vProvider === 'drive' ? 'Drive' : vProvider === 'icloud' ? 'iCloud' : 'Video'

                      return (
                        <div key={m.id} style={{ display: 'grid' }}>
                          <div
                            style={{
                              position: 'relative',
                              display: 'grid',
                              gridTemplateColumns: '50px 44px 62px 68px minmax(0,1fr) 88px minmax(0,1fr) 100px 98px 68px',
                              alignItems: 'center',
                              minHeight: 50,
                              borderBottom: '1px solid var(--border-subtle)',
                              background: rowBg,
                              transition: 'background 0.15s ease',
                            }}
                          >
                            {/* Vạch màu bên trái 2px */}
                            <div
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: 2,
                                background: leftBorderColor,
                              }}
                            />

                            {/* Cột 1: Mã */}
                            <div style={{ padding: '0 0 0 14px' }}>
                              <button
                                type="button"
                                onClick={() => setViewingMatch(m)}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  padding: 0,
                                  font: "600 11.5px/1.3 'IBM Plex Mono', monospace",
                                  color: 'var(--teal-500)',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                }}
                                title={t('matchDetail.title')}
                              >
                                {matchCode}
                              </button>
                            </div>

                            {/* Cột 2: Sửa */}
                            <div style={{ padding: '0 2px' }}>
                              <button
                                type="button"
                                onClick={() => setEditingMatch(m)}
                                style={{
                                  height: 22,
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '0 8px',
                                  borderRadius: 5,
                                  background: 'var(--surface-raised)',
                                  border: '1px solid var(--border-default)',
                                  font: "600 10.5px/1 'IBM Plex Sans', sans-serif",
                                  color: 'var(--text-secondary)',
                                  cursor: 'pointer',
                                }}
                              >
                                {t('matchSearch.btnEdit')}
                              </button>
                            </div>

                            {/* Cột 3: Giờ + khoảng cách */}
                            <div style={{ padding: '0 6px', display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <span style={{ font: "600 13px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                                {matchTime}
                              </span>
                              <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                                {m.gapText || '+0′'}
                              </span>
                            </div>

                            {/* Cột 4: Sân (click navigate buổi & trận) */}
                            <div style={{ padding: '0 6px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s?.id ? (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/buoi-tap/${s.id}?tab=matches&matchId=${m.id}`)}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    padding: 0,
                                    font: "400 11.5px/1.3 'IBM Plex Mono', monospace",
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    textDecoration: 'none',
                                  }}
                                  title={`${venue?.name || ''} · ${t('pages.sessions.title')}`}
                                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--teal-500)' }}
                                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                                >
                                  {courtLabel || t('session.courtNum', { n: 1 })}
                                </button>
                              ) : (
                                <span style={{ font: "400 11.5px/1.3 'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>
                                  {courtLabel || t('session.courtNum', { n: 1 })}
                                </span>
                              )}
                            </div>

                            {/* Cột 5: Đội thắng */}
                            <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                              <span style={{ font: "600 13px/1.25 'IBM Plex Sans', sans-serif", color: 'var(--status-delivered-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {winnerNames}
                              </span>
                              <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: 'var(--status-delivered-fg)' }}>
                                {winnerDeltaStr}
                              </span>
                            </div>

                            {/* Cột 6: Tỷ số */}
                            <div style={{ padding: '0 4px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                              <div style={{ font: "600 16px/1 'IBM Plex Mono', monospace" }}>
                                <span style={{ color: 'var(--teal-500)' }}>
                                  {isMultiSet ? winSetsCount : (scoreSets.length > 0 ? scoreSets[0].winPts : 21)}
                                </span>
                                <span style={{ color: 'var(--text-muted)', padding: '0 3px' }}>–</span>
                                <span style={{ color: 'var(--text-secondary)' }}>
                                  {isMultiSet ? loseSetsCount : (scoreSets.length > 0 ? scoreSets[0].losePts : 19)}
                                </span>
                              </div>
                              {isMultiSet && (
                                <div
                                  style={{
                                    font: "500 10.5px/1.2 'IBM Plex Mono', monospace",
                                    color: 'var(--text-muted)',
                                    marginTop: 3,
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={scoreSets.map((s) => `${s.winPts}–${s.losePts}`).join(', ')}
                                >
                                  {scoreSets.map((s) => `${s.winPts}:${s.losePts}`).join(' ')}
                                </div>
                              )}
                            </div>

                            {/* Cột 7: Đội thua */}
                            <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                              <span style={{ font: "500 12.5px/1.25 'IBM Plex Sans', sans-serif", color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {loserNames}
                              </span>
                              <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: 'var(--status-incident-fg)' }}>
                                {loserDeltaStr}
                              </span>
                            </div>

                            {/* Cột 8: Dự đoán */}
                            <div style={{ padding: '0 6px', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                              <span style={{ font: "600 13px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                                {predPct}
                              </span>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 999,
                                  background: tagBg,
                                  font: "600 10.5px/1 'IBM Plex Sans', sans-serif",
                                  color: tagColor,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {tagLabel}
                              </span>
                            </div>

                            {/* Cột 9: Video */}
                            <div style={{ padding: '0 6px', display: 'flex', justifyContent: 'center' }}>
                              {hasVideo ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const playUrl = buildPlayableVideoUrl(m.videoUrl, m.videoTimestamp)
                                    if (playUrl) window.open(playUrl, '_blank')
                                  }}
                                  style={{
                                    height: 24,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    padding: '0 9px',
                                    borderRadius: 999,
                                    background: 'rgba(225,68,52,.14)',
                                    border: '1px solid rgba(225,68,52,.45)',
                                    font: "600 10.5px/1 'IBM Plex Sans', sans-serif",
                                    color: '#FF9A8F',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={m.videoUrl}
                                >
                                  <span style={{ font: "400 9px/1 'IBM Plex Mono', monospace" }}>▶</span>
                                  <span>{videoTagLabel}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setExpandedVideoMatchId((prev) => (prev === m.id ? null : m.id))}
                                  style={{
                                    height: 24,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    padding: '0 9px',
                                    borderRadius: 999,
                                    border: '1px dashed var(--border-default)',
                                    background: 'transparent',
                                    font: "600 10.5px/1 'IBM Plex Sans', sans-serif",
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {t('matchVideo.btnAttach')}
                                </button>
                              )}
                            </div>

                            {/* Cột 10: Nguồn */}
                            <div style={{ padding: '0 14px 0 6px', textAlign: 'right', font: "400 10.5px/1 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                              {isChallenge ? t('challenge.challenge') : t('challenge.fromCourt')}
                            </div>
                          </div>

                          {/* Dòng Inline Expander gắn Video */}
                          {expandedVideoMatchId === m.id && (
                            <MatchVideoInlineExpander
                              match={m}
                              matchCode={matchCode}
                              timeStr={matchTime}
                              courtVenueStr={`${courtLabel} · ${venue?.name || ''}`}
                              teamText={`${winnerNames} vs ${loserNames}`}
                              scoreText={fullScoreStr}
                              onSave={(videoData) => {
                                a.attachMatchVideo(m.id, videoData)
                                setExpandedVideoMatchId(null)
                              }}
                              onCancel={() => setExpandedVideoMatchId(null)}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}

                {searchResults.length === 0 && (
                  <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    {t('matchSearch.emptySearch')}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Bảng: Phân trang / Xem thêm */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '11px 14px',
                borderTop: '1px solid var(--border-subtle)',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ font: "400 11.5px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                {t('common.showingOf', { n: Math.min(searchCardLimit, searchResults.length), total: searchResults.length })}
              </div>
              {searchResults.length > searchCardLimit && (
                <button
                  type="button"
                  onClick={() => setSearchCardLimit((prev) => prev + 10)}
                  style={{
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 13px',
                    borderRadius: 7,
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border-default)',
                    font: "600 12.5px/1 'IBM Plex Sans', sans-serif",
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  {t('matchSearch.viewMoreMatches', { n: Math.min(10, searchResults.length - searchCardLimit) })}
                </button>
              )}
            </div>
          </div>
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
          isMobile={isMobile}
          onClose={() => setLedgerMemberId(null)}
          onViewCareerElo={() => {
            setLedgerMemberId(null)
            setActiveTab('elo')
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

      {/* Modal xác nhận Đồng bộ lại Elo — thay window.confirm để nói rõ nó đụng cả điểm mùa */}
      {recalcConfirmOpen && (
        <Dialog
          open
          width={560}
          sheet={isMobile}
          title={t('leaderboard.recalcConfirmTitle')}
          description={t('leaderboard.recalcConfirmMsg')}
          onClose={() => setRecalcConfirmOpen(false)}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, width: '100%' }}>
              <Button variant="secondary" onClick={() => setRecalcConfirmOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                icon="rotate-ccw"
                onClick={() => {
                  setRecalcConfirmOpen(false)
                  a.recalcAllRatings?.()
                }}
              >
                {t('leaderboard.recalcConfirmBtn')}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <Alert tone="warning" title={t('leaderboard.recalcWarnTitle')}>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18, display: 'grid', gap: 4 }}>
                <li>{t('leaderboard.recalcAffect1')}</li>
                <li>{t('leaderboard.recalcAffect2')}</li>
                <li>{t('leaderboard.recalcAffect3')}</li>
                <li>{t('leaderboard.recalcAffect4')}</li>
              </ul>
            </Alert>
            <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
              {t('leaderboard.recalcSafeNote')}
            </div>
          </div>
        </Dialog>
      )}

      {/* Modal Chi tiết Hồ sơ & Biểu đồ Elo của thành viên */}
      {selectedMemberId && currentMember && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? 8 : 20,
          }}
          onClick={() => setSelectedMemberId(null)}
        >
          <div
            data-screen-label="Member Profile & Rating Chart Modal"
            style={{
              width: 1040,
              maxWidth: '100%',
              maxHeight: '92vh',
              background: 'var(--surface-overlay)',
              border: '1px solid var(--border-default)',
              borderRadius: 12,
              boxShadow: 'var(--shadow-overlay)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 18px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--surface-card)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={currentMember.name} src={currentMember.avatarUrl || currentMember.avatar} size={28} />
                <span style={{ font: "700 15px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                  {currentMember.name}
                </span>
                <span style={{ font: "400 12px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                  · {t('leaderboard.tabChart')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMemberId(null)}
                aria-label={t('common.close')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 4,
                }}
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: isMobile ? 12 : 20, overflowY: 'auto', flex: 1 }}>
              <MemberProfileTab
                member={currentMember}
                allMembers={activeMembers}
                onSelectMember={(id) => setSelectedMemberId(id)}
                db={db}
                rankTheme={rankTheme}
                onSelectTheme={(themeKey) => setRankTheme(themeKey)}
                isMobile={isMobile}
                onChallenge={(targetId) => {
                  setSelectedMemberId(null)
                  setInitialTeamA([])
                  setInitialTeamB([targetId])
                  setChallengeModalOpen(true)
                }}
              />
            </div>
          </div>
        </div>
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
