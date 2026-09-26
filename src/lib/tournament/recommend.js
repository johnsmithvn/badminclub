/**
 * @file recommend.js
 * Gợi ý thể thức cho CẢ giải (README handoff §5.7, plan §7 Phase 5). Thuần: không React, không Supabase.
 *
 * Mặc định đọc số đội/sân/giờ/luật thật từ giải, chỉ chọn 1 trong 3 ưu tiên. BTC cũng có thể GIẢ LẬP (tham số
 * `sim`) để lên phương án trước khi có đăng ký thật: chỉnh số VĐV nam/nữ, bật/tắt từng nội dung, số sân, giờ,
 * phút/trận — không đụng gì tới dữ liệu đăng ký/đội thật, `sim` chỉ đổi ĐẦU VÀO của phép tính. Thời gian là
 * ƯỚC TÍNH theo tổng phút sân / số sân (chưa tính đội không đánh 2 trận cùng lúc).
 */

import cfg from '#config/app.json' with { type: 'json' }
import { RULE_PRESETS, advanceCounts, groupSizes, presetKeyOf } from '#lib/tournament/format.js'
import { eventPlayers, eventTeams } from '#lib/tournament/pairing.js'

const REC = cfg.tournament.recommender
export const PRIORITIES = ['balanced', 'games', 'fast']

/** Phút sân của một trận theo luật (luật mẫu → bảng số; luật tự chỉnh → số mặc định). */
export function minutesOf(rule) {
  return REC.minutesByPreset[presetKeyOf(rule)] ?? cfg.tournament.estimateMatchMin
}

/** Nhánh loại trực tiếp n đội (có tranh 3-4 khi ≥ 4 đội như mẫu): số trận vòng loại / trận tranh hạng. */
function koCost(n) {
  if (n < 2) return { q: 0, f: 0 }
  const f = 1 + (n >= 4 ? 1 : 0) // chung kết + tranh 3-4
  return { q: n - 1 + (n >= 4 ? 1 : 0) - f, f }
}

/** Tổng VĐV còn thi đấu theo giới của cả giải (khử trùng theo người) — số mặc định khi mở hộp giả lập. */
export function genderCounts(tour) {
  const seen = new Set()
  let M = 0
  let W = 0
  for (const r of tour.registrations || []) {
    if (r.status === 'withdrawn') continue
    const key = r.playerId || r.id
    if (seen.has(key)) continue
    seen.add(key)
    if (r.gender === 'nam') M++
    else if (r.gender === 'nu') W++
  }
  return { M, W }
}

/** Số đội giả lập của một nội dung từ tổng VĐV nam/nữ (chưa biết ai đăng ký nội dung nào, coi như đều vào hết). */
export function simTeamsOf(event, M, W) {
  if (event.teamSize === 1) return event.genderRule === 'male' ? M : event.genderRule === 'female' ? W : M + W
  if (event.genderRule === 'mixed') return Math.min(M, W)
  return Math.floor((event.genderRule === 'female' ? W : M) / 2)
}

/** Các phương án cho một nội dung n đội — đúng các mẫu tab Thể thức làm được. */
export function candidatesFor(n) {
  if (n < 2) return []
  const out = [{ tpl: 'ko', numGroups: 1, advance: 0 }]
  if (n >= 3 && n <= 7) out.push({ tpl: 'rr', numGroups: 1, advance: 0 })
  for (const G of [2, 3, 4]) {
    const per = Math.ceil(n / G)
    if (per < 3 || per > 6) continue
    for (const a of [1, 2]) if (G * a >= 4 && G * a < n) out.push({ tpl: 'rr_ko', numGroups: G, advance: a })
    if (G * 2 >= 4 && G * 2 < n && advanceCounts(n, G, 2, 2).plate >= 2) out.push({ tpl: 'rr_ko_plate', numGroups: G, advance: 2 })
  }
  return out
}

/** Số trận, phút sân, số trận tối thiểu mỗi đội của một phương án. */
export function costOf(c, n, { dq, df, rest = REC.restMin }) {
  let q = 0
  let f = 0
  let minG = 1
  if (c.tpl === 'ko') {
    ;({ q, f } = koCost(n))
  } else {
    const sizes = groupSizes(n, c.numGroups)
    q = sizes.reduce((s, k) => s + (k * (k - 1)) / 2, 0)
    minG = Math.min(...sizes) - 1
    if (c.tpl !== 'rr') {
      const counts = advanceCounts(n, c.numGroups, c.advance, c.tpl === 'rr_ko_plate' ? 2 : 0)
      for (const m of [counts.main, counts.plate]) {
        const k = koCost(m)
        q += k.q
        f += k.f
      }
    }
  }
  return { ...c, matches: q + f, minutes: q * (dq + rest) + f * (df + rest), minG, multi: c.tpl !== 'ko' && c.tpl !== 'rr' }
}

