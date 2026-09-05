// Logic tính toán Elo, Độ tin cậy (Confidence) & Hiệu chỉnh chéo giới tính (Calibration).
// HÀM THUẦN — không gọi React hay Supabase, test độc lập bằng Node.

import cfg from '#config/app.json' with { type: 'json' }
import { getTierName, getComedyQuip } from '#data/rankThemes.js'

export const DEFAULT_RATING = cfg.rating?.defaultRating ?? 0
export const MIN_RATING = cfg.rating?.minRating ?? 0
export const K_FACTOR = cfg.rating?.kFactor ?? 32
export const K_DYNAMIC = cfg.rating?.kDynamic || { r1: 48, r2: 36, r3: 28, r4: 20, r5: 16 }
export const BALANCE_THRESHOLD = cfg.rating?.balanceThreshold ?? 120
export const IMBALANCE_THRESHOLD = cfg.rating?.imbalanceThreshold ?? 250
export const TIERS = cfg.rating?.tiers || [
  { key: 'novice', min: 0, max: 199, token: 'rank-novice', icon: 'sparkles' },
  { key: 'rookie', min: 200, max: 399, token: 'rank-rookie', icon: 'play' },
  { key: 'regular', min: 400, max: 599, token: 'rank-regular', icon: 'shield' },
  { key: 'solid', min: 600, max: 799, token: 'rank-solid', icon: 'award' },
  { key: 'net_master', min: 800, max: 999, token: 'rank-net-master', icon: 'zap' },
  { key: 'coverage', min: 1000, max: 1199, token: 'rank-coverage', icon: 'flame' },
  { key: 'heavy_hitter', min: 1200, max: 1399, token: 'rank-heavy-hitter', icon: 'trophy' },
  { key: 'court_boss', min: 1400, max: 99999, token: 'rank-court-boss', icon: 'crown' },
]

/**
 * Điểm Elo xuất phát (Seed Rating) gắn với Trình độ của thành viên.
 * Ưu tiên:
 * 1. Bảng cấu hình levelInitialRatings trong app.json (yeu: 200, tb: 500, kha: 800...)
 * 2. Nội suy theo vị trí index của bậc trong mảng levels của CLB (200 -> 1000).
 * 3. Fallback: DEFAULT_RATING.
 * @param {string} [level]
 * @param {Array<string>} [levels]
 * @returns {number}
 */
export function initialRatingOf(level, levels) {
  if (!level) return DEFAULT_RATING
  const lKey = String(level).trim().toLowerCase()
  const map = cfg.rating?.levelInitialRatings || {}
  if (map[lKey] != null) return map[lKey]

  // Chuẩn hoá bỏ dấu để so sánh an toàn không phụ thuộc font/bảng mã
  const lClean = lKey.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/g, 'd') // i18n-ok: data normalization
  if (map[lClean] != null) return map[lClean]
  if (lClean.includes('yeu') || lClean === 'y' || lClean === 'newbie') return map.yeu ?? 200
  if (lClean.includes('kha') || lClean === 'k' || lClean === 'tbk') return map.kha ?? 800
  if (lClean.includes('tot') || lClean.includes('gioi') || lClean === 'pro') return map.tot ?? 1000
  if (lClean === 'tb' || lClean.includes('trung binh')) return map.tb ?? 500

  // Nếu có danh sách levels của CLB, nội suy theo index từ 200 đến 1000
  if (Array.isArray(levels) && levels.length > 1) {
    const idx = levels.findIndex((x) => String(x).trim().toLowerCase() === lKey)
    if (idx >= 0) {
      const minSeed = 200
      const maxSeed = 1000
      const pct = idx / (levels.length - 1)
      return Math.round(minSeed + pct * (maxSeed - minSeed))
    }
  }

  return DEFAULT_RATING
}

/**
 * Trả về hệ số K riêng cho người chơi dựa vào số trận đã đấu (độ tin cậy R1 -> R5).
 * Người mới (R1) K cao (48) để nhanh về đúng trình.
 * Người kỳ cựu (R5) K thấp (16) để điểm vững vàng, không bị oan khi cõng tạ.
 */
export function kFactorOf(gamesCount = 0) {
  if (gamesCount < 5) return K_DYNAMIC.r1 ?? 48
  if (gamesCount < 15) return K_DYNAMIC.r2 ?? 36
  if (gamesCount < 30) return K_DYNAMIC.r3 ?? 28
  if (gamesCount < 50) return K_DYNAMIC.r4 ?? 20
  return K_DYNAMIC.r5 ?? 16
}

