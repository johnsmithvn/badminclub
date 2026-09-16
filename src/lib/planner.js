// Planner buổi chơi: tính toán vòng đấu, tải trận, sức khoẻ kế hoạch, cảnh báo và tự động lập.
// Hàm thuần: nhận dữ liệu, trả dữ liệu mới, không setState, không đụng DOM hay React.

import { detailedCourtBalance } from '#lib/assign.js'
import { sessionMembers, isPresent, sGuests, levelOf, playerName, playerOf } from '#lib/money.js'
import { monthOf } from '#utils/dates.js'
import { t } from '#i18n'

export const DEFAULT_ROUND_MINUTES = 18
export const DEFAULT_TOTAL_ROUNDS = 10

/**
 * Tính mốc giờ bắt đầu và kết thúc của từng vòng.
 * @param {string} startTime - Giờ bắt đầu dạng 'HH:MM' (ví dụ '19:00')
 * @param {number} roundMinutes - Số phút mỗi vòng (mặc định 18)
 * @param {number} totalRounds - Tổng số vòng (mặc định 10)
 * @returns {Array<{ roundIndex: number, label: string, time: string, timeRange: string, startMin: number, endMin: number }>}
 */
export function calcRoundTimes(startTime = '19:00', roundMinutes = DEFAULT_ROUND_MINUTES, totalRounds = DEFAULT_TOTAL_ROUNDS) {
  const parts = String(startTime || '19:00').split(':')
  const startHour = parseInt(parts[0], 10) || 19
  const startMinute = parseInt(parts[1], 10) || 0
  const baseMinutes = startHour * 60 + startMinute

  const fmt = (min) => {
    const h = Math.floor(min / 60) % 24
    const m = min % 60
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0')
  }

  const out = []
  for (let r = 0; r < totalRounds; r++) {
    const sMin = baseMinutes + r * roundMinutes
    const eMin = sMin + roundMinutes
    out.push({
      roundIndex: r,
      label: 'R' + (r + 1),
      time: fmt(sMin),
      timeRange: fmt(sMin) + ' → ' + fmt(eMin),
      startMin: sMin,
      endMin: eMin,
    })
  }
  return out
}

/**
 * Lấy khung giờ bắt đầu, kết thúc và tổng số phút của các sân thực tế trong buổi.
 * @param {Object} session - Buổi chơi
 * @returns {{ startTime: string, endTime: string, totalMinutes: number }}
 */
export function getSessionTimeRange(session) {
  const courts = (session?.courts || []).filter((c) => !c.sold)
  const validCourts = courts.length > 0 ? courts : (session?.courts || [])
  const froms = validCourts.map((c) => c.from).filter(Boolean).sort()
  const tos = validCourts.map((c) => c.to).filter(Boolean).sort().reverse()
  const startTime = froms[0] || '19:00'
  const endTime = tos[0] || '21:00'

  const [sh, sm] = startTime.split(':').map((v) => parseInt(v, 10) || 0)
  const [eh, em] = endTime.split(':').map((v) => parseInt(v, 10) || 0)
  let totalMinutes = (eh * 60 + em) - (sh * 60 + sm)
  if (totalMinutes <= 0) totalMinutes += 24 * 60

  return { startTime, endTime, totalMinutes }
}

/**
 * Khởi tạo cấu trúc kế hoạch mặc định từ session.
 * @param {Object} session - Buổi tập
 * @param {Array} players - Danh sách người chơi
 * @param {number} roundMinutes - Số phút mỗi vòng
 * @param {number|null} totalRounds - Tổng số vòng (null = tự tính theo giờ sân)
 * @param {Object|null} db - Cơ sở dữ liệu CLB để lấy tên sân
 * @returns {Object} Kế hoạch rỗng chuẩn hoá
 */
export function createDefaultPlan(session, players = [], roundMinutes = DEFAULT_ROUND_MINUTES, totalRounds = null, db = null) {
  const activeCourts = (session?.courts || []).filter((c) => !c.sold)
  const courtsList = activeCourts.length > 0 ? activeCourts : (session?.courts || [])
  const courts = courtsList.length > 0
    ? courtsList.map((c, idx) => {
        let name = c.courtLabel || null
        if (!name && c.courtId && db) {
          const found = (db.courts || []).find((x) => x.id === c.courtId)
          if (found?.name) name = found.name
        }
        return {
          courtIndex: idx,
          courtId: c.courtId || null,
          name,
        }
      })
    : [{ courtIndex: 0, courtId: null, name: null }, { courtIndex: 1, courtId: null, name: null }]

  const { startTime, totalMinutes } = getSessionTimeRange(session)
  const calculatedRounds = Math.max(1, Math.floor(totalMinutes / roundMinutes))
  const numRounds = totalRounds || calculatedRounds

  const times = calcRoundTimes(startTime, roundMinutes, numRounds)

  const rounds = times.map((t) => ({
    roundIndex: t.roundIndex,
    label: t.label,
    time: t.time,
    timeRange: t.timeRange,
    courts: courts.map((c) => ({
      courtIndex: c.courtIndex,
      courtId: c.courtId || null,
      name: c.name,
      teamA: [],
      teamB: [],
      challengeId: null,
      wishId: null,
      tag: null,
    })),
  }))

  return {
    roundMinutes,
    totalRounds: numRounds,
    rounds,
    wishes: [],
  }
}

/**
 * Cập nhật mốc giờ các vòng khi thay đổi số phút mỗi trận.
 */
