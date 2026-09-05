// Điểm chạm mạng DUY NHẤT của app. Đọc/ghi Supabase cho MỘT CLB.
//
// Cách hoạt động:
//   load(clubId)  → select toàn bộ bảng của CLB → dbmap.toDb() → state `db`
//   save(db)      → dbmap.toRows() → so với ảnh chụp lần đồng bộ trước (dbmap.diff)
//                   → chỉ ghi/xoá đúng những dòng đã đổi
//
// Nhờ vậy 78 action trong appActions.js vẫn ghi state đồng bộ như cũ, UI phản hồi tức thì,
// còn việc xuống DB chạy nền sau `sync.debounceMs`. Đổi lại: hai người sửa CÙNG một dòng
// thì người ghi sau thắng. Chấp nhận được vì đơn vị ghi là từng dòng, không phải cả CLB.

import { supabase, unwrap } from '#supabase'
import { clubRow, diff, toDb, toRows } from '#contexts/dbmap.js'
import { monthOf } from '#utils/dates.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }

/** Ngày hôm nay theo đồng hồ máy, dạng 'YYYY-MM-DD' (không dùng toISOString để không lệch múi giờ). */
export function todayISO() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

/* ---------- ảnh chụp lần đồng bộ gần nhất ---------- */

let synced = { clubId: null, rows: {}, club: null }

/* ================= ĐỌC ================= */

const SESSION_TREE =
  '*, session_courts(*), attendances(*), session_guests(*), session_lineups(*),' +
  ' session_court_groups(*), matches(*, match_players(*))'

export async function load(clubId) {
  if (!supabase) throw new Error('Chưa cấu hình Supabase')
  const of = (table, sel) => supabase.from(table).select(sel || '*').eq('club_id', clubId)

  const [
    club, courts, groups, members, guests, schedules, sessions,
    dues, adjustments, courtBills, manual, guestPrices,
    locks, rosterRows, changes, levelRows, joinRequests,
    challenges, playerRatings, matchEdits, clubCalibration,
  ] = await Promise.all([
    supabase.from('clubs').select('*').eq('id', clubId).single(),
    of('courts'),
    of('member_groups', '*, group_courts(court_id)'),
    of('club_members', '*, club_member_groups(group_id), profile:profiles(*)'),
    of('guests'),
    of('schedules', '*, schedule_slots(*)'),
    of('sessions', SESSION_TREE),
    of('monthly_dues'),
    of('member_adjustments'),
    of('court_bills'),
    of('transactions').eq('ref_type', 'manual'),
    of('guest_price_rules'),
    of('roster_locks'),
    supabase.from('group_memberships').select('*, member_groups!inner(club_id)')
      .eq('member_groups.club_id', clubId),
    supabase.from('member_changes').select('*, club_members!inner(club_id)')
      .eq('club_members.club_id', clubId),
    // Bảng con không có `club_id` → join lên cha để lọc, đúng khuôn `group_memberships`.
    supabase.from('member_levels').select('*, club_members!inner(club_id)')
      .eq('club_members.club_id', clubId),
    supabase.rpc('club_pending_requests', { p_club: clubId }),
    of('challenges', '*, challenge_players(*)'),
    of('player_ratings'),
    of('match_edits'),
    of('club_calibration'),
  ])

  const clubRowRaw = unwrap(club)
  // DB dựng từ trước mà chưa áp 0003 thì thiếu clubs.levels và RPC club_pending_requests.
  // Nói thẳng ra thay vì chạy nửa vời rồi lỗi rải rác khắp nơi.
  if (!Object.prototype.hasOwnProperty.call(clubRowRaw, 'levels')) {
    throw new Error(t('sync.needMigrate'))
  }
  const memberRows = unwrap(members)
  const requests = joinRequests.error ? [] : (joinRequests.data || [])

  // Tài khoản thấy được: người đã ghép vào CLB + người đang xin vào (RPC trả kèm hồ sơ).
  const users = []
  const seen = new Set()
  memberRows.forEach((m) => {
    if (!m.profile || seen.has(m.profile.id)) return
    seen.add(m.profile.id)
    users.push(m.profile)
  })
  requests.forEach((r) => {
    if (seen.has(r.user_id)) return
    seen.add(r.user_id)
    users.push({
      id: r.user_id, name: r.name, nick: r.nick, phone: r.phone, email: r.email,
      gender: r.gender, level: r.level, created_at: r.created_at,
    })
  })

  const raw = {
    club: clubRowRaw,
    courts: unwrap(courts),
    groups: unwrap(groups),
    members: memberRows,
    guests: unwrap(guests),
    schedules: unwrap(schedules),
    sessions: unwrap(sessions),
    dues: unwrap(dues),
    adjustments: unwrap(adjustments),
    courtBills: unwrap(courtBills),
    manual: unwrap(manual),
    guestPrices: unwrap(guestPrices),
    locks: unwrap(locks),
    rosterRows: unwrap(rosterRows),
    changes: unwrap(changes),
    // DB chưa chạy 0011 thì bảng chưa có: coi như chưa ai đổi trình độ, `levelOf` rơi về ô chờ cũ.
    levelRows: levelRows.error ? [] : (levelRows.data || []),
    joinRequests: requests,
    users,
    challenges: challenges.error ? [] : (challenges.data || []),
    playerRatings: playerRatings.error ? [] : (playerRatings.data || []),
    matchEdits: matchEdits.error ? [] : (matchEdits.data || []),
    clubCalibration: clubCalibration.error ? [] : (clubCalibration.data || []),
  }

  const today = todayISO()
  const db = { ...toDb(raw, { clubId }), clubId, today, month: monthOf(today) }

  // Ảnh chụp phải dựng LẠI từ `db` chứ không từ `raw`: có vậy load và save mới cùng một
  // hàm map, lệch nhau là lộ ra ngay ở lần save đầu chứ không âm thầm xoá dòng.
  synced = { clubId, rows: toRows(db, ctxOf(db)), club: JSON.stringify(clubRow(db)) }
  return db
}

