// node src/__tests__/lib/sky.test.js
// Nền bầu trời trang chủ: chọn nhân vật + câu thoại theo số liệu (lib/sky.js, docs/HOME_SKY.md).
import assert from 'node:assert/strict'
import { OWL_WAKE, SKY_ACT_MS, SKY_CAST, UFO_GIVE_BACK, UFO_HUH, UFO_OUTCOMES, beatenBy, createBags, drawCast, isLate, lastMatchOf, lastPlayedAt, moonAge, shortName, shuffled, skyFacts, skyFoes, skyLines, skyMode, ufoPool, ufoScript } from '#lib/sky.js'
import vi from '#i18n/vi.json' with { type: 'json' }
import cfg from '#config/app.json' with { type: 'json' }
import { ROUTE_KEYS } from '#routes'

const keys = (arr) => arr.map((l) => l[0])
const get = (key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), vi)

// Ba tình huống mẫu của thiết kế (Tweaks → Tình huống).
const DEFAULT = { rank: 2, rd: -1, gap: 5, rival: 'Hương Giang', streak: 2, off: 1 }
const LEADER = { rank: 1, rd: 1, gap: 0, rival: '', streak: 3, off: 1 }
const AWAY = { rank: 4, rd: -2, gap: 23, rival: 'VA', streak: 0, off: 12 }
const HOT = { rank: 2, rd: 1, gap: 2, rival: 'Hương Giang', streak: 5, off: 0 }
const HERO = ['sky.hero.top1', 'sky.hero.saveWorld', 'sky.hero.forgotBag', 'sky.hero.supersonic', 'sky.hero.riceCooker', 'sky.hero.noRacket']
const BANNER = ['sky.banner.chores', 'sky.banner.moms', 'sky.banner.wow', 'sky.banner.sneak', 'sky.banner.hoaSen']

/* ---------- giờ khuya & bốc nhân vật ---------- */
assert.ok(isLate(22) && isLate(23) && isLate(0) && isLate(3), '22h–4h là khuya: cú mèo phải được ra')
assert.ok(!isLate(4) && !isLate(12) && !isLate(21), 'ngoài 22h–4h mà ra cú mèo là sai thiết kế "chỉ sau 22h"')

/* ---------- túi xáo: đủ một lượt mới lặp ---------- */
assert.deepEqual([...shuffled(7)].sort(), [0, 1, 2, 3, 4, 5, 6], 'xáo không được mất / lặp phần tử')
{
  const draw = createBags()
  for (const n of [2, 3, 5, 7]) {
    let prev = -1
    for (let round = 0; round < 40; round++) {
      const got = Array.from({ length: n }, () => draw('k' + n, n))
      assert.deepEqual([...got].sort((a, b) => a - b), [...Array(n).keys()], 'mỗi lượt ' + n + ' phần tử phải ra đủ cả ' + n + ' trước khi lặp: ' + got)
      assert.notEqual(got[0], prev, 'chỗ nối hai lượt không được lặp lại phần tử vừa ra')
      prev = got[n - 1]
    }
  }
  assert.equal(draw('one', 1), 0, 'danh sách 1 phần tử luôn ra phần tử đó')
  draw('chg', 5); draw('chg', 5)
  const after = Array.from({ length: 3 }, () => draw('chg', 3))
  assert.deepEqual([...after].sort(), [0, 1, 2], 'danh sách đổi độ dài (câu theo số liệu đổi) thì xáo lượt mới cho đủ độ dài mới')
}

/* ---------- túi nhân vật qua các lần mở trang ---------- */
{
  let left = [], seen = []
  for (let i = 0; i < SKY_CAST.length; i++) { const d = drawCast(left, true); seen.push(d.cast); left = d.left }
  assert.deepEqual([...seen].sort(), [...SKY_CAST].sort(), 'khuya: 5 lần mở phải gặp đủ 5 nhân vật')
  for (let n = 0; n < 50; n++) {
    const d = drawCast(left, false)
    assert.notEqual(d.cast, 'owl', 'chưa khuya mà ra cú mèo là sai thiết kế "chỉ sau 22h"')
    left = d.left
  }
  const day = Array.from({ length: 4 }, function () { const d = drawCast(this.left, false); this.left = d.left; return d.cast }, { left: [] })
  assert.deepEqual([...day].sort(), ['banner', 'hero', 'top1', 'ufo'], 'ban ngày: 4 lần mở gặp đủ 4 nhân vật không phải cú')
  assert.deepEqual(drawCast(['owl', 'ufo'], false), { cast: 'ufo', left: ['owl'] }, 'chưa khuya: cú vẫn nằm trong túi chờ lần mở lúc khuya')
  const stuck = drawCast(['owl'], false).cast
  assert.ok(SKY_CAST.includes(stuck) && stuck !== 'owl', 'túi chỉ còn cú mà chưa khuya thì xáo túi mới, không kẹt (ra: ' + stuck + ')')
  assert.ok(SKY_CAST.includes(drawCast('rác', true).cast), 'localStorage hỏng thì vẫn bốc được nhân vật')
}

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
assert.deepEqual(keys(d.owl), ['sky.owl.sleep', 'sky.owl.peek', 'sky.owl.hunt', 'sky.owl.late', 'sky.owl.bed', 'sky.line.drop', 'sky.line.streak'],
  'mặc định (hạng 2, tụt 1, chuỗi 2): cú an ủi tụt hạng và khen chuỗi — không còn câu "còn N điểm là vượt" / "cách hạng"')
