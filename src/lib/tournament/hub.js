/**
 * @file hub.js
 * Luật của Hub giải đấu (Phase 1): nội dung thi đấu, vòng đời giải, đăng ký thí sinh, checklist.
 * Thuần: không React, không Supabase. Chữ hiển thị do UI dịch từ key.
 */

import { feeFor } from '#lib/tournament/finance.js'
import { initialRatingOf } from '#lib/rating.js'

/** Mỗi loại nội dung quyết định số người / đội và luật giới — UI không tự chọn hai cột này. */
export const EVENT_KINDS = {
  md: { teamSize: 2, genderRule: 'male' },
  wd: { teamSize: 2, genderRule: 'female' },
  xd: { teamSize: 2, genderRule: 'mixed' },
  ms: { teamSize: 1, genderRule: 'male' },
  ws: { teamSize: 1, genderRule: 'female' },
  open_doubles: { teamSize: 2, genderRule: 'any' },
  open_singles: { teamSize: 1, genderRule: 'any' },
}

/** Giới nào được vào nội dung. `mixed` nhận cả hai — ràng 1 nam + 1 nữ là việc của ghép cặp. */
export function canEnter(event, gender) {
  if (event.genderRule === 'male') return gender === 'nam'
  if (event.genderRule === 'female') return gender === 'nu'
  return gender === 'nam' || gender === 'nu'
}

/** Nội dung còn nhận / bỏ người không — khớp trigger `tournament_lineup_guard` ở DB. */
export const entriesOpen = (event) => event.status === 'draft' || event.status === 'pairing'

/** Thí sinh đang đăng ký, hợp giới với nội dung, chưa vào nội dung đó. */
export function eligibleNotEntered(tour, event) {
  const inEvent = new Set(tour.entries.filter((e) => e.eventId === event.id).map((e) => e.registrationId))
  return tour.registrations.filter((r) => r.status === 'registered' && canEnter(event, r.gender) && !inEvent.has(r.id))
}

/**
 * Vòng đời giải: nháp ⇄ mở đăng ký → đang diễn ra → kết thúc. Huỷ được khi chưa kết thúc.
 * Đi ngược từ `running` không có: lúc đó đã có trận, lùi lại là trận mồ côi.
 */
const FLOW = {
  draft: ['registration', 'cancelled'],
  registration: ['draft', 'running', 'cancelled'],
  running: ['finished', 'cancelled'],
  finished: [],
  cancelled: ['draft'],
}
export const nextStatuses = (status) => FLOW[status] || []
export const TOUR_STATUSES = Object.keys(FLOW)
/** Khớp CHECK `tournament_events.status` ở DB. */
export const EVENT_STATUSES = ['draft', 'pairing', 'drawn', 'running', 'finished']
/** Tab của Hub — thứ tự trên stepper, đúng handoff: ① Thí sinh → ② Thể thức → ③ Ghép cặp. */
export const HUB_TABS = ['overview', 'info', 'players', 'format', 'pairing']

/**
 * Dòng đăng ký mới của một thành viên. Giới, trình độ, rating, phí đều CHỤP tại lúc đăng ký:
 * đổi trình độ hay đổi phí sau đó không làm đổi cân bằng đã ghép hay khoản đã thu.
 * Chưa có Elo thì rating lấy mức khởi điểm theo trình độ (cùng hàm Elo dùng cho người mới).
 */
export function newRegistration({ tournament, member, ratings, levels }) {
  const rated = ratings?.[member.id]
  return {
    playerType: 'member',
    playerId: member.id,
    gender: member.gender,
    level: member.level || '',
    ratingSnapshot: rated && rated.gamesCount > 0 ? rated.rating : initialRatingOf(member.level, levels),
    fee: feeFor(tournament, member.gender),
    paid: false,
    paidAt: null,
    status: 'registered',
  }
}

/** Số thí sinh (đang đăng ký) của một nội dung, tách nam / nữ. */
export function eventCounts(tour, eventId) {
  const active = new Map(tour.registrations.filter((r) => r.status === 'registered').map((r) => [r.id, r]))
  const regs = tour.entries.filter((e) => e.eventId === eventId).map((e) => active.get(e.registrationId)).filter(Boolean)
  return {
    total: regs.length,
    male: regs.filter((r) => r.gender === 'nam').length,
    female: regs.filter((r) => r.gender === 'nu').length,
  }
}

/**
 * Khối "Trước khi bắt đầu" ở Tổng quan: việc nào đã xong, việc nào còn thiếu, và tab xử lý nó.
 * @returns {Array<{ key: string, done: boolean, tab: string, n?: number }>}
 */
export function hubChecklist(tour) {
  const active = tour.registrations.filter((r) => r.status === 'registered')
  const entered = new Set(tour.entries.map((e) => e.registrationId))
  const noEvent = active.filter((r) => !entered.has(r.id)).length
  const unpaid = active.filter((r) => !r.paid).length
  return [
    { key: 'events', done: tour.events.length > 0, tab: 'overview' },
    { key: 'players', done: active.length > 0, tab: 'players' },
    { key: 'entries', done: active.length > 0 && noEvent === 0, tab: 'players', n: noEvent },
    { key: 'fees', done: active.length > 0 && unpaid === 0, tab: 'players', n: unpaid },
    { key: 'prizes', done: tour.prizes.length > 0, tab: 'info' },
    { key: 'lineups', done: tour.events.length > 0 && tour.events.every((e) => !entriesOpen(e)), tab: 'pairing' },
    { key: 'schedules', done: tour.events.length > 0 && tour.events.every((e) => e.status === 'running' || e.status === 'finished'), tab: 'format' },
  ]
}
