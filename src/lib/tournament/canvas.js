/**
 * @file canvas.js
 * Canvas sơ đồ (handoff "Giải đấu · sơ đồ tự do", plan Phase 6): luật của thể thức TỰ DỰNG. Thuần.
 *
 * Mô hình chạy được (khớp đúng những gì sinh lịch làm được — không cho dựng thứ không sinh được):
 *   · đúng MỘT giai đoạn nguồn = seq 1 (nhận mọi đội), vòng bảng hoặc loại trực tiếp;
 *   · nguồn là vòng bảng thì đẩy đội sang các nhánh loại trực tiếp qua link (mỗi nhánh một bộ hạng, không trùng);
 *   · mọi giai đoạn khác là loại trực tiếp và có đúng một link vào, từ nguồn.
 */

import cfg from '#config/app.json' with { type: 'json' }
import { calcGroupBalance, snakeGroups } from '#lib/tournament/roundRobin.js'
import { buildKnockout, nextPowerOf2 } from '#lib/tournament/bracket.js'
import { buildTemplateStages, groupSizes } from '#lib/tournament/format.js'
import { entrantsFromLinks } from '#lib/tournament/links.js'
import { eventTeams } from '#lib/tournament/pairing.js'
import { costOf, fmtClock, minutesOf, toMin } from '#lib/tournament/recommend.js'

export const CANVAS = { w: 190, h: 96, gapX: 90, gapY: 28, pad: 16 }
export const RANK_CHOICES = [1, 2, 3, 4, 5, 6]

/**
 * Toạ độ mặc định khi chưa kéo: nguồn cột trái, các nhánh xếp dọc cột phải (theo cỡ thật của từng khối).
 * @param {(stage) => { w: number, h: number }} [sizeOf]  cỡ khối (mặc định cỡ chuẩn CANVAS)
 */
export function layoutOf(stages, sizeOf = () => ({ w: CANVAS.w, h: CANVAS.h })) {
  const sorted = [...stages].sort((a, b) => a.seq - b.seq)
  const colX = CANVAS.pad + (sorted[0] ? sizeOf(sorted[0]).w : CANVAS.w) + CANVAS.gapX
  let y = CANVAS.pad
  return Object.fromEntries(sorted.map((s, i) => {
    let auto = { x: CANVAS.pad, y: CANVAS.pad }
    if (i > 0) {
      auto = { x: colX, y }
      y += sizeOf(s).h + CANVAS.gapY
    }
    return [s.id, { x: s.canvasX ?? auto.x, y: s.canvasY ?? auto.y }]
  }))
}

/** seq cho giai đoạn mới: nối tiếp cuối (seq 1 luôn là nguồn). */
export const nextSeq = (stages) => stages.reduce((m, s) => Math.max(m, s.seq), 0) + 1

/**
 * Sơ đồ có sinh lịch được không. Trả key i18n của lỗi đầu tiên, hoặc null.
 * @param {object[]} stages  giai đoạn của MỘT nội dung
 * @param {object[]} links   link giữa các giai đoạn đó
 */
export function graphIssue(stages, links) {
  if (!stages.length) return 'tournament.canvas.errEmpty'
  const source = stages.find((s) => s.seq === 1)
  if (!source) return 'tournament.canvas.errNoSource'
  const ids = new Set(stages.map((s) => s.id))
  const own = links.filter((l) => ids.has(l.fromStageId) && ids.has(l.toStageId))
  if (own.some((l) => l.toStageId === source.id)) return 'tournament.canvas.errIntoSource'
  if (own.some((l) => l.fromStageId !== source.id)) return 'tournament.canvas.errChain'
  if (source.type === 'knockout' && stages.length > 1) return 'tournament.canvas.errKoSource'
  for (const s of stages) {
    if (s.id === source.id) continue
    if (s.type !== 'knockout') return 'tournament.canvas.errTargetType'
    const into = own.filter((l) => l.toStageId === s.id)
    if (into.length !== 1 || !into[0].ranks?.length) return 'tournament.canvas.errUnlinked'
  }
  const taken = own.flatMap((l) => l.ranks)
  if (new Set(taken).size !== taken.length) return 'tournament.canvas.errRankTwice'
  return null
}

