// Truy vết điểm mùa: tua dữ liệu về một thời điểm bằng lịch sử thay đổi (`audit_log`, migration
// 0070), tính lại bảng điểm mùa đúng như app lúc đó, và chỉ ra MỖI LẦN GHI làm điểm ai đổi bao nhiêu.
//
// Dùng cho backtest (`npm run backtest -- truy_vet.json --at … --vs-at …`), không có màn hình.
// HÀM THUẦN: không gọi Supabase, không React. Dữ liệu vào là file "Xuất dữ liệu truy vết":
//   { tables: { <tên bảng>: [dòng Postgres] }, audit: [dòng audit_log] }
//
// Bảng điểm dựng qua đúng `toDb` của app và `calculateSeasonLeaderboard` — tức là ĐÚNG con số màn
// hình hiện lúc đó (đọc số Elo lưu trong từng trận, không chạy lại Elo). Muốn thử "nếu tính lại Elo"
// thì chạy backtest thường trên file xuất trận.

import { toDb } from '#contexts/dbmap.js'
import { calculateSeasonLeaderboard } from '#lib/season.js'
import cfg from '#config/app.json' with { type: 'json' }

/** Các bảng file truy vết mang theo — đủ để dựng lại Elo và điểm mùa. */
export const TRACE_TABLES = [
  'clubs', 'club_members', 'member_levels', 'guests', 'sessions', 'session_guests', 'attendances',
  'matches', 'match_players', 'challenges', 'challenge_players', 'challenge_guests',
  'challenge_predictions', 'player_ratings', 'club_calibration',
]

// Khoá dòng — PHẢI trùng cách trigger `audit_row()` tính `row_id`.
const KEY = {
  member_levels: (r) => `${r.member_id}|${r.from_month}`,
  attendances: (r) => `${r.session_id}|${r.member_id}`,
}
export const rowKey = (table, row) => (KEY[table] ? KEY[table](row) : String(row.id))

const tsOf = (e) => Date.parse(e.changed_at)

const index = (tables) => {
  const idx = {}
  TRACE_TABLES.forEach((t) => {
    idx[t] = new Map((tables[t] || []).map((r) => [rowKey(t, r), { ...r }]))
  })
  return idx
}
const unindex = (idx) => Object.fromEntries(Object.entries(idx).map(([t, m]) => [t, [...m.values()]]))

/** Lùi MỘT thay đổi: thêm → bỏ dòng · sửa → trả giá trị cũ · xoá → dựng lại dòng. */
function undo(idx, e) {
  const m = idx[e.table_name]
  if (!m) return
  if (e.action === 'I') m.delete(e.row_id)
  else if (e.action === 'U') { const r = m.get(e.row_id); if (r) m.set(e.row_id, { ...r, ...e.old_data }) }
  else if (e.action === 'D') m.set(e.row_id, { ...(m.get(e.row_id) || {}), ...e.old_data })
}

/** Tiến MỘT thay đổi — ngược của `undo`. */
function redo(idx, e) {
  const m = idx[e.table_name]
  if (!m) return
  if (e.action === 'I') m.set(e.row_id, { ...(m.get(e.row_id) || {}), ...e.new_data })
  else if (e.action === 'U') { const r = m.get(e.row_id); if (r) m.set(e.row_id, { ...r, ...e.new_data }) }
  else if (e.action === 'D') m.delete(e.row_id)
}

/**
 * Dữ liệu tại thời điểm `atMs`: lùi mọi thay đổi xảy ra SAU đó, từ mới nhất về cũ nhất.
 * Thay đổi trước khi có lịch sử (trước khi chạy 0070) thì không lùi được — dữ liệu khi đó là
 * trạng thái sớm nhất mà lịch sử còn giữ.
 */
export function rewind(tables, audit, atMs) {
  const idx = index(tables)
  ;[...(audit || [])].filter((e) => tsOf(e) > atMs).sort((a, b) => b.id - a.id).forEach((e) => undo(idx, e))
  return unindex(idx)
}

