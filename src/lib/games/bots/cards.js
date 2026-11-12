// Máy chơi game bài (phòng chơi với máy). Máy CHỈ thấy state công khai + tay của chính nó (`hand`, dealer.handOf) —
// không đọc bài người khác, nọc hay dây nổ. Mỗi hàm trả một nước đúng dạng máy khách gửi; nhà cái (dealer.js) kiểm và
// điền lá thật như server.
//
// Mức: easy = hay chọn bừa · normal = theo kinh nghiệm thường · hard = thêm đếm bài / tính xác suất.

import { isBomb, isHeo, playsOf, rankOf as tlRank, TWO } from '#lib/games/tienlen.js'
import { bestLay, cover, meldsIn, pendingOf, pointsOf as phPoints, rankOf as phRank, sendsFor, suitOf as phSuit, uOf } from '#lib/games/phom.js'
import { fits, JOKER, kindOf as bbKind, mustCall, WIRES } from '#lib/games/baibip.js'
import { MAX_CARDS, pointsOf as xdPoints, standMin } from '#lib/games/xidach.js'

const anyOf = (xs, rand) => xs[Math.floor(rand() * xs.length)]

// ---------- Tiến lên ----------

/**
 * Số "lượt" ước chừng để đánh hết `hand` (càng ít càng tốt) + phạt lá lẻ nhỏ: tách tham lam sảnh dài nhất, rồi bộ
 * cùng hạng, còn lại là lá lẻ. Heo / tứ quý không tính là gánh nặng (đánh lúc nào cũng được).
 */
function burden(hand, bac) {
  let rest = [...hand].sort((a, b) => a - b)
  let groups = 0
  for (;;) {
    // Sảnh dài nhất (miền Nam: lá đầu mỗi hạng; miền Bắc: một chất).
    let best = null
    for (let r0 = 0; r0 < TWO; r0++) {
      for (let su = bac ? 0 : -1; su < (bac ? 4 : 0); su++) {
        const run = []
        for (let r = r0; r < TWO; r++) {
          const c = rest.find((x) => tlRank(x) === r && (su < 0 || (x & 3) === su))
          if (c == null) break
          run.push(c)
        }
        if (run.length >= 3 && (!best || run.length > best.length)) best = run
      }
    }
    if (!best) break
    rest = rest.filter((c) => !best.includes(c))
    groups += 1
  }
  const cnt = Array(13).fill(0)
  for (const c of rest) cnt[tlRank(c)] += 1
  let lowSingles = 0
  cnt.forEach((k, r) => {
    if (!k) return
    groups += 1
    if (k === 1 && r < 8) lowSingles += (8 - r) / 8 // lá lẻ nhỏ (dưới J) khó thoát
  })
  return groups + lowSingles
}

export function tienlenBot(s, seat, level, rand, hand) {
  const plays = playsOf(s, hand)
  if (!plays.length) return { pass: true }
  if (level === 'easy') {
    // Chặn được thì đôi khi vẫn bỏ; còn lại đánh bừa trong 3 bộ nhỏ nhất (không đánh heo / hàng khi mở vòng).
    if (s.table && rand() < 0.3) return { pass: true }
    const soft = plays.filter(({ k }) => !isBomb(k) && !(isHeo(k) && !s.table))
    const pool = (soft.length ? soft : plays).sort((a, b) => a.k.top - b.k.top).slice(0, 3)
    return { play: anyOf(pool, rand).cs }
  }
  const others = s.counts.map((k, i) => (i === seat || s.out[i] ? 99 : k))
  const danger = Math.min(...others) // đối thủ gần về nhất còn mấy lá
  // Đánh hết một lần được thì đánh luôn.
  const all = plays.find(({ cs }) => cs.length === hand.length)
  if (all) return { play: all.cs }
  const score = ({ cs, k }) => {
    const rest = hand.filter((c) => !cs.includes(c))
    let v = burden(rest, s.bac) * 10 + k.top / 52
    if (isBomb(k) || isHeo(k)) v += danger <= 3 ? 0 : s.table ? 25 : 40 // giữ heo / hàng tới lúc cần
    if (!s.table) v -= cs.length * 0.5 // mở vòng: thoát nhiều lá một lúc
    // Khó: đối thủ còn 1 lá thì mở vòng đừng đánh lá lẻ nhỏ (họ thoát ngay) — đánh bộ, hoặc lá lẻ to nhất.
    if (level === 'hard' && !s.table && danger === 1 && cs.length === 1) v += 20 - tlRank(k.top)
    if (level === 'hard' && s.table && danger <= 2) v -= 15 // chặn bằng mọi giá khi có người sắp về
    return v
  }
  const ranked = plays.map((p) => ({ ...p, v: score(p) })).sort((a, b) => a.v - b.v)
  const best = ranked[0]
  // Đang chặn: phải phá bộ hoặc tốn heo / hàng mà chưa ai sắp về → bỏ lượt.
  if (s.table) {
    const now = burden(hand, s.bac) * 10
    const costly = (isBomb(best.k) || isHeo(best.k)) && danger > 3
    if (costly || best.v - now > (level === 'hard' ? 6 : 12)) return { pass: true }
  }
  return { play: best.cs }
}

