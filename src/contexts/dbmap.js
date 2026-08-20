// Map giữa state `db` của client và 30 bảng Postgres. HÀM THUẦN — không import React,
// không gọi Supabase. `storage.js` là chỗ duy nhất gọi mạng; file này chỉ đổi hình dữ liệu.
//
// Hai chiều:
//   toDb(raw, ctx)   dòng đọc từ Postgres  → state `db` của client
//   toRows(db, ctx)  state `db` của client → { tên bảng: [dòng] }
//
// `diff(prev, next)` so hai kết quả của toRows để biết phải ghi/xoá đúng những dòng nào.
// Nhờ vậy 78 action trong appActions.js không phải biết gì về Supabase.
//
// Bảng nào ghi theo cách nào — xem TABLES ở cuối file.

import cfg from '#config/app.json' with { type: 'json' }

/* ================= tiện ích đổi kiểu ================= */

/** 'HH:MM:SS' của Postgres → 'HH:MM' mà UI dùng. */
const hm = (v) => (v ? String(v).slice(0, 5) : '')
/** Chuỗi rỗng → null, để không nhét '' vào cột uuid. */
const uu = (v) => v || null
/** timestamptz → 'YYYY-MM-DD' (client chỉ giữ tới ngày). */
const dOf = (v) => (v ? String(v).slice(0, 10) : null)
const num = (v) => (v == null ? 0 : Number(v))

/** Khoá nhận diện người chơi trong lineup: member và guest dùng chung namespace ở client,
 *  nên xuống DB phải kèm player_type. */
const kindOf = (ctx, key) => (ctx.memberIds.has(key) ? 'member' : 'guest')

/* ================= Postgres → client ================= */

/**
 * @param raw dữ liệu đã fetch, xem storage.js#fetchClub
 * @param ctx { clubId }
 */
