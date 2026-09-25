// Giao diện vòng bảng (Phase 4) render bằng component thật — xem _render.js.
import test from 'node:test'
import assert from 'node:assert/strict'
import { text, load } from './_render.js'
import { db, tour } from './fixture.js'

const { default: OverviewTab } = await load('#components/tournament/OverviewTab.jsx')
const { GroupBoard } = await load('#components/tournament/BracketBoard.jsx')
const { stageGroups } = await import('#lib/tournament/standings.js')

const noop = () => {}
const R21 = { sets: 1, points: 21, winBy2: true, cap: 30 }
const m = (id, round, slot, a, b, sets, winner) => ({
  id, stageId: 's1', groupId: 'gA', round, slot, roundKind: 'group', teamAId: a, teamBId: b, rule: R21,
  status: winner ? 'done' : 'ready', sets: sets || [], winner: winner || null, nextMatchId: null, loserNextMatchId: null,
})

// 3 đội 1 người (Nguyễn Văn An, Trần Bình, Lê Thị Cúc) — vòng khép kín 21-15 ba trận: hoà tuyệt đối.
function rrTour({ stageStatus = 'running', finalRanks = {} } = {}) {
  return tour({
    stages: [
      { id: 's1', eventId: 'e-md', seq: 1, type: 'round_robin', status: stageStatus, config: { numGroups: 1, advancePerGroup: 2, legs: 1 }, matchRule: R21 },
      { id: 's2', eventId: 'e-md', seq: 2, type: 'knockout', status: 'pending', config: { seeding: 'rank' }, matchRule: R21 },
    ],
    stageLinks: [{ id: 'l1', fromStageId: 's1', toStageId: 's2', ranks: [1, 2] }],
    teams: ['tA', 'tB', 'tC'].map((id) => ({ id, eventId: 'e-md' })),
    teamPlayers: [
      { teamId: 'tA', eventId: 'e-md', registrationId: 'r1' },
      { teamId: 'tB', eventId: 'e-md', registrationId: 'r2' },
      { teamId: 'tC', eventId: 'e-md', registrationId: 'r3' },
    ],
    groups: [{ id: 'gA', stageId: 's1', label: 'A', seq: 1 }],
    groupTeams: ['tA', 'tB', 'tC'].map((id, i) => ({ groupId: 'gA', teamId: id, seedInGroup: i + 1, finalRank: finalRanks[id] ?? null })),
    matches: [
      m('m1', 0, 0, 'tA', 'tB', [[21, 15]], 'A'),
      m('m2', 1, 0, 'tB', 'tC', [[21, 15]], 'A'),
      m('m3', 2, 0, 'tC', 'tA', [[21, 15]], 'A'),
    ],
  })
}

const overview = (tr, canEdit = true) => text(OverviewTab, {
  tour: tr, db, a: {}, event: tr.events[0], onGo: noop, canEdit, isMobile: false, onOpenBracket: noop,
})

test('Tổng quan: bảng xếp hạng có đội (ghép từ groupTeams), hoà tuyệt đối thì mời BTC xếp rồi chốt', () => {
  const s = overview(rrTour())
  assert.match(s, /Bảng A/)
  assert.match(s, /Nguyễn Văn An/)
  assert.match(s, /Trần Bình/)
  assert.match(s, /Lê Thị Cúc/)
  assert.match(s, /bấm ↑ để xếp lại/)
  assert.match(s, /Chốt giai đoạn/)

  const viewer = overview(rrTour(), false)
  assert.doesNotMatch(viewer, /Chốt giai đoạn|bấm ↑/, 'không có quyền → không nút chốt, không nút xếp')
})

test('Tổng quan: đã chốt → hiện đúng hạng đã ghi và nút tạo lịch nhánh sau', () => {
  const s = overview(rrTour({ stageStatus: 'done', finalRanks: { tC: 1, tA: 2, tB: 3 } }))
  assert.match(s, /Giai đoạn đã chốt/)
  assert.match(s, /Tạo lịch Vòng loại trực tiếp/)
  assert.ok(s.indexOf('Lê Thị Cúc') < s.indexOf('Nguyễn Văn An') && s.indexOf('Nguyễn Văn An') < s.indexOf('Trần Bình'),
    'thứ tự theo final_rank đã ghi, không tính lại')
})

test('Trang nhánh: vòng bảng hiện theo bảng và lượt; đã chốt thì không còn nút sửa / hoàn tác', () => {
  const tr = rrTour()
  const props = { groups: stageGroups(tr, 's1'), tour: tr, db, canEdit: true, isMobile: false, onScore: noop, onUndo: noop, onEdit: noop, onQuick: noop }
  const open = text(GroupBoard, { ...props, locked: false })
  assert.match(open, /Bảng A/)
  assert.match(open, /Lượt 1.*Lượt 2.*Lượt 3/)
  assert.match(open, /Sửa điểm|Sửa/)

  const locked = text(GroupBoard, { ...props, locked: true })
  assert.doesNotMatch(locked, /Hoàn tác|Sửa điểm/)
})
