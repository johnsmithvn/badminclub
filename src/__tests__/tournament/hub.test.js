import test from 'node:test'
import assert from 'node:assert/strict'
import { EVENT_KINDS, canEnter, entriesOpen, nextStatuses, newRegistration, eventCounts, hubChecklist } from '#lib/tournament/hub.js'

const ev = (kind, status = 'draft') => ({ id: kind, kind, status, ...EVENT_KINDS[kind] })
const tourOf = (p = {}) => ({ events: [], registrations: [], entries: [], prizes: [], ...p })
const reg = (id, gender, p = {}) => ({ id, gender, paid: false, status: 'registered', ...p })

test('nội dung → số người và luật giới; ai được vào', () => {
  assert.deepEqual(EVENT_KINDS.xd, { teamSize: 2, genderRule: 'mixed' })
  assert.deepEqual(EVENT_KINDS.ms, { teamSize: 1, genderRule: 'male' })
  assert.equal(canEnter(ev('md'), 'nam'), true)
  assert.equal(canEnter(ev('md'), 'nu'), false, 'nữ vào đôi nam là sai luật giải')
  assert.equal(canEnter(ev('wd'), 'nam'), false)
  assert.equal(canEnter(ev('xd'), 'nu'), true)
  assert.equal(canEnter(ev('open_singles'), 'nam'), true)
  assert.equal(canEnter(ev('xd'), undefined), false, 'không rõ giới thì không cho vào')
})

test('bỏ / thêm người vào nội dung chỉ khi chưa chốt đội hình (khớp trigger DB)', () => {
  assert.equal(entriesOpen(ev('md', 'pairing')), true)
  assert.equal(entriesOpen(ev('md', 'drawn')), false, 'đã chốt mà bỏ tick được là rút người khỏi đội')
  assert.equal(entriesOpen(ev('md', 'running')), false)
})

test('vòng đời giải: không lùi từ đang diễn ra, không mở lại giải đã kết thúc', () => {
  assert.deepEqual(nextStatuses('draft'), ['registration', 'cancelled'])
  assert.ok(nextStatuses('registration').includes('draft'))
  assert.ok(!nextStatuses('running').includes('registration'), 'đã có trận mà lùi về đăng ký là trận mồ côi')
  assert.deepEqual(nextStatuses('finished'), [])
  assert.deepEqual(nextStatuses('unknown'), [])
})

test('đăng ký: chụp giới, trình độ, phí theo giới, rating (chưa đánh trận thì theo trình độ)', () => {
  const tournament = { feeMale: 200000, feeFemale: 150000 }
  const levels = ['Newbie', 'TBY', 'TB-', 'TB']
  const nam = { id: 'm1', gender: 'nam', level: 'TB' }
  const nu = { id: 'm2', gender: 'nu', level: 'TBY' }
  const ratings = { m1: { rating: 812, gamesCount: 30 }, m2: { rating: 999, gamesCount: 0 } }

  const r1 = newRegistration({ tournament, member: nam, ratings, levels })
  assert.equal(r1.fee, 200000)
  assert.equal(r1.ratingSnapshot, 812)
  assert.equal(r1.playerType, 'member')
  assert.equal(r1.paid, false)
  const r2 = newRegistration({ tournament, member: nu, ratings, levels })
  assert.equal(r2.fee, 150000, 'nữ đóng phí nữ')
  assert.notEqual(r2.ratingSnapshot, 999, 'rating chưa qua trận nào là số mặc định, không phản ánh trình')
  assert.equal(typeof r2.ratingSnapshot, 'number')
})