export function toDb(raw, ctx) {
  const club = raw.club || {}
  const levels = club.levels && club.levels.length ? club.levels : cfg.levelsDefault

  const courts = (raw.courts || []).map((c) => ({
    id: c.id, name: c.name, addr: c.address || '', price: num(c.price_per_hour), active: c.active,
  }))

  const groups = (raw.groups || []).map((g) => ({
    id: g.id, name: g.name, short: g.short || '', weekday: g.weekday,
    feeNam: num(g.fee_male), feeNu: num(g.fee_female),
    from: hm(g.start_time), to: hm(g.end_time), quota: g.quota, active: g.active,
    courtIds: (g.group_courts || []).map((x) => x.court_id),
  }))

  const members = (raw.members || []).map((m) => ({
    id: m.id, name: m.name, phone: m.phone || '', gender: m.gender, level: m.level,
    role: m.role, joined: m.joined_at, active: m.active, userId: m.user_id || null,
    linkedAt: dOf(m.linked_at), pendingLevel: m.pending_level || null,
    pendingLevelFrom: m.pending_level_from || null,
    groupIds: (m.club_member_groups || []).map((x) => x.group_id),
  }))

  const guests = (raw.guests || []).map((g) => ({
    id: g.id, name: g.name, gender: g.gender, level: g.level,
    phone: g.phone || '', invitedBy: g.invited_by || '',
  }))

  const schedules = (raw.schedules || []).map((s) => ({
    id: s.id, name: s.name, groupId: s.group_id, weekdays: s.weekdays || [],
    start: s.start_date, end: s.end_date || '', active: s.active,
    rows: (s.schedule_slots || []).map((r) => ({
      courtId: r.court_id, from: hm(r.start_time), to: hm(r.end_time),
    })),
  }))

  const attendance = {}
  const lineups = {}
  const courtGroups = {}
  const groupMode = {}
  const courtMin = {}
  const sessionGuests = []
  const matches = []

  const sessions = (raw.sessions || []).map((s) => {
    const rows = (s.session_courts || []).slice().sort((a, b) => a.court_index - b.court_index)
    rows.forEach((r) => {
      if (r.default_minutes == null) return
      courtMin[s.id] = { ...(courtMin[s.id] || {}), [r.court_index]: r.default_minutes }
    })

    const att = {}
    ;(s.attendances || []).forEach((a) => { att[a.member_id] = a.status === 'present' })
    if (Object.keys(att).length) attendance[s.id] = att

    const lu = {}
    ;(s.session_lineups || []).forEach((l) => { lu[l.slot] = l.player_id })
    if (Object.keys(lu).length) lineups[s.id] = lu

    const cg = {}
    ;(s.session_court_groups || []).forEach((g) => { cg[g.player_id] = g.court_index })
    if (Object.keys(cg).length) courtGroups[s.id] = cg

    if (s.group_mode) groupMode[s.id] = true

    ;(s.session_guests || []).forEach((g) => sessionGuests.push({
      id: g.id, sessionId: s.id, guestId: g.guest_id, level: g.level, gender: g.gender,
      price: num(g.price), paid: g.paid, invitedBy: g.invited_by || '',
    }))

    ;(s.matches || []).forEach((mt) => matches.push({
      id: mt.id, sessionId: s.id, courtIdx: mt.court_index, minutes: mt.minutes,
      at: mt.ended_at ? new Date(mt.ended_at).getTime() : 0,
      playerKeys: (mt.match_players || []).slice()
        .sort((a, b) => a.team - b.team).map((p) => p.player_id),
    }))

    return {
      id: s.id, date: s.date, groupId: s.group_id, scheduleId: s.schedule_id || null,
      status: s.status, note: s.note || '', shuttleTypeId: s.shuttle_type_id || null,
      shuttleMode: s.shuttle_mode, tubesOpened: s.tubes_opened, loose: s.loose_units,
      shuttleUsed: s.shuttle_used, shuttleEst: s.shuttle_est, closedAt: dOf(s.closed_at),
      courts: rows.map((r) => ({
        courtId: r.court_id, from: hm(r.start_time), to: hm(r.end_time),
        sold: r.is_sold, soldAmount: num(r.sold_amount), soldTo: r.sold_to || '', extra: r.is_extra,
      })),
    }
  }).sort((a, b) => (a.date < b.date ? -1 : 1))

  const roster = {}
  ;(raw.rosterRows || []).forEach((r) => {
    const m = roster[r.month] || (roster[r.month] = {})
    const g = m[r.group_id] || (m[r.group_id] = {})
    g[r.member_id] = r.state
  })

  const locked = {}
  ;(raw.locks || []).forEach((l) => { locked[l.month] = true })

  const backPaid = {}
  ;(raw.backCredits || []).forEach((b) => {
    if (b.paid) backPaid[b.month + ':' + b.group_id + ':' + b.member_id] = true
  })

  // Một dòng giá / trình độ, hai cột nam-nữ — đúng hình mà màn Cài đặt đang dùng.
  // Trình độ nào chưa có giá thì hiện 0 chứ không biến mất khỏi bảng.
  const priceOf = {}
  ;(raw.guestPrices || []).forEach((p) => { priceOf[p.level + '|' + p.gender] = num(p.price) })
  const guestPrices = levels.map((lv) => ({
    level: lv, nam: priceOf[lv + '|nam'] || 0, nu: priceOf[lv + '|nu'] || 0,
  }))

  return {
    club: {
      id: club.id, name: club.name, code: club.code,
      opening: num(club.opening_balance), openingDate: club.opening_date,
      openingBy: club.opening_by || '',
      bank: { holder: club.bank_holder || '', no: club.bank_no || '', bank: club.bank_name || '' },
      seeDebtEachOther: club.see_debt_each_other, seeFund: club.see_fund,
      roundUnit: club.round_unit, lockDay: club.lock_day, courtPayMode: club.court_pay_mode,
      linkModes: { code: club.allow_code_join, invite: club.allow_invite, phone: club.allow_phone_suggest },
      levels,
    },
    levels,
    courts, groups, members, guests, schedules, sessions,
    attendance, sessionGuests, lineups, courtGroups, groupMode, courtMin, matches,
    roster, locked, backPaid, guestPrices,

    shuttleTypes: (raw.shuttleTypes || []).map((s) => ({
      id: s.id, name: s.name, perTube: s.per_tube,
      pricePerTube: num(s.price_per_tube), active: s.active,
    })),
    dues: (raw.dues || []).map((d) => ({
      id: d.id, month: d.month, groupId: d.group_id, memberId: d.member_id,
      amount: num(d.amount), paid: d.paid, paidAt: d.paid_at || null,
      method: d.method || '', note: d.note || '',
    })),
    courtBills: (raw.courtBills || []).map((b) => ({
      id: b.id, month: b.month, date: b.paid_on, venue: b.venue,
      amount: num(b.amount), payer: b.payer || '', note: b.note || '',
    })),
    manual: (raw.manual || []).map((x) => ({
      id: x.id, date: x.date, dir: x.direction, cat: x.category, label: x.label,
      amount: num(x.amount), by: x.payer_name || '',
    })),
    purchases: (raw.purchases || []).map((p) => ({
      id: p.id, date: p.date, typeId: p.type_id, tubes: p.tubes, extra: p.extra_units,
      qty: p.total_units, pricePerTube: num(p.price_per_tube), total: num(p.total_amount),
      payer: p.funded_by || '', note: p.note || '',
    })),
    stockChecks: (raw.stockChecks || []).map((s) => ({
      id: s.id, date: s.date, month: s.month, counted: s.counted,
      systemLeft: s.system_left, diff: s.diff, spread: s.spread_sessions,
    })),
    changes: (raw.changes || []).map((c) => ({
      id: c.id, memberId: c.member_id, field: c.field, from: c.from_value, to: c.to_value,
      by: 'member', effective: c.effective, status: c.status,
    })),
    users: (raw.users || []).map((u) => ({
      id: u.id, name: u.name, nick: u.nick || u.name, phone: u.phone || '',
      gender: u.gender || '', level: u.level || '', since: dOf(u.created_at),
    })),
    joinRequests: (raw.joinRequests || []).map((r) => ({
      id: r.id, clubId: ctx.clubId, userId: r.user_id, at: dOf(r.created_at),
      status: 'pending', note: r.note || '', code: club.code,
    })),
    invites: (raw.invites || []).map((i) => ({
      id: i.id, clubId: ctx.clubId, memberId: i.member_id, phone: i.phone,
      at: dOf(i.sent_at), status: i.status,
    })),
    playing: {},
  }
}

