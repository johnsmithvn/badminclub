// Mùa đã chốt: nạp bảng chốt (0073) khi màn hình mở mùa đó.
// Trả `true` khi đang chờ — lúc đó màn hình KHÔNG được tính lại từ trận, vì đó chính là con số
// đã trôi mà bảng chốt sinh ra để thay.

import { useEffect } from 'react'
import { useApp } from '#contexts/AppContext.jsx'
import { seasonKeyOf } from '#lib/season.js'

export function useSeasonStandings(season) {
  const { db, a } = useApp()
  const key = season?.frozenAt ? seasonKeyOf(season) : null
  useEffect(() => {
    if (key) a.loadSeasonStandings(key)
  }, [key, a])
  return Boolean(key && !db?.seasonStandings?.[key])
}
