// node src/__tests__/lib/sky.test.js
// Nền bầu trời trang chủ: chọn nhân vật + câu thoại theo số liệu (lib/sky.js, docs/HOME_SKY.md).
import assert from 'node:assert/strict'
import { SKY_CAST, UFO_GIVE_BACK, UFO_HUH, isLate, lastPlayedAt, moonAge, pickCast, skyFacts, skyLines, skyMode, ufoOutcome, ufoScript } from '#lib/sky.js'
import vi from '#i18n/vi.json' with { type: 'json' }
import cfg from '#config/app.json' with { type: 'json' }
import { ROUTE_KEYS } from '#routes'

const keys = (arr) => arr.map((l) => l[0])
const get = (key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), vi)

// Ba tình huống mẫu của thiết kế (Tweaks → Tình huống).
const DEFAULT = { rank: 2, rd: -1, gap: 5, rival: 'Hương Giang', streak: 2, off: 1, chaser: '', cg: 0 }
const LEADER = { rank: 1, rd: 1, gap: 0, rival: '', streak: 3, off: 1, chaser: 'Hương Giang', cg: 4 }
const AWAY = { rank: 4, rd: -2, gap: 23, rival: 'VA', streak: 0, off: 12, chaser: '', cg: 0 }
const HOT = { rank: 2, rd: 1, gap: 2, rival: 'Hương Giang', streak: 5, off: 0, chaser: '', cg: 0 }

/* ---------- giờ khuya & bốc nhân vật ---------- */
assert.ok(isLate(22) && isLate(23) && isLate(0) && isLate(3), '22h–4h là khuya: cú mèo phải được ra')
assert.ok(!isLate(4) && !isLate(12) && !isLate(21), 'ngoài 22h–4h mà ra cú mèo là sai thiết kế "chỉ sau 22h"')
for (let r = 0; r < 1; r += 0.01) {
  assert.notEqual(pickCast(false, r), 'owl', 'chưa khuya mà bốc trúng cú mèo (r=' + r + ')')
  assert.ok(SKY_CAST.includes(pickCast(true, r)))
}
assert.equal(pickCast(true, 0), 'owl')
assert.equal(pickCast(false, 0.9999), 'ufo', 'r sát 1 không được tràn ra ngoài danh sách')

/* ---------- trang nào có nền ---------- */
for (const r of ['home', 'matches', 'leaderboard', 'badges', 'sessions', 'library', 'members', 'profile', 'settings']) {
  assert.equal(skyMode(r), 'full', r + ': trang đã chọn phải có nền + nhân vật')
}
assert.equal(skyMode('session'), 'bg', 'chi tiết buổi tập: chỉ nền, nhân vật bay qua bảng xếp sân là vướng')
assert.equal(skyMode('libraryPost'), 'bg')
for (const r of ['overview', 'calendar', 'tournaments', 'tournament', 'debts', 'fund', 'schema']) {
  assert.equal(skyMode(r), null, r + ': trang không chọn mà có nền là sai yêu cầu')
}
const unknown = [...cfg.sky.routes, ...cfg.sky.bgRoutes, ...cfg.ui.mobileHidden].filter((r) => !ROUTE_KEYS.includes(r))
assert.deepEqual(unknown, [], 'app.json gõ sai tên route thì trang đó lặng lẽ không có nền / không ẩn')

/* ---------- câu theo số liệu ---------- */
const d = skyLines(DEFAULT, 'Canh lá ngón')
assert.deepEqual(keys(d.owl), ['sky.owl.sleep', 'sky.owl.peek', 'sky.owl.hunt', 'sky.owl.late', 'sky.owl.bed', 'sky.line.near', 'sky.line.drop', 'sky.line.streak'],
  'mặc định (hạng 2, cách 5, tụt 1, chuỗi 2): cú phải giục vượt, an ủi tụt hạng và khen chuỗi')
assert.deepEqual(d.owl[5][1], { n: 5, name: 'Hương Giang' })
assert.deepEqual(keys(d.banner), ['sky.banner.tonight', 'sky.banner.chores', 'sky.line.near', 'sky.line.drop', 'sky.line.streak'])
assert.deepEqual(d.banner[0][1], { name: 'Canh lá ngón' }, 'băng rôn phải gọi đúng tên người đang xem')
assert.deepEqual(keys(d.hero), ['sky.hero.top1', 'sky.hero.saveWorld', 'sky.hero.forgotBag', 'sky.hero.supersonic', 'sky.line.near', 'sky.line.drop', 'sky.line.streak'])
assert.ok(keys(d.wish).includes('sky.wish.pass'), 'có người trên thì có điều ước "vượt <tên>"')

const l = skyLines(LEADER, 'A')
assert.deepEqual(keys(l.owl), ['sky.owl.sleep', 'sky.owl.peek', 'sky.owl.hunt', 'sky.owl.late', 'sky.owl.bed', 'sky.line.leader', 'sky.line.chaser', 'sky.line.streak'],
  'đang hạng 1: không được khen "vừa lên hạng" (đã hết hạng để lên) mà phải nhắc người đuổi theo')
