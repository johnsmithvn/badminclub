// Sổ quỹ: tổng hợp theo tháng · chi tiết thu chi · hoá đơn sân (handoff 02 §5).
// Số dư CHỈ tính từ transactions — không cộng lại từ nhiều nguồn.

import { Button, Card, StatCard, Tabs } from '#ds'
import { Empty, GRID_STAT, Mono, Overline } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { ddmy, monthTxt } from '#utils/dates.js'
import { billsOf, courtPayMode, fmt, payerName } from '#lib/money.js'
import { catLabel, dailySummary, fundBalance, ledgerGrouped, monthFlow } from '#lib/ledger.js'
import { courtBillForm, ledgerForm } from '#lib/forms.js'
import { can } from '#lib/roles.js'
import { t } from '#i18n'

export default function Fund() {
  const { db, ui, a } = useApp()
  const tab = ui.tab.fund || 'month'
  const canMoney = can(db.viewAs || 'owner', 'money')
  const flow = monthFlow(db, db.month)
  const bal = fundBalance(db)
  const net = flow.in - flow.out

  return (
    <>
      <div style={GRID_STAT}>
        <StatCard label={t('fund.balance')} value={fmt(bal)} icon="wallet"
          tone={bal < 0 ? 'critical' : 'neutral'} caption={t('fund.balanceCaption')} />
        <StatCard label={t('fund.monthIn')} value={fmt(flow.in)} icon="trending-up" tone="positive"
          caption={monthTxt(db.month)} />
        <StatCard label={t('fund.monthOut')} value={fmt(flow.out)} icon="trending-down" tone="critical"
          caption={monthTxt(db.month)} />
        <StatCard label={t('fund.monthNet')} value={(net >= 0 ? '+' : '') + fmt(net)} icon="scale"
          tone={net >= 0 ? 'positive' : 'critical'} caption={monthTxt(db.month)} />
      </div>

      <CourtBills canMoney={canMoney} />

      <Tabs
        variant="underline"
        items={[{ value: 'month', label: t('fund.tabMonth') }, { value: 'detail', label: t('fund.tabDetail') }]}
        value={tab}
        onChange={(v) => a.setTab('fund', v)}
      />

      {tab === 'month' ? <MonthSummary /> : <Detail canMoney={canMoney} />}
    </>
  )
}

/* ---------------- tiền sân ---------------- */

