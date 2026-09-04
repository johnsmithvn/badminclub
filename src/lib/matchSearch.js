// Logic tìm kiếm trận đấu, lọc đối đầu & ma trận thi đấu (H2H Matrix) — Pure functions.

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
      const isCloseSet = sets.some((s) => s && s[0] != null && s[1] != null && Math.abs(s[0] - s[1]) <= 3)
      const isThreeSets = sets.filter((s) => s && s[0] + s[1] > 0).length >= 3
      if (!isCloseSet && !isThreeSets) return false
    } else if (quality === 'upset') {
      const ra = m.initialRatingA || 0
      const rb = m.initialRatingB || 0
      const winTeam = m.winnerTeam
      const aLower = ra < rb
      const bLower = rb < ra
      const aUpset = aLower && winTeam === 'A' && Math.abs(ra - rb) > 100
      const bUpset = bLower && winTeam === 'B' && Math.abs(ra - rb) > 100
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
