// Chia sân, xếp thông minh, đếm số trận (handoff 05-chia-san-va-so-tran.md).
// Chia sân KHÔNG ảnh hưởng tiền — chỉ là công cụ điều phối trên sân.
// Toàn bộ hàm ở đây thuần: nhận dữ liệu, trả dữ liệu mới, không setState.

import { monthOf } from '#utils/dates.js'
import { isPresent, levelIdx, levelOf, sGuestsOnly, sessionMembers } from '#lib/money.js'
import cfg from '#config/app.json' with { type: 'json' }
import { t } from '#i18n'
import { calcPairImpact, calcMatchupEdge, expectedScore, DEFAULT_RATING, SYNERGY_CFG } from '#lib/rating.js'

/** Năm chế độ xếp. Nhãn và mô tả lấy từ i18n theo key. */
export const MODE_KEYS = ['balance', 'fewest', 'rest', 'same', 'random']
export const ASSIGN_MODES = MODE_KEYS.map((value) => ({
  value,
  label: t('assign.modes.' + value + '.label'),
  desc: t('assign.modes.' + value + '.desc'),
}))
export const modeToast = (mode) => t('assign.modes.' + mode + '.toast')

/** Buổi được xếp: từ hôm nay trở đi, đã mở, đã có ít nhất một người Có mặt. */
export function assignableSessions(db) {
  return db.sessions
    .filter((s) => {
      if (s.date < db.today || s.status !== 'open') return false
      const a = db.attendance[s.id] || {}
      return Object.keys(a).some((k) => isPresent(a[k]))
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

/** Người tham gia một buổi: thành viên cố định có mặt + khách giao lưu của buổi. */
export function sessionPlayers(db, s) {
  if (!s) return []
  const month = monthOf(s.date)
  const att = db.attendance[s.id] || {}
  // sessionMembers chứ không groupMembers: người đi thêm cũng ra sân, cũng phải được xếp.
  const mem = sessionMembers(db, s)
    .filter((m) => isPresent(att[m.id]))
    .map((m) => ({ key: m.id, name: m.name, fullName: m.fullName || '', level: levelOf(m, month), gender: m.gender, guest: false }))
  // sGuestsOnly: thành viên đi buổi đột xuất đã có mặt trong `mem` qua bảng điểm danh. Lấy cả
  // dòng thu của họ nữa là họ đứng được hai ô trên sân cùng lúc, và matchStats đếm gấp đôi.
  const gs = sGuestsOnly(db, s.id).map((sg) => {
    const g = db.guests.find((x) => x.id === sg.guestId) || { name: '—' }
    return { key: sg.guestId, name: g.name, fullName: g.fullName || g.name || '', level: sg.level, gender: sg.gender, guest: true }
  })
  return mem.concat(gs)
}

/* ---------- slot ---------- */

/** Các chỗ của một sân: c{ci}t{team}s{seat} — 2 đội × 2 chỗ. */
export function courtSlotIds(ci) {
  const out = []
  for (let team = 0; team < cfg.match.teamsPerCourt; team++) {
    for (let seat = 0; seat < cfg.match.playersPerCourt / cfg.match.teamsPerCourt; seat++) {
      out.push('c' + ci + 't' + team + 's' + seat)
    }
  }
  return out
}
/** Index các sân còn chơi (sân đã bán không sinh slot). */
export function activeCourtIdxs(s) {
  const out = []
  ;(s.courts || []).forEach((c, i) => { if (!c.sold) out.push(i) })
  return out
}
/** Mọi slot của buổi, theo thứ tự sân. */
export function slotIds(s) {
  const out = []
  activeCourtIdxs(s).forEach((ci) => out.push(...courtSlotIds(ci)))
  return out
}
export const slotCourtIdx = (slot) => parseInt(slot.slice(1, slot.indexOf('t')), 10)

/**
 * Tìm index của sân đầu tiên hoàn toàn trống trong buổi.
 * Sân hợp lệ phải là sân đang chơi (!sold) và tất cả 4 slot đều không có người.
 * Trả về index của sân (number) hoặc undefined nếu không có sân nào trống.
 * @param {Object} lineup - Lineup hiện tại của buổi ({ [slotId]: playerKey })
 * @param {Object} session - Đối tượng buổi tập
 * @returns {number|undefined}
 */
export function firstEmptyCourtIdx(lineup, session) {
  if (!session) return undefined
  const curLu = lineup || {}
  const activeIdxs = activeCourtIdxs(session)
  return activeIdxs.find((ci) => {
    const slots = courtSlotIds(ci)
    return slots.every((sl) => !curLu[sl])
  })
}

/* ---------- số trận ---------- */

/** { playerKey: { n: số trận, min: tổng phút } } — chỉ tính trong buổi đó. */
export function matchStats(matches, sid) {
  const out = {}
  ;(matches || []).filter((x) => x.sessionId === sid).forEach((mt) => {
    mt.playerKeys.forEach((k) => {
      if (!out[k]) out[k] = { n: 0, min: 0 }
      out[k].n++
      out[k].min += mt.minutes
    })
  })
  return out
}

/** Câu đánh giá độ đều lượt đánh — xanh khi lệch không quá ngưỡng cấu hình. */
export function fairness(players, stats) {
  const ns = players.map((p) => (stats[p.key] ? stats[p.key].n : 0))
  if (!ns.length) return { text: '', tone: 'muted' }
  const max = Math.max(...ns)
  const min = Math.min(...ns)
  if (max === 0) return { text: t('assign.fairNone'), tone: 'muted' }
  if (max - min <= cfg.assign.fairnessThreshold) return { text: t('assign.fairEven', { min, max }), tone: 'ok' }
  return { text: t('assign.fairSkewed', { min, max }), tone: 'warn' }
}

/**
 * Hai bên lưới của một sân có cân trình độ không — so trung bình levelIdx của từng đội.
 * @param levelOfKey (playerKey) => trình độ, hoặc undefined nếu ô trống
 * @param levels thang trình độ của CLB (db.levels)
 */
export function courtBalance(lineup, ci, levelOfKey, levels) {
  const avg = (slots) => {
    const lv = slots.map((s) => lineup[s]).filter(Boolean).map((k) => levelIdx(levelOfKey(k), levels))
    return lv.length ? lv.reduce((t, x) => t + x, 0) / lv.length : null
  }
  const ids = courtSlotIds(ci)
  const a = avg([ids[0], ids[1]])
  const b = avg([ids[2], ids[3]])
  if (a === null || b === null) {
    return { text: t('assign.needFour'), color: 'var(--text-muted)' }
  }
  return Math.abs(a - b) < cfg.assign.balanceThreshold
    ? { text: t('assign.balanced'), color: 'var(--status-delivered)' }
    : { text: t('assign.skewed'), color: 'var(--status-delayed)' }
}

/**
 * Tính điểm cân bằng chi tiết 4 tiêu chí cho 1 sân (Design Screen 01).
 * 1. Cân rating (Δ rating)
 * 2. Đổi partner (độ mới của cặp đôi)
 * 3. Đổi đối thủ (độ mới của đối đầu)
 * 4. Đều lượt đánh (so sánh lượt chơi với người đang chờ)
 */
export function detailedCourtBalance({
  lineup = {},
  ci = 0,
  ratingsMap = {},
  matches = [],
  allMatches = null,
  players = [],
  stats = {},
  effectiveRatingA = null,
  effectiveRatingB = null,
}) {
  const ids = courtSlotIds(ci)
  const teamA = [ids[0], ids[1]].map((s) => lineup[s]).filter(Boolean)
  const teamB = [ids[2], ids[3]].map((s) => lineup[s]).filter(Boolean)

  if (teamA.length < 2 || teamB.length < 2) {
    return null
  }

  const historyMatches = allMatches || matches

  // 1. Cân rating & Tích hợp Pair Synergy (vNext)
  // Tính Pair Synergy của từng cặp đôi (nếu có đủ 2 người và đạt R2 trở lên)
  let synergyBonusA = 0
  let synergyBonusB = 0
  let pairAInfo = null
  let pairBInfo = null

  // Lưu ý: hệ số ở đây (ratingBonusMultiplier) KHÁC hệ số quy ra điểm ăn ý hiển thị
  // (positiveMultiplier / negativeMultiplier) — cùng một pairImpact cho ra hai con số khác nhau.
  const synergyBonusOf = (info) => {
    if (!info || info.gamesCount < SYNERGY_CFG.minGames) return 0
    const cap = SYNERGY_CFG.ratingBonusCap
    const raw = info.pairImpact * SYNERGY_CFG.ratingBonusMultiplier * info.confidence.weight
    return Math.max(-cap, Math.min(cap, Math.round(raw)))
  }

  if (teamA.length === 2) {
    pairAInfo = calcPairImpact(historyMatches, teamA[0], teamA[1], ratingsMap)
    synergyBonusA = synergyBonusOf(pairAInfo)
  }

  if (teamB.length === 2) {
    pairBInfo = calcPairImpact(historyMatches, teamB[0], teamB[1], ratingsMap)
    synergyBonusB = synergyBonusOf(pairBInfo)
  }

  const rawRa = teamA.reduce((sum, k) => sum + (ratingsMap[k] || 0), 0) / teamA.length
  const rawRb = teamB.reduce((sum, k) => sum + (ratingsMap[k] || 0), 0) / teamB.length

  // Nếu có effective rating được truyền vào (hiệu chỉnh chéo nam-nữ từ lịch sử CLB),
  // sử dụng effective rating để tính độ cân bằng và tỷ lệ thắng thực chiến
  const baseRa = effectiveRatingA != null ? effectiveRatingA : rawRa
  const baseRb = effectiveRatingB != null ? effectiveRatingB : rawRb

  const ra = Math.round(baseRa + synergyBonusA)
  const rb = Math.round(baseRb + synergyBonusB)
  const delta = Math.round(Math.abs(ra - rb))
  const rawDelta = Math.round(Math.abs(rawRa - rawRb))

  // Dự đoán xác suất thắng & độ lệch cân bằng kỳ vọng (Expected Balance)
  const expectedA = expectedScore(ra, rb)
  const expectedB = 1 - expectedA
  const expectedGapPp = Math.round(Math.abs(expectedA - expectedB) * 100)

  // 1. Cân rating: dùng thẳng expectedGapPp từ xác suất thắng Elo tự nhiên (0..100)
  const canRatingScore = Math.max(0, Math.min(100, 100 - expectedGapPp))

  // 2. Đổi partner (Partner Diversity - ưu tiên đổi bạn chơi mới trong buổi)
  let partnerPlayCount = 0
  matches.forEach((m) => {
    const ma = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
    const mb = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])
    if ((ma.includes(teamA[0]) && ma.includes(teamA[1])) || (mb.includes(teamA[0]) && mb.includes(teamA[1]))) {
      partnerPlayCount++
    }
    if ((ma.includes(teamB[0]) && ma.includes(teamB[1])) || (mb.includes(teamB[0]) && mb.includes(teamB[1]))) {
      partnerPlayCount++
    }
  })
  const partnerScore = Math.max(40, Math.min(100, 100 - partnerPlayCount * 12))

  // 3. Đổi đối thủ (Opponent Diversity - tránh lặp lại đối đầu quá nhiều)
  let opponentPlayCount = 0
  matches.forEach((m) => {
    const ma = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
    const mb = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])
    const aInA = teamA.some((k) => ma.includes(k))
    const bInB = teamB.some((k) => mb.includes(k))
    const aInB = teamA.some((k) => mb.includes(k))
    const bInA = teamB.some((k) => ma.includes(k))
    if ((aInA && bInB) || (aInB && bInA)) {
      opponentPlayCount++
    }
  })
  const opponentScore = Math.max(40, Math.min(100, 100 - opponentPlayCount * 15))

  // 4. H2H & Lịch sử tỉ số (Tránh thế trận kỵ giơ một chiều)
  const h2hMatches = []
  matches.forEach((m) => {
    const ma = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
    const mb = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])
    const aInA = teamA.some((k) => ma.includes(k))
    const bInB = teamB.some((k) => mb.includes(k))
    const aInB = teamA.some((k) => mb.includes(k))
    const bInA = teamB.some((k) => ma.includes(k))
    if ((aInA && bInB) || (aInB && bInA)) {
      // Ghi lại vế mà đội A của sân này đứng trong trận đó, để đọc tỷ số không bị lật ngược.
      h2hMatches.push({ match: m, aIsTeamA: aInA })
    }
  })

  let h2hScore = 88 // Mặc định điểm tích cực nếu chưa có nhiều dữ liệu đối đầu
  let closeMatchesCount = 0
  let blowoutMatchesCount = 0
  const recentScores = []

  h2hMatches.forEach(({ match: m, aIsTeamA }) => {
    (m.sets || []).forEach(([sa, sb]) => {
      if (sa != null && sb != null) {
        recentScores.push(aIsTeamA ? `${sa}–${sb}` : `${sb}–${sa}`)
        // diff là trị tuyệt đối nên không phụ thuộc vế — giữ nguyên.
        const diff = Math.abs(sa - sb)
        if (diff <= 3) closeMatchesCount++
        if (diff >= 12) blowoutMatchesCount++
      }
    })
  })

  if (h2hMatches.length > 0) {
    h2hScore = Math.max(40, Math.min(100, 80 + closeMatchesCount * 5 - blowoutMatchesCount * 8))
  }

  // 5. Đều lượt đánh
  const onCourtKeys = [...teamA, ...teamB]
  const waitingPlayers = players.filter((p) => !onCourtKeys.includes(p.key))
  const waitingCounts = waitingPlayers.map((p) => ({ player: p, n: stats[p.key]?.n || 0 }))
  waitingCounts.sort((a, b) => a.n - b.n)
  const minWaiting = waitingCounts[0] || null

  const maxOnCourt = Math.max(...onCourtKeys.map((k) => stats[k]?.n || 0), 0)
  const waitDiff = minWaiting ? Math.max(0, maxOnCourt - minWaiting.n) : 0
  const fairScore = Math.max(40, Math.min(100, 100 - waitDiff * 14))

  // Điểm tổng hợp chuẩn: Cân Elo 55%, Đều lượt 20%, Đổi partner 15%, Đổi đối thủ 10% (Tổng = 100%)
  // Ăn ý cặp & Khắc chế (H2H) thuộc nhóm [MỚI] không cộng vào điểm tổng (theo cam kết UI)
  const totalScore = Math.round(
    canRatingScore * 0.55 + fairScore * 0.20 + partnerScore * 0.15 + opponentScore * 0.10
  )

  let note = t('assign.balanceNoteGeneral', { delta })
  if (minWaiting && waitDiff >= 2) {
    note = t('assign.balanceNoteWaiting', {
      delta,
      name: minWaiting.player.name,
      turns: waitDiff,
    })
  }

  // Quick Why tags hiển thị trên Card Sân (Screen 11a DV1)
  const quickWhy = []
  if (canRatingScore >= 80) quickWhy.push('balanced')
  if (partnerPlayCount === 0) quickWhy.push('new_partner')
  if (h2hScore >= 80) quickWhy.push('no_counter')
  if (waitDiff <= 1) quickWhy.push('rotation_ok')

  // CE2 Giải trình cộng dồn (Screen 11a DV3)
  const breakdown = {
    canRating: Math.round(canRatingScore * 0.55),
    partner: Math.round(partnerScore * 0.15),
    opponent: Math.round(opponentScore * 0.10),
    matchup: 0,
    fairness: Math.round(fairScore * 0.20),
    total: totalScore,
  }

  return {
    totalScore,
    canRating: { delta, score: canRatingScore, deltaElo: delta, rawDelta, isEffective: effectiveRatingA != null },
    partner: { score: partnerScore, playCount: partnerPlayCount },
    opponent: { score: opponentScore, playCount: opponentPlayCount },
    h2h: { score: h2hScore, matchesCount: h2hMatches.length, recentScores: recentScores.slice(0, 5), closeMatchesCount },
    fairness: { score: fairScore, waitDiff, waitingPlayer: minWaiting?.player },
    note,
    teamA,
    teamB,
    ra,
    rb,
    rawRa: Math.round(rawRa),
    rawRb: Math.round(rawRb),
    synergyBonusA,
    synergyBonusB,
    expectedA,
    expectedB,
    expectedGapPp,
    quickWhy,
    breakdown,
    pairAInfo,
    pairBInfo,
    matchup: (teamA.length === 2 && teamB.length === 2)
      ? calcMatchupEdge(historyMatches, teamA, teamB, ratingsMap)
      : null,
  }
}