export function updatePlanRoundMinutes(plan, newMinutes, startTime = '19:00') {
  if (!plan) return plan
  const numRounds = plan.rounds?.length || DEFAULT_TOTAL_ROUNDS
  const times = calcRoundTimes(startTime, newMinutes, numRounds)
  const nextRounds = (plan.rounds || []).map((r, i) => {
    const t = times[i]
    return {
      ...r,
      time: t ? t.time : r.time,
      timeRange: t ? t.timeRange : r.timeRange,
    }
  })
  return {
    ...plan,
    roundMinutes: newMinutes,
    rounds: nextRounds,
  }
}

/**
 * Thêm 1 vòng đấu vào cuối kế hoạch.
 */
export function addPlanRound(plan, courts = [0, 1], roundMinutes = DEFAULT_ROUND_MINUTES, startTime = '19:00') {
  if (!plan) return plan
  const currentRounds = plan.rounds || []
  const nextIdx = currentRounds.length
  const mins = plan.roundMinutes || roundMinutes
  const times = calcRoundTimes(startTime, mins, nextIdx + 1)
  const t = times[nextIdx]

  const defaultCourts = courts.map((c, idx) => ({
    courtIndex: idx,
    courtId: c?.courtId || null,
    name: c?.name || c?.courtLabel || null,
    teamA: [],
    teamB: [],
    challengeId: null,
    wishId: null,
    tag: null,
  }))

  const newRound = {
    roundIndex: nextIdx,
    label: t ? t.label : 'R' + (nextIdx + 1),
    time: t ? t.time : '',
    timeRange: t ? t.timeRange : '',
    courts: defaultCourts,
  }

  return {
    ...plan,
    rounds: [...currentRounds, newRound],
  }
}

/**
 * Bớt 1 vòng đấu ở cuối kế hoạch (tối thiểu giữ 1 vòng).
 */
export function removePlanRound(plan) {
  if (!plan || !plan.rounds || plan.rounds.length <= 1) return plan
  return {
    ...plan,
    rounds: plan.rounds.slice(0, -1),
  }
}

/**
 * Tính tải trận của từng người chơi theo toàn bộ kế hoạch.
 * @param {Array} rounds - Danh sách các vòng
 * @param {Array} players - Danh sách người tham gia
 * @returns {Object} Map { [playerKey]: { count: number, consecutiveMax: number, rounds: number[], loadState: 'overload'|'underload'|'balanced' } }
 */
export function calcPlayerLoads(rounds = [], players = []) {
  const loads = {}
  ;(players || []).forEach((p) => {
    const k = p.key || p.id
    if (k) {
      loads[k] = {
        count: 0,
        consecutiveMax: 0,
        rounds: [],
        loadState: 'balanced',
      }
    }
  })

  // Đếm sự xuất hiện của từng người trong các vòng
  rounds.forEach((r) => {
    const placedThisRound = new Set()
    ;(r.courts || []).forEach((c) => {
      ;(c.teamA || []).forEach((k) => { if (k) placedThisRound.add(k) })
      ;(c.teamB || []).forEach((k) => { if (k) placedThisRound.add(k) })
    })

    placedThisRound.forEach((k) => {
      if (!loads[k]) {
        loads[k] = { count: 0, consecutiveMax: 0, rounds: [], loadState: 'balanced' }
      }
      loads[k].count++
      loads[k].rounds.push(r.roundIndex)
    })
  })

  // Tính số vòng đánh liên tiếp tối đa và trạng thái tải
  Object.keys(loads).forEach((k) => {
    const rList = loads[k].rounds.sort((a, b) => a - b)
    let curConsecutive = 0
    let maxConsecutive = 0
    for (let i = 0; i < rList.length; i++) {
      if (i === 0 || rList[i] === rList[i - 1] + 1) {
        curConsecutive++
      } else {
        curConsecutive = 1
      }
      if (curConsecutive > maxConsecutive) maxConsecutive = curConsecutive
    }
    loads[k].consecutiveMax = maxConsecutive

    // Ngưỡng: >= 7 trận là quá tải, <= 3 là quá ít (đối với buổi 10 vòng)
    if (loads[k].count >= 7) {
      loads[k].loadState = 'overload'
    } else if (loads[k].count <= 3 && loads[k].count > 0) {
      loads[k].loadState = 'underload'
    } else {
      loads[k].loadState = 'balanced'
    }
  })

  return loads
}

/**
 * Tính điểm cân bằng cho 1 ô trận trên kế hoạch.
 * @param {Array} teamA - Mảng key đấu thủ đội A
 * @param {Array} teamB - Mảng key đấu thủ đội B
 * @param {Object} ratingsMap - Map playerKey -> rating
 * @returns {number|null} Điểm cân bằng 0..100 hoặc null nếu chưa đủ 4 người
 */
export function calcCourtBalanceScore(teamA = [], teamB = [], ratingsMap = {}) {
  if (!teamA || !teamB || teamA.length !== 2 || teamB.length !== 2) {
    return null
  }
  const lineup = {
    c0t0s0: teamA[0],
    c0t0s1: teamA[1],
    c0t1s0: teamB[0],
    c0t1s1: teamB[1],
  }
  const bal = detailedCourtBalance({
    lineup,
    ci: 0,
    ratingsMap,
    matches: [],
  })
  return bal ? bal.totalScore : null
}

