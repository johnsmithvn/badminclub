// node src/__tests__/games/tienlen.test.js
// Luật Tiến lên (lib/games/tienlen.js). Sai ở đây là chặn nhầm bộ, chuyển lượt nhầm người, kẹt ván khi có người rời,
// chấm sai hạng / cóng / tiền chặt / thối.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import tl, { HAND, TWO, beats, comboOf, priceOf, thoiOf, variantOf, whiteOf } from '#lib/games/tienlen.js'
import { replay } from '#lib/games/registry.js'

/** Nước deal như server ghi (0078 game_tienlen_deal): ván chơi lại thì `first` đi trước, không thì ai cầm lá nhỏ nhất. */
function dealOf(hands, first) {
  const low = first == null ? Math.min(...hands.flat()) : null
  const f = first ?? hands.findIndex((h) => h.includes(low))
  const w = hands.findIndex(whiteOf)
  return { seat: f, move: { deal: { first: f, low, n: hands.map((h) => h.length), white: w < 0 ? null : w } } }
}
const start = (hands, first) => {
  const d = dealOf(hands, first)
  return tl.apply(tl.setup(), d.seat, d.move)
}
const step = (s, seat, move) => {
  const err = tl.validate(s, seat, move)
  assert.equal(err, null, 'nước ' + JSON.stringify(move) + ' của ghế ' + seat + ' phải hợp lệ, bị: ' + err)
  return tl.apply(s, seat, move)
}

/** Kết quả server chấm (0078 game_tienlen_run) = result() của JS + thối: ai chưa về đích, chưa rời, trả người về Nhất. */
function serverResult(s, hands) {
  const r = tl.result(s)
  if (!r || s.last?.white) return r
  const scores = { ...r.scores }
  const top = r.ranks[0]
  hands.forEach((h, i) => {
    if (s.counts[i] === 0 || s.left.includes(i) || i === top) return
    const v = thoiOf(h.filter((c) => !s.gone.includes(c)))
    scores[i] -= v
    scores[top] += v
  })
  return { ...r, scores }
}

// Trước khi chia bài không ai đi được; nước deal chỉ một lần, đúng hình dạng.
{
  const s = tl.setup()
  assert.equal(tl.validate(s, 0, { play: [0] }), 'games.err.badMove')
  assert.equal(tl.validate(s, 0, { deal: { first: 0, low: 0, n: [13] } }), 'games.err.badMove', 'ít nhất 2 người')
  assert.equal(tl.validate(s, 1, { deal: { first: 0, low: 0, n: [13, 13] } }), 'games.err.badMove', 'nước deal ghi ở ghế đi trước')
  assert.equal(tl.validate(s, 0, { deal: { first: 0, low: 0, n: [14, 13] } }), 'games.err.badMove', 'quá 13 lá')
  assert.equal(tl.validate(s, 0, { deal: { first: 0, low: 0, n: [13, 13], white: 2 } }), 'games.err.badMove', 'tới trắng ghế không có')
  const s1 = start([[0], [1]])
  assert.equal(tl.validate(s1, 0, dealOf([[0], [1]]).move), 'games.err.badMove', 'không chia lại giữa ván')
  assert.deepEqual([s1.turn, s1.low, s1.counts], [0, 0, [1, 1]])
  const s2 = start([[0, 4], [8, 12]], 1)
  assert.deepEqual([s2.turn, s2.low], [1, null], 'ván chơi lại: người về Nhất đi trước, không bắt lá nào')
}

// Bỏ lượt là mất quyền tới hết vòng; người đánh cuối mở vòng mới.
{
  let s = start([[0, 40, 41], [8, 44, 50], [12, 24, 51]])
  s = step(s, 0, { play: [0] })
  s = step(s, 1, { play: [8] })
  s = step(s, 2, { pass: true })
  assert.equal(s.turn, 0)
  s = step(s, 0, { play: [40] })
  assert.equal(s.turn, 1, 'ghế 2 đã bỏ nên bị bỏ qua')
  s = step(s, 1, { pass: true })
  assert.equal(s.table, null, 'cả bàn bỏ → vòng mới')
  assert.equal(s.turn, 0, 'người đánh cuối mở vòng mới')
  assert.deepEqual(s.passed, [false, false, false], 'vòng mới thì ai cũng được đánh lại')
  assert.equal(tl.validate(s, 0, { pass: true }), 'games.err.mustLead', 'mở vòng không được bỏ')
}