/**
 * Tính hệ số nhân khoảng cách tỷ số (Margin of Victory Multiplier).
 * Thắng sát nút (21-19) nhân ~1.05.
 * Thắng áp đảo (21-5) nhân tối đa ~1.40.
 */
export function marginMultiplier(sets) {
  if (!sets || !sets.length || cfg.rating?.marginOfVictory?.enabled === false) return 1.0
  const played = sets.filter((s) => (s[0] || 0) + (s[1] || 0) > 0)
  if (!played.length) return 1.0
  const diffSum = played.reduce((acc, s) => acc + Math.abs((s[0] || 0) - (s[1] || 0)), 0)
  const avgDiff = diffSum / played.length
  const maxMult = cfg.rating?.marginOfVictory?.maxMultiplier ?? 1.4
  const divisor = cfg.rating?.marginOfVictory?.divisor ?? 40
  const mult = 1 + (avgDiff / divisor)
  return Math.min(maxMult, Math.max(1.0, Math.round(mult * 100) / 100))
}

export const TIER_EMOJIS = {
  novice: '✨',
  rookie: '🏸',
  regular: '🛡️',
  solid: '⚔️',
  net_master: '⚡',
  coverage: '🔥',
  heavy_hitter: '🏆',
  court_boss: '👑',
}

/**
 * Xác định phân hạng Rank Tier (Hỗ trợ 4 bộ Theme: street, comedy, destroyer, slang)
 * @param {number} [rating=0]
 * @param {string} [themeKey='street']
 */
export function rankTierOf(rating = 0, themeKey = 'street') {
  const r = Math.max(MIN_RATING, Math.round(rating || 0))
  const tier = TIERS.find((t) => r >= t.min && r <= t.max) || TIERS[0]
  const range = (tier.max === 99999 ? 200 : (tier.max - tier.min + 1))
  const progress = Math.min(100, Math.max(0, Math.round(((r - tier.min) / range) * 100)))
  const safeTheme = themeKey || 'street'
  const label = getTierName(safeTheme, tier.key)
  const quip = getComedyQuip(tier.key)
  const tierHex = tier.color || (cfg.rating?.tiers || []).find((t) => t.key === tier.key)?.color || (
    tier.key === 'rookie' ? '#38BDF8' :
    tier.key === 'regular' ? '#34D399' :
    tier.key === 'solid' ? '#FACC15' :
    tier.key === 'net_master' ? '#FB923C' :
    tier.key === 'coverage' ? '#F43F5E' :
    tier.key === 'heavy_hitter' ? '#A855F7' :
    tier.key === 'court_boss' ? '#EC4899' : '#94A3B8'
  )
  const colorToken = tier.token ? `var(--${tier.token}, ${tierHex})` : (tier.color || `var(--rank-novice, #94A3B8)`)

  return {
    key: tier.key,
    label,
    quip,
    token: tier.token || `rank-${tier.key.replace(/_/g, '-')}`,
    color: colorToken,
    colorToken,
    icon: tier.icon,
    min: tier.min,
    max: tier.max,
    rating: r,
    progress,
    theme: safeTheme,
  }
}

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
 * Trả về rating kỹ thuật và displayRating luôn >= MIN_RATING (0).
 * Nếu chưa đấu trận nào, dùng seed rating gắn với trình độ của thành viên (member.level).
 * @param {Object|Array} playerRatings
 * @param {string} memberId
 * @param {Object} [member]
 * @param {Array<string>} [levels]
 * @returns {{ rating: number, displayRating: number, gamesCount: number, confidence: string, winsCount: number, lossesCount: number, tier: Object }}
 */
