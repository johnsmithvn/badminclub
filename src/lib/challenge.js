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

/** Tiến độ nhận kèo của các đấu thủ */
export function getChallengeAcceptanceProgress(challenge) {
  if (!challenge) return { acceptedCount: 0, totalCount: 0, isFullyAccepted: false, pendingPlayerIds: [] }
  const isDoubles = (challenge.teamA || []).length > 1
  const totalCount = isDoubles ? 4 : 2
  const allCurrent = Array.from(new Set([...(challenge.teamA || []), ...(challenge.teamB || [])]))
  const acceptedList = challenge.acceptedPlayers || []
  const acceptedPlayersInMatch = allCurrent.filter((id) => acceptedList.includes(id))
  const acceptedCount = acceptedPlayersInMatch.length
  const pendingPlayerIds = allCurrent.filter((id) => !acceptedList.includes(id))
  const isFullTeam = isDoubles
    ? (challenge.teamA || []).length === 2 && (challenge.teamB || []).length === 2
    : (challenge.teamA || []).length === 1 && (challenge.teamB || []).length === 1
  const isFullyAccepted = Boolean(isFullTeam && allCurrent.length === totalCount && pendingPlayerIds.length === 0)

  return {
    acceptedCount,
    totalCount,
    isFullyAccepted,
    pendingPlayerIds,
    isDoubles,
  }
}

/** Kiểm tra xem kèo đã được tất cả đấu thủ đồng ý chưa */
export function isChallengeFullyAccepted(challenge) {
  return getChallengeAcceptanceProgress(challenge).isFullyAccepted
}

/** Kiểm tra thành viên có thể bấm Nhận kèo không */
export function canMemberAcceptChallenge(challenge, myMemberId, isAdmin = false) {
  if (!challenge || challenge.status !== 'pending') return false
  if (challenge.expiresAt && new Date(challenge.expiresAt).getTime() <= Date.now()) return false

  const allCurrent = Array.from(new Set([...(challenge.teamA || []), ...(challenge.teamB || [])]))
  const acceptedList = challenge.acceptedPlayers || []

  // Nếu người dùng là đấu thủ trong trận đấu: chỉ nhận được khi BẢN THÂN CHƯA NHẬN (kể cả khi là Admin)
  if (myMemberId && allCurrent.includes(myMemberId)) {
    return !acceptedList.includes(myMemberId)
  }

  // Nếu là Admin nhưng KHÔNG thi đấu trong kèo: có thể duyệt nhanh khi kèo đã đủ người ở cả 2 đội và chưa tất cả accept
  if (isAdmin) {
    const isDoubles = (challenge.teamA || []).length > 1
    const needed = isDoubles ? 2 : 1
    const isFull = (challenge.teamA || []).length === needed && (challenge.teamB || []).length === needed
    const isFullyAccepted = isFull && allCurrent.length === (needed * 2) && allCurrent.every((id) => acceptedList.includes(id))
    return isFull && !isFullyAccepted
  }

  return false
}

