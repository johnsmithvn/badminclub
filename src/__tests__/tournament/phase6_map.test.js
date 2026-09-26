// Phase 6: ánh xạ khách ngoài + toạ độ canvas (0059), tên khách, chữ chuông "sắp tới lượt".
import test from 'node:test'
import assert from 'node:assert/strict'
import { toTour, tourRows } from '#contexts/dbmap.js'
import { newGuestRegistration, regName } from '#lib/tournament/hub.js'
import { resolveNotificationPayload } from '#lib/activity.js'
import { t } from '#i18n'

test('khách ngoài CLB: map 2 chiều, không mang tournament_id (danh sách của CLB, dùng lại qua nhiều giải)', () => {
  const tr = toTour({ tournament: { id: 't', club_id: 'c' }, guests: [{ id: 'g1', club_id: 'c', name: 'Khách A', gender: 'nu', level: 'TB', phone: null }] })
  assert.deepEqual(tr.guests, [{ id: 'g1', clubId: 'c', name: 'Khách A', gender: 'nu', level: 'TB', phone: '' }])
  const [row] = tourRows('tournament_guests', [{ ...tr.guests[0], tournamentId: 't' }])
  assert.deepEqual(row, { id: 'g1', club_id: 'c', name: 'Khách A', gender: 'nu', level: 'TB', phone: null })
})

test('toạ độ canvas: đi và về nguyên vẹn; chưa kéo là null (sơ đồ tự xếp)', () => {
  const tr = toTour({ tournament: { id: 't', club_id: 'c' }, stages: [{ id: 's', seq: 1, type: 'knockout', canvas_x: 120, canvas_y: null }] })
  assert.equal(tr.stages[0].canvasX, 120)
  assert.equal(tr.stages[0].canvasY, null)
  const [row] = tourRows('tournament_stages', tr.stages)
  assert.equal(row.canvas_x, 120)
  assert.equal(row.canvas_y, null)
})

test('đăng ký khách: loại guest, rating khởi điểm theo trình độ tự khai, phí theo giới; tên lấy từ danh sách khách', () => {
  const tournament = { feeMale: 100000, feeFemale: 80000 }
  const reg = newGuestRegistration({ tournament, guest: { id: 'g1', gender: 'nu', level: 'TB' }, levels: ['Yếu', 'TB', 'Khá'] })
  assert.equal(reg.playerType, 'guest')
  assert.equal(reg.playerId, 'g1')
  assert.equal(reg.fee, 80000)
  assert.ok(reg.ratingSnapshot > 0)
  const tour = { guests: [{ id: 'g1', name: 'Khách A' }] }
  assert.equal(regName(tour, { members: [], guests: [] }, reg), 'Khách A')
})

test('chuông sắp tới lượt: tên nội dung dịch từ key, có sân', () => {
  const p = resolveNotificationPayload({ type: 'tournament_match_court', payload: { kind: 'xd', court: 'Sân 2' } }, {})
  assert.equal(p.event, t('tournament.kind.xd'))
  assert.match(t('notification.tournament_match_court', p), /Đôi nam nữ.*Sân 2/)
  const r = resolveNotificationPayload({ type: 'tournament_match_ready', payload: { kind: 'md' } }, {})
  assert.match(t('notification.tournament_match_ready', r), /Đôi nam/)
})

test('màn Thí sinh: nhãn KHÁCH; giải miễn phí không có cột phí; có người nợ phí thì có nút "Tất cả đã đóng"', async () => {
  const { text, load, fakeActions } = await import('./_render.js')
  const { db, tour } = await import('./fixture.js')
  const { default: PlayersTab } = await load('#components/tournament/PlayersTab.jsx')
  const props = (tr) => ({ tour: tr, db, a: fakeActions(), canEdit: true, isMobile: false })

  const withGuest = tour({
    scope: 'open',
    guests: [{ id: 'g1', name: 'Khách Ngoài', gender: 'nam', level: '' }],
    registrations: [...tour().registrations, { id: 'rg', playerType: 'guest', playerId: 'g1', gender: 'nam', ratingSnapshot: 500, fee: 200000, paid: false, status: 'registered' }],
  })
  const s = text(PlayersTab, props(withGuest))
  assert.match(s, /Khách Ngoài .*KHÁCH/)
  assert.match(s, /Tất cả đã đóng \(3\)/, 'r2, r4 và khách chưa đóng')

  const free = tour({ feeMale: 0, feeFemale: 0, registrations: tour().registrations.map((r) => ({ ...r, fee: 0, paid: false })) })
  const f = text(PlayersTab, props(free))
  assert.doesNotMatch(f, /Lệ phí|Tất cả đã đóng/)
  assert.match(f, /miễn phí/)
})
