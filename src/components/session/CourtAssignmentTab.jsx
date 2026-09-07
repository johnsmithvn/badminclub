// Chia sân · tìm người trong 1 giây (Bản thiết kế 9a · CS0, CS1, CS2, CS3).
// Cân bằng hoàn hảo giữa 2 chế độ Light Mode & Dark Mode.
// Không đếm giờ: chạm đội thắng = ghi kết quả, sân đang đánh vẫn xếp sẵn ván sau.
// Danh sách chờ gom nhóm theo số trận, grid 2 cột gọn 1 dòng chữ, thanh sort/lọc dính đầu.

import { useState, useMemo, useCallback } from 'react'
import { Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { playerName, genderTxt } from '#lib/money.js'
import { dd } from '#utils/dates.js'
import { sessionPlayers, detailedCourtBalance, courtSlotIds, activeCourtIdxs } from '#lib/assign.js'
import {
  getPlayerRating,
  teamRating, computeClubCalibration,
} from '#lib/rating.js'
import { t } from '#i18n'
import BestOfNArrangementView from '#components/session/BestOfNArrangementView.jsx'

export default function CourtAssignmentTab({ s, onSwitchTab, activeTab }) {
  const { db, a } = useApp()
  const { isDark } = useTheme()
  const isMobile = useMobile(768)

  // Switcher Best-of-N thông minh vs Chia sân 1 giây (9a)
  const [useBestOfN, setUseBestOfN] = useState(false)

  // Sân đang chọn để xếp (0-indexed)
  const [courtIdx, setCourtIdx] = useState(0)

  // 4 slot của sân đang xếp: teamA (2 người) & teamB (2 người)
  const [teamA, setTeamA] = useState([])
  const [teamB, setTeamB] = useState([])

  // Ô đang được nhắm ("Chạm tên →" focus): 0 (A1), 1 (A2), 2 (B1), 3 (B2)
  const [activeSlotIndex, setActiveSlotIndex] = useState(0)

  // Cài đặt Elo & Kèo
  const [ratingEnabled, setRatingEnabled] = useState(true)
  const [selectedChallengeId, setSelectedChallengeId] = useState(null)
  const [_isBo3, setIsBo3] = useState(false)

  // Hàng sort & lọc (Zone 5)
  // 'fewest' | 'waitingTime' | 'level' | 'az'
  const [sortMode, setSortMode] = useState('fewest')
  const [filterGender, setFilterGender] = useState(null) // null | 'female' | 'male'
  const [filterSameLevel, setFilterSameLevel] = useState(false)
  const [filterNotPlayedWith, setFilterNotPlayedWith] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  // BottomSheet sheets
  const [showSortFilterSheet, setShowSortFilterSheet] = useState(false)
  const [showStatsSheet, setShowStatsSheet] = useState(false)
  const [statsTab, setStatsTab] = useState('matches') // 'matches' | 'waiting' | 'pairs'

  // Palette màu thích ứng cân bằng Light Mode & Dark Mode
  const T = useMemo(() => ({
    pageBg: isDark ? '#0B1220' : 'var(--surface-page, #F4F7FA)',
    cardBg: isDark ? '#141D2E' : 'var(--surface-card, #FFFFFF)',
    cardRaised: isDark ? '#1A2437' : 'var(--surface-raised, #FFFFFF)',
    cardSunken: isDark ? '#101927' : 'var(--surface-sunken, #F1F5F9)',
    cardSubtle: isDark ? '#0F1726' : '#F8FAFC',
    headerBg: isDark ? '#080F1C' : 'var(--surface-card, #FFFFFF)',
    bottomBarBg: isDark ? '#080F1C' : 'var(--surface-card, #FFFFFF)',
    borderSubtle: isDark ? '#22304A' : 'var(--border-subtle, #DCE4EE)',
    borderDefault: isDark ? '#2E3E5C' : 'var(--border-default, #CBD5E1)',
    borderStrong: isDark ? '#42557A' : '#94A3B8',
    textPrimary: isDark ? '#E9EFF7' : 'var(--text-primary, #1A2434)',
    textSecondary: isDark ? '#A8B7CB' : 'var(--text-secondary, #56657B)',
    textMuted: isDark ? '#8494AA' : 'var(--text-muted, #73839A)',
    textDisabled: isDark ? '#5B6B81' : 'var(--text-disabled, #9BA9BB)',
    tealAccent: isDark ? '#00B2A9' : '#00786F',
    tealText: isDark ? '#5FDBD3' : '#00786F',
    tealBg: isDark ? 'rgba(0,178,169,.16)' : 'rgba(0,178,169,.12)',
    tealBorder: isDark ? '#00786F' : 'rgba(0,178,169,.45)',
    amberText: isDark ? '#F0B75C' : '#B26A00',
    amberBg: isDark ? 'rgba(224,138,0,.18)' : 'rgba(224,138,0,.12)',
    amberBorder: isDark ? '#B26A00' : 'rgba(224,138,0,.45)',
    blueText: isDark ? '#9FC0EA' : '#1D50A0',
    blueBg: isDark ? 'rgba(60,116,196,.18)' : 'rgba(60,116,196,.12)',
    blueBorder: isDark ? 'rgba(159,192,234,.45)' : 'rgba(60,116,196,.35)',
    femaleBorder: isDark ? 'rgba(232,107,168,.45)' : 'rgba(190,24,93,.35)',
    femaleBg: isDark ? 'rgba(232,107,168,.12)' : 'rgba(252,231,243,.60)',
    femaleText: isDark ? '#E86BA8' : '#BE185D',
    greenBtn: isDark ? '#0D5E3A' : '#12A867',
    greenBtnBorder: isDark ? '#00875A' : '#0E8A55',
    activeSlotBorder: isDark ? '#9FC0EA' : '#1D50A0',
    activeSlotBg: isDark ? 'rgba(60,116,196,.16)' : 'rgba(221,232,247,.60)',
  }), [isDark])

  // Danh sách người tham gia buổi (thành viên có mặt + khách)
  const players = useMemo(() => sessionPlayers(db, s), [db, s])

  // Map rating (Effective strength)
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

  // Object stats cho điểm cân bằng
  const statsObj = useMemo(() => {
    const obj = {}
    players.forEach((p) => {
      obj[p.key] = { n: matchCountMap[p.key] || 0 }
    })
    return obj
  }, [players, matchCountMap])

  // Danh sách sân còn hoạt động
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

  // Danh sách sân đang đánh (Zone 3)
  const playingCourts = useMemo(() => {
    const currentPlaying = (db.playing || {})[s.id] || {}
    const currentLineups = (db.lineups || {})[s.id] || {}
    const list = []

    ;(s.courts || []).forEach((c, i) => {
      if (c.sold) return
      const isPlaying = Boolean(currentPlaying[i])
      const slots = courtSlotIds(i)
      const courtPlayerKeys = slots.map((sl) => currentLineups[sl]).filter(Boolean)
      const hasLineup = courtPlayerKeys.length > 0

      if (isPlaying || hasLineup) {
        const tA = [currentLineups[slots[0]], currentLineups[slots[1]]].filter(Boolean)
        const tB = [currentLineups[slots[2]], currentLineups[slots[3]]].filter(Boolean)
        const courtMatches = sessionMatches.filter((m) => m.courtIdx === i)
        list.push({
          courtIndex: i,
          label: c.label || t('session.courtNum', { n: i + 1 }),
          matchNum: courtMatches.length + 1,
          isPlaying,
          teamA: tA,
          teamB: tB,
          allKeys: courtPlayerKeys,
        })
      }
    })

    return list
  }, [s.courts, s.id, db.playing, db.lineups, sessionMatches])

  // Người đang chờ (chưa có mặt trên sân đang xếp)
  const waitingPlayers = useMemo(() => {
    return players.filter((p) => !teamA.includes(p.key) && !teamB.includes(p.key))
  }, [players, teamA, teamB])

  // Thống kê giới tính trong hàng chờ
  const femaleWaitingCount = useMemo(() => {
    return waitingPlayers.filter((p) => p.gender === 'female').length
  }, [waitingPlayers])
  const maleWaitingCount = useMemo(() => {
    return waitingPlayers.filter((p) => p.gender !== 'female').length
  }, [waitingPlayers])

  // Người tham chiếu trong slot hiện tại (để lọc cùng trình hoặc chưa đánh cùng)
  const activeReferencedPlayer = useMemo(() => {
    const allFilled = [...teamA, ...teamB]
    const refKey = allFilled[0]
    return refKey ? players.find((p) => p.key === refKey) : null
  }, [teamA, teamB, players])

  // Lọc danh sách chờ theo bộ lọc + từ khóa
  const filteredWaiting = useMemo(() => {
    return waitingPlayers.filter((p) => {
      // Tìm kiếm
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const nameMatch = (p.name || '').toLowerCase().includes(q)
        const levelMatch = (p.level || '').toLowerCase().includes(q)
        if (!nameMatch && !levelMatch) return false
      }
      // Lọc giới tính
      if (filterGender === 'female' && p.gender !== 'female') return false
      if (filterGender === 'male' && p.gender === 'female') return false

      // Lọc cùng trình với người đang xếp
      if (filterSameLevel && activeReferencedPlayer) {
        if (p.level !== activeReferencedPlayer.level) return false
      }

      // Lọc chưa đánh cùng người trong ô
      if (filterNotPlayedWith && activeReferencedPlayer) {
        const hasPlayedTogether = sessionMatches.some((m) => {
          const tA = m.teamA || []
          const tB = m.teamB || []
          return (tA.includes(activeReferencedPlayer.key) && tA.includes(p.key)) ||
                 (tB.includes(activeReferencedPlayer.key) && tB.includes(p.key))
        })
        if (hasPlayedTogether) return false
      }

      return true
    })
  }, [waitingPlayers, searchQuery, filterGender, filterSameLevel, filterNotPlayedWith, activeReferencedPlayer, sessionMatches])

  // Phân nhóm người chờ theo số trận (Đột phá thiết kế 9a: CS0 & CS1)
  const groupedWaiting = useMemo(() => {
    if (sortMode === 'waitingTime') {
      const list = [...filteredWaiting].sort((p1, p2) => {
        const m1 = sessionMatches.find((m) => (m.playerKeys || []).includes(p1.key))
        const m2 = sessionMatches.find((m) => (m.playerKeys || []).includes(p2.key))
        const t1 = m1?.at || 0
        const t2 = m2?.at || 0
        return t1 - t2
      })
      return [{ key: 'waitingTime', label: t('assign.sortWaitTitle'), players: list }]
    }

    if (sortMode === 'level') {
      const groups = {}
      filteredWaiting.forEach((p) => {
        const lvl = p.level || 'TB'
        if (!groups[lvl]) groups[lvl] = []
        groups[lvl].push(p)
      })
      return Object.keys(groups).map((lvl) => ({
        key: lvl,
        label: lvl,
        players: groups[lvl].sort((a, b) => (ratingsMap[b.key] || 0) - (ratingsMap[a.key] || 0)),
      }))
    }

    if (sortMode === 'az') {
      const list = [...filteredWaiting].sort((p1, p2) => (p1.name || '').localeCompare(p2.name || ''))
      return [{ key: 'az', label: 'A → Z', players: list }]
    }

    // Mặc định: 'fewest' - Gom nhóm theo số trận (4 trận, 5 trận, 6 trận...)
    const counts = {}
    filteredWaiting.forEach((p) => {
      const n = matchCountMap[p.key] || 0
      if (!counts[n]) counts[n] = []
      counts[n].push(p)
    })

    const sortedMatchCounts = Object.keys(counts).map(Number).sort((a, b) => a - b)
    const minMatches = sortedMatchCounts[0] ?? 0
    const maxMatches = sortedMatchCounts[sortedMatchCounts.length - 1] ?? 0

    return sortedMatchCounts.map((count) => {
      const isLowest = count === minMatches
      const isHighest = count === maxMatches && sortedMatchCounts.length > 1
      return {
        key: `match-${count}`,
        matchCount: count,
        label: `${count} ${t('units.match')}`,
        sub: isLowest ? t('assign.sortFewestTitle') : isHighest ? t('units.match') : '',
        isLowest,
        isHighest,
        players: counts[count],
      }
    })
  }, [filteredWaiting, sortMode, matchCountMap, sessionMatches, ratingsMap])

  // Tự động tìm slot trống kế tiếp
  const getNextEmptySlot = useCallback((curA, curB, startIdx = 0) => {
    const slots = [curA[0], curA[1], curB[0], curB[1]]
    for (let i = 0; i < 4; i++) {
      const target = (startIdx + i) % 4
      if (!slots[target]) return target
    }
    return 0
  }, [])

  // Chạm vào slot trên sân đang xếp
  const handleTapSlot = (slotIdx) => {
    const key = slotIdx === 0 ? teamA[0] : slotIdx === 1 ? teamA[1] : slotIdx === 2 ? teamB[0] : teamB[1]
    if (key) {
      if (slotIdx === 0) setTeamA([null, teamA[1]].filter(Boolean))
      else if (slotIdx === 1) setTeamA([teamA[0]].filter(Boolean))
      else if (slotIdx === 2) setTeamB([null, teamB[1]].filter(Boolean))
      else if (slotIdx === 3) setTeamB([teamB[0]].filter(Boolean))
      setActiveSlotIndex(slotIdx)
    } else {
      setActiveSlotIndex(slotIdx)
    }
  }

  // Chạm vào tên người trong danh sách chờ: Đưa ngay vào ô đang nhắm trong 1 giây!
  const handleTapPlayer = useCallback((key) => {
    if (teamA.includes(key)) {
      setTeamA((prev) => prev.filter((k) => k !== key))
      setActiveSlotIndex(teamA[0] === key ? 0 : 1)
      return
    }
    if (teamB.includes(key)) {
      setTeamB((prev) => prev.filter((k) => k !== key))
      setActiveSlotIndex(teamB[0] === key ? 2 : 3)
      return
    }

    let nextA = [...teamA]
    let nextB = [...teamB]

    if (activeSlotIndex === 0) {
      nextA = [key, nextA[1]].filter(Boolean)
    } else if (activeSlotIndex === 1) {
      nextA = [nextA[0], key].filter(Boolean)
    } else if (activeSlotIndex === 2) {
      nextB = [key, nextB[1]].filter(Boolean)
    } else if (activeSlotIndex === 3) {
      nextB = [nextB[0], key].filter(Boolean)
    }

    setTeamA(nextA)
    setTeamB(nextB)

    const nextSlot = getNextEmptySlot(nextA, nextB, (activeSlotIndex + 1) % 4)
    setActiveSlotIndex(nextSlot)
  }, [teamA, teamB, activeSlotIndex, getNextEmptySlot])

  // Nút "Tự xếp 4 ít trận": tự động bốc 4 người ít trận nhất lấp đầy sân
  const handleAutoPickFewest = () => {
    const unselected = [...waitingPlayers]
    unselected.sort((p1, p2) => (matchCountMap[p1.key] || 0) - (matchCountMap[p2.key] || 0))

    const needed = 4 - (teamA.length + teamB.length)
    if (needed <= 0) return

    const picked = unselected.slice(0, needed).map((p) => p.key)
    let pIdx = 0
    const nextA = [...teamA]
    while (nextA.length < 2 && pIdx < picked.length) {
      nextA.push(picked[pIdx++])
    }
    const nextB = [...teamB]
    while (nextB.length < 2 && pIdx < picked.length) {
      nextB.push(picked[pIdx++])
    }
    setTeamA(nextA)
    setTeamB(nextB)
    setActiveSlotIndex(getNextEmptySlot(nextA, nextB, 0))
    a.toast(t('toast.arranged', { mode: t('assign.sortFewestTitle'), n: picked.length }))
  }

  // Nạp kèo đã nhận vào sân
  const handleLoadChallenge = (c) => {
    setTeamA((c.teamA || []).slice(0, 2))
    setTeamB((c.teamB || []).slice(0, 2))
    setSelectedChallengeId(c.id)
    setRatingEnabled(c.ratingEnabled !== false)
    if ((c.bestOf || 1) > 1) {
      setIsBo3(true)
    }
    a.toast(t('quickMatch.loadChalSuccess', { code: c.code || '' }))
  }

  // Nút "Vào sân" (Zone 7): đưa sân vào trạng thái đang đánh
  const handleEnterCourt = () => {
    if (teamA.length < 2 || teamB.length < 2) {
      a.toast(t('quickMatch.errNotEnough', { req: 2 }))
      return
    }

    const slots = courtSlotIds(courtIdx)
    const currentLineups = { ...(db.lineups || {})[s.id] }
    currentLineups[slots[0]] = teamA[0]
    currentLineups[slots[1]] = teamA[1]
    currentLineups[slots[2]] = teamB[0]
    currentLineups[slots[3]] = teamB[1]
    a.setLineup(s.id, currentLineups)

    a.startCourt(s.id, courtIdx)
    a.toast(t('assign.statusPlaying') + ' ' + (courtOptions[courtIdx]?.label || t('session.courtNum', { n: courtIdx + 1 })))

    const activeIdxs = activeCourtIdxs(s)
    const nextCourt = activeIdxs.find((ci) => ci !== courtIdx)
    if (nextCourt !== undefined) {
      setCourtIdx(nextCourt)
      setTeamA([])
      setTeamB([])
      setActiveSlotIndex(0)
    }
  }

  // Ghi kết quả 1 chạm nhanh trên thẻ sân đang đánh (Zone 3: "chạm = thắng, ghi luôn")
  const handleQuickRecordCourtWin = (court, winningTeam) => {
    const tA = court.teamA
    const tB = court.teamB
    if (tA.length < 1 || tB.length < 1) return

    const sa = winningTeam === 'A' ? 21 : 19
    const sb = winningTeam === 'B' ? 21 : 19

    a.saveMatchScore({
      sid: s.id,
      ci: court.courtIndex,
      teamA: tA,
      teamB: tB,
      sets: [[sa, sb]],
      ratingEnabled: true,
    })

    const winNames = (winningTeam === 'A' ? tA : tB).map((k) => playerName(db, k)).join(' · ')
    a.toast(`${winNames} ${t('units.win')} ${sa}–${sb}!`)
  }

  // Thống kê buổi (phục vụ CS3)
  const sessionStatsData = useMemo(() => {
    const totalMatches = sessionMatches.length
    const matchCounts = Object.values(matchCountMap)
    const avg = players.length > 0 ? (totalMatches * 4 / players.length).toFixed(1) : '0.0'
    const minM = matchCounts.length ? Math.min(...matchCounts) : 0
    const maxM = matchCounts.length ? Math.max(...matchCounts) : 0
    return {
      totalMatches,
      avgMatches: avg,
      minMatches: minM,
      maxMatches: maxM,
      membersList: [...players].sort((a, b) => (matchCountMap[a.key] || 0) - (matchCountMap[b.key] || 0)),
    }
  }, [sessionMatches, matchCountMap, players])

  // Tóm tắt trạng thái ô sân đang xếp
  const emptySlotsCount = 4 - (teamA.length + teamB.length)
  const courtLineupSummary = useMemo(() => {
    const curLabel = courtOptions[courtIdx]?.label || t('session.courtNum', { n: courtIdx + 1 })
    const nameA1 = teamA[0] ? playerName(db, teamA[0]) : ''
    const nameA2 = teamA[1] ? playerName(db, teamA[1]) : ''
    const teamATxt = [nameA1, nameA2].filter(Boolean).join(' · ') || t('assign.slotEmptyLabel')
    return {
      courtLabel: curLabel,
      teamATxt,
      emptyCount: emptySlotsCount,
    }
  }, [courtOptions, courtIdx, teamA, db, emptySlotsCount])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: T.pageBg, color: T.textPrimary, minHeight: '100%' }}>
      {/* ---------------- CHUYỂN CHẾ ĐỘ THÔNG MINH (BEST-OF-N) VS 1 GIÂY ---------------- */}
      <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: T.headerBg, borderBottom: `1px solid ${T.borderSubtle}` }}>
        <div style={{ display: 'flex', gap: 6, padding: 3, borderRadius: 8, background: T.cardSunken, border: `1px solid ${T.borderSubtle}` }}>
          <button
            type="button"
            onClick={() => setUseBestOfN(false)}
            style={{
              font: "600 12px/1 'IBM Plex Sans', sans-serif",
              padding: '6px 12px',
              borderRadius: 6,
              background: !useBestOfN ? (isDark ? '#1D50A0' : 'var(--navy-600, #143C7D)') : 'transparent',
              color: !useBestOfN ? '#fff' : T.textMuted,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {t('assign.fastAssignMode')}
          </button>
          <button
            type="button"
            onClick={() => setUseBestOfN(true)}
            style={{
              font: "600 12px/1 'IBM Plex Sans', sans-serif",
              padding: '6px 12px',
              borderRadius: 6,
              background: useBestOfN ? '#00B2A9' : 'transparent',
              color: useBestOfN ? '#04302C' : T.textMuted,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {t('season.bestOfNMode')}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => setShowSearch((prev) => !prev)}
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: showSearch ? T.tealBg : T.cardRaised,
              border: `1px solid ${showSearch ? T.tealBorder : T.borderDefault}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: showSearch ? T.tealText : T.textSecondary,
              cursor: 'pointer',
            }}
            title={t('common.searchQuick')}
          >
            <span style={{ fontSize: 16 }}>⌕</span>
          </button>
          <button
            type="button"
            onClick={() => setShowStatsSheet(true)}
            style={{
              height: 34,
              padding: '0 10px',
              borderRadius: 8,
              background: T.cardRaised,
              border: `1px solid ${T.borderDefault}`,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
            }}
            title={t('assign.statsSheetTitle', { date: dd(s.date) })}
          >
            <span style={{ color: T.tealText, fontSize: 13 }}>▤</span>
            <span style={{ font: "600 11px/1 'IBM Plex Sans', sans-serif", color: T.textSecondary }}>{t('common.filter')}</span>
          </button>
        </div>
      </div>

      {useBestOfN ? (
        <div style={{ padding: '14px' }}>
          <BestOfNArrangementView
            session={s}
            players={players}
            db={db}
            onApplyPlan={(chosenLineup) => a.setLineup(s.id, chosenLineup)}
            onToggleManual={() => setUseBestOfN(false)}
            isMobile={isMobile}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', position: 'relative' }}>
          {/* Banner Kèo đã nhận (nếu có) */}
          {acceptedChallenges.length > 0 && (
            <div style={{ padding: '10px 14px', background: T.amberBg, borderBottom: `1px solid ${T.amberBorder}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Icon name="flame" size={16} color={T.amberText} />
              <span style={{ font: "600 12px/1.3 'IBM Plex Sans', sans-serif", color: T.amberText }}>
                {t('quickMatch.pendingChalBanner', { n: acceptedChallenges.length })}:
              </span>
              {acceptedChallenges.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleLoadChallenge(c)}
                  style={{
                    font: "600 11px/1 'IBM Plex Sans', sans-serif",
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: T.cardBg,
                    border: `1px solid ${T.amberBorder}`,
                    color: T.textPrimary,
                    cursor: 'pointer',
                  }}
                >
                  {t('quickMatch.loadChal')}: {c.code}
                </button>
              ))}
            </div>
          )}

          {/* ========================================================================= */}
          {/* VÙNG 3 · SÂN ĐANG ĐÁNH (CAROUSEL CUỘN NGANG · CHẠM ĐỘI THẮNG = GHI KẾT QUẢ) */}
          {/* ========================================================================= */}
          <div style={{ padding: '12px 14px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase', color: T.textMuted }}>
                {t('assign.playingCourtsHeader')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', padding: '3px 8px', borderRadius: 999, border: `1px dashed ${T.borderDefault}`, font: "400 10px/1 'IBM Plex Mono', monospace", color: T.textMuted }}>
                {courtOptions.find((c) => !playingCourts.some((p) => p.courtIndex === c.value))?.label || t('units.court')} {t('assign.statusEmpty')}
              </div>
            </div>

            {/* Danh sách carousel các sân đang đánh */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', overflowX: 'auto', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
              {playingCourts.length > 0 ? (
                playingCourts.map((court) => {
                  const namesA = court.teamA.map((k) => playerName(db, k)).join(' · ') || t('quickMatch.teamA')
                  const namesB = court.teamB.map((k) => playerName(db, k)).join(' · ') || t('quickMatch.teamB')
                  return (
                    <div
                      key={court.courtIndex}
                      style={{
                        width: 172,
                        flex: '0 0 auto',
                        scrollSnapAlign: 'start',
                        padding: '9px 10px',
                        borderRadius: 10,
                        background: T.cardBg,
                        border: `1px solid ${T.tealBorder}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 7,
                        boxShadow: 'var(--shadow-xs, 0 1px 1px rgba(0,0,0,.30))',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {court.label}
                        </span>
                        <span style={{ font: "400 10px/1 'IBM Plex Mono', monospace", color: T.textDisabled, whiteSpace: 'nowrap' }}>
                          {t('assign.gameNum', { n: court.matchNum })}
                        </span>
                      </div>

                      {/* 2 Đội có thể chạm trực tiếp để ghi thắng */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div
                          onClick={() => handleQuickRecordCourtWin(court, 'A')}
                          style={{
                            minHeight: 40,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                            padding: '0 9px',
                            borderRadius: 7,
                            background: T.cardSunken,
                            border: `1px solid ${T.borderDefault}`,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          title={t('assign.tapToRecordWin', { team: 'A' })}
                        >
                          <span style={{ flex: 1, minWidth: 0, font: "600 12px/1.2 'IBM Plex Sans', sans-serif", color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {namesA}
                          </span>
                          <span style={{ font: "400 10px/1 'IBM Plex Mono', monospace", color: T.textDisabled, flex: '0 0 auto' }}>A</span>
                        </div>

                        <div
                          onClick={() => handleQuickRecordCourtWin(court, 'B')}
                          style={{
                            minHeight: 40,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                            padding: '0 9px',
                            borderRadius: 7,
                            background: T.cardSunken,
                            border: `1px solid ${T.borderDefault}`,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          title={t('assign.tapToRecordWin', { team: 'B' })}
                        >
                          <span style={{ flex: 1, minWidth: 0, font: "600 12px/1.2 'IBM Plex Sans', sans-serif", color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {namesB}
                          </span>
                          <span style={{ font: "400 10px/1 'IBM Plex Mono', monospace", color: T.textDisabled, flex: '0 0 auto' }}>B</span>
                        </div>
                      </div>

                      <div style={{ font: "400 10px/1.3 'IBM Plex Mono', monospace", color: T.textDisabled, whiteSpace: 'nowrap' }}>
                        {t('assign.tapToWinNote')}
                      </div>

                      {/* Dự kiến ván sau nếu đang xếp sân này */}
                      {court.courtIndex === courtIdx && teamA.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 7px', borderRadius: 6, background: T.blueBg, border: `1px dashed ${T.blueBorder}` }}>
                          <span style={{ flex: 1, minWidth: 0, font: "400 10px/1.2 'IBM Plex Mono', monospace", color: T.blueText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t('assign.nextGamePrefix', { names: teamA.map((k) => playerName(db, k)).join(' · ') })}
                          </span>
                          <span style={{ font: "600 10px/1 'IBM Plex Sans', sans-serif", color: T.blueText, whiteSpace: 'nowrap' }}>
                            {teamA.length + teamB.length}/4
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                <div style={{ padding: '12px', borderRadius: 8, background: T.cardSunken, border: `1px dashed ${T.borderDefault}`, font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: T.textMuted, width: '100%', textAlign: 'center' }}>
                  {t('assign.noCourtPlaying')}
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* VÙNG 4 · SÂN ĐANG XẾP (CHIP CHUYỂN SÂN + 4 Ô TƯƠNG TÁC + CHỈ BÁO CHẠM TÊN →) */}
          {/* ========================================================================= */}
          <div style={{ padding: '12px 14px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ padding: '11px 12px', borderRadius: 10, background: T.blueBg, border: `1px solid ${T.blueBorder}`, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: T.blueText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t('assign.arrangingSuffix', { label: courtOptions[courtIdx]?.label || t('session.courtNum', { n: courtIdx + 1 }) })}
                </span>
                <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: T.blueText, whiteSpace: 'nowrap' }}>
                  {t('assign.slotCount', { cur: activeSlotIndex + 1, total: 4 })}
                </span>
              </div>

              {/* Hàng chip chuyển sân nhanh */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {courtOptions.map((opt, idx) => {
                  const isSelected = idx === courtIdx
                  const isPlaying = playingCourts.some((p) => p.courtIndex === idx)
                  return (
                    <div
                      key={opt.value}
                      onClick={() => setCourtIdx(idx)}
                      style={{
                        minHeight: 28,
                        flex: '0 0 auto',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '0 9px',
                        borderRadius: 999,
                        background: isSelected ? (isDark ? 'rgba(60,116,196,.30)' : '#DDE8F7') : 'transparent',
                        border: `1px solid ${isSelected ? T.blueBorder : T.borderDefault}`,
                        font: "600 11px/1 'IBM Plex Sans', sans-serif",
                        color: isSelected ? T.blueText : T.textSecondary,
                        cursor: 'pointer',
                      }}
                    >
                      <span>S{idx + 1}</span>
                      <span style={{ font: "400 10px/1 'IBM Plex Mono', monospace", opacity: 0.8 }}>
                        {isPlaying ? t('assign.statusPlaying') : t('assign.statusEmpty')}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* 4 ô tương tác của sân: 2 ô Đội A + 2 ô Đội B */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                {[0, 1, 2, 3].map((slotIdx) => {
                  const isTeamA = slotIdx < 2
                  const playerKey = isTeamA ? teamA[slotIdx] : teamB[slotIdx - 2]
                  const isActive = activeSlotIndex === slotIdx && !playerKey
                  const p = playerKey ? players.find((x) => x.key === playerKey) : null
                  const plays = playerKey ? (matchCountMap[playerKey] || 0) : 0

                  if (playerKey && p) {
                    return (
                      <div
                        key={slotIdx}
                        onClick={() => handleTapSlot(slotIdx)}
                        style={{
                          minHeight: 48,
                          padding: '7px 9px',
                          borderRadius: 8,
                          background: T.cardBg,
                          border: `1px solid ${isDark ? 'rgba(159,192,234,.45)' : 'var(--border-default)'}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                          cursor: 'pointer',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                        title={t('assign.removeSlotTooltip')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                          <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.name}
                          </span>
                          <span style={{ font: "600 11px/1 'IBM Plex Sans', sans-serif", color: T.textMuted }}>✕</span>
                        </div>
                        <div style={{ font: "400 10px/1.2 'IBM Plex Mono', monospace", color: T.textMuted, whiteSpace: 'nowrap' }}>
                          {t('assign.slotTeamMeta', { team: isTeamA ? 'A' : 'B', n: plays })}
                        </div>
                      </div>
                    )
                  }

                  if (isActive) {
                    return (
                      <div
                        key={slotIdx}
                        onClick={() => handleTapSlot(slotIdx)}
                        style={{
                          minHeight: 48,
                          padding: '7px 9px',
                          borderRadius: 8,
                          background: T.activeSlotBg,
                          border: `1.5px solid ${T.activeSlotBorder}`,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          gap: 2,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ font: "600 12px/1.2 'IBM Plex Sans', sans-serif", color: T.blueText, whiteSpace: 'nowrap' }}>
                          {t('assign.tapNameHint')}
                        </div>
                        <div style={{ font: "400 10px/1.2 'IBM Plex Mono', monospace", color: T.blueText, whiteSpace: 'nowrap' }}>
                          {t('assign.slotTeamMeta', { team: isTeamA ? 'A' : 'B', n: slotIdx + 1 })}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={slotIdx}
                      onClick={() => handleTapSlot(slotIdx)}
                      style={{
                        minHeight: 48,
                        padding: '7px 9px',
                        borderRadius: 8,
                        border: `1px dashed ${T.borderDefault}`,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        gap: 2,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ font: "600 12px/1.2 'IBM Plex Sans', sans-serif", color: T.textDisabled, whiteSpace: 'nowrap' }}>
                        {t('assign.slotEmptyLabel')}
                      </div>
                      <div style={{ font: "400 10px/1.2 'IBM Plex Mono', monospace", color: T.textDisabled, whiteSpace: 'nowrap' }}>
                        {t('assign.slotTeamMeta', { team: isTeamA ? 'A' : 'B', n: slotIdx + 1 })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* VÙNG 5 · HÀNG SORT & LỌC (STICKY DÍNH ĐẦU KHI CUỘN) */}
          {/* ========================================================================= */}
          <div
            style={{
              marginTop: 12,
              padding: '10px 14px',
              background: T.pageBg,
              borderTop: `1px solid ${T.borderSubtle}`,
              borderBottom: `1px solid ${T.borderSubtle}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              position: 'sticky',
              top: 0,
              zIndex: 10,
              backdropFilter: 'blur(8px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase', color: T.textMuted }}>
                {t('assign.waitingCount', { n: filteredWaiting.length })}
              </div>
              <div style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: T.textDisabled, whiteSpace: 'nowrap' }}>
                {t('assign.stickyOnScroll')}
              </div>
            </div>

            {/* Ô tìm kiếm nếu được bật */}
            {showSearch && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="text"
                  placeholder={t('assign.searchPlayerPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    height: 36,
                    borderRadius: 8,
                    background: T.cardSunken,
                    border: `1px solid ${T.borderDefault}`,
                    padding: '0 12px',
                    fontSize: 13,
                    color: T.textPrimary,
                    outline: 'none',
                  }}
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{ background: 'transparent', border: 'none', color: T.textMuted, cursor: 'pointer', fontSize: 13 }}
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* Hàng chip Sort & Lọc */}
            <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Chip mở Sheet Sort (CS2) */}
              <div
                onClick={() => setShowSortFilterSheet(true)}
                style={{
                  minHeight: 32,
                  flex: '0 0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '0 11px',
                  borderRadius: 999,
                  background: T.tealBg,
                  border: `1px solid ${T.tealBorder}`,
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  color: T.tealText,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>
                  {sortMode === 'fewest' ? t('assign.sortFewest') : sortMode === 'waitingTime' ? t('assign.sortWaiting') : sortMode === 'level' ? t('assign.sortLevel') : t('assign.sortAz')}
                </span>
              </div>

              <div
                onClick={() => setSortMode('waitingTime')}
                style={{
                  minHeight: 32,
                  flex: '0 0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 11px',
                  borderRadius: 999,
                  background: sortMode === 'waitingTime' ? T.cardRaised : 'transparent',
                  border: `1px solid ${sortMode === 'waitingTime' ? T.borderStrong : T.borderSubtle}`,
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  color: sortMode === 'waitingTime' ? T.textPrimary : T.textSecondary,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {t('assign.sortWaiting')}
              </div>

              <div
                onClick={() => setSortMode('level')}
                style={{
                  minHeight: 32,
                  flex: '0 0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 11px',
                  borderRadius: 999,
                  background: sortMode === 'level' ? T.cardRaised : 'transparent',
                  border: `1px solid ${sortMode === 'level' ? T.borderStrong : T.borderSubtle}`,
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  color: sortMode === 'level' ? T.textPrimary : T.textSecondary,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {t('assign.sortLevel')}
              </div>

              <div style={{ width: 1, height: 20, background: T.borderSubtle, flex: '0 0 auto' }} />

              {/* Lọc Nữ */}
              <div
                onClick={() => setFilterGender((prev) => prev === 'female' ? null : 'female')}
                style={{
                  minHeight: 32,
                  flex: '0 0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 11px',
                  borderRadius: 999,
                  background: filterGender === 'female' ? T.femaleBg : 'transparent',
                  border: `1px solid ${filterGender === 'female' ? T.femaleBorder : T.borderSubtle}`,
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  color: filterGender === 'female' ? T.femaleText : T.textSecondary,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {t('assign.filterFemale', { n: femaleWaitingCount })}
              </div>

              {/* Lọc Nam */}
              <div
                onClick={() => setFilterGender((prev) => prev === 'male' ? null : 'male')}
                style={{
                  minHeight: 32,
                  flex: '0 0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 11px',
                  borderRadius: 999,
                  background: filterGender === 'male' ? T.blueBg : 'transparent',
                  border: `1px solid ${filterGender === 'male' ? T.blueBorder : T.borderSubtle}`,
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  color: filterGender === 'male' ? T.blueText : T.textSecondary,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {t('assign.filterMale', { n: maleWaitingCount })}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* VÙNG 6 · ĐANG CHỜ (VÙNG CAO NHẤT · GRID 2 CỘT GOM NHÓM THEO SỐ TRẬN) */}
          {/* ========================================================================= */}
          <div style={{ flex: 1, padding: '10px 14px 110px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {groupedWaiting.length > 0 ? (
              groupedWaiting.map((group) => {
                const isAmber = group.isLowest
                return (
                  <div key={group.key} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {/* Header nhóm */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ font: "700 12px/1 'IBM Plex Mono', monospace", color: isAmber ? T.amberText : T.textSecondary, whiteSpace: 'nowrap' }}>
                        {group.label}
                      </div>
                      <div style={{ flex: 1, height: 1, background: T.borderSubtle }} />
                      <div style={{ font: "400 11px/1 'IBM Plex Sans', sans-serif", color: T.textDisabled, whiteSpace: 'nowrap' }}>
                        {group.players.length} {t('units.people')} {group.sub ? `· ${group.sub}` : ''}
                      </div>
                    </div>

                    {/* Grid 2 cột gọn 1 dòng chữ: 16 người vừa vặn không bị cuộn dài */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(180px, 1fr))', gap: 7 }}>
                      {group.players.map((p) => {
                        const plays = matchCountMap[p.key] || 0
                        const isFemale = p.gender === 'female'
                        const isSelected = teamA.includes(p.key) || teamB.includes(p.key)

                        return (
                          <div
                            key={p.key}
                            onClick={() => handleTapPlayer(p.key)}
                            style={{
                              minHeight: 52,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '8px 10px',
                              borderRadius: 10,
                              background: isSelected ? T.activeSlotBg : T.cardBg,
                              border: `1px solid ${isFemale ? T.femaleBorder : T.borderDefault}`,
                              cursor: 'pointer',
                              transition: 'all 0.12s ease',
                              boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.04))',
                            }}
                            role="button"
                            tabIndex={0}
                            title={`${p.name} · ${genderTxt(p.gender)} · ${p.level} · ${plays} ${t('units.match')}`}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {p.name}
                              </div>
                              <div style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: isFemale ? T.femaleText : T.textMuted, whiteSpace: 'nowrap' }}>
                                {genderTxt(p.gender)} · {p.level || 'TB'}
                              </div>
                            </div>

                            {/* Số trận to bên phải */}
                            <div style={{ font: "700 18px/1 Barlow, sans-serif", color: isAmber ? T.amberText : T.textSecondary, flex: '0 0 auto' }}>
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
              <div style={{ textAlign: 'center', padding: '36px 14px', color: T.textMuted, font: "400 13px/1.5 'IBM Plex Sans', sans-serif" }}>
                {t('assign.noWaitingFiltered')}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* VÙNG 7 · THANH DƯỚI CỐ ĐỊNH (TÓM TẮT SÂN + TỰ XẾP 4 ÍT TRẬN + VÀO SÂN) */}
          {/* ========================================================================= */}
          <div
            style={{
              position: 'sticky',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '10px 14px 14px',
              background: T.bottomBarBg,
              borderTop: `1px solid ${T.borderSubtle}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              zIndex: 20,
              boxShadow: '0 -4px 16px rgba(0,0,0,.15)',
            }}
          >
            {/* Tóm tắt tình trạng sân đang xếp */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: T.cardSunken, border: `1px solid ${T.borderSubtle}` }}>
              <div style={{ flex: 1, minWidth: 0, font: "400 12px/1.35 'IBM Plex Sans', sans-serif", color: T.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {courtLineupSummary.courtLabel} · {t('quickMatch.teamA')} <span style={{ color: T.textPrimary, fontWeight: 600 }}>{courtLineupSummary.teamATxt}</span>
              </div>
              <div style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: T.textDisabled, flex: '0 0 auto', whiteSpace: 'nowrap' }}>
                {courtLineupSummary.emptyCount > 0 ? t('assign.slotsRemaining', { n: courtLineupSummary.emptyCount }) : t('assign.slotsFull')}
              </div>
            </div>

            {/* 2 nút hành động lớn */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleAutoPickFewest}
                disabled={waitingPlayers.length === 0 || emptySlotsCount === 0}
                style={{
                  flex: 1,
                  minHeight: 46,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  background: T.cardRaised,
                  border: `1px solid ${T.borderDefault}`,
                  font: "600 13px/1 'IBM Plex Sans', sans-serif",
                  color: T.textPrimary,
                  cursor: (waitingPlayers.length === 0 || emptySlotsCount === 0) ? 'not-allowed' : 'pointer',
                  opacity: (waitingPlayers.length === 0 || emptySlotsCount === 0) ? 0.5 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {t('assign.autoPickFewestBtn')}
              </button>

              <button
                type="button"
                onClick={handleEnterCourt}
                disabled={emptySlotsCount > 0}
                style={{
                  flex: 1,
                  minHeight: 46,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  background: emptySlotsCount > 0 ? (isDark ? '#16231D' : '#D1FAE5') : T.greenBtn,
                  border: `1px solid ${emptySlotsCount > 0 ? 'transparent' : T.greenBtnBorder}`,
                  font: "700 13px/1 'IBM Plex Sans', sans-serif",
                  color: emptySlotsCount > 0 ? (isDark ? '#4B6B5D' : '#065F46') : '#FFFFFF',
                  cursor: emptySlotsCount > 0 ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: emptySlotsCount === 0 ? '0 2px 8px rgba(13,94,58,.30)' : 'none',
                }}
              >
                {t('assign.enterCourtBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SHEET CS2 · SORT & LỌC POOL */}
      {/* ========================================================================= */}
      {showSortFilterSheet && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            background: 'rgba(3,8,17,.60)',
            backdropFilter: 'blur(3px)',
          }}
          onClick={() => setShowSortFilterSheet(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: T.cardBg,
              borderTop: `1px solid ${T.borderDefault}`,
              borderRadius: '18px 18px 0 0',
              padding: '12px 16px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 -12px 30px rgba(0,0,0,.45)',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            {/* Thanh gạt trên sheet */}
            <div style={{ width: 40, height: 4, borderRadius: 999, background: T.borderDefault, alignSelf: 'center' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ font: "600 17px/1.2 Barlow, sans-serif", color: T.textPrimary }}>
                {t('assign.sortSheetTitle')}
              </div>
              <div
                onClick={() => {
                  setSortMode('fewest')
                  setFilterGender(null)
                  setFilterSameLevel(false)
                  setFilterNotPlayedWith(false)
                }}
                style={{ font: "600 12px/1 'IBM Plex Sans', sans-serif", color: T.tealText, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {t('assign.setDefault')}
              </div>
            </div>

            {/* 4 Chế độ Sort Radio */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[
                { id: 'fewest', title: t('assign.sortFewestTitle'), desc: t('assign.sortFewestDesc') },
                { id: 'waitingTime', title: t('assign.sortWaitTitle'), desc: t('assign.sortWaitDesc') },
                { id: 'level', title: t('assign.sortLevelTitle'), desc: t('assign.sortLevelDesc') },
                { id: 'az', title: t('assign.sortAzTitle'), desc: t('assign.sortAzDesc') },
              ].map((opt) => {
                const isSelected = sortMode === opt.id
                return (
                  <div
                    key={opt.id}
                    onClick={() => setSortMode(opt.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      minHeight: 48,
                      padding: '0 12px',
                      borderRadius: 8,
                      background: isSelected ? T.tealBg : 'transparent',
                      border: `1px solid ${isSelected ? T.tealBorder : T.borderSubtle}`,
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        flex: '0 0 auto',
                        borderRadius: 999,
                        border: isSelected ? `5px solid ${T.tealAccent}` : `1.5px solid ${T.borderDefault}`,
                        background: isSelected ? T.pageBg : 'transparent',
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: T.textPrimary }}>
                        {opt.title}
                      </div>
                      <div style={{ font: "400 11px/1.3 'IBM Plex Sans', sans-serif", color: T.textMuted }}>
                        {opt.desc}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Lọc nhanh · cộng dồn */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase', color: T.textMuted }}>
                {t('assign.quickFilterTitle')}
              </div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <div
                  onClick={() => setFilterGender((p) => p === 'female' ? null : 'female')}
                  style={{
                    minHeight: 36,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 13px',
                    borderRadius: 999,
                    background: filterGender === 'female' ? T.femaleBg : 'transparent',
                    border: `1px solid ${filterGender === 'female' ? T.femaleBorder : T.borderSubtle}`,
                    font: "600 12px/1 'IBM Plex Sans', sans-serif",
                    color: filterGender === 'female' ? T.femaleText : T.textSecondary,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('assign.filterFemaleTag', { n: femaleWaitingCount })}
                </div>

                <div
                  onClick={() => setFilterGender((p) => p === 'male' ? null : 'male')}
                  style={{
                    minHeight: 36,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 13px',
                    borderRadius: 999,
                    background: filterGender === 'male' ? T.blueBg : 'transparent',
                    border: `1px solid ${filterGender === 'male' ? T.blueBorder : T.borderSubtle}`,
                    font: "600 12px/1 'IBM Plex Sans', sans-serif",
                    color: filterGender === 'male' ? T.blueText : T.textSecondary,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('assign.filterMaleTag', { n: maleWaitingCount })}
                </div>

                <div
                  onClick={() => setFilterSameLevel((p) => !p)}
                  style={{
                    minHeight: 36,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 13px',
                    borderRadius: 999,
                    background: filterSameLevel ? T.tealBg : 'transparent',
                    border: `1px solid ${filterSameLevel ? T.tealBorder : T.borderSubtle}`,
                    font: "600 12px/1 'IBM Plex Sans', sans-serif",
                    color: filterSameLevel ? T.tealText : T.textSecondary,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('assign.sameLevelSlot')}
                </div>

                <div
                  onClick={() => setFilterNotPlayedWith((p) => !p)}
                  style={{
                    minHeight: 36,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 13px',
                    borderRadius: 999,
                    background: filterNotPlayedWith ? T.tealBg : 'transparent',
                    border: `1px solid ${filterNotPlayedWith ? T.tealBorder : T.borderSubtle}`,
                    font: "600 12px/1 'IBM Plex Sans', sans-serif",
                    color: filterNotPlayedWith ? T.tealText : T.textSecondary,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('assign.notPlayedWithTeam', { name: teamA[0] ? playerName(db, teamA[0]) : t('quickMatch.teamA') })}
                </div>
              </div>
              <div style={{ font: "400 12px/1.45 'IBM Plex Sans', sans-serif", color: T.textMuted }}>
                {t('assign.filterNote')}
              </div>
            </div>

            {/* Thẻ gợi ý tự xếp */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 10, background: T.blueBg, border: `1px solid ${T.blueBorder}` }}>
              <div style={{ font: "600 13px/1.25 'IBM Plex Sans', sans-serif", color: T.blueText }}>
                {t('assign.autoPickFourTitle')}
              </div>
              <div style={{ font: "400 12px/1.45 'IBM Plex Sans', sans-serif", color: T.textSecondary }}>
                {t('assign.autoPickFourDesc', {
                  names: [...waitingPlayers].sort((p1, p2) => (matchCountMap[p1.key] || 0) - (matchCountMap[p2.key] || 0)).slice(0, 4).map((p) => p.name).join(' · ') || t('assign.notEnoughToPick'),
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  handleAutoPickFewest()
                  setShowSortFilterSheet(false)
                }}
                style={{
                  minHeight: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  background: T.cardRaised,
                  border: `1px solid ${T.blueBorder}`,
                  font: "700 13px/1 'IBM Plex Sans', sans-serif",
                  color: T.blueText,
                  cursor: 'pointer',
                }}
              >
                {t('assign.testAssignToCourt', { n: courtIdx + 1 })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SHEET CS3 · THỐNG KÊ BUỔI (MỞ TỪ NÚT ▤ · KHÔNG RỜI MÀN) */}
      {/* ========================================================================= */}
      {showStatsSheet && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            background: 'rgba(3,8,17,.60)',
            backdropFilter: 'blur(3px)',
          }}
          onClick={() => setShowStatsSheet(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: T.cardBg,
              borderTop: `1px solid ${T.borderDefault}`,
              borderRadius: '18px 18px 0 0',
              padding: '12px 16px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              boxShadow: '0 -12px 30px rgba(0,0,0,.45)',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ width: 40, height: 4, borderRadius: 999, background: T.borderDefault, alignSelf: 'center' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ font: "600 17px/1.2 Barlow, sans-serif", color: T.textPrimary }}>
                {t('assign.statsSheetTitle', { date: dd(s.date) })}
              </div>
              <div style={{ font: "400 12px/1.45 'IBM Plex Sans', sans-serif", color: T.textMuted }}>
                {t('assign.statsSheetSub')}
              </div>
            </div>

            {/* 3 Tab thống kê */}
            <div style={{ display: 'flex', padding: 3, borderRadius: 8, background: T.cardSunken, border: `1px solid ${T.borderSubtle}`, gap: 2 }}>
              <button
                type="button"
                onClick={() => setStatsTab('matches')}
                style={{
                  flex: 1,
                  minHeight: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                  background: statsTab === 'matches' ? T.cardRaised : 'transparent',
                  border: `1px solid ${statsTab === 'matches' ? T.borderDefault : 'transparent'}`,
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  color: statsTab === 'matches' ? T.textPrimary : T.textSecondary,
                  cursor: 'pointer',
                }}
              >
                {t('assign.tabMatches')}
              </button>
              <button
                type="button"
                onClick={() => setStatsTab('waiting')}
                style={{
                  flex: 1,
                  minHeight: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                  background: statsTab === 'waiting' ? T.cardRaised : 'transparent',
                  border: `1px solid ${statsTab === 'waiting' ? T.borderDefault : 'transparent'}`,
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  color: statsTab === 'waiting' ? T.textPrimary : T.textSecondary,
                  cursor: 'pointer',
                }}
              >
                {t('assign.tabWaiting')}
              </button>
              <button
                type="button"
                onClick={() => setStatsTab('pairs')}
                style={{
                  flex: 1,
                  minHeight: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                  background: statsTab === 'pairs' ? T.cardRaised : 'transparent',
                  border: `1px solid ${statsTab === 'pairs' ? T.borderDefault : 'transparent'}`,
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  color: statsTab === 'pairs' ? T.textPrimary : T.textSecondary,
                  cursor: 'pointer',
                }}
              >
                {t('assign.tabPairs')}
              </button>
            </div>

            {/* 2 Thẻ tổng quan */}
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: T.cardSunken, border: `1px solid ${T.borderSubtle}` }}>
                <div style={{ font: "400 11px/1.3 'IBM Plex Sans', sans-serif", color: T.textMuted }}>{t('assign.statsAvg')}</div>
                <div style={{ font: "700 20px/1.15 Barlow, sans-serif", color: T.textPrimary }}>
                  {t('assign.statsAvgUnit', { n: sessionStatsData.avgMatches })}
                </div>
              </div>
              <div style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: T.amberBg, border: `1px solid ${T.amberBorder}` }}>
                <div style={{ font: "400 11px/1.3 'IBM Plex Sans', sans-serif", color: T.amberText }}>{t('assign.statsMaxDiff')}</div>
                <div style={{ font: "700 20px/1.15 Barlow, sans-serif", color: T.amberText }}>
                  {sessionStatsData.minMatches} ↔ {sessionStatsData.maxMatches}
                </div>
              </div>
            </div>

            {/* Danh sách thanh tiến trình từng người */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
              {sessionStatsData.membersList.map((p) => {
                const plays = matchCountMap[p.key] || 0
                const maxVal = Math.max(sessionStatsData.maxMatches, 1)
                const pct = Math.min(100, Math.round((plays / maxVal) * 100))
                const isAmber = plays === sessionStatsData.minMatches
                const barColor = isAmber ? T.amberText : plays === sessionStatsData.maxMatches ? T.textDisabled : T.tealAccent

                return (
                  <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 88, flex: '0 0 auto', font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name}
                    </div>
                    <div style={{ flex: 1, height: 10, borderRadius: 999, background: T.cardSunken, border: `1px solid ${T.borderSubtle}`, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 999 }} />
                    </div>
                    <div style={{ width: 30, flex: '0 0 auto', textAlign: 'right', font: "600 13px/1 'IBM Plex Mono', monospace", color: isAmber ? T.amberText : T.textSecondary }}>
                      {plays}
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowStatsSheet(false)}
              style={{
                minHeight: 46,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                background: T.cardRaised,
                border: `1px solid ${T.borderDefault}`,
                font: "600 13px/1 'IBM Plex Sans', sans-serif",
                color: T.textPrimary,
                cursor: 'pointer',
              }}
            >
              {t('assign.closeBackToWait')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