/* ================= client → Postgres ================= */

/**
 * @param db  state client
 * @param ctx { clubId, memberIds:Set<string> }
 * @returns { [table]: row[] }
 */
export function toRows(db, ctx) {
  const cid = ctx.clubId
  const out = {}
  const put = (table, row) => (out[table] || (out[table] = [])).push(row)

  db.courts.forEach((c) => put('courts', {
    id: c.id, club_id: cid, name: c.name, address: c.addr || null,
    price_per_hour: c.price, active: c.active !== false,
  }))

  db.groups.forEach((g) => {
    put('member_groups', {
      id: g.id, club_id: cid, name: g.name, short: g.short || null, weekday: g.weekday,
      fee_male: g.feeNam, fee_female: g.feeNu, start_time: g.from, end_time: g.to,
      quota: g.quota, active: g.active !== false,
    })
    ;(g.courtIds || []).forEach((court) => put('group_courts', { group_id: g.id, court_id: court }))
  })

  db.members.forEach((m) => {
    put('club_members', {
      id: m.id, club_id: cid, user_id: uu(m.userId), role: m.role, name: m.name,
      phone: m.phone || null, gender: m.gender, level: m.level,
      pending_level: m.pendingLevel || null, pending_level_from: m.pendingLevelFrom || null,
      joined_at: m.joined, active: m.active !== false, linked_at: m.linkedAt || null,
    })
    ;(m.groupIds || []).forEach((g) => put('club_member_groups', { member_id: m.id, group_id: g }))
  })

  ;(db.invites || []).forEach((i) => put('club_invites', {
    id: i.id, club_id: cid, member_id: i.memberId, phone: i.phone,
    token: i.token || i.id, status: i.status, sent_at: i.at,
  }))

  db.guests.forEach((g) => put('guests', {
    id: g.id, club_id: cid, name: g.name, gender: g.gender, level: g.level,
    phone: g.phone || null, invited_by: uu(g.invitedBy),
  }))

  db.shuttleTypes.forEach((s) => put('shuttle_types', {
    id: s.id, club_id: cid, name: s.name, per_tube: s.perTube,
    price_per_tube: s.pricePerTube || null, active: s.active !== false,
  }))

  db.schedules.forEach((s) => {
    put('schedules', {
      id: s.id, club_id: cid, group_id: s.groupId, name: s.name, weekdays: s.weekdays || [],
      start_date: s.start, end_date: s.end || null, active: s.active !== false,
    })
    ;(s.rows || []).forEach((r) => put('schedule_slots', {
      schedule_id: s.id, court_id: r.courtId, start_time: r.from, end_time: r.to,
    }))
  })

  db.sessions.forEach((s) => {
    put('sessions', {
      id: s.id, club_id: cid, group_id: s.groupId, schedule_id: uu(s.scheduleId),
      date: s.date, status: s.status, shuttle_type_id: uu(s.shuttleTypeId),
      shuttle_mode: s.shuttleMode, tubes_opened: s.tubesOpened || 0, loose_units: s.loose || 0,
      shuttle_used: s.shuttleUsed || 0, shuttle_est: !!s.shuttleEst, note: s.note || null,
      closed_at: s.closedAt || null, group_mode: !!(db.groupMode || {})[s.id],
    })
    const mins = (db.courtMin || {})[s.id] || {}
    ;(s.courts || []).forEach((r, i) => put('session_courts', {
      session_id: s.id, court_id: r.courtId, court_index: i,
      start_time: r.from, end_time: r.to, is_extra: !!r.extra, is_sold: !!r.sold,
      sold_amount: r.soldAmount || 0, sold_to: r.soldTo || null,
      default_minutes: mins[i] == null ? null : mins[i],
    }))
  })

  Object.keys(db.attendance || {}).forEach((sid) => {
    const m = db.attendance[sid] || {}
    Object.keys(m).forEach((mid) => put('attendances', {
      session_id: sid, member_id: mid, status: m[mid] ? 'present' : 'absent',
    }))
  })

  db.sessionGuests.forEach((g) => put('session_guests', {
    id: g.id, session_id: g.sessionId, guest_id: g.guestId, level: g.level, gender: g.gender,
    price: g.price, invited_by: uu(g.invitedBy), paid: !!g.paid,
  }))

  Object.keys(db.lineups || {}).forEach((sid) => {
    const lu = db.lineups[sid] || {}
    Object.keys(lu).forEach((slot) => {
      const key = lu[slot]
      if (!key) return
      put('session_lineups', {
        session_id: sid, slot, court_index: parseInt(slot.slice(1, slot.indexOf('t')), 10),
        player_type: kindOf(ctx, key), player_id: key,
      })
    })
  })

  Object.keys(db.courtGroups || {}).forEach((sid) => {
    const cg = db.courtGroups[sid] || {}
    Object.keys(cg).forEach((key) => put('session_court_groups', {
      session_id: sid, court_index: cg[key], player_type: kindOf(ctx, key), player_id: key,
    }))
  })

  ;(db.matches || []).forEach((mt) => {
    put('matches', {
      id: mt.id, session_id: mt.sessionId, court_index: mt.courtIdx, minutes: mt.minutes,
      ended_at: new Date(mt.at || 0).toISOString(),
    })
    // Ô 0,1 là một bên lưới; 2,3 là bên kia (xem courtSlotIds trong lib/assign.js).
    ;(mt.playerKeys || []).forEach((key, i) => put('match_players', {
      match_id: mt.id, player_type: kindOf(ctx, key), player_id: key,
      team: Math.min(1, Math.floor(i / 2)),
    }))
  })

  Object.keys(db.roster || {}).forEach((month) => {
    const byGroup = db.roster[month] || {}
    Object.keys(byGroup).forEach((gid) => {
      const m = byGroup[gid] || {}
      Object.keys(m).forEach((mid) => put('group_memberships', {
        month, group_id: gid, member_id: mid, state: m[mid],
      }))
    })
  })

  Object.keys(db.locked || {}).forEach((month) => {
    if (db.locked[month]) put('roster_locks', { club_id: cid, month })
  })

  db.dues.forEach((d) => put('monthly_dues', {
    id: d.id, club_id: cid, month: d.month, group_id: d.groupId, member_id: d.memberId,
    amount: d.amount, paid: !!d.paid, paid_at: d.paidAt || null,
    method: d.method || null, note: d.note || null,
  }))

  Object.keys(db.backPaid || {}).forEach((key) => {
    if (!db.backPaid[key]) return
    const [month, gid, mid] = key.split(':')
    // ponytail: chỉ lưu cờ đã trả; số buổi / đơn giá / số tiền tính lại được từ buổi + quỹ tháng
    // (xem backRows trong lib/money.js). Nếu cần query SQL ra tiền back thì phải ghi đủ.
    put('back_credits', { club_id: cid, month, group_id: gid, member_id: mid, paid: true })
  })

  db.courtBills.forEach((b) => put('court_bills', {
    id: b.id, club_id: cid, month: b.month, paid_on: b.date, venue: b.venue,
    amount: b.amount, payer: b.payer || null, note: b.note || null,
  }))

  db.manual.forEach((x) => put('transactions', {
    id: x.id, club_id: cid, date: x.date, direction: x.dir, category: x.cat,
    label: x.label, amount: x.amount, ref_type: 'manual', payer_name: x.by || null,
  }))

  db.purchases.forEach((p) => put('shuttle_purchases', {
    id: p.id, club_id: cid, date: p.date, type_id: p.typeId, tubes: p.tubes,
    extra_units: p.extra, total_units: p.qty, price_per_tube: p.pricePerTube || null,
    total_amount: p.total, funded_by: p.payer || null, note: p.note || null,
  }))

  ;(db.stockChecks || []).forEach((s) => put('stock_checks', {
    id: s.id, club_id: cid, date: s.date, month: s.month, counted: s.counted,
    system_left: s.systemLeft, diff: s.diff, spread_sessions: s.spread,
  }))

  ;(db.changes || []).forEach((c) => put('member_changes', {
    id: c.id, member_id: c.memberId, field: c.field, from_value: c.from, to_value: c.to,
    effective: c.effective, status: c.status,
  }))

  // Bảng giá khách bám theo danh sách trình độ của CLB: thêm trình độ là có ngay 2 dòng giá.
  const from = db.club.openingDate
  ;(db.guestPrices || []).forEach((p) => {
    put('guest_price_rules', { club_id: cid, level: p.level, gender: 'nam', price: p.nam || 0, effective_from: from })
    put('guest_price_rules', { club_id: cid, level: p.level, gender: 'nu', price: p.nu || 0, effective_from: from })
  })

  return out
}

