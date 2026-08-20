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
    club, courts, groups, members, guests, shuttleTypes, schedules, sessions,
    dues, backCredits, courtBills, manual, purchases, stockChecks, guestPrices,
    locks, rosterRows, changes, invites, joinRequests,
  ] = await Promise.all([
    supabase.from('clubs').select('*').eq('id', clubId).single(),
    of('courts'),
    of('member_groups', '*, group_courts(court_id)'),
    of('club_members', '*, club_member_groups(group_id), profile:profiles(*)'),
    of('guests'),
    of('shuttle_types'),
    of('schedules', '*, schedule_slots(*)'),
    of('sessions', SESSION_TREE),
    of('monthly_dues'),
    of('back_credits'),
    of('court_bills'),
    of('transactions').eq('ref_type', 'manual'),
    of('shuttle_purchases'),
    of('stock_checks'),
    of('guest_price_rules'),
    of('roster_locks'),
    supabase.from('group_memberships').select('*, member_groups!inner(club_id)')
      .eq('member_groups.club_id', clubId),
    supabase.from('member_changes').select('*, club_members!inner(club_id)')
      .eq('club_members.club_id', clubId),
    of('club_invites'),
    supabase.rpc('club_pending_requests', { p_club: clubId }),
  ])

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
      id: r.user_id, name: r.name, nick: r.nick, phone: r.phone,
      gender: r.gender, level: r.level, created_at: r.created_at,
    })
  })

  const raw = {
    club: unwrap(club),
    courts: unwrap(courts),
    groups: unwrap(groups),
    members: memberRows,
    guests: unwrap(guests),
    shuttleTypes: unwrap(shuttleTypes),
    schedules: unwrap(schedules),
    sessions: unwrap(sessions),
    dues: unwrap(dues),
    backCredits: unwrap(backCredits),
    courtBills: unwrap(courtBills),
    manual: unwrap(manual),
    purchases: unwrap(purchases),
    stockChecks: unwrap(stockChecks),
    guestPrices: unwrap(guestPrices),
    locks: unwrap(locks),
    rosterRows: unwrap(rosterRows),
    changes: unwrap(changes),
    invites: unwrap(invites),
    joinRequests: requests,
    users,
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

/** Nơi báo lỗi đồng bộ ra UI (AppContext gắn vào). */
export function setSyncErrorHandler(fn) { onError = fn }

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
      unwrap(await supabase.from('clubs').update(clubRow(db)).eq('id', cid))
      if (mine()) synced.club = club
    }
    for (const op of ops) await apply(op)

    // Chỉ ghi nhận ảnh chụp mới khi TẤT CẢ thao tác đã xong. Lỗi giữa chừng thì lần sau
    // diff lại từ ảnh chụp cũ và làm lại — mọi thao tác đều lặp lại được (upsert / delete).
    if (mine()) synced.rows = rows
  } catch (e) {
    console.error('[storage] đồng bộ thất bại', e)
    if (onError) onError(e)
  } finally {
    running = false
    if (pending) flush()
  }
}

async function apply(op) {
  const q = supabase.from(op.table)
  if (op.op === 'upsert') {
    return unwrap(op.conflict
      ? await q.upsert(op.rows, { onConflict: op.conflict })
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

const inList = (vals) => '(' + vals.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',') + ')'

/** Đổi CLB: quên ảnh chụp cũ để lần save sau không so nhầm sang dữ liệu CLB khác. */
export function reset() {
  clearTimeout(timer)
  pending = null
  synced = { clubId: null, rows: {}, club: null }
}