/**
 * Tính toán 4 chỉ số sức khoẻ của kế hoạch.
 * @param {Array} rounds - Danh sách các vòng
 * @param {Array} challenges - Danh sách kèo đấu
 * @param {Array} wishes - Danh sách nguyện vọng
 * @param {Array} players - Danh sách người chơi
 * @param {Object} ratingsMap - Map ID -> rating
 * @returns {Object}
 */
export function calcPlanHealth(rounds = [], challenges = [], wishes = [], players = [], ratingsMap = {}) {
  const loads = calcPlayerLoads(rounds, players)
  const activeKeys = Object.keys(loads).filter((k) => loads[k].count > 0)
  const loadCounts = activeKeys.map((k) => loads[k].count)

  const minLoad = loadCounts.length > 0 ? Math.min(...loadCounts) : 0
  const maxLoad = loadCounts.length > 0 ? Math.max(...loadCounts) : 0
  const loadGap = maxLoad - minLoad

  // Đếm kèo và nguyện vọng đã xếp
  const placedChallengeIds = new Set()
  const placedWishIds = new Set()
  let incompleteCourts = 0
  const balanceScores = []

  rounds.forEach((r) => {
    ;(r.courts || []).forEach((c) => {
      if (c.challengeId) placedChallengeIds.add(c.challengeId)
      if (c.wishId) placedWishIds.add(c.wishId)

      const count = (c.teamA?.length || 0) + (c.teamB?.length || 0)
      if (count > 0 && count < 4) {
        incompleteCourts++
      } else if (count === 4) {
        const score = calcCourtBalanceScore(c.teamA, c.teamB, ratingsMap)
        if (score != null) balanceScores.push(score)
      }
    })
  })

  const totalReqs = (challenges?.length || 0) + (wishes?.length || 0)
  const fulfilledReqs = placedChallengeIds.size + placedWishIds.size

  const avgBalance = balanceScores.length > 0
    ? Math.round(balanceScores.reduce((sum, v) => sum + v, 0) / balanceScores.length)
    : 85

  return {
    fulfilledReqs,
    totalReqs,
    minLoad,
    maxLoad,
    loadGap,
    avgBalance,
    incompleteCourts,
  }
}

/**
 * Phát hiện danh sách các vấn đề / cảnh báo cần xử lý trong kế hoạch.
 * @param {Array} rounds - Danh sách các vòng
 * @param {Array} players - Danh sách người chơi
 * @param {Array} challenges - Danh sách kèo đấu
 * @param {Array} wishes - Danh sách nguyện vọng
 * @returns {Array<Object>} Danh sách issue
 */
export function detectPlanIssues(rounds = [], players = [], challenges = [], wishes = []) {
  const issues = []
  const pMap = {}
  ;(players || []).forEach((p) => { pMap[p.key || p.id] = p })

  // 1. Quét các ô trận thiếu người
  rounds.forEach((r) => {
    const placedInRound = new Set()
    ;(r.courts || []).forEach((c) => {
      ;(c.teamA || []).forEach((k) => placedInRound.add(k))
      ;(c.teamB || []).forEach((k) => placedInRound.add(k))
    })
    const freeCount = players.filter((p) => !placedInRound.has(p.key || p.id)).length

    ;(r.courts || []).forEach((c, cIdx) => {
      const totalPlaced = (c.teamA?.length || 0) + (c.teamB?.length || 0)
      if (totalPlaced > 0 && totalPlaced < 4) {
        const missing = 4 - totalPlaced
        issues.push({
          id: `missing-${r.roundIndex}-${cIdx}`,
          type: 'missing_players',
          severity: 'danger',
          roundIndex: r.roundIndex,
          courtIndex: cIdx,
          roundNum: r.roundIndex + 1,
          courtNum: cIdx + 1,
          totalPlaced,
          missing,
          freeCount,
        })
      }
    })
  })

  // 2. Quét chênh lệch tải trận quá lớn
  const loads = calcPlayerLoads(rounds, players)
  const activeKeys = Object.keys(loads).filter((k) => loads[k].count > 0)
  if (activeKeys.length > 0) {
    const counts = activeKeys.map((k) => loads[k].count)
    const min = Math.min(...counts)
    const max = Math.max(...counts)
    if (max - min >= 3) {
      const topNames = activeKeys.filter((k) => loads[k].count === max).map((k) => pMap[k]?.name || k).slice(0, 2).join(', ')
      const lowNames = activeKeys.filter((k) => loads[k].count === min).map((k) => pMap[k]?.name || k).slice(0, 2).join(', ')
      issues.push({
        id: 'load-skew',
        type: 'load_skew',
        severity: 'warning',
        lowNames,
        topNames,
        min,
        max,
      })
    }
  }

  // 3. Quét người đánh 3 vòng liên tiếp
  Object.keys(loads).forEach((k) => {
    if (loads[k].consecutiveMax >= 3) {
      const name = pMap[k]?.name || k
      issues.push({
        id: `consecutive-${k}`,
        type: 'consecutive_rounds',
        severity: 'warning',
        name,
        count: loads[k].consecutiveMax,
      })
    }
  })

  // 4. Quét nguyện vọng chưa được xếp
  ;(wishes || []).forEach((w) => {
    let placed = false
    rounds.forEach((r) => {
      ;(r.courts || []).forEach((c) => {
        if (c.wishId === w.id) placed = true
      })
    })
    if (!placed) {
      issues.push({
        id: `wish-${w.id}`,
        type: 'unplaced_wish',
        severity: 'info',
        wishText: w.text || w.title || '',
      })
    }
  })

  return issues
}

