// Quản lý theme (sáng / tối) của ứng dụng.
// Lưu trạng thái vào localStorage ('badminclub.theme') và gán attribute data-theme lên <html>.
// Hỗ trợ tự động nhận diện prefers-color-scheme từ hệ điều hành và đồng bộ giữa các tab.
// Chế độ hiển thị (theme mode) đã bỏ lựa chọn "đơn giản" — app luôn chạy bản 14a "hào nhoáng".

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const Ctx = createContext(null)

export const THEME_KEY = 'badminclub.theme'
// Hoạt ảnh nền trời (SkyBackdrop) trên thiết bị này: 'off' = trời đứng yên cho nhẹ máy (Cài đặt → Chung).
export const SKY_MOTION_KEY = 'badminclub.skyMotion'

function getInitialSkyMotion() {
  try { return localStorage.getItem(SKY_MOTION_KEY) !== 'off' } catch { return true }
}

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light'
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'dark' || saved === 'light') return saved
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
  } catch {
    // Không cản trở trong môi trường sandbox hoặc private mode
  }
  return 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme)
  const [skyMotion, setSkyMotionState] = useState(getInitialSkyMotion)

  // Đồng bộ theme với thẻ <html>, <body> và localStorage
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.colorScheme = theme
    if (document.body) {
      document.body.classList.toggle('theme-dark', theme === 'dark')
    }
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // Bỏ qua lỗi ghi storage
    }
  }, [theme])

  // index.html đã gán sẵn data-theme-mode="glamorous" trước khi React mount (chống FOUC);
  // gán lại ở đây để phòng trường hợp script inline đó lỗi. Không ghi localStorage vì không ai đọc.
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('data-theme-mode', 'glamorous')
  }, [])

  // Lắng nghe thay đổi từ các tab trình duyệt khác (cho sáng / tối)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e) => {
      if (e.key === THEME_KEY && (e.newValue === 'dark' || e.newValue === 'light')) {
        setThemeState(e.newValue)
      }
      if (e.key === SKY_MOTION_KEY) setSkyMotionState(e.newValue !== 'off')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  const setTheme = useCallback((next) => {
    if (next === 'dark' || next === 'light') {
      setThemeState(next)
    }
  }, [])

  const setSkyMotion = useCallback((on) => {
    setSkyMotionState(on)
    try { localStorage.setItem(SKY_MOTION_KEY, on ? 'on' : 'off') } catch { /* private mode: chỉ áp dụng phiên này */ }
  }, [])

  const value = useMemo(() => ({
    theme,
    isDark: theme === 'dark',
    toggleTheme,
    setTheme,
    skyMotion,
    setSkyMotion,
  }), [theme, toggleTheme, setTheme, skyMotion, setSkyMotion])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme() {
  const ctx = useContext(Ctx)
  if (!ctx) {
    return {
      theme: 'light',
      isDark: false,
      toggleTheme: () => {},
      setTheme: () => {},
      skyMotion: true,
      setSkyMotion: () => {},
    }
  }
  return ctx
}
