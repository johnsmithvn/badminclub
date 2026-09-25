/**
 * @file format.js
 * Thể thức của một nội dung → giai đoạn (tournament_stages) + xem trước nhánh. Thuần.
 * Mẫu: `ko` · `rr` · `rr_ko` · `rr_ko_plate` (plan §1, §7).
 */

import cfg from '#config/app.json' with { type: 'json' }
import { nextPowerOf2, roundKindOf } from '#lib/tournament/bracket.js'
import { ruleFor } from '#lib/tournament/scoring.js'
import { snakeIndex } from '#lib/tournament/roundRobin.js'

export const RULE_PRESETS = cfg.tournament.rulePresets
export const TEMPLATES = ['ko', 'rr', 'rr_ko', 'rr_ko_plate']

/** Key preset trùng hệt luật, null = luật tự chỉnh. */
export function presetKeyOf(rule) {
  if (!rule) return null
  return Object.keys(RULE_PRESETS).find((k) => {
    const p = RULE_PRESETS[k]
    return p.sets === rule.sets && p.points === rule.points && p.winBy2 === rule.winBy2 && p.cap === rule.cap
  }) || null
}

/** Giai đoạn loại trực tiếp mặc định cho nội dung — luật theo quy chế mùa 1 (app.json). */
export function defaultStage(event) {
  const d = cfg.tournament.defaultRules
  const ranking = RULE_PRESETS[d.ranking]
  return {
    seq: 1,
    type: 'knockout',
    title: null,
    status: 'pending',
    config: { thirdPlace: true, seeding: 'seed' },
    matchRule: { ...RULE_PRESETS[d.qualify[event.kind] || d.qualify.default] },
    ruleOverrides: { final: { ...ranking }, third: { ...ranking } },
  }
}

/**
 * Xây dựng các giai đoạn và liên kết theo mẫu thể thức.
 * `title` để null: tên hiển thị (Nhánh chính / Nhánh phụ) lấy từ i18n theo mẫu + seq, không lưu chữ vào DB
 * (RULES §3.3). Nhánh phụ lấy hạng 3–4; bảng ít đội hơn thì `entrantsFromLinks` bỏ qua hạng thiếu.
 * @param {'ko'|'rr'|'rr_ko'|'rr_ko_plate'} templateKey
 * @param {object} event
 * @param {object} [custom]
 * @returns {{ stages: Array<object>, links: Array<object> }}
 */
export function buildTemplateStages(templateKey, event, custom = {}) {
  const d = cfg.tournament.defaultRules
  const ranking = RULE_PRESETS[d.ranking]
  const qualifyRule = { ...RULE_PRESETS[d.qualify[event.kind] || d.qualify.default] }
  const ruleOverrides = { final: { ...ranking }, third: { ...ranking } }

  if (templateKey === 'rr') {
    return {
      stages: [
        {
          seq: 1,
          type: 'round_robin',
          title: null,
          status: 'pending',
          config: { numGroups: custom.numGroups || 1, legs: custom.legs || 1, seeding: 'seed' },
          matchRule: qualifyRule,
          ruleOverrides: {},
        },
      ],
      links: [],
    }
  }

  if (templateKey === 'rr_ko') {
    const advancePerGroup = custom.advancePerGroup || 2
    return {
      stages: [
        {
          seq: 1,
          type: 'round_robin',
          title: null,
          status: 'pending',
          config: { numGroups: custom.numGroups || 2, advancePerGroup, legs: custom.legs || 1, seeding: 'seed' },
          matchRule: qualifyRule,
          ruleOverrides: {},
        },
        {
          seq: 2,
          type: 'knockout',
          title: null,
          status: 'pending',
          config: { thirdPlace: true, seeding: 'rank' },
          matchRule: qualifyRule,
          ruleOverrides,
        },
      ],
      links: [
        {
          fromStageSeq: 1,
          toStageSeq: 2,
          ranks: Array.from({ length: advancePerGroup }, (_, i) => i + 1),
        },
      ],
    }
  }

  if (templateKey === 'rr_ko_plate') {
    return {
      stages: [
        {
          seq: 1,
          type: 'round_robin',
          title: null,
          status: 'pending',
          config: { numGroups: custom.numGroups || 2, advancePerGroup: 2, legs: custom.legs || 1, seeding: 'seed' },
          matchRule: qualifyRule,
          ruleOverrides: {},
        },
        {
          seq: 2,
          type: 'knockout',
          title: null,
          status: 'pending',
          config: { thirdPlace: true, seeding: 'rank' },
          matchRule: qualifyRule,
          ruleOverrides,
        },
        {
          seq: 3,
          type: 'knockout',
          title: null,
          status: 'pending',
          config: { thirdPlace: true, seeding: 'rank' },
          matchRule: qualifyRule,
          ruleOverrides,
        },
      ],
      links: [
        { fromStageSeq: 1, toStageSeq: 2, ranks: [1, 2] },
        { fromStageSeq: 1, toStageSeq: 3, ranks: [3, 4] },
      ],
    }
  }

  // Mặc định 'ko'
  return {
    stages: [defaultStage(event)],
    links: [],
  }
}

