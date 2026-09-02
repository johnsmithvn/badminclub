// Sổ quỹ: tổng hợp theo tháng · chi tiết thu chi · hoá đơn sân (handoff 02 §5).
// Số dư CHỈ tính từ transactions — không cộng lại từ nhiều nguồn.

import { Alert, Badge, Button, Card, IconButton, Input, StatCard, Tabs } from '#ds'
import { Empty, GRID_STAT, Mono, Overline } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { ddmy, monthTxt } from '#utils/dates.js'
import { fmt, shuttleUnit, stock } from '#lib/money.js'
import { availableBalance, catLabel, editTarget, ledgerGrouped, monthFlow, undoTarget } from '#lib/ledger.js'
import { courtBillForm, editBillForm, editLedgerForm, ledgerForm } from '#lib/forms.js'
import { can } from '#lib/roles.js'
import { t } from '#i18n'

export default function Fund() {
  const { db, ui, a } = useApp()
  const tab = ui.tab.fund || 'detail'
  const canMoney = can(db.viewAs || 'owner', 'money')

  return (
    <>
      <Tabs
        variant="underline"
        items={[
          { value: 'detail', label: t('fund.tabDetail2') },
          { value: 'month', label: t('fund.tabMonth2') },
        ]}
        value={tab}
        onChange={(v) => a.setTab('fund', v)}
      />

      {tab === 'detail' ? <Detail canMoney={canMoney} /> : <MonthSummary />}
    </>
  )
}

/* ---------------- TỔNG KẾT QUỸ THÁNG (BÁO CÁO PHONG TRÀO) ---------------- */

export function FundOverviewCards() {
  const { db } = useApp()
  const flow = monthFlow(db, db.month)
  const net = flow.in - flow.out
  const av = availableBalance(db)
  const bal = av.balance
  const st = stock(db)
  const unit = shuttleUnit(db)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
      <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--surface-accent-soft)', border: '1px solid var(--teal-500)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)' }}>{t('fund.colTotalIn')}</div>
        <div style={{ font: 'var(--type-h2)', color: 'var(--status-delivered)', marginTop: 4 }}>
          +{fmt(flow.in)}
        </div>
        <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', marginTop: 2 }}>
          {t('fund.colTotalInSub')}
        </div>
      </div>

      <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)' }}>{t('fund.colTotalOut')}</div>
        <div style={{ font: 'var(--type-h2)', color: 'var(--status-incident)', marginTop: 4 }}>
          −{fmt(flow.out)}
        </div>
        <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', marginTop: 2 }}>
          {t('fund.colTotalOutSub')}
        </div>
      </div>

      <div style={{
        padding: '14px 16px', borderRadius: 12,
        background: net >= 0 ? 'var(--surface-accent-soft)' : 'var(--status-delayed-bg)',
        border: `1px solid ${net >= 0 ? 'var(--teal-500)' : 'var(--status-delayed)'}`,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)' }}>{t('fund.colNet')}</div>
        <div style={{ font: 'var(--type-h2)', color: net >= 0 ? 'var(--status-delivered)' : 'var(--status-delayed)', marginTop: 4 }}>
          {(net >= 0 ? '+' : '') + fmt(net)}
        </div>
        <div style={{ font: 'var(--type-caption)', fontWeight: 600, color: net >= 0 ? 'var(--teal-800)' : 'var(--status-delayed)', marginTop: 2 }}>
          {t(net >= 0 ? 'fund.netUp' : 'fund.netDown')}
        </div>
      </div>

      <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)' }}>{t('fund.colBalanceNow')}</div>
        <div style={{ font: 'var(--type-h2)', color: 'var(--text-primary)', marginTop: 4 }}>
          {fmt(bal)}
        </div>
        <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', marginTop: 2 }}>
          {t('fund.stockLine', { n: st.left, amount: fmt(st.left * unit) })}
        </div>
      </div>
    </div>
  )
}

