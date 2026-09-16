import { useState, useMemo, useEffect, useRef } from 'react'
import { useApp } from '#contexts/AppContext.jsx'
import { sessionPlayers } from '#lib/assign.js'
import { getPlayerRating, DEFAULT_RATING } from '#lib/rating.js'
import {
  createDefaultPlan,
  calcPlayerLoads,
  autoGeneratePlan,
  calcRoundTimes,
  DEFAULT_ROUND_MINUTES,
  DEFAULT_TOTAL_ROUNDS,
} from '#lib/planner.js'
import { t } from '#i18n'

import PlannerHeader from './PlannerHeader.jsx'
import PlannerPlayerCol from './PlannerPlayerCol.jsx'
import PlannerGridCol from './PlannerGridCol.jsx'
import PlannerTimelineCol from './PlannerTimelineCol.jsx'
import PlannerHealthCol from './PlannerHealthCol.jsx'
import PlannerAddWishDialog from './PlannerAddWishDialog.jsx'

export default function SessionPlannerTab({ s }) {
  const { db, a } = useApp()

  // 1. Danh sách người tham gia buổi thực tế (không fake data)
  const players = useMemo(() => sessionPlayers(db, s), [db, s])

  // 2. Map rating cho từng người
  const ratingsMap = useMemo(() => {
    const map = {}
    players.forEach((p) => {
      const pr = getPlayerRating(db.playerRatings, p.key, p, db.levels)
      map[p.key] = pr.effectiveStrength ?? pr.rating ?? DEFAULT_RATING
    })
    return map
  }, [players, db.playerRatings, db.levels])

  // 3. Danh sách kèo đấu thực tế trong CLB
  const challenges = useMemo(() => {
    return (db.challenges || []).filter(
      (c) => (c.sessionId === s.id || !c.sessionId) && c.status !== 'cancelled' && c.status !== 'played'
    )
  }, [db.challenges, s.id])

  // 4. Kế hoạch buổi (lấy từ s.planner hoặc khởi tạo mặc định)
  const [plan, setPlan] = useState(() => {
    if (s.planner && Array.isArray(s.planner.rounds) && s.planner.rounds.length > 0) {
      return s.planner
    }
    return createDefaultPlan(s, players, DEFAULT_ROUND_MINUTES, DEFAULT_TOTAL_ROUNDS)
  })

  // Bản kế hoạch đã lưu gần nhất (dưới DB) để theo dõi isDirty và hỗ trợ khôi phục (revert)
  const [lastSavedPlan, setLastSavedPlan] = useState(() => {
    if (s.planner && Array.isArray(s.planner.rounds) && s.planner.rounds.length > 0) {
      return s.planner
    }
    return null
  })

  // Đồng bộ khi s.planner thay đổi từ bên ngoài (ví dụ sau khi sync DB xong)
  useEffect(() => {
    if (s.planner && Array.isArray(s.planner.rounds) && s.planner.rounds.length > 0) {
      setLastSavedPlan((cur) => cur || s.planner)
    }
  }, [s.planner])

  const [isSaving, setIsSaving] = useState(false)

  // Kiểm tra xem có thay đổi chưa lưu so với bản đã lưu trên DB không
  const isDirty = useMemo(() => {
    if (!lastSavedPlan) return true
    return JSON.stringify(plan) !== JSON.stringify(lastSavedPlan)
  }, [plan, lastSavedPlan])

  // 5. Tác vụ Lưu kế hoạch chủ động
  const handleSavePlan = () => {
    setIsSaving(true)
    try {
      if (a.setSessionPlanner) {
        a.setSessionPlanner(s.id, plan)
      }
      setLastSavedPlan(plan)
      a.toast(t('planner.saveSuccess'))
    } finally {
      setTimeout(() => setIsSaving(false), 300)
    }
  }

  // 6. Tác vụ Khôi phục về bản kế hoạch đã lưu gần nhất (nếu xếp nhầm)
  const handleRevertPlan = () => {
    a.confirm({
      title: t('planner.revert'),
      message: t('planner.revertConfirm'),
      tone: 'danger',
      onConfirm: () => {
        if (lastSavedPlan) {
          setPlan(lastSavedPlan)
        } else {
          const fresh = createDefaultPlan(s, players, DEFAULT_ROUND_MINUTES, DEFAULT_TOTAL_ROUNDS)
          setPlan(fresh)
        }
        a.toast(t('planner.revertDone'))
      },
    })
  }

  // 7. Auto-save dự phòng định kỳ sau mỗi 3 phút nếu có thay đổi chưa lưu
  useEffect(() => {
    if (!isDirty) return undefined
    const timer = setTimeout(() => {
      if (a.setSessionPlanner) {
        a.setSessionPlanner(s.id, plan)
        setLastSavedPlan(plan)
        a.toast(t('planner.autoSaved'))
      }
    }, 180000) // 3 phút
    return () => clearTimeout(timer)
  }, [isDirty, plan, s.id, a])

  // 8. View mode: 'grid' (Màn 1a Bảng vòng) hoặc 'timeline' (Màn 1b Dòng thời gian)
  const [viewMode, setViewMode] = useState('grid')
  const [highlightRoundIndex, setHighlightRoundIndex] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showAddWish, setShowAddWish] = useState(false)

  // 9. Thống kê tải trận
  const loads = useMemo(() => calcPlayerLoads(plan.rounds, players), [plan.rounds, players])

  // 10. Các tác vụ thao tác kế hoạch
  const handleAutoPlan = () => {
    const newRounds = autoGeneratePlan({
      players,
      courts: s.courts || [0, 1],
      challenges,
      wishes: plan.wishes || [],
      startTime: plan.rounds?.[0]?.time || '19:00',
      roundMinutes: plan.roundMinutes || DEFAULT_ROUND_MINUTES,
      totalRounds: plan.rounds?.length || DEFAULT_TOTAL_ROUNDS,
      ratingsMap,
    })
    setPlan((prev) => ({ ...prev, rounds: newRounds }))
    a.toast(t('planner.autoPlanDone', { rounds: newRounds.length }))
  }

  const handleReset = () => {
    a.confirm({
      title: t('planner.reset'),
      message: t('planner.resetConfirm'),
      tone: 'danger',
      onConfirm: () => {
        const fresh = createDefaultPlan(s, players, plan.roundMinutes || DEFAULT_ROUND_MINUTES, DEFAULT_TOTAL_ROUNDS)
        setPlan(fresh)
      },
    })
  }

  const handleDropPlayer = (roundIndex, courtIndex, playerKey) => {
    setPlan((prev) => {
      const nextRounds = prev.rounds.map((r, rIdx) => {
        if (rIdx !== roundIndex) return r

        // Xoá người chơi khỏi bất kỳ vị trí nào khác trong CÙNG VÒNG này (tránh 1 người đánh 2 sân cùng lúc)
        const nextCourts = r.courts.map((court, cIdx) => {
          let teamA = (court.teamA || []).filter((k) => k !== playerKey)
          let teamB = (court.teamB || []).filter((k) => k !== playerKey)

          // Nếu là sân đang thả người vào:
          if (cIdx === courtIndex) {
            if (teamA.length < 2) {
              teamA = [...teamA, playerKey]
            } else if (teamB.length < 2) {
              teamB = [...teamB, playerKey]
            } else {
              // Sân đã đủ 4 người -> thay người cuối của đội B
              teamB = [teamB[0], playerKey]
            }
          }
          return { ...court, teamA, teamB }
        })

        return { ...r, courts: nextCourts }
      })

      return { ...prev, rounds: nextRounds }
    })
  }

  const handleClearCourt = (roundIndex, courtIndex) => {
    setPlan((prev) => {
      const nextRounds = prev.rounds.map((r, rIdx) => {
        if (rIdx !== roundIndex) return r
        const nextCourts = r.courts.map((c, cIdx) => {
          if (cIdx !== courtIndex) return c
          return {
            ...c,
            teamA: [],
            teamB: [],
            challengeId: null,
            wishId: null,
            tag: null,
          }
        })
        return { ...r, courts: nextCourts }
      })
      return { ...prev, rounds: nextRounds }
    })
  }

  const handleAddRound = () => {
    setPlan((prev) => {
      const nextIdx = prev.rounds.length
      const startTime = prev.rounds[0]?.time || '19:00'
      const mins = prev.roundMinutes || DEFAULT_ROUND_MINUTES
      const times = calcRoundTimes(startTime, mins, nextIdx + 1)
      const newTime = times[nextIdx]

      const numCourts = prev.rounds[0]?.courts?.length || 2
      const newRound = {
        roundIndex: nextIdx,
        label: newTime?.label || `R${nextIdx + 1}`,
        time: newTime?.time || '22:00',
        timeRange: newTime?.timeRange || '22:00 → 22:18',
        courts: Array.from({ length: numCourts }, (_, ci) => ({
          courtIndex: ci,
          name: prev.rounds[0]?.courts?.[ci]?.name || null,
          teamA: [],
          teamB: [],
          challengeId: null,
          wishId: null,
          tag: null,
        })),
      }
      return {
        ...prev,
        rounds: [...prev.rounds, newRound],
        totalRounds: nextIdx + 1,
      }
    })
  }

  const handleScheduleChallenge = (challengeId) => {
    const chal = challenges.find((c) => c.id === challengeId)
    if (!chal) return

    setPlan((prev) => {
      let scheduled = false
      const nextRounds = prev.rounds.map((r) => {
        if (scheduled) return r
        // Tìm sân trống
        const freeIdx = r.courts.findIndex((c) => c.teamA.length === 0 && c.teamB.length === 0)
        if (freeIdx >= 0) {
          scheduled = true
          handleViewRound(r.roundIndex)
          const nextCourts = [...r.courts]
          nextCourts[freeIdx] = {
            ...nextCourts[freeIdx],
            teamA: [...(chal.teamA || [])],
            teamB: [...(chal.teamB || [])],
            challengeId: chal.id,
            tag: 'CHALLENGE',
          }
          return { ...r, courts: nextCourts }
        }
        return r
      })

      return scheduled ? { ...prev, rounds: nextRounds } : prev
    })
  }

  const handleViewRound = (roundIndex) => {
    setHighlightRoundIndex(roundIndex)
    setTimeout(() => {
      const el = document.getElementById(
        viewMode === 'grid' ? `planner-round-${roundIndex}` : `planner-tl-${roundIndex}`
      )
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
    setTimeout(() => {
      setHighlightRoundIndex(null)
    }, 2400)
  }

  const handleSaveWish = (newWish) => {
    setPlan((prev) => ({
      ...prev,
      wishes: [...(prev.wishes || []), newWish],
    }))
  }

  // Khung giờ hiển thị
  const startStr = plan.rounds?.[0]?.time || '19:00'
  const endStr = plan.rounds?.[plan.rounds.length - 1]?.time || '22:00'

  return (
    <div
      style={{
        ...S.mainCard,
        ...(isFullscreen ? S.fullscreenWrap : {}),
      }}
    >
      {/* 1. Header điều khiển */}
      <PlannerHeader
        session={s}
        viewMode={viewMode}
        onSetViewMode={setViewMode}
        onAutoPlan={handleAutoPlan}
        onReset={handleReset}
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSavePlan}
        onRevert={handleRevertPlan}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        roundsCount={plan.rounds.length}
        courtsCount={plan.rounds[0]?.courts?.length || 2}
        playersCount={players.length}
        startTime={startStr}
        endTime={endStr}
      />

      {/* 2. Thân 3 cột theo chuẩn concept Màn 1a / 1b */}
      <div style={S.body3Cols}>
        {/* Cột 1: Người & tải trận (232px) */}
        <PlannerPlayerCol
          players={players}
          loads={loads}
          attendance={db.attendance?.[s.id] || {}}
          challenges={challenges}
          wishes={plan.wishes || []}
        />

        {/* Cột 2: Màn 1a Bảng vòng HOẶC Màn 1b Dòng thời gian */}
        {viewMode === 'grid' ? (
          <PlannerGridCol
            rounds={plan.rounds}
            players={players}
            ratingsMap={ratingsMap}
            highlightRoundIndex={highlightRoundIndex}
            onDropPlayer={handleDropPlayer}
            onClearCourt={handleClearCourt}
            onAddRound={handleAddRound}
          />
        ) : (
          <PlannerTimelineCol
            rounds={plan.rounds}
            players={players}
            highlightRoundIndex={highlightRoundIndex}
            onDropPlayer={handleDropPlayer}
          />
        )}

        {/* Cột 3: Kèo & Nguyện vọng, Sức khoẻ kế hoạch, Cảnh báo (284px) */}
        <PlannerHealthCol
          rounds={plan.rounds}
          challenges={challenges}
          wishes={plan.wishes || []}
          players={players}
          ratingsMap={ratingsMap}
          onScheduleChallenge={handleScheduleChallenge}
          onViewRound={handleViewRound}
          onOpenAddWish={() => setShowAddWish(true)}
        />
      </div>

      {/* Modal thêm nguyện vọng */}
      <PlannerAddWishDialog
        isOpen={showAddWish}
        onClose={() => setShowAddWish(false)}
        onSaveWish={handleSaveWish}
        players={players}
      />
    </div>
  )
}

const S = {
  mainCard: {
    height: 790,
    minHeight: 640,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: '#0B1220',
    border: '1px solid #22304A',
    borderRadius: 12,
    boxShadow: '0 20px 44px rgba(0,0,0,0.5)',
    margin: '4px 0 20px',
    maxWidth: '100%',
  },
  fullscreenWrap: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 9999,
    borderRadius: 0,
    border: 'none',
    margin: 0,
  },
  body3Cols: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    overflow: 'hidden',
  },
}