/**
 * Chia bảng tay (lưu ở `stage.config.manualGroups` = mảng id đội theo bảng) còn dùng được không:
 * đúng số bảng, mỗi bảng ≥ 2 đội, phủ ĐÚNG tập đội đủ người hiện tại (ghép lại cặp là chia lại).
 */
export function manualGroupsOk(manual, teamIds, numGroups) {
  if (!Array.isArray(manual) || manual.length !== numGroups) return false
  if (manual.some((g) => !Array.isArray(g) || g.length < 2)) return false
  const flat = manual.flat()
  return flat.length === teamIds.length && new Set(flat).size === flat.length && teamIds.every((id) => flat.includes(id))
}

/**
 * Bảng để sinh lịch vòng bảng: chia tay nếu còn dùng được, không thì chia rắn theo rating.
 * Trả đúng dạng `snakeGroups` ({ label, seq, teams: [{ teamId, seedInGroup, sum }] }).
 */
export function groupsForStage(stage, fullTeams) {
  const numGroups = stage.config?.numGroups || 1
  const manual = stage.config?.manualGroups
  if (!manualGroupsOk(manual, fullTeams.map((t) => t.id), numGroups)) return snakeGroups(fullTeams, numGroups)
  const sumOf = new Map(fullTeams.map((t) => [t.id, t.sum || 0]))
  return manual.map((ids, i) => ({
    label: String.fromCharCode(65 + i),
    seq: i + 1,
    teams: ids.map((id, k) => ({ teamId: id, seedInGroup: k + 1, sum: sumOf.get(id) })),
  }))
}

/**
 * Bảng đang hiển thị trên canvas (mảng id đội theo bảng): bản chia tay nếu có — kể cả DỞ DANG (còn cặp chưa
 * xếp), bỏ id đội không còn — không có thì bản chia rắn sẽ dùng khi tạo lịch.
 */
export function shownGroups(stage, fullTeams) {
  const numGroups = stage.config?.numGroups || 1
  const manual = stage.config?.manualGroups
  if (Array.isArray(manual) && manual.length === numGroups) {
    const live = new Set(fullTeams.map((t) => t.id))
    return manual.map((ids) => (ids || []).filter((id) => live.has(id)))
  }
  return snakeGroups(fullTeams, numGroups).map((g) => g.teams.map((x) => x.teamId))
}

/** Cặp chưa vào bảng nào (chỉ có khi đang chia tay). */
export function unplacedTeams(stage, fullTeams) {
  const placed = new Set(shownGroups(stage, fullTeams).flat())
  return fullTeams.filter((t) => !placed.has(t.id))
}

/** Chuyển đội sang bảng `toGroup`; `toGroup = -1` = trả về khay "cặp chưa xếp". Trả bản chia tay mới. */
export function moveTeam(stage, fullTeams, teamId, toGroup) {
  const numGroups = stage.config?.numGroups || 1
  const next = shownGroups(stage, fullTeams).map((ids) => ids.filter((id) => id !== teamId))
  if (toGroup >= 0 && toGroup < numGroups) next[toGroup] = [...next[toGroup], teamId]
  return next
}

/* ---------- Ước tính trên canvas (chân khối, thanh trên) ---------- */

/** Số trận loại trực tiếp n đội: vòng loại / trận tranh hạng (chung kết + 3-4 nếu bật và ≥ 4 đội). */
function koCount(n, third) {
  if (n < 2) return { q: 0, f: 0 }
  const total = n - 1 + (third && n >= 4 ? 1 : 0)
  const f = Math.min(total, 1 + (third && n >= 4 ? 1 : 0))
  return { q: total - f, f }
}

