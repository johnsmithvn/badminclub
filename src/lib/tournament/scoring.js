/**
 * @file scoring.js
 * Logic tính điểm thuần túy cho module Giải đấu (Tournament).
 * Không phụ thuộc React, không phụ thuộc Supabase.
 */

/**
 * Xác định bên thắng của 1 set đấu.
 *
 * @param {number} a Điểm của bên A
 * @param {number} b Điểm của bên B
 * @param {{ sets: number, points: number, winBy2: boolean, cap: number }} rule
 * @returns {'A' | 'B' | null | 'invalid'}
 *   - 'A': Bên A thắng hợp lệ
 *   - 'B': Bên B thắng hợp lệ
 *   - null: Set chưa kết thúc, đang đánh tiếp
 *   - 'invalid': Điểm không hợp lệ hoặc đã vượt quá điểm dừng quy định
 */
export function setWinner(a, b, rule) {
  if (!rule || typeof rule.points !== 'number' || typeof rule.cap !== 'number') {
    return 'invalid'
  }

  // Điểm không nguyên, âm, hoặc lớn hơn cap
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > rule.cap || b > rule.cap) {
    return 'invalid'
  }

  // Kiểm tra hòa không hợp lệ:
  // - Nếu không winBy2: không thể hòa từ mốc points trở lên (ví dụ 30-30 khi chạm 30, 15-15 khi chạm 15)
  // - Nếu winBy2: chỉ không thể hòa từ mốc cap trở lên (ví dụ 30-30 khi cap=30; 29-29 vẫn là deuce hợp lệ)
  const maxTiedPoint = rule.winBy2 ? rule.cap : rule.points
  if (a === b && a >= maxTiedPoint) {
    return 'invalid'
  }

  // Hòa nhau dưới maxTiedPoint: set đang tiếp diễn
  if (a === b) {
    return null
  }

  const isAWinner = a > b
  const w = isAWinner ? a : b
  const l = isAWinner ? b : a
  const side = isAWinner ? 'A' : 'B'

  // Tính điểm dừng hợp lệ (target) của set
  let target
  if (!rule.winBy2) {
    target = rule.points
  } else {
    if (l <= rule.points - 2) {
      target = rule.points
    } else if (l < rule.cap - 1) {
      target = l + 2
    } else {
      // l === rule.cap - 1 (ví dụ l=29, cap=30 => target=30)
      target = rule.cap
    }
  }

  if (w === target) {
    return side
  }
  if (w < target) {
    return null
  }
  // w > target (ví dụ 25-10, 24-21, 31-29: điểm đã vượt quá điểm dừng hợp lệ)
  return 'invalid'
}

/**
 * Hàm phân tích mảng các set đấu (Single Source of Truth cho matchWinner và validateSets).
 *
 * @param {Array<[number, number]>} sets
 * @param {{ sets: number, points: number, winBy2: boolean, cap: number }} rule
 * @returns {{
 *   error: string | null,
 *   isSyntaxValid: boolean,
 *   winner: 'A' | 'B' | null,
 *   winsA: number,
 *   winsB: number
 * }}
 */
function inspectSets(sets, rule) {
  if (!Array.isArray(sets)) {
    return { error: 'tournament.err.invalidFormat', isSyntaxValid: false, winner: null, winsA: 0, winsB: 0 }
  }
  if (!rule || typeof rule.sets !== 'number') {
    return { error: 'tournament.err.missingRule', isSyntaxValid: false, winner: null, winsA: 0, winsB: 0 }
  }
  if (sets.length === 0) {
    return { error: 'tournament.err.emptySets', isSyntaxValid: true, winner: null, winsA: 0, winsB: 0 }
  }

  const needWins = Math.ceil(rule.sets / 2)
  let winsA = 0
  let winsB = 0

  for (let i = 0; i < sets.length; i++) {
    // Nếu một bên đã thắng đủ số set mà vẫn còn set phía sau -> thừa set
    if (winsA >= needWins || winsB >= needWins) {
      return { error: 'tournament.err.extraSets', isSyntaxValid: false, winner: null, winsA, winsB }
    }

    const s = sets[i]
    if (!Array.isArray(s) || s.length !== 2) {
      return { error: 'tournament.err.invalidSetFormat', isSyntaxValid: false, winner: null, winsA, winsB }
    }

    const sw = setWinner(s[0], s[1], rule)
    if (sw === 'invalid') {
      return { error: 'tournament.err.invalidSetScore', isSyntaxValid: false, winner: null, winsA, winsB }
    }
    if (sw === null) {
      // Set chưa xong, nếu phía sau vẫn còn set khác -> lỗi thứ tự
      if (i < sets.length - 1) {
        return { error: 'tournament.err.incompleteSet', isSyntaxValid: false, winner: null, winsA, winsB }
      }
      return { error: 'tournament.err.incompleteSet', isSyntaxValid: true, winner: null, winsA, winsB }
    }

    if (sw === 'A') winsA++
    if (sw === 'B') winsB++
  }

  const winner = winsA >= needWins ? 'A' : winsB >= needWins ? 'B' : null
  const finished = winner !== null

  return {
    error: finished ? null : 'tournament.err.matchNotFinished',
    isSyntaxValid: true,
    winner,
    winsA,
    winsB
  }
}

