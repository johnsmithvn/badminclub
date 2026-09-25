// Giao diện Phase 2 (Ghép cặp, Thể thức) render bằng component thật — xem _render.js.
import test from 'node:test'
import assert from 'node:assert/strict'
import { text, html, load, fakeActions, buttonTag, isDisabled } from './_render.js'
import { db, tour } from './fixture.js'
import { RULE_PRESETS } from '#lib/tournament/format.js'

const { default: PairingTab } = await load('#components/tournament/PairingTab.jsx')
const { default: FormatTab } = await load('#components/tournament/FormatTab.jsx')

// Đôi nam nữ: 2 nam + 2 nữ đăng ký; 1 cặp đã ghép (An + Cúc), 2 người chờ.
const xdTour = (evStatus = 'draft', p = {}) => tour({
  events: [{ id: 'e-xd', kind: 'xd', teamSize: 2, genderRule: 'mixed', status: evStatus }],
  entries: ['r1', 'r2', 'r3', 'r4'].map((id) => ({ eventId: 'e-xd', registrationId: id })),
  registrations: [
    { id: 'r1', playerId: 'm1', gender: 'nam', ratingSnapshot: 800, fee: 0, paid: true, status: 'registered' },
    { id: 'r2', playerId: 'm2', gender: 'nam', ratingSnapshot: 500, fee: 0, paid: true, status: 'registered' },
    { id: 'r3', playerId: 'm3', gender: 'nu', ratingSnapshot: 300, fee: 0, paid: true, status: 'registered' },
    { id: 'r4', playerId: 'm4', gender: 'nu', ratingSnapshot: 600, fee: 0, paid: true, status: 'registered' },
  ],
  teams: [{ id: 'tA', eventId: 'e-xd', pinned: true, drawNo: null, status: 'active' }],
  teamPlayers: [{ teamId: 'tA', eventId: 'e-xd', registrationId: 'r1' }, { teamId: 'tA', eventId: 'e-xd', registrationId: 'r3' }],
  ...p,
})
const props = (tr, extra = {}) => ({ tour: tr, event: tr.events[0], db, a: fakeActions(), canEdit: true, isMobile: false, ...extra })

test('ghép cặp: người chờ, cặp đã ghim, ô Cặp mới; chưa đủ 2 cặp thì chưa chốt được', () => {
  const s = text(PairingTab, props(xdTour()))
  assert.match(s, /Chưa có cặp 2/)
  assert.match(s, /Trần Bình/)
  assert.match(s, /Cặp 1 1100 Bỏ ghim/, 'cặp đã ghim hiện nút Bỏ ghim, tổng rating 800 + 300')
  assert.match(s, /Cặp mới/)
  assert.match(s, /Cần ít nhất 2 đội đủ người/)
  assert.ok(isDisabled(buttonTag(html(PairingTab, props(xdTour())), 'Chốt đội hình')), 'chưa đủ luật thì nút chốt khoá')
  assert.match(s, /Tự ghép/)
})

test('ghép cặp: 2 cặp đủ → hiện độ lệch và chốt được; đã chốt thì chỉ xem', () => {
  const two = xdTour('draft', {
    teams: [{ id: 'tA', eventId: 'e-xd', pinned: false }, { id: 'tB', eventId: 'e-xd', pinned: false }],
    teamPlayers: [['tA', 'r1'], ['tA', 'r3'], ['tB', 'r2'], ['tB', 'r4']].map(([teamId, registrationId]) => ({ teamId, registrationId, eventId: 'e-xd' })),
  })
  const s = text(PairingTab, props(two))
  assert.match(s, /Lệch 0 Cân/, '800+300 và 500+600 — bằng nhau')
  assert.match(s, /Mọi người đã có cặp/)
  assert.doesNotMatch(s, /Cần ít nhất/)
  assert.ok(!isDisabled(buttonTag(html(PairingTab, props(two)), 'Chốt đội hình')), 'đủ luật thì chốt được')

  const locked = text(PairingTab, props({ ...two, events: [{ ...two.events[0], status: 'drawn' }] }))
  assert.match(locked, /đã chốt đội hình\. Chỉ xem/)
  assert.match(locked, /Mở lại để sửa/)
  assert.doesNotMatch(locked, /Tự ghép|Xoá ghép|Chốt đội hình/, 'đã chốt mà còn nút sửa là bấm vào ăn lỗi trigger DB')
})

test('ghép cặp: nội dung đơn không ghép, chỉ chốt danh sách; không quyền thì không có nút', () => {
  const ms = tour({
    events: [{ id: 'e-ms', kind: 'ms', teamSize: 1, genderRule: 'male', status: 'draft' }],
    entries: [{ eventId: 'e-ms', registrationId: 'r1' }, { eventId: 'e-ms', registrationId: 'r2' }],
  })
  const s = text(PairingTab, props(ms))
  assert.match(s, /là nội dung đơn, không cần ghép cặp/)
  assert.match(s, /Chốt danh sách/)
  assert.doesNotMatch(text(PairingTab, props(xdTour(), { canEdit: false })), /Tự ghép|Chốt đội hình|Ghim/)
})

