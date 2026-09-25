/**
 * @file format.js
 * Thể thức của một nội dung → giai đoạn (tournament_stages) + xem trước nhánh. Thuần.
 * Phase 2 chỉ có mẫu `ko` (loại trực tiếp); vòng bảng thêm ở Phase 4 (plan §7).
 */

import cfg from '#config/app.json' with { type: 'json' }
import { nextPowerOf2, roundKindOf } from '#lib/tournament/bracket.js'
import { ruleFor } from '#lib/tournament/scoring.js'

export const RULE_PRESETS = cfg.tournament.rulePresets
export const TEMPLATES = ['ko']

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
 * Đội tham dự theo cách xếp:
 *   seed → hạt giống 1..n theo tổng rating giảm dần (bằng nhau: số bốc thăm, rồi id — ổn định).
 *   slot → theo số bốc thăm; thiếu số nào là lỗi `needDraw`.
 */
export function entrantsOf(teams, seeding) {
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