/**
 * Xác định bên thắng của toàn bộ trận đấu từ mảng các set.
 *
 * @param {Array<[number, number]>} sets Mảng các set, ví dụ [[21, 18], [19, 21], [21, 15]]
 * @param {{ sets: number, points: number, winBy2: boolean, cap: number }} rule
 * @returns {'A' | 'B' | null | 'invalid'}
 */
export function matchWinner(sets, rule) {
  const inspected = inspectSets(sets, rule)
  if (!inspected.isSyntaxValid) {
    return 'invalid'
  }
  return inspected.winner
}

/**
 * Kiểm tra tính hợp lệ toàn diện của kết quả các set cho một trận đã kết thúc.
 * Dùng trước khi gọi RPC commit hoặc edit.
 *
 * @param {Array<[number, number]>} sets
 * @param {{ sets: number, points: number, winBy2: boolean, cap: number }} rule
 * @returns {string | null} Trả về null nếu hợp lệ, hoặc mã lỗi key i18n
 */
export function validateSets(sets, rule) {
  const inspected = inspectSets(sets, rule)
  return inspected.error
}

/**
 * Tính toán các cờ thông báo cho Bảng điểm Live (Scoreboard):
 * - deuce: Đang hòa căng thẳng ở cuối set
 * - setPoint: { A: boolean, B: boolean }
 * - matchPoint: { A: boolean, B: boolean }
 *
 * @param {{ currentScore: [number, number], sets: Array<[number, number]> }} state
 * @param {{ sets: number, points: number, winBy2: boolean, cap: number }} rule
 * @returns {{
 *   deuce: boolean,
 *   setPoint: { A: boolean, B: boolean },
 *   matchPoint: { A: boolean, B: boolean }
 * }}
 */
export function scoreFlags(state, rule) {
  const [a, b] = state.currentScore || [0, 0]
  const completedSets = state.sets || []
  const needWins = Math.ceil(rule.sets / 2)
  const inspected = inspectSets(completedSets, rule)
  const winsA = inspected.winsA
  const winsB = inspected.winsB

  const isDeuce = rule.winBy2 && a >= rule.points - 1 && b >= rule.points - 1 && a < rule.cap && b < rule.cap

  const aNext = setWinner(a + 1, b, rule)
  const bNext = setWinner(a, b + 1, rule)

  const aHasSetPoint = aNext === 'A'
  const bHasSetPoint = bNext === 'B'

  const aHasMatchPoint = aHasSetPoint && winsA + 1 >= needWins
  const bHasMatchPoint = bHasSetPoint && winsB + 1 >= needWins

  return {
    deuce: isDeuce,
    setPoint: { A: aHasSetPoint, B: bHasSetPoint },
    matchPoint: { A: aHasMatchPoint, B: bHasMatchPoint }
  }
}

/**
 * Lấy luật điểm cho một vòng đấu cụ thể của giai đoạn.
 * Chỉ nhận camelCase theo quy ước của repo (dbmap đã chuẩn hóa).
 * Thiếu stage hoặc thiếu matchRule sẽ throw Error (tránh hard-code và che giấu bug).
 *
 * @param {{ matchRule: { sets: number, points: number, winBy2: boolean, cap: number }, ruleOverrides?: Record<string, any> }} stage
 * @param {string} roundKind Ví dụ: 'final', 'third', 'sf', 'qf', 'r16', 'r32', 'group'
 * @returns {{ sets: number, points: number, winBy2: boolean, cap: number }}
 */
export function ruleFor(stage, roundKind) {
  if (!stage || !stage.matchRule) {
    throw new Error('ruleFor: stage or stage.matchRule is missing')
  }

  const overrides = stage.ruleOverrides || {}
  if (roundKind && overrides[roundKind]) {
    return overrides[roundKind]
  }

  return stage.matchRule
}