/**
 * Kiểm tra xem một người chơi có bị đánh dấu vắng mặt (hoặc nghỉ không báo) trong buổi hay không.
 */
export function isPlayerAbsent(k, attendance = {}) {
  if (!k) return false
  const state = attendance[k]
  return state === false || state === 'noshow'
}

/**
 * Kiểm tra tính hợp lệ về điểm danh của một KÈO ĐẤU:
 * Cả 4 người của đội A và đội B phải có mặt và không bị báo vắng.
 */
export function validateChallengeAttendance(c, attendance = {}, players = [], db = null) {
  const pMap = {}
  ;(players || []).forEach((p) => { pMap[p.key || p.id] = p })

  const teamKeys = [...(c.teamA || []), ...(c.teamB || [])]
  const absentKeys = teamKeys.filter((k) => isPlayerAbsent(k, attendance))
  const absentNames = absentKeys.map((k) => {
    if (pMap[k]?.name) return pMap[k].name
    return resolveSafePlayerName(db, k, k)
  })

  return {
    valid: absentKeys.length === 0,
    hasAbsent: absentKeys.length > 0,
    absentKeys,
    absentNames,
    absentText: absentNames.join(', '),
  }
}

/**
 * Kiểm tra tính hợp lệ về điểm danh của một NGUYỆN VỌNG:
 * Cả người gửi và người được ghép phải có mặt và không bị báo vắng.
 */
export function validateWishAttendance(w, attendance = {}, players = [], db = null) {
  const pMap = {}
  ;(players || []).forEach((p) => { pMap[p.key || p.id] = p })

  const wishKeys = [w.memberId, w.targetId].filter(Boolean)
  const absentKeys = wishKeys.filter((k) => isPlayerAbsent(k, attendance))
  const absentNames = absentKeys.map((k) => {
    if (pMap[k]?.name) return pMap[k].name
    return resolveSafePlayerName(db, k, k)
  })

  return {
    valid: absentKeys.length === 0,
    hasAbsent: absentKeys.length > 0,
    absentKeys,
    absentNames,
    absentText: absentNames.join(', '),
  }
}

/**
 * Thuật toán Tự động lập kế hoạch đa vòng (Multi-Round Auto Scheduler).
 * Hỗ trợ:
 * - mode: 'fill' (chỉ điền ô còn trống, giữ nguyên các trận đã xếp) | 'replace' (làm mới lại toàn bộ).
 * - strategy: 'elo' (cân bằng trình độ) | 'social' (tối đa hoá giao lưu, tránh trùng bạn cặp) | 'gender' (phân loại nam/nữ, ưu tiên đôi nam nữ).
 * - splitHalf: boolean (chia nhóm cố định nửa đầu buổi, trộn chéo nửa sau).
 * - selectedChallengeIds: mảng id kèo được chọn để ưu tiên (nếu null thì lấy tất cả hợp lệ).
 * - selectedWishIds: mảng id nguyện vọng được chọn để ưu tiên (nếu null thì lấy tất cả hợp lệ).
 * - attendance: đối tượng điểm danh của buổi ({ [memberId]: boolean | 'noshow' | 'extra' }).
 *
 * @param {Object} params
 * @param {Array} [params.existingRounds] - Các vòng hiện có (nếu có)
 * @param {string} [params.mode] - 'fill' | 'replace'
 * @param {string} [params.strategy] - 'elo' | 'social' | 'gender'
 * @param {boolean} [params.splitHalf] - Chia nhóm nửa đầu buổi
 * @param {Array} [params.selectedChallengeIds] - Danh sách ID kèo được tick chọn
 * @param {Array} [params.selectedWishIds] - Danh sách ID nguyện vọng được tick chọn
 * @param {Object} [params.attendance] - Trạng thái điểm danh buổi
 * @param {Array} params.players - Danh sách người tham gia
 * @param {Array} params.courts - Danh sách sân
 * @param {Array} params.challenges - Kèo đấu cần ưu tiên xếp
 * @param {Array} params.wishes - Nguyện vọng
 * @param {string} params.startTime - Giờ bắt đầu
 * @param {number} params.roundMinutes - Số phút/vòng
 * @param {number} params.totalRounds - Tổng số vòng
 * @param {Object} params.ratingsMap - Map ID -> rating
 * @returns {Array} rounds mới (kèm thuộc tính report)
 */