test('đếm thí sinh của nội dung: bỏ người đã rút, tách nam / nữ', () => {
  const tour = tourOf({
    registrations: [reg('a', 'nam'), reg('b', 'nu'), reg('c', 'nam', { status: 'withdrawn' })],
    entries: [{ eventId: 'xd', registrationId: 'a' }, { eventId: 'xd', registrationId: 'b' },
      { eventId: 'xd', registrationId: 'c' }, { eventId: 'md', registrationId: 'a' }],
  })
  const pick = ({ total, male, female }) => ({ total, male, female })
  assert.deepEqual(pick(eventCounts(tour, 'xd')), { total: 2, male: 1, female: 1 })
  assert.deepEqual(pick(eventCounts(tour, 'md')), { total: 1, male: 1, female: 0 })
})

test('đếm thẻ nội dung: số khách, số đội đủ người / số đội lập được (handoff "x/y cặp đủ")', () => {
  const tour = tourOf({
    events: [ev('xd'), ev('md'), ev('ms')],
    registrations: [reg('a', 'nam'), reg('b', 'nu', { playerType: 'guest' }), reg('c', 'nam'), reg('d', 'nam')],
    entries: ['a', 'b', 'c'].map((id) => ({ eventId: 'xd', registrationId: id }))
      .concat(['a', 'c', 'd'].map((id) => ({ eventId: 'md', registrationId: id })), [{ eventId: 'ms', registrationId: 'a' }]),
    teams: [{ id: 't1', eventId: 'xd' }, { id: 't2', eventId: 'md' }],
    teamPlayers: [{ teamId: 't1', registrationId: 'a' }, { teamId: 't1', registrationId: 'b' }, { teamId: 't2', registrationId: 'c' }],
  })
  const xd = eventCounts(tour, 'xd')
  assert.equal(xd.guests, 1)
  assert.equal(xd.full, 1)
  assert.equal(xd.slots, 1, 'nam nữ: min(2 nam, 1 nữ)')
  const md = eventCounts(tour, 'md')
  assert.equal(md.full, 0, 'đội t2 mới có 1 người')
  assert.equal(md.slots, 1, '3 người → 1 đôi')
  assert.deepEqual([eventCounts(tour, 'ms').full, eventCounts(tour, 'ms').slots], [1, 1], 'đơn: mỗi người một đội')
})

test('checklist "Trước khi bắt đầu": chỉ việc chặn giải chạy; giải rỗng thiếu hết; đủ thì xong hết', () => {
  const empty = hubChecklist(tourOf())
  assert.ok(empty.every((c) => !c.done), 'giải chưa có gì mà báo xong mục nào là sai')

  const partial = hubChecklist(tourOf({
    events: [ev('md')],
    registrations: [reg('a', 'nam', { paid: true, fee: 100 }), reg('b', 'nam', { fee: 100 }), reg('x', 'nam', { status: 'withdrawn', fee: 100 })],
    entries: [{ eventId: 'md', registrationId: 'a' }],
  }))
  const byKey = Object.fromEntries(partial.map((c) => [c.key, c]))
  assert.equal(byKey.events.done, true)
  assert.equal(byKey.entries.done, false)
  assert.equal(byKey.entries.n, 1, 'b chưa chọn nội dung; x đã rút không tính')
  assert.equal(byKey.fees.n, 1)
  assert.equal(byKey.fees.tab, 'players')
  assert.equal(byKey.prizes, undefined, 'giải thưởng không chặn giải chạy — không nằm trong checklist')

  assert.equal(byKey.lineups.done, false, 'nội dung còn nháp = chưa chốt đội hình')
  assert.equal(byKey.schedules.tab, 'format')

  const full = hubChecklist(tourOf({
    events: [ev('md', 'running')], prizes: [{ id: 'p' }],
    registrations: [reg('a', 'nam', { paid: true })],
    entries: [{ eventId: 'md', registrationId: 'a' }],
  }))
  assert.ok(full.every((c) => c.done))

  // Giải miễn phí: không có dòng thu phí (không có gì để thu).
  const free = hubChecklist(tourOf({ events: [ev('md')], registrations: [reg('a', 'nam', { fee: 0 })], entries: [] }))
  assert.equal(free.some((c) => c.key === 'fees'), false)
})
