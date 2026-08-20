// Kho cầu: mua · tiêu thụ · kiểm kho cuối tháng (handoff 02 §5).
// Giá bình quân toàn kho là nguồn duy nhất cho mọi phép tính giá thành.

import { Alert, Button, Card, DataTable, StatCard, Tabs } from '#ds'
import { Empty, GRID_STAT, Mono, Overline } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { ddmy, monthTxt } from '#utils/dates.js'
import { estSessions, fmt, fmtK, groupOf, monthSessions, shuttleUnit, stock } from '#lib/money.js'
import { purchaseForm, stockCheckForm } from '#lib/forms.js'
import { can } from '#lib/roles.js'
import { t } from '#i18n'

export default function Shuttles() {
  const { db, ui, a } = useApp()
  const tab = ui.tab.shuttles || 'buy'
  const canMoney = can(db.viewAs || 'owner', 'money')
  const st = stock(db)
  const unit = shuttleUnit(db)

  return (
    <>
      <Alert tone="info" title={t('shuttles.rulesTitle')}>
        <div style={{ display: 'grid', gap: 3 }}>
          <span>{t('shuttles.rule1')}</span>
          <span>{t('shuttles.rule2')}</span>
          <span>{t('shuttles.rule3')}</span>
        </div>
      </Alert>

      <div style={GRID_STAT}>
        <StatCard label={t('shuttles.statBought')} value={st.bought} unit={t('units.shuttle')} icon="shopping-cart" />
        <StatCard label={t('shuttles.statUsed')} value={st.used} unit={t('units.shuttle')} icon="package-open" />
        <StatCard label={t('shuttles.statLeft')} value={st.left} unit={t('units.shuttle')} icon="package" tone="accent"
          caption={t('shuttles.statLeftCaption', { bought: st.bought, used: st.used })} />
        <StatCard label={t('shuttles.statUnit')} value={fmt(unit)} icon="tags"
          caption={t('shuttles.statUnitCaption')} />
      </div>

      <StockCheck canMoney={canMoney} />

      <Tabs
        variant="underline"
        items={[{ value: 'buy', label: t('shuttles.tabBuy') }, { value: 'usage', label: t('shuttles.tabUsage') }]}
        value={tab}
        onChange={(v) => a.setTab('shuttles', v)}
      />

      {tab === 'buy' ? <Purchases canMoney={canMoney} /> : <Usage />}
    </>
  )
}

/* ---------------- kiểm kho ---------------- */

function StockCheck({ canMoney }) {
  const { db, a } = useApp()
  const st = stock(db)
  const est = estSessions(db, db.month)
  const last = (db.stockChecks || [])[db.stockChecks.length - 1]

  return (
    <Card
      title={t('shuttles.checkTitle')}
      subtitle={t('shuttles.checkSub')}
      icon="scale"
      padding="14px 16px"
      actions={canMoney && (
        <Button variant="primary" size="sm" icon="scale"
          onClick={() => a.openDialog('check', stockCheckForm(db))}>
          {t('shuttles.doCheck')}
        </Button>
      )}
    >
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <Box label={t('shuttles.checkSystem')} value={st.left} />
          <Box label={t('shuttles.checkCounted')} value={last ? last.counted : '—'} />
          <Box label={t('shuttles.checkDiff')} value={last ? (last.diff > 0 ? '+' : '') + last.diff : '—'}
            color={last && last.diff !== 0 ? 'var(--status-delayed)' : undefined} />
          <Box label={t('shuttles.checkSpread')}
            value={t('shuttles.checkSpreadUnit', { n: est.length, month: monthTxt(db.month) })} />
        </div>
        {!est.length && <div style={S.caption}>{t('shuttles.checkNoEst')}</div>}
        {last && (
          <div style={S.caption}>
            {t('shuttles.checkLast', { date: ddmy(last.date), counted: last.counted, diff: last.diff })}
          </div>
        )}
      </div>
    </Card>
  )
}

