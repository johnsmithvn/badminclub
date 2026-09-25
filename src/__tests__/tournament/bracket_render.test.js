// Giao diện Phase 3 (nhánh đấu, bảng ghi điểm) render bằng component thật — xem _render.js.
import test from 'node:test'
import assert from 'node:assert/strict'
import { text, html, load, buttonTag, isDisabled } from './_render.js'
import { db, tour as baseTour } from './fixture.js'
import { buildKnockout } from '#lib/tournament/bracket.js'
import { applyCommit } from '#lib/tournament/advance.js'
import { koRounds } from '#lib/tournament/bracketView.js'
import { RULE_PRESETS } from '#lib/tournament/format.js'

const { default: BracketBoard } = await load('#components/tournament/BracketBoard.jsx')
const { default: TourModuleNav } = await load('#components/tournament/TourModuleNav.jsx')
const { ScoreDialog, EditScoreDialog, UndoDialog } = await load('#components/tournament/MatchDialogs.jsx')

// Đôi nam 4 đội (BK, CK, 3-4) — mỗi đội 1 người cho gọn; tên lấy từ db.members qua registration.
const PEOPLE = ['m1', 'm2', 'm3', 'm4']
function setup(play = []) {
  let k = 0
  const stage = { id: 's1', matchRule: RULE_PRESETS.r1x30, ruleOverrides: { final: RULE_PRESETS.r3x15, third: RULE_PRESETS.r3x15 }, config: { thirdPlace: true } }
  let matches = buildKnockout({ stage, entrants: PEOPLE.map((_, i) => ({ id: 'T' + (i + 1), seed: i + 1 })), newId: () => 'x' + ++k })
    .map((m) => ({ ...m, eventId: 'e-md' }))
  for (const [kind, slot, sets, winner, status = 'done', note = null] of play) {
    const m = matches.find((x) => x.roundKind === kind && x.slot === slot)
    const r = applyCommit(matches, { matchId: m.id, sets, winner, status, note })
    assert.equal(r.error, null, r.error)
    matches = r.matches
  }
  const tr = baseTour({
    registrations: PEOPLE.map((p, i) => ({ id: 'r' + i, playerId: p, gender: 'nam', ratingSnapshot: 500, fee: 0, paid: true, status: 'registered' })),
    teams: PEOPLE.map((_, i) => ({ id: 'T' + (i + 1), eventId: 'e-md' })),
    teamPlayers: PEOPLE.map((_, i) => ({ teamId: 'T' + (i + 1), eventId: 'e-md', registrationId: 'r' + i })),
    stages: [{ id: 's1', eventId: 'e-md', seq: 1, status: 'running', ...stage }],
    matches,
  })
  return { tr, view: koRounds(matches, 's1'), m: (kind, slot = 0) => matches.find((x) => x.roundKind === kind && x.slot === slot) }
}
const noop = () => {}
const board = (tr, view, canEdit = true) => ({ view, tour: tr, db, canEdit, isMobile: false, onScore: noop, onUndo: noop, onEdit: noop, onQuick: noop })

test('nhánh mới: cột vòng, luật từng vòng, mã trận, chờ đội; nút GHI ĐIỂM chỉ ở trận sẵn sàng', () => {
  const { tr, view } = setup()
  const s = text(BracketBoard, board(tr, view))
  assert.match(s, /Bán kết 2 trận 1 sec 30 · chạm/)
  assert.match(s, /Chung kết 1 trận 3 sec 15/)
  assert.match(s, /BK1 GHI ĐIỂM 1 Nguyễn Văn An .*4 Phạm Dung/, 'hạt giống 1 gặp 4')
  assert.match(s, /CK Chờ đội Chờ đội/)
  assert.match(s, /Nhà vô địch Chờ chung kết/)
  const h = html(BracketBoard, board(tr, view))
  assert.equal((h.match(/>GHI ĐIỂM</g) || []).length, 2, 'chỉ 2 bán kết đủ đội — CK / 3-4 chưa ghi được')
  assert.match(h, /data-k="x1:A"/, 'ô đội có data-k để hiệu ứng bay tìm ra')
  assert.match(h, /data-k="champ"/)
  assert.doesNotMatch(html(BracketBoard, board(tr, view, false)), /GHI ĐIỂM|<input/, 'thành viên thường chỉ xem')
})

test('trận 1 set có ô nhập nhanh; trận 3 set thì không (phải mở bảng điểm)', () => {
  const { tr, view } = setup([['sf', 0, [[30, 20]], 'A'], ['sf', 1, [[30, 25]], 'A']])
  const h = html(BracketBoard, board(tr, view))
  const ck = h.slice(h.indexOf('data-card="' + view.final.id + '"'))
  assert.doesNotMatch(ck.slice(0, ck.indexOf('data-card=', 20)), /<input/, 'chung kết 3 sec không nhập nhanh một ô')
})

test('sau bán kết: đội thắng lên CK, thua xuống 3-4, điểm hiện trên thẻ, có Sửa điểm + Hoàn tác', () => {
  const { tr, view } = setup([['sf', 0, [[30, 20]], 'A'], ['sf', 1, [[27, 30]], 'B']])
  const s = text(BracketBoard, board(tr, view))
  assert.match(s, /BK1 Sửa điểm Hoàn tác 1 Nguyễn Văn An 30 4 Phạm Dung 20/)
  assert.match(s, /CK GHI ĐIỂM Nguyễn Văn An Lê Thị Cúc/)
  assert.match(s, /Phạm Dung Trần Bình/, '3-4: thua BK1 bên A, thua BK2 bên B')
})

