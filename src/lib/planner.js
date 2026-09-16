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
 * Thuật toán Tự động lập kế hoạch đa vòng (Multi-Round Auto Scheduler).
 * Thuần: nhận dữ liệu, trả về danh sách rounds mới.
 * @param {Object} params
 * @param {Array} params.players - Danh sách người tham gia
 * @param {Array} params.courts - Danh sách sân
 * @param {Array} params.challenges - Kèo đấu cần ưu tiên xếp
 * @param {Array} params.wishes - Nguyện vọng
 * @param {string} params.startTime - Giờ bắt đầu
 * @param {number} params.roundMinutes - Số phút/vòng
 * @param {number} params.totalRounds - Tổng số vòng
 * @param {Object} params.ratingsMap - Map ID -> rating
 * @returns {Array} rounds mới đã lấp đầy
 */
export function autoGeneratePlan({
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
  const pList = (players || []).map((p) => p.key || p.id).filter(Boolean)

  if (pList.length < 4) {
    // Không đủ người xếp sân
    return times.map((t) => ({
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

  // Khởi tạo mảng rounds rỗng
  const rounds = times.map((t) => ({
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

  // 1. Xếp các KÈO ĐẤU được yêu cầu trước vào các vòng giữa (ví dụ R3, R5, R7)
  const acceptedChallenges = (challenges || []).filter((c) => c.status === 'accepted' || c.status === 'pending')
  let chalTargetRound = 2 // Ưu tiên xếp từ Vòng 3 (index 2)

  acceptedChallenges.forEach((c) => {
    const tA = (c.teamA || []).filter((k) => pList.includes(k))
    const tB = (c.teamB || []).filter((k) => pList.includes(k))
    if (tA.length === 2 && tB.length === 2 && chalTargetRound < totalRounds) {
      const r = rounds[chalTargetRound]
      // Tìm sân trống đầu tiên
      const freeCourt = r.courts.find((court) => court.teamA.length === 0 && court.teamB.length === 0)
      if (freeCourt) {
        freeCourt.teamA = [...tA]
        freeCourt.teamB = [...tB]
        freeCourt.challengeId = c.id
        freeCourt.tag = 'CHALLENGE'
        chalTargetRound += 2 // Cách nhau 2 vòng cho kèo tiếp theo
      }
    }
  })

  // 2. Lấp đầy các sân và vòng còn lại bằng thuật toán cân bằng tải & rating
  const matchCounts = {}
  pList.forEach((k) => { matchCounts[k] = 0 })

  // Cập nhật số trận đã được xếp từ các kèo
  rounds.forEach((r) => {
    r.courts.forEach((c) => {
      ;[...(c.teamA || []), ...(c.teamB || [])].forEach((k) => {
        if (matchCounts[k] !== undefined) matchCounts[k]++
      })
    })
  })

  // Điền từng vòng một
  for (let r = 0; r < totalRounds; r++) {
    const round = rounds[r]
    const placedThisRound = new Set()

    // Người đã ở trong kèo
    round.courts.forEach((c) => {
      ;(c.teamA || []).forEach((k) => placedThisRound.add(k))
      ;(c.teamB || []).forEach((k) => placedThisRound.add(k))
    })

    // Điền vào các sân còn trống
    for (let ci = 0; ci < round.courts.length; ci++) {
      const court = round.courts[ci]
      if (court.teamA.length === 2 && court.teamB.length === 2) continue

      // Lấy danh sách những người chưa đánh ở vòng này
      const available = pList.filter((k) => !placedThisRound.has(k))
      if (available.length < 4) break

      // Kiểm tra xem ai vừa đánh ở vòng trước (r - 1) và vòng trước nữa (r - 2)
      const playedPrev = r > 0 ? new Set() : new Set()
      const playedPrev2 = r > 1 ? new Set() : new Set()
      if (r > 0) {
        rounds[r - 1].courts.forEach((c) => {
          ;(c.teamA || []).forEach((k) => playedPrev.add(k))
          ;(c.teamB || []).forEach((k) => playedPrev.add(k))
        })
      }
      if (r > 1) {
        rounds[r - 2].courts.forEach((c) => {
          ;(c.teamA || []).forEach((k) => playedPrev2.add(k))
          ;(c.teamB || []).forEach((k) => playedPrev2.add(k))
        })
      }

      // Sắp xếp ưu tiên:
      // 1. Không đánh 2 vòng liên tiếp (playedPrev && playedPrev2)
      // 2. Số trận đã đánh ít hơn (matchCounts nhỏ hơn)
      // 3. Xáo trộn ngẫu nhiên nhẹ để đa dạng
      available.sort((a, b) => {
        const consecutiveA = (playedPrev.has(a) && playedPrev2.has(a)) ? 1 : 0
        const consecutiveB = (playedPrev.has(b) && playedPrev2.has(b)) ? 1 : 0
        if (consecutiveA !== consecutiveB) return consecutiveA - consecutiveB

        const diff = matchCounts[a] - matchCounts[b]
        if (diff !== 0) return diff

        const justPlayedA = playedPrev.has(a) ? 1 : 0
        const justPlayedB = playedPrev.has(b) ? 1 : 0
        if (justPlayedA !== justPlayedB) return justPlayedA - justPlayedB

        return Math.random() - 0.5
      })

      const chosen4 = available.slice(0, 4)

      const getR = (k) => ratingsMap[k] || 1000
      const pairings = [
        { tA: [chosen4[0], chosen4[1]], tB: [chosen4[2], chosen4[3]] },
        { tA: [chosen4[0], chosen4[2]], tB: [chosen4[1], chosen4[3]] },
        { tA: [chosen4[0], chosen4[3]], tB: [chosen4[1], chosen4[2]] },
      ]

      pairings.sort((p1, p2) => {
        const diff1 = Math.abs((getR(p1.tA[0]) + getR(p1.tA[1])) - (getR(p1.tB[0]) + getR(p1.tB[1])))
        const diff2 = Math.abs((getR(p2.tA[0]) + getR(p2.tA[1])) - (getR(p2.tB[0]) + getR(p2.tB[1])))
        return diff1 - diff2
      })

      const best = pairings[0]
      court.teamA = best.tA
      court.teamB = best.tB

      chosen4.forEach((k) => {
        placedThisRound.add(k)
        matchCounts[k]++
      })
    }
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

