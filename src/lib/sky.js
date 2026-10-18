// Nền bầu trời (components/layout/SkyBackdrop.jsx): trang nào có nền, chọn nhân vật ghé thăm và dựng
// câu thoại theo số liệu thật của người đang xem. Hàm thuần — trả về [key i18n, tham số], component tự gọi t().
// Ngưỡng ở app.json → sky. Toàn bộ tình huống và câu thoại: docs/HOME_SKY.md.

import cfg from '#config/app.json' with { type: 'json' }

const C = cfg.sky
const DAY = 864e5

/** Năm nhân vật. Cú mèo đứng đầu vì chỉ nó bị loại khi chưa khuya. */
export const SKY_CAST = ['owl', 'banner', 'top1', 'hero', 'ufo']

/** Route nào vẽ nền trời: 'full' (nền + nhân vật), 'bg' (chỉ nền — trang con), null (không). */
export const skyMode = (route) => (C.routes.includes(route) ? 'full' : C.bgRoutes.includes(route) ? 'bg' : null)

/** Trận gần nhất có `memberId` trong đội, null nếu chưa đánh trận nào. */
export function lastMatchOf(matches, memberId) {
  let last = null
  for (const m of matches || []) {
    if ((m?.at || 0) > (last?.at || 0) && ((m.teamA || []).includes(memberId) || (m.teamB || []).includes(memberId))) last = m
  }
  return last
}

/** Mốc (ms) trận gần nhất có `memberId` trong đội, 0 nếu chưa đánh trận nào. */
export const lastPlayedAt = (matches, memberId) => lastMatchOf(matches, memberId)?.at || 0

/** `memberId` thua trận `m` thì trả id người đầu đội thắng, không thì '' (thắng / chưa có kết quả). */
export function beatenBy(m, memberId) {
  if (!m?.winnerTeam) return ''
  const inA = (m.teamA || []).includes(memberId)
  if ((m.winnerTeam === 'A') === inA) return ''
  return ((inA ? m.teamB : m.teamA) || [])[0] || ''
}

/**
 * Tên chèn vào câu thoại: dài quá `max` ký tự thì cắt, ưu tiên cắt ở khoảng trắng, thêm "…". CLB có tên
 * hơn 70 ký tự (kèm mặt cười ◕⩊◕) — để nguyên thì bóng thoại / thẻ điều ước dài ba bốn dòng.
 */
export function shortName(s, max = 20) {
  const ch = Array.from(String(s || '').trim())
  if (ch.length <= max) return ch.join('')
  const cut = ch.slice(0, max).join('')
  const sp = cut.lastIndexOf(' ')
  return (sp >= max / 2 ? cut.slice(0, sp) : cut).trimEnd() + '…'
}

/** Khuya: từ lateFrom giờ tối tới trước lateUntil giờ sáng. */
export const isLate = (hour) => hour >= C.lateFrom || hour < C.lateUntil

