// node --test — Nghỉ không báo: VẪN TÍNH TIỀN nhưng KHÔNG tính là có mặt trên sân.
// Bản đồ đầy đủ: src/__tests__/README.md

import test from 'node:test'
import assert from 'node:assert/strict'
import { adhocCharges, headCount, isCharged, isPresent, presentCount, sessionMembers } from '#lib/money.js'
import { sessionPlayers } from '#lib/assign.js'

/**
 * Trước khi có trạng thái này, điểm danh chỉ có một cờ mà CẢ tiền LẪN xếp sân cùng đọc. Người
 * nghỉ không báo trước vẫn phải trả tiền (sân đã đặt rồi), nên quản trò buộc phải để họ ở
 * 'Có mặt' — kéo theo chuyên cần, XP, huy hiệu và bảng công bằng lượt đánh đều tưởng họ có ra sân,
 * và bảng công bằng còn xếp họ vào diện "bị bỏ quên", đúng ngược sự thật.
 *
 * Hai vị từ phải tách bạch và KHÔNG được gộp lại:
 *   isCharged  → mọi phép tính TIỀN
 *   isPresent  → xếp sân, chuyên cần, XP, huy hiệu
 */

const mkDb = (att) => ({
  today: '2026-08-01',
  month: '2026-08',
  members: [
    { id: 'm1', name: 'A', gender: 'nam', level: 'TB', active: true, joinedAt: '2026-01-01' },
    { id: 'm2', name: 'B', gender: 'nu', level: 'TB', active: true, joinedAt: '2026-01-01' },
    { id: 'm3', name: 'C', gender: 'nam', level: 'TB', active: true, joinedAt: '2026-01-01' },
  ],
  guests: [],
  sessionGuests: [],
  guestPrices: [{ level: 'TB', nam: 50000, nu: 40000 }],
  club: { memberExtraDiscount: 0, hasMemberExtraDiscount: false },
  groups: [{ id: 'ALL', name: 'CLB' }],
  roster: {},
  dues: [],
  // Không có scheduleId -> buổi đột xuất -> ai có mặt thì phải trả tiền như khách
  sessions: [{ id: 's1', date: '2026-08-10', groupId: 'ALL', status: 'open', courts: [{ from: '18:00', to: '20:00' }] }],
  attendance: { s1: att },
  courts: [],
  matches: [],
})

test('Nghỉ không báo — tiền và sân tách bạch', async (t) => {
  await t.test('1. Hai vị từ khác nhau đúng một chỗ: noshow', () => {
    assert.equal(isCharged('noshow'), true, 'Nghỉ không báo thì sân đã đặt, tiền đã mất — vẫn phải trả')
    assert.equal(isPresent('noshow'), false, 'Nhưng không ra sân, nên không được tính là đã đi tập')

    // Ba trạng thái còn lại phải giống hệt nhau ở cả hai vị từ, nếu không là đổi luật cũ.
    ;[true, false, 'extra', undefined].forEach((v) => {
      assert.equal(isCharged(v), isPresent(v), `Trạng thái ${JSON.stringify(v)} không được đổi nghĩa`)
    })
  })

  await t.test('2. Người nghỉ không báo VẪN sinh dòng công nợ', () => {
    // Đây là lý do cả thay đổi này tồn tại: quản trò phải đánh dấu được người không đến
    // mà KHÔNG mất khoản thu của buổi đó.
    const db = mkDb({ m1: true, m2: 'noshow', m3: false })
    const { add, remove } = adhocCharges(db, db.sessions[0], db.attendance.s1)

    const ids = add.map((r) => r.memberId).sort()
    assert.deepEqual(ids, ['m1', 'm2'], 'Thiếu m2 nghĩa là đánh dấu nghỉ không báo làm bốc hơi tiền buổi của người đó')
    assert.ok(add.every((r) => r.price > 0), 'Dòng thu phải có giá, không thì công nợ bằng 0')
    assert.deepEqual(remove, [])
  })

  await t.test('3. Chuyển từ Có mặt sang Nghỉ không báo KHÔNG gỡ dòng thu đang có', () => {
    // Quản trò đánh dấu lại giữa buổi. Nếu adhocCharges đọc isPresent thì dòng thu chưa trả
    // của người đó bị xoá ngay lúc bấm — mất tiền im lặng, không ai thấy.
    const db = mkDb({ m1: true, m2: 'noshow' })
    db.sessionGuests = [
      { id: 'sg1', sessionId: 's1', memberId: 'm1', guestId: null, price: 50000, paid: false },
      { id: 'sg2', sessionId: 's1', memberId: 'm2', guestId: null, price: 40000, paid: false },
    ]
    const { add, remove } = adhocCharges(db, db.sessions[0], db.attendance.s1)
    assert.deepEqual(add, [], 'Hai người đã có dòng thu rồi, không được sinh thêm')
    assert.deepEqual(remove, [], 'Xoá dòng thu của người nghỉ không báo là mất tiền buổi đó')
  })

  await t.test('4. Báo vắng TRƯỚC thì vẫn được gỡ dòng thu như cũ', () => {
    // Luật cũ không được đổi: báo trước thì không phải trả.
    const db = mkDb({ m1: true, m2: false })
    db.sessionGuests = [{ id: 'sg2', sessionId: 's1', memberId: 'm2', guestId: null, price: 40000, paid: false }]
    const { remove } = adhocCharges(db, db.sessions[0], db.attendance.s1)
    assert.deepEqual(remove, ['sg2'], 'Người báo vắng trước mà vẫn bị thu là thu sai')
  })

  await t.test('5. Đầu người để CHIA TIỀN sân có tính người nghỉ không báo', () => {
    const db = mkDb({ m1: true, m2: 'noshow', m3: false })
    assert.equal(presentCount(db, db.sessions[0]), 2, 'Chia tiền sân cho 1 người thay vì 2 là mỗi người gánh gấp đôi')
    assert.equal(headCount(db, db.sessions[0]), 2)
    assert.equal(sessionMembers(db, db.sessions[0]).some((m) => m.id === 'm2'), true, 'Biến mất khỏi danh sách buổi là không thu được tiền')
  })

  await t.test('6. Nhưng KHÔNG được xếp lên sân', () => {
    const db = mkDb({ m1: true, m2: 'noshow', m3: false })
    const keys = sessionPlayers(db, db.sessions[0]).map((p) => p.key)
    assert.deepEqual(keys, ['m1'], 'Xếp sân cho người không có mặt là quản trò gọi tên một người không ở đó')
  })
})
