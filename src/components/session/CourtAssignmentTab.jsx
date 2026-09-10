import { useState, useMemo, useCallback } from 'react'
import { Button, Card, Icon, IconButton, Select, Switch } from '#ds'
import { GenderChip, LevelChip } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { playerName, genderTxt, isFemaleGender, isMaleGender } from '#lib/money.js'
import { can } from '#lib/roles.js'
import { sessionPlayers, detailedCourtBalance, courtSlotIds, calculatePlayerWaitTime } from '#lib/assign.js'
import {
  expectedScore, getPlayerRating,
  teamRating, computeClubCalibration,
  calcPlayerDeltas, calcPairImpact,
} from '#lib/rating.js'
import { t } from '#i18n'
import CourtWaitingFilterSheet from '#components/session/CourtWaitingFilterSheet.jsx'
import SessionStatsSheet from '#components/session/SessionStatsSheet.jsx'
import BalanceScore from '#components/session/BalanceScore.jsx'

export default function CourtAssignmentTab({ s }) {
  const { db, a } = useApp()
  const isMobile = useMobile(768)
  const role = db.viewAs || 'owner'
  const canManage = can(role, 'assign')

  // Mode: 'doubles' (2 vs 2) hoặc 'singles' (1 vs 1)
  const [mode, setMode] = useState('doubles')
  const maxPerTeam = mode === 'doubles' ? 2 : 1

  // Đội A & Đội B (mảng id/key các đấu thủ)
  const [teamA, setTeamA] = useState([])
  const [teamB, setTeamB] = useState([])

  // Cài đặt sân & Elo
  const [courtIdx, setCourtIdx] = useState(0)
  const [ratingEnabled, setRatingEnabled] = useState(true)
  const [selectedChallengeId, setSelectedChallengeId] = useState(null)

  // Tỷ số & Đội thắng
  const [winnerTeam, setWinnerTeam] = useState('A')
  const [presetScore, setPresetScore] = useState('21-19') // '21-19' | '21-15' | '21-11' | 'custom'
  const [scoreA, setScoreA] = useState(21)
  const [scoreB, setScoreB] = useState(19)
  const [isBo3, setIsBo3] = useState(false)
  const [bo3Sets, _setBo3Sets] = useState([
    [21, 19],
    [19, 21],
    [21, 18],
  ])

  // Tìm kiếm trong khu vực chờ
  const [searchQuery, setSearchQuery] = useState('')

  // CS2 & CS3 Sheets & Sort/Filter state
  const [showSortSheet, setShowSortSheet] = useState(false)
  const [showStatsSheet, setShowStatsSheet] = useState(false)
  const [showBalanceSheet, setShowBalanceSheet] = useState(false)
  const [showChangesBox, setShowChangesBox] = useState(false)
  const [sortOption, setSortOption] = useState('fewest') // 'fewest' | 'wait' | 'level' | 'az'
  const [filters, setFilters] = useState({
    gender: null, // 'female' | 'male' | null
    sameLevel: false,
    notPlayedWith: false,
    noRest: false,
  })
  const [activeSlot, setActiveSlot] = useState({ team: 'A', idx: 0 })

  // Danh sách tất cả người tham gia buổi (thành viên có mặt + khách)
  const players = useMemo(() => sessionPlayers(db, s), [db, s])

  // Map rating cho tất cả người trong pool (dùng Effective Strength tầng 3 co cụm Bayes)
  const ratingsMap = useMemo(() => {
    const map = {}
    players.forEach((p) => {
      const pr = getPlayerRating(db.playerRatings, p.key, p, db.levels)
      map[p.key] = pr.effectiveStrength || pr.rating || 1500
    })
    return map
  }, [players, db.playerRatings, db.levels])

  // Danh sách các trận đã đấu trong buổi này
  const sessionMatches = useMemo(() => {
    return (db.matches || [])
      .filter((m) => m.sessionId === s.id)
      .slice()
      .sort((m1, m2) => (m2.at || 0) - (m1.at || 0))
  }, [db.matches, s.id])

  // Đếm số trận đã chơi trong buổi hôm nay cho từng người
  const matchCountMap = useMemo(() => {
    const counts = {}
    sessionMatches.forEach((m) => {
      const keys = m.playerKeys || [...(m.teamA || []), ...(m.teamB || [])]
      keys.forEach((k) => {
        counts[k] = (counts[k] || 0) + 1
      })
    })
    return counts
  }, [sessionMatches])

  // Object stats cho hàm tính điểm cân bằng
  const statsObj = useMemo(() => {
    const obj = {}
    players.forEach((p) => {
      obj[p.key] = { n: matchCountMap[p.key] || 0 }
    })
    return obj
  }, [players, matchCountMap])

  // Danh sách các sân còn hoạt động trong buổi
  const courtOptions = useMemo(() => {
    const list = (s.courts || []).filter((c) => !c.sold)
    if (!list.length) return [{ value: 0, label: t('session.courtNum', { n: 1 }) }]
    return list.map((c, i) => ({
      value: i,
      label: c.label || t('session.courtNum', { n: i + 1 }),
    }))
  }, [s.courts])

  // Kèo đã nhận trong buổi (chưa hoàn thành)
  const acceptedChallenges = useMemo(() => {
    return (db.challenges || []).filter((c) => c.sessionId === s.id && c.status === 'accepted')
  }, [db.challenges, s.id])

  // Người đang chờ (chưa có tên trên sân)
  const waitingPlayers = useMemo(() => {
    return players.filter((p) => !teamA.includes(p.key) && !teamB.includes(p.key))
  }, [players, teamA, teamB])

  const waitingFemaleCount = useMemo(() => waitingPlayers.filter((p) => isFemaleGender(p.gender)).length, [waitingPlayers])
  const waitingMaleCount = useMemo(() => waitingPlayers.filter((p) => isMaleGender(p.gender)).length, [waitingPlayers])

  // Map tính thời gian chờ: tính từ trận đầu tiên được ghi trong lịch sử nếu chưa đánh, hoặc từ trận gần nhất
  const playerWaitTimeMap = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    const { waitMap } = calculatePlayerWaitTime({
      players,
      sessionMatches,
      session: s,
      now,
    })
    return waitMap
  }, [players, sessionMatches, s])

  const playersOnCourtKeys = useMemo(() => [...teamA, ...teamB], [teamA, teamB])

  // Xác định người đối chiếu trên sân theo ô đang chọn (activeSlot), ưu tiên bạn cùng đội
  const refPlayerKey = useMemo(() => {
    if (activeSlot) {
      const isTeamA = activeSlot.team === 'A'
      const partnerKey = isTeamA
        ? (activeSlot.idx === 0 ? teamA[1] : teamA[0])
        : (activeSlot.idx === 0 ? teamB[1] : teamB[0])
      if (partnerKey) return partnerKey

      const oppTeam = isTeamA ? teamB : teamA
      if (oppTeam[0]) return oppTeam[0]
      if (oppTeam[1]) return oppTeam[1]
    }
    return teamA[0] || teamA[1] || teamB[0] || teamB[1] || null
  }, [activeSlot, teamA, teamB])

  const refPlayer = useMemo(() => {
    if (!refPlayerKey) return null
    return players.find((p) => p.key === refPlayerKey) || null
  }, [refPlayerKey, players])

  const refLevel = refPlayer?.level || null
  const targetKey = refPlayerKey || teamA[0] || teamB[0] || null

  const playerOnCourtName = useMemo(() => {
    if (targetKey) return playerName(db, targetKey)
    return ''
  }, [targetKey, db])

  // Đếm số người cùng trình độ với ô đang xếp
  const sameLevelCount = useMemo(() => {
    if (!refLevel) return 0
    const targetLvl = refLevel.trim().toLowerCase()
    return waitingPlayers.filter((p) => (p.level || '').trim().toLowerCase() === targetLvl).length
  }, [refLevel, waitingPlayers])

  // Tập hợp người đã từng đánh cặp cùng đối tượng đối chiếu trong buổi
  const partneredKeys = useMemo(() => {
    const keysToCheck = targetKey ? [targetKey] : playersOnCourtKeys
    if (!keysToCheck.length) return new Set()
    const set = new Set()
    sessionMatches.forEach((m) => {
      const tA = (m.teamA && m.teamA.length) ? m.teamA : (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
      const tB = (m.teamB && m.teamB.length) ? m.teamB : (m.playerKeys ? m.playerKeys.slice(tA.length, tA.length + 2) : [])
      keysToCheck.forEach((tk) => {
        if (tA.includes(tk)) {
          tA.forEach((k) => { if (k !== tk) set.add(k) })
        }
        if (tB.includes(tk)) {
          tB.forEach((k) => { if (k !== tk) set.add(k) })
        }
      })
    })
    return set
  }, [targetKey, playersOnCourtKeys, sessionMatches])

  // Đếm số người chưa từng đánh cặp cùng người trên sân
  const notPlayedWithCount = useMemo(() => {
    if (!targetKey && !playersOnCourtKeys.length) return 0
    return waitingPlayers.filter((p) => !partneredKeys.has(p.key)).length
  }, [targetKey, playersOnCourtKeys.length, waitingPlayers, partneredKeys])

  // Tập hợp người vừa tham gia lượt trận gần nhất của buổi (chưa được nghỉ)
  const recentRoundPlayerKeys = useMemo(() => {
    if (!sessionMatches.length) return new Set()
    const latestMatchPerCourt = {}
    sessionMatches.forEach((m) => {
      const ci = m.courtIdx ?? 0
      if (!latestMatchPerCourt[ci] || (m.at || 0) > (latestMatchPerCourt[ci].at || 0)) {
        latestMatchPerCourt[ci] = m
      }
    })
    const maxAt = Math.max(...sessionMatches.map((m) => m.at || 0))
    const set = new Set()
    sessionMatches.forEach((m) => {
      const isLatestForCourt = Object.values(latestMatchPerCourt).some((lm) => lm.id === m.id)
      const isRecent = maxAt > 0 && (maxAt - (m.at || 0)) < 15 * 60 * 1000
      if (isLatestForCourt || isRecent) {
        const keys = m.playerKeys || [...(m.teamA || []), ...(m.teamB || [])]
        keys.forEach((k) => set.add(k))
      }
    })
    return set
  }, [sessionMatches])

  // Đếm số người vừa đánh xong ở lượt gần nhất
  const noRestCount = useMemo(() => {
    if (!sessionMatches.length) return 0
    return waitingPlayers.filter((p) => recentRoundPlayerKeys.has(p.key)).length
  }, [sessionMatches.length, waitingPlayers, recentRoundPlayerKeys])

  // Lọc và sắp xếp người chờ (CS1 + CS2)
  const processedWaiting = useMemo(() => {
    let list = [...waitingPlayers]

    // 1. Tìm kiếm theo tên hoặc trình độ
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((p) => {
        const nameMatch = (p.name || '').toLowerCase().includes(q)
        const levelMatch = (p.level || '').toLowerCase().includes(q)
        return nameMatch || levelMatch
      })
    }

    // 2. Lọc giới tính
    if (filters.gender === 'female' || filters.gender === 'nu') {
      list = list.filter((p) => isFemaleGender(p.gender))
    } else if (filters.gender === 'male' || filters.gender === 'nam') {
      list = list.filter((p) => isMaleGender(p.gender))
    }

    // 3. Lọc cùng trình ô đang xếp
    if (filters.sameLevel && refLevel) {
      const targetLvl = refLevel.trim().toLowerCase()
      list = list.filter((p) => (p.level || '').trim().toLowerCase() === targetLvl)
    }

    // 4. Lọc chưa đánh cùng người trên sân
    if (filters.notPlayedWith && (targetKey || playersOnCourtKeys.length > 0)) {
      list = list.filter((p) => !partneredKeys.has(p.key))
    }

    // 5. Lọc chưa nghỉ quả nào
    if (filters.noRest) {
      list = list.filter((p) => recentRoundPlayerKeys.has(p.key))
    }

    // Sắp xếp
    if (sortOption === 'wait') {
      list.sort((p1, p2) => {
        const diff = (playerWaitTimeMap[p2.key] || 0) - (playerWaitTimeMap[p1.key] || 0)
        if (diff !== 0) return diff
        const cnt1 = matchCountMap[p1.key] || 0
        const cnt2 = matchCountMap[p2.key] || 0
        if (cnt1 !== cnt2) return cnt1 - cnt2
        return (p1.name || '').localeCompare(p2.name || '', 'vi')
      })
    } else if (sortOption === 'level') {
      list.sort((p1, p2) => (ratingsMap[p2.key] || 0) - (ratingsMap[p1.key] || 0))
    } else if (sortOption === 'az') {
      list.sort((p1, p2) => (p1.name || '').localeCompare(p2.name || '', 'vi'))
    } else {
      // Mặc định: fewest (ít trận nhất)
      list.sort((p1, p2) => (matchCountMap[p1.key] || 0) - (matchCountMap[p2.key] || 0) || (p1.name || '').localeCompare(p2.name || '', 'vi'))
    }

    return list
  }, [waitingPlayers, searchQuery, filters, sortOption, refLevel, targetKey, playersOnCourtKeys.length, partneredKeys, recentRoundPlayerKeys, playerWaitTimeMap, ratingsMap, matchCountMap])

  // Gom nhóm theo số trận cho chế độ 'fewest' (CS1)
  const fewestGroups = useMemo(() => {
    if (sortOption !== 'fewest') return null
    const groups = {}
    processedWaiting.forEach((p) => {
      const count = matchCountMap[p.key] || 0
      if (!groups[count]) groups[count] = []
      groups[count].push(p)
    })
    const sortedCounts = Object.keys(groups).map(Number).sort((a, b) => a - b)
    return sortedCounts.map((count) => ({
      count,
      players: groups[count],
    }))
  }, [sortOption, processedWaiting, matchCountMap])

  // Danh sách ứng viên ít trận nhất cho CS2 auto-pick
  const fewestCandidates = useMemo(() => {
    const unselected = [...waitingPlayers]
    unselected.sort((p1, p2) => (matchCountMap[p1.key] || 0) - (matchCountMap[p2.key] || 0))
    return unselected
  }, [waitingPlayers, matchCountMap])

  // Nhãn tiêu chí sắp xếp hiện tại
  const sortLabel = useMemo(() => {
    if (sortOption === 'wait') return t('assign.sortWaiting')
    if (sortOption === 'level') return t('assign.sortLevel')
    if (sortOption === 'az') return t('assign.sortAz')
    return t('assign.sortFewest')
  }, [sortOption])

  // Đổi mode đơn / đôi
  const handleSwitchMode = (newMode) => {
    setMode(newMode)
    const newMax = newMode === 'doubles' ? 2 : 1
    if (teamA.length > newMax) setTeamA(teamA.slice(0, newMax))
    if (teamB.length > newMax) setTeamB(teamB.slice(0, newMax))
    setActiveSlot({ team: 'A', idx: Math.min(teamA.length, newMax - 1) })
  }

  // Chạm vào người trong danh sách chờ: tự động đưa vào slot đang chọn (highlighted slot)
  const handleTapPlayer = useCallback((key) => {
    if (teamA.includes(key)) {
      const idx = teamA.indexOf(key)
      setTeamA((prev) => prev.filter((k) => k !== key))
      setActiveSlot({ team: 'A', idx })
      return
    }
    if (teamB.includes(key)) {
      const idx = teamB.indexOf(key)
      setTeamB((prev) => prev.filter((k) => k !== key))
      setActiveSlot({ team: 'B', idx })
      return
    }

    // Tìm ô target
    let target = activeSlot
    const isTargetEmpty = target && (
      (target.team === 'A' && !teamA[target.idx] && target.idx < maxPerTeam) ||
      (target.team === 'B' && !teamB[target.idx] && target.idx < maxPerTeam)
    )

    if (!isTargetEmpty) {
      if (teamA.length < maxPerTeam) {
        target = { team: 'A', idx: teamA.length }
      } else if (teamB.length < maxPerTeam) {
        target = { team: 'B', idx: teamB.length }
      } else {
        a.toast(t('quickMatch.errFullSlots', { req: maxPerTeam }))
        return
      }
    }

    if (target.team === 'A') {
      const nextA = [...teamA]
      nextA[target.idx] = key
      const filteredA = nextA.filter(Boolean)
      setTeamA(filteredA)
      // Tự động nhảy sang ô trống tiếp theo
      if (filteredA.length < maxPerTeam) {
        setActiveSlot({ team: 'A', idx: filteredA.length })
      } else if (teamB.length < maxPerTeam) {
        setActiveSlot({ team: 'B', idx: teamB.length })
      } else {
        setActiveSlot(null)
      }
    } else {
      const nextB = [...teamB]
      nextB[target.idx] = key
      const filteredB = nextB.filter(Boolean)
      setTeamB(filteredB)
      if (teamA.length < maxPerTeam) {
        setActiveSlot({ team: 'A', idx: teamA.length })
      } else if (filteredB.length < maxPerTeam) {
        setActiveSlot({ team: 'B', idx: filteredB.length })
      } else {
        setActiveSlot(null)
      }
    }
  }, [teamA, teamB, activeSlot, maxPerTeam, a])

  // Nút "Ai ít trận nhất": tự động xếp những người đánh ít nhất vào các slot trống
  const handleAutoPickFewest = () => {
    const unselected = [...waitingPlayers]
    unselected.sort((p1, p2) => (matchCountMap[p1.key] || 0) - (matchCountMap[p2.key] || 0))

    const needed = (maxPerTeam * 2) - (teamA.length + teamB.length)
    if (needed <= 0) return

    const picked = unselected.slice(0, needed).map((p) => p.key)
    let pIdx = 0
    const nextA = [...teamA]
    while (nextA.length < maxPerTeam && pIdx < picked.length) {
      nextA.push(picked[pIdx++])
    }
    const nextB = [...teamB]
    while (nextB.length < maxPerTeam && pIdx < picked.length) {
      nextB.push(picked[pIdx++])
    }
    setTeamA(nextA)
    setTeamB(nextB)
  }

  // Xoá đội hình
  const handleClearLineup = () => {
    setTeamA([])
    setTeamB([])
    setSelectedChallengeId(null)
  }

  // Nạp kèo đã nhận vào sân
  const handleLoadChallenge = (c) => {
    const isDbl = (c.teamA || []).length > 1 || (c.teamB || []).length > 1
    const targetMode = isDbl ? 'doubles' : 'singles'
    setMode(targetMode)
    setTeamA(c.teamA || [])
    setTeamB(c.teamB || [])
    setSelectedChallengeId(c.id)
    setRatingEnabled(c.ratingEnabled !== false)
    if ((c.bestOf || 1) > 1) {
      setIsBo3(true)
    }
    a.toast(t('quickMatch.loadChalSuccess', { code: c.code || '' }))
  }

  // Đổi đội thắng (1 chạm)
  const handleSelectWinner = (team) => {
    setWinnerTeam(team)
    if (presetScore === '21-19') {
      setScoreA(team === 'A' ? 21 : 19)
      setScoreB(team === 'B' ? 21 : 19)
    } else if (presetScore === '21-15') {
      setScoreA(team === 'A' ? 21 : 15)
      setScoreB(team === 'B' ? 21 : 15)
    } else if (presetScore === '21-11') {
      setScoreA(team === 'A' ? 21 : 11)
      setScoreB(team === 'B' ? 21 : 11)
    } else if (presetScore === 'custom') {
      if (team === 'A' && scoreA < scoreB) {
        const tmp = scoreA
        setScoreA(scoreB)
        setScoreB(tmp)
      } else if (team === 'B' && scoreB < scoreA) {
        const tmp = scoreA
        setScoreA(scoreB)
        setScoreB(tmp)
      }
    }
  }

  // Chọn preset tỷ số nhanh (21-19, 21-15, 21-11, Khác)
  const handleSelectPreset = (preset) => {
    setPresetScore(preset)
    if (preset === '21-19') {
      setScoreA(winnerTeam === 'A' ? 21 : 19)
      setScoreB(winnerTeam === 'B' ? 21 : 19)
    } else if (preset === '21-15') {
      setScoreA(winnerTeam === 'A' ? 21 : 15)
      setScoreB(winnerTeam === 'B' ? 21 : 15)
    } else if (preset === '21-11') {
      setScoreA(winnerTeam === 'A' ? 21 : 11)
      setScoreB(winnerTeam === 'B' ? 21 : 11)
    }
  }

  // Tăng/giảm tỷ số tùy chỉnh
  const updateCustomScore = (team, delta) => {
    setPresetScore('custom')
    if (team === 'A') {
      const next = Math.max(0, Math.min(30, Number(scoreA || 0) + delta))
      setScoreA(next)
      if (next > scoreB) setWinnerTeam('A')
      else if (next < scoreB) setWinnerTeam('B')
    } else {
      const next = Math.max(0, Math.min(30, Number(scoreB || 0) + delta))
      setScoreB(next)
      if (next > scoreA) setWinnerTeam('B')
      else if (next < scoreA) setWinnerTeam('A')
    }
  }

  // Nhập điểm trực tiếp qua ô input
  const setCustomScoreDirect = (team, valStr) => {
    setPresetScore('custom')
    const val = parseInt(valStr, 10)
    const safeVal = isNaN(val) ? 0 : Math.max(0, Math.min(30, val))
    if (team === 'A') {
      setScoreA(safeVal)
      if (safeVal > scoreB) setWinnerTeam('A')
      else if (safeVal < scoreB) setWinnerTeam('B')
    } else {
      setScoreB(safeVal)
      if (safeVal > scoreA) setWinnerTeam('B')
      else if (safeVal < scoreA) setWinnerTeam('A')
    }
  }

  // Hoán đổi điểm hai bên
  const handleSwapCustomScore = () => {
    setPresetScore('custom')
    const prevA = scoreA
    const prevB = scoreB
    setScoreA(prevB)
    setScoreB(prevA)
    if (prevB > prevA) setWinnerTeam('A')
    else if (prevA > prevB) setWinnerTeam('B')
  }

  // ---------------- TÍNH TOÁN RATING, BALANCE & EFFECTIVE RATING ----------------
  const ratingA = useMemo(() => teamRating(teamA, ratingsMap), [teamA, ratingsMap])
  const ratingB = useMemo(() => teamRating(teamB, ratingsMap), [teamB, ratingsMap])
  const deltaRating = Math.abs(ratingA - ratingB)

  // Tên đội A & B dạng chuỗi
  const teamAName = useMemo(() => teamA.map((k) => playerName(db, k)).join(' · '), [teamA, db])
  const teamBName = useMemo(() => teamB.map((k) => playerName(db, k)).join(' · '), [teamB, db])

  // Chỉ số ăn ý cặp đồng đội (Dòng ăn ý là của cặp đồng đội, không phải của cả 4 ô)
  // 2 người cùng bên -> 1 dòng ăn ý; Đủ 4 người -> 2 dòng; 1 người -> không có dòng; Đánh đơn -> không bao giờ có
  const pairAInfo = useMemo(() => {
    if (mode === 'singles' || teamA.length < 2) return null
    return calcPairImpact(db.matches || [], teamA[0], teamA[1], ratingsMap)
  }, [mode, teamA, db.matches, ratingsMap])

  const pairBInfo = useMemo(() => {
    if (mode === 'singles' || teamB.length < 2) return null
    return calcPairImpact(db.matches || [], teamB[0], teamB[1], ratingsMap)
  }, [mode, teamB, db.matches, ratingsMap])

  // Điểm cân bằng chi tiết (Detailed Balance Score - Mockup 01 & M2)
  const balanceDetails = useMemo(() => {
    if (teamA.length < maxPerTeam || teamB.length < maxPerTeam) return null
    const mockLineup = {}
    const ids = courtSlotIds(courtIdx)
    teamA.forEach((k, idx) => { mockLineup[ids[idx]] = k })
    teamB.forEach((k, idx) => { mockLineup[ids[2 + idx]] = k })
    return detailedCourtBalance({
      lineup: mockLineup,
      ci: courtIdx,
      ratingsMap,
      matches: sessionMatches,
      allMatches: db.matches || [],
      players,
      stats: statsObj,
    })
  }, [teamA, teamB, maxPerTeam, courtIdx, ratingsMap, sessionMatches, db.matches, players, statsObj])

  // Phân tích Effective Rating & Học chéo giới tính (Mockup R3)
  const effectiveAnalysis = useMemo(() => {
    if (teamA.length < 2 || teamB.length < 2) return null

    // Đếm giới tính
    const gA = teamA.map((k) => (players.find((p) => p.key === k) || {}).gender)
    const gB = teamB.map((k) => (players.find((p) => p.key === k) || {}).gender)
    const hasFemaleA = gA.some(isFemaleGender)
    const hasFemaleB = gB.some(isFemaleGender)
    const isCrossGender = hasFemaleA !== hasFemaleB || (hasFemaleA && hasFemaleB)

    // Lấy dữ liệu hiệu chỉnh chéo giới tính của CLB
    const memberMap = {}
    ;(db?.members || []).forEach((m) => { if (m?.id) memberMap[m.id] = m })
    ;(db?.guests || []).forEach((g) => { if (g?.id) memberMap[g.id] = g })
    players.forEach((p) => { if (p?.key) memberMap[p.key] = { ...(memberMap[p.key] || {}), ...p } })
    const cals = computeClubCalibration(db.matches || [], memberMap)
    const midBucket = cals.find((c) => c.bucket === '100-300') || { observedWinRate: 27, sampleSize: 40, learnedAdjustment: 38 }

    // Tính effective rating (cộng hệ số hiệu chỉnh cho bên có nữ nếu chéo)
    let effA = ratingA
    let effB = ratingB
    if (hasFemaleA && !hasFemaleB) effA += (midBucket.learnedAdjustment || 38) * 2
    else if (hasFemaleB && !hasFemaleA) effB += (midBucket.learnedAdjustment || 38) * 2

    const effDelta = Math.abs(effA - effB)

    // Gợi ý đổi người: thử swap 1 người để tìm cặp cân hơn
    let suggestion = null
    if (deltaRating > 80 || effDelta > 80) {
      const p1 = teamA[1]
      const p2 = teamB[1]
      if (p1 && p2) {
        const testA = [teamA[0], p2]
        const testB = [teamB[0], p1]
        const testRa = teamRating(testA, ratingsMap)
        const testRb = teamRating(testB, ratingsMap)
        const testDelta = Math.abs(testRa - testRb)
        if (testDelta < effDelta) {
          suggestion = {
            p1Key: p1,
            p2Key: p2,
            p1Name: playerName(db, p1),
            p2Name: playerName(db, p2),
            teamName: playerName(db, teamB[0]),
            newDelta: testDelta,
          }
        }
      }
    }

    return {
      isCrossGender,
      rawDelta: deltaRating,
      effA: Math.round(effA),
      effB: Math.round(effB),
      effDelta,
      sampleMatches: midBucket.sampleSize || 40,
      femaleWinRate: midBucket.observedWinRate || 27,
      suggestion,
    }
  }, [teamA, teamB, players, ratingA, ratingB, deltaRating, db, ratingsMap])

  // Win rate dự đoán từ Elo
  const [pctA, pctB] = useMemo(() => {
    if (!teamA.length || !teamB.length) return [50, 50]
    const pA = expectedScore(ratingA, ratingB)
    const rA = Math.round(pA * 100)
    return [rA, 100 - rA]
  }, [ratingA, ratingB, teamA, teamB])

  // Biến động Elo dự kiến theo thuật toán cho từng người
  const playerDeltas = useMemo(() => {
    if (!teamA.length || !teamB.length || !ratingEnabled) return {}
    try {
      const gamesCountMap = {}
      players.forEach((p) => {
        gamesCountMap[p.key] = getPlayerRating(db.playerRatings, p.key).gamesCount || 0
      })
      const playedSets = isBo3
        ? bo3Sets.filter(([sa, sb]) => sa > 0 || sb > 0)
        : [[Number(scoreA), Number(scoreB)]]
      const { deltas } = calcPlayerDeltas({
        teamA,
        teamB,
        aWon: winnerTeam === 'A',
        ratingsMap,
        gamesCountMap,
        sets: playedSets,
      })
      return deltas || {}
    } catch {
      return {}
    }
  }, [teamA, teamB, ratingEnabled, winnerTeam, ratingsMap, players, db.playerRatings, isBo3, bo3Sets, scoreA, scoreB])

  // Lưu kết quả trận đấu
  const handleSaveResult = () => {
    if (teamA.length < maxPerTeam || teamB.length < maxPerTeam) {
      a.toast(t('quickMatch.errNotEnough', { req: maxPerTeam }))
      return
    }

    const playedSets = isBo3
      ? bo3Sets.filter(([sa, sb]) => sa > 0 || sb > 0)
      : [[Number(scoreA), Number(scoreB)]]

    if (!playedSets.length) {
      a.toast(t('quickMatch.errNoScore'))
      return
    }

    // Kiểm tra hòa set
    for (let i = 0; i < playedSets.length; i++) {
      const [sa, sb] = playedSets[i]
      if (sa === sb) {
        a.toast(t('quickMatch.errTie'))
        return
      }
    }

    a.saveMatchScore({
      sid: s.id,
      ci: courtIdx,
      teamA,
      teamB,
      sets: playedSets,
      challengeId: selectedChallengeId,
      ratingEnabled,
    })

    // Reset sạch sân sẵn sàng cho trận kế tiếp
    setTeamA([])
    setTeamB([])
    setSelectedChallengeId(null)
    setWinnerTeam('A')
    setPresetScore('21-19')
    setScoreA(21)
    setScoreB(19)
    a.toast(t('quickMatch.saveSuccess'))
  }

  // Swap theo gợi ý của Effective Rating
  const handleApplySuggestion = (sug) => {
    if (!sug) return
    setTeamA((prev) => [prev[0], sug.p2Key])
    setTeamB((prev) => [prev[0], sug.p1Key])
    a.toast(t('assign.swapSuggestion') + ': ' + sug.p1Name + ' ⇄ ' + sug.p2Name)
  }

  const isCourtFull = teamA.length >= maxPerTeam && teamB.length >= maxPerTeam

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={S.container}>
      {/* ---------------- Banner Kèo đã nhận (nếu có) ---------------- */}
      {acceptedChallenges.length > 0 && (
        <div style={S.chalBanner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="flame" size={16} color="var(--status-transit-fg)" />
            <span style={{ font: '600 13px/1.4 var(--font-sans)', color: 'var(--text-primary)' }}>
              {t('quickMatch.pendingChalBanner', { n: acceptedChallenges.length })}:
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {acceptedChallenges.map((c) => {
              const nameA = (c.teamA || []).map((id) => playerName(db, id)).join(' + ') || t('quickMatch.teamA')
              const nameB = (c.teamB || []).map((id) => playerName(db, id)).join(' + ') || t('quickMatch.teamB')
              return (
                <div key={c.id} style={S.chalChip}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{nameA}</span>
                  <span style={{ color: 'var(--text-muted)' }}>vs</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{nameB}</span>
                  <span style={S.tagSub}>{c.bestOf || 1} set</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="download"
                    onClick={() => handleLoadChallenge(c)}
                  >
                    {t('quickMatch.loadChal')}
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ---------------- 1. KHU VỰC CHỜ (WAITING POOL - TĂNG CƯỜNG THÔNG TIN) ---------------- */}
      {/* ---------------- 1. KHU VỰC CHỜ (WAITING POOL - GIAO DIỆN CS1) ---------------- */}
      <Card
        title={t('assign.waitingCount', { n: waitingPlayers.length })}
        subtitle={isMobile ? `${waitingPlayers.length}/${players.length}` : t('assign.waitingSub', { n: waitingPlayers.length, total: players.length })}
        icon="users"
        padding="12px 14px"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Nút ▤ Thống kê mở CS3 - chỉ hiển thị với Ban tổ chức / Quản lý */}
            {canManage && (
              <Button
                variant="secondary"
                size="sm"
                icon="table"
                onClick={() => setShowStatsSheet(true)}
                title={t('assign.statsSheetSub')}
                style={{ padding: isMobile ? '0 8px' : '0 12px' }}
              >
                {isMobile ? '▤' : `▤ ${t('assign.tabStats')}`}
              </Button>
            )}
            {canManage && (
              <Button
                variant="secondary"
                size="sm"
                icon="wand-sparkles"
                onClick={handleAutoPickFewest}
                disabled={waitingPlayers.length === 0 || isCourtFull}
                style={{ padding: isMobile ? '0 8px' : '0 12px' }}
              >
                {isMobile ? t('assign.fewestBtnShort') : t('assign.fewestBtn')}
              </Button>
            )}
          </div>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {/* Ô tìm kiếm người trong pool */}
          <div style={S.searchRow}>
            <input
              type="text"
              placeholder={t('assign.searchPlayerPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={S.searchInput}
            />
            <span style={S.touchHint}>{t('assign.poolTouchHint')}</span>
          </div>

          {/* Hàng sort & lọc dính ở đầu (CS1 mockup) */}
          <div style={S.stickyBar}>
            {/* Chip Sort chính -> Mở CS2 */}
            <button
              type="button"
              onClick={() => setShowSortSheet(true)}
              style={{
                ...S.sortChipMain,
                ...(sortOption !== 'fewest' ? S.sortChipMainActive : {}),
              }}
            >
              {sortLabel}
            </button>

            {/* Chip Chờ lâu */}
            <button
              type="button"
              onClick={() => setSortOption((prev) => prev === 'wait' ? 'fewest' : 'wait')}
              style={{
                ...S.quickChip,
                ...(sortOption === 'wait' ? S.quickChipActive : {}),
              }}
            >
              {t('assign.sortWaiting')}
            </button>

            {/* Chip Trình */}
            <button
              type="button"
              onClick={() => setSortOption((prev) => prev === 'level' ? 'fewest' : 'level')}
              style={{
                ...S.quickChip,
                ...(sortOption === 'level' ? S.quickChipActive : {}),
              }}
            >
              {t('assign.sortLevel')}
            </button>

            <div style={S.chipDivider} />

            {/* Chip Nữ */}
            <button
              type="button"
              onClick={() => setFilters((prev) => ({
                ...prev,
                gender: (prev.gender === 'female' || prev.gender === 'nu') ? null : 'female',
              }))}
              style={{
                ...S.genderChipFemale,
                ...((filters.gender === 'female' || filters.gender === 'nu') ? S.genderChipFemaleActive : {}),
              }}
            >
              {t('assign.filterFemale', { n: waitingFemaleCount })}
            </button>

            {/* Chip Nam */}
            <button
              type="button"
              onClick={() => setFilters((prev) => ({
                ...prev,
                gender: (prev.gender === 'male' || prev.gender === 'nam') ? null : 'male',
              }))}
              style={{
                ...S.genderChipMale,
                ...((filters.gender === 'male' || filters.gender === 'nam') ? S.genderChipMaleActive : {}),
              }}
            >
              {t('assign.filterMale', { n: waitingMaleCount })}
            </button>

            {/* Chips cho các bộ lọc nâng cao nếu đang bật */}
            {filters.sameLevel && (
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, sameLevel: false }))}
                style={S.activeFilterChip}
                title={t('common.clear')}
              >
                {refLevel ? t('assign.filterSameLevel', { level: refLevel }) : `${t('assign.sameLevelSlot')} ✕`}
              </button>
            )}

            {filters.notPlayedWith && (
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, notPlayedWith: false }))}
                style={S.activeFilterChip}
                title={t('common.clear')}
              >
                {playerOnCourtName ? t('assign.filterNotPlayed', { name: playerOnCourtName }) : t('assign.filterNotPlayedGeneric')}
              </button>
            )}

            {filters.noRest && (
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, noRest: false }))}
                style={S.activeFilterChip}
                title={t('common.clear')}
              >
                {t('assign.filterNoRest')}
              </button>
            )}

            {/* Nút xoá tất cả bộ lọc nếu có bộ lọc nâng cao */}
            {(filters.sameLevel || filters.notPlayedWith || filters.noRest) && (
              <button
                type="button"
                onClick={() => setFilters({ gender: null, sameLevel: false, notPlayedWith: false, noRest: false })}
                style={S.clearFiltersBtn}
                title={t('assign.clearAllFilters')}
              >
                {t('assign.clearAllFilters')}
              </button>
            )}
          </div>

          {/* Danh sách người chờ dạng grid 2 cột (CS1) */}
          <div style={S.poolContainerScroll}>
            {canManage && sortOption === 'fewest' && fewestGroups ? (
              fewestGroups.map((grp) => {
                let badgeColor = '#A8B7CB'
                let badgeBg = 'var(--surface-sunken, rgba(255,255,255,0.05))'
                let border = '1px solid var(--border-subtle, rgba(255,255,255,0.1))'
                let lineGradient = 'linear-gradient(90deg, var(--border-subtle, rgba(255,255,255,0.15)) 0%, transparent 100%)'
                let dotColor = '#7E92B2'

                if (grp.count === 0 || grp.count <= 2) {
                  badgeColor = '#F0B75C'
                  badgeBg = 'rgba(240,183,92,0.12)'
                  border = '1px solid rgba(240,183,92,0.3)'
                  lineGradient = 'linear-gradient(90deg, rgba(240,183,92,0.35) 0%, transparent 100%)'
                  dotColor = '#F0B75C'
                } else if (grp.count >= 6) {
                  badgeColor = '#5B6B81'
                  badgeBg = 'rgba(91,107,129,0.12)'
                  border = '1px solid rgba(91,107,129,0.25)'
                  lineGradient = 'linear-gradient(90deg, rgba(91,107,129,0.3) 0%, transparent 100%)'
                  dotColor = '#5B6B81'
                } else {
                  badgeColor = '#5FDBD3'
                  badgeBg = 'rgba(0,178,169,0.12)'
                  border = '1px solid rgba(0,178,169,0.3)'
                  lineGradient = 'linear-gradient(90deg, rgba(0,178,169,0.35) 0%, transparent 100%)'
                  dotColor = 'var(--teal-500, #00B2A9)'
                }

                return (
                  <div key={`grp-${grp.count}`} style={S.groupWrapper}>
                    {/* Header nhóm số trận: Dải phân cách Pill Badge + Dot + Line gradient đồng bộ với Điểm danh */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        margin: '6px 0 2px',
                        padding: '0 2px',
                        userSelect: 'none',
                      }}
                    >
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '2px 8px',
                          borderRadius: 99,
                          background: badgeBg,
                          border,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                          transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
                        }}
                      >
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: dotColor,
                            display: 'inline-block',
                          }}
                        />
                        <span
                          style={{
                            font: "600 11px/1.2 'IBM Plex Sans', sans-serif",
                            color: badgeColor,
                            letterSpacing: '0.3px',
                          }}
                        >
                          {grp.count} {t('units.match')}
                        </span>
                        <span
                          style={{
                            font: "700 10.5px/1.2 'IBM Plex Mono', monospace",
                            color: badgeColor,
                            opacity: 0.85,
                            marginLeft: 2,
                          }}
                        >
                          {grp.players.length}
                        </span>
                      </div>
                      <div
                        style={{
                          flex: 1,
                          height: 1,
                          background: lineGradient,
                        }}
                      />
                    </div>

                    {/* Grid 2 cột */}
                    <div style={S.twoColGrid}>
                      {grp.players.map((p) => {
                        const plays = matchCountMap[p.key] || 0
                        const isFemale = isFemaleGender(p.gender)
                        return (
                          <div
                            key={p.key}
                            onClick={() => handleTapPlayer(p.key)}
                            style={{
                              ...S.cs1PlayerCard,
                              borderColor: isFemale ? 'rgba(232,107,168,.45)' : '#2E3E5C',
                            }}
                            role="button"
                            tabIndex={0}
                            title={p.name}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={S.cs1PlayerName}>{p.name}</div>
                              <div style={{ ...S.cs1PlayerMeta, color: isFemale ? '#E86BA8' : '#8494AA' }}>
                                {genderTxt(p.gender)} · {p.level || 'TB'}
                                {p.guest && <span style={S.cs1GuestBadge}>{t('home.tagGuest')}</span>}
                              </div>
                            </div>
                            <div style={{ ...S.cs1MatchCount, color: badgeColor }}>
                              {plays}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            ) : (
              <div style={S.groupWrapper}>
                {processedWaiting.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      margin: '6px 0 2px',
                      padding: '0 2px',
                      userSelect: 'none',
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '2px 8px',
                        borderRadius: 99,
                        background: 'rgba(0,178,169,0.12)',
                        border: '1px solid rgba(0,178,169,0.3)',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                        transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
                      }}
                    >
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: '50%',
                          background: 'var(--teal-500, #00B2A9)',
                          display: 'inline-block',
                        }}
                      />
                      <span
                        style={{
                          font: "600 11px/1.2 'IBM Plex Sans', sans-serif",
                          color: '#5FDBD3',
                          letterSpacing: '0.3px',
                        }}
                      >
                        {t('assign.waitingPool')}
                      </span>
                      <span
                        style={{
                          font: "700 10.5px/1.2 'IBM Plex Mono', monospace",
                          color: '#5FDBD3',
                          opacity: 0.85,
                          marginLeft: 2,
                        }}
                      >
                        {processedWaiting.length}
                      </span>
                    </div>
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        background: 'linear-gradient(90deg, rgba(0,178,169,0.35) 0%, transparent 100%)',
                      }}
                    />
                  </div>
                )}

                <div style={S.twoColGrid}>
                  {processedWaiting.map((p) => {
                    const plays = matchCountMap[p.key] || 0
                    const isFemale = isFemaleGender(p.gender)
                    let badgeColor = '#A8B7CB'
                    if (plays === 0 || plays <= 2) badgeColor = '#F0B75C'
                    else if (plays >= 6) badgeColor = '#5B6B81'

                    return (
                      <div
                        key={p.key}
                        onClick={() => handleTapPlayer(p.key)}
                        style={{
                          ...S.cs1PlayerCard,
                          borderColor: isFemale ? 'rgba(232,107,168,.45)' : '#2E3E5C',
                        }}
                        role="button"
                        tabIndex={0}
                        title={p.name}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={S.cs1PlayerName}>{p.name}</div>
                          <div style={{ ...S.cs1PlayerMeta, color: isFemale ? '#E86BA8' : '#8494AA' }}>
                            {genderTxt(p.gender)} · {p.level || 'TB'}
                            {canManage && sortOption === 'wait' && (playerWaitTimeMap[p.key] || 0) > 0 && (
                              <> · {t('assign.waitingMinutes', { m: Math.round((playerWaitTimeMap[p.key] || 0) / 60000) })}</>
                            )}
                            {p.guest && <span style={S.cs1GuestBadge}>{t('home.tagGuest')}</span>}
                          </div>
                        </div>
                        {canManage && (
                          <div style={{ ...S.cs1MatchCount, color: badgeColor }}>
                            {plays}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {processedWaiting.length === 0 && (
              <div style={S.emptyPoolMsg}>
                <div>{waitingPlayers.length === 0 ? t('session.guestEmpty') : t('assign.noWaitingFiltered')}</div>
                {waitingPlayers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters({ gender: null, sameLevel: false, notPlayedWith: false, noRest: false })}
                    style={S.emptyResetBtn}
                  >
                    {t('assign.clearAllFilters')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ---------------- 2. MẶT SÂN THI ĐẤU VISUAL COURT (SCREEN 01) ---------------- */}
      <div style={{ ...S.courtCard, padding: isMobile ? '12px 10px' : '16px' }}>
        {/* Header Sân */}
        <div style={{
          ...S.courtTopBar,
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: isMobile ? 10 : 12,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isMobile ? 'space-between' : 'flex-start',
            gap: 10,
            flexWrap: 'wrap',
            flex: 1,
          }}>
            {courtOptions.length > 1 ? (
              <div style={{ minWidth: 120 }}>
                <Select
                  size="sm"
                  value={courtIdx}
                  options={courtOptions}
                  onChange={(e) => setCourtIdx(Number(e.target.value))}
                />
              </div>
            ) : (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 6,
                background: 'var(--surface-sunken)',
                border: '1px solid var(--border-subtle)',
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--text-secondary)',
              }}>
                <Icon name="map-pin" size={14} color="var(--status-transit-fg)" />
                <span>{courtOptions[0]?.label || t('session.courtNum', { n: 1 })}</span>
              </div>
            )}
            {/* Mode Switcher */}
            <div style={S.modeTrack}>
              <button
                type="button"
                onClick={() => handleSwitchMode('doubles')}
                style={{
                  ...S.modeBtn,
                  ...(mode === 'doubles' ? S.modeBtnActive : {}),
                }}
              >
                <span>{t('quickMatch.modeDoubles')}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode('singles')}
                style={{
                  ...S.modeBtn,
                  ...(mode === 'singles' ? S.modeBtnActive : {}),
                }}
              >
                <span>{t('quickMatch.modeSingles')}</span>
              </button>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isMobile ? 'space-between' : 'flex-end',
            gap: 12,
            width: isMobile ? '100%' : 'auto',
            paddingTop: isMobile ? 8 : 0,
            borderTop: isMobile ? '1px dashed var(--border-subtle)' : 'none',
          }}>
            <label style={S.switchLabel}>
              <Switch checked={ratingEnabled} onChange={setRatingEnabled} />
              <span style={{ fontSize: 13, fontWeight: 500, color: ratingEnabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {ratingEnabled ? t('quickMatch.rateElo') : t('quickMatch.unrated')}
              </span>
            </label>
            {(teamA.length > 0 || teamB.length > 0) && (
              <Button variant="ghost" size="sm" icon="eraser" onClick={handleClearLineup}>
                {t('assign.clearCourt')}
              </Button>
            )}
          </div>
        </div>

        {/* Khung mặt sân thi đấu (với UX Highlight Slot chọn) */}
        <div style={S.courtSurface}>
          {/* Đội A (Top) */}
          <div style={{ ...S.teamRow, gridTemplateColumns: mode === 'singles' ? '1fr' : 'repeat(2, minmax(0, 1fr))' }}>
            {Array.from({ length: maxPerTeam }).map((_, idx) => {
              const key = teamA[idx]
              const isTargetSlot = activeSlot?.team === 'A' && activeSlot?.idx === idx

              if (key) {
                const p = players.find((x) => x.key === key) || {}
                const r = ratingsMap[key] || 0
                const plays = matchCountMap[key] || 0
                return (
                  <div
                    key={key}
                    style={S.slotFilled}
                    onClick={() => setActiveSlot({ team: 'A', idx })}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                        <span style={S.slotName}>{p.name}</span>
                        <LevelChip level={p.level} levels={db.levels} size="sm" />
                        {p.guest && <span style={S.guestTag}>{t('home.tagGuest')}</span>}
                      </div>
                      <IconButton
                        icon="x"
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          setTeamA((prev) => prev.filter((k) => k !== key))
                          setActiveSlot({ team: 'A', idx })
                        }}
                      />
                    </div>
                    <div style={S.slotMeta}>
                      <GenderChip gender={p.gender} />
                      <span style={{ color: 'var(--border-strong-color)' }}>·</span>
                      <span style={{ color: 'var(--text-primary)', fontFamily: '"IBM Plex Mono", monospace' }}>{r}</span>
                      {canManage && (
                        <>
                          <span style={{ color: 'var(--border-strong-color)' }}>·</span>
                          <span style={{ color: 'var(--status-transit-fg)' }}>{plays} {t('units.match')}</span>
                        </>
                      )}
                    </div>
                  </div>
                )
              }

              if (isTargetSlot) {
                return (
                  <div
                    key={`slot-A-${idx}`}
                    onClick={() => setActiveSlot({ team: 'A', idx })}
                    style={S.slotActiveHighlight}
                  >
                    <div style={S.slotActiveText}>{t('assign.tapNameHint')}</div>
                    <div style={S.slotActiveSub}>{t('assign.slotTeamLabel', { team: 'A', n: idx + 1 })}</div>
                  </div>
                )
              }

              return (
                <div
                  key={`slot-A-${idx}`}
                  onClick={() => setActiveSlot({ team: 'A', idx })}
                  style={S.slotDashedEmpty}
                >
                  <div style={S.slotEmptyTitle}>{t('assign.slotEmptyLabel')}</div>
                  <div style={S.slotEmptySub}>{t('assign.slotTeamLabel', { team: 'A', n: idx + 1 })}</div>
                </div>
              )
            })}
          </div>

          {/* Dòng Ăn ý cặp Team A (chỉ hiển thị khi đủ 2 người cùng bên, không áp dụng đánh đơn) */}
          {pairAInfo && (
            <div style={pairAInfo.gamesCount >= 5 ? S.synergyRowActive : S.synergyRowNeutral}>
              <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 3 }}>
                <div style={pairAInfo.gamesCount >= 5 ? S.synergyTitleActive : S.synergyTitleNeutral}>
                  {pairAInfo.gamesCount >= 5
                    ? t('assign.synergyTitle', { names: teamAName, score: pairAInfo.synergyScore })
                    : t('assign.synergyNotEnoughData', { names: teamAName })}
                </div>
                <div style={pairAInfo.gamesCount >= 5 ? S.synergySubActive : S.synergySubNeutral}>
                  {pairAInfo.gamesCount >= 5
                    ? t('assign.synergyDetail', {
                        n: pairAInfo.gamesCount,
                        exp: pairAInfo.expectedWinPct,
                        act: pairAInfo.actualWinPct,
                      })
                    : t('assign.synergyNeedMoreGames', {
                        n: pairAInfo.gamesCount,
                        min: 5,
                      })}
                </div>
              </div>
            </div>
          )}

          {/* Vạch LƯỚI Phân Cách */}
          <div style={S.netDivider}>
            <div style={S.netLine} />
            <span style={S.netText}>{t('assign.net')}</span>
            <div style={S.netLine} />
          </div>

          {/* Đội B (Bottom) */}
          <div style={{ ...S.teamRow, gridTemplateColumns: mode === 'singles' ? '1fr' : 'repeat(2, minmax(0, 1fr))' }}>
            {Array.from({ length: maxPerTeam }).map((_, idx) => {
              const key = teamB[idx]
              const isTargetSlot = activeSlot?.team === 'B' && activeSlot?.idx === idx

              if (key) {
                const p = players.find((x) => x.key === key) || {}
                const r = ratingsMap[key] || 0
                const plays = matchCountMap[key] || 0
                return (
                  <div
                    key={key}
                    style={S.slotFilled}
                    onClick={() => setActiveSlot({ team: 'B', idx })}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                        <span style={S.slotName}>{p.name}</span>
                        <LevelChip level={p.level} levels={db.levels} size="sm" />
                        {p.guest && <span style={S.guestTag}>{t('home.tagGuest')}</span>}
                      </div>
                      <IconButton
                        icon="x"
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          setTeamB((prev) => prev.filter((k) => k !== key))
                          setActiveSlot({ team: 'B', idx })
                        }}
                      />
                    </div>
                    <div style={S.slotMeta}>
                      <GenderChip gender={p.gender} />
                      <span style={{ color: 'var(--border-strong-color)' }}>·</span>
                      <span style={{ color: 'var(--text-primary)', fontFamily: '"IBM Plex Mono", monospace' }}>{r}</span>
                      {canManage && (
                        <>
                          <span style={{ color: 'var(--border-strong-color)' }}>·</span>
                          <span style={{ color: 'var(--status-transit-fg)' }}>{plays} {t('units.match')}</span>
                        </>
                      )}
                    </div>
                  </div>
                )
              }

              if (isTargetSlot) {
                return (
                  <div
                    key={`slot-B-${idx}`}
                    onClick={() => setActiveSlot({ team: 'B', idx })}
                    style={S.slotActiveHighlight}
                  >
                    <div style={S.slotActiveText}>{t('assign.tapNameHint')}</div>
                    <div style={S.slotActiveSub}>{t('assign.slotTeamLabel', { team: 'B', n: idx + 1 })}</div>
                  </div>
                )
              }

              return (
                <div
                  key={`slot-B-${idx}`}
                  onClick={() => setActiveSlot({ team: 'B', idx })}
                  style={S.slotDashedEmpty}
                >
                  <div style={S.slotEmptyTitle}>{t('assign.slotEmptyLabel')}</div>
                  <div style={S.slotEmptySub}>{t('assign.slotTeamLabel', { team: 'B', n: idx + 1 })}</div>
                </div>
              )
            })}
          </div>

          {/* Dòng Ăn ý cặp Team B (chỉ hiển thị khi đủ 2 người cùng bên, không áp dụng đánh đơn) */}
          {pairBInfo && (
            <div style={pairBInfo.gamesCount >= 5 ? S.synergyRowActive : S.synergyRowNeutral}>
              <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 3 }}>
                <div style={pairBInfo.gamesCount >= 5 ? S.synergyTitleActive : S.synergyTitleNeutral}>
                  {pairBInfo.gamesCount >= 5
                    ? t('assign.synergyTitle', { names: teamBName, score: pairBInfo.synergyScore })
                    : t('assign.synergyNotEnoughData', { names: teamBName })}
                </div>
                <div style={pairBInfo.gamesCount >= 5 ? S.synergySubActive : S.synergySubNeutral}>
                  {pairBInfo.gamesCount >= 5
                    ? t('assign.synergyDetail', {
                        n: pairBInfo.gamesCount,
                        exp: pairBInfo.expectedWinPct,
                        act: pairBInfo.actualWinPct,
                      })
                    : t('assign.synergyNeedMoreGames', {
                        n: pairBInfo.gamesCount,
                        min: 5,
                      })}
                </div>
              </div>
            </div>
          )}

          {/* Banner Điểm cân bằng M1 (bấm vào mở Sheet M2 BalanceScore) */}
          {balanceDetails && (
            <div
              onClick={() => setShowBalanceSheet(true)}
              style={S.balanceBanner}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.balanceBannerTitle}>
                  {t('assign.balanceScore')}
                  {effectiveAnalysis?.suggestion && (
                    <span
                      style={{
                        marginLeft: 8,
                        font: '600 10.5px/1 "IBM Plex Mono", monospace',
                        padding: '3px 7px',
                        borderRadius: 4,
                        background: 'rgba(0,178,169,.18)',
                        color: '#5FDBD3',
                        verticalAlign: 'middle',
                      }}
                    >
                      💡 {t('assign.swapSuggestion')}
                    </span>
                  )}
                </div>
                <div style={S.balanceBannerSub}>
                  {t('assign.balanceIndicatorsCount', { n: 6, newCount: 2 })}
                </div>
              </div>
              <span style={S.balanceBannerScore}>{balanceDetails.totalScore}</span>
              <span style={S.balanceBannerChevron}>›</span>
            </div>
          )}
        </div>


        {/* ---------------- 5. KHỐI NHẬP TỶ SỐ & GHI KẾT QUẢ (MOCKUP 02) ---------------- */}
        {teamA.length > 0 && teamB.length > 0 && (
          <div style={S.scoreLoggerBox}>
            <div style={{ font: '600 11px/1.2 "IBM Plex Sans", sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              {t('scoreModal.instruction')}
            </div>

            {/* 2 Thẻ Đội A và Đội B */}
            <div style={{ ...S.teamsChoiceGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              {/* Thẻ Đội A */}
              <div
                onClick={() => handleSelectWinner('A')}
                style={{
                  ...S.teamChoiceCard,
                  ...(winnerTeam === 'A' ? S.teamChoiceCardWon : {}),
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '600 15px/1.25 "IBM Plex Sans", sans-serif', color: winnerTeam === 'A' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {teamA.map((k) => playerName(db, k)).join(' · ')}
                  </div>
                  <div style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: winnerTeam === 'A' ? 'var(--status-transit-fg)' : 'var(--text-muted)' }}>
                    {t('scoreModal.teamAvg', { t: 'A', r: ratingA })}
                  </div>
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    setPresetScore('custom')
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                  title={t('scoreModal.customScoreTitle')}
                >
                  {winnerTeam === 'A' && <span style={S.wonBadge}>{t('scoreModal.winnerTag')}</span>}
                  <div style={winnerTeam === 'A' ? S.bigScoreWon : S.bigScoreLost}>
                    {scoreA}
                  </div>
                </div>
              </div>

              {/* Thẻ Đội B */}
              <div
                onClick={() => handleSelectWinner('B')}
                style={{
                  ...S.teamChoiceCard,
                  ...(winnerTeam === 'B' ? S.teamChoiceCardWon : {}),
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '600 15px/1.25 "IBM Plex Sans", sans-serif', color: winnerTeam === 'B' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {teamB.map((k) => playerName(db, k)).join(' · ')}
                  </div>
                  <div style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: winnerTeam === 'B' ? 'var(--status-transit-fg)' : 'var(--text-muted)' }}>
                    {t('scoreModal.teamAvg', { t: 'B', r: ratingB })}
                  </div>
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    setPresetScore('custom')
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                  title={t('scoreModal.customScoreTitle')}
                >
                  {winnerTeam === 'B' && <span style={S.wonBadge}>{t('scoreModal.winnerTag')}</span>}
                  <div style={winnerTeam === 'B' ? S.bigScoreWon : S.bigScoreLost}>
                    {scoreB}
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Nút preset tỷ số nhanh */}
            <div style={S.presetRow}>
              {['21-19', '21-15', '21-11'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  style={{
                    ...S.presetBtn,
                    ...(presetScore === p ? S.presetBtnActive : {}),
                  }}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleSelectPreset('custom')}
                style={{
                  ...S.presetBtn,
                  ...(presetScore === 'custom' ? S.presetBtnActive : {}),
                }}
              >
                {t('scoreModal.presetOther')}
              </button>
            </div>

            {/* Bộ nhập tỷ số tùy chỉnh khi bấm "Khác" */}
            {presetScore === 'custom' && (
              <div style={S.customScoreBox}>
                <div style={S.customScoreHeader}>
                  <span style={{ font: '600 12px/1 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary)' }}>
                    {t('scoreModal.customScoreTitle')}
                  </span>
                  {Number(scoreA) === Number(scoreB) && (
                    <span style={{ color: 'var(--status-delayed-fg)', fontSize: 11.5, fontWeight: 500 }}>
                      {t('quickMatch.errTie')}
                    </span>
                  )}
                </div>

                <div style={S.customScoreRow}>
                  {/* Cột điểm Đội A */}
                  <div style={S.customTeamCol}>
                    <span style={S.customTeamName}>
                      {teamA.map((k) => playerName(db, k)).join(' · ')}
                    </span>
                    <div style={S.stepperBox}>
                      <button
                        type="button"
                        onClick={() => updateCustomScore('A', -1)}
                        style={S.stepBtn}
                        title="-1"
                      >−</button>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={scoreA}
                        onChange={(e) => setCustomScoreDirect('A', e.target.value)}
                        style={{
                          ...S.scoreBox,
                          borderColor: winnerTeam === 'A' ? 'var(--teal-700)' : 'var(--border-default)',
                          color: winnerTeam === 'A' ? 'var(--status-transit-fg)' : 'var(--text-primary)',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => updateCustomScore('A', 1)}
                        style={S.stepBtn}
                        title="+1"
                      >+</button>
                    </div>
                  </div>

                  {/* Nút đổi điểm */}
                  <button
                    type="button"
                    title={t('scoreModal.swapScore')}
                    onClick={handleSwapCustomScore}
                    style={S.swapBtn}
                  >
                    ⇄
                  </button>

                  {/* Cột điểm Đội B */}
                  <div style={S.customTeamCol}>
                    <span style={S.customTeamName}>
                      {teamB.map((k) => playerName(db, k)).join(' · ')}
                    </span>
                    <div style={S.stepperBox}>
                      <button
                        type="button"
                        onClick={() => updateCustomScore('B', -1)}
                        style={S.stepBtn}
                        title="-1"
                      >−</button>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={scoreB}
                        onChange={(e) => setCustomScoreDirect('B', e.target.value)}
                        style={{
                          ...S.scoreBox,
                          borderColor: winnerTeam === 'B' ? 'var(--teal-700)' : 'var(--border-default)',
                          color: winnerTeam === 'B' ? 'var(--status-transit-fg)' : 'var(--text-primary)',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => updateCustomScore('B', 1)}
                        style={S.stepBtn}
                        title="+1"
                      >+</button>
                    </div>
                  </div>
                </div>

                {/* Preset điểm bổ sung */}
                <div style={S.subPresetRow}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {t('scoreModal.quickPresets')}:
                  </span>
                  {[
                    [21, 18],
                    [21, 16],
                    [21, 14],
                    [21, 12],
                    [21, 0],
                    [30, 29],
                  ].map(([pa, pb]) => (
                    <button
                      key={`${pa}-${pb}`}
                      type="button"
                      onClick={() => {
                        if (winnerTeam === 'B') {
                          setScoreA(pb)
                          setScoreB(pa)
                        } else {
                          setScoreA(pa)
                          setScoreB(pb)
                        }
                      }}
                      style={S.subPresetBtn}
                    >
                      {winnerTeam === 'B' ? `${pb}–${pa}` : `${pa}–${pb}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Dự đoán trước trận & Thay đổi sau khi lưu */}
            <div style={S.preMatchBox}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ font: '600 11px/1.2 "IBM Plex Sans", sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  {t('scoreModal.predictTitle')}
                </span>
                <span style={ratingEnabled ? S.balancedTag : { ...S.balancedTag, background: 'var(--surface-sunken)', color: 'var(--text-muted)' }}>
                  {ratingEnabled ? t('scoreModal.balancedTag') : t('scoreModal.unratedTag')}
                </span>
              </div>
              {ratingEnabled ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', font: '400 12.5px "IBM Plex Mono", monospace', marginTop: 4 }}>
                    <span style={{ color: 'var(--status-transit-fg)' }}>A {pctA}%</span>
                    <span style={{ color: 'var(--text-muted)' }}>{pctB}% B</span>
                  </div>
                  <div style={S.predictBarTrack}>
                    <div style={{ width: `${pctA}%`, height: '100%', background: 'var(--action-accent-bg, #00B2A9)' }} />
                    <div style={{ width: `${pctB}%`, height: '100%', background: 'var(--border-subtle)' }} />
                  </div>
                  <div style={{ font: '400 12.5px/1.4 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)', marginTop: 4 }}>
                    {t('scoreModal.predictSub', { delta: deltaRating })}
                  </div>
                </>
              ) : (
                <div style={{ font: '400 12.5px/1.4 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)', marginTop: 4 }}>
                  {t('scoreModal.predictSubUnrated')}
                </div>
              )}
            </div>

            {/* Box thay đổi Elo & XP - Dạng Collapsible Accordion (mặc định đóng) */}
            <div style={S.changesBox}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setShowChangesBox((prev) => !prev)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowChangesBox((prev) => !prev) }}
                style={S.changesToggleHeader}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                  <span style={{ font: '600 11px/1.2 "IBM Plex Sans", sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    {t('scoreModal.postMatchChanges')}
                  </span>
                  <span style={{ font: '500 11px/1 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                    · {ratingEnabled ? t('scoreModal.changesPreviewTag') : t('scoreModal.unratedChange')}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, font: '600 12px/1 "IBM Plex Sans", sans-serif', color: 'var(--teal-600, #00B2A9)' }}>
                  <span>{showChangesBox ? t('scoreModal.collapseChanges') : t('scoreModal.expandChanges')}</span>
                  <span style={{ fontSize: 13, transform: showChangesBox ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>▾</span>
                </div>
              </div>

              {showChangesBox && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {[...teamA, ...teamB].map((k) => {
                      const inA = teamA.includes(k)
                      const isWon = (inA && winnerTeam === 'A') || (!inA && winnerTeam === 'B')
                      const dVal = playerDeltas[k]
                      const deltaTxt = dVal != null ? (dVal > 0 ? `+${dVal}` : `${dVal}`) : (isWon ? '+8' : '−8')
                      const xpVal = isWon ? '+30' : '+15'
                      return (
                        <div key={k} style={S.changeRow}>
                          <span style={{ font: '600 14px "IBM Plex Sans", sans-serif', color: isWon ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                            {playerName(db, k)}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {ratingEnabled ? (
                              <span style={{ font: '600 12.5px "IBM Plex Mono", monospace', color: isWon ? 'var(--status-delivered-fg)' : 'var(--status-incident-fg)' }}>
                                {t('scoreModal.ratingChange', { d: deltaTxt })}
                              </span>
                            ) : (
                              <span style={{ font: '500 12px "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                                {t('scoreModal.unratedChange')}
                              </span>
                            )}
                            <span style={{ font: '600 12.5px "IBM Plex Mono", monospace', color: 'var(--status-transit-fg)' }}>
                              {t('scoreModal.xpChange', { xp: xpVal })}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ font: '400 12px/1.45 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)', marginTop: 6 }}>
                    {ratingEnabled ? t('scoreModal.xpExplain') : t('scoreModal.xpExplainUnrated')}
                  </div>
                </div>
              )}
            </div>

            {/* NÚT LƯU KẾT QUẢ TO 56px */}
            <button
              type="button"
              onClick={handleSaveResult}
              style={S.bigSaveBtn}
            >
              {t('scoreModal.saveResult')}
            </button>
          </div>
        )}
      </div>
    </div>

      {/* CS2: Sheet sort & lọc */}
      <CourtWaitingFilterSheet
        open={showSortSheet}
        onClose={() => setShowSortSheet(false)}
        sortOption={sortOption}
        onSelectSort={(opt) => {
          setSortOption(opt)
          setShowSortSheet(false)
        }}
        filters={{
          ...filters,
          femaleCount: waitingFemaleCount,
          maleCount: waitingMaleCount,
          sameLevelCount,
          refLevel,
          notPlayedWithCount,
          noRestCount,
        }}
        onToggleFilter={(fKey, val) => {
          setFilters((prev) => ({ ...prev, [fKey]: val }))
        }}
        onResetDefault={() => {
          setSortOption('fewest')
          setFilters({ gender: null, sameLevel: false, notPlayedWith: false, noRest: false })
          setShowSortSheet(false)
        }}
        onAutoPickFewest={handleAutoPickFewest}
        fewestCandidates={fewestCandidates}
        courtLabel={courtOptions.find((c) => c.value === courtIdx)?.label || t('session.courtNum', { n: courtIdx + 1 })}
        playerOnCourtName={playerOnCourtName}
      />

      {/* CS3: Sheet thống kê buổi · không rời màn - chỉ mở cho Ban tổ chức / Quản lý */}
      {canManage && (
        <SessionStatsSheet
          open={showStatsSheet}
          onClose={() => setShowStatsSheet(false)}
          session={s}
          players={players}
          sessionMatches={sessionMatches}
          matchCountMap={matchCountMap}
          ratingsMap={ratingsMap}
          db={db}
        />
      )}

      {/* M2 · Sheet Điểm cân bằng · BalanceScore.jsx */}
      {showBalanceSheet && balanceDetails && (
        <BalanceScore
          balanceDetails={balanceDetails}
          effectiveAnalysis={effectiveAnalysis}
          ratingA={ratingA}
          ratingB={ratingB}
          pctA={pctA}
          pctB={pctB}
          teamAName={teamAName}
          teamBName={teamBName}
          onApplySuggestion={(sug) => {
            handleApplySuggestion(sug)
            setShowBalanceSheet(false)
          }}
          onClose={() => setShowBalanceSheet(false)}
        />
      )}
    </div>
  )
}

const S = {
  container: {
    display: 'grid',
    gap: 16,
  },
  chalBanner: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-lg)',
    padding: '12px 14px',
  },
  chalChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '6px 10px',
    fontSize: 13,
  },
  tagSub: {
    font: '400 11.5px/1 var(--font-mono)',
    color: 'var(--text-muted)',
    background: 'var(--surface-card)',
    padding: '3px 6px',
    borderRadius: 4,
  },
  searchRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  searchInput: {
    flex: '1 1 200px',
    height: 38,
    borderRadius: 8,
    border: '1px solid var(--border-default)',
    background: 'var(--surface-sunken)',
    color: 'var(--text-primary)',
    padding: '0 12px',
    fontSize: 13,
    outline: 'none',
  },
  touchHint: {
    font: '400 12px/1.3 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
    width: '100%',
  },
  stickyBar: {
    display: 'flex',
    gap: 7,
    alignItems: 'center',
    flexWrap: 'wrap',
    padding: '4px 0 2px',
  },
  sortChipMain: {
    minHeight: 34,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '0 12px',
    borderRadius: 999,
    background: 'rgba(0,178,169,.20)',
    border: '1px solid #00B2A9',
    font: '600 12px/1 "IBM Plex Sans", sans-serif',
    color: '#5FDBD3',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  sortChipMainActive: {
    background: '#00B2A9',
    color: '#04302C',
  },
  quickChip: {
    minHeight: 34,
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 12px',
    borderRadius: 999,
    border: '1px solid var(--border-subtle, #22304A)',
    background: 'transparent',
    font: '600 12px/1 "IBM Plex Sans", sans-serif',
    color: 'var(--text-secondary, #A8B7CB)',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  quickChipActive: {
    background: 'var(--surface-raised, #1A2437)',
    borderColor: 'var(--border-default, #2E3E5C)',
    color: '#E9EFF7',
  },
  chipDivider: {
    width: 1,
    height: 22,
    background: 'var(--border-subtle, #22304A)',
    margin: '0 2px',
  },
  genderChipFemale: {
    minHeight: 34,
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 12px',
    borderRadius: 999,
    border: '1px solid rgba(232,107,168,.45)',
    background: 'transparent',
    font: '600 12px/1 "IBM Plex Sans", sans-serif',
    color: '#E86BA8',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  genderChipFemaleActive: {
    background: 'rgba(232,107,168,.25)',
    borderColor: '#E86BA8',
    color: '#F48CBF',
  },
  genderChipMale: {
    minHeight: 34,
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 12px',
    borderRadius: 999,
    border: '1px solid var(--border-subtle, #22304A)',
    background: 'transparent',
    font: '600 12px/1 "IBM Plex Sans", sans-serif',
    color: 'var(--text-secondary, #A8B7CB)',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  genderChipMaleActive: {
    background: 'rgba(60,116,196,.20)',
    borderColor: '#3C74C4',
    color: '#9FC0EA',
  },
  activeFilterBadge: {
    minHeight: 34,
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 10px',
    borderRadius: 999,
    background: 'rgba(240,183,92,.18)',
    border: '1px solid rgba(240,183,92,.45)',
    color: '#F0B75C',
    font: '600 11.5px/1 "IBM Plex Sans", sans-serif',
    cursor: 'pointer',
  },
  activeFilterChip: {
    minHeight: 34,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '0 10px',
    borderRadius: 999,
    background: 'rgba(0,178,169,.18)',
    border: '1px solid #00B2A9',
    color: '#5FDBD3',
    font: '600 11.5px/1 "IBM Plex Sans", sans-serif',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  clearFiltersBtn: {
    minHeight: 34,
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 10px',
    borderRadius: 999,
    font: '600 11.5px/1 "IBM Plex Sans", sans-serif',
    background: 'rgba(235,87,87,.14)',
    border: '1px solid rgba(235,87,87,.35)',
    color: '#FF8080',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  emptyResetBtn: {
    display: 'inline-block',
    marginTop: 8,
    minHeight: 30,
    padding: '6px 14px',
    borderRadius: 6,
    font: '600 12px/1 "IBM Plex Sans", sans-serif',
    background: 'rgba(0,178,169,.16)',
    border: '1px solid #00B2A9',
    color: '#5FDBD3',
    cursor: 'pointer',
  },
  poolContainerScroll: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    maxHeight: 360,
    overflowY: 'auto',
    paddingRight: 4,
  },
  groupWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
  },
  groupDivider: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  groupBadge: {
    font: '700 12px/1 "IBM Plex Mono", monospace',
    whiteSpace: 'nowrap',
  },
  groupLine: {
    flex: 1,
    height: 1,
    background: 'var(--border-subtle, #22304A)',
  },
  groupCount: {
    font: '400 11px/1 "IBM Plex Sans", sans-serif',
    color: 'var(--text-disabled, #5B6B81)',
    whiteSpace: 'nowrap',
  },
  twoColGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 7,
    width: '100%',
    minWidth: 0,
  },
  cs1PlayerCard: {
    minHeight: 52,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    borderRadius: 10,
    background: 'var(--surface-card, #141D2E)',
    border: '1px solid #2E3E5C',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    overflow: 'hidden',
  },
  cs1PlayerName: {
    font: '600 14px/1.2 "IBM Plex Sans", sans-serif',
    color: 'var(--text-primary, #E9EFF7)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cs1PlayerMeta: {
    font: '400 11px/1.3 "IBM Plex Mono", monospace',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: 2,
  },
  cs1GuestBadge: {
    marginLeft: 4,
    fontSize: 9.5,
    padding: '1px 4px',
    borderRadius: 4,
    background: 'rgba(224,138,0,.18)',
    color: '#F0B75C',
  },
  cs1MatchCount: {
    font: '700 18px/1 Barlow, sans-serif',
    flex: '0 0 auto',
  },
  slotActiveHighlight: {
    minHeight: 56,
    minWidth: 0,
    overflow: 'hidden',
    padding: '7px 10px',
    borderRadius: 8,
    background: 'rgba(60,116,196,.16)',
    border: '1.5px solid #9FC0EA',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 2,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxShadow: '0 0 0 2px rgba(159,192,234,.2)',
  },
  slotActiveText: {
    font: '600 12.5px/1.2 "IBM Plex Sans", sans-serif',
    color: '#9FC0EA',
    whiteSpace: 'nowrap',
  },
  slotActiveSub: {
    font: '400 10px/1.2 "IBM Plex Mono", monospace',
    color: '#9FC0EA',
    whiteSpace: 'nowrap',
  },
  slotDashedEmpty: {
    minHeight: 56,
    minWidth: 0,
    overflow: 'hidden',
    padding: '7px 10px',
    borderRadius: 8,
    border: '1px dashed #2E3E5C',
    background: 'var(--surface-sunken, #101927)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 2,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  slotEmptyTitle: {
    font: '600 12.5px/1.2 "IBM Plex Sans", sans-serif',
    color: '#5B6B81',
    whiteSpace: 'nowrap',
  },
  slotEmptySub: {
    font: '400 10px/1.2 "IBM Plex Mono", monospace',
    color: '#5B6B81',
    whiteSpace: 'nowrap',
  },
  playerPillMobile: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    minHeight: 38,
    padding: '6px 12px',
    borderRadius: 999,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-xs)',
    transition: 'all 0.15s ease',
  },
  playCountTagPill: {
    font: '400 11px/1 var(--font-mono)',
    color: 'var(--text-muted)',
    background: 'var(--surface-sunken)',
    padding: '2px 6px',
    borderRadius: 999,
  },
  playerChip: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 5,
    padding: '9px 12px',
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  playerNameText: {
    font: '600 14px/1.2 "IBM Plex Sans", sans-serif',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  genderTagMale: {
    font: '600 10px/1 "IBM Plex Sans", sans-serif',
    color: 'var(--status-scheduled-fg)',
    background: 'var(--status-scheduled-bg)',
    padding: '2px 6px',
    borderRadius: 4,
  },
  genderTagFemale: {
    font: '600 10px/1 "IBM Plex Sans", sans-serif',
    color: 'var(--status-incident-fg)',
    background: 'var(--status-incident-bg)',
    padding: '2px 6px',
    borderRadius: 4,
  },
  guestTag: {
    font: '600 10px/1 "IBM Plex Sans", sans-serif',
    color: 'var(--status-delayed-fg)',
    background: 'var(--status-delayed-bg)',
    padding: '2px 6px',
    borderRadius: 4,
  },
  freshPlayTag: {
    font: '600 10.5px/1 "IBM Plex Mono", monospace',
    color: 'var(--status-delayed-fg)',
    background: 'var(--status-delayed-bg)',
    padding: '2px 6px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
  },
  playCountTag: {
    font: '400 11px/1 "IBM Plex Mono", monospace',
    color: 'var(--text-muted)',
    background: 'var(--surface-sunken)',
    padding: '2px 6px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
  },
  playerRatingMono: {
    font: '500 11.5px/1 "IBM Plex Mono", monospace',
    color: 'var(--text-muted)',
    textAlign: 'right',
  },
  emptyPoolMsg: {
    gridColumn: '1 / -1',
    textAlign: 'center',
    padding: '16px',
    color: 'var(--text-muted)',
    fontSize: 13,
  },
  courtCard: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 16,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: '16px',
    maxWidth: '100%',
    boxSizing: 'border-box',
  },
  courtTopBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    paddingBottom: 10,
    borderBottom: '1px solid var(--border-subtle)',
  },
  modeTrack: {
    display: 'flex',
    padding: 3,
    borderRadius: 8,
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    gap: 2,
  },
  modeBtn: {
    height: 32,
    padding: '0 12px',
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    font: '600 12.5px/1 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  modeBtnActive: {
    background: 'var(--surface-card)',
    color: 'var(--text-primary)',
    boxShadow: 'var(--shadow-sm)',
  },
  switchLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
  },
  courtSurface: {
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 12,
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    maxWidth: '100%',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  teamRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(0, 1fr))',
    gap: 8,
    width: '100%',
    minWidth: 0,
  },
  slotFilled: {
    minHeight: 64,
    minWidth: 0,
    overflow: 'hidden',
    borderRadius: 8,
    padding: '10px',
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: 6,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  slotName: {
    font: '600 14px/1.2 "IBM Plex Sans", sans-serif',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  slotMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    flexWrap: 'wrap',
    minWidth: 0,
    overflow: 'hidden',
  },
  slotEmpty: {
    minHeight: 64,
    minWidth: 0,
    overflow: 'hidden',
    borderRadius: 8,
    background: 'var(--surface-card)',
    border: '1.5px dashed var(--border-strong-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotEmptyText: {
    font: '500 13px/1 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
  },
  netDivider: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    margin: '2px 0',
  },
  netLine: {
    flex: 1,
    height: 1,
    background: 'var(--border-default)',
    opacity: 0.8,
  },
  netText: {
    font: '700 10px/1 "IBM Plex Sans", sans-serif',
    letterSpacing: '1.5px',
    color: 'var(--text-muted)',
    padding: '0 8px',
  },
  balanceBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    padding: '11px 12px',
    borderRadius: 6,
    background: '#101927',
    border: '1px solid #22304A',
    cursor: 'pointer',
    marginTop: 2,
  },
  balanceBannerTitle: {
    font: '600 11px/1.2 "IBM Plex Sans", sans-serif',
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    color: '#8494AA',
  },
  balanceBannerSub: {
    font: '400 12px/1.4 "IBM Plex Sans", sans-serif',
    color: '#5B6B81',
  },
  balanceBannerScore: {
    font: '700 28px/1 Barlow, sans-serif',
    color: '#E9EFF7',
  },
  balanceBannerChevron: {
    font: '400 16px/1 "IBM Plex Sans", sans-serif',
    color: '#5B6B81',
  },
  synergyRowActive: {
    padding: '9px 11px',
    borderRadius: 6,
    background: 'rgba(0,178,169,.12)',
    border: '1px solid #00786F',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  synergyRowNeutral: {
    padding: '9px 11px',
    borderRadius: 6,
    background: 'rgba(148,164,186,.08)',
    border: '1px solid #2E3E5C',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  synergyTitleActive: {
    font: '600 12.5px/1.35 "IBM Plex Sans", sans-serif',
    color: '#5FDBD3',
  },
  synergyTitleNeutral: {
    font: '600 12.5px/1.35 "IBM Plex Sans", sans-serif',
    color: '#E9EFF7',
  },
  synergySubActive: {
    font: '400 12.5px/1.45 "IBM Plex Sans", sans-serif',
    color: '#A8B7CB',
  },
  synergySubNeutral: {
    font: '400 12.5px/1.45 "IBM Plex Sans", sans-serif',
    color: '#8494AA',
  },
  balanceBox: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 10,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  balanceTitle: {
    font: '600 11px/1.2 "IBM Plex Sans", sans-serif',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
  },
  balanceBigScore: {
    font: '700 22px/1 Barlow, sans-serif',
    color: 'var(--status-transit-fg)',
  },
  metricRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  metricLabel: {
    font: '400 12px/1.3 "IBM Plex Sans", sans-serif',
    color: 'var(--text-secondary)',
    width: 100,
  },
  metricTrack: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    background: 'var(--surface-sunken)',
    overflow: 'hidden',
  },
  metricValueMono: {
    font: '400 12px/1.3 "IBM Plex Mono", monospace',
    color: 'var(--text-muted)',
    width: 36,
    textAlign: 'right',
  },
  balanceNoteText: {
    font: '400 12.5px/1.45 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
    marginTop: 4,
  },
  effCard: {
    background: 'var(--surface-card)',
    border: '1px solid var(--teal-600, #00786F)',
    borderRadius: 10,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  calibratedBadge: {
    font: '600 10px/1 "IBM Plex Sans", sans-serif',
    padding: '5px 9px',
    borderRadius: 999,
    background: 'var(--status-transit-bg)',
    color: 'var(--status-transit-fg)',
    whiteSpace: 'nowrap',
  },
  barCompareRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  barCompareLabel: {
    font: '400 12px/1.3 "IBM Plex Mono", monospace',
    color: 'var(--text-muted)',
    width: 100,
  },
  barCompareTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    background: 'var(--surface-sunken)',
    display: 'flex',
  },
  barCompareValue: {
    font: '400 12px/1.3 "IBM Plex Mono", monospace',
    color: 'var(--text-muted)',
    fontSize: 11.5,
    whiteSpace: 'nowrap',
  },
  effDescText: {
    font: '400 12.5px/1.45 "IBM Plex Sans", sans-serif',
    color: 'var(--text-muted)',
  },
  suggestionBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 8,
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    marginTop: 2,
  },
  scoreLoggerBox: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 10,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  teamsChoiceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(0, 1fr))',
    gap: 10,
    width: '100%',
    minWidth: 0,
  },
  teamChoiceCard: {
    borderRadius: 10,
    padding: '12px',
    background: 'var(--surface-sunken)',
    border: '1.5px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    minWidth: 0,
    overflow: 'hidden',
  },
  teamChoiceCardWon: {
    background: 'var(--status-transit-bg)',
    borderColor: 'var(--status-transit-fg)',
  },
  wonBadge: {
    font: '600 11px/1 "IBM Plex Sans", sans-serif',
    padding: '4px 8px',
    borderRadius: 999,
    background: 'var(--action-accent-bg, #00B2A9)',
    color: 'var(--action-accent-fg, #04302C)',
  },
  bigScoreWon: {
    minWidth: 48,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    background: 'var(--surface-card)',
    border: '1.5px solid var(--action-accent-bg, #00B2A9)',
    font: '700 24px/1 Barlow, sans-serif',
    color: 'var(--status-transit-fg)',
  },
  bigScoreLost: {
    minWidth: 48,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    font: '700 24px/1 Barlow, sans-serif',
    color: 'var(--text-muted)',
  },
  presetRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 8,
  },
  presetBtn: {
    minHeight: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    font: '600 13px/1 "IBM Plex Mono", monospace',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  presetBtnActive: {
    background: 'var(--action-primary-bg)',
    borderColor: 'var(--action-primary-bg)',
    color: 'var(--action-primary-fg)',
  },
  customScoreBox: {
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  customScoreHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  customScoreRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  customTeamCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  customTeamName: {
    font: '600 13px/1.2 "IBM Plex Sans", sans-serif',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  },
  stepperBox: {
    display: 'flex',
    alignItems: 'center',
    background: 'var(--surface-card)',
    borderRadius: 'var(--radius-md)',
    padding: 2,
    border: '1px solid var(--border-subtle)',
    gap: 2,
  },
  stepBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)',
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
  },
  scoreBox: {
    width: 52,
    height: 38,
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--surface-card)',
    fontFamily: 'var(--font-mono)',
    fontSize: 20,
    fontWeight: 700,
    textAlign: 'center',
    padding: 0,
    outline: 'none',
  },
  swapBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-muted)',
    fontSize: 16,
    cursor: 'pointer',
    flexShrink: 0,
    marginTop: 20,
  },
  subPresetRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    paddingTop: 4,
    borderTop: '1px solid var(--border-subtle)',
  },
  subPresetBtn: {
    padding: '3px 8px',
    borderRadius: 4,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    font: '600 12px/1 "IBM Plex Mono", monospace',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  preMatchBox: {
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  balancedTag: {
    font: '600 10.5px/1 "IBM Plex Sans", sans-serif',
    padding: '3px 8px',
    borderRadius: 999,
    background: 'var(--status-transit-bg)',
    color: 'var(--status-transit-fg)',
  },
  predictBarTrack: {
    display: 'flex',
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    background: 'var(--border-subtle)',
    marginTop: 2,
  },
  changesBox: {
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  changesToggleHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    userSelect: 'none',
    gap: 8,
    minHeight: 26,
  },
  changeRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '8px 10px',
    borderRadius: 6,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
  },
  bigSaveBtn: {
    minHeight: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    background: 'var(--action-accent-bg, #00B2A9)',
    border: 'none',
    font: '700 16px/1 "IBM Plex Sans", sans-serif',
    color: 'var(--action-accent-fg, #04302C)',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0, 178, 169, 0.3)',
    transition: 'all 0.15s ease',
  },
}
