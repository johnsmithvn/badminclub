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
export function marginMultiplier(sets, customOptions = null) {
  if (!sets || !sets.length || cfg.rating?.marginOfVictory?.enabled === false) return 1.0
  const played = sets.filter((s) => (s[0] || 0) + (s[1] || 0) > 0)
  if (!played.length) return 1.0
  const diffSum = played.reduce((acc, s) => acc + Math.abs((s[0] || 0) - (s[1] || 0)), 0)
  const avgDiff = diffSum / played.length
  const maxMult = customOptions?.maxMultiplier ?? cfg.rating?.marginOfVictory?.maxMultiplier ?? 1.4
  const divisor = customOptions?.divisor ?? cfg.rating?.marginOfVictory?.divisor ?? 40
  const mult = 1 + (avgDiff / divisor)
  return Math.min(maxMult, Math.max(1.0, Math.round(mult * 100) / 100))
}

/**
 * Phiên bản MOV vNext (Divisor 75, trần 1.20) giúp làm mềm hệ số cách biệt mượt mà,
 * tránh để trận 21-10 chạm kịch trần ngang với trận vỡ trận 21-3.
 */
export function marginMultiplierVNext(sets, maxMult = 1.20, divisor = 75) {
  return marginMultiplier(sets, { maxMultiplier: maxMult, divisor })
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
  const tokenName = tier.token || `rank-${tier.key.replace(/_/g, '-')}`
  const colorToken = `var(--${tokenName})`

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
/**
 * Kiểm tra xem thành viên có đang ở giai đoạn thẩm định (< 5 trận) hay không.
 */
export function isProvisional(gamesCount = 0) {
  return (gamesCount || 0) < 5
}

/**
 * Tính điểm sức mạnh hiệu dụng (Effective Strength) dùng cho thuật toán xếp sân.
 * Co cụm Elo về điểm seed ban đầu đối với người ít trận:
 * - < 5 trận: Seed 60% + Elo 40% (co mạnh nhất để tránh overfit vì vài trận may mắn)
 * - 5–14 trận: Seed 35% + Elo 65%
 * - 15–29 trận: Seed 15% + Elo 85%
 * - ≥ 30 trận: Elo 100% (dữ liệu đã tin cậy hoàn toàn)
 * @param {number} rating - Elo hiện tại
 * @param {number} seedRating - Điểm seed khi vào CLB (theo level)
 * @param {number} gamesCount - Số trận đã đấu
 * @returns {number}
 */
export function effectiveStrengthOf(rating = 0, seedRating = 0, gamesCount = 0) {
  const r = Math.round(rating || 0)
  const seed = Math.round(seedRating || r)
  const g = Math.max(0, gamesCount || 0)
  if (g >= 30) return r
  if (g >= 15) return Math.round(seed * 0.15 + r * 0.85)
  if (g >= 5) return Math.round(seed * 0.35 + r * 0.65)
  return Math.round(seed * 0.60 + r * 0.40)
}

/**
 * Lấy an toàn thông tin rating của 1 người chơi từ playerRatings (hỗ trợ cả Object Map lẫn Array).
 * Trả về rating kỹ thuật và displayRating luôn >= MIN_RATING (0).
 * Nếu chưa đấu trận nào, dùng seed rating gắn với trình độ của thành viên (member.level).
 * @param {Object|Array} playerRatings
 * @param {string} memberId
 * @param {Object} [member]
 * @param {Array<string>} [levels]
 * @returns {{ rating: number, displayRating: number, effectiveStrength: number, seedRating: number, gamesCount: number, confidence: string, isProvisional: boolean, provisionalRemaining: number, winsCount: number, lossesCount: number, tier: Object }}
 */
export function getPlayerRating(playerRatings, memberId, member = null, levels = null) {
  const seedRating = member?.level ? initialRatingOf(member.level, levels) : DEFAULT_RATING
  if (!playerRatings || !memberId) {
    return {
      rating: seedRating,
      displayRating: Math.max(MIN_RATING, seedRating),
      effectiveStrength: seedRating,
      seedRating,
      gamesCount: 0,
      confidence: 'low',
      isProvisional: true,
      provisionalRemaining: 5,
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
      effectiveStrength: seedRating,
      seedRating,
      gamesCount: 0,
      confidence: 'low',
      isProvisional: true,
      provisionalRemaining: 5,
      winsCount: 0,
      lossesCount: 0,
      tier: rankTierOf(seedRating),
    }
  }
  const r = Math.round(found.rating ?? seedRating)
  const gCount = found.gamesCount ?? found.games_count ?? 0
  const eff = effectiveStrengthOf(r, seedRating, gCount)
  return {
    ...found,
    rating: r,
    displayRating: Math.max(MIN_RATING, r),
    effectiveStrength: eff,
    seedRating,
    gamesCount: gCount,
    isProvisional: isProvisional(gCount),
    provisionalRemaining: Math.max(0, 5 - gCount),
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
 * Xếp hạng danh sách thành viên thi đấu chéo giới nhiều nhất và độ tin cậy tương ứng.
 * @param {Object} topCrossMap - Map memberId -> số trận chéo giới tính
 * @param {Object} membersMap - Map memberId -> member object
 * @returns {Array<{ id: string, name: string, member: Object, count: number, confidence: 'low'|'medium'|'high'|'very_high' }>}
 */
export function rankTopCrossGenderPlayers(topCrossMap, membersMap, limit = 8) {
  if (!topCrossMap || typeof topCrossMap !== 'object') return []
  const confThresholds = cfg.rating?.crossGenderConfidence || { low: 5, medium: 15, high: 30 }

  const sorted = Object.entries(topCrossMap)
    .map(([id, count]) => {
      const member = membersMap?.[id] || { id, name: '—' }
      let confidence = 'very_high'
      if (count < confThresholds.low) confidence = 'low'
      else if (count < confThresholds.medium) confidence = 'medium'
      else if (count < confThresholds.high) confidence = 'high'

      return {
        id,
        name: member.name || '—',
        member,
        count,
        confidence,
      }
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  return typeof limit === 'number' && limit > 0 ? sorted.slice(0, limit) : sorted
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
    const teamA = (m.teamA && m.teamA.length) ? m.teamA : (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
    const teamB = (m.teamB && m.teamB.length) ? m.teamB : (m.playerKeys ? m.playerKeys.slice(teamA.length) : [])
    if (!teamA.length || !teamB.length) return m

    ;[...teamA, ...teamB].forEach((id) => {
      if (ratings[id] === undefined) {
        ratings[id] = initialRatingOf('TB', levels)
        gamesCount[id] = 0
      }
    })

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
      teamA,
      teamB,
      initialRatingA: ra,
      initialRatingB: rb,
      winnerTeam,
      eloDelta: Math.abs(delta),
    }
  })

  // Dựng kết quả ratings cuối cùng cho từng người (kèm tier & displayRating)
  const memberIdSet = new Set((members || []).map((m) => m.id))
  const finalRatings = {}
  Object.keys(ratings).forEach((id) => {
    if (!memberIdSet.has(id)) return
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

/* ==========================================================================
 * TẦNG CẶP & KHẮC CHẾ (PAIR SYNERGY & OPPONENT MATCHUP - vNext Spec)
 * Nguyên tắc: Expected vs Actual (Kỳ vọng vs Thực tế) & Đơn vị Impact: pp
 * ========================================================================== */

/**
 * Phân cấp bậc độ tin cậy R1 – R4 theo số trận mẫu.
 * R1: < 5 trận (●○○○, trọng số 0.0, thẩm định)
 * R2: 5–11 trận (●●○○, trọng số 0.5, vừa)
 * R3: 12–29 trận (●●●○, trọng số 1.0, cao)
 * R4: >= 30 trận (●●●●, trọng số 1.0, rất cao)
 * @param {number} gamesCount
 * @returns {{ tier: 'R1'|'R2'|'R3'|'R4', dots: string, weight: number, isProvisional: boolean, labelKey: string }}
 */
export function confidenceLevelOf(gamesCount = 0) {
  const g = Math.max(0, gamesCount || 0)
  if (g < 5) return { tier: 'R1', dots: '●○○○', weight: 0.0, isProvisional: true, labelKey: 'rating.confidence.r1' }
  if (g < 12) return { tier: 'R2', dots: '●●○○', weight: 0.5, isProvisional: false, labelKey: 'rating.confidence.r2' }
  if (g < 30) return { tier: 'R3', dots: '●●●○', weight: 1.0, isProvisional: false, labelKey: 'rating.confidence.r3' }
  return { tier: 'R4', dots: '●●●●', weight: 1.0, isProvisional: false, labelKey: 'rating.confidence.r4' }
}

/**
 * Chuẩn hóa độ lệch kỳ vọng (pairImpact) thành Điểm Ăn Ý (SynergyScore 0–100).
 * Áp dụng Bayesian Shrinkage để co cụm về mức trung tính 50 khi ít trận.
 * - pairImpact = +17pp với 18 trận -> Ăn ý 91 (khớp design AY1/AY2).
 * - pairImpact = -17pp với 15 trận -> Ăn ý 38 (khớp design AY1).
 * @param {number} pairImpact - Điểm phần trăm chênh lệch giữa thực tế và kỳ vọng (pp)
 * @param {number} gamesCount - Số trận của cặp
 * @returns {number} Điểm ăn ý từ 10 đến 99 (50 là trung tính)
 */
export function normalizeSynergyScore(pairImpact = 0, gamesCount = 0) {
  if (!gamesCount || gamesCount <= 0) return 50
  const c = Math.min(1.0, gamesCount / 15)
  let scaled = 50
  if (pairImpact >= 0) {
    scaled = 50 + pairImpact * 2.41 * c
  } else {
    scaled = 50 + pairImpact * 0.70 * c
  }
  return Math.max(10, Math.min(99, Math.round(scaled)))
}

/**
 * Tính toán hiệu quả thực tế của cặp đôi (Pair Impact & Synergy).
 * @param {Array} matches - Danh sách trận đấu
 * @param {string} playerAKey - ID người chơi A
 * @param {string} playerBKey - ID người chơi B
 * @param {Object} [ratingsMap] - Map ID -> rating
 */
export function calcPairImpact(matches = [], playerAKey, playerBKey, ratingsMap = {}) {
  if (!playerAKey || !playerBKey || playerAKey === playerBKey) {
    return {
      playerA: playerAKey,
      playerB: playerBKey,
      pairKey: '',
      gamesCount: 0,
      winsCount: 0,
      lossesCount: 0,
      actualWinPct: 50,
      expectedWinPct: 50,
      pairImpact: 0,
      synergyScore: 50,
      recentResults: [],
      formKey: 'stable',
      confidence: confidenceLevelOf(0),
      pairMatches: [],
    }
  }

  const pairKey = [playerAKey, playerBKey].sort().join('::')
  const pairMatches = []

  ;(matches || []).forEach((m) => {
    if (!m || !m.winnerTeam) return
    const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
    const teamB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])

    const inA = teamA.includes(playerAKey) && teamA.includes(playerBKey)
    const inB = teamB.includes(playerAKey) && teamB.includes(playerBKey)
    if (!inA && !inB) return

    const won = inA ? m.winnerTeam === 'A' : m.winnerTeam === 'B'

    let expA = 0.5
    if (m.initialRatingA != null && m.initialRatingB != null) {
      expA = expectedScore(m.initialRatingA, m.initialRatingB)
    } else if (ratingsMap && Object.keys(ratingsMap).length > 0) {
      const ra = teamRating(teamA, ratingsMap)
      const rb = teamRating(teamB, ratingsMap)
      expA = expectedScore(ra, rb)
    }
    const myExpected = inA ? expA : (1 - expA)
    const at = m.at || (m.playedAt ? Date.parse(m.playedAt) : 0) || (m.createdAt ? Date.parse(m.createdAt) : 0)

    pairMatches.push({
      id: m.id,
      at,
      won,
      myExpected,
      sets: m.sets || [],
      opponentTeam: inA ? teamB : teamA,
    })
  })

  pairMatches.sort((a, b) => (a.at || 0) - (b.at || 0))

  const gamesCount = pairMatches.length
  const winsCount = pairMatches.filter((x) => x.won).length
  const lossesCount = gamesCount - winsCount

  const actualWinPct = gamesCount > 0 ? Math.round((winsCount / gamesCount) * 100) : 50
  const sumExp = pairMatches.reduce((acc, x) => acc + x.myExpected, 0)
  const expectedWinPct = gamesCount > 0 ? Math.round((sumExp / gamesCount) * 100) : 50
  const pairImpact = actualWinPct - expectedWinPct

  const confidence = confidenceLevelOf(gamesCount)
  const synergyScore = normalizeSynergyScore(pairImpact, gamesCount)

  const recentResults = pairMatches.slice(-5).map((x) => (x.won ? 'W' : 'L'))
  const recentWins = recentResults.filter((r) => r === 'W').length

  let formKey = 'stable'
  if (recentResults.length >= 4 && recentWins >= 4) formKey = 'hot'
  else if (recentResults.length >= 4 && recentWins <= 1) formKey = 'slump'

  return {
    playerA: playerAKey,
    playerB: playerBKey,
    pairKey,
    gamesCount,
    winsCount,
    lossesCount,
    actualWinPct,
    expectedWinPct,
    pairImpact,
    synergyScore,
    recentResults,
    formKey,
    confidence,
    pairMatches,
  }
}

/**
 * Tính xu hướng ăn ý gần đây của cặp (Synergy Trend: 'up' | 'down' | 'steady').
 */
export function calcSynergyTrend(matches = [], playerAKey, playerBKey, ratingsMap = {}) {
  const info = calcPairImpact(matches, playerAKey, playerBKey, ratingsMap)
  if (info.gamesCount < 5) return 'steady'

  const pairMatches = info.pairMatches || []
  const recentWindow = pairMatches.slice(-5)
  const priorWindow = pairMatches.slice(0, -5)
  if (!priorWindow.length) return 'steady'

  const rateOf = (arr) => arr.filter((x) => x.won).length / arr.length
  const recentRate = rateOf(recentWindow)
  const priorRate = rateOf(priorWindow)
  const diff = recentRate - priorRate

  if (diff >= 0.15) return 'up'
  if (diff <= -0.15) return 'down'
  return 'steady'
}

/**
 * Tính hệ số khắc chế / kỵ giơ đối đầu có hướng (Opponent Matchup Edge) giữa Cặp A và Cặp B.
 * H2H ≠ Matchup: H2H ghi lịch sử, Matchup ghi lợi thế kỳ vọng thực tế.
 */
export function calcMatchupEdge(matches = [], pairAKeys = [], pairBKeys = [], ratingsMap = {}) {
  if (!pairAKeys?.length || !pairBKeys?.length) {
    return {
      gamesCount: 0,
      winsCount: 0,
      actualWinPct: 50,
      expectedWinPct: 50,
      matchupImpact: 0,
      advantageScore: 50,
      confidence: confidenceLevelOf(0),
      recentScores: [],
    }
  }

  const pA1 = pairAKeys[0]
  const pA2 = pairAKeys[1]
  const pB1 = pairBKeys[0]
  const pB2 = pairBKeys[1]

  const h2hMatches = []
  ;(matches || []).forEach((m) => {
    if (!m || !m.winnerTeam) return
    const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
    const teamB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])

    const aInA = pA2 ? (teamA.includes(pA1) && teamA.includes(pA2)) : teamA.includes(pA1)
    const bInB = pB2 ? (teamB.includes(pB1) && teamB.includes(pB2)) : teamB.includes(pB1)

    const aInB = pA2 ? (teamB.includes(pA1) && teamB.includes(pA2)) : teamB.includes(pA1)
    const bInA = pB2 ? (teamA.includes(pB1) && teamA.includes(pB2)) : teamA.includes(pB1)

    if ((aInA && bInB) || (aInB && bInA)) {
      const won = aInA ? m.winnerTeam === 'A' : m.winnerTeam === 'B'
      
      let expA = 0.5
      if (m.initialRatingA != null && m.initialRatingB != null) {
        expA = expectedScore(m.initialRatingA, m.initialRatingB)
      } else if (ratingsMap && Object.keys(ratingsMap).length > 0) {
        const ra = teamRating(teamA, ratingsMap)
        const rb = teamRating(teamB, ratingsMap)
        expA = expectedScore(ra, rb)
      }
      const pairAExp = aInA ? expA : (1 - expA)

      h2hMatches.push({
        id: m.id,
        won,
        pairAExp,
        sets: m.sets || [],
        at: m.at || (m.playedAt ? Date.parse(m.playedAt) : 0),
      })
    }
  })

  h2hMatches.sort((a, b) => (a.at || 0) - (b.at || 0))
  const gamesCount = h2hMatches.length
  if (gamesCount === 0) {
    return {
      gamesCount: 0,
      winsCount: 0,
      actualWinPct: 50,
      expectedWinPct: 50,
      matchupImpact: 0,
      advantageScore: 50,
      confidence: confidenceLevelOf(0),
      recentScores: [],
    }
  }

  const winsCount = h2hMatches.filter((x) => x.won).length
  const actualWinPct = Math.round((winsCount / gamesCount) * 100)
  const sumExp = h2hMatches.reduce((acc, x) => acc + x.pairAExp, 0)
  const expectedWinPct = Math.round((sumExp / gamesCount) * 100)
  const matchupImpact = actualWinPct - expectedWinPct

  const c = Math.min(1.0, gamesCount / 10)
  const advantageScore = Math.max(10, Math.min(99, Math.round(50 + matchupImpact * 1.2 * c)))

  const recentScores = []
  h2hMatches.slice(-5).forEach((m) => {
    (m.sets || []).forEach(([sa, sb]) => {
      if (sa != null && sb != null) recentScores.push(`${sa}–${sb}`)
    })
  })

  return {
    gamesCount,
    winsCount,
    actualWinPct,
    expectedWinPct,
    matchupImpact,
    advantageScore,
    confidence: confidenceLevelOf(gamesCount),
    recentScores,
  }
}

/**
 * Tổng hợp và xếp hạng toàn bộ các cặp đấu trong CLB (Tab Ăn ý & Khắc chế - AY1).
 */
export function rankPairs(matches = [], membersMap = {}, ratingsMap = {}, options = {}) {
  const { formatFilter = 'all', minGames = 1 } = options
  const pairMap = new Map()

  ;(matches || []).forEach((m) => {
    if (!m || !m.winnerTeam) return
    const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
    const teamB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])

    if (teamA.length >= 2) {
      const k = [teamA[0], teamA[1]].sort().join('::')
      pairMap.set(k, [teamA[0], teamA[1]])
    }
    if (teamB.length >= 2) {
      const k = [teamB[0], teamB[1]].sort().join('::')
      pairMap.set(k, [teamB[0], teamB[1]])
    }
  })

  const list = []
  pairMap.forEach(([p1, p2]) => {
    const info = calcPairImpact(matches, p1, p2, ratingsMap)
    if (info.gamesCount < minGames) return

    const m1 = membersMap[p1] || { id: p1, name: p1 }
    const m2 = membersMap[p2] || { id: p2, name: p2 }

    const isF1 = m1.gender === 'nu' || m1.gender === 'Nữ' // i18n-ok: gender check
    const isF2 = m2.gender === 'nu' || m2.gender === 'Nữ' // i18n-ok: gender check
    let format = 'MD'
    if (isF1 && isF2) format = 'WD'
    else if (isF1 || isF2) format = 'XD'

    if (formatFilter !== 'all' && format !== formatFilter) return

    const trend = calcSynergyTrend(matches, p1, p2, ratingsMap)
    const r1 = ratingsMap[p1] || 1500
    const r2 = ratingsMap[p2] || 1500

    list.push({
      ...info,
      memberA: m1,
      memberB: m2,
      format,
      trend,
      combinedRating: r1 + r2,
      r1,
      r2,
    })
  })

  list.sort((a, b) => {
    if (a.confidence.tier === 'R1' && b.confidence.tier !== 'R1') return 1
    if (a.confidence.tier !== 'R1' && b.confidence.tier === 'R1') return -1
    return b.synergyScore - a.synergyScore || b.gamesCount - a.gamesCount
  })

  const rankedPairs = list.map((item, idx) => ({ ...item, rank: idx + 1 }))
  const qualified = rankedPairs.filter((p) => p.gamesCount >= 5)

  const topPair = qualified[0] || rankedPairs[0] || null
  const underperformingPair = qualified.length > 1
    ? [...qualified].sort((a, b) => a.synergyScore - b.synergyScore)[0]
    : null
  const provisionalPairs = rankedPairs.filter((p) => p.gamesCount < 5)

  return {
    rankedPairs,
    topPair,
    underperformingPair,
    provisionalPairs,
    totalPairsCount: rankedPairs.length,
  }
}