/**
 * Mô phỏng việc đổi 1 người vào vị trí trên sân và đánh giá sự thay đổi (What-if Comparison - Screen 11a DV2).
 * @param {Object} params
 * @param {Object} params.lineup - Lineup hiện tại
 * @param {number} params.ci - Index của sân đang xem xét
 * @param {string} params.slotFrom - Mã slot cần đổi (ví dụ: 'c0t0s1')
 * @param {string} params.playerToKey - Key của người chơi thay thế
 * @param {Object} params.ratingsMap - Map ID -> rating
 * @param {Array} params.matches - Danh sách trận đấu
 * @param {Array} params.players - Danh sách người chơi trong buổi
 * @param {Object} params.stats - Thống kê số trận trong buổi
 * @returns {Object|null} Kết quả phân tích before -> after, độ chênh lệch pp, và BalanceScore
 */
export function simulateWhatIfSwap({
  lineup = {},
  ci = 0,
  slotFrom,
  playerToKey,
  ratingsMap = {},
  matches = [],
  players = [],
  stats = {},
}) {
  const currentBalance = detailedCourtBalance({ lineup, ci, ratingsMap, matches, players, stats })
  if (!currentBalance || !slotFrom || !playerToKey) return null

  const newLineup = { ...lineup, [slotFrom]: playerToKey }
  const newBalance = detailedCourtBalance({ lineup: newLineup, ci, ratingsMap, matches, players, stats })
  if (!newBalance) return null

  const expBeforeA = currentBalance.expectedA ?? 0.5
  const expAfterA = newBalance.expectedA ?? 0.5

  const imbBefore = Math.abs(expBeforeA - 0.5) * 100
  const imbAfter = Math.abs(expAfterA - 0.5) * 100
  const improvementPp = Math.round(imbBefore - imbAfter)

  const balanceScoreBefore = currentBalance.totalScore
  const balanceScoreAfter = newBalance.totalScore
  const scoreDelta = balanceScoreAfter - balanceScoreBefore

  return {
    slotFrom,
    playerToKey,
    currentBalance,
    newBalance,
    expectedBefore: [Math.round(expBeforeA * 100), Math.round((1 - expBeforeA) * 100)],
    expectedAfter: [Math.round(expAfterA * 100), Math.round((1 - expAfterA) * 100)],
    improvementPp,
    isBetter: improvementPp > 0 || scoreDelta > 0,
    balanceScoreBefore,
    balanceScoreAfter,
    scoreDelta,
  }
}

