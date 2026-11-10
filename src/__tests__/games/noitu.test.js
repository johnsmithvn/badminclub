// node src/__tests__/games/noitu.test.js
// Luật Nối từ (lib/games/noitu.js). Sai ở đây là nhận từ không nối, chốt phiếu sai, tính giờ sai sau khi bị bác,
// hay loại nhầm người.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import nt, { ASKS, BONUS_MS, linkOf, normWord, optsOf, VOTE_MS, wordErr } from '#lib/games/noitu.js'
import { replay } from '#lib/games/registry.js'

const T0 = Date.parse('2026-11-07T10:00:00Z')
const at = (ms) => ({ at: new Date(T0 + ms).toISOString() })
const begin = (order, options) => nt.apply(nt.setup({ options }), order[0], { deal: { order } }, at(0))
const step = (s, seat, move, ms) => {
  const err = nt.validate(s, seat, move)
  assert.equal(err, null, JSON.stringify(move) + ' của ghế ' + seat + ' phải hợp lệ, bị: ' + err)
  return nt.apply(s, seat, move, at(ms))
}

// Tuỳ chọn: lạ thì về mặc định — PHẢI khớp phần đọc options ở 0091. Phòng cũ (không có dict…) chạy y như 0083.
const OLD = { dict: 'vote', cut: false, flip: true, repeat: 0 }
assert.deepEqual(optsOf({}), { lang: 'vi', link: 1, time: 20, ...OLD })
assert.deepEqual(optsOf({ lang: 'en', link: 2, time: 15 }), { lang: 'en', link: 2, time: 15, ...OLD })
assert.deepEqual(optsOf({ lang: 'fr', link: '2', time: 99, dict: 'x', cut: 1, flip: 0, repeat: 9 }), { lang: 'vi', link: 1, time: 20, ...OLD })
assert.deepEqual(optsOf({ dict: 'dict', cut: true, flip: false, repeat: 2 }), { lang: 'vi', link: 1, time: 20, dict: 'dict', cut: true, flip: false, repeat: 2 })
assert.equal(optsOf({ dict: 'vote', cut: true }).cut, false, 'không từ điển thì không chặn từ cụt')
assert.deepEqual(optsOf({ lang: 'en', dict: 'mix', cut: true, flip: false }), { lang: 'en', link: 1, time: 20, ...OLD }, 'English không có từ điển')
assert.deepEqual(nt.defaultOptions, { lang: 'vi', link: 1, time: 20, dict: 'mix', cut: false, flip: true, repeat: 0 })
assert.equal(normWord('  Học   SINH '), 'học sinh')
assert.equal(normWord('học sinh'), 'học sinh', 'chữ có dấu tổ hợp phải về dạng dựng sẵn (NFC)')
// Dấu oa / oe / uy cuối âm tiết về kiểu cũ — từ điển 0092 chuẩn hoá y vậy.
assert.equal(normWord('Hoà Bình'), 'hòa bình')
assert.equal(normWord('thuỷ thủ'), 'thủy thủ')
assert.equal(normWord('khoẻ mạnh'), 'khỏe mạnh')
assert.equal(normWord('quý giá'), 'quý giá', '"qu" giữ nguyên')
assert.equal(normWord('hoàn toàn'), 'hoàn toàn', 'có âm cuối thì không đổi')
assert.equal(normWord('huế thuệ'), 'huế thuệ')

// Chia: thứ tự lượt của server; người đầu tiên tới lượt, hạn = giờ chia + thời gian mỗi lượt.
{
  assert.equal(nt.validate(nt.setup({}), 1, { deal: { order: [1, 0] } }), null)
  assert.equal(nt.validate(nt.setup({}), 0, { deal: { order: [1, 0] } }), 'games.err.badMove', 'nước chia ghi ở ghế đi đầu')
  assert.equal(nt.validate(nt.setup({}), 1, { deal: { order: [1, 1] } }), 'games.err.badMove')
  const s = begin([1, 0])
  assert.deepEqual([s.turn, s.deadline - T0, s.fresh, s.alive], [1, 20000, true, [true, true]])
  assert.deepEqual(nt.apply(s, 1, { word: 'học sinh' }), s, 'chưa có giờ server thì không áp')
  assert.equal(nt.request(s, 1, { word: 'học sinh' }), true)
}

