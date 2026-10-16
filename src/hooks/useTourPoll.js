import { useEffect } from 'react'
import cfg from '#config/app.js'

/**
 * Gọi `poll` mỗi `ms` khi tab đang mở; quay lại tab thì gọi ngay.
 * Supabase free: poll thay realtime, tab ẩn thì không tốn lượt (docs/TOURNAMENT_PLAN.md §4.4).
 * Dùng cho bảng trận của giải (mặc định `tournament.pollMs`) và màn ghi sân (`sync.courtPollMs`).
 * @param {boolean} on  giải đã nạp và có lịch thi đấu / màn đang mở
 * @param {() => Promise<void>} poll  a.tourPoll · a.pollSession
 * @param {number} [ms]
 */
export function useTourPoll(on, poll, ms = cfg.tournament.pollMs) {
  useEffect(() => {
    if (!on) return undefined
    const tick = () => { if (!document.hidden) poll().catch(() => {}) }
    const timer = setInterval(tick, ms)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick) }
  }, [on, poll, ms])
}
