// Danh sách danh hiệu mà người dùng đã được xem modal chúc mừng, lưu theo từng CLB + từng
// thành viên trong localStorage.
//
// Ba nơi cùng đụng vào dữ liệu này: GlobalBadgeUnlockHost (listener toàn cục), ScoreModal và
// EditScoreModal (bắn modal ngay lúc nhập/sửa điểm). Trước đây mỗi nơi tự ghép chuỗi khoá và
// tự parse — lệch một ký tự là modal chúc mừng bung lại lần hai cho cùng một danh hiệu. Gom về
// đây để chỉ có một định dạng khoá duy nhất.

/**
 * Khoá lưu trữ cho một thành viên trong một CLB.
 * @returns {string|null} null khi chưa xác định được thành viên — người gọi bỏ qua, không ghi gì.
 */
export function seenBadgesKey(db, memberId) {
  if (!memberId) return null
  const clubId = db?.clubId || db?.id || 'default'
  return `badminclub_seen_badges_${clubId}_${memberId}`
}

/**
 * Đọc danh sách đã xem.
 * @returns {string[]|null} null nghĩa là CHƯA CÓ bản ghi hợp lệ (lần đầu chạy, storage bị tắt,
 * hoặc giá trị hỏng do đổi format / app khác cùng origin ghi đè). Người gọi phân biệt được
 * "chưa có bản ghi" với "có bản ghi rỗng" — hai trường hợp này xử lý khác nhau.
 */
export function readSeenBadges(key) {
  if (!key) return null
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Đánh dấu một danh hiệu là đã xem. Không ném lỗi khi storage bị tắt hoặc đầy. */
export function markBadgeSeen(key, badgeId) {
  if (!key || !badgeId) return
  try {
    const list = readSeenBadges(key) || []
    if (!list.includes(badgeId)) {
      list.push(badgeId)
      localStorage.setItem(key, JSON.stringify(list))
    }
  } catch {
    // storage bị tắt hoặc hết dung lượng — mất trạng thái "đã xem" không làm hỏng gì
  }
}
