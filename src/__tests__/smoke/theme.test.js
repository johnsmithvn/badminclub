// node --test src/__tests__/smoke/theme.test.js
// Kiểm tra tính đầy đủ của hệ thống Dark Mode:
// - Khóa lưu trữ THEME_KEY
// - Icon sun và moon trong Design System
// - Nhãn đa ngôn ngữ trong vi.json
// - CSS tokens cho dark theme
// - Pre-hydration script trong index.html

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ICONS } from '#components/ds/icons.js'
import vi from '#i18n/vi.json' with { type: 'json' }

test('Dark Mode - Khóa lưu trữ chuẩn hóa và ThemeContext', () => {
  const ctxSrc = readFileSync('src/contexts/ThemeContext.jsx', 'utf8')
  assert.ok(ctxSrc.includes("THEME_KEY = 'badminclub.theme'"), 'ThemeContext phải định nghĩa THEME_KEY badminclub.theme')
  assert.ok(ctxSrc.includes('ThemeProvider'), 'ThemeContext phải export ThemeProvider')
  assert.ok(ctxSrc.includes('useTheme'), 'ThemeContext phải export useTheme')
})

test('Dark Mode - Icon sun và moon trong Design System', () => {
  assert.ok(ICONS.sun, 'Icon sun phải tồn tại')
  assert.ok(ICONS.moon, 'Icon moon phải tồn tại')
  assert.equal(typeof ICONS.sun, 'object', 'Icon sun phải là component Lucide hợp lệ')
  assert.equal(typeof ICONS.moon, 'object', 'Icon moon phải là component Lucide hợp lệ')
})

test('Dark Mode - Nhãn đa ngôn ngữ i18n trong vi.json', () => {
  assert.ok(vi.common.themeLight, 'Phải có nhãn chuyển sang giao diện sáng')
  assert.ok(vi.common.themeDark, 'Phải có nhãn chuyển sang giao diện tối')
  assert.ok(vi.common.themeToggle, 'Phải có nhãn chuyển đổi giao diện')
})

test('Dark Mode - CSS tokens đầy đủ trong dark.css', () => {
  const darkCss = readFileSync('src/styles/tokens/dark.css', 'utf8')
  assert.ok(darkCss.includes('[data-theme="dark"]'), 'Phải hỗ trợ attribute selector [data-theme="dark"]')
  assert.ok(darkCss.includes('.theme-dark'), 'Phải hỗ trợ class selector .theme-dark')
  assert.ok(darkCss.includes('--surface-page'), 'Phải định nghĩa --surface-page')
  assert.ok(darkCss.includes('--surface-card'), 'Phải định nghĩa --surface-card')
  assert.ok(darkCss.includes('--text-primary'), 'Phải định nghĩa --text-primary')
})

test('Dark Mode - Chống nháy sáng (FOUC) trong index.html', () => {
  const html = readFileSync('index.html', 'utf8')
  assert.ok(html.includes('badminclub.theme'), 'index.html phải đọc key badminclub.theme')
  assert.ok(html.includes('data-theme'), 'index.html phải gán data-theme trước khi React load')
})