/** Số đội vào một nhánh từ vòng bảng nguồn: đếm (bảng, hạng) có thật — bảng k đội chỉ có hạng 1..k. */
export function teamsViaLink(ranks, nSource, numGroups) {
  return groupSizes(nSource, numGroups).reduce((sum, k) => sum + ranks.filter((r) => r <= k).length, 0)
}

/**
 * Ước tính cả sơ đồ của một nội dung — ĐỌC từ giải, BTC không nhập gì.
 * @returns {{ teams, stages: { [id]: { teams, matches, minutes } }, matches, minutes, courts, finish, fits }}
 *   `finish`/`fits` = null khi giải chưa khai báo giờ hoặc sân. Phút = phút sân (chưa chia số sân).
 */
export function estimateOf(tour, event) {
  const rest = cfg.tournament.recommender.restMin
  const stages = tour.stages.filter((s) => s.eventId === event.id)
  const source = stages.find((s) => s.seq === 1)
  const links = tour.stageLinks || []
  const n = eventTeams(tour, event.id).filter((x) => x.full).length
  const out = {}
  stages.forEach((s) => {
    const link = links.find((l) => l.toStageId === s.id)
    const teams = s === source ? n
      : link && source?.type === 'round_robin' ? teamsViaLink(link.ranks, n, source.config?.numGroups || 1) : 0
    const dq = minutesOf(s.matchRule)
    const df = minutesOf(s.ruleOverrides?.final || s.matchRule)
    let q = 0
    let f = 0
    if (s.type === 'round_robin') {
      q = groupSizes(teams, s.config?.numGroups || 1).reduce((sum, k) => sum + (k * (k - 1)) / 2, 0) * (s.config?.legs || 1)
    } else {
      ;({ q, f } = koCount(teams, s.config?.thirdPlace))
    }
    out[s.id] = { teams, matches: q + f, minutes: q * (dq + rest) + f * (df + rest) }
  })
  const matches = Object.values(out).reduce((sum, x) => sum + x.matches, 0)
  const minutes = Object.values(out).reduce((sum, x) => sum + x.minutes, 0)
  // Mỗi đội đá ít nhất (handoff "Mỗi đội đá ít nhất"): vòng bảng = bảng nhỏ nhất − 1 (× số lượt); loại trực tiếp = 1.
  let minPerTeam = 0
  if (source && n >= 2) {
    minPerTeam = source.type === 'round_robin'
      ? (Math.min(...groupSizes(n, source.config?.numGroups || 1)) - 1) * (source.config?.legs || 1)
      : 1
  }
  const courts = tour.courtLabels?.length || 0
  const start = toMin(tour.startTime)
  const end = toMin(tour.endTime)
  const finish = start != null && courts ? start + Math.ceil(minutes / courts) : null
  return {
    teams: n, stages: out, matches, minutes, courts, minPerTeam,
    finish: finish == null ? null : fmtClock(finish),
    fits: finish == null || end == null ? null : finish <= end,
  }
}

/**
 * Nhánh thu nhỏ trong khối loại trực tiếp (handoff: "A1 / B2", "Thắng trận 1 vòng trước").
 * Dựng bằng CHÍNH `entrantsFromLinks` + `buildKnockout` với đội giả mang nhãn — xem trước khớp đúng lịch sẽ sinh.
 * @returns {null | Array<{ roundKind, matches: Array<{ no, a, b }> }>}
 *   a/b: { kind: 'slot', label: 'A1' } · { kind: 'seed', n } · { kind: 'winner', no } · { kind: 'loser', no } · { kind: 'bye' }
 */