assert.deepEqual(d.owl[5][1], { n: 1 })
assert.deepEqual(keys(d.banner), ['sky.banner.tonight', ...BANNER, 'sky.line.drop', 'sky.line.streak'])
assert.deepEqual(d.banner[0][1], { name: 'Canh lá ngón' }, 'băng rôn phải gọi đúng tên người đang xem')
assert.deepEqual(keys(d.hero), [...HERO, 'sky.line.drop', 'sky.line.streak'])
assert.ok(keys(d.wish).includes('sky.wish.pass'), 'có người trên thì có điều ước "vượt <tên>"')

const l = skyLines(LEADER, 'A')
assert.deepEqual(keys(l.owl), ['sky.owl.sleep', 'sky.owl.peek', 'sky.owl.hunt', 'sky.owl.late', 'sky.owl.bed', 'sky.line.leader', 'sky.line.streak'],
  'đang hạng 1: không được khen "vừa lên hạng" (đã hết hạng để lên)')
assert.ok(!keys(l.wish).includes('sky.wish.pass'), 'đang hạng 1 thì không còn ai để ước vượt')

const a = skyLines(AWAY, 'A')
assert.deepEqual(keys(a.owl), ['sky.line.missRacket', 'sky.line.daysOff'],
  'nghỉ 12 ngày: cú thôi giục đi ngủ / phục thù, không xát muối tụt hạng, chỉ nhắc ra sân')
assert.deepEqual(a.owl[1][1], { n: 12 })
assert.deepEqual(keys(a.banner), ['sky.banner.missRacket', ...BANNER.filter((k) => k !== 'sky.banner.sneak'), 'sky.line.daysOff'],
  'nghỉ lâu: băng rôn mở bằng "Vợt đang nhớ bạn đấy", không lặp lại câu đó, không trêu "trốn đi đánh cầu hơi nhiều"')

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
assert.deepEqual(keys(rv.rise), ['sky.ufo.rise.court', 'sky.ufo.rise.help', 'sky.ufo.rise.ahead'])
const ch = ufoScript(LEADER, false, 'A')
assert.ok(ch.me && ch.victim === '', 'đang hạng 1: không có người trên → UFO luôn bắt chính mình (bỏ cảnh bắt người đuổi theo)')
assert.deepEqual(ch.abduct, ['sky.ufo.abductMe', { rank: 1 }])
assert.deepEqual([me.heroSay, rv.heroSay], [['sky.hero.rescue'], ['sky.hero.rescue']], 'siêu nhân cứu ai cũng nói cùng một câu')
assert.equal(ufoScript({ ...DEFAULT, rank: null, rival: '' }, true, 'A').abduct, null, 'chưa có hạng thì bỏ câu "Mượn tay vợt hạng …"')
assert.ok(keys(ufoScript(AWAY, true, 'A').rise).includes('sky.ufo.rise.away'))
assert.deepEqual([me.thank, rv.thank], [['sky.ufo.thankMe'], ['sky.ufo.thankRival']], 'được siêu nhân cứu: bạn và người kia cảm ơn khác nhau')
assert.deepEqual(keys(me.slip), ['sky.ufo.slipMe.home', 'sky.ufo.slipMe.game'])
assert.deepEqual(keys(rv.slip), ['sky.ufo.slipRival.rank', 'sky.ufo.slipRival.phew'])
assert.deepEqual(rv.safe, ['sky.ufo.safeRival', { name: 'Canh lá ngón' }], 'người kia bị bắn rơi thì nghi chính bạn bắn')

