// NGHIỆM THU: dựng lại giải mùa 1 theo quy chế "Giải Masters Phú Khê Badminton 2026" (16/08/2026).
// Số liệu tiền và luật điểm lấy nguyên văn quy chế. Chỗ quy chế KHÔNG ghi thì đánh dấu [A] = giả định.

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildKnockout } from '#lib/tournament/bracket.js'
import { applyCommit } from '#lib/tournament/advance.js'
import { tournamentMoney } from '#lib/tournament/finance.js'

// Quy chế mục "Nội dung, thể thức thi đấu".
const QUALIFY_MD_WD = { sets: 1, points: 30, winBy2: false, cap: 30 } // "01 sec 30 điểm, chạm 30 trước thắng"
const QUALIFY_XD = { sets: 1, points: 21, winBy2: true, cap: 30 }     // "cách biệt 02; 29–29 ai ghi điểm 30 thắng"
const RANKING = { sets: 3, points: 15, winBy2: false, cap: 15 }       // "Nhất–Nhì và Ba–Tư: 03 sec 15, chạm 15"

const EVENTS = [
  { kind: 'md', rule: QUALIFY_MD_WD, win: [[30, 27]] },
  { kind: 'wd', rule: QUALIFY_MD_WD, win: [[30, 29]] },
  { kind: 'xd', rule: QUALIFY_XD, win: [[30, 29]] }, // 29–29 → 30–29: ca hiếm nhất của luật này
]
const TEAMS_PER_EVENT = 8 // [A] quy chế không ghi; khớp bốc thăm Đ1–Đ8 trong design

function runEvent({ kind, rule, win }) {
  let n = 0
  const stage = {
    id: `stage-${kind}`,
    matchRule: rule,
    ruleOverrides: { final: RANKING, third: RANKING },
    config: { seeding: 'slot', thirdPlace: true },
  }
  const entrants = Array.from({ length: TEAMS_PER_EVENT }, (_, i) => ({ id: `${kind}-D${i + 1}`, drawNo: i + 1 }))
  const built = buildKnockout({ stage, entrants, newId: () => `${kind}-m${++n}` })

  let ms = built
  for (let m = ms.find((x) => x.status === 'ready'); m; m = ms.find((x) => x.status === 'ready')) {
    const sets = m.rule.sets === 3 ? [[15, 12], [13, 15], [15, 14]] : win
    const res = applyCommit(ms, { matchId: m.id, sets, winner: 'A' })
    assert.equal(res.error, null, `${kind} ${m.roundKind}: ${res.error}`)
    ms = res.matches
  }
  return { built, played: ms }
}

test('Masters PK 2026 — nhánh đấu: 3 nội dung × 8 đội, luật theo vòng, đánh được tới hết', () => {
  const all = EVENTS.map(runEvent)
  const built = all.flatMap((e) => e.built)

  assert.equal(built.length, 24, '3 × (4 TK + 2 BK + CK + 3-4)')
  const ranking = built.filter((m) => m.roundKind === 'final' || m.roundKind === 'third')
  assert.equal(ranking.length, 6)
  assert.ok(ranking.every((m) => m.rule.sets === 3 && m.rule.points === 15), 'mọi trận Nhất–Nhì, Ba–Tư: 3 sec 15')
  assert.ok(built.filter((m) => m.roundKind === 'sf').every((m) => m.rule.sets === 1),
    'bán kết không có trong "vòng tranh hạng" của quy chế → vẫn đánh luật vòng loại 1 sec')
  assert.ok(all[2].built.filter((m) => m.roundKind === 'qf').every((m) => m.rule.winBy2),
    'đôi nam nữ: vòng loại cách 2; đôi nam/nữ thì chạm 30')

  for (const { played } of all) {
    assert.ok(played.every((m) => m.status === 'done'), 'không có trận nào kẹt lại chưa đánh')
    const final = played.find((m) => m.roundKind === 'final')
    const third = played.find((m) => m.roundKind === 'third')
    const podium = [final.teamAId, final.teamBId, third.teamAId]
    assert.equal(new Set(podium).size, 3, 'Nhất, Nhì, Ba là 3 đội khác nhau')
  }
})

test('Masters PK 2026 — tiền: khớp từng con số của quy chế', () => {
  // Quy chế mục "Lệ phí được sử dụng để chi trả". "Trích quỹ CLB" KHÔNG nằm trong đây: nó là số dư tính ra.
  const budgetLines = [
    { label: 'Thuê sân 4h × 2 sân', amount: 640000 },
    { label: 'Cầu thi đấu 4 ống', amount: 1280000 },
    { label: 'Huy chương 20 cái', amount: 385000 },
    { label: 'Phông bạt', amount: 220000 },
  ]
  // "200.000đ/đội · 150.000đ/đội · 100.000đ/đội", mọi nội dung.
  const prizes = [200000, 150000, 100000].map((cash) => ({ cash, eventId: null }))

  // [A] Quy chế không ghi số người. Tổng thu phải = tổng chi + trích quỹ = 4.950.000đ, tức 4·nam + 3·nữ = 99.
  // Chọn 18 nam + 9 nữ (một nghiệm). Lưu ý: 9 nữ không đủ 8 đội đôi nữ → TEAMS_PER_EVENT=8 ở trên là giả định
  // của phần nhánh đấu, chưa khớp với số tiền thật — cần số liệu thật của mùa 1.
  const registrations = [
    ...Array.from({ length: 18 }, () => ({ fee: 200000, paid: true, status: 'registered' })),
    ...Array.from({ length: 9 }, () => ({ fee: 150000, paid: true, status: 'registered' })),
  ]

  const m = tournamentMoney({ registrations, prizes, budgetLines, eventCount: 3 })
  assert.equal(m.prizeTotal, 1350000, 'quy chế: "Tiền thưởng 1.350.000đ" = 450k × 3 nội dung')
  assert.equal(m.plannedOut, 3875000, '640 + 1.280 + 385 + 220 + 1.350 (nghìn đồng)')
  assert.equal(m.expected, 4950000)
  assert.equal(m.balance, 1075000, 'quy chế: "Trích quỹ CLB 1.075.000đ" — phải là số dư tính ra, không phải một dòng chi')
})
