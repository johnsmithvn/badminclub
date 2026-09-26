/**
 * @file scoreboard.js
 * Bảng ghi điểm từng quả của trọng tài (handoff: GHI ĐIỂM). Trạng thái thuần + reducer, không React.
 * Điểm chỉ nằm ở máy trọng tài (bản nháp localStorage); lên DB một lần khi xác nhận (plan §4.5).
 */

import { freeSetWinner, resultWinner, scoreFlags, setWinner } from '#lib/tournament/scoring.js'

/** Trạng thái rỗng. `swapped`: hai bên đã đổi sân (đổi sau mỗi set) — chỉ ảnh hưởng cách hiển thị. */
export const emptyBoard = () => ({ sets: [], cur: [0, 0], swapped: false, history: [] })

const snapshot = (s) => ({ sets: s.sets, cur: s.cur, swapped: s.swapped })

/**
 * @param {{ sets: number[][], cur: number[], swapped: boolean, history: object[] }} s
 * @param {{ type: 'point'|'minus'|'undo'|'endSet', side?: 'A'|'B' }} action
 * @param {object} rule luật của TRẬN (đã chép vào trận lúc sinh nhánh)
 */
export function boardReducer(s, action, rule) {
  if (action.type === 'undo') {
    if (!s.history.length) return s
    const prev = s.history[s.history.length - 1]
    return { ...prev, history: s.history.slice(0, -1) }
  }
  if (resultWinner(s.sets, rule)) return s // xong trận: khoá
  // "Kết thúc set" (D11): trọng tài chốt set đang đánh ở tỷ số hiện tại (đánh ngắn / hết giờ). Hoà thì chưa chốt được.
  if (action.type === 'endSet') {
    if (!freeSetWinner(s.cur[0], s.cur[1]) || freeSetWinner(s.cur[0], s.cur[1]) === 'invalid') return s
    return { sets: [...s.sets, [...s.cur]], cur: [0, 0], swapped: !s.swapped, history: [...s.history, snapshot(s)] }
  }
  const i = action.side === 'A' ? 0 : 1
  if (action.type === 'minus') {
    if (s.cur[i] === 0) return s
    const cur = [...s.cur]
    cur[i] -= 1
    return { ...s, cur, history: [...s.history, snapshot(s)] }
  }
  if (action.type !== 'point') return s
  const cur = [...s.cur]
  cur[i] += 1
  const w = setWinner(cur[0], cur[1], rule)
  if (w === 'invalid') return s // vượt trần — không có quả này
  const history = [...s.history, snapshot(s)]
  if (w === 'A' || w === 'B') {
    // Hết set: chốt set, về 0-0, đổi sân (quy chế: "thắng sec, đổi sân").
    return { sets: [...s.sets, cur], cur: [0, 0], swapped: !s.swapped, history }
  }
  return { ...s, cur, history }
}

/** Trạng thái để vẽ: người thắng trận (nếu xong), cờ set/match point, vừa hết set (để báo đổi sân). */
export function boardView(s, rule) {
  const winner = resultWinner(s.sets, rule)
  const done = Boolean(winner)
  return {
    winner: done ? winner : null,
    setNo: s.sets.length + (done ? 0 : 1),
    flags: done ? null : scoreFlags({ currentScore: s.cur, sets: s.sets }, rule),
    justSwitched: !done && s.sets.length > 0 && s.cur[0] === 0 && s.cur[1] === 0,
    canEndSet: !done && (s.cur[0] !== s.cur[1]),
  }
}

/** Bản nháp an toàn: dữ liệu đọc từ localStorage có thể hỏng / cũ — hỏng thì bắt đầu lại. */
export function parseDraft(raw) {
  try {
    const d = JSON.parse(raw)
    const pair = (x) => Array.isArray(x) && x.length === 2 && x.every(Number.isInteger)
    if (!d || !pair(d.cur) || !Array.isArray(d.sets) || !d.sets.every(pair)) return emptyBoard()
    return { sets: d.sets, cur: d.cur, swapped: Boolean(d.swapped), history: [] }
  } catch {
    return emptyBoard()
  }
}
