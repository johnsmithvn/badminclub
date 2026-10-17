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

/** Mốc (ms) trận gần nhất có `memberId` trong đội, 0 nếu chưa đánh trận nào. */
export function lastPlayedAt(matches, memberId) {
  let last = 0
  for (const m of matches || []) {
    const at = m?.at || 0
    if (at > last && ((m.teamA || []).includes(memberId) || (m.teamB || []).includes(memberId))) last = at
  }
  return last
}

/** Khuya: từ lateFrom giờ tối tới trước lateUntil giờ sáng. */
export const isLate = (hour) => hour >= C.lateFrom || hour < C.lateUntil

/** Bốc một nhân vật cho lần mở trang. `r` ∈ [0, 1). Chưa khuya thì không có cú mèo. */
export function pickCast(late, r) {
  const pool = late ? SKY_CAST : SKY_CAST.slice(1)
  return pool[Math.min(pool.length - 1, Math.floor(r * pool.length))]
}

/**
 * Số liệu nhân vật nói theo — tất cả theo ĐIỂM MÙA, đúng thứ thẻ Hạng mùa giải đang hiện.
 * @param {object} p
 * @param {object} p.hero    getMyHeroStats
 * @param {object} p.form    getPlayerForm5
 * @param {Array}  p.season  getSurroundingSeasonStandings (cần dòng ngay dưới mình khi đang hạng 1)
 * @param {number} p.lastAt  mốc trận gần nhất của mình (ms), 0 = chưa đánh trận nào
 * @param {Date}   p.now
 */
export function skyFacts({ hero, form, season, lastAt, now }) {
  const rank = hero?.seasonRank || null
  const rows = season || []
  const meIdx = rows.findIndex((r) => r.isMe)
  const below = rank === 1 && meIdx >= 0 ? rows[meIdx + 1] : null
  const dayOf = (ms) => new Date(ms).setHours(0, 0, 0, 0)
  return {
    rank,
    rd: hero?.seasonRankDelta || 0,
    gap: hero?.seasonPointsToNextRank || 0,
    rival: rank > 1 ? hero?.seasonTargetRival?.name || '' : '',
    streak: form?.streak || 0,
    off: lastAt ? Math.max(0, Math.round((dayOf(now) - dayOf(lastAt)) / DAY)) : 0,
    chaser: below?.name || '',
    cg: below ? Math.max(0, (rows[meIdx].points || 0) - (below.points || 0)) : 0,
  }
}

/** Câu theo số liệu — dùng chung cho cú mèo, băng rôn, siêu nhân. */
function dataLines(st) {
  const out = []
  const away = st.off >= C.awayDays
  if (away) out.push(['sky.line.missRacket'], ['sky.line.daysOff', { n: st.off }])
  if (st.rank === 1) {
    out.push(['sky.line.leader'])
    if (st.chaser) out.push(['sky.line.chaser', { name: st.chaser, n: st.cg }])
  } else if (st.rank > 1 && st.rival && st.gap <= C.nearGap) {
    out.push(['sky.line.near', { n: st.gap, name: st.rival }])
  } else if (st.rank > 1) {
    out.push(['sky.line.far', { rank: st.rank - 1, n: st.gap }])
  }
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
    // Chưa ghép thành viên (không có tên) thì bỏ câu gọi tên.
    banner: (away ? [['sky.banner.missRacket']] : name ? [['sky.banner.tonight', { name }]] : [])
      .concat([['sky.banner.chores']], dl.slice(away ? 1 : 0)),
    hero: [['sky.hero.top1'], ['sky.hero.saveWorld'], ['sky.hero.forgotBag'], ['sky.hero.supersonic']].concat(dl),
    wish: [['sky.wish.smash'], ['sky.wish.net']]
      .concat(st.rival ? [['sky.wish.pass', { name: st.rival }]] : [])
      .concat([
        ['sky.wish.court'],
        ['sky.wish.feather'],
        ['sky.wish.partner'],
        ['sky.wish.string'],
        ['sky.wish.miss'],
        ['sky.wish.wife'],
        ['sky.wish.both'],
        ['sky.wish.serve'],
      ]),
  }
}

/**
 * Cảnh UFO bắt cóc. `isMe`: bắt chính mình (áo teal) hay người kề mình trên BXH (áo hồng):
 * đang hạng 1 thì là người đuổi theo, không thì là người ngay trên. Không có ai kề → luôn là mình.
 * Trả về người bị bắt, các câu kêu (cảnh bốc 1 câu) và lời của năm kết cục (xem UFO_OUTCOMES).
 */
