// Logic tính toán Elo, Độ tin cậy (Confidence) & Hiệu chỉnh chéo giới tính (Calibration).
// HÀM THUẦN — không gọi React hay Supabase, test độc lập bằng Node.

import cfg from '#config/app.json' with { type: 'json' }

export const DEFAULT_RATING = cfg.rating?.defaultRating ?? 0
export const K_FACTOR = cfg.rating?.kFactor ?? 32
export const BALANCE_THRESHOLD = cfg.rating?.balanceThreshold ?? 120
export const IMBALANCE_THRESHOLD = cfg.rating?.imbalanceThreshold ?? 250

/** Đánh giá độ cân bằng giữa 2 mức rating */
export function evalBalance(ra, rb) {
  const gap = Math.abs(ra - rb)
  if (gap > IMBALANCE_THRESHOLD) return { level: 'imbalanced', labelKey: 'rating.balance.imbalanced', gap }
  if (gap > BALANCE_THRESHOLD) return { level: 'slight', labelKey: 'rating.balance.slight', gap }
  return { level: 'balanced', labelKey: 'rating.balance.balanced', gap }
}

/** Xác suất thắng dự kiến theo Elo: P(A) = 1 / (1 + 10^((Rb - Ra) / 400)) */
export function expectedScore(ra, rb) {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400))
}

/**
 * Lấy an toàn thông tin rating của 1 người chơi từ playerRatings (hỗ trợ cả Object Map lẫn Array).
 * @param {Object|Array} playerRatings
 * @param {string} memberId
 * @returns {{ rating: number, gamesCount: number, confidence: string, winsCount: number, lossesCount: number }}
 */
export function getPlayerRating(playerRatings, memberId) {
  if (!playerRatings || !memberId) {
    return { rating: DEFAULT_RATING, gamesCount: 0, confidence: 'low', winsCount: 0, lossesCount: 0 }
  }
  let found = null
  if (Array.isArray(playerRatings)) {
    found = playerRatings.find((r) => r.memberId === memberId || r.playerId === memberId)
  } else if (typeof playerRatings === 'object') {
    found = playerRatings[memberId]
  }
  if (!found) {
    return { rating: DEFAULT_RATING, gamesCount: 0, confidence: 'low', winsCount: 0, lossesCount: 0 }
  }
  return {
    ...found,
    rating: Math.round(found.rating ?? DEFAULT_RATING),
    gamesCount: found.gamesCount ?? found.games_count ?? 0,
    winsCount: found.winsCount ?? found.wins_count ?? 0,
    lossesCount: found.lossesCount ?? found.losses_count ?? 0,
    confidence: found.confidence ?? found.confidence_label ?? confidenceOf(found.gamesCount ?? 0),
  }
}

/** Rating trung bình của một đội (1 hoặc 2 người). */
export function teamRating(playerIds, ratingsMap) {
  if (!playerIds || !playerIds.length) return DEFAULT_RATING
  const sum = playerIds.reduce((acc, id) => {
    const r = ratingsMap && ratingsMap[id] != null ? ratingsMap[id] : DEFAULT_RATING
    return acc + r
  }, 0)
  return Math.round(sum / playerIds.length)
}

/**
 * Tính điểm biến thiên Elo (delta) cho trận đấu.
 * @param {number} ra - Rating đội A
 * @param {number} rb - Rating đội B
 * @param {boolean} aWon - Đội A thắng hay thua
 * @param {number} [k] - Hệ số K (mặc định 32)
 */
export function calcEloDelta(ra, rb, aWon, k = K_FACTOR) {
  const ea = expectedScore(ra, rb)
  const actualA = aWon ? 1 : 0
  const deltaA = Math.round(k * (actualA - ea))
  return { deltaA, deltaB: -deltaA, expectedA: ea, expectedB: 1 - ea }
}

/**
 * Xác định nhãn độ tin cậy dựa vào số trận đã đấu và độ lệch chuẩn.
 * @param {number} gamesCount 
 * @param {number} [deviation]
 * @returns {'low' | 'medium' | 'high' | 'very_high'}
 */
export function confidenceOf(gamesCount, deviation) {
  if (deviation !== undefined) {
    if (gamesCount < 5 || deviation > 250) return 'low'
    if (gamesCount < 15 || deviation > 150) return 'medium'
    if (gamesCount < 30 || deviation > 90) return 'high'
    return 'very_high'
  }
  if (gamesCount < 5) return 'low'
  if (gamesCount < 15) return 'medium'
  if (gamesCount < 30) return 'high'
  return 'very_high'
}

