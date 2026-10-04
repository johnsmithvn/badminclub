/**
 * @file swiss.js
 * Thể thức Thụy Sĩ. Thuần: không React, không Supabase.
 *
 * Một giai đoạn = một bảng chứa mọi đội (dùng lại bảng / final_rank / chốt giai đoạn của vòng tròn). Không đá hết
 * mọi cặp như vòng tròn: đá N vòng, mỗi vòng ghép đội CÙNG ĐIỂM với nhau, không cho gặp lại đội đã gặp.
 *   · Vòng 1: theo hạt giống, nửa trên gặp nửa dưới (1 gặp n/2+1…) — hạt giống không gặp nhau sớm.
 *   · Vòng sau: xếp theo điểm → Buchholz → đối đầu/bảng con; ghép 1-2, 3-4… (Monrad), gặp lại thì tìm cặp khác
 *     (quay lui). Không cách nào tránh được mới cho gặp lại (`rematch: true`).
 *   · Số đội lẻ: một đội được miễn (bye, tính 1 trận thắng) — đội thấp hạng nhất CHƯA từng được miễn.
 * Xếp hạng: điểm (thắng + bye) → Buchholz (tổng điểm các đối thủ đã gặp) → đối đầu / bảng con như vòng tròn → hoà
 * thì BTC quyết lúc chốt (như vòng tròn). Cầu lông không có hoà trận.
 */

import { bucketsBy, computeStats, rankTied } from '#lib/tournament/standings.js'
import { hasResult } from '#lib/tournament/scoring.js'

