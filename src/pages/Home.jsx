// Trang chủ: tab Tổng quan + tab Báo cáo (handoff 02 §1).

import { Alert, Avatar, Button, Card, DataTable, IconButton, ProgressBar, StatCard, Tabs } from '#ds'
import { Bar, DayBox, Empty, GRID_PAIR, GRID_STAT, Mono, Overline, sessionColumns } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { ddmy, monthOf, monthTxt } from '#utils/dates.js'
import {
  adjustRows, advanceRows, costRow, costState, courtCost, courtTxt, dueState, duesOf, duesTotal, fmt, fmtK, genderTxt,
  groupMembers, groupOf, guestOf, homeAlerts, isPresent, memberOf, monthSessions, sessionOf,
  shuttleUnit, stock, timeTxt,
} from '#lib/money.js'
import { availableBalance, monthFlow } from '#lib/ledger.js'
import { t } from '#i18n'
import { Detail, FundBalanceColumns, FundOverviewCards, Reconcile } from '#pages/Fund.jsx'
import { can } from '#lib/roles.js'
import cfg from '#config/app.json' with { type: 'json' }

export default function Home() {
  const { db, ui, a } = useApp()
  const tab = ui.tab.home || 'overview'
  const canMoney = can(db.viewAs || 'owner', 'money')

  return (
    <>
      <Tabs
        variant="underline"
        items={[
          { value: 'overview', label: 'Tổng quan' },
          { value: 'transactions', label: 'Chi tiết thu chi' },
          { value: 'report', label: 'Báo cáo tháng' },
          { value: 'rec', label: 'Đối chiếu quỹ' },
        ]}
        value={tab}
        onChange={(v) => a.setTab('home', v)}
      />
      {tab === 'overview' ? (
        <Overview />
      ) : tab === 'transactions' ? (
        <Detail canMoney={canMoney} />
      ) : tab === 'rec' ? (
        <Reconcile />
      ) : (
        <Report />
      )}
    </>
  )
}

/* ============================ TỔNG QUAN ============================ */

