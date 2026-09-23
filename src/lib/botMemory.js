// Adapter quản lý bộ nhớ kịch bản cá nhân (Personal Bot Memory Store).
//
// Giai đoạn MVP: Lưu trữ bằng localStorage theo từng thành viên.
// Thiết kế dạng Interface sạch sẽ để sẵn sàng chuyển sang đồng bộ server/DB sau này
// mà không cần sửa đổi Scenario Engine.

const STORAGE_PREFIX = 'badmin_bot_mem_'

/**
 * Lấy toàn bộ bộ nhớ của một thành viên.
 * @param {string} memberId
 * @returns {Array<Object>}
 */
export function getBotMemory(memberId) {
  if (!memberId || typeof window === 'undefined' || !window?.localStorage) return []
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${memberId}`)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}

/**
 * Lưu danh sách bộ nhớ của thành viên.
 */
function saveBotMemory(memberId, records) {
  if (!memberId || typeof window === 'undefined' || !window?.localStorage) return
  try {
    // Chỉ giữ tối đa 50 bản ghi gần nhất để tránh phình dung lượng
    const trimmed = (records || []).slice(-50)
    localStorage.setItem(`${STORAGE_PREFIX}${memberId}`, JSON.stringify(trimmed))
  } catch (e) {}
}

/**
 * Kiểm tra xem hôm nay thành viên đã thấy Modal Encounter chưa (Daily Cap: 1 Modal / Ngày).
 * @param {string} memberId
 * @param {number} [now]
 * @returns {boolean}
 */
export function hasSeenModalToday(memberId, now = Date.now()) {
  const memory = getBotMemory(memberId)
  const todayStr = new Date(now).toISOString().slice(0, 10)
  return memory.some((rec) => rec.mode === 'modal' && new Date(rec.shownAt || 0).toISOString().slice(0, 10) === todayStr)
}

/**
 * Kiểm tra xem kịch bản cùng loại này đã được hiển thị gần đây chưa (trong vòng N ngày).
 * @param {string} memberId
 * @param {string} scenarioKey
 * @param {number} withinDays
 * @param {number} [now]
 * @returns {boolean}
 */
export function hasShownRecently(memberId, key, withinDays = 3, now = Date.now()) {
  if (!memberId || !key) return false
  const memory = getBotMemory(memberId)
  const cutoff = now - withinDays * 24 * 3600 * 1000
  return memory.some((rec) => (rec.scenarioKey === key || rec.eventKey === key) && (rec.shownAt || 0) >= cutoff)
}

/**
 * Kiểm tra xem một eventKey cụ thể (ví dụ match:m1) đã được người dùng này xem hay chưa.
 * @param {string} memberId
 * @param {string} eventKey
 * @param {number} withinDays
 * @param {number} [now]
 * @returns {boolean}
 */
export function hasShownEvent(memberId, eventKey, withinDays = 7, now = Date.now()) {
  if (!memberId || !eventKey) return false
  const memory = getBotMemory(memberId)
  const cutoff = now - withinDays * 24 * 3600 * 1000
  return memory.some((rec) => rec.eventKey === eventKey && (rec.shownAt || 0) >= cutoff)
}

/**
 * Ghi nhận một lần hiển thị Encounter (Modal hoặc Card).
 * @param {string} memberId
 * @param {Object} encounter
 * @param {number} [now]
 */
export function recordEncounterShown(memberId, encounter, now = Date.now()) {
  const scenarioKey = encounter?.scenario?.scenarioKey || encounter?.scenarioKey
  if (!memberId || !scenarioKey) return
  const memory = getBotMemory(memberId)
  const newRec = {
    id: `enc_${now}_${Math.random().toString(36).slice(2, 7)}`,
    scenarioKey,
    eventKey: encounter.eventKey || encounter.scenario?.eventKey || null,
    mode: encounter.mode || 'card',
    shownAt: now,
    actionTaken: null,
    actionedAt: null,
    resolved: false,
    resolvedAt: null,
  }
  memory.push(newRec)
  saveBotMemory(memberId, memory)
}

/**
 * Ghi nhận hành động người dùng bấm nút tương tác từ kịch bản (ví dụ: bấm gạ kèo đòi nợ).
 * @param {string} memberId
 * @param {string} scenarioKey
 * @param {string} actionType
 * @param {number} [now]
 */
export function recordActionTaken(memberId, scenarioKey, actionType, now = Date.now()) {
  if (!memberId || !scenarioKey) return
  const memory = getBotMemory(memberId)
  // Tìm bản ghi gần nhất khớp scenarioKey
  for (let i = memory.length - 1; i >= 0; i--) {
    if (memory[i].scenarioKey === scenarioKey && !memory[i].actionTaken) {
      memory[i].actionTaken = actionType
      memory[i].actionedAt = now
      break
    }
  }
  saveBotMemory(memberId, memory)
}

/**
 * Đánh dấu một kịch bản đã được giải quyết xong (resolved), dùng cho Callback chuỗi sự kiện.
 * @param {string} memberId
 * @param {string} scenarioKey
 * @param {number} [now]
 */
export function resolveScenario(memberId, scenarioKey, now = Date.now()) {
  if (!memberId || !scenarioKey) return
  const memory = getBotMemory(memberId)
  for (let i = memory.length - 1; i >= 0; i--) {
    if (memory[i].scenarioKey === scenarioKey && !memory[i].resolved) {
      memory[i].resolved = true
      memory[i].resolvedAt = now
      break
    }
  }
  saveBotMemory(memberId, memory)
}

export const BotMemoryStore = {
  getMemory: getBotMemory,
  hasSeenModalToday,
  hasShownRecently,
  hasShownEvent,
  recordEncounterShown,
  recordActionTaken,
  resolveScenario,
}