const finished = (m) => hasResult(m) || m.status === 'bye'
const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`)
// Quay lui tối đa từng này bước rồi thôi — đủ cho giải CLB (≤ 32 đội); quá thì cho gặp lại thay vì treo máy.
const SEARCH_BUDGET = 20000

/** Số vòng mặc định: ⌈log₂ n⌉, tối thiểu 3, không quá số vòng còn ghép được mà không gặp lại. */
export function swissRounds(n) {
  if (n < 2) return 0
  const cap = n % 2 ? n : n - 1
  return Math.min(cap, Math.max(3, Math.ceil(Math.log2(n))))
}

/** Số vòng của giai đoạn: BTC đặt (`config.rounds`) hoặc mặc định theo số đội. */
export const roundsOf = (stage, n) => stage?.config?.rounds || swissRounds(n)

const matchOf = ({ stage, groupId, round, slot, a, b, newId }) => ({
  id: newId(), stageId: stage.id, groupId, round, slot, roundKind: 'group',
  teamAId: a, teamBId: b, sourceA: null, sourceB: b ? null : { kind: 'bye' },
  nextMatchId: null, nextSide: null, loserNextMatchId: null, loserNextSide: null,
  rule: { ...stage.matchRule },
  status: b ? 'ready' : 'bye', sets: [], winner: b ? null : 'A', resultNote: null, seqNo: null, courtLabel: null,
})

/**
 * Bảng + trận vòng 1.
 * @param {{ stage: object, entrants: Array<{ id: string, seed: number }>, newId: () => string }} p
 * @returns {{ group: object, matches: object[] }}
 */
export function buildSwissStart({ stage, entrants, newId }) {
  if (!Array.isArray(entrants) || entrants.length < 2) throw new Error('buildSwissStart: cần ít nhất 2 đội')
  const bySeed = [...entrants].sort((a, b) => a.seed - b.seed)
  const group = {
    id: newId(), stageId: stage.id, label: 'A', seq: 1,
    teams: bySeed.map((e, i) => ({ teamId: e.id, seedInGroup: i + 1 })),
  }
  const bye = bySeed.length % 2 ? bySeed[bySeed.length - 1] : null
  const play = bye ? bySeed.slice(0, -1) : bySeed
  const half = play.length / 2
  const matches = play.slice(0, half).map((top, i) => {
    const m = matchOf({ stage, groupId: group.id, round: 0, slot: i, a: top.id, b: play[half + i].id, newId })
    return { ...m, sourceA: { kind: 'seed', n: top.seed }, sourceB: { kind: 'seed', n: play[half + i].seed } }
  })
  if (bye) matches.push({ ...matchOf({ stage, groupId: group.id, round: 0, slot: half, a: bye.id, b: null, newId }), sourceA: { kind: 'seed', n: bye.seed } })
  return { group, matches }
}

/**
 * Bảng xếp hạng Thụy Sĩ — cùng dạng `groupStandings` (để bảng / chốt giai đoạn / nhánh sau dùng chung), thêm
 * `buchholz`, `byes`. `won` = ĐIỂM (thắng + bye) — cột THẮNG trên bảng là điểm Thụy Sĩ.
 * `isFinished` = mọi trận đã sinh đã xong (bye tính là xong).
 */
export function swissStandings(group, matches) {
  const teamIds = (group.teams || []).map((t) => (typeof t === 'string' ? t : t.teamId))
  const own = matches.filter((m) => m.groupId === group.id)
  const real = own.filter((m) => m.status !== 'bye')
  const byes = new Map(teamIds.map((id) => [id, own.filter((m) => m.status === 'bye' && (m.teamAId === id || m.teamBId === id)).length]))
  const stats = new Map(teamIds.map((id) => [id, computeStats(id, real)]))
  const score = (id) => stats.get(id).won + byes.get(id)
  const opponents = (id) => real.filter((m) => hasResult(m) && (m.teamAId === id || m.teamBId === id))
    .map((m) => (m.teamAId === id ? m.teamBId : m.teamAId))
  const rows = teamIds.map((id) => ({
    ...stats.get(id), won: score(id), wins: stats.get(id).won, byes: byes.get(id),
    buchholz: opponents(id).reduce((s, op) => s + (stats.has(op) ? score(op) : 0), 0),
  }))

  const order = []
  const ties = []
  const sorted = [...rows].sort((a, b) => b.won - a.won || b.buchholz - a.buchholz)
  bucketsBy(sorted, (r) => `${r.won}|${r.buchholz}`).forEach((b) => {
    const sub = rankTied(b, real)
    order.push(...sub.order)
    ties.push(...sub.ties)
  })
  const tied = new Set(ties.flat())
  const done = real.filter((m) => hasResult(m))
  return {
    rows: order.map((r, i) => ({ ...r, rank: i + 1, tied: tied.has(r.teamId) })),
    ties,
    isFinished: own.length > 0 && own.every(finished),
    matchesCount: { total: real.length, done: done.length },
  }
}

/** Số vòng đã sinh và vòng cuối đã đấu xong chưa. */
export function swissProgress(group, matches) {
  const own = matches.filter((m) => m.groupId === group.id)
  const played = own.length ? Math.max(...own.map((m) => m.round)) + 1 : 0
  const last = own.filter((m) => m.round === played - 1)
  return { played, lastDone: last.length > 0 && last.every(finished) }
}

/** Ghép cặp theo thứ tự `order` (id), không gặp lại; quay lui khi bí. null = không ghép được trong ngân sách. */
function pairUp(order, played) {
  let budget = SEARCH_BUDGET
  const go = (list) => {
    if (!list.length) return []
    if (--budget < 0) return null
    const [a, ...rest] = list
    for (let i = 0; i < rest.length; i++) {
      if (played.has(pairKey(a, rest[i]))) continue
      const sub = go(rest.filter((_, j) => j !== i))
      if (sub) return [[a, rest[i]], ...sub]
      if (budget < 0) return null
    }
    return null
  }
  return go(order)
}

/**
 * Cặp đấu vòng kế tiếp. Người gọi đã kiểm vòng trước xong hết.
 * @param {{ stage: object, group: object, matches: object[], newId: () => string }} p
 * @returns {{ matches: object[], rematch: boolean }}
 */
export function pairNextRound({ stage, group, matches, newId }) {
  const own = matches.filter((m) => m.groupId === group.id)
  const round = own.length ? Math.max(...own.map((m) => m.round)) + 1 : 0
  const table = swissStandings(group, matches)
  const order = table.rows.map((r) => r.teamId)
  const rankOf = new Map(table.rows.map((r) => [r.teamId, r.rank]))
  const byes = new Map(table.rows.map((r) => [r.teamId, r.byes]))
  const played = new Set(own.filter((m) => m.teamAId && m.teamBId).map((m) => pairKey(m.teamAId, m.teamBId)))

  // Đội lẻ: thử miễn lần lượt từ dưới lên, ưu tiên đội ít lần miễn nhất — lấy phương án đầu tiên ghép được.
  const up = [...order].reverse()
  const minBye = Math.min(...order.map((id) => byes.get(id)))
  const candidates = order.length % 2
    ? [...up.filter((id) => byes.get(id) === minBye), ...up.filter((id) => byes.get(id) !== minBye)]
    : [null]

  let pairs = null
  let bye = candidates[0]
  for (const c of candidates) {
    pairs = pairUp(order.filter((id) => id !== c), played)
    if (pairs) { bye = c; break }
  }
  const rematch = !pairs
  if (!pairs) {
    const rest = order.filter((id) => id !== bye)
    pairs = Array.from({ length: rest.length / 2 }, (_, i) => [rest[2 * i], rest[2 * i + 1]])
  }

  const out = pairs.map(([x, y], slot) => {
    const [a, b] = rankOf.get(x) <= rankOf.get(y) ? [x, y] : [y, x]
    const m = matchOf({ stage, groupId: group.id, round, slot, a, b, newId })
    return { ...m, sourceA: { kind: 'rank', n: rankOf.get(a) }, sourceB: { kind: 'rank', n: rankOf.get(b) } }
  })
  if (bye) out.push({ ...matchOf({ stage, groupId: group.id, round, slot: out.length, a: bye, b: null, newId }), sourceA: { kind: 'rank', n: rankOf.get(bye) } })
  return { matches: out, rematch }
}
