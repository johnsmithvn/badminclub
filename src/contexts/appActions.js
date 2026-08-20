// Mọi hành động ghi dữ liệu. Mỗi hành động bắn toast bằng tiếng Việt nói rõ đã làm gì và hệ quả.
// Quy ước: dbRef.current = db hiện tại (đọc để tính text toast), setDb(partial) để ghi.

import { addMonth, dd, ddmy, monthOf, monthTxt, wd } from '#utils/dates.js'
import cfg from '#config/app.json' with { type: 'json' }
import {
  courtCost, courtTxt, fmt, fmtK, groupMembers, groupOf, guestOf, guestPrice, memberOf,
  perTube, presentCount, quotaFor, remainSessions, rowCost, sGuests, guestRev, sessionCost,
  sessionOf, checkPreview, checkOf, freezeCost, spreadDiff, unfrozenCost, timeTxt, unitPrice,
  adjustRows, pendingOffset,
} from '#lib/money.js'
import { fundBalance } from '#lib/ledger.js'
import { modeToast, activeCourtIdxs, arrange, autoSplit, courtSlotIds, matchStats, place, removePlayer, sessionPlayers, slotCourtIdx } from '#lib/assign.js'
import { can, roleDesc, roleName, viewAsOptions } from '#lib/roles.js'
import { supabase, unwrap } from '#supabase'
import { pathOf } from '#routes'
import { t } from '#i18n'