// ---------- Phỏm ----------

/** Lá còn "sống" với `c`: đôi (cùng số) hoặc cạ (cùng chất cách ≤ 2) trên tay — giữ để thành phỏm. */
const mates = (c, hand) => hand.filter((x) => x !== c && (phRank(x) === phRank(c) || (phSuit(x) === phSuit(c) && Math.abs(phRank(x) - phRank(c)) <= 2))).length

/**
 * Khó: chỉ tính đôi / cạ còn "sống" — lá còn thiếu để thành phỏm chưa lộ (`gone`: chồng bài, phỏm đã hạ, lá người khác
 * ăn). Đôi cần một trong hai lá cùng số còn lại; cạ cách 2 cần lá giữa; cạ liền cần lá hai đầu.
 */
function liveMates(c, hand, gone) {
  const r = phRank(c)
  const su = phSuit(c)
  let v = 0
  for (const x of hand) {
    if (x === c) continue
    let need = []
    if (phRank(x) === r) need = [0, 1, 2, 3].map((k) => r * 4 + k).filter((y) => y !== c && y !== x)
    else if (phSuit(x) === su && Math.abs(phRank(x) - r) <= 2) {
      const lo = Math.min(r, phRank(x))
      const hi = Math.max(r, phRank(x))
      need = (hi - lo === 2 ? [lo + 1] : [lo - 1, hi + 1]).filter((k) => k >= 0 && k <= 12).map((k) => k * 4 + su)
    }
    if (need.some((y) => !gone.has(y))) v += 1
  }
  return v
}

/**
 * Khó: lá `c` đánh ra có bao nhiêu cách để người khác ghép phỏm mà ăn — đếm các cặp lá ghép được với nó mà mình chưa
 * thấy ở đâu (`known` = tay mình + lá đã lộ). Bộ cùng số: còn 3 lá chưa thấy = 3 cặp, còn 2 = 1 cặp; dây: mỗi cặp liền
 * kề cùng chất chưa thấy = 1.
 */
function eatRisk(c, known) {
  const r = phRank(c)
  const su = phSuit(c)
  const same = [0, 1, 2, 3].map((k) => r * 4 + k).filter((y) => y !== c && !known.has(y)).length
  let risk = same === 3 ? 3 : same === 2 ? 1 : 0
  for (const [a, b] of [[r - 2, r - 1], [r - 1, r + 1], [r + 1, r + 2]]) {
    if (a >= 0 && b <= 12 && !known.has(a * 4 + su) && !known.has(b * 4 + su)) risk += 1
  }
  return risk
}

export function phomBot(s, seat, level, rand, hand) {
  const pend = pendingOf(s, seat)
  const non = hand.filter((c) => !pend.includes(c))
  const laid = s.melds[seat] != null
  if (s.step === 'take') {
    const canEat = s.last && cover(non, [...pend, s.last.card])
    if (canEat && (level !== 'easy' || rand() < 0.6)) return { eat: true }
    return { draw: true }
  }
  // Ù được thì ù (sau khi ăn / bốc, chưa hạ).
  if (!laid) {
    const u = uOf(hand, pend)
    if (u) return { u }
  }
  if (s.step === 'lay') {
    const melds = bestLay(hand, pend) || []
    const used = melds.flat()
    const rest = hand.filter((c) => !used.includes(c))
    let send = melds.length && level !== 'easy' ? sendsFor(rest, s.melds, seat) : []
    // Phải còn ít nhất một lá để đánh lá chốt.
    while (send.length && used.length + send.length > hand.length - 1) send = send.slice(0, -1)
    return { lay: melds, send }
  }
  // Đánh: lá không phải lá ăn, đánh xong vẫn xếp được các lá ăn.
  const ok = non.filter((c) => cover(non.filter((x) => x !== c), pend))
  const pool = ok.length ? ok : non
  if (level === 'easy') return { discard: anyOf(pool, rand) }
  const inMeld = new Set(meldsIn(non).flat())
  const gone = new Set([...s.piles.flat(), ...s.melds.flat().flat().filter((x) => x != null), ...s.eaten.filter((e) => e.by !== seat).map((e) => e.card)])
  // Rác điểm cao, không nằm trong phỏm, ít lá "sống" → đánh trước. Đã hạ thì chỉ còn rác: đánh lá to nhất.
  const score = (c) => {
    let v = phPoints(c)
    if (!laid) {
      if (inMeld.has(c)) v -= 40
      // Khó: chỉ tính đôi / cạ còn sống, và càng ít lượt bốc trước khi hạ thì càng bớt giữ (khó thành phỏm kịp).
      v -= level === 'hard' ? liveMates(c, non, gone) * (2 + 2 * Math.max(0, 3 - s.piles[seat].length)) : mates(c, non) * 6
    }
    // Khó: tránh nhả lá người khác ăn được (bị ăn mất 1 điểm, lá chốt mất 4).
    if (level === 'hard') v -= eatRisk(c, new Set([...hand, ...gone])) * (laid ? 2 : 0.5)
    return v
  }
  return { discard: pool.slice().sort((a, b) => score(b) - score(a) || b - a)[0] }
}

