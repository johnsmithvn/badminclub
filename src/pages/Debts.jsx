// Công nợ: Thu / Hoàn theo buổi (Table & Grid) · Quỹ tháng (Table & Grid) · Quỹ nợ.

import { useState } from 'react'
import { Alert, Avatar, Button, Card, Dialog, Icon, IconButton, Input, SearchField, Select, Tabs } from '#ds'
import { Empty, GRID_PAIR, Mono, Overline, PayDebtsDialog, QrModal, TabTrack } from '#ui'
import { findBank, getVietQrUrl } from '#utils/vietqr.js'
import { useApp } from '#contexts/AppContext.jsx'
import { ddmy, monthOf, wd } from '#utils/dates.js'
import {
  adjustRows, advanceRows, clubDebtCounts, courtTxt, dueState, duesOf, duesTotal, fmt, fmtK,
  genderTxt, groupOf, guestOf, intOf, memberOf, monthSessions, myDebtCounts, myMember, pendingClaims,
  sessionOf, timeTxt,
} from '#lib/money.js'
import { can } from '#lib/roles.js'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'

const norm = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd') // i18n-ok: chuẩn hoá chữ để tìm kiếm, không phải chữ hiện ra
    .trim()

/**
 * Nhãn + màu trạng thái một khoản. Ba trạng thái chứ không phải hai kể từ migration 0018:
 * đã trả · ĐANG CHỜ DUYỆT (thành viên tự khai đã chuyển) · chưa trả.
 */
/**
 * Nhãn + icon của NÚT hành động. Khoản đang chờ duyệt vẫn dùng đúng nút tick cũ (bấm là bật
 * `paid`, sổ quỹ tự có dòng thu) — nhưng phải nói là DUYỆT, không phải "Bấm để Thu": người
 * bấm cần biết mình đang xác nhận lời khai của thành viên chứ không phải vừa cầm tiền mặt.
 */
const actionLabel = (item) =>
  t(item.paid
    ? (item.isRefund ? 'debts.paidRefund' : 'debts.paidCollect')
    : (item.isRefund ? 'debts.tapRefund' : 'debts.tapCollect'))

actionLabel.icon = (item) =>
  (item.paid ? 'circle-check' : item.isRefund ? 'send' : 'hand-coins')

const stateLabel = (item) =>
  t(item.paid
    ? (item.isRefund ? 'debts.paidRefund' : 'debts.paidCollect')
    : item.claimedAt
      ? 'debts.waitApprove'
      : (item.isRefund ? 'debts.unpaidRefund' : 'debts.unpaidCollect'))

/** Quỹ tháng: đang chờ duyệt thì đè lên nhãn "Chưa đóng" — chưa đóng và đã báo chuyển là
 *  hai việc khác nhau, để nguyên là người giữ quỹ thu lại lần hai. */
const dueWaiting = (x, st) => Boolean(x.claimedAt) && st.remain > 0

const stateStyle = (item) => (item.paid ? S.pillPaid : item.claimedAt ? S.pillWait : S.pillUnpaid)

