// Sổ quỹ: tổng hợp theo tháng · chi tiết thu chi · hoá đơn sân (handoff 02 §5).
// Số dư CHỈ tính từ transactions — không cộng lại từ nhiều nguồn.

import { Alert, Badge, Button, Card, Input, StatCard, Tabs } from '#ds'
import { Empty, GRID_STAT, Mono, Overline } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { ddmy, monthTxt } from '#utils/dates.js'
import { fmt, fmtK, intOf, payerName, shuttleUnit, stock } from '#lib/money.js'
import { availableBalance, catLabel, dailySummary, ledgerGrouped, monthFlow, reconcile } from '#lib/ledger.js'
import { courtBillForm, ledgerForm } from '#lib/forms.js'
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
          { value: 'detail', label: 'Chi tiết thu chi' },
          { value: 'month', label: 'Tổng kết quỹ tháng' },
          { value: 'rec', label: t('fund.tabRec') },
        ]}
        value={tab}
        onChange={(v) => a.setTab('fund', v)}
      />

      {tab === 'detail' ? <Detail canMoney={canMoney} /> : tab === 'rec' ? <Reconcile /> : <MonthSummary />}
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
        <div style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)' }}>Tổng tiền thu từ anh em</div>
        <div style={{ font: 'var(--type-h2)', color: 'var(--status-delivered)', marginTop: 4 }}>
          +{fmt(flow.in)}
        </div>
        <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', marginTop: 2 }}>
          Quỹ tháng & khách vãng lai
        </div>
      </div>

      <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)' }}>Tổng chi phí hoạt động</div>
        <div style={{ font: 'var(--type-h2)', color: 'var(--status-incident)', marginTop: 4 }}>
          −{fmt(flow.out)}
        </div>
        <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', marginTop: 2 }}>
          Tiền sân, mua cầu, hoàn vắng
        </div>
      </div>

      <div style={{
        padding: '14px 16px', borderRadius: 12,
        background: net >= 0 ? 'var(--surface-accent-soft)' : 'var(--status-delayed-bg)',
        border: `1px solid ${net >= 0 ? 'var(--teal-500)' : 'var(--status-delayed)'}`,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)' }}>Chênh lệch thu - chi tháng này</div>
        <div style={{ font: 'var(--type-h2)', color: net >= 0 ? 'var(--status-delivered)' : 'var(--status-delayed)', marginTop: 4 }}>
          {(net >= 0 ? '+' : '') + fmt(net)}
        </div>
        <div style={{ font: 'var(--type-caption)', fontWeight: 600, color: net >= 0 ? 'var(--teal-800)' : 'var(--status-delayed)', marginTop: 2 }}>
          {net >= 0 ? '● Tháng này đang thặng dư quỹ' : '▲ Tháng này đang bị hụt quỹ'}
        </div>
      </div>

      <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)' }}>Số dư quỹ hiện tại</div>
        <div style={{ font: 'var(--type-h2)', color: 'var(--text-primary)', marginTop: 4 }}>
          {fmt(bal)}
        </div>
        <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', marginTop: 2 }}>
          Kho cầu: {st.left} quả ({fmt(st.left * unit)})
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
      <Card title="Các khoản thu từ anh em (+)" icon="trending-up" padding="0">
        <div style={{ display: 'grid' }}>
          {inGroups.length === 0 ? (
            <div style={{ padding: 16, font: 'var(--type-caption)', color: 'var(--text-muted)', textAlign: 'center' }}>
              Chưa phát sinh khoản thu nào trong tháng.
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
                    {g.items.length} giao dịch
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
            <span>TỔNG CỘNG THU</span>
            <Mono size={15} color="var(--status-delivered)">+{fmt(flow.in)}</Mono>
          </div>
        </div>
      </Card>

      {/* Cột Chi */}
      <Card title="Các khoản chi hoạt động (-)" icon="trending-down" padding="0">
        <div style={{ display: 'grid' }}>
          {outGroups.length === 0 ? (
            <div style={{ padding: 16, font: 'var(--type-caption)', color: 'var(--text-muted)', textAlign: 'center' }}>
              Chưa phát sinh khoản chi nào trong tháng.
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
                    {g.items.length} giao dịch
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
            <span>TỔNG CỘNG CHI</span>
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
        title={`Tổng kết quỹ tháng ${monthTxt(db.month)}`}
        subtitle="Báo cáo thu tiền anh em đóng và các khoản chi thuê sân, mua cầu thực tế của CLB"
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

/* ---------------- đối chiếu quỹ (Phase 9 · P7) ---------------- */

/**
 * Thủ quỹ gõ số tiền THẬT đang giữ; app so với sổ rồi liệt kê nghi vấn cụ thể.
 * Mọi phép tính nằm ở `ledger.js: reconcile` — màn này chỉ render.
 * Ô nhập đọc bằng `intOf` để gõ "3.387.000" có dấu chấm vẫn ra đúng số (P4.5).
 */
export function Reconcile() {
  const { db, ui, a } = useApp()
  const raw = ui.form.recCounted
  // Chưa gõ gì → truyền null để reconcile biết là "chưa đối chiếu", khác hẳn với đếm được 0 đồng.
  const r = reconcile(db, raw == null || raw === '' ? null : intOf(raw))
  const has = r.counted != null

  return (
    <Card title={t('fund.rec.title')} subtitle={t('fund.rec.sub')} icon="scale" padding="14px 16px">
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
        <div>
          <div style={S.caption}>{t('fund.rec.counted')}</div>
          <Input mono style={{ width: 190 }} value={raw ?? ''}
            onChange={(e) => a.setF('recCounted', e.target.value)} />
          <div style={{ ...S.caption, marginTop: 4, maxWidth: 260 }}>{t('fund.rec.countedHint')}</div>
        </div>
        <div style={{ ...S.row, gap: 18 }}>
          <div>
            <div style={S.caption}>{t('fund.rec.book')}</div>
            <Mono>{fmt(r.book)}</Mono>
          </div>
          <div>
            <div style={S.caption}>{t('fund.rec.diff')}</div>
            <Mono style={{ color: !has || r.diff === 0 ? 'var(--text-secondary)' : 'var(--status-incident)' }}>
              {has ? (r.diff > 0 ? '+' : '') + fmt(r.diff) : '—'}
            </Mono>
          </div>
        </div>
        {has && <Button variant="ghost" size="sm" icon="x" onClick={() => a.setF('recCounted', undefined)}>
          {t('fund.rec.reset')}
        </Button>}
      </div>

      <Alert
        tone={!has ? 'info' : r.diff === 0 ? 'success' : 'warning'}
        title={!has ? t('fund.rec.empty') : r.diff === 0 ? t('fund.rec.even')
          : t(r.diff > 0 ? 'fund.rec.more' : 'fund.rec.less', { amount: fmt(r.gap) })}
      />

      {r.suspects.length > 0 && (
        <>
          <Overline style={{ marginTop: 14 }}>{t('fund.rec.suspects')}</Overline>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {r.suspects.map((s) => (
              <div key={s.key} style={{
                ...S.row, alignItems: 'flex-start', flexDirection: 'column', gap: 4,
                borderColor: s.match ? 'var(--status-incident)' : 'var(--border-subtle)',
              }}>
                <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{ ...S.label, flex: 1 }}>
                    {t('fund.rec.' + s.key + '.title', { n: s.n, month: monthTxt(db.month) })}
                  </span>
                  <Mono>{s.amount == null ? t('fund.rec.unknown') : fmt(s.amount)}</Mono>
                  {s.match && <Badge tone="danger">{t('fund.rec.match')}</Badge>}
                </div>
                <span style={S.caption}>{t('fund.rec.' + s.key + '.body')}</span>
              </div>
            ))}
          </div>
        </>
      )}
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
