// Logic tìm kiếm trận đấu, lọc đối đầu & ma trận thi đấu (H2H Matrix) — Pure functions.
import cfg from '#config/app.json' with { type: 'json' }

/**
 * Lọc danh sách trận đấu theo các tiêu chí đa chiều.
 */
export function filterMatches(matches, { playerA, playerB, mode = 'h2h', quality = 'all', fromDate, toDate } = {}) {
  const normMode = mode === 'vs' ? 'h2h' : mode === 'team' ? 'teammate' : mode

  return (matches || []).filter((m) => {
    const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
    const teamB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])
    const players = m.playerKeys || [...teamA, ...teamB]

    if (!players.length) return false

    // Lọc theo khoảng ngày
    const mDate = m.date || (m.createdAt ? m.createdAt.slice(0, 10) : null)
    if (fromDate && mDate && mDate < fromDate) return false
    if (toDate && mDate && mDate > toDate) return false

    // Lọc theo 2 người chơi
    if (playerA && playerB) {
      if (normMode === 'h2h') {
        const aIn1 = teamA.includes(playerA) && teamB.includes(playerB)
        const aIn2 = teamB.includes(playerA) && teamA.includes(playerB)
        if (!aIn1 && !aIn2) return false
      } else if (normMode === 'teammate') {
        const same1 = teamA.includes(playerA) && teamA.includes(playerB)
        const same2 = teamB.includes(playerA) && teamB.includes(playerB)
        if (!same1 && !same2) return false
      }
    } else if (playerA) {
      if (!players.includes(playerA)) return false
    } else if (playerB) {
      if (!players.includes(playerB)) return false
    }

    // Lọc theo chất lượng trận đấu
    if (quality === 'close') {
      const sets = m.sets || []
      const maxDiff = cfg.match?.closeMatchMaxDiff ?? 3
      const isCloseSet = sets.some((s) => s && s[0] != null && s[1] != null && Math.abs(s[0] - s[1]) <= maxDiff)
      const isThreeSets = sets.filter((s) => s && s[0] + s[1] > 0).length >= 3
      if (!isCloseSet && !isThreeSets) return false
    } else if (quality === 'upset') {
      const ra = m.initialRatingA || 0
      const rb = m.initialRatingB || 0
      const winTeam = m.winnerTeam
      const aLower = ra < rb
      const bLower = rb < ra
      const minGap = cfg.match?.upsetMinGap ?? 100
      const aUpset = aLower && winTeam === 'A' && Math.abs(ra - rb) > minGap
      const bUpset = bLower && winTeam === 'B' && Math.abs(ra - rb) > minGap
      if (!aUpset && !bUpset) return false
    }

    return true
  })
}

export const searchMatches = filterMatches

/**
 * Xây dựng ma trận đối đầu N x N giữa các thành viên.
 * Trả về { matrix: { [id1]: { [id2]: { wins, losses, total } } }, neverMet: [{ p1, p2 }] }
 */
export function buildH2HMatrix(members, matches) {
  const matrix = {}
  const activeMembers = (members || []).filter((m) => m.active !== false)
  const ids = activeMembers.map((m) => m.id)

  ids.forEach((id1) => {
    matrix[id1] = {}
    ids.forEach((id2) => {
      if (id1 !== id2) {
        matrix[id1][id2] = { wins: 0, losses: 0, total: 0 }
      }
    })
  })

  ;(matches || []).forEach((m) => {
    const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
    const teamB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])
    if (!teamA.length || !teamB.length || !m.winnerTeam) return

    const aWon = m.winnerTeam === 'A'

    teamA.forEach((pA) => {
      teamB.forEach((pB) => {
        if (matrix[pA] && matrix[pA][pB]) {
          matrix[pA][pB].total += 1
          if (aWon) matrix[pA][pB].wins += 1
          else matrix[pA][pB].losses += 1
        }
        if (matrix[pB] && matrix[pB][pA]) {
          matrix[pB][pA].total += 1
          if (!aWon) matrix[pB][pA].wins += 1
          else matrix[pB][pA].losses += 1
        }
      })
    })
  })

  // Tìm các cặp thành viên chưa từng chạm trán đối đầu
  const neverMet = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const id1 = ids[i]
      const id2 = ids[j]
      if (matrix[id1] && matrix[id1][id2] && matrix[id1][id2].total === 0) {
        neverMet.push([id1, id2])
      }
    }
  }

  return { matrix, neverMet }
}

export function headToHeadMatrix(members, matches) {
  return buildH2HMatrix(members, matches).matrix
}

export function neverMetPairs(members, matches) {
  return buildH2HMatrix(members, matches).neverMet
}

/**
 * Tìm các cặp thành viên có chênh lệch thắng - thua nhiều nhất (Cặp lệch nhất - Screen DS3).
 */
export function topDisparatePairs(matrix, members, limit = 5) {
  if (!matrix) return []
  const activeMembers = (members || []).filter((m) => m.active !== false)
  const ids = activeMembers.map((m) => m.id)
  const pairs = []

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const p1 = ids[i]
      const p2 = ids[j]
      const cell = matrix[p1]?.[p2]
      if (cell && cell.total > 0) {
        const disparity = Math.abs(cell.wins - cell.losses)
        pairs.push({
          p1,
          p2,
          wins1: cell.wins,
          wins2: cell.losses,
          total: cell.total,
          disparity,
        })
      }
    }
  }

  return pairs
    .sort((a, b) => b.disparity - a.disparity || b.total - a.total)
    .slice(0, limit)
}

/**
 * Thống kê các cặp chưa từng gặp nhau kèm số buổi cùng tham gia (Screen DS3).
 */
export function neverMetWithSessionCount(neverMetList, { sessions = [], attendance = {}, matches = [] } = {}, limit = 10) {
  if (!neverMetList || !neverMetList.length) return []

  const scoredPairs = neverMetList.map((item) => {
    const id1 = Array.isArray(item) ? item[0] : (item?.p1 || item?.id1)
    const id2 = Array.isArray(item) ? item[1] : (item?.p2 || item?.id2)
    if (!id1 || !id2) return null

    let commonSessionsCount = 0

    sessions.forEach((s) => {
      const att = attendance[s.id] || {}
      // Thành viên được coi là có mặt nếu attendance[id] !== false hoặc từng có match trong buổi đó
      const attended1 = att[id1] === true || att[id1] === 'yes' || (att[id1] !== false && att[id1] != null) || (s.participantIds && s.participantIds.includes(id1))
      const attended2 = att[id2] === true || att[id2] === 'yes' || (att[id2] !== false && att[id2] != null) || (s.participantIds && s.participantIds.includes(id2))

      let played1 = attended1
      let played2 = attended2
      if (!played1 || !played2) {
        matches.forEach((m) => {
          if (m.sessionId === s.id) {
            const keys = m.playerKeys || [...(m.teamA || []), ...(m.teamB || [])]
            if (keys.includes(id1)) played1 = true
            if (keys.includes(id2)) played2 = true
          }
        })
      }

      if (played1 && played2) {
        commonSessionsCount++
      }
    })

    return {
      p1: id1,
      p2: id2,
      commonSessionsCount,
    }
  }).filter(Boolean)

  // Sắp xếp các cặp cùng đi nhiều buổi nhất lên trước
  return scoredPairs
    .sort((a, b) => b.commonSessionsCount - a.commonSessionsCount)
    .slice(0, limit)
}