assert.deepEqual(l.owl[6][1], { name: 'Hương Giang', n: 4 })
assert.ok(!keys(l.wish).includes('sky.wish.pass'), 'đang hạng 1 thì không còn ai để ước vượt')
assert.ok(!keys(skyLines({ ...LEADER, chaser: '' }, 'A').owl).includes('sky.line.chaser'), 'CLB một người thì không có người đuổi theo')

const a = skyLines(AWAY, 'A')
assert.deepEqual(keys(a.owl), ['sky.line.missRacket', 'sky.line.daysOff', 'sky.line.far'],
  'nghỉ 12 ngày: cú thôi giục đi ngủ / phục thù, không xát muối tụt hạng, chỉ nhắc ra sân')
assert.deepEqual(a.owl[1][1], { n: 12 })
assert.deepEqual(a.owl[2][1], { rank: 3, n: 23 }, 'cách xa (> nearGap) thì nói "cách hạng 3 còn 23 điểm"')
assert.deepEqual(keys(a.banner), ['sky.banner.missRacket', 'sky.banner.chores', 'sky.line.daysOff', 'sky.line.far'],
  'nghỉ lâu: băng rôn mở bằng "Vợt đang nhớ bạn đấy" và không lặp lại câu đó lần nữa')

const h = skyLines(HOT, 'A')
assert.ok(keys(h.owl).includes('sky.line.rise') && !keys(h.owl).includes('sky.line.drop'))
assert.deepEqual(h.owl.at(-1), ['sky.line.streak', { n: 5 }])

assert.deepEqual(keys(skyLines({ ...DEFAULT, rank: null, rival: '', rd: 0, streak: 0 }, 'A').owl), ['sky.owl.sleep', 'sky.owl.peek', 'sky.owl.hunt', 'sky.owl.late', 'sky.owl.bed'],
  'chưa có hạng mùa thì không được nói "Cách hạng 0" hay "vượt undefined"')

/* ---------- cảnh UFO ---------- */
const me = ufoScript(DEFAULT, true, 'Canh lá ngón')
assert.ok(me.me && me.victim === '')
assert.deepEqual(keys(me.rise), ['sky.ufo.rise.court', 'sky.ufo.rise.letGo', 'sky.ufo.rise.near', 'sky.ufo.rise.streak'])
assert.deepEqual(me.abduct, ['sky.ufo.abductMe', { rank: 2 }])
const rv = ufoScript(DEFAULT, false, 'Canh lá ngón')
assert.equal(rv.victim, 'Hương Giang', 'đang hạng 2: UFO bắt người NGAY TRÊN mình')
assert.deepEqual(rv.rise[2], ['sky.ufo.rise.ahead', { name: 'Canh lá ngón', n: 5 }])
assert.deepEqual(rv.abduct, ['sky.ufo.abductRival', { name: 'Hương Giang' }])
const ch = ufoScript(LEADER, false, 'A')
assert.equal(ch.victim, 'Hương Giang', 'đang hạng 1: UFO bắt người đang đuổi theo mình')
assert.deepEqual(keys(ch.rise), ['sky.ufo.rise.court', 'sky.ufo.rise.help', 'sky.ufo.rise.chasing'])
assert.equal(ch.abduct[0], 'sky.ufo.abductChaser')
assert.ok(ufoScript({ ...LEADER, chaser: '' }, false, 'A').me, 'không có ai kề trên BXH thì UFO bắt chính mình')
assert.equal(ufoScript({ ...DEFAULT, rank: null, rival: '' }, true, 'A').abduct, null, 'chưa có hạng thì bỏ câu "Mượn tay vợt hạng …"')
assert.ok(keys(ufoScript(AWAY, true, 'A').rise).includes('sky.ufo.rise.away'))
assert.deepEqual([me.thank, rv.thank], [['sky.ufo.thankMe'], ['sky.ufo.thankRival']], 'được siêu nhân cứu: bạn và người kia cảm ơn khác nhau')
assert.deepEqual(keys(me.slip), ['sky.ufo.slipMe.home', 'sky.ufo.slipMe.game'])
assert.deepEqual(keys(rv.slip), ['sky.ufo.slipRival.rank', 'sky.ufo.slipRival.phew'])
assert.deepEqual(rv.safe, ['sky.ufo.safeRival', { name: 'Canh lá ngón' }], 'người kia bị bắn rơi thì nghi chính bạn bắn')

