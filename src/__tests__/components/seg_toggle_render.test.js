// Nút chọn nhỏ trong thẻ trang Thống kê cá nhân: Mùa giải/Elo (kiểu hộp) và Tất cả/Nam/Nữ (kiểu viên thuốc).
import test from 'node:test'
import assert from 'node:assert/strict'
import { text, html, load, buttonTag } from '../tournament/_render.js'

const { default: SegToggle } = await load('#components/home/personal/SegToggle.jsx')
const mode = [['season', 'Mùa giải'], ['elo', 'Elo']]
const gender = [['all', 'Tất'], ['nam', 'Nam'], ['nu', 'Nữ']]

test('đủ nút theo thứ tự', () => {
  assert.equal(text(SegToggle, { options: mode, value: 'season', onChange: () => {} }), 'Mùa giải Elo')
  assert.equal(text(SegToggle, { variant: 'pill', options: gender, value: 'all', onChange: () => {} }), 'Tất Nam Nữ')
})

test('nút đang chọn nổi lên (nền thẻ + bóng), nút còn lại trong suốt', () => {
  const m = html(SegToggle, { options: mode, value: 'elo', onChange: () => {} })
  assert.match(buttonTag(m, 'Elo'), /background:var\(--surface-card\).*box-shadow:var\(--shadow-sm\)/)
  assert.match(buttonTag(m, 'Mùa giải'), /background:none/)
})

test('kiểu hộp bo 6px, kiểu viên thuốc bo tròn hẳn', () => {
  assert.match(buttonTag(html(SegToggle, { options: mode, value: 'season', onChange: () => {} }), 'Elo'), /border-radius:6px/)
  assert.match(buttonTag(html(SegToggle, { variant: 'pill', options: gender, value: 'all', onChange: () => {} }), 'Nam'), /border-radius:999px/)
})
