// Bắn tàu (trò dân gian trên giấy kẻ ô). 2 người, mỗi người một vùng biển 10 × 10, giấu 5 tàu dài 5, 4, 3, 3, 2 ô
// (thẳng ngang / dọc, không chồng lên nhau, được đứng sát nhau). Lần lượt gọi một ô để bắn: trúng thì bắn tiếp,
// trượt thì mất lượt. Bắn trúng hết các ô của một tàu là tàu chìm (lộ cả tàu). Đánh chìm cả 5 tàu trước là thắng.
//
// Game có THÔNG TIN ẨN (docs/GAMES.md §5.2): vị trí tàu không nằm trong log. Máy khách gửi { place: [5 tàu] } —
// server (0080 game_bantau_fill) kiểm, cất vào game_hands (chỉ chủ tàu đọc được) rồi ghi { placed: true }.
// Bắn: máy khách gửi { fire: ô }, server tra tàu đối phương rồi ghi { fire, hit, sunk? } — sunk = các ô của tàu vừa
// chìm. Server từ chối nước sai lượt / bắn lại ô cũ nên log chỉ có nước đúng; kết quả chấm lại bằng game_bantau_result.
//
// Ô i = hàng * 10 + cột. state = { placed[2], phase ('place' | 'fire'), turn, shots[ghế][100] (null | 'miss' | 'hit' |
//   'sunk' — kết quả các phát ghế đó bắn sang biển đối phương), hits[2], sunk[ghế][] (tàu đối phương đã chìm),
//   over, winner, last, ply }
//   last = { seat, placed? } | { seat, fire, hit, sunk? }

export const SIZE = 10
export const CELLS = SIZE * SIZE
export const SHIPS = [5, 4, 3, 3, 2]
export const TOTAL = SHIPS.reduce((a, b) => a + b, 0)

const isCell = (i) => Number.isInteger(i) && i >= 0 && i < CELLS

/** Hạm đội hợp lệ không: đủ 5 tàu đúng độ dài, mỗi tàu thẳng hàng liền ô, không chồng nhau. */
export function fleetOk(fleet) {
  if (!Array.isArray(fleet) || fleet.length !== SHIPS.length) return false
  const all = fleet.flat()
  if (all.length !== TOTAL || !all.every(isCell) || new Set(all).size !== TOTAL) return false
  return fleet.every((ship, k) => {
    if (!Array.isArray(ship) || ship.length !== SHIPS[k]) return false
    const cs = [...ship].sort((a, b) => a - b)
    const row = cs.every((c, j) => j === 0 || (c === cs[j - 1] + 1 && Math.floor(c / SIZE) === Math.floor(cs[0] / SIZE)))
    const col = cs.every((c, j) => j === 0 || c === cs[j - 1] + SIZE)
    return row || col
  })
}

/** Xếp ngẫu nhiên một hạm đội (máy khách dùng — không nằm trong luật / log). */
export function randomFleet(rand = Math.random) {
  for (;;) {
    const used = new Set()
    const fleet = []
    for (const len of SHIPS) {
      let ship = null
      for (let tries = 0; tries < 200 && !ship; tries++) {
        const down = rand() < 0.5
        const r = Math.floor(rand() * (down ? SIZE - len + 1 : SIZE))
        const c = Math.floor(rand() * (down ? SIZE : SIZE - len + 1))
        const cells = Array.from({ length: len }, (_, k) => (down ? (r + k) * SIZE + c : r * SIZE + c + k))
        if (cells.every((x) => !used.has(x))) ship = cells
      }
      if (!ship) break
      ship.forEach((x) => used.add(x))
      fleet.push(ship)
    }
    if (fleet.length === SHIPS.length) return fleet
  }
}

export default {
  id: 'bantau',
  minPlayers: 2,
  maxPlayers: 2,
  defaultOptions: {},

  setup() {
    return {
      placed: [false, false], phase: 'place', turn: null, shots: [Array(CELLS).fill(null), Array(CELLS).fill(null)],
      hits: [0, 0], sunk: [[], []], over: false, winner: null, last: null, ply: 0,
    }
  },

  validate(s, seat, move) {
    if (s.over) return 'games.err.over'
    if (seat !== 0 && seat !== 1) return 'games.err.badMove'
    if (move?.place !== undefined || move?.placed === true) {
      if (s.placed[seat]) return 'games.err.placed'
      return move.placed === true || fleetOk(move.place) ? null : 'games.err.badFleet'
    }
    if (move?.fire === undefined) return 'games.err.badMove'
    if (s.phase !== 'fire') return 'games.err.notReady'
    if (seat !== s.turn) return 'games.err.notYourTurn'
    if (!isCell(move.fire)) return 'games.err.badMove'
    if (s.shots[seat][move.fire] != null) return 'games.err.fired'
    if (move.hit !== undefined && typeof move.hit !== 'boolean') return 'games.err.badMove'
    return null
  },

  /** Xếp tàu và bắn đều cần server (cất tàu / tra trúng trượt) — màn chơi không hiện trước. */
  request: (s, seat, move) => move?.place !== undefined || (move?.fire !== undefined && move.hit === undefined),

  /** Ghế đang được chờ (registry.waitingOf): lúc xếp tàu cả hai cùng xếp — chờ người chưa chốt; lúc bắn là người tới lượt. */
  waiting: (s) => (s.over ? [] : s.phase === 'place' ? [0, 1].filter((x) => !s.placed[x]) : [s.turn]),

  apply(s0, seat, move) {
    if (move.place !== undefined) return s0 // chưa qua server — không có gì để áp
    if (move.placed) {
      const placed = s0.placed.map((p, i) => p || i === seat)
      const ready = placed.every(Boolean)
      return { ...s0, placed, phase: ready ? 'fire' : 'place', turn: ready ? 0 : null, ply: s0.ply + 1, last: { seat, placed: true } }
    }
    if (move.hit === undefined) return s0
    const { fire, hit } = move
    const sunk = Array.isArray(move.sunk) && move.sunk.length ? move.sunk : null
    const mine = s0.shots[seat].slice()
    mine[fire] = hit ? 'hit' : 'miss'
    if (sunk) for (const c of sunk) mine[c] = 'sunk'
    const shots = seat === 0 ? [mine, s0.shots[1]] : [s0.shots[0], mine]
    const hits = s0.hits.map((h, i) => (i === seat && hit ? h + 1 : h))
    const sunkAll = s0.sunk.map((list, i) => (i === seat && sunk ? [...list, sunk] : list))
    const s = {
      ...s0, shots, hits, sunk: sunkAll, turn: hit ? seat : 1 - seat, ply: s0.ply + 1,
      last: { seat, fire, hit, ...(sunk ? { sunk } : {}) },
    }
    return hits[seat] >= TOTAL ? { ...s, over: true, winner: seat, turn: null } : s
  },

  view: (s) => s,

  result(s) {
    if (!s.over) return null
    return { winners: [s.winner], draw: false }
  },
}