/** Riêng bảng `clubs` — một dòng, cập nhật chứ không insert (RPC create_club đã tạo). */
export function clubRow(db) {
  const c = db.club
  return {
    name: c.name, opening_balance: c.opening, opening_date: c.openingDate,
    opening_by: c.openingBy || null,
    bank_holder: c.bank.holder || null, bank_no: c.bank.no || null, bank_name: c.bank.bank || null,
    court_pay_mode: c.courtPayMode, lock_day: c.lockDay, round_unit: !!c.roundUnit,
    see_debt_each_other: !!c.seeDebtEachOther, see_fund: !!c.seeFund,
    allow_code_join: !!c.linkModes.code, allow_invite: !!c.linkModes.invite,
    allow_phone_suggest: !!c.linkModes.phone,
    levels: c.levels && c.levels.length ? c.levels : cfg.levelsDefault,
  }
}

/* ================= mô tả bảng + so sánh ================= */

// mode 'id'    : client tự sinh uuid cho từng dòng → thêm/sửa/xoá theo id.
// mode 'key'   : dòng con không có id ở client nhưng có khoá tự nhiên → upsert theo `conflict`,
//                dọn dòng thừa bằng `scope` + `child`.
// mode 'scope' : dòng con không có khoá nào ổn định → scope nào đổi thì xoá sạch rồi ghi lại.
//                Chỉ dùng cho tập nhỏ (≤ vài chục dòng).
//
// Thứ tự trong mảng là thứ tự ghi: cha trước con, để không vướng khoá ngoại.
export const TABLES = [
  { table: 'courts', mode: 'id' },
  { table: 'member_groups', mode: 'id' },
  { table: 'group_courts', mode: 'scope', scope: ['group_id'] },
  { table: 'club_members', mode: 'id' },
  { table: 'club_member_groups', mode: 'scope', scope: ['member_id'] },
  { table: 'club_invites', mode: 'id' },
  { table: 'guests', mode: 'id' },
  { table: 'shuttle_types', mode: 'id' },
  { table: 'schedules', mode: 'id' },
  { table: 'schedule_slots', mode: 'scope', scope: ['schedule_id'] },
  { table: 'sessions', mode: 'id' },
  { table: 'session_courts', mode: 'key', conflict: 'session_id,court_index', scope: ['session_id'], child: 'court_index' },
  { table: 'attendances', mode: 'key', conflict: 'session_id,member_id', scope: ['session_id'], child: 'member_id' },
  { table: 'session_guests', mode: 'id' },
  { table: 'session_lineups', mode: 'key', conflict: 'session_id,slot', scope: ['session_id'], child: 'slot' },
  { table: 'session_court_groups', mode: 'key', conflict: 'session_id,player_type,player_id', scope: ['session_id'], child: 'player_id' },
  { table: 'matches', mode: 'id' },
  { table: 'match_players', mode: 'scope', scope: ['match_id'] },
  { table: 'group_memberships', mode: 'key', conflict: 'month,group_id,member_id', scope: ['month', 'group_id'], child: 'member_id' },
  { table: 'roster_locks', mode: 'scope', scope: ['club_id'] },
  { table: 'monthly_dues', mode: 'id' },
  { table: 'back_credits', mode: 'scope', scope: ['club_id'] },
  { table: 'court_bills', mode: 'id' },
  { table: 'transactions', mode: 'id' },
  { table: 'shuttle_purchases', mode: 'id' },
  { table: 'stock_checks', mode: 'id' },
  { table: 'member_changes', mode: 'id' },
  { table: 'guest_price_rules', mode: 'scope', scope: ['club_id'] },
]

