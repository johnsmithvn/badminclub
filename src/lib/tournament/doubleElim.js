/**
 * @file doubleElim.js
 * Nhánh thắng / Nhánh thua (double elimination). Thuần: không React, không Supabase.
 *
 * Thua 2 trận mới bị loại. Giai đoạn `knockout` với `config.bracket = 'double'`:
 *   · Nhánh thắng: y hệt nhánh loại trực tiếp (`buildKnockout`, không tranh 3), chung kết nhánh = 'wf'.
 *   · Nhánh thua ('lb'): 2(R−1) vòng. Vòng chẵn: đội thắng vòng trước gặp nhau (vòng 0: đội thua vòng 1 nhánh
 *     thắng gặp nhau). Vòng lẻ: đội thắng vòng trước gặp đội vừa rơi từ nhánh thắng xuống — rơi theo thứ tự
 *     ĐẢO để hai đội vừa gặp nhau ở nhánh thắng không gặp lại ngay.
 *   · Chung kết tổng 'gf': vô địch nhánh thắng (bên A) gặp vô địch nhánh thua (bên B). B thắng → hai đội cùng
 *     mới thua 1 trận → trận 2 'gf2' (RPC commit tự chèn, xem migration 0063). A thắng → xong.
 *   · Miễn đấu: trận bye vòng 1 nhánh thắng không có đội thua → ô nhánh thua tương ứng bỏ trống; trận nhánh thua
 *     chỉ còn một nguồn thì đội đó đi thẳng tới trận sau (không sinh trận miễn đấu ở nhánh thua).
 *
 * `round` đánh số chung cho cả giai đoạn để con trỏ luôn trỏ tới vòng SAU (RPC kiểm) và không trùng
 * (stage, round, slot): nhánh thắng r → 4r (chẵn), nhánh thua → 2k+5 (lẻ; k đếm từ vòng nhánh thua ĐẦU TIÊN
 * còn trận — miễn đấu nhiều có thể xoá trắng vòng 0, và chỉ vòng 0), chung kết tổng → 4R (trận 2: 4R+1).
 */

import { buildKnockout } from '#lib/tournament/bracket.js'
import { ruleFor } from '#lib/tournament/scoring.js'

const HAS_RESULT = new Set(['done', 'walkover', 'retired'])
const hasResult = (m) => HAS_RESULT.has(m.status)

export const isDouble = (stage) => stage?.type === 'knockout' && stage?.config?.bracket === 'double'
const wbRound = (r) => 4 * r
/** Vòng thứ mấy của nhánh thua (0-based, tính từ vòng đầu còn trận) từ `round` chung. */
export const lbIndexOf = (round) => (round - 5) / 2

/**
 * Sinh toàn bộ trận của nhánh thắng/thua (trừ trận 2 chung kết tổng — chỉ có khi cần).
 * @param {{ stage: object, entrants: Array<{ id: string, seed?: number, drawNo?: number }>, newId: () => string }} p
 */
