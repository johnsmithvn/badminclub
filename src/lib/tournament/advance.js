/**
 * @file advance.js
 * Chốt / hoàn tác / sửa kết quả trên mảng trận trong bộ nhớ. Thuần: không React, không Supabase.
 *
 * Đây là ĐẶC TẢ CHẠY ĐƯỢC của các RPC `tournament_commit_match` / `_undo_match` / `_edit_match`
 * (docs/TOURNAMENT_PLAN.md §2.3): plpgsql viết theo đúng hành vi mà test của file này khoá.
 * Mọi hàm trả `{ matches, error }` — lỗi là key i18n, `matches` giữ nguyên khi có lỗi.
 */

import { freeSetWinner, resultWinner, validateResult } from '#lib/tournament/scoring.js'

const RESULT = ['done', 'walkover', 'retired']
// Trận đích đang đánh hoặc đã có kết quả → gỡ đội ra là xoá trận người ta đang/đã đánh.
const BLOCKS_UNDO = ['live', ...RESULT]

const hasResult = (m) => RESULT.includes(m.status)
const blank = (s) => !s || !String(s).trim()

/**
 * Đặt (hoặc gỡ, khi `teamId` null) một đội vào một bên của trận. Đủ 2 đội → `ready`; thiếu → `pending`.
 * Dùng chung cho chốt, hoàn tác và bye của `bracket.js` — một chỗ quyết trạng thái trận đích.
 */
export function seatTeam(match, side, teamId) {
  match[side === 'A' ? 'teamAId' : 'teamBId'] = teamId
  if (!teamId) match.status = 'pending'
  else if (match.teamAId && match.teamBId && match.status === 'pending') match.status = 'ready'
}

// Trả bản sao của mảng + trận cần sửa, để hàm nào cũng không đụng vào mảng người gọi đưa vào.
function cloneWith(matches, matchId) {
  const next = matches.map((m) => ({ ...m }))
  const byId = new Map(next.map((m) => [m.id, m]))
  return { next, byId, m: byId.get(matchId) }
}

const gf2Of = (matches, m) => matches.find((x) => x.stageId === m.stageId && x.roundKind === 'gf2')

/**
 * `stages` (tuỳ chọn): để biết trận thuộc Thụy Sĩ — trận của vòng đã có vòng sau thì không hoàn tác được
 * (cặp vòng sau ghép theo kết quả đó).
 */
export function canUndo(matches, matchId, stages = []) {
  const m = matches.find((x) => x.id === matchId)
  if (!m) return { ok: false, reasonKey: 'tournament.err.matchNotFound' }
  if (m.status === 'bye') return { ok: false, reasonKey: 'tournament.err.cannotUndoBye' }
  if (!hasResult(m)) return { ok: false, reasonKey: 'tournament.err.matchNotDone' }
  const downstream = [m.nextMatchId, m.loserNextMatchId].filter(Boolean)
  const gf2 = m.roundKind === 'gf' ? gf2Of(matches, m) : null
  const blocked = matches.some((x) => downstream.includes(x.id) && BLOCKS_UNDO.includes(x.status))
    || Boolean(gf2 && BLOCKS_UNDO.includes(gf2.status))
  if (blocked) return { ok: false, reasonKey: 'tournament.err.downstreamHasResult' }
  const swiss = stages.find((s) => s.id === m.stageId)?.type === 'swiss'
  if (swiss && matches.some((x) => x.stageId === m.stageId && x.round > m.round)) return { ok: false, reasonKey: 'tournament.err.swissLaterRound' }
  return { ok: true }
}

/**
 * Kiểm điểm theo trạng thái chốt. `retired` (bỏ cuộc giữa trận): set dở dang hợp lệ, nhưng điểm từng
 * set vẫn phải đọc được theo luật (không âm, không quá trần, không vượt điểm dừng).
 */
function resultError({ sets, winner, status, note }, rule) {
  if (status === 'done') {
    // D11: điểm tự do — chỉ kiểm đủ số set thắng, không set hoà, không thừa set (cùng `tournament_valid_sets` 0061).
    return validateResult(sets, rule) || (resultWinner(sets, rule) !== winner ? 'tournament.err.winnerMismatch' : null)
  }
  if (status === 'walkover') {
    if (blank(note)) return 'tournament.err.missingReason'
    return sets.length ? 'tournament.err.walkoverHasSets' : null
  }
  if (status === 'retired') {
    if (blank(note)) return 'tournament.err.missingReason'
    // Bỏ cuộc giữa chừng: set dở dang (kể cả đang hoà) được — chỉ cần là số 0..99 và không quá số set.
    const readable = sets.length <= rule.sets &&
      sets.every((s) => Array.isArray(s) && s.length === 2 && freeSetWinner(s[0], s[1]) !== 'invalid')
    return readable ? null : 'tournament.err.invalidSetScore'
  }
  return 'tournament.err.invalidStatus'
}

