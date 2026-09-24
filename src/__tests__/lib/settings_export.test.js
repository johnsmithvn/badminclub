import test from 'node:test'
import assert from 'node:assert/strict'
import { makeActions } from '#contexts/appActions.js'

test('Settings Export & Import — cấu trúc schema và áp dụng cài đặt', () => {
  let currentDb = {
    club: {
      id: 'CLB1',
      name: 'CLB Cầu Lông A',
      code: 'CLBA123',
      roundUnit: true,
      lockDay: 25,
      seeDebtEachOther: false,
      seeFund: false,
      courtPayMode: 'payer',
      levels: ['Newbie', 'Y', 'Khá'],
    },
    levels: ['Newbie', 'Y', 'Khá'],
    groups: [
      { id: 'G1', name: 'Ca thứ 6', short: 'T6', feeNam: 250000, feeNu: 200000, unitNam: 60000, unitNu: 50000 },
    ],
    guestPrices: [
      { level: 'Newbie', nam: 50000, nu: 40000 },
      { level: 'Y', nam: 60000, nu: 50000 },
      { level: 'Khá', nam: 70000, nu: 60000 },
    ],
    courts: [
      { id: 'C1', name: 'Sân Nguyễn Tuân', addr: 'Số 9 NT', price: 120000, active: true },
    ],
  }

  const dbRef = { current: currentDb }
  const uiRef = { current: { form: {} } }
  const toasts = []

  const setDb = (updater) => {
    const patch = typeof updater === 'function' ? updater(currentDb) : updater
    currentDb = { ...currentDb, ...patch }
    dbRef.current = currentDb
  }

  const a = makeActions({
    setDb,
    setUi: () => {},
    dbRef,
    uiRef,
    navRef: { current: () => {} },
    toast: (msg) => toasts.push(msg),
    reload: () => {},
  })

  // 1. Áp dụng file cài đặt từ CLB khác
  const importedData = {
    schema: 'badminclub_settings',
    version: 1,
    exportedAt: '2026-09-01T10:00:00.000Z',
    clubName: 'CLB Mẫu Pro',
    club: {
      roundUnit: false,
      lockDay: 28,
      seeDebtEachOther: true,
      seeFund: true,
      courtPayMode: 'month',
      levels: ['Y', 'TB-', 'TB', 'Khá'],
    },
    money: {
      feeNam: 300000,
      feeNu: 260000,
      unitNam: 75000,
      unitNu: 65000,
      hasMemberExtraDiscount: true,
      memberExtraDiscount: 10000,
      guestPrices: [
        { level: 'Y', nam: 70000, nu: 60000 },
        { level: 'TB-', nam: 80000, nu: 70000 },
        { level: 'TB', nam: 85000, nu: 75000 },
        { level: 'Khá', nam: 90000, nu: 80000 },
      ],
    },
    courts: [
      { name: 'Sân Nguyễn Xiển', addr: 'Hạ Đình', mapUrl: 'https://maps.app.goo.gl/xyz', price: 140000, active: true },
    ],
    groups: [
      { name: 'Ca Chủ Nhật', short: 'CN', from: '08:00', to: '10:00', feeNam: 300000, feeNu: 260000 },
    ],
  }

  a.applyImportedSettings(importedData, {
    includeClub: true,
    includeMoney: true,
    includeCourts: true,
    includeGroups: true,
  })

  // Kiểm tra cài đặt chung
  assert.equal(currentDb.club.lockDay, 28)
  assert.equal(currentDb.club.roundUnit, false)
  assert.deepEqual(currentDb.levels, ['Y', 'TB-', 'TB', 'Khá'])

  // Kiểm tra giá khách
  assert.equal(currentDb.guestPrices.find((p) => p.level === 'TB')?.nam, 85000)
  assert.equal(currentDb.club.hasMemberExtraDiscount, true)
  assert.equal(currentDb.club.memberExtraDiscount, 10000)

  // Kiểm tra sân bãi (giữ sân cũ, thêm sân mới có mapUrl)
  assert.equal(currentDb.courts.length, 2)
  const nxCourt = currentDb.courts.find((c) => c.name === 'Sân Nguyễn Xiển')
  assert.ok(nxCourt)
  assert.equal(nxCourt.mapUrl, 'https://maps.app.goo.gl/xyz')


  // Kiểm tra nhóm
  assert.equal(currentDb.groups.length, 2)
  assert.ok(currentDb.groups.some((g) => g.name === 'Ca Chủ Nhật'))

  // 2. Nhập TỪNG PHẦN: chỉ tick "sân", mọi thứ khác phải y nguyên.
  // Bỏ qua cờ opts là ghi đè biểu phí của CLB bằng biểu phí CLB khác — mọi khoản thu tháng
  // sau sai số ngay từ lúc sinh quỹ, và không ai biết đã bị đổi lúc nào.
  const feeBefore = currentDb.groups.map((g) => g.feeNam)
  const lockBefore = currentDb.club.lockDay

  a.applyImportedSettings({
    ...importedData,
    club: { ...importedData.club, lockDay: 5 },
    money: { ...importedData.money, feeNam: 999000 },
    courts: [{ name: 'Sân Mỹ Đình', addr: '', price: 100000, active: true }],
  }, { includeCourts: true })

  assert.deepEqual(currentDb.groups.map((g) => g.feeNam), feeBefore, 'không tick "biểu phí" mà quỹ tháng vẫn đổi → thu sai tiền cả CLB')
  assert.equal(currentDb.club.lockDay, lockBefore, 'không tick "cài đặt chung" mà ngày chốt vẫn đổi → khoá danh sách sai ngày')
  assert.ok(currentDb.courts.some((c) => c.name === 'Sân Mỹ Đình'), 'tick "sân" mà sân mới không vào → nhập từng phần vô dụng')

  // 3. Kiểm tra saveGroupsTab bảo toàn đúng giá trị nhóm đầu tiên và thứ tự nhóm
  a.saveGroupsTab([
    { id: 'G1', name: 'Ca thứ 6', feeNam: 300000, feeNu: 250000, unitNam: 55000, unitNu: 45000 },
    { id: 'G2', name: 'Ca Chủ Nhật', feeNam: 250000, feeNu: 200000, unitNam: 55000, unitNu: 45000 },
  ])
  assert.equal(currentDb.groups[0].feeNam, 300000, 'nhóm đầu tiên phải giữ nguyên mức riêng 300k, không bị ép về giá cũ')
  assert.equal(currentDb.groups[1].feeNam, 250000, 'nhóm thứ hai phải giữ nguyên mức 250k')

  // 4. Kiểm tra flag hasCustomPricing được bảo toàn
  a.saveGroupsTab([
    { id: 'G1', name: 'Ca thứ 6', feeNam: 250000, feeNu: 200000, unitNam: 55000, unitNu: 45000, hasCustomPricing: true },
    { id: 'G2', name: 'Ca Chủ Nhật', feeNam: 250000, feeNu: 200000, unitNam: 55000, unitNu: 45000 },
  ])
  assert.equal(currentDb.groups[0].hasCustomPricing, true, 'flag hasCustomPricing phải được lưu qua saveGroupsTab')
  assert.equal(currentDb.groups[0].feeNam, 250000, 'nhóm có giá trùng CLB nhưng flag custom vẫn giữ giá')

  // 5. Kiểm tra saveMoneyTab không bao giờ đè lên nhóm có hasCustomPricing === true
  a.saveGroupsTab([
    { id: 'G1', name: 'Ca thứ 6', feeNam: 300000, feeNu: 250000, unitNam: 55000, unitNu: 45000 },
    { id: 'G2', name: 'Ca Chủ Nhật', feeNam: 250000, feeNu: 200000, unitNam: 55000, unitNu: 45000, hasCustomPricing: true },
  ])
  a.saveMoneyTab({
    feeNam: 350000,
    feeNu: 300000,
    hasRefund: true,
    unitNam: 60000,
    unitNu: 50000,
  })
  assert.equal(currentDb.groups[0].feeNam, 350000, 'nhóm áp dụng theo CLB phải cập nhật theo biểu phí CLB mới')
  assert.equal(currentDb.groups[1].feeNam, 250000, 'nhóm có mức riêng hasCustomPricing === true tuyệt đối không bị saveMoneyTab ghi đè')

  // 6. Nhóm đầu tiên là mức riêng thì saveMoneyTab vẫn bảo toàn nhóm đầu và cập nhật nhóm sau
  a.saveGroupsTab([
    { id: 'G1', name: 'Ca thứ 6', feeNam: 280000, feeNu: 220000, unitNam: 50000, unitNu: 40000, hasCustomPricing: true },
    { id: 'G2', name: 'Ca Chủ Nhật', feeNam: 350000, feeNu: 300000, unitNam: 60000, unitNu: 50000 },
  ])
  a.saveMoneyTab({
    feeNam: 320000,
    feeNu: 270000,
    hasRefund: true,
    unitNam: 55000,
    unitNu: 45000,
  })
  assert.equal(currentDb.groups[0].feeNam, 280000, 'nhóm G1 có mức riêng ở vị trí đầu tiên vẫn giữ nguyên 280k')
  assert.equal(currentDb.groups[1].feeNam, 320000, 'nhóm G2 theo CLB phải cập nhật thành 320k')
})