/**
 * Thống kê năng lực theo từng thể thức (Format Ratings: Career, Doubles, Mixed, Singles - AY3).
 */
export function getPlayerFormatRatings(matches = [], memberId, ratingsMap = {}, membersMap = {}) {
  const careerElo = ratingsMap[memberId] || DEFAULT_RATING

  const buckets = {
    doubles: { wins: 0, total: 0 },
    mixed: { wins: 0, total: 0 },
    singles: { wins: 0, total: 0 },
  }

  ;(matches || []).forEach((m) => {
    if (!m || !m.winnerTeam) return
    const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
    const teamB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])

    const inA = teamA.includes(memberId)
    const inB = teamB.includes(memberId)
    if (!inA && !inB) return

    const isWon = inA ? m.winnerTeam === 'A' : m.winnerTeam === 'B'
    const isSingles = teamA.length === 1 && teamB.length === 1
    const myTeam = inA ? teamA : teamB

    if (isSingles) {
      buckets.singles.total++
      if (isWon) buckets.singles.wins++
    } else {
      buckets.doubles.total++
      if (isWon) buckets.doubles.wins++

      const teamPlayers = myTeam.map((id) => membersMap[id]).filter(Boolean)
      const hasFemale = teamPlayers.some((p) => p.gender === 'nu' || p.gender === 'Nữ') // i18n-ok: gender check
      const hasMale = teamPlayers.some((p) => p.gender !== 'nu' && p.gender !== 'Nữ') // i18n-ok: gender check
      if (hasFemale && hasMale) {
        buckets.mixed.total++
        if (isWon) buckets.mixed.wins++
      }
    }
  })

  const calcShrinkRating = (wins, total) => {
    if (!total) return { rating: careerElo, gamesCount: 0, winsCount: 0, lossesCount: 0, winPct: 0, confidence: confidenceLevelOf(0), isProvisional: true }
    const winRate = wins / total
    const rawDelta = (winRate - 0.5) * 300
    const weight = Math.min(0.85, total / 30)
    const r = Math.round(careerElo + rawDelta * weight)
    return {
      rating: r,
      gamesCount: total,
      winsCount: wins,
      lossesCount: total - wins,
      winPct: Math.round(winRate * 100),
      confidence: confidenceLevelOf(total),
      isProvisional: total < 5,
    }
  }

  return {
    career: { rating: careerElo, gamesCount: buckets.doubles.total + buckets.singles.total },
    doubles: calcShrinkRating(buckets.doubles.wins, buckets.doubles.total),
    mixed: calcShrinkRating(buckets.mixed.wins, buckets.mixed.total),
    singles: calcShrinkRating(buckets.singles.wins, buckets.singles.total),
  }
}

