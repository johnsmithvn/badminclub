// Đợt bám handoff — giao diện render bằng component thật (xem _render.js): chữ + nút đúng chỗ, không vỡ lúc chạy.
import test from 'node:test'
import assert from 'node:assert/strict'
import { text, html, load, fakeActions, buttonTag, isDisabled } from './_render.js'
import { db, tour } from './fixture.js'

const { default: PairingTab } = await load('#components/tournament/PairingTab.jsx')
const { default: EventBar } = await load('#components/tournament/EventBar.jsx')
const { default: OverviewTab } = await load('#components/tournament/OverviewTab.jsx')
const { default: FormatTab } = await load('#components/tournament/FormatTab.jsx')
const { default: RecommendDialog } = await load('#components/tournament/RecommendDialog.jsx')
const { default: FlowCanvas } = await load('#components/tournament/FlowCanvas.jsx')
const { default: BracketBoard } = await load('#components/tournament/BracketBoard.jsx')
const { BracketSetup } = await load('#pages/TournamentBracket.jsx')
const { RuleField } = await load('#components/tournament/TourBits.jsx')
const { koRounds } = await import('#lib/tournament/bracketView.js')
const { buildKnockout } = await import('#lib/tournament/bracket.js')

const noop = () => {}
const R21 = { sets: 1, points: 21, winBy2: true, cap: 30 }
const R3x15 = { sets: 3, points: 15, winBy2: false, cap: 15 }

// Đôi nam 8 người = 4 cặp đủ; cặp t0 chênh trình lớn; có 1 khách.
function mdTour(p = {}) {
  const regs = Array.from({ length: 8 }, (_, i) => ({
    id: 'r' + i, playerId: i < 5 ? ['m1', 'm2', 'm3', 'm4', 'm5'][i] : 'g' + i, playerType: i === 7 ? 'guest' : 'member',
    gender: 'nam', ratingSnapshot: [800, 600, 560, 550, 540, 530, 520, 510][i], fee: 0, paid: true, status: 'registered',
  }))
  const teams = [0, 1, 2, 3].map((k) => ({ id: 't' + k, eventId: 'e-md', pinned: false, drawNo: k + 1 }))
  return tour({
    events: [{ id: 'e-md', kind: 'md', teamSize: 2, genderRule: 'male', status: 'draft' }],
    registrations: regs,
    entries: regs.map((r) => ({ eventId: 'e-md', registrationId: r.id })),
    teams,
    teamPlayers: regs.map((r, i) => ({ teamId: 't' + Math.floor(i / 2), eventId: 'e-md', registrationId: r.id })),
    guests: [{ id: 'g7', name: 'Khách G', gender: 'nam' }],
    ...p,
  })
}
const stage = (id, seq, type, p = {}) => ({ id, eventId: 'e-md', seq, type, status: 'pending', title: '', config: {}, matchRule: R21, ruleOverrides: {}, ...p })

test('ghép cặp: nhận xét từng cặp, cột So với TB tô vàng khi lệch nhiều', () => {
  const s = text(PairingTab, { tour: mdTour(), event: mdTour().events[0], db, a: fakeActions(), canEdit: true, isMobile: false })
  assert.match(s, /Chênh trình trong cặp 200 điểm; người yếu hơn sẽ bị nhắm/)
  assert.match(s, /Có khách: rating tự khai/)
  assert.match(s, /So với TB/)
  assert.match(s, /\+\d+/, 'cặp mạnh hơn trung bình có dấu +')
  assert.match(s, /vàng = lệch trung bình quá 40/)
})

test('thẻ nội dung: số khách + x/y cặp đủ', () => {
  const tr = mdTour()
  const s = text(EventBar, { tour: tr, value: 'e-md', onChange: noop, canEdit: true, isMobile: false, onAdd: noop, onDelete: noop })
  assert.match(s, /8 VĐV · 8 nam · 0 nữ · 1 khách · 4\/4 cặp đủ/)
})

test('tổng quan: nhánh thu nhỏ chưa có lịch hiện ô chờ "Nhất A / Nhì B"; có lịch hiện đội thật + nút mở nhánh', () => {
  const pending = mdTour({
    stages: [stage('rr', 1, 'round_robin', { config: { numGroups: 2 } }), stage('ko', 2, 'knockout', { config: { thirdPlace: false } })],
    stageLinks: [{ id: 'l', fromStageId: 'rr', toStageId: 'ko', ranks: [1, 2] }],
  })
  const s = text(OverviewTab, { tour: pending, db, a: fakeActions(), event: pending.events[0], onGo: noop, canEdit: true, isMobile: false, onOpenBracket: noop })
  assert.match(s, /Điền tự động khi vòng bảng xong/)
  assert.match(s, /Nhất A.*Nhì B/)

  const ko = stage('k1', 1, 'knockout', { status: 'running', config: { seeding: 'seed', thirdPlace: false } })
  let n = 0
  const matches = buildKnockout({ stage: ko, entrants: ['t0', 't1', 't2', 't3'].map((id, i) => ({ id, seed: i + 1 })), newId: () => 'm' + n++ })
    .map((m) => ({ ...m, eventId: 'e-md' }))
  const live = mdTour({ stages: [ko], matches })
  const s2 = text(OverviewTab, { tour: live, db, a: fakeActions(), event: live.events[0], onGo: noop, canEdit: true, isMobile: false, onOpenBracket: noop })
  assert.match(s2, /Mở nhánh đấu/)
  assert.match(s2, /Thắng trận BK1/, 'chung kết chờ người thắng bán kết')
})