export function koPreviewOf(stage, source, link, nSource) {
  let entrants
  if (link && source?.type === 'round_robin') {
    const G = source.config?.numGroups || 1
    const sizes = groupSizes(nSource, G)
    const groups = sizes.map((_, i) => ({ id: 'g' + i, seq: i + 1 }))
    const groupTeams = sizes.flatMap((k, i) => link.ranks.filter((r) => r <= k)
      .map((r) => ({ groupId: 'g' + i, teamId: String.fromCharCode(65 + i) + r, finalRank: r })))
    const res = entrantsFromLinks({ link, groups, groupTeams })
    if (res.error) return null
    entrants = res.entrants
  } else {
    if (nSource < 2) return null
    entrants = Array.from({ length: nSource }, (_, i) => ({ id: '#' + (i + 1), seed: i + 1 }))
  }
  let k = 0
  const ms = buildKnockout({ stage: { ...stage, config: { ...stage.config, seeding: 'seed' } }, entrants, newId: () => 'm' + k++ })
  const played = ms.filter((m) => m.status !== 'bye').sort((a, b) => a.round - b.round || (a.roundKind === 'third') - (b.roundKind === 'third') || a.slot - b.slot)
  const noOf = new Map(played.map((m, i) => [m.id, i + 1]))
  const side = (m, s) => {
    const team = s === 'A' ? m.teamAId : m.teamBId
    if (team) return team.startsWith('#') ? { kind: 'seed', n: Number(team.slice(1)) } : { kind: 'slot', label: team }
    const src = s === 'A' ? m.sourceA : m.sourceB
    if (src?.kind === 'winner') return { kind: 'winner', no: noOf.get(src.match) }
    if (src?.kind === 'loser') return { kind: 'loser', no: noOf.get(src.match) }
    return { kind: 'bye' }
  }
  const rounds = []
  played.forEach((m) => {
    const key = m.roundKind === 'third' ? 'third' : m.round
    let r = rounds.find((x) => x.key === key)
    if (!r) rounds.push(r = { key, roundKind: m.roundKind, matches: [] })
    r.matches.push({ no: noOf.get(m.id), a: side(m, 'A'), b: side(m, 'B') })
  })
  return rounds.map((r) => ({ roundKind: r.roundKind, matches: r.matches }))
}

/**
 * "Kiểm tra sơ đồ": MỌI điều cần biết trước khi chạy (không chỉ lỗi đầu tiên).
 * @returns {Array<{ tone: 'bad'|'warn'|'ok', key: string, vars?: object }>}
 */
export function canvasChecks(tour, event) {
  const stages = tour.stages.filter((s) => s.eventId === event.id)
  const out = []
  const issue = graphIssue(stages, tour.stageLinks || [])
  if (issue) out.push({ tone: 'bad', key: issue })
  const full = eventTeams(tour, event.id).filter((x) => x.full)
  const rr = stages.find((s) => s.seq === 1 && s.type === 'round_robin')
  if (rr) {
    const unplaced = unplacedTeams(rr, full).length
    if (unplaced) out.push({ tone: 'bad', key: 'tournament.canvas.chkUnplaced', vars: { n: unplaced } })
    const small = shownGroups(rr, full).filter((ids) => ids.length < 2).length
    if (small && full.length) out.push({ tone: 'bad', key: 'tournament.canvas.chkSmallGroup', vars: { n: small } })
  }
  if (full.length < 2) out.push({ tone: 'warn', key: 'tournament.canvas.chkNoTeams' })
  const est = stages.length ? estimateOf(tour, event) : null
  if (est?.matches) {
    const vars = { n: est.matches, courts: est.courts, finish: est.finish, end: tour.endTime }
    if (est.fits === false) out.push({ tone: 'warn', key: 'tournament.canvas.chkOver', vars })
    else if (est.fits) out.push({ tone: 'ok', key: 'tournament.canvas.chkFits', vars })
    else out.push({ tone: 'warn', key: 'tournament.canvas.chkNoWindow', vars })
  }
  return out
}

