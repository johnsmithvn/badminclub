/**
 * @file advance.js
 * Chốt / hoàn tác / sửa kết quả trên mảng trận trong bộ nhớ. Thuần: không React, không Supabase.
 *
 * Đây là ĐẶC TẢ CHẠY ĐƯỢC của các RPC `tournament_commit_match` / `_undo_match` / `_edit_match`
 * (docs/TOURNAMENT_PLAN.md §2.3): plpgsql viết theo đúng hành vi mà test của file này khoá.
 * Mọi hàm trả `{ matches, error }` — lỗi là key i18n, `matches` giữ nguyên khi có lỗi.
 */

import { matchWinner, setWinner, validateSets } from '#lib/tournament/scoring.js'

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

export function canUndo(matches, matchId) {
  const m = matches.find((x) => x.id === matchId)
  if (!m) return { ok: false, reasonKey: 'tournament.err.matchNotFound' }
  if (m.status === 'bye') return { ok: false, reasonKey: 'tournament.err.cannotUndoBye' }
  if (!hasResult(m)) return { ok: false, reasonKey: 'tournament.err.matchNotDone' }
  const downstream = [m.nextMatchId, m.loserNextMatchId].filter(Boolean)
  const blocked = matches.some((x) => downstream.includes(x.id) && BLOCKS_UNDO.includes(x.status))
  return blocked ? { ok: false, reasonKey: 'tournament.err.downstreamHasResult' } : { ok: true }
}

/**
 * Kiểm điểm theo trạng thái chốt. `retired` (bỏ cuộc giữa trận): set dở dang hợp lệ, nhưng điểm từng
 * set vẫn phải đọc được theo luật (không âm, không quá trần, không vượt điểm dừng).
 */
function resultError({ sets, winner, status, note }, rule) {
  if (status === 'done') {
    return validateSets(sets, rule) || (matchWinner(sets, rule) !== winner ? 'tournament.err.winnerMismatch' : null)
  }
  if (status === 'walkover') {
    if (blank(note)) return 'tournament.err.missingReason'
    return sets.length ? 'tournament.err.walkoverHasSets' : null
  }
  if (status === 'retired') {
    if (blank(note)) return 'tournament.err.missingReason'
    const readable = sets.length <= rule.sets &&
      sets.every((s) => Array.isArray(s) && s.length === 2 && setWinner(s[0], s[1], rule) !== 'invalid')
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
  return { matches: next, error: null }
}

/** Gỡ kết quả, gỡ đội ở CẢ trận sau lẫn trận 3-4. Chặn khi trận đích đã đánh (`canUndo`). */
export function applyUndo(matches, { matchId, reason }) {
  const check = canUndo(matches, matchId)
  if (!check.ok) return { matches, error: check.reasonKey }
  if (blank(reason)) return { matches, error: 'tournament.err.missingReason' }

  const { next, byId, m } = cloneWith(matches, matchId)
  Object.assign(m, { status: 'ready', sets: [], winner: null, resultNote: null })
  if (m.nextMatchId) seatTeam(byId.get(m.nextMatchId), m.nextSide, null)
  if (m.loserNextMatchId) seatTeam(byId.get(m.loserNextMatchId), m.loserNextSide, null)
  return { matches: next, error: null }
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
  const invalid = validateSets(sets, cur.rule)
  if (invalid) return { matches, error: invalid }
  if (matchWinner(sets, cur.rule) !== cur.winner) return { matches, error: 'tournament.err.cannotChangeWinnerInEdit' }

  const { next, m } = cloneWith(matches, matchId)
  m.sets = sets
  return { matches: next, error: null }
}

/** Xoá trận để sinh lại chỉ khi chưa trận nào có kết quả thật (bye không tính). */
export function canResetStage(matches) {
  return matches.some(hasResult) ? { ok: false, reasonKey: 'tournament.err.stageHasResults' } : { ok: true }
}
