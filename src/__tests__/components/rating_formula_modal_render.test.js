// Popup "Công thức rating" ở tab Cặp đôi. Mobile (375px) từng tràn ngang: bảng cột cố định 126/92/92px và
// 150/96/40px rộng hơn chỗ trống (~270px), 4 thẻ một hàng chỉ còn ~60px mỗi thẻ cho số 16px.
import test from 'node:test'
import assert from 'node:assert/strict'
import { html, text, load } from '../tournament/_render.js'

const { default: RatingFormulaModal } = await load('#components/leaderboard/RatingFormulaModal.jsx')
const desk = html(RatingFormulaModal, { onClose: () => {}, totalMatches: 118, isMobile: false })
const mob = html(RatingFormulaModal, { onClose: () => {}, totalMatches: 118, isMobile: true })

test('mobile: sheet dính đáy, rộng hết màn, bo 2 góc trên', () => {
  assert.match(mob, /^<div style="[^"]*align-items:flex-end;justify-content:center;padding:0"/)
  assert.match(mob, /width:100%;max-width:100%[^"]*border-radius:18px 18px 0 0/)
})

test('mobile: không còn cột cố định rộng — chỉ cột tên co được + cột số hẹp', () => {
  assert.doesNotMatch(mob, /126px|150px|92px|96px/)
  assert.match(mob, /grid-template-columns:minmax\(0,1fr\) 56px 56px/)
  assert.match(mob, /grid-template-columns:minmax\(0,1fr\) 40px/)
})

test('mobile: thẻ ngưỡng mẫu & đầu vào công thức xếp 2 cột thay vì 4', () => {
  assert.doesNotMatch(mob, /repeat\(4, minmax\(0, 1fr\)\)/)
  assert.equal((mob.match(/repeat\(2, minmax\(0, 1fr\)\)/g) || []).length, 2)
})

test('mobile: nút đóng đủ to để chạm (≥ 44px)', () => {
  assert.match(mob, /<button type="button" aria-label="[^"]*" style="[^"]*width:44px;height:44px/)
})

test('desktop giữ nguyên bố cục cũ', () => {
  assert.match(desk, /width:820px/)
  assert.match(desk, /grid-template-columns:126px minmax\(0,1fr\) 92px 92px/)
  assert.match(desk, /grid-template-columns:150px minmax\(0,1fr\) 96px 40px/)
  assert.equal((desk.match(/repeat\(4, minmax\(0, 1fr\)\)/g) || []).length, 2)
})

test('cùng nội dung ở cả hai cỡ màn', () => {
  assert.equal(text(RatingFormulaModal, { onClose: () => {}, totalMatches: 118, isMobile: true }),
    text(RatingFormulaModal, { onClose: () => {}, totalMatches: 118, isMobile: false }))
})
