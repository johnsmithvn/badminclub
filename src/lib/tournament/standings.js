/**
 * @file standings.js
 * Bảng xếp hạng vòng tròn (plan §3.1, thông lệ BWF). Thuần: không React, không Supabase.
 *
 *   1. Số trận thắng.
 *   2. Bằng nhau 2 đội → đối đầu trực tiếp.
 *   3. Bằng nhau ≥ 3 đội → bảng con chỉ gồm trận giữa các đội đó: thắng → hiệu số set → hiệu số điểm.
 *      Tách được nhóm nào thì xét lại nhóm đó từ đầu (còn đúng 2 đội → quay lại đối đầu).
 *   4. Vẫn hoà → `ties`, BTC quyết ở bước "Chốt giai đoạn". Không tự phân xử.
 */

import { freeSetWinner } from '#lib/tournament/scoring.js'

const HAS_RESULT = new Set(['done', 'walkover', 'retired'])

/**
 * Set / điểm của một trận đã có kết quả.
 *   walkover: bên thắng được đủ số set cần thắng, mỗi set `rule.points`–0.
 *   retired:  giữ các set đã đánh xong; set dở dang và các set còn thiếu tính cho bên thắng (như walkover),
 *             điểm dở dang giữ nguyên như đã đánh.
 */
function resolveMatchResult(match) {
  const isA = match.winner === 'A'
  const isB = match.winner === 'B'
  const need = Math.ceil((match.rule?.sets || 1) / 2)
  const pts = match.rule?.points || 21

  if (match.status === 'walkover') {
    return {
      teamAWins: isA, teamBWins: isB,
      setsA: isA ? need : 0, setsB: isB ? need : 0,
      ptsA: isA ? need * pts : 0, ptsB: isB ? need * pts : 0,
    }
  }

  let setsA = 0
  let setsB = 0
  let ptsA = 0
  let ptsB = 0
  const list = Array.isArray(match.sets) ? match.sets : []
  list.forEach(([a = 0, b = 0], i) => {
    ptsA += a
    ptsB += b
    // Bỏ cuộc: set CUỐI là set đang đánh dở lúc dừng → không tính cho ai (điểm vẫn cộng); bên thắng được bù dưới đây.
    if (match.status === 'retired' && i === list.length - 1) return
    const w = freeSetWinner(a, b) // D11: set thuộc bên cao điểm hơn — không xét luật điểm
    if (w === 'A') setsA++
    else if (w === 'B') setsB++
  })

  if (match.status === 'retired') {
    if (isA) setsA = Math.max(setsA, need)
    if (isB) setsB = Math.max(setsB, need)
  }

  return { teamAWins: isA, teamBWins: isB, setsA, setsB, ptsA, ptsB }
}

/** Thống kê của một đội trên một tập trận (chỉ trận đã có kết quả). */
function computeStats(teamId, matches) {
  const s = { teamId, played: 0, won: 0, lost: 0, setsWon: 0, setsLost: 0, pointsWon: 0, pointsLost: 0 }
  matches.forEach((m) => {
    const inA = m.teamAId === teamId
    if (!inA && m.teamBId !== teamId) return
    if (!HAS_RESULT.has(m.status)) return
    const r = resolveMatchResult(m)
    const [me, op] = inA ? ['A', 'B'] : ['B', 'A']
    s.played++
    if (r['team' + me + 'Wins']) s.won++
    else if (r['team' + op + 'Wins']) s.lost++
    s.setsWon += r['sets' + me]
    s.setsLost += r['sets' + op]
    s.pointsWon += r['pts' + me]
    s.pointsLost += r['pts' + op]
  })
  return { ...s, setDiff: s.setsWon - s.setsLost, pointDiff: s.pointsWon - s.pointsLost }
}

/** Đối đầu trực tiếp: 1 = A hơn, -1 = B hơn, 0 = chưa phân định (chưa gặp, hoặc 2 lượt hoà nhau hoàn toàn). */
function headToHead(idA, idB, matches) {
  const direct = matches.filter((m) => HAS_RESULT.has(m.status)
    && ((m.teamAId === idA && m.teamBId === idB) || (m.teamAId === idB && m.teamBId === idA)))
  if (!direct.length) return 0
  const a = computeStats(idA, direct)
  const b = computeStats(idB, direct)
  const d = (a.won - b.won) || (a.setDiff - b.setDiff) || (a.pointDiff - b.pointDiff)
  return Math.sign(d)
}

/** Gom các dòng liên tiếp có cùng khoá (đã sort). */
function bucketsBy(rows, key) {
  const out = []
  rows.forEach((r) => {
    const last = out[out.length - 1]
    if (last && key(last[0]) === key(r)) last.push(r)
    else out.push([r])
  })
  return out
}

/**
 * Xếp một nhóm đội bằng số trận thắng. Trả `{ order, ties }` — `ties` là các nhóm id không tách được.
 * Đệ quy: mỗi lần tách được thì xét lại nhóm con với bảng con mới của riêng nhóm đó.
 */