const Box = ({ label, value, color }) => (
  <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--surface-inset)', display: 'grid', gap: 4 }}>
    <Overline>{label}</Overline>
    <Mono weight={600} size={16} color={color || 'var(--text-primary)'}>{value}</Mono>
  </div>
)

/* ---------------- lịch sử mua ---------------- */

function Purchases({ canMoney }) {
  const { db, a } = useApp()
  const typeName = (id) => (db.shuttleTypes.find((x) => x.id === id) || { name: t('common.unknown') }).name

  const columns = [
    { key: 'd', header: t('shuttles.colDate'), mono: true, render: (r) => ddmy(r.date) },
    { key: 't', header: t('shuttles.colType'), render: (r) => typeName(r.typeId) },
    { key: 'tu', header: t('shuttles.colTubes'), align: 'right', mono: true, render: (r) => r.tubes || '—' },
    { key: 'q', header: t('shuttles.colQty'), align: 'right', mono: true, render: (r) => r.qty },
    { key: 'pt', header: t('shuttles.colPerTube'), align: 'right', mono: true, render: (r) => (r.pricePerTube ? fmtK(r.pricePerTube) : '—') },
    { key: 'to', header: t('shuttles.colTotal'), align: 'right', mono: true, render: (r) => (r.total ? fmtK(r.total) : '—') },
    {
      key: 'pu', header: t('shuttles.colPerUnit'), align: 'right', mono: true,
      render: (r) => (r.total && r.qty ? fmtK(Math.round(r.total / r.qty)) : '—'),
    },
    { key: 'p', header: t('shuttles.colPayer'), muted: true, render: (r) => r.payer || t('common.unknown') },
  ]

  return (
    <Card
      title={t('shuttles.buyTitle')}
      subtitle={t('shuttles.buySub')}
      icon="shopping-cart"
      padding="0"
      actions={canMoney && (
        <Button variant="accent" size="sm" icon="plus" onClick={() => a.openDialog('purchase', purchaseForm(db))}>
          {t('shuttles.addPurchase')}
        </Button>
      )}
    >
      {db.purchases.length === 0
        ? <Empty icon="shopping-cart" title={t('shuttles.buyEmpty')} hint={t('shuttles.buyEmptyHint')} />
        : <DataTable columns={columns} rows={db.purchases.slice().reverse()} rowKey="id" />}
    </Card>
  )
}

/* ---------------- tiêu thụ theo buổi ---------------- */

function Usage() {
  const { db } = useApp()
  const unit = shuttleUnit(db)
  const rows = monthSessions(db, db.month).filter((s) => s.shuttleUsed > 0)

  const columns = [
    { key: 'd', header: t('shuttles.colSession'), mono: true, render: (r) => ddmy(r.date) },
    { key: 'g', header: t('shuttles.colGroup'), render: (r) => groupOf(db, r.groupId).name },
    {
      key: 'm', header: t('shuttles.colMode'), muted: true,
      render: (r) => t('session.shuttleMode' + (r.shuttleMode || 'quota')[0].toUpperCase() + (r.shuttleMode || 'quota').slice(1)),
    },
    {
      key: 'u', header: t('shuttles.colUsed'), align: 'right', mono: true,
      render: (r) => r.shuttleUsed + (r.shuttleEst ? ' ~' : ''),
    },
    { key: 'mo', header: t('shuttles.colMoney'), align: 'right', mono: true, render: (r) => fmtK(r.shuttleUsed * unit) },
    { key: 'st', header: t('sessionCol.status'), render: (r) => t('sessionState.' + r.status) },
  ]

  return (
    <Card title={t('shuttles.usageTitle')} subtitle={t('shuttles.usageSub')} icon="package-open" padding="0">
      {rows.length === 0
        ? <Empty icon="package-open" title={t('shuttles.usageEmpty')} hint={t('shuttles.usageEmptyHint')} />
        : <DataTable columns={columns} rows={rows} rowKey="id" dense />}
    </Card>
  )
}

const S = { caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' } }
