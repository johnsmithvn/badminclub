import { useMemo } from 'react'
import { Alert, Avatar, Button, Card, DataTable, Icon, IconButton, ProgressBar, StatCard, Tabs } from '#ds'
import { Bar, DayBox, Empty, GRID_PAIR, GRID_STAT, Mono, MyDebtPanel, Overline, SessionPill, TabTrack } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { ddmy, monthOf, monthTxt, wd } from '#utils/dates.js'
import {
  adjustRows, advanceRows, courtCost, courtTxt, dueState, duesOf, duesTotal, fmt, fmtK,
  groupMembers, groupOf, guestOf, homeAlerts, isPresent, memberOf, monthSessions,
  openSessions, sessionOf, timeTxt, playerName,
} from '#lib/money.js'
import { monthFlow } from '#lib/ledger.js'
import { getPlayerRating } from '#lib/rating.js'
import { neverMetPairs } from '#lib/matchSearch.js'
import { t } from '#i18n'
import { Detail, FundBalanceColumns, FundOverviewCards } from '#pages/Fund.jsx'
import { can } from '#lib/roles.js'
import { scheduleForm } from '#lib/forms.js'
import { PUBLIC_PATHS } from '#routes'
import cfg from '#config/app.json' with { type: 'json' }

export default function Home() {
  const { db, ui, a } = useApp()
  const tab = ui.tab.home || 'overview'
  const canMoney = can(db.viewAs || 'owner', 'money')

  return (
    <>
      <MyDebtPanel place="top" />
      <TabTrack>
        <Tabs
          variant="underline"
          items={[
            { value: 'overview', label: t('home.tabs.overview') },
            { value: 'match', label: t('home.tabMatch') },
            { value: 'transactions', label: t('home.tabTransactions') },
            { value: 'report', label: t('home.tabReport') },
          ]}
          value={tab}
          onChange={(v) => a.setTab('home', v)}
        />
      </TabTrack>
      {tab === 'overview' ? (
        <Overview />
      ) : tab === 'match' ? (
        <MatchTab />
      ) : tab === 'transactions' ? (
        <Detail canMoney={canMoney} />
      ) : (
        <Report />
      )}
    </>
  )
}

/* ============================ TỔNG QUAN ============================ */

