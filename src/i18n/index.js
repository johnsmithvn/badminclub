// i18n — mọi chuỗi hiện ra cho người dùng phải đi qua t(). KHÔNG viết chữ tiếng Việt trong .jsx.
// Thêm ngôn ngữ: tạo src/i18n/<mã>.json cùng bộ key, import và thêm vào LOCALES bên dưới.

import app from '#config/app.json' with { type: 'json' }
import vi from '#i18n/vi.json' with { type: 'json' }

const LOCALES = { vi }

let locale = app.locale

export const setLocale = (l) => {
  if (!LOCALES[l]) throw new Error('Chưa có bộ chữ cho locale: ' + l)
  locale = l
}
export const getLocale = () => locale

const dig = (obj, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)

/**
 * Lấy chuỗi theo key, chèn biến dạng {{ten}}.
 *   t('toast.clubSwitched', { club: 'Phú Khê' })
 * Thiếu key thì trả về chính key và cảnh báo ở DEV — để lỗ hổng lộ ra, không im lặng.
 */
export function t(key, vars) {
  let s = dig(LOCALES[locale], key)
  if (s === undefined && locale !== app.locale) s = dig(LOCALES[app.locale], key)
  if (typeof s !== 'string') {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
      console.warn('[i18n] thiếu key: ' + key)
    }
    return key
  }
  if (!vars) return s
  return s.replace(/\{\{(\w+)\}\}/g, (m, name) => (vars[name] === undefined ? m : String(vars[name])))
}

/** Lấy cả một nhánh (dùng cho danh sách: t.list('assign.modes')). */
export const tBranch = (key) => dig(LOCALES[locale], key) || {}