/** Đưa bảng phẳng về đúng hình `storage.load()` đọc ra rồi qua `toDb` của app. */
export function tablesToDb(tables, clubId) {
  const by = (list, k) => {
    const m = new Map()
    ;(list || []).forEach((r) => { const v = r[k]; if (!m.has(v)) m.set(v, []); m.get(v).push(r) })
    return m
  }
  const playersOf = by(tables.match_players, 'match_id')
  const matchesOf = by(tables.matches, 'session_id')
  const attOf = by(tables.attendances, 'session_id')
  const sgOf = by(tables.session_guests, 'session_id')
  const cpOf = by(tables.challenge_players, 'challenge_id')
  const cgOf = by(tables.challenge_guests, 'challenge_id')
  const club = (tables.clubs || [])[0] || {}
  const raw = {
    club,
    members: tables.club_members || [],
    levelRows: tables.member_levels || [],
    guests: tables.guests || [],
    sessions: (tables.sessions || []).map((s) => ({
      ...s,
      attendances: attOf.get(s.id) || [],
      session_guests: sgOf.get(s.id) || [],
      matches: (matchesOf.get(s.id) || []).map((m) => ({ ...m, match_players: playersOf.get(m.id) || [] })),
    })),
    challenges: (tables.challenges || []).map((c) => ({
      ...c, challenge_players: cpOf.get(c.id) || [], challenge_guests: cgOf.get(c.id) || [],
    })),
    challengePredictions: tables.challenge_predictions || [],
    playerRatings: tables.player_ratings || [],
    clubCalibration: tables.club_calibration || [],
  }
  return { ...toDb(raw, { clubId: clubId || club.id }), clubId: clubId || club.id }
}

/** Mùa chứa thời điểm `atMs` (theo ngày bắt đầu / kết thúc); không có thì mùa đang mở. */
export function seasonAt(db, atMs, seasonId = null) {
  const list = db.seasons || []
  if (seasonId) return list.find((s) => s.id === seasonId || s.code === seasonId) || null
  const day = new Date(atMs).toISOString().slice(0, 10)
  return list.find((s) => s.startDate && s.startDate <= day && (!s.endDate || day <= s.endDate))
    || list.find((s) => s.active) || null
}

/** Bảng điểm mùa đúng như app hiện tại thời điểm `atMs` của dữ liệu `tables`. */
export function boardOf(tables, atMs, seasonId = null) {
  const db = tablesToDb(tables)
  const season = seasonAt(db, atMs, seasonId)
  if (!season) return { season: null, rows: [] }
  const lb = calculateSeasonLeaderboard(db, { ...season, referenceDate: new Date(atMs).toISOString() }).leaderboard
  return {
    season,
    rows: lb.map((r) => ({
      id: r.id, name: r.name, points: r.totalSeasonPoints, matches: r.matchesCount, wins: r.winsCount,
    })),
  }
}

/**
 * Tóm tắt một lần ghi (một `tx_id`) thành dữ liệu có cấu trúc — CLI tự viết thành câu.
 *   matchesAdded / matchesDeleted: dòng trận + người chơi (từ match_players cùng lần ghi)
 *   eloRewrites: số trận CHỈ đổi số Elo lưu trong trận (Tính lại toàn bộ / Huỷ / Sửa chạy lại Elo)
 *   scoreEdits: trận đổi tỉ số / đội thắng
 *   levelChanges: đổi trình độ thành viên / khách / mốc trình độ
 */
export function summarizeTx(entries) {
  const ELO_COLS = new Set(['initial_rating_a', 'initial_rating_b', 'elo_delta'])
  const counts = {}
  entries.forEach((e) => {
    const c = counts[e.table_name] || (counts[e.table_name] = { I: 0, U: 0, D: 0 })
    c[e.action] += 1
  })
  const playersOf = (matchId, side) => entries
    .filter((e) => e.table_name === 'match_players' && (e[side]?.match_id === matchId))
    .map((e) => e[side])
  const matchRows = entries.filter((e) => e.table_name === 'matches')
  return {
    txId: entries[0]?.tx_id ?? null,
    at: entries[0]?.changed_at ?? null,
    actor: entries[0]?.actor ?? null,
    counts,
    matchesAdded: matchRows.filter((e) => e.action === 'I')
      .map((e) => ({ ...e.new_data, players: playersOf(e.row_id, 'new_data') })),
    matchesDeleted: matchRows.filter((e) => e.action === 'D')
      .map((e) => ({ ...e.old_data, players: playersOf(e.row_id, 'old_data') })),
    eloRewrites: matchRows.filter((e) => e.action === 'U'
      && Object.keys(e.new_data || {}).every((k) => ELO_COLS.has(k))).length,
    scoreEdits: matchRows.filter((e) => e.action === 'U'
      && ('sets' in (e.new_data || {}) || 'winner_team' in (e.new_data || {})))
      .map((e) => ({ id: e.row_id, old: e.old_data, new: e.new_data })),
    levelChanges: entries.filter((e) => e.action !== 'D'
      && ((['club_members', 'guests'].includes(e.table_name) && e.action === 'U' && 'level' in (e.new_data || {}))
        || e.table_name === 'member_levels'))
      .map((e) => ({ table: e.table_name, id: e.row_id, from: e.old_data?.level ?? null, to: e.new_data?.level ?? null })),
    predictions: counts.challenge_predictions ? Object.values(counts.challenge_predictions).reduce((s, x) => s + x, 0) : 0,
    // Xoá kèo = xoá hẳn dòng kèo, phiếu cược bay theo (ON DELETE CASCADE) — điểm cược biến mất.
    challengesDeleted: entries.filter((e) => e.table_name === 'challenges' && e.action === 'D')
      .map((e) => ({ ...e.old_data, predictions: entries.filter((p) => p.table_name === 'challenge_predictions'
        && p.action === 'D' && p.old_data?.challenge_id === e.row_id).map((p) => p.old_data) })),
    // Trận rời khỏi kèo (kèo bị xoá → challenge_id về NULL): hết hệ số kèo ×2, điểm mùa trận đó đổi.
    unlinkedFromChallenge: matchRows.filter((e) => e.action === 'U' && 'challenge_id' in (e.new_data || {})
      && e.old_data?.challenge_id && !e.new_data.challenge_id).length,
    seasonConfig: entries.some((e) => e.table_name === 'clubs' && e.action === 'U' && 'seasons' in (e.new_data || {})),
  }
}

