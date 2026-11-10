// Máy chơi bằng luật kinh nghiệm (không tìm kiếm sâu) cho Caro, Chấm ô, Cờ cá ngựa, Bắn tàu — mấy trò này bàn to
// hoặc nhiều may rủi, chấm điểm từng nước theo mẹo của người chơi giỏi là đủ khó. Thuần JS, chạy trong Web Worker.
// Mỗi hàm nhận `lv` = 'easy' | 'normal' | 'hard' và `rand` (test truyền số cố định).

import { boxesOf, edgesOf } from '#lib/games/chamo.js'
import chamo from '#lib/games/chamo.js'
import { movesOf, squareOf, TRACK, HOME } from '#lib/games/cangua.js'
import { CELLS, randomFleet, SHIPS, SIZE } from '#lib/games/bantau.js'
import { shuffle } from '#lib/games/bots/search.js'

const pickOne = (a, rand) => a[Math.floor(rand() * a.length)]

/** Chọn ngẫu nhiên trong các phương án có điểm ≥ (tốt nhất − margin). list = [{ m, v }]. */
function near(list, margin, rand) {
  const best = Math.max(...list.map((x) => x.v))
  return pickOne(list.filter((x) => x.v >= best - margin), rand).m
}

// ── Caro ────────────────────────────────────────────────────────────────────────────────────────────────────────
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]]

/** Điểm thế cờ nếu ghế `seat` đặt vào ô i: mỗi hướng đếm quân liền + số đầu còn trống. */
function caroCell(s, i, seat) {
  const n = s.size
  const r0 = Math.floor(i / n)
  const c0 = i % n
  let v = 0
  for (const [dr, dc] of DIRS) {
    let count = 1
    let open = 0
    for (const sgn of [1, -1]) {
      let r = r0 + dr * sgn
      let c = c0 + dc * sgn
      while (r >= 0 && r < n && c >= 0 && c < n && s.board[r * n + c] === seat) { count++; r += dr * sgn; c += dc * sgn }
      if (r >= 0 && r < n && c >= 0 && c < n && s.board[r * n + c] == null) open++
    }
    const gap = s.win - count
    if (gap <= 0) v += 1e7
    else if (open === 0) continue
    else if (gap === 1) v += open === 2 ? 1e6 : 1e5
    else if (gap === 2) v += open === 2 ? 5e4 : 2e3
    else if (gap === 3) v += open === 2 ? 1e3 : 100
    else v += 10 * open
  }
  return v
}

const WIN_W = [0, 1, 40, 900, 2e4, 1e7]
/** Chấm kiểu "cửa sổ": mọi đoạn dài `win` ô đi qua i không có quân đối phương, càng nhiều quân mình càng điểm cao —
 *  bắt được cả thế đứt quãng (X·XX) mà cách đếm quân liền bỏ sót. */
function caroWin(s, i, seat) {
  const n = s.size
  const r0 = Math.floor(i / n)
  const c0 = i % n
  let v = 0
  for (const [dr, dc] of DIRS) {
    for (let k = 0; k < s.win; k++) {
      let own = 0
      let ok = true
      for (let t = 0; t < s.win && ok; t++) {
        const r = r0 + dr * (t - k)
        const c = c0 + dc * (t - k)
        if (r < 0 || r >= n || c < 0 || c >= n) ok = false
        else if (r === r0 && c === c0) own++
        else if (s.board[r * n + c] === seat) own++
        else if (s.board[r * n + c] != null) ok = false
      }
      if (ok) v += WIN_W[Math.min(own, 5)]
    }
  }
  return v
}

/** Ô trống trong vòng 2 ô quanh các quân đã đặt; bàn trống thì ô giữa. */
function caroCands(s) {
  const n = s.size
  const out = []
  for (let i = 0; i < s.board.length; i++) {
    if (s.board[i] != null) continue
    const r = Math.floor(i / n)
    const c = i % n
    let near2 = false
    for (let dr = -2; dr <= 2 && !near2; dr++) {
      for (let dc = -2; dc <= 2 && !near2; dc++) {
        const y = r + dr
        const x = c + dc
        if (y >= 0 && y < n && x >= 0 && x < n && s.board[y * n + x] != null) near2 = true
      }
    }
    if (near2) out.push(i)
  }
  return out.length ? out : [Math.floor(n / 2) * n + Math.floor(n / 2)]
}