function rankTied(rows, matches) {
  if (rows.length <= 1) return { order: rows, ties: [] }

  if (rows.length === 2) {
    const cmp = headToHead(rows[0].teamId, rows[1].teamId, matches)
    if (cmp !== 0) return { order: cmp > 0 ? rows : [rows[1], rows[0]], ties: [] }
    return { order: rows, ties: [rows.map((r) => r.teamId)] }
  }

  const ids = new Set(rows.map((r) => r.teamId))
  const internal = matches.filter((m) => ids.has(m.teamAId) && ids.has(m.teamBId))
  const mini = new Map(rows.map((r) => [r.teamId, computeStats(r.teamId, internal)]))
  const key = (r) => { const s = mini.get(r.teamId); return `${s.won}|${s.setDiff}|${s.pointDiff}` }
  const sorted = [...rows].sort((x, y) => {
    const a = mini.get(x.teamId)
    const b = mini.get(y.teamId)
    return (b.won - a.won) || (b.setDiff - a.setDiff) || (b.pointDiff - a.pointDiff)
  })
  const buckets = bucketsBy(sorted, key)
  if (buckets.length === 1) return { order: rows, ties: [rows.map((r) => r.teamId)] }

  const order = []
  const ties = []
  buckets.forEach((b) => {
    const sub = rankTied(b, matches)
    order.push(...sub.order)
    ties.push(...sub.ties)
  })
  return { order, ties }
}

/**
 * Bảng xếp hạng của một bảng đấu.
 * @param {{ id: string, teams: Array<string|{ teamId: string }> }} group  xem `stageGroups`
 * @param {Array<object>} matches  trận (có thể là toàn giải — lọc theo `groupId`)
 * @returns {{ rows: Array<object>, ties: string[][], isFinished: boolean, matchesCount: { total: number, done: number } }}
 *   `rows[i].tied` = true khi đội nằm trong một nhóm hoà chưa tách được.
 */
export function groupStandings(group, matches) {
  const teamIds = (group.teams || []).map((t) => (typeof t === 'string' ? t : t.teamId))
  const own = matches.filter((m) => m.groupId === group.id)
  const done = own.filter((m) => HAS_RESULT.has(m.status))

  const stats = teamIds.map((id) => computeStats(id, own))
  const order = []
  const ties = []
  bucketsBy([...stats].sort((a, b) => b.won - a.won), (r) => r.won).forEach((b) => {
    const sub = rankTied(b, own)
    order.push(...sub.order)
    ties.push(...sub.ties)
  })

  const tied = new Set(ties.flat())
  return {
    rows: order.map((r, i) => ({ ...r, rank: i + 1, tied: tied.has(r.teamId) })),
    ties,
    isFinished: own.length > 0 && done.length === own.length,
    matchesCount: { total: own.length, done: done.length },
  }
}

/**
 * Các bảng của một giai đoạn, kèm đội (từ `tour.groupTeams`, theo `seedInGroup`) — dạng `groupStandings` cần.
 * Bảng trong state `tour` không mang danh sách đội; ghép ở đây, không map rải rác trong JSX.
 */
export function stageGroups(tour, stageId) {
  return (tour.groups || [])
    .filter((g) => g.stageId === stageId)
    .sort((x, y) => x.seq - y.seq)
    .map((g) => ({
      ...g,
      teams: (tour.groupTeams || [])
        .filter((gt) => gt.groupId === g.id)
        .sort((x, y) => (x.seedInGroup ?? 0) - (y.seedInGroup ?? 0))
        .map((gt) => ({ teamId: gt.teamId, seedInGroup: gt.seedInGroup, finalRank: gt.finalRank })),
    }))
}

/**
 * Thứ tự BTC chốt: thứ tự tính được, nhưng BTC được đảo 2 đội liền nhau CÙNG một nhóm hoà (bốc thăm / chọn tay).
 * @param {object[]} rows  từ `groupStandings`
 * @param {string[]|undefined} manual  thứ tự id BTC đã chỉnh (bỏ qua nếu không còn khớp đội)
 */
export function orderedRows(rows, manual) {
  if (!manual || manual.length !== rows.length || !rows.every((r) => manual.includes(r.teamId))) return rows
  return manual.map((id) => rows.find((r) => r.teamId === id)).map((r, i) => ({ ...r, rank: i + 1 }))
}

/**
 * Thứ tự cuối cùng của một bảng — đã chốt thì theo `final_rank` đã ghi (không tính lại); chưa chốt thì theo
 * thứ tự BTC tự xếp khi hoà (`manual`, id đội theo `orderedRows`). Dùng chung để RENDER và để tính `ranks`
 * lúc "Chốt giai đoạn" — khớp nhau tuyệt đối, không lệch giữa hiển thị và cái ghi xuống DB.
 */
export function finalRows(stage, group, st, manual) {
  return stage?.status === 'done'
    ? orderedRows(st.rows, [...group.teams].sort((x, y) => (x.finalRank ?? 99) - (y.finalRank ?? 99)).map((x) => x.teamId))
    : orderedRows(st.rows, manual)
}

/** Đảo đội `teamId` lên trên đội liền trước — chỉ khi cả hai cùng một nhóm hoà. Trả thứ tự id mới, hoặc null. */
export function swapUpInTie(rows, ties, teamId) {
  const i = rows.findIndex((r) => r.teamId === teamId)
  if (i <= 0) return null
  const prev = rows[i - 1].teamId
  if (!ties.some((g) => g.includes(teamId) && g.includes(prev))) return null
  const ids = rows.map((r) => r.teamId)
  ;[ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]
  return ids
}