// ---------- Bài bịp ----------

/** Xác suất `k` lá vừa úp đều là lá chủ, theo bài mình đang cầm (8 lá chủ = 6 lá cùng loại + 2 Joker). */
function honestOdds(s, hand, k) {
  const mine = hand.filter((c) => fits(c, s.table)).length
  const pool = 20 - hand.length
  let p = 1
  for (let i = 0; i < k; i++) p *= Math.max(0, 8 - mine - i) / Math.max(1, pool - i)
  return p
}

const choose = (n, r) => {
  if (r < 0 || r > n) return 0
  let v = 1
  for (let i = 0; i < r; i++) v = (v * (n - i)) / (i + 1)
  return v
}

/**
 * Khó: xác suất người vừa úp `k` lá THẬT SỰ có ≥ k lá chủ trên tay lúc đánh (người có lá thật thường đánh lá thật) —
 * phân phối siêu bội trên các lá mình không thấy (20 lá trừ tay mình, gồm cả lá chưa chia).
 */
function honestHard(s, hand, k) {
  const pool = 20 - hand.length
  const good = 8 - hand.filter((c) => fits(c, s.table)).length
  const h = Math.min(pool, s.counts[s.lastPlay.seat] + k)
  let p = 0
  for (let x = k; x <= Math.min(good, h); x++) p += (choose(good, x) * choose(pool - good, h - x)) / choose(pool, h)
  return p
}

export function baibipBot(s, seat, level, rand, hand) {
  if (s.phase === 'redeal') return { deal: true }
  if (s.phase === 'cut') {
    const free = Array.from({ length: WIRES }, (_, w) => w).filter((w) => !s.cuts[seat].includes(w))
    return { cut: anyOf(free, rand) }
  }
  if (mustCall(s, seat) || !hand.length) return { call: true }
  const callable = s.lastPlay && s.lastPlay.seat !== seat
  if (callable) {
    const honest = level === 'hard' ? honestHard(s, hand, s.lastPlay.n) : honestOdds(s, hand, s.lastPlay.n)
    // Người vừa đánh đã hết bài → ván sắp kết thúc, tố luôn nếu có chút nghi ngờ.
    const lastOut = s.counts[s.lastPlay.seat] === 0
    const need = level === 'easy' ? 0.15 + rand() * 0.5 : level === 'hard' ? 0.4 : 0.35
    if (honest < need || (lastOut && honest < 0.85 && level !== 'easy')) return { call: true }
  }
  const truths = hand.filter((c) => fits(c, s.table)).sort((a, b) => bbKind(a) - bbKind(b))
  const lies = hand.filter((c) => !fits(c, s.table))
  if (level === 'easy') {
    const k = 1 + Math.floor(rand() * Math.min(3, hand.length))
    return { play: hand.slice().sort(() => rand() - 0.5).slice(0, k) }
  }
  if (truths.length) {
    // Đánh lá thật (để Joker lại sau cùng). Khó: đánh tới 3 lá thật một lượt cho mau hết bài.
    const real = truths.filter((c) => bbKind(c) !== JOKER)
    const order = [...real, ...truths.filter((c) => bbKind(c) === JOKER)]
    return { play: order.slice(0, Math.min(level === 'hard' ? 3 : 2, order.length)) }
  }
  // Không có lá thật: nói dối ít lá nhất.
  return { play: lies.slice(0, 1) }
}

// ---------- Xì dách ----------

export function xidachBot(s, seat, level, rand, hand) {
  if (s.phase !== 'play' || s.turn !== seat) return null
  const pts = xdPoints(hand)
  const min = standMin(s, seat)
  if (hand.length >= MAX_CARDS) return { stand: true }
  if (pts < min) return { draw: true }
  if (pts > 21) return { stand: true } // quắc: dằn luôn, không ai biết tới lúc lật
  if (level === 'easy') return pts < 18 && rand() < 0.5 ? { draw: true } : { stand: true }
  if (seat !== s.banker) {
    // Con: 4 lá mà còn thấp thì rút thử ngũ linh (ăn đôi).
    if (level === 'hard' && hand.length === 4 && pts <= 17) return { draw: true }
    return pts >= 17 ? { stand: true } : { draw: true }
  }
  // Cái: con rút nhiều lá (≥ 4) dễ quắc / ngũ linh; con dằn 2 lá thường điểm cao.
  const players = s.counts.map((k, y) => (y === seat || s.out[y] || s.xi[y] ? null : k)).filter((k) => k != null)
  const avg = players.length ? players.reduce((a, b) => a + b, 0) / players.length : 2
  const target = level === 'hard' ? (avg <= 2.4 ? 18 : 17) : 17
  return pts >= target ? { stand: true } : { draw: true }
}
