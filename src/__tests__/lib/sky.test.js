// node src/__tests__/lib/sky.test.js
// Nền bầu trời trang chủ: chọn nhân vật + câu thoại theo số liệu (lib/sky.js, docs/HOME_SKY.md).
import assert from 'node:assert/strict'
import { SKY_CAST, isLate, moonAge, pickCast, skyFacts, skyLines, ufoOutcome, ufoScript } from '#lib/sky.js'
import vi from '#i18n/vi.json' with { type: 'json' }

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

/* ---------- câu theo số liệu ---------- */
const d = skyLines(DEFAULT, 'Canh lá ngón')
assert.deepEqual(keys(d.owl), ['sky.owl.sleep', 'sky.owl.peek', 'sky.line.near', 'sky.line.drop', 'sky.line.streak'],
  'mặc định (hạng 2, cách 5, tụt 1, chuỗi 2): cú phải giục vượt, an ủi tụt hạng và khen chuỗi')
assert.deepEqual(d.owl[2][1], { n: 5, name: 'Hương Giang' })
assert.deepEqual(keys(d.banner), ['sky.banner.tonight', 'sky.banner.chores', 'sky.line.near', 'sky.line.drop', 'sky.line.streak'])
assert.deepEqual(d.banner[0][1], { name: 'Canh lá ngón' }, 'băng rôn phải gọi đúng tên người đang xem')
assert.deepEqual(keys(d.hero), ['sky.hero.top1', 'sky.line.near', 'sky.line.drop', 'sky.line.streak'])
assert.ok(keys(d.wish).includes('sky.wish.pass'), 'có người trên thì có điều ước "vượt <tên>"')

const l = skyLines(LEADER, 'A')
assert.deepEqual(keys(l.owl), ['sky.owl.sleep', 'sky.owl.peek', 'sky.line.leader', 'sky.line.chaser', 'sky.line.streak'],
  'đang hạng 1: không được khen "vừa lên hạng" (đã hết hạng để lên) mà phải nhắc người đuổi theo')
assert.deepEqual(l.owl[3][1], { name: 'Hương Giang', n: 4 })
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

assert.deepEqual(keys(skyLines({ ...DEFAULT, rank: null, rival: '', rd: 0, streak: 0 }, 'A').owl), ['sky.owl.sleep', 'sky.owl.peek'],
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

assert.equal(ufoOutcome(0, true), 'abduct')
assert.equal(ufoOutcome(0.5, true), 'hero')
assert.equal(ufoOutcome(0.99, true), 'rocket')
for (let r = 0; r < 1; r += 0.05) assert.notEqual(ufoOutcome(r, false), 'abduct', 'không có câu bắt cóc thì không được ra kết cục bắt cóc')

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

/* ---------- trăng ---------- */
assert.equal(moonAge('full', now), 29.530589 / 2)
const age = moonAge('lunar', now)
assert.ok(age >= 0 && age < 29.6, 'tuổi trăng phải nằm trong một chu kỳ')

/* ---------- mọi key nhân vật có thể nói đều có chữ trong vi.json ---------- */
const all = [DEFAULT, LEADER, AWAY, HOT, { ...DEFAULT, rank: null }].flatMap((st) => {
  const L = skyLines(st, 'A')
  const u = [true, false].map((m) => ufoScript(st, m, 'A'))
  return [...L.owl, ...L.banner, ...L.hero, ...L.wish, ...u.flatMap((x) => [...x.rise, x.abduct, x.heroSay, x.safe].filter(Boolean))]
})
const missing = [...new Set(keys(all))].filter((k) => typeof get(k) !== 'string')
assert.deepEqual(missing, [], 'nhân vật sẽ nói nguyên chuỗi key thay vì câu thoại')
for (const k of ['sky.you', 'sky.boom', 'sky.wishTitle', 'sky.ufo.hero', 'sky.tip.owl', 'sky.tip.banner', 'sky.tip.hero', 'sky.tip.ufo', 'sky.tip.victim', 'sky.tip.wish']) {
  assert.equal(typeof get(k), 'string', 'thiếu chữ ' + k)
}
assert.equal(get('sky.cons').length, 6, 'sáu chòm sao vẽ trong SkyBackdrop phải có đủ sáu tên')

console.log('sky check: OK')