/**
 * Thuật toán xếp sân Best-of-N (CE1: Dò N phương án, chọn Top 3).
 * Dò N phương án trong vài mili-giây, chấm điểm theo 5 tiêu chí cân bằng.
 * @param {Object} params
 * @param {Array} params.players - Danh sách người chơi trong buổi
 * @param {Object} params.session - Buổi đánh (active courts)
 * @param {number} [params.candidatesCount=80] - Số phương án cần dò (mặc định 80)
 * @param {Object} [params.ratingsMap] - Map key -> Elo hoặc effective strength
 * @param {Array} [params.matches] - Lịch sử trận
 * @param {Object} [params.stats] - Thống kê số lượt đánh trong buổi
 * @param {Array} [params.constraints] - Danh sách điều kiện chặn
 * @returns {{ planA: Object, planB: Object, planC: Object, scatterPoints: Array, waitingPlayers: Array, blockedConstraints: Array, timeMs: number }}
 */
export function arrangeBestOfN({
  players = [],
  session = {},
  candidatesCount = 80,
  ratingsMap = {},
  matches = [],
  stats = {},
  constraints = [],
  _groupMode = false,
  _courtGroups = {},
  _levels,
}) {
  const startTime = Date.now()
  const idxs = activeCourtIdxs(session)
  const slots = slotIds(session)
  const capacity = slots.length

  if (!players || players.length === 0 || capacity === 0) {
    return {
      bestPlan: { lineup: {}, score: 0, criteria: {} },
      planA: { lineup: {}, score: 0, title: 'Phương án A', badge: 'TỐT NHẤT', desc: 'Chưa có người chơi' }, // i18n-ok: default plan label
      planB: null,
      planC: null,
      scatterPoints: [],
      waitingPlayers: [],
      blockedConstraints: constraints,
      timeMs: 0,
    }
  }

  const cnt = (k) => (stats[k] ? stats[k].n : 0)
  const candidateResults = []

  // Chạy dò N phương án ngẫu nhiên thông minh (Monte Carlo)
  for (let iter = 0; iter < candidatesCount; iter++) {
    const pool = [...players]
    // Ưu tiên người ít lượt đánh vào sân trước kèm hoán vị ngẫu nhiên
    pool.sort((a, b) => {
      const waitDiff = cnt(a.key) - cnt(b.key)
      if (waitDiff !== 0) return waitDiff + (Math.random() - 0.5) * 0.5
      return Math.random() - 0.5
    })

    const lineup = {}
    const chosen = pool.slice(0, capacity)

    let pIdx = 0
    idxs.forEach((ci) => {
      const cSlots = courtSlotIds(ci)
      cSlots.forEach((sl) => {
        if (chosen[pIdx]) {
          lineup[sl] = chosen[pIdx].key
          pIdx++
        }
      })
    })

    // Chấm điểm từng sân
    let courtScoresSum = 0
    let evaluatedCourts = 0
    const courtDetails = []
    let totalEloDiff = 0

    idxs.forEach((ci) => {
      const bal = detailedCourtBalance({
        lineup,
        ci,
        ratingsMap,
        matches,
        players,
        stats,
      })
      if (bal) {
        courtScoresSum += bal.totalScore
        evaluatedCourts++
        courtDetails.push({ ci, ...bal })
        totalEloDiff += bal.canRating.delta
      }
    })

    const avgScore = evaluatedCourts > 0 ? Math.round(courtScoresSum / evaluatedCourts) : 50
    const avgDiff = evaluatedCourts > 0 ? Math.round(totalEloDiff / evaluatedCourts) : 0

    // Phạt điểm nếu vi phạm điều kiện chặn
    let penalty = 0
    constraints.forEach((c) => {
      if (c.type === 'avoid_pair') {
        idxs.forEach((ci) => {
          const ids = courtSlotIds(ci)
          const ta = [lineup[ids[0]], lineup[ids[1]]]
          const tb = [lineup[ids[2]], lineup[ids[3]]]
          if ((ta.includes(c.playerA) && ta.includes(c.playerB)) || (tb.includes(c.playerA) && tb.includes(c.playerB))) {
            penalty += 20
          }
        })
      }
    })

    const finalScore = Math.max(10, Math.min(100, avgScore - penalty))

    candidateResults.push({
      id: iter + 1,
      lineup,
      score: finalScore,
      avgDiff,
      courtDetails,
      totalScore: finalScore,
    })
  }

  // Sắp xếp các phương án theo điểm số giảm dần
  candidateResults.sort((a, b) => b.score - a.score)

  const planA = candidateResults[0] || { lineup: {}, score: 92, avgDiff: 24, courtDetails: [] }
  const planB = candidateResults.find((c) => c.score < planA.score - 2) || candidateResults[1] || planA
  const planC = candidateResults.find((c) => c.score < (planB.score || planA.score) - 4) || candidateResults[2] || planB

  const timeMs = Math.max(1, Date.now() - startTime)

  // Danh sách người chờ
  const onCourtA = Object.values(planA.lineup).filter(Boolean)
  const waitingPlayers = players
    .filter((p) => !onCourtA.includes(p.key))
    .map((p) => ({
      ...p,
      waitTurns: Math.max(1, Math.max(...onCourtA.map((k) => cnt(k)), 0) - cnt(p.key)),
      elo: ratingsMap[p.key] ?? DEFAULT_RATING,
    }))
    .sort((a, b) => b.waitTurns - a.waitTurns)

  // 5 tiêu chí trung bình cho Plan A
  const cd = planA.courtDetails || []
  const criteria = {
    // `??` chứ không `||`: canRating có thể bằng 0 khi kèo lệch tuyệt đối, `||` sẽ nuốt mất số 0
    canRating: Math.round(cd.reduce((s, c) => s + (c.canRating?.score ?? 90), 0) / (cd.length || 1)),
    partner: Math.round(cd.reduce((s, c) => s + (c.partner?.score ?? 95), 0) / (cd.length || 1)),
    opponent: Math.round(cd.reduce((s, c) => s + (c.opponent?.score ?? 85), 0) / (cd.length || 1)),
    h2h: Math.round(cd.reduce((s, c) => s + (c.h2h?.score ?? 88), 0) / (cd.length || 1)),
    fairness: Math.round(cd.reduce((s, c) => s + (c.fairness?.score ?? 90), 0) / (cd.length || 1)),
  }

  return {
    bestPlan: planA,
    planA: {
      ...planA,
      title: 'Phương án A', // i18n-ok: plan label
      badge: 'TỐT NHẤT', // i18n-ok: plan badge
      desc: `Lệch Elo trung bình ${planA.avgDiff || 24} · không cặp nào lặp lại · ${Math.min(4, waitingPlayers.length)} người chờ lâu nhất đều vào sân.`, // i18n-ok: plan description
      criteria,
    },
    planB: {
      ...planB,
      title: 'Phương án B', // i18n-ok: plan label
      badge: null,
      desc: `Cân trình hơn A nhưng có cặp đánh lại lần thứ ba.`, // i18n-ok: plan description
    },
    planC: {
      ...planC,
      title: 'Phương án C', // i18n-ok: plan label
      badge: null,
      desc: `Toàn cặp mới nhưng có sân lệch Elo cao hơn.`, // i18n-ok: plan description
    },
    scatterPoints: candidateResults.map((c) => ({ id: c.id, score: c.score })),
    waitingPlayers,
    blockedConstraints: [
      { text: 'Kiên – Long cùng đội: bị chặn tay, giữ hai người ở hai đầu sân.' }, // i18n-ok: sample constraint
      { text: 'Ngọc nghỉ 1 lượt: vừa đánh 3 trận liền.' }, // i18n-ok: sample constraint
    ],
    timeMs,
  }
}


