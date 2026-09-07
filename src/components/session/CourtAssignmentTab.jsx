import { useState, useMemo, useCallback } from 'react'
import { Button, Card, Icon, IconButton, Select, Switch } from '#ds'
import { GenderChip, LevelChip } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { playerName, genderTxt } from '#lib/money.js'
import { sessionPlayers, detailedCourtBalance, courtSlotIds } from '#lib/assign.js'
import {
  expectedScore, getPlayerRating,
  teamRating, computeClubCalibration,
  calcPlayerDeltas,
} from '#lib/rating.js'
import { t } from '#i18n'
import BestOfNArrangementView from '#components/session/BestOfNArrangementView.jsx'

export default function CourtAssignmentTab({ s }) {
  const { db, a } = useApp()
  const isMobile = useMobile(768)

  // Mode: 'doubles' (2 vs 2) hoặc 'singles' (1 vs 1)
  const [mode, setMode] = useState('doubles')
  const maxPerTeam = mode === 'doubles' ? 2 : 1

  // Đội A & Đội B (mảng id/key các đấu thủ)
  const [teamA, setTeamA] = useState([])
  const [teamB, setTeamB] = useState([])
  const [useBestOfN, setUseBestOfN] = useState(false)

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

  // Danh sách tất cả người tham gia buổi (thành viên có mặt + khách)
  const players = useMemo(() => sessionPlayers(db, s), [db, s])

  // Map rating cho tất cả người trong pool
  const ratingsMap = useMemo(() => {
    const map = {}
    players.forEach((p) => {
      map[p.key] = getPlayerRating(db.playerRatings, p.key).rating
    })
    return map
  }, [players, db.playerRatings])

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

  // Lọc người chờ theo ô tìm kiếm
  const filteredWaiting = useMemo(() => {
    if (!searchQuery.trim()) return waitingPlayers
    const q = searchQuery.toLowerCase()
    return waitingPlayers.filter((p) => {
      const nameMatch = (p.name || '').toLowerCase().includes(q)
      const levelMatch = (p.level || '').toLowerCase().includes(q)
      return nameMatch || levelMatch
    })
  }, [waitingPlayers, searchQuery])

  // Đổi mode đơn / đôi
  const handleSwitchMode = (newMode) => {
    setMode(newMode)
    const newMax = newMode === 'doubles' ? 2 : 1
    if (teamA.length > newMax) setTeamA(teamA.slice(0, newMax))
    if (teamB.length > newMax) setTeamB(teamB.slice(0, newMax))
  }

  // Chạm vào người trong danh sách chờ: tự động đưa vào slot trống
  const handleTapPlayer = useCallback((key) => {
    if (teamA.includes(key)) {
      setTeamA((prev) => prev.filter((k) => k !== key))
      return
    }
    if (teamB.includes(key)) {
      setTeamB((prev) => prev.filter((k) => k !== key))
      return
    }
    if (teamA.length < maxPerTeam) {
      setTeamA((prev) => [...prev, key])
    } else if (teamB.length < maxPerTeam) {
      setTeamB((prev) => [...prev, key])
    } else {
      a.toast(t('quickMatch.errFullSlots', { req: maxPerTeam }))
    }
  }, [teamA, teamB, maxPerTeam, a])

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

  // Điểm cân bằng chi tiết (Detailed Balance Score - Mockup 01)
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
      players,
      stats: statsObj,
    })
  }, [teamA, teamB, maxPerTeam, courtIdx, ratingsMap, sessionMatches, players, statsObj])

  // Phân tích Effective Rating & Học chéo giới tính (Mockup R3)
  const effectiveAnalysis = useMemo(() => {
    if (teamA.length < 2 || teamB.length < 2) return null

    // Đếm giới tính
    const gA = teamA.map((k) => (players.find((p) => p.key === k) || {}).gender)
    const gB = teamB.map((k) => (players.find((p) => p.key === k) || {}).gender)
    const hasFemaleA = gA.includes('female')
    const hasFemaleB = gB.includes('female')
    const isCrossGender = hasFemaleA !== hasFemaleB || (hasFemaleA && hasFemaleB)

    // Lấy dữ liệu hiệu chỉnh chéo giới tính của CLB
    const memberMap = {}
    players.forEach((p) => { memberMap[p.key] = p })
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
      {/* Switcher Chế độ Best-of-N thông minh vs Chia sân đơn lẻ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, padding: 3, borderRadius: 8, background: '#141D2E', border: '1px solid #22304A' }}>
          <button
            type="button"
            onClick={() => setUseBestOfN(true)}
            style={{
              font: "600 12px/1 'IBM Plex Sans', sans-serif",
              padding: '8px 14px',
              borderRadius: 6,
              background: useBestOfN ? '#00B2A9' : 'transparent',
              color: useBestOfN ? '#04302C' : '#A8B7CB',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {t('season.bestOfNMode')}
          </button>
          <button
            type="button"
            onClick={() => setUseBestOfN(false)}
            style={{
              font: "600 12px/1 'IBM Plex Sans', sans-serif",
              padding: '8px 14px',
              borderRadius: 6,
              background: !useBestOfN ? '#1D50A0' : 'transparent',
              color: !useBestOfN ? '#fff' : '#A8B7CB',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {t('season.scorePerCourtMode')}
          </button>
        </div>
      </div>

      {useBestOfN ? (
        <BestOfNArrangementView
          session={s}
          players={players}
          db={db}
          onApplyPlan={(chosenLineup) => a.setLineup(s.id, chosenLineup)}
          onToggleManual={() => setUseBestOfN(false)}
          isMobile={isMobile}
        />
      ) : (
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
      <Card
        title={t('assign.waitingPool')}
        subtitle={t('assign.waitingSub', { n: waitingPlayers.length, total: players.length })}
        icon="users"
        padding="14px 16px"
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon="wand-sparkles"
            onClick={handleAutoPickFewest}
            disabled={waitingPlayers.length === 0 || isCourtFull}
          >
            {t('assign.fewestBtn')}
          </Button>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {/* Ô tìm kiếm người trong pool */}
          <div style={S.searchRow}>
            <input
              type="text"
              placeholder={t('session.searchMember')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={S.searchInput}
            />
            <span style={S.touchHint}>{t('assign.poolTouchHint')}</span>
          </div>

          {/* Danh sách người chờ: trên mobile là hàng pill cuộn tự nhiên (Screen 01), trên desktop là lưới card 2 dòng */}
          <div style={isMobile ? S.poolPillWrap : S.poolGrid}>
            {filteredWaiting.map((p) => {
              const plays = matchCountMap[p.key] || 0
              const r = ratingsMap[p.key] || 0
              const isFresh = plays === 0

              if (isMobile) {
                return (
                  <div
                    key={p.key}
                    onClick={() => handleTapPlayer(p.key)}
                    style={S.playerPillMobile}
                    role="button"
                    tabIndex={0}
                    title={`${p.name} · ${genderTxt(p.gender)} · ${r} Elo · ${plays} ${t('units.match')}`}
                  >
                    <span style={S.playerNameText}>{p.name}</span>
                    <GenderChip gender={p.gender} />
                    <LevelChip level={p.level} levels={db.levels} size="sm" />
                    {p.guest && <span style={S.guestTag}>{t('home.tagGuest')}</span>}
                    {isFresh ? (
                      <span style={S.freshPlayTag}>0 {t('units.match')}</span>
                    ) : (
                      <span style={S.playCountTagPill}>{plays}t</span>
                    )}
                  </div>
                )
              }

              return (
                <div
                  key={p.key}
                  onClick={() => handleTapPlayer(p.key)}
                  style={S.playerChip}
                  role="button"
                  tabIndex={0}
                  title={p.name}
                >
                  {/* Hàng 1: Tên VĐV to rõ không bị cắt + LevelChip + Tag Khách */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                      <span style={S.playerNameText}>{p.name}</span>
                      {p.guest && <span style={S.guestTag}>{t('home.tagGuest')}</span>}
                    </div>
                    <LevelChip level={p.level} levels={db.levels} size="sm" />
                  </div>

                  {/* Hàng 2: Giới tính · Số trận (nổi bật nếu 0 trận) · Rating Elo */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%', fontSize: 11.5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <GenderChip gender={p.gender} />
                      <span style={{ color: 'var(--border-strong-color)' }}>·</span>
                      <span style={isFresh ? S.freshPlayTag : S.playCountTag}>
                        {plays} {t('units.match')}
                      </span>
                    </div>
                    <span style={S.playerRatingMono}>{r}</span>
                  </div>
                </div>
              )
            })}
            {filteredWaiting.length === 0 && (
              <div style={S.emptyPoolMsg}>
                {waitingPlayers.length === 0 ? t('session.guestEmpty') : t('common.noData')}
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

        {/* Khung mặt sân thi đấu */}
        <div style={S.courtSurface}>
          {/* Đội A (Top) */}
          <div style={{ ...S.teamRow, gridTemplateColumns: mode === 'singles' ? '1fr' : '1fr 1fr' }}>
            {Array.from({ length: maxPerTeam }).map((_, idx) => {
              const key = teamA[idx]
              if (key) {
                const p = players.find((x) => x.key === key) || {}
                const r = ratingsMap[key] || 0
                const plays = matchCountMap[key] || 0
                return (
                  <div key={key} style={S.slotFilled}>
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
                        onClick={() => setTeamA((prev) => prev.filter((k) => k !== key))}
                      />
                    </div>
                    <div style={S.slotMeta}>
                      <GenderChip gender={p.gender} />
                      <span style={{ color: 'var(--border-strong-color)' }}>·</span>
                      <span style={{ color: 'var(--text-primary)', fontFamily: '"IBM Plex Mono", monospace' }}>{r}</span>
                      <span style={{ color: 'var(--border-strong-color)' }}>·</span>
                      <span style={{ color: 'var(--status-transit-fg)' }}>{plays} {t('units.match')}</span>
                    </div>
                  </div>
                )
              }
              return (
                <div key={idx} style={S.slotEmpty}>
                  <span style={S.slotEmptyText}>{t('assign.courtEmptySlot')}</span>
                </div>
              )
            })}
          </div>

          {/* Vạch LƯỚI Phân Cách */}
          <div style={S.netDivider}>
            <div style={S.netLine} />
            <span style={S.netText}>{t('assign.net')}</span>
            <div style={S.netLine} />
          </div>

          {/* Đội B (Bottom) */}
          <div style={{ ...S.teamRow, gridTemplateColumns: mode === 'singles' ? '1fr' : '1fr 1fr' }}>
            {Array.from({ length: maxPerTeam }).map((_, idx) => {
              const key = teamB[idx]
              if (key) {
                const p = players.find((x) => x.key === key) || {}
                const r = ratingsMap[key] || 0
                const plays = matchCountMap[key] || 0
                return (
                  <div key={key} style={S.slotFilled}>
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
                        onClick={() => setTeamB((prev) => prev.filter((k) => k !== key))}
                      />
                    </div>
                    <div style={S.slotMeta}>
                      <GenderChip gender={p.gender} />
                      <span style={{ color: 'var(--border-strong-color)' }}>·</span>
                      <span style={{ color: 'var(--text-primary)', fontFamily: '"IBM Plex Mono", monospace' }}>{r}</span>
                      <span style={{ color: 'var(--border-strong-color)' }}>·</span>
                      <span style={{ color: 'var(--status-transit-fg)' }}>{plays} {t('units.match')}</span>
                    </div>
                  </div>
                )
              }
              return (
                <div key={idx} style={S.slotEmpty}>
                  <span style={S.slotEmptyText}>{t('assign.courtEmptySlot')}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ---------------- 3. KHỐI ĐIỂM CÂN BẰNG (BALANCE SCORE - MOCKUP 01) ---------------- */}
        {balanceDetails && (
          <div style={S.balanceBox}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={S.balanceTitle}>{t('assign.balanceScore')}</span>
              <span style={S.balanceBigScore}>{balanceDetails.totalScore}</span>
            </div>

            {/* 4 thanh đo sub-metrics */}
            <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
              {/* 1. Cân rating */}
              <div style={S.metricRow}>
                <span style={S.metricLabel}>{t('assign.canRating')}</span>
                <div style={S.metricTrack}>
                  <div style={{ width: `${balanceDetails.canRating.score}%`, height: '100%', background: '#00B2A9' }} />
                </div>
                <span style={S.metricValueMono}>Δ{balanceDetails.canRating.delta}</span>
              </div>
              {/* 2. Đổi partner */}
              <div style={S.metricRow}>
                <span style={S.metricLabel}>{t('assign.partnerVariety')}</span>
                <div style={S.metricTrack}>
                  <div style={{ width: `${balanceDetails.partner.score}%`, height: '100%', background: '#00B2A9' }} />
                </div>
                <span style={S.metricValueMono}>{balanceDetails.partner.score}</span>
              </div>
              {/* 3. Đổi đối thủ */}
              <div style={S.metricRow}>
                <span style={S.metricLabel}>{t('assign.opponentVariety')}</span>
                <div style={S.metricTrack}>
                  <div style={{ width: `${balanceDetails.opponent.score}%`, height: '100%', background: '#00B2A9' }} />
                </div>
                <span style={S.metricValueMono}>{balanceDetails.opponent.score}</span>
              </div>
              {/* 4. Đều lượt đánh */}
              <div style={S.metricRow}>
                <span style={S.metricLabel}>{t('assign.fairnessPlays')}</span>
                <div style={S.metricTrack}>
                  <div style={{ width: `${balanceDetails.fairness.score}%`, height: '100%', background: balanceDetails.fairness.score < 80 ? '#E08A00' : '#00B2A9' }} />
                </div>
                <span style={{ ...S.metricValueMono, color: balanceDetails.fairness.score < 80 ? '#F0B75C' : '#8494AA' }}>
                  {balanceDetails.fairness.score}
                </span>
              </div>
            </div>

            <div style={S.balanceNoteText}>{balanceDetails.note}</div>
          </div>
        )}

        {/* ---------------- 4. KHỐI EFFECTIVE RATING (MOCKUP R3) ---------------- */}
        {effectiveAnalysis && effectiveAnalysis.isCrossGender && (
          <div style={S.effCard}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ font: '600 15px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                  {t('assign.twoWayBalance')}
                </div>
                <div style={{ font: '400 12px/1.4 "IBM Plex Sans", sans-serif', color: '#8494AA' }}>
                  {t('assign.twoWaySub')}
                </div>
              </div>
              <span style={S.calibratedBadge}>{t('assign.calibratedTag')}</span>
            </div>

            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              {/* Rating thô */}
              <div style={S.barCompareRow}>
                <span style={S.barCompareLabel}>{t('assign.rawRating')}</span>
                <div style={S.barCompareTrack}>
                  <div style={{ width: `${pctA}%`, height: '100%', background: '#2E3E5C' }} />
                  <div style={{ width: `${pctB}%`, height: '100%', background: '#1A2437' }} />
                </div>
                <span style={S.barCompareValue}>{ratingA} vs {ratingB} · {t('assign.skewDiff', { d: effectiveAnalysis.rawDelta })}</span>
              </div>

              {/* Effective rating */}
              <div style={S.barCompareRow}>
                <span style={{ ...S.barCompareLabel, color: '#5FDBD3' }}>{t('assign.effectiveRating')}</span>
                <div style={S.barCompareTrack}>
                  <div style={{ width: `${Math.round((effectiveAnalysis.effA / (effectiveAnalysis.effA + effectiveAnalysis.effB)) * 100)}%`, height: '100%', background: '#00B2A9' }} />
                  <div style={{ width: `${Math.round((effectiveAnalysis.effB / (effectiveAnalysis.effA + effectiveAnalysis.effB)) * 100)}%`, height: '100%', background: '#2E3E5C' }} />
                </div>
                <span style={{ ...S.barCompareValue, color: '#5FDBD3' }}>
                  {effectiveAnalysis.effA} vs {effectiveAnalysis.effB} · {t('assign.skewDiff', { d: effectiveAnalysis.effDelta })}
                </span>
              </div>
            </div>

            <div style={S.effDescText}>
              {t('assign.effectiveDesc', { n: effectiveAnalysis.sampleMatches, pct: effectiveAnalysis.femaleWinRate })}
            </div>

            {/* Gợi ý xếp khác */}
            {effectiveAnalysis.suggestion && (
              <div style={S.suggestionBox}>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '600 13px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                    {t('assign.swapAction', { p1: effectiveAnalysis.suggestion.p1Name, p2: effectiveAnalysis.suggestion.p2Name })}
                  </div>
                  <div style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: 'var(--status-transit-fg)' }}>
                    {t('assign.skewDiff', { d: effectiveAnalysis.suggestion.newDelta })}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleApplySuggestion(effectiveAnalysis.suggestion)}
                >
                  {t('assign.swapNow')}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ---------------- 5. KHỐI NHẬP TỶ SỐ & GHI KẾT QUẢ (MOCKUP 02) ---------------- */}
        {teamA.length > 0 && teamB.length > 0 && (
          <div style={S.scoreLoggerBox}>
            <div style={{ font: '600 11px/1.2 "IBM Plex Sans", sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              {t('scoreModal.instruction')}
            </div>

            {/* 2 Thẻ Đội A và Đội B */}
            <div style={S.teamsChoiceGrid}>
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

            {/* Box thay đổi Elo & XP */}
            <div style={S.changesBox}>
              <span style={{ font: '600 11px/1.2 "IBM Plex Sans", sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                {t('scoreModal.postMatchChanges')}
              </span>
              <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
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
  poolGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 8,
    maxHeight: 280,
    overflowY: 'auto',
    paddingRight: 4,
  },
  poolPillWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    maxHeight: 260,
    overflowY: 'auto',
    padding: '2px 0',
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
  },
  teamRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 10,
  },
  slotFilled: {
    minHeight: 64,
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
  },
  slotEmpty: {
    minHeight: 64,
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 10,
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
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
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
