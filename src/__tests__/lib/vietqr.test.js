import assert from 'node:assert/strict'
import { findBank, getVietQrUrl, parseVietQr } from '#utils/vietqr.js'

// 1. Kiểm tra tra cứu ngân hàng
assert.equal(findBank('MB').shortName, 'MB Bank')
assert.equal(findBank('970422').code, 'MB')
assert.equal(findBank('techcombank').code, 'TCB')
assert.equal(findBank('vietcombank').code, 'VCB')
assert.equal(findBank('tpbank').code, 'TPB')

// 2. Kiểm tra sinh URL VietQR
const qrUrl = getVietQrUrl({
  bankCode: 'TCB',
  accountNo: '0327279292',
  accountHolder: 'Nguyen Minh Tung',
  amount: 250000,
  memo: 'Quy thang 9',
})
assert.ok(qrUrl.includes('970407-0327279292-compact2.png'))
assert.ok(qrUrl.includes('accountName=NGUYEN%20MINH%20TUNG'))
assert.ok(qrUrl.includes('amount=250000'))

// 3. Kiểm tra parse chuỗi VietQR từ URL
const parsedUrl = parseVietQr(qrUrl)
assert.equal(parsedUrl.bankName, 'Techcombank')
assert.equal(parsedUrl.bankNo, '0327279292')
assert.equal(parsedUrl.bankHolder, 'NGUYEN MINH TUNG')
assert.equal(parsedUrl.amount, 250000)
assert.equal(parsedUrl.memo, 'Quy thang 9')

// 4. Kiểm tra parse chuỗi chuẩn EMVCo Napas 247
// 000201 010212 3854 0010A000000727 0124 0006970407 01100327279292 0208QRIBFTTA 5303704 5406250000 5802VN 5916NGUYEN MINH TUNG 6215 0811QUY THANG 9 6304
const emvcoPayload =
  '000201' +
  '010212' +
  '3854' +
    '0010A000000727' +
    '0124' +
      '0006970407' +
      '01100327279292' +
    '0208QRIBFTTA' +
  '5303704' +
  '5406250000' +
  '5802VN' +
  '5916NGUYEN MINH TUNG' +
  '6215' +
    '0811QUY THANG 9' +
  '6304A1B2'

const parsedEmvco = parseVietQr(emvcoPayload)
assert.ok(parsedEmvco)
assert.equal(parsedEmvco.bankName, 'Techcombank')
assert.equal(parsedEmvco.bankNo, '0327279292')
assert.equal(parsedEmvco.bankHolder, 'NGUYEN MINH TUNG')
assert.equal(parsedEmvco.amount, 250000)
assert.equal(parsedEmvco.memo, 'QUY THANG 9')

console.log('vietqr parse & generator check: OK')
