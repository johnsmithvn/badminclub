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
 * Trận đáng xem: xen kẽ kèo dưới thắng (chênh lớn trước) và trận sát / đủ 3 set (sát trước), tối đa `limit`.
 * Không có trận nào như vậy thì lấy 3 trận đầu danh sách, gắn 'recent' — không giả làm trận sát điểm.
 */
export function pickWatchable(matches, limit = 5) {
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