export function ufoScript(st, isMe, name) {
  const victim = st.rank === 1 ? st.chaser : st.rival
  const me = isMe || !victim
  const rise = me
    ? [['sky.ufo.rise.court'], ['sky.ufo.rise.letGo']]
      .concat(st.rank > 1 && st.gap <= C.nearGap ? [['sky.ufo.rise.near', { n: st.gap, name: st.rival }]] : [])
      .concat(st.rank === 1 ? [['sky.ufo.rise.leader']] : [])
      .concat(st.streak >= C.streakMin ? [['sky.ufo.rise.streak', { n: st.streak }]] : [])
      .concat(st.off >= C.awayDays ? [['sky.ufo.rise.away', { n: st.off }]] : [])
    : [['sky.ufo.rise.court'], ['sky.ufo.rise.help', { name }],
      st.rank > 1 ? ['sky.ufo.rise.ahead', { name, n: st.gap }] : ['sky.ufo.rise.chasing', { name }]]
  return {
    me,
    victim: me ? '' : victim,
    rise,
    // Chưa có hạng thì không có câu "Mượn tay vợt hạng …" → bỏ kết cục bắt cóc.
    abduct: me
      ? st.rank ? ['sky.ufo.abductMe', { rank: st.rank }] : null
      : [st.rank > 1 ? 'sky.ufo.abductRival' : 'sky.ufo.abductChaser', { name: victim }],
    // Siêu nhân cứu: siêu nhân nói, người được cứu cảm ơn.
    heroSay: me ? ['sky.hero.rescueMe'] : ['sky.hero.rescueRival'],
    thank: me ? ['sky.ufo.thankMe'] : ['sky.ufo.thankRival'],
    // Bị bắn rơi: người bung dù đáp xuống.
    safe: me ? ['sky.ufo.safeMe'] : ['sky.ufo.safeRival', { name }],
    // Tia chập, tuột xuống: bốc 1 câu.
    slip: me ? [['sky.ufo.slipMe.home'], ['sky.ufo.slipMe.game']] : [['sky.ufo.slipRival.rank'], ['sky.ufo.slipRival.phew']],
  }
}

/** UFO trả người lại (bốc 1 câu mỗi bên) — giống nhau cho mọi người bị bắt. */
export const UFO_GIVE_BACK = [
  ['sky.ufo.giveBack.talk'],
  ['sky.ufo.giveBack.smash'],
  ['sky.ufo.giveBack.doubles'],
  ['sky.ufo.giveBack.elo'],
  ['sky.ufo.giveBack.boba'],
  ['sky.ufo.giveBack.tension'],
  ['sky.ufo.giveBack.roof'],
]
export const UFO_HUH = [['sky.ufo.huhBack.a'], ['sky.ufo.huhBack.b'], ['sky.ufo.huhBack.c'], ['sky.ufo.huhBack.d']]

/** Năm kết cục và tỉ lệ của thiết kế: bắt cóc · siêu nhân cứu · bắn rơi · tia chập tuột · trả lại. */
export const UFO_OUTCOMES = [['ok', 0.2], ['rescue', 0.28], ['down', 0.28], ['slip', 0.11], ['ret', 0.13]]

/** Chọn kết cục từ `r` ∈ [0, 1). `canAbduct` false (chưa có hạng để nói) → bỏ "bắt cóc", chia lại phần còn lại. */
export function ufoOutcome(r, canAbduct) {
  const pool = canAbduct ? UFO_OUTCOMES : UFO_OUTCOMES.slice(1)
  let x = r * pool.reduce((s, [, w]) => s + w, 0)
  for (const [out, w] of pool) if ((x -= w) < 0) return out
  return pool[pool.length - 1][0]
}

const SYNODIC = 29.530589
/** Tuổi trăng (ngày) theo app.json → sky.moon: rằm, lưỡi liềm, hoặc tính theo lịch âm. */
export function moonAge(mode, now) {
  if (mode === 'full') return SYNODIC / 2
  if (mode === 'crescent') return 4.6
  return (((now - Date.UTC(2000, 0, 6, 18, 14)) / DAY) % SYNODIC + SYNODIC) % SYNODIC
}