function Overview() {
  const { db, a } = useApp()
  const canMoney = can(db.viewAs || 'owner', 'money')
  const canSessions = can(db.viewAs || 'owner', 'sessions')
  const month = db.month
  const sess = monthSessions(db, month)
  const closed = sess.filter((s) => s.status === 'closed')
  const dues = duesOf(db, month)
  const duesPaid = dues.filter((d) => dueState(d).full)

  // 1. Tính toán tất cả người đang nợ CLB (khách ngoài, hội viên đi thêm ca, hội viên nợ quỹ tháng)
  const debtorMap = {}
  ;(db.sessionGuests || []).forEach((sg) => {
    const s = sessionOf(db, sg.sessionId)
    if (!s || monthOf(s.date) !== month || sg.paid) return
    const k = sg.memberId || sg.guestId
    const who = sg.memberId ? memberOf(db, k) : guestOf(db, k)
    if (!debtorMap[k]) {
      debtorMap[k] = {
        id: k,
        name: who.name,
        isMember: !!sg.memberId,
        gender: who.gender || sg.gender,
        level: who.level || sg.level,
        debt: 0,
        desc: [],
      }
    }
    debtorMap[k].debt += sg.price
    debtorMap[k].desc.push('Buổi ' + ddmy(s.date))
  })

  adjustRows(db, month).forEach((ar) => {
    if (ar.paid || ar.amount <= 0) return
    const k = ar.memberId
    const who = ar.member
    if (!debtorMap[k]) {
      debtorMap[k] = {
        id: k,
        name: who.name,
        isMember: true,
        gender: who.gender,
        level: who.level,
        debt: 0,
        desc: [],
      }
    }
    debtorMap[k].debt += ar.amount
    debtorMap[k].desc.push(ar.label)
  })

  dues.forEach((d) => {
    const st = dueState(d)
    if (st.remain <= 0) return
    const k = d.memberId
    const who = memberOf(db, k)
    if (!debtorMap[k]) {
      debtorMap[k] = {
        id: k,
        name: who.name,
        isMember: true,
        gender: who.gender,
        level: who.level,
        debt: 0,
        desc: [],
      }
    }
    debtorMap[k].debt += st.remain
    debtorMap[k].desc.push('Quỹ tháng thiếu ' + fmtK(st.remain))
  })

  const debtors = Object.values(debtorMap).sort((a, b) => b.debt - a.debt)
  const totalDebt = debtors.reduce((x, r) => x + r.debt, 0)

  // 2. Tính toán các chủ nợ của CLB (thành viên ứng tiền mua cầu, hoá đơn sân hoặc tiền hoàn vắng)
  const creditorMap = {}
  advanceRows(db).forEach((adv) => {
    if (adv.repaidAt) return
    const k = adv.memberId
    if (!creditorMap[k]) {
      creditorMap[k] = {
        id: k,
        name: adv.name,
        owed: 0,
        desc: [],
      }
    }
    creditorMap[k].owed += adv.amount
    creditorMap[k].desc.push(adv.label)
  })

  adjustRows(db, month).forEach((ar) => {
    if (ar.paid || ar.amount >= 0) return
    const k = ar.memberId
    const who = ar.member
    const amt = Math.abs(ar.amount)
    if (!creditorMap[k]) {
      creditorMap[k] = {
        id: k,
        name: who.name,
        owed: 0,
        desc: [],
      }
    }
    creditorMap[k].owed += amt
    creditorMap[k].desc.push('Hoàn vắng ' + ar.label)
  })

  const creditors = Object.values(creditorMap).sort((a, b) => b.owed - a.owed)
  const totalOwed = creditors.reduce((x, r) => x + r.owed, 0)

  const flow = monthFlow(db, month)
  const st = stock(db)
  const av = availableBalance(db)
  const bal = av.balance

  // 3. Buổi tới: Ưu tiên các buổi sắp tới trong tháng hiện tại CHƯA CHỐT và CHƯA HUỶ
  let upcoming = db.sessions
    .filter((s) => s.date >= db.today && monthOf(s.date) === month && s.status !== 'cancelled' && s.status !== 'closed')
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
    .slice(0, 4)

  // Nếu trong tháng đã hết buổi tới, mới lấy gối đầu các buổi tới của tháng sau
  if (upcoming.length === 0) {
    upcoming = db.sessions
      .filter((s) => s.date >= db.today && s.status !== 'cancelled' && s.status !== 'closed')
      .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
      .slice(0, 4)
  }

  // Số buổi có mặt của từng người trong tháng — chỉ tính buổi đã chốt.
  const attend = {}
  closed.forEach((s) => {
    const map = db.attendance[s.id] || {}
    Object.keys(map).forEach((k) => { if (isPresent(map[k])) attend[k] = (attend[k] || 0) + 1 })
  })
  const maxAtt = Math.max(1, ...Object.keys(attend).map((k) => attend[k]))

  // 4. Người lôi kéo nhiều nhất (Top rủ khách giao lưu và giới thiệu thành viên)
  const scanInviters = (filterMonth) => {
    const map = {}
    ;(db.sessionGuests || []).forEach((sg) => {
      const s = sessionOf(db, sg.sessionId)
      if (filterMonth && (!s || monthOf(s.date) !== month)) return
      const mid = sg.invitedBy || (guestOf(db, sg.guestId) || {}).invitedBy
      if (!mid) return
      const member = memberOf(db, mid)
      if (!member || !member.name) return
      if (!map[mid]) {
        map[mid] = { id: mid, name: member.name, count: 0, guests: new Set() }
      }
      map[mid].count += 1
      const gName = (guestOf(db, sg.guestId) || {}).name || 'Khách'
      map[mid].guests.add(gName)
    })
    ;(db.members || []).forEach((m) => {
      if (!m.invitedBy) return
      const mid = m.invitedBy
      const member = memberOf(db, mid)
      if (!member || !member.name) return
      if (!map[mid]) {
        map[mid] = { id: mid, name: member.name, count: 0, guests: new Set() }
      }
      map[mid].count += 1
    })
    return map
  }

  let inviterMap = scanInviters(true)
  let isAllTime = false
  if (Object.keys(inviterMap).length === 0) {
    inviterMap = scanInviters(false)
    isAllTime = true
  }
  const topInviters = Object.values(inviterMap)
    .map((x) => ({ ...x, guestCount: x.guests.size }))
    .sort((a, b) => b.count - a.count)
  const maxInvites = Math.max(1, ...topInviters.map((x) => x.count))

  return (
    <>
      <Warnings />
      <Setup />
      {/* 4 thẻ tài chính chuẩn từ Sổ quỹ */}
      <FundOverviewCards />

      {/* 4 chỉ số vận hành CLB */}
      <div style={{ ...GRID_STAT, marginTop: 12 }}>
        <StatCard label="Nợ cần thu" value={fmt(totalDebt)} icon="clock-alert"
          tone={totalDebt > 0 ? 'warning' : 'neutral'}
          caption={debtors.length ? `${debtors.length} người đang nợ` : 'Đã thu đủ'} />
        <StatCard label={t('home.dues')} value={duesPaid.length + ' / ' + dues.length} icon="users"
          tone={dues.length && duesPaid.length === dues.length ? 'positive' : 'warning'}
          caption={t('home.duesCaption', {
            paid: fmtK(duesTotal(dues).paid),
            total: fmtK(duesTotal(dues).amount),
          })} />
        <StatCard label={t('home.stock')} value={st.left} unit={t('units.shuttle')} icon="package" tone="accent"
          caption={t('home.stockCaption', { bought: st.bought, used: st.used })} />
        <StatCard label={t('home.closedRatio')}
          value={closed.length + ' / ' + sess.filter((s) => s.status !== 'cancelled').length}
          icon="clipboard-check"
          caption={sess.filter((s) => s.status !== 'cancelled').length - closed.length === 0
            ? 'Đã chốt tất cả buổi'
            : `Còn ${sess.filter((s) => s.status !== 'cancelled').length - closed.length} buổi chưa chốt`} />
      </div>

      <div style={GRID_PAIR}>
        <Card title={t('home.upcoming')} subtitle={t('home.upcomingSub')} icon="calendar-clock" padding="0">
          {upcoming.length === 0
            ? <Empty icon="calendar-days" title={t('home.noUpcoming')} hint={t('home.noUpcomingHint')} />
            : <div style={{ display: 'grid' }}>
                {upcoming.map((s) => (
                  <div key={s.id} style={SS.upRow}>
                    <DayBox iso={s.date} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...SS.label, ...SS.ellipsis }}>{groupOf(db, s.groupId).name}</div>
                      <div style={{ ...SS.ellipsis, font: 'var(--type-mono)', color: 'var(--text-muted)', fontSize: 12 }}>
                        {timeTxt(s) + ' · ' + courtTxt(db, s)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      <Mono weight={600} color="var(--text-primary)">{fmt(courtCost(db, s))}</Mono>
                      <div style={SS.caption}>{t('home.courtCostLabel')}</div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      {canSessions ? (
                        <Button size="sm" icon="user-round-check"
                          variant={s.status === 'draft' ? 'secondary' : 'accent'}
                          onClick={() => {
                            if (s.status === 'draft') a.setSessionStatus(s.id, 'open')
                            a.openSession(s.id)
                          }}>
                          {s.status === 'draft' ? t('home.openSession') : t('home.markAttend')}
                        </Button>
                      ) : (
                        <Button size="sm" icon="eye" variant="ghost" onClick={() => a.openSession(s.id)}>
                          Xem buổi
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>}
        </Card>

        <Card title={t('home.duesProgress')} subtitle={monthTxt(month)} icon="banknote"
          actions={<Button variant="ghost" size="sm" iconAfter="chevron-right" onClick={() => a.go('debts')}>
            {t('home.duesLink')}
          </Button>}>
          {db.groups.length === 0
            ? <Empty icon="users" title={t('home.noGroup')} hint={t('home.noGroupHint')} />
            : <div style={{ display: 'grid', gap: 16 }}>
            {db.groups.map((g) => {
              const d = dues.filter((x) => x.groupId === g.id)
              const paid = d.filter((x) => dueState(x).full)
              const tot = duesTotal(d)
              const missing = tot.remain
              return (
                <div key={g.id} style={{ display: 'grid', gap: 7 }}>
                  <ProgressBar label={g.name} value={paid.length} max={d.length || 1}
                    tone={d.length && paid.length === d.length ? 'success' : 'warning'}
                    valueLabel={t('home.duesRatio', { paid: paid.length, total: d.length })} />
                  <div style={SS.between}>
                    <span>
                      {t('home.duesCollected')}{' '}
                      <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                        {fmt(tot.paid)}
                      </strong>
                      {' / ' + fmt(tot.amount)}
                    </span>
                    <span>{missing ? t('home.duesMissing', { amount: fmt(missing) }) : t('common.enough')}</span>
                  </div>
                </div>
              )
            })}
            <div style={SS.dashTop}>
              <Overline>{t('home.unpaidTitle')}</Overline>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {dues.filter((d) => dueState(d).remain > 0).map((d) => {
                  const st = dueState(d)
                  return (
                    <div key={d.id} style={SS.chip}>
                      <Avatar name={memberOf(db, d.memberId).name} size={22} />
                      <span style={SS.label}>{memberOf(db, d.memberId).name}</span>
                      <Mono color="var(--status-delayed)">{fmt(st.remain)}</Mono>
                      {st.paid > 0 && <span style={SS.caption}>{t('home.duePartialTag', { amount: fmtK(st.paid) })}</span>}
                      {/* Nút này thu NỐT phần còn thiếu; thu một phần thì vào Công nợ. */}
                      {canMoney && (
                        <IconButton icon="check" size="sm" variant="ghost"
                          label={t('home.markPaid')} onClick={() => a.payDue(d.id)} />
                      )}
                    </div>
                  )
                })}
                {dues.every((d) => dueState(d).remain <= 0) && <Mono color="var(--text-muted)">{t('common.enough')}</Mono>}
              </div>
            </div>
          </div>}
        </Card>
      </div>

      <div style={GRID_PAIR}>
        <Card
          title="Người nợ nhiều nhất"
          subtitle={monthTxt(month) + ' · Nợ buổi & quỹ tháng'}
          icon="clock-alert"
          padding="16px 18px"
          actions={
            <Button variant="ghost" size="sm" iconAfter="chevron-right" onClick={() => a.go('debts')}>
              Xem tất cả
            </Button>
          }
        >
          <div style={{ display: 'grid', gap: 9 }}>
            {debtors.slice(0, cfg.ui.topDebtCount || 5).map((r) => (
              <div key={r.id} style={SS.debtRow}>
                <Avatar name={r.name} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={SS.label}>{r.name}</span>
                    <span style={{
                      font: '600 10px var(--font-sans)', padding: '1px 6px', borderRadius: 99,
                      background: r.isMember ? 'var(--teal-50)' : 'var(--amber-50)',
                      color: r.isMember ? 'var(--teal-700)' : 'var(--amber-700)',
                    }}>
                      {r.isMember ? 'Hội viên' : 'Khách'}
                    </span>
                  </div>
                  <div style={{ ...SS.caption, ...SS.ellipsis }}>
                    {r.desc.slice(0, 2).join(' · ')}
                  </div>
                </div>
                <Mono weight={600} size={14} color="var(--status-delayed)">{fmt(r.debt)}</Mono>
                {canMoney && (
                  <Button variant="secondary" size="sm" icon="arrow-right"
                    onClick={() => a.go('debts')}>Thu</Button>
                )}
              </div>
            ))}
            {!debtors.length && <Empty icon="circle-check" title="Không ai còn nợ" hint="Tất cả khách và hội viên đã thanh toán đủ tiền trong tháng." />}
          </div>
        </Card>

        <Card
          title="Chủ nợ của CLB"
          subtitle="CLB đang nợ nhiều nhất · Ứng tiền & hoàn vắng"
          icon="wallet"
          padding="16px 18px"
          actions={
            <Button variant="ghost" size="sm" iconAfter="chevron-right" onClick={() => { a.setTab('debts', 'advance'); a.go('debts') }}>
              Xem quỹ nợ
            </Button>
          }
        >
          <div style={{ display: 'grid', gap: 9 }}>
            {creditors.slice(0, cfg.ui.topDebtCount || 5).map((r) => (
              <div key={r.id} style={SS.debtRow}>
                <Avatar name={r.name} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={SS.label}>{r.name}</span>
                  <div style={{ ...SS.caption, ...SS.ellipsis }}>
                    {r.desc.slice(0, 2).join(' · ')}
                  </div>
                </div>
                <Mono weight={600} size={14} color="var(--status-incident)">{fmt(r.owed)}</Mono>
                {canMoney && (
                  <Button variant="secondary" size="sm" icon="rotate-ccw"
                    onClick={() => { a.setTab('debts', 'advance'); a.go('debts') }}>Hoàn</Button>
                )}
              </div>
            ))}
            {!creditors.length && <Empty icon="circle-check" title="CLB không nợ ai" hint="CLB không còn khoản nợ ứng tiền hay tiền hoàn vắng nào chưa thanh toán." />}
          </div>
        </Card>
      </div>

      <div style={GRID_PAIR}>
        <Card title={t('home.topAttend')} subtitle={t('home.topAttendSub')} icon="trophy" padding="16px 18px">
          <div style={{ display: 'grid', gap: 10 }}>
            {Object.keys(attend).sort((x, y) => attend[y] - attend[x]).slice(0, cfg.ui.topAttendCount)
              .map((k, i) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Mono style={{ width: 16, textAlign: 'right' }} color="var(--text-muted)">{i + 1}</Mono>
                  <Avatar name={memberOf(db, k).name} size={26} />
                  <span style={{ ...SS.label, flex: '0 0 96px', ...SS.ellipsis }}>{memberOf(db, k).name}</span>
                  <Bar pct={Math.round((attend[k] / maxAtt) * 100)}
                    color={i === 0 ? 'var(--teal-500)' : 'var(--navy-500)'} />
                  <Mono>{t('home.sessionCount', { n: attend[k] })}</Mono>
                </div>
              ))}
            {!Object.keys(attend).length && <Empty title={t('home.noSession')} hint={t('home.noSessionHint')} />}
          </div>
        </Card>

        <Card
          title="Người lôi kéo nhiều nhất"
          subtitle={isAllTime ? "Đại sứ rủ rê · Toàn thời gian" : `Đại sứ rủ rê · ${monthTxt(month).toLowerCase()}`}
          icon="user-round-plus"
          padding="16px 18px"
        >
          <div style={{ display: 'grid', gap: 10 }}>
            {topInviters.slice(0, cfg.ui.topAttendCount || 5).map((r, i) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Mono style={{ width: 16, textAlign: 'right' }} color="var(--text-muted)">{i + 1}</Mono>
                <Avatar name={r.name} size={26} />
                <div style={{ flex: '0 0 105px', minWidth: 0 }}>
                  <div style={{ ...SS.label, ...SS.ellipsis }}>{r.name}</div>
                  <div style={{ font: '10px var(--font-sans)', color: 'var(--text-muted)' }}>
                    {r.guestCount ? `${r.guestCount} người quen` : 'Thành viên mới'}
                  </div>
                </div>
                <Bar pct={Math.round((r.count / maxInvites) * 100)} color={i === 0 ? 'var(--amber-500)' : 'var(--teal-500)'} />
                <Mono style={{ whiteSpace: 'nowrap' }}>{r.count} lượt</Mono>
              </div>
            ))}
            {!topInviters.length && (
              <Empty
                icon="user-round-plus"
                title="Chưa có ai rủ thêm người"
                hint="Mỗi khi thêm khách vào buổi tập, hãy chọn người rủ để vinh danh đại sứ kéo người nhé!"
              />
            )}
          </div>
        </Card>
      </div>

      {/* Section Tổng kết thu chi 2 cột từ Sổ quỹ */}
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ font: 'var(--type-h3)', color: 'var(--text-primary)' }}>
              Tổng kết thu chi {monthTxt(month).toLowerCase()}
            </div>
            <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
              Báo cáo chi tiết các khoản thu từ anh em và chi phí vận hành thực tế của CLB
            </div>
          </div>
          <Button variant="ghost" size="sm" iconAfter="chevron-right" onClick={() => a.setTab('home', 'transactions')}>
            Xem chi tiết thu chi
          </Button>
        </div>
        <FundBalanceColumns />
      </div>
    </>
  )
}

