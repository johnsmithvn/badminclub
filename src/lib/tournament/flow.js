/**
 * @file flow.js
 * Sơ đồ thi đấu (handoff "Giải đấu · sơ đồ tự do", plan §7 Phase 6) dạng pipeline CHỈ XEM:
 * đội → giai đoạn 1 → (link: hạng nào đi đâu) → giai đoạn sau → người thắng. Thuần: không React, không Supabase.
 */

import { groupSizes } from '#lib/tournament/format.js'
import { progressOf } from '#lib/tournament/bracketView.js'
import { eventTeams } from '#lib/tournament/pairing.js'

const hasResult = (m) => m.status === 'done' || m.status === 'walkover' || m.status === 'retired'

/**
 * Key i18n tên giai đoạn (khi BTC không đặt tên riêng `title`) — mọi màn gọi cùng một kiểu:
 * vòng bảng · một nhánh loại duy nhất = "Vòng loại trực tiếp" · nhiều nhánh sau vòng bảng: nhánh đầu = chính,
 * các nhánh sau = phụ.
 */
export function stageLabelKey(stage, eventStages) {
  if (stage.type === 'round_robin') return 'tournament.stage.groups'
  const kos = eventStages.filter((s) => s.type === 'knockout' && s.seq > 1).sort((a, b) => a.seq - b.seq)
  if (stage.seq === 1 || kos.length < 2) return 'tournament.format.koStage'
  return kos[0].id === stage.id ? 'tournament.stage.main' : 'tournament.stage.plate'
}

/**
 * Người thắng của giai đoạn — chỉ khi đã phân định thật, không đoán:
 *   loại trực tiếp: đội thắng trận chung kết;
 *   vòng tròn 1 bảng: hạng 1 đã CHỐT (`final_rank`). Nhiều bảng không có "một người thắng" → null.
 */
function winnerOf(tour, stage) {
  if (stage.type === 'knockout') {
    const f = tour.matches.find((m) => m.stageId === stage.id && m.roundKind === 'final' && hasResult(m))
    return f ? (f.winner === 'A' ? f.teamAId : f.teamBId) : null
  }
  const groups = (tour.groups || []).filter((g) => g.stageId === stage.id)
  if (stage.status !== 'done' || groups.length !== 1) return null
  return (tour.groupTeams || []).find((gt) => gt.groupId === groups[0].id && gt.finalRank === 1)?.teamId || null
}

/**
 * Sơ đồ của một nội dung.
 * @returns {null | {
 *   teams: number,
 *   first: Node,
 *   next: Array<Node & { ranks: number[] }>,   // các giai đoạn nhận đội từ `first` qua link, theo seq
 * }}
 * Node = { id, seq, type, labelKey, status, teams, groups, matches: {done,total}, rule, winner }
 *   `teams` của giai đoạn chưa có lịch = số đội DỰ KIẾN (từ số bảng / số đội đi tiếp).
 */
export function flowOf(tour, event) {
  const stages = tour.stages.filter((s) => s.eventId === event.id).sort((x, y) => x.seq - y.seq)
  if (!stages.length) return null
  const n = eventTeams(tour, event.id).filter((x) => x.full).length
  const [first] = stages
  const links = (tour.stageLinks || []).filter((l) => l.fromStageId === first.id)

  const node = (s, expected) => {
    const own = tour.matches.filter((m) => m.stageId === s.id)
    const groups = (tour.groups || []).filter((g) => g.stageId === s.id)
    const inGroups = new Set((tour.groupTeams || []).filter((gt) => groups.some((g) => g.id === gt.groupId)).map((gt) => gt.teamId))
    const inFirstRound = new Set(own.filter((m) => m.round === 0).flatMap((m) => [m.teamAId, m.teamBId]).filter(Boolean))
    const actual = s.type === 'round_robin' ? inGroups.size : inFirstRound.size
    return {
      id: s.id,
      seq: s.seq,
      type: s.type,
      labelKey: stageLabelKey(s, stages),
      title: s.title || '',
      status: s.status,
      teams: s.status === 'pending' ? expected : actual,
      groups: s.type === 'round_robin' ? (groups.length || s.config?.numGroups || 1) : 0,
      matches: progressOf(own),
      rule: s.matchRule,
      winner: winnerOf(tour, s),
    }
  }

  // Số đội dự kiến vào một nhánh = số (bảng, hạng) có thật: bảng k đội chỉ có hạng 1..k.
  // Đúng cho mọi sơ đồ (mẫu lẫn tự dựng, bao nhiêu nhánh cũng được).
  const sizes = groupSizes(n, first.config?.numGroups || 1)
  const expected = (ranks) => sizes.reduce((sum, k) => sum + ranks.filter((r) => r <= k).length, 0)

  return {
    teams: n,
    first: node(first, n),
    next: links
      .map((l) => {
        const s = stages.find((x) => x.id === l.toStageId)
        return s && { ...node(s, expected(l.ranks)), ranks: [...l.ranks].sort((a, b) => a - b) }
      })
      .filter(Boolean)
      .sort((x, y) => x.seq - y.seq),
  }
}

/**
 * Nội dung đã có kết quả cuối: mọi giai đoạn CUỐI (không đẩy đội đi đâu nữa) đã phân định — nhánh loại có
 * người thắng chung kết, vòng tròn đã chốt giai đoạn. Chưa chọn thể thức = chưa xong.
 */
export function eventDone(tour, event) {
  const flow = flowOf(tour, event)
  if (!flow) return false
  const ends = flow.next.length ? flow.next : [flow.first]
  return ends.every((n) => (n.type === 'round_robin' ? n.status === 'done' : Boolean(n.winner)))
}

/** Cả giải xong: có ít nhất một nội dung và nội dung nào cũng xong. */
export const tourDone = (tour) => tour.events.length > 0 && tour.events.every((e) => eventDone(tour, e))
