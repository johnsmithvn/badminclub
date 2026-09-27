/**
 * @file roundRobin.js
 * Thuật toán chia bảng con rắn (snake) và sinh lịch thi đấu vòng tròn (circle/Berger).
 * Thuần: không React, không Supabase.
 */

import cfg from '#config/app.json' with { type: 'json' }

/**
 * Chia hạt giống hình con rắn (snake draft) vào các bảng.
 * Thứ tự: A, B, C, D → D, C, B, A → A, B, C, D...
 * Tự xếp theo tổng rating giảm dần trước khi chia (`eventTeams` trả theo số bốc thăm, không theo rating);
 * sort ổn định → đội bằng rating giữ thứ tự truyền vào.
 * @param {Array<{ id: string, sum?: number }>} teams
 * @param {number} numGroups  Số bảng (2, 4...)
 * @param {(seq: number) => string} [labelFn]  Đặt tên bảng (A, B, C...)
 * @returns {Array<{ label: string, seq: number, teams: Array<{ teamId: string, seedInGroup: number, sum: number }> }>}
 */
export function snakeGroups(teams, numGroups, labelFn = (i) => String.fromCharCode(65 + i)) {
  if (!numGroups || numGroups < 1) throw new Error('snakeGroups: số bảng phải >= 1')
  const groups = Array.from({ length: numGroups }, (_, i) => ({
    label: labelFn(i),
    seq: i + 1,
    teams: [],
  }))

  ;[...teams].sort((a, b) => (b.sum || 0) - (a.sum || 0)).forEach((t, i) => {
    const groupIdx = snakeIndex(i, numGroups)
    groups[groupIdx].teams.push({
      teamId: t.id,
      seedInGroup: groups[groupIdx].teams.length + 1,
      sum: t.sum || 0,
    })
  })

  return groups
}

/** Hạt giống thứ i (0-based) vào bảng nào: lượt chẵn A→D, lượt lẻ D→A. */
export function snakeIndex(i, numGroups) {
  const rem = i % numGroups
  return Math.floor(i / numGroups) % 2 === 0 ? rem : numGroups - 1 - rem
}

/**
 * Tính chỉ số cân bằng giữa các bảng: độ lệch rating TRUNG BÌNH mỗi đội giữa bảng mạnh nhất và yếu nhất
 * (README handoff §5.3). Dùng trung bình chứ không dùng tổng: bảng 4 đội với bảng 3 đội thì tổng luôn lệch.
 * Ngưỡng `app.json → tournament.groupBalanceOk`.
 * @param {Array<{ teams: Array<{ sum?: number }> }>} groups
 * @returns {{ min: number, max: number, spread: number, isBalanced: boolean }}
 */
export function calcGroupBalance(groups) {
  const filled = (groups || []).filter((g) => g.teams.length > 0)
  if (filled.length <= 1) return { min: 0, max: 0, spread: 0, isBalanced: true }
  const avgs = filled.map((g) => g.teams.reduce((s, t) => s + (t.sum || 0), 0) / g.teams.length)
  const min = Math.min(...avgs)
  const max = Math.max(...avgs)
  const spread = Math.round(max - min)
  return { min, max, spread, isBalanced: spread <= cfg.tournament.groupBalanceOk }
}

/**
 * Sinh các cặp đấu của một bảng theo thuật toán Circle (Berger).
 * Đội lẻ: có một đội nghỉ lượt đó (không sinh trận đấu giả / không có dummy).
 * @param {Array<string>} teamIds  Danh sách ID đội trong bảng
 * @param {number} [legs=1]  1: lượt đi, 2: lượt đi & về
 * @returns {Array<{ round: number, teamAId: string, teamBId: string }>}
 */
export function circleMatches(teamIds, legs = 1) {
  if (!teamIds || teamIds.length < 2) return []
  const n = teamIds.length
  const isOdd = n % 2 !== 0
  const count = isOdd ? n + 1 : n
  const list = isOdd ? [...teamIds, null] : [...teamIds]
  const roundsCount = count - 1
  const half = count / 2
  const matches = []

  for (let r = 0; r < roundsCount; r++) {
    for (let i = 0; i < half; i++) {
      const a = list[i]
      const b = list[count - 1 - i]
      // Nếu 1 bên là null (dummy do số đội lẻ) -> đội kia nghỉ lượt này
      if (a && b) {
        // Đổi bên sân xen kẽ qua từng vòng cho công bằng
        const [teamAId, teamBId] = (r + i) % 2 === 0 ? [a, b] : [b, a]
        matches.push({ round: r, teamAId, teamBId })
      }
    }
    // Xoay các phần tử trừ vị trí 0 (cố định vị trí đầu)
    const fixed = list[0]
    const rest = list.slice(1)
    rest.unshift(rest.pop())
    list.splice(0, list.length, fixed, ...rest)
  }

  if (legs === 2) {
    const leg1 = matches.map((m) => ({ ...m }))
    const leg2 = leg1.map((m) => ({
      round: m.round + roundsCount,
      teamAId: m.teamBId,
      teamBId: m.teamAId,
    }))
    return [...leg1, ...leg2]
  }

  return matches
}

/**
 * Xây dựng toàn bộ các trận vòng bảng cho một giai đoạn (stage).
 * @param {{ stage: object, groups: Array<object>, legs?: number, newId: () => string }} params
 * @returns {Array<object>}  Danh sách tournament_matches ở dạng camelCase
 */
export function buildRoundRobin({ stage, groups, legs = 1, newId }) {
  if (!stage || !stage.id) throw new Error('buildRoundRobin: thiếu stage')
  if (!Array.isArray(groups) || groups.length === 0) throw new Error('buildRoundRobin: cần ít nhất 1 bảng')

  const matchRule = stage.matchRule
  if (!matchRule) throw new Error('buildRoundRobin: stage thiếu matchRule')

  const matches = []
  groups.forEach((g) => {
    const teamIds = (g.teams || []).map((t) => (typeof t === 'string' ? t : t.teamId))
    const groupPairs = circleMatches(teamIds, legs)

    // Nhóm theo round để đánh số slot
    const byRound = {}
    groupPairs.forEach((p) => {
      byRound[p.round] = byRound[p.round] || []
      byRound[p.round].push(p)
    })

    Object.keys(byRound).sort((a, b) => Number(a) - Number(b)).forEach((rStr) => {
      const r = Number(rStr)
      byRound[r].forEach((p, slot) => {
        matches.push({
          id: newId(),
          stageId: stage.id,
          groupId: g.id,
          round: r,
          slot,
          roundKind: 'group',
          teamAId: p.teamAId,
          teamBId: p.teamBId,
          sourceA: { kind: 'seed', n: g.teams.find((t) => t.teamId === p.teamAId)?.seedInGroup || null },
          sourceB: { kind: 'seed', n: g.teams.find((t) => t.teamId === p.teamBId)?.seedInGroup || null },
          rule: matchRule,
          status: 'ready',
          sets: [],
          winner: null,
          nextMatchId: null,
          nextSide: null,
          loserNextMatchId: null,
          loserNextSide: null,
        })
      })
    })
  })

  return matches
}