// Người đang giữ bàn rời ván: vòng vẫn chạy tiếp, hết người chặn thì ghế kế sau ghế đã rời mở vòng.
{
  let s = start([[0, 4], [44, 8], [12, 28], [20, 30]])
  s = step(s, 0, { play: [0] })
  s = step(s, 1, { play: [44] })
  s = tl.apply(s, 1, { out: true })
  assert.equal(s.turn, 2, 'người rời không phải người tới lượt → lượt giữ nguyên')
  s = step(s, 2, { pass: true })
  s = step(s, 3, { pass: true })
  s = step(s, 0, { pass: true })
  assert.deepEqual([s.table, s.turn], [null, 2], 'chủ bàn đã rời → ghế kế sau ghế đó (còn ở lại) mở vòng')
  assert.equal(tl.validate(s, 1, { play: [8] }), 'games.err.badMove', 'ghế đã rời không đi được nữa')
}

// Người tới lượt rời → lượt sang người kế; còn một người là hết ván. Rời trước về Bét.
{
  let s = start([[0, 4], [8, 12], [16, 20]])
  s = step(s, 0, { play: [0] })
  s = tl.apply(s, 1, { out: true })
  assert.equal(s.turn, 2)
  s = tl.apply(s, 2, { out: true })
  assert.deepEqual(tl.result(s), { winners: [0], draw: false, ranks: [0, 2, 1], scores: { 0: 2, 1: -2, 2: 0 } })
  assert.equal(tl.validate(s, 0, { play: [4] }), 'games.err.over')
}

// Về Nhất rồi ván vẫn chạy để xếp Nhì / Ba; người kế sau mở tiếp.
{
  let s = start([[4], [0, 8], [1, 12]])
  s = step(s, 1, { play: [0] })
  s = step(s, 2, { play: [1] })
  s = step(s, 0, { play: [4] })
  assert.deepEqual([s.over, s.turn, s.order, tl.result(s)], [false, 1, [0], null])
  assert.equal(tl.validate(s, 0, { pass: true }), 'games.err.badMove', 'người đã về không đi nữa')
  s = step(s, 1, { play: [8] })
  assert.deepEqual(tl.result(s), { winners: [0], draw: false, ranks: [0, 1, 2], scores: { 0: 2, 1: 0, 2: -2 } })
}

// Máy này không biết bài người khác, chỉ chặn lá đã ra bàn. Không sửa state cũ.
{
  const s0 = start([[0, 5], [1, 9]])
  const s1 = step(s0, 0, { play: [0] })
  assert.equal(tl.validate(s1, 1, { play: [0] }), 'games.err.notYourCard')
  assert.equal(tl.validate(s1, 1, { play: [33] }), null, 'lá chưa ra bàn: máy khách cho qua, server chặn nếu không có trên tay')
  const snap = JSON.stringify(s1)
  tl.apply(s1, 1, { play: [9] })
  assert.equal(JSON.stringify(s1), snap, 'apply không được sửa state cũ')
  assert.deepEqual(s0.gone, [])
}

// Hằng số khớp SQL.
{
  const sql = readFileSync('supabase/migrations/0078_games_tienlen.sql', 'utf8')
  assert.equal(Number(sql.match(/c_two CONSTANT int := (\d+);/)[1]), TWO, 'c_two trong 0078 khác TWO')
  for (const m of sql.matchAll(/c_hand +CONSTANT int := (\d+);/g)) assert.equal(Number(m[1]), HAND, 'c_hand trong 0078 khác HAND')
}