const ctxOf = (db) => ({ clubId: db.clubId, memberIds: new Set(db.members.map((m) => m.id)) })

/* ================= GHI ================= */

let timer = null
let pending = null
let running = false
let onError = null
let onFatal = null

/** Nơi báo lỗi đồng bộ ra UI (AppContext gắn vào). */
export function setSyncErrorHandler(fn) { onError = fn }

/**
 * Nơi xử lý lỗi KHÔNG TỰ KHỎI (AppContext gắn vào — nó nạp lại CLB từ DB).
 *
 * Phải tách khỏi `onError` vì hai loại lỗi cần hai cách xử lý ngược nhau: lỗi mạng thì để yên,
 * lần save sau làm lại là xong; lỗi cố định thì làm lại bao nhiêu lần cũng hỏng.
 */
export function setSyncFatalHandler(fn) { onFatal = fn }

/**
 * Mã lỗi Postgres/PostgREST mà thử lại CÓ ăn thua — chờ một nhịp là qua.
 * Xếp nhầm cái nào vào đây là op hỏng kẹt lại trong hàng đợi mãi (xem `flush`); xếp nhầm ra
 * ngoài thì người dùng mất thay đổi vừa gõ chỉ vì DB bận một giây.
 */
const RETRY_CODES = new Set([
  '40001', // serialization_failure — hai giao dịch đụng nhau, chạy lại là xong
  '40P01', // deadlock_detected
  '55P03', // lock_not_available
  '57014', // query_canceled — statement timeout
  '53300', // too_many_connections
  '08000', '08003', '08006', // connection exception
  'PGRST301', // JWT hết hạn — supabase-js tự làm mới token rồi lần sau đi được
])

/**
 * Lỗi này thử lại có ăn thua không?
 *
 * Mất mạng thì `fetch` ném TypeError TRẦN, không có `code` — cái đó tự khỏi, cứ để lần save sau
 * làm lại. Có `code` nghĩa là Postgres/PostgREST đã trả lời hẳn hoi: '23503' khoá ngoại,
 * '42501' RLS chặn, '42703' thiếu cột, 'PGRST…' schema cache — dữ liệu hoặc lược đồ sai, chờ
 * bao lâu cũng thế, phải nạp lại từ DB thì hàng đợi mới thông.
 *
 * TRỪ nhóm `RETRY_CODES`: chúng cũng có `code` nhưng là sự cố nhất thời của DB, không phải lỗi
 * dữ liệu. Coi chúng là chí mạng thì mỗi lần DB bận một nhịp là người dùng mất thay đổi vừa gõ.
 */
export const isFatal = (e) => Boolean(e && e.code) && !RETRY_CODES.has(e.code)

/** Hẹn giờ đẩy thay đổi xuống DB. Gọi liên tục cũng chỉ ghi một lần sau debounce. */
export function save(db) {
  if (!supabase || !db || !db.clubId || db.clubId !== synced.clubId) return
  pending = db
  clearTimeout(timer)
  timer = setTimeout(flush, cfg.sync.debounceMs)
}

