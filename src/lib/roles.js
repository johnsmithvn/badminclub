// Ba vai và quyền (owner, treasurer, member). Ma trận nằm ở src/config/permissions.json (tương ứng bảng role_permissions
// trong DB), nhãn và mô tả nằm ở src/i18n/<locale>.json. File này chỉ tra cứu.
// Ẩn UI chỉ là lớp thứ hai — backend PHẢI kiểm lại quyền.

import perm from '#config/permissions.json' with { type: 'json' }
import { t } from '#i18n'

export const ROLE_KEYS = perm.order
export const ROLES = perm.order.map((value) => ({ value, label: t('roles.' + value + '.label') }))

export const can = (role, what) => (perm.flags[role] || []).indexOf(what) >= 0
/** null = vào được tất cả route. */
export const allowedRoutes = (role) => perm.routes[role] || null
export const roleName = (r) => t('roles.' + r + '.label')
export const roleDesc = (r) => t('roles.' + r + '.desc')

/**
 * Vai được phép chọn ở ô "Xem như": chính vai của mình và các vai YẾU HƠN (order xếp mạnh
 * trước). Không cho tự nâng quyền: UI mở ra nhưng RLS ở Supabase vẫn chặn, người dùng chỉ
 * nhận được lỗi không hiểu.
 */
export const viewAsOptions = (myRole) => {
  const i = ROLE_KEYS.indexOf(myRole)
  return i < 0 ? ROLE_KEYS.slice() : ROLE_KEYS.slice(i)
}

/**
 * ID những người CÓ TRÁCH NHIỆM xử lý một loại việc — dùng làm người nhận thông báo cho các
 * yêu cầu chờ người khác duyệt (khai đã chuyển tiền → `money`, xin đổi hồ sơ → `members`).
 *
 * Lọc `userId` là cố ý: RLS của `notifications` đọc theo `club_members.user_id = auth.uid()`,
 * nên dòng gửi cho người chưa liên kết tài khoản KHÔNG ai đọc được — nó chỉ nằm đó chiếm chỗ
 * trong cửa sổ 100 dòng mà `storage.load()` lấy về, đẩy thông báo thật ra ngoài.
 */
export const membersWithPerm = (members, what) => (members || [])
  .filter((m) => m && m.active !== false && m.userId && can(m.role, what))
  .map((m) => m.id)

/** Route không được phép → về home, không hiện trang lỗi. */
export function effRoute(role, route) {
  const a = allowedRoutes(role)
  return a && a.indexOf(route) < 0 ? 'home' : route
}

/**
 * Bốn slot đầu đổi theo vai (dựa trên flag 'money'), slot 5 luôn là 'more' (Handoff §1.2 & §B3).
 * - can(role, 'money') -> home, sessions, debts, leaderboard, more
 * - ngược lại          -> home, sessions, leaderboard, profile, more
 */
export function footerSlots(role) {
  const canMoney = can(role, 'money')
  return canMoney
    ? ['home', 'sessions', 'debts', 'leaderboard', 'more']
    : ['home', 'sessions', 'leaderboard', 'profile', 'more']
}