/** Id của mọi bản ghi mới. Trùng kiểu uuid của Postgres nên client ghi thẳng được, khỏi map id. */
const uid = () => crypto.randomUUID()

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
        id: uid(), date, month, counted: parseInt(counted, 10) || 0,
        systemLeft, diff, spread: diff ? n : 0,
      }]),
    }
  }
  const upUi = (fn) => setUi((u) => ({ ...u, ...fn(u) }))
  const myRole = () => db().viewAs || 'owner'
  const nextMonthKey = () => addMonth(db().month, 1)

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

  /** Buổi đang ở chế độ định mức thì cập nhật lại số cầu khi số sân đổi. */
  const syncQuota = (d, s) => (s.shuttleMode === 'quota' ? { ...s, shuttleUsed: quotaFor(d, s) } : s)

  /** Điều hướng qua React Router. */
  const nav = (key, id) => navRef.current && navRef.current(pathOf(key, id))

  const patchSession = (sid, fn) =>
    up((d) => ({ sessions: d.sessions.map((x) => (x.id === sid ? fn(x, d) : x)) }))

  return {
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
    sendInvite: (mid) => {
      const m = memberOf(db(), mid)
      up((d) => ({
        invites: (d.invites || []).concat([
          { id: uid(), clubId: d.clubId, memberId: mid, phone: m.phone, at: d.today, status: 'sent', token: uid() },
        ]),
      }))
      toast(t('toast.inviteSent', { phone: m.phone, name: m.name }))
    },
    // Hai hành động dưới KHÔNG đi qua đồng bộ ngầm: người xin vào chưa phải thành viên nên
    // client không có quyền ghi thẳng. Gọi RPC (SECURITY DEFINER) rồi nạp lại CLB.
    approveJoin: async (rid, mid) => {
      const d0 = db()
      const req = (d0.joinRequests || []).find((r) => r.id === rid)
      if (!req) return
      const u = d0.users.find((x) => x.id === req.userId)
      const name = mid ? memberOf(d0, mid).name : ''
      try {
        unwrap(await supabase.rpc('approve_join_request', { p_request: rid, p_member_id: mid || null }))
      } catch (e) {
        return toast(e.message)
      }
      await reload()
      toast(mid
        ? t('toast.linked', { name, account: u ? u.name : '' })
        : t('toast.memberCreatedFromUser', { account: u ? u.name : '' }))
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
        return { attendance: a }
      }),
    /** Thêm người đi thêm: thành viên nhóm khác hôm nay có đánh. Sinh khoản THU ở đối chiếu. */
    addExtra: (sid, mid) => {
      if (!mid) return toast(t('toast.needMember'))
      up((d) => ({ attendance: { ...d.attendance, [sid]: { ...(d.attendance[sid] || {}), [mid]: 'extra' } } }))
      toast(t('toast.extraAdded', { name: memberOf(db(), mid).name }))
    },
    removeExtra: (sid, mid) => {
      up((d) => {
        const m = { ...(d.attendance[sid] || {}) }
        delete m[mid]
        return { attendance: { ...d.attendance, [sid]: m } }
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
        return { attendance: a }
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
      patchSession(sid, (x) => ({ ...x, shuttleUsed: Math.max(0, parseInt(v || 0, 10) || 0), shuttleEst: false })),
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
        rows[i] = { ...rows[i], [k]: k === 'soldAmount' ? Math.max(0, parseInt(v || 0, 10) || 0) : v }
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
            : { ...base, ...unfrozenCost() }
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
      const gender = f.gGender || 'nam'
      up((d) => {
        let gid = (d.guests.find((x) => x.name.toLowerCase() === name.toLowerCase()) || {}).id
        let guests = d.guests
        if (!gid) {
          gid = uid()
          guests = d.guests.concat([{ id: gid, name, gender, level, invitedBy: f.gBy, phone: '' }])
        } else {
          guests = d.guests.map((x) => (x.id === gid ? { ...x, invitedBy: f.gBy } : x))
        }
        return {
          guests,
          sessionGuests: d.sessionGuests.concat([{
            id: uid(), sessionId: d.sessionId, guestId: gid, level, gender,
            price: guestPrice(d, level, gender), paid: !!f.gPaid, invitedBy: f.gBy,
          }]),
        }
      })
      upUi((u) => ({ form: { ...u.form, gName: '' } }))
      toast(t('toast.guestAdded', { name, by: memberOf(db(), f.gBy).name, price: fmt(guestPrice(db(), level, gender)) }))
    },
    toggleGuestPaid: (id) =>
      up((d) => ({ sessionGuests: d.sessionGuests.map((g) => (g.id === id ? { ...g, paid: !g.paid } : g)) })),
    removeGuest: (id) => {
      up((d) => ({ sessionGuests: d.sessionGuests.filter((g) => g.id !== id) }))
      toast(t('toast.guestRemoved'))
    },
    setGuestInviter: (sgId, mid) =>
      up((d) => ({ sessionGuests: d.sessionGuests.map((x) => (x.id === sgId ? { ...x, invitedBy: mid } : x)) })),
    collectDebt: (gid) => {
      up((d) => ({
        sessionGuests: d.sessionGuests.map((g) => {
          const ss = sessionOf(d, g.sessionId)
          return g.guestId === gid && ss && monthOf(ss.date) === d.month ? { ...g, paid: true } : g
        }),
      }))
      toast(t('toast.debtCollected', { name: guestOf(db(), gid).name }))
    },

    /* ---------- quỹ tháng, back tiền, danh sách cố định ---------- */
    toggleDue: (id) => {
      const was = db().dues.find((y) => y.id === id)
      if (!was) return
      up((d) => ({ dues: d.dues.map((x) => (x.id === id ? { ...x, paid: !x.paid, paidAt: x.paid ? null : d.today } : x)) }))
      const name = memberOf(db(), was.memberId).name
      toast(was.paid
        ? t('toast.dueUnpaid', { name })
        : t('toast.duePaid', { name, amount: fmt(was.amount) }))
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
    setRoster: (month, gid, mid, val) =>
      up((d) => {
        const all = { ...d.roster }
        const base = d.roster[month] || ensureRoster(d, month)
        const gm = { ...(base[gid] || {}) }
        gm[mid] = val
        all[month] = { ...base, [gid]: gm }
        return { roster: all }
      }),
    lockRoster: (month) => {
      const wasLocked = !!db().locked[month]
      up((d) => {
        // ponytail: bỏ chốt chỉ tắt cờ, KHÔNG hoàn lại các khoản đã trừ vào quỹ tháng này.
        // Đúng như hành vi cũ (dues sinh ra vẫn ở lại). Cần hoàn thì phải có bước huỷ riêng.
        if (d.locked[month]) return { locked: { ...d.locked, [month]: false } }
        const dues = d.dues.slice()
        const used = []            // khoản đối chiếu đã tiêu vào tháng này
        const seen = new Set()     // một người ở hai nhóm chỉ được trừ MỘT lần
        d.groups.forEach((g) => {
          const r = (d.roster[month] || {})[g.id] || {}
          Object.keys(r).forEach((mid) => {
            if (r[mid] !== 'fixed') return
            if (dues.some((x) => x.month === month && x.groupId === g.id && x.memberId === mid)) return
            const mb = d.members.find((x) => x.id === mid)
            if (!mb) return
            const base = mb.gender === 'nu' ? g.feeNu : g.feeNam
            // Khoản tháng trước xin "trừ vào quỹ tháng sau" — dấu cộng thẳng vào là đúng:
            // âm (quỹ nợ người) thì đóng ít đi, dương (người nợ quỹ) thì đóng thêm.
            const pend = seen.has(mid) ? [] : pendingOffset(d, mid, month)
            seen.add(mid)
            pend.forEach((x) => used.push(x.key))
            const off = pend.reduce((x, y) => x + y.amount, 0)
            dues.push({
              id: uid(), month, groupId: g.id, memberId: mid,
              amount: Math.max(0, base + off), paid: false, paidAt: null, method: '',
              note: off ? t('debts.offsetNote', { amount: fmtK(Math.abs(off)) }) : '',
            })
          })
        })
        const adjustments = (d.adjustments || []).map((x) =>
          used.indexOf(x.key) < 0 ? x : { ...x, paid: true, paidAt: month + '-01' })
        return { dues, adjustments, locked: { ...d.locked, [month]: true } }
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
            return { ...m, pendingLevel: c.to, pendingLevelFrom: addMonth(d.month, 1) }
          })
        }
        return { members, changes: d.changes.map((x) => (x.id === id ? { ...x, status: ok ? 'approved' : 'rejected' } : x)) }
      })
      toast(t(ok ? 'toast.changeApproved' : 'toast.changeRejected'))
    },

    /* ---------- thành viên ---------- */
    saveMember: () => {
      const f = form()
      up((d) => ({
        members: d.members.map((m) => {
          if (m.id !== f.eId) return m
          const base = { ...m, name: f.eName, phone: f.ePhone, gender: f.eGender }
          if (f.eLevel === m.level) return base
          return f.eWhen === 'now'
            ? { ...base, level: f.eLevel, pendingLevel: null, pendingLevelFrom: null }
            : { ...base, pendingLevel: f.eLevel, pendingLevelFrom: addMonth(d.month, 1) }
        }),
      }))
      upUi(() => ({ dialog: null, form: {} }))
      toast(t('toast.memberSaved'))
    },
    createMember: () => {
      const f = form()
      const name = (f.mName || '').trim()
      if (!name) return toast(t('toast.needMemberName'))
      const start = f.mStart || 'next'
      const gs = f.mGroups || []
      if (start !== 'none' && !gs.length) return toast(t('toast.needGroup'))
      const nextM = nextMonthKey()
      up((d) => {
        const id = uid()
        const mb = {
          id, name, gender: f.mGender || 'nam', level: f.mLevel || d.levels[0],
          groupIds: start === 'now' ? gs : [], role: 'member', phone: f.mPhone || '',
          joined: d.today, active: true, userId: null, pendingLevel: null, pendingLevelFrom: null,
        }
        const dues = d.dues.slice()
        const roster = { ...d.roster }
        gs.forEach((gid) => {
          const g = d.groups.find((x) => x.id === gid)
          const base = roster[nextM] || ensureRoster(d, nextM)
          const gm = { ...(base[gid] || {}) }
          gm[id] = 'fixed'
          roster[nextM] = { ...base, [gid]: gm }
          if (start === 'now') {
            const rem = remainSessions(d, gid, d.month)
            const u = unitPrice(d, mb, g, d.month)
            if (rem > 0) {
              dues.push({
                id: uid(), month: d.month, groupId: gid, memberId: id, amount: u.unit * rem,
                paid: false, paidAt: null, method: '', note: 'Vào giữa tháng · ' + rem + ' buổi còn lại',
              })
            }
          }
        })
        return { dues, roster, members: d.members.concat([mb]) }
      })
      upUi(() => ({ dialog: null, form: {} }))
      toast(start === 'next'
        ? t('toast.memberAddedNext', { name, month: monthTxt(nextM).toLowerCase() })
        : t('toast.memberAdded', { name }))
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
    toggleMemberGroup: (gid) =>
      upUi((u) => {
        const w = (u.form.mGroups || []).slice()
        const i = w.indexOf(gid)
        if (i < 0) w.push(gid)
        else w.splice(i, 1)
        return { form: { ...u.form, mGroups: w } }
      }),
    addRow: () => {
      // CLB mới chưa có sân nào — nói rõ thay vì nổ vì đọc courts[0].
      const c = db().courts[0]
      if (!c) return toast(t('toast.needCourtFirst'))
      const g = db().groups[0]
      upUi((u) => ({
        form: {
          ...u.form,
          rows: (u.form.rows || []).concat([
            { courtId: c.id, from: g ? g.from : '18:00', to: g ? g.to : '20:00' },
          ]),
        },
      }))
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
      if (!f.sGroup) return toast(t('toast.needGroupFirst'))
      if (!dates.length) return toast(t('toast.needWeekday'))
      up((d) => {
        const scId = uid()
        const rows = (f.rows || []).map((r) => ({ ...r, sold: false, soldAmount: 0, soldTo: '', extra: false }))
        const stId = d.shuttleTypes[0] ? d.shuttleTypes[0].id : null
        const exist = {}
        d.sessions.forEach((x) => { exist[x.date + '|' + f.sGroup] = true })
        const added = []
        dates.forEach((dt) => {
          if (exist[dt + '|' + f.sGroup]) return
          added.push({
            id: uid(), date: dt, groupId: f.sGroup, status: 'draft', shuttleUsed: 0,
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
      nav('schedules')
      toast(t('toast.scheduleCreated', { n: dates.length, from: dd(dates[0]), to: dd(dates[dates.length - 1]) }))
    },
    createAdhoc: () => {
      const f = form()
      if (!f.aDate) return toast(t('toast.needDate'))
      let newId = ''
      up((d) => {
        newId = uid()
        return {
          sessionId: newId,
          sessions: d.sessions.concat([{
            id: newId, date: f.aDate, groupId: f.aGroup, status: 'open', shuttleUsed: 0,
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
      const tubes = parseInt(f.pTubes || 0, 10) || 0
      const extra = parseInt(f.pExtra || 0, 10) || 0
      const total = parseInt(f.pTotal || 0, 10) || 0
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
          payer: f.pPayer || 'Quỹ CLB', note: f.pNote || '',
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
      const amt = parseInt(f.bAmount || 0, 10) || 0
      if (!amt || !(f.bVenue || '').trim()) return toast(t('toast.needVenueAmount'))
      up((d) => {
        return {
          courtBills: (d.courtBills || []).concat([{
            id: uid(), month: f.bMonth, date: f.bDate, venue: f.bVenue, amount: amt,
            payer: f.bPayer || 'Quỹ CLB', note: f.bNote || '',
          }]),
        }
      })
      upUi(() => ({ dialog: null, form: {} }))
      toast(t('toast.billAdded', { amount: fmtK(amt) }))
    },
    createLedger: () => {
      const f = form()
      const amt = parseInt(f.lAmount || 0, 10) || 0
      if (!amt || !(f.lLabel || '').trim()) return toast(t('toast.needLabelAmount'))
      up((d) => {
        return {
          manual: d.manual.concat([{
            id: uid(), date: f.lDate, dir: f.lDir, cat: f.lCat, label: f.lLabel, amount: amt,
            by: memberOf(d, (d.members.find((m) => m.userId === d.currentUserId) || {}).id).name,
          }]),
        }
      })
      upUi(() => ({ dialog: null, form: {} }))
      toast(t('toast.ledgerAdded'))
    },
    setCourtPayMode: (v) => {
      up((d) => ({ club: { ...d.club, courtPayMode: v } }))
      toast(t(v === 'month' ? 'toast.payModeMonth' : 'toast.payModeSession'))
    },

    /* ---------- cài đặt ---------- */
    setClub: (k, v) => up((d) => ({ club: { ...d.club, [k]: v } })),
    /**
     * Thang trình độ của CLB. Nhập một chuỗi "yếu, ..., mạnh" — THỨ TỰ chính là thứ tự mạnh dần,
     * thuật toán cân sân dùng đúng thứ tự này.
     * Chặn xoá trình độ đang có người dùng: xoá xong thì bảng giá khách và cân sân sai câm.
     */
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
    setLockDay: (v) => up((d) => ({ club: { ...d.club, lockDay: Math.min(28, Math.max(1, parseInt(v || 1, 10) || 1)) } })),
    setPrice: (level, gender, v) =>
      up((d) => ({
        guestPrices: d.guestPrices.map((x) => (x.level === level ? { ...x, [gender]: parseInt(v || 0, 10) || 0 } : x)),
      })),
    setCourtField: (id, k, v) =>
      up((d) => ({
        courts: d.courts.map((c) => (c.id === id ? { ...c, [k]: k === 'price' ? parseInt(v || 0, 10) || 0 : v } : c)),
      })),
    addCourt: () => {
      const f = form()
      const name = (f.cName || '').trim()
      if (!name) return toast(t('toast.needCourtName'))
      up((d) => ({
        courts: d.courts.concat([{
          id: uid(), name, addr: (f.cAddr || '').trim(),
          price: parseInt(f.cPrice || 0, 10) || 0, active: true,
        }]),
      }))
      upUi(() => ({ dialog: null, form: {} }))
      toast(t('toast.courtCreated', { name }))
    },
    addGroup: () => {
      const f = form()
      const name = (f.grName || '').trim()
      if (!name) return toast(t('toast.needGroupName'))
      if (!(f.grCourts || []).length) return toast(t('toast.needGroupCourt'))
      up((d) => ({
        groups: d.groups.concat([{
          id: uid(), name, short: (f.grShort || '').trim() || name.slice(0, 3),
          weekday: parseInt(f.grWeekday || 0, 10) || 0,
          feeNam: parseInt(f.grFeeNam || 0, 10) || 0,
          feeNu: parseInt(f.grFeeNu || 0, 10) || 0,
          from: f.grFrom, to: f.grTo,
          quota: parseInt(f.grQuota || 0, 10) || cfg.shuttle.quotaDefault,
          courtIds: f.grCourts.slice(), active: true,
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
        groups: d.groups.map((g) => (g.id === id ? { ...g, [k]: typeof g[k] === 'number' ? parseInt(v || 0, 10) || 0 : v } : g)),
      })),
    setShuttleType: (id, k, v) =>
      up((d) => ({
        shuttleTypes: d.shuttleTypes.map((x) => {
          if (x.id !== id) return x
          if (k === 'name' || k === 'active') return { ...x, [k]: v }
          return { ...x, [k]: parseInt(v || 0, 10) || 0 }
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
      if (!key) return
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
    clearSlot: (sid, slot) =>
      up((d) => {
        const lineups = { ...(d.lineups || {}) }
        const lu = { ...(lineups[sid] || {}) }
        delete lu[slot]
        lineups[sid] = lu
        return { lineups }
      }),
    removeFromCourt: (sid, key) =>
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
      if (!key) return
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
      const on = !!(db().groupMode || {})[sid]
      up((d) => ({ groupMode: { ...(d.groupMode || {}), [sid]: !on } }))
      toast(t(on ? 'toast.groupModeOff' : 'toast.groupModeOn'))
    },
    autoSplitCourts: (sid) => {
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
      up((d) => ({
        lineups: { ...(d.lineups || {}), [sid]: {} },
        courtGroups: { ...(d.courtGroups || {}), [sid]: {} },
      }))
      upUi(() => ({ picked: null }))
      toast(t('toast.lineupCleared'))
    },
    arrange: (sid, mode) => {
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
    setCourtMin: (sid, ci, v) =>
      up((d) => {
        const all = { ...(d.courtMin || {}) }
        const c = { ...(all[sid] || {}) }
        c[ci] = Math.max(0, parseInt(v || 0, 10) || 0)
        all[sid] = c
        return { courtMin: all }
      }),
    startCourt: (sid, ci) => {
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
      const gl = sGuests(d0, sid)
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
      L.push('Chi phí buổi: ' + fmt(sessionCost(d0, s)) + ' (sân + ' + s.shuttleUsed + ' quả cầu)')
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

}
