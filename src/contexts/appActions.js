// Mọi hành động ghi dữ liệu. Mỗi hành động bắn toast bằng tiếng Việt nói rõ đã làm gì và hệ quả.
// Quy ước: dbRef.current = db hiện tại (đọc để tính text toast), setDb(partial) để ghi.

import { addMonth, dd, ddmy, monthOf, monthTxt, wd } from '#utils/dates.js'
import {
  courtCost, courtTxt, fmt, fmtK, groupMembers, groupOf, guestOf, guestPrice, memberOf,
  perTube, presentCount, quotaFor, remainSessions, rowCost, sGuests, guestRev, sessionCost,
  sessionOf, stock, estSessions, timeTxt, unitPrice,
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
        m[mid] = m[mid] === true ? false : true
        a[sid] = m
        return { attendance: a }
      }),
    markAll: (sid, val) => {
      up((d) => {
        const s = sessionOf(d, sid)
        const a = { ...d.attendance }
        const m = {}
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
    setSessionStatus: (sid, st) => {
      up((d) => ({
        sessions: d.sessions.map((x) => (x.id === sid ? { ...x, status: st, closedAt: st === 'closed' ? d.today : x.closedAt } : x)),
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
    payBack: (key) => {
      const was = !!db().backPaid[key]
      up((d) => ({ backPaid: { ...d.backPaid, [key]: !d.backPaid[key] } }))
      toast(t(was ? 'toast.backUnpaid' : 'toast.backPaid'))
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
        if (d.locked[month]) return { locked: { ...d.locked, [month]: false } }
        const dues = d.dues.slice()
        d.groups.forEach((g) => {
          const r = (d.roster[month] || {})[g.id] || {}
          Object.keys(r).forEach((mid) => {
            if (r[mid] !== 'fixed') return
            if (dues.some((x) => x.month === month && x.groupId === g.id && x.memberId === mid)) return
            const mb = d.members.find((x) => x.id === mid)
            if (!mb) return
            dues.push({
              id: uid(), month, groupId: g.id, memberId: mid,
              amount: mb.gender === 'nu' ? g.feeNu : g.feeNam, paid: false, paidAt: null, method: '', note: '',
            })
          })
        })
        return { dues, locked: { ...d.locked, [month]: true } }
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
    addRow: () =>
      upUi((u) => ({
        form: { ...u.form, rows: (u.form.rows || []).concat([{ courtId: db().courts[0].id, from: '18:00', to: '20:00' }]) },
      })),
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
    createPurchase: () => {
      const f = form()
      const d0 = db()
      const t = d0.shuttleTypes.find((x) => x.id === f.pType)
      const tubes = parseInt(f.pTubes || 0, 10) || 0
      const extra = parseInt(f.pExtra || 0, 10) || 0
      const total = parseInt(f.pTotal || 0, 10) || 0
      const qty = tubes * t.perTube + extra
      if (!qty) return toast(t('toast.needQty'))
      if (!total) return toast(t('toast.needTotal'))
      up((d) => {
        return {
          purchases: d.purchases.concat([{
            id: uid(), date: f.pDate, typeId: f.pType, tubes, extra, qty,
            pricePerTube: tubes ? Math.round(total / tubes) : 0, total,
            payer: f.pPayer || 'Quỹ CLB', note: f.pNote || '',
          }]),
        }
      })
      upUi(() => ({ dialog: null, form: {} }))
      toast(t('toast.purchaseAdded', { qty, unit: fmtK(Math.round(total / qty)) }))
    },
    applyCheck: () => {
      const f = form()
      const d0 = db()
      const counted = parseInt(f.ckCount || 0, 10) || 0
      if (!f.ckCount) return toast(t('toast.needCounted'))
      const sysLeft = stock(d0).left
      const diff = sysLeft - counted
      const month = d0.month
      const est = estSessions(d0, month)
      if (diff !== 0 && !est.length) {
        return toast(t('toast.noEstSession'))
      }
      const n = est.length
      let rest = diff
      const delta = {}
      est.forEach((x, i) => {
        const share = i === n - 1 ? rest : Math.round(diff / n)
        rest -= share
        delta[x.id] = share
      })
      up((d) => {
        return {
          sessions: d.sessions.map((x) =>
            delta[x.id] === undefined
              ? x
              : { ...x, shuttleUsed: Math.max(0, x.shuttleUsed + delta[x.id]), shuttleEst: false, shuttleMode: 'exact' }
          ),
          stockChecks: (d.stockChecks || []).concat([{
            id: uid(), date: f.ckDate || d.today, month, counted, systemLeft: sysLeft,
            diff, spread: diff ? n : 0,
          }]),
        }
      })
      upUi(() => ({ dialog: null, form: {} }))
      toast(diff === 0
        ? t('toast.stockMatched')
        : t('toast.stockSpread', { diff: (diff > 0 ? '+' : '') + diff, n }))
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
    setCourtPrice: (id, v) =>
      up((d) => ({ courts: d.courts.map((c) => (c.id === id ? { ...c, price: parseInt(v || 0, 10) || 0 } : c)) })),
    setGroupField: (id, k, v) =>
      up((d) => ({
        groups: d.groups.map((g) => (g.id === id ? { ...g, [k]: typeof g[k] === 'number' ? parseInt(v || 0, 10) || 0 : v } : g)),
      })),
    setShuttleType: (id, k, v) =>
      up((d) => ({
        shuttleTypes: d.shuttleTypes.map((t) => (t.id === id ? { ...t, [k]: k === 'name' ? v : parseInt(v || 0, 10) || 0 } : t)),
      })),

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