/** Sắp phương án theo ưu tiên — phương án đầu là lựa chọn. */
export function sortByPriority(list, priority) {
  const by = {
    fast: (a, b) => a.minutes - b.minutes,
    games: (a, b) => b.minG - a.minG || a.minutes - b.minutes,
    balanced: (a, b) => Math.min(b.minG, 3) - Math.min(a.minG, 3) || Number(b.multi) - Number(a.multi) || a.minutes - b.minutes,
  }
  return [...list].sort(by[priority] || by.balanced)
}

export const toMin = (hhmm) => {
  if (!hhmm) return null
  const [h, m] = String(hhmm).split(':').map(Number)
  return Number.isFinite(h) ? h * 60 + (m || 0) : null
}
export const fmtClock = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/**
 * Số đội của nội dung: đội đủ người; chưa ghép thì ước từ số người đã vào nội dung (`estimated: true`).
 */
export function teamsOf(tour, event) {
  const full = eventTeams(tour, event.id).filter((x) => x.full).length
  if (full) return { n: full, estimated: false }
  const players = eventPlayers(tour, event.id)
  if (event.teamSize === 1) return { n: players.length, estimated: true }
  if (event.genderRule === 'mixed') {
    return { n: Math.min(players.filter((p) => p.gender === 'nam').length, players.filter((p) => p.gender === 'nu').length), estimated: true }
  }
  return { n: Math.floor(players.length / 2), estimated: true }
}

/** Luật vòng loại / chung kết của nội dung: giai đoạn đã lưu, không có thì mặc định theo quy chế (app.json). */
export function rulesOf(tour, event) {
  const d = cfg.tournament.defaultRules
  const s1 = tour.stages.find((s) => s.eventId === event.id && s.seq === 1)
  const q = s1?.matchRule || RULE_PRESETS[d.qualify[event.kind] || d.qualify.default]
  const ko = tour.stages.find((s) => s.eventId === event.id && s.type === 'knockout')
  const f = ko?.ruleOverrides?.final || RULE_PRESETS[d.ranking]
  return { dq: minutesOf(q), df: minutesOf(f) }
}

/** Khoá phương án (để BTC chọn tay một phương án khác): mẫu · số bảng · số đội đi tiếp. */
export const optionKey = (o) => `${o.tpl}:${o.numGroups}:${o.advance}`

/**
 * Luật trận gợi ý theo số phút sân còn cho MỖI trận (README handoff §5.7):
 *   vòng loại ≤ 10 → 1×15 · ≤ 18 → 1×21 cách 2 · ≤ 24 → 1×30 · hơn → 3×21;
 *   chung kết (phút × finalFactor) ≤ 20 → 3×11 · ≤ 30 → 3×15 · hơn → 3×21.
 */
export function suggestRules(minutesPerMatch) {
  const q = minutesPerMatch
  const f = minutesPerMatch * REC.finalFactor
  return {
    qualify: q <= 10 ? 'r1x15' : q <= 18 ? 'r1x21' : q <= 24 ? 'r1x30' : 'r3x21',
    final: f <= 20 ? 'r3x11' : f <= 30 ? 'r3x15' : 'r3x21',
  }
}

/**
 * Gợi ý cho mọi nội dung của giải.
 * @param {object} tour  state `tour`
 * @param {'balanced'|'games'|'fast'} priority
 * @param {{ [eventId]: string }} [picks]  phương án BTC chọn tay (`optionKey`) — giữ nguyên, không bị hạ khi vượt giờ
 * @param {object} [sim]  giả lập, mỗi khoá tuỳ chọn, thiếu khoá nào thì đọc thật từ giải như cũ:
 *   `M`/`W` (số VĐV nam/nữ) → thay `teamsOf` bằng `simTeamsOf`; `enabled` ({eventId: bool}) → bỏ nội dung tắt
 *   khỏi cả danh sách lẫn phép tính giờ; `courts`/`start`/`end` (phút) → thay sân/giờ giải; `dq`/`df`/`rest`
 *   (phút/trận vòng loại, chung kết, nghỉ giữa trận) → thay luật đọc từ giai đoạn đã lưu.
 * @returns {{ events: Array<{ eventId, n, estimated, pick, options, autoKey, edited }>, totalMinutes, capacity, finish, fits, rules }}
 *   `options[i].badges`: 'recommended' (phương án tự chọn) · 'fastest' · 'mostGames' · 'over' (chọn nó thì vượt giờ).
 *   `capacity`/`finish`/`fits`/`rules` = null khi giải chưa khai báo giờ hoặc sân (không ước tính được, vẫn gợi ý).
 *   Vượt khung giờ → hạ dần nội dung tốn nhất (không phải nội dung chọn tay) xuống phương án rẻ hơn kế tiếp.
 */