test('xong chung kết: có vô địch; trận đã có trận sau đánh thì không còn nút Hoàn tác', () => {
  const { tr, view } = setup([['sf', 0, [[30, 20]], 'A'], ['sf', 1, [[27, 30]], 'B'], ['final', 0, [[15, 10], [15, 12]], 'A'],
    ['third', 1, [], 'B', 'walkover', 'vắng']])
  const s = text(BracketBoard, board(tr, view))
  assert.match(s, /Nhà vô địch Nguyễn Văn An/)
  assert.match(s, /CK Sửa điểm Hoàn tác .*15 15 .*10 12/)
  assert.match(s, /3-4 Xử thua Hoàn tác/, 'xử thua: không có Sửa điểm (không có điểm để sửa)')
  const h = html(BracketBoard, board(tr, view))
  const bk1 = h.slice(h.indexOf('data-card="' + view.rounds[0].matches[0].id + '"'), h.indexOf('data-card="' + view.rounds[0].matches[1].id + '"'))
  assert.doesNotMatch(bk1, />Hoàn tác</, 'CK đã đánh — hoàn tác BK1 là xoá trận người ta đã đánh')
})

test('bảng ghi điểm: tên hai đội, 0-0, ba chế độ; chưa có đội thắng thì nút xác nhận khoá', () => {
  const { tr, m } = setup()
  const props = { match: m('sf'), tour: tr, db, onClose: noop, onCommit: noop, onStart: noop }
  const s = text(ScoreDialog, props)
  assert.match(s, /BK1 · Đôi nam/)
  assert.match(s, /1 sec 30 · chạm/)
  assert.match(s, /Ghi từng quả Nhập tỷ số Xử thua \/ Bỏ cuộc/)
  assert.match(s, /Nguyễn Văn An .*0 Chạm để \+1.*Phạm Dung .*0 Chạm để \+1/)
  assert.match(s, /Set 1 đang đánh/)
  assert.ok(isDisabled(buttonTag(html(ScoreDialog, props), 'Xác nhận · đưa đội thắng lên')))
})

test('sửa điểm: nạp điểm cũ, bắt ghi lý do; hoàn tác: bắt ghi lý do', () => {
  const { tr, m } = setup([['sf', 0, [[30, 20]], 'A']])
  const e = html(EditScoreDialog, { match: m('sf'), tour: tr, db, onClose: noop, onSave: noop })
  assert.match(e, /Sửa điểm BK1/)
  assert.match(e, /value="30"/)
  assert.match(e, /value="20"/)
  assert.ok(isDisabled(buttonTag(e, 'Lưu')), 'chưa có lý do thì không lưu được — nhật ký sửa phải có lý do')
  const u = html(UndoDialog, { match: m('sf'), onClose: noop, onUndo: noop })
  assert.match(u, /Hoàn tác BK1/)
  assert.ok(isDisabled(buttonTag(u, 'Hoàn tác')))
})

test('thanh module: bước hiện tại, chưa có lịch thì Nhánh đấu khoá, nhiều nội dung thì có chọn', () => {
  const evs = [{ id: 'a', kind: 'md' }, { id: 'b', kind: 'xd' }]
  const hub = html(TourModuleNav, { active: 'hub', events: [], onHub: noop, onBracket: noop })
  assert.ok(isDisabled(buttonTag(hub, 'Nhánh đấu')), 'chưa nội dung nào có lịch — vào nhánh chỉ thấy trang trống')
  const br = text(TourModuleNav, { active: 'bracket', events: evs, eventId: 'a', onHub: noop, onBracket: noop })
  assert.match(br, /1 Tổng quan & đăng ký 2 Nhánh đấu/)
  assert.match(br, /Đôi nam .*Đôi nam nữ/)
  assert.doesNotMatch(text(TourModuleNav, { active: 'hub', events: evs, eventId: 'a', onHub: noop, onBracket: noop }), /Đôi nam nữ/,
    'ở Hub không hiện ô chọn nội dung — Hub đã có hàng thẻ nội dung')
})

const { default: OverviewTab } = await load('#components/tournament/OverviewTab.jsx')

test('bảng ghi điểm: chọn sân của giải (chỉ trận chưa xong)', () => {
  const { tr, m } = setup()
  const props = { match: m('sf'), tour: tr, db, onClose: noop, onCommit: noop, onStart: noop, onCourt: noop }
  assert.match(text(ScoreDialog, props), /Sân Sân 20 Sân 21/)
  assert.doesNotMatch(text(ScoreDialog, { ...props, tour: { ...tr, courtLabels: [] } }), /Sân 20/)
})

test('tổng quan khi giải chạy: trận kế tiếp của cả giải, tiến độ; trận xong không còn trong hàng chờ', () => {
  const { tr } = setup([['sf', 0, [[30, 20]], 'A']])
  const s = text(OverviewTab, { tour: tr, db, onGo: noop, canEdit: true, onOpenBracket: noop })
  assert.match(s, /Đang đánh & kế tiếp 1\/4 trận/)
  assert.match(s, /BK2 ĐN Trần Bình – Lê Thị Cúc Mở nhánh/)
  assert.doesNotMatch(s, /BK1/, 'BK1 đã xong — không còn là trận chờ')
  assert.match(s, /Trước khi bắt đầu/)
  assert.doesNotMatch(text(OverviewTab, { tour: { ...tr, matches: [] }, db, onGo: noop, canEdit: true, onOpenBracket: noop }), /Đang đánh & kế tiếp/,
    'chưa có lịch thì không có khối trận')
})
