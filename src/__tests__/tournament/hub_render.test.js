// Giao diện Hub (Phase 1) render bằng component thật với dữ liệu mẫu — xem _render.js.
import test from 'node:test'
import assert from 'node:assert/strict'
import { text, html, load, fakeActions } from './_render.js'
import { db, tour } from './fixture.js'

const { default: TourHero } = await load('#components/tournament/TourHero.jsx')
const { default: EventBar } = await load('#components/tournament/EventBar.jsx')
const { default: TourStepper } = await load('#components/tournament/TourStepper.jsx')
const { default: OverviewTab } = await load('#components/tournament/OverviewTab.jsx')
const { default: InfoTab } = await load('#components/tournament/InfoTab.jsx')
const { default: PlayersTab } = await load('#components/tournament/PlayersTab.jsx')

const noop = () => {}
const money = { collected: 350000, expected: 700000 }

test('hero: tên, trạng thái, meta mono, số; nút quản trị chỉ khi có quyền', () => {
  const props = { tour: tour(), money, isMobile: false, onBack: noop, onEdit: noop, onDelete: noop, onStatus: noop }
  const admin = text(TourHero, { ...props, canEdit: true })
  assert.match(admin, /Giải Masters Phú Khê 2026/)
  assert.match(admin, /Đang mở đăng ký/)
  assert.match(admin, /16\/08\/2026 · Sân An Bình · 2 sân · 08:00–12:00/)
  assert.doesNotMatch(admin, /Bắt đầu giải/, 'trạng thái tự đi theo lịch (tạo lịch → đang diễn ra) — không bắt BTC bấm')
  assert.match(admin, /Huỷ giải/, 'việc tay duy nhất còn lại với trạng thái giải')
  assert.match(admin, /350\.000/)
  assert.match(admin, /\b4\b.*VĐV/, '4 người đang đăng ký — người đã rút không tính')

  const viewer = text(TourHero, { ...props, canEdit: false })
  assert.doesNotMatch(viewer, /Huỷ giải|Sửa thông tin/, 'thành viên thường thấy nút là bấm vào ăn lỗi RLS')
  assert.match(viewer, /Giải Masters Phú Khê 2026/)
})

test('hàng nội dung: tên, trạng thái, số VĐV từng nội dung; rỗng thì báo và mời thêm', () => {
  const s = text(EventBar, { tour: tour(), value: 'e-md', onChange: noop, canEdit: true, isMobile: false, onAdd: noop, onDelete: noop })
  assert.match(s, /Đôi nam .*Nhận đăng ký/)
  assert.match(s, /Đôi nữ .*Đã chốt đội hình/)
  assert.match(s, /2 VĐV · 2 nam · 0 nữ/)
  assert.match(s, /Nội dung/, 'còn loại chưa thêm → có nút + Nội dung')

  const empty = text(EventBar, { tour: tour({ events: [] }), value: null, onChange: noop, canEdit: false, isMobile: false })
  assert.match(empty, /Giải chưa có nội dung thi đấu/)
  assert.doesNotMatch(html(EventBar, { tour: tour({ events: [] }), onChange: noop, canEdit: false }), /<button/,
    'không có quyền thì không có nút thêm')
})

test('stepper: ô số và dòng phụ', () => {
  const s = text(TourStepper, {
    items: [{ key: 'overview', sub: '2/5 việc chuẩn bị' }, { key: 'info', sub: 'x' }, { key: 'players', sub: 'y' }],
    value: 'players', onChange: noop,
  })
  assert.match(s, /TQ Tổng quan 2\/5 việc chuẩn bị/)
  assert.match(s, /1 Thí sinh/)
  assert.doesNotMatch(s, /Thể thức|Ghép cặp/, 'stepper chỉ hiện đúng các bước được truyền vào')
})

test('tổng quan: checklist nói đúng việc còn thiếu', () => {
  const s = text(OverviewTab, { tour: tour(), onGo: noop, canEdit: true })
  assert.match(s, /Trước khi bắt đầu/)
  assert.match(s, /1 thí sinh chưa chọn nội dung/, 'r4 chưa chọn nội dung nào')
  assert.match(s, /2 thí sinh chưa đóng lệ phí/)
  assert.doesNotMatch(s, /Có cơ cấu giải thưởng/, 'giải thưởng không chặn giải chạy — đã bỏ khỏi checklist')
})

test('thông tin: thu theo giới, chi, tiền thưởng nhân số nội dung, số dư; không quyền thì không sửa', () => {
  const props = { tour: tour(), isMobile: false, a: fakeActions(), onEdit: noop }
  const s = text(InfoTab, { ...props, canEdit: true })
  assert.match(s, /Nam · 2 người 400\.000/, 'r5 đã rút không tính vào thu')
  assert.match(s, /Nữ · 2 người 300\.000/)
  assert.match(s, /Tổng thu Đã thu 350\.000 \/ 700\.000 700\.000/)
  assert.match(s, /Thuê sân 640\.000/)
  assert.match(s, /Tiền thưởng \(tự tính từ cơ cấu giải\) 1\.050\.000/, '(200k + 150k) × 3 nội dung')
  assert.match(s, /Tổng chi 1\.690\.000/)
  assert.match(s, /Thiếu, cần bù [^-]*-990\.000/, 'thu 700k < chi 1.690k')
  assert.match(s, /Nhất Huy chương vàng 200\.000 \/đội/)

  const viewer = html(InfoTab, { ...props, canEdit: false })
  assert.doesNotMatch(viewer, /Thêm khoản chi|Thêm giải|Xoá dòng/)
})

test('thí sinh: chip đúng giới, chip khoá khi nội dung đã chốt, người rút có nhãn', () => {
  const s = html(PlayersTab, { tour: tour(), db, a: fakeActions(), canEdit: true, isMobile: false })
  const row = (name) => s.slice(s.indexOf(name), s.indexOf('</tr>', s.indexOf(name)))
  assert.doesNotMatch(row('Nguyễn Văn An'), />ĐNữ</, 'nam không được thấy chip Đôi nữ')
  assert.match(row('Nguyễn Văn An'), />ĐN</)
  assert.match(row('Lê Thị Cúc'), /title="Nội dung đã chốt đội hình[^"]*"[^>]*disabled/,
    'Đôi nữ đã chốt: chip vẫn hiện (đang bật) nhưng khoá, có lý do')
  assert.match(text(PlayersTab, { tour: tour(), db, a: fakeActions(), canEdit: true }), /Hoàng Em .*Đã rút/)
  assert.doesNotMatch(html(PlayersTab, { tour: tour(), db, a: fakeActions(), canEdit: false }), />Rút</)
})