/* ---------------- Cảnh báo sai im lặng (money.js: homeAlerts) ---------------- */

/**
 * Ba lỗi này không có gì để so nên không ai phát hiện — xem TASKS Phase 9 · P7.
 * Mỗi cảnh báo phải kèm ĐƯỜNG XỬ LÝ ngay tại chỗ, báo không thôi thì cũng bị bỏ qua như cũ.
 */
function Warnings() {
  const { db, a } = useApp()
  const list = homeAlerts(db)
  if (!list.length) return null

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {list.map((w) => (
        <Alert key={w.key} tone={w.tone} title={t('home.warn.' + w.key + '.title', { n: w.n })}>
          <div style={{ display: 'grid', gap: 8 }}>
            <span>{t('home.warn.' + w.key + '.body', { n: w.n, month: monthTxt(db.month).toLowerCase() })}</span>
            {!w.ids
              ? (
                <div>
                  <Button size="sm" variant="secondary" icon="landmark" onClick={() => a.setTab('home', 'transactions')}>
                    {t('home.warn.noBill.btn')}
                  </Button>
                </div>
              )
              : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {w.ids.slice(0, cfg.ui.warnSessionCount).map((id) => {
                    const s = sessionOf(db, id)
                    return (
                      <div key={id} style={SS.warnRow}>
                        <span style={SS.label}>{ddmy(s.date)}</span>
                        <span style={{ ...SS.caption, flex: 1, ...SS.ellipsis }}>{groupOf(db, s.groupId).name}</span>
                        {w.key === 'staleDraft' ? (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => a.setSessionStatus(id, 'open')}>
                              {t('home.warn.playedBtn')}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => a.setSessionStatus(id, 'cancelled')}>
                              {t('home.warn.cancelBtn')}
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="secondary" iconAfter="chevron-right"
                            onClick={() => a.openSession(id)}>
                            {t('home.warn.closeBtn')}
                          </Button>
                        )}
                      </div>
                    )
                  })}
                  {w.ids.length > cfg.ui.warnSessionCount && (
                    <span style={SS.caption}>
                      {t('home.warn.more', { n: w.ids.length - cfg.ui.warnSessionCount })}
                    </span>
                  )}
                </div>
              )}
          </div>
        </Alert>
      ))}
    </div>
  )
}

