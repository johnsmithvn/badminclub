import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Avatar, Button, Card, Dialog, Icon, Input, Select, StatCard } from '#ds'
import { LevelChip, Mono, Overline, SearchSelect, TabTrack } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useAuth } from '#contexts/AuthContext.jsx'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }
import { playerName, courtOf, myMember, playerOf } from '#lib/money.js'
import { dd } from '#utils/dates.js'
import {
  getPlayerRating, expectedScore, calcEloDelta, confidenceProgress,
  BALANCE_THRESHOLD, IMBALANCE_THRESHOLD, matchCodeOf, DEFAULT_RATING,
} from '#lib/rating.js'
import {
  searchMatches, headToHeadMatrix, neverMetPairs, topDisparatePairs, neverMetWithSessionCount,
} from '#lib/matchSearch.js'
import { buildPlayableVideoUrl, formatGapMinutes, parseVideoProvider } from '#utils/videoUtils.js'
import EditScoreModal from '#components/challenge/EditScoreModal.jsx'
import CreateChallengeModal from '#components/challenge/CreateChallengeModal.jsx'
import MatchDetailModal from '#components/challenge/MatchDetailModal.jsx'
import AttachVideoModal, { MatchVideoInlineExpander } from '#components/challenge/AttachVideoModal.jsx'
import { VideoPlayerModal } from '#components/challenge/VideoPlayerModal.jsx'

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

