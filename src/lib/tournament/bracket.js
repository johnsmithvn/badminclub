/**
 * @file bracket.js
 * Sinh nhánh loại trực tiếp. Thuần: không React, không Supabase.
 *
 * Trả về trận ở dạng client (camelCase). `dbmap` đổi sang cột DB khi gửi RPC `tournament_generate_stage`;
 * `clubId/tournamentId/eventId` RPC tự lấy từ giai đoạn — client không gửi, khỏi phải tin.
 */

import { ruleFor } from '#lib/tournament/scoring.js'
import { seatTeam } from '#lib/tournament/advance.js'

// Tính từ chung kết ngược lại. Hết mảng = nhánh > 32 đội, CHECK `round_kind` ở DB không nhận.
const KINDS_FROM_END = ['final', 'sf', 'qf', 'r16', 'r32']

export function nextPowerOf2(n) {
  let size = 1
  while (size < n) size *= 2
  return size
}

/** Thứ tự hạt giống chuẩn: [1] → [1,2] → [1,4,2,3] → [1,8,4,5,2,7,3,6]… */
export function bracketOrder(size) {
  let order = [1]
  while (order.length < size) {
    const len = order.length * 2
    order = order.flatMap((seed) => [seed, len + 1 - seed])
  }
  return order
}

export function roundKindOf(round, totalRounds) {
  const kind = KINDS_FROM_END[totalRounds - 1 - round]
  if (!kind) throw new Error(`roundKindOf: nhánh ${2 ** totalRounds} đội vượt giới hạn r32`)
  return kind
}

/**
 * Đội ở từng vị trí vòng đầu (null = bye).
 *
 * Bye luôn nằm ở vị trí của hạt giống > n trong `bracketOrder` — cả khi bốc thăm. Vì `bracketOrder` ghép
 * hạt giống s với size+1-s và n > size/2, hai bye không bao giờ gặp nhau. Chế độ `slot` rải đội bốc thăm
 * TUẦN TỰ vào các vị trí còn lại → đủ lũy thừa 2 thì đúng 1–2, 3–4…; thiếu thì số bốc thăm nhỏ được bye.
 * Xếp tuần tự từ đầu (1–2, 3–4, 5–6, bye–bye) là nhánh kẹt: trận bye–bye không có ai đi tiếp.
 */
function firstRoundTeams(entrants, size, seeding) {
  const n = entrants.length
  const order = bracketOrder(size)
  // Tự do: số bốc thăm = đúng ô trong nhánh (1..size) — BTC tự đặt cả chỗ miễn đấu.
  if (seeding === 'pos') {
    const out = Array(size).fill(null)
    entrants.forEach((e) => { out[e.drawNo - 1] = e })
    return out
  }
  if (seeding === 'slot') {
    const drawn = [...entrants].sort((a, b) => a.drawNo - b.drawNo)
    let k = 0
    return order.map((seed) => (seed > n ? null : drawn[k++]))
  }
  const bySeed = [...entrants].sort((a, b) => a.seed - b.seed)
  return order.map((seed) => bySeed[seed - 1] || null)
}

/**
 * Id đội theo từng ô vòng đầu (null = ô miễn đấu). Ô thứ i ghi làm số bốc thăm i + 1 với cách xếp "Tự do"
 * (`seeding:'slot', free:true`) → nhánh GIỐNG HỆT — dùng để đổi chỗ tay từ nhánh đang thấy.
 */
export function slotsOf(entrants, seeding) {
  return firstRoundTeams(entrants, nextPowerOf2(entrants.length), seeding).map((e) => e?.id ?? null)
}

/** Cách xếp thật của giai đoạn: 'seed' · 'slot' (bốc thăm, rải tuần tự) · 'pos' (tự do, số = ô). */
export const seedingOf = (config) => (config?.seeding === 'slot' ? (config?.free ? 'pos' : 'slot') : 'seed')
/** Tên cách xếp cho UI (đuôi khoá i18n nhãn "Xếp vào nhánh"): 'seed' · 'slot' · 'free' · 'rank'. */
export const arrangeOf = (config) => (config?.seeding === 'slot' && config?.free ? 'free' : config?.seeding || 'seed')

