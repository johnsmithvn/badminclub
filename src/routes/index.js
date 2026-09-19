// Một bảng duy nhất map route key ↔ URL. Key là danh tính dùng cho quyền (logic/roles.js) và
// sidebar; path là URL người dùng thấy. Tên trang và mô tả lấy từ i18n theo key, không viết ở đây.

import { t } from '#i18n'

/** Route bên trong một CLB — cần đăng nhập VÀ đã chọn CLB. */
export const ROUTE_KEYS = [
  'home', 'myStats', 'calendar', 'sessions', 'session', 'assign', 'matches', 'leaderboard', 'badges', 'members',
  'debts', 'fund', 'profile', 'settings', 'schema',
]

/**
 * Route ngoài app — không cần CLB.
 *
 * `account` là hồ sơ TÀI KHOẢN (`profiles`), cố ý nằm ngoài CLB: một tài khoản dùng cho mọi
 * CLB, sửa nó không được đòi phải vào một CLB nào trước. Hồ sơ TRONG một CLB
 * (`club_members`) là màn khác — route `profile` bên dưới.
 */
export const PUBLIC_PATHS = {
  login: '/dang-nhap', register: '/dang-ky', clubs: '/clb', account: '/tai-khoan',
}

const PATHS = {
  home: '/',
  myStats: '/thanh-tich-cua-toi',
  calendar: '/lich-thang',
  sessions: '/buoi-tap',
  session: '/buoi-tap/:id',
  assign: '/chia-san',
  matches: '/tran-dau',
  leaderboard: '/bang-xep-hang',
  badges: '/danh-hieu',
  members: '/thanh-vien',
  debts: '/cong-no',
  fund: '/so-quy',
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

/** Key → URL. Route 'session' cần id, 'challenges' dẫn sang tab Sàn kèo. */
export function pathOf(key, id) {
  if (key === 'challenges') {
    return id ? `/tran-dau?tab=challenges&challengeId=${id}` : '/tran-dau?tab=challenges'
  }
  const p = PATHS[key]
  if (!p) return PATHS.home
  return id ? p.replace(':id', id) : p
}

/** URL hiện tại → route key. */

export function keyOfPath(pathname) {
  if (pathname.startsWith('/buoi-tap/')) return 'session'
  if (pathname === '/lich-co-dinh') return 'settings'
  const hit = ROUTE_KEYS.find((k) => PATHS[k] === pathname)
  return hit || 'home'
}

/**
 * Tạo URL điều hướng cho Web Push notification kèm tham số ?club=
 * Xử lý đầy đủ 6 refType: challenge, session, match, claim, debts, member
 */
export function buildPushUrl({ type, refType, refId, clubId }) {
  let path = '/'
  if (refType === 'challenge' || type?.startsWith('challenge_')) {
    path = pathOf('challenges', refId)
  } else if (refType === 'session' && refId) {
    path = pathOf('session', refId)
  } else if (refType === 'match') {
    path = refId ? `${pathOf('matches')}?tab=search&matchId=${refId}` : pathOf('matches')
  } else if (refType === 'claim') {
    path = pathOf('fund')
  } else if (refType === 'debts') {
    path = pathOf('debts')
  } else if (refType === 'member') {
    path = type === 'member_change_requested' ? pathOf('members') : pathOf('profile')
  }
  if (!clubId) return path
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}club=${clubId}`
}