/**
 * Đội tham dự theo cách xếp:
 *   seed → hạt giống 1..n theo tổng rating giảm dần (bằng nhau: số bốc thăm, rồi id — ổn định).
 *   slot → theo số bốc thăm; thiếu số nào là lỗi `needDraw`.
 *   rank → lấy từ liên kết vòng bảng (entrantsFromLinks), không kiểm ở đây.
 */
export function entrantsOf(teams, seeding) {
  if (seeding === 'rank') {
    return { error: null, entrants: [] }
  }
  const full = teams.filter((t) => t.full)
  if (seeding === 'slot') {
    if (full.some((t) => !Number.isInteger(t.drawNo))) return { error: 'tournament.format.needDraw', entrants: [] }
    return { error: null, entrants: full.map((t) => ({ id: t.id, drawNo: t.drawNo })) }
  }
  const sorted = [...full].sort((a, b) => b.sum - a.sum || (a.drawNo ?? 0) - (b.drawNo ?? 0) || a.id.localeCompare(b.id))
  return { error: null, entrants: sorted.map((t, i) => ({ id: t.id, seed: i + 1 })) }
}

/** Bốc thăm: số 1..n xáo ngẫu nhiên cho các đội đủ người. */
export function drawNumbers(teams, rand = Math.random) {
  const ids = teams.filter((t) => t.full).map((t) => t.id)
  const nums = ids.map((_, i) => i + 1)
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[nums[i], nums[j]] = [nums[j], nums[i]]
  }
  return ids.map((id, i) => ({ teamId: id, drawNo: nums[i] }))
}

/**
 * Xem trước nhánh loại trực tiếp với n đội: các vòng, số trận, luật của vòng, số bye.
 * Trận bye không tính là trận phải đánh.
 */
export function koPreview(n, stage) {
  if (n < 2) return { size: 0, byes: 0, rounds: [], total: 0 }
  const size = nextPowerOf2(n)
  const count = Math.log2(size)
  const rounds = Array.from({ length: count }, (_, r) => {
    const kind = roundKindOf(r, count)
    return { kind, matches: size >> (r + 1), rule: ruleFor(stage, kind) }
  })
  const byes = size - n
  rounds[0].matches -= byes
  if (stage.config?.thirdPlace && n >= 4) rounds.push({ kind: 'third', matches: 1, rule: ruleFor(stage, 'third') })
  return { size, byes, rounds, total: rounds.reduce((s, r) => s + r.matches, 0) }
}

/**
 * Xem trước vòng bảng với n đội: số bảng, số đội/bảng, số trận, số lượt.
 */
export function rrPreview(n, stage, custom = {}) {
  const numGroups = custom.numGroups || stage.config?.numGroups || 1
  const legs = custom.legs || stage.config?.legs || 1
  if (n < 2) return { numGroups, teamsPerGroup: 0, total: 0, rounds: 0, rule: stage.matchRule }
  let total = 0
  let maxRounds = 0
  for (const k of groupSizes(n, numGroups)) {
    if (k >= 2) {
      total += (k * (k - 1) / 2) * legs
      const r = (k % 2 === 0 ? k - 1 : k) * legs
      if (r > maxRounds) maxRounds = r
    }
  }
  return {
    numGroups,
    teamsPerGroup: Math.ceil(n / numGroups),
    total,
    rounds: maxRounds,
    rule: stage.matchRule,
  }
}

/** Số đội mỗi bảng khi chia n đội vào G bảng kiểu con rắn (cùng công thức `snakeGroups`): lệch nhau tối đa 1. */
export function groupSizes(n, numGroups) {
  const sizes = Array(numGroups).fill(0)
  for (let i = 0; i < n; i++) sizes[snakeIndex(i, numGroups)]++
  return sizes
}

/**
 * Số đội vào nhánh chính / nhánh phụ sau vòng bảng — tính theo cỡ từng bảng (bảng nhỏ góp ít hơn).
 * @param {number} advance  hạng 1..advance mỗi bảng vào nhánh chính
 * @param {number|'all'|0} plate  số hạng tiếp theo vào nhánh phụ ('all' = mọi đội còn lại, 0 = không có nhánh phụ)
 */
export function advanceCounts(n, numGroups, advance, plate = 0) {
  const sizes = groupSizes(n, numGroups)
  return {
    main: sizes.reduce((s, k) => s + Math.min(k, advance), 0),
    plate: sizes.reduce((s, k) => s + Math.max(0, Math.min(k - advance, plate === 'all' ? k : plate)), 0),
  }
}