/** Đẩy ngay, không chờ debounce. Dùng trước khi rời CLB. */
export function flushNow() {
  clearTimeout(timer)
  return flush()
}

async function flush() {
  if (running || !pending) return
  const db = pending
  pending = null
  running = true
  // Đổi CLB giữa lúc đang ghi thì reset() đã đặt synced.clubId = null. Mọi lần ghi vào
  // `synced` dưới đây PHẢI kiểm lại cid, không thì ảnh chụp của CLB cũ đè lên CLB mới và
  // lần save kế tiếp sẽ xoá dữ liệu của CLB cũ.
  const cid = db.clubId
  const mine = () => synced.clubId === cid
  try {
    const rows = toRows(db, ctxOf(db))
    const ops = diff(synced.rows, rows)

    const club = JSON.stringify(clubRow(db))
    if (club !== synced.club) {
      const row = clubRow(db)
      let res = await supabase.from('clubs').update(row).eq('id', cid)
      if (res.error && (res.error.message?.includes('has_member_extra_discount') || res.error.message?.includes('member_extra_discount'))) {
        console.warn('[storage] DB chưa chạy migration 0024 (thiếu cột member_extra_discount). Bỏ qua 2 cột này để không chặn lưu cài đặt CLB.')
        const fallback = { ...row }
        delete fallback.has_member_extra_discount
        delete fallback.member_extra_discount
        res = await supabase.from('clubs').update(fallback).eq('id', cid)
      }
      unwrap(res)
      if (mine()) synced.club = club
    }
    for (const op of ops) await apply(op)

    // Chỉ ghi nhận ảnh chụp mới khi TẤT CẢ thao tác đã xong. Lỗi giữa chừng thì lần sau
    // diff lại từ ảnh chụp cũ và làm lại — mọi thao tác đều lặp lại được (upsert / delete).
    // ponytail: lỗi TẠM (mạng) thì làm lại là đúng, nhưng lỗi CỐ ĐỊNH (khoá ngoại, RLS chặn)
    // thì op hỏng nằm lại trong diff mãi và mọi thay đổi sau nó cũng không xuống được DB —
    // màn hình vẫn báo đã lưu. Nâng cấp khi cần: hoặc reload() đè state khi lỗi không phải
    // lỗi mạng, hoặc ghi nhận ảnh chụp từng phần theo op đã chạy xong.
    if (mine()) synced.rows = rows
  } catch (e) {
    console.error('[storage] đồng bộ thất bại', e)
    if (onError) onError(e)
    // Lỗi cố định mà cứ để đó thì op hỏng nằm lại trong diff MÃI, và mọi thay đổi sau nó cũng
    // không xuống được DB trong khi màn hình vẫn báo đã lưu — im lặng, không ai biết. Nhường
    // cho AppContext nạp lại từ DB: mất đúng thay đổi vừa hỏng, đổi lấy việc màn hình nói thật.
    if (isFatal(e) && onFatal) onFatal(e)
  } finally {
    running = false
    if (pending) flush()
  }
}

async function apply(op) {
  const q = supabase.from(op.table)
  if (op.op === 'upsert') {
    return unwrap(op.conflict
      ? await q.upsert(op.rows, { onConflict: op.conflict, ignoreDuplicates: Boolean(op.ignoreDuplicates) })
      : await q.insert(op.rows))
  }
  if (op.op === 'delIds') {
    return unwrap(await q.delete().in('id', op.ids))
  }
  // delScope: xoá trong phạm vi (buổi / nhóm / tháng), giữ lại những dòng còn dùng.
  let del = q.delete()
  Object.keys(op.scope).forEach((c) => { del = del.eq(c, op.scope[c]) })
  if (op.child && op.keep.length) del = del.not(op.child, 'in', inList(op.keep))
  return unwrap(await del)
}

// Danh sách cho toán tử `in` của PostgREST. Số để trần (cột int), chuỗi bọc nháy kép.
const inList = (vals) => '(' + vals.map((v) =>
  (typeof v === 'number' ? String(v) : '"' + String(v).replace(/"/g, '""') + '"')
).join(',') + ')'

/** Đổi CLB: quên ảnh chụp cũ để lần save sau không so nhầm sang dữ liệu CLB khác. */
export function reset() {
  clearTimeout(timer)
  pending = null
  synced = { clubId: null, rows: {}, club: null }
}