function Overview() {
  const { db, a } = useApp()
  const isMobile = useMobile(768)
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
    debtorMap[k].desc.push(t('home.descSession', { date: ddmy(s.date) }))
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
    debtorMap[k].desc.push(t('home.descDuesShort', { amount: fmtK(st.remain) }))
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

  const backRows = []
  adjustRows(db, month).forEach((ar) => {
    if (ar.paid || ar.amount >= 0) return
    backRows.push(ar)
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
    creditorMap[k].desc.push(ar.label)
  })

  const creditors = Object.values(creditorMap).sort((a, b) => b.owed - a.owed)
  const totalBack = backRows.reduce((x, r) => x + Math.abs(r.amount), 0)
  const backMembers = new Set(backRows.map((r) => r.memberId))

  // 3. Buổi tới: Ưu tiên các buổi sắp tới trong tháng hiện tại CHƯA CHỐT và CHƯA HUỶ.
  // LOẠI buổi đang mở: chúng đã nằm trên banner `OpenNow` ở đầu trang. Một buổi hiện hai chỗ
  // thì người ta phải tự đối chiếu xem có phải cùng một buổi không, và đó là việc của máy.
  const openIds = new Set(openSessions(db).map((s) => s.id))
  const pickUpcoming = (sameMonth) => db.sessions
    .filter((s) => s.date >= db.today && s.status !== 'cancelled' && s.status !== 'closed'
      && !openIds.has(s.id) && (!sameMonth || monthOf(s.date) === month))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
    .slice(0, 4)

  // Nếu trong tháng đã hết buổi tới, mới lấy gối đầu các buổi tới của tháng sau
  let upcoming = pickUpcoming(true)
  if (upcoming.length === 0) upcoming = pickUpcoming(false)

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
      const gName = (guestOf(db, sg.guestId) || {}).name || t('debts.guestFallback')
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

  const upcomingCard = (
    <Card title={t('home.upcoming')} subtitle={t('home.upcomingSub')} icon="calendar-clock" padding="0">
      {upcoming.length === 0
        ? <Empty
            icon={openIds.size ? 'play' : 'calendar-days'}
            title={t(openIds.size ? 'home.allOpen' : 'home.noUpcoming')}
            hint={t(openIds.size ? 'home.allOpenHint' : 'home.noUpcomingHint')}
          />
        : <div style={{ display: 'grid', minWidth: 0, width: '100%' }}>
            {upcoming.map((s) => (
              <div key={s.id} style={SS.upRow}>
                <DayBox iso={s.date} />
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'grid', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 7px', borderRadius: 4,
                      background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(14, 165, 233, 0.12) 100%)',
                      border: '1px solid rgba(2, 132, 199, 0.2)',
                      color: 'var(--navy-800)', fontWeight: 600, fontSize: 12,
                    }}>
                      <Icon name="users" size={11} style={{ color: 'var(--teal-600)' }} />
                      <span>{groupOf(db, s.groupId).name}</span>
                    </span>
                    <SessionPill status={s.status} size="sm" />
                  </div>
                  <div
                    title={timeTxt(s) + ' · ' + courtTxt(db, s)}
                    style={{
                      ...SS.ellipsis,
                      fontFamily: 'var(--font-sans)',
                      color: 'var(--text-secondary)',
                      fontSize: 12,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11.5,
                      color: 'var(--navy-700)', padding: '1px 5px', borderRadius: 3,
                      background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)',
                    }}>
                      {timeTxt(s)}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>·</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <Icon name="map-pin" size={11} style={{ color: 'var(--teal-600)', flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{courtTxt(db, s)}</span>
                    </span>
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
                      {t('home.viewSession')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>}
    </Card>
  )

  return (
    <>
      {isMobile && <Setup />}
      <Warnings />
      <MyDebtPanel place="overview" />
      <OpenNow />
      {!isMobile && <Setup />}
      {isMobile && upcomingCard}
      {/* 4 thẻ tài chính chuẩn từ Sổ quỹ */}
      <FundOverviewCards />

      {/* 4 chỉ số vận hành CLB */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: isMobile ? 10 : 12,
        marginTop: 12,
      }}>
        <StatCard label={t('home.debtToCollect')} value={fmt(totalDebt)} icon="clock-alert"
          tone={totalDebt > 0 ? 'warning' : 'neutral'}
          caption={debtors.length ? t('home.debtorCount', { n: debtors.length }) : t('home.debtAllPaid')} />
        <StatCard label={t('home.totalBack')} value={fmt(totalBack)} icon="hand-coins"
          tone={totalBack > 0 ? 'accent' : 'neutral'}
          caption={backMembers.size ? t('home.backCount', { n: backMembers.size }) : t('home.noBack')} />
        <StatCard label={t('home.dues')} value={duesPaid.length + ' / ' + dues.length} icon="users"
          tone={dues.length && duesPaid.length === dues.length ? 'positive' : 'warning'}
          caption={t('home.duesCaption', {
            paid: fmtK(duesTotal(dues).paid),
            total: fmtK(duesTotal(dues).amount),
          })} />
        <StatCard label={t('home.closedRatio')}
          value={closed.length + ' / ' + sess.filter((s) => s.status !== 'cancelled').length}
          icon="clipboard-check"
          caption={sess.filter((s) => s.status !== 'cancelled').length - closed.length === 0
            ? t('home.allClosed')
            : t('home.openLeft', { n: sess.filter((s) => s.status !== 'cancelled').length - closed.length })} />
      </div>

      <div style={isMobile ? { display: 'grid', gap: 12 } : GRID_PAIR}>
        {!isMobile && upcomingCard}

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
                    <div key={d.id} style={{ ...SS.chip, minHeight: 32 }}>
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

      <div style={isMobile ? { display: 'grid', gap: 12 } : GRID_PAIR}>
        <Card
          title={t('home.topDebtorTitle')}
          subtitle={t('home.topDebtorSub', { month: monthTxt(month) })}
          icon="clock-alert"
          padding="16px 18px"
          actions={
            <Button variant="ghost" size="sm" iconAfter="chevron-right" onClick={() => a.go('debts')}>
              {t('home.viewAll')}
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
                      {t(r.isMember ? 'home.tagMember' : 'home.tagGuest')}
                    </span>
                  </div>
                  <div style={isMobile ? SS.caption : { ...SS.caption, ...SS.ellipsis }}>
                    {r.desc.slice(0, 2).join(' · ')}
                  </div>
                </div>
                <Mono weight={600} size={14} color="var(--status-delayed)">{fmt(r.debt)}</Mono>
                {canMoney && (
                  <Button variant="secondary" size="sm" icon="arrow-right"
                    onClick={() => a.go('debts')}>{t('debts.doCollect')}</Button>
                )}
              </div>
            ))}
            {!debtors.length && <Empty icon="circle-check" title={t('home.noDebtor')} hint={t('home.noDebtorHint')} />}
          </div>
        </Card>

        <Card
          title={t('home.creditorTitle')}
          subtitle={t('home.creditorSub')}
          icon="wallet"
          padding="16px 18px"
          actions={
            <Button variant="ghost" size="sm" iconAfter="chevron-right" onClick={() => { a.setTab('debts', 'advance'); a.go('debts') }}>
              {t('home.viewAdvance')}
            </Button>
          }
        >
          <div style={{ display: 'grid', gap: 9 }}>
            {creditors.slice(0, cfg.ui.topDebtCount || 5).map((r) => (
              <div key={r.id} style={SS.debtRow}>
                <Avatar name={r.name} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={SS.label}>{r.name}</span>
                  <div style={isMobile ? SS.caption : { ...SS.caption, ...SS.ellipsis }}>
                    {r.desc.slice(0, 2).join(' · ')}
                  </div>
                </div>
                <Mono weight={600} size={14} color="var(--status-incident)">{fmt(r.owed)}</Mono>
                {canMoney && (
                  <Button variant="secondary" size="sm" icon="rotate-ccw"
                    onClick={() => { a.setTab('debts', 'advance'); a.go('debts') }}>{t('home.repay')}</Button>
                )}
              </div>
            ))}
            {!creditors.length && <Empty icon="circle-check" title={t('home.noCreditor')} hint={t('home.noCreditorHint')} />}
          </div>
        </Card>
      </div>

      <div style={isMobile ? { display: 'grid', gap: 12 } : GRID_PAIR}>
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
          title={t('home.topInviterTitle')}
          subtitle={isAllTime
            ? t('home.topInviterAll')
            : t('home.topInviterMonth', { month: monthTxt(month).toLowerCase() })}
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
                    {r.guestCount ? t('home.inviterKnown', { n: r.guestCount }) : t('home.inviterNew')}
                  </div>
                </div>
                <Bar pct={Math.round((r.count / maxInvites) * 100)} color={i === 0 ? 'var(--amber-500)' : 'var(--teal-500)'} />
                <Mono style={{ whiteSpace: 'nowrap' }}>{t('home.inviterTimes', { n: r.count })}</Mono>
              </div>
            ))}
            {!topInviters.length && (
              <Empty
                icon="user-round-plus"
                title={t('home.noInviter')}
                hint={t('home.noInviterHint')}
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
              {t('home.summaryTitle', { month: monthTxt(month).toLowerCase() })}
            </div>
            <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
              {t('home.summarySub')}
            </div>
          </div>
          <Button variant="ghost" size="sm" iconAfter="chevron-right" onClick={() => a.setTab('home', 'transactions')}>
            {t('home.viewLedger')}
          </Button>
        </div>
        <FundBalanceColumns />
      </div>
    </>
  )
}