// Kết cục rút bằng túi xáo (như SkyBackdrop → ufoScene): cứ 5 cảnh UFO là đủ cả 5 kết cục.
assert.deepEqual(ufoPool(true), UFO_OUTCOMES)
assert.deepEqual(ufoPool(false), ['rescue', 'down', 'slip', 'ret'], 'không có câu bắt cóc thì không được ra kết cục bắt cóc')
{
  const draw = createBags()
  for (const can of [true, false]) {
    const pool = ufoPool(can)
    for (let round = 0; round < 10; round++) {
      const seen = Array.from({ length: pool.length }, () => pool[draw('ufo' + can, pool.length)])
      assert.deepEqual([...seen].sort(), [...pool].sort(), 'một lượt ' + pool.length + ' cảnh UFO phải gặp đủ ' + pool.length + ' kết cục: ' + seen)
    }
  }
}

/* ---------- đọc số liệu ---------- */
const now = new Date(2026, 9, 17, 23, 0)
const facts = skyFacts({
  hero: { seasonRank: 1, seasonRankDelta: 1, seasonPointsToNextRank: 0, seasonTargetRival: null },
  form: { streak: 3 },
  lastAt: new Date(2026, 9, 5, 20, 30).getTime(),
  now,
})
assert.deepEqual(facts, { rank: 1, rd: 1, gap: 0, rival: '', streak: 3, off: 12 })
assert.equal(skyFacts({ hero: null, form: null, lastAt: 0, now }).off, 0, 'chưa đánh trận nào không phải là "nghỉ lâu"')
assert.equal(skyFacts({ hero: {}, form: {}, lastAt: new Date(2026, 9, 17, 6).getTime(), now }).off, 0, 'đánh sáng nay là 0 ngày, không phải 1')
assert.deepEqual(skyFacts({ now }), { rank: null, rd: 0, gap: 0, rival: '', streak: 0, off: 0 }, 'trang chỉ có nền / chưa ghép thành viên: số liệu rỗng, không throw')

const MS = [{ at: 100, teamA: ['me', 'x'], teamB: ['y', 'z'] }, { at: 300, teamA: ['y', 'z'], teamB: ['x', 'w'] }, { at: 200, teamA: ['y', 'w'], teamB: ['me', 'z'] }, { teamA: ['me'] }]
assert.equal(lastPlayedAt(MS, 'me'), 200, 'trận gần nhất của MÌNH, không phải của cả CLB')
assert.equal(lastPlayedAt(MS, 'nobody'), 0)
assert.equal(lastPlayedAt(undefined, 'me'), 0)
assert.equal(lastMatchOf(MS, 'me').at, 200)

/* ---------- tên dài ---------- */
assert.equal(shortName('Canh lá đắng :)))'), 'Canh lá đắng :)))', 'tên ≤ 20 ký tự giữ nguyên')
assert.equal(shortName('Tiểu Công Chúa đang muốn đi ngủ'), 'Tiểu Công Chúa đang…', 'cắt ở khoảng trắng gần nhất')
assert.equal(shortName('Trông kia đàn gà con lông vàng ◕⩊◕ Đi theo mẹ tìm ăn trong vườn  ◍•ᴗ•◍'), 'Trông kia đàn gà…')
assert.equal(shortName('A'.repeat(30)), 'A'.repeat(20) + '…', 'không có khoảng trắng thì cắt cứng')
assert.equal(shortName(''), '')

/* ---------- réo tên đối thủ: gạ kèo (băng rôn) & điều ước ---------- */
assert.equal(beatenBy({ winnerTeam: 'B', teamA: ['me', 'x'], teamB: ['y', 'z'] }, 'me'), 'y', 'thua trận gần nhất → người đội thắng')
assert.equal(beatenBy({ winnerTeam: 'A', teamA: ['me', 'x'], teamB: ['y', 'z'] }, 'me'), '', 'thắng thì không có ai "vừa thắng mình"')
assert.equal(beatenBy({ winnerTeam: 'A', teamA: ['y'], teamB: ['me'] }, 'me'), 'y')
assert.equal(beatenBy({ winnerTeam: null, teamA: ['me'], teamB: ['y'] }, 'me'), '', 'trận chưa có kết quả')
assert.equal(beatenBy(null, 'me'), '')