export function FundBalanceColumns() {
  const { db } = useApp()
  const flow = monthFlow(db, db.month)
  const groups = ledgerGrouped(db, db.month)
  const inGroups = groups.filter((g) => g.dir === 'in' && g.cat !== 'opening')
  const outGroups = groups.filter((g) => g.dir === 'out')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
      {/* Cột Thu */}
      <Card title={t('fund.inTitle')} icon="trending-up" padding="0">
        <div style={{ display: 'grid' }}>
          {inGroups.length === 0 ? (
            <div style={{ padding: 16, font: 'var(--type-caption)', color: 'var(--text-muted)', textAlign: 'center' }}>
              {t('fund.inEmpty')}
            </div>
          ) : (
            inGroups.map((g) => (
              <div key={g.key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)',
              }}>
                <div>
                  <div style={{ font: 'var(--type-label)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {catLabel(g.cat)}
                  </div>
                  <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
                    {t('fund.txCount', { n: g.items.length })}
                  </div>
                </div>
                <Mono size={14} weight={600} color="var(--status-delivered)">
                  +{fmt(g.amount)}
                </Mono>
              </div>
            ))
          )}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', background: 'var(--surface-sunken)', fontWeight: 700,
          }}>
            <span>{t('fund.totalIn')}</span>
            <Mono size={15} color="var(--status-delivered)">+{fmt(flow.in)}</Mono>
          </div>
        </div>
      </Card>

      {/* Cột Chi */}
      <Card title={t('fund.outTitle')} icon="trending-down" padding="0">
        <div style={{ display: 'grid' }}>
          {outGroups.length === 0 ? (
            <div style={{ padding: 16, font: 'var(--type-caption)', color: 'var(--text-muted)', textAlign: 'center' }}>
              {t('fund.outEmpty')}
            </div>
          ) : (
            outGroups.map((g) => (
              <div key={g.key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)',
              }}>
                <div>
                  <div style={{ font: 'var(--type-label)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {catLabel(g.cat)}
                  </div>
                  <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
                    {t('fund.txCount', { n: g.items.length })}
                  </div>
                </div>
                <Mono size={14} weight={600} color="var(--status-incident)">
                  −{fmt(g.amount)}
                </Mono>
              </div>
            ))
          )}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', background: 'var(--surface-sunken)', fontWeight: 700,
          }}>
            <span>{t('fund.totalOut')}</span>
            <Mono size={15} color="var(--status-incident)">−{fmt(flow.out)}</Mono>
          </div>
        </div>
      </Card>
    </div>
  )
}

export function MonthSummary() {
  const { db } = useApp()

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* 1. Thẻ Tóm tắt Thặng dư / Hụt quỹ tháng */}
      <Card
        title={t('fund.monthSumTitle', { month: monthTxt(db.month) })}
        subtitle={t('fund.monthSumSub')}
        icon="scale"
        padding="16px"
      >
        <FundOverviewCards />
      </Card>

      {/* 2. Bảng cân đối Thu - Chi 2 cột */}
      <FundBalanceColumns />
    </div>
  )
}

/* ---------------- chi tiết thu chi ---------------- */