/**
 * Tính toán hiệu chỉnh giới tính dựa trên mô hình dữ liệu quan sát được.
 * @param {Array} matches - Danh sách tất cả các trận có kết quả
 * @param {Object} membersMap - Map memberId -> member object { gender, ... }
 */
export function computeClubCalibration(matches, membersMap) {
  const buckets = {
    '<100': { sampleSize: 0, femaleWins: 0 },
    '100-300': { sampleSize: 0, femaleWins: 0 },
    '>300': { sampleSize: 0, femaleWins: 0 },
  }
  const topCross = {}

  // Phân loại các trận có sự tham gia của cả nam và nữ
  ;(matches || []).forEach((m) => {
    if (!m.sets || !m.sets.length || !m.winnerTeam) return
    const teamAIds = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
    const teamBIds = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])

    const teamAPlayers = teamAIds.map((id) => membersMap[id]).filter(Boolean)
    const teamBPlayers = teamBIds.map((id) => membersMap[id]).filter(Boolean)
    if (!teamAPlayers.length || !teamBPlayers.length) return

    const teamAFemale = teamAPlayers.some((p) => p.gender === 'nu' || p.gender === 'Nữ') // i18n-ok: data matching
    const teamBFemale = teamBPlayers.some((p) => p.gender === 'nu' || p.gender === 'Nữ') // i18n-ok: data matching

    // Trận đấu chéo giới tính (1 bên có nữ, bên kia toàn nam)
    if ((teamAFemale && !teamBFemale) || (!teamAFemale && teamBFemale)) {
      const ra = m.initialRatingA || 0
      const rb = m.initialRatingB || 0
      const gap = Math.abs(ra - rb)
      const bKey = gap < 100 ? '<100' : gap <= 300 ? '100-300' : '>300'
      buckets[bKey].sampleSize += 1

      const femaleWon = (teamAFemale && m.winnerTeam === 'A') || (teamBFemale && m.winnerTeam === 'B')
      if (femaleWon) buckets[bKey].femaleWins += 1

      ;[...teamAIds, ...teamBIds].forEach((id) => {
        topCross[id] = (topCross[id] || 0) + 1
      })
    }
  })

  const list = Object.entries(buckets).map(([bucket, val]) => {
    const winRate = val.sampleSize > 0 ? val.femaleWins / val.sampleSize : 0
    const learnedAdjustment = val.sampleSize >= 5 ? Math.round((winRate - 0.5) * 200) : 0
    return {
      bucket,
      sampleSize: val.sampleSize,
      femaleWins: val.femaleWins,
      observedWinRate: winRate,
      learnedAdjustment,
    }
  })

  list.buckets = buckets
  list.topCrossGenderPlayers = topCross
  return list
}

/**
 * Tính toán Effective Rating cho một người chơi khi thi đấu với đối phương,
 * áp dụng hiệu chỉnh học được từ CLB nếu là trận chéo giới tính.
 */
export function effectiveRating(member, opponentHasOppositeGender, calibrationList) {
  const base = member.rating != null ? member.rating : DEFAULT_RATING
  if (!opponentHasOppositeGender || !calibrationList || !calibrationList.length) return base
  const cal = calibrationList.find((c) => c.bucket === '100-300') || calibrationList[0]
  if (!cal || !cal.learnedAdjustment) return base
  return member.gender === 'nu' ? base + cal.learnedAdjustment : base
}

/**
 * Replay lại toàn bộ lịch sử thi đấu từ mốc trận bị sửa để tính lại Elo cho tất cả thành viên.
 * Đảm bảo tính nhất quán tuyệt đối về chuỗi Elo.
 * @param {Array} allMatches - Toàn bộ các trận trong CLB, sắp xếp theo thời gian
 * @param {string} editedMatchId - ID của trận vừa bị sửa
 * @param {Array} members - Danh sách thành viên CLB
 */