/** Hạng mặc định cho link mới kéo từ vòng bảng: 2 hạng nhỏ nhất còn trống (1–2, rồi 3–4…). */
export function nextFreeRanks(links, sourceId, count = 2) {
  const taken = new Set(links.filter((l) => l.fromStageId === sourceId).flatMap((l) => l.ranks))
  const out = []
  for (let r = 1; out.length < count && r <= 16; r++) if (!taken.has(r)) out.push(r)
  return out
}

/** Độ cân các bảng đang hiển thị (handoff "Độ cân các bảng"): rating TB mỗi bảng, lệch max − min, cân khi ≤ ngưỡng. */
export function groupBalanceOf(stage, fullTeams) {
  const sum = new Map(fullTeams.map((t) => [t.id, t.sum || 0]))
  const groups = shownGroups(stage, fullTeams).map((ids) => ({ teams: ids.map((id) => ({ sum: sum.get(id) })) }))
  const avgs = groups.map((g) => (g.teams.length ? Math.round(g.teams.reduce((x, t) => x + t.sum, 0) / g.teams.length) : null))
  return { avgs, ...calcGroupBalance(groups) }
}

/** Lượt miễn vòng đầu của nhánh n đội: 2ᵏ − n (hạt giống cao được miễn). */
export const byesOf = (n) => (n < 2 ? 0 : nextPowerOf2(n) - n)

/**
 * Hộp "Tạo nhanh sơ đồ" (handoff): mẫu + số cặp mỗi bảng → số bảng / đi tiếp, và tóm tắt
 * "n khối · m đường nối · ~x trận" — tính bằng CHÍNH `buildTemplateStages` + `costOf` như lúc áp dụng thật.
 */
export function quickPlan(tpl, event, n, perGroup = 4) {
  const grouped = tpl === 'rr_ko' || tpl === 'rr_ko_plate'
  const numGroups = tpl === 'rr' ? 1 : grouped ? Math.max(2, Math.min(4, Math.ceil(n / Math.max(2, perGroup)))) : 1
  const advance = grouped ? 2 : 0
  const { stages, links } = buildTemplateStages(tpl, event, { numGroups, advancePerGroup: advance })
  const rule = stages[0]?.matchRule
  const final = stages.find((s) => s.type === 'knockout')?.ruleOverrides?.final || rule
  const cost = n >= 2 ? costOf({ tpl, numGroups, advance }, n, { dq: minutesOf(rule), df: minutesOf(final) }) : { matches: 0 }
  return { numGroups, advance, blocks: stages.length, links: links.length, matches: cost.matches }
}

/**
 * Sơ đồ của một nội dung → mẫu CLB (0060). Bỏ id, trạng thái, chia bảng tay (đội thay theo giải) — chỉ giữ hình.
 * @returns {{ stages: object[], links: Array<{ fromSeq, toSeq, ranks }> }}
 */
export function graphOf(stages, links) {
  const seqOf = new Map(stages.map((s) => [s.id, s.seq]))
  return {
    stages: [...stages].sort((a, b) => a.seq - b.seq).map((s) => {
      const { manualGroups, ...config } = s.config || {}
      return { seq: s.seq, type: s.type, title: s.title || null, config, matchRule: s.matchRule, ruleOverrides: s.ruleOverrides || {}, canvasX: s.canvasX ?? null, canvasY: s.canvasY ?? null }
    }),
    links: links.filter((l) => seqOf.has(l.fromStageId) && seqOf.has(l.toStageId))
      .map((l) => ({ fromSeq: seqOf.get(l.fromStageId), toSeq: seqOf.get(l.toStageId), ranks: [...l.ranks] })),
  }
}

/** Mẫu CLB → giai đoạn + link cùng dạng `buildTemplateStages` (để `replaceFormat` dùng chung một đường ghi). */
export function stagesFromGraph(graph) {
  return {
    stages: (graph?.stages || []).map((s) => ({ ...s, status: 'pending', config: { ...(s.config || {}) } })),
    links: (graph?.links || []).map((l) => ({ fromStageSeq: l.fromSeq, toStageSeq: l.toSeq, ranks: l.ranks })),
  }
}