function checkEntrants(entrants, seeding) {
  if (!Array.isArray(entrants) || entrants.length < 2) {
    throw new Error('buildKnockout: cần ít nhất 2 đội')
  }
  const key = seeding === 'seed' ? 'seed' : 'drawNo'
  const vals = entrants.map((e) => e[key])
  if (!vals.every(Number.isInteger) || new Set(vals).size !== vals.length) {
    throw new Error(`buildKnockout: mọi đội phải có ${key} nguyên, không trùng`)
  }
  if (key === 'seed' && vals.some((v) => v < 1 || v > vals.length)) {
    throw new Error('buildKnockout: seed phải là 1..số đội')
  }
  if (seeding === 'pos' && vals.some((v) => v < 1 || v > nextPowerOf2(vals.length))) {
    throw new Error('buildKnockout: ô tự do phải là 1..cỡ nhánh')
  }
}

/**
 * Sinh toàn bộ trận của một giai đoạn loại trực tiếp.
 *
 * @param {object} p
 * @param {{ id: string, matchRule: object, ruleOverrides?: object, config?: { seeding?: 'seed'|'slot', thirdPlace?: boolean } }} p.stage
 * @param {Array<{ id: string, seed?: number, drawNo?: number }>} p.entrants
 * @param {() => string} p.newId  sinh UUID (client sinh sẵn để con trỏ next* trỏ được vào nhau trước khi insert)
 */
export function buildKnockout({ stage, entrants, newId }) {
  if (!stage || !stage.id) throw new Error('buildKnockout: thiếu stage')
  if (typeof newId !== 'function') throw new Error('buildKnockout: thiếu newId')
  const seeding = seedingOf(stage.config)
  checkEntrants(entrants, seeding)

  const n = entrants.length
  const size = nextPowerOf2(n)
  const rounds = Math.log2(size)

  const make = (round, slot, roundKind) => ({
    id: newId(), stageId: stage.id, groupId: null, round, slot, roundKind,
    teamAId: null, teamBId: null, sourceA: null, sourceB: null,
    nextMatchId: null, nextSide: null, loserNextMatchId: null, loserNextSide: null,
    rule: { ...ruleFor(stage, roundKind) },
    status: 'pending', sets: [], winner: null, resultNote: null, seqNo: null, courtLabel: null,
  })

  const byRound = []
  for (let r = 0; r < rounds; r++) {
    const kind = roundKindOf(r, rounds)
    byRound.push(Array.from({ length: size >> (r + 1) }, (_, s) => make(r, s, kind)))
  }

  for (let r = 0; r < rounds - 1; r++) {
    byRound[r].forEach((m, s) => {
      const next = byRound[r + 1][s >> 1]
      m.nextMatchId = next.id
      m.nextSide = s % 2 ? 'B' : 'A'
      next[m.nextSide === 'A' ? 'sourceA' : 'sourceB'] = { kind: 'winner', match: m.id }
    })
  }

  // 3 đội thì một bán kết là bye → không có đội thua để đá 3-4; trận đó sẽ chờ mãi.
  let third = null
  if (stage.config?.thirdPlace && n >= 4) {
    third = make(rounds - 1, 1, 'third')
    const [sf1, sf2] = byRound[rounds - 2]
    sf1.loserNextMatchId = third.id
    sf1.loserNextSide = 'A'
    sf2.loserNextMatchId = third.id
    sf2.loserNextSide = 'B'
    third.sourceA = { kind: 'loser', match: sf1.id }
    third.sourceB = { kind: 'loser', match: sf2.id }
  }

  const teams = firstRoundTeams(entrants, size, seeding)
  // Hai ô miễn gặp nhau = không ai đi tiếp, trận sau chờ mãi (chỉ xếp tự do mới có thể xảy ra).
  if (teams.some((x, i) => i % 2 === 0 && !x && !teams[i + 1])) throw new Error('buildKnockout: trận vòng đầu không có đội nào')
  const sourceOf = (team) => {
    if (!team) return { kind: 'bye' }
    return seeding === 'seed' ? { kind: 'seed', n: team.seed } : { kind: 'draw', n: team.drawNo }
  }
  const nextOf = (m) => byRound[1]?.[m.slot >> 1]

  byRound[0].forEach((m, s) => {
    const a = teams[2 * s]
    const b = teams[2 * s + 1]
    m.teamAId = a ? a.id : null
    m.teamBId = b ? b.id : null
    m.sourceA = sourceOf(a)
    m.sourceB = sourceOf(b)
    if (a && b) {
      m.status = 'ready'
      return
    }
    // Bye: đội có mặt thắng luôn, và được điền sẵn vào trận sau NGAY trong payload — RPC không tự đẩy.
    m.status = 'bye'
    m.winner = a ? 'A' : 'B'
    const next = nextOf(m)
    if (next) seatTeam(next, m.nextSide, (a || b).id)
  })

  return third ? [...byRound.flat(), third] : byRound.flat()
}
