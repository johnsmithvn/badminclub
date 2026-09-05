// Quản lý nghiệp vụ Kèo đấu (Challenge) — Pure functions, không phụ thuộc React/Supabase.

import { expectedScore, teamRating, BALANCE_THRESHOLD, IMBALANCE_THRESHOLD } from '#lib/rating.js'

/** Sinh mã kèo kế tiếp dạng C-0125 */
export function nextChallengeCode(existingChallenges = []) {
  const maxNum = existingChallenges.reduce((max, c) => {
    if (!c.code) return max
    const match = c.code.match(/C-(\d+)/)
    if (match) {
      const n = parseInt(match[1], 10)
      return n > max ? n : max
    }
    return max
  }, 100)
  return 'C-' + String(maxNum + 1).padStart(4, '0')
}

/** Xác định hướng của kèo đối với một thành viên: 'in' (gửi cho bạn), 'out' (bạn gửi), hoặc 'none' */
export function challengeDirection(challenge, myMemberId) {
  if (!challenge || !myMemberId) return 'none'
  const inA = (challenge.teamA || []).includes(myMemberId)
  const inB = (challenge.teamB || []).includes(myMemberId)
  if (challenge.createdBy === myMemberId || inA) return 'out'
  if (inB) return 'in'
  return 'none'
}

/** Tính toán độ cân bằng và tỷ lệ thắng dự kiến cho Kèo */
export function evalChallengeBalance(teamA, teamB, ratingsMap) {
  const ra = teamRating(teamA, ratingsMap)
  const rb = teamRating(teamB, ratingsMap)
  const gap = Math.abs(ra - rb)
  const pctA = Math.round(expectedScore(ra, rb) * 100)
  const pctB = 100 - pctA

  let tone = 'even' // 'even' | 'slight' | 'imbalanced'
  if (gap > IMBALANCE_THRESHOLD) tone = 'imbalanced'
  else if (gap > BALANCE_THRESHOLD) tone = 'slight'

  return { ra, rb, gap, pctA, pctB, tone }
}

/** Kiểm tra xem kèo có đang trong trạng thái chờ sân (accepted) không */
export const isWaitingCourt = (c) => Boolean(c && c.status === 'accepted')

/** Kiểm tra xem kèo có thể hủy không (người tạo mới hủy được khi còn pending) */
export function canCancelChallenge(challenge, myMemberId) {
  if (!challenge || challenge.status !== 'pending') return false
  return challenge.createdBy === myMemberId || (challenge.teamA || []).includes(myMemberId)
}

/** Lọc danh sách thành viên có mặt có thể chọn vào kèo (loại trừ khách vãng lai) */
export function pickableMembersForChallenge(members, attendanceMap, sessionId) {
  const att = (attendanceMap && attendanceMap[sessionId]) || {}
  return (members || []).filter((m) => m.active !== false && att[m.id] === true)
}
