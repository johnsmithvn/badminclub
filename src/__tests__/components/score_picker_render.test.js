// Khối chọn tỉ số (ScorePicker) — dùng chung cho modal Ghi kết quả và khối ghi kết quả ở Chia sân.
// Render tĩnh (xem tournament/_render.js): khoá cái gì hiện ra theo từng trạng thái của #lib/scorePicker.js.
import test from 'node:test'
import assert from 'node:assert/strict'
import { text, html, load } from '../tournament/_render.js'
import { seed } from '../fixture.js'
import { scoreStateFrom } from '#lib/scorePicker.js'

const { default: ScorePicker } = await load('#components/challenge/ScorePicker.jsx')
const db = seed()
const [m1, m2, m3, m4] = db.members
const base = {
  db, teamA: [m1.id, m2.id], teamB: [m3.id, m4.id], ratingA: 820, ratingB: 790, ratingEnabled: true,
  playerDeltas: {}, seasonDeltas: {}, isMobile: false, onChange: () => {},
}
const show = (value, extra) => text(ScorePicker, { ...base, value, ...extra })

test('mặc định: tên hai đội, A thắng 21-19, đủ 4 nút preset, chưa mở ô Khác', () => {
  const s = show(scoreStateFrom())
  assert.match(s, new RegExp(`${m1.name} · ${m2.name}`))
  assert.match(s, new RegExp(`${m3.name} · ${m4.name}`))
  assert.match(s, /Thắng 21 .* 19/, 'nhãn Thắng nằm ở đội A')
  assert.match(s, /21-19 21-15 21-11 Khác/)
  assert.doesNotMatch(s, /Tùy chỉnh tỷ số/)
})

test('thẻ đội hiện Elo trung bình của đội (cùng kiểu modal Sửa tỷ số)', () => {
  const s = show(scoreStateFrom())
  assert.match(s, /Rating TB: 820/)
  assert.match(s, /Rating TB: 790/)
})

test('B thắng: nhãn Thắng chuyển sang đội B', () => {
  const s = show(scoreStateFrom([[15, 21]]))
  assert.match(s, /15 .* Thắng 21/)
})

test('Khác: hiện ô tự nhập, tỷ số nhanh theo phía đội thắng; hoà thì cảnh báo', () => {
  const b = show(scoreStateFrom([[17, 21]]))
  assert.match(b, /Tùy chỉnh tỷ số/)
  assert.match(b, /18–21 16–21 14–21 12–21 0–21 29–30/, 'B thắng → tỷ số nhanh đảo phía')
  assert.doesNotMatch(b, /không thể hòa/)
  const tie = show(scoreStateFrom([[20, 20]]))
  assert.match(tie, /không thể hòa/)
  assert.match(tie, /21–18 21–16/, 'A thắng → bên trái là điểm thắng')
})

test('ô nhập số: 2 ô, kẹp 0..30', () => {
  const m = html(ScorePicker, { ...base, value: scoreStateFrom([[17, 21]]) })
  assert.equal((m.match(/<input[^>]*type="number"[^>]*min="0"[^>]*max="30"/g) || []).length, 2)
})

test('không tính Elo: tiêu đề hộp biến động báo không tính', () => {
  const on = show(scoreStateFrom())
  const off = show(scoreStateFrom(), { ratingEnabled: false })
  assert.match(on, /Biến động · Dự kiến/)
  assert.doesNotMatch(off, /Dự kiến/)
})
