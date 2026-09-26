/**
 * @file hub.js
 * Luật của Hub giải đấu (Phase 1): nội dung thi đấu, vòng đời giải, đăng ký thí sinh, checklist.
 * Thuần: không React, không Supabase. Chữ hiển thị do UI dịch từ key.
 */

import { feeFor } from '#lib/tournament/finance.js'
import { initialRatingOf } from '#lib/rating.js'
import { playerName } from '#lib/money.js'

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
  cancelled: ['draft', 'registration'],
}
export const nextStatuses = (status) => FLOW[status] || []
export const TOUR_STATUSES = Object.keys(FLOW)
/** Khớp CHECK `tournament_events.status` ở DB. */
export const EVENT_STATUSES = ['draft', 'pairing', 'drawn', 'running', 'finished']
/**
 * Tab của Hub — thứ tự trên stepper: ① Thí sinh → ② Ghép cặp. Mẫu thể thức, luật, bốc thăm, tạo lịch đều đã
 * dời sang Sơ đồ thi đấu (FlowCanvas) — bỏ tab "Thể thức" riêng để tránh 2 màn cùng sửa một thứ (2026-09-26).
 */
export const HUB_TABS = ['overview', 'info', 'players', 'pairing']

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

/**
 * Đăng ký của một khách ngoài CLB (`tournament_guests`). Khách không có Elo → rating khởi điểm theo trình độ
 * tự khai (cùng hàm Elo dùng cho thành viên mới), phí theo giới như thành viên.
 */
export function newGuestRegistration({ tournament, guest, levels }) {
  return {
    playerType: 'guest',
    playerId: guest.id,
    gender: guest.gender,
    level: guest.level || '',
    ratingSnapshot: initialRatingOf(guest.level, levels),
    fee: feeFor(tournament, guest.gender),
    paid: false,
    paidAt: null,
    status: 'registered',
  }
}

/** Tên VĐV của một đăng ký: khách ngoài lấy từ `tour.guests`, thành viên lấy như mọi màn khác (`playerName`). */
export function regName(tour, db, reg) {
  if (reg.playerType === 'guest') return (tour.guests || []).find((g) => g.id === reg.playerId)?.name || playerName(db, reg.playerId)
  return playerName(db, reg.playerId)
}

/**
 * Số thí sinh (đang đăng ký) của một nội dung: tách nam / nữ, số khách; và số đội ĐỦ người trên số đội có thể
 * lập từ số người đó (handoff "x/y cặp đủ": đơn = mỗi người một đội, nam nữ = min(nam, nữ), đôi = n/2).
 */
export function eventCounts(tour, eventId) {
  const event = tour.events.find((e) => e.id === eventId)
  const active = new Map(tour.registrations.filter((r) => r.status === 'registered').map((r) => [r.id, r]))
  const regs = tour.entries.filter((e) => e.eventId === eventId).map((e) => active.get(e.registrationId)).filter(Boolean)
  const male = regs.filter((r) => r.gender === 'nam').length
  const female = regs.filter((r) => r.gender === 'nu').length
  const size = event?.teamSize || 2
  const teams = (tour.teams || []).filter((t) => t.eventId === eventId)
  const full = size === 1
    ? regs.length
    : teams.filter((t) => (tour.teamPlayers || []).filter((p) => p.teamId === t.id && active.has(p.registrationId)).length === size).length
  return {
    total: regs.length,
    male,
    female,
    guests: regs.filter((r) => r.playerType === 'guest').length,
    full,
    slots: size === 1 ? regs.length : event?.genderRule === 'mixed' ? Math.min(male, female) : Math.floor(regs.length / 2),
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
  // Chỉ việc thật sự CHẶN giải chạy (plan: làm gọn đăng ký). Thu phí chỉ khi giải có phí; giải thưởng
  // không chặn gì (vẫn sửa ở tab Thông tin) nên không nằm trong checklist.
  const charged = active.filter((r) => r.fee > 0)
  const unpaid = charged.filter((r) => !r.paid).length
  return [
    { key: 'events', done: tour.events.length > 0, tab: 'overview' },
    { key: 'players', done: active.length > 0, tab: 'players' },
    { key: 'entries', done: active.length > 0 && noEvent === 0, tab: 'players', n: noEvent },
    ...(charged.length ? [{ key: 'fees', done: unpaid === 0, tab: 'players', n: unpaid }] : []),
    { key: 'lineups', done: tour.events.length > 0 && tour.events.every((e) => !entriesOpen(e)), tab: 'pairing' },
    // 'flow' không phải tab Hub — TournamentHub.jsx bắt riêng giá trị này để điều hướng sang trang Sơ đồ.
    { key: 'schedules', done: tour.events.length > 0 && tour.events.every((e) => e.status === 'running' || e.status === 'finished'), tab: 'flow' },
  ]
}