export function caroBot(s, me, lv, rand = Math.random) {
  const foe = 1 - me
  const def = lv === 'easy' ? 0.5 : lv === 'normal' ? 0.85 : 1
  const cands = shuffle(caroCands(s), rand)
  const list = cands.map((i) => ({ m: i, v: 1.1 * caroCell(s, i, me) + def * caroCell(s, i, foe) })).sort((a, b) => b.v - a.v)
  if (lv === 'easy') return { i: pickOne(list.slice(0, 5), rand).m }
  if (lv === 'normal') return { i: near(list, list[0].v * 0.15, rand) }
  // Khó: nước bắt buộc trước — thắng ngay, chặn đối phương thắng ngay, tạo 4 mở, chặn đối phương tạo 4 mở —
  // rồi mới tới chấm điểm (gần như không ngẫu nhiên).
  for (const [who, at] of [[me, 1e7], [foe, 1e7], [me, 1e6], [foe, 1e6]]) {
    const hit = list.filter((x) => caroCell(s, x.m, who) >= at)
    if (hit.length) return { i: hit[0].m }
  }
  const deep = cands.map((i) => ({ m: i, v: 1.1 * caroWin(s, i, me) + caroWin(s, i, foe) })).sort((x, y) => y.v - x.v)
  return { i: near(deep, deep[0].v * 0.02, rand) }
}

// ── Chấm ô ──────────────────────────────────────────────────────────────────────────────────────────────────────
const sidesOf = (s, b) => edgesOf(s.size, b).filter((e) => s.lines[e] != null).length

export function chamoBot(s, me, lv, rand = Math.random) {
  const free = shuffle(s.lines.map((v, i) => (v == null ? i : null)).filter((i) => i != null), rand)
  const closes = free.filter((l) => boxesOf(s.size, l).some((b) => sidesOf(s, b) === 3))
  const safe = free.filter((l) => boxesOf(s.size, l).every((b) => sidesOf(s, b) < 2))
  if (lv === 'easy') {
    if (closes.length && rand() < 0.7) return { line: closes[0] }
    return { line: pickOne(free, rand) }
  }
  if (closes.length) return { line: closes[0] }
  if (safe.length) return { line: safe[0] }
  if (lv === 'normal') return { line: free[0] }
  // Khó: bắt buộc phải cho — chọn nét cho đi ít ô nhất (giả lập đối phương ăn tham hết chuỗi).
  // ponytail: chưa "nhả 2 ô cuối" (double-dealing) để giữ quyền đi trong chuỗi dài — thêm nếu máy còn dễ thắng quá.
  const given = (l) => {
    let st = chamo.apply(s, me, { line: l })
    let n = 0
    for (;;) {
      const take = st.lines.findIndex((v, i) => v == null && boxesOf(st.size, i).some((b) => sidesOf(st, b) === 3))
      if (take < 0 || st.over) return n
      const before = st.boxes.filter((v) => v != null).length
      st = chamo.apply(st, 1 - me, { line: take })
      n += st.boxes.filter((v) => v != null).length - before
    }
  }
  return { line: free.map((l) => ({ m: l, v: -given(l) })).reduce((a, b) => (b.v > a.v ? b : a)).m }
}

// ── Cờ cá ngựa ──────────────────────────────────────────────────────────────────────────────────────────────────
/** Ô đường đua đang có ngựa đối phương đứng sau trong tầm 1..6 bước (dễ bị đá). */
function threatened(s, me, sq) {
  return s.horses.some((hs, seat) => seat !== me && !s.out[seat] && hs.some((p) => {
    if (p < 0 || p >= TRACK) return false
    const back = (sq - squareOf(s.colors[seat], p) + TRACK) % TRACK
    return back >= 1 && back <= 6
  }))
}