test('thể thức: mặc định theo quy chế; xem trước; thiếu bước nào thì nói bước đó', () => {
  const tr = xdTour()
  const s = text(FormatTab, props(tr))
  assert.match(s, /Thể thức · Đôi nam nữ/)
  assert.match(s, /Loại trực tiếp/)
  assert.match(s, /Chọn thể thức trước khi tạo lịch/, 'chưa lưu thể thức → nói đúng việc cần làm')

  const stage = { id: 's1', eventId: 'e-xd', seq: 1, type: 'knockout', status: 'pending', config: { thirdPlace: true, seeding: 'seed' },
    matchRule: RULE_PRESETS.r1x21, ruleOverrides: { final: RULE_PRESETS.r3x15, third: RULE_PRESETS.r3x15 } }
  const draft = text(FormatTab, props({ ...tr, stages: [stage] }))
  assert.match(draft, /Chốt đội hình ở bước 3 trước khi tạo lịch/)
  assert.match(draft, /Cần ít nhất 2 đội đủ người để xem trước/)
})

test('thể thức: đủ đội + đã chốt → xem trước đúng số trận, tạo lịch được; đã có lịch thì khoá luật', () => {
  const teams = Array.from({ length: 5 }, (_, i) => ({ id: 't' + i, eventId: 'e-md', pinned: false, drawNo: null }))
  const regs = Array.from({ length: 10 }, (_, i) => ({ id: 'q' + i, playerId: 'm1', gender: 'nam', ratingSnapshot: 400 + i, fee: 0, paid: true, status: 'registered' }))
  const base = tour({
    events: [{ id: 'e-md', kind: 'md', teamSize: 2, genderRule: 'male', status: 'drawn' }],
    registrations: regs,
    entries: regs.map((r) => ({ eventId: 'e-md', registrationId: r.id })),
    teams,
    teamPlayers: regs.map((r, i) => ({ teamId: 't' + Math.floor(i / 2), eventId: 'e-md', registrationId: r.id })),
    stages: [{ id: 's1', eventId: 'e-md', seq: 1, type: 'knockout', status: 'pending', config: { thirdPlace: true, seeding: 'seed' },
      matchRule: RULE_PRESETS.r1x30, ruleOverrides: { final: RULE_PRESETS.r3x15, third: RULE_PRESETS.r3x15 } }],
  })
  const s = text(FormatTab, props(base))
  assert.match(s, /Xem trước với 5 đội/)
  assert.match(s, /Tứ kết 1 sec 30 · chạm 1 trận/, '5 đội: 3 đội được miễn tứ kết')
  assert.match(s, /Chung kết 3 sec 15 2?1 trận/)
  assert.match(s, /3 đội được miễn vòng đầu/)
  assert.match(s, /Tổng số trận 5/, '1 TK + 2 BK + CK + 3-4')
  const ready = html(FormatTab, props(base))
  assert.ok(buttonTag(ready, 'Tạo lịch thi đấu') && !isDisabled(buttonTag(ready, 'Tạo lịch thi đấu')), 'đủ điều kiện thì tạo lịch được')
  assert.ok(!isDisabled(buttonTag(ready, '3 sec 21 · cách 2')), 'chưa có lịch thì đổi luật được')

  const slot = { ...base, stages: [{ ...base.stages[0], config: { thirdPlace: true, seeding: 'slot' } }] }
  assert.match(text(FormatTab, props(slot)), /Bốc thăm trước khi tạo lịch/)

  const done = { ...base, stages: [{ ...base.stages[0], status: 'running' }], matches: [
    { id: 'x1', eventId: 'e-md', status: 'ready' }, { id: 'x2', eventId: 'e-md', status: 'bye' }] }
  const d = text(FormatTab, props(done))
  assert.match(d, /Đã có lịch thi đấu — 1 trận/, 'trận bye không tính')
  assert.match(d, /luật đã chép vào từng trận/)
  assert.match(d, /Làm lại lịch/)
  assert.ok(isDisabled(buttonTag(html(FormatTab, props(done)), '3 sec 21 · cách 2')), 'đã có lịch: nút luật phải khoá')
})

test('bốc thăm: đã chốt + đủ số → danh sách theo Đ1, Đ2… và có hướng dẫn đổi chỗ', () => {
  const regs = Array.from({ length: 4 }, (_, i) => ({ id: 'q' + i, playerId: 'm' + (i + 1), gender: 'nam', ratingSnapshot: 400, fee: 0, paid: true, status: 'registered' }))
  const tr = tour({
    events: [{ id: 'e-ms', kind: 'ms', teamSize: 1, genderRule: 'male', status: 'drawn' }],
    registrations: regs,
    entries: regs.map((r) => ({ eventId: 'e-ms', registrationId: r.id })),
    teams: regs.map((r, i) => ({ id: 't' + i, eventId: 'e-ms', drawNo: 4 - i })),
    teamPlayers: regs.map((r, i) => ({ teamId: 't' + i, eventId: 'e-ms', registrationId: r.id })),
    stages: [{ id: 's1', eventId: 'e-ms', seq: 1, type: 'knockout', status: 'pending', config: { thirdPlace: false, seeding: 'slot' },
      matchRule: RULE_PRESETS.r1x21, ruleOverrides: {} }],
  })
  const s = text(FormatTab, props(tr))
  assert.match(s, /Bấm một đội rồi bấm đội khác để đổi chỗ/)
  assert.match(s, /Đ1 Phạm Dung Đ2 Lê Thị Cúc Đ3 Trần Bình Đ4 Nguyễn Văn An/, 'xếp theo số bốc thăm')
  const locked = text(FormatTab, props({ ...tr, stages: [{ ...tr.stages[0], status: 'running' }] }))
  assert.doesNotMatch(locked, /đổi chỗ/, 'đã có lịch — đổi chỗ phải làm lại lịch trước')
})
