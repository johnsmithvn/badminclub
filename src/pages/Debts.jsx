// Công nợ: Thu / Hoàn theo buổi (gộp Khách ngoài, Đi thêm, Vắng ca có expand từng buổi) · Quỹ tháng · Quỹ nợ.

import { useState } from 'react'
import { Alert, Avatar, Button, Card, Icon, IconButton, Input, Select, Tabs } from '#ds'
import { Empty, GRID_PAIR, Mono, Overline } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { ddmy, monthOf, monthTxt, wd } from '#utils/dates.js'
import {
  adjustRows, advanceRows, courtTxt, dueState, duesOf, duesTotal, fmt, fmtK,
  groupOf, guestOf, intOf, memberOf, monthSessions, sessionOf, timeTxt,
} from '#lib/money.js'
import { can } from '#lib/roles.js'
import { t } from '#i18n'

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

/* ---------------- thu / hoàn theo buổi tập (expand chi tiết) ---------------- */

function SessionDebts({ canMoney }) {
  const { db, a } = useApp()
  const [expanded, setExpanded] = useState({})
  const [editingPrices, setEditingPrices] = useState({})
  const [filter, setFilter] = useState('unpaid')

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
    if (filter === 'unpaid') return p.hasUnpaid
    if (filter === 'paid') return !p.hasUnpaid && p.totalCount > 0
    return true
  }).sort((a, b) => b.unpaidCount - a.unpaidCount)

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
    // 1. Khách ngoài
    const guestItems = person.items.filter((x) => x.type === 'guest' && !x.paid)
    if (guestItems.length > 0) {
      a.collectDebt(person.id)
    }
    // 2. Đối chiếu
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
      subtitle="Gộp khách giao lưu, hội viên đi thêm và hoàn tiền vắng — bấm vào từng người để mở rộng chi tiết buổi"
      icon="receipt"
      padding="0"
      actions={
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
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
      {filteredPeople.length === 0 ? (
        <Empty icon="circle-check" title="Không có công nợ buổi nào" hint="Tất cả các buổi giao lưu, đi thêm và vắng mặt trong tháng đều đã được thanh toán xong." />
      ) : (
        <div style={{ display: 'grid' }}>
          {filteredPeople.map((p) => {
            const isExp = !!expanded[p.id]
            const inviter = p.invitedBy ? memberOf(db, p.invitedBy).name : ''

            return (
              <div key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {/* Dòng tóm tắt của Người */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', background: isExp ? 'var(--surface-sunken)' : 'var(--surface-card)',
                    cursor: 'pointer', flexWrap: 'wrap', gap: 10,
                  }}
                  onClick={() => toggleExpand(p.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 220 }}>
                    <IconButton
                      icon={isExp ? 'chevron-down' : 'chevron-right'}
                      size="sm"
                      variant="ghost"
                      label={isExp ? 'Thu gọn' : 'Mở rộng'}
                      onClick={(e) => { e.stopPropagation(); toggleExpand(p.id) }}
                    />
                    <Avatar name={p.name} size={32} />
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
                        {p.totalCount} buổi ({p.unpaidCount > 0 ? `${p.unpaidCount} chưa thanh toán` : 'Đã thanh toán đủ'})
                      </div>
                    </div>
                  </div>

                  {/* Tổng tiền & Nút thu/hoàn tất cả */}
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
                          ✓ Đã hoàn tất
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

                {/* Danh sách con khi bấm Expand mở rộng */}
                {isExp && (
                  <div style={{ padding: '6px 16px 14px 48px', background: 'var(--surface-inset)' }}>
                    <div style={{ font: 'var(--type-overline)', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.04em' }}>
                      Chi tiết từng buổi (Gợi ý số tiền & sửa trực tiếp):
                    </div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {p.items.map((item) => {
                        const currentPrice = editingPrices[item.key] !== undefined ? editingPrices[item.key] : String(item.price)
                        return (
                          <div
                            key={item.key}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '9px 14px', borderRadius: 8, background: 'var(--surface-card)',
                              border: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: 10,
                            }}
                          >
                            {/* Thông tin ngày, giờ, sân */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Icon name="calendar" size={16} style={{ color: 'var(--text-muted)' }} />
                              <div>
                                <div style={{ font: 'var(--type-label)', fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {wd(item.date)}, {ddmy(item.date)} · {item.timeVenue}
                                </div>
                                <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
                                  <span style={{
                                    color: item.isRefund ? 'var(--status-incident)' : 'var(--teal-700)',
                                    fontWeight: 600,
                                  }}>
                                    {item.typeLabel}
                                  </span>
                                  {item.groupName ? ` · ${item.groupName}` : ''}
                                </div>
                              </div>
                            </div>

                            {/* Ô nhập sửa số tiền + Nút thu/trả riêng buổi này */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
                                  {item.isRefund ? 'Hoàn trả:' : 'Số tiền:'}
                                </span>
                                <Input
                                  size="sm"
                                  mono
                                  disabled={!canMoney || item.paid}
                                  value={currentPrice}
                                  onChange={(e) => handlePriceChange(item.key, e.target.value)}
                                  onBlur={() => handlePriceBlur(item)}
                                  style={{ width: 110, textAlign: 'right' }}
                                  suffix="đ"
                                />
                              </div>

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
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

/* ---------------- thành viên ứng tiền ---------------- */

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

/* ---------------- quỹ tháng ---------------- */

function Dues({ dues, canMoney }) {
  const { db, ui, a } = useApp()
  const missing = duesTotal(dues).remain

  return (
    <Card
      title={t('debts.duesTitle')}
      subtitle={t('debts.duesSub')}
      icon="banknote"
      padding="14px 16px"
      actions={<Mono weight={600} color={missing ? 'var(--status-delayed)' : 'var(--status-delivered)'}>
        {missing ? t('debts.totalDues', { amount: fmt(missing) }) : t('common.enough')}
      </Mono>}
    >
      {dues.length === 0
        ? <Empty icon="banknote" title={t('debts.duesEmpty')} hint={t('debts.duesEmptyHint')} />
        : <div style={{ display: 'grid', gap: 12 }}>
            {db.groups.map((g) => {
              const list = dues.filter((x) => x.groupId === g.id)
              if (!list.length) return null
              return (
                <div key={g.id} style={{ display: 'grid', gap: 7 }}>
                  <Overline>{g.name}</Overline>
                  <div style={{ display: 'grid', gap: 7 }}>
                    {list.map((x) => {
                      const st = dueState(x)
                      const key = 'due_' + x.id
                      return (
                        <div key={x.id} style={{
                          ...S.dueChip,
                          background: st.state === 'full' ? 'var(--surface-accent-soft)'
                            : st.state === 'partial' ? 'var(--status-delayed-bg)' : 'var(--surface-card)',
                          borderColor: st.state === 'full' ? 'var(--teal-500)'
                            : st.state === 'partial' ? 'var(--status-delayed)' : 'var(--border-subtle)',
                        }}>
                          <Avatar name={memberOf(db, x.memberId).name} size={22} />
                          <span style={{ ...S.label, flex: 1, minWidth: 90 }}>{memberOf(db, x.memberId).name}</span>
                          <Mono color={st.state === 'full' ? 'var(--status-delivered)' : 'var(--text-primary)'}>
                            {fmtK(st.paid) + ' / ' + fmt(st.amount)}
                          </Mono>
                          {st.remain > 0 && (
                            <Mono color="var(--status-delayed)">{t('debts.dueRemain', { amount: fmtK(st.remain) })}</Mono>
                          )}
                          {canMoney && st.remain > 0 && (
                            <>
                              <Input size="sm" mono style={{ width: 118 }}
                                value={ui.form[key] ?? String(st.remain)}
                                onChange={(e) => a.setF(key, e.target.value)} />
                              <Button variant="secondary" size="sm" icon="hand-coins"
                                onClick={() => { a.payDue(x.id, ui.form[key]); a.setF(key, undefined) }}>
                                {t('debts.dueCollect')}
                              </Button>
                            </>
                          )}
                          {canMoney && st.paid > 0 && (
                            <IconButton icon="rotate-ccw" size="sm" variant="ghost"
                              label={t('debts.dueClear')} onClick={() => a.clearDue(x.id)} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>}
    </Card>
  )
}

const S = {
  row: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '9px 11px',
    border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--surface-card)',
  },
  dueChip: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 11px', borderRadius: 99,
    border: '1px solid', font: 'inherit',
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
}