// Bộ mẫu dùng chung với file kiểm 0078: SQL và JS phải ra cùng một kết quả.
{
  const check = readFileSync('supabase/manual/0078_games_tienlen_check.sql', 'utf8')
  const tc = check.split('$tc$')
  assert.equal(tc.length, 3, 'file kiểm 0078 phải có đúng một khối $tc$')
  const { combo, beats: bt, price, thoi, white } = JSON.parse(tc[1])
  for (const f of combo) assert.deepEqual(comboOf(f.cards), f.combo, 'kiểu bộ ' + JSON.stringify(f.cards))
  for (const f of bt) {
    assert.equal(beats(comboOf(f.a), f.t && comboOf(f.t)), f.beats, JSON.stringify(f.a) + ' chặn ' + JSON.stringify(f.t))
  }
  for (const f of price) assert.equal(priceOf(f.cards), f.price, 'giá chặt ' + JSON.stringify(f.cards))
  for (const f of thoi) assert.equal(thoiOf(f.hand), f.thoi, 'thối ' + JSON.stringify(f.hand))
  for (const f of white) assert.equal(whiteOf(f.hand), f.white, 'tới trắng ' + JSON.stringify(f.hand))

  const fx = check.split('$tl$')
  assert.equal(fx.length, 3, 'file kiểm 0078 phải có đúng một khối $tl$')
  const games = JSON.parse(fx[1])
  for (const g of games) {
    let s = start(g.hands, g.first)
    const log = [{ seq: 1, ...dealOf(g.hands, g.first) }]
    g.steps.forEach((st, k) => {
      const at = 'ván mẫu "' + g.note + '", nước ' + (k + 1) + ' ' + JSON.stringify(st.move)
      // Hai chỗ JS biết ít hơn server (xem 0078 game_tienlen_run): lá không có trên tay, và { out } do client gửi.
      const js = tl.validate(s, st.seat, st.move)
      if (st.log) assert.equal(js, null, at + ': nước server ghi phải hợp lệ với JS')
      else if (st.move?.out === true) assert.equal(st.err, 'games.err.badMove', at)
      else if (st.err === 'games.err.notYourCard') assert.ok(js === null || js === st.err, at + ': JS trả ' + js)
      else assert.equal(js, st.err, at)
      if (st.log || st.err == null) {
        s = tl.apply(s, st.seat, st.move)
        log.push({ seq: log.length + 1, seat: st.seat, move: st.move })
      }
    })
    assert.deepEqual(serverResult(s, g.hands), g.result, 'ván mẫu "' + g.note + '": JS chấm khác kết quả ghi trong file kiểm 0078')
    assert.deepEqual(replay(tl, {}, log), s, 'ván mẫu "' + g.note + '": dựng lại từ log phải ra đúng state')
  }
  assert.ok(games.some((g) => g.result == null) && games.some((g) => g.hands.length === 4), 'bộ ván phải có ván chưa xong và ván 4 người')
}