export function replayRatingCascade(allMatches, editedMatchId, members) {
  // Sắp xếp các trận theo thời gian tăng dần
  const sorted = [...(allMatches || [])].sort((a, b) => (a.at || 0) - (b.at || 0))
  const startIdx = sorted.findIndex((m) => m.id === editedMatchId)
  if (startIdx < 0) return { updatedRatings: {}, updatedMatches: sorted }

  // Khởi tạo bảng rating tính toán
  const ratings = {}
  const gamesCount = {}
  const winsCount = {}
  const lossesCount = {}
  ;(members || []).forEach((m) => {
    ratings[m.id] = DEFAULT_RATING
    gamesCount[m.id] = 0
    winsCount[m.id] = 0
    lossesCount[m.id] = 0
  })

  // Duyệt qua từng trận từ đầu đến cuối
  const updatedMatches = sorted.map((m, idx) => {
    const players = m.playerKeys || []
    if (players.length < 2) return m

    const teamA = players.slice(0, 2)
    const teamB = players.slice(2, 4)
    const ra = teamRating(teamA, ratings)
    const rb = teamRating(teamB, ratings)

    // Xác định kết quả
    let winnerTeam = m.winnerTeam
    if (m.sets && m.sets.length) {
      const validSets = m.sets.filter((s) => s[0] + s[1] > 0)
      if (validSets.length) {
        const aWins = validSets.filter((s) => s[0] > s[1]).length
        const bWins = validSets.filter((s) => s[1] > s[0]).length
        winnerTeam = aWins > bWins ? 'A' : 'B'
      }
    }

    if (!winnerTeam) return m

    const aWon = winnerTeam === 'A'
    const isRated = m.ratingEnabled !== false

    let delta = 0
    if (isRated) {
      const { deltaA } = calcEloDelta(ra, rb, aWon, K_FACTOR)
      delta = deltaA
      teamA.forEach((id) => { ratings[id] = (ratings[id] || DEFAULT_RATING) + deltaA })
      teamB.forEach((id) => { ratings[id] = (ratings[id] || DEFAULT_RATING) - deltaA })
    }

    // Tăng số trận
    teamA.forEach((id) => {
      gamesCount[id] = (gamesCount[id] || 0) + 1
      if (aWon) winsCount[id] = (winsCount[id] || 0) + 1
      else lossesCount[id] = (lossesCount[id] || 0) + 1
    })
    teamB.forEach((id) => {
      gamesCount[id] = (gamesCount[id] || 0) + 1
      if (!aWon) winsCount[id] = (winsCount[id] || 0) + 1
      else lossesCount[id] = (lossesCount[id] || 0) + 1
    })

    return {
      ...m,
      initialRatingA: ra,
      initialRatingB: rb,
      winnerTeam,
      eloDelta: delta,
    }
  })

  // Dựng kết quả ratings cuối cùng cho từng người
  const finalRatings = {}
  Object.keys(ratings).forEach((id) => {
    finalRatings[id] = {
      memberId: id,
      rating: ratings[id],
      gamesCount: gamesCount[id] || 0,
      winsCount: winsCount[id] || 0,
      lossesCount: lossesCount[id] || 0,
      confidence: confidenceOf(gamesCount[id] || 0),
    }
  })

  return { finalRatings, updatedMatches }
}

/**
 * Tính toán tiến trình độ tin cậy theo thang bậc R1 -> R5
 * @param {number} gamesCount
 */
export function confidenceProgress(gamesCount = 0) {
  if (gamesCount < 5) {
    return {
      level: 'R1',
      levelNum: 1,
      nextLevel: 'R2',
      current: gamesCount,
      target: 5,
      needed: 5 - gamesCount,
      pct: Math.min(100, Math.round((gamesCount / 5) * 100)),
      isMax: false,
    }
  }
  if (gamesCount < 15) {
    return {
      level: 'R2',
      levelNum: 2,
      nextLevel: 'R3',
      current: gamesCount,
      target: 15,
      needed: 15 - gamesCount,
      pct: Math.min(100, Math.round(((gamesCount - 5) / 10) * 100)),
      isMax: false,
    }
  }
  if (gamesCount < 30) {
    return {
      level: 'R3',
      levelNum: 3,
      nextLevel: 'R4',
      current: gamesCount,
      target: 30,
      needed: 30 - gamesCount,
      pct: Math.min(100, Math.round(((gamesCount - 15) / 15) * 100)),
      isMax: false,
    }
  }
  if (gamesCount < 50) {
    return {
      level: 'R4',
      levelNum: 4,
      nextLevel: 'R5',
      current: gamesCount,
      target: 50,
      needed: 50 - gamesCount,
      pct: Math.min(100, Math.round(((gamesCount - 30) / 20) * 100)),
      isMax: false,
    }
  }
  return {
    level: 'R5',
    levelNum: 5,
    nextLevel: null,
    current: gamesCount,
    target: 50,
    needed: 0,
    pct: 100,
    isMax: true,
  }
}

