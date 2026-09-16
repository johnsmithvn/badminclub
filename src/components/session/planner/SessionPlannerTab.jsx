import { useState, useMemo, useEffect } from 'react'
import { useApp } from '#contexts/AppContext.jsx'
import { getPlayerRating, DEFAULT_RATING } from '#lib/rating.js'
import {
  createDefaultPlan,
  calcPlayerLoads,
  autoGeneratePlan,
  getSessionPlannerPlayers,
  getSessionTimeRange,
  updatePlanRoundMinutes,
  addPlanRound,
  removePlanRound,
  validateChallengeAttendance,
  validateWishAttendance,
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
import PlannerAutoModal from './PlannerAutoModal.jsx'

export default function SessionPlannerTab({ s: sProp, session: sessionProp, challenges: chalProp }) {
  const s = sProp || sessionProp
  const { db, a } = useApp()

  // 1. Danh sách kèo đấu thực tế trong CLB
  const challenges = useMemo(() => {
    if (Array.isArray(chalProp) && chalProp.length > 0) return chalProp
    return (db.challenges || []).filter(
      (c) => (c.sessionId === s.id || !c.sessionId) && c.status !== 'cancelled' && c.status !== 'played'
    )
  }, [db.challenges, s.id, chalProp])

  // Khung giờ thực tế của các sân trong buổi
  const sessionTime = useMemo(() => getSessionTimeRange(s, db.schedules), [s, db.schedules])

  // 2. Kế hoạch buổi (lấy từ s.planner hoặc khởi tạo mặc định)
  const [plan, setPlan] = useState(() => {
    if (s.planner && Array.isArray(s.planner.rounds) && s.planner.rounds.length > 0) {
      return s.planner
    }
    const courtsList = (s.courts || []).filter((c) => !c.sold)
    return createDefaultPlan(
      s,
      [],
      DEFAULT_ROUND_MINUTES,
      courtsList.length > 0 ? courtsList : null,
      db
    )
  })

  // 3. Danh sách người tham gia buổi toàn diện (cả thành viên nhóm, khách mời và người trong kèo)
  const players = useMemo(() => {
    return getSessionPlannerPlayers(db, s, challenges, plan)
  }, [db, s, challenges, plan])

  // 4. Map rating cho từng người
  const ratingsMap = useMemo(() => {
    const map = {}
    players.forEach((p) => {
      const pr = getPlayerRating(db.playerRatings, p.key, p, db.levels)
      map[p.key] = pr.effectiveStrength ?? pr.rating ?? DEFAULT_RATING
    })
    return map
  }, [players, db.playerRatings, db.levels])

  // Bản kế hoạch đã lưu gần nhất (dưới DB) để theo dõi isDirty và hỗ trợ khôi phục (revert)
  const [lastSavedPlan, setLastSavedPlan] = useState(() => {
    if (s.planner && Array.isArray(s.planner.rounds) && s.planner.rounds.length > 0) {
      return s.planner
    }
    return null
  })

  // Đồng bộ khi s.planner thay đổi từ bên ngoài (ví dụ sau khi sync DB xong)
  const [prevPlanner, setPrevPlanner] = useState(s.planner)
  if (s.planner !== prevPlanner) {
    setPrevPlanner(s.planner)
    if (s.planner && Array.isArray(s.planner.rounds) && s.planner.rounds.length > 0 && !lastSavedPlan) {
      setLastSavedPlan(s.planner)
    }
  }

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
          const fresh = createDefaultPlan(s, players, DEFAULT_ROUND_MINUTES, null, db)
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
  const [showAutoModal, setShowAutoModal] = useState(false)

  // 9. Thống kê tải trận
  const loads = useMemo(() => calcPlayerLoads(plan.rounds, players), [plan.rounds, players])

  // 10. Các tác vụ thao tác kế hoạch
  const handleAutoPlan = () => {
    setShowAutoModal(true)
  }

  const handleRunAutoPlan = ({ mode, strategy, splitHalf, selectedChallengeIds, selectedWishIds }) => {
    const activeCourts = (s.courts || []).filter((c) => !c.sold)
    const courtsList = activeCourts.length > 0 ? activeCourts : (s.courts || [0, 1])
    const att = db.attendance?.[s.id] || {}
    const newRounds = autoGeneratePlan({
      existingRounds: plan.rounds,
      mode,
      strategy,
      splitHalf,
      selectedChallengeIds,
      selectedWishIds,
      attendance: att,
      players,
      courts: courtsList,
      challenges,
      wishes: plan.wishes || [],
      startTime: sessionTime?.startTime || '19:00',
      roundMinutes: plan.roundMinutes || DEFAULT_ROUND_MINUTES,
      totalRounds: plan.rounds?.length || DEFAULT_TOTAL_ROUNDS,
      ratingsMap,
    })
    setPlan((prev) => ({ ...prev, rounds: newRounds }))

    const rep = newRounds.report
    if (rep) {
      const schedText = t('planner.autoPlanReportSuccess', {
        challenges: rep.scheduledChallengesCount,
        wishes: rep.scheduledWishesCount,
      })
      const unplacedTotal = rep.unplacedChallengesCount + rep.unplacedWishesCount
      if (unplacedTotal > 0) {
        const warnText = t('planner.autoPlanReportUnplaced', { n: unplacedTotal })
        a.toast(`${schedText}. ⚠️ ${warnText}`, { tone: 'warning' })
      } else {
        a.toast(schedText)
      }
    } else {
      a.toast(t('planner.autoPlanDone', { rounds: newRounds.length }))
    }
  }

  const handleReset = () => {
    a.confirm({
      title: t('planner.reset'),
      message: t('planner.resetConfirm'),
      tone: 'danger',
      onConfirm: () => {
        const fresh = createDefaultPlan(s, players, plan.roundMinutes || DEFAULT_ROUND_MINUTES, null, db)
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
    const activeCourts = (s.courts || []).filter((c) => !c.sold)
    const courtsList = activeCourts.length > 0 ? activeCourts : (s.courts || [0, 1])
    setPlan((prev) => addPlanRound(prev, courtsList, prev.roundMinutes || DEFAULT_ROUND_MINUTES, sessionTime?.startTime || '19:00'))
  }

  const handleRemoveRound = () => {
    setPlan((prev) => removePlanRound(prev))
  }

  const handleChangeRoundMinutes = (newMinutes) => {
    setPlan((prev) => updatePlanRoundMinutes(prev, newMinutes, sessionTime?.startTime || '19:00'))
  }

  // Di chuyển hoặc hoán đổi nguyên cả trận đấu giữa các vòng/sân
  const handleMoveMatch = (sourceRound, sourceCourt, targetRound, targetCourt) => {
    if (sourceRound === targetRound && sourceCourt === targetCourt) return

    setPlan((prev) => {
      const srcR = prev.rounds.find((r) => r.roundIndex === sourceRound)
      const tgtR = prev.rounds.find((r) => r.roundIndex === targetRound)
      if (!srcR || !tgtR) return prev

      const srcCourt = srcR.courts[sourceCourt]
      const tgtCourt = tgtR.courts[targetCourt]
      if (!srcCourt || !tgtCourt) return prev

      const nextRounds = prev.rounds.map((r) => {
        if (r.roundIndex !== sourceRound && r.roundIndex !== targetRound) return r

        const nextCourts = [...r.courts]
        if (sourceRound === targetRound) {
          // Cùng 1 vòng nhưng đổi sân
          nextCourts[sourceCourt] = {
            ...srcCourt,
            teamA: [...(tgtCourt.teamA || [])],
            teamB: [...(tgtCourt.teamB || [])],
            challengeId: tgtCourt.challengeId || null,
            wishId: tgtCourt.wishId || null,
            tag: tgtCourt.tag || null,
            bestOf: tgtCourt.bestOf || null,
            bo3Part: tgtCourt.bo3Part || null,
          }
          nextCourts[targetCourt] = {
            ...tgtCourt,
            teamA: [...(srcCourt.teamA || [])],
            teamB: [...(srcCourt.teamB || [])],
            challengeId: srcCourt.challengeId || null,
            wishId: srcCourt.wishId || null,
            tag: srcCourt.tag || null,
            bestOf: srcCourt.bestOf || null,
            bo3Part: srcCourt.bo3Part || null,
          }
        } else if (r.roundIndex === sourceRound) {
          nextCourts[sourceCourt] = {
            ...srcCourt,
            teamA: [...(tgtCourt.teamA || [])],
            teamB: [...(tgtCourt.teamB || [])],
            challengeId: tgtCourt.challengeId || null,
            wishId: tgtCourt.wishId || null,
            tag: tgtCourt.tag || null,
            bestOf: tgtCourt.bestOf || null,
            bo3Part: tgtCourt.bo3Part || null,
          }
        } else if (r.roundIndex === targetRound) {
          nextCourts[targetCourt] = {
            ...tgtCourt,
            teamA: [...(srcCourt.teamA || [])],
            teamB: [...(srcCourt.teamB || [])],
            challengeId: srcCourt.challengeId || null,
            wishId: srcCourt.wishId || null,
            tag: srcCourt.tag || null,
            bestOf: srcCourt.bestOf || null,
            bo3Part: srcCourt.bo3Part || null,
          }
        }
        return { ...r, courts: nextCourts }
      })

      return { ...prev, rounds: nextRounds }
    })
  }

  const handleScheduleChallenge = (challengeId) => {
    const chal = challenges.find((c) => c.id === challengeId)
    if (!chal) return

    const chalCheck = validateChallengeAttendance(chal, db.attendance?.[s.id] || {}, players, db)
    if (!chalCheck.valid) {
      a.toast(t('planner.chalAbsentCantSchedule', { names: chalCheck.absentNames.join(', ') }), { tone: 'danger' })
      return
    }

    const isBo3 = chal.bestOf === 3 || chal.best_of === 3

    setPlan((prev) => {
      let scheduled = false
      const teamKeys = [...(chal.teamA || []), ...(chal.teamB || [])]

      const nextRounds = prev.rounds.map((r, rIdx) => {
        if (scheduled) return r

        if (isBo3) {
          const r2 = prev.rounds[rIdx + 1]
          if (!r2) return r

          const isBusyR1 = (r.courts || []).some((court) =>
            [...(court.teamA || []), ...(court.teamB || [])].some((k) => teamKeys.includes(k))
          )
          const isBusyR2 = (r2.courts || []).some((court) =>
            [...(court.teamA || []), ...(court.teamB || [])].some((k) => teamKeys.includes(k))
          )
          if (isBusyR1 || isBusyR2) return r

          const freeIdx = (r.courts || []).findIndex(
            (court, ci) =>
              (court.teamA?.length || 0) === 0 &&
              (court.teamB?.length || 0) === 0 &&
              (r2.courts?.[ci]?.teamA?.length || 0) === 0 &&
              (r2.courts?.[ci]?.teamB?.length || 0) === 0
          )
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
              bestOf: 3,
              bo3Part: 1,
            }
            return { ...r, courts: nextCourts }
          }
          return r
        } else {
          const isBusy = (r.courts || []).some((court) =>
            [...(court.teamA || []), ...(court.teamB || [])].some((k) => teamKeys.includes(k))
          )
          if (isBusy) return r

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
        }
      })

      if (scheduled && isBo3) {
        for (let ri = 0; ri < nextRounds.length - 1; ri++) {
          const ci = (nextRounds[ri].courts || []).findIndex((court) => court.challengeId === chal.id && court.bo3Part === 1)
          if (ci >= 0 && nextRounds[ri + 1]?.courts?.[ci]) {
            const nextC = [...nextRounds[ri + 1].courts]
            nextC[ci] = {
              ...nextC[ci],
              teamA: [...(chal.teamA || [])],
              teamB: [...(chal.teamB || [])],
              challengeId: chal.id,
              tag: 'CHALLENGE',
              bestOf: 3,
              bo3Part: 2,
            }
            nextRounds[ri + 1] = { ...nextRounds[ri + 1], courts: nextC }
            break
          }
        }
      }

      if (!scheduled) {
        a.toast(t('planner.wishNoSlotFound'), { tone: 'warning' })
      }

      return scheduled ? { ...prev, rounds: nextRounds } : prev
    })
  }

  const handleScheduleWish = (wishId) => {
    const wish = (plan.wishes || []).find((w) => w.id === wishId)
    if (!wish) return

    const wishCheck = validateWishAttendance(wish, db.attendance?.[s.id] || {}, players, db)
    if (!wishCheck.valid) {
      a.toast(t('planner.wishAbsentCantSchedule', { names: wishCheck.absentNames.join(', ') }), { tone: 'danger' })
      return
    }

    setPlan((prev) => {
      let scheduled = false
      const wishKeys = [wish.memberId, wish.targetId].filter(Boolean)

      const nextRounds = prev.rounds.map((r) => {
        if (scheduled) return r

        // Kiểm tra xem 2 người có ai đã đánh trong vòng này chưa
        const isBusy = (r.courts || []).some((court) =>
          [...(court.teamA || []), ...(court.teamB || [])].some((k) => wishKeys.includes(k))
        )
        if (isBusy) return r

        // Tìm sân trống
        const freeIdx = r.courts.findIndex((c) => c.teamA.length === 0 && c.teamB.length === 0)
        if (freeIdx >= 0) {
          scheduled = true
          handleViewRound(r.roundIndex)
          const nextCourts = [...r.courts]
          const isOpponent = wish.type === 'opponent'
          nextCourts[freeIdx] = {
            ...nextCourts[freeIdx],
            teamA: isOpponent ? [wish.memberId] : [...wishKeys],
            teamB: isOpponent ? [wish.targetId] : [],
            wishId: wish.id,
            tag: 'WISH',
          }
          return { ...r, courts: nextCourts }
        }
        return r
      })

      if (!scheduled) {
        a.toast(t('planner.wishNoSlotFound'), { tone: 'warning' })
      }

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

  // Khung giờ hiển thị (ưu tiên giờ sân thực tế)
  const startStr = sessionTime?.startTime || plan.rounds?.[0]?.time || '19:00'
  const endStr = sessionTime?.endTime || plan.rounds?.[plan.rounds.length - 1]?.time || '21:00'
  const courtsCount = plan.rounds?.[0]?.courts?.length || (s.courts || []).filter((c) => !c.sold).length || 2

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
        courtsCount={courtsCount}
        playersCount={players.length}
        startTime={startStr}
        endTime={endStr}
        roundMinutes={plan.roundMinutes || DEFAULT_ROUND_MINUTES}
        onChangeRoundMinutes={handleChangeRoundMinutes}
        onAddRound={handleAddRound}
        onRemoveRound={handleRemoveRound}
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
            db={db}
            rounds={plan.rounds}
            players={players}
            ratingsMap={ratingsMap}
            highlightRoundIndex={highlightRoundIndex}
            onDropPlayer={handleDropPlayer}
            onMoveMatch={handleMoveMatch}
            onClearCourt={handleClearCourt}
            onAddRound={handleAddRound}
          />
        ) : (
          <PlannerTimelineCol
            db={db}
            rounds={plan.rounds}
            players={players}
            highlightRoundIndex={highlightRoundIndex}
            onDropPlayer={handleDropPlayer}
          />
        )}

        {/* Cột 3: Kèo & Nguyện vọng, Sức khoẻ kế hoạch, Cảnh báo (284px) */}
        <PlannerHealthCol
          db={db}
          rounds={plan.rounds}
          challenges={challenges}
          wishes={plan.wishes || []}
          players={players}
          ratingsMap={ratingsMap}
          attendance={db.attendance?.[s.id] || {}}
          onScheduleChallenge={handleScheduleChallenge}
          onScheduleWish={handleScheduleWish}
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

      {/* Modal tuỳ chọn tự động lập kế hoạch */}
      <PlannerAutoModal
        isOpen={showAutoModal}
        onClose={() => setShowAutoModal(false)}
        onSubmit={handleRunAutoPlan}
        courtsCount={courtsCount}
        roundsCount={plan.rounds?.length || 0}
        playersCount={players.length}
        challenges={challenges}
        wishes={plan.wishes || []}
        attendance={db.attendance?.[s.id] || {}}
        players={players}
        db={db}
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
