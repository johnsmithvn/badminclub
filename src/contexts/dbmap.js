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
/** Như num nhưng GIỮ null. Cột cost_* dùng null để nói "chưa đóng băng" — ép về 0 là sai nghĩa. */
const numN = (v) => (v == null ? null : Number(v))

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

  let groups = (raw.groups || []).map((g) => ({
    id: g.id, name: g.name, short: g.short || '', weekday: g.weekday,
    feeNam: num(g.fee_male), feeNu: num(g.fee_female),
    // Đơn giá một buổi CLB tự đặt; 0 = để app tự chia.
    unitNam: num(g.unit_male), unitNu: num(g.unit_female),
    from: hm(g.start_time), to: hm(g.end_time), quota: g.quota, active: g.active,
    courtIds: (g.group_courts || []).map((x) => x.court_id),
  }))

  if (groups.length === 0) {
    groups = [{
      id: crypto.randomUUID(), name: 'Cố định', short: 'CĐ', weekday: 0,
      feeNam: 0, feeNu: 0, unitNam: 0, unitNu: 0,
      from: '18:00', to: '20:00', quota: 24, active: true,
      courtIds: [],
    }]
  }

  const members = (raw.members || []).map((m) => {
    return {
      id: m.id, name: m.name, phone: m.phone || '', gender: m.gender, level: m.level,
      role: m.role, joined: m.joined_at, active: m.active, userId: m.user_id || null,
      linkedAt: dOf(m.linked_at), pendingLevel: m.pending_level || null,
      pendingLevelFrom: m.pending_level_from || null,
      // Rỗng = chưa cố định ca nào (đi lẻ). Không bịa ca mặc định ở đây: migration 0002 đã
      // backfill `club_member_groups` cho người cũ, nên rỗng bây giờ là rỗng thật.
      groupIds: (m.club_member_groups || []).map((x) => x.group_id),
    }
  })

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
    // Ba trạng thái: true có mặt · false vắng · 'extra' đi thêm (không cố định của nhóm).
    ;(s.attendances || []).forEach((a) => {
      att[a.member_id] = a.status === 'extra' ? 'extra' : a.status === 'present'
    })
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
      // group_id NULL = buổi đột xuất của toàn CLB; client gọi nhóm đó là 'ALL' (xem groupOf).
      id: s.id, date: s.date, groupId: s.group_id || 'ALL', scheduleId: s.schedule_id || null,
      status: s.status, note: s.note || '', shuttleTypeId: s.shuttle_type_id || null,
      shuttleMode: s.shuttle_mode, tubesOpened: s.tubes_opened, loose: s.loose_units,
      shuttleUsed: s.shuttle_used, shuttleEst: s.shuttle_est, closedAt: dOf(s.closed_at),
      // Giá thành đóng băng lúc chốt buổi. null = chưa đóng băng, đọc số tính live.
      costCourt: numN(s.cost_court), costShuttleUnit: numN(s.cost_shuttle_unit),
      costShuttle: numN(s.cost_shuttle), costTotal: numN(s.cost_total),
      costGuestRev: numN(s.cost_guest_rev), costHeads: numN(s.cost_heads),
      costFrozenAt: dOf(s.cost_frozen_at),
      courts: rows.map((r) => ({
        courtId: r.court_id, from: hm(r.start_time), to: hm(r.end_time),
        sold: r.is_sold, soldAmount: num(r.sold_amount), soldTo: r.sold_to || '', extra: r.is_extra,
        // Tiền dòng sân đóng băng lúc chốt buổi (0012). null = chưa chốt, rowCost tính live.
        cost: numN(r.cost),
      })),
    }
  }).sort((a, b) => (a.date < b.date ? -1 : 1))

  // Thứ tự thời gian, không phải thứ tự Postgres trả về: "Bỏ trận vừa ghi" lấy phần tử cuối
  // mảng, mà load() không ORDER BY bảng nào cả — sau F5 là xoá nhầm một trận bất kỳ.
  matches.sort((a, b) => a.at - b.at)

  const roster = {}
  ;(raw.rosterRows || []).forEach((r) => {
    const m = roster[r.month] || (roster[r.month] = {})
    const g = m[r.group_id] || (m[r.group_id] = {})
    g[r.member_id] = r.state
  })

  const locked = {}
  ;(raw.locks || []).forEach((l) => { locked[l.month] = true })

  // Đối chiếu buổi. `key` dựng lại y hệt money.js: adjustKey — dòng nào cũng tra được từ
  // bảng tính live mà không phải join tay.
  const adjustments = (raw.adjustments || []).map((x) => ({
    id: x.id, key: [x.month, x.group_id, x.member_id, x.kind].join(':'),
    month: x.month, groupId: x.group_id, memberId: x.member_id, kind: x.kind,
    sessions: x.sessions, unit: num(x.unit_price), amount: num(x.amount),
    settle: x.settle, paid: !!x.paid, paidAt: x.paid_at || null,
  }))

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
      multiGroup: !!club.multi_group,
      linkModes: { code: club.allow_code_join, invite: club.allow_invite, phone: club.allow_phone_suggest },
      levels,
    },
    levels,
    courts, groups, members, guests, schedules, sessions,
    attendance, sessionGuests, lineups, courtGroups, groupMode, courtMin, matches,
    roster, locked, adjustments, guestPrices,

    shuttleTypes: (raw.shuttleTypes || []).map((s) => ({
      id: s.id, name: s.name, perTube: s.per_tube,
      pricePerTube: num(s.price_per_tube), active: s.active,
    })),
    dues: (raw.dues || []).map((d) => ({
      id: d.id, month: d.month, groupId: d.group_id, memberId: d.member_id,
      // `paid_amount` là nguồn sự thật; cột `paid` chỉ còn là bản sao suy ra (xem 0009).
      amount: num(d.amount), paidAmount: num(d.paid_amount), paidAt: d.paid_at || null,
      method: d.method || '', note: d.note || '',
    })),
    courtBills: (raw.courtBills || []).map((b) => ({
      id: b.id, month: b.month, date: b.paid_on, venue: b.venue,
      amount: num(b.amount), payerId: b.payer_member_id || null,
      payer: b.payer || '', note: b.note || '',   // payer: chỉ còn để đọc dữ liệu cũ nhập tay
      repaidAt: b.repaid_at || '',
    })),
    manual: (raw.manual || []).map((x) => ({
      id: x.id, date: x.date, dir: x.direction, cat: x.category, label: x.label,
      amount: num(x.amount), by: x.payer_name || '',
    })),
    purchases: (raw.purchases || []).map((p) => ({
      id: p.id, date: p.date, typeId: p.type_id, tubes: p.tubes, extra: p.extra_units,
      qty: p.total_units, pricePerTube: num(p.price_per_tube), total: num(p.total_amount),
      // funded_by là NGUỒN TIỀN (fund / member_advance), không phải tên người — xem 0008.
      payerId: p.payer_member_id || null, fundedBy: p.funded_by || null, note: p.note || '',
      repaidAt: p.repaid_at || '',
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
      // Đơn giá một buổi CLB tự đặt. 0 và null đều nghĩa là "để app tự chia" → ghi null cho gọn.
      unit_male: g.unitNam || null, unit_female: g.unitNu || null,
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
      id: s.id, club_id: cid, group_id: s.groupId === 'ALL' ? null : uu(s.groupId),
      schedule_id: uu(s.scheduleId),
      date: s.date, status: s.status, shuttle_type_id: uu(s.shuttleTypeId),
      shuttle_mode: s.shuttleMode, tubes_opened: s.tubesOpened || 0, loose_units: s.loose || 0,
      shuttle_used: s.shuttleUsed || 0, shuttle_est: !!s.shuttleEst, note: s.note || null,
      closed_at: s.closedAt || null, group_mode: !!(db.groupMode || {})[s.id],
      // `?? null` chứ không `|| null`: số 0 hợp lệ (buổi không dùng quả cầu nào) phải giữ là 0.
      cost_court: s.costCourt ?? null, cost_shuttle_unit: s.costShuttleUnit ?? null,
      cost_shuttle: s.costShuttle ?? null, cost_total: s.costTotal ?? null,
      cost_guest_rev: s.costGuestRev ?? null, cost_heads: s.costHeads ?? null,
      cost_frozen_at: s.costFrozenAt || null,
    })
    const mins = (db.courtMin || {})[s.id] || {}
    ;(s.courts || []).forEach((r, i) => put('session_courts', {
      session_id: s.id, court_id: r.courtId, court_index: i,
      start_time: r.from, end_time: r.to, is_extra: !!r.extra, is_sold: !!r.sold,
      sold_amount: r.soldAmount || 0, sold_to: r.soldTo || null,
      default_minutes: mins[i] == null ? null : mins[i],
      // Buổi chưa chốt phải xuống NULL, không phải 0 — 0 là "sân này miễn phí", đọc lại là mất tiền.
      cost: r.cost == null ? null : r.cost,
    }))
  })

  Object.keys(db.attendance || {}).forEach((sid) => {
    const m = db.attendance[sid] || {}
    Object.keys(m).forEach((mid) => put('attendances', {
      session_id: sid, member_id: mid,
      status: m[mid] === 'extra' ? 'extra' : m[mid] ? 'present' : 'absent',
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
      Object.keys(m).forEach((mid) => {
        // Chỉ ba giá trị của enum `roster_state` được xuống DB. 'none' (money.js: rosterStatus)
        // nghĩa là KHÔNG có bản ghi — bỏ qua ở đây thì `diff` sinh delScope và dòng cũ bị xoá,
        // đúng ý. Lọt xuống là 22P02, và vì ảnh chụp đồng bộ chỉ cập nhật khi MỌI op xong nên
        // cả hàng đợi kẹt lại: không mất tiền, nhưng mọi thay đổi sau đó im lặng không lưu.
        if (cfg.rosterStates.indexOf(m[mid]) < 0) return
        put('group_memberships', { month, group_id: gid, member_id: mid, state: m[mid] })
      })
    })
  })

  Object.keys(db.locked || {}).forEach((month) => {
    if (db.locked[month]) put('roster_locks', { club_id: cid, month })
  })

  db.dues.forEach((d) => put('monthly_dues', {
    id: d.id, club_id: cid, month: d.month, group_id: d.groupId, member_id: d.memberId,
    amount: d.amount, paid_amount: d.paidAmount || 0,
    // `paid` là cột DEPRECATED, ghi lại như bản sao suy ra để nó không nói dối với báo cáo SQL cũ.
    paid: (d.paidAmount || 0) >= d.amount,
    paid_at: d.paidAt || null, method: d.method || null, note: d.note || null,
  }))

  // Ghi ĐỦ số, không chỉ cờ `paid` như bảng back_credits cũ: khoản đã chốt phải đọc được
  // bằng SQL, và phải đứng yên khi điểm danh hay quỹ nhóm đổi về sau.
  ;(db.adjustments || []).forEach((x) => put('member_adjustments', {
    id: x.id, club_id: cid, month: x.month, group_id: x.groupId, member_id: x.memberId,
    kind: x.kind, sessions: x.sessions || 0, unit_price: x.unit || 0, amount: x.amount || 0,
    settle: x.settle || 'cash', paid: !!x.paid, paid_at: x.paidAt || null,
  }))

  db.courtBills.forEach((b) => put('court_bills', {
    id: b.id, club_id: cid, month: b.month, paid_on: b.date, venue: b.venue,
    amount: b.amount, payer_member_id: uu(b.payerId), payer: b.payer || null,
    note: b.note || null, repaid_at: b.repaidAt || null,
  }))

  db.manual.forEach((x) => put('transactions', {
    id: x.id, club_id: cid, date: x.date, direction: x.dir, category: x.cat,
    label: x.label, amount: x.amount, ref_type: 'manual', payer_name: x.by || null,
  }))

  db.purchases.forEach((p) => put('shuttle_purchases', {
    id: p.id, club_id: cid, date: p.date, type_id: p.typeId, tubes: p.tubes,
    extra_units: p.extra, total_units: p.qty, price_per_tube: p.pricePerTube || null,
    total_amount: p.total, payer_member_id: uu(p.payerId), funded_by: p.fundedBy || null,
    note: p.note || null, repaid_at: p.repaidAt || null,
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
    multi_group: !!c.multiGroup,
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
  // `club_invites` cố ý KHÔNG có ở đây: mời qua SĐT đã gỡ khỏi client (cần module riêng, có
  // gửi tin thật). Bảng và cột `clubs.allow_invite` giữ nguyên dưới DB, chờ module đó.
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
  { table: 'member_adjustments', mode: 'id' },
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
  // Xoá dòng CHA phải chạy sau khi con của nó đã đi — ngược hẳn với thứ tự ghi. Gom riêng
  // rồi đảo ngược ở cuối: `club_members` đứng thứ 4 trong TABLES còn `group_memberships`
  // thứ 19, xoá theo thứ tự khai báo là Postgres chặn bằng khoá ngoại (23503) và cả hàng đợi
  // đồng bộ kẹt ở đó. Chỉ `delIds` mới xoá dòng cha; `delScope` toàn rơi vào bảng lá nên giữ
  // nguyên chỗ, tách khỏi `upsert` đi kèm là mode 'scope' xoá mất đúng dòng vừa ghi.
  const gone = []
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
      const dead = a.filter((r) => !mb.has(r.id)).map((r) => r.id)
      if (write.length) ops.push({ table: spec.table, op: 'upsert', rows: write, conflict: 'id' })
      if (dead.length) gone.push({ table: spec.table, op: 'delIds', ids: dead })
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
  return ops.concat(gone.reverse())
}
