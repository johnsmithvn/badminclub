// Công nợ: Thu / Hoàn theo buổi (Table & Grid) · Quỹ tháng (Table & Grid) · Quỹ nợ.

import { useState } from 'react'
import { Alert, Avatar, Button, Card, Dialog, Icon, IconButton, Input, SearchField, Select, Tabs } from '#ds'
import { Empty, GRID_PAIR, Mono, Overline, PayDebtsDialog, QrModal } from '#ui'
import { findBank, getVietQrUrl } from '#utils/vietqr.js'
import { useApp } from '#contexts/AppContext.jsx'
import { ddmy, monthOf, wd } from '#utils/dates.js'
import {
  adjustRows, advanceRows, clubDebtCounts, courtTxt, dueState, duesOf, duesTotal, fmt, fmtK,
  genderTxt, groupOf, guestOf, intOf, memberOf, monthSessions, myDebtCounts, myMember, pendingClaims,
  sessionOf, timeTxt,
} from '#lib/money.js'
import { can } from '#lib/roles.js'
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

  return (
    <>
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

function SessionDebts({ canMoney }) {
  const { db, a } = useApp()
  const [expanded, setExpanded] = useState({})
  const [editingPrices, setEditingPrices] = useState({})
  const [filter, setFilter] = useState('unpaid')
  const [viewMode, setViewMode] = useState('table') // 'table' | 'grid'
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('unpaid-desc')
  const [typeFilter, setTypeFilter] = useState('') // '' | 'member' | 'guest'
  const [confirmCollect, setConfirmCollect] = useState(null)
  const [qrTarget, setQrTarget] = useState(null)
  const [payMine, setPayMine] = useState(null)
  const [refundTarget, setRefundTarget] = useState(null)
  const me = myMember(db)

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
      <div style={S.fltBar}>
        <SearchField
          width={250}
          style={{ height: 32 }}
          placeholder={t('debts.searchSession')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
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
      </div>

      {filteredPeople.length === 0 ? (
        <Empty icon="circle-check" title={t('debts.sEmpty')} hint={t('debts.sEmptyHint')} />
      ) : viewMode === 'table' ? (
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
                            style={{ width: 95, textAlign: 'right' }}
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
                              size="sm"
                              variant={item.paid ? 'ghost' : 'secondary'}
                              icon={actionLabel.icon(item)}
                              onClick={() => handleSettleItem(item, p)}
                            >
                              {t(item.paid
                                ? (item.isRefund ? 'debts.paidRefund' : 'debts.paidCollect')
                                : (item.isRefund ? 'debts.doRefund' : 'debts.doCollect'))}
                            </Button>
                            )
                          ) : (
                            <span style={stateStyle(item)}>
                              {stateLabel(item)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {canMoney && p.hasUnpaid && (
                  <Button
                    size="sm"
                    variant="primary"
                    icon={p.unpaidRefund > 0 && p.unpaidDue === 0 ? 'send' : 'circle-check'}
                    onClick={() => handleSettleAll(p)}
                    style={{ width: '100%', marginTop: 'auto' }}
                  >
                    {t(p.unpaidRefund > 0 && p.unpaidDue === 0 ? 'debts.refundAll' : 'debts.collectAll')}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Dialog xác nhận thu nợ / hoàn tiền */}
      {confirmCollect && (
        <Dialog
          open
          onClose={() => setConfirmCollect(null)}
          title={t('debts.collectDebtConfirmTitle')}
          footer={
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
              <Button variant="secondary" onClick={() => setConfirmCollect(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="accent"
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
        <PayDebtsDialog items={payMine} memo={me.name} onClose={() => setPayMine(null)} />
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
  const { db, a } = useApp()
  const [refundTarget, setRefundTarget] = useState(null)
  const owing = rows.filter((r) => !r.repaidAt)
  const total = owing.reduce((x, r) => x + r.amount, 0)

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
                    if (r.repaidAt) return a.repayAdvance(r.kind, r.id)
                    const mb = memberOf(db, r.memberId)
                    return setRefundTarget({
                      name: r.name,
                      bankHolder: mb.bankHolder, bankNo: mb.bankNo, bankName: mb.bankName,
                      amount: r.amount,
                      run: () => a.repayAdvance(r.kind, r.id),
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
                    onConfirm: () => a.deleteAdvance(r.kind, r.id),
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
  const { db, ui, a } = useApp()
  // Thành viên thường không có canMoney nên mọi nút thu đều ẩn. Ngoại lệ duy nhất: khoản quỹ
  // tháng của CHÍNH HỌ — bấm để tự khai đã chuyển, không phải để tick đã thu.
  const me = myMember(db)
  const [payMine, setPayMine] = useState(null)
  const [selectedGroup, setSelectedGroup] = useState('ALL')
  const [viewMode, setViewMode] = useState('table') // 'table' | 'grid'
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('') // '' | 'unpaid' | 'paid'
  const [sortKey, setSortKey] = useState('remain-desc')

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
      ) : viewMode === 'table' ? (
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
                        {canMoney && st.paid > 0 && (
                          <IconButton
                            icon="rotate-ccw"
                            size="sm"
                            variant="ghost"
                            label={t('debts.dueClear')}
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
                        <Button size="sm" variant="ghost" icon="arrow-right"
                          onClick={() => a.setTab('debts', 'pending')}>
                          {t('debts.goPending')}
                        </Button>
                      ) : (
                        <>
                        <Input
                          size="sm"
                          mono
                          style={{ flex: 1, textAlign: 'right' }}
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
                          {t('debts.doCollect')}
                        </Button>
                      </>
                    )}
                    </div>
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
        <PayDebtsDialog items={payMine} memo={me.name} onClose={() => setPayMine(null)} />
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