export function getPlayerRating(playerRatings, memberId, member = null, levels = null) {
  const seedRating = member?.level ? initialRatingOf(member.level, levels) : DEFAULT_RATING
  if (!playerRatings || !memberId) {
    return {
      rating: seedRating,
      displayRating: Math.max(MIN_RATING, seedRating),
      gamesCount: 0,
      confidence: 'low',
      winsCount: 0,
      lossesCount: 0,
      tier: rankTierOf(seedRating),
    }
  }
  let found = null
  if (Array.isArray(playerRatings)) {
    found = playerRatings.find((r) => r.memberId === memberId || r.playerId === memberId)
  } else if (typeof playerRatings === 'object') {
    found = playerRatings[memberId]
  }
  if (!found) {
    return {
      rating: seedRating,
      displayRating: Math.max(MIN_RATING, seedRating),
      gamesCount: 0,
      confidence: 'low',
      winsCount: 0,
      lossesCount: 0,
      tier: rankTierOf(seedRating),
    }
  }
  const r = Math.round(found.rating ?? seedRating)
  const gCount = found.gamesCount ?? found.games_count ?? 0
  return {
    ...found,
    rating: r,
    displayRating: Math.max(MIN_RATING, r),
    gamesCount: gCount,
    winsCount: found.winsCount ?? found.wins_count ?? 0,
    lossesCount: found.lossesCount ?? found.losses_count ?? 0,
    confidence: found.confidence ?? found.confidence_label ?? confidenceOf(gCount),
    tier: rankTierOf(r),
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
 * Tính điểm biến thiên Elo (delta) cho trận đấu (Hỗ trợ K tùy biến và hệ số cách biệt Margin of Victory).
 * @param {number} ra - Rating đội A
 * @param {number} rb - Rating đội B
 * @param {boolean} aWon - Đội A thắng hay thua
 * @param {number} [k] - Hệ số K (mặc định 32)
 * @param {Array} [sets] - Danh sách set điểm để tính Margin of Victory
 */
export function calcEloDelta(ra, rb, aWon, k = K_FACTOR, sets = null) {
  const ea = expectedScore(ra, rb)
  const actualA = aWon ? 1 : 0
  const mult = sets ? marginMultiplier(sets) : 1.0
  const deltaA = Math.round(k * (actualA - ea) * mult)
  return { deltaA, deltaB: -deltaA, expectedA: ea, expectedB: 1 - ea, multiplier: mult }
}

/**
 * Tính điểm biến thiên Elo RIÊNG BIỆT cho từng thành viên trong đội dựa theo:
 * - Hệ số K cá nhân (Dynamic K-Factor theo số trận R1-R5)
 * - Hệ số cách biệt tỷ số set (Margin of Victory)
 */
export function calcPlayerDeltas({ teamA = [], teamB = [], aWon, ratingsMap = {}, gamesCountMap = {}, sets = null }) {
  const ra = teamRating(teamA, ratingsMap)
  const rb = teamRating(teamB, ratingsMap)
  const ea = expectedScore(ra, rb)
  const eb = 1 - ea
  const mult = sets ? marginMultiplier(sets) : 1.0

  const deltas = {}
  teamA.forEach((id) => {
    const k = kFactorOf(gamesCountMap[id] || 0)
    const raw = k * ((aWon ? 1 : 0) - ea) * mult
    deltas[id] = Math.round(raw)
  })
  teamB.forEach((id) => {
    const k = kFactorOf(gamesCountMap[id] || 0)
    const raw = k * ((!aWon ? 1 : 0) - eb) * mult
    deltas[id] = Math.round(raw)
  })

  return { deltas, expectedA: ea, expectedB: eb, multiplier: mult, ra, rb }
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
export function replayRatingCascade(allMatches, editedMatchId, members, levels) {
  // Sắp xếp các trận theo thời gian tăng dần
  const sorted = [...(allMatches || [])].sort((a, b) => (a.at || 0) - (b.at || 0))
  const startIdx = sorted.findIndex((m) => m.id === editedMatchId)
  if (startIdx < 0) return { finalRatings: {}, updatedMatches: sorted }

  // Khởi tạo bảng rating tính toán
  const ratings = {}
  const gamesCount = {}
  const winsCount = {}
  const lossesCount = {}
  ;(members || []).forEach((m) => {
    ratings[m.id] = initialRatingOf(m?.level, levels)
    gamesCount[m.id] = 0
    winsCount[m.id] = 0
    lossesCount[m.id] = 0
  })

  // Duyệt qua từng trận từ đầu đến cuối
  const updatedMatches = sorted.map((m) => {
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
        winnerTeam = aWins > bWins ? 'A' : bWins > aWins ? 'B' : null
      }
    }

    if (!winnerTeam) return { ...m, winnerTeam: null }

    const aWon = winnerTeam === 'A'
    const isRated = m.ratingEnabled !== false

    let delta = 0
    if (isRated) {
      const { deltas } = calcPlayerDeltas({
        teamA,
        teamB,
        aWon,
        ratingsMap: ratings,
        gamesCountMap: gamesCount,
        sets: m.sets,
      })
      delta = deltas[teamA[0]] || 0
      teamA.forEach((id) => {
        ratings[id] = (ratings[id] || DEFAULT_RATING) + (deltas[id] || 0)
      })
      teamB.forEach((id) => {
        ratings[id] = (ratings[id] || DEFAULT_RATING) + (deltas[id] || 0)
      })
      // Tăng số trận Elo
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
    }

    return {
      ...m,
      initialRatingA: ra,
      initialRatingB: rb,
      winnerTeam,
      eloDelta: delta,
    }
  })

  // Dựng kết quả ratings cuối cùng cho từng người (kèm tier & displayRating)
  const finalRatings = {}
  Object.keys(ratings).forEach((id) => {
    const finalR = Math.round(ratings[id])
    finalRatings[id] = {
      memberId: id,
      rating: finalR,
      displayRating: Math.max(MIN_RATING, finalR),
      gamesCount: gamesCount[id] || 0,
      winsCount: winsCount[id] || 0,
      lossesCount: lossesCount[id] || 0,
      confidence: confidenceOf(gamesCount[id] || 0),
      tier: rankTierOf(finalR),
    }
  })

  return { finalRatings, updatedMatches }
}

/**
 * Tính toán suy hao phong độ (Inactivity Decay) do nghỉ đấu lâu ngày.
 * - < 30 ngày: Bình thường (active)
 * - 30-44 ngày: Cảnh báo tạm nghỉ (inactive = true, decay = 0)
 * - >= 45 ngày: Bắt đầu trừ nhẹ 10 điểm cho mỗi chu kỳ 30 ngày tiếp theo (decay > 0, floor >= 0)
 * @param {number} rating
 * @param {string|number|Date} [lastMatchAt]
 * @param {string|number|Date} [asOfDate]
 */
export function applyInactivityDecay(rating, lastMatchAt, asOfDate = new Date()) {
  const currentRating = Math.max(MIN_RATING, Math.round(rating || 0))
  if (!lastMatchAt) {
    return {
      rating: currentRating,
      daysInactive: 0,
      isInactive: false,
      decayAmount: 0,
    }
  }

  const lastDate = new Date(lastMatchAt).getTime()
  const refDate = new Date(asOfDate).getTime()
  if (isNaN(lastDate) || isNaN(refDate) || refDate <= lastDate) {
    return {
      rating: currentRating,
      daysInactive: 0,
      isInactive: false,
      decayAmount: 0,
    }
  }

  const daysInactive = Math.floor((refDate - lastDate) / (1000 * 60 * 60 * 24))
  const warnDays = cfg.rating?.inactivity?.warnDays ?? 30
  const decayDays = cfg.rating?.inactivity?.decayDays ?? 45
  const decayAmountPerPeriod = cfg.rating?.inactivity?.decayAmount ?? 10

  if (daysInactive < warnDays) {
    return {
      rating: currentRating,
      daysInactive,
      isInactive: false,
      decayAmount: 0,
    }
  }

  if (daysInactive < decayDays) {
    return {
      rating: currentRating,
      daysInactive,
      isInactive: true,
      decayAmount: 0,
    }
  }

  // Quá decayDays (45 ngày): tính số chu kỳ 30 ngày kế tiếp
  const periods = Math.floor((daysInactive - decayDays) / 30) + 1
  const totalDecay = periods * decayAmountPerPeriod
  const decayedRating = Math.max(MIN_RATING, currentRating - totalDecay)

  return {
    rating: decayedRating,
    daysInactive,
    isInactive: true,
    decayAmount: totalDecay,
  }
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

/**
 * Trả về mã hiển thị định danh cho một trận đấu (VD: M-01, M-02... hoặc mã kèo CH-001)
 * @param {object} db 
 * @param {object} m 
 */
export function matchCodeOf(db, m) {
  if (!m) return 'M-01'
  if (m.code) return m.code
  if (m.challengeId) {
    const c = (db?.challenges || []).find((x) => x.id === m.challengeId)
    if (c?.code) return c.code
  }
  if (m.sessionId) {
    const sessionMatches = (db?.matches || [])
      .filter((x) => x.sessionId === m.sessionId)
      .slice()
      .sort((a, b) => (a.at || 0) - (b.at || 0) || (a.createdAt || '').localeCompare(b.createdAt || ''))
    const idx = sessionMatches.findIndex((x) => x.id === m.id)
    if (idx >= 0) {
      return `M-${String(idx + 1).padStart(2, '0')}`
    }
  }
  const allMatches = (db?.matches || [])
    .slice()
    .sort((a, b) => (a.at || 0) - (b.at || 0) || (a.createdAt || '').localeCompare(b.createdAt || ''))
  const gIdx = allMatches.findIndex((x) => x.id === m.id)
  return gIdx >= 0 ? `M-${String(gIdx + 1).padStart(2, '0')}` : 'M-01'
}

