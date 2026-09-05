// Quản lý theme (sáng / tối) của ứng dụng.
// Lưu trạng thái vào localStorage ('badminclub.theme') và gán attribute data-theme lên <html>.
// Hỗ trợ tự động nhận diện prefers-color-scheme từ hệ điều hành và đồng bộ giữa các tab.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const Ctx = createContext(null)

export const THEME_KEY = 'badminclub.theme'

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

  // Lắng nghe thay đổi từ các tab trình duyệt khác
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e) => {
      if (e.key === THEME_KEY && (e.newValue === 'dark' || e.newValue === 'light')) {
        setThemeState(e.newValue)
      }
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

  const value = useMemo(() => ({
    theme,
    isDark: theme === 'dark',
    toggleTheme,
    setTheme,
  }), [theme, toggleTheme, setTheme])

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
    }
  }
  return ctx
}