// Dạng từ + phần nối (tiếng Việt): 2 âm tiết, âm tiết đầu = âm tiết cuối của từ trước, không lặp.
{
  let s = begin([0, 1])
  assert.equal(wordErr(s, 'học'), 'games.err.badWord')
  assert.equal(wordErr(s, 'học sinh giỏi'), 'games.err.badWord')
  assert.equal(wordErr(s, 'Học sinh'), 'games.err.badWord', 'máy khách phải chuẩn hoá trước khi gửi')
  assert.equal(wordErr(s, 'học sinh'), null)
  s = step(s, 0, { word: 'học sinh' }, 3000)
  assert.deepEqual([s.vote.word, s.vote.left, s.asks], ['học sinh', 17000, 1])
  assert.equal(nt.validate(s, 0, { word: 'sinh viên' }), 'games.err.voting')
  assert.equal(nt.validate(s, 0, { vote: true }), 'games.err.badMove', 'người gửi không tự duyệt')
  s = step(s, 1, { vote: true }, 4000) // 2 người: người duyệt duy nhất đồng ý → nhận luôn
  assert.deepEqual([s.chain.map((c) => c.word), s.turn, s.deadline - T0, s.fresh, s.asks], [['học sinh'], 1, 24000, false, 0])
  assert.equal(linkOf(s), 'sinh ')
  assert.equal(wordErr(s, 'học sinh'), 'games.err.noLink')
  assert.equal(wordErr(s, 'sinh viên'), null)
  s = step(s, 1, { word: 'sinh viên' }, 6000)
  s = step(s, 0, { close: true }, 6000 + VOTE_MS) // im lặng = đồng ý
  assert.deepEqual([s.chain.length, s.turn], [2, 0])
  assert.equal(wordErr(s, 'viên sinh'), null)
  s = step(s, 0, { word: 'viên sinh' }, 15000)
  s = step(s, 1, { close: true }, 15000 + VOTE_MS)
  assert.equal(wordErr(s, 'sinh viên'), 'games.err.usedWord', 'không lặp từ đã dùng trong ván')
}

// English: nối bằng 1 hoặc 2 chữ cuối, dài hơn phần nối.
{
  let s = begin([0, 1], { lang: 'en', link: 2 })
  assert.equal(wordErr(s, 'table tennis'), 'games.err.badWord')
  s = step(s, 0, { word: 'table' }, 1000)
  s = step(s, 1, { vote: true }, 2000)
  assert.equal(linkOf(s), 'le')
  assert.equal(wordErr(s, 'egg'), 'games.err.noLink')
  assert.equal(wordErr(s, 'le'), 'games.err.noLink', 'phải dài hơn phần nối')
  assert.equal(wordErr(s, 'leaf'), null)
  const one = step(step(begin([0, 1], { lang: 'en' }), 0, { word: 'apple' }, 1000), 1, { vote: true }, 2000)
  assert.equal(wordErr(one, 'egg'), null)
}

// Bị bác: giữ lượt, giờ còn lại + 3 giây, từ bị bác không gửi lại; mỗi lượt gửi tối đa 2 từ.
{
  let s = begin([0, 1])
  s = step(s, 0, { word: 'cá voi' }, 5000) // còn 15 giây
  s = step(s, 1, { vote: false }, 7000)
  assert.deepEqual([s.turn, s.vote, s.deadline - T0, s.verdict.ok], [0, null, 7000 + 15000 + BONUS_MS, false])
  assert.equal(wordErr(s, 'cá voi'), 'games.err.usedWord')
  s = step(s, 0, { word: 'cá heo' }, 9000)
  s = step(s, 1, { vote: false }, 10000)
  assert.equal(s.asks, ASKS)
  assert.equal(nt.validate(s, 0, { word: 'cá mập' }), 'games.err.noAsks')
  assert.equal(nt.validate(s, 0, { giveup: true }), null)
}