export function canguaBot(s, me, lv, rand = Math.random) {
  if (s.dice == null) return { roll: true }
  const ms = movesOf(s, me)
  if (!ms.length) return null
  if (lv === 'easy') return { horse: pickOne(ms, rand).horse }
  const list = ms.map((m) => {
    const from = s.horses[me][m.horse]
    const sq = (p) => squareOf(s.colors[me], p)
    let v = m.to >= HOME ? 40 + m.to : m.to - Math.max(from, 0)
    if (from === -1) v += 30 // ra quân
    if (m.kicked) v += 50 + Math.max(0, s.horses[m.kicked.seat][m.kicked.horse])
    if (lv === 'hard' && m.to < TRACK) {
      if (threatened(s, me, sq(m.to))) v -= 25
      if (from >= 0 && from < TRACK && threatened(s, me, sq(from))) v += 15
    }
    return { m: m.horse, v }
  })
  return { horse: near(list, lv === 'normal' ? 8 : 0, rand) }
}

// ── Bắn tàu ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** Ô kề theo trục d (1 = ngang, SIZE = dọc), chiều sg; -1 nếu ra ngoài bàn / sang hàng khác. */
const stepOf = (i, d, sg) => {
  const j = i + d * sg
  return j < 0 || j >= CELLS || (d === 1 && Math.floor(j / SIZE) !== Math.floor(i / SIZE)) ? -1 : j
}
const nbrs = (i) => [1, SIZE].flatMap((d) => [stepOf(i, d, 1), stepOf(i, d, -1)]).filter((j) => j >= 0)

export function bantauBot(s, me, lv, rand = Math.random) {
  if (s.phase === 'place') return { place: randomFleet(rand) }
  const shots = s.shots[me]
  const open = []
  for (let i = 0; i < CELLS; i++) if (shots[i] == null) open.push(i)
  const hits = []
  for (let i = 0; i < CELLS; i++) if (shots[i] === 'hit') hits.push(i)
  if (lv === 'easy') {
    const around = hits.flatMap(nbrs).filter((j) => shots[j] == null)
    return { fire: around.length && rand() < 0.5 ? pickOne(around, rand) : pickOne(open, rand) }
  }
  if (lv === 'normal') {
    // Săn / diệt: trúng rồi thì bắn quanh (có 2 phát thẳng hàng thì bắn nối dài); chưa trúng thì bắn ô bàn cờ.
    if (hits.length) {
      for (const h of hits) {
        for (const d of [1, SIZE]) {
          if (![1, -1].some((sg) => { const j = stepOf(h, d, sg); return j >= 0 && shots[j] === 'hit' })) continue
          const ends = []
          for (const sg of [1, -1]) {
            let j = h
            while (j >= 0 && shots[j] === 'hit') j = stepOf(j, d, sg)
            if (j >= 0 && shots[j] == null) ends.push(j)
          }
          if (ends.length) return { fire: pickOne(ends, rand) }
        }
      }
      const around = hits.flatMap(nbrs).filter((j) => shots[j] == null)
      if (around.length) return { fire: pickOne(around, rand) }
    }
    const parity = open.filter((i) => (Math.floor(i / SIZE) + i) % 2 === 0)
    return { fire: pickOne(parity.length ? parity : open, rand) }
  }
  // Khó: bản đồ xác suất — đếm mọi cách đặt các tàu còn lại khớp với phát trượt / tàu chìm; phủ phát trúng thì nặng ký.
  const left = SHIPS.slice()
  for (const ship of s.sunk[me]) { const k = left.indexOf(ship.length); if (k >= 0) left.splice(k, 1) }
  const heat = new Array(CELLS).fill(0)
  for (const len of left) {
    for (const down of [false, true]) {
      for (let r = 0; r < (down ? SIZE - len + 1 : SIZE); r++) {
        for (let c = 0; c < (down ? SIZE : SIZE - len + 1); c++) {
          const cells = Array.from({ length: len }, (_, k) => (down ? (r + k) * SIZE + c : r * SIZE + c + k))
          if (cells.some((x) => shots[x] === 'miss' || shots[x] === 'sunk')) continue
          const covered = cells.filter((x) => shots[x] === 'hit').length
          const w = covered ? 1 + 40 * covered : 1
          for (const x of cells) if (shots[x] == null) heat[x] += w
        }
      }
    }
  }
  return { fire: near(open.map((i) => ({ m: i, v: heat[i] })), 0, rand) }
}
