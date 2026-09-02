// Mọi hành động ghi dữ liệu. Mỗi hành động bắn toast bằng tiếng Việt nói rõ đã làm gì và hệ quả.
// Quy ước: dbRef.current = db hiện tại (đọc để tính text toast), setDb(partial) để ghi.

import { addMonth, dd, ddmy, monthOf, monthTxt, wd } from '#utils/dates.js'
import cfg from '#config/app.json' with { type: 'json' }
import {
  courtCost, courtTxt, fmt, fmtK, groupMembers, groupOf, guestOf, guestPrice, memberOf,
  perTube, presentCount, quotaFor, rowCost, sGuests, guestRev, costRow,
  sessionOf, checkPreview, checkOf, freezeCost, spreadDiff, unfrozenCost, timeTxt,
  adjustRows, lockDues, regroupDues, dueState, intOf, memberRefs, groupRefs, sessionRefs, joinDues,
  adhocCharges, chargeName, sGuestsOnly,
} from '#lib/money.js'
import { CATS, fundBalance, groupKey, ledger, undoTarget } from '#lib/ledger.js'
import { modeToast, activeCourtIdxs, arrange, autoSplit, courtSlotIds, matchStats, place, removePlayer, sessionPlayers, slotCourtIdx } from '#lib/assign.js'
import { can, roleDesc, roleName, viewAsOptions } from '#lib/roles.js'
import { applyScheduleEdit, planScheduleDelete, planScheduleEdit } from '#lib/schedules.js'
import { supabase, unwrap } from '#supabase'
import { pathOf } from '#routes'
import { t } from '#i18n'

/** Id của mọi bản ghi mới. Trùng kiểu uuid của Postgres nên client ghi thẳng được, khỏi map id. */
const uid = () => crypto.randomUUID()

/** Các trường SỐ của một nhóm cố định — dùng để biết ô nhập nào phải đi qua intOf. */
const GROUP_NUM = ['feeNam', 'feeNu', 'quota', 'unitNam', 'unitNu']