// 3 người: chốt sớm khi đã rõ; hết 8 giây thì hoà phiếu vẫn nhận, bác nhiều hơn thì bác.
{
  const base = step(begin([0, 1, 2]), 0, { word: 'mặt trời' }, 1000)
  const early = step(base, 1, { vote: true }, 2000)
  assert.equal(early.vote, null, 'một phiếu đồng ý + một người chưa bầu: dù bác cũng chỉ hoà → nhận ngay')
  assert.equal(early.turn, 1)
  const wait = step(base, 1, { vote: false }, 2000)
  assert.notEqual(wait.vote, null, 'một phiếu bác chưa đủ để bác')
  assert.equal(nt.validate(wait, 1, { vote: true }), 'games.err.voted')
  const tie = step(wait, 2, { vote: true }, 3000)
  assert.deepEqual([tie.vote, tie.verdict.ok], [null, true], 'hoà phiếu thì nhận')
  const no = step(wait, 2, { vote: false }, 3000)
  assert.deepEqual([no.vote, no.verdict.ok, no.turn], [null, false, 0])
  const closed = step(wait, 0, { close: true }, 1000 + VOTE_MS)
  assert.equal(closed.verdict.ok, false, 'hết 8 giây: 0 đồng ý / 1 bác → bác')
  assert.equal(nt.validate(base, 2, { close: true }), null, 'ai cũng báo hết hạn duyệt được — server kiểm giờ')
}

// Hết giờ / Chịu: người tới lượt bị loại (máy nào báo cũng được), người kế bắt đầu lại bằng từ tự do.
{
  let s = step(step(begin([2, 0, 1]), 2, { word: 'bàn ghế' }, 1000), 0, { vote: true }, 2500)
  assert.deepEqual([s.turn, s.fresh, s.vote], [0, false, null])
  s = step(s, 2, { timeout: true }, 2500 + 20000) // ghế 2 báo ghế 0 hết giờ
  assert.deepEqual([s.alive, s.turn, s.fresh, s.last], [[false, true, true], 1, true, { seat: 0, timeout: true }])
  assert.equal(wordErr(s, 'hoa hồng'), null, 'sau khi có người bị loại: từ tự do')
  s = step(s, 1, { giveup: true }, 30000)
  assert.deepEqual([s.over, s.winner, nt.result(s)], [true, 2, { winners: [2], draw: false }])
}

// Rời bàn: người gửi rời → huỷ phiếu, người kế đi; người duyệt rời → bớt phiếu, có thể chốt luôn.
{
  const base = step(begin([0, 1, 2]), 0, { word: 'mặt trăng' }, 1000)
  const w = step(base, 1, { vote: false }, 2000)
  const voterGone = nt.apply(w, 2, { out: true }, at(3000))
  assert.deepEqual([voterGone.vote, voterGone.verdict.ok, voterGone.turn], [null, false, 0], 'còn 1 người duyệt, đã bác')
  const authorGone = nt.apply(base, 0, { out: true }, at(3000))
  assert.deepEqual([authorGone.vote, authorGone.turn, authorGone.fresh, authorGone.alive], [null, 1, true, [false, true, true]])
  assert.equal(nt.validate(authorGone, 0, { vote: true }), 'games.err.badMove')
}

// Từ điển: server ghi kèm { ok: true } → nhận ngay, không mở phiếu, không tốn lượt gửi.
{
  let s = begin([0, 1], { dict: 'mix' })
  s = step(s, 0, { word: 'học sinh', ok: true }, 2000)
  assert.deepEqual([s.vote, s.chain.map((c) => c.word), s.turn, s.deadline - T0, s.fresh, s.asks], [null, ['học sinh'], 1, 22000, false, 0])
  assert.deepEqual(s.verdict, { word: 'học sinh', seat: 0, ok: true, dict: true })
  s = step(s, 1, { word: 'sinh hoạt' }, 3000) // từ lạ → cả bàn duyệt như cũ
  assert.equal(s.vote.word, 'sinh hoạt')
}

// Đảo từ: cấm thì không được trả "sinh học" sau "học sinh"; từ khác cùng phần nối vẫn được.
{
  const yes = step(begin([0, 1]), 0, { word: 'học sinh', ok: true }, 1000)
  assert.equal(wordErr(yes, 'sinh học'), null, 'mặc định cho đảo')
  const no = step(begin([0, 1], { flip: false }), 0, { word: 'học sinh', ok: true }, 1000)
  assert.equal(wordErr(no, 'sinh học'), 'games.err.flipWord')
  assert.equal(wordErr(no, 'sinh viên'), null)
}