/** [0, 1, …, n-1] xáo ngẫu nhiên (Fisher–Yates). */
export function shuffled(n, r = Math.random) {
  const a = [...Array(n).keys()]
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * "Túi xáo" cho mọi lựa chọn ngẫu nhiên của nền trời (câu thoại, kết cục UFO, điều ước, hình xếp…):
 * rút hết một lượt — mỗi phần tử đúng một lần, thứ tự ngẫu nhiên — rồi mới xáo lượt mới, để không câu
 * nào lặp khi còn câu chưa ra. Hai lượt nối nhau không trùng phần tử ở chỗ nối.
 * Trả về `draw(key, n)` → chỉ số trong [0, n). Mỗi `key` một túi; `n` đổi (danh sách câu đổi theo số
 * liệu) thì túi đó xáo lại từ đầu.
 */
export function createBags(r = Math.random) {
  const bags = {}
  return (key, n) => {
    if (n <= 1) return 0
    let b = bags[key]
    if (!b || b.n !== n) b = bags[key] = { n, left: [], last: -1 }
    if (!b.left.length) {
      b.left = shuffled(n, r)
      if (b.left[0] === b.last) [b.left[0], b.left[n - 1]] = [b.left[n - 1], b.left[0]]
    }
    b.last = b.left.shift()
    return b.last
  }
}

/**
 * Nhân vật cho lần mở trang — túi xáo nhớ qua các lần mở (component lưu `left` vào localStorage):
 * đủ 5 nhân vật mới lặp. Chưa khuya thì bỏ qua cú mèo (cú vẫn nằm trong túi chờ lần mở lúc khuya);
 * túi chỉ còn cú mà chưa khuya thì xáo túi mới.
 * @returns {{ cast: string, left: string[] }} nhân vật lần này và phần túi còn lại
 */
export function drawCast(left, late, r = Math.random) {
  const ok = (c) => late || c !== 'owl'
  let bag = (Array.isArray(left) ? left : []).filter((c) => SKY_CAST.includes(c))
  if (!bag.some(ok)) bag = shuffled(SKY_CAST.length, r).map((i) => SKY_CAST[i])
  const i = bag.findIndex(ok)
  return { cast: bag[i], left: bag.filter((_, j) => j !== i) }
}

/**
 * Số liệu nhân vật nói theo — tất cả theo ĐIỂM MÙA, đúng thứ thẻ Hạng mùa giải đang hiện.
 * @param {object} p
 * @param {object} p.hero    getMyHeroStats
 * @param {object} p.form    getPlayerForm5
 * @param {number} p.lastAt  mốc trận gần nhất của mình (ms), 0 = chưa đánh trận nào
 * @param {Date}   p.now
 */
export function skyFacts({ hero, form, lastAt, now }) {
  const rank = hero?.seasonRank || null
  const dayOf = (ms) => new Date(ms).setHours(0, 0, 0, 0)
  return {
    rank,
    rd: hero?.seasonRankDelta || 0,
    gap: hero?.seasonPointsToNextRank || 0,
    rival: rank > 1 ? hero?.seasonTargetRival?.name || '' : '',
    streak: form?.streak || 0,
    off: lastAt ? Math.max(0, Math.round((dayOf(now) - dayOf(lastAt)) / DAY)) : 0,
  }
}

/**
 * Người để nhân vật réo tên. Mỗi người dạng { id, name, female }: `top` = BXH mùa theo hạng, `arch` =
 * kỳ phùng địch thủ (activity.js → getPersonalHighlights), `beatBy` = người vừa thắng mình ở trận gần nhất.
 * - `dare` (băng rôn "Gạ kèo …"): người vừa thắng mình, không có thì kỳ phùng địch thủ.
 * - `foes` (điều ước réo tên): kỳ phùng địch thủ + 5 người cao nhất BXH mùa, trừ mình. Người xem là nữ
 *   thì chỉ lấy nữ (kỳ phùng địch thủ nếu là nữ + 5 bạn nữ cao nhất); không có ai thì lấy như thường.
 */
export function skyFoes({ meId, female, top = [], arch = null, beatBy = null }) {
  const pick = (girls) => {
    const ok = (p) => p && p.id !== meId && (!girls || p.female)
    const ppl = [arch, ...top.filter(ok).slice(0, 5)].filter(ok)
    return [...new Map(ppl.map((p) => [p.id, p.name])).values()]
  }
  const girls = female ? pick(true) : []
  return { dare: beatBy?.name || arch?.name || '', foes: girls.length ? girls : pick(false) }
}

/**
 * BXH mùa — đối thủ thò đầu trêu (SeasonRaceTab): người NGAY TRÊN `meId` giục đuổi, người NGAY DƯỚI doạ
 * lật kèo. `rows` = danh sách đang hiện, theo hạng; `shown(id)` = dòng đó có được vẽ không (mobile: top 3
 * nằm ở bục, không có dòng để thò). Trả về [{ id, line: [key i18n, tham số] }], rỗng nếu không có ai.
 */
export function rivalPeeks(rows, meId, shown = () => true) {
  const i = (rows || []).findIndex((r) => r.id === meId)
  if (i < 0) return []
  const me = rows[i], up = rows[i - 1], down = rows[i + 1]
  return [
    up && shown(up.id) && { id: up.id, line: ['season.peek.up', { n: Math.max(1, (up.totalSeasonPoints || 0) - (me.totalSeasonPoints || 0)) }] },
    down && shown(down.id) && { id: down.id, line: ['season.peek.down'] },
  ].filter(Boolean)
}

/** Câu theo số liệu — dùng chung cho cú mèo, băng rôn, siêu nhân. */
function dataLines(st) {
  const out = []
  const away = st.off >= C.awayDays
  if (away) out.push(['sky.line.missRacket'], ['sky.line.daysOff', { n: st.off }])
  if (st.rank === 1) out.push(['sky.line.leader'])
  if (st.rd < 0 && !away) out.push(['sky.line.drop', { n: -st.rd }])
  if (st.rd > 0 && st.rank > 1) out.push(['sky.line.rise', { n: st.rd }])
  if (st.streak >= C.streakMin) out.push(['sky.line.streak', { n: st.streak }])
  return out
}

/**
 * Lời của từng nhân vật, theo thứ tự xoay vòng (bấm → câu kế).
 * `name` = tên người đang xem (băng rôn gọi tên).
 */
export function skyLines(st, name) {
  const dl = dataLines(st)
  const away = st.off >= C.awayDays
  return {
    owl: (away ? [] : [['sky.owl.sleep'], ['sky.owl.peek'], ['sky.owl.hunt'], ['sky.owl.late'], ['sky.owl.bed']]).concat(dl),
    // Nghỉ lâu: câu "Vợt đang nhớ bạn đấy" lên đầu băng rôn bản không mặt cười, nên bỏ câu cùng ý trong dl.
    // Chưa ghép thành viên (không có tên) thì bỏ câu gọi tên. Nghỉ lâu thì bỏ câu "trốn đi đánh cầu hơi nhiều".
    banner: (away ? [['sky.banner.missRacket']] : name ? [['sky.banner.tonight', { name }]] : [])
      .concat(st.dare ? [['sky.banner.dare', { name: st.dare }]] : [])
      .concat([['sky.banner.chores'], ['sky.banner.moms'], ['sky.banner.wow']], away ? [] : [['sky.banner.sneak']], [['sky.banner.hoaSen']])
      .concat(dl.slice(away ? 1 : 0)),
    hero: [['sky.hero.top1'], ['sky.hero.saveWorld'], ['sky.hero.forgotBag'], ['sky.hero.supersonic'], ['sky.hero.riceCooker'], ['sky.hero.noRacket']].concat(dl),
    wish: [['sky.wish.smash'], ['sky.wish.net']]
      .concat(st.rival ? [['sky.wish.pass', { name: st.rival }]] : [])
      .concat([['sky.wish.feather'], ['sky.wish.partner'], ['sky.wish.miss'], ['sky.wish.both'], ['sky.wish.serve'], ['sky.wish.vibe'], ['sky.wish.boss']])
      // Réo tên đối thủ: tên rút lúc ước (túi xáo riêng), nên giữ cả danh sách `foes` trong tham số.
      .concat(st.foes?.length ? [['sky.wish.own', { foes: st.foes }], ['sky.wish.bonk', { foes: st.foes }]] : []),
  }
}

/**
 * Cảnh UFO bắt cóc. `isMe`: bắt chính mình (áo teal) hay người ngay trên mình trên BXH (áo hồng).
 * Đang hạng 1 / chưa có hạng (không có người trên) → luôn là mình.
 * Trả về người bị bắt, các câu kêu (cảnh rút 1 câu bằng túi xáo) và lời của năm kết cục (UFO_OUTCOMES).
 */
export function ufoScript(st, isMe, name) {
  const victim = st.rank > 1 ? st.rival : ''
  const me = isMe || !victim
  const rise = me
    ? [['sky.ufo.rise.court'], ['sky.ufo.rise.letGo']]
      .concat(st.rank > 1 && st.gap <= C.nearGap ? [['sky.ufo.rise.near', { n: st.gap, name: st.rival }]] : [])
      .concat(st.rank === 1 ? [['sky.ufo.rise.leader']] : [])
      .concat(st.streak >= C.streakMin ? [['sky.ufo.rise.streak', { n: st.streak }]] : [])
      .concat(st.off >= C.awayDays ? [['sky.ufo.rise.away', { n: st.off }]] : [])
    : [['sky.ufo.rise.court'], ['sky.ufo.rise.help', { name }], ['sky.ufo.rise.ahead', { name, n: st.gap }]]
  return {
    me,
    victim: me ? '' : victim,
    rise,
    // Chưa có hạng thì không có câu "Mượn tay vợt hạng …" → bỏ kết cục bắt cóc.
    abduct: me
      ? st.rank ? ['sky.ufo.abductMe', { rank: st.rank }] : null
      : ['sky.ufo.abductRival', { name: victim }],
    // Siêu nhân cứu: siêu nhân nói, người được cứu cảm ơn.
    heroSay: ['sky.hero.rescue'],
    thank: me ? ['sky.ufo.thankMe'] : ['sky.ufo.thankRival'],
    // Bị bắn rơi: người bung dù đáp xuống.
    safe: me ? ['sky.ufo.safeMe'] : ['sky.ufo.safeRival', { name }],
    // Tia chập, tuột xuống: rút 1 câu.
    slip: me ? [['sky.ufo.slipMe.home'], ['sky.ufo.slipMe.game']] : [['sky.ufo.slipRival.rank'], ['sky.ufo.slipRival.phew']],
  }
}

/** UFO trả người lại (rút 1 câu mỗi bên bằng túi xáo) — giống nhau cho mọi người bị bắt. */
export const UFO_GIVE_BACK = [
  ['sky.ufo.giveBack.talk'],
  ['sky.ufo.giveBack.smash'],
  ['sky.ufo.giveBack.doubles'],
  ['sky.ufo.giveBack.elo'],
  ['sky.ufo.giveBack.boba'],
  ['sky.ufo.giveBack.heavy'],
  ['sky.ufo.giveBack.roof'],
  ['sky.ufo.giveBack.galaxy'],
  ['sky.ufo.giveBack.sweat'],
]
/**
 * Thời lượng một lượt hoạt cảnh trời đêm định kỳ (ms) — khớp keyframe ở effects.css. Nhịp lặp
 * (app.json → sky.*EveryMs) phải dài hơn, không thì lượt mới cắt ngang lượt đang diễn.
 */
export const SKY_ACT_MS = { cuoi: 7000, fireShuttle: 3600, eclipse: 32000 }

/** Cú mèo bị bấm đánh thức khi đang ngủ gật (rút 1 bằng túi xáo). */
export const OWL_WAKE = [['sky.owl.wake.dream'], ['sky.owl.wake.fall']]
export const UFO_HUH =[['sky.ufo.huhBack.a'], ['sky.ufo.huhBack.b'], ['sky.ufo.huhBack.c'], ['sky.ufo.huhBack.d']]

/**
 * Năm kết cục UFO: bắt cóc · siêu nhân cứu · bị bắn rơi · tia chập tuột · trả lại. Rút bằng túi xáo
 * (createBags) nên cứ 5 cảnh UFO là đủ cả 5. Chưa có hạng (không có câu "Mượn tay vợt hạng …") thì
 * bỏ "bắt cóc", túi còn 4.
 */
export const UFO_OUTCOMES = ['ok', 'rescue', 'down', 'slip', 'ret']
export const ufoPool = (canAbduct) => (canAbduct ? UFO_OUTCOMES : UFO_OUTCOMES.slice(1))

const SYNODIC = 29.530589
/** Tuổi trăng (ngày) theo app.json → sky.moon: rằm, lưỡi liềm, hoặc tính theo lịch âm. */
export function moonAge(mode, now) {
  if (mode === 'full') return SYNODIC / 2
  if (mode === 'crescent') return 4.6
  return (((now - Date.UTC(2000, 0, 6, 18, 14)) / DAY) % SYNODIC + SYNODIC) % SYNODIC
}
