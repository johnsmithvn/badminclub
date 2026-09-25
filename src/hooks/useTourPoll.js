import { useEffect } from 'react'
import cfg from '#config/app.json' with { type: 'json' }

/**
 * Nạp lại bảng trận của giải mỗi `tournament.pollMs` khi tab đang mở; quay lại tab thì nạp ngay.
 * Supabase free: poll thay realtime, tab ẩn thì không tốn lượt (docs/TOURNAMENT_PLAN.md §4.4).
 * @param {boolean} on  giải đã nạp và có lịch thi đấu
 * @param {() => Promise<void>} poll  a.tourPoll
 */
export function useTourPoll(on, poll) {
  useEffect(() => {
    if (!on) return undefined
    const tick = () => { if (!document.hidden) poll().catch(() => {}) }
    const timer = setInterval(tick, cfg.tournament.pollMs)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick) }
  }, [on, poll])
}
