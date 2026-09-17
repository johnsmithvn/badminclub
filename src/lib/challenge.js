// Quản lý nghiệp vụ Kèo đấu (Challenge) — Pure functions, không phụ thuộc React/Supabase.

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

/**
 * Tính toán tiến độ chuỗi ván đấu (BO1, BO3, BO5) của một Kèo:
 * - Thu thập tất cả các trận con thuộc kèo đó.
 * - Đếm số hiệp thắng của Đội A và Đội B.
 * - Xác định trạng thái đã xong hay chưa, tỉ số chuỗi, hiệp tiếp theo.
 */
export function getChallengeSeriesProgress(challenge, matches = []) {
  if (!challenge) {
    return {
      winsA: 0,
      winsB: 0,
      winsNeeded: 1,
      isComplete: false,
      winnerTeam: null,
      totalSetsPlayed: 0,
      nextSetNumber: 1,
      isDecider: false,
      seriesScoreText: '0 – 0',
      playedMatches: [],
    }
  }

  const chalMatches = (matches || [])
    .filter((m) => m && m.challengeId === challenge.id)
    .slice()
    .sort((a, b) => (a.at || 0) - (b.at || 0))

  let winsA = 0
  let winsB = 0
  chalMatches.forEach((m) => {
    if (m.winnerTeam === 'A') winsA++
    else if (m.winnerTeam === 'B') winsB++
  })

  const bestOf = Number(challenge.bestOf) || 1
  const winsNeeded = Math.ceil(bestOf / 2)
  const isComplete = Boolean(winsA >= winsNeeded || winsB >= winsNeeded)
  const winnerTeam = winsA >= winsNeeded ? 'A' : (winsB >= winsNeeded ? 'B' : null)
  const totalSetsPlayed = chalMatches.length
  const nextSetNumber = totalSetsPlayed + 1
  const isDecider = Boolean(!isComplete && winsA === winsNeeded - 1 && winsB === winsNeeded - 1)
  const seriesScoreText = `${winsA} – ${winsB}`

  return {
    winsA,
    winsB,
    winsNeeded,
    isComplete,
    winnerTeam,
    totalSetsPlayed,
    nextSetNumber,
    isDecider,
    seriesScoreText,
    playedMatches: chalMatches,
  }
}

/**
 * Thống kê tỷ lệ và số điểm dự đoán cho một Kèo đấu
 */
export function getPredictionStats(predictions = [], challengeId) {
  // Loại cả 'refunded': phiếu đã hoàn thì net = 0, để nó trong hồ là tỉ lệ pool kể chuyện một
  // ván cược không còn tồn tại.
  const activePreds = (predictions || []).filter(
    (p) => p && p.challengeId === challengeId && p.status !== 'cancelled' && p.status !== 'refunded'
  )

  let countA = 0
  let countB = 0
  let pointsA = 0
  let pointsB = 0
  const predictorsA = []
  const predictorsB = []

  activePreds.forEach((p) => {
    const pts = Number(p.stakePoints) || 0
    if (p.team === 'A') {
      countA++
      pointsA += pts
      predictorsA.push(p)
    } else if (p.team === 'B') {
      countB++
      pointsB += pts
      predictorsB.push(p)
    }
  })

  const totalCount = countA + countB
  const totalPoints = pointsA + pointsB

  let pctA = 50
  let pctB = 50
  if (totalPoints > 0) {
    pctA = Math.round((pointsA / totalPoints) * 100)
    pctB = 100 - pctA
  } else if (totalCount > 0) {
    pctA = Math.round((countA / totalCount) * 100)
    pctB = 100 - pctA
  }

  return {
    countA,
    countB,
    totalCount,
    pointsA,
    pointsB,
    totalPoints,
    pctA,
    pctB,
    predictorsA,
    predictorsB,
  }
}

/**
 * Lấy phiếu dự đoán của thành viên cho một kèo cụ thể
 */
export function getMemberPrediction(predictions = [], challengeId, memberId) {
  if (!challengeId || !memberId) return null
  return (predictions || []).find(
    (p) => p.challengeId === challengeId && p.memberId === memberId && p.status !== 'cancelled'
  ) || null
}

/**
 * Kiểm tra thành viên có đủ điều kiện gửi dự đoán cho Kèo đấu không
 */
