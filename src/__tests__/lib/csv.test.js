// node --test — Test bộ đọc CSV và ánh xạ thành viên CLB.

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  detectColumns,
  generateSampleCsv,
  normalizeGender,
  normalizeGroup,
  normalizeLevel,
  parseAndValidateMembers,
  parseCsvRows,
  validateHeaders,
} from '#lib/csv.js'

test('parseCsvRows — cơ bản, dấu phẩy, BOM UTF-8', () => {
  const csv = '\uFEFFName,Phone,Gender\r\nAn,0912345678,Nam\r\nBinh,0987654321,Nu'
  const rows = parseCsvRows(csv)
  assert.equal(rows.length, 3)
  assert.deepEqual(rows[0], ['Name', 'Phone', 'Gender'])
  assert.deepEqual(rows[1], ['An', '0912345678', 'Nam'])
  assert.deepEqual(rows[2], ['Binh', '0987654321', 'Nu'])
})

test('parseCsvRows — hỗ trợ dấu chấm phẩy và tab', () => {
  const semi = 'Name;Phone;Level\nAn;0912;TB\nBinh;0987;TB+'
  assert.equal(parseCsvRows(semi).length, 3)
  assert.equal(parseCsvRows(semi)[1][1], '0912')

  const tab = 'Name\tPhone\nAn\t0912'
  assert.equal(parseCsvRows(tab).length, 2)
  assert.equal(parseCsvRows(tab)[1][0], 'An')
})

test('parseCsvRows — xử lý ngoặc kép và dấu phẩy bên trong', () => {
  const csv = 'Name,Note\r\n"Nguyen, Van An","Danh ""VIP"""'
  const rows = parseCsvRows(csv)
  assert.equal(rows[1][0], 'Nguyen, Van An')
  assert.equal(rows[1][1], 'Danh "VIP"')
})

test('detectColumns — tự động tìm đúng vị trí cột', () => {
  const header = ['Họ và tên', 'SĐT', 'Giới tính', 'Trình độ', 'Nhóm cố định']
  const map = detectColumns(header)
  assert.equal(map.nameIdx, 0)
  assert.equal(map.phoneIdx, 1)
  assert.equal(map.genderIdx, 2)
  assert.equal(map.levelIdx, 3)
  assert.equal(map.groupIdx, 4)
})

test('normalizeGender & normalizeLevel', () => {
  assert.equal(normalizeGender('Nữ'), 'nu')
  assert.equal(normalizeGender('female'), 'nu')
  assert.equal(normalizeGender('F'), 'nu')
  assert.equal(normalizeGender('Nam'), 'nam')
  assert.equal(normalizeGender('M'), 'nam')

  const levels = ['Newbie', 'TBY', 'TB-', 'TB', 'TB+', 'Khá']
  assert.equal(normalizeLevel('tb', levels), 'TB')
  assert.equal(normalizeLevel('tb+', levels), 'TB+')
  assert.equal(normalizeLevel('kha', levels), 'Khá')
  assert.equal(normalizeLevel('Chưa rõ', levels), 'Newbie')
})

test('normalizeGroup — khớp tên hoặc mã ngắn', () => {
  const groups = [
    { id: 'g1', name: 'Nhóm Thứ 3-5', short: 'T3-T5' },
    { id: 'g2', name: 'Nhóm Chủ nhật', short: 'CN' },
  ]
  assert.equal(normalizeGroup('T3-T5', groups).groupId, 'g1')
  assert.equal(normalizeGroup('Nhóm Chủ nhật', groups).groupId, 'g2')
  assert.equal(normalizeGroup('Không có', groups).groupId, null)
})

