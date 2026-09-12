// Quản lý theme (sáng / tối) của ứng dụng.
// Lưu trạng thái vào localStorage ('badminclub.theme') và gán attribute data-theme lên <html>.
// Hỗ trợ tự động nhận diện prefers-color-scheme từ hệ điều hành và đồng bộ giữa các tab.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const Ctx = createContext(null)

export const THEME_KEY = 'badminclub.theme'
export const THEME_MODE_KEY = 'badminclub.themeMode'

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

function getInitialThemeMode() {
  if (typeof window === 'undefined') return 'simple'
  try {
    const saved = localStorage.getItem(THEME_MODE_KEY)
    if (saved === 'glamorous' || saved === 'simple') return saved
  } catch {
    // Bỏ qua lỗi truy cập storage
  }
  return 'simple'
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme)
  const [themeMode, setThemeModeState] = useState(getInitialThemeMode)

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

  // Đồng bộ themeMode với thẻ <html> và localStorage
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('data-theme-mode', themeMode)
    try {
      localStorage.setItem(THEME_MODE_KEY, themeMode)
    } catch {
      // Bỏ qua lỗi ghi storage
    }
  }, [themeMode])

  // Lắng nghe thay đổi từ các tab trình duyệt khác
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e) => {
      if (e.key === THEME_KEY && (e.newValue === 'dark' || e.newValue === 'light')) {
        setThemeState(e.newValue)
      }
      if (e.key === THEME_MODE_KEY && (e.newValue === 'glamorous' || e.newValue === 'simple')) {
        setThemeModeState(e.newValue)
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

  const setThemeMode = useCallback((next) => {
    if (next === 'glamorous' || next === 'simple') {
      setThemeModeState(next)
    }
  }, [])

  const toggleThemeMode = useCallback(() => {
    setThemeModeState((prev) => (prev === 'glamorous' ? 'simple' : 'glamorous'))
  }, [])

  const value = useMemo(() => ({
    theme,
    isDark: theme === 'dark',
    toggleTheme,
    setTheme,
    themeMode,
    isGlamorous: themeMode === 'glamorous',
    setThemeMode,
    toggleThemeMode,
  }), [theme, toggleTheme, setTheme, themeMode, setThemeMode, toggleThemeMode])

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
      themeMode: 'simple',
      isGlamorous: false,
      setThemeMode: () => {},
      toggleThemeMode: () => {},
    }
  }
  return ctx
}