// MIỀN BẮC (0085): đồng chất, heo chặn mọi lẻ / đôi, không đôi thông, không tới trắng, không cóng, về bằng heo / tứ quý là về chót.
{
  const c = (r, su) => r * 4 + su // hạng 0 = 3 … 12 = 2; chất 0 ♠ 1 ♣ 2 ♦ 3 ♥
  const k = (cards) => comboOf(cards, true)
  assert.equal(variantOf({ variant: 'bac' }), 'bac')
  assert.equal(variantOf({ variant: 'x' }), 'nam', 'tuỳ chọn bậy → miền Nam như SQL')
  assert.equal(k([c(0, 0), c(1, 1), c(2, 0)]), null, 'sảnh lẫn chất không thành bộ')
  assert.equal(k([c(0, 0), c(0, 1), c(1, 0), c(1, 1), c(2, 0), c(2, 1)]), null, 'không có đôi thông')
  assert.ok(comboOf([c(0, 0), c(1, 1), c(2, 0)]), 'miền Nam vẫn nhận sảnh lẫn chất')
  assert.equal(beats(k([c(5, 1)]), k([c(4, 0)]), true), false, 'lẻ khác chất không chặn được')
  assert.equal(beats(k([c(5, 0)]), k([c(4, 0)]), true), true)
  assert.equal(beats(k([c(TWO, 0)]), k([c(11, 3)]), true), true, 'heo chặn mọi lẻ')
  assert.equal(beats(k([c(TWO, 0)]), k([c(TWO, 1)]), true), false, 'heo với heo so chất')
  assert.equal(beats(k([c(6, 2), c(6, 3)]), k([c(5, 2), c(5, 3)]), true), true, 'đôi đỏ chặn đôi đỏ')
  assert.equal(beats(k([c(6, 0), c(6, 1)]), k([c(5, 2), c(5, 3)]), true), false, 'đôi đen không chặn đôi đỏ')
  assert.equal(beats(k([c(TWO, 0), c(TWO, 1)]), k([c(9, 2), c(9, 3)]), true), true, 'đôi heo chặn mọi đôi')
  assert.equal(beats(k([c(1, 0), c(2, 0), c(3, 0)]), k([c(0, 0), c(1, 0), c(2, 0)]), true), true, 'sảnh cùng chất cao hơn')
  assert.equal(beats(k([c(1, 1), c(2, 1), c(3, 1)]), k([c(0, 0), c(1, 0), c(2, 0)]), true), false, 'sảnh khác chất')
  const quad = k([c(3, 0), c(3, 1), c(3, 2), c(3, 3)])
  assert.equal(beats(quad, k([c(TWO, 3)]), true), true, 'tứ quý chặt heo')
  assert.equal(beats(quad, k([c(TWO, 0), c(TWO, 1)]), true), true, 'tứ quý chặt đôi heo')
  assert.equal(beats(quad, k([c(11, 3)]), true), false, 'tứ quý không chặn lẻ thường')
  assert.equal(thoiOf([c(TWO, 3), c(0, 0), c(0, 1), c(1, 0), c(1, 1), c(2, 0), c(2, 1)], true), 2, 'miền Bắc không thối đôi thông')

  const bac = (hands) => {
    const n = hands.map((h) => h.length)
    const low = Math.min(...hands.flat())
    const f = hands.findIndex((h) => h.includes(low))
    const s0 = tl.setup({ options: { variant: 'bac' } })
    assert.equal(tl.validate(s0, f, { deal: { first: f, low, n, white: 0 } }), 'games.err.badMove', 'miền Bắc không tới trắng')
    return tl.apply(s0, f, { deal: { first: f, low, n, white: null } })
  }
  // Về bằng heo → về chót: người còn bài xếp trên.
  let s = bac([[c(0, 0), c(TWO, 3)], [c(1, 1), c(5, 1)]])
  s = step(s, 0, { play: [c(0, 0)] })
  assert.equal(tl.validate(s, 1, { play: [c(5, 1)] }), 'games.err.tooLow', 'lẻ khác chất bị chặn')
  s = step(s, 1, { pass: true })
  s = step(s, 0, { play: [c(TWO, 3)] })
  assert.equal(s.over, true)
  assert.deepEqual(tl.result(s).ranks, [1, 0], 'về bằng heo là về chót')
  // Không cóng: người về Nhất không kéo người chưa đánh lá nào ra khỏi ván.
  s = bac([[c(0, 0)], [c(5, 1), c(6, 1)], [c(7, 2), c(8, 2)]])
  s = step(s, 0, { play: [c(0, 0)] })
  assert.deepEqual([s.over, s.cong, s.out], [false, [], [true, false, false]])
  // Ván đầu đánh tự do (lead = 'free'): server ghi low = null → nước đầu không buộc có lá nhỏ nhất.
  {
    const free = tl.apply(tl.setup({ options: { lead: 'free' } }), 0, { deal: { first: 0, low: null, n: [2, 2], white: null } })
    assert.equal(tl.validate(free, 0, { play: [c(5, 1)] }), null, 'lead free: nước đầu không cần lá nhỏ nhất')
    const must = tl.apply(tl.setup(), 0, { deal: { first: 0, low: c(0, 0), n: [2, 2], white: null } })
    assert.equal(tl.validate(must, 0, { play: [c(5, 1)] }), 'games.err.mustLow', 'mặc định: nước đầu phải có lá nhỏ nhất')
    assert.deepEqual(tl.defaultOptions, { variant: 'nam', lead: 'must' })
  }
  // SQL 0085 chép đúng các nhánh này.
  const sql = readFileSync('supabase/migrations/0085_games_tienlen_bac.sql', 'utf8')
  for (const frag of ["options ->> 'variant' = 'bac'", 'game_tienlen_bac_combo(v_play)', 'game_tienlen_bac_beats(v_k, v_table)',
    'v_chot := v_chot || m.seat', 'v_alive || v_chot || v_cong', 'game_tienlen_bac_thoi(', "options ->> 'lead' FROM game_rooms"]) {
    assert.ok(sql.includes(frag), '0085 thiếu: ' + frag)
  }
}

console.log('tienlen check: OK')
