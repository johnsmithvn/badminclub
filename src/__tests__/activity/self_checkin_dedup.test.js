import test from 'node:test'
import assert from 'node:assert/strict'
import { makeActions } from '../../contexts/appActions.js'

test('memberSelfCheckin deduplication & rapid spam prevention', async (t) => {
  let currentDb = {
    clubId: 'c1',
    currentUserId: 'u1',
    members: [
      { id: 'm1', name: 'Kuro', role: 'member', active: true, userId: 'u1' },
      { id: 'm_owner', name: 'Owner', role: 'owner', active: true, userId: 'u_owner' },
    ],
    sessions: [
      { id: 's1', date: '2026-09-18', status: 'open', groupId: 'g1' },
    ],
    groups: [{ id: 'g1', name: 'Nhóm 1', courtIds: [] }],
    attendance: {},
    lineups: {},
    notifications: [],
    guests: [],
    sessionGuests: [],
    adjustments: [],
    courts: [],
    levels: ['TB'],
  }

  const dbRef = { current: currentDb }
  const uiRef = { current: {} }
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

  await t.test('1. Báo vắng lần đầu: trạng thái thay đổi và ghi nhận vào attendance', () => {
    toasts.length = 0
    a.memberSelfCheckin('s1', 'absent')

    assert.equal(currentDb.attendance?.s1?.m1, false, 'Điểm danh phải cập nhật m1 = false (báo vắng)')
    assert.ok(toasts.length > 0, 'Phải có toast thông báo thành công')
  })

  await t.test('2. Báo vắng liên tục (rapid clicks) khi trạng thái không đổi: bị chặn ngay lập tức', () => {
    toasts.length = 0
    // Gọi tiếp lần 2 và lần 3 ngay sau lần 1
    a.memberSelfCheckin('s1', 'absent')
    a.memberSelfCheckin('s1', 'absent')

    assert.equal(currentDb.attendance?.s1?.m1, false, 'Trạng thái vẫn giữ nguyên false')
    assert.equal(toasts.length, 0, 'Click spam nhanh bị chặn triệt để, không bắn toast đè')
  })

  await t.test('3. Chuyển sang Có mặt: trạng thái có sự thay đổi -> được chấp nhận', () => {
    toasts.length = 0
    a.memberSelfCheckin('s1', 'present')

    assert.equal(currentDb.attendance?.s1?.m1, true, 'Điểm danh phải cập nhật m1 = true (có mặt)')
    assert.ok(toasts.some((msg) => msg.includes('Đã cập nhật')), 'Toast thành công khi đổi sang có mặt')
  })

  await t.test('4. Bấm Có mặt liên tục (rapid clicks): bị chặn, không spam', () => {
    toasts.length = 0
    a.memberSelfCheckin('s1', 'present')

    assert.equal(currentDb.attendance?.s1?.m1, true, 'Trạng thái vẫn là true')
    assert.equal(toasts.length, 0, 'Click spam bị chặn, không gửi thông báo hay toast thừa')
  })
})
