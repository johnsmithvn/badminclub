/**
 * @file finance.js
 * Thẻ tiền của giải — CHỈ ĐỂ XEM (docs/TOURNAMENT_PLAN.md D2). Không ghi `transactions`, không đụng `ledger()`.
 * Thuần: không React, không Supabase. Tiền là số nguyên VND, không làm tròn.
 */

/** Phí theo giới tính — chỉ dùng LÚC ĐĂNG KÝ; sau đó phí đã chốt trong `registration.fee`. */
export function feeFor(tournament, gender) {
  if (gender === 'nam') return tournament.feeMale
  if (gender === 'nu') return tournament.feeFemale
  throw new Error(`feeFor: giới tính không hợp lệ "${gender}"`)
}

const sum = (list, pick) => list.reduce((t, x) => t + pick(x), 0)

/**
 * @param {object} p
 * @param {Array<{ fee: number, paid: boolean, status: 'registered'|'withdrawn' }>} p.registrations
 * @param {Array<{ cash: number, eventId: string|null }>} p.prizes  `eventId` null = áp cho MỌI nội dung
 * @param {Array<{ amount: number }>} p.budgetLines
 * @param {number} p.eventCount số nội dung của giải
 *
 * `balance` = thu dự kiến − chi dự kiến. Dương là "trích quỹ CLB" — một con số TÍNH RA, không phải một
 * dòng dự trù (nhập nó thành dòng chi là trừ hai lần). Âm là "thiếu, cần bù".
 * Người rút lui không vào thu dự kiến; nếu đã đóng thì hiện riêng ở `withdrawnPaid` để BTC quyết hoàn hay giữ.
 */
export function tournamentMoney({ registrations, prizes, budgetLines, eventCount }) {
  const active = registrations.filter((r) => r.status === 'registered')
  const expected = sum(active, (r) => r.fee)
  const collected = sum(active.filter((r) => r.paid), (r) => r.fee)
  const prizeTotal = sum(prizes, (p) => p.cash * (p.eventId ? 1 : eventCount))
  const budgetTotal = sum(budgetLines, (b) => b.amount)
  return {
    expected,
    collected,
    outstanding: expected - collected,
    withdrawnPaid: sum(registrations.filter((r) => r.status === 'withdrawn' && r.paid), (r) => r.fee),
    prizeTotal,
    budgetTotal,
    plannedOut: prizeTotal + budgetTotal,
    balance: expected - prizeTotal - budgetTotal,
  }
}