export function autoGeneratePlan({
  existingRounds = null,
  mode = existingRounds ? 'fill' : 'replace',
  strategy = 'elo',
  splitHalf = false,
  selectedChallengeIds = null,
  selectedWishIds = null,
  attendance = {},
  players = [],
  courts = [0, 1],
  challenges = [],
  wishes = [],
  startTime = '19:00',
  roundMinutes = DEFAULT_ROUND_MINUTES,
  totalRounds = DEFAULT_TOTAL_ROUNDS,
  ratingsMap = {},
}) {
  const times = calcRoundTimes(startTime, roundMinutes, totalRounds)
  const courtConfigs = Array.isArray(courts) && courts.length > 0
    ? courts.map((c, idx) => ({
        courtIndex: idx,
        courtId: typeof c === 'object' ? (c.courtId || null) : null,
        name: typeof c === 'object' ? (c.name || c.courtLabel || null) : null,
      }))
    : [{ courtIndex: 0, courtId: null, name: null }, { courtIndex: 1, courtId: null, name: null }]
  const pList = (players || []).map((p) => p.key || p.id).filter((k) => Boolean(k) && !isPlayerAbsent(k, attendance))

  if (pList.length < 4) {
    // Không đủ người xếp sân
    const emptyRounds = times.map((t) => ({
      roundIndex: t.roundIndex,
      label: t.label,
      time: t.time,
      timeRange: t.timeRange,
      courts: courtConfigs.map((c) => ({
        courtIndex: c.courtIndex,
        courtId: c.courtId,
        name: c.name,
        teamA: [],
        teamB: [],
        challengeId: null,
        wishId: null,
        tag: null,
      })),
    }))
    emptyRounds.report = {
      scheduledChallengesCount: 0,
      unplacedChallengesCount: 0,
      invalidChallengesCount: 0,
      scheduledWishesCount: 0,
      unplacedWishesCount: 0,
      invalidWishesCount: 0,
      scheduledChallenges: [],
      unplacedChallenges: [],
      scheduledWishes: [],
      unplacedWishes: [],
    }
    return emptyRounds
  }

  // Bản đồ giới tính & thông tin người chơi
  const genderMap = {}
  ;(players || []).forEach((p) => {
    const k = p.key || p.id
    if (k) genderMap[k] = (p.gender === 'nu' || p.gender === 'female') ? 'nu' : 'nam'
  })
  const getG = (k) => genderMap[k] || 'nam'
  const getR = (k) => ratingsMap[k] || 1000
  const pairKey = (a, b) => [a, b].sort().join('__')

  // Báo cáo xếp lịch
  const scheduledChallengeIds = new Set()
  const unplacedChallengeIds = new Set()
  const invalidChallengeIds = new Set()
  const scheduledWishIds = new Set()
  const unplacedWishIds = new Set()
  const invalidWishIds = new Set()

  let rounds
  const isFill = mode === 'fill' && Array.isArray(existingRounds) && existingRounds.length > 0

  if (isFill) {
    // Clone sâu từ existingRounds để giữ nguyên những gì đã xếp
    rounds = existingRounds.map((r, rIdx) => ({
      ...r,
      roundIndex: r.roundIndex !== undefined ? r.roundIndex : rIdx,
      label: r.label || (times[rIdx]?.label || `R${rIdx + 1}`),
      time: r.time || (times[rIdx]?.time || ''),
      timeRange: r.timeRange || (times[rIdx]?.timeRange || ''),
      courts: (r.courts || []).map((c, cIdx) => ({
        ...c,
        courtIndex: c.courtIndex !== undefined ? c.courtIndex : cIdx,
        courtId: c.courtId || courtConfigs[cIdx]?.courtId || null,
        name: c.name || courtConfigs[cIdx]?.name || null,
        teamA: Array.isArray(c.teamA) ? [...c.teamA] : [],
        teamB: Array.isArray(c.teamB) ? [...c.teamB] : [],
      })),
    }))

    // Ghi nhận các kèo/nguyện vọng đã có trong existingRounds
    rounds.forEach((r) => {
      ;(r.courts || []).forEach((c) => {
        if (c.challengeId) scheduledChallengeIds.add(c.challengeId)
        if (c.wishId) scheduledWishIds.add(c.wishId)
      })
    })
  } else {
    // Khởi tạo mảng rounds rỗng
    rounds = times.map((t) => ({
      roundIndex: t.roundIndex,
      label: t.label,
      time: t.time,
      timeRange: t.timeRange,
      courts: courtConfigs.map((c) => ({
        courtIndex: c.courtIndex,
        courtId: c.courtId,
        name: c.name,
        teamA: [],
        teamB: [],
        challengeId: null,
        wishId: null,
        tag: null,
      })),
    }))
  }

  // Xếp KÈO ĐẤU vào các vòng thích hợp (ưu tiên vòng 3, 5, 7...)
  // Kiểm tra tính hợp lệ về điểm danh và lựa chọn của Host
  const eligibleChallenges = (challenges || []).filter((c) => {
    if (Array.isArray(selectedChallengeIds) && !selectedChallengeIds.includes(c.id)) {
      return false
    }
    const val = validateChallengeAttendance(c, attendance, players)
    if (!val.valid) {
      invalidChallengeIds.add(c.id)
      return false
    }
    return c.status === 'accepted' || c.status === 'pending'
  })

  let chalTargetRound = 2
  eligibleChallenges.forEach((c) => {
    if (scheduledChallengeIds.has(c.id)) return

    const tA = (c.teamA || []).filter((k) => pList.includes(k))
    const tB = (c.teamB || []).filter((k) => pList.includes(k))
    let scheduled = false
    if (tA.length === 2 && tB.length === 2) {
      // Duyệt tìm vòng phù hợp: ưu tiên từ chalTargetRound trở đi
      const roundOrder = []
      for (let r = chalTargetRound; r < totalRounds; r++) roundOrder.push(r)
      for (let r = 0; r < chalTargetRound && r < totalRounds; r++) roundOrder.push(r)

      for (const rIdx of roundOrder) {
        const r = rounds[rIdx]
        if (!r) continue
        const alreadyInRound = (r.courts || []).some(
          (court) => [...(court.teamA || []), ...(court.teamB || [])].some((k) => tA.includes(k) || tB.includes(k))
        )
        if (!alreadyInRound) {
          const freeCourt = (r.courts || []).find((court) => (court.teamA?.length || 0) === 0 && (court.teamB?.length || 0) === 0)
          if (freeCourt) {
            freeCourt.teamA = [...tA]
            freeCourt.teamB = [...tB]
            freeCourt.challengeId = c.id
            freeCourt.tag = 'CHALLENGE'
            scheduledChallengeIds.add(c.id)
            chalTargetRound = Math.max(chalTargetRound, rIdx + 2)
            scheduled = true
            break
          }
        }
      }
    }
    if (!scheduled) {
      unplacedChallengeIds.add(c.id)
    }
  })

  // Xếp NGUYỆN VỌNG THÀNH VIÊN (đánh cặp cùng nhau) vào các vòng thích hợp
  const eligibleWishes = (wishes || []).filter((w) => {
    if (Array.isArray(selectedWishIds) && !selectedWishIds.includes(w.id)) {
      return false
    }
    const val = validateWishAttendance(w, attendance, players)
    if (!val.valid) {
      invalidWishIds.add(w.id)
      return false
    }
    return w.type === 'partner' && pList.includes(w.memberId) && pList.includes(w.targetId)
  })

  eligibleWishes.forEach((w) => {
    if (scheduledWishIds.has(w.id)) return

    let placed = false
    for (let rIdx = 0; rIdx < totalRounds; rIdx++) {
      const r = rounds[rIdx]
      if (!r) continue
      const alreadyInRound = (r.courts || []).some(
        (c) => (c.teamA || []).includes(w.memberId) || (c.teamA || []).includes(w.targetId) ||
               (c.teamB || []).includes(w.memberId) || (c.teamB || []).includes(w.targetId)
      )
      if (!alreadyInRound) {
        const freeCourt = (r.courts || []).find((c) => (c.teamA?.length || 0) === 0 && (c.teamB?.length || 0) === 0)
        if (freeCourt) {
          freeCourt.teamA = [w.memberId, w.targetId]
          freeCourt.wishId = w.id
          freeCourt.tag = 'WISH'
          scheduledWishIds.add(w.id)
          placed = true
          break
        }
      }
    }
    if (!placed) {
      unplacedWishIds.add(w.id)
    }
  })

  // Khởi tạo bộ đếm số trận và cặp đôi bạn cặp
  const matchCounts = {}
  const partnerCounts = {}
  pList.forEach((k) => { matchCounts[k] = 0 })

  rounds.forEach((r) => {
    ;(r.courts || []).forEach((c) => {
      ;[...(c.teamA || []), ...(c.teamB || [])].forEach((k) => {
        if (matchCounts[k] !== undefined) matchCounts[k]++
      })
      if (c.teamA?.length === 2) {
        const pk = pairKey(c.teamA[0], c.teamA[1])
        partnerCounts[pk] = (partnerCounts[pk] || 0) + 1
      }
      if (c.teamB?.length === 2) {
        const pk = pairKey(c.teamB[0], c.teamB[1])
        partnerCounts[pk] = (partnerCounts[pk] || 0) + 1
      }
    })
  })

  // Thiết lập phân nhóm nửa đầu buổi (nếu bật splitHalf)
  const canSplit = splitHalf && totalRounds >= 4 && courtConfigs.length >= 2 && pList.length >= 8
  const halfRounds = canSplit ? Math.floor(totalRounds / 2) : 0
  const group0 = canSplit ? pList.filter((_, i) => i % 2 === 0) : []
  const group1 = canSplit ? pList.filter((_, i) => i % 2 !== 0) : []

  // Hàm chấm điểm cách chia cặp dựa theo chiến lược đã chọn
  const scorePairing = (p) => {
    const rA = getR(p.tA[0]) + getR(p.tA[1])
    const rB = getR(p.tB[0]) + getR(p.tB[1])
    const eloDiff = Math.abs(rA - rB)

    if (strategy === 'social') {
      const pkA = pairKey(p.tA[0], p.tA[1])
      const pkB = pairKey(p.tB[0], p.tB[1])
      const repeatPenalty = ((partnerCounts[pkA] || 0) + (partnerCounts[pkB] || 0)) * 500
      return repeatPenalty + eloDiff
    }

    if (strategy === 'gender') {
      const gA = [getG(p.tA[0]), getG(p.tA[1])]
      const gB = [getG(p.tB[0]), getG(p.tB[1])]
      const nuA = gA.filter((g) => g === 'nu').length
      const nuB = gB.filter((g) => g === 'nu').length
      const totalNu = nuA + nuB

      // Nếu có đúng 2 nữ trong 4 người -> bắt buộc mỗi bên 1 nam + 1 nữ (Đôi nam nữ)
      if (totalNu === 2) {
        if (nuA === 1 && nuB === 1) return eloDiff // Hợp lệ, chấm theo elo
        return 5000 + eloDiff // Phạt nặng nếu để 2 nữ cùng 1 đội đấu 2 nam
      }
      // Nếu có 1 nữ -> ưu tiên cân bằng elo
      return eloDiff
    }

    // Mặc định: 'elo'
    return eloDiff
  }

  // Điền từng vòng
  const numRounds = rounds.length
  for (let r = 0; r < numRounds; r++) {
    const round = rounds[r]
    const placedThisRound = new Set()

    // Ghi nhận những người đã có mặt ở vòng này
    ;(round.courts || []).forEach((c) => {
      ;(c.teamA || []).forEach((k) => placedThisRound.add(k))
      ;(c.teamB || []).forEach((k) => placedThisRound.add(k))
    })

    // Điền vào các sân
    for (let ci = 0; ci < round.courts.length; ci++) {
      const court = round.courts[ci]
      const curPlaced = (court.teamA?.length || 0) + (court.teamB?.length || 0)
      if (curPlaced === 4) continue // Đã đủ 4 người, bỏ qua

      // Xác định tập ứng viên theo phân nhóm nửa đầu buổi
      let candidatePool = pList
      if (canSplit && r < halfRounds) {
        const designatedGroup = ci === 0 ? group0 : group1
        const groupAvailable = designatedGroup.filter((k) => !placedThisRound.has(k))
        if (groupAvailable.length >= (4 - curPlaced)) {
          candidatePool = designatedGroup
        }
      }

      // Lấy danh sách người chưa đánh ở vòng này
      const available = candidatePool.filter((k) => !placedThisRound.has(k))
      const needCount = 4 - curPlaced
      if (available.length < needCount) continue

      // Ai vừa đánh ở vòng r - 1 và r - 2
      const playedPrev = r > 0 ? new Set() : new Set()
      const playedPrev2 = r > 1 ? new Set() : new Set()
      if (r > 0 && rounds[r - 1]) {
        ;(rounds[r - 1].courts || []).forEach((c) => {
          ;(c.teamA || []).forEach((k) => playedPrev.add(k))
          ;(c.teamB || []).forEach((k) => playedPrev.add(k))
        })
      }
      if (r > 1 && rounds[r - 2]) {
        ;(rounds[r - 2].courts || []).forEach((c) => {
          ;(c.teamA || []).forEach((k) => playedPrev2.add(k))
          ;(c.teamB || []).forEach((k) => playedPrev2.add(k))
        })
      }

      // Sắp xếp ưu tiên chọn người vào sân
      available.sort((a, b) => {
        // 1. Chống 3 vòng liền
        const consecutiveA = (playedPrev.has(a) && playedPrev2.has(a)) ? 1 : 0
        const consecutiveB = (playedPrev.has(b) && playedPrev2.has(b)) ? 1 : 0
        if (consecutiveA !== consecutiveB) return consecutiveA - consecutiveB

        // 2. Cân bằng tải trận (số trận ít hơn đi trước)
        const diff = matchCounts[a] - matchCounts[b]
        if (diff !== 0) return diff

        // 3. Ưu tiên người vừa nghỉ
        const justPlayedA = playedPrev.has(a) ? 1 : 0
        const justPlayedB = playedPrev.has(b) ? 1 : 0
        if (justPlayedA !== justPlayedB) return justPlayedA - justPlayedB

        // 4. Nếu là gender strategy và có nữ, ưu tiên cân đối số lượng nữ vào sân
        if (strategy === 'gender') {
          const isNuA = getG(a) === 'nu' ? 1 : 0
          const isNuB = getG(b) === 'nu' ? 1 : 0
          if (isNuA !== isNuB) return 0
        }

        return Math.random() - 0.5
      })

      const chosen = available.slice(0, needCount)
      chosen.forEach((k) => {
        placedThisRound.add(k)
        matchCounts[k]++
      })

      if (curPlaced === 0) {
        // Sân hoàn toàn trống -> thử 3 cách ghép cặp và chọn cách tốt nhất
        const pairings = [
          { tA: [chosen[0], chosen[1]], tB: [chosen[2], chosen[3]] },
          { tA: [chosen[0], chosen[2]], tB: [chosen[1], chosen[3]] },
          { tA: [chosen[0], chosen[3]], tB: [chosen[1], chosen[2]] },
        ]
        pairings.sort((p1, p2) => scorePairing(p1) - scorePairing(p2))
        const best = pairings[0]
        court.teamA = best.tA
        court.teamB = best.tB

        const pkA = pairKey(best.tA[0], best.tA[1])
        const pkB = pairKey(best.tB[0], best.tB[1])
        partnerCounts[pkA] = (partnerCounts[pkA] || 0) + 1
        partnerCounts[pkB] = (partnerCounts[pkB] || 0) + 1
      } else {
        // Sân đã có người một phần (fill mode) -> điền vào chỗ thiếu
        let nextA = [...(court.teamA || [])]
        let nextB = [...(court.teamB || [])]
        chosen.forEach((k) => {
          if (nextA.length < 2) nextA.push(k)
          else if (nextB.length < 2) nextB.push(k)
        })
        court.teamA = nextA
        court.teamB = nextB

        if (nextA.length === 2) {
          const pkA = pairKey(nextA[0], nextA[1])
          partnerCounts[pkA] = (partnerCounts[pkA] || 0) + 1
        }
        if (nextB.length === 2) {
          const pkB = pairKey(nextB[0], nextB[1])
          partnerCounts[pkB] = (partnerCounts[pkB] || 0) + 1
        }
      }
    }
  }

  rounds.report = {
    scheduledChallengesCount: scheduledChallengeIds.size,
    unplacedChallengesCount: unplacedChallengeIds.size,
    invalidChallengesCount: invalidChallengeIds.size,
    scheduledWishesCount: scheduledWishIds.size,
    unplacedWishesCount: unplacedWishIds.size,
    invalidWishesCount: invalidWishIds.size,
    scheduledChallenges: Array.from(scheduledChallengeIds),
    unplacedChallenges: Array.from(unplacedChallengeIds),
    invalidChallenges: Array.from(invalidChallengeIds),
    scheduledWishes: Array.from(scheduledWishIds),
    unplacedWishes: Array.from(unplacedWishIds),
    invalidWishes: Array.from(invalidWishIds),
  }

  return rounds
}