export default function Debts() {
  const { db, ui, a } = useApp()
  const isMobile = useMobile()
  const rawTab = ui.tab.debts || 'sessions'
  // `canMoney` PHẢI đứng trước `tab`: `tab` đọc nó. Để sau là TDZ — "Cannot access before
  // initialization" ngay lúc render, và minify đổi tên biến nên log không nói được là biến nào.
  const canMoney = can(db.viewAs || 'owner', 'money')
  const tab = rawTab === 'guest' || rawTab === 'back' ? 'sessions'
    : (rawTab === 'pending' && !canMoney) ? 'sessions'
    : rawTab

  const dues = duesOf(db, db.month)
  const advances = advanceRows(db)
  const pending = canMoney ? pendingClaims(db, db.month) : []
  const counts = canMoney ? clubDebtCounts(db, db.month) : myDebtCounts(db, db.month)
  const [selectedPersonId, setSelectedPersonId] = useState(null)

  if (isMobile) {
    const isCn2 = tab === 'sessions' && !!selectedPersonId

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 24 }}>
        {!isCn2 && (
          <>
            {/* Header */}
            <div style={{
              padding: '16px 18px', background: '#080F1C', borderBottom: '1px solid rgba(255,255,255,.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 60,
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ font: '600 17px/1.2 Barlow, sans-serif', color: '#E9EFF7' }}>{t('debts.title')}</div>
                <div style={{ font: "400 12px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                  {tab === 'dues'
                    ? t('debts.mobileDuesMonth', { month: db.month })
                    : tab === 'advance'
                      ? t('debts.mobileAdvanceHeaderSub', { n: advances.filter((r) => !r.repaidAt).length })
                      : tab === 'pending'
                        ? t('debts.pendingTitle')
                        : t('debts.mobileLockNotice', { month: db.month, day: db.club?.lockDay || 25 })}
                </div>
              </div>
            </div>

            {/* Segmented Control */}
            <div style={{ padding: '0 14px' }}>
              <div style={{ display: 'flex', background: '#101927', border: '1px solid #22304A', borderRadius: 8, padding: 3 }}>
                <div
                  onClick={() => a.setTab('debts', 'sessions')}
                  style={{
                    flex: 1, textTransform: 'none', textAlign: 'center', padding: '9px 6px', borderRadius: 6,
                    background: tab === 'sessions' ? '#141D2E' : 'transparent',
                    boxShadow: tab === 'sessions' ? '0 1px 1px rgba(0,0,0,.30)' : 'none',
                    font: `${tab === 'sessions' ? 600 : 500} 13px/1.2 'IBM Plex Sans', sans-serif`,
                    color: tab === 'sessions' ? '#E9EFF7' : '#8494AA', cursor: 'pointer',
                  }}
                >
                  {t('debts.tabSessions')}
                </div>
                <div
                  onClick={() => a.setTab('debts', 'dues')}
                  style={{
                    flex: 1, textTransform: 'none', textAlign: 'center', padding: '9px 6px', borderRadius: 6,
                    background: tab === 'dues' ? '#141D2E' : 'transparent',
                    boxShadow: tab === 'dues' ? '0 1px 1px rgba(0,0,0,.30)' : 'none',
                    font: `${tab === 'dues' ? 600 : 500} 13px/1.2 'IBM Plex Sans', sans-serif`,
                    color: tab === 'dues' ? '#E9EFF7' : '#8494AA', cursor: 'pointer',
                  }}
                >
                  {t('debts.tabDues')}
                </div>
                <div
                  onClick={() => a.setTab('debts', 'advance')}
                  style={{
                    flex: 1, textTransform: 'none', textAlign: 'center', padding: '9px 6px', borderRadius: 6,
                    background: tab === 'advance' ? '#141D2E' : 'transparent',
                    boxShadow: tab === 'advance' ? '0 1px 1px rgba(0,0,0,.30)' : 'none',
                    font: `${tab === 'advance' ? 600 : 500} 13px/1.2 'IBM Plex Sans', sans-serif`,
                    color: tab === 'advance' ? '#E9EFF7' : '#8494AA', cursor: 'pointer',
                  }}
                >
                  {t('debts.tabAdvance')}
                </div>
                {canMoney && (
                  <div
                    onClick={() => a.setTab('debts', 'pending')}
                    style={{
                      flex: 1, textTransform: 'none', textAlign: 'center', padding: '9px 6px', borderRadius: 6,
                      background: tab === 'pending' ? '#141D2E' : 'transparent',
                      boxShadow: tab === 'pending' ? '0 1px 1px rgba(0,0,0,.30)' : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      font: `${tab === 'pending' ? 600 : 500} 13px/1.2 'IBM Plex Sans', sans-serif`,
                      color: tab === 'pending' ? '#E9EFF7' : '#8494AA', cursor: 'pointer',
                    }}
                  >
                    {t('debts.tabPending')}
                    {counts.pending > 0 && (
                      <span style={{ font: "600 10px/1 'IBM Plex Mono', monospace", color: '#F0B75C', background: 'rgba(224,138,0,.18)', padding: '4px 7px', borderRadius: 999 }}>
                        {counts.pending}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {tab === 'sessions' && (
          <SessionDebts
            canMoney={canMoney}
            selectedPersonId={selectedPersonId}
            onSelectPerson={setSelectedPersonId}
          />
        )}
        {tab === 'dues' && <Dues dues={dues} canMoney={canMoney} />}
        {tab === 'advance' && <Advances rows={advances} canMoney={canMoney} />}
        {tab === 'pending' && canMoney && <PendingClaims groups={pending} />}
      </div>
    )
  }

  return (
    <>
      <TabTrack>
        <Tabs
          variant="underline"
          items={[
            { value: 'sessions', label: t('debts.tabSessions'), count: counts.sessions },
            { value: 'dues', label: t('debts.tabDues'), count: counts.dues },
            { value: 'advance', label: t('debts.tabAdvance'), count: counts.advance },
          ].concat(canMoney ? [{
            value: 'pending',
            label: t('debts.tabPending'),
            count: counts.pending,
          }] : [])}
          value={tab}
          onChange={(v) => a.setTab('debts', v)}
        />
      </TabTrack>
      {tab === 'sessions' && <SessionDebts canMoney={canMoney} />}
      {tab === 'dues' && <Dues dues={dues} canMoney={canMoney} />}
      {tab === 'advance' && <Advances rows={advances} canMoney={canMoney} />}
      {tab === 'pending' && canMoney && <PendingClaims groups={pending} />}
    </>
  )
}

/* ---------------- THU / HOÀN THEO BUỔI (TABLE & GRID) ---------------- */

/**
 * Xác nhận TRẢ TIỀN RA cho thành viên (hoàn tiền vắng · trả khoản họ đã ứng).
 *
 * Chiều ngược với luồng thành viên tự khai: ở đây hiện QR + tài khoản của CHÍNH NGƯỜI NHẬN
 * để người giữ quỹ quét, chuyển, rồi mới ghi sổ. KHÔNG có bước duyệt — người bấm nút cũng
 * chính là người cầm tiền, không có ai thứ hai để xác nhận.
 *
 * Người nhận chưa điền tài khoản thì QrModal tự hiện "chưa có mã QR"; nút xác nhận vẫn bấm
 * được vì trả tiền mặt là chuyện thường.
 */
function RefundConfirm({ target, onClose }) {
  if (!target) return null
  const { name, bankHolder, bankNo, bankName, amount, run } = target
  return (
    <QrModal
      title={t('debts.refundQrTitle', { name })}
      qrUrl={getVietQrUrl({
        bankCode: (findBank(bankName) || {}).bin || bankName,
        accountNo: bankNo,
        accountHolder: bankHolder || name,
        amount,
      })}
      bankName={bankName}
      accountNo={bankNo}
      accountHolder={bankHolder || name}
      amount={fmt(amount)}
      confirmLabel={t('debts.refundConfirm')}
      onConfirm={() => { run(); onClose() }}
      onClose={onClose}
    />
  )
}

function SessionDebts({ canMoney, selectedPersonId, onSelectPerson }) {
  const { db, a, toast } = useApp()
  const isMobile = useMobile()
  const [expanded, setExpanded] = useState({})
  const [editingPrices, setEditingPrices] = useState({})
  const [editingInlineKey, setEditingInlineKey] = useState(null)
  const [filter, setFilter] = useState('unpaid')
  const [viewMode, setViewMode] = useState('table') // 'table' | 'grid'
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('unpaid-desc')
  const [typeFilter, setTypeFilter] = useState('') // '' | 'member' | 'guest'
  const [confirmCollect, setConfirmCollect] = useState(null)
  const [qrTarget, setQrTarget] = useState(null)
  const [payMine, setPayMine] = useState(null)
  const [refundTarget, setRefundTarget] = useState(null)
  const me = myMember(db)
  const effectiveViewMode = isMobile ? 'grid' : viewMode
  const activeFilterCount = (typeFilter ? 1 : 0) + (sortKey !== 'unpaid-desc' ? 1 : 0)

  /**
   * Các khoản của một người mà THÀNH VIÊN tự khai được: còn nợ, chưa khai, có id thật, và
   * đúng chiều người-nợ-quỹ. Gộp theo `kind:id` vì một dòng đối chiếu bị tách thành nhiều
   * dòng theo từng buổi để thủ quỹ soi — gửi trùng id lên RPC là vô nghĩa, còn cộng dồn
   * `price` mới ra đúng số tiền phải chuyển.
   */
  const claimable = (p) => {
    const byRef = {}
    p.unpaidItems.forEach((x) => {
      if (x.isRefund || x.claimedAt || !x.claimRef) return
      const k = x.claimRef.kind + ':' + x.claimRef.id
      if (!byRef[k]) byRef[k] = { ...x.claimRef, amount: 0 }
      byRef[k].amount += x.price
    })
    return Object.values(byRef)
  }

  // Map người chơi
  const peopleMap = {}

  // 1. Khách giao lưu & thành viên đi buổi đột xuất (sessionGuests)
  ;(db.sessionGuests || []).forEach((sg) => {
    const s = sessionOf(db, sg.sessionId)
    if (!s || monthOf(s.date) !== db.month) return
    const isMember = !!sg.memberId
    let personId = sg.memberId || sg.guestId
    if (!personId) return

    const rawGuest = !isMember ? (db.guests || []).find((g) => g.id === personId) : null
    if (rawGuest && rawGuest.companionOf && (db.guests || []).some((g) => g.id === rawGuest.companionOf)) {
      personId = rawGuest.companionOf
    }

    const who = isMember ? memberOf(db, personId) : guestOf(db, personId)
    if (!peopleMap[personId]) {
      peopleMap[personId] = {
        id: personId,
        name: who.name || t('debts.guestFallback'),
        gender: who.gender || sg.gender,
        level: who.level || sg.level,
        avatarUrl: who.avatarUrl || '',
        bankHolder: who.bankHolder || '',
        bankNo: who.bankNo || '',
        bankName: who.bankName || '',
        isMember,
        invitedBy: sg.invitedBy || who.invitedBy || '',
        items: [],
      }
    }

    const group = groupOf(db, s.groupId)
    const slotDesc = rawGuest && rawGuest.id !== personId ? ` (${rawGuest.name})` : ''
    peopleMap[personId].items.push({
      key: `sg:${sg.id}`,
      sgId: sg.id,
      type: 'guest',
      typeLabel: t(isMember ? 'debts.typeAdhoc' : 'debts.typeGuest') + slotDesc,
      isRefund: false,
      date: s.date,
      sessionId: s.id,
      timeVenue: `${timeTxt(s)} · ${courtTxt(db, s)}`,
      groupName: group?.name || t('debts.adhocGroup'),
      price: sg.price,
      paid: !!sg.paid,
      claimedAt: sg.claimedAt || null,
      claimRef: { kind: 'guest', id: sg.id },
      canEdit: !sg.paid && !sg.claimedAt,
    })
  })

  // 2. Hội viên vắng & Đi thêm ca cố định (adjustRows)
  const adjusts = adjustRows(db, db.month)
  adjusts.forEach((r) => {
    const memberId = r.memberId
    const mb = r.member
    if (!peopleMap[memberId]) {
      peopleMap[memberId] = {
        id: memberId,
        name: mb.name,
        gender: mb.gender,
        level: mb.level,
        avatarUrl: mb.avatarUrl || '',
        bankHolder: mb.bankHolder || '',
        bankNo: mb.bankNo || '',
        bankName: mb.bankName || '',
        isMember: true,
        invitedBy: '',
        items: [],
      }
    }

    const att = (s) => (db.attendance[s.id] || {})
    const closedSessions = monthSessions(db, db.month).filter(
      (s) => s.groupId === r.groupId && s.status === 'closed'
    )

    const matchingSessions = closedSessions.filter((s) => {
      const v = att(s)[memberId]
      return r.kind === 'absent_back' ? v === false : v === 'extra'
    })

    const isRefund = r.amount < 0
    const unitPrice = r.unit || (r.sessions ? Math.round(Math.abs(r.amount) / r.sessions) : 0)

    if (matchingSessions.length > 0) {
      matchingSessions.forEach((s) => {
        peopleMap[memberId].items.push({
          key: `adj:${r.key}:${s.id}`,
          adjustKey: r.key,
          type: r.kind,
          typeLabel: t(r.kind === 'absent_back' ? 'debts.typeAbsentGroup' : 'debts.typeExtraGroup'),
          isRefund,
          date: s.date,
          sessionId: s.id,
          timeVenue: `${timeTxt(s)} · ${courtTxt(db, s)}`,
          groupName: r.group?.name || '',
          price: unitPrice,
          paid: !!r.paid,
          settle: r.settle,
          claimedAt: r.claimedAt || null,
          claimRef: r.id ? { kind: 'adjust', id: r.id } : null,
          canEdit: !r.paid && !r.claimedAt,
        })
      })
    } else {
      peopleMap[memberId].items.push({
        key: `adj:${r.key}`,
        adjustKey: r.key,
        type: r.kind,
        typeLabel: t(r.kind === 'absent_back' ? 'debts.typeAbsent' : 'debts.typeExtra'),
        isRefund,
        date: db.today,
        sessionId: null,
        timeVenue: r.group?.name || '',
        groupName: r.group?.name || '',
        price: Math.abs(r.amount),
        paid: !!r.paid,
        settle: r.settle,
        claimedAt: r.claimedAt || null,
        claimRef: r.id ? { kind: 'adjust', id: r.id } : null,
        canEdit: !r.paid && !r.claimedAt,
      })
    }
  })

  // Sắp xếp và tính toán
  const people = Object.values(peopleMap).map((p) => {
    p.items.sort((a, b) => (a.date < b.date ? -1 : 1))
    const unpaidItems = p.items.filter((x) => !x.paid)
    const unpaidDue = unpaidItems.filter((x) => !x.isRefund).reduce((sum, x) => sum + x.price, 0)
    const unpaidRefund = unpaidItems.filter((x) => x.isRefund).reduce((sum, x) => sum + x.price, 0)
    const hasUnpaid = unpaidItems.length > 0
    return {
      ...p,
      unpaidItems,
      unpaidDue,
      unpaidRefund,
      hasUnpaid,
      totalCount: p.items.length,
      unpaidCount: unpaidItems.length,
    }
  })

  const totalDue = people.reduce((sum, p) => sum + p.unpaidDue, 0)
  const totalRefund = people.reduce((sum, p) => sum + p.unpaidRefund, 0)

  const filteredPeople = people.filter((p) => {
    // 1. Lọc theo trạng thái thanh toán
    if (filter === 'unpaid' && !p.hasUnpaid) return false
    if (filter === 'paid' && (p.hasUnpaid || p.totalCount === 0)) return false

    // 2. Lọc theo đối tượng (hội viên / khách ngoài)
    if (typeFilter === 'member' && !p.isMember) return false
    if (typeFilter === 'guest' && p.isMember) return false

    // 3. Tìm kiếm (Search)
    if (search.trim()) {
      const q = norm(search)
      const matchName = norm(p.name).includes(q)
      const matchInviter = norm(p.invitedBy ? memberOf(db, p.invitedBy).name : '').includes(q)
      const matchSession = p.items.some((it) =>
        norm(it.timeVenue).includes(q) || norm(it.groupName).includes(q) || it.date.includes(q)
      )
      if (!matchName && !matchInviter && !matchSession) return false
    }

    return true
  }).sort((a, b) => {
    if (sortKey === 'name-asc') return a.name.localeCompare(b.name, 'vi')
    if (sortKey === 'name-desc') return b.name.localeCompare(a.name, 'vi')
    if (sortKey === 'count-desc') return b.totalCount - a.totalCount
    if (sortKey === 'unpaid-asc') return (a.unpaidDue + a.unpaidRefund) - (b.unpaidDue + b.unpaidRefund)
    // unpaid-desc (mặc định)
    const diff = (b.unpaidDue + b.unpaidRefund) - (a.unpaidDue + a.unpaidRefund)
    if (diff !== 0) return diff
    return a.name.localeCompare(b.name, 'vi')
  })

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handlePriceChange = (key, val) => {
    setEditingPrices((prev) => ({ ...prev, [key]: val }))
  }

  const handlePriceBlur = (item) => {
    const raw = editingPrices[item.key]
    if (raw === undefined) return
    const newPrice = intOf(raw)
    if (item.type === 'guest') {
      a.setChargePrice(item.sgId, newPrice)
    } else if (item.adjustKey) {
      a.setAdjustAmount(item.adjustKey, newPrice)
    }
  }

  const doSettleItem = (item) => {
    if (item.type === 'guest') {
      a.toggleGuestPaid(item.sgId)
    } else if (item.adjustKey) {
      a.settleAdjust(item.adjustKey)
    }
  }

  // Tiền ĐI RA thì phải qua bước xem QR của người nhận đã. Tiền ĐI VÀO giữ nguyên đường cũ:
  // người giữ quỹ cầm tiền mặt tại sân, bấm một nhát là xong.
  const handleSettleItem = (item, person) => {
    if (item.isRefund && !item.paid && person) {
      setRefundTarget({
        name: person.name,
        bankHolder: person.bankHolder, bankNo: person.bankNo, bankName: person.bankName,
        amount: item.price,
        run: () => doSettleItem(item),
      })
      return
    }
    doSettleItem(item)
  }

  const handleSettleAll = (person) => {
    if (person.unpaidRefund > 0 && person.unpaidDue === 0) {
      setRefundTarget({
        name: person.name,
        bankHolder: person.bankHolder, bankNo: person.bankNo, bankName: person.bankName,
        amount: person.unpaidRefund,
        run: () => executeSettleAll(person),
      })
      return
    }
    setConfirmCollect(person)
  }

  const executeSettleAll = (person) => {
    const guestItems = person.items.filter((x) => x.type === 'guest' && !x.paid)
    if (guestItems.length > 0) {
      a.collectDebt(person.id)
    }
    const seenAdj = new Set()
    person.items.forEach((x) => {
      if (x.adjustKey && !x.paid && !seenAdj.has(x.adjustKey)) {
        seenAdj.add(x.adjustKey)
        a.settleAdjust(x.adjustKey)
      }
    })
  }

  const modalsNode = (
    <>
      {filterSheetOpen && (
        <Dialog
          open={filterSheetOpen}
          sheet
          title={t('common.filterTitle')}
          onClose={() => setFilterSheetOpen(false)}
        >
          <div style={{ display: 'grid', gap: 16, padding: '12px 0 calc(20px + env(safe-area-inset-bottom, 0px))' }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                {t('debts.whoMember')} / {t('debts.whoGuest')}
              </label>
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                options={[
                  { value: '', label: t('debts.whoAll') },
                  { value: 'member', label: t('debts.whoMember') },
                  { value: 'guest', label: t('debts.whoGuest') },
                ]}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                {t('common.sort')}
              </label>
              <Select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                options={[
                  { value: 'unpaid-desc', label: t('debts.sortUnpaidDesc') },
                  { value: 'unpaid-asc', label: t('debts.sortUnpaidAsc') },
                  { value: 'name-asc', label: t('debts.sortNameAsc') },
                  { value: 'name-desc', label: t('debts.sortNameDesc') },
                  { value: 'count-desc', label: t('debts.sortCountDesc') },
                ]}
                style={{ width: '100%' }}
              />
            </div>
            <Button
              variant="primary"
              style={{ height: 48, marginTop: 8 }}
              onClick={() => setFilterSheetOpen(false)}
            >
              {t('common.apply')}
            </Button>
          </div>
        </Dialog>
      )}

      {confirmCollect && (
        <Dialog
          open
          sheet={isMobile}
          onClose={() => setConfirmCollect(null)}
          title={t('debts.collectDebtConfirmTitle')}
          footer={
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
              <Button variant="secondary" style={isMobile ? { height: 48, flex: 1 } : undefined} onClick={() => setConfirmCollect(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="accent"
                style={isMobile ? { height: 48, flex: 1 } : undefined}
                onClick={() => {
                  executeSettleAll(confirmCollect)
                  setConfirmCollect(null)
                }}
              >
                {t('debts.collectDebtConfirmBtn', { amount: fmt(confirmCollect.unpaidDue) })}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'grid', gap: 12, fontSize: 14 }}>
            <p style={{ margin: 0 }}>
              {t('debts.collectDebtConfirmDesc', {
                name: confirmCollect.name,
                count: confirmCollect.unpaidCount,
                month: db.month,
                amount: fmt(confirmCollect.unpaidDue),
              })}
            </p>
            <div style={{ padding: '8px 12px', background: 'var(--surface-inset)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
              {confirmCollect.items.filter((x) => !x.paid).map((it) => (
                <div key={it.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>{ddmy(it.date)} · {it.typeLabel}</span>
                  <Mono>{fmt(it.price)}</Mono>
                </div>
              ))}
            </div>
          </div>
        </Dialog>
      )}

      <RefundConfirm target={refundTarget} onClose={() => setRefundTarget(null)} />

      {payMine && (
        <PayDebtsDialog items={payMine} onClose={() => setPayMine(null)} />
      )}

      {qrTarget && (
        <QrModal
          title={t('bank.qrTitle') + ' · ' + qrTarget.name}
          qrUrl={getVietQrUrl({
            bankCode: (findBank(qrTarget.bankName) || {}).bin || qrTarget.bankName,
            accountNo: qrTarget.bankNo,
            accountHolder: qrTarget.bankHolder || qrTarget.name,
            amount: qrTarget.unpaidRefund > 0 ? qrTarget.unpaidRefund : (qrTarget.unpaidDue > 0 ? qrTarget.unpaidDue : undefined),
          })}
          bankName={qrTarget.bankName}
          accountNo={qrTarget.bankNo}
          accountHolder={qrTarget.bankHolder || qrTarget.name}
          amount={qrTarget.unpaidRefund > 0 ? fmt(qrTarget.unpaidRefund) : (qrTarget.unpaidDue > 0 ? fmt(qrTarget.unpaidDue) : undefined)}
          onClose={() => setQrTarget(null)}
        />
      )}
    </>
  )

  if (isMobile) {
    if (selectedPersonId) {
      const person = people.find((p) => p.id === selectedPersonId)
      if (!person) {
        if (onSelectPerson) onSelectPerson(null)
        return null
      }

      const inviter = person.invitedBy ? memberOf(db, person.invitedBy).name : ''
      const isDebt = person.unpaidDue > 0

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* CN2 Header */}
          <div style={{
            padding: '16px 18px', background: '#080F1C', borderBottom: '1px solid rgba(255,255,255,.10)',
            display: 'flex', alignItems: 'center', gap: 12, minHeight: 60,
          }}>
            <div
              onClick={() => onSelectPerson && onSelectPerson(null)}
              style={{
                width: 28, height: 28, borderRadius: 6, background: '#1A2437', border: '1px solid #2E3E5C',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <Icon name="arrow-left" size={16} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ font: '600 17px/1.2 Barlow, sans-serif', color: '#E9EFF7' }}>{person.name}</div>
              <div style={{ font: "400 12px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                {person.items.length} {t('units.session')}{inviter ? ` · ${t('debts.tagInviterShort', { name: inviter })}` : person.isMember ? ` · ${t('debts.tagMember')}` : ''}
              </div>
            </div>
          </div>

          <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Summary Card */}
            <div style={{
              background: '#141D2E', border: '1px solid #22304A', borderRadius: 10,
              boxShadow: '0 1px 1px rgba(0,0,0,.30)', padding: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8494AA' }}>
                  {isDebt ? t('debts.unpaidCollect') : t('debts.unpaidRefund')}
                </div>
                <div style={{ font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  {person.isMember
                    ? t('debts.tagMember')
                    : t('debts.mobileGuestPriceHint', { level: person.level || '', gender: genderTxt(person.gender) })}
                </div>
              </div>
              <div style={{ font: '700 26px/1 Barlow, sans-serif', color: isDebt ? '#F0B75C' : '#5FD9A2' }}>
                {fmt(isDebt ? person.unpaidDue : person.unpaidRefund)}
              </div>
            </div>

            {/* Session List */}
            <div style={{
              background: '#141D2E', border: '1px solid #22304A', borderRadius: 10,
              boxShadow: '0 1px 1px rgba(0,0,0,.30)', overflow: 'hidden',
            }}>
              <div style={{
                padding: '12px 14px', background: '#101927', borderBottom: '1px solid #22304A',
                font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '0.08em',
                textTransform: 'uppercase', color: '#8494AA',
              }}>
                {t('debts.mobileEachSession')}
              </div>

              {person.items.map((item, idx) => {
                const isEditing = editingInlineKey === item.key
                const currentPrice = editingPrices[item.key] !== undefined ? editingPrices[item.key] : String(item.price)

                if (isEditing) {
                  return (
                    <div
                      key={item.key}
                      style={{
                        padding: 14, borderBottom: idx < person.items.length - 1 ? '1px solid #22304A' : 'none',
                        display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(60,116,196,.08)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <div style={{ font: "600 15px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                            {wd(item.date)} {ddmy(item.date)} · {item.timeVenue}
                          </div>
                          <div style={{ font: "400 12px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                            {item.groupName} · {item.typeLabel}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="text"
                          value={currentPrice}
                          onChange={(e) => handlePriceChange(item.key, e.target.value)}
                          style={{
                            flex: 1, minHeight: 44, display: 'flex', alignItems: 'center', padding: '0 12px',
                            background: '#101927', border: '1px solid #3C74C4', borderRadius: 6,
                            font: "600 16px/1 'IBM Plex Mono', monospace", color: '#E9EFF7', outline: 'none',
                          }}
                        />
                        <div
                          onClick={() => {
                            handlePriceBlur(item)
                            setEditingInlineKey(null)
                          }}
                          style={{
                            minHeight: 44, padding: '0 14px', display: 'flex', alignItems: 'center',
                            background: '#1D50A0', borderRadius: 6, font: "600 14px/1 'IBM Plex Sans', sans-serif",
                            color: '#FFFFFF', cursor: 'pointer',
                          }}
                        >
                          {t('debts.mobileSave')}
                        </div>
                        <div
                          onClick={() => {
                            handlePriceChange(item.key, undefined)
                            setEditingInlineKey(null)
                          }}
                          style={{
                            minHeight: 44, padding: '0 12px', display: 'flex', alignItems: 'center',
                            background: '#1A2437', border: '1px solid #2E3E5C', borderRadius: 6,
                            font: "600 14px/1 'IBM Plex Sans', sans-serif", color: '#A8B7CB', cursor: 'pointer',
                          }}
                        >
                          {t('debts.mobileCancel')}
                        </div>
                      </div>
                      <div style={{ font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: '#F0B75C' }}>
                        {t('debts.mobileEditInlineHint')}
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={item.key}
                    onClick={() => {
                      if (canMoney && !item.paid && !item.claimedAt) {
                        setEditingInlineKey(item.key)
                      }
                    }}
                    style={{
                      padding: 14, borderBottom: idx < person.items.length - 1 ? '1px solid #22304A' : 'none',
                      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
                      cursor: canMoney && !item.paid && !item.claimedAt ? 'pointer' : 'default',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ font: "600 15px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                        {wd(item.date)} {ddmy(item.date)} · {item.timeVenue}
                      </div>
                      <div style={{ font: "400 12px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                        {item.groupName} · {item.typeLabel}
                        {item.paid && ` · ${t('debts.paidCollect')}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ font: "600 15px/1 'IBM Plex Mono', monospace", color: item.paid ? '#5FD9A2' : '#E9EFF7' }}>
                        {fmt(item.price)}
                      </div>
                      {canMoney && !item.paid && !item.claimedAt && (
                        <Icon name="pencil" size={13} style={{ color: '#8494AA' }} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Fund Notice Box */}
            <div style={{
              background: '#141D2E', border: '1px solid #00786F', borderRadius: 10,
              padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ font: "600 13px/1.3 'IBM Plex Sans', sans-serif", color: '#5FDBD3' }}>
                {t('debts.mobileFundNoticeTitle')}
              </div>
              <div style={{ font: "400 12px/1.45 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                {t('debts.mobileFundNoticeDesc')}
              </div>
            </div>

            {/* Bottom Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <div
                onClick={() => {
                  if (!canMoney) {
                    toast(t('common.unauthorized'))
                    return
                  }
                  handleSettleAll(person)
                }}
                style={{
                  flex: 1, textAlign: 'center', minHeight: 56, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', background: '#1D50A0', borderRadius: 6,
                  font: "600 16px/1 'IBM Plex Sans', sans-serif", color: '#FFFFFF', cursor: 'pointer',
                }}
              >
                {isDebt
                  ? t('debts.mobileCollectBtn', { amount: fmt(person.unpaidDue) })
                  : t('debts.mobileRefundBtn', { amount: fmt(person.unpaidRefund) })}
              </div>
              <div
                onClick={() => {
                  if (isDebt) {
                    setQrTarget(person)
                  } else {
                    setRefundTarget({
                      name: person.name, bankHolder: person.bankHolder, bankNo: person.bankNo,
                      bankName: person.bankName, amount: person.unpaidRefund,
                      run: () => executeSettleAll(person),
                    })
                  }
                }}
                style={{
                  minHeight: 56, padding: '0 18px', display: 'flex', alignItems: 'center',
                  background: '#1A2437', border: '1px solid #2E3E5C', borderRadius: 6,
                  font: "600 16px/1 'IBM Plex Sans', sans-serif", color: '#A8B7CB', cursor: 'pointer',
                }}
              >
                {t('debts.mobileQrBtn')}
              </div>
            </div>
          </div>

          {modalsNode}
        </div>
      )
    }

    // CN1
    const debtors = filteredPeople.filter((p) => p.unpaidDue > 0)
    const refundees = filteredPeople.filter((p) => p.unpaidRefund > 0)
    const debtorsTotal = debtors.reduce((sum, p) => sum + p.unpaidDue, 0)
    const refundeesTotal = refundees.reduce((sum, p) => sum + p.unpaidRefund, 0)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Search Field */}
        <div style={{ padding: '0 14px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', minHeight: 44, padding: '0 12px',
            background: '#101927', border: '1px solid #2E3E5C', borderRadius: 6,
          }}>
            <Icon name="search" size={16} style={{ color: '#5B6B81', marginRight: 8 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('debts.searchSession')}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                font: "400 15px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7',
              }}
            />
            {search && (
              <IconButton icon="x" size="sm" variant="ghost" label={t('common.clear')} onClick={() => setSearch('')} />
            )}
          </div>
        </div>

        {filteredPeople.length === 0 ? (
          <div style={{ padding: '14px' }}>
            <Empty icon="circle-check" title={t('debts.sEmpty')} hint={t('debts.sEmptyHint')} />
          </div>
        ) : (
          <div style={{ padding: '4px 14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Nhóm 1: Cần thu */}
            {debtors.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8494AA' }}>
                    {t('debts.mobileNeedCollectGroup', { n: debtors.length })}
                  </div>
                  <div style={{ font: "600 13px/1 'IBM Plex Mono', monospace", color: '#F0B75C' }}>
                    + {fmt(debtorsTotal)}
                  </div>
                </div>

                {debtors.map((p) => {
                  const inviter = p.invitedBy ? memberOf(db, p.invitedBy).name : ''
                  const samplePrice = p.unpaidItems[0]?.price || 0
                  const formula = p.unpaidItems.length > 1
                    ? `${fmt(samplePrice)} × ${p.unpaidItems.length}`
                    : (p.isMember ? t('debts.tagMember') : t('debts.tagGuest'))

                  return (
                    <div
                      key={p.id}
                      style={{
                        background: '#141D2E', border: '1px solid #22304A', borderRadius: 10,
                        boxShadow: '0 1px 1px rgba(0,0,0,.30)', padding: 14,
                        display: 'flex', flexDirection: 'column', gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ font: "600 16px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>{p.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{
                              font: "600 10px/1 'IBM Plex Sans', sans-serif",
                              color: p.isMember ? '#9FC0EA' : '#A8B7CB',
                              background: p.isMember ? 'rgba(60,116,196,.18)' : 'rgba(148,164,186,.14)',
                              padding: '5px 8px', borderRadius: 999,
                            }}>
                              {t(p.isMember ? 'debts.tagMember' : 'debts.tagGuest')}
                            </span>
                            {p.level && (
                              <span style={{
                                font: "600 10px/1 'IBM Plex Sans', sans-serif", color: '#5FDBD3',
                                background: 'rgba(0,178,169,.18)', padding: '5px 8px', borderRadius: 999,
                              }}>
                                {p.level}
                              </span>
                            )}
                            <span style={{ font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                              {inviter ? `${t('debts.tagInviterShort', { name: inviter })} · ` : ''}{p.unpaidItems.length} {t('units.session')}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                          <div style={{ font: '700 22px/1 Barlow, sans-serif', color: '#F0B75C' }}>
                            +{fmt(p.unpaidDue)}
                          </div>
                          <div style={{ font: "400 11px/1.2 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                            {formula}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <div
                          onClick={() => {
                            if (!canMoney) {
                              if (me && p.id === me.id) {
                                setPayMine(claimable(p))
                              } else {
                                toast(t('common.unauthorized'))
                              }
                              return
                            }
                            handleSettleAll(p)
                          }}
                          style={{
                            flex: 1, textAlign: 'center', padding: '0 12px', minHeight: 48,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: '#1D50A0', borderRadius: 6,
                            font: "600 15px/1 'IBM Plex Sans', sans-serif", color: '#FFFFFF', cursor: 'pointer',
                          }}
                        >
                          {!canMoney && me && p.id === me.id ? t('debts.payMine', { amount: fmt(p.unpaidDue) }) : t('debts.collectAll')}
                        </div>
                        <div
                          onClick={() => onSelectPerson && onSelectPerson(p.id)}
                          style={{
                            padding: '0 14px', minHeight: 48, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', background: '#1A2437', border: '1px solid #2E3E5C',
                            borderRadius: 6, font: "600 15px/1 'IBM Plex Sans', sans-serif", color: '#A8B7CB', cursor: 'pointer',
                          }}
                        >
                          {t('common.details')}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Nhóm 2: Cần trả */}
            {refundees.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: debtors.length > 0 ? 4 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8494AA' }}>
                    {t('debts.mobileNeedRefundGroup', { n: refundees.length })}
                  </div>
                  <div style={{ font: "600 13px/1 'IBM Plex Mono', monospace", color: '#5FD9A2' }}>
                    − {fmt(refundeesTotal)}
                  </div>
                </div>

                {refundees.map((p) => {
                  const firstItem = p.unpaidItems[0]
                  const reason = firstItem?.typeLabel || t('debts.typeAbsentGroup')

                  return (
                    <div
                      key={p.id}
                      style={{
                        background: '#141D2E', border: '1px solid #22304A', borderRadius: 10,
                        boxShadow: '0 1px 1px rgba(0,0,0,.30)', padding: 14,
                        display: 'flex', flexDirection: 'column', gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ font: "600 16px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>{p.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{
                              font: "600 10px/1 'IBM Plex Sans', sans-serif", color: '#9FC0EA',
                              background: 'rgba(60,116,196,.18)', padding: '5px 8px', borderRadius: 999,
                            }}>
                              {t('debts.tagMember')}
                            </span>
                            <span style={{ font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                              {reason}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                          <div style={{ font: '700 22px/1 Barlow, sans-serif', color: '#5FD9A2' }}>
                            −{fmt(p.unpaidRefund)}
                          </div>
                          <div style={{ font: "400 11px/1.2 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                            {p.unpaidItems.length} {t('units.session')}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <div
                          onClick={() => {
                            if (!canMoney) {
                              toast(t('common.unauthorized'))
                              return
                            }
                            handleSettleAll(p)
                          }}
                          style={{
                            flex: 1, textAlign: 'center', padding: '0 12px', minHeight: 48,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: '#1D50A0', borderRadius: 6,
                            font: "600 15px/1 'IBM Plex Sans', sans-serif", color: '#FFFFFF', cursor: 'pointer',
                          }}
                        >
                          {t('debts.refundAll')}
                        </div>
                        <div
                          onClick={() => onSelectPerson && onSelectPerson(p.id)}
                          style={{
                            padding: '0 14px', minHeight: 48, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', background: '#1A2437', border: '1px solid #2E3E5C',
                            borderRadius: 6, font: "600 15px/1 'IBM Plex Sans', sans-serif", color: '#A8B7CB', cursor: 'pointer',
                          }}
                        >
                          {t('common.details')}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {modalsNode}
      </div>
    )
  }

  return (
    <Card
      title={t('debts.sTitle')}
      subtitle={t('debts.sSub')}
      icon="receipt"
      padding="0"
      actions={
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Lọc trạng thái */}
          <Tabs
            variant="segmented"
            items={[
              { value: 'unpaid', label: t('debts.fUnpaid') },
              { value: 'all', label: t('common.all') },
              { value: 'paid', label: t('debts.fDone') },
            ]}
            value={filter}
            onChange={(v) => setFilter(v)}
          />

          {/* Chuyển đổi Bảng / Lưới */}
          {!isMobile && (
            <div style={S.viewSwitcher}>
              <IconButton
                icon="list"
                size="sm"
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                label={t('debts.viewTable')}
                onClick={() => setViewMode('table')}
              />
              <IconButton
                icon="layout-grid"
                size="sm"
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                label={t('debts.viewGrid')}
                onClick={() => setViewMode('grid')}
              />
            </div>
          )}

          {/* Tổng tiền nổi bật */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              font: '700 12.5px/1 var(--font-sans)',
              color: 'var(--status-delivered-fg)',
              background: 'var(--status-delivered-bg)',
              border: '1px solid rgba(14,138,85,0.3)',
              padding: '4px 10px',
              borderRadius: 6,
            }}>
              {t('debts.needCollect', { amount: fmt(totalDue) })}
            </span>
            <span style={{
              font: '700 12.5px/1 var(--font-sans)',
              color: 'var(--status-incident-fg)',
              background: 'var(--status-incident-bg)',
              border: '1px solid rgba(196,43,28,0.3)',
              padding: '4px 10px',
              borderRadius: 6,
            }}>
              {t('debts.needRefund', { amount: fmt(totalRefund) })}
            </span>
          </div>
        </div>
      }
    >
      {/* Thanh tìm kiếm và sắp xếp */}
      <div style={{
        ...S.fltBar,
        ...(isMobile ? { display: 'flex', gap: 8, width: '100%' } : {}),
      }}>
        <SearchField
          width={isMobile ? undefined : 250}
          style={{ height: isMobile ? 48 : 36, flex: 1 }}
          placeholder={t('debts.searchSession')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
        {isMobile ? (
          <>
            <button
              type="button"
              onClick={() => setFilterSheetOpen(true)}
              style={{
                height: 48,
                minHeight: 48,
                padding: '0 14px',
                borderRadius: 'var(--radius-control)',
                border: '1px solid var(--border-default)',
                background: activeFilterCount > 0 ? 'var(--action-accent-bg)' : 'var(--surface-card)',
                color: activeFilterCount > 0 ? 'var(--action-accent-fg)' : 'var(--text-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Icon name="settings-2" size={14} />
              <span>{t('common.filter')}</span>
              {activeFilterCount > 0 && (
                <span style={{
                  background: 'var(--action-accent-fg)',
                  color: 'var(--gray-0)',
                  borderRadius: 999,
                  padding: '1px 6px',
                  fontSize: 11,
                  fontWeight: 700,
                }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
            {filterSheetOpen && (
              <Dialog
                open={filterSheetOpen}
                sheet
                title={t('common.filterTitle')}
                onClose={() => setFilterSheetOpen(false)}
              >
                <div style={{ display: 'grid', gap: 16, padding: '12px 0 calc(20px + env(safe-area-inset-bottom, 0px))' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                      {t('debts.whoMember')} / {t('debts.whoGuest')}
                    </label>
                    <Select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      options={[
                        { value: '', label: t('debts.whoAll') },
                        { value: 'member', label: t('debts.whoMember') },
                        { value: 'guest', label: t('debts.whoGuest') },
                      ]}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                      {t('common.sort')}
                    </label>
                    <Select
                      value={sortKey}
                      onChange={(e) => setSortKey(e.target.value)}
                      options={[
                        { value: 'unpaid-desc', label: t('debts.sortUnpaidDesc') },
                        { value: 'unpaid-asc', label: t('debts.sortUnpaidAsc') },
                        { value: 'name-asc', label: t('debts.sortNameAsc') },
                        { value: 'name-desc', label: t('debts.sortNameDesc') },
                        { value: 'count-desc', label: t('debts.sortCountDesc') },
                      ]}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <Button
                    variant="primary"
                    style={{ height: 48, marginTop: 8 }}
                    onClick={() => setFilterSheetOpen(false)}
                  >
                    {t('common.apply')}
                  </Button>
                </div>
              </Dialog>
            )}
          </>
        ) : (
          <>
            <Select
              size="sm"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[
                { value: '', label: t('debts.whoAll') },
                { value: 'member', label: t('debts.whoMember') },
                { value: 'guest', label: t('debts.whoGuest') },
              ]}
            />
            <Select
              size="sm"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              options={[
                { value: 'unpaid-desc', label: t('debts.sortUnpaidDesc') },
                { value: 'unpaid-asc', label: t('debts.sortUnpaidAsc') },
                { value: 'name-asc', label: t('debts.sortNameAsc') },
                { value: 'name-desc', label: t('debts.sortNameDesc') },
                { value: 'count-desc', label: t('debts.sortCountDesc') },
              ]}
            />
          </>
        )}
      </div>

      {filteredPeople.length === 0 ? (
        <Empty icon="circle-check" title={t('debts.sEmpty')} hint={t('debts.sEmptyHint')} />
      ) : effectiveViewMode === 'table' ? (
        <div style={{ display: 'grid' }}>
          {filteredPeople.map((p) => {
            const isExp = !!expanded[p.id]
            const inviter = p.invitedBy ? memberOf(db, p.invitedBy).name : ''

            return (
              <div key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 16px', background: isExp ? 'var(--surface-sunken)' : 'var(--surface-card)',
                    cursor: 'pointer', flexWrap: 'wrap', gap: 10,
                  }}
                  onClick={() => toggleExpand(p.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 240 }}>
                    <IconButton
                      icon={isExp ? 'chevron-down' : 'chevron-right'}
                      size="sm"
                      variant="ghost"
                      label={t(isExp ? 'debts.collapse' : 'debts.expand')}
                      onClick={(e) => { e.stopPropagation(); toggleExpand(p.id) }}
                    />
                    <Avatar name={p.name} src={p.avatarUrl} size={30} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ font: 'var(--type-label)', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {p.name}
                        </span>
                        {(p.bankName && p.bankNo) && (
                          <IconButton
                            icon="qr-code"
                            size="sm"
                            variant="ghost"
                            label={t('bank.viewQr')}
                            onClick={(e) => {
                              e.stopPropagation()
                              setQrTarget(p)
                            }}
                          />
                        )}
                        <span style={p.isMember ? S.tagMember : S.tagGuest}>
                          {t(p.isMember ? 'debts.tagMember' : 'debts.tagGuest')}
                        </span>
                        {inviter && (
                          <span style={S.tagInviter}>{t('debts.tagInviter', { name: inviter })}</span>
                        )}
                      </div>
                      <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', marginTop: 2 }}>
                        {t('debts.personMeta', {
                          n: p.totalCount,
                          state: p.unpaidCount > 0 ? t('debts.unpaidCount', { n: p.unpaidCount }) : t('debts.fDone'),
                        })}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ textAlign: 'right' }}>
                      {p.unpaidDue > 0 && (
                        <div style={{ font: 'var(--type-label)', fontWeight: 700, color: 'var(--status-delivered)' }}>
                          {t('debts.sumCollect', { amount: fmt(p.unpaidDue) })}
                        </div>
                      )}
                      {p.unpaidRefund > 0 && (
                        <div style={{ font: 'var(--type-label)', fontWeight: 700, color: 'var(--status-incident)' }}>
                          {t('debts.sumRefund', { amount: fmt(p.unpaidRefund) })}
                        </div>
                      )}
                      {!p.hasUnpaid && (
                        <div style={{ font: 'var(--type-caption)', fontWeight: 600, color: 'var(--status-delivered)' }}>
                          {t('debts.allDone')}
                        </div>
                      )}
                    </div>
                    {canMoney && p.hasUnpaid && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={p.unpaidRefund > 0 && p.unpaidDue === 0 ? 'send' : 'circle-check'}
                        onClick={() => handleSettleAll(p)}
                      >
                        {t(p.unpaidRefund > 0 && p.unpaidDue === 0 ? 'debts.payAll' : 'debts.collectAll')}
                      </Button>
                    )}
                    {!canMoney && me && p.id === me.id && claimable(p).length > 0 && (
                      <Button
                        size="sm"
                        variant="primary"
                        icon="banknote"
                        onClick={() => setPayMine(claimable(p))}
                      >
                        {t('debts.payMine', { amount: fmt(claimable(p).reduce((n, x) => n + x.amount, 0)) })}
                      </Button>
                    )}
                  </div>
                </div>

                {isExp && (
                  <div style={{ padding: '0 16px 12px 48px', background: 'var(--surface-sunken)' }}>
                    <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', font: 'var(--type-label)' }}>
                        <thead>
                          <tr style={S.subTableHead}>
                            <th style={S.th}>{t('debts.colSession')}</th>
                            <th style={S.th}>{t('debts.colKind')}</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>{t('debts.colAmountEdit')}</th>
                            <th style={{ ...S.th, textAlign: 'center' }}>{t('debts.colState')}</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>{t('debts.colAction')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.items.map((item) => {
                            const currentPrice = editingPrices[item.key] !== undefined ? editingPrices[item.key] : String(item.price)
                            return (
                              <tr key={item.key} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <td style={S.td}>
                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {wd(item.date)}, {ddmy(item.date)} · {item.timeVenue}
                                  </div>
                                  <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{item.groupName}</div>
                                </td>
                                <td style={S.td}>
                                  <span style={{
                                    color: item.isRefund ? 'var(--status-incident)' : 'var(--teal-700)',
                                    fontWeight: 600,
                                  }}>
                                    {item.typeLabel}
                                  </span>
                                </td>
                                <td style={{ ...S.td, textAlign: 'right' }}>
                                  <Input
                                    size="sm"
                                    mono
                                    disabled={!canMoney || item.paid || !!item.claimedAt}
                                    value={currentPrice}
                                    onChange={(e) => handlePriceChange(item.key, e.target.value)}
                                    onBlur={() => handlePriceBlur(item)}
                                    style={{ width: 105, textAlign: 'right', display: 'inline-block' }}
                                    suffix={t('units.dong')}
                                  />
                                </td>
                                <td style={{ ...S.td, textAlign: 'center' }}>
                                  <span style={stateStyle(item)}>
                                    {stateLabel(item)}
                                  </span>
                                </td>
                                <td style={{ ...S.td, textAlign: 'right' }}>
                                  {canMoney ? (
                                    item.claimedAt && !item.paid ? (
                                      <Button size="sm" variant="ghost" icon="arrow-right"
                                        onClick={() => a.setTab('debts', 'pending')}>
                                        {t('debts.goPending')}
                                      </Button>
                                    ) : (
                                    <Button
                                      size="sm"
                                      variant={item.paid ? 'ghost' : 'secondary'}
                                      icon={actionLabel.icon(item)}
                                      onClick={() => handleSettleItem(item, p)}
                                    >
                                      {actionLabel(item)}
                                    </Button>
                                    )
                                  ) : (
                                    <span style={stateStyle(item)}>
                                      {stateLabel(item)}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={S.gridContainer}>
          {filteredPeople.map((p) => {
            const inviter = p.invitedBy ? memberOf(db, p.invitedBy).name : ''

            return (
              <div key={p.id} style={S.personCard}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <Avatar name={p.name} src={p.avatarUrl} size={34} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ font: 'var(--type-label)', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.name}
                        </div>
                        {(p.bankName && p.bankNo) && (
                          <IconButton
                            icon="qr-code"
                            size="sm"
                            variant="ghost"
                            label={t('bank.viewQr')}
                            onClick={() => setQrTarget(p)}
                          />
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
                        <span style={p.isMember ? S.tagMember : S.tagGuest}>
                          {t(p.isMember ? 'debts.tagMember' : 'debts.tagGuest')}
                        </span>
                        {inviter && <span style={S.tagInviter}>{t('debts.tagInviterShort', { name: inviter })}</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    {p.unpaidDue > 0 && (
                      <span style={{ font: 'var(--type-label)', fontWeight: 700, color: 'var(--status-delivered)' }}>
                        +{fmt(p.unpaidDue)}
                      </span>
                    )}
                    {p.unpaidRefund > 0 && (
                      <span style={{ font: 'var(--type-label)', fontWeight: 700, color: 'var(--status-incident)' }}>
                        −{fmt(p.unpaidRefund)}
                      </span>
                    )}
                    {!p.hasUnpaid && (
                      <span style={{ font: 'var(--type-caption)', fontWeight: 600, color: 'var(--status-delivered)' }}>
                        {t('debts.allDone')}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ height: 1, background: 'var(--border-subtle)' }} />

                <div style={{ display: 'grid', gap: 8, flex: 1 }}>
                  {p.items.map((item) => {
                    const currentPrice = editingPrices[item.key] !== undefined ? editingPrices[item.key] : String(item.price)
                    return (
                      <div key={item.key} style={S.gridSessionRow}>
                        <div>
                          <div style={{ font: 'var(--type-label)', fontWeight: 600, fontSize: 12 }}>
                            {wd(item.date)}, {ddmy(item.date)}
                          </div>
                          <div style={{ font: 'var(--type-caption)', fontSize: 11, color: 'var(--text-muted)' }}>
                            {item.timeVenue}
                          </div>
                          <div style={{ font: 'var(--type-caption)', fontSize: 11, color: item.isRefund ? 'var(--status-incident)' : 'var(--teal-700)', fontWeight: 600 }}>
                            {item.typeLabel}
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <Input
                            size="sm"
                            mono
                            disabled={!canMoney || item.paid || !!item.claimedAt}
                            value={currentPrice}
                            onChange={(e) => handlePriceChange(item.key, e.target.value)}
                            onBlur={() => handlePriceBlur(item)}
                            style={{ width: isMobile ? 110 : 95, height: isMobile ? 44 : undefined, textAlign: 'right' }}
                            suffix={t('units.dong')}
                          />
                          {canMoney ? (
                            item.claimedAt && !item.paid ? (
                              <Button size="sm" variant="ghost" icon="arrow-right"
                                onClick={() => a.setTab('debts', 'pending')}>
                                {t('debts.goPending')}
                              </Button>
                            ) : (
                            <Button
                              size={isMobile ? 'md' : 'sm'}
                              variant={item.paid ? 'ghost' : 'secondary'}
                              icon={actionLabel.icon(item)}
                              onClick={() => handleSettleItem(item, p)}
                              style={isMobile ? { minHeight: 44 } : undefined}
                            >
                              {t(item.paid
                                ? (item.isRefund ? 'debts.paidRefund' : 'debts.paidCollect')
                                : (item.isRefund ? 'debts.doRefund' : 'debts.doCollect'))}
                            </Button>
                            )
                          ) : (
                            <Button
                              size={isMobile ? 'md' : 'sm'}
                              variant={item.paid ? 'ghost' : 'secondary'}
                              icon={actionLabel.icon(item)}
                              onClick={() => toast(t('common.unauthorized'))}
                              style={isMobile ? { minHeight: 44 } : undefined}
                            >
                              {t(item.paid
                                ? (item.isRefund ? 'debts.paidRefund' : 'debts.paidCollect')
                                : (item.isRefund ? 'debts.doRefund' : 'debts.doCollect'))}
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {p.hasUnpaid && (
                  <Button
                    size={isMobile ? 'md' : 'sm'}
                    variant="primary"
                    icon={p.unpaidRefund > 0 && p.unpaidDue === 0 ? 'send' : 'circle-check'}
                    onClick={() => {
                      if (!canMoney) {
                        toast(t('common.unauthorized'))
                        return
                      }
                      handleSettleAll(p)
                    }}
                    style={{ width: '100%', minHeight: isMobile ? 48 : undefined, marginTop: 'auto' }}
                  >
                    {t(p.unpaidRefund > 0 && p.unpaidDue === 0 ? 'debts.refundAll' : 'debts.collectAll')}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modalsNode}
    </Card>
  )
}

/* ---------------- THÀNH VIÊN ỨNG TIỀN (QUỸ NỢ) ---------------- */

/* ---------------- Chờ duyệt ---------------- */

/**
 * Việc cần làm NGAY: ai đã báo chuyển tiền và đang chờ xác nhận.
 *
 * Tách khỏi hai bảng công nợ vì đây là câu hỏi khác — "ai đang chờ tôi", không phải "ai còn
 * nợ". Danh sách nợ dài hàng chục dòng, khoản chờ duyệt thì vài cái và gấp; trộn vào nhau là
 * bỏ sót. Duyệt / từ chối CHỈ ở đây: một khoản có hai đường xử lý là hai chỗ phải sửa khi
 * luật đổi, và là hai chỗ để lệch nhau.
 *
 * Duyệt = gọi ĐÚNG action tick đang có của từng loại. Không có đường ghi tiền mới nào.
 */
function PendingClaims({ groups }) {
  const { db, a } = useApp()

  const approve = (x) => {
    if (x.kind === 'dues') return a.payDue(x.id, undefined)
    if (x.kind === 'guest') return a.toggleGuestPaid(x.id)
    // `settleAdjust` khoá theo `key` ghép, không phải id — tra ngược lại từ bảng đối chiếu.
    const row = adjustRows(db, db.month).find((r) => r.id === x.id)
    if (row) a.settleAdjust(row.key)
  }

  if (!groups.length) {
    return (
      <Card padding="0">
        <Empty icon="circle-check" title={t('debts.pendingEmpty')} hint={t('debts.pendingEmptyHint')} />
      </Card>
    )
  }

  return (
    <Card
      title={t('debts.pendingTitle')}
      subtitle={t('debts.pendingSub')}
      icon="clock-alert"
      padding="14px 16px"
    >
      <div style={{ display: 'grid', gap: 12 }}>
        {groups.map((g) => (
          <div key={g.memberId} style={{
            border: '1px solid var(--border-subtle)', borderRadius: 10,
            padding: 12, display: 'grid', gap: 8, background: 'var(--surface-card)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Avatar name={g.name} src={g.avatarUrl} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.label}>{g.name}</div>
                <div style={S.caption}>{t('debts.pendingCount', { n: g.items.length })}</div>
              </div>
              <Mono weight={700} size={14} color="var(--status-scheduled)">{fmt(g.total)}</Mono>
              <Button
                size="sm" variant="primary" icon="circle-check"
                onClick={() => g.items.forEach(approve)}
              >
                {t('debts.approveAll')}
              </Button>
            </div>

            {g.items.map((x) => (
              <div key={x.key} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                borderRadius: 8, background: 'var(--surface-inset)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.label}>{x.label}</div>
                  <div style={S.caption}>
                    {ddmy(x.date)}{x.sub ? ' · ' + x.sub : ''}
                    {x.claimedAt ? ' · ' + t('debts.claimedOn', { date: ddmy(String(x.claimedAt).slice(0, 10)) }) : ''}
                  </div>
                </div>
                <Mono weight={600}>{fmt(x.amount)}</Mono>
                <IconButton
                  icon="circle-x" size="sm" variant="ghost"
                  label={t('debts.rejectClaim')}
                  onClick={() => a.rejectClaim({ kind: x.kind, id: x.id })}
                />
                <Button size="sm" variant="secondary" icon="circle-check" onClick={() => approve(x)}>
                  {t('debts.approveClaim')}
                </Button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  )
}

function Advances({ rows, canMoney }) {
  const { db, a, toast } = useApp()
  const isMobile = useMobile()
  const [refundTarget, setRefundTarget] = useState(null)
  const owing = rows.filter((r) => !r.repaidAt)
  const total = owing.reduce((x, r) => x + r.amount, 0)

  if (isMobile) {
    const prevMonthNum = (parseInt(db.month.slice(5, 7), 10) - 1 || 12).toString().padStart(2, '0')

    return (
      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <RefundConfirm target={refundTarget} onClose={() => setRefundTarget(null)} />
        {owing.length === 0 ? (
          <Empty icon="circle-check" title={t('debts.noAdvance')} hint={t('debts.noAdvanceHint')} />
        ) : (
          owing.map((r) => (
            <div
              key={r.kind + r.id}
              style={{
                background: '#141D2E', border: '1px solid #22304A', borderRadius: 10,
                boxShadow: '0 1px 1px rgba(0,0,0,.30)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ font: "600 16px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                    {t('debts.mobileAdvanceItemTitle', { name: r.name, label: r.label })}
                  </div>
                  <div style={{ font: "400 12px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                    {t('debts.mobileAdvanceItemSub', { date: ddmy(r.date), desc: r.sub || r.label })}
                  </div>
                </div>
                <div style={{ font: '700 22px/1 Barlow, sans-serif', color: '#FF9A8F' }}>
                  {fmt(r.amount)}
                </div>
              </div>
              <div style={{ font: "400 12px/1.45 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                {t('debts.mobileAdvanceDesc', {
                  date: ddmy(r.date),
                  cat: r.category || r.label,
                  name: r.name,
                })}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div
                  onClick={() => {
                    if (!canMoney) {
                      toast(t('common.unauthorized'))
                      return
                    }
                    setRefundTarget({
                      name: r.name, bankHolder: r.bankHolder, bankNo: r.bankNo, bankName: r.bankName,
                      amount: r.amount, run: () => a.repayAdvance(r.kind, r.id),
                    })
                  }}
                  style={{
                    flex: 1, textAlign: 'center', minHeight: 48, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', background: '#1D50A0', borderRadius: 6,
                    font: "600 15px/1 'IBM Plex Sans', sans-serif", color: '#FFFFFF', cursor: 'pointer',
                  }}
                >
                  {t('debts.mobileAdvanceRepayBtn', { amount: fmt(r.amount) })}
                </div>
                <div
                  onClick={() => {
                    setRefundTarget({
                      name: r.name, bankHolder: r.bankHolder, bankNo: r.bankNo, bankName: r.bankName,
                      amount: r.amount, run: () => a.repayAdvance(r.kind, r.id),
                    })
                  }}
                  style={{
                    minHeight: 48, padding: '0 16px', display: 'flex', alignItems: 'center',
                    background: '#1A2437', border: '1px solid #2E3E5C', borderRadius: 6,
                    font: "600 15px/1 'IBM Plex Sans', sans-serif", color: '#A8B7CB', cursor: 'pointer',
                  }}
                >
                  {t('debts.mobileQrBtn')}
                </div>
              </div>
            </div>
          ))
        )}

        <div style={{
          background: '#141D2E', border: '1px dashed #2E3E5C', borderRadius: 10, padding: 16,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ font: "600 15px/1.3 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
            {t('debts.mobileAdvanceAllDone', { month: prevMonthNum })}
          </div>
          <div style={{ font: "400 13px/1.45 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
            {t('debts.mobileAdvanceAllDoneSub')}
          </div>
        </div>
      </div>
    )
  }

  if (!rows.length) {
    return (
      <Card padding="0">
        <Empty icon="circle-check" title={t('debts.noAdvance')} hint={t('debts.noAdvanceHint')} />
      </Card>
    )
  }

  return (
    <Card
      title={t('debts.advanceTitle')}
      subtitle={t('debts.advanceSub')}
      icon="wallet"
      padding="14px 16px"
      actions={
        <span style={{
          font: '700 12.5px/1 var(--font-sans)',
          color: total > 0 ? 'var(--status-delayed-fg)' : 'var(--status-delivered-fg)',
          background: total > 0 ? 'var(--status-delayed-bg)' : 'var(--status-delivered-bg)',
          border: `1px solid ${total > 0 ? 'rgba(178,106,0,0.35)' : 'rgba(14,138,85,0.3)'}`,
          padding: '4px 10px',
          borderRadius: 6,
        }}>
          {t('debts.advanceTotal', { amount: fmt(total) })}
        </span>
      }
    >
      <div style={{ display: 'grid', gap: 10 }}>
        <Alert tone="info" title={t('debts.advanceAlertTitle')}>{t('debts.advanceAlert')}</Alert>
        <RefundConfirm target={refundTarget} onClose={() => setRefundTarget(null)} />
        {rows.map((r) => (
          <div key={r.kind + r.id} style={{ ...S.row, opacity: r.repaidAt ? 0.6 : 1 }}>
            <Avatar name={r.name} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.label}>{r.name}</div>
              <div style={S.caption}>
                {t('debts.advanceMeta', { what: r.label, date: ddmy(r.date) })}
                {r.repaidAt ? ' · ' + t('debts.advanceRepaidAt', { date: ddmy(r.repaidAt) }) : ''}
              </div>
            </div>
            <Mono weight={600} size={14}
              color={r.repaidAt ? 'var(--text-muted)' : 'var(--status-delayed)'}>{fmt(r.amount)}</Mono>
            {canMoney && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Button size="sm" variant={r.repaidAt ? 'ghost' : 'secondary'}
                  icon={r.repaidAt ? 'rotate-ccw' : 'circle-check'}
                  onClick={() => {
                    if (r.repaidAt) return a.repayAdvance(r.id)
                    const mb = memberOf(db, r.memberId)
                    return setRefundTarget({
                      name: r.name,
                      bankHolder: mb.bankHolder, bankNo: mb.bankNo, bankName: mb.bankName,
                      amount: r.amount,
                      run: () => a.repayAdvance(r.id),
                    })
                  }}>
                  {r.repaidAt ? t('debts.advanceUndo') : t('debts.advanceRepay')}
                </Button>
                <IconButton
                  size="sm"
                  icon="trash-2"
                  variant="ghost"
                  label={t('debts.del')}
                  onClick={() => a.confirm({
                    title: t('debts.delTitle'),
                    message: t('debts.delMsg', { what: r.name + ' · ' + fmt(r.amount) }),
                    desc: t('debts.delDesc'),
                    tone: 'danger',
                    confirmText: t('debts.delOk'),
                    onConfirm: () => a.deleteAdvance(r.id),
                  })}
                  style={{ color: 'var(--status-incident)' }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

/* ---------------- QUỸ THÁNG (TABLE & GRID) ---------------- */

function Dues({ dues, canMoney }) {
  const { db, ui, a, toast } = useApp()
  const isMobile = useMobile()
  // Thành viên thường không có canMoney nên mọi nút thu đều ẩn. Ngoại lệ duy nhất: khoản quỹ
  // tháng của CHÍNH HỌ — bấm để tự khai đã chuyển, không phải để tick đã thu.
  const me = myMember(db)
  const [payMine, setPayMine] = useState(null)
  const [refundTarget, setRefundTarget] = useState(null)
  const [selectedGroup, setSelectedGroup] = useState('ALL')
  const [viewMode, setViewMode] = useState('table') // 'table' | 'grid'
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('') // '' | 'unpaid' | 'paid'
  const [sortKey, setSortKey] = useState('remain-desc')
  const effectiveViewMode = isMobile ? 'grid' : viewMode

  const missing = duesTotal(dues).remain

  // Lọc và sắp xếp
  const filteredDues = dues.filter((d) => {
    // 1. Nhóm ca
    if (selectedGroup !== 'ALL' && d.groupId !== selectedGroup) return false

    const st = dueState(d)
    // 2. Trạng thái đóng
    if (statusFilter === 'unpaid' && st.remain === 0) return false
    if (statusFilter === 'paid' && st.remain > 0) return false

    // 3. Tìm kiếm
    if (search.trim()) {
      const q = norm(search)
      const mb = memberOf(db, d.memberId)
      const matchName = norm(mb.name).includes(q)
      const matchPhone = norm(mb.phone).includes(q)
      const matchGroup = norm(groupOf(db, d.groupId)?.name).includes(q)
      if (!matchName && !matchPhone && !matchGroup) return false
    }

    return true
  }).sort((a, b) => {
    const sta = dueState(a)
    const stb = dueState(b)
    const ma = memberOf(db, a.memberId).name
    const mb = memberOf(db, b.memberId).name

    if (sortKey === 'name-asc') return ma.localeCompare(mb, 'vi')
    if (sortKey === 'name-desc') return mb.localeCompare(ma, 'vi')
    if (sortKey === 'remain-asc') return sta.remain - stb.remain
    if (sortKey === 'paid-desc') return stb.paid - sta.paid
    if (sortKey === 'amount-desc') return stb.amount - sta.amount
    // remain-desc (mặc định: ai còn thiếu nhiều nhất lên đầu)
    if (stb.remain !== sta.remain) return stb.remain - sta.remain
    return ma.localeCompare(mb, 'vi')
  })

  if (isMobile) {
    const collectedCount = filteredDues.filter((d) => dueState(d).state === 'full').length
    const totalCount = filteredDues.length
    const collectedAmount = filteredDues.reduce((sum, d) => sum + dueState(d).paid, 0)
    const totalAmount = filteredDues.reduce((sum, d) => sum + dueState(d).amount, 0)
    const remainTotal = totalAmount - collectedAmount
    const unpaidCount = filteredDues.filter((d) => dueState(d).remain > 0).length
    const pct = totalAmount > 0 ? Math.min(100, Math.round((collectedAmount / totalAmount) * 100)) : 0
    const selectedGroupObj = db.groups.find((g) => g.id === selectedGroup)
    const groupName = selectedGroupObj?.name || (db.groups[0]?.name || t('debts.allGroups'))
    const groupPrice = selectedGroupObj?.price || (db.groups[0]?.price || 0)
    const groupSessions = monthSessions(db, db.month).filter((s) => selectedGroup === 'ALL' || s.groupId === selectedGroup).length || 4

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Group chips */}
        <div style={{ padding: '0 14px', overflowX: 'auto', display: 'flex', gap: 8, paddingBottom: 4 }}>
          {[{ value: 'ALL', label: t('debts.allGroups') }].concat(
            db.groups.map((g) => ({ value: g.id, label: g.name }))
          ).map((g) => {
            const active = selectedGroup === g.value
            return (
              <div
                key={g.value}
                onClick={() => setSelectedGroup(g.value)}
                style={{
                  whiteSpace: 'nowrap', padding: '7px 12px', borderRadius: 999, cursor: 'pointer',
                  background: active ? '#1D50A0' : '#1A2437', border: `1px solid ${active ? '#1D50A0' : '#2E3E5C'}`,
                  color: active ? '#FFFFFF' : '#A8B7CB', font: "600 12px/1 'IBM Plex Sans', sans-serif",
                }}
              >
                {g.label}
              </div>
            )
          })}
        </div>

        {/* Progress Card */}
        <div style={{ padding: '0 14px' }}>
          <div style={{
            background: '#141D2E', border: '1px solid #22304A', borderRadius: 10,
            boxShadow: '0 1px 1px rgba(0,0,0,.30)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8494AA' }}>
                {t('debts.mobileDuesProgress', { collected: collectedCount, total: totalCount })}
              </div>
              <div style={{ font: "600 15px/1 'IBM Plex Mono', monospace", color: '#5FD9A2' }}>
                {fmt(collectedAmount)}
              </div>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: '#101927', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: '#00B2A9', transition: 'width 0.3s ease' }} />
            </div>
            <div style={{ font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
              {t('debts.mobileDuesRemainDesc', {
                n: unpaidCount,
                amount: fmt(remainTotal),
                group: groupName,
                price: fmt(groupPrice),
                sessions: groupSessions,
              })}
            </div>
          </div>
        </div>

        {/* Member cards list */}
        <div style={{ padding: '0 14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredDues.length === 0 ? (
            <Empty icon="banknote" title={t('debts.duesEmpty')} hint={t('debts.duesEmptyHint')} />
          ) : (
            filteredDues.map((x) => {
              const st = dueState(x)
              const mb = memberOf(db, x.memberId)

              if (st.state === 'partial') {
                return (
                  <div
                    key={x.id}
                    style={{
                      background: '#141D2E', border: '1px solid #22304A', borderRadius: 10,
                      boxShadow: '0 1px 1px rgba(0,0,0,.30)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ font: "600 16px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>{mb.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ font: "600 10px/1 'IBM Plex Sans', sans-serif", color: '#5FD9A2', background: 'rgba(18,168,103,.18)', padding: '5px 8px', borderRadius: 999 }}>
                            {mb.level}
                          </span>
                          <span style={{ font: "400 12px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                            {mb.phone || t('common.unknown')}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <div style={{ font: '700 22px/1 Barlow, sans-serif', color: '#F0B75C' }}>
                          {t('debts.mobileRemainVal', { amount: fmt(st.remain) })}
                        </div>
                        <div style={{ font: "400 11px/1.2 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                          {t('debts.mobilePaidFraction', { paid: fmt(st.paid), amount: fmt(st.amount) })}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div
                        onClick={() => {
                          if (!canMoney) {
                            if (me && x.memberId === me.id) {
                              setPayMine([{ kind: 'dues', id: x.id, amount: st.remain }])
                            } else {
                              toast(t('common.unauthorized'))
                            }
                            return
                          }
                          a.payDue(x.id, st.remain)
                        }}
                        style={{
                          flex: 1, textAlign: 'center', minHeight: 48, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', background: '#1D50A0', borderRadius: 6,
                          font: "600 15px/1 'IBM Plex Sans', sans-serif", color: '#FFFFFF', cursor: 'pointer',
                        }}
                      >
                        {t('debts.mobileCollectRest', { amount: fmt(st.remain) })}
                      </div>
                      <div
                        onClick={() => {
                          if (!canMoney) {
                            toast(t('common.unauthorized'))
                            return
                          }
                          const val = window.prompt(t('debts.collectMoney'), String(st.remain))
                          if (val != null && val !== '') a.payDue(x.id, val)
                        }}
                        style={{
                          minHeight: 48, padding: '0 16px', display: 'flex', alignItems: 'center',
                          background: '#1A2437', border: '1px solid #2E3E5C', borderRadius: 6,
                          font: "600 15px/1 'IBM Plex Sans', sans-serif", color: '#A8B7CB', cursor: 'pointer',
                        }}
                      >
                        {t('debts.mobileEdit')}
                      </div>
                      {canMoney && st.paid > 0 && (
                        <div
                          onClick={() => a.clearDue(x.id)}
                          title={t('debts.undoMark')}
                          aria-label={t('debts.undoMark')}
                          style={{
                            minHeight: 48, width: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: '#1A2437', border: '1px solid #2E3E5C', borderRadius: 6,
                            color: '#8494AA', cursor: 'pointer',
                          }}
                        >
                          <Icon name="rotate-ccw" size={18} />
                        </div>
                      )}
                    </div>
                  </div>
                )
              }

              if (st.state === 'none') {
                return (
                  <div
                    key={x.id}
                    style={{
                      background: '#141D2E', border: '1px solid #22304A', borderRadius: 10,
                      boxShadow: '0 1px 1px rgba(0,0,0,.30)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ font: "600 16px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>{mb.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ font: "600 10px/1 'IBM Plex Sans', sans-serif", color: '#9FC0EA', background: 'rgba(60,116,196,.18)', padding: '5px 8px', borderRadius: 999 }}>
                            {mb.level}
                          </span>
                          <span style={{ font: "400 12px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                            {mb.phone || t('common.unknown')}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <div style={{ font: '700 22px/1 Barlow, sans-serif', color: '#F0B75C' }}>
                          {t('debts.mobileRemainVal', { amount: fmt(st.remain) })}
                        </div>
                        <div style={{ font: "400 11px/1.2 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                          {t('debts.mobileUnpaidNone')}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div
                        onClick={() => {
                          if (!canMoney) {
                            if (me && x.memberId === me.id) {
                              setPayMine([{ kind: 'dues', id: x.id, amount: st.remain }])
                            } else {
                              toast(t('common.unauthorized'))
                            }
                            return
                          }
                          a.payDue(x.id, st.remain)
                        }}
                        style={{
                          flex: 1, textAlign: 'center', minHeight: 48, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', background: '#1D50A0', borderRadius: 6,
                          font: "600 15px/1 'IBM Plex Sans', sans-serif", color: '#FFFFFF', cursor: 'pointer',
                        }}
                      >
                        {t('debts.mobileCollectBtn', { amount: fmt(st.remain) })}
                      </div>
                      <div
                        onClick={() => {
                          if (mb.bankName && mb.bankNo) {
                            setRefundTarget({
                              name: mb.name, bankHolder: mb.bankHolder || mb.name, bankNo: mb.bankNo,
                              bankName: mb.bankName, amount: st.remain,
                              run: () => a.payDue(x.id, st.remain),
                            })
                          } else {
                            toast(t('bank.noQrDesc'))
                          }
                        }}
                        style={{
                          minHeight: 48, padding: '0 16px', display: 'flex', alignItems: 'center',
                          background: '#1A2437', border: '1px solid #2E3E5C', borderRadius: 6,
                          font: "600 15px/1 'IBM Plex Sans', sans-serif", color: '#A8B7CB', cursor: 'pointer',
                        }}
                      >
                        {t('debts.mobileQrBtn')}
                      </div>
                    </div>
                  </div>
                )
              }

              // Full
              return (
                <div
                  key={x.id}
                  style={{
                    background: '#141D2E', border: '1px solid #22304A', borderRadius: 10,
                    padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, opacity: 0.85,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                    <div style={{ font: "600 16px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {mb.name}
                    </div>
                    <div style={{ font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                      {t('debts.mobilePaidOn', { date: ddmy(x.paidAt || db.today) })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{
                      font: "600 11px/1 'IBM Plex Sans', sans-serif", color: '#5FD9A2',
                      background: 'rgba(18,168,103,.18)', padding: '6px 10px', borderRadius: 999,
                    }}>
                      {t('debts.mobilePaidFullBadge', { amount: fmt(st.amount) })}
                    </span>
                    {canMoney && (
                      <div
                        onClick={() => a.clearDue(x.id)}
                        title={t('debts.undoMark')}
                        aria-label={t('debts.undoMark')}
                        style={{
                          minHeight: 36, minWidth: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: '#1A2437', border: '1px solid #2E3E5C', borderRadius: 6,
                          color: '#A8B7CB', cursor: 'pointer',
                        }}
                      >
                        <Icon name="rotate-ccw" size={16} />
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {payMine && <PayDebtsDialog items={payMine} onClose={() => setPayMine(null)} />}
        <RefundConfirm target={refundTarget} onClose={() => setRefundTarget(null)} />
      </div>
    )
  }

  return (
    <Card
      title={t('debts.duesTitle')}
      subtitle={t('debts.duesSub')}
      icon="banknote"
      padding="0"
      actions={
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Tabs
            variant="segmented"
            items={[{ value: 'ALL', label: t('debts.allGroups') }].concat(
              db.groups.map((g) => ({ value: g.id, label: g.name }))
            )}
            value={selectedGroup}
            onChange={(v) => setSelectedGroup(v)}
          />

          {!isMobile && (
            <div style={S.viewSwitcher}>
              <IconButton
                icon="list"
                size="sm"
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                label={t('debts.viewTable')}
                onClick={() => setViewMode('table')}
              />
              <IconButton
                icon="layout-grid"
                size="sm"
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                label={t('debts.viewGrid')}
                onClick={() => setViewMode('grid')}
              />
            </div>
          )}

          <span style={{
            font: '700 12.5px/1 var(--font-sans)',
            color: missing ? 'var(--status-delayed-fg)' : 'var(--status-delivered-fg)',
            background: missing ? 'var(--status-delayed-bg)' : 'var(--status-delivered-bg)',
            border: `1px solid ${missing ? 'rgba(178,106,0,0.35)' : 'rgba(14,138,85,0.3)'}`,
            padding: '4px 10px',
            borderRadius: 6,
          }}>
            {missing ? t('debts.totalDues', { amount: fmt(missing) }) : t('common.enough')}
          </span>
        </div>
      }
    >
      {/* Thanh tìm kiếm và sắp xếp */}
      <div style={S.fltBar}>
        <SearchField
          width={250}
          style={{ height: 32 }}
          placeholder={t('debts.searchMember')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
        <Select
          size="sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: '', label: t('debts.dueAll') },
            { value: 'unpaid', label: t('debts.dueShort') },
            { value: 'paid', label: t('debts.dueFull') },
          ]}
        />
        <Select
          size="sm"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
          options={[
            { value: 'remain-desc', label: t('debts.sortRemainDesc') },
            { value: 'remain-asc', label: t('debts.sortRemainAsc') },
            { value: 'name-asc', label: t('debts.sortNameAsc') },
            { value: 'name-desc', label: t('debts.sortNameDesc') },
            { value: 'paid-desc', label: t('debts.sortPaidDesc') },
            { value: 'amount-desc', label: t('debts.sortAmountDesc') },
          ]}
        />
      </div>
      {filteredDues.length === 0 ? (
        <Empty icon="banknote" title={t('debts.duesEmpty')} hint={t('debts.duesEmptyHint')} />
      ) : effectiveViewMode === 'table' ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', font: 'var(--type-label)' }}>
            <thead>
              <tr style={S.subTableHead}>
                <th style={S.th}>{t('debts.colMember')}</th>
                <th style={S.th}>{t('debts.colGroup')}</th>
                <th style={{ ...S.th, textAlign: 'right' }}>{t('debts.colDue')}</th>
                <th style={{ ...S.th, textAlign: 'right' }}>{t('debts.colPaid')}</th>
                <th style={{ ...S.th, textAlign: 'right' }}>{t('debts.colRemain')}</th>
                <th style={{ ...S.th, textAlign: 'center' }}>{t('debts.colState')}</th>
                <th style={{ ...S.th, textAlign: 'right' }}>{t('debts.colAction')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredDues.map((x) => {
                const st = dueState(x)
                const mb = memberOf(db, x.memberId)
                const group = groupOf(db, x.groupId)
                const key = 'due_' + x.id

                return (
                  <tr key={x.id} style={{ borderBottom: '1px solid var(--border-subtle)', background: st.remain > 0 ? 'var(--surface-card)' : 'transparent' }}>
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <Avatar name={mb.name} size={28} />
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{mb.name}</div>
                          <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
                            {genderTxt(mb.gender)} · {mb.level}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={S.td}>
                      <span style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {group?.name || ''}
                      </span>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right' }}>
                      <Mono>{fmt(st.amount)}</Mono>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right' }}>
                      <Mono color={st.paid > 0 ? 'var(--status-delivered)' : 'var(--text-muted)'}>
                        {fmt(st.paid)}
                      </Mono>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right' }}>
                      <Mono color={st.remain > 0 ? 'var(--status-delayed)' : 'var(--text-muted)'} weight={st.remain > 0 ? 600 : 400}>
                        {fmt(st.remain)}
                      </Mono>
                    </td>
                    <td style={{ ...S.td, textAlign: 'center' }}>
                      <span style={dueWaiting(x, st) ? S.pillWait
                        : st.state === 'full' ? S.pillPaid : st.state === 'partial' ? S.pillPartial : S.pillUnpaid}>
                        {dueWaiting(x, st) ? t('debts.waitApprove')
                          : t(st.state === 'full' ? 'debts.stFull' : st.state === 'partial' ? 'debts.stPartial' : 'debts.stNone')}
                      </span>
                    </td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        {canMoney && st.remain > 0 && (
                          dueWaiting(x, st) ? (
                            <Button size="sm" variant="ghost" icon="arrow-right"
                              onClick={() => a.setTab('debts', 'pending')}>
                              {t('debts.goPending')}
                            </Button>
                          ) : (
                            <>
                            <Input
                              size="sm"
                              mono
                              style={{ width: 100, textAlign: 'right' }}
                              value={ui.form[key] ?? String(st.remain)}
                              onChange={(e) => a.setF(key, e.target.value)}
                              suffix={t('units.dong')}
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              icon="hand-coins"
                              onClick={() => { a.payDue(x.id, ui.form[key]); a.setF(key, undefined) }}
                            >
                              {t('debts.collectMoney')}
                            </Button>
                            </>
                          )
                        )}
                        {!canMoney && me && x.memberId === me.id && st.remain > 0 && !x.claimedAt && (
                          <Button
                            variant="primary"
                            size="sm"
                            icon="banknote"
                            onClick={() => setPayMine([{ kind: 'dues', id: x.id, amount: st.remain }])}
                          >
                            {t('debts.payMine', { amount: fmt(st.remain) })}
                          </Button>
                        )}
                        {!canMoney && (!me || x.memberId !== me.id) && st.remain > 0 && (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon="hand-coins"
                            onClick={() => toast(t('common.unauthorized'))}
                          >
                            {t('debts.collectMoney')}
                          </Button>
                        )}
                        {canMoney && st.paid > 0 && (
                          <IconButton
                            icon="rotate-ccw"
                            size="sm"
                            variant="ghost"
                            label={t('debts.undoMark')}
                            onClick={() => a.clearDue(x.id)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={S.gridContainer}>
          {filteredDues.map((x) => {
            const st = dueState(x)
            const mb = memberOf(db, x.memberId)
            const group = groupOf(db, x.groupId)
            const key = 'due_' + x.id

            return (
              <div
                key={x.id}
                style={{
                  ...S.duesCard,
                  borderColor: st.remain > 0 ? 'var(--status-delayed)' : 'var(--border-subtle)',
                  background: st.remain > 0 ? 'var(--surface-card)' : 'var(--surface-card)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                    <Avatar name={mb.name} size={32} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ font: 'var(--type-label)', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {mb.name}
                      </div>
                      <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
                        {group?.name}
                      </div>
                    </div>
                  </div>

                  <span style={st.state === 'full' ? S.pillPaid : st.state === 'partial' ? S.pillPartial : S.pillUnpaid}>
                    {t(st.state === 'full' ? 'debts.stFullShort' : st.state === 'partial' ? 'debts.stPartialShort' : 'debts.stNoneShort')}
                  </span>
                </div>

                <div style={{ height: 1, background: 'var(--border-subtle)' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('debts.paidOverDue')}</span>
                  <Mono size={14} weight={600} color={st.state === 'full' ? 'var(--status-delivered)' : 'var(--text-primary)'}>
                    {fmtK(st.paid)} / {fmt(st.amount)}
                  </Mono>
                </div>

                {st.remain > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ font: 'var(--type-caption)', color: 'var(--status-delayed)' }}>{t('debts.remainLabel')}</span>
                    <Mono size={14} weight={700} color="var(--status-delayed)">
                      {fmt(st.remain)}
                    </Mono>
                  </div>
                )}

                <div style={{ marginTop: 'auto', paddingTop: 4 }}>
                  {canMoney && st.remain > 0 && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {dueWaiting(x, st) ? (
                        <Button size={isMobile ? 'md' : 'sm'} variant="ghost" icon="arrow-right"
                          onClick={() => a.setTab('debts', 'pending')}
                          style={isMobile ? { minHeight: 48, width: '100%' } : undefined}>
                          {t('debts.goPending')}
                        </Button>
                      ) : (
                        <>
                        <Input
                          size="sm"
                          mono
                          style={{ flex: 1, textAlign: 'right', ...(isMobile ? { height: 44 } : {}) }}
                          value={ui.form[key] ?? String(st.remain)}
                          onChange={(e) => a.setF(key, e.target.value)}
                          suffix={t('units.dong')}
                        />
                        <Button
                          variant="secondary"
                          size={isMobile ? 'md' : 'sm'}
                          icon="hand-coins"
                          onClick={() => { a.payDue(x.id, ui.form[key]); a.setF(key, undefined) }}
                          style={isMobile ? { minHeight: 48 } : undefined}
                        >
                          {t('debts.doCollect')}
                        </Button>
                      </>
                    )}
                    </div>
                  )}
                  {!canMoney && me && x.memberId === me.id && st.remain > 0 && !x.claimedAt && (
                    <Button
                      variant="primary"
                      size={isMobile ? 'md' : 'sm'}
                      icon="banknote"
                      onClick={() => setPayMine([{ kind: 'dues', id: x.id, amount: st.remain }])}
                      style={isMobile ? { minHeight: 48, width: '100%' } : undefined}
                    >
                      {t('debts.payMine', { amount: fmt(st.remain) })}
                    </Button>
                  )}
                  {!canMoney && (!me || x.memberId !== me.id) && st.remain > 0 && (
                    <Button
                      variant="secondary"
                      size={isMobile ? 'md' : 'sm'}
                      icon="hand-coins"
                      onClick={() => toast(t('common.unauthorized'))}
                      style={isMobile ? { minHeight: 48, width: '100%' } : undefined}
                    >
                      {t('debts.doCollect')}
                    </Button>
                  )}
                  {canMoney && st.paid > 0 && st.remain === 0 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="rotate-ccw"
                        onClick={() => a.clearDue(x.id)}
                      >
                        {t('debts.undoMark')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {payMine && (
        <PayDebtsDialog items={payMine} onClose={() => setPayMine(null)} />
      )}
    </Card>
  )
}

const S = {
  row: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '9px 11px',
    border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--surface-card)',
  },
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  tagMember: {
    font: '600 10px/1 var(--font-sans)', padding: '2px 7px', borderRadius: 99,
    background: 'var(--surface-accent-soft)', color: 'var(--teal-800)', border: '1px solid var(--teal-500)',
  },
  tagGuest: {
    font: '600 10px/1 var(--font-sans)', padding: '2px 7px', borderRadius: 99,
    background: 'var(--surface-inset)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)',
  },
  tagInviter: {
    font: '500 11px/1 var(--font-sans)', color: 'var(--text-muted)',
  },
  fltBar: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)',
    background: 'var(--surface-sunken)',
  },
  viewSwitcher: {
    display: 'flex', alignItems: 'center', gap: 2, background: 'var(--surface-sunken)',
    padding: 3, borderRadius: 8, border: '1px solid var(--border-subtle)',
  },
  subTableHead: {
    background: 'var(--surface-inset)', borderBottom: '1px solid var(--border-subtle)',
    color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  th: { padding: '8px 12px', textAlign: 'left', fontWeight: 600 },
  td: { padding: '10px 12px', verticalAlign: 'middle' },
  pillPaid: {
    padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
    background: 'var(--status-delivered-bg)', color: 'var(--status-delivered-fg)',
    display: 'inline-block', whiteSpace: 'nowrap',
  },
  pillUnpaid: {
    padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
    background: 'var(--status-delayed-bg)', color: 'var(--status-delayed-fg)',
    display: 'inline-block', whiteSpace: 'nowrap',
  },
  pillWait: {
    padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
    background: 'var(--status-scheduled-bg)', color: 'var(--status-scheduled-fg)',
    display: 'inline-block', whiteSpace: 'nowrap',
  },
  pillPartial: {
    padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
    background: 'var(--status-scheduled-bg)', color: 'var(--status-scheduled-fg)',
    display: 'inline-block', whiteSpace: 'nowrap',
  },
  gridContainer: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
    gap: 14, padding: 16,
  },
  personCard: {
    borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--surface-card)',
    padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
    boxShadow: 'var(--shadow-sm)',
  },
  gridSessionRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    padding: '8px 10px', borderRadius: 8, background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
  },
  duesCard: {
    borderRadius: 12, border: '1px solid', padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 10, boxShadow: 'var(--shadow-sm)',
  },
}