/**
 * Tìm bạn đấu hợp nhất (Best Partners) và đối thủ kỵ giơ nhất (Nemeses) của một thành viên (AY3).
 */
export function getPlayerPartnersAndMatchups(matches = [], memberId, membersMap = {}, ratingsMap = {}) {
  const partnerKeys = new Set()
  const opponentKeys = new Set()

  ;(matches || []).forEach((m) => {
    if (!m || !m.winnerTeam) return
    const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
    const teamB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])

    const inA = teamA.includes(memberId)
    const inB = teamB.includes(memberId)
    if (!inA && !inB) return

    const myTeam = inA ? teamA : teamB
    const oppTeam = inA ? teamB : teamA

    myTeam.forEach((id) => { if (id !== memberId) partnerKeys.add(id) })
    oppTeam.forEach((id) => opponentKeys.add(id))
  })

  const partners = []
  partnerKeys.forEach((partnerId) => {
    const info = calcPairImpact(matches, memberId, partnerId, ratingsMap)
    if (!info.gamesCount) return
    partners.push({
      ...info,
      partner: membersMap[partnerId] || { id: partnerId, name: partnerId },
    })
  })
  partners.sort((a, b) => b.synergyScore - a.synergyScore || b.gamesCount - a.gamesCount)

  const opponents = []
  opponentKeys.forEach((oppId) => {
    const edge = calcMatchupEdge(matches, [memberId], [oppId], ratingsMap)
    if (!edge.gamesCount) return
    opponents.push({
      ...edge,
      opponent: membersMap[oppId] || { id: oppId, name: oppId },
    })
  })

  const favoriteOpponents = opponents.filter((x) => x.matchupImpact >= 0).sort((a, b) => b.actualWinPct - a.actualWinPct)
  const nemeses = opponents.filter((x) => x.matchupImpact < 0).sort((a, b) => a.actualWinPct - b.actualWinPct)

  return {
    bestPartners: partners,
    favoriteOpponents,
    nemeses,
  }
}

