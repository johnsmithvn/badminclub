// Hook kiểm tra breakpoint màn hình di động (<= 768px).
// An toàn trên cả Node SSR / Vitest / browser.

import { useEffect, useState } from 'react'

export function useMobile(breakpoint = 768) {
  if (typeof window === 'undefined') return false

  const [isMobile, setIsMobile] = useState(() => {
    if (!window.matchMedia) return false
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const handler = (e) => setIsMobile(e.matches)
    if (mq.addEventListener) {
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    } else if (mq.addListener) {
      mq.addListener(handler)
      return () => mq.removeListener(handler)
    }
  }, [breakpoint])

  return isMobile
}
