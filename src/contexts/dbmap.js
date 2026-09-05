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
    id: c.id, name: c.name, addr: c.address || '', mapUrl: c.map_url || '',
    price: num(c.price_per_hour), active: c.active,
  }))

  let groups = (raw.groups || []).map((g) => ({
    id: g.id, name: g.name, short: g.short || '',
    feeNam: num(g.fee_male), feeNu: num(g.fee_female),
    // Đơn giá một buổi CLB tự đặt; 0 = để app tự chia.
    unitNam: num(g.unit_male), unitNu: num(g.unit_female),
    from: hm(g.start_time), to: hm(g.end_time), active: g.active,
    courtIds: (g.group_courts || []).map((x) => x.court_id),
  }))

  // KHÔNG bịa nhóm mặc định khi CLB chưa có nhóm nào. Trước đây chỗ này sinh một nhóm "Cố định"
  // với `crypto.randomUUID()` mới mỗi lần nạp — xoá nhóm xong, reload là nó mọc lại với id khác,
  // rồi `storage.js: save` ghi ngược xuống DB thành một nhóm ma. Không có nhóm là trạng thái
  // HỢP LỆ từ 0008: ai chưa thuộc nhóm nào thì tính đi lẻ.

  // Mốc trình độ gom theo người, sắp xuôi thời gian — `levelOf` chỉ cần tìm mốc lớn nhất <= tháng.
  const levelsBy = {}
  ;(raw.levelRows || []).forEach((r) => {
    ;(levelsBy[r.member_id] = levelsBy[r.member_id] || []).push({ from: r.from_month, level: r.level })
  })
  Object.values(levelsBy).forEach((list) => list.sort((a, b) => (a.from < b.from ? -1 : 1)))

  const members = (raw.members || []).map((m) => {
    return {
      id: m.id, name: m.name, fullName: m.full_name || '',
      phone: m.phone || '', email: m.email || '', gender: m.gender, level: m.level,
      avatarUrl: m.avatar_url || '', qrUrl: m.qr_url || '',
      bankHolder: m.bank_holder || '', bankNo: m.bank_no || '', bankName: m.bank_name || '',
      bankAccounts: m.bank_accounts || [],
      role: m.role, joined: m.joined_at, active: m.active, userId: m.user_id || null,
      linkedAt: dOf(m.linked_at), pendingLevel: m.pending_level || null,
      pendingLevelFrom: m.pending_level_from || null,
      note: m.note || '',
      levelHistory: levelsBy[m.id] || [],
      // Rỗng = chưa cố định ca nào (đi lẻ). Không bịa ca mặc định ở đây: migration 0002 đã
      // backfill `club_member_groups` cho người cũ, nên rỗng bây giờ là rỗng thật.
      groupIds: (m.club_member_groups || []).map((x) => x.group_id),
    }
  })

  const guests = (raw.guests || []).map((g) => ({
    id: g.id, name: g.name, gender: g.gender, level: g.level,
    phone: g.phone || '', invitedBy: g.invited_by || '', note: g.note || '',
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

    // Một dòng = MỘT LƯỢT TRẢ TIỀN. `guest_id` = khách ngoài CLB; `member_id` = thành viên đi
    // buổi đột xuất (migration 0003). Đúng một trong hai có giá trị.
    ;(s.session_guests || []).forEach((g) => sessionGuests.push({
      id: g.id, sessionId: s.id, guestId: g.guest_id || null, memberId: g.member_id || null,
      level: g.level, gender: g.gender,
      price: num(g.price), paid: g.paid, invitedBy: g.invited_by || '',
      claimedAt: g.claimed_at || null,
    }))

    ;(s.matches || []).forEach((mt) => {
      const players = (mt.match_players || []).slice().sort((a, b) => a.team - b.team)
      matches.push({
        id: mt.id, sessionId: s.id, courtIdx: mt.court_index, minutes: mt.minutes,
        at: mt.ended_at ? new Date(mt.ended_at).getTime() : 0,
        sourceType: mt.source_type || 'session',
        challengeId: mt.challenge_id || null,
        ratingEnabled: mt.rating_enabled !== false,
        ratingAlgorithm: mt.rating_algorithm || 'ELO_V1',
        matchPolicy: mt.match_policy || 'official',
        sets: mt.sets || [],
        winnerTeam: mt.winner_team || null,
        scoreText: mt.score_text || '',
        initialRatingA: numN(mt.initial_rating_a),
        initialRatingB: numN(mt.initial_rating_b),
        eloDelta: numN(mt.elo_delta),
        teamA: players.filter((p) => p.team === 0).map((p) => p.player_id),
        teamB: players.filter((p) => p.team === 1).map((p) => p.player_id),
        playerKeys: players.map((p) => p.player_id),
      })
    })

    return {
      // group_id NULL = buổi đột xuất của toàn CLB; client gọi nhóm đó là 'ALL' (xem groupOf).
      id: s.id, date: s.date, groupId: s.group_id || 'ALL', scheduleId: s.schedule_id || null,
      status: s.status, note: s.note || '', closedAt: dOf(s.closed_at),
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
    claimedAt: x.claimed_at || null,
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
      avatarUrl: club.avatar_url || '',
      bankQrUrl: club.bank_qr_url || '',
      bankAccounts: club.bank_accounts || [],
      opening: num(club.opening_balance), openingDate: club.opening_date,
      openingBy: club.opening_by || '',
      bank: { holder: club.bank_holder || '', no: club.bank_no || '', bank: club.bank_name || '' },
      seeDebtEachOther: club.see_debt_each_other, seeFund: club.see_fund,
      roundUnit: club.round_unit, lockDay: club.lock_day, courtPayMode: club.court_pay_mode,
      multiGroup: !!club.multi_group,
      hasMemberExtraDiscount: !!club.has_member_extra_discount,
      memberExtraDiscount: club.member_extra_discount != null ? num(club.member_extra_discount) : 5000,
      debtBanner: club.debt_banner || 'slim',
      linkModes: { code: club.allow_code_join, invite: club.allow_invite, phone: club.allow_phone_suggest },
      levels,
    },
    levels,
    courts, groups, members, guests, schedules, sessions,
    attendance, sessionGuests, lineups, courtGroups, groupMode, courtMin, matches,
    roster, locked, adjustments, guestPrices,

    dues: (raw.dues || []).map((d) => ({
      id: d.id, month: d.month, groupId: d.group_id, memberId: d.member_id,
      // `paid_amount` là nguồn sự thật; cột `paid` chỉ còn là bản sao suy ra (xem 0009).
      amount: num(d.amount), paidAmount: num(d.paid_amount), paidAt: d.paid_at || null,
      claimedAt: d.claimed_at || null,
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
    changes: (raw.changes || []).map((c) => ({
      id: c.id, memberId: c.member_id, field: c.field, from: c.from_value, to: c.to_value,
      by: 'member', effective: c.effective, status: c.status,
    })),
    users: (raw.users || []).map((u) => ({
      id: u.id, name: u.name, nick: u.nick || u.name, phone: u.phone || '',
      email: u.email || '', avatarUrl: u.avatar_url || '', qrUrl: u.qr_url || '',
      bankHolder: u.bank_holder || '', bankNo: u.bank_no || '', bankName: u.bank_name || '',
      bankAccounts: u.bank_accounts || [],
      gender: u.gender || '', level: u.level || '', since: dOf(u.created_at),
    })),
    joinRequests: (raw.joinRequests || []).map((r) => ({
      id: r.id, clubId: ctx.clubId, userId: r.user_id, at: dOf(r.created_at),
      status: 'pending', note: r.note || '', code: club.code,
    })),
    challenges: (raw.challenges || []).map((c) => {
      const players = c.challenge_players || []
      return {
        id: c.id, code: c.code, clubId: c.club_id, sessionId: c.session_id || null,
        createdBy: c.created_by, status: c.status, courtId: c.court_id || null,
        scheduledAt: c.scheduled_at || '', bestOf: c.best_of || 3,
        ratingEnabled: c.rating_enabled !== false, expiresAt: c.expires_at || '',
        matchId: c.match_id || null,
        teamA: players.filter((p) => p.team === 'A').map((p) => p.member_id),
        teamB: players.filter((p) => p.team === 'B').map((p) => p.member_id),
      }
    }),
    playerRatings: (() => {
      const map = {}
      ;(raw.playerRatings || []).forEach((r) => {
        map[r.member_id] = {
          id: r.id, memberId: r.member_id, rating: num(r.rating),
          gamesCount: num(r.games_count), winsCount: num(r.wins_count), lossesCount: num(r.losses_count),
          deviation: num(r.rating_deviation), confidence: r.confidence_label || 'low',
        }
      })
      return map
    })(),
    matchEdits: (raw.matchEdits || []).map((e) => ({
      id: e.id, matchId: e.match_id, clubId: e.club_id, editedBy: e.edited_by,
      editedAt: e.edited_at, fieldChanged: e.field_changed, oldValue: e.old_value,
      newValue: e.new_value, reason: e.reason, ratingRecalcFromMatchId: e.rating_recalc_from_match_id,
    })),
    clubCalibration: (raw.clubCalibration || []).map((c) => ({
      id: c.id, bucket: c.bucket, sampleSize: num(c.sample_size),
      observedWinRate: num(c.observed_win_rate), learnedAdjustment: num(c.learned_adjustment),
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
    map_url: c.mapUrl || null,
    price_per_hour: c.price, active: c.active !== false,
  }))

  db.groups.forEach((g) => {
    put('member_groups', {
      // `member_groups.weekday` là cột NOT NULL không có DEFAULT nên vẫn phải ghi, nhưng client
      // đã bỏ hẳn khái niệm này: thứ trong tuần nằm ở `schedules.weekdays[]`. Ghi 0 và quên nó đi.
      id: g.id, club_id: cid, name: g.name, short: g.short || null, weekday: 0,
      fee_male: g.feeNam, fee_female: g.feeNu, start_time: g.from, end_time: g.to,
      // Đơn giá một buổi CLB tự đặt. 0 và null đều nghĩa là "để app tự chia" → ghi null cho gọn.
      unit_male: g.unitNam || null, unit_female: g.unitNu || null,
      active: g.active !== false,
    })
    ;(g.courtIds || []).forEach((court) => put('group_courts', { group_id: g.id, court_id: court }))
  })

  db.members.forEach((m) => {
    put('club_members', {
      id: m.id, club_id: cid, user_id: uu(m.userId), role: m.role, name: m.name,
      full_name: m.fullName || null,
      phone: m.phone || null, email: m.email || null, gender: m.gender, level: m.level,
      avatar_url: m.avatarUrl || null, qr_url: m.qrUrl || null,
      bank_holder: m.bankHolder || null, bank_no: m.bankNo || null, bank_name: m.bankName || null,
      bank_accounts: m.bankAccounts && m.bankAccounts.length ? m.bankAccounts : null,
      pending_level: m.pendingLevel || null, pending_level_from: m.pendingLevelFrom || null,
      joined_at: m.joined, active: m.active !== false, linked_at: m.linkedAt || null,
      note: m.note || null,
    })
    ;(m.groupIds || []).forEach((g) => put('club_member_groups', { member_id: m.id, group_id: g }))
    ;(m.levelHistory || []).forEach((h) => put('member_levels', {
      member_id: m.id, from_month: h.from, level: h.level,
    }))
  })

  db.guests.forEach((g) => put('guests', {
    id: g.id, club_id: cid, name: g.name, gender: g.gender, level: g.level,
    phone: g.phone || null, invited_by: uu(g.invitedBy), note: g.note || null,
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
      date: s.date, status: s.status, note: s.note || null,
      closed_at: s.closedAt || null, group_mode: !!(db.groupMode || {})[s.id],
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
    id: g.id, session_id: g.sessionId, guest_id: uu(g.guestId), member_id: uu(g.memberId),
    level: g.level, gender: g.gender,
    price: g.price, invited_by: uu(g.invitedBy), paid: !!g.paid,
    claimed_at: g.claimedAt || null,
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

  ;(db.challenges || []).forEach((c) => {
    put('challenges', {
      id: c.id, code: c.code, club_id: cid, session_id: uu(c.sessionId),
      created_by: c.createdBy, status: c.status, court_id: uu(c.courtId),
      scheduled_at: c.scheduledAt || null, best_of: c.bestOf || 3,
      rating_enabled: c.ratingEnabled !== false, expires_at: c.expiresAt || null,
      match_id: uu(c.matchId),
    })
    ;(c.teamA || []).forEach((mid) => put('challenge_players', { challenge_id: c.id, member_id: mid, team: 'A' }))
    ;(c.teamB || []).forEach((mid) => put('challenge_players', { challenge_id: c.id, member_id: mid, team: 'B' }))
  })

  ;(db.matches || []).forEach((mt) => {
    put('matches', {
      id: mt.id, session_id: mt.sessionId, court_index: mt.courtIdx, minutes: mt.minutes,
      ended_at: new Date(mt.at || 0).toISOString(),
      source_type: mt.sourceType || 'session',
      challenge_id: uu(mt.challengeId),
      rating_enabled: mt.ratingEnabled !== false,
      rating_algorithm: mt.ratingAlgorithm || 'ELO_V1',
      match_policy: mt.matchPolicy || 'official',
      sets: mt.sets || [],
      winner_team: mt.winnerTeam || null,
      score_text: mt.scoreText || null,
      initial_rating_a: numN(mt.initialRatingA),
      initial_rating_b: numN(mt.initialRatingB),
      elo_delta: numN(mt.eloDelta),
    })
    // Ô 0,1 là một bên lưới; 2,3 là bên kia (xem courtSlotIds trong lib/assign.js).
    ;(mt.playerKeys || []).forEach((key, i) => put('match_players', {
      match_id: mt.id, player_type: kindOf(ctx, key), player_id: key,
      team: Math.min(1, Math.floor(i / 2)),
    }))
  })

  const ratingsList = Array.isArray(db.playerRatings)
    ? db.playerRatings
    : Object.entries(db.playerRatings || {}).map(([mid, val]) => ({ ...val, memberId: val.memberId || mid }))

  ratingsList.forEach((r) => {
    const mid = r.memberId || r.playerId
    if (!mid) return
    const rid = r.id || uu(r.id)
    if (!rid) return
    put('player_ratings', {
      id: rid, club_id: cid, member_id: mid,
      rating: r.rating || 0, games_count: r.gamesCount || 0,
      wins_count: r.winsCount || 0, losses_count: r.lossesCount || 0,
      rating_deviation: r.deviation || cfg.rating?.defaultDeviation || 350, confidence_label: r.confidence || 'low',
    })
  })

  ;(db.matchEdits || []).forEach((e) => put('match_edits', {
    id: e.id, match_id: e.matchId, club_id: cid, edited_by: uu(e.editedBy),
    edited_at: e.editedAt || new Date().toISOString(),
    field_changed: e.fieldChanged, old_value: e.oldValue || null,
    new_value: e.newValue || null, reason: e.reason,
    rating_recalc_from_match_id: uu(e.ratingRecalcFromMatchId),
  }))

  ;(db.clubCalibration || []).forEach((c) => put('club_calibration', {
    id: c.id, club_id: cid, calibration_type: 'cross_gender',
    bucket: c.bucket, sample_size: c.sampleSize || 0,
    observed_win_rate: c.observedWinRate || 0,
    learned_adjustment: c.learnedAdjustment || 0,
  }))

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
    claimed_at: d.claimedAt || null,
  }))

  // Ghi ĐỦ số, không chỉ cờ `paid` như bảng back_credits cũ: khoản đã chốt phải đọc được
  // bằng SQL, và phải đứng yên khi điểm danh hay quỹ nhóm đổi về sau.
  ;(db.adjustments || []).forEach((x) => put('member_adjustments', {
    id: x.id, club_id: cid, month: x.month, group_id: x.groupId, member_id: x.memberId,
    kind: x.kind, sessions: x.sessions || 0, unit_price: x.unit || 0, amount: x.amount || 0,
    settle: x.settle || 'cash', paid: !!x.paid, paid_at: x.paidAt || null,
    claimed_at: x.claimedAt || null,
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
    avatar_url: c.avatarUrl || null,
    bank_qr_url: c.bankQrUrl || null,
    bank_holder: c.bank.holder || null, bank_no: c.bank.no || null, bank_name: c.bank.bank || null,
    bank_accounts: c.bankAccounts && c.bankAccounts.length ? c.bankAccounts : null,
    court_pay_mode: c.courtPayMode, lock_day: c.lockDay, round_unit: !!c.roundUnit,
    multi_group: !!c.multiGroup,
    has_member_extra_discount: !!c.hasMemberExtraDiscount,
    member_extra_discount: c.memberExtraDiscount != null ? num(c.memberExtraDiscount) : 5000,
    debt_banner: c.debtBanner || 'slim',
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
  // Mode 'scope': mốc trình độ không có id ở client, và một người chỉ có vài mốc — xoá sạch của
  // người nào vừa đổi rồi ghi lại, đúng khuôn `club_member_groups`.
  { table: 'member_levels', mode: 'scope', scope: ['member_id'] },
  // `club_invites` cố ý KHÔNG có ở đây: mời qua SĐT đã gỡ khỏi client (cần module riêng, có
  // gửi tin thật). Bảng và cột `clubs.allow_invite` giữ nguyên dưới DB, chờ module đó.
  { table: 'guests', mode: 'id' },
  { table: 'schedules', mode: 'id' },
  { table: 'schedule_slots', mode: 'scope', scope: ['schedule_id'] },
  { table: 'sessions', mode: 'id' },
  { table: 'session_courts', mode: 'key', conflict: 'session_id,court_index', scope: ['session_id'], child: 'court_index' },
  { table: 'attendances', mode: 'key', conflict: 'session_id,member_id', scope: ['session_id'], child: 'member_id' },
  { table: 'session_guests', mode: 'id' },
  { table: 'session_lineups', mode: 'key', conflict: 'session_id,slot', scope: ['session_id'], child: 'slot' },
  { table: 'session_court_groups', mode: 'key', conflict: 'session_id,player_type,player_id', scope: ['session_id'], child: 'player_id' },
  { table: 'challenges', mode: 'id' },
  { table: 'challenge_players', mode: 'key', conflict: 'challenge_id,member_id', scope: ['challenge_id'], child: 'member_id' },
  { table: 'matches', mode: 'id' },
  { table: 'match_players', mode: 'scope', scope: ['match_id'] },
  { table: 'group_memberships', mode: 'key', conflict: 'month,group_id,member_id', scope: ['month', 'group_id'], child: 'member_id' },
  { table: 'roster_locks', mode: 'scope', scope: ['club_id'] },
  { table: 'monthly_dues', mode: 'id' },
  { table: 'member_adjustments', mode: 'id' },
  { table: 'court_bills', mode: 'id' },
  { table: 'transactions', mode: 'id' },
  { table: 'member_changes', mode: 'id' },
  { table: 'player_ratings', mode: 'id' },
  { table: 'match_edits', mode: 'id', noDelete: true, insertOnly: true },
  { table: 'club_calibration', mode: 'scope', scope: ['club_id'] },
  { table: 'guest_price_rules', mode: 'scope', scope: ['club_id'] },
]

const scopeKey = (spec, row) => spec.scope.map((c) => row[c]).join(' ')

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
      const dead = spec.noDelete ? [] : a.filter((r) => !mb.has(r.id)).map((r) => r.id)
      if (write.length) {
        ops.push({
          table: spec.table,
          op: 'upsert',
          rows: write,
          conflict: 'id',
          ignoreDuplicates: Boolean(spec.insertOnly),
        })
      }
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
