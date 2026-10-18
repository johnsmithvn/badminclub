// node src/__tests__/lib/sky.test.js
// Nền bầu trời trang chủ: chọn nhân vật + câu thoại theo số liệu (lib/sky.js, docs/HOME_SKY.md).
import assert from 'node:assert/strict'
import { OWL_WAKE, SKY_ACT_MS, SKY_CAST, UFO_GIVE_BACK, UFO_HUH, UFO_OUTCOMES, beatenBy, createBags, fxMs, isLate, normSkyPrefs, SKY_FX, SKY_FX_MAX, lastMatchOf, lastPlayedAt, moonAge, opponentsOf, SKY_PREFS_V, shortName, shuffled, skyFacts, skyFoes, skyLines, skyMode, stageNext, ufoPool, ufoScript } from '#lib/sky.js'
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

/* ---------- cài đặt hiệu ứng (trang Giao diện) ---------- */
{
  const def = normSkyPrefs(undefined)
  assert.ok(Object.values(def.on).every((x) => x === true), 'PC chưa chỉnh gì: bật hết, kể cả hiệu ứng nền')
  const phone = normSkyPrefs(undefined, true)
  assert.deepEqual(Object.keys(phone.on).filter((k) => phone.on[k]).sort(), [...cfg.sky.mobileOn].sort(), 'điện thoại chưa chỉnh gì: chỉ bật sky.mobileOn')
  assert.deepEqual(cfg.sky.mobileOn.filter((k) => !SKY_FX.some((x) => x.key === k)), [], 'app.json → sky.mobileOn gõ sai tên hiệu ứng')
  for (const fx of SKY_FX.filter((x) => x.min)) {
    assert.equal(def.every[fx.key], cfg.sky.fx[fx.key], fx.key + ': mặc định lấy app.json → sky.fx')
    assert.ok(cfg.sky.fx[fx.key] >= fx.min && cfg.sky.fx[fx.key] <= SKY_FX_MAX, fx.key + ': mặc định nằm ngoài [min, max]')
  }
  for (const k of SKY_CAST) assert.ok(SKY_FX.some((x) => x.key === k), k + ': nhân vật nào cũng phải tắt được ở trang Giao diện')
  const p = normSkyPrefs({ v: SKY_PREFS_V, on: { hero: true, ambient: true, banner: false, rác: true }, every: { hero: 5, ufo: '50', wish: 99999, banner: 'abc', cuoi: -3, owl: 12 } })
  assert.equal(p.on.hero, true); assert.equal(p.on.ambient, true); assert.equal(p.on.banner, false); assert.equal(p.on.ufo, true, 'khoá không có trong bản lưu thì theo mặc định của máy')
  assert.equal(normSkyPrefs(p).v, SKY_PREFS_V, 'lưu rồi đọc lại phải giữ được công tắc')
  // Bản lưu trước khi đổi mặc định (không có v / v cũ): công tắc về mặc định của máy, số giây giữ nguyên.
  const saved = { v: SKY_PREFS_V - 1, on: { hero: false, owl: false, ambient: false, wish: false }, every: { hero: 20 } }
  assert.ok(Object.values(normSkyPrefs(saved).on).every(Boolean), 'migrate PC: bản lưu cũ tắt gì cũng về bật hết')
  assert.deepEqual(normSkyPrefs(saved, true).on, phone.on, 'migrate điện thoại: về đúng mặc định điện thoại')
  assert.equal(normSkyPrefs(saved).every.hero, 20, 'migrate: giữ số giây người dùng đã chỉnh')
  assert.ok(!('rác' in p.on) && !('owl' in p.every), 'khoá lạ / hiệu ứng chỉ bật-tắt không có ô số giây')
  assert.deepEqual([p.every.hero, p.every.ufo, p.every.wish, p.every.banner, p.every.cuoi], [5, 50, SKY_FX_MAX, cfg.sky.fx.banner, cfg.sky.fx.cuoi],
    'giữ số đang gõ dở (5), đọc chuỗi số, chặn trên 3600, sai kiểu / âm thì về mặc định')
  assert.equal(fxMs(p, 'hero'), 10000, 'gõ 5 giây cho siêu nhân thì vẫn chạy theo tối thiểu 10 giây')
  assert.equal(fxMs(p, 'ufo'), 50000)
  assert.equal(fxMs(normSkyPrefs('rác'), 'eclipse'), cfg.sky.fx.eclipse * 1000, 'localStorage hỏng thì dùng mặc định')
  // Trang Giao diện ghép key theo SKY_FX (themePage.fx.<key>.*, themePage.group.<g>) — test i18n chung không thấy.
  for (const fx of SKY_FX) for (const k of ['themePage.fx.' + fx.key + '.label', 'themePage.fx.' + fx.key + '.note', 'themePage.group.' + fx.group, 'themePage.groupSub.' + fx.group]) {
    assert.equal(typeof get(k), 'string', 'trang Giao diện thiếu chữ ' + k)
  }
  for (const [k, ms] of Object.entries(SKY_ACT_MS)) {
    const min = SKY_FX.find((x) => x.key === k).min
    assert.ok(min * 1000 > ms, k + ': tối thiểu ' + min + ' s ngắn hơn một lượt diễn ' + ms + ' ms — lượt mới sẽ cắt ngang lượt đang diễn')
  }
}