/* ---------------- Sân đang mở ---------------- */

/**
 * Banner nhắc: CLB đang có buổi mở, vào xem ngay. Ẩn hoàn toàn khi không có buổi nào `open` —
 * một tấm banner báo "không có gì" thì mọi người học cách lờ nó đi, và lần có thật cũng lờ nốt.
 *
 * Bấm vào thẻ là mở thẳng buổi đó. Nút chỉ đường phải `stopPropagation`, không thì bấm map lại
 * nhảy sang màn buổi tập.
 */
function OpenNow() {
  const { db, a } = useApp()
  const list = openSessions(db)
  if (!list.length) return null

  return (
    <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
      {list.map((s) => (
        <div
          key={s.id}
          role="button"
          tabIndex={0}
          onClick={() => a.openSession(s.id)}
          onKeyDown={(e) => { if (e.key === 'Enter') a.openSession(s.id) }}
          style={{
            cursor: 'pointer',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--status-delivered)',
            borderLeft: '4px solid var(--status-delivered)',
            background: 'linear-gradient(135deg, var(--status-delivered-bg) 0%, var(--surface-card) 60%)',
            padding: '12px 14px',
            display: 'grid',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '2px 8px', borderRadius: 99,
              background: 'var(--status-delivered)', color: '#fff',
              font: '700 10.5px/1 var(--font-sans)', letterSpacing: 'var(--tracking-caps)',
            }}>
              <Icon name="play" size={10} />
              {t('home.openNow.badge')}
            </span>
            <span style={{ font: 'var(--type-label)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {s.group}
            </span>
            <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
              {wd(s.date)} · {ddmy(s.date)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 12.5 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icon name="clock-alert" size={13} style={{ color: 'var(--teal-600)' }} />
              <Mono weight={700}>{s.time}</Mono>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
              <Icon name="map-pin" size={13} style={{ color: 'var(--teal-600)' }} />
              {s.courtTxt}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
              <Icon name="users" size={13} style={{ color: 'var(--teal-600)', flexShrink: 0 }} />
              <span style={{
                fontWeight: 700,
                color: 'var(--teal-700)',
                background: 'var(--teal-50)',
                padding: '2px 7px',
                borderRadius: 4,
                border: '1px solid var(--teal-200)',
              }}>
                {t('home.openNow.totalSummary', { n: s.totalGoing })}
              </span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {t('home.openNow.fixedRatio', { going: s.fixedGoing, roster: s.roster })}
              </span>
              {s.extraGoing > 0 && (
                <span style={{ color: 'var(--navy-700)', fontWeight: 600 }}>
                  · {t('home.openNow.extraCount', { n: s.extraGoing })}
                </span>
              )}
              <span style={{ color: s.guests > 0 ? 'var(--amber-700)' : 'var(--text-muted)', fontWeight: 600 }}>
                · {t('home.openNow.guestCount', { n: s.guests })}
              </span>
            </span>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {s.places.filter((p) => p.mapUrl).map((p) => (
              <a
                key={p.id}
                href={p.mapUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 99, textDecoration: 'none',
                  border: '1px solid var(--border-subtle)', background: 'var(--surface-card)',
                  color: 'var(--teal-700)', font: '600 11.5px/1 var(--font-sans)',
                }}
              >
                <Icon name="map-pin" size={11} />
                {t('home.openNow.map', { name: p.name })}
              </a>
            ))}
            <Button size="sm" variant="secondary" icon="arrow-right"
              onClick={(e) => { e.stopPropagation(); a.openSession(s.id) }}>
              {t('home.openNow.go')}
            </Button>
          </div>
        </div>
      ))}
    </div>
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
    { key: 'schedule', done: db.schedules.length > 0, icon: 'repeat', go: () => a.openDialog('schedule', scheduleForm(db)) },
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

    </>
  )
}

/* ============================ SÂN ĐẤU / THI ĐẤU ============================ */

function MatchTab() {
  const { db } = useApp()
  const isMobile = useMobile(768)
  const activeMembers = useMemo(() => (db.members || []).filter((m) => m.active !== false), [db.members])
  const matches = useMemo(() => db.matches || [], [db.matches])
  const sessions = useMemo(() => db.sessions || [], [db.sessions])
  const month = db.month

  const memberMap = useMemo(() => {
    const map = {}
    activeMembers.forEach((m) => { map[m.id] = m })
    return map
  }, [activeMembers])

  // 1. 4 Thẻ StatCard
  const stats = useMemo(() => {
    const totalMatches = matches.length
    let upsetMatchesCount = 0
    let balancedMatchesCount = 0

    matches.forEach((m) => {
      const ra = m.initialRatingA || 0
      const rb = m.initialRatingB || 0
      if (Math.abs(ra - rb) > 100 && ((ra < rb && m.winnerTeam === 'A') || (rb < ra && m.winnerTeam === 'B'))) {
        upsetMatchesCount++
      }
      const isScoreClose = (m.sets || []).some((s) => s && s[0] != null && s[1] != null && Math.abs(s[0] - s[1]) <= 3)
      const isRatingClose = Math.abs(ra - rb) <= 50
      if (isScoreClose || isRatingClose) {
        balancedMatchesCount++
      }
    })

    let ratedCount = 0
    activeMembers.forEach((m) => {
      const pr = getPlayerRating(db.playerRatings, m.id, m, db.levels)
      if (pr.gamesCount > 0) ratedCount++
    })

    const balancedRatio = totalMatches > 0 ? Math.round((balancedMatchesCount / totalMatches) * 100) : 0

    return {
      totalMatches,
      upsetMatchesCount,
      ratedCount,
      balancedRatio,
    }
  }, [matches, activeMembers, db.playerRatings, db.levels])

  // 2. Buổi tiếp theo & Trải phổ Elo (Histogram)
  const nextSessionData = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const upcoming = sessions
      .filter((s) => s.status !== 'closed' && (s.date >= todayStr || s.status === 'open'))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))

    const next = upcoming[0] || null
    if (!next) return null

    const group = (db.groups || []).find((g) => g.id === next.groupId)
    const fixedIds = group?.memberIds || []
    const attendIds = (next.attendance || []).filter((at) => at.status === 'present').map((at) => at.memberId || at.id)
    const allRosterIds = Array.from(new Set([...fixedIds, ...attendIds]))
    const roster = allRosterIds.map((id) => memberMap[id]).filter(Boolean)

    const buckets = [
      { key: 'bronze', label: '< 800', count: 0, color: 'var(--podium-bronze)' },
      { key: 'silver', label: '800 – 999', count: 0, color: 'var(--podium-silver)' },
      { key: 'gold', label: '1000 – 1199', count: 0, color: 'var(--podium-gold)' },
      { key: 'plat', label: '1200 – 1399', count: 0, color: 'var(--status-transit-fg)' },
      { key: 'diamond', label: '≥ 1400', count: 0, color: 'var(--action-primary-bg)' },
    ]

    roster.forEach((m) => {
      const r = getPlayerRating(db.playerRatings, m.id, m, db.levels).rating
      if (r < 800) buckets[0].count++
      else if (r < 1000) buckets[1].count++
      else if (r < 1200) buckets[2].count++
      else if (r < 1400) buckets[3].count++
      else buckets[4].count++
    })

    const maxCount = Math.max(1, ...buckets.map((b) => b.count))

    return {
      session: next,
      rosterCount: roster.length,
      buckets,
      maxCount,
    }
  }, [sessions, db.groups, memberMap, db.playerRatings, db.levels])

  // 3. Người của tháng (Top Win Rate, Top Streak)
  const playersOfMonth = useMemo(() => {
    const memberStats = {}
    activeMembers.forEach((m) => {
      memberStats[m.id] = { member: m, matches: 0, wins: 0 }
    })

    const sorted = [...matches].sort((a, b) => (b.at || 0) - (a.at || 0))
    sorted.forEach((m) => {
      const mDate = m.createdAt ? m.createdAt.slice(0, 7) : ''
      if (mDate && mDate !== month) return

      const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
      const teamB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])
      const aWon = m.winnerTeam === 'A'

      teamA.forEach((id) => {
        if (memberStats[id]) {
          memberStats[id].matches++
          if (aWon) memberStats[id].wins++
        }
      })
      teamB.forEach((id) => {
        if (memberStats[id]) {
          memberStats[id].matches++
          if (!aWon) memberStats[id].wins++
        }
      })
    })

    let topWrPlayer = null
    let maxWr = -1
    Object.values(memberStats).forEach((st) => {
      if (st.matches >= 2) {
        const wr = st.wins / st.matches
        if (wr > maxWr) {
          maxWr = wr
          topWrPlayer = { ...st, winRate: Math.round(wr * 100) }
        }
      }
    })

    let topStreakPlayer = null
    let maxStreak = 0
    activeMembers.forEach((m) => {
      let streak = 0
      for (const mt of sorted) {
        const teamA = mt.teamA || (mt.playerKeys ? mt.playerKeys.slice(0, 2) : [])
        const teamB = mt.teamB || (mt.playerKeys ? mt.playerKeys.slice(2, 4) : [])
        const inA = teamA.includes(m.id)
        const inB = teamB.includes(m.id)
        if (!inA && !inB) continue
        const won = (inA && mt.winnerTeam === 'A') || (inB && mt.winnerTeam === 'B')
        if (won) streak++
        else break
      }
      if (streak >= 3 && streak > maxStreak) {
        maxStreak = streak
        topStreakPlayer = { member: m, streak }
      }
    })

    return {
      topWrPlayer,
      topStreakPlayer,
    }
  }, [activeMembers, matches, month])

  // 4. Cặp chưa từng gặp nhau & Lượt đánh chưa đều
  const neverMet = useMemo(() => {
    return neverMetPairs(activeMembers, matches).slice(0, 6)
  }, [activeMembers, matches])

  const unevenSessionPlay = useMemo(() => {
    const sessionsWithMatches = sessions.filter((s) => matches.some((m) => m.sessionId === s.id))
    const lastSession = sessionsWithMatches.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0] || null
    if (!lastSession) return null

    const sessionMatches = matches.filter((m) => m.sessionId === lastSession.id)
    const playCounts = {}
    sessionMatches.forEach((m) => {
      const allP = [...(m.teamA || []), ...(m.teamB || [])]
      allP.forEach((pid) => {
        playCounts[pid] = (playCounts[pid] || 0) + 1
      })
    })

    const entries = Object.entries(playCounts)
    if (entries.length < 3) return null

    const totalPlays = entries.reduce((acc, [, c]) => acc + c, 0)
    const avgPlays = totalPlays / entries.length

    const uneven = entries
      .filter(([, c]) => c <= Math.max(1, Math.floor(avgPlays - 1)))
      .map(([id, count]) => ({
        id,
        name: playerName(db, id),
        count,
        avg: Math.round(avgPlays),
      }))

    return {
      session: lastSession,
      uneven,
    }
  }, [sessions, matches, db])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* 4 StatCards */}
      <div style={isMobile ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } : GRID_STAT}>
        <StatCard
          label={t('home.statMatchesTotal')}
          value={stats.totalMatches}
          sub={t('home.statMatchesSub')}
        />
        <StatCard
          label={t('home.statUpsetCount')}
          value={stats.upsetMatchesCount}
          sub={t('home.statUpsetSub')}
        />
        <StatCard
          label={t('home.statRatedCount')}
          value={`${stats.ratedCount}/${activeMembers.length}`}
          sub={t('home.statRatedSub')}
        />
        <StatCard
          label={t('home.statBalancedRatio')}
          value={`${stats.balancedRatio}%`}
          sub={t('home.statBalancedSub')}
        />
      </div>

      {/* Grid 2 cột */}
      <div style={isMobile ? { display: 'grid', gap: 16 } : GRID_PAIR}>
        {/* Cột trái */}
        <div style={{ display: 'grid', gap: 16 }}>
          {/* 1. Trải phổ Elo buổi tới */}
          <Card
            title={t('home.histogramTitle')}
            subtitle={nextSessionData ? t('home.histogramSub', { n: nextSessionData.rosterCount, date: ddmy(nextSessionData.session.date) }) : t('home.histogramNoSession')}
            icon="chart-column"
            padding="16px"
          >
            {!nextSessionData ? (
              <Empty icon="calendar-days" title={t('home.histogramNoSession')} />
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {nextSessionData.buckets.map((b) => {
                  const pct = Math.round((b.count / nextSessionData.maxCount) * 100)
                  return (
                    <div key={b.key} style={{ display: 'grid', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                        <span style={{ fontWeight: 600, color: b.color, fontFamily: '"IBM Plex Mono", monospace' }}>
                          {b.label}
                        </span>
                        <span style={{ fontFamily: '"IBM Plex Mono", monospace', color: 'var(--text-primary)' }}>
                          {b.count}
                        </span>
                      </div>
                      <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-inset)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: b.color, transition: 'width 0.3s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* 2. Người nổi bật trong tháng */}
          <Card
            title={t('home.playersOfMonthTitle')}
            subtitle={t('home.playersOfMonthSub')}
            icon="trophy"
            padding="16px"
          >
            <div style={{ display: 'grid', gap: 10 }}>
              {/* Top Win Rate */}
              <div style={SS.matchHighlightBox}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ ...SS.matchIconWrap, background: 'var(--status-delivered-bg)', color: 'var(--status-delivered-fg)' }}>
                    <Icon name="sparkles" size={16} />
                  </div>
                  <div>
                    <div style={SS.caption}>{t('home.topWinRate')}</div>
                    <div style={SS.label}>
                      {playersOfMonth.topWrPlayer ? playersOfMonth.topWrPlayer.member.name : '—'}
                    </div>
                  </div>
                </div>
                {playersOfMonth.topWrPlayer && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ font: '700 15px "IBM Plex Mono", monospace', color: 'var(--status-delivered-fg)' }}>
                      {playersOfMonth.topWrPlayer.winRate}%
                    </div>
                    <div style={SS.caption}>
                      {playersOfMonth.topWrPlayer.wins}W – {playersOfMonth.topWrPlayer.matches - playersOfMonth.topWrPlayer.wins}L
                    </div>
                  </div>
                )}
              </div>

              {/* Top Streak */}
              <div style={SS.matchHighlightBox}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ ...SS.matchIconWrap, background: 'var(--status-delayed-bg)', color: 'var(--status-delayed-fg)' }}>
                    <Icon name="flame" size={16} />
                  </div>
                  <div>
                    <div style={SS.caption}>{t('home.topStreak')}</div>
                    <div style={SS.label}>
                      {playersOfMonth.topStreakPlayer ? playersOfMonth.topStreakPlayer.member.name : '—'}
                    </div>
                  </div>
                </div>
                {playersOfMonth.topStreakPlayer && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ font: '700 15px "IBM Plex Mono", monospace', color: 'var(--status-delayed-fg)' }}>
                      {playersOfMonth.topStreakPlayer.streak}W
                    </div>
                    <div style={SS.caption}>
                      {t('home.statMatchesSub')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Cột phải */}
        <div style={{ display: 'grid', gap: 16 }}>
          {/* 3. Cặp chưa từng đối đầu */}
          <Card
            title={t('home.neverMetTitle')}
            subtitle={t('home.neverMetSub')}
            icon="users"
            padding="16px"
          >
            {neverMet.length === 0 ? (
              <Empty icon="users" title={t('home.noNeverMet')} />
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {neverMet.map(([id1, id2], idx) => (
                  <div key={idx} style={SS.neverMetChip}>
                    <span>⚔️</span>
                    <span style={{ fontWeight: 600 }}>{playerName(db, id1)}</span>
                    <span style={{ color: 'var(--text-muted)' }}>·</span>
                    <span style={{ fontWeight: 600 }}>{playerName(db, id2)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 4. Lượt đánh chưa đều buổi gần nhất */}
          <Card
            title={t('home.unevenPlayTitle')}
            subtitle={unevenSessionPlay ? `${t('home.unevenPlaySub')} · ${ddmy(unevenSessionPlay.session.date)}` : t('home.unevenPlaySub')}
            icon="clock-alert"
            padding="16px"
          >
            {!unevenSessionPlay || unevenSessionPlay.uneven.length === 0 ? (
              <Empty icon="check" title={t('home.noUneven')} />
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {unevenSessionPlay.uneven.map((u) => (
                  <div key={u.id} style={SS.unevenRow}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--status-delayed-fg)' }}>⚠️</span>
                      <span style={SS.label}>{u.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ font: '600 13px "IBM Plex Mono", monospace', color: 'var(--status-delayed-fg)' }}>
                        {t('home.playCount', { n: u.count })}
                      </span>
                      <span style={SS.caption}>
                        (tb ~ {u.avg})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

const SS = {
  upRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
    borderTop: '1px solid var(--border-subtle)',
    minWidth: 0, width: '100%', boxSizing: 'border-box',
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
  matchHighlightBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
  },
  matchIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  neverMetChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 10px',
    borderRadius: 6,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    fontSize: 12.5,
    color: 'var(--text-primary)',
  },
  unevenRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderRadius: 6,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
  },
}