function resolveSafePlayerName(db, id, fallback) {
  if (!id) return fallback || ''
  if (db) {
    const n = playerName(db, id)
    if (n && n !== id) return n
    const p = playerOf(db, id)
    if (p?.name && p.name !== id) return p.name
  }
  if (typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(id)) {
    return fallback || t('planner.defaultGuestName')
  }
  return id
}

/**
 * Thu thập danh sách người chơi toàn diện cho Planner của một buổi:
 * - Bao gồm mọi thành viên của nhóm buổi chơi (cả đã điểm danh và chưa điểm danh).
 * - Bao gồm mọi khách giao lưu của buổi (sGuests).
 * - Bao gồm bất kỳ ai có mặt trong các kèo đấu (challenges) hoặc đã được xếp trong các vòng (rounds).
 */
export function getSessionPlannerPlayers(db, s, challenges = [], plan = null) {
  if (!s || !db) return []
  const month = monthOf(s.date)
  const att = db.attendance?.[s.id] || {}
  const seenKeys = new Set()
  const out = []

  // 1. Thành viên của nhóm/buổi (cả có mặt và chưa rõ)
  const mems = sessionMembers(db, s) || []
  mems.forEach((m) => {
    if (m?.id && !seenKeys.has(m.id)) {
      seenKeys.add(m.id)
      out.push({
        key: m.id,
        id: m.id,
        name: m.name || m.fullName || t('planner.defaultMemberName'),
        fullName: m.fullName || m.name || '',
        avatarUrl: m.avatarUrl || m.avatar_url || (m.profile && (m.profile.avatar_url || m.profile.avatarUrl)) || '',
        level: levelOf(m, month) || m.level || 'TB',
        gender: m.gender || 'nam',
        guest: false,
        isAtt: isPresent(att[m.id]),
      })
    }
  })

  // 2. Khách giao lưu của buổi chơi (sGuests)
  const guests = sGuests(db, s.id) || []
  guests.forEach((sg) => {
    const key = sg.guestId || sg.memberId || sg.id
    if (key && !seenKeys.has(key)) {
      seenKeys.add(key)
      if (sg.id) seenKeys.add(sg.id)
      if (sg.guestId) seenKeys.add(sg.guestId)

      const defaultGuest = t('planner.defaultGuestName')
      let name = ''
      if (sg.name && !/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(sg.name)) {
        name = sg.name
      } else if (sg.guestName) {
        name = sg.guestName
      } else if (sg.guest_name) {
        name = sg.guest_name
      } else {
        const fromKey = resolveSafePlayerName(db, key, defaultGuest)
        const fromSgId = resolveSafePlayerName(db, sg.id, defaultGuest)
        name = (fromKey && fromKey !== key && fromKey !== defaultGuest)
          ? fromKey
          : ((fromSgId && fromSgId !== sg.id && fromSgId !== defaultGuest) ? fromSgId : defaultGuest)
      }

      const pObj = playerOf(db, key) || playerOf(db, sg.id)
      const avatarUrl = sg.avatarUrl || sg.avatar_url || pObj?.avatarUrl || pObj?.avatar_url || (pObj?.profile && (pObj?.profile?.avatar_url || pObj?.profile?.avatarUrl)) || ''

      out.push({
        key,
        id: key,
        sgId: sg.id,
        name,
        fullName: name,
        avatarUrl,
        level: sg.level || 'TB',
        gender: sg.gender || 'nam',
        guest: !sg.memberId,
        isAtt: true, // Khách thêm vào buổi coi như có mặt
      })
    }
  })

  // 3. Người chơi trong các Kèo đấu (challenges)
  ;(challenges || []).forEach((c) => {
    ;[...(c.teamA || []), ...(c.teamB || [])].forEach((k) => {
      if (k && !seenKeys.has(k)) {
        seenKeys.add(k)
        const defaultGuest = t('planner.defaultGuestName')
        const name = resolveSafePlayerName(db, k, defaultGuest)
        const pObj = playerOf(db, k)
        const avatarUrl = pObj?.avatarUrl || pObj?.avatar_url || (pObj?.profile && (pObj?.profile?.avatar_url || pObj?.profile?.avatarUrl)) || ''
        out.push({
          key: k,
          id: k,
          name,
          fullName: name,
          avatarUrl,
          level: pObj?.level || 'TB',
          gender: pObj?.gender || 'nam',
          guest: !pObj || !!pObj.guestId || !pObj.role,
          isAtt: isPresent(att[k]),
        })
      }
    })
  })

  // 4. Người chơi đã được xếp vào các trận trong kế hoạch
  ;(plan?.rounds || []).forEach((r) => {
    ;(r.courts || []).forEach((c) => {
      ;[...(c.teamA || []), ...(c.teamB || [])].forEach((k) => {
        if (k && !seenKeys.has(k)) {
          seenKeys.add(k)
          const defaultGuest = t('planner.defaultGuestName')
          const name = resolveSafePlayerName(db, k, defaultGuest)
          const pObj = playerOf(db, k)
          const avatarUrl = pObj?.avatarUrl || pObj?.avatar_url || (pObj?.profile && (pObj?.profile?.avatar_url || pObj?.profile?.avatarUrl)) || ''
          out.push({
            key: k,
            id: k,
            name,
            fullName: name,
            avatarUrl,
            level: pObj?.level || 'TB',
            gender: pObj?.gender || 'nam',
            guest: !pObj || !!pObj.guestId || !pObj.role,
            isAtt: isPresent(att[k]),
          })
        }
      })
    })
  })

  return out
}