const deltaOf = (before, after) => {
  const b = new Map(before.rows.map((r) => [r.id, r.points]))
  const out = {}
  after.rows.forEach((r) => {
    const d = r.points - (b.get(r.id) ?? 0)
    if (d) out[r.id] = d
  })
  before.rows.forEach((r) => { if (!after.rows.some((x) => x.id === r.id) && r.points) out[r.id] = -r.points })
  return out
}

/**
 * So bảng điểm mùa tại hai mốc và CHIA CÔNG cho từng lần ghi ở giữa.
 *
 * Tua về mốc A, rồi áp lần lượt từng lần ghi (theo `tx_id`, đúng thứ tự xảy ra) cho tới mốc B;
 * sau mỗi lần ghi tính lại bảng điểm — phần chênh của từng người được ghi cho đúng lần ghi đó.
 * Tổng mọi bước luôn bằng B − A, nên không có điểm nào "trôi" không rõ nguồn. Bảng điểm ở mọi
 * bước tính cho CÙNG một mùa (mùa của mốc B, hoặc `seasonId`).
 *
 * @returns {{ season, before, after, steps: Array<{ summary, deltas: { [memberId]: number } }> }}
 */
export function explainChange(tables, audit, fromMs, toMs, seasonId = null) {
  const idx = index(rewind(tables, audit, fromMs))
  const season = seasonAt(tablesToDb(rewind(tables, audit, toMs)), toMs, seasonId)
  const sid = season?.id || season?.code || null
  const before = boardOf(unindex(idx), toMs, sid)

  const between = (audit || []).filter((e) => tsOf(e) > fromMs && tsOf(e) <= toMs).sort((a, b) => a.id - b.id)
  const groups = []
  const byTx = new Map()
  between.forEach((e) => {
    if (!byTx.has(e.tx_id)) { byTx.set(e.tx_id, []); groups.push(byTx.get(e.tx_id)) }
    byTx.get(e.tx_id).push(e)
  })

  const steps = []
  let prev = before
  groups.forEach((entries) => {
    entries.forEach((e) => redo(idx, e))
    const cur = boardOf(unindex(idx), toMs, sid)
    const deltas = deltaOf(prev, cur)
    if (Object.keys(deltas).length) steps.push({ summary: summarizeTx(entries), deltas })
    prev = cur
  })
  return { season, before, after: prev, steps }
}

/**
 * Đọc mốc thời gian gõ ở dòng lệnh. Có múi giờ (ISO đầy đủ) thì đọc nguyên; chỉ có ngày / ngày giờ
 * ("2026-10-16", "2026-10-16 14:00") thì hiểu là giờ CLB (`trace.timezone`).
 */
export function parseAt(text) {
  const s = String(text || '').trim()
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?$/)
  if (m) return Date.parse(`${m[1]}T${m[2] || '23:59:59'}${m[2] && m[2].length === 5 ? ':00' : ''}${cfg.trace?.timezone || 'Z'}`)
  return Date.parse(s)
}