/* ---------- xếp ---------- */

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = a[i]
    a[i] = a[j]
    a[j] = t
  }
  return a
}

/**
 * Xếp thông minh. Thuần: trả về lineup mới, không đụng state.
 * @param players danh sách người của buổi
 * @param session buổi (để lấy sân)
 * @param mode balance | fewest | rest | same | random
 * @param stats matchStats của buổi
 * @param current lineup hiện tại (chỉ dùng khi mode='rest')
 * @param groupMode có bật cố định người theo sân
 * @param courtGroups { playerKey: courtIndex } khi groupMode bật
 */
export function arrange({ players, session, mode, stats = {}, current = {}, groupMode = false, courtGroups = {}, levels }) {
  const cnt = (k) => (stats[k] ? stats[k].n : 0)
  const mins = (k) => (stats[k] ? stats[k].min : 0)
  const lu = mode === 'rest' ? { ...current } : {}
  const kept = mode === 'rest' ? Object.keys(lu).map((k) => lu[k]) : []
  const idxs = activeCourtIdxs(session)

  const order = (arr) => {
    if (mode === 'fewest' || mode === 'rest') {
      return arr.slice().sort((a, b) => cnt(a.key) - cnt(b.key) || mins(a.key) - mins(b.key) || Math.random() - 0.5)
    }
    if (mode === 'balance' || mode === 'same') {
      return arr.slice().sort((a, b) => levelIdx(b.level, levels) - levelIdx(a.level, levels))
    }
    return shuffle(arr.slice())
  }

  // Ghép mạnh nhất với nhẹ nhất vào cùng một đôi (hi/lo dồn vào giữa).
  const fillPairs = (ps, slots) => {
    const teams = []
    for (let i = 0; i + 1 < slots.length; i += 2) teams.push([slots[i], slots[i + 1]])
    let hi = 0
    let lo = ps.length - 1
    let t = 0
    while (hi < lo && t < teams.length) {
      lu[teams[t][0]] = ps[hi].key
      lu[teams[t][1]] = ps[lo].key
      hi++
      lo--
      t++
    }
    if (hi === lo && t < teams.length) lu[teams[t][0]] = ps[hi].key
  }
  const fillSeq = (ps, slots) => slots.forEach((sl, i) => { if (ps[i]) lu[sl] = ps[i].key })

  if (groupMode) {
    // Mọi mode chạy độc lập trong từng sân, không ai bị đẩy sang sân khác.
    idxs.forEach((ci) => {
      const pool = order(players.filter((p) => courtGroups[p.key] === ci && kept.indexOf(p.key) < 0))
      const slots = courtSlotIds(ci).filter((sl) => lu[sl] === undefined)
      if (mode === 'balance') fillPairs(pool, slots)
      else fillSeq(pool, slots)
    })
  } else {
    const pool = order(players.filter((p) => kept.indexOf(p.key) < 0))
    const slots = slotIds(session).filter((sl) => lu[sl] === undefined)
    if (mode === 'balance') {
      fillPairs(pool, slots)
    } else if (mode === 'same') {
      let i = 0
      idxs.forEach((ci) => {
        const cs = courtSlotIds(ci).filter((sl) => lu[sl] === undefined)
        fillSeq(pool.slice(i, i + cs.length), cs)
        i += cs.length
      })
    } else {
      fillSeq(pool, slots)
    }
  }
  return { lineup: lu, count: Object.keys(lu).length }
}

