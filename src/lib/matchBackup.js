// Sao lưu & khôi phục LỊCH SỬ TRẬN dạng JSON.
// Hàm thuần: nhận dữ liệu, trả dữ liệu mới. Không setState, không fetch, không import React.
//
// Trận đấu KHÔNG ảnh hưởng tiền (xem FEATURES.md) — file này chỉ đụng trục thi đấu.

export const MATCH_BACKUP_SCHEMA = 'badminclub_matches'
export const MATCH_BACKUP_VERSION = 2

const keysOf = (m) => (m?.playerKeys?.length ? m.playerKeys : [...(m?.teamA || []), ...(m?.teamB || [])])

/**
 * Dựng payload sao lưu. Kèm `members` / `guests` / `sessions` ở dạng THAM CHIẾU (chỉ để người đọc
 * file và script phân tích tra tên, không dùng để khôi phục) — nếu không thì mở file ra chỉ thấy
 * một rừng uuid, không đối chiếu được với bất cứ thứ gì.
 * Lọc theo khoảng ngày của BUỔI (không phải mốc `at` của trận): trận thuộc về buổi nào thì
 * tính theo ngày buổi đó, khớp với cách mùa giải và mọi màn thống kê chia khoảng. Bỏ trống
 * `range` là lấy tất cả.
 *
 * @param {Object} db
 * @param {{from?: string, to?: string, label?: string}} [range] - 'YYYY-MM-DD', bao gồm cả hai đầu
 * @returns {Object}
 */
export function buildMatchBackup(db = {}, range = null) {
  const from = range?.from || ''
  const to = range?.to || ''
  const dateOf = Object.fromEntries((db.sessions || []).map((x) => [x.id, x.date || '']))
  // So sánh chuỗi 'YYYY-MM-DD' là đủ và an toàn hơn Date.parse: không dính múi giờ, không lệch
  // một ngày ở ranh giới — đúng cách `monthSessions` và bộ lọc mùa đang làm.
  const inRange = (m) => {
    const d = dateOf[m.sessionId] || ''
    if (!d) return !from && !to   // trận mồ côi: chỉ lấy khi không lọc gì
    if (from && d < from) return false
    if (to && d > to) return false
    return true
  }

  const keptSessions = (db.sessions || []).filter((x) => {
    const d = x.date || ''
    if (from && d < from) return false
    if (to && d > to) return false
    return true
  })
  const keptSessionIds = new Set(keptSessions.map((x) => x.id))

  const matches = (db.matches || []).filter(inRange).map((m) => ({
    id: m.id,
    sessionId: m.sessionId,
    courtIdx: m.courtIdx ?? null,
    minutes: m.minutes ?? null,
    at: m.at ?? null,
    sets: m.sets || [],
    winnerTeam: m.winnerTeam ?? null,
    ratingEnabled: m.ratingEnabled !== false,
    initialRatingA: m.initialRatingA ?? null,
    initialRatingB: m.initialRatingB ?? null,
    eloDelta: m.eloDelta ?? null,
    playerKeys: keysOf(m),
  }))

  return {
    schema: MATCH_BACKUP_SCHEMA,
    version: MATCH_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    clubName: db.club?.name || '',
    clubCode: db.club?.code || '',
    matchCount: matches.length,
    // Ghi lại đã lọc gì: mở file ra phải biết ngay trong đó là toàn bộ hay một khoảng.
    range: (from || to) ? { from, to, label: range?.label || '' } : null,
    matches,
    ref: {
      levels: db.levels || [],
      members: (db.members || []).map((x) => ({ id: x.id, name: x.name, level: x.level, gender: x.gender, active: x.active !== false })),
      guests: (db.guests || []).map((x) => ({ id: x.id, name: x.name, level: x.level, gender: x.gender })),
      // Sân của buổi: cần để biết TRẦN CỨNG số trận. 2 sân × 2 tiếng cho gấp đôi lượt so với
      // 1 sân, nên "trận/buổi" không so được giữa hai buổi nếu không biết buổi đó mấy sân.
      // Sân đã bán không sinh lượt nào — giữ cờ `sold` chứ đừng lọc sẵn.
      sessions: keptSessions.map((x) => ({
        id: x.id,
        date: x.date,
        status: x.status || '',
        courts: (x.courts || []).map((c) => ({ from: c.from || '', to: c.to || '', sold: !!c.sold })),
      })),
      // ĐIỂM DANH — thiếu nó thì không đo được công bằng lượt đánh: người đi tập mà không được
      // gọi trận nào sẽ VÔ HÌNH, vì không có dấu vết nào trong bảng trận.
      attendance: Object.fromEntries(
        keptSessions.map((x) => [x.id, (db.attendance || {})[x.id] || {}]).filter(([, v]) => Object.keys(v).length)
      ),
      // Khách khai trình độ theo TỪNG BUỔI; `guests.level` chỉ là mức mặc định.
      sessionGuests: (db.sessionGuests || []).filter((g) => keptSessionIds.has(g.sessionId)).map((g) => ({
        id: g.id, sessionId: g.sessionId, guestId: g.guestId || null, memberId: g.memberId || null,
        level: g.level || '', gender: g.gender || '',
      })),
    },
  }
}

