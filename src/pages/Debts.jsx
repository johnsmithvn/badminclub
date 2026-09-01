// Công nợ: Thu / Hoàn theo buổi (Table & Grid) · Quỹ tháng (Table & Grid) · Quỹ nợ.

import { useState } from 'react'
import { Alert, Avatar, Button, Card, Icon, IconButton, Input, SearchField, Select, Tabs } from '#ds'
import { Empty, GRID_PAIR, Mono, Overline } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { ddmy, monthOf, monthTxt, wd } from '#utils/dates.js'
import {
  adjustRows, advanceRows, courtTxt, dueState, duesOf, duesTotal, fmt, fmtK,
  genderTxt, groupOf, guestOf, intOf, memberOf, monthSessions, sessionOf, timeTxt,
} from '#lib/money.js'
import { can } from '#lib/roles.js'
import { t } from '#i18n'

const norm = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim()

export default function Debts() {
  const { db, ui, a } = useApp()
  const rawTab = ui.tab.debts || 'sessions'
  const tab = rawTab === 'guest' || rawTab === 'back' ? 'sessions' : rawTab
  const canMoney = can(db.viewAs || 'owner', 'money')

  const dues = duesOf(db, db.month)
  const advances = advanceRows(db)

  // Đếm số người / lượt chưa thanh toán của tab theo buổi
  const unpaidGuests = (db.sessionGuests || []).filter((sg) => {
    const s = sessionOf(db, sg.sessionId)
    return s && monthOf(s.date) === db.month && !sg.paid
  }).length

  const unpaidAdjusts = adjustRows(db, db.month).filter((r) => !r.paid).length
  const totalSessionPending = unpaidGuests + unpaidAdjusts

  return (
    <>
      <Tabs
        variant="underline"
        items={[
          { value: 'sessions', label: 'Thu / Hoàn theo buổi', count: totalSessionPending },
          { value: 'dues', label: t('debts.tabDues'), count: dues.filter((x) => dueState(x).remain > 0).length },
          { value: 'advance', label: t('debts.tabAdvance'), count: advances.filter((x) => !x.repaidAt).length },
        ]}
        value={tab}
        onChange={(v) => a.setTab('debts', v)}
      />
      {tab === 'sessions' && <SessionDebts canMoney={canMoney} />}
      {tab === 'dues' && <Dues dues={dues} canMoney={canMoney} />}
      {tab === 'advance' && <Advances rows={advances} canMoney={canMoney} />}
    </>
  )
}

/* ---------------- THU / HOÀN THEO BUỔI (TABLE & GRID) ---------------- */