export function Detail({ canMoney }) {
  const { db, ui, a } = useApp()
  const groups = ledgerGrouped(db, db.month, { includeAdvances: true })
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
            <>
              <Button variant="secondary" size="sm" icon="landmark" onClick={() => a.openDialog('bill', courtBillForm(db))}>
                {t('fund.addBill')}
              </Button>
              <Button variant="accent" size="sm" icon="plus" onClick={() => a.openDialog('ledger', ledgerForm(db))}>
                {t('fund.addEntry')}
              </Button>
            </>
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
              <span />
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
                    <span style={S.catCell}>
                      {catLabel(g.cat)}
                      {g.isAdvance && (
                        <span style={{
                          marginLeft: 6, fontSize: 10, padding: '2px 7px', borderRadius: 99,
                          background: 'rgba(217, 119, 6, 0.12)', color: '#b45309',
                          fontWeight: 600, border: '1px solid rgba(217, 119, 6, 0.3)',
                        }}>
                          {t('fund.advanceTag')}
                        </span>
                      )}
                    </span>
                    <span style={{ font: 'var(--type-body)', color: 'var(--text-secondary)' }}>
                      {many ? t('fund.itemCount', { n: g.items.length }) : g.items[0].label}
                    </span>
                    <span style={{
                      ...S.caption,
                      fontWeight: g.isAdvance ? 600 : 'normal',
                      color: g.isAdvance ? '#b45309' : undefined,
                    }}>
                      {many ? '' : (g.items[0].by && g.items[0].by !== '—' ? g.items[0].by : t('fund.payerFund'))}
                    </span>
                    <span
                      title={g.tooltip || (g.isAdvance ? t('fund.advanceTip') : undefined)}
                      style={{
                        ...S.r, fontWeight: 600,
                        color: g.isAdvance ? '#d97706' : g.dir === 'in' ? 'var(--status-delivered)' : 'var(--status-incident)',
                        cursor: g.tooltip || g.isAdvance ? 'help' : undefined,
                      }}
                    >
                      {g.isAdvance ? `⚡ ${fmt(g.amount)}` : (g.dir === 'in' ? '+' : '−') + fmt(g.amount)}
                    </span>
                    {/* Dòng gộp nhiều mục không có nút: mỗi mục một nguồn khác nhau, gộp lại
                        thì không biết đang hoàn cái nào. Bung ra rồi thao tác từng mục. */}
                    {many ? <span /> : <RowActions row={g.items[0]} canMoney={canMoney} />}
                  </div>
                  {many && open && g.items.map((it) => (
                    <div key={it.id} style={{ ...S.grid5, ...S.row4, background: 'var(--surface-inset)' }}>
                      <span />
                      <span />
                      <span style={{ font: 'var(--type-body)', color: 'var(--text-secondary)' }}>{it.label}</span>
                      <span style={{
                        ...S.caption,
                        fontWeight: it.isAdvance ? 600 : 'normal',
                        color: it.isAdvance ? '#b45309' : undefined,
                      }}>
                        {it.by && it.by !== '—' ? it.by : t('fund.payerFund')}
                      </span>
                      <span
                        title={it.tooltip}
                        style={{
                          ...S.r,
                          color: it.isAdvance ? '#d97706' : 'var(--text-secondary)',
                          fontWeight: it.isAdvance ? 600 : 'normal',
                          cursor: it.tooltip ? 'help' : undefined,
                        }}
                      >
                        {it.isAdvance ? `⚡ ${fmt(it.amount)}` : fmt(it.amount)}
                      </span>
                      <RowActions row={it} canMoney={canMoney} />
                    </div>
                  ))}
                </div>
              )
            })}
          </div>}
    </Card>
  )
}

/**
 * Nút của một dòng sổ quỹ. Sổ quỹ là bảng SUY RA nên KHÔNG có nút xoá dòng: hoàn tác là lật
 * cờ ở nguồn (`ledger.js: undoTarget`), y hệt bấm "Thu" rồi "Bỏ thu" bên màn Công nợ.
 *
 * Sửa và hoàn tác là hai tập khác nhau, cố ý: hoá đơn sân do quỹ tự trả thì SỬA được nhưng
 * không hoàn được (dòng chi chính là hoá đơn đó); còn quỹ tháng đã thu thì hoàn được nhưng
 * không sửa ở đây (sửa số tiền phải qua màn Công nợ, nơi có cả phần còn thiếu).
 */
function RowActions({ row, canMoney }) {
  const { db, a } = useApp()
  if (!canMoney) return <span />
  const undo = undoTarget(db, row)
  const edit = editTarget(db, row)
  if (!undo && !edit) return <span />

  const open = (e, fn) => { e.stopPropagation(); fn() }
  return (
    <span style={{ display: 'flex', gap: 2, justifyContent: 'flex-end', alignItems: 'center' }}>
      {edit && (
        <IconButton icon="settings-2" size="sm" variant="ghost" label={t('fund.editRow')}
          onClick={(e) => open(e, () => (edit.kind === 'bill'
            ? a.openDialog('bill', editBillForm(db.courtBills.find((x) => x.id === edit.id)))
            : a.openDialog('ledger', editLedgerForm(db.manual.find((x) => x.id === edit.id)))))} />
      )}
      {undo && (
        <span title={t('fund.undoHint')}>
          <IconButton icon="undo-2" size="sm" variant="ghost" label={t('fund.undo')}
            onClick={(e) => open(e, () => a.undoLedgerRow(row.id))} />
        </span>
      )}
    </span>
  )
}

/* ---------------- đối chiếu quỹ (Phase 9 · P7) ---------------- */

const S = {
  grid4: { display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1.1fr', gap: 8, minWidth: 620 },
  grid5: { display: 'grid', gridTemplateColumns: '1fr 1.1fr 2.4fr 1.1fr 1.1fr 92px', gap: 8, minWidth: 940 },
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