/**
 * Soi file nhập. TẤT CẢ HOẶC KHÔNG GÌ CẢ: chỉ cần một lỗi là từ chối nguyên file, không ghi
 * một dòng nào. Trận đấu là gốc sinh ra Elo và điểm mùa của cả CLB — nhập nửa vời rồi mới phát
 * hiện sai thì phải replay lại toàn bộ, và không có đường lùi.
 *
 * Lỗi trả về dạng KEY i18n + tham số, để hàm này test được mà không cần dựng i18n.
 *
 * @param {Object} data - nội dung file đã JSON.parse
 * @param {Object} db - CLB đích
 * @returns {{ok: boolean, error?: string, params?: Object, matches?: Array, stats?: Object}}
 */
export function validateMatchBackup(data, db = {}) {
  // Không có dấu nhận dạng thì đây là JSON của thứ khác — dừng, đừng đoán.
  if (!data || data.schema !== MATCH_BACKUP_SCHEMA) {
    return { ok: false, error: 'matchIo.errSchema' }
  }
  if (Number(data.version) > MATCH_BACKUP_VERSION) {
    return { ok: false, error: 'matchIo.errVersion', params: { v: data.version, max: MATCH_BACKUP_VERSION } }
  }

  // CLB đã có trận thì chặn ngay, không gộp, không thay. Gộp thì phải định nghĩa xử lý trùng id,
  // thay thì xoá mất mọi trận ghi sau lần export — cả hai đều hỏng âm thầm.
  const existing = (db.matches || []).length
  if (existing > 0) {
    return { ok: false, error: 'matchIo.errNotEmpty', params: { n: existing } }
  }

  const matches = Array.isArray(data.matches) ? data.matches : null
  if (!matches) return { ok: false, error: 'matchIo.errNoMatches' }
  if (!matches.length) return { ok: false, error: 'matchIo.errEmptyFile' }

  const sessionIds = new Set((db.sessions || []).map((x) => x.id))
  const playerIds = new Set([
    ...(db.members || []).map((x) => x.id),
    ...(db.guests || []).map((x) => x.id),
  ])

  const missingSessions = new Set()
  const missingPlayers = new Set()
  let malformed = 0

  matches.forEach((m) => {
    const keys = keysOf(m)
    if (!m?.id || !m?.sessionId || keys.length < 2) {
      malformed++
      return
    }
    if (!sessionIds.has(m.sessionId)) missingSessions.add(m.sessionId)
    keys.forEach((k) => { if (!playerIds.has(k)) missingPlayers.add(k) })
  })

  if (malformed > 0) {
    return { ok: false, error: 'matchIo.errMalformed', params: { n: malformed } }
  }
  // Trận trỏ sang buổi không tồn tại sẽ mồ côi: khoá ngoại session_id NOT NULL nên ghi là vỡ,
  // mà có ghi được thì màn Buổi tập cũng không bao giờ hiện ra.
  if (missingSessions.size > 0) {
    return { ok: false, error: 'matchIo.errMissingSessions', params: { n: missingSessions.size } }
  }
  // Người không còn trong CLB thì Elo và điểm mùa của trận đó không quy được về ai.
  if (missingPlayers.size > 0) {
    return { ok: false, error: 'matchIo.errMissingPlayers', params: { n: missingPlayers.size } }
  }

  const ids = new Set()
  for (const m of matches) {
    if (ids.has(m.id)) return { ok: false, error: 'matchIo.errDuplicateId', params: { id: m.id } }
    ids.add(m.id)
  }

  const rated = matches.filter((m) => m.ratingEnabled !== false).length
  return {
    ok: true,
    matches: matches.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      courtIdx: m.courtIdx ?? 0,
      minutes: m.minutes ?? 0,
      at: m.at ?? null,
      sets: m.sets || [],
      winnerTeam: m.winnerTeam ?? null,
      ratingEnabled: m.ratingEnabled !== false,
      initialRatingA: m.initialRatingA ?? null,
      initialRatingB: m.initialRatingB ?? null,
      eloDelta: m.eloDelta ?? null,
      playerKeys: keysOf(m),
      teamA: keysOf(m).slice(0, 2),
      teamB: keysOf(m).slice(2, 4),
    })),
    stats: {
      total: matches.length,
      rated,
      casual: matches.length - rated,
      sessions: new Set(matches.map((m) => m.sessionId)).size,
      clubName: data.clubName || '',
      exportedAt: data.exportedAt || '',
    },
  }
}