test('validateHeaders — ép chuẩn 5 cột template', () => {
  const okHeader = ['Họ và tên', 'Số điện thoại', 'Giới tính', 'Trình độ', 'Nhóm cố định']
  assert.equal(validateHeaders(okHeader).ok, true)

  const wrongCount = ['Họ và tên', 'Số điện thoại']
  assert.equal(validateHeaders(wrongCount).ok, false)

  const wrongCol = ['Họ và tên', 'Số điện thoại', 'Giới tính', 'Trình độ', 'Địa chỉ']
  assert.equal(validateHeaders(wrongCol).ok, false)

  // Hai cột tuỳ chọn chỉ được đứng SAU 5 cột chuẩn. File cũ 5 cột phải chạy y như trước —
  // chèn cột mới vào giữa là từ chối hàng loạt file người dùng đang có.
  const withOptional = [...okHeader, 'Tên đầy đủ', 'Email']
  assert.equal(validateHeaders(withOptional).ok, true)
  assert.equal(validateHeaders([...okHeader, 'Email']).ok, true, 'thêm một cột tuỳ chọn thôi cũng phải nhận')

  assert.equal(validateHeaders([...okHeader, 'Địa chỉ']).ok, false,
    'cột dư mà không phải cột tuỳ chọn thì vẫn phải chặn — không thì file sai mẫu lọt vào và cột bị đọc nhầm')
  assert.equal(validateHeaders([...okHeader, 'Email', 'Email']).ok, false,
    'cùng một cột tuỳ chọn hai lần thì không biết lấy cột nào')
})

test('parseAndValidateMembers — đọc hai cột tuỳ chọn theo TÊN, không theo vị trí', () => {
  const csv = `Họ và tên,Số điện thoại,Giới tính,Trình độ,Nhóm cố định,Email,Tên đầy đủ
Thúy,0327279292,Nữ,TB,,thuy@gmail.com,Nguyễn Thị Thuý`

  const res = parseAndValidateMembers(csv, ['Newbie', 'TB'], [], [])
  assert.equal(res.headerError, null)
  assert.equal(res.rows[0].fullName, 'Nguyễn Thị Thuý',
    'đảo thứ tự hai cột tuỳ chọn mà đọc theo vị trí là email chui vào ô tên đầy đủ và ngược lại')
  assert.equal(res.rows[0].email, 'thuy@gmail.com')
  assert.equal(res.rows[0].name, 'Thúy', 'cột 1 vẫn là TÊN HIỂN THỊ, hai cột thêm không được đụng vào')
})

test('parseAndValidateMembers — file 5 cột cũ vẫn chạy, hai trường mới rỗng', () => {
  const csv = `Họ và tên,Số điện thoại,Giới tính,Trình độ,Nhóm cố định
Thúy,0327279292,Nữ,TB,`

  const res = parseAndValidateMembers(csv, ['Newbie', 'TB'], [], [])
  assert.equal(res.headerError, null, 'file CSV người dùng đang có phải nhập được y như trước')
  assert.equal(res.rows[0].fullName, '')
  assert.equal(res.rows[0].email, '')
})

test('parseAndValidateMembers — kiểm tra cảnh báo trùng và lỗi thiếu tên với template chuẩn', () => {
  const csv = `Họ và tên,Số điện thoại,Giới tính,Trình độ,Nhóm cố định
Nguyễn Văn A,0912345678,Nam,TB,T3-T5
,0987654321,Nữ,Newbie,
Trần Thị B,0912345678,Nữ,TB-,`

  const existing = [{ id: 'm1', name: 'Cũ A', phone: '0912345678' }]
  const res = parseAndValidateMembers(csv, ['Newbie', 'TB-', 'TB'], [{ id: 'g1', short: 'T3-T5' }], existing)

  assert.equal(res.headerError, null)
  assert.equal(res.summary.total, 3)
  assert.equal(res.summary.warnCount, 2) // cả 2 đều trùng SĐT với existing
  assert.equal(res.summary.errorCount, 1) // dòng 2 thiếu tên
  assert.equal(res.rows[1].status, 'error')
  assert.equal(res.rows[0].groupId, 'g1')
})

test('parseAndValidateMembers — báo lỗi khi sai tên cột', () => {
  const csv = `Name,Phone,Gender,Rank\nAn,0912,Nam,TB`
  const res = parseAndValidateMembers(csv)
  assert.ok(res.headerError)
  assert.equal(res.rows.length, 0)
})

test('generateSampleCsv — sinh mẫu có BOM UTF-8', () => {
  const sample = generateSampleCsv(['Newbie', 'TB'], [{ id: 'g1', short: 'T3-T5' }])
  assert.ok(sample.startsWith('\uFEFF'))
  assert.ok(sample.includes('Nguyễn Văn An'))
  assert.ok(sample.includes('Họ và tên,Số điện thoại,Giới tính,Trình độ,Nhóm cố định'))
})