/* ---------- trang nào có nền ---------- */
for (const r of ['home', 'leaderboard']) assert.equal(skyMode(r), 'full', r + ': nhân vật chỉ ở Trang chủ và BXH')
for (const r of ['matches', 'badges', 'sessions', 'library', 'members', 'profile', 'settings', 'theme']) {
  assert.equal(skyMode(r), 'lite', r + ': trang chính khác chỉ trăng, sao, mưa sao băng, cú — nhẹ máy')
}
assert.equal(skyMode('session'), 'bg', 'chi tiết buổi tập: chỉ nền, nhân vật bay qua bảng xếp sân là vướng')
assert.equal(skyMode('libraryPost'), 'bg')
for (const r of ['overview', 'calendar', 'tournaments', 'tournament', 'debts', 'fund', 'schema']) {
  assert.equal(skyMode(r), null, r + ': trang không chọn mà có nền là sai yêu cầu')
}
const unknown = [...cfg.sky.routes, ...cfg.sky.liteRoutes, ...cfg.sky.bgRoutes, ...cfg.ui.mobileHidden].filter((r) => !ROUTE_KEYS.includes(r))
assert.deepEqual(unknown, [], 'app.json gõ sai tên route thì trang đó lặng lẽ không có nền / không ẩn')

/* ---------- sân khấu chung: băng rôn, đom đóm, siêu nhân, UFO thay phiên ---------- */
{
  // Giả lập đúng vòng lặp ở SkyBackdrop: lượt đầu theo *FirstMs, nghỉ N tính từ lúc xong, sân bận thì đợi + gap.
  const dur = { hero: 10000, banner: 16640, ufo: 15000, top1: 26400 }, rest = 40000, gap = 4000
  const due = { banner: 6000, hero: 3000, ufo: 8000, top1: 12000 }
  const seq = [], ended = {}
  let free = 0, prevEnd = -Infinity
  for (let i = 0; i < 16; i++) {
    const { k, at } = stageNext(due, free)
    assert.ok(at >= prevEnd + gap, 'lượt ' + i + ' (' + k + '): hai cảnh không được chồng nhau, cách nhau ít nhất gap')
    if (k in ended) assert.ok(at - ended[k] >= rest, k + ': phải nghỉ đủ N giây tính từ lúc diễn xong')
    const end = at + dur[k]
    seq.push(k); ended[k] = prevEnd = end
    free = end + gap; due[k] = end + rest
  }
  assert.deepEqual(seq.slice(0, 4), ['hero', 'banner', 'ufo', 'top1'], 'lượt đầu: cảnh tới hạn sớm nhất lên trước')
  assert.deepEqual(new Set(seq.slice(4)).size, 4, 'không cảnh nào bị bỏ đói')
}

/* ---------- câu theo số liệu ---------- */
const d = skyLines(DEFAULT, 'Canh lá ngón')
assert.deepEqual(keys(d.owl), ['sky.owl.sleep', 'sky.owl.peek', 'sky.owl.hunt', 'sky.owl.late', 'sky.owl.bed'], 'câu theo số liệu chỉ ở băng rôn: cú chỉ nói câu cố định')
assert.deepEqual(keys(d.banner), ['sky.banner.tonight', ...BANNER, 'sky.line.drop', 'sky.line.streak'],
  'mặc định (hạng 2, tụt 1, chuỗi 2): băng rôn an ủi tụt hạng và khen chuỗi — không còn câu "còn N điểm là vượt" / "cách hạng"')
assert.deepEqual(d.banner.at(-2)[1], { n: 1 })
assert.deepEqual(d.banner[0][1], { name: 'Canh lá ngón' }, 'băng rôn phải gọi đúng tên người đang xem')
assert.deepEqual(keys(d.hero), HERO, 'câu theo số liệu chỉ ở băng rôn: siêu nhân chỉ nói câu cố định')
assert.ok(keys(d.wish).includes('sky.wish.pass'), 'có người trên thì có điều ước "vượt <tên>"')

