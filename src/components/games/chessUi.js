import { useEffect, useRef, useState } from 'react'
import { deadlineOf, leftOf } from '#lib/games/chessClock.js'
import { t } from '#i18n'

// Phần dùng chung của bàn Cờ vua / Cờ tướng (ChessStage.jsx): co giãn bàn, đồng hồ tổng, câu kết thúc ván.

/** "9:05" từ mili giây (làm tròn lên — còn 0,2 giây vẫn hiện 0:01). */
export const mmss = (ms) => {
  const s = Math.ceil(Math.max(0, ms) / 1000)
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}

/** Số giả ngẫu nhiên cố định theo n — vị trí bụi sáng / mảnh bung không nhảy giữa các lần vẽ. */
export const rnd = (n) => {
  const x = Math.sin(n * 12.9898 + 4.1) * 43758.5453
  return x - Math.floor(x)
}

/** Bàn vẽ ở cỡ thiết kế `designW` rồi thu nhỏ cho vừa khung chứa → [ref gắn vào khung, tỉ lệ ≤ 1]. */
export function useFit(designW) {
  const ref = useRef(null)
  const [k, setK] = useState(1)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(([e]) => setK(Math.min(1, e.contentRect.width / designW)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [designW])
  return [ref, k]
}

/**
 * Đồng hồ tổng mỗi bên (state.clock — chessClock.js) → [ms ghế 0, ms ghế 1] hoặc null nếu ván không có đồng hồ.
 * Quá hạn thì máy tự báo { timeout }: người tới lượt báo trước, đối thủ chờ thêm 2 giây phòng máy kia đã tắt; server
 * từ chối (lệch giờ) thì 4 giây thử lại một lần — cùng nhịp Ô ăn quan / Bài bịp.
 */
export function useChessClock(state, mySeat, onMove) {
  const due = deadlineOf(state)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (due == null) return undefined
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [due])
  const sent = useRef('')
  const seated = mySeat != null && !!onMove
  useEffect(() => {
    if (due == null || !seated) return
    const at = due + (state.turn === mySeat ? 300 : 2000)
    if (now < at) return
    const tag = state.ply + ':' + Math.floor((now - at) / 4000)
    if (sent.current === tag) return
    sent.current = tag
    onMove({ timeout: true })
  }, [due, seated, now, mySeat, state.turn, state.ply, onMove])
  return state.clock ? [0, 1].map((seat) => leftOf(state, seat, now)) : null
}

/**
 * Câu trên màn kết thúc ván → { title, sub } hoặc null nếu ván chưa xong. `result` = kết quả phòng (server xử thắng vì
 * đối thủ rời / mất kết nối; phòng máy: xin thua, hoà) — có thể null khi ván tự kết thúc theo luật (state.over).
 */
export function overOf({ state, result, mySeat, names, reasons }) {
  if (!state.over && !result) return null
  const draw = result ? !!result.draw : state.winner == null
  const winners = result?.winners ?? (state.winner == null ? [] : [state.winner])
  const title = draw ? t('games.draw')
    : mySeat != null ? t(winners.includes(mySeat) ? 'games.youWin' : 'games.youLose')
      : t('games.win', { name: winners.map((s) => names?.[s] || '').join(', ') })
  const sub = result?.resign ? t('games.chess.subResign')
    : result?.idle ? t('games.chess.subIdle')
      : result?.forfeit ? t('games.chess.subForfeit')
        : state.over ? t(reasons + state.reason)
          : draw ? t('games.chess.subAgreed') : ''
  return { title, sub }
}
