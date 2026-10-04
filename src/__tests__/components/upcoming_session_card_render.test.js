// Thẻ "Buổi tới" (vé) — tab Sân đấu gộp phần tóm tắt buổi của CLB vào khe `club`, nằm giữa kèo và hàng nút.
import test from 'node:test'
import assert from 'node:assert/strict'
import { text, load } from '../tournament/_render.js'
import { createElement } from 'react'

const { default: UpcomingSessionCard } = await load('#components/home/personal/UpcomingSessionCard.jsx')
const session = {
  id: 's1', when: 'tonight', timeFrom: '18:00', timeTo: '20:00', venueName: 'Sân Phú Khê',
  attendees: [], goingCount: 9, isRegistered: true, myChallenges: [], otherChallenges: [],
}
const base = { session, isMobile: true, onViewSchedule() {}, onViewAssignment() {}, onChallenge() {}, onOpenChallenge() {} }

test('không truyền club: vé như cũ', () => {
  const s = text(UpcomingSessionCard, base)
  assert.match(s, /18:00/)
  assert.match(s, /Sân Phú Khê/)
  assert.doesNotMatch(s, /TÓM TẮT CLB/)
})

test('có club: phần CLB nằm sau thông tin vé và trước hàng nút', () => {
  const s = text(UpcomingSessionCard, { ...base, club: createElement('span', null, 'TÓM TẮT CLB') })
  const venue = s.indexOf('Sân Phú Khê')
  const club = s.indexOf('TÓM TẮT CLB')
  const buttons = s.lastIndexOf(text(UpcomingSessionCard, base).split(' ').slice(-3).join(' '))
  assert.ok(venue >= 0 && club > venue, 'CLB sau thông tin sân')
  assert.ok(buttons > club, 'hàng nút vẫn nằm cuối')
})

test('chưa có buổi: thẻ rỗng không hiện khe CLB', () => {
  assert.doesNotMatch(text(UpcomingSessionCard, { ...base, session: null, club: createElement('span', null, 'TÓM TẮT CLB') }), /TÓM TẮT CLB/)
})