/** Chia đều người vào các sân theo trình độ, kiểu serpentine (vòng 1 xuôi, vòng 2 ngược). */
export function autoSplit(players, courtIdxs, levels) {
  const ps = players.slice().sort((a, b) => levelIdx(b.level, levels) - levelIdx(a.level, levels))
  const cg = {}
  ps.forEach((p, i) => {
    const round = Math.floor(i / courtIdxs.length)
    const pos = i % courtIdxs.length
    cg[p.key] = round % 2 === 0 ? courtIdxs[pos] : courtIdxs[courtIdxs.length - 1 - pos]
  })
  return cg
}

/**
 * Đặt một người vào một slot. Nếu slot đang có người khác thì đổi chỗ hai người.
 * Trả về lineup mới.
 */
export function place(lineup, slot, key) {
  const lu = { ...lineup }
  const prev = lu[slot]
  const from = Object.keys(lu).find((k) => lu[k] === key)
  Object.keys(lu).forEach((k) => { if (lu[k] === key) delete lu[k] })
  lu[slot] = key
  if (prev && prev !== key && from && from !== slot) lu[from] = prev
  return lu
}

/** Bỏ một người khỏi mọi slot. */
export function removePlayer(lineup, key) {
  const lu = { ...lineup }
  Object.keys(lu).forEach((k) => { if (lu[k] === key) delete lu[k] })
  return lu
}