export function buildDoubleElim({ stage, entrants, newId }) {
  const wbAll = buildKnockout({ stage: { ...stage, config: { ...stage.config, thirdPlace: false } }, entrants, newId })
  const R = Math.max(...wbAll.map((m) => m.round)) + 1
  const size = 2 ** R
  const wb = Array.from({ length: R }, (_, r) => wbAll.filter((m) => m.round === r).sort((a, b) => a.slot - b.slot))
  wbAll.forEach((m) => {
    m.round = wbRound(m.round)
    if (m.roundKind === 'final') Object.assign(m, { roundKind: 'wf', rule: { ...ruleFor(stage, 'wf') } })
  })

  const make = (round, slot, roundKind, rule) => ({
    id: newId(), stageId: stage.id, groupId: null, round, slot, roundKind,
    teamAId: null, teamBId: null, sourceA: null, sourceB: null,
    nextMatchId: null, nextSide: null, loserNextMatchId: null, loserNextSide: null,
    rule: { ...rule }, status: 'pending', sets: [], winner: null, resultNote: null, seqNo: null, courtLabel: null,
  })
  const win = (m, to, side) => { m.nextMatchId = to.id; m.nextSide = side; to['source' + side] = { kind: 'winner', match: m.id } }
  const lose = (m, to, side) => { m.loserNextMatchId = to.id; m.loserNextSide = side; to['source' + side] = { kind: 'loser', match: m.id } }

  // `round` nhánh thua gán SAU khi bỏ ô chết (biết vòng 0 còn trận không).
  const lb = []
  for (let j = 0; j <= R - 2; j++) {
    const count = size >> (j + 2)
    lb[2 * j] = Array.from({ length: count }, (_, s) => make(null, s, 'lb', ruleFor(stage, 'lb')))
    lb[2 * j + 1] = Array.from({ length: count }, (_, s) => make(null, s, 'lb', ruleFor(stage, 'lb')))
  }
  // Chung kết tổng: luật riêng 'gf' nếu BTC đặt, không thì luật "chung kết" (vòng tranh hạng).
  const gf = make(4 * R, 0, 'gf', stage.ruleOverrides?.gf || ruleFor(stage, 'final'))
  win(wb[R - 1][0], gf, 'A')

  if (R === 1) {
    lose(wb[0][0], gf, 'B')
  } else {
    wb[0].forEach((m, s) => lose(m, lb[0][s >> 1], s % 2 ? 'B' : 'A'))
    for (let j = 0; j <= R - 2; j++) {
      const count = lb[2 * j + 1].length
      lb[2 * j].forEach((m, i) => win(m, lb[2 * j + 1][i], 'A'))
      wb[j + 1].forEach((m, i) => lose(m, lb[2 * j + 1][count - 1 - i], 'B'))
      if (j <= R - 3) lb[2 * j + 1].forEach((m, i) => win(m, lb[2 * j + 2][i >> 1], i % 2 ? 'B' : 'A'))
    }
    win(lb[2 * R - 3][0], gf, 'B')
  }

  // Bỏ ô chết do bye: trận nhánh thua thiếu nguồn → đẩy thẳng nguồn còn lại (nếu có) tới trận sau.
  const byId = new Map([...wbAll, ...lb.flat(), gf].map((m) => [m.id, m]))
  const live = (src) => Boolean(src) && src.kind !== 'bye' && !(src.kind === 'loser' && byId.get(src.match)?.status === 'bye')
  const removed = new Set()
  lb.forEach((round) => round.forEach((m) => {
    const liveA = live(m.sourceA)
    const liveB = live(m.sourceB)
    if (liveA && liveB) return
    removed.add(m.id)
    const to = byId.get(m.nextMatchId)
    const side = m.nextSide
    if (!liveA && !liveB) {
      to['source' + side] = { kind: 'bye' }
      return
    }
    const src = liveA ? m.sourceA : m.sourceB
    const from = byId.get(src.match)
    if (src.kind === 'loser') { from.loserNextMatchId = to.id; from.loserNextSide = side } else { from.nextMatchId = to.id; from.nextSide = side }
    to['source' + side] = src
  }))
  wb[0].filter((m) => m.status === 'bye').forEach((m) => { m.loserNextMatchId = null; m.loserNextSide = null })

  const kept = lb.map((round) => round.filter((m) => !removed.has(m.id)))
  const shift = kept[0]?.length === 0 ? 1 : 0
  const lbKept = kept.map((round, k) => round.map((m, slot) => ({ ...m, slot, round: 2 * (k - shift) + 5 })))
  return [...wbAll, ...lbKept.flat(), gf]
}

/** Vô địch: trận 2 chung kết tổng nếu có, không thì chung kết tổng khi đội nhánh thắng (A) thắng. */
export function deChampion(own) {
  const gf2 = own.find((m) => m.roundKind === 'gf2')
  if (gf2) return hasResult(gf2) ? (gf2.winner === 'A' ? gf2.teamAId : gf2.teamBId) : null
  const gf = own.find((m) => m.roundKind === 'gf')
  return gf && hasResult(gf) && gf.winner === 'A' ? gf.teamAId : null
}

/**
 * Chia trận của giai đoạn để hiển thị: nhánh thắng / nhánh thua (theo vòng, bỏ vòng rỗng) / chung kết tổng.
 * `third` = đội thua trận cuối nhánh thua (hạng 3) khi đã có kết quả.
 */
export function deView(matches, stageId) {
  const own = matches.filter((m) => m.stageId === stageId)
  const rounds = (list) => {
    const by = new Map()
    list.forEach((m) => { if (!by.has(m.round)) by.set(m.round, []); by.get(m.round).push(m) })
    return [...by.keys()].sort((a, b) => a - b)
      .map((round) => ({ round, kind: by.get(round)[0].roundKind, matches: by.get(round).sort((a, b) => a.slot - b.slot) }))
  }
  const wb = rounds(own.filter((m) => !['lb', 'gf', 'gf2'].includes(m.roundKind)))
  const lb = rounds(own.filter((m) => m.roundKind === 'lb'))
  const gf = own.find((m) => m.roundKind === 'gf') || null
  const gf2 = own.find((m) => m.roundKind === 'gf2') || null
  const lbFinal = lb[lb.length - 1]?.matches[0]
  const third = lbFinal && hasResult(lbFinal) ? (lbFinal.winner === 'A' ? lbFinal.teamBId : lbFinal.teamAId) : null
  return { wb, lb, gf, gf2, champion: deChampion(own), third }
}