const l = skyLines(LEADER, 'A')
assert.deepEqual(keys(l.banner).filter((k) => k.startsWith('sky.line.')), ['sky.line.leader', 'sky.line.streak'],
  'đang hạng 1: không được khen "vừa lên hạng" (đã hết hạng để lên)')
assert.ok(!keys(l.wish).includes('sky.wish.pass'), 'đang hạng 1 thì không còn ai để ước vượt')

const a = skyLines(AWAY, 'A')
assert.deepEqual(keys(a.owl), ['sky.owl.sleep', 'sky.owl.peek', 'sky.owl.hunt', 'sky.owl.late', 'sky.owl.bed'], 'nghỉ lâu cú vẫn nói câu cố định — nhắc ra sân là việc của băng rôn')
assert.deepEqual(a.banner.at(-1), ['sky.line.daysOff', { n: 12 }], 'nghỉ 12 ngày: không xát muối tụt hạng, chỉ nhắc ra sân')
assert.deepEqual(keys(a.banner), ['sky.banner.missRacket', ...BANNER.filter((k) => k !== 'sky.banner.sneak'), 'sky.line.daysOff'],
  'nghỉ lâu: băng rôn mở bằng "Vợt đang nhớ bạn đấy", không lặp lại câu đó, không trêu "trốn đi đánh cầu hơi nhiều"')

const h = skyLines(HOT, 'A')
assert.ok(keys(h.banner).includes('sky.line.rise') && !keys(h.banner).includes('sky.line.drop'))
assert.deepEqual(h.banner.at(-1), ['sky.line.streak', { n: 5 }])

assert.deepEqual(keys(skyLines({ ...DEFAULT, rank: null, rival: '', rd: 0, streak: 0 }, 'A').banner).filter((k) => k.startsWith('sky.line.')), [],
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
{
  // Nhóm gạ kèo: người vừa thắng mình + người hạ mình gần đây + người hay đối đầu + kỳ phùng địch thủ, không trùng
  const f = skyFoes({ meId: 'me', female: false, top: TOP, arch: P('c'), beatBy: P('z'), beaters: [P('z'), P('b')], rivals: [P('d'), P('me')] })
  assert.deepEqual(f.dares, ['Nz', 'Nb', 'Nd', 'Nc'], 'gạ kèo: vừa thắng mình → hạ mình gần đây → hay đối đầu → kỳ phùng, trừ mình, không trùng')
  const g = skyFoes({ meId: 'me', female: true, top: TOP, beaters: [P('a'), P('b', true)] })
  assert.deepEqual(g.dares, ['Na', 'Nb', 'Nb'], 'người xem là nữ: tên nữ góp hai lần (ra nhiều hơn), tên nam vẫn có')
  assert.deepEqual(skyFoes({ meId: 'me', top: TOP }).dares, [])
  assert.deepEqual(skyLines({ ...DEFAULT, dares: ['Na', 'Nb'] }, 'A').banner[1], ['sky.banner.dare', { dares: ['Na', 'Nb'] }], 'có nhóm tên → câu gạ kèo mang cả nhóm, rút tên lúc bay')
}
{
  const M = (at, a, b, w) => ({ at, teamA: a, teamB: b, winnerTeam: w })
  const ms = [M(1, ['me'], ['x'], 'B'), M(2, ['me', 'p'], ['x', 'y'], 'A'), M(3, ['y'], ['me'], 'A'), M(4, ['me'], ['x'], 'A'), M(5, ['q'], ['r'], 'A')]
  const o = opponentsOf(ms, 'me')
  assert.deepEqual(o.beaters, ['y', 'x'], 'người hạ mình, trận mới trước, không trùng; đồng đội không tính')
  assert.deepEqual(o.rivals, ['x', 'y'], 'đối đầu nhiều nhất: x gặp 3 trận, y 2 trận; trận không có mình bỏ qua')
  assert.deepEqual(opponentsOf(ms, 'me', { recent: 1 }).beaters, [], 'chỉ xét `recent` trận gần nhất (trận 4 mình thắng)')
}

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
assert.equal(get('sky.cons').length, 10, 'mười chòm sao vẽ trong SkyBackdrop (CONS) phải có đủ mười tên')

/* ---------- hoạt cảnh định kỳ ---------- */
for (const k of Object.keys(SKY_ACT_MS)) assert.ok(cfg.sky[k + 'FirstMs'] > 0, k + 'FirstMs phải > 0')
assert.equal(UFO_GIVE_BACK.length, 9, 'UFO trả người: 9 câu (thêm galaxy, sweat)')

console.log('sky check: OK')