const scopeKey = (spec, row) => spec.scope.map((c) => row[c]).join(' ')

/**
 * So hai kết quả toRows() → danh sách việc phải làm với Supabase.
 * Trả về mảng thao tác theo đúng thứ tự TABLES:
 *   { table, op:'upsert', rows, conflict }
 *   { table, op:'delIds', ids }                          xoá theo id
 *   { table, op:'delScope', scope:{cột:giá trị}, child, keep }
 *                        xoá dòng trong scope; `keep` là danh sách giá trị `child` còn giữ
 *                        (rỗng = xoá hết scope)
 */
export function diff(prev, next) {
  const ops = []
  TABLES.forEach((spec) => {
    const a = prev[spec.table] || []
    const b = next[spec.table] || []
    if (!a.length && !b.length) return

    if (spec.mode === 'id') {
      const byId = (list) => {
        const m = new Map()
        list.forEach((r) => m.set(r.id, r))
        return m
      }
      const ma = byId(a)
      const mb = byId(b)
      const write = b.filter((r) => JSON.stringify(ma.get(r.id)) !== JSON.stringify(r))
      const gone = a.filter((r) => !mb.has(r.id)).map((r) => r.id)
      if (write.length) ops.push({ table: spec.table, op: 'upsert', rows: write, conflict: 'id' })
      if (gone.length) ops.push({ table: spec.table, op: 'delIds', ids: gone })
      return
    }

    // 'key' và 'scope': gom theo scope, chỉ đụng scope nào đổi.
    const group = (list) => {
      const m = new Map()
      list.forEach((r) => {
        const k = scopeKey(spec, r)
        if (!m.has(k)) m.set(k, [])
        m.get(k).push(r)
      })
      return m
    }
    const ga = group(a)
    const gb = group(b)
    const keys = new Set([...ga.keys(), ...gb.keys()])

    keys.forEach((k) => {
      const ra = ga.get(k) || []
      const rb = gb.get(k) || []
      if (JSON.stringify(ra) === JSON.stringify(rb)) return
      const sample = rb[0] || ra[0]
      const scope = {}
      spec.scope.forEach((c) => { scope[c] = sample[c] })

      if (spec.mode === 'scope') {
        ops.push({ table: spec.table, op: 'delScope', scope, child: null, keep: [] })
        if (rb.length) ops.push({ table: spec.table, op: 'upsert', rows: rb, conflict: null })
        return
      }
      const keep = rb.map((r) => r[spec.child])
      const dropped = ra.some((r) => keep.indexOf(r[spec.child]) < 0)
      if (dropped || !rb.length) ops.push({ table: spec.table, op: 'delScope', scope, child: spec.child, keep })
      if (rb.length) {
        const before = new Map(ra.map((r) => [r[spec.child], JSON.stringify(r)]))
        const write = rb.filter((r) => before.get(r[spec.child]) !== JSON.stringify(r))
        if (write.length) ops.push({ table: spec.table, op: 'upsert', rows: write, conflict: spec.conflict })
      }
    })
  })
  return ops
}
