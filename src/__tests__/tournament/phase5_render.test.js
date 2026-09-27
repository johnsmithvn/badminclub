// Giao diện Phase 5 (gợi ý thể thức, ghép nâng cao) render bằng component thật — xem _render.js.
import test from 'node:test'
import assert from 'node:assert/strict'
import { text, load, fakeActions } from './_render.js'
import { db, tour } from './fixture.js'

const { default: PairingTab } = await load('#components/tournament/PairingTab.jsx')
const { default: RecommendDialog } = await load('#components/tournament/RecommendDialog.jsx')

const noop = () => {}
const reg = (id, playerId, rating) => ({ id, playerId, gender: 'nam', ratingSnapshot: rating, fee: 0, paid: true, status: 'registered' })
// Đôi nam: 2 cặp chưa ghim, lệch nhiều (800+700 vs 400+300) — có gợi ý đổi.
const mdTour = (p = {}) => tour({
  events: [{ id: 'e-md', kind: 'md', teamSize: 2, genderRule: 'male', status: 'draft' }],
  registrations: [reg('r1', 'm1', 800), reg('r2', 'm2', 700), reg('r3', 'm3', 400), reg('r4', 'm4', 300)],
  entries: ['r1', 'r2', 'r3', 'r4'].map((id) => ({ eventId: 'e-md', registrationId: id })),
  teams: [{ id: 'tA', eventId: 'e-md', pinned: false }, { id: 'tB', eventId: 'e-md', pinned: false }],
  teamPlayers: [
    { teamId: 'tA', eventId: 'e-md', registrationId: 'r1' }, { teamId: 'tA', eventId: 'e-md', registrationId: 'r2' },
    { teamId: 'tB', eventId: 'e-md', registrationId: 'r3' }, { teamId: 'tB', eventId: 'e-md', registrationId: 'r4' },
  ],
  ...p,
})
const pairing = (tr, canEdit = true) => text(PairingTab, { tour: tr, event: tr.events[0], db, a: fakeActions(), canEdit, isMobile: false })

test('ghép cặp: 4 chế độ, dòng ăn ý từng cặp, gợi ý đổi người khi lệch nhiều', () => {
  const s = pairing(mdTour())
  assert.match(s, /Cân bằng.*Hạt giống.*Ăn ý.*Ngẫu nhiên/)
  assert.match(s, /Chưa từng đánh chung/, 'CLB chưa có trận nào của họ')
  assert.match(s, /Đổi .* ↔ .*: độ lệch 800 → 0/)
  assert.match(s, /Đổi ngay/)
  assert.doesNotMatch(pairing(mdTour(), false), /Đổi ngay/, 'không có quyền → không gợi ý đổi')
})

test('ghép cặp: đã đánh chung đủ 2 trận thì hiện số trận và tỉ lệ thắng', () => {
  const matches = [0, 1, 2].map((i) => ({ id: 'x' + i, teamA: ['m1', 'm2'], teamB: ['z1', 'z2'], winnerTeam: i < 2 ? 'A' : 'B', ratingEnabled: true }))
  const s = text(PairingTab, { tour: mdTour(), event: mdTour().events[0], db: { ...db, matches }, a: fakeActions(), canEdit: true, isMobile: false })
  assert.match(s, /Đánh chung 3 trận · thắng 67%/)
})

test('gợi ý thể thức: chỉ chọn ưu tiên; đọc giờ + sân của giải; nút áp dụng đếm nội dung', () => {
  const s = text(RecommendDialog, { tour: mdTour(), onClose: noop, onApply: noop })
  assert.match(s, /Gợi ý thể thức/)
  assert.match(s, /Cân bằng.*Nhiều trận.*Nhanh/)
  assert.match(s, /Đôi nam.*2 đội/)
  assert.match(s, /Xong khoảng \d\d:\d\d \(ước tính\)/, 'fixture có giờ 08:00–12:00 và 2 sân')
  assert.match(s, /Áp dụng cho 1 nội dung/)

  // Giải chưa khai báo giờ/sân: hộp giả lập vẫn tự có mặc định (2 sân, 08:00-12:00) để BTC lên phương án
  // trước khi khai báo — không còn chặn ở "chưa khai báo giờ hoặc sân" như bản chỉ đọc thật cũ.
  const noReal = text(RecommendDialog, { tour: mdTour({ courtLabels: [] }), onClose: noop, onApply: noop })
  assert.match(noReal, /Xong khoảng \d\d:\d\d \(ước tính\)/)
})

test('gợi ý thể thức: nội dung đã có lịch thì giữ nguyên, không tính vào nút áp dụng', () => {
  const tr = mdTour({ stages: [{ id: 's1', eventId: 'e-md', seq: 1, type: 'knockout', status: 'running', matchRule: { sets: 1, points: 21, winBy2: true, cap: 30 } }] })
  const s = text(RecommendDialog, { tour: tr, onClose: noop, onApply: noop })
  assert.match(s, /Đã có lịch — giữ nguyên/)
  assert.match(s, /Áp dụng cho 0 nội dung/)
})
