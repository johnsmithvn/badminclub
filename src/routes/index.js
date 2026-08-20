// Một bảng duy nhất map route key ↔ URL. Key là danh tính dùng cho quyền (logic/roles.js) và
// sidebar; path là URL người dùng thấy. Tên trang và mô tả lấy từ i18n theo key, không viết ở đây.

import { t } from '#i18n'

/** Route bên trong một CLB — cần đăng nhập VÀ đã chọn CLB. */
export const ROUTE_KEYS = [
  'home', 'calendar', 'sessions', 'session', 'assign', 'schedules', 'members',
  'debts', 'fund', 'shuttles', 'profile', 'settings', 'schema',
]

/** Route ngoài app — không cần CLB. */
export const PUBLIC_PATHS = { login: '/dang-nhap', register: '/dang-ky', clubs: '/clb' }

const PATHS = {
  home: '/',
  calendar: '/lich-thang',
  sessions: '/buoi-tap',
  session: '/buoi-tap/:id',
  assign: '/chia-san',
  schedules: '/lich-co-dinh',
  members: '/thanh-vien',
  debts: '/cong-no',
  fund: '/so-quy',
  shuttles: '/kho-cau',
  profile: '/ca-nhan',
  settings: '/cai-dat',
  schema: '/so-do-du-lieu',
}

export const PAGES = ROUTE_KEYS.map((key) => ({ key, path: PATHS[key] }))

export const pageOf = (key) => ({
  key,
  path: PATHS[key] || PATHS.home,
  title: t('pages.' + (PATHS[key] ? key : 'home') + '.title'),
  desc: t('pages.' + (PATHS[key] ? key : 'home') + '.desc'),
})

/** Key → URL. Route 'session' cần id. */
export function pathOf(key, id) {
  const p = PATHS[key]
  if (!p) return PATHS.home
  return id ? p.replace(':id', id) : p
}

/** URL hiện tại → route key. */
/** Đường dẫn này có nằm ngoài phạm vi một CLB không. */
export const isPublicPath = (pathname) =>
  Object.values(PUBLIC_PATHS).indexOf(pathname) >= 0

export function keyOfPath(pathname) {
  if (pathname.startsWith('/buoi-tap/')) return 'session'
  const hit = ROUTE_KEYS.find((k) => PATHS[k] === pathname)
  return hit || 'home'
}