export default function Matches() {
  const { db, a } = useApp()
  const { profile } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const isMobile = useMobile()
  const [searchParams, setSearchParams] = useSearchParams()

  const myMem = myMember(db)
  const myId = myMem?.id || null
  const role = db.viewAs || myMem?.role || 'member'
  const isAdmin = role === 'owner' || role === 'treasurer'

  // Tab: 'challenges' (Sàn kèo) | 'search' (Lịch sử & Video) | 'matrix' (Ma trận đối đầu)
  // Tương thích ngược: nếu URL có tab=history thì map về 'search'
  const tabParam = searchParams.get('tab')
  const initialTab = (tabParam === 'search' || tabParam === 'history')
    ? 'search'
    : (tabParam === 'matrix' ? 'matrix' : 'challenges')

  const [activeTab, setActiveTab] = useState(initialTab)
  const [challengeSubTab, setChallengeSubTab] = useState('my') // 'my' | 'open' | 'pending' | 'played' | 'all'

  // Đồng bộ URL khi đổi tab
  const handleSelectTab = (newTab) => {
    setActiveTab(newTab)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', newTab)
    setSearchParams(nextParams, { replace: true })
  }

  // State Kèo & Thách đấu
  const [challengeModalOpen, setChallengeModalOpen] = useState(false)
  const [initialTeamA, setInitialTeamA] = useState([])
  const [initialTeamB, setInitialTeamB] = useState([])
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000)
    return () => clearInterval(timer)
  }, [])

  // Tự động mở modal tạo kèo khi có targetId hoặc challenge=new từ trang Danh hiệu / BXH
  useEffect(() => {
    const target = searchParams.get('targetId')
    const challengeParam = searchParams.get('challenge')
    if (target) {
      if (myId) setInitialTeamA([myId])
      setInitialTeamB([target])
      setChallengeModalOpen(true)
      setActiveTab('challenges')
    } else if (challengeParam === 'new') {
      if (myId) setInitialTeamA([myId])
      setChallengeModalOpen(true)
      setActiveTab('challenges')
    }
  }, [searchParams, myId])

  // State Tìm trận & Lịch sử
  const [playerA, setPlayerA] = useState(() => searchParams.get('playerA') || '')
  const [playerB, setPlayerB] = useState(() => searchParams.get('playerB') || '')
  const [searchMode, setSearchMode] = useState('vs') // 'vs' | 'team'
  const [qualityFilter, setQualityFilter] = useState('all') // 'all' | 'close' | 'upset'
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [seasonFilter, setSeasonFilter] = useState('all')
  const [courtFilter, setCourtFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [onlyVideoFilter, setOnlyVideoFilter] = useState(() => searchParams.get('video') === 'true')
  const [viewerFilter, setViewerFilter] = useState('all')
  const [sortOption, setSortOption] = useState('latest') // 'latest' | 'dramatic' | 'elo_swing'
  const [searchCardLimit, setSearchCardLimit] = useState(10)
  const [expandedVideoMatchId, setExpandedVideoMatchId] = useState(null)

  // Modals
  const [editingMatch, setEditingMatch] = useState(null)
  const [viewingMatch, setViewingMatch] = useState(null)
  const [playingVideoMatch, setPlayingVideoMatch] = useState(null)

  // State Ma trận đối đầu H2H
  const [matrixMemberLimit, setMatrixMemberLimit] = useState(() => (isMobile ? 5 : 8))

  const activeMembers = useMemo(() => {
    return (db.members || []).filter((m) => m.active !== false)
  }, [db.members])

  const memberSearchOptions = useMemo(() => {
    return (activeMembers || []).map((m) => ({
      value: m.id,
      label: m.name,
      level: m.level,
    }))
  }, [activeMembers])

  const memberMap = useMemo(() => {
    const map = {}
    ;(db?.members || []).forEach((m) => { if (m?.id) map[m.id] = m })
    ;(db?.guests || []).forEach((g) => { if (g?.id) map[g.id] = g })
    ;(db?.sessionGuests || []).forEach((sg) => {
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

  const memberNameOf = useCallback((id) => playerName(db, id), [db])
  const getRating = (mid) => getPlayerRating(db.playerRatings, mid, playerOf(db, mid), db.levels).rating

  // =========================================================================
  // TAB 1: SÀN KÈO / THÁCH ĐẤU (CHALLENGES)
  // =========================================================================
  const allChallenges = useMemo(() => {
    return (db.challenges || []).slice().sort((a, b) => {
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return tB - tA
    })
  }, [db.challenges])

  const myChallenges = useMemo(() => {
    if (!myId) return []
    return allChallenges.filter((c) => {
      return c.createdBy === myId || (c.teamA || []).includes(myId) || (c.teamB || []).includes(myId)
    })
  }, [allChallenges, myId])

  const openChallenges = useMemo(() => {
    return allChallenges.filter((c) => {
      const isPending = c.status === 'pending'
      const teamB = c.teamB || []
      const teamA = c.teamA || []
      const needsMembers = !teamB.length || teamB.length < (teamA.length > 1 ? 2 : 1)
      return isPending && needsMembers
    })
  }, [allChallenges])

  const pendingChallenges = useMemo(() => {
    return allChallenges.filter((c) => c.status === 'pending')
  }, [allChallenges])

  const playedChallenges = useMemo(() => {
    return allChallenges.filter((c) => c.status === 'played')
  }, [allChallenges])

  const displayedChallenges = useMemo(() => {
    switch (challengeSubTab) {
      case 'my': return myChallenges
      case 'open': return openChallenges
      case 'pending': return pendingChallenges
      case 'played': return playedChallenges
      case 'all': return allChallenges
      default: return myChallenges
    }
  }, [challengeSubTab, myChallenges, openChallenges, pendingChallenges, playedChallenges, allChallenges])

  // =========================================================================
  // TAB 2: LỊCH SỬ ĐẤU & VIDEO (SEARCH) - BÊ NGUYÊN TỪ LEADERBOARD CŨ
  // =========================================================================
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
    if (viewerFilter !== 'all') {
      list = list.filter((m) => {
        const viewers = m.videoViewers || {}
        return (Number(viewers[viewerFilter]) || 0) > 0
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
  }, [db.matches, playerA, playerB, searchMode, qualityFilter, onlyVideoFilter, viewerFilter, courtFilter, sourceFilter, sortOption, db.playerRatings, activeMembers, db.levels, db.sessions])

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

  // Dữ liệu đếm số lượng cho các tag lọc nhanh
  const allMatchesForCounters = useMemo(() => {
    let list = searchMatches(db.matches || [], {
      playerA: playerA || null,
      playerB: playerB || null,
      mode: searchMode,
      quality: 'all',
      ratingsMap: {},
    })
    if (onlyVideoFilter) list = list.filter((m) => Boolean(m.videoUrl))
    if (courtFilter !== 'all') {
      list = list.filter((m) => {
        const s = (db.sessions || []).find((x) => x.id === m.sessionId)
        const courtObj = s?.courts?.[m.courtIdx]
        return courtObj?.courtId === courtFilter || String(m.courtIdx) === courtFilter
      })
    }
    return list
  }, [db.matches, playerA, playerB, searchMode, onlyVideoFilter, courtFilter, db.sessions])

  const challengeMatchesCount = useMemo(() => {
    return allMatchesForCounters.filter((m) => Boolean(m.challengeId || m.sourceType === 'challenge')).length
  }, [allMatchesForCounters])

  const closeMatchesCount = useMemo(() => {
    return allMatchesForCounters.filter((m) => (m.sets || []).some((s) => s && s[0] != null && s[1] != null && Math.abs(s[0] - s[1]) <= 3)).length
  }, [allMatchesForCounters])

  const upsetMatchesCount = useMemo(() => {
    return allMatchesForCounters.filter((m) => {
      const ra = m.initialRatingA || 0
      const rb = m.initialRatingB || 0
      const aWon = m.winnerTeam === 'A'
      return Math.abs(ra - rb) > 100 && ((ra < rb && aWon) || (rb < ra && !aWon))
    }).length
  }, [allMatchesForCounters])

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

  // Thống kê Đối đầu H2H chi tiết giữa Player A và Player B cho Tab Search
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

  // =========================================================================
  // TAB 3: MA TRẬN ĐỐI ĐẦU H2H (MATRIX) - BÊ NGUYÊN TỪ LEADERBOARD CŨ
  // =========================================================================
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
      const countA = memberH2HCounts[a.id] || 0
      const countB = memberH2HCounts[b.id] || 0
      if (countB !== countA) return countB - countA
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

  return (
    <div style={S.page}>
      {/* 1. Header Trang */}
      <div style={S.header}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={S.h1}>{t('pages.matches.title')}</h1>
          <div style={S.hint}>{t('pages.matches.desc')}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            variant="primary"
            icon="plus"
            onClick={() => {
              setInitialTeamA(myId ? [myId] : [])
              setInitialTeamB([])
              setChallengeModalOpen(true)
            }}
          >
            {t('matchesPage.createBtn')}
          </Button>
        </div>
      </div>

      {/* 2. Thanh Tabs Chính */}
      <TabTrack style={{ marginBottom: 16 }}>
        <div style={S.tabTrack}>
          <button
            type="button"
            onClick={() => handleSelectTab('challenges')}
            style={{
              ...S.tabBtn,
              ...(activeTab === 'challenges' ? S.tabBtnActive : {}),
            }}
          >
            <Icon name="history" size={15} />
            <span>{t('matchesPage.tabChallenges')}</span>
            {pendingChallenges.length > 0 && (
              <span style={S.tabBadgeMono}>{pendingChallenges.length}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleSelectTab('search')}
            style={{
              ...S.tabBtn,
              ...(activeTab === 'search' ? S.tabBtnActive : {}),
            }}
          >
            <Icon name="search" size={15} />
            <span>{t('matchesPage.tabHistory')}</span>
            <span style={S.tabBadgeMono}>{(db.matches || []).length}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectTab('matrix')}
            style={{
              ...S.tabBtn,
              ...(activeTab === 'matrix' ? S.tabBtnActive : {}),
            }}
          >
            <Icon name="grid" size={15} />
            <span>{t('matchesPage.tabMatrix')}</span>
          </button>
        </div>
      </TabTrack>

      {/* ========================================================================= */}
      {/* TAB 1: SÀN KÈO / THÁCH ĐẤU */}
      {/* ========================================================================= */}
      {activeTab === 'challenges' && (
        <div style={{ display: 'grid', gap: 14 }}>
          {/* Subtabs lọc kèo */}
          <div style={S.subTabWrap}>
            {[
              { id: 'my', label: t('challenge.tabMy'), count: myChallenges.length },
              { id: 'open', label: t('challenge.tabOpen'), count: openChallenges.length, color: 'var(--status-transit-fg)' },
              { id: 'pending', label: t('challenge.tabPending'), count: pendingChallenges.length, color: 'var(--status-delayed-fg)' },
              { id: 'played', label: t('challenge.tabPlayed'), count: playedChallenges.length },
              { id: 'all', label: t('challenge.tabAll'), count: allChallenges.length },
            ].map((st) => {
              const active = challengeSubTab === st.id
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setChallengeSubTab(st.id)}
                  style={{
                    ...S.subTabBtn,
                    background: active ? 'var(--surface-card)' : 'transparent',
                    border: active ? '1px solid var(--border-default)' : '1px solid transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  <span style={{ fontWeight: active ? 600 : 500 }}>{st.label}</span>
                  <span style={{ ...S.subTabCount, color: st.color || (active ? 'var(--text-primary)' : 'var(--text-muted)') }}>
                    {st.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Danh sách thẻ Kèo */}
          <div style={{ display: 'grid', gap: 10 }}>
            {displayedChallenges.map((c) => {
              const teamA = c.teamA || []
              const teamB = c.teamB || []
              const namesA = teamA.map(memberNameOf).join(' · ')
              const namesB = teamB.length ? teamB.map(memberNameOf).join(' · ') : t('challenge.teamEmptyHint')
              const ratA = teamA.length ? Math.round(teamA.reduce((sum, id) => sum + getRating(id), 0) / teamA.length) : 0
              const ratB = teamB.length ? Math.round(teamB.reduce((sum, id) => sum + getRating(id), 0) / teamB.length) : 0
              const gap = Math.abs(ratA - ratB)
              const pA = expectedScore(ratA, ratB || ratA)
              const pctA = Math.round(pA * 100)
              const pctB = 100 - pctA

              const isPlayed = c.status === 'played'
              const isPending = c.status === 'pending'
              const isAccepted = c.status === 'accepted'
              const isCreator = myId && c.createdBy === myId
              const isTeamB = myId && teamB.includes(myId)
              const isOpen = !teamB.length || teamB.length < (teamA.length > 1 ? 2 : 1)

              // Countdown hết hạn
              const expTime = c.expiresAt ? new Date(c.expiresAt).getTime() : (c.createdAt ? new Date(c.createdAt).getTime() + 60 * 60 * 1000 : null)
              let expStr = ''
              if (expTime && isPending) {
                const diff = expTime - now
                if (diff <= 0) {
                  expStr = '00:00'
                } else {
                  const mins = Math.floor(diff / 60000)
                  const secs = Math.floor((diff % 60000) / 1000)
                  expStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`
                }
              }

              const statusBadgeText = isPending
                ? `${t('challenge.status.pending')}${expStr ? ` · ${expStr}` : ''}`
                : (t('challenge.status.' + c.status) || c.status)

              const sessionObj = c.sessionId ? (db.sessions || []).find((s) => s.id === c.sessionId) : null

              return (
                <div key={c.id} style={S.challengeCard}>
                  {/* Hàng 1: Mã kèo & Trạng thái & Buổi */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={S.monoCode}>{c.code}</span>
                      {sessionObj ? (
                        <span style={S.sessionBadge}>
                          {t('matchesPage.sessionLinked', { date: dd(sessionObj.date) })}
                        </span>
                      ) : (
                        <span style={S.casualBadge}>{t('matchesPage.noSessionLinked')}</span>
                      )}
                      {c.ratingEnabled === false && (
                        <span style={S.casualBadge}>{t('challenge.casual')}</span>
                      )}
                    </div>
                    <span style={{
                      ...S.statusBadge,
                      background: isPlayed ? 'var(--surface-brand-soft)' : isAccepted ? 'var(--surface-nav-active)' : 'rgba(240,183,92,0.14)',
                      borderColor: isPlayed ? 'var(--status-delivered-fg)' : isAccepted ? 'var(--teal-700)' : 'var(--border-subtle)',
                      color: isPlayed ? 'var(--status-delivered-fg)' : isAccepted ? 'var(--status-transit-fg)' : 'var(--status-delayed-fg)',
                    }}>
                      {statusBadgeText}
                    </span>
                  </div>

                  {/* Hàng 2: Đối đầu Team A vs Team B */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.teamName}>{namesA}</div>
                      <div style={S.teamRatingMono}>
                        {ratA > 0 ? t('challenge.avgRating', { r: ratA.toLocaleString('vi-VN') }) : '—'}
                      </div>
                    </div>
                    <span style={S.vsText}>VS</span>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                      <div style={{ ...S.teamName, color: teamB.length ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {namesB}
                      </div>
                      <div style={S.teamRatingMono}>
                        {ratB > 0 ? t('challenge.avgRating', { r: ratB.toLocaleString('vi-VN') }) : '—'}
                      </div>
                    </div>
                  </div>

                  {/* Cảnh báo lệch trình */}
                  {gap > IMBALANCE_THRESHOLD && ratA > 0 && ratB > 0 && (
                    <div style={S.warnBox}>
                      {t('challenge.gapWarningNotBlocked', { gap: gap.toLocaleString('vi-VN') })}
                    </div>
                  )}

                  {/* Thanh win% preview */}
                  {!isPlayed && ratB > 0 && (
                    <div style={{ display: 'grid', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: 'var(--status-transit-fg)' }}>{pctA}%</span>
                        <span style={{ color: 'var(--text-muted)' }}>{t('rating.gap', { gap })}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{pctB}%</span>
                      </div>
                      <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-sunken)' }}>
                        <div style={{ width: `${pctA}%`, background: 'var(--action-accent-bg, var(--teal-500))', height: '100%' }} />
                        <div style={{ width: `${pctB}%`, background: 'var(--border-default)', height: '100%' }} />
                      </div>
                    </div>
                  )}

                  {/* Hàng nút bấm thao tác */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    {/* Nhận / Từ chối nếu tôi là Team B hoặc Admin */}
                    {isPending && (isTeamB || isAdmin) && (
                      <>
                        <button
                          type="button"
                          onClick={() => a.respondChallenge(c.id, true)}
                          style={S.smallPrimaryBtn}
                        >
                          <Icon name="check" size={14} />
                          <span>{t('challenge.btnAccept')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => a.respondChallenge(c.id, false)}
                          style={S.smallGhostBtn}
                        >
                          <Icon name="circle-x" size={14} />
                          <span>{t('challenge.btnDecline')}</span>
                        </button>
                      </>
                    )}

                    {/* Nhận kèo mở nếu tôi chưa thuộc Team A */}
                    {isPending && isOpen && !teamA.includes(myId) && (
                      <button
                        type="button"
                        onClick={() => a.acceptOpenChallenge({ challengeId: c.id })}
                        style={S.smallPrimaryBtn}
                      >
                        <Icon name="check" size={14} />
                        <span>{t('matchesPage.acceptOpenChallenge')}</span>
                      </button>
                    )}

                    {/* Hủy kèo nếu là người tạo hoặc admin */}
                    {isPending && (isCreator || isAdmin) && (
                      <button
                        type="button"
                        onClick={() => a.cancelChallenge(c.id)}
                        style={S.smallDangerBtn}
                      >
                        <Icon name="circle-x" size={14} />
                        <span>{t('challenge.btnCancel')}</span>
                      </button>
                    )}

                    {/* Xem trận đấu nếu đã đấu xong */}
                    {isPlayed && c.matchId && (
                      <button
                        type="button"
                        onClick={() => {
                          const m = (db.matches || []).find((x) => x.id === c.matchId)
                          if (m) setViewingMatch(m)
                        }}
                        style={S.smallSecondaryBtn}
                      >
                        <Icon name="eye" size={14} />
                        <span>{t('challenge.details')}</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            {displayedChallenges.length === 0 && (
              <div style={S.emptyBox}>
                <Icon name="history" size={32} style={{ color: 'var(--text-muted)' }} />
                <div style={S.emptyTitle}>{t('matchesPage.emptyChallenges')}</div>
                <div style={S.emptySub}>{t('matchesPage.createChallengePrompt')}</div>
                <Button
                  variant="secondary"
                  icon="plus"
                  onClick={() => {
                    setInitialTeamA(myId ? [myId] : [])
                    setInitialTeamB([])
                    setChallengeModalOpen(true)
                  }}
                  style={{ marginTop: 8 }}
                >
                  {t('matchesPage.createBtn')}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LỊCH SỬ ĐẤU & VIDEO (SEARCH) - 100% NGUYÊN BẢN LEADERBOARD CŨ */}
      {/* ========================================================================= */}
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
              {/* Cụm chọn Người chơi A ⇄ Người chơi B */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: isMobile ? 120 : 155 }}>
                  <SearchSelect
                    size="sm"
                    placeholder={`A · ${t('matchSearch.playerA')}`}
                    options={memberSearchOptions}
                    value={playerA}
                    onChange={(val) => setPlayerA(val || '')}
                    clearable
                    menuWidth={220}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const temp = playerA
                    setPlayerA(playerB)
                    setPlayerB(temp)
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    border: '1px solid var(--field-border)',
                    borderRadius: 'var(--radius-control)',
                    background: 'var(--field-bg)',
                    color: 'var(--teal-500)',
                    font: "600 13px/1 'IBM Plex Mono', monospace",
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                  title={t('common.swap')}
                >
                  ⇄
                </button>

                <div style={{ width: isMobile ? 120 : 155 }}>
                  <SearchSelect
                    size="sm"
                    placeholder={`B · ${t('matchSearch.playerB')}`}
                    options={memberSearchOptions}
                    value={playerB}
                    onChange={(val) => setPlayerB(val || '')}
                    clearable
                    menuWidth={220}
                  />
                </div>
              </div>

              {/* Chế độ đối đầu / cùng đội */}
              <Select
                size="sm"
                value={searchMode}
                onChange={(e) => setSearchMode(e.target.value)}
                options={[
                  { value: 'vs', label: t('matchSearch.modeH2H') },
                  { value: 'team', label: t('matchSearch.modeTeammate') },
                ]}
              />

              {/* Dropdown kịch tính */}
              <Select
                size="sm"
                value={qualityFilter}
                onChange={(e) => setQualityFilter(e.target.value)}
                options={[
                  { value: 'all', label: t('matchSearch.qualityAll') },
                  { value: 'close', label: t('matchSearch.qualityClose') },
                  { value: 'upset', label: t('matchSearch.qualityUpset') },
                ]}
                style={qualityFilter !== 'all' ? {
                  borderColor: 'var(--teal-500)',
                  fontWeight: 600,
                } : undefined}
              />

              {/* Lọc Nguồn: Tất cả / Kèo / Chia sân */}
              <Select
                size="sm"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                options={[
                  { value: 'all', label: t('matchVideo.filterAllSources') },
                  { value: 'challenge', label: `⚔️ ${t('challenge.challenge')}` },
                  { value: 'session', label: `🏟️ ${t('challenge.fromCourt')}` },
                ]}
                style={sourceFilter === 'challenge' ? {
                  borderColor: '#A855F7',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                } : undefined}
              />

              {/* Nút Lọc thêm */}
              <button
                type="button"
                onClick={() => setShowMoreFilters((prev) => !prev)}
                style={{
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0 11px',
                  borderRadius: 'var(--radius-control)',
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
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 10px',
                    borderRadius: 'var(--radius-control)',
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
                <Select
                  size="sm"
                  value={seasonFilter}
                  onChange={(e) => setSeasonFilter(e.target.value)}
                  options={[
                    { value: 'all', label: t('matchVideo.filterSeason', { season: '2026' }) },
                  ]}
                />

                <Select
                  size="sm"
                  value={courtFilter}
                  onChange={(e) => setCourtFilter(e.target.value)}
                  options={[
                    { value: 'all', label: t('matchVideo.filterAllCourts') },
                    ...(db.courts || []).map((c) => ({ value: c.id, label: c.name })),
                  ]}
                  style={courtFilter !== 'all' ? {
                    borderColor: 'var(--teal-500)',
                    fontWeight: 600,
                  } : undefined}
                />

                <button
                  type="button"
                  onClick={() => setOnlyVideoFilter((prev) => !prev)}
                  style={{
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 10px',
                    borderRadius: 'var(--radius-control)',
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

                {isAdmin && (
                  <Select
                    size="sm"
                    value={viewerFilter}
                    onChange={(e) => setViewerFilter(e.target.value)}
                    options={[
                      { value: 'all', label: t('matchVideo.allViewers') },
                      { value: 'guest', label: t('matchVideo.guestViewer') },
                      ...(db.members || []).map((m) => ({ value: m.id, label: m.name })),
                    ]}
                    style={viewerFilter !== 'all' ? {
                      borderColor: 'var(--teal-500)',
                      fontWeight: 600,
                    } : undefined}
                  />
                )}
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

              {/* Nút lọc nhanh: Kèo */}
              <button
                type="button"
                onClick={() => setSourceFilter((prev) => (prev === 'challenge' ? 'all' : 'challenge'))}
                style={{
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '0 10px',
                  borderRadius: 999,
                  background: sourceFilter === 'challenge' ? 'rgba(168,85,247,.22)' : 'var(--surface-inset)',
                  border: '1px solid',
                  borderColor: sourceFilter === 'challenge' ? '#A855F7' : 'var(--border-subtle)',
                  font: "600 11.5px/1 'IBM Plex Sans', sans-serif",
                  color: sourceFilter === 'challenge' ? '#D8B4FE' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title={t('challenge.challenge')}
              >
                <span>⚔️ {t('challenge.challenge')}</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{challengeMatchesCount}</span>
              </button>

              {/* Nút lọc nhanh: Sát điểm */}
              <button
                type="button"
                onClick={() => setQualityFilter((prev) => (prev === 'close' ? 'all' : 'close'))}
                style={{
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '0 10px',
                  borderRadius: 999,
                  background: qualityFilter === 'close' ? 'rgba(224,138,0,.22)' : 'var(--surface-inset)',
                  border: '1px solid',
                  borderColor: qualityFilter === 'close' ? '#E08A00' : 'var(--border-subtle)',
                  font: "600 11.5px/1 'IBM Plex Sans', sans-serif",
                  color: qualityFilter === 'close' ? '#FFCB77' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title={t('matchVideo.tagClose')}
              >
                <span>{t('matchVideo.tagClose')}</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{closeMatchesCount}</span>
              </button>

              {/* Nút lọc nhanh: Bất ngờ */}
              <button
                type="button"
                onClick={() => setQualityFilter((prev) => (prev === 'upset' ? 'all' : 'upset'))}
                style={{
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '0 10px',
                  borderRadius: 999,
                  background: qualityFilter === 'upset' ? 'rgba(225,68,52,.24)' : 'var(--surface-inset)',
                  border: '1px solid',
                  borderColor: qualityFilter === 'upset' ? 'rgba(225,68,52,.7)' : 'var(--border-subtle)',
                  font: "600 11.5px/1 'IBM Plex Sans', sans-serif",
                  color: qualityFilter === 'upset' ? '#FFB0A5' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title={t('matchVideo.tagUpset')}
              >
                <span>{t('matchVideo.tagUpset')}</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{upsetMatchesCount}</span>
              </button>

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
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setPlayingVideoMatch(m)
                                  }}
                                  style={{
                                    height: 24,
                                    display: 'inline-flex',
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
                                  {Number(m.videoViews) > 0 && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, opacity: 0.85, fontSize: 10, marginLeft: 2 }}>
                                      <Icon name="eye" size={10} />
                                      <span>{m.videoViews}</span>
                                    </span>
                                  )}
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

      {/* ========================================================================= */}
      {/* TAB 3: MA TRẬN ĐỐI ĐẦU H2H (MATRIX) - 100% NGUYÊN BẢN LEADERBOARD CŨ */}
      {/* ========================================================================= */}
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

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* Modal xem video trận đấu trực tiếp */}
      {playingVideoMatch && (
        <VideoPlayerModal
          match={playingVideoMatch}
          matchCode={matchCodeOf(db, playingVideoMatch)}
          onClose={() => setPlayingVideoMatch(null)}
        />
      )}

      {/* Modal chi tiết trận đấu */}
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

      {/* Modal tạo kèo / gạ kèo */}
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
  page: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '16px 14px 32px',
    display: 'grid',
    gap: 16,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  h1: {
    font: '700 22px/1.2 var(--font-sans)',
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  hint: {
    font: '400 13px/1.4 var(--font-sans)',
    color: 'var(--text-muted)',
    marginTop: 4,
  },
  tabTrack: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    padding: '2px 0',
  },
  tabBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    borderRadius: 8,
    border: '1px solid transparent',
    background: 'transparent',
    color: 'var(--text-secondary)',
    font: '600 13px/1 var(--font-sans)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    background: 'var(--surface-card)',
    borderColor: 'var(--border-default)',
    color: 'var(--text-primary)',
    boxShadow: 'var(--shadow-xs)',
  },
  tabBadgeMono: {
    font: '600 11px/1 var(--font-mono)',
    padding: '2px 6px',
    borderRadius: 999,
    background: 'var(--surface-sunken)',
    color: 'var(--text-muted)',
  },
  subTabWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    overflowX: 'auto',
    paddingBottom: 4,
  },
  subTabBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 6,
    font: '500 12.5px/1 var(--font-sans)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  subTabCount: {
    font: '600 11px/1 var(--font-mono)',
  },
  challengeCard: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    padding: '12px 14px',
    display: 'grid',
    gap: 8,
    transition: 'border-color 0.15s ease',
  },
  monoCode: {
    font: '600 12.5px/1.3 "IBM Plex Mono", monospace',
    color: 'var(--status-transit-fg)',
  },
  sessionBadge: {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    padding: '2px 6px',
    borderRadius: 4,
    background: 'var(--surface-sunken)',
    color: 'var(--text-secondary)',
  },
  casualBadge: {
    fontSize: 11,
    fontWeight: 500,
    padding: '2px 6px',
    borderRadius: 4,
    background: 'var(--surface-sunken)',
    color: 'var(--text-muted)',
  },
  challengeBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: 4,
    background: 'rgba(168,85,247,.16)',
    color: '#D8B4FE',
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: 999,
    border: '1px solid',
  },
  teamName: {
    font: '600 13.5px/1.3 var(--font-sans)',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  teamRatingMono: {
    font: '400 11.5px/1.3 var(--font-mono)',
    color: 'var(--text-muted)',
    marginTop: 2,
  },
  vsText: {
    font: '700 12px/1 var(--font-mono)',
    color: 'var(--text-muted)',
    padding: '0 6px',
  },
  warnBox: {
    fontSize: 11.5,
    padding: '6px 10px',
    borderRadius: 6,
    background: 'rgba(240,183,92,0.12)',
    border: '1px solid rgba(240,183,92,0.3)',
    color: 'var(--status-delayed-fg)',
  },
  smallPrimaryBtn: {
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '0 10px',
    borderRadius: 6,
    background: 'var(--action-accent-bg, var(--teal-500))',
    color: 'var(--action-accent-fg, #04302C)',
    font: '600 12px/1 var(--font-sans)',
    border: 'none',
    cursor: 'pointer',
  },
  smallSecondaryBtn: {
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '0 10px',
    borderRadius: 6,
    background: 'var(--surface-sunken)',
    color: 'var(--text-primary)',
    font: '600 12px/1 var(--font-sans)',
    border: '1px solid var(--border-subtle)',
    cursor: 'pointer',
  },
  smallGhostBtn: {
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '0 10px',
    borderRadius: 6,
    background: 'transparent',
    color: 'var(--text-secondary)',
    font: '500 12px/1 var(--font-sans)',
    border: '1px solid var(--border-subtle)',
    cursor: 'pointer',
  },
  smallDangerBtn: {
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '0 10px',
    borderRadius: 6,
    background: 'rgba(225,68,52,.12)',
    color: 'var(--status-incident-fg, #E14434)',
    font: '600 12px/1 var(--font-sans)',
    border: '1px solid rgba(225,68,52,.3)',
    cursor: 'pointer',
  },
  emptyBox: {
    padding: '36px 20px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
  },
  emptyTitle: {
    font: '600 15px/1.3 var(--font-sans)',
    color: 'var(--text-primary)',
  },
  emptySub: {
    font: '400 13px/1.4 var(--font-sans)',
    color: 'var(--text-muted)',
    maxWidth: 360,
  },

  // -------------------------------------------------------------
  // STYLES GỐC TỪ LEADERBOARD CŨ CHO TAB SEARCH VÀ MATRIX
  // -------------------------------------------------------------
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