const P = (id, female = false) => ({ id, name: 'N' + id, female })
const TOP = [P('a'), P('me'), P('b', true), P('c'), P('d', true), P('e'), P('f'), P('g', true)]
assert.deepEqual(skyFoes({ meId: 'me', female: false, top: TOP }).foes, ['Na', 'Nb', 'Nc', 'Nd', 'Ne'], 'nam: 5 người cao nhất BXH mùa, trừ mình')
assert.deepEqual(skyFoes({ meId: 'me', female: true, top: TOP }).foes, ['Nb', 'Nd', 'Ng'], 'nữ: chỉ réo tên các bạn nữ')
assert.deepEqual(skyFoes({ meId: 'me', female: true, top: [P('a'), P('c')] }).foes, ['Na', 'Nc'], 'nữ mà BXH không có bạn nữ nào thì lấy như thường')
assert.deepEqual(skyFoes({ meId: 'me', female: false, top: TOP, arch: P('c') }).foes, ['Nc', 'Na', 'Nb', 'Nd', 'Ne'], 'kỳ phùng địch thủ đứng đầu, không trùng tên')
assert.deepEqual(skyFoes({ meId: 'me', female: true, top: TOP, arch: P('c') }).foes, ['Nb', 'Nd', 'Ng'], 'nữ: kỳ phùng địch thủ là nam thì bỏ')
assert.deepEqual(skyFoes({ meId: 'me', female: false }).foes, [], 'chưa có BXH mùa: không réo ai')
assert.equal(skyFoes({ meId: 'me', top: TOP, arch: P('c'), beatBy: P('z') }).dare, 'Nz', 'gạ kèo: ưu tiên người vừa thắng mình')
assert.equal(skyFoes({ meId: 'me', top: TOP, arch: P('c') }).dare, 'Nc', 'không ai vừa thắng mình → kỳ phùng địch thủ')
assert.equal(skyFoes({ meId: 'me', top: TOP }).dare, '', 'không có ai để gạ thì không có câu gạ kèo')

const fo = skyLines({ ...DEFAULT, dare: 'Vương', foes: ['Vương', 'Hương Giang'] }, 'A')
assert.deepEqual(fo.banner[1], ['sky.banner.dare', { name: 'Vương' }])
assert.deepEqual(fo.wish.slice(-2), [['sky.wish.own', { foes: ['Vương', 'Hương Giang'] }], ['sky.wish.bonk', { foes: ['Vương', 'Hương Giang'] }]],
  'điều ước réo tên giữ cả danh sách để tên rút lúc ước')
assert.ok(!keys(d.wish).includes('sky.wish.own') && !keys(d.banner).includes('sky.banner.dare'), 'không có ai để réo thì không có câu réo tên')

assert.deepEqual(keys(skyLines(DEFAULT, '').banner).slice(0, 2), ['sky.banner.chores', 'sky.banner.moms'], 'không có tên thì băng rôn không được kéo " ơi, tối nay đánh không?"')

/* ---------- trăng ---------- */
assert.equal(moonAge('full', now), 29.530589 / 2)
const age = moonAge('lunar', now)
assert.ok(age >= 0 && age < 29.6, 'tuổi trăng phải nằm trong một chu kỳ')

/* ---------- mọi key nhân vật có thể nói đều có chữ trong vi.json ---------- */
const all = [DEFAULT, LEADER, AWAY, HOT, { ...DEFAULT, rank: null }, { ...DEFAULT, dare: 'B', foes: ['B'] }].flatMap((st) => {
  const L = skyLines(st, 'A')
  const u = [true, false].map((m) => ufoScript(st, m, 'A'))
  return [...L.owl, ...L.banner, ...L.hero, ...L.wish, ...u.flatMap((x) => [...x.rise, x.abduct, x.heroSay, x.thank, x.safe, ...x.slip].filter(Boolean))]
}).concat(UFO_GIVE_BACK, UFO_HUH, OWL_WAKE)
const missing = [...new Set(keys(all))].filter((k) => typeof get(k) !== 'string')
assert.deepEqual(missing, [], 'nhân vật sẽ nói nguyên chuỗi key thay vì câu thoại')
for (const k of ['sky.boom', 'sky.ufo.huh', 'sky.ufo.hit', 'sky.ufo.slip', 'sky.owl.zzz', 'sky.owl.pop']) {
  assert.equal(typeof get(k), 'string', 'thiếu chữ ' + k)
}
assert.equal(get('sky.cons').length, 6, 'sáu chòm sao vẽ trong SkyBackdrop phải có đủ sáu tên')

/* ---------- hoạt cảnh định kỳ & cú ngủ gật ---------- */
for (const [act, ms] of Object.entries(SKY_ACT_MS)) {
  assert.ok(cfg.sky[act + 'FirstMs'] > 0, act + 'FirstMs phải > 0')
  assert.ok(cfg.sky[act + 'EveryMs'] > ms, act + ': nhịp lặp ' + cfg.sky[act + 'EveryMs'] + ' ms ngắn hơn một lượt diễn ' + ms + ' ms — lượt mới sẽ cắt ngang lượt đang diễn')
}
const [idleMin, idleMax] = cfg.sky.owlIdleMs
assert.ok(idleMin > 0 && idleMin <= idleMax, 'owlIdleMs phải là [min, max] với 0 < min ≤ max')
assert.equal(UFO_GIVE_BACK.length, 9, 'UFO trả người: 9 câu (thêm galaxy, sweat)')

console.log('sky check: OK')