export function makeActions({ setDb, setUi, dbRef, uiRef, navRef, toast, reload }) {
  const db = () => dbRef.current
  /** Form đang nhập — đọc qua ref, KHÔNG đọc qua updater của setUi (updater không chạy đồng bộ). */
  const form = () => uiRef.current.form || {}
  /** Ghi db: fn(d) trả về phần thay đổi. */
  const up = (fn) => setDb((d) => ({ ...d, ...fn(d) }))

  /**
   * Ghi/đè một dòng đối chiếu buổi. Lần đầu chạm vào là LƯU con số hiện tại — từ đó sửa điểm
   * danh hay sửa quỹ nhóm không làm đổi khoản đã chốt nữa. Cùng nguyên tắc đóng băng giá thành.
   */
  const upsertAdjust = (d, row, patch) => {
    const list = (d.adjustments || []).slice()
    const i = list.findIndex((x) => x.key === row.key)
    const base = i >= 0 ? list[i] : {
      id: uid(), key: row.key, month: row.month, groupId: row.groupId, memberId: row.memberId,
      kind: row.kind, sessions: row.sessions, unit: row.unit, amount: row.amount,
      settle: 'cash', paid: false, paidAt: null,
    }
    const next = { ...base, ...patch }
    if (i >= 0) list[i] = next
    else list.push(next)
    return list
  }

  /**
   * Áp một lần kiểm kho, trả về phần state thay đổi. Dùng chung cho nút "Kiểm kho" và ô
   * "còn lại trong tủ" lúc nhập đợt cầu — hai lối vào, một logic.
   *
   * Ba việc: chỉnh số cầu các buổi CÒN ƯỚC LƯỢNG của tháng đó · đóng băng CỨNG lại giá thành
   * mấy buổi vừa chỉnh · ghi một dòng lịch sử kiểm kho.
   * KHÔNG tạo giao dịch nào: tiền cầu đã ra khỏi quỹ lúc mua, kiểm kho chỉ chia lại số tiền
   * đã trả đó cho các buổi. Chia lại một cái bánh đã mua thì không tốn thêm tiền.
   */
  const stockCheckPatch = (d, date, counted) => {
    const { month, systemLeft, diff, est, n } = checkPreview(d, date, counted)
    const delta = spreadDiff(est, diff)
    return {
      sessions: d.sessions.map((x) => {
        if (delta[x.id] === undefined) return x
        const next = {
          ...x, shuttleUsed: Math.max(0, x.shuttleUsed + delta[x.id]),
          shuttleEst: false, shuttleMode: 'exact',
        }
        return { ...next, ...freezeCost(d, next, date) }
      }),
      stockChecks: (d.stockChecks || []).concat([{
        id: uid(), date, month, counted: intOf(counted),
        systemLeft, diff, spread: diff ? n : 0,
      }]),
    }
  }
  const upUi = (fn) => setUi((u) => ({ ...u, ...fn(u) }))
  const myRole = () => db().viewAs || 'owner'

  /**
   * Chia sân ghi xuống `session_lineups` · `session_court_groups` · `matches` · `match_players`,
   * mà RLS gác cả bốn bằng cờ `assign` (`0002_auth_rls.sql:409`). Vai `member` CÓ route `assign`
   * (handoff: 3 màn mobile của thành viên) nhưng KHÔNG có cờ đó.
   *
   * Không chặn ở đây thì: member kéo một người → Supabase từ chối → `flush()` ném lỗi → ảnh chụp
   * đồng bộ không cập nhật → op hỏng phát lại mãi và **cả hàng đợi kẹt**, trong khi màn hình vẫn
   * báo đã lưu. Chặn bằng toast, không disable im lặng (ARCHITECTURE §4 quy ước 2).
   */
  const canAssign = () => {
    if (can(myRole(), 'assign')) return true
    toast(t('toast.noAssignPerm'))
    return false
  }

  /** Danh sách cố định của một tháng, suy từ groupIds nếu tháng đó chưa có bản ghi riêng. */
  const ensureRoster = (d, month) => {
    if (d.roster[month]) return d.roster[month]
    const r = {}
    d.groups.forEach((g) => {
      r[g.id] = {}
      d.members.filter((m) => (m.groupIds || []).indexOf(g.id) >= 0).forEach((m) => { r[g.id][m.id] = 'fixed' })
    })
    return r
  }

  /**
   * Buổi ĐỘT XUẤT: đồng bộ dòng thu theo giá giao lưu với bảng điểm danh vừa đổi. Gọi từ MỌI
   * đường sửa điểm danh (toggleAtt · addExtra · removeExtra · markAll) — sót một đường là có
   * người đánh mà không có dòng tiền, và không màn nào lộ ra chuyện đó.
   * Công thức thuần nằm ở `money.js: adhocCharges`; đây chỉ gắn `id`.
   */
  const withAdhocCharges = (d, sid, att) => {
    const { add, remove } = adhocCharges(d, sessionOf(d, sid), att)
    if (!add.length && !remove.length) return {}
    return {
      sessionGuests: d.sessionGuests
        .filter((g) => remove.indexOf(g.id) < 0)
        .concat(add.map((r) => ({ id: uid(), ...r }))),
    }
  }

  /** Buổi đang ở chế độ định mức thì cập nhật lại số cầu khi số sân đổi. */
  const syncQuota = (d, s) => (s.shuttleMode === 'quota' ? { ...s, shuttleUsed: quotaFor(d, s) } : s)

  /** Điều hướng qua React Router. */
  const nav = (key, id) => navRef.current && navRef.current(pathOf(key, id))

  const patchSession = (sid, fn) =>
    up((d) => ({ sessions: d.sessions.map((x) => (x.id === sid ? fn(x, d) : x)) }))

  const A = {
    /* ---------- điều hướng, tháng, tab, form ---------- */
    go: (key, id) => nav(key, id),
    openSession: (id) => {
      setDb((d) => ({ ...d, sessionId: id }))
      nav('session', id)
    },
    shiftMonth: (delta) => up((d) => ({ month: addMonth(d.month, delta) })),
    /** Đồng bộ buổi đang xem theo URL — các action như addGuest/addSessionCourt dùng db.sessionId. */
    setSessionId: (id) => setDb((d) => (d.sessionId === id ? d : { ...d, sessionId: id })),
    setTab: (k, v) => upUi((u) => ({ tab: { ...u.tab, [k]: v } })),
    setF: (k, v) => upUi((u) => ({ form: { ...u.form, [k]: v } })),
    openDialog: (name, form = {}) => upUi(() => ({ dialog: name, form })),
    closeDialog: () => upUi(() => ({ dialog: null, form: {} })),
    confirm: (options) => {
      const c = typeof options === 'string' ? { message: options } : options
      upUi(() => ({ confirm: c }))
    },
    alert: (options) => {
      const c = typeof options === 'string'
        ? { message: options, alertOnly: true, confirmText: 'Đóng' }
        : { ...options, alertOnly: true, confirmText: options.okText || options.confirmText || 'Đóng' }
      upUi(() => ({ confirm: c }))
    },
    closeConfirm: () => upUi(() => ({ confirm: null })),
    toggleExpand: (k) => upUi((u) => ({ expanded: { ...u.expanded, [k]: !u.expanded[k] } })),
    setAllExpanded: (map) => upUi(() => ({ expanded: map })),
    toast,

    /* ---------- CLB, vai, tài khoản ---------- */
    setViewAs: (v) => {
      // Chỉ cho xem như vai của mình hoặc yếu hơn — xem viewAsOptions.
      if (viewAsOptions(db().myRole).indexOf(v) < 0) return toast(t('toast.viewAsDenied'))
      up(() => ({ viewAs: v }))
      toast(t('toast.viewAs', { role: roleName(v), desc: roleDesc(v) }))
    },
    setMemberRole: (mid, role) => {
      if (!can(myRole(), 'members')) return toast(t('toast.noMemberPerm'))
      up((d) => ({ members: d.members.map((m) => (m.id === mid ? { ...m, role } : m)) }))
      toast(t('toast.roleChanged', { name: memberOf(db(), mid).name, role: roleName(role) }))
    },
    linkMemberUser: (mid, uid) => {
      if (!uid) return toast(t('toast.pickMemberRecord'))
      // Một user chỉ gắn 1 bản ghi trong 1 CLB: bản ghi cũ tự bị bỏ ghép.
      up((d) => ({
        members: d.members.map((m) => {
          if (m.id === mid) return { ...m, userId: uid, linkedAt: d.today }
          if (m.userId === uid) return { ...m, userId: null }
          return m
        }),
      }))
      const u = db().users.find((x) => x.id === uid)
      toast(t('toast.linked', { name: memberOf(db(), mid).name, account: u ? u.name : uid }))
    },
    unlinkMember: (mid) => {
      up((d) => ({ members: d.members.map((m) => (m.id === mid ? { ...m, userId: null } : m)) }))
      toast(t('toast.unlinked'))
    },
    // Mời qua SĐT đã gỡ khỏi client: phần TẠO bản ghi chạy được nhưng phần NHẬN (mở link →
    // tạo tài khoản → tự ghép) chưa có, nên nút chỉ hứa suông. Bảng `club_invites` và cột
    // `clubs.allow_invite` giữ nguyên dưới DB, chờ làm thành một module riêng có gửi tin thật.
    // Hai hành động dưới KHÔNG đi qua đồng bộ ngầm: người xin vào chưa phải thành viên nên
    // client không có quyền ghi thẳng. Gọi RPC (SECURITY DEFINER) rồi nạp lại CLB.
    /**
     * `fields`: các trường (`lib/members.js: MERGE_FIELDS`) chủ CLB tick để lấy từ hồ sơ tài
     * khoản đè lên bản ghi thành viên. Rỗng = chỉ gắn tài khoản, giữ nguyên dữ liệu CLB đang
     * dùng để tính tiền — đó là mặc định, và là hành vi trước 0009.
     *
     * Chỉ có nghĩa khi GHÉP (`mid` khác rỗng). Nhánh tạo mới lấy trọn hồ sơ vì không có dữ
     * liệu cũ nào để giữ; RPC bỏ qua `p_fields` ở nhánh đó.
     */
    approveJoin: async (rid, mid, fields) => {
      const d0 = db()
      const req = (d0.joinRequests || []).find((r) => r.id === rid)
      if (!req) return
      const u = d0.users.find((x) => x.id === req.userId)
      const name = mid ? memberOf(d0, mid).name : ''
      const take = mid ? (fields || []) : []
      try {
        unwrap(await supabase.rpc('approve_join_request', {
          p_request: rid, p_member_id: mid || null, p_fields: take,
        }))
      } catch (e) {
        // DB chưa apply 0009 thì hàm 3 tham số không tồn tại và PostgREST trả nguyên văn
        // "Could not find the function public.approve_join_request(...) in the schema cache" —
        // câu đó không nói cho ai biết phải làm gì.
        const m = String(e.message || '')
        return toast(/approve_join_request|schema cache/i.test(m) ? t('sync.needMigrate') : m)
      }
      await reload()
      if (!mid) return toast(t('toast.memberCreatedFromUser', { account: u ? u.name : '' }))
      // Ghi đè trường nào phải nói ra: đó là dữ liệu CLB vừa bị thay, và không có đường lùi.
      toast(take.length
        ? t('toast.linkedFields', {
            name, account: u ? u.name : '',
            fields: take.map((f) => t('members.changeField.' + f)).join(', '),
          })
        : t('toast.linked', { name, account: u ? u.name : '' }))
    },
    rejectJoin: async (rid) => {
      try {
        unwrap(await supabase.rpc('reject_join_request', { p_request: rid }))
      } catch (e) {
        return toast(e.message)
      }
      await reload()
      toast(t('toast.joinRejected'))
    },
    toggleLinkMode: (k) => {
      up((d) => {
        const lm = { code: true, invite: true, phone: true, ...d.club.linkModes }
        lm[k] = !lm[k]
        return { club: { ...d.club, linkModes: lm } }
      })
    },

    /* ---------- điểm danh ---------- */
    toggleAtt: (sid, mid) =>
      up((d) => {
        const a = { ...d.attendance }
        const m = { ...(a[sid] || {}) }
        // Người đi thêm không có trạng thái "vắng" — họ không cố định nhóm này nên không nợ
        // buổi nào. Muốn bỏ thì bấm nút xoá.
        if (m[mid] === 'extra') return {}
        m[mid] = m[mid] === true ? false : true
        a[sid] = m
        return { attendance: a, ...withAdhocCharges(d, sid, m) }
      }),
    /** Thêm người đi thêm: thành viên nhóm khác hôm nay có đánh. Sinh khoản THU ở đối chiếu. */
    addExtra: (sid, mid) => {
      if (!mid) return toast(t('toast.needMember'))
      up((d) => {
        const m = { ...(d.attendance[sid] || {}), [mid]: 'extra' }
        return { attendance: { ...d.attendance, [sid]: m }, ...withAdhocCharges(d, sid, m) }
      })
      toast(t('toast.extraAdded', { name: memberOf(db(), mid).name }))
    },
    removeExtra: (sid, mid) => {
      up((d) => {
        const m = { ...(d.attendance[sid] || {}) }
        delete m[mid]
        return { attendance: { ...d.attendance, [sid]: m }, ...withAdhocCharges(d, sid, m) }
      })
      toast(t('toast.extraRemoved'))
    },
    markAll: (sid, val) => {
      up((d) => {
        const s = sessionOf(d, sid)
        const a = { ...d.attendance }
        // Bắt đầu từ bảng cũ chứ không bảng rỗng: "tất cả có mặt/vắng" chỉ nói về danh sách
        // CỐ ĐỊNH, không được hất người đi thêm ra khỏi buổi.
        const m = { ...(a[sid] || {}) }
        groupMembers(d, s.groupId, monthOf(s.date)).forEach((x) => { m[x.id] = val })
        a[sid] = m
        return { attendance: a, ...withAdhocCharges(d, sid, m) }
      })
      toast(t(val ? 'toast.allPresent' : 'toast.allAbsent'))
    },

    /* ---------- cầu của buổi ---------- */
    setShuttleMode: (sid, mode) =>
      patchSession(sid, (x, d) => {
        if (mode === 'quota') return { ...x, shuttleMode: 'quota', shuttleEst: true, shuttleUsed: quotaFor(d, x) }
        if (mode === 'tubes') {
          const pt = perTube(d, x)
          const tb = x.tubesOpened || Math.floor((x.shuttleUsed || 0) / pt)
          return { ...x, shuttleMode: 'tubes', shuttleEst: false, tubesOpened: tb, loose: x.loose || 0, shuttleUsed: tb * pt + (x.loose || 0) }
        }
        return { ...x, shuttleMode: 'exact', shuttleEst: false }
      }),
    setShuttle: (sid, v) =>
      patchSession(sid, (x) => ({ ...x, shuttleUsed: intOf(v), shuttleEst: false })),
    bumpTubes: (sid, delta) =>
      patchSession(sid, (x, d) => {
        const pt = perTube(d, x)
        const tb = Math.max(0, (x.tubesOpened || 0) + delta)
        return { ...x, shuttleMode: 'tubes', shuttleEst: false, tubesOpened: tb, shuttleUsed: tb * pt + (x.loose || 0) }
      }),
    bumpLoose: (sid, delta) =>
      patchSession(sid, (x, d) => {
        const pt = perTube(d, x)
        const lo = Math.max(0, (x.loose || 0) + delta)
        return { ...x, shuttleMode: 'tubes', shuttleEst: false, loose: lo, shuttleUsed: (x.tubesOpened || 0) * pt + lo }
      }),

    /* ---------- sân của buổi ---------- */
    setSold: (sid, i, k, v) =>
      patchSession(sid, (x, d) => {
        const rows = (x.courts || []).slice()
        rows[i] = { ...rows[i], [k]: k === 'soldAmount' ? intOf(v) : v }
        return syncQuota(d, { ...x, courts: rows })
      }),
    toggleCourtSold: (sid, i) =>
      patchSession(sid, (x, d) => {
        const rows = (x.courts || []).slice()
        const r = rows[i]
        rows[i] = r.sold
          ? { ...r, sold: false, soldAmount: 0, soldTo: '' }
          : { ...r, sold: true, soldAmount: Math.round(rowCost(d, r) / 1000) * 1000 }
        return syncQuota(d, { ...x, courts: rows })
      }),
    addSessionCourt: () => {
      const f = form()
      const sid = db().sessionId
      up((d) => ({
        sessions: d.sessions.map((x) =>
          x.id === sid
            ? syncQuota(d, {
                ...x,
                courts: (x.courts || []).concat([
                  { courtId: f.acCourt, from: f.acFrom, to: f.acTo, sold: false, soldAmount: 0, soldTo: '', extra: true },
                ]),
              })
            : x
        ),
      }))
      upUi(() => ({ dialog: null, form: {} }))
      toast(t('toast.courtAdded'))
    },
    /** Ghi chú của một buổi. Cột `sessions.note` có sẵn dưới DB và đã map hai chiều từ lâu,
     *  chỉ là chưa có ô nhập nào. */
    setSessionNote: (sid, v) => patchSession(sid, (x) => ({ ...x, note: v })),

    /**
     * XOÁ CỨNG một buổi — chỉ khi chưa ai chạm vào (`money.js: sessionRefs`). Sáu bảng con
     * cascade theo `sessions`, nên xoá buổi đã có dấu vết là mất điểm danh, trận và tiền khách
     * đã thu, âm thầm. Có dấu vết thì dùng Huỷ.
     */
    deleteSession: (sid) => {
      const d0 = db()
      const was = sessionOf(d0, sid)
      if (!was) return
      const why = sessionRefs(d0, sid)
      if (why.length) {
        return toast(t('toast.sessionHasRefs', {
          why: why.map((k) => t('session.ref.' + k)).join(', '),
        }))
      }
      up((d) => ({ sessions: d.sessions.filter((x) => x.id !== sid) }))
      toast(t('toast.sessionDeleted', { date: dd(was.date) }))
    },

    removeSessionCourt: (sid, i) =>
      patchSession(sid, (x, d) => {
        const rows = (x.courts || []).slice()
        rows.splice(i, 1)
        return syncQuota(d, { ...x, courts: rows })
      }),

    /* ---------- trạng thái buổi ---------- */
    /**
     * Chốt buổi → ĐÓNG BĂNG giá thành vào chính bản ghi buổi. Mở lại / huỷ → bỏ đóng băng.
     * Không đóng băng thì mua thêm một đợt cầu giá khác là mọi buổi cũ đổi con số, sang năm
     * mở lại tháng cũ user thấy số khác số họ đã đọc hôm nay.
     * Đây là Tầng B — vẫn KHÔNG sinh dòng nào ở sổ quỹ (xem DATABASE.md §3.1).
     */
    setSessionStatus: (sid, st) => {
      up((d) => ({
        sessions: d.sessions.map((x) => {
          if (x.id !== sid) return x
          const base = { ...x, status: st, closedAt: st === 'closed' ? d.today : x.closedAt }
          return st === 'closed'
            ? { ...base, ...freezeCost(d, base, d.today) }
            : { ...base, ...unfrozenCost(base) }
        }),
      }))
      const key = { closed: 'sessionClosed', open: 'sessionOpened', cancelled: 'sessionCancelled' }[st] || 'sessionDraft'
      toast(t('toast.' + key))
    },

    /* ---------- khách giao lưu ---------- */
    addGuest: () => {
      const f = form()
      const name = (f.gName || '').trim()
      if (!name) return toast(t('toast.needGuestName'))
      if (!f.gBy) return toast(t('toast.needGuestInviter'))
      const level = f.gLevel || db().levels[0]
      // CLB chưa có thang trình độ: `level` undefined đi thẳng xuống cột NOT NULL và lần đồng bộ
      // sau chết im lặng ở Supabase, khách thì đã hiện trên màn hình.
      if (!level) return toast(t('toast.noClubLevels'))
      const gender = f.gGender || 'nam'
      const d0 = db()

      // Tra khách và sinh id TRƯỚC updater — cần biết `gid` để chặn trùng, và sinh id trong
      // updater thì StrictMode gọi hai lần ra hai id khác nhau.
      const old = d0.guests.find((x) => x.name.toLowerCase() === name.toLowerCase())
      const gid = old ? old.id : uid()

      // Một khách chỉ có MỘT lượt trong một buổi. Thêm hai lượt thì tiền vẫn đúng nhưng chia
      // sân hỏng: `assign.js: sessionPlayers` lấy `guestId` làm khoá người chơi, hai lượt cùng
      // khoá nên chỉ đứng được một ô, và `matchStats` đếm số trận gấp đôi cho khách đó.
      if (sGuests(d0, d0.sessionId).some((x) => x.guestId === gid)) {
        return toast(t('toast.guestDup', { name: old ? old.name : name }))
      }

      up((d) => ({
        guests: old
          ? d.guests.map((x) => (x.id === gid ? { ...x, invitedBy: f.gBy } : x))
          : d.guests.concat([{ id: gid, name, gender, level, invitedBy: f.gBy, phone: '' }]),
        sessionGuests: d.sessionGuests.concat([{
          id: uid(), sessionId: d.sessionId, guestId: gid, level, gender,
          price: guestPrice(d, level, gender), paid: !!f.gPaid, invitedBy: f.gBy,
        }]),
      }))
      upUi((u) => ({ form: { ...u.form, gName: '' } }))
      toast(t('toast.guestAdded', { name, by: memberOf(db(), f.gBy).name, price: fmt(guestPrice(db(), level, gender)) }))
    },
    toggleGuestPaid: (id) =>
      up((d) => ({ sessionGuests: d.sessionGuests.map((g) => (g.id === id ? { ...g, paid: !g.paid } : g)) })),
    /**
     * Sửa đè giá một lượt thu. Bảng giá theo trình độ chỉ là GỢI Ý — CLB miễn cho người mới,
     * lấy rẻ người nhà, thu thêm người đến muộn… đều là chuyện thường. Đã thu rồi thì khoá:
     * sửa số sau khi tiền vào quỹ là sổ quỹ lệch mà không có dòng nào giải thích.
     */
    setChargePrice: (id, v) =>
      up((d) => ({
        sessionGuests: d.sessionGuests.map((g) => (g.id === id && !g.paid ? { ...g, price: intOf(v) } : g)),
      })),
    removeGuest: (id) => {
      up((d) => ({ sessionGuests: d.sessionGuests.filter((g) => g.id !== id) }))
      toast(t('toast.guestRemoved'))
    },
    setGuestInviter: (sgId, mid) =>
      up((d) => ({ sessionGuests: d.sessionGuests.map((x) => (x.id === sgId ? { ...x, invitedBy: mid } : x)) })),
    /** `id` là guestId (khách) hoặc memberId (thành viên đi buổi đột xuất) — xem `guestDebtRows`. */
    collectDebt: (id) => {
      const d0 = db()
      const row = d0.sessionGuests.find((g) => g.guestId === id || g.memberId === id)
      up((d) => ({
        sessionGuests: d.sessionGuests.map((g) => {
          const ss = sessionOf(d, g.sessionId)
          const mine = g.guestId === id || g.memberId === id
          return mine && ss && monthOf(ss.date) === d.month ? { ...g, paid: true } : g
        }),
      }))
      toast(t('toast.debtCollected', { name: row ? chargeName(d0, row) : guestOf(d0, id).name }))
    },

    /* ---------- quỹ tháng, back tiền, danh sách cố định ---------- */
    /**
     * Ghi nhận tiền quỹ tháng đã NHẬN. `amount` bỏ trống = thu nốt phần còn thiếu.
     * Không dùng cờ bật/tắt nữa: đóng trước một phần là chuyện thường, cờ boolean thì hoặc
     * ghi thừa hoặc ghi thiếu.
     */
    payDue: (id, amount) => {
      const was = db().dues.find((y) => y.id === id)
      if (!was) return
      const st = dueState(was)
      const add = amount === undefined ? st.remain : intOf(amount)
      if (add <= 0) return toast(t('toast.needAmount'))
      const next = st.paid + add
      up((d) => ({ dues: d.dues.map((x) => (x.id === id ? { ...x, paidAmount: next, paidAt: d.today } : x)) }))
      const name = memberOf(db(), was.memberId).name
      const left = Math.max(0, st.amount - next)
      toast(left > 0
        ? t('toast.duePartial', { name, amount: fmt(add), remain: fmt(left) })
        : t('toast.duePaid', { name, amount: fmt(add) }))
    },
    /** Xoá sạch số đã nhận của một khoản — dùng khi ghi nhầm người. */
    clearDue: (id) => {
      const was = db().dues.find((y) => y.id === id)
      if (!was || !dueState(was).paid) return
      up((d) => ({ dues: d.dues.map((x) => (x.id === id ? { ...x, paidAmount: 0, paidAt: null } : x)) }))
      toast(t('toast.dueUnpaid', { name: memberOf(db(), was.memberId).name }))
    },
    /**
     * Đánh dấu một khoản đối chiếu đã trả / đã thu.
     *   amount ÂM  → chi "Back cố định nghỉ"
     *   amount DƯƠNG → thu "Đi thêm buổi"
     * Riêng settle='offset_next_dues' thì KHÔNG sinh giao dịch — trừ vào quỹ tháng sau.
     */
    settleAdjust: (key) => {
      const month = key.split(':')[0]
      const row = adjustRows(db(), month).find((x) => x.key === key)
      if (!row) return
      up((d) => (row.paid && row.settle === 'cash'
        // Bỏ đánh dấu một khoản trả tiền mặt: xoá dòng đã lưu để số quay về tính live.
        // Khoản trừ tháng sau thì giữ lại, vì cách trả là lựa chọn của user chứ không suy ra được.
        ? { adjustments: (d.adjustments || []).filter((x) => x.key !== key) }
        : { adjustments: upsertAdjust(d, row, { paid: !row.paid, paidAt: row.paid ? null : d.today }) }))
      const back = row.amount < 0
      toast(row.paid
        ? t('toast.adjustUndone')
        : t(back ? 'toast.adjustPaid' : 'toast.adjustCollected',
             { name: row.member.name, amount: fmt(Math.abs(row.amount)) }))
    },
    /** Chọn cách trả: tiền mặt, hay trừ vào quỹ tháng sau. */
    setAdjustSettle: (key, settle) => {
      const month = key.split(':')[0]
      const row = adjustRows(db(), month).find((x) => x.key === key)
      if (!row || row.paid) return
      up((d) => (settle === 'cash' && !row.saved
        ? {}
        : { adjustments: upsertAdjust(d, row, { settle }) }))
      toast(t(settle === 'cash' ? 'toast.settleCash' : 'toast.settleOffset', { name: row.member.name }))
    },
    setAdjustAmount: (key, amount) => {
      const month = key.split(':')[0]
      const row = adjustRows(db(), month).find((x) => x.key === key)
      if (!row || row.paid) return
      const amt = intOf(amount)
      const sign = row.amount < 0 ? -1 : 1
      up((d) => ({
        adjustments: upsertAdjust(d, row, { amount: sign * Math.abs(amt) }),
      }))
    },
    /**
     * Ô cố định của một người trong một ca. `'none'` KHÔNG phải một trạng thái lưu được: enum
     * `roster_state` dưới DB chỉ có ('fixed','off','pending'), còn `money.js: rosterStatus` suy
     * ra 'none' từ chỗ KHÔNG CÓ bản ghi. Nên 'none' phải XOÁ ô, không phải ghi chuỗi 'none' —
     * ghi xuống là Postgres 22P02 và cả hàng đợi đồng bộ kẹt lại, trong khi màn hình vẫn hiện
     * thay đổi nên không ai biết là chưa lưu.
     */
    setRoster: (month, gid, mid, val) =>
      up((d) => {
        const all = { ...d.roster }
        const base = d.roster[month] || ensureRoster(d, month)
        const gm = { ...(base[gid] || {}) }
        if (cfg.rosterStates.indexOf(val) < 0) delete gm[mid]
        else gm[mid] = val
        all[month] = { ...base, [gid]: gm }
        return { roster: all }
      }),
    lockRoster: (month) => {
      const wasLocked = !!db().locked[month]
      up((d) => {
        // ponytail: bỏ chốt chỉ tắt cờ, KHÔNG hoàn lại các khoản đã trừ vào quỹ tháng này.
        // Đúng như hành vi cũ (dues sinh ra vẫn ở lại). Cần hoàn thì phải có bước huỷ riêng.
        if (d.locked[month]) return { locked: { ...d.locked, [month]: false } }
        // Công thức nằm ở money.js: lockDues — đây là chỗ sinh ra toàn bộ tiền phải thu của
        // một tháng, phải test được bằng node chứ không chỉ bấm thử.
        const { rows, used } = lockDues(d, month)
        return {
          dues: d.dues.concat(rows.map((r) => ({ id: uid(), ...r }))),
          adjustments: (d.adjustments || []).map((x) =>
            used.indexOf(x.key) < 0 ? x : { ...x, paid: true, paidAt: month + '-01' }),
          locked: { ...d.locked, [month]: true },
        }
      })
      toast(wasLocked ? t('toast.rosterUnlocked') : t('toast.rosterLocked', { month: monthTxt(month).toLowerCase() }))
    },
    approveChange: (id, ok) => {
      up((d) => {
        const c = d.changes.find((x) => x.id === id)
        if (!c) return {}
        let members = d.members
        if (ok) {
          members = d.members.map((m) => {
            if (m.id !== c.memberId) return m
            if (c.field === 'phone') return { ...m, phone: c.to }
            if (c.effective === 'now') return { ...m, level: c.to, pendingLevel: null, pendingLevelFrom: null }
            // Mốc lấy từ HÔM NAY, không phải tháng đang chọn ở header: duyệt trong lúc xem
            // tháng cũ thì mốc rơi vào quá khứ và trình độ mới áp dụng ngay, đổi luôn cái
            // hiện trên các buổi đã đánh xong.
            return { ...m, pendingLevel: c.to, pendingLevelFrom: addMonth(monthOf(d.today), 1) }
          })
        }
        return { members, changes: d.changes.map((x) => (x.id === id ? { ...x, status: ok ? 'approved' : 'rejected' } : x)) }
      })
      toast(t(ok ? 'toast.changeApproved' : 'toast.changeRejected'))
    },

    /* ---------- thành viên ---------- */
    /**
     * Lưu sửa thành viên, gồm cả NHÓM CỐ ĐỊNH — trước đây phải đi đường vòng qua tab Danh sách
     * cố định, mà tab đó lại chỉ thấy tháng sau nên coi như không sửa được.
     *
     * Gỡ hết nhóm = thành người đi lẻ (vãng lai). Khi đó khoản quỹ tháng của nhóm bị gỡ:
     *   chưa đóng đồng nào → XOÁ, không thì họ bị nhắc một khoản không còn phải đóng;
     *   đã đóng một phần   → GIỮ nguyên và ghi chú lý do. Tiền đã vào quỹ thật thì không được
     *                        tự bốc hơi khỏi sổ, và họ đã trả cho các buổi của tháng đó rồi.
     */
    saveMember: () => {
      const f = form()
      const d0 = db()
      const was = d0.members.find((m) => m.id === f.eId)
      if (!was) return
      const gs = f.eGroups || []
      const gMonth = f.eWhenGroup === 'now' ? d0.month : addMonth(d0.month, 1)

      // Trình độ mới luôn áp dụng ngay lập tức cho các buổi sắp tới
      const mb = {
        ...was,
        name: f.eName,
        phone: f.ePhone || '',
        gender: f.eGender,
        level: f.eLevel,
        pendingLevel: null,
        pendingLevelFrom: null,
        note: f.eNote || '',
        groupIds: gs.slice(),
      }

      // Tính TRƯỚC updater rồi mới ghi: cộng dồn `kept`/`dropped` bên trong updater là đọc
      // state rồi gây side effect ở đó — React 19 StrictMode gọi updater hai lần và toast báo
      // gấp đôi số tiền (xem ARCHITECTURE §4 quy ước 1).
      const { dues, add, kept, dropped } = regroupDues(d0, mb, gs, gMonth)
      const rows = add.map((r) => ({ id: uid(), ...r }))

      up((d) => {
        const roster = { ...d.roster }
        const base = roster[gMonth] || ensureRoster(d, gMonth)
        const next = { ...base }
        d.groups.forEach((g) => {
          next[g.id] = { ...(next[g.id] || {}), [f.eId]: gs.indexOf(g.id) >= 0 ? 'fixed' : 'off' }
        })
        roster[gMonth] = next
        return { members: d.members.map((m) => (m.id === f.eId ? mb : m)), roster, dues: dues.concat(rows) }
      })
      upUi(() => ({ dialog: null, form: {} }))
      toast(kept > 0
        ? t('toast.memberSavedKept', { amount: fmt(kept), month: monthTxt(gMonth).toLowerCase() })
        : dropped > 0
          ? t('toast.memberSavedDropped', { n: dropped, month: monthTxt(gMonth).toLowerCase() })
          : t('toast.memberSaved'))
    },
    /**
     * Ngưng hoạt động: giữ nguyên toàn bộ lịch sử điểm danh và tiền, chỉ ẩn khỏi danh sách.
     *
     * `back` > 0 thì ghi thêm một dòng chi "Back cố định nghỉ" vào sổ quỹ. Phải ghi ở đây chứ
     * không qua bảng đối chiếu: người đã ngưng thì `adjustRows` không sinh dòng cho họ nữa
     * (nó lọc qua `groupMembers`, mà `groupMembers` bỏ người `active === false`).
     * Trả bao nhiêu, hay không trả, là thoả thuận của CLB — app chỉ gợi ý số.
     */
    deactivate: (id, back) => {
      const was = db().members.find((m) => m.id === id)
      if (!was) return
      const amount = intOf(back)
      up((d) => ({
        members: d.members.map((m) => (m.id === id ? { ...m, active: false } : m)),
        manual: amount > 0
          ? d.manual.concat([{
              id: uid(), date: d.today, dir: 'out', cat: CATS.back,
              label: t('members.offBackLabel', { name: was.name, month: monthTxt(d.month).toLowerCase() }),
              amount, by: memberOf(d, (d.members.find((m) => m.userId === d.currentUserId) || {}).id).name,
            }])
          : d.manual,
      }))
      upUi(() => ({ dialog: null, form: {} }))
      toast(amount > 0
        ? t('toast.memberOffBack', { name: was.name, amount: fmt(amount) })
        : t('toast.memberOff', { name: was.name }))
    },
    /**
     * Cho hoạt động lại. KHÔNG đụng tiền: khoản back đã ghi lúc ngưng là giao dịch thật,
     * người ta quay lại thì thu lại bằng một dòng thu tay, không xoá lịch sử.
     */
    reactivate: (id) => {
      const was = db().members.find((m) => m.id === id)
      if (!was) return
      up((d) => ({ members: d.members.map((m) => (m.id === id ? { ...m, active: true } : m)) }))
      toast(t('toast.memberOn', { name: was.name }))
    },
    /**
     * Xoá cứng — CHỈ khi chưa dính điểm danh, tiền, trận nào. Dính rồi thì xoá là mất lịch sử
     * của tháng đã chốt, và khoá ngoại dưới DB cũng chặn.
     */
    deleteMember: (id) => {
      const d0 = db()
      const m = d0.members.find((x) => x.id === id)
      if (!m) return
      const why = memberRefs(d0, id)
      if (why.length) {
        return toast(t('toast.memberHasRefs', { name: m.name, why: why.map((k) => t('members.ref.' + k)).join(', ') }))
      }
      up((d) => {
        // Dọn cả bản ghi danh sách cố định, không thì khoá ngoại group_memberships chặn lúc ghi.
        const roster = {}
        Object.keys(d.roster || {}).forEach((month) => {
          roster[month] = {}
          Object.keys(d.roster[month]).forEach((gid) => {
            const gm = { ...d.roster[month][gid] }
            delete gm[id]
            roster[month][gid] = gm
          })
        })
        return { members: d.members.filter((x) => x.id !== id), roster }
      })
      toast(t('toast.memberDeleted', { name: m.name }))
    },
    deleteMembersBulk: (ids) => {
      const d0 = db()
      const toDel = []
      const blocked = []
      ids.forEach((id) => {
        const m = d0.members.find((x) => x.id === id)
        if (!m) return
        const why = memberRefs(d0, id)
        if (why.length) blocked.push(m.name)
        else toDel.push(id)
      })

      if (!toDel.length) {
        return toast('Không thể xoá vì tất cả thành viên đã chọn đều đã có dữ liệu tham gia/tiền quỹ.')
      }

      const idSet = new Set(toDel)
      up((d) => {
        const roster = {}
        Object.keys(d.roster || {}).forEach((month) => {
          roster[month] = {}
          Object.keys(d.roster[month]).forEach((gid) => {
            const gm = { ...d.roster[month][gid] }
            toDel.forEach((id) => delete gm[id])
            roster[month][gid] = gm
          })
        })
        return { members: d.members.filter((x) => !idSet.has(x.id)), roster }
      })

      if (blocked.length) {
        toast(`Đã xoá ${toDel.length} thành viên. Bỏ qua ${blocked.length} người do đã có dữ liệu: ${blocked.join(', ')}`)
      } else {
        toast(`Đã xoá ${toDel.length} thành viên đã chọn`)
      }
    },
    setMembersGroupsBulk: (memberIds, groupIds) => {
      const d0 = db()
      const gs = groupIds || []
      const month = d0.month
      const nextM = addMonth(month, 1)

      let duesAccum = (d0.dues || []).slice()
      const newDuesRows = []

      const targetMembers = d0.members.filter((m) => memberIds.includes(m.id))
      targetMembers.forEach((mb) => {
        const updatedMb = { ...mb, groupIds: gs.slice() }
        const { dues, add } = regroupDues({ ...d0, dues: duesAccum }, updatedMb, gs, month)
        duesAccum = dues
        add.forEach((r) => newDuesRows.push({ id: uid(), ...r }))
      })

      up((d) => {
        const roster = { ...d.roster }
        ;[month, nextM].forEach((mKey) => {
          const base = roster[mKey] || ensureRoster(d, mKey)
          const next = { ...base }
          d.groups.forEach((g) => {
            const gm = { ...(next[g.id] || {}) }
            memberIds.forEach((id) => {
              gm[id] = gs.indexOf(g.id) >= 0 ? 'fixed' : 'off'
            })
            next[g.id] = gm
          })
          roster[mKey] = next
        })

        const idSet = new Set(memberIds)
        return {
          members: d.members.map((m) => (idSet.has(m.id) ? { ...m, groupIds: gs.slice() } : m)),
          roster,
          dues: duesAccum.concat(newDuesRows),
        }
      })

      if (gs.length === 0) {
        toast(`Đã chuyển ${memberIds.length} thành viên sang Không cố định (đi lẻ)`)
      } else {
        const gNames = d0.groups.filter((g) => gs.includes(g.id)).map((g) => g.short || g.name).join(' + ')
        toast(`Đã gán ${memberIds.length} thành viên vào: ${gNames}`)
      }
    },
    deactivateMembersBulk: (ids) => {
      const idSet = new Set(ids)
      up((d) => ({
        members: d.members.map((m) => (idSet.has(m.id) ? { ...m, active: false } : m)),
      }))
      toast(`Đã chuyển ${ids.length} thành viên sang trạng thái Ngưng hoạt động (lịch sử giữ nguyên)`)
    },
    reactivateMembersBulk: (ids) => {
      const idSet = new Set(ids)
      up((d) => ({
        members: d.members.map((m) => (idSet.has(m.id) ? { ...m, active: true } : m)),
      }))
      toast(`Đã cho ${ids.length} thành viên hoạt động trở lại`)
    },
    createMember: () => {
      const f = form()
      const d0 = db()
      const name = (f.mName || '').trim()
      if (!name) return toast(t('toast.needMemberName'))
      // Không chọn ca nào = chưa cố định (đi lẻ). KHÔNG tự gán về ca đầu tiên: người mới đến
      // chơi thử mà bị gán cố định thì tháng sau `lockDues` đẻ ra một khoản quỹ không ai yêu
      // cầu, và không có gì trên màn hình nói cho họ biết.
      const gs = (f.mGroups || []).slice()
      const start = gs.length ? f.mStart || 'next' : 'none'
      const nextM = addMonth(d0.month, 1)

      // Sinh id và tính khoản thu TRƯỚC updater. Trước đây toast đọc `db()` SAU `up()` rồi mò
      // `members[length - 1]` — mà `db()` lúc đó vẫn là state cũ (dbRef chỉ cập nhật ở
      // useLayoutEffect), nên số tiền in ra là của NGƯỜI TRƯỚC ĐÓ hoặc 0.
      const id = uid()
      const mb = {
        id, name, gender: f.mGender || 'nam', level: f.mLevel || d0.levels[0],
        groupIds: start === 'now' ? gs : [], role: 'member', phone: f.mPhone || '',
        note: f.mNote || '',
        joined: d0.today, active: true, userId: null, pendingLevel: null, pendingLevelFrom: null,
      }
      const owed = start !== 'now' ? [] : gs.map((gid) => {
        const g = d0.groups.find((x) => x.id === gid)
        const jd = g ? joinDues(d0, mb, g, d0.month) : { amount: 0 }
        return { gid, jd }
      }).filter((x) => x.jd.amount > 0)

      up((d) => {
        const roster = { ...d.roster }
        const fix = (month, gid) => {
          const base = roster[month] || ensureRoster(d, month)
          roster[month] = { ...base, [gid]: { ...(base[gid] || {}), [id]: 'fixed' } }
        }
        gs.forEach((gid) => {
          fix(nextM, gid)
          // Vào từ THÁNG NÀY thì phải cố định cả tháng này, không thì người mới không hiện ở
          // màn điểm danh và không ai chấm công cho họ được.
          if (start === 'now') fix(d.month, gid)
        })
        return {
          roster,
          members: d.members.concat([mb]),
          dues: d.dues.concat(owed.map(({ gid, jd }) => ({
            id: uid(), month: d.month, groupId: gid, memberId: id, amount: jd.amount,
            paidAmount: 0, paidAt: null, method: '',
            note: jd.full ? t('members.joinFull') : t('members.joinPartial', { n: jd.sessions }),
          }))),
        }
      })
      upUi(() => ({ dialog: null, form: {} }))
      toast(start === 'next'
        ? t('toast.memberAddedNext', { name, month: monthTxt(nextM).toLowerCase() })
        : start === 'now'
          ? t('toast.memberAddedNow', {
              name, month: monthTxt(d0.month).toLowerCase(),
              amount: fmtK(owed.reduce((x, y) => x + y.jd.amount, 0)),
            })
          : t('toast.memberAdded', { name }))
    },

    importMembers: (parsedRows, options = {}) => {
      const valid = (parsedRows || []).filter((r) => r.status !== 'error' && r.name)
      if (!valid.length) return toast(t('toast.noValidMembersToImport'))

      const d0 = db()
      const start = options.start || 'next'
      const defGid = options.defaultGroupId || null
      const nextM = addMonth(d0.month, 1)

      const newMembers = []
      const newDues = []
      const fixMap = []

      valid.forEach((row) => {
        const id = uid()
        const gs = Array.isArray(row.groupIds)
          ? row.groupIds
          : (row.groupId ? [row.groupId] : (defGid ? [defGid] : []))
        const mb = {
          id,
          name: row.name,
          gender: row.gender || 'nam',
          level: row.level || d0.levels[0],
          groupIds: start === 'now' ? gs : [],
          role: 'member',
          phone: row.phone || '',
          joined: d0.today,
          active: true,
          userId: null,
          pendingLevel: null,
          pendingLevelFrom: null,
        }
        newMembers.push(mb)

        if (start === 'now' && gs.length) {
          gs.forEach((gid) => {
            const g = d0.groups.find((x) => x.id === gid)
            const jd = g ? joinDues(d0, mb, g, d0.month) : { amount: 0 }
            if (jd && jd.amount > 0) {
              newDues.push({
                id: uid(),
                month: d0.month,
                groupId: gid,
                memberId: id,
                amount: jd.amount,
                paidAmount: 0,
                paidAt: null,
                method: '',
                note: jd.full ? t('members.joinFull') : t('members.joinPartial', { n: jd.sessions }),
              })
            }
          })
        }

        if (start !== 'none' && gs.length) {
          fixMap.push({ id, gs })
        }
      })

      up((d) => {
        const roster = { ...d.roster }
        const fix = (month, gid, mid) => {
          const base = roster[month] || ensureRoster(d, month)
          roster[month] = { ...base, [gid]: { ...(base[gid] || {}), [mid]: 'fixed' } }
        }

        fixMap.forEach(({ id, gs }) => {
          gs.forEach((gid) => {
            fix(nextM, gid, id)
            if (start === 'now') fix(d.month, gid, id)
          })
        })

        return {
          roster,
          members: d.members.concat(newMembers),
          dues: d.dues.concat(newDues),
        }
      })

      upUi(() => ({ dialog: null, form: {} }))
      toast(t('toast.membersImported', { n: newMembers.length }))
    },

    /* ---------- lịch cố định và buổi ---------- */
    toggleSchedule: (id) => {
      // Đọc TRƯỚC khi ghi: db() sau up() vẫn là state cũ (React chưa render lại).
      const was = db().schedules.find((x) => x.id === id)
      if (!was) return
      up((d) => ({ schedules: d.schedules.map((x) => (x.id === id ? { ...x, active: !x.active } : x)) }))
      toast(t(was.active ? 'toast.scheduleOff' : 'toast.scheduleOn', { name: was.name }))
    },
    toggleWeekday: (wdNum) =>
      upUi((u) => {
        const w = (u.form.weekdays || []).slice()
        const i = w.indexOf(wdNum)
        if (i < 0) w.push(wdNum)
        else w.splice(i, 1)
        return { form: { ...u.form, weekdays: w } }
      }),
    /** Bật/tắt một nhóm trong form. `field` là 'mGroups' (thêm mới) hoặc 'eGroups' (sửa). */
    toggleMemberGroup: (gid, field = 'mGroups') =>
      upUi((u) => {
        const w = (u.form[field] || []).slice()
        const i = w.indexOf(gid)
        if (i < 0) w.push(gid)
        else w.splice(i, 1)
        return { form: { ...u.form, [field]: w } }
      }),
    /**
     * Đổi nhóm trong hộp thoại tạo lịch → kéo luôn giờ mặc định của nhóm đó xuống các dòng sân.
     *
     * Trước đây `defaultCourtRows` chỉ đọc `db.groups[0]` MỘT LẦN lúc mở hộp thoại, nên tạo
     * lịch cho "Ca chủ nhật" lại điền giờ của "Ca thứ 6" (nhóm đứng đầu mảng) — và đổi nhóm
     * xong giờ vẫn đứng im. Hai ô "giờ mặc định" của nhóm vì thế trông như vô dụng: chúng có
     * dữ liệu đúng nhưng không bao giờ tới được đúng chỗ.
     *
     * Chỉ đụng dòng sân đang có, KHÔNG đụng buổi nào đã sinh — giờ của buổi nằm ở `session_courts`.
     */
    setScheduleGroup: (gid) =>
      upUi((u) => {
        const g = db().groups.find((x) => x.id === gid)
        if (!g) return { form: { ...u.form, sGroup: gid } }
        return {
          form: {
            ...u.form,
            sGroup: gid,
            rows: (u.form.rows || []).map((r) => ({ ...r, from: g.from || r.from, to: g.to || r.to })),
          },
        }
      }),
    addRow: () => {
      // CLB mới chưa có sân nào — nói rõ thay vì nổ vì đọc courts[0].
      const c = db().courts[0]
      if (!c) return toast(t('toast.needCourtFirst'))
      upUi((u) => {
        // Giờ lấy theo nhóm ĐANG CHỌN trong form, không phải `groups[0]`. Đọc groups[0] là
        // thêm dòng sân thứ hai cho lịch Ca chủ nhật lại điền giờ của Ca thứ 6 — cùng đúng
        // cái lỗi mà `setScheduleGroup` vừa vá cho dòng đầu.
        const gs = db().groups
        const g = gs.find((x) => x.id === u.form.sGroup) || gs[0]
        return {
          form: {
            ...u.form,
            rows: (u.form.rows || []).concat([
              { courtId: c.id, from: (g && g.from) || '18:00', to: (g && g.to) || '20:00' },
            ]),
          },
        }
      })
    },
    delRow: (i) =>
      upUi((u) => {
        const r = (u.form.rows || []).slice()
        r.splice(i, 1)
        return { form: { ...u.form, rows: r } }
      }),
    setRow: (i, k, v) =>
      upUi((u) => {
        const r = (u.form.rows || []).slice()
        r[i] = { ...r[i], [k]: v }
        return { form: { ...u.form, rows: r } }
      }),
    createSchedule: (dates) => {
      const f = form()
      const d0 = db()
      const sGroup = f.sGroup || (d0.groups.length > 0 ? d0.groups[0].id : '')
      if (!sGroup) return toast(t('toast.needGroupFirst'))
      if (!dates.length) return toast(t('toast.needWeekday'))
      up((d) => {
        const scId = uid()
        const rows = (f.rows || []).map((r) => ({ ...r, sold: false, soldAmount: 0, soldTo: '', extra: false }))
        const stId = d.shuttleTypes[0] ? d.shuttleTypes[0].id : null
        const exist = {}
        d.sessions.forEach((x) => { exist[x.date + '|' + sGroup] = true })
        const added = []
        dates.forEach((dt) => {
          if (exist[dt + '|' + sGroup]) return
          added.push({
            id: uid(), date: dt, groupId: sGroup, status: 'draft', shuttleUsed: 0,
            shuttleTypeId: stId, note: '', shuttleMode: 'quota', tubesOpened: 0, loose: 0, shuttleEst: true,
            courts: rows.map((r) => ({ ...r })), scheduleId: scId,
          })
        })
        return {
          schedules: d.schedules.concat([{
            id: scId, name: f.sName || 'Lịch ' + groupOf(d, f.sGroup).short, groupId: f.sGroup,
            weekdays: f.weekdays, rows: f.rows, start: f.start, end: f.end, active: true,
          }]),
          sessions: d.sessions.concat(added).sort((a, b) => (a.date < b.date ? -1 : 1)),
        }
      })
      upUi(() => ({ dialog: null, form: {} }))
      toast(t('toast.scheduleCreated', { n: dates.length, from: dd(dates[0]), to: dd(dates[dates.length - 1]) }))
    },
    /**
     * SỬA một lịch đã sinh buổi. Toàn bộ luật "được đụng buổi nào" nằm ở
     * `lib/schedules.js: planScheduleEdit` — buổi đã mở/chốt/huỷ và buổi quá khứ bất khả xâm
     * phạm, xem chú thích đầu file đó.
     *
     * Kế hoạch tính LẠI ở đây từ `db()` chứ không nhận từ dialog: dialog tính để HIỆN, action
     * tính để LÀM. Nhận bản dialog truyền xuống là có ngày người ta duyệt một bản kế hoạch
     * còn app chạy một bản khác (state đổi giữa lúc hộp thoại đang mở).
     */
    saveSchedule: () => {
      const f = form()
      const d0 = db()
      const sched = (d0.schedules || []).find((x) => x.id === f.eSchedId)
      if (!sched) return
      const plan = planScheduleEdit(d0, sched, f)
      if (plan.blocked.length) return toast(t(plan.blocked[0]))

      up((d) => applyScheduleEdit(d, sched, f, planScheduleEdit(d, sched, f), uid))
      upUi(() => ({ dialog: null, form: {} }))
      toast(t('toast.scheduleSaved', {
        name: f.sName || sched.name,
        keep: plan.keep.length, add: plan.add.length, remove: plan.remove.length,
        skip: plan.locked.length + plan.past.length,
      }))
    },
    /**
     * XOÁ HẲN một lịch. Chỉ cho khi lịch còn mềm (`planScheduleDelete`) — còn buổi đã mở/đã
     * chốt/đã qua ngày thì đường đúng là bấm "Tắt", không phải xoá.
     */
    deleteSchedule: (id) => {
      const d0 = db()
      const sched = (d0.schedules || []).find((x) => x.id === id)
      if (!sched) return
      const plan = planScheduleDelete(d0, sched)
      if (!plan.ok) return toast(t('toast.scheduleNoDelete', { n: plan.locked.length + plan.past.length }))
      up((d) => ({
        schedules: d.schedules.filter((x) => x.id !== id),
        sessions: d.sessions.filter((x) => x.scheduleId !== id),
      }))
      toast(t('toast.scheduleDeleted', { name: sched.name, n: plan.sessions.length }))
    },
    createAdhoc: () => {
      const f = form()
      if (!f.aDate) return toast(t('toast.needDate'))
      // CLB chưa có sân nào thì `defaultCourtRows` trả `courtId: ''`, mà `session_courts.court_id`
      // là `uuid NOT NULL REFERENCES courts(id)` — chuỗi rỗng xuống đó là Postgres 22P02, và vì
      // ảnh chụp đồng bộ chỉ cập nhật khi MỌI op xong nên cả hàng đợi kẹt lại. Nút "Buổi đột xuất"
      // nằm ở header nên đây là thao tác một CLB mới toanh chạm vào đầu tiên.
      if (!db().courts.length) return toast(t('toast.needCourtFirst'))
      if ((f.rows || []).some((r) => !r.courtId)) return toast(t('toast.needCourtFirst'))
      // Sinh id TRƯỚC updater: StrictMode gọi updater hai lần, gán biến ngoài ở trong đó thì
      // biến giữ id của lần gọi này còn state giữ id của lần gọi kia — nav() trỏ vào buổi
      // không tồn tại.
      const newId = uid()
      up((d) => {
        return {
          sessionId: newId,
          sessions: d.sessions.concat([{
            // LUÔN 'ALL' (→ group_id NULL). Gán buổi đột xuất vào một ca cố định thì
            // `unitPrice` đếm nó vào số buổi của ca đó, đơn giá một buổi tụt xuống, và tiền
            // back cho người vắng của CẢ ca giảm theo — không ai sửa gì mà tiền vẫn đổi.
            id: newId, date: f.aDate, groupId: 'ALL', status: 'open', shuttleUsed: 0,
            shuttleTypeId: d.shuttleTypes[0] ? d.shuttleTypes[0].id : null,
            note: 'Buổi đột xuất', shuttleMode: 'quota', tubesOpened: 0, loose: 0, shuttleEst: true,
            courts: (f.rows || []).map((r) => ({ ...r, sold: false, soldAmount: 0, soldTo: '', extra: false })),
            scheduleId: null,
          }]).sort((a, b) => (a.date < b.date ? -1 : 1)),
        }
      })
      upUi(() => ({ dialog: null, form: {} }))
      nav('session', newId)
      toast(t('toast.adhocCreated', { date: dd(f.aDate) }))
    },

    /* ---------- kho cầu ---------- */
    /**
     * Nhập một đợt cầu. Đây là chỗ DUY NHẤT tiền cầu ra khỏi quỹ — dùng cầu từng buổi không
     * ghi chi nữa, ghi thêm là đếm hai lần cùng một số tiền.
     *
     * Ô "còn lại trong tủ trước khi nhập" (tuỳ chọn) sinh luôn một lần kiểm kho. Đảo thời điểm
     * đếm sang lúc mua là lối tốt nhất: mua cầu thì đằng nào cũng mở tủ, tự nhiên hơn bắt user
     * nhớ đếm cuối tháng, mà tần suất mua vốn đã ~1 lần/tháng.
     */
    createPurchase: () => {
      const f = form()
      const d0 = db()
      // KHÔNG đặt tên biến là `t` — sẽ che hàm dịch t() và mọi toast dưới đây nổ TypeError.
      const ty = d0.shuttleTypes.find((x) => x.id === f.pType)
      if (!ty) return toast(t('toast.needShuttleType'))
      const tubes = intOf(f.pTubes)
      const extra = intOf(f.pExtra)
      const total = intOf(f.pTotal)
      const qty = tubes * ty.perTube + extra
      if (!qty) return toast(t('toast.needQty'))
      if (!total) return toast(t('toast.needTotal'))

      // Ngày để trống thì rơi về hôm nay — nếu không, `date` lưu là '' còn `month` lại tính
      // theo hôm nay, hai con số của cùng một lần kiểm kho lệch nhau.
      const pDate = f.pDate || d0.today
      // Đếm tủ TRƯỚC khi nhập: kiểm kho phải tính trên tồn cũ và giá bình quân cũ.
      const left = String(f.pLeft ?? '').trim()
      const check = left === '' || checkOf(d0, monthOf(pDate)) ? null : checkPreview(d0, pDate, left)
      const canCheck = !!check && (check.diff === 0 || check.n > 0)

      up((d) => ({
        ...(canCheck ? stockCheckPatch(d, pDate, left) : {}),
        purchases: d.purchases.concat([{
          id: uid(), date: pDate, typeId: f.pType, tubes, extra, qty,
          pricePerTube: tubes ? Math.round(total / tubes) : 0, total,
          // Người trả trỏ về bản ghi thành viên. `fundedBy` để P5 dùng (quỹ trả / thành viên ứng).
          payerId: f.pPayer || null, fundedBy: null, note: f.pNote || '',
        }]),
      }))
      upUi(() => ({ dialog: null, form: {} }))
      toast(canCheck
        ? t('toast.purchaseAddedChecked', {
            qty, unit: fmtK(Math.round(total / qty)),
            diff: (check.diff > 0 ? '+' : '') + check.diff, n: check.n,
          })
        : t('toast.purchaseAdded', { qty, unit: fmtK(Math.round(total / qty)) }))
    },
    applyCheck: () => {
      const f = form()
      const d0 = db()
      if (!f.ckCount) return toast(t('toast.needCounted'))
      const date = f.ckDate || d0.today
      // Tháng chia phần lệch lấy từ NGÀY KIỂM, không phải tháng đang xem ở header.
      const { month, diff, n, done } = checkPreview(d0, date, f.ckCount)
      // Mỗi tháng một lần: lần hai không còn buổi ước lượng để chia, hoặc chia chồng lên phần
      // đã chia. DB cũng chặn bằng uq_check_month, chặn ở đây để user thấy câu tử tế.
      if (done) return toast(t('toast.checkDone', { month: monthTxt(month), date: ddmy(done.date) }))
      if (diff !== 0 && !n) return toast(t('toast.noEstSession', { month: monthTxt(month) }))

      up((d) => stockCheckPatch(d, date, f.ckCount))
      upUi(() => ({ dialog: null, form: {} }))
      toast(diff === 0
        ? t('toast.stockMatched')
        : t('toast.stockSpread', { diff: (diff > 0 ? '+' : '') + diff, n, month: monthTxt(month) }))
    },

    /* ---------- sổ quỹ ---------- */
    createCourtBill: () => {
      const f = form()
      const amt = intOf(f.bAmount)
      if (!amt || !(f.bVenue || '').trim()) return toast(t('toast.needVenueAmount'))
      up((d) => {
        return {
          courtBills: (d.courtBills || []).concat([{
            id: uid(), month: f.bMonth, date: f.bDate, venue: f.bVenue, amount: amt,
            payerId: f.bPayer || null, payer: '', note: f.bNote || '',
          }]),
        }
      })
      upUi(() => ({ dialog: null, form: {} }))
      toast(t('toast.billAdded', { amount: fmtK(amt) }))
    },
    /**
     * Sửa một hoá đơn sân ĐÃ GHI. Gõ nhầm số tiền hay nhầm tháng là chuyện thường, mà cách duy
     * nhất trước đây là xoá rồi ghi lại — xoá xong ghi lại thì mất luôn `repaidAt`, tức là mất
     * dấu vết CLB đã trả lại người ứng hay chưa.
     *
     * KHÔNG đụng `repaidAt`: đó là sự kiện tiền rời két, thuộc về nút Hoàn/Trả lại, không thuộc
     * về form sửa. Đổi người ứng thì người mới cũng thừa hưởng đúng trạng thái đã trả đó.
     */
    saveCourtBill: () => {
      const f = form()
      const amt = intOf(f.bAmount)
      if (!amt || !(f.bVenue || '').trim()) return toast(t('toast.needVenueAmount'))
      up((d) => ({
        courtBills: (d.courtBills || []).map((x) => (x.id === f.eBillId
          ? { ...x, month: f.bMonth, date: f.bDate, venue: f.bVenue, amount: amt, payerId: f.bPayer || null, note: f.bNote || '' }
          : x)),
      }))
      upUi(() => ({ dialog: null, form: {} }))
      toast(t('toast.billSaved', { amount: fmtK(amt) }))
    },
    createLedger: () => {
      const f = form()
      const amt = intOf(f.lAmount)
      if (!amt || !(f.lLabel || '').trim()) return toast(t('toast.needLabelAmount'))
      up((d) => {
        return {
          manual: d.manual.concat([{
            id: uid(), date: f.lDate, dir: f.lDir, cat: f.lCat, label: f.lLabel, amount: amt,
            by: memberOf(d, (d.members.find((m) => m.userId === d.currentUserId) || {}).id).name,
          }]),
        }
      })
      // Bung sẵn nhóm vừa ghi vào. Dòng sổ quỹ gộp theo ngày+hạng mục+chiều, nên ghi một khoản
      // trùng ngày và hạng mục với khoản đã có thì nó chui vào dòng cũ, dòng cũ đổi thành
      // "2 dòng" và MÀN HÌNH KHÔNG CÓ DÒNG NÀO MỚI — người ghi tưởng bấm hụt, ghi lại lần nữa.
      const gk = groupKey({ date: f.lDate, cat: f.lCat, dir: f.lDir })
      upUi((u) => ({ dialog: null, form: {}, expanded: { ...u.expanded, [gk]: true } }))
      toast(t('toast.ledgerAdded'))
    },
    /** Sửa một dòng thu/chi ghi tay. Giữ nguyên `by` — người ghi gốc là dấu vết, không phải ô nhập. */
    saveLedger: () => {
      const f = form()
      const amt = intOf(f.lAmount)
      if (!amt || !(f.lLabel || '').trim()) return toast(t('toast.needLabelAmount'))
      up((d) => ({
        manual: d.manual.map((x) => (x.id === f.eLedgerId
          ? { ...x, date: f.lDate, dir: f.lDir, cat: f.lCat, label: f.lLabel, amount: amt }
          : x)),
      }))
      // Sửa ngày hoặc hạng mục là dòng nhảy sang nhóm khác — bung nhóm ĐÍCH, không phải nhóm cũ.
      upUi((u) => ({
        dialog: null, form: {},
        expanded: { ...u.expanded, [groupKey({ date: f.lDate, cat: f.lCat, dir: f.lDir })]: true },
      }))
      toast(t('toast.ledgerSaved'))
    },
    setCourtPayMode: (v) => {
      up((d) => ({ club: { ...d.club, courtPayMode: v } }))
      toast(t(v === 'month' ? 'toast.payModeMonth' : 'toast.payModeSession'))
    },

    /**
     * CLB trả lại tiền cho người đã ứng — LÚC NÀY khoản chi mới vào sổ quỹ (migration 0011).
     * Bấm lần nữa thì gỡ đánh dấu: bấm nhầm mà không lùi được thì sổ quỹ mang một dòng chi ma.
     * Đọc trạng thái TRƯỚC khi ghi — updater của React không chạy đồng bộ, đọc trong đó thì
     * toast báo ngược (đúng cái bug `toggleSchedule` đã dính một lần).
     */
    repayAdvance: (kind, id) => {
      const key = kind === 'court' ? 'courtBills' : 'purchases'
      const cur = (db()[key] || []).find((x) => x.id === id)
      if (!cur) return
      const on = !cur.repaidAt
      up((d) => ({ [key]: d[key].map((x) => (x.id === id ? { ...x, repaidAt: on ? d.today : '' } : x)) }))
      toast(t(on ? 'toast.advanceRepaid' : 'toast.advanceUndone'))
    },
    deleteAdvance: (kind, id) => {
      const key = kind === 'court' ? 'courtBills' : 'purchases'
      up((d) => ({ [key]: (d[key] || []).filter((x) => x.id !== id) }))
      toast('Đã xoá khoản nợ thành công')
    },

    /* ---------- cài đặt ---------- */
    setClub: (k, v) => up((d) => ({ club: { ...d.club, [k]: v } })),
    toggleMultiGroup: (enabled) => {
      up((d) => ({ club: { ...d.club, multiGroup: !!enabled } }))
      toast(t(enabled ? 'toast.multiGroupEnabled' : 'toast.multiGroupDisabled'))
    },
    setDefaultGroupDues: (k, v) =>
      up((d) => {
        if (!d.groups || d.groups.length === 0) return {}
        const defGid = d.groups[0].id
        return {
          groups: d.groups.map((g) => (g.id === defGid ? { ...g, [k]: intOf(v) } : g)),
        }
      }),
    /**
     * Thang trình độ của CLB. Nhập một chuỗi "yếu, ..., mạnh" — THỨ TỰ chính là thứ tự mạnh dần,
     * thuật toán cân sân dùng đúng thứ tự này.
     * Chặn xoá trình độ đang có người dùng: xoá xong thì bảng giá khách và cân sân sai câm.
     */
    /**
     * Gán một mức giá khách cho NHIỀU trình độ cùng lúc. Thang 9 bậc là 18 ô nhập tay, mà thực
     * tế CLB chỉ có vài mức giá — gõ từng ô vừa lâu vừa dễ lệch.
     * `who`: 'nam' | 'nu' | 'both'.
     */
    applyPriceBulk: () => {
      const f = form()
      const levels = f.bulkLevels || []
      const price = intOf(f.bulkPrice)
      const who = f.bulkWho || 'both'
      if (!levels.length) return toast(t('toast.needLevels'))
      up((d) => ({
        guestPrices: d.guestPrices.map((x) => {
          if (levels.indexOf(x.level) < 0) return x
          return {
            ...x,
            nam: who === 'nu' ? x.nam : price,
            nu: who === 'nam' ? x.nu : price,
          }
        }),
      }))
      upUi((u) => ({ form: { ...u.form, bulkLevels: [] } }))
      toast(t('toast.priceBulk', { n: levels.length, amount: fmtK(price) }))
    },
    toggleBulkLevel: (level) =>
      upUi((u) => {
        const w = (u.form.bulkLevels || []).slice()
        const i = w.indexOf(level)
        if (i < 0) w.push(level)
        else w.splice(i, 1)
        return { form: { ...u.form, bulkLevels: w } }
      }),
    setLevels: (text) => {
      const list = String(text || '').split(',').map((x) => x.trim()).filter(Boolean)
      const next = list.filter((x, i) => list.indexOf(x) === i)
      if (next.length < 2) return toast(t('toast.levelsTooFew'))
      const d0 = db()
      const used = new Set()
      d0.members.forEach((m) => { used.add(m.level); if (m.pendingLevel) used.add(m.pendingLevel) })
      d0.guests.forEach((g) => used.add(g.level))
      d0.sessionGuests.forEach((g) => used.add(g.level))
      const lost = [...used].filter((l) => l && next.indexOf(l) < 0)
      if (lost.length) return toast(t('toast.levelsInUse', { list: lost.join(', ') }))
      up((d) => ({
        levels: next,
        club: { ...d.club, levels: next },
        guestPrices: next.map((lv) => d.guestPrices.find((p) => p.level === lv) || { level: lv, nam: 0, nu: 0 }),
      }))
      toast(t('toast.levelsSaved', { n: next.length }))
    },
    setLockDay: (v) => up((d) => ({ club: { ...d.club, lockDay: Math.min(28, Math.max(1, intOf(v) || 1)) } })),
    setPrice: (level, gender, v) =>
      up((d) => ({
        guestPrices: d.guestPrices.map((x) => (x.level === level ? { ...x, [gender]: intOf(v) } : x)),
      })),
    setCourtField: (id, k, v) =>
      up((d) => ({
        courts: d.courts.map((c) => (c.id === id ? { ...c, [k]: k === 'price' ? intOf(v) : v } : c)),
      })),
    addCourt: () => {
      const f = form()
      const name = (f.cName || '').trim()
      if (!name) return toast(t('toast.needCourtName'))
      up((d) => ({
        courts: d.courts.concat([{
          id: uid(), name, addr: (f.cAddr || '').trim(),
          price: intOf(f.cPrice), active: true,
        }]),
      }))
      upUi(() => ({ dialog: null, form: {} }))
      toast(t('toast.courtCreated', { name }))
    },
    addGroup: () => {
      const f = form()
      const d0 = db()
      const def = d0.groups[0] || {}
      const name = (f.grName || '').trim()
      if (!name) return toast(t('toast.needGroupName'))
      up((d) => ({
        groups: d.groups.concat([{
          id: uid(), name, short: (f.grShort || '').trim() || name.slice(0, 3),
          feeNam: def.feeNam || 0,
          feeNu: def.feeNu || 0,
          unitNam: def.unitNam || 0,
          unitNu: def.unitNu || 0,
          from: f.grFrom || '18:00', to: f.grTo || '20:00',
          quota: intOf(f.grQuota) || cfg.shuttle.quotaDefault,
          courtIds: [], active: true,
        }]),
      }))
      upUi(() => ({ dialog: null, form: {} }))
      toast(t('toast.groupCreated', { name }))
    },
    toggleGroupCourt: (gid, cid) =>
      up((d) => ({
        groups: d.groups.map((g) => {
          if (g.id !== gid) return g
          const has = (g.courtIds || []).indexOf(cid) >= 0
          return { ...g, courtIds: has ? g.courtIds.filter((x) => x !== cid) : (g.courtIds || []).concat([cid]) }
        }),
      })),
    setGroupField: (id, k, v) =>
      up((d) => ({
        // Khoá nào là SỐ phải liệt kê tay: `typeof g[k] === 'number'` sai ngay khi giá trị đang
        // là null (đơn giá tự đặt để trống) — lúc đó nó nhét thẳng chuỗi vào cột bigint.
        groups: d.groups.map((g) => (g.id === id
          ? { ...g, [k]: GROUP_NUM.indexOf(k) >= 0 ? intOf(v) : v }
          : g)),
      })),
    /**
     * Xoá một nhóm cố định. Chặn theo DỮ LIỆU (`money.js: groupRefs`), không theo vị trí.
     *
     * Luật cũ chặn `groups[0]` là "nhóm mặc định không xoá" — mà `groups[0]` chỉ là nhóm đứng
     * đầu mảng, không phải một cờ thật. Nhập cài đặt từ CLB khác xong là thứ tự đổi, và người
     * ta không xoá nổi một nhóm rác dù nó chẳng dính gì. Luật cũ cũng chỉ kiểm buổi + lịch,
     * bỏ lọt quỹ tháng / đối chiếu / danh sách cố định — mà mấy bảng đó đều trỏ về
     * `member_groups` bằng khoá ngoại TRẦN, xoá là 23503 và kẹt cả hàng đợi đồng bộ.
     */
    deleteGroup: (id) => {
      const d0 = db()
      const why = groupRefs(d0, id)
      if (why.length) {
        const txt = why.map((k) => t('settings.groupRef.' + k)).join(', ')
        // Có lịch sử = chặn VĨNH VIỄN, nói thẳng ra. Gộp chung với "gỡ đi rồi xoá lại" là để
        // người ta ngồi gỡ mãi một thứ không bao giờ gỡ nổi.
        return toast(t(why.indexOf('history') >= 0 ? 'toast.groupHistoryLocked' : 'toast.groupInUse', { why: txt }))
      }
      up((d) => ({
        groups: d.groups.filter((g) => g.id !== id),
        // Hết ca thì thành đi lẻ. KHÔNG đá sang ca mặc định: đó là gán cố định thay cho user,
        // và tháng sau sẽ thu quỹ của một ca họ chưa bao giờ chọn.
        members: d.members.map((m) => ({ ...m, groupIds: (m.groupIds || []).filter((g) => g !== id) })),
      }))
      toast(t('toast.groupDeleted'))
    },
    saveMoneyTab: ({ feeNam, feeNu, unitNam, unitNu, guestPrices }) => {
      up((d) => ({
        groups: d.groups.map((g) => ({
          ...g,
          feeNam: intOf(feeNam),
          feeNu: intOf(feeNu),
          unitNam: intOf(unitNam),
          unitNu: intOf(unitNu),
        })),
        guestPrices: guestPrices ? guestPrices.map((x) => ({
          level: x.level,
          nam: intOf(x.nam),
          nu: intOf(x.nu),
        })) : d.guestPrices,
      }))
      toast(t('toast.pricingSaved'))
    },
    saveGroupsTab: (groupsList) => {
      up(() => ({
        groups: groupsList.map((g) => ({
          ...g,
          name: (g.name || '').trim(),
          short: (g.short || '').trim() || (g.name || '').slice(0, 3),
          from: g.from || '18:00',
          to: g.to || '20:00',
          quota: intOf(g.quota) || cfg.shuttle.quotaDefault,
        })),
      }))
      toast(t('toast.groupsSaved'))
    },
    setShuttleType: (id, k, v) =>
      up((d) => ({
        shuttleTypes: d.shuttleTypes.map((x) => {
          if (x.id !== id) return x
          if (k === 'name' || k === 'active') return { ...x, [k]: v }
          return { ...x, [k]: intOf(v) }
        }),
      })),
    addShuttleType: () => {
      up((d) => ({
        shuttleTypes: d.shuttleTypes.concat([{
          id: uid(), name: t('settings.newTypeName'), perTube: cfg.shuttle.perTubeDefault,
          pricePerTube: 0, active: true,
        }]),
      }))
      toast(t('toast.typeAdded'))
    },
    exportSettings: () => {
      const d = db()
      const data = {
        schema: 'badminclub_settings',
        version: 1,
        exportedAt: new Date().toISOString(),
        clubName: d.club?.name || '',
        clubCode: d.club?.code || '',
        club: {
          roundUnit: !!d.club?.roundUnit,
          lockDay: d.club?.lockDay || cfg.club.defaultLockDay,
          seeDebtEachOther: !!d.club?.seeDebtEachOther,
          seeFund: !!d.club?.seeFund,
          courtPayMode: d.club?.courtPayMode || 'payer',
          levels: d.levels || cfg.levelsDefault,
        },
        money: {
          feeNam: d.groups[0]?.feeNam || 0,
          feeNu: d.groups[0]?.feeNu || 0,
          unitNam: d.groups[0]?.unitNam || 0,
          unitNu: d.groups[0]?.unitNu || 0,
          guestPrices: (d.guestPrices || []).map((p) => ({
            level: p.level,
            nam: p.nam || 0,
            nu: p.nu || 0,
          })),
        },
        courts: (d.courts || []).map((c) => ({
          name: c.name,
          addr: c.addr || '',
          price: c.price || 0,
          active: c.active !== false,
        })),
        shuttleTypes: (d.shuttleTypes || []).map((s) => ({
          name: s.name,
          perTube: s.perTube || cfg.shuttle.perTubeDefault,
          pricePerTube: s.pricePerTube || 0,
          active: s.active !== false,
        })),
        groups: (d.groups || []).map((g) => ({
          name: g.name,
          short: g.short || '',
          feeNam: g.feeNam || 0,
          feeNu: g.feeNu || 0,
          unitNam: g.unitNam || 0,
          unitNu: g.unitNu || 0,
          from: g.from || '18:00',
          to: g.to || '20:00',
          quota: g.quota || cfg.shuttle.quotaDefault,
          active: g.active !== false,
        })),
      }

      const jsonStr = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const aEl = document.createElement('a')
      const fileName = `cai_dat_clb_${d.club?.code || 'badmin'}.json`
      aEl.href = url
      aEl.download = fileName
      document.body.appendChild(aEl)
      aEl.click()
      document.body.removeChild(aEl)
      URL.revokeObjectURL(url)
      toast(t('toast.settingsExported', { file: fileName }))
    },
    applyImportedSettings: (data, opts = {}) => {
      if (!data || data.schema !== 'badminclub_settings') {
        return toast(t('toast.settingsBadFile'))
      }

      up((d) => {
        const next = {}

        // 1. Cài đặt chung & Levels
        if (opts.includeClub && data.club) {
          const clubLevels = Array.isArray(data.club.levels) && data.club.levels.length
            ? data.club.levels
            : d.levels

          next.club = {
            ...d.club,
            roundUnit: data.club.roundUnit !== undefined ? !!data.club.roundUnit : d.club.roundUnit,
            lockDay: data.club.lockDay || d.club.lockDay,
            seeDebtEachOther: data.club.seeDebtEachOther !== undefined ? !!data.club.seeDebtEachOther : d.club.seeDebtEachOther,
            seeFund: data.club.seeFund !== undefined ? !!data.club.seeFund : d.club.seeFund,
            courtPayMode: data.club.courtPayMode || d.club.courtPayMode,
            levels: clubLevels,
          }
          next.levels = clubLevels
        }

        // 2. Biểu phí & Giá khách giao lưu
        if (opts.includeMoney && data.money) {
          const activeLevels = next.levels || d.levels
          if (Array.isArray(data.money.guestPrices)) {
            const priceMap = {}
            data.money.guestPrices.forEach((p) => {
              priceMap[p.level] = { nam: intOf(p.nam), nu: intOf(p.nu) }
            })
            next.guestPrices = activeLevels.map((lv) => ({
              level: lv,
              nam: priceMap[lv]?.nam || 0,
              nu: priceMap[lv]?.nu || 0,
            }))
          }
          const feeNam = intOf(data.money.feeNam)
          const feeNu = intOf(data.money.feeNu)
          const unitNam = intOf(data.money.unitNam)
          const unitNu = intOf(data.money.unitNu)
          const currentGroups = next.groups || d.groups
          next.groups = currentGroups.map((g) => ({
            ...g,
            feeNam: feeNam || g.feeNam,
            feeNu: feeNu || g.feeNu,
            unitNam: unitNam || g.unitNam,
            unitNu: unitNu || g.unitNu,
          }))
        }

        // 3. Sân bãi
        if (opts.includeCourts && Array.isArray(data.courts) && data.courts.length) {
          const existingCourts = (d.courts || []).slice()
          const newCourts = []
          data.courts.forEach((c) => {
            const match = existingCourts.find((x) => x.name.toLowerCase() === (c.name || '').trim().toLowerCase())
            if (match) {
              match.addr = c.addr || match.addr
              match.price = intOf(c.price) || match.price
            } else {
              newCourts.push({
                id: uid(),
                name: (c.name || '').trim(),
                addr: c.addr || '',
                price: intOf(c.price),
                active: c.active !== false,
              })
            }
          })
          next.courts = existingCourts.concat(newCourts)
        }

        // 4. Loại cầu
        if (opts.includeShuttles && Array.isArray(data.shuttleTypes) && data.shuttleTypes.length) {
          const existingShuttles = (d.shuttleTypes || []).slice()
          const newShuttles = []
          data.shuttleTypes.forEach((s) => {
            const match = existingShuttles.find((x) => x.name.toLowerCase() === (s.name || '').trim().toLowerCase())
            if (match) {
              match.perTube = intOf(s.perTube) || match.perTube
              match.pricePerTube = intOf(s.pricePerTube) || match.pricePerTube
            } else {
              newShuttles.push({
                id: uid(),
                name: (s.name || '').trim(),
                perTube: intOf(s.perTube) || cfg.shuttle.perTubeDefault,
                pricePerTube: intOf(s.pricePerTube) || 0,
                active: s.active !== false,
              })
            }
          })
          next.shuttleTypes = existingShuttles.concat(newShuttles)
        }

        // 5. Nhóm cố định
        if (opts.includeGroups && Array.isArray(data.groups) && data.groups.length) {
          const existingGroups = (next.groups || d.groups || []).slice()
          const newGroups = []
          data.groups.forEach((g) => {
            const match = existingGroups.find((x) => x.name.toLowerCase() === (g.name || '').trim().toLowerCase())
            if (match) {
              match.short = g.short || match.short
              match.from = g.from || match.from
              match.to = g.to || match.to
              match.quota = intOf(g.quota) || match.quota
              match.feeNam = intOf(g.feeNam) || match.feeNam
              match.feeNu = intOf(g.feeNu) || match.feeNu
              match.unitNam = intOf(g.unitNam) || match.unitNam
              match.unitNu = intOf(g.unitNu) || match.unitNu
            } else {
              newGroups.push({
                id: uid(),
                name: (g.name || '').trim(),
                short: g.short || (g.name || '').slice(0, 3),
                from: g.from || '18:00',
                to: g.to || '20:00',
                quota: intOf(g.quota) || cfg.shuttle.quotaDefault,
                feeNam: intOf(g.feeNam) || 0,
                feeNu: intOf(g.feeNu) || 0,
                unitNam: intOf(g.unitNam) || 0,
                unitNu: intOf(g.unitNu) || 0,
                courtIds: [],
                active: g.active !== false,
              })
            }
          })
          next.groups = existingGroups.concat(newGroups)
        }

        return next
      })

      upUi(() => ({ dialog: null }))
      toast(t('toast.settingsImported', { club: data.clubName || t('common.unknown') }))
    },

    /**
     * Thành viên tự xin đổi thông tin của mình trong CLB (handoff 01 §6).
     * SĐT áp dụng NGAY, trình độ áp dụng TỪ THÁNG SAU — vì trình độ ảnh hưởng giá khách và
     * thuật toán cân sân của những buổi đã chốt.
     */
    requestChange: (field, value) => {
      const d0 = db()
      const me = d0.members.find((m) => m.userId === d0.currentUserId)
      if (!me) return toast(t('toast.noMemberRecord'))
      const from = field === 'phone' ? (me.phone || '') : me.level
      const to = String(value || '').trim()
      if (!to) return toast(t('toast.changeEmpty'))
      if (to === from) return toast(t('toast.changeSame'))
      if ((d0.changes || []).some((c) => c.status === 'pending' && c.memberId === me.id && c.field === field)) {
        return toast(t('toast.changeDup'))
      }
      up((d) => ({
        changes: (d.changes || []).concat([{
          id: uid(), memberId: me.id, field, from, to, by: 'member',
          effective: field === 'phone' ? 'now' : 'next', status: 'pending',
        }]),
      }))
      toast(t(field === 'phone' ? 'toast.changeAskedNow' : 'toast.changeAskedNext'))
    },

    /* ---------- chia sân ---------- */
    setAssignSession: (id) => upUi(() => ({ assignId: id, picked: null })),
    setAsnMode: (v) => upUi(() => ({ asnMode: v })),
    pickPlayer: (key) => upUi((u) => ({ picked: u.picked === key ? null : key })),
    place: (sid, slot, key) => {
      if (!key || !canAssign()) return
      up((d) => {
        const lineups = { ...(d.lineups || {}) }
        const before = lineups[sid] || {}
        const prev = before[slot]
        lineups[sid] = place(before, slot, key)
        const out = { lineups }
        if ((d.groupMode || {})[sid]) {
          const cgAll = { ...(d.courtGroups || {}) }
          const cg = { ...(cgAll[sid] || {}) }
          const ci = slotCourtIdx(slot)
          cg[key] = ci
          if (prev && prev !== key) cg[prev] = ci
          cgAll[sid] = cg
          out.courtGroups = cgAll
        }
        return out
      })
      upUi(() => ({ picked: null }))
    },
    tapSlot: (sid, slot, picked) => {
      if (picked) return null // caller gọi place
      const k = ((db().lineups || {})[sid] || {})[slot]
      if (k) upUi(() => ({ picked: k }))
    },
    clearSlot: (sid, slot) => canAssign() &&
      up((d) => {
        const lineups = { ...(d.lineups || {}) }
        const lu = { ...(lineups[sid] || {}) }
        delete lu[slot]
        lineups[sid] = lu
        return { lineups }
      }),
    removeFromCourt: (sid, key) => canAssign() &&
      up((d) => {
        const lineups = { ...(d.lineups || {}) }
        lineups[sid] = removePlayer(lineups[sid] || {}, key)
        const cgAll = { ...(d.courtGroups || {}) }
        const cg = { ...(cgAll[sid] || {}) }
        delete cg[key]
        cgAll[sid] = cg
        return { lineups, courtGroups: cgAll }
      }),
    assignToCourt: (sid, key, ci) => {
      if (!key || !canAssign()) return
      up((d) => {
        const cgAll = { ...(d.courtGroups || {}) }
        const cg = { ...(cgAll[sid] || {}) }
        cg[key] = ci
        cgAll[sid] = cg
        const lineups = { ...(d.lineups || {}) }
        const lu = { ...(lineups[sid] || {}) }
        Object.keys(lu).forEach((k) => { if (lu[k] === key && slotCourtIdx(k) !== ci) delete lu[k] })
        lineups[sid] = lu
        return { courtGroups: cgAll, lineups }
      })
      upUi(() => ({ picked: null }))
    },
    toggleGroupMode: (sid) => {
      if (!canAssign()) return
      const on = !!(db().groupMode || {})[sid]
      up((d) => ({ groupMode: { ...(d.groupMode || {}), [sid]: !on } }))
      toast(t(on ? 'toast.groupModeOff' : 'toast.groupModeOn'))
    },
    autoSplitCourts: (sid) => {
      if (!canAssign()) return
      const d0 = db()
      const s = sessionOf(d0, sid)
      if (!s) return
      const idxs = activeCourtIdxs(s)
      if (idxs.length < 2) return toast(t('toast.oneCourtOnly'))
      const ps = sessionPlayers(d0, s)
      const cg = autoSplit(ps, idxs, d0.levels)
      up((d) => ({
        courtGroups: { ...(d.courtGroups || {}), [sid]: cg },
        lineups: { ...(d.lineups || {}), [sid]: {} },
        groupMode: { ...(d.groupMode || {}), [sid]: true },
      }))
      upUi(() => ({ picked: null }))
      toast(t('toast.courtsSplit', { n: ps.length, courts: idxs.length }))
    },
    clearLineup: (sid) => {
      if (!canAssign()) return
      up((d) => ({
        lineups: { ...(d.lineups || {}), [sid]: {} },
        courtGroups: { ...(d.courtGroups || {}), [sid]: {} },
      }))
      upUi(() => ({ picked: null }))
      toast(t('toast.lineupCleared'))
    },
    arrange: (sid, mode) => {
      if (!canAssign()) return
      const d0 = db()
      const s = sessionOf(d0, sid)
      if (!s) return
      const { lineup, count } = arrange({
        players: sessionPlayers(d0, s),
        session: s,
        mode,
        stats: matchStats(d0.matches, sid),
        current: (d0.lineups || {})[sid] || {},
        groupMode: !!(d0.groupMode || {})[sid],
        courtGroups: (d0.courtGroups || {})[sid] || {},
        levels: d0.levels,
      })
      up((d) => ({ lineups: { ...(d.lineups || {}), [sid]: lineup } }))
      upUi(() => ({ picked: null, asnMode: mode }))
      toast(t('toast.arranged', { mode: modeToast(mode), n: count }))
    },

    /* ---------- bấm giờ và ghi trận ---------- */
    setCourtMin: (sid, ci, v) => canAssign() &&
      up((d) => {
        const all = { ...(d.courtMin || {}) }
        const c = { ...(all[sid] || {}) }
        c[ci] = intOf(v)
        all[sid] = c
        return { courtMin: all }
      }),
    startCourt: (sid, ci) => {
      if (!canAssign()) return
      const on = !!((db().playing || {})[sid] || {})[ci]
      up((d) => {
        const all = { ...(d.playing || {}) }
        const c = { ...(all[sid] || {}) }
        c[ci] = on ? false : Date.now()
        all[sid] = c
        return { playing: all }
      })
      toast(t(on ? 'toast.clockStopped' : 'toast.clockStarted'))
    },
    finishCourt: (sid, ci, minutes) => {
      if (!canAssign()) return
      const d0 = db()
      const lu = (d0.lineups || {})[sid] || {}
      const keys = courtSlotIds(ci).map((sl) => lu[sl]).filter(Boolean)
      if (!keys.length) return toast(t('toast.courtEmpty'))
      up((d) => {
        const lineups = { ...(d.lineups || {}) }
        const l2 = { ...(lineups[sid] || {}) }
        courtSlotIds(ci).forEach((sl) => { delete l2[sl] })
        lineups[sid] = l2
        const playing = { ...(d.playing || {}) }
        const c = { ...(playing[sid] || {}) }
        c[ci] = false
        playing[sid] = c
        return {
          lineups, playing,
          matches: (d.matches || []).concat([
            { id: uid(), sessionId: sid, courtIdx: ci, playerKeys: keys, minutes, at: Date.now() },
          ]),
        }
      })
      upUi(() => ({ picked: null }))
      toast(t('toast.matchSaved', { n: keys.length, min: minutes }))
    },
    undoMatch: (sid) => {
      if (!canAssign()) return
      const list = (db().matches || []).filter((x) => x.sessionId === sid)
      if (!list.length) return toast(t('toast.noMatch'))
      const last = list[list.length - 1]
      up((d) => ({ matches: (d.matches || []).filter((x) => x.id !== last.id) }))
      toast(t('toast.matchUndone'))
    },

    /* ---------- báo cáo Zalo ---------- */
    copyZalo: (sid) => {
      const d0 = db()
      const s = sessionOf(d0, sid)
      if (!s) return
      const g = groupOf(d0, s.groupId)
      const gl = sGuestsOnly(d0, sid)
      const L = []
      L.push('🏸 ' + d0.club.name.toUpperCase() + ' · BUỔI ' + ddmy(s.date) + ' (' + wd(s.date) + ')')
      L.push('Sân: ' + courtTxt(d0, s) + ' · ' + timeTxt(s))
      L.push('Điểm danh: ' + presentCount(d0, s) + '/' + groupMembers(d0, s.groupId, monthOf(s.date)).length + ' thành viên ' + g.name)
      L.push('Cầu dùng: ' + s.shuttleUsed + ' quả · Tiền sân: ' + fmt(courtCost(d0, s)))
      L.push('')
      L.push('KHÁCH GIAO LƯU (' + gl.length + ' người) — ' + fmt(guestRev(d0, sid)))
      gl.forEach((x) => {
        const by = x.invitedBy || guestOf(d0, x.guestId).invitedBy
        L.push('· ' + guestOf(d0, x.guestId).name + ' (' + (x.gender === 'nu' ? 'Nữ' : 'Nam') + '/' + x.level + ')' +
          (by ? ' — ' + memberOf(d0, by).name + ' rủ' : '') + ': ' + fmt(x.price) + (x.paid ? ' — đã trả' : ' — ghi nợ'))
      })
      L.push('')
      // costRow chứ không sessionCost: buổi đã chốt thì đọc số ĐÃ ĐÓNG BĂNG, đúng bằng số
      // đang hiện trên card buổi và bảng Báo cáo. Tính lại là báo cáo gửi lên nhóm nói một
      // đằng, màn hình nói một nẻo, ngay khi giá cầu hay giá sân đổi.
      L.push('Chi phí buổi: ' + fmt(costRow(d0, s).cost) + ' (sân + ' + s.shuttleUsed + ' quả cầu)')
      L.push('Thu từ khách: ' + fmt(guestRev(d0, sid)))
      L.push('Quỹ CLB hiện tại: ' + fmt(fundBalance(d0)))
      const bk = d0.club.bank
      L.push('CK: ' + bk.holder + ' · ' + bk.no + ' · ' + bk.bank)
      const txt = L.join('\n')
      upUi(() => ({ dialog: 'zalo', form: { zaloText: txt } }))
      try {
        navigator.clipboard.writeText(txt).then(() => toast(t('toast.zaloCopied')), () => {})
      } catch { /* clipboard bị chặn thì vẫn hiện dialog để copy tay */ }
    },
  }

  /**
   * HOÀN TÁC một dòng sổ quỹ — giống hệt bấm "Thu" rồi "Bỏ thu" ở màn Công nợ.
   *
   * Sổ quỹ là bảng SUY RA (`lib/ledger.js: ledger`), không có dòng nào để xoá. Nên hoàn tác =
   * lật đúng cái cờ ở NGUỒN, rồi dòng tự biến khỏi sổ và số dư tự trừ lại. Nguồn nào ứng với
   * dòng nào là việc của `undoTarget` — hàm thuần, có test.
   *
   * Gọi LẠI đúng các action mà màn Công nợ / Kho cầu vẫn dùng chứ không viết luồng gỡ thứ hai:
   * hai đường gỡ cho cùng một khoản tiền rồi sẽ lệch nhau, mà lệch ở đây là lệch số dư quỹ.
   * Vì thế `makeActions` trả về `A` chứ không trả literal — cần gọi được action anh em.
   */
  A.undoLedgerRow = (rowId) => {
    const d0 = db()
    const tg = undoTarget(d0, ledger(d0).find((r) => r.id === rowId))
    if (!tg) return toast(t('toast.ledgerNoUndo'))
    if (tg.kind === 'manual') {
      up((d) => ({ manual: d.manual.filter((m) => m.id !== tg.id) }))
      return toast(t('toast.ledgerRemoved'))
    }
    if (tg.kind === 'due') return A.clearDue(tg.id)
    if (tg.kind === 'guest') {
      A.toggleGuestPaid(tg.id)
      return toast(t('toast.guestUnpaid'))
    }
    if (tg.kind === 'adjust') return A.settleAdjust(tg.key)
    return A.repayAdvance(tg.advKind, tg.id)
  }

  return A
}
