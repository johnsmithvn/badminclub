/**
 * @file bracketView.js
 * Dựng nhánh để HIỂN THỊ + dữ liệu cho hiệu ứng "đội thắng bay lên". Thuần: không React, không DOM.
 */

const RESULT = new Set(['done', 'walkover', 'retired'])
export const hasResult = (m) => RESULT.has(m.status)

/** Khoá ô của một đội trong một trận — component gắn vào `data-k` để hiệu ứng tìm ra ô. */
export const slotKey = (matchId, side) => `${matchId}:${side}`
export const CHAMP_KEY = 'champ'

/**
 * Trận của một giai đoạn loại trực tiếp, xếp theo vòng → ô. Trận 3-4 tách riêng.
 * @returns {{ rounds: Array<{ round: number, kind: string, matches: object[] }>, third: object|null, final: object|null }}
 */
export function koRounds(matches, stageId) {
  const own = matches.filter((m) => m.stageId === stageId)
  const third = own.find((m) => m.roundKind === 'third') || null
  const byRound = new Map()
  own.filter((m) => m.roundKind !== 'third').forEach((m) => {
    if (!byRound.has(m.round)) byRound.set(m.round, [])
    byRound.get(m.round).push(m)
  })
  const rounds = [...byRound.keys()].sort((a, b) => a - b).map((round) => {
    const list = byRound.get(round).sort((a, b) => a.slot - b.slot)
    return { round, kind: list[0].roundKind, matches: list }
  })
  const last = rounds[rounds.length - 1]
  return { rounds, third, final: last && last.kind === 'final' ? last.matches[0] : null }
}

/** Mã trận hiển thị: TK1, BK2, CK, 3-4 — số thứ tự trong vòng (1-based). Chữ cái lấy từ i18n ở UI. */
export const matchNo = (m) => m.slot + 1

/** Tiến độ: trận đã có kết quả / trận phải đánh (bye không tính). */
export function progressOf(matches) {
  const real = matches.filter((m) => m.status !== 'bye')
  return { done: real.filter(hasResult).length, total: real.length }
}

/** Trận chờ đánh theo thứ tự thi đấu: đang đánh trước, rồi seqNo (BTC xếp tay), rồi vòng, rồi ô. */
export function queueOf(matches) {
  const order = (m) => [m.status === 'live' ? 0 : 1, m.seqNo ?? Infinity, m.round, m.slot]
  return matches
    .filter((m) => m.status === 'ready' || m.status === 'live')
    .sort((a, b) => {
      const x = order(a)
      const y = order(b)
      for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1
      return 0
    })
}

/**
 * Trận nào vừa có kết quả giữa hai lần xem (trước khi chốt → sau khi chốt, hoặc giữa hai lần poll)
 * và đội nào phải "bay" từ ô nào tới ô nào. Thắng → ô ở trận sau (chung kết → ô Vô địch, loé vàng);
 * thua bán kết → ô ở trận 3-4. Trận chưa từng thấy (lần nạp đầu) thì không bay.
 */
export function flightsOf(prev, next) {
  const before = new Map(prev.map((m) => [m.id, m]))
  const out = []
  next.forEach((m) => {
    const was = before.get(m.id)
    if (!was || hasResult(was) || !hasResult(m) || !m.winner) return
    const lose = m.winner === 'A' ? 'B' : 'A'
    if (m.nextMatchId) out.push({ from: slotKey(m.id, m.winner), to: slotKey(m.nextMatchId, m.nextSide) })
    else if (m.roundKind === 'final') out.push({ from: slotKey(m.id, m.winner), to: CHAMP_KEY, gold: true })
    if (m.loserNextMatchId) out.push({ from: slotKey(m.id, lose), to: slotKey(m.loserNextMatchId, m.loserNextSide) })
  })
  return out
}

/** Điểm từng set của một bên: [[21,18],[15,21]] + 'A' → [21, 15]. */
export const sideScores = (sets, side) => (sets || []).map((s) => (side === 'A' ? s[0] : s[1]))

/**
 * Thứ tự đội ở vòng đầu (theo ô, bỏ ô bye) sau khi đổi chỗ 2 đội — dùng làm SỐ BỐC THĂM để sinh lại nhánh kiểu `slot`.
 * Ô bye của `slot` và `seed` trùng nhau (đều là vị trí hạt giống > n của `bracketOrder`), nên sinh lại với thứ tự
 * này cho đúng nhánh cũ, chỉ 2 đội đổi chỗ. Trả null nếu một trong hai đội không ở vòng đầu.
 * @returns {string[] | null}  id đội theo thứ tự — phần tử thứ i nhận số bốc thăm i + 1
 */
export function swapOrder(matches, stageId, teamA, teamB) {
  const first = matches.filter((m) => m.stageId === stageId && m.round === 0 && m.roundKind !== 'third').sort((a, b) => a.slot - b.slot)
  const order = first.flatMap((m) => [m.teamAId, m.teamBId]).filter(Boolean)
  const i = order.indexOf(teamA)
  const j = order.indexOf(teamB)
  if (i < 0 || j < 0 || i === j) return null
  ;[order[i], order[j]] = [order[j], order[i]]
  return order
}

/** Nhánh còn sửa / sinh lại được: chưa trận nào có kết quả (trừ bye) và chưa trận nào đang đánh. */
export const stageEditable = (matches, stageId) => !matches.some((m) => m.stageId === stageId && (hasResult(m) || m.status === 'live'))