export function canMemberPredict(challenge, memberId, db = {}, availablePoints = 0) {
  if (!challenge || !memberId) return { ok: false, reason: 'invalid_params' }

  // 1. Kiểm tra cờ cho phép dự đoán và khóa sổ
  if (challenge.predictionsEnabled === false) {
    return { ok: false, reason: 'disabled' }
  }
  if (challenge.predictionsLocked || challenge.status === 'oncourt' || challenge.status === 'played' || challenge.status === 'cancelled' || challenge.status === 'expired' || challenge.status === 'declined') {
    return { ok: false, reason: 'locked' }
  }
  // Quá hạn phải chặn theo MỐC GIỜ chứ không theo cột `status`: không có tiến trình nào quét kèo
  // hết hạn, `status` chỉ đổi khi có người bấm vào nó. Kèo treo qua đêm vẫn đang là 'pending'.
  if (challenge.expiresAt && new Date(challenge.expiresAt).getTime() <= Date.now()) {
    return { ok: false, reason: 'locked' }
  }

  // 2. Luật 1: Cấm tuyệt đối đấu thủ trong trận dự đoán
  const allPlayers = [...(challenge.teamA || []), ...(challenge.teamB || [])]
  if (allPlayers.includes(memberId)) {
    return { ok: false, reason: 'player_conflict' }
  }

  // 3. Kiểm tra thành viên đang hoạt động
  const member = (db.members || []).find((m) => m.id === memberId)
  if (!member || member.active === false) {
    return { ok: false, reason: 'member_inactive' }
  }

  // 4. Kiểm tra đã có phiếu cược chưa (mỗi người 1 phiếu)
  const existing = getMemberPrediction(db.challengePredictions || [], challenge.id, memberId)
  if (existing && existing.status === 'pending') {
    return { ok: false, reason: 'already_predicted', existing }
  }

  // 5. Kiểm tra số dư SP tối thiểu (>= 1 SP)
  if (Number(availablePoints) < 1) {
    return { ok: false, reason: 'insufficient_points' }
  }

  return { ok: true, reason: null }
}

/**
 * Trạng thái kèo mà phiếu dự đoán KHÔNG còn cơ hội được quyết toán nữa.
 *
 * Quan trọng cho `pendingStakeOf`: phiếu nằm trên một kèo đã chết thì không được giam SP của
 * người đặt. Đây là chỗ đã làm mất điểm vĩnh viễn — kèo hết hạn mà không ai bấm vào thì cột
 * `status` không bao giờ đổi, phiếu ở lại 'pending' mãi, và SP khả dụng bị trừ mãi.
 */
const DEAD_CHALLENGE_STATUS = new Set(['cancelled', 'declined', 'expired'])

export function isChallengeDead(challenge, now = Date.now()) {
  if (!challenge) return true
  if (DEAD_CHALLENGE_STATUS.has(challenge.status)) return true
  // Kèo chưa lên sân mà đã quá giờ hết hạn thì coi như chết, kể cả khi `status` còn 'pending'.
  if (
    (challenge.status === 'pending' || challenge.status === 'accepted')
    && challenge.expiresAt
    && new Date(challenge.expiresAt).getTime() <= now
  ) return true
  return false
}

/**
 * Tổng SP đang bị giam trong các phiếu CHỜ quyết toán của một thành viên.
 * Bỏ qua phiếu nằm trên kèo đã chết — xem `isChallengeDead`.
 */
export function pendingStakeOf(predictions = [], challenges = [], memberId, now = Date.now()) {
  if (!memberId) return 0
  const byId = new Map((challenges || []).map((c) => [c.id, c]))
  return (predictions || []).reduce((sum, p) => {
    if (p.memberId !== memberId || p.status !== 'pending') return sum
    if (isChallengeDead(byId.get(p.challengeId), now)) return sum
    return sum + (Number(p.stakePoints) || 0)
  }, 0)
}

/**
 * SP còn dùng được để đặt cược = điểm mùa hiện có trừ phần đang bị giam.
 * Bằng 0 là KHÔNG được cược — không có cửa nợ điểm.
 */
export function availableSeasonPoints(totalSeasonPoints, predictions = [], challenges = [], memberId, now = Date.now()) {
  const total = Number(totalSeasonPoints) || 0
  return Math.max(0, total - pendingStakeOf(predictions, challenges, memberId, now))
}

/**
 * Áp kết quả quyết toán lên danh sách phiếu ở state client.
 *
 * Phải khớp TỪNG DÒNG với `settle_challenge_predictions` trong 0042, vì đây chỉ là bản cập nhật
 * lạc quan cho màn hình còn sự thật nằm ở RPC. Lệch nhau là màn hình báo một đằng DB một nẻo.
 *
 * @param winnerTeam 'A' | 'B' để chia thắng thua; null/undefined để hoàn phiếu.
 */
export function settlePredictionsLocal(predictions = [], challengeId, winnerTeam, at) {
  return (predictions || []).map((p) => {
    if (p.challengeId !== challengeId) return p
    if (winnerTeam === 'A' || winnerTeam === 'B') {
      // Nhận cả phiếu đã quyết toán: sửa tỷ số làm lật đội thắng thì phiếu phải chạy lại.
      if (p.status !== 'pending' && p.status !== 'won' && p.status !== 'lost') return p
      const won = p.team === winnerTeam
      return {
        ...p,
        status: won ? 'won' : 'lost',
        payoutPoints: won ? (Number(p.stakePoints) || 0) * 2 : 0,
        settledAt: at,
        updatedAt: at,
      }
    }
    // Hoàn: chỉ đụng phiếu đang chờ, không lặng lẽ gỡ kết quả đã ăn/thua.
    if (p.status !== 'pending') return p
    return { ...p, status: 'refunded', payoutPoints: Number(p.stakePoints) || 0, settledAt: at, updatedAt: at }
  })
}
