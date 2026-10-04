// Số liệu tab "Sân đấu" ở trang chủ (HomeMatchTab) — hàm thuần, test được. Mọi ngưỡng đi qua nguồn chung:
// trận sát / kèo dưới / 3 set ở #lib/matchSearch.js, độ cân sân ở #lib/planner.js, lệch trình ở #lib/rating.js.
import { isoOf } from '#utils/dates.js'
import { isCloseMatch, isThreeSetMatch, isUpsetMatch, minSetDiff } from '#lib/matchSearch.js'
import { calcCourtBalanceScore } from '#lib/planner.js'
import { IMBALANCE_THRESHOLD } from '#lib/rating.js'

/** Tháng của trận ('YYYY-MM') theo giờ ĐỊA PHƯƠNG — toISOString là UTC, trận 0–7h sáng giờ VN bị lùi sang hôm trước. */
export function matchMonthOf(m) {
  const d = m.createdAt ? new Date(m.createdAt) : m.at ? new Date(m.at) : null
  return d && !isNaN(d) ? isoOf(d).slice(0, 7) : ''
}

/** % trận sát điểm — null khi chưa có trận nào. */
export function closeRate(matches) {
  if (!matches.length) return null
  return Math.round((matches.filter(isCloseMatch).length / matches.length) * 100)
}

/**
 * Phân bố rating của những người đi một buổi: 9 cột, cột đông nhất, chênh mạnh nhất – yếu nhất và có lệch
 * trình không (chênh vượt `IMBALANCE_THRESHOLD`). null khi chưa ai có rating.
 */
export function ratingSpread(ratings, binCount = 9) {
  if (!ratings.length) return null
  const sorted = [...ratings].sort((a, b) => a - b)
  const minR = sorted[0]
  const maxR = sorted[sorted.length - 1]
  const step = Math.max(20, Math.ceil((maxR - minR || 200) / binCount))
  const bins = Array.from({ length: binCount }, (_, i) => ({ min: minR + i * step, max: minR + (i + 1) * step, count: 0 }))
  sorted.forEach((r) => {
    bins[Math.min(binCount - 1, Math.max(0, Math.floor((r - minR) / step)))].count++
  })
  const maxBinCount = Math.max(1, ...bins.map((b) => b.count))
  const gap = maxR - minR
  return { minR, maxR, bins, maxBinCount, peak: bins.find((b) => b.count === maxBinCount), gap, imbalanced: gap > IMBALANCE_THRESHOLD }
}

/** Điểm chia sân trung bình (0–100) các trận ĐÔI, chấm bằng rating hiện tại + số buổi đã chấm. */
export function avgCourtBalance(matches, ratingsMap) {
  const scored = matches
    .filter((m) => (m.teamA || []).length === 2 && (m.teamB || []).length === 2)
    .map((m) => ({ m, score: calcCourtBalanceScore(m.teamA, m.teamB, ratingsMap) }))
    .filter((x) => typeof x.score === 'number')
  if (!scored.length) return { score: null, sessionCount: 0 }
  return {
    score: Math.round(scored.reduce((sum, x) => sum + x.score, 0) / scored.length),
    sessionCount: new Set(scored.map((x) => x.m.sessionId)).size,
  }
}

/**
 * Trận đáng xem: chỉ trận CÓ VIDEO. Xen kẽ kèo dưới thắng (chênh lớn trước) và trận sát / đủ 3 set (sát trước),
 * tối đa `limit`. Không có trận nào như vậy thì lấy 3 trận có video đầu danh sách, gắn 'recent' — không giả làm
 * trận sát điểm.
 */
export function pickWatchable(allMatches, limit = 5) {
  const matches = allMatches.filter((m) => m.videoUrl)
  const upsets = matches.filter(isUpsetMatch)
    .map((m) => ({ match: m, gap: Math.abs((m.initialRatingA || 0) - (m.initialRatingB || 0)), type: 'upset' }))
    .sort((x, y) => y.gap - x.gap)
  const closes = matches.filter((m) => isCloseMatch(m) || isThreeSetMatch(m))
    .map((m) => ({ match: m, minDiff: minSetDiff(m), type: 'close' }))
    .sort((x, y) => (x.minDiff ?? 99) - (y.minDiff ?? 99))
  const list = []
  const seen = new Set()
  const take = (item) => { if (item && list.length < limit && !seen.has(item.match.id)) { seen.add(item.match.id); list.push(item) } }
  for (let i = 0; i < Math.max(upsets.length, closes.length) && list.length < limit; i++) {
    take(upsets[i])
    take(closes[i])
  }
  if (!list.length) return matches.slice(0, 3).map((m) => ({ match: m, minDiff: minSetDiff(m), type: 'recent' }))
  return list
}

/**
 * Cặp chưa từng gặp cho người xem: cặp có `myId` lên trước (gắn `isMine`), thiếu mới bù cặp khác của CLB.
 * `scored` đã xếp theo số buổi cùng đi (neverMetWithSessionCount) — thứ tự trong mỗi nhóm giữ nguyên.
 */
export function neverMetForViewer(scored, myId, limit) {
  const isMine = (p) => !!myId && (p.p1 === myId || p.p2 === myId)
  return [...scored.filter(isMine), ...scored.filter((p) => !isMine(p))]
    .slice(0, limit)
    .map((p) => ({ ...p, isMine: isMine(p) }))
}

/**
 * Kình địch: hai người đứng HAI BÊN lưới với nhau nhiều nhất (trận đôi tính cả 4 cặp chéo), tối thiểu
 * `minMeetings` lần. Gặp nhiều trước; cùng số lần thì tỷ số sát hơn trước. `p1` là người thắng nhiều hơn.
 */
export function monthRivals(matches, { minMeetings, limit }) {
  const byKey = {}
  matches.forEach((m) => {
    if (m.winnerTeam !== 'A' && m.winnerTeam !== 'B') return
    ;(m.teamA || []).forEach((a) => (m.teamB || []).forEach((b) => {
      const [x, y] = a < b ? [a, b] : [b, a]
      const r = (byKey[`${x}|${y}`] ||= { x, y, total: 0, xWins: 0 })
      r.total++
      if ((m.winnerTeam === 'A') === (x === a)) r.xWins++
    }))
  })
  return Object.values(byKey)
    .filter((r) => r.total >= minMeetings)
    .map(({ x, y, total, xWins }) => (xWins >= total - xWins
      ? { p1: x, p2: y, total, w1: xWins, w2: total - xWins }
      : { p1: y, p2: x, total, w1: total - xWins, w2: xWins }))
    .sort((r1, r2) => r2.total - r1.total || (r1.w1 - r1.w2) - (r2.w1 - r2.w2))
    .slice(0, limit)
}