/**
 * Chốt kết quả: đội thắng → `nextMatchId`, đội thua → `loserNextMatchId` (tranh 3-4).
 * @param {{ matchId: string, sets?: Array<[number,number]>, winner: 'A'|'B', status?: 'done'|'walkover'|'retired', note?: string }} p
 */
export function applyCommit(matches, { matchId, sets = [], winner, status = 'done', note = null }) {
  const cur = matches.find((x) => x.id === matchId)
  if (!cur) return { matches, error: 'tournament.err.matchNotFound' }
  if (cur.status !== 'ready' && cur.status !== 'live') {
    return { matches, error: hasResult(cur) ? 'tournament.err.alreadyCommitted' : 'tournament.err.matchNotReady' }
  }
  if (winner !== 'A' && winner !== 'B') return { matches, error: 'tournament.err.invalidWinner' }
  const error = resultError({ sets, winner, status, note }, cur.rule)
  if (error) return { matches, error }

  const { next, byId, m } = cloneWith(matches, matchId)
  Object.assign(m, { status, sets, winner, resultNote: status === 'done' ? null : note })
  const [won, lost] = winner === 'A' ? [m.teamAId, m.teamBId] : [m.teamBId, m.teamAId]
  if (m.nextMatchId) seatTeam(byId.get(m.nextMatchId), m.nextSide, won)
  if (m.loserNextMatchId) seatTeam(byId.get(m.loserNextMatchId), m.loserNextSide, lost)
  // Chung kết tổng: đội nhánh thua (B) thắng → đá thêm trận 2 (RPC chèn trận thật; đây chỉ đoán trước).
  if (m.roundKind === 'gf' && winner === 'B' && !gf2Of(next, m)) {
    next.push({
      ...m, id: m.id + ':gf2', round: m.round + 1, slot: 0, roundKind: 'gf2', status: 'ready', sets: [], winner: null, resultNote: null,
      sourceA: { kind: 'loser', match: m.id }, sourceB: { kind: 'winner', match: m.id },
    })
  }
  return { matches: next, error: null }
}

/** Gỡ kết quả, gỡ đội ở CẢ trận sau lẫn trận 3-4 (và trận 2 chung kết tổng). Chặn khi trận đích đã đánh (`canUndo`). */
export function applyUndo(matches, { matchId, reason }, stages = []) {
  const check = canUndo(matches, matchId, stages)
  if (!check.ok) return { matches, error: check.reasonKey }
  if (blank(reason)) return { matches, error: 'tournament.err.missingReason' }

  const { next, byId, m } = cloneWith(matches, matchId)
  Object.assign(m, { status: 'ready', sets: [], winner: null, resultNote: null })
  if (m.nextMatchId) seatTeam(byId.get(m.nextMatchId), m.nextSide, null)
  if (m.loserNextMatchId) seatTeam(byId.get(m.loserNextMatchId), m.loserNextSide, null)
  const gf2 = m.roundKind === 'gf' ? gf2Of(next, m) : null
  return { matches: gf2 ? next.filter((x) => x !== gf2) : next, error: null }
}

/**
 * Sửa ĐIỂM trận đã xong, người thắng giữ nguyên. Không có nhánh thay đội ở trận sau:
 * đổi người thắng = `applyUndo` rồi `applyCommit` (một bộ kiểm downstream duy nhất).
 */
export function applyEdit(matches, { matchId, sets, reason }) {
  const cur = matches.find((x) => x.id === matchId)
  if (!cur) return { matches, error: 'tournament.err.matchNotFound' }
  if (cur.status !== 'done') return { matches, error: 'tournament.err.cannotEditNotDone' }
  if (blank(reason)) return { matches, error: 'tournament.err.missingReason' }
  const invalid = validateResult(sets, cur.rule)
  if (invalid) return { matches, error: invalid }
  if (resultWinner(sets, cur.rule) !== cur.winner) return { matches, error: 'tournament.err.cannotChangeWinnerInEdit' }

  const { next, m } = cloneWith(matches, matchId)
  m.sets = sets
  return { matches: next, error: null }
}

/** Xoá trận để sinh lại chỉ khi chưa trận nào có kết quả thật (bye không tính). */
export function canResetStage(matches) {
  return matches.some(hasResult) ? { ok: false, reasonKey: 'tournament.err.stageHasResults' } : { ok: true }
}