// Tỉ lệ kết cục của thiết kế: bắt cóc 20% · siêu nhân 28% · bắn rơi 28% · tuột 11% · trả lại 13%.
const tally = (can) => {
  const n = {}
  for (let i = 0; i < 10000; i++) { const o = ufoOutcome(i / 10000, can); n[o] = (n[o] || 0) + 1 }
  return n
}
// Quét đều 10.000 điểm; ±1 vì điểm nằm đúng biên rơi về bên nào là do làm tròn số thực.
const want = { ok: 2000, rescue: 2800, down: 2800, slip: 1100, ret: 1300 }, got = tally(true)
assert.deepEqual(Object.keys(got).sort(), Object.keys(want).sort(), 'phải ra đủ năm kết cục')
for (const o in want) assert.ok(Math.abs(got[o] - want[o]) <= 1, 'tỉ lệ kết cục "' + o + '" lệch thiết kế: ' + got[o] + '/10000')
const noRank = tally(false)
assert.equal(noRank.ok, undefined, 'không có câu bắt cóc thì không được ra kết cục bắt cóc')
assert.deepEqual(Object.keys(noRank).sort(), ['down', 'rescue', 'ret', 'slip'], 'bỏ bắt cóc thì bốn kết cục còn lại vẫn phải ra được')
assert.equal(ufoOutcome(0.9999999, true), 'ret', 'r sát 1 không được tràn ra ngoài danh sách')

/* ---------- đọc số liệu ---------- */
const now = new Date(2026, 9, 17, 23, 0)
const facts = skyFacts({
  hero: { seasonRank: 1, seasonRankDelta: 1, seasonPointsToNextRank: 0, seasonTargetRival: null },
  form: { streak: 3 },
  season: [{ name: 'Bạn', points: 287, isMe: true }, { name: 'Hương Giang', points: 283 }],
  lastAt: new Date(2026, 9, 5, 20, 30).getTime(),
  now,
})
assert.deepEqual(facts, { rank: 1, rd: 1, gap: 0, rival: '', streak: 3, off: 12, chaser: 'Hương Giang', cg: 4 })
assert.equal(skyFacts({ hero: null, form: null, season: [], lastAt: 0, now }).off, 0, 'chưa đánh trận nào không phải là "nghỉ lâu"')
assert.equal(skyFacts({ hero: {}, form: {}, season: [], lastAt: new Date(2026, 9, 17, 6).getTime(), now }).off, 0, 'đánh sáng nay là 0 ngày, không phải 1')
assert.deepEqual(skyFacts({ now }), { rank: null, rd: 0, gap: 0, rival: '', streak: 0, off: 0, chaser: '', cg: 0 }, 'trang chỉ có nền / chưa ghép thành viên: số liệu rỗng, không throw')

const MS = [{ at: 100, teamA: ['me', 'x'], teamB: ['y', 'z'] }, { at: 300, teamA: ['y', 'z'], teamB: ['x', 'w'] }, { at: 200, teamA: ['y', 'w'], teamB: ['me', 'z'] }, { teamA: ['me'] }]
assert.equal(lastPlayedAt(MS, 'me'), 200, 'trận gần nhất của MÌNH, không phải của cả CLB')
assert.equal(lastPlayedAt(MS, 'nobody'), 0)
assert.equal(lastPlayedAt(undefined, 'me'), 0)

assert.deepEqual(keys(skyLines(DEFAULT, '').banner).slice(0, 2), ['sky.banner.chores', 'sky.line.near'], 'không có tên thì băng rôn không được kéo " ơi, tối nay đánh không?"')

/* ---------- trăng ---------- */
assert.equal(moonAge('full', now), 29.530589 / 2)
const age = moonAge('lunar', now)
assert.ok(age >= 0 && age < 29.6, 'tuổi trăng phải nằm trong một chu kỳ')

/* ---------- mọi key nhân vật có thể nói đều có chữ trong vi.json ---------- */
const all = [DEFAULT, LEADER, AWAY, HOT, { ...DEFAULT, rank: null }].flatMap((st) => {
  const L = skyLines(st, 'A')
  const u = [true, false].map((m) => ufoScript(st, m, 'A'))
  return [...L.owl, ...L.banner, ...L.hero, ...L.wish, ...u.flatMap((x) => [...x.rise, x.abduct, x.heroSay, x.thank, x.safe, ...x.slip].filter(Boolean))]
}).concat(UFO_GIVE_BACK, UFO_HUH)
const missing = [...new Set(keys(all))].filter((k) => typeof get(k) !== 'string')
assert.deepEqual(missing, [], 'nhân vật sẽ nói nguyên chuỗi key thay vì câu thoại')
for (const k of ['sky.you', 'sky.boom', 'sky.wishTitle', 'sky.ufo.huh', 'sky.ufo.hit', 'sky.ufo.slip', 'sky.tip.owl', 'sky.tip.banner', 'sky.tip.hero', 'sky.tip.wish', 'sky.tip.ufo']) {
  assert.equal(typeof get(k), 'string', 'thiếu chữ ' + k)
}
assert.equal(get('sky.cons').length, 6, 'sáu chòm sao vẽ trong SkyBackdrop phải có đủ sáu tên')

console.log('sky check: OK')