/* ---------------- CLB mới: bốn bước để dùng được ---------------- */

/**
 * Chỉ hiện khi CLB còn thiếu dữ liệu nền. Bốn bước phải theo đúng thứ tự này:
 * nhóm cố định cần sân, thành viên cần nhóm để tính quỹ, lịch cần cả hai.
 */
function Setup() {
  const { db, a } = useApp()
  if (!can(db.viewAs || 'owner', 'settings')) return null
  const steps = [
    { key: 'court', done: db.courts.length > 0, icon: 'map-pin', go: () => { a.go('settings'); a.setTab('settings', 'courts') } },
    { key: 'group', done: db.groups.length > 0, icon: 'users', go: () => { a.go('settings'); a.setTab('settings', 'groups') } },
    { key: 'member', done: db.members.filter((m) => m.active !== false).length > 1, icon: 'user-round-plus', go: () => a.go('members') },
    { key: 'schedule', done: db.schedules.length > 0, icon: 'repeat', go: () => { a.go('settings'); a.setTab('settings', 'schedules') } },
    // Bảng giá khách sinh sẵn theo thang trình độ nhưng mặc định 0 đ — không sửa thì thu khách ra 0.
    {
      key: 'price', done: db.guestPrices.some((p) => p.nam > 0 || p.nu > 0), icon: 'tags',
      go: () => { a.go('settings'); a.setTab('settings', 'money') },
    },
  ]
  const left = steps.filter((s) => !s.done)
  if (!left.length) return null
  const next = left[0]

  return (
    <Card title={t('setup.cardTitle')} subtitle={t('setup.cardSub', { done: steps.length - left.length, total: steps.length })}
      icon="list" padding="14px 16px">
      <div style={{ display: 'grid', gap: 9 }}>
        {steps.map((s) => (
          <div key={s.key} style={{ ...SS.stepRow, opacity: s.done ? 0.6 : 1 }}>
            <IconButton icon={s.done ? 'circle-check' : s.icon} size="sm" variant="ghost"
              label={t('setup.step.' + s.key + '.title')} onClick={s.go} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...SS.label, textDecoration: s.done ? 'line-through' : 'none' }}>
                {t('setup.step.' + s.key + '.title')}
              </div>
              <div style={SS.caption}>{t('setup.step.' + s.key + '.hint')}</div>
            </div>
            {!s.done && (
              <Button size="sm" variant={s.key === next.key ? 'primary' : 'secondary'} iconAfter="chevron-right"
                onClick={s.go}>{t('setup.step.' + s.key + '.btn')}</Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

/* ============================ BÁO CÁO ============================ */

function Report() {
  const { db } = useApp()
  const month = db.month

  // 4 tháng gần nhất, cột đôi thu/chi
  const months = []
  for (let i = cfg.ui.barMonthCount - 1; i >= 0; i--) {
    const [y, mo] = month.split('-').map(Number)
    const d = new Date(y, mo - 1 - i, 1)
    months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'))
  }
  const flows = months.map((m) => ({ m, ...monthFlow(db, m) }))
  const maxFlow = Math.max(1, ...flows.map((f) => Math.max(f.in, f.out)))
  const H = cfg.ui.barChartHeight

  const closed = monthSessions(db, month).filter((s) => s.status === 'closed')
  // Bảng giá thành liệt kê MỌI buổi trong tháng trừ buổi huỷ — buổi chưa chốt vẫn xem được
  // giá tạm, badge trạng thái nói rõ con số nào còn đổi được.
  const costSessions = monthSessions(db, month).filter((s) => s.status !== 'cancelled')
  // Tỷ lệ đi tập: mẫu số là số buổi đã chốt của nhóm mà người đó cố định
  const rows = []
  db.groups.forEach((g) => {
    const gSess = closed.filter((s) => s.groupId === g.id)
    if (!gSess.length) return
    groupMembers(db, g.id, month).forEach((m) => {
      // isPresent chứ không `=== true`: 'extra' cũng là có mặt. Tab Tổng quan cùng trang đã
      // dùng isPresent — hai ô đếm cùng một việc mà ra hai số là chỗ không ai tin nổi con nào.
      const went = gSess.filter((s) => isPresent((db.attendance[s.id] || {})[m.id])).length
      rows.push({ key: g.id + m.id, name: m.name, went, total: gSess.length, pct: Math.round((went / gSess.length) * 100) })
    })
  })
  rows.sort((x, y) => y.pct - x.pct || y.went - x.went)

  // Khách theo trình độ
  const byLevel = {}
  db.sessionGuests.forEach((sg) => {
    const s = db.sessions.find((x) => x.id === sg.sessionId)
    if (!s || s.date.slice(0, 7) !== month) return
    if (!byLevel[sg.level]) byLevel[sg.level] = { level: sg.level, sum: 0, count: 0 }
    byLevel[sg.level].sum += sg.price
    byLevel[sg.level].count++
  })
  const levelRows = db.guestPrices.map((p) => byLevel[p.level] || { level: p.level, sum: 0, count: 0 })
  const maxLevelSum = Math.max(1, ...levelRows.map((r) => r.sum))

  return (
    <>
      <Card title={t('report.flow')} subtitle={t('report.flowSub')} icon="chart-column" padding="18px">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 26, paddingTop: 8, overflowX: 'auto' }}>
          {flows.map((f) => {
            const net = f.in - f.out
            return (
              <div key={f.m} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: H }}>
                  <div style={{ width: 26, borderRadius: '4px 4px 0 0', background: 'var(--teal-500)', height: Math.round((f.in / maxFlow) * H) }} />
                  <div style={{ width: 26, borderRadius: '4px 4px 0 0', background: 'var(--status-incident)', height: Math.round((f.out / maxFlow) * H) }} />
                </div>
                <div style={SS.label}>{f.m.slice(5, 7) + '/' + f.m.slice(0, 4)}</div>
                <div style={{ font: 'var(--type-caption)', color: net >= 0 ? 'var(--status-delivered)' : 'var(--status-incident)' }}>
                  {(net >= 0 ? '+' : '') + fmtK(net)}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <div style={{ ...GRID_PAIR, gridTemplateColumns: 'repeat(auto-fit,minmax(380px,1fr))', alignItems: 'start' }}>
        <Card title={t('report.attendRate')} subtitle={t('report.attendRateSub')} icon="user-round-check" padding="16px 18px">
          <div style={{ display: 'grid', gap: 9 }}>
            {rows.map((r) => {
              const color = r.pct >= 80 ? 'var(--status-delivered)' : r.pct >= 50 ? 'var(--navy-500)' : 'var(--status-delayed)'
              return (
                <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ ...SS.label, flex: '0 0 96px', ...SS.ellipsis }}>{r.name}</span>
                  <Bar pct={r.pct} color={color} />
                  <Mono style={{ flex: '0 0 56px', textAlign: 'right' }}>{r.went + '/' + r.total}</Mono>
                  <Mono weight={600} size={12} color={color} style={{ flex: '0 0 40px', textAlign: 'right' }}>{r.pct + '%'}</Mono>
                </div>
              )
            })}
            {!rows.length && <Empty title={t('home.noSession')} hint={t('home.noSessionHint')} />}
          </div>
        </Card>

        <Card title={t('report.byLevel')} subtitle={t('report.byLevelSub')} icon="layers" padding="16px 18px">
          <div style={{ display: 'grid', gap: 12 }}>
            {levelRows.map((r) => {
              const price = db.guestPrices.find((p) => p.level === r.level) || { nam: 0, nu: 0 }
              return (
                <div key={r.level} style={{ display: 'grid', gap: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                    <span style={SS.label}>
                      {r.level}{' '}
                      <span style={SS.caption}>
                        · {t('report.levelPrice', { price: fmtK(price.nam) + '/' + fmtK(price.nu) })}
                      </span>
                    </span>
                    <Mono weight={600} color="var(--text-primary)">{fmt(r.sum)}</Mono>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <Bar pct={Math.round((r.sum / maxLevelSum) * 100)} height={7} />
                    <Mono color="var(--text-muted)">{t('report.guestTimes', { n: r.count })}</Mono>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <Card title={t('report.costTable')} subtitle={t('report.costTableSub')} icon="calculator" padding="0">
        <div style={{ display: 'grid', overflowX: 'auto' }}>
          <div style={{ ...SS.costGrid, ...SS.costHead }}>
            <span>{t('report.col.session')}</span>
            <span>{t('report.col.group')}</span>
            <span style={SS.r}>{t('report.col.people')}</span>
            <span style={SS.r}>{t('report.col.court')}</span>
            <span style={SS.r}>{t('report.col.shuttle')}</span>
            <span style={SS.r}>{t('report.col.cost')}</span>
            <span style={SS.r}>{t('report.col.guestRev')}</span>
            <span style={SS.r}>{t('report.col.perHead')}</span>
            <span style={SS.r}>{t('report.col.subsidy')}</span>
          </div>
          {costSessions.map((s) => {
            const c = costRow(db, s)
            const st = costState(s)
            return (
              <div key={s.id} style={{ ...SS.costGrid, ...SS.costRow }}>
                <span style={{ color: 'var(--text-primary)' }}>
                  {s.date.slice(8, 10) + '/' + s.date.slice(5, 7)}
                  {st !== 'final' && <span style={SS.costTag[st]}>{t('session.costState.' + st)}</span>}
                </span>
                <span style={SS.caption}>{groupOf(db, s.groupId).name}</span>
                <span style={SS.r}>{c.people}</span>
                <span style={SS.r}>{fmtK(c.court)}</span>
                <span style={SS.r}>{fmtK(c.shuttle)}</span>
                <span style={{ ...SS.r, color: 'var(--text-primary)', fontWeight: 600 }}>{fmtK(c.cost)}</span>
                <span style={{ ...SS.r, color: 'var(--status-delivered)' }}>{fmtK(c.rev)}</span>
                <span style={SS.r}>{fmtK(c.per)}</span>
                <span style={{
                  ...SS.r, fontWeight: 600,
                  color: c.subsidy > 0 ? 'var(--status-incident)' : 'var(--status-delivered)',
                }}>
                  {fmtK(c.subsidy)}
                </span>
              </div>
            )
          })}
          {!costSessions.length && <Empty title={t('home.noSession')} hint={t('home.noSessionHint')} />}
        </div>
        <div style={{ ...SS.caption, padding: '10px 18px' }}>{t('report.costTableNote')}</div>
      </Card>
    </>
  )
}

const COST_COLS = '1.35fr 1.2fr .7fr .9fr .9fr 1fr 1fr .9fr 1fr'
// Badge trạng thái con số giá thành — xem money.js: costState.
const COST_TAG = {
  font: '600 9px/1 var(--font-sans)', padding: '3px 6px', borderRadius: 99,
  marginLeft: 6, whiteSpace: 'nowrap',
}
const SS = {
  costTag: {
    live: { ...COST_TAG, background: 'var(--status-scheduled-bg)', color: 'var(--status-scheduled-fg)' },
    temp: { ...COST_TAG, background: 'var(--status-delayed-bg)', color: 'var(--status-delayed-fg)' },
  },
  upRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
    borderTop: '1px solid var(--border-subtle)',
  },
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  ellipsis: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  between: { display: 'flex', justifyContent: 'space-between', gap: 10, font: 'var(--type-caption)', color: 'var(--text-muted)' },
  dashTop: { borderTop: '1px dashed var(--border-subtle)', paddingTop: 12, display: 'grid', gap: 8 },
  chip: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
    border: '1px solid var(--border-subtle)', borderRadius: 99, background: 'var(--surface-card)',
  },
  debtRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px',
    border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--surface-card)',
  },
  stepRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px',
    border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--surface-card)',
  },
  // Nền trắng trong ruột Alert màu: dòng buổi phải đọc được trên cả tone warning lẫn danger.
  warnRow: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px',
    borderRadius: 8, background: 'var(--surface-card)',
  },
  costGrid: { display: 'grid', gridTemplateColumns: COST_COLS, gap: 8, minWidth: 900 },
  costHead: {
    padding: '10px 18px', background: 'var(--surface-inset)', borderBottom: '1px solid var(--border-subtle)',
    font: 'var(--type-overline)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)',
    color: 'var(--text-muted)',
  },
  costRow: {
    padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)',
    font: 'var(--type-mono)', color: 'var(--text-secondary)',
  },
  r: { textAlign: 'right' },
}