function SessionDebts({ canMoney }) {
  const { db, a } = useApp()
  const [expanded, setExpanded] = useState({})
  const [editingPrices, setEditingPrices] = useState({})
  const [filter, setFilter] = useState('unpaid')
  const [viewMode, setViewMode] = useState('table') // 'table' | 'grid'
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('unpaid-desc')
  const [typeFilter, setTypeFilter] = useState('') // '' | 'member' | 'guest'

  // Map người chơi
  const peopleMap = {}

  // 1. Khách giao lưu & thành viên đi buổi đột xuất (sessionGuests)
  ;(db.sessionGuests || []).forEach((sg) => {
    const s = sessionOf(db, sg.sessionId)
    if (!s || monthOf(s.date) !== db.month) return
    const isMember = !!sg.memberId
    const personId = sg.memberId || sg.guestId
    if (!personId) return

    const who = isMember ? memberOf(db, personId) : guestOf(db, personId)
    if (!peopleMap[personId]) {
      peopleMap[personId] = {
        id: personId,
        name: who.name || 'Khách',
        gender: who.gender || sg.gender,
        level: who.level || sg.level,
        isMember,
        invitedBy: sg.invitedBy || who.invitedBy || '',
        items: [],
      }
    }

    const group = groupOf(db, s.groupId)
    peopleMap[personId].items.push({
      key: `sg:${sg.id}`,
      sgId: sg.id,
      type: 'guest',
      typeLabel: isMember ? 'Đi buổi đột xuất' : 'Khách giao lưu',
      isRefund: false,
      date: s.date,
      sessionId: s.id,
      timeVenue: `${timeTxt(s)} · ${courtTxt(db, s)}`,
      groupName: group?.name || 'Buổi đột xuất',
      price: sg.price,
      paid: !!sg.paid,
      canEdit: !sg.paid,
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
          typeLabel: r.kind === 'absent_back' ? 'Vắng ca cố định' : 'Đi thêm ca cố định',
          isRefund,
          date: s.date,
          sessionId: s.id,
          timeVenue: `${timeTxt(s)} · ${courtTxt(db, s)}`,
          groupName: r.group?.name || '',
          price: unitPrice,
          paid: !!r.paid,
          settle: r.settle,
          canEdit: !r.paid,
        })
      })
    } else {
      peopleMap[memberId].items.push({
        key: `adj:${r.key}`,
        adjustKey: r.key,
        type: r.kind,
        typeLabel: r.kind === 'absent_back' ? 'Vắng buổi' : 'Đi thêm buổi',
        isRefund,
        date: db.today,
        sessionId: null,
        timeVenue: r.group?.name || '',
        groupName: r.group?.name || '',
        price: Math.abs(r.amount),
        paid: !!r.paid,
        settle: r.settle,
        canEdit: !r.paid,
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

  const handleSettleItem = (item) => {
    if (item.type === 'guest') {
      a.toggleGuestPaid(item.sgId)
    } else if (item.adjustKey) {
      a.settleAdjust(item.adjustKey)
    }
  }

  const handleSettleAll = (person) => {
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
      title="Công nợ theo buổi"
      subtitle="Gộp khách ngoài, hội viên đi thêm và hoàn tiền vắng — có thể xem dạng Bảng hoặc Lưới ô vuông"
      icon="receipt"
      padding="0"
      actions={
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Lọc trạng thái */}
          <Tabs
            variant="segmented"
            items={[
              { value: 'unpaid', label: 'Chưa thu / trả' },
              { value: 'all', label: 'Tất cả' },
              { value: 'paid', label: 'Đã xong' },
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
              label="Dạng Bảng"
              onClick={() => setViewMode('table')}
            />
            <IconButton
              icon="layout-grid"
              size="sm"
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              label="Dạng Lưới Thẻ"
              onClick={() => setViewMode('grid')}
            />
          </div>

          {/* Tổng tiền */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Mono weight={600} color="var(--status-delivered)">
              Quỹ cần thu: {fmt(totalDue)}
            </Mono>
            <Mono weight={600} color="var(--status-incident)">
              Quỹ cần trả: {fmt(totalRefund)}
            </Mono>
          </div>
        </div>
      }
    >
      {/* Thanh tìm kiếm và sắp xếp */}
      <div style={S.fltBar}>
        <SearchField
          width={250}
          style={{ height: 32 }}
          placeholder="Tìm theo tên người, người rủ, ca..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
        <Select
          size="sm"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          options={[
            { value: '', label: 'Tất cả đối tượng' },
            { value: 'member', label: 'Chỉ hội viên' },
            { value: 'guest', label: 'Chỉ khách ngoài' },
          ]}
        />
        <Select
          size="sm"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
          options={[
            { value: 'unpaid-desc', label: 'Sắp xếp: Chưa thu / trả nhiều nhất' },
            { value: 'unpaid-asc', label: 'Sắp xếp: Chưa thu / trả ít nhất' },
            { value: 'name-asc', label: 'Sắp xếp: Tên A → Z' },
            { value: 'name-desc', label: 'Sắp xếp: Tên Z → A' },
            { value: 'count-desc', label: 'Sắp xếp: Số buổi nhiều nhất' },
          ]}
        />
      </div>

      {filteredPeople.length === 0 ? (
        <Empty icon="circle-check" title="Không có công nợ buổi nào" hint="Tất cả các buổi giao lưu, đi thêm và vắng mặt trong tháng đều đã được thanh toán xong." />
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
                      label={isExp ? 'Thu gọn' : 'Mở rộng'}
                      onClick={(e) => { e.stopPropagation(); toggleExpand(p.id) }}
                    />
                    <Avatar name={p.name} size={30} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ font: 'var(--type-label)', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {p.name}
                        </span>
                        <span style={p.isMember ? S.tagMember : S.tagGuest}>
                          {p.isMember ? 'Hội viên' : 'Khách ngoài'}
                        </span>
                        {inviter && (
                          <span style={S.tagInviter}>Rủ bởi {inviter}</span>
                        )}
                      </div>
                      <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', marginTop: 2 }}>
                        {p.totalCount} buổi ({p.unpaidCount > 0 ? `${p.unpaidCount} chưa thanh toán` : 'Đã xong'})
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ textAlign: 'right' }}>
                      {p.unpaidDue > 0 && (
                        <div style={{ font: 'var(--type-label)', fontWeight: 700, color: 'var(--status-delivered)' }}>
                          Thu: +{fmt(p.unpaidDue)}
                        </div>
                      )}
                      {p.unpaidRefund > 0 && (
                        <div style={{ font: 'var(--type-label)', fontWeight: 700, color: 'var(--status-incident)' }}>
                          Trả: −{fmt(p.unpaidRefund)}
                        </div>
                      )}
                      {!p.hasUnpaid && (
                        <div style={{ font: 'var(--type-caption)', fontWeight: 600, color: 'var(--status-delivered)' }}>
                          ✓ Đã xong
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
                        {p.unpaidRefund > 0 && p.unpaidDue === 0 ? 'Trả tất cả' : 'Thu tất cả'}
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
                            <th style={S.th}>Buổi tập & Sân</th>
                            <th style={S.th}>Phân loại</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>Số tiền (sửa được)</th>
                            <th style={{ ...S.th, textAlign: 'center' }}>Trạng thái</th>
                            <th style={{ ...S.th, textAlign: 'right' }}>Thao tác</th>
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
                                    disabled={!canMoney || item.paid}
                                    value={currentPrice}
                                    onChange={(e) => handlePriceChange(item.key, e.target.value)}
                                    onBlur={() => handlePriceBlur(item)}
                                    style={{ width: 105, textAlign: 'right', display: 'inline-block' }}
                                    suffix="đ"
                                  />
                                </td>
                                <td style={{ ...S.td, textAlign: 'center' }}>
                                  <span style={item.paid ? S.pillPaid : S.pillUnpaid}>
                                    {item.paid ? (item.isRefund ? 'Đã trả' : 'Đã thu') : (item.isRefund ? 'Chưa trả' : 'Chưa thu')}
                                  </span>
                                </td>
                                <td style={{ ...S.td, textAlign: 'right' }}>
                                  <Button
                                    size="sm"
                                    variant={item.paid ? 'ghost' : 'secondary'}
                                    disabled={!canMoney}
                                    icon={item.paid ? 'circle-check' : item.isRefund ? 'send' : 'hand-coins'}
                                    onClick={() => handleSettleItem(item)}
                                  >
                                    {item.paid
                                      ? (item.isRefund ? 'Đã trả' : 'Đã thu')
                                      : (item.isRefund ? 'Bấm để Trả' : 'Bấm để Thu')}
                                  </Button>
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
                    <Avatar name={p.name} size={34} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ font: 'var(--type-label)', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.name}
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
                        <span style={p.isMember ? S.tagMember : S.tagGuest}>
                          {p.isMember ? 'Hội viên' : 'Khách ngoài'}
                        </span>
                        {inviter && <span style={S.tagInviter}>{inviter} rủ</span>}
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
                        ✓ Đã xong
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
                            disabled={!canMoney || item.paid}
                            value={currentPrice}
                            onChange={(e) => handlePriceChange(item.key, e.target.value)}
                            onBlur={() => handlePriceBlur(item)}
                            style={{ width: 95, textAlign: 'right' }}
                            suffix="đ"
                          />
                          <Button
                            size="sm"
                            variant={item.paid ? 'ghost' : 'secondary'}
                            disabled={!canMoney}
                            icon={item.paid ? 'circle-check' : item.isRefund ? 'send' : 'hand-coins'}
                            onClick={() => handleSettleItem(item)}
                          >
                            {item.paid ? (item.isRefund ? 'Đã trả' : 'Đã thu') : (item.isRefund ? 'Trả' : 'Thu')}
                          </Button>
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
                    {p.unpaidRefund > 0 && p.unpaidDue === 0 ? 'Hoàn trả tất cả' : 'Thu tất cả'}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

/* ---------------- THÀNH VIÊN ỨNG TIỀN (QUỸ NỢ) ---------------- */

function Advances({ rows, canMoney }) {
  const { a } = useApp()
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
      actions={<Mono weight={600} color="var(--status-delayed)">{t('debts.advanceTotal', { amount: fmt(total) })}</Mono>}
    >
      <div style={{ display: 'grid', gap: 10 }}>
        <Alert tone="info" title={t('debts.advanceAlertTitle')}>{t('debts.advanceAlert')}</Alert>
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
              <Button size="sm" variant={r.repaidAt ? 'ghost' : 'secondary'}
                icon={r.repaidAt ? 'rotate-ccw' : 'circle-check'}
                onClick={() => a.repayAdvance(r.kind, r.id)}>
                {r.repaidAt ? t('debts.advanceUndo') : t('debts.advanceRepay')}
              </Button>
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
      subtitle="Thu quỹ tháng trọn gói của hội viên cố định — hỗ trợ xem dạng Bảng kế toán hoặc Lưới ô vuông"
      icon="banknote"
      padding="0"
      actions={
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Tabs
            variant="segmented"
            items={[{ value: 'ALL', label: 'Tất cả các ca' }].concat(
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
              label="Dạng Bảng"
              onClick={() => setViewMode('table')}
            />
            <IconButton
              icon="layout-grid"
              size="sm"
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              label="Dạng Lưới Thẻ"
              onClick={() => setViewMode('grid')}
            />
          </div>

          <Mono weight={600} color={missing ? 'var(--status-delayed)' : 'var(--status-delivered)'}>
            {missing ? t('debts.totalDues', { amount: fmt(missing) }) : t('common.enough')}
          </Mono>
        </div>
      }
    >
      {/* Thanh tìm kiếm và sắp xếp */}
      <div style={S.fltBar}>
        <SearchField
          width={250}
          style={{ height: 32 }}
          placeholder="Tìm theo tên thành viên, số điện thoại..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
        <Select
          size="sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: '', label: 'Tất cả trạng thái đóng' },
            { value: 'unpaid', label: 'Chỉ người còn thiếu' },
            { value: 'paid', label: 'Đã đóng đủ' },
          ]}
        />
        <Select
          size="sm"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
          options={[
            { value: 'remain-desc', label: 'Sắp xếp: Còn thiếu nhiều nhất' },
            { value: 'remain-asc', label: 'Sắp xếp: Còn thiếu ít nhất' },
            { value: 'name-asc', label: 'Sắp xếp: Tên A → Z' },
            { value: 'name-desc', label: 'Sắp xếp: Tên Z → A' },
            { value: 'paid-desc', label: 'Sắp xếp: Đã đóng nhiều nhất' },
            { value: 'amount-desc', label: 'Sắp xếp: Mức quỹ cao nhất' },
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
                <th style={S.th}>Thành viên</th>
                <th style={S.th}>Ca cố định</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Mức quỹ</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Đã đóng</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Còn thiếu</th>
                <th style={{ ...S.th, textAlign: 'center' }}>Trạng thái</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Thao tác</th>
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
                      <span style={st.state === 'full' ? S.pillPaid : st.state === 'partial' ? S.pillPartial : S.pillUnpaid}>
                        {st.state === 'full' ? '● Đã đóng đủ' : st.state === 'partial' ? '◐ Đóng một phần' : '▲ Chưa đóng'}
                      </span>
                    </td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        {canMoney && st.remain > 0 && (
                          <>
                            <Input
                              size="sm"
                              mono
                              style={{ width: 100, textAlign: 'right' }}
                              value={ui.form[key] ?? String(st.remain)}
                              onChange={(e) => a.setF(key, e.target.value)}
                              suffix="đ"
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              icon="hand-coins"
                              onClick={() => { a.payDue(x.id, ui.form[key]); a.setF(key, undefined) }}
                            >
                              Thu tiền
                            </Button>
                          </>
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
                    {st.state === 'full' ? '● Đã đủ' : st.state === 'partial' ? '◐ 1 phần' : '▲ Thiếu'}
                  </span>
                </div>

                <div style={{ height: 1, background: 'var(--border-subtle)' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>Đã đóng / Mức quỹ:</span>
                  <Mono size={14} weight={600} color={st.state === 'full' ? 'var(--status-delivered)' : 'var(--text-primary)'}>
                    {fmtK(st.paid)} / {fmt(st.amount)}
                  </Mono>
                </div>

                {st.remain > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ font: 'var(--type-caption)', color: 'var(--status-delayed)' }}>Còn thiếu:</span>
                    <Mono size={14} weight={700} color="var(--status-delayed)">
                      {fmt(st.remain)}
                    </Mono>
                  </div>
                )}

                <div style={{ marginTop: 'auto', paddingTop: 4 }}>
                  {canMoney && st.remain > 0 && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <Input
                        size="sm"
                        mono
                        style={{ flex: 1, textAlign: 'right' }}
                        value={ui.form[key] ?? String(st.remain)}
                        onChange={(e) => a.setF(key, e.target.value)}
                        suffix="đ"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="hand-coins"
                        onClick={() => { a.payDue(x.id, ui.form[key]); a.setF(key, undefined) }}
                      >
                        Thu
                      </Button>
                    </div>
                  )}
                  {canMoney && st.paid > 0 && st.remain === 0 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="rotate-ccw"
                        onClick={() => a.clearDue(x.id)}
                      >
                        Huỷ đánh dấu
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
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
