// Đồng hồ bấm giờ sân: re-render mỗi cfg.clockTickMs, CHỈ khi có sân đang chạy.
// Tách ra hook để màn Chia sân không phải tự quản interval.

import { useEffect, useState } from 'react'
import cfg from '#config/app.json' with { type: 'json' }

/** @param active có sân nào đang bấm giờ không */
export function useClock(active) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => tick((n) => n + 1), cfg.clockTickMs)
    return () => clearInterval(id)
  }, [active])
}

/** Số phút đã chạy từ mốc bấm Bắt đầu. Tối thiểu 1 phút để không ghi trận 0 phút. */
export const elapsedMin = (startedAt) =>
  startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 60000)) : 0