export function recommend(tour, priority = 'balanced', picks = {}, sim = {}) {
  const start = sim.start ?? toMin(tour.startTime)
  const end = sim.end ?? toMin(tour.endTime)
  const courts = sim.courts ?? (tour.courtLabels?.length || 0)
  const capacity = start != null && end != null && end > start && courts ? (end - start) * courts : null
  const rest = sim.rest

  const build = (useP) => {
    const events = tour.events
      .filter((ev) => sim.enabled?.[ev.id] !== false)
      .map((ev) => {
        const { n, estimated } = sim.M != null && sim.W != null ? { n: simTeamsOf(ev, sim.M, sim.W), estimated: true } : teamsOf(tour, ev)
        const r = sim.dq != null && sim.df != null ? { dq: sim.dq, df: sim.df } : rulesOf(tour, ev)
        const options = sortByPriority(candidatesFor(n).map((c) => costOf(c, n, rest != null ? { ...r, rest } : r)), priority)
        const manual = useP && picks[ev.id] ? options.findIndex((o) => optionKey(o) === picks[ev.id]) : -1
        return { eventId: ev.id, n, estimated, options, idx: manual >= 0 ? manual : 0, fixed: manual >= 0 }
      })
    const sum = () => events.reduce((s, e) => s + (e.options[e.idx]?.minutes || 0), 0)
    if (capacity != null) {
      for (let guard = 0; guard < 100 && sum() > capacity; guard++) {
        const movable = events
          .filter((e) => !e.fixed)
          .map((e) => {
            const cur = e.options[e.idx]
            const next = cur && e.options.findIndex((o, i) => i > e.idx && o.minutes < cur.minutes)
            return { e, cost: cur?.minutes || 0, next }
          })
          .filter((x) => x.next > 0)
          .sort((a, b) => b.cost - a.cost)
        if (!movable.length) break
        movable[0].e.idx = movable[0].next
      }
    }
    return { events, total: sum() }
  }

  const auto = build(false)
  const { events, total } = build(true)
  const matches = events.reduce((s, e) => s + (e.options[e.idx]?.matches || 0), 0)

  return {
    events: events.map((e, ei) => {
      const autoKey = auto.events[ei].options[auto.events[ei].idx] ? optionKey(auto.events[ei].options[auto.events[ei].idx]) : null
      const fastest = Math.min(...e.options.map((o) => o.minutes))
      const most = Math.max(...e.options.map((o) => o.minG))
      const others = total - (e.options[e.idx]?.minutes || 0)
      const options = e.options.map((o) => ({
        ...o,
        key: optionKey(o),
        badges: [
          optionKey(o) === autoKey && 'recommended',
          o.minutes === fastest && 'fastest',
          o.minG === most && e.options.length > 1 && 'mostGames',
          capacity != null && others + o.minutes > capacity && 'over',
        ].filter(Boolean),
      }))
      const pick = options[e.idx] || null
      return { eventId: e.eventId, n: e.n, estimated: e.estimated, options, pick, autoKey, edited: Boolean(pick && autoKey && pick.key !== autoKey) }
    }),
    totalMinutes: total,
    capacity,
    finish: capacity != null ? fmtClock(start + Math.ceil(total / courts)) : null,
    fits: capacity != null ? total <= capacity : null,
    rules: capacity != null && matches ? suggestRules(capacity / matches - REC.restMin) : null,
  }
}

/**
 * Các bước hiển thị ở panel "Xem trước" cho phương án đang chọn — thuần mô tả, không phải dữ liệu ghi DB
 * (giai đoạn thật dựng lúc "Áp dụng", đọc số đội thật lúc đó).
 * @returns {Array<{ key: 'groups'|'ko'|'plate', n: number, numGroups?: number, sizes?: number[] }>}
 */
export function pipelineOf(pick, n) {
  if (!pick) return []
  if (pick.tpl === 'ko') return [{ key: 'ko', n }]
  const steps = [{ key: 'groups', n, numGroups: pick.numGroups, sizes: groupSizes(n, pick.numGroups) }]
  if (pick.tpl !== 'rr') {
    steps.push({ key: 'ko', n: pick.numGroups * pick.advance })
    if (pick.tpl === 'rr_ko_plate') steps.push({ key: 'plate', n: null })
  }
  return steps
}