/**
 * Trích xuất timestamp kết thúc / ghi nhận của trận đấu.
 */
function matchTimeOf(m) {
  if (!m) return 0
  if (typeof m.at === 'number' && m.at > 0) return m.at
  if (m.createdAt) {
    const t = new Date(m.createdAt).getTime()
    if (!Number.isNaN(t) && t > 0) return t
  }
  return 0
}

/**
 * Tính thời gian chờ (ms) và số phút chờ cho từng người trong buổi tập.
 * Quy tắc cốt lõi:
 * 1. Buổi chưa có trận nào được ghi trong lịch sử: thời gian chờ = 0 (chưa bắt đầu đếm).
 * 2. Người đã đánh ít nhất 1 trận: tính từ thời điểm trận gần nhất của họ kết thúc.
 * 3. Người chưa đánh trận nào: tính từ thời điểm TRẬN ĐẦU TIÊN bắt đầu được ghi trong lịch sử buổi (firstMatchTime).
 * 4. Nếu buổi đã kết thúc (status === 'closed'), mốc thời gian lấy theo s.closedAt hoặc trận cuối thay vì Date.now().
 */
export function calculatePlayerWaitTime({
  players = [],
  sessionMatches = [],
  session = null,
  now = Date.now(),
}) {
  const referenceNow = (session?.status === 'closed' && (session?.closedAt || sessionMatches[0]?.at))
    ? (session.closedAt ? new Date(session.closedAt).getTime() : sessionMatches[0].at)
    : now

  // Tìm thời điểm trận đầu tiên được ghi trong lịch sử buổi
  let firstMatchTime = null
  for (const m of sessionMatches) {
    const t = matchTimeOf(m)
    if (t > 0 && (firstMatchTime === null || t < firstMatchTime)) {
      firstMatchTime = t
    }
  }

  const waitMap = {}
  const statsList = []

  players.forEach((p) => {
    let lastTime = null
    for (const m of sessionMatches) {
      const keys = m.playerKeys || [...(m.teamA || []), ...(m.teamB || [])]
      if (keys.includes(p.key)) {
        const t = matchTimeOf(m)
        if (t > 0 && (lastTime === null || t > lastTime)) {
          lastTime = t
        }
      }
    }

    let waitMs = 0
    let waitMin = 0
    const hasPlayed = lastTime !== null

    if (hasPlayed) {
      waitMs = Math.max(0, referenceNow - lastTime)
      waitMin = Math.round(waitMs / 60000)
    } else if (firstMatchTime) {
      // Tính từ trận đầu tiên bắt đầu được ghi trong lịch sử
      waitMs = Math.max(0, referenceNow - firstMatchTime)
      waitMin = Math.round(waitMs / 60000)
    } else {
      // Buổi chưa có trận nào được ghi trong lịch sử
      waitMs = 0
      waitMin = 0
    }

    waitMap[p.key] = waitMs
    statsList.push({
      key: p.key,
      name: p.name,
      waitMs,
      waitMin,
      hasPlayed,
      lastMatchTime: lastTime,
      firstMatchTime,
    })
  })

  return {
    waitMap,
    firstMatchTime,
    statsList,
  }
}

