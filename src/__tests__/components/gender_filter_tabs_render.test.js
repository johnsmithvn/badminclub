// Bộ lọc giới tính Tất cả / Nam / Nữ ở Bảng xếp hạng (tab Elo sự nghiệp + tab Đua mùa).
import test from 'node:test'
import assert from 'node:assert/strict'
import { text, html, load, buttonTag } from '../tournament/_render.js'

const { default: GenderFilterTabs } = await load('#components/leaderboard/GenderFilterTabs.jsx')
const base = { counts: { all: 24, nam: 14, nu: 10 }, isDark: false, allActiveBg: '#00B2A9', onChange: () => {} }

test('đủ 3 nút kèm số người mỗi nhóm', () => {
  assert.equal(text(GenderFilterTabs, { ...base, value: 'all' }), 'Tất cả 24 ♂ Nam 14 ♀ Nữ 10')
})

test('nút đang chọn được tô màu của nhóm: Tất cả theo tab · Nam xanh · Nữ hồng', () => {
  const bg = (value, label) => (buttonTag(html(GenderFilterTabs, { ...base, value }), label).match(/background:([^;"]+)/) || [])[1]
  assert.equal(bg('all', 'Tất cả'), '#00B2A9')
  assert.equal(bg('nam', 'Nam'), '#1D50A0')
  assert.equal(bg('nu', 'Nữ'), '#D946EF')
  assert.equal(bg('nam', 'Tất cả'), 'transparent', 'nút không chọn: nền trong suốt')
})

test('chế độ tối: nút Tất cả dùng navy, không dùng màu của tab', () => {
  const tag = buttonTag(html(GenderFilterTabs, { ...base, value: 'all', isDark: true }), 'Tất cả')
  assert.match(tag, /background:var\(--navy-700\)/)
})
