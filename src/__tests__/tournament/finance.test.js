import test from 'node:test'
import assert from 'node:assert/strict'
import { feeFor, tournamentMoney } from '#lib/tournament/finance.js'

const reg = (fee, paid, status = 'registered') => ({ fee, paid, status })

test('feeFor: phí theo giới tính; giới tính lạ là lỗi chứ không phải 0đ', () => {
  const t = { feeMale: 200000, feeFemale: 150000 }
  assert.equal(feeFor(t, 'nam'), 200000)
  assert.equal(feeFor(t, 'nu'), 150000)
  assert.throws(() => feeFor(t, 'male'), /giới tính/, 'trả 0 im lặng = VĐV đăng ký miễn phí mà không ai biết')
})

test('thu: dự kiến / đã thu / còn thiếu; người rút lui tách riêng', () => {
  const m = tournamentMoney({
    registrations: [
      reg(200000, true), reg(200000, false), reg(150000, true),
      reg(150000, true, 'withdrawn'), reg(200000, false, 'withdrawn'),
    ],
    prizes: [],
    budgetLines: [],
    eventCount: 1,
  })
  assert.equal(m.expected, 550000, 'người rút lui không còn là khoản phải thu')
  assert.equal(m.collected, 350000)
  assert.equal(m.outstanding, 200000)
  assert.equal(m.withdrawnPaid, 150000, 'đã đóng rồi rút: tiền vẫn trong tay BTC, phải hiện ra để quyết hoàn hay giữ')
})

test('chi: giải thưởng không gắn nội dung nhân theo số nội dung; gắn nội dung thì tính 1 lần', () => {
  const m = tournamentMoney({
    registrations: [],
    prizes: [{ cash: 200000, eventId: null }, { cash: 50000, eventId: 'xd' }],
    budgetLines: [{ amount: 100000 }],
    eventCount: 3,
  })
  assert.equal(m.prizeTotal, 650000, '200k × 3 nội dung + 50k riêng nội dung xd')
  assert.equal(m.budgetTotal, 100000)
  assert.equal(m.plannedOut, 750000)
  assert.equal(m.balance, -750000, 'âm = thiếu, cần bù')
})
