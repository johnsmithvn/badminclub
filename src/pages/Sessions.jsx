// Buổi tập: 4 StatCard + danh sách buổi có tab lọc (handoff 02 §2).

import { Card, DataTable, StatCard, Tabs } from '#ds'
import { Empty, GRID_STAT, sessionColumns } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import {
  billsOf, courtCost, courtPayMode, fmt, guestPaidRev, guestRev, monthSessions,
} from '#lib/money.js'
import { t } from '#i18n'

export default function Sessions() {
  const { db, ui, a } = useApp()
  const tab = ui.tab.sessions || 'all'
  const sess = monthSessions(db, db.month)
  const closed = sess.filter((s) => s.status === 'closed')
  const cancelled = sess.filter((s) => s.status === 'cancelled')
  const unclosed = sess.filter((s) => s.status === 'draft' || s.status === 'open')

  // Trả trọn tháng thì tiền sân lấy từ hoá đơn; trả từng buổi thì cộng các buổi đã chốt.
  const perMonth = courtPayMode(db) === 'month'
  const courtSpent = perMonth
    ? billsOf(db, db.month).reduce((x, b) => x + b.amount, 0)
    : closed.reduce((x, s) => x + courtCost(db, s), 0)

  const guestTotal = sess.reduce((x, s) => x + guestRev(db, s.id), 0)
  const guestPaid = sess.reduce((x, s) => x + guestPaidRev(db, s.id), 0)

  const rows = tab === 'open' ? unclosed : tab === 'closed' ? closed : tab === 'cancelled' ? cancelled : sess

  const tabItems = [
    { value: 'all', label: t('session.tabAll'), count: sess.length },
    { value: 'open', label: t('session.tabOpen'), count: unclosed.length },
    { value: 'closed', label: t('session.tabClosed'), count: closed.length },
  ]
  if (cancelled.length > 0) {
    tabItems.push({ value: 'cancelled', label: t('session.tabCancelled'), count: cancelled.length })
  }

  const countCaption = cancelled.length > 0
    ? t('session.statCountCancelled', {
      closed: closed.length,
      open: unclosed.length,
      cancelled: cancelled.length,
    })
    : t('session.statCountCaption', { closed: closed.length, open: unclosed.length })

  return (
    <>
      <div style={{ ...GRID_STAT, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
        <StatCard label={t('session.statCount')} value={sess.length} unit={t('units.session')} icon="clipboard-check"
          caption={countCaption} />
        <StatCard label={t('session.statCourt')} value={fmt(courtSpent)} icon="landmark" tone="critical"
          caption={t(perMonth ? 'session.statCourtMonth' : 'session.statCourtSession')} />
        <StatCard label={t('session.statGuest')} value={fmt(guestTotal)} icon="user-round-plus" tone="positive"
          caption={t('session.statGuestCaption', { paid: fmt(guestPaid), debt: fmt(guestTotal - guestPaid) })} />
      </div>

      <Card
        title={t('session.listTitle')}
        icon="list"
        padding="0"
        actions={
          <Tabs
            variant="segmented"
            items={tabItems}
            value={tab}
            onChange={(v) => a.setTab('sessions', v)}
          />
        }
      >
        {rows.length === 0
          ? <Empty icon="calendar-days" title={t('session.emptyTitle')} hint={t('session.emptyHint')} />
          : <DataTable columns={sessionColumns(db)} rows={rows} rowKey="id" onRowClick={(r) => a.openSession(r.id)} />}
      </Card>
    </>
  )
}
