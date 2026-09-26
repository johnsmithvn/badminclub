// Giao diện Phase 2 (Ghép cặp) render bằng component thật — xem _render.js.
// Thể thức (chọn mẫu, luật, bốc thăm, tạo lịch) không còn là component riêng — đã gộp hết vào FlowCanvas
// (2026-09-26, xem format_render lịch sử git nếu cần bản cũ) — coverage nằm ở handoff_render.test.js/canvas.test.js.
import test from 'node:test'
import assert from 'node:assert/strict'
import { text, html, load, fakeActions, buttonTag, isDisabled } from './_render.js'
import { db, tour } from './fixture.js'

const { default: PairingTab } = await load('#components/tournament/PairingTab.jsx')

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
  assert.ok(!isDisabled(buttonTag(html(PairingTab, props(two)), 'Chốt &amp; tạo lịch · loại trực tiếp')),
    'một bấm: chốt + tạo lịch; chưa chọn thể thức thì nói rõ sẽ dùng loại trực tiếp')

  const locked = text(PairingTab, props({ ...two, events: [{ ...two.events[0], status: 'drawn' }] }))
  assert.match(locked, /đã chốt đội hình\. Chỉ xem/)
  assert.match(locked, /Tạo lịch · loại trực tiếp/, 'đã chốt mà chưa có lịch → tạo lịch ngay tại đây')
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