function CourtBills({ canMoney }) {
  const { db, a } = useApp()
  const mode = courtPayMode(db)
  const bills = billsOf(db, db.month)

  return (
    <Card
      title={t('fund.courtTitle')}
      subtitle={t('fund.courtSub')}
      icon="landmark"
      padding="14px 16px"
      actions={
        <Tabs
          variant="segmented"
          items={[
            { value: 'month', label: t('fund.payModeMonth') },
            { value: 'session', label: t('fund.payModeSession') },
          ]}
          value={mode}
          onChange={(v) => canMoney && a.setCourtPayMode(v)}
        />
      }
    >
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={S.caption}>{t(mode === 'month' ? 'fund.payModeMonthNote' : 'fund.payModeSessionNote')}</div>

        {mode === 'month' && (
          <>
            {bills.length === 0
              ? <Empty icon="landmark" title={t('fund.billEmpty')} hint={t('fund.billEmptyHint')} />
              : bills.map((b) => (
                  <div key={b.id} style={S.row}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.label}>{b.venue}</div>
                      <Mono color="var(--text-muted)">
                        {ddmy(b.date) + ' · ' + payerName(db, b.payerId, b.payer) + (b.note ? ' · ' + b.note : '')}
                      </Mono>
                    </div>
                    <Mono weight={600} size={14} color="var(--status-incident)">{fmt(b.amount)}</Mono>
                  </div>
                ))}
            {canMoney && (
              <div>
                <Button variant="secondary" size="sm" icon="plus"
                  onClick={() => a.openDialog('bill', courtBillForm(db))}>
                  {t('fund.addBill')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

/* ---------------- tổng hợp theo tháng ---------------- */

function MonthSummary() {
  const { db } = useApp()
  const sum = dailySummary(db, db.month)

  return (
    <Card title={t('fund.sumTitle')} subtitle={t('fund.sumSub')} icon="chart-column" padding="0">
      {sum.rows.length === 0
        ? <Empty icon="wallet" title={t('fund.empty')} hint={t('fund.emptyHint')} />
        : <div style={{ display: 'grid', overflowX: 'auto' }}>
            <div style={{ ...S.grid4, ...S.head }}>
              <span>{t('fund.colDate')}</span>
              <span style={S.r}>{t('fund.colIn')}</span>
              <span style={S.r}>{t('fund.colOut')}</span>
              <span style={S.r}>{t('fund.colBalance')}</span>
            </div>
            <div style={{ ...S.grid4, ...S.row4, background: 'var(--surface-inset)' }}>
              <span style={S.caption}>{t('fund.opening')}</span>
              <span style={S.r} />
              <span style={S.r} />
              <span style={{ ...S.r, fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(sum.opening)}</span>
            </div>
            {sum.rows.map((r) => (
              <div key={r.date} style={{ ...S.grid4, ...S.row4 }}>
                <span style={{ color: 'var(--text-primary)' }}>{ddmy(r.date)}</span>
                <span style={{ ...S.r, color: r.in ? 'var(--status-delivered)' : 'var(--text-disabled)' }}>
                  {r.in ? fmt(r.in) : '—'}
                </span>
                <span style={{ ...S.r, color: r.out ? 'var(--status-incident)' : 'var(--text-disabled)' }}>
                  {r.out ? fmt(r.out) : '—'}
                </span>
                <span style={{ ...S.r, fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(r.balance)}</span>
              </div>
            ))}
          </div>}
    </Card>
  )
}

/* ---------------- chi tiết thu chi ---------------- */

function Detail({ canMoney }) {
  const { db, ui, a } = useApp()
  const groups = ledgerGrouped(db, db.month)
  const allOpen = groups.length > 0 && groups.every((g) => g.items.length < 2 || ui.expanded[g.key])

  return (
    <Card
      title={t('fund.detailTitle')}
      subtitle={t('fund.detailSub')}
      icon="list"
      padding="0"
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" size="sm" icon={allOpen ? 'chevron-right' : 'chevron-down'}
            onClick={() => a.setAllExpanded(allOpen ? {} : Object.fromEntries(groups.map((g) => [g.key, true])))}>
            {t(allOpen ? 'fund.collapseAll' : 'fund.expandAll')}
          </Button>
          {canMoney && (
            <Button variant="accent" size="sm" icon="plus" onClick={() => a.openDialog('ledger', ledgerForm(db))}>
              {t('fund.addEntry')}
            </Button>
          )}
        </div>
      }
    >
      {groups.length === 0
        ? <Empty icon="wallet" title={t('fund.empty')} hint={t('fund.emptyHint')} />
        : <div style={{ display: 'grid', overflowX: 'auto' }}>
            <div style={{ ...S.grid5, ...S.head }}>
              <span>{t('fund.colDate')}</span>
              <span>{t('fund.colCat')}</span>
              <span>{t('fund.colLabel')}</span>
              <span>{t('fund.colBy')}</span>
              <span style={S.r}>{t('fund.colAmount')}</span>
            </div>
            {groups.map((g) => {
              const many = g.items.length > 1
              const open = !!ui.expanded[g.key]
              return (
                <div key={g.key}>
                  <div
                    onClick={() => many && a.toggleExpand(g.key)}
                    style={{ ...S.grid5, ...S.row4, cursor: many ? 'pointer' : 'default', alignItems: 'center' }}
                  >
                    <span style={{ color: 'var(--text-primary)' }}>{ddmy(g.date)}</span>
                    <span style={S.catCell}>{catLabel(g.cat)}</span>
                    <span style={{ font: 'var(--type-body)', color: 'var(--text-secondary)' }}>
                      {many ? t('fund.itemCount', { n: g.items.length }) : g.items[0].label}
                    </span>
                    <span style={S.caption}>{many ? '' : g.items[0].by || ''}</span>
                    <span style={{
                      ...S.r, fontWeight: 600,
                      color: g.dir === 'in' ? 'var(--status-delivered)' : 'var(--status-incident)',
                    }}>
                      {(g.dir === 'in' ? '+' : '−') + fmt(g.amount)}
                    </span>
                  </div>
                  {many && open && g.items.map((it) => (
                    <div key={it.id} style={{ ...S.grid5, ...S.row4, background: 'var(--surface-inset)' }}>
                      <span />
                      <span />
                      <span style={{ font: 'var(--type-body)', color: 'var(--text-secondary)' }}>{it.label}</span>
                      <span style={S.caption}>{it.by || ''}</span>
                      <span style={{ ...S.r, color: 'var(--text-secondary)' }}>{fmt(it.amount)}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>}
    </Card>
  )
}

const S = {
  grid4: { display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1.1fr', gap: 8, minWidth: 620 },
  grid5: { display: 'grid', gridTemplateColumns: '1fr 1.1fr 2.4fr 1.1fr 1.1fr', gap: 8, minWidth: 860 },
  head: {
    padding: '10px 18px', background: 'var(--surface-inset)', borderBottom: '1px solid var(--border-subtle)',
    font: 'var(--type-overline)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)',
    color: 'var(--text-muted)',
  },
  row4: {
    padding: '10px 18px', borderBottom: '1px solid var(--border-subtle)',
    font: 'var(--type-mono)', color: 'var(--text-secondary)',
  },
  catCell: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  row: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '9px 11px',
    border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--surface-card)',
  },
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  r: { textAlign: 'right' },
}