test('thể thức: mẫu CLB, Lưu làm mẫu, Sửa trên sơ đồ tự do, Mỗi đội đá ít nhất', () => {
  const tr = mdTour({
    stages: [stage('rr', 1, 'round_robin', { config: { numGroups: 2 } })],
    templates: [{ id: 'tp', name: 'Mẫu 3 nhánh', graph: { stages: [{}, {}, {}], links: [] } }],
  })
  const s = text(FormatTab, { tour: tr, event: tr.events[0], db, a: fakeActions(), canEdit: true, isMobile: false, onOpenBracket: noop, onOpenFlow: noop })
  assert.match(s, /Mẫu 3 nhánh Mẫu CLB · 3 khối/)
  assert.match(s, /Sửa trên sơ đồ tự do/)
  assert.match(s, /Lưu làm mẫu CLB/)
  assert.match(s, /Mỗi đội đá ít nhất 1 trận/, '4 cặp chia 2 bảng × 2 → mỗi cặp 1 trận vòng bảng')
})

test('luật trận: có lựa chọn Tuỳ chỉnh; luật tự chỉnh mở sẵn ô nhập', () => {
  assert.match(text(RuleField, { value: R21, onChange: noop }), /Tuỳ chỉnh luật/)
  const custom = text(RuleField, { value: { sets: 3, points: 25, winBy2: true, cap: 30 }, onChange: noop })
  assert.match(custom, /Số sec .*Cách 2 .*Dùng luật này/)
})

test('gợi ý thể thức: danh sách phương án có nhãn; luật gợi ý + ô áp dụng', () => {
  const tr = tour({
    events: [{ id: 'e1', kind: 'md', teamSize: 2, genderRule: 'male', status: 'draft' }],
    teams: Array.from({ length: 8 }, (_, i) => ({ id: 'x' + i, eventId: 'e1' })),
    registrations: Array.from({ length: 16 }, (_, i) => ({ id: 'q' + i, playerId: 'm1', gender: 'nam', ratingSnapshot: 500, status: 'registered', fee: 0 })),
    teamPlayers: Array.from({ length: 16 }, (_, i) => ({ teamId: 'x' + Math.floor(i / 2), eventId: 'e1', registrationId: 'q' + i })),
  })
  const s = text(RecommendDialog, { tour: tr, onClose: noop, onApply: noop })
  assert.match(s, /KHUYÊN DÙNG/)
  assert.match(s, /NHANH NHẤT/)
  assert.match(s, /\d+ trận · ≥\d+ trận\/đội · \d+ phút sân/)
  assert.match(s, /Luật trận gợi ý/)
  assert.match(s, /Áp dụng cả luật gợi ý/)
})

test('canvas: lượt miễn trên khối nhánh, gợi ý kéo nền / cuộn, nút Chạy nhánh trên khối xuất phát', () => {
  const tr = mdTour({
    stages: [stage('rr', 1, 'round_robin', { config: { numGroups: 2 } }), stage('ko', 2, 'knockout', { config: { thirdPlace: true } })],
    stageLinks: [{ id: 'l', fromStageId: 'rr', toStageId: 'ko', ranks: [1] }],
    courtLabels: ['S1'],
  })
  const s = text(FlowCanvas, { tour: tr, event: tr.events[0], db, a: fakeActions(), onBack: noop, onOpenBracket: noop })
  assert.match(s, /Kéo nền để di chuyển · cuộn chuột để phóng/)
  assert.match(s, /Hạng 1 · 2 đội/)
  assert.match(s, /Chạy nhánh →/)
  assert.match(s, /Căn lại khung nhìn/)
})

test('trang nhánh: tên đội vòng đầu kéo được khi còn đổi chỗ; thiết lập sửa được → "Xong · tạo lại nhánh"; đã đấu → chỉ đọc', () => {
  const ko = stage('k1', 1, 'knockout', { status: 'running', config: { seeding: 'seed', thirdPlace: true }, ruleOverrides: { final: R3x15, third: R3x15 } })
  let n = 0
  const matches = buildKnockout({ stage: ko, entrants: ['t0', 't1', 't2', 't3'].map((id, i) => ({ id, seed: i + 1 })), newId: () => 'm' + n++ })
    .map((m) => ({ ...m, eventId: 'e-md' }))
  const tr = mdTour({ stages: [ko], matches })
  const board = html(BracketBoard, { view: koRounds(matches, 'k1'), tour: tr, db, canEdit: true, isMobile: false, onScore: noop, onUndo: noop, onEdit: noop, onQuick: noop, onSwap: noop })
  assert.match(board, /draggable="true"/)
  assert.doesNotMatch(html(BracketBoard, { view: koRounds(matches, 'k1'), tour: tr, db, canEdit: true, isMobile: false, onScore: noop, onUndo: noop, onEdit: noop, onQuick: noop }), /draggable="true"/)

  const props = { tour: tr, db, stage: ko, own: matches, a: fakeActions(), canEdit: true }
  const edit = html(BracketSetup, { ...props, editable: true })
  assert.match(text(BracketSetup, { ...props, editable: true }), /Thiết lập nhánh.*Tranh hạng 3.*Xong · tạo lại nhánh/)
  assert.ok(isDisabled(buttonTag(edit, 'Xong · tạo lại nhánh')), 'chưa đổi gì thì chưa tạo lại')
  assert.match(text(BracketSetup, { ...props, editable: true }), /Kéo tên đội ở vòng đầu/)
  assert.doesNotMatch(text(BracketSetup, { ...props, editable: false }), /Xong · tạo lại nhánh/)
})