// Lặp từ: nhận lại tối đa `repeat` lần; từ bị bác thì vẫn không gửi lại được.
{
  const play = (repeat) => {
    let s = begin([0, 1], { repeat })
    for (const [k, w] of ['học sinh', 'sinh học', 'học sinh', 'sinh học'].entries()) s = step(s, k % 2, { word: w, ok: true }, 1000 * (k + 1))
    return s
  }
  assert.throws(() => play(0), /usedWord/, 'không cho lặp')
  assert.equal(wordErr(play(1), 'học sinh'), 'games.err.usedWord', 'đã dùng 2 lần = lặp 1 lần')
  assert.equal(wordErr(play(2), 'học sinh'), null)
  let s = begin([0, 1], { repeat: 2 })
  s = step(step(s, 0, { word: 'cá voi' }, 1000), 1, { vote: false }, 2000)
  assert.equal(wordErr(s, 'cá voi'), 'games.err.usedWord')
}

// Dựng lại từ log: lấy giờ server ở cột at của từng dòng.
{
  const room = { options: { time: 15 }, seed: 's', seats: [0, 1] }
  const log = [
    { seq: 1, seat: 1, move: { deal: { order: [1, 0] } }, ...at(0) },
    { seq: 2, seat: 0, move: { word: 'học sinh' }, ...at(500) }, // sai lượt → bỏ qua
    { seq: 3, seat: 1, move: { word: 'học sinh' }, ...at(1000) },
    { seq: 4, seat: 0, move: { vote: true }, ...at(2000) },
  ]
  const s = replay(nt, room, log)
  assert.deepEqual([s.chain.length, s.turn, s.deadline - T0, s.ply], [1, 0, 2000 + 15000, 3])
}

// SQL 0083 / 0091 dùng cùng bảng chữ, cùng hằng số, cùng mã lỗi; 0091 đọc tuỳ chọn như optsOf.
for (const f of ['0083_games_noitu.sql', '0091_games_noitu_dict.sql']) {
  const sql = readFileSync(new URL('../../../supabase/migrations/' + f, import.meta.url), 'utf8')
  assert.ok(sql.includes('a-zàáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]{1,10}'), 'bảng chữ tiếng Việt phải khớp JS')
  assert.ok(sql.includes(':= ' + VOTE_MS + ';') && sql.includes(':= ' + BONUS_MS + ';') && sql.includes(':= ' + ASKS + ';'))
  for (const k of ['badWord', 'noLink', 'usedWord', 'noVote', 'voted', 'voting', 'noAsks', 'notYet', 'late']) {
    assert.ok(sql.includes('games.err.' + k), f + ' phải dùng mã lỗi ' + k)
  }
}
{
  const sql = readFileSync(new URL('../../../supabase/migrations/0091_games_noitu_dict.sql', import.meta.url), 'utf8')
  for (const k of ['notInDict', 'deadEnd', 'flipWord']) assert.ok(sql.includes('games.err.' + k))
  for (const frag of ["v_opt ->> 'dict' IN ('mix', 'dict')", "r.options ->> 'dict' IN ('mix', 'dict')", "(v_opt ->> 'repeat')::numeric IN (1, 2)",
    "OR mv ? 'ok' THEN", `p_move || '{"ok": true}'::jsonb`]) assert.ok(sql.includes(frag), '0091 thiếu: ' + frag)
  const data = readFileSync(new URL('../../../supabase/migrations/0092_games_words_vi.sql', import.meta.url), 'utf8')
  const words = [...data.matchAll(/'([^'\n]+ [^'\n]+)'/g)].map((m) => m[1])
  assert.ok(words.length > 40000, 'từ điển phải có vài chục nghìn từ')
  const bad = words.filter((w) => wordErr(nt.setup({}), w) !== null || normWord(w) !== w)
  assert.deepEqual(bad.slice(0, 5), [], 'mọi từ trong 0092 phải đúng mẫu và đã chuẩn hoá như normWord')
  for (const w of ['học sinh', 'sinh viên', 'hòa bình']) assert.ok(words.includes(w), 'thiếu ' + w)
}

console.log('noitu check: OK')
