/**
 * @file links.js
 * Liên kết giữa các giai đoạn: lấy thứ hạng vòng bảng (final_rank) đẩy sang vòng Knockout.
 * Thuần: không React, không Supabase.
 */

/**
 * Lấy danh sách đội tham dự giai đoạn sau từ liên kết stage_links và thứ hạng vòng bảng.
 * Nguyên tắc chéo nhánh (A1–B2) và xoay nửa nhánh G/2 khi có >= 3 bảng:
 * đảm bảo 2 đội cùng bảng rơi vào 2 nửa nhánh khác nhau (chỉ có thể gặp lại nhau ở Chung kết).
 *
 * @param {object} params
 * @param {object} params.link  tournament_stage_links ({ fromStageId, toStageId, ranks })
 * @param {Array<object>} params.groups  Danh sách tournament_groups của giai đoạn trước, sắp theo seq
 * @param {Array<object>} params.groupTeams  Danh sách tournament_group_teams có finalRank
 * @returns {{ entrants: Array<{ id: string, seed: number }>, error: string|null }}
 */
export function entrantsFromLinks({ link, groups, groupTeams }) {
  if (!link || !Array.isArray(link.ranks) || !link.ranks.length) {
    return { entrants: [], error: 'tournament.err.invalidLink' }
  }

  const ranks = link.ranks // ví dụ [1, 2] hoặc [3]
  const sortedGroups = [...groups].sort((a, b) => (a.seq || 0) - (b.seq || 0))
  const G = sortedGroups.length

  if (G === 0) return { entrants: [], error: 'tournament.err.noGroups' }

  // Kiểm tra tất cả các đội cần lấy đã có final_rank chưa
  const teamsByRankAndGroup = {}
  ranks.forEach((r) => { teamsByRankAndGroup[r] = {} })

  for (const gt of groupTeams) {
    if (gt.finalRank && ranks.includes(gt.finalRank)) {
      teamsByRankAndGroup[gt.finalRank][gt.groupId] = gt.teamId
    }
  }

  // Bảng có đủ đội cho hạng đó mà chưa có final_rank = chưa chốt → lỗi.
  // Bảng ít đội hơn hạng cần lấy (7 đội chia 4+3, nhánh phụ lấy hạng 4) → bảng đó không góp đội, không lỗi.
  const sizeOf = (gid) => groupTeams.filter((gt) => gt.groupId === gid).length
  for (const r of ranks) {
    for (const g of sortedGroups) {
      if (!teamsByRankAndGroup[r][g.id] && sizeOf(g.id) >= r) {
        return { entrants: [], error: 'tournament.err.rankNotAssigned' }
      }
    }
  }

  const entrants = []
  let currentSeed = 1
  const push = (r, g) => {
    const id = teamsByRankAndGroup[r][g.id]
    if (id) entrants.push({ id, seed: currentSeed++ })
  }

  // Nếu chỉ lấy 1 hạng (ví dụ chỉ lấy Hạng 1 hoặc chỉ lấy Hạng 3 nhánh phụ):
  if (ranks.length === 1) {
    sortedGroups.forEach((g) => push(ranks[0], g))
    return entrants.length >= 2 ? { entrants, error: null } : { entrants: [], error: 'tournament.err.rankNotAssigned' }
  }

  // Nếu lấy Hạng 1 và Hạng 2 (hoặc nhiều hạng):
  // Hạng 1 các bảng A, B, C, D... lấy seed 1..G
  sortedGroups.forEach((g) => push(ranks[0], g))

  // Hạng 2 các bảng:
  // Với G = 2: shift = 0 -> A2 lấy seed 3, B2 lấy seed 4. Bracket [1,4,2,3] -> BK1: 1-4 (A1 vs B2), BK2: 2-3 (B1 vs A2)
  // Với G >= 3: shift = Math.floor(G / 2) -> xoay nửa bảng, đảm bảo 2 đội cùng bảng rơi vào 2 nửa nhánh khác nhau.
  //   G = 3 (không xoay thì C1 gặp C2 ngay vòng đầu): A1–bye, B2–C2 | B1–bye, C1–A2.
  if (ranks.length >= 2) {
    const shift = G >= 3 ? Math.floor(G / 2) : 0
    for (let i = 0; i < G; i++) push(ranks[1], sortedGroups[(i + shift) % G])
  }

  // Nếu có thêm Hạng 3 trở lên
  for (let rIdx = 2; rIdx < ranks.length; rIdx++) sortedGroups.forEach((g) => push(ranks[rIdx], g))

  return entrants.length >= 2 ? { entrants, error: null } : { entrants: [], error: 'tournament.err.rankNotAssigned' }
}
