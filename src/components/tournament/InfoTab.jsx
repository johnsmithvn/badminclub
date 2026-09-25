import { useState } from 'react'
import { Button, Card, Dialog, IconButton, Input } from '#ds'
import { Mono } from '#ui'
import { fmtK, genderTxt, intOf } from '#lib/money.js'
import { tournamentMoney } from '#lib/tournament/finance.js'
import { t } from '#i18n'
import { tourMeta } from './tourUtils.js'

const col = { display: 'grid', gap: 16, alignContent: 'start' }

/** Một dòng bảng kê: nhãn trái, số mono phải. `tone`: 'in' xanh (thu), 'out' đỏ (chi). */
function Row({ label, value, strong, tone, sub, action }) {
  const color = tone === 'in' ? 'var(--status-delivered-fg)' : tone === 'out' ? 'var(--status-incident-fg)' : 'var(--text-primary)'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, minHeight: 40,
      borderTop: strong ? '1px solid var(--border-default)' : '1px solid var(--border-subtle)',
    }}>
      <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 3 }}>
        <span style={{ font: `${strong ? 600 : 400} 13px/1.3 var(--font-sans)`, color: strong ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
          {label}
        </span>
        {sub && <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{sub}</span>}
      </span>
      <Mono weight={strong ? 700 : 500} size={strong ? 14 : 13} color={color}>{value}</Mono>
      {action}
    </div>
  )
}

/**
 * Thông tin & giải thưởng — thứ tự đúng handoff: thời gian & địa điểm · lệ phí · tổng thu · dự trù chi ·
 * tiền thưởng (tự tính) · tổng chi · cơ cấu giải · quy định. Tiền CHỈ ĐỂ XEM, không ghi Sổ quỹ (plan D2).
 */
export default function InfoTab({ tour, canEdit, isMobile, a, onEdit }) {
  const [line, setLine] = useState(null) // { table, row }
  const active = tour.registrations.filter((r) => r.status === 'registered')
  const money = tournamentMoney({
    registrations: tour.registrations, prizes: tour.prizes, budgetLines: tour.budgetLines, eventCount: tour.events.length,
  })
  const byGender = (g) => active.filter((r) => r.gender === g)
  const del = (table, id) => (canEdit ? <IconButton icon="trash-2" size="sm" label={t('tournament.line.delete')}
    onClick={() => a.tourDeleteLine(table, id)} /> : null)
  const open = (table, row) => canEdit && setLine({ table, row })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1fr) minmax(0,1.15fr)', gap: 16 }}>
      <div style={col}>
        <Card title={t('tournament.info.timePlace')} icon="calendar-days"
          actions={canEdit && <Button size="sm" variant="secondary" icon="pencil" onClick={onEdit}>{t('common.edit')}</Button>}>
          <div style={{ display: 'grid', gap: 10 }}>
            <Mono size={13} color="var(--text-primary)" style={{ whiteSpace: 'normal' }}>{tourMeta(tour)}</Mono>
            {tour.courtLabels.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tour.courtLabels.map((c) => (
                  <span key={c} style={{
                    font: '600 11px/1 var(--font-mono)', padding: '5px 9px', borderRadius: 99,
                    background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)',
                  }}>{c}</span>
                ))}
              </div>
            )}
          </div>
        </Card>
        <RulesCard tour={tour} canEdit={canEdit} a={a} />
      </div>

      <div style={col}>
        <Card title={t('tournament.info.fees')} subtitle={t('tournament.info.feeNote')} icon="wallet" padding="10px 18px 12px">
          {['nam', 'nu'].map((g) => (
            <Row key={g} label={t('tournament.info.feeRow', { gender: genderTxt(g), n: byGender(g).length })}
              value={fmtK(byGender(g).reduce((s, r) => s + r.fee, 0))} />
          ))}
          <Row strong tone="in" label={t('tournament.info.revenue')} value={fmtK(money.expected)}
            sub={t('tournament.info.collected', { paid: fmtK(money.collected), total: fmtK(money.expected) })} />

          <SectionHead title={t('tournament.info.budget')} add={canEdit && t('tournament.info.addBudget')}
            onAdd={() => open('tournament_budget_lines', null)} />
          {tour.budgetLines.length === 0 && <Muted>{t('tournament.info.emptyBudget')}</Muted>}
          {tour.budgetLines.map((b) => (
            <Clickable key={b.id} on={canEdit} onClick={() => open('tournament_budget_lines', b)}>
              <Row label={b.label} value={fmtK(b.amount)} action={del('tournament_budget_lines', b.id)} />
            </Clickable>
          ))}
          <Row label={t('tournament.info.prizeLine')} value={fmtK(money.prizeTotal)} />
          <Row strong tone="out" label={t('tournament.info.out')} value={fmtK(money.plannedOut)} />
          <Row strong tone={money.balance >= 0 ? 'in' : 'out'} value={fmtK(money.balance)}
            label={t(money.balance >= 0 ? 'tournament.info.surplus' : 'tournament.info.deficit')}
            sub={t('tournament.info.balanceNote')} />
          <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', paddingTop: 8 }}>
            {t('tournament.info.feeNow', { male: fmtK(tour.feeMale), female: fmtK(tour.feeFemale) })}
          </div>
        </Card>

        <Card title={t('tournament.info.prizes')} icon="medal" padding="10px 18px 12px"
          subtitle={tour.events.length > 0 ? t('tournament.info.prizeTimes', { n: tour.events.length }) : undefined}
          actions={canEdit && <Button size="sm" variant="secondary" icon="plus" onClick={() => open('tournament_prizes', null)}>
            {t('tournament.info.addPrize')}</Button>}>
          {tour.prizes.length === 0 && <Muted>{t('tournament.info.emptyPrizes')}</Muted>}
          {tour.prizes.map((p) => (
            <Clickable key={p.id} on={canEdit} onClick={() => open('tournament_prizes', p)}>
              <Row label={p.label} sub={p.description || undefined}
                value={fmtK(p.cash) + ' ' + t('tournament.info.perTeam')} action={del('tournament_prizes', p.id)} />
            </Clickable>
          ))}
        </Card>
      </div>

      {line && <LineDialog {...line} nextRank={tour.prizes.length + 1} nextSort={tour.budgetLines.length} onClose={() => setLine(null)}
        onSave={(row) => a.tourSaveLine(line.table, row)} />}
    </div>
  )
}

const Muted = ({ children }) => (
  <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', padding: '10px 0' }}>{children}</div>
)

function SectionHead({ title, add, onAdd }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 14, paddingBottom: 4 }}>
      <span style={{ flex: 1, font: 'var(--type-overline)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', color: 'var(--text-muted)' }}>
        {title}
      </span>
      {add && <Button size="sm" variant="ghost" icon="plus" onClick={onAdd}>{add}</Button>}
    </div>
  )
}

/** Dòng bấm được để sửa (chỉ khi có quyền). Nút xoá bên trong tự chặn nổi bọt. */
const Clickable = ({ on, onClick, children }) => (
  <div role={on ? 'button' : undefined} tabIndex={on ? 0 : undefined} style={{ cursor: on ? 'pointer' : 'default' }}
    onClick={(e) => { if (on && !e.target.closest('button')) onClick() }}
    onKeyDown={(e) => { if (on && e.key === 'Enter' && e.target === e.currentTarget) onClick() }}>
    {children}
  </div>
)

function RulesCard({ tour, canEdit, a }) {
  const [draft, setDraft] = useState('')
  const save = (rules) => a.tourUpdate({ rules })
  const add = async () => {
    const r = draft.trim()
    if (r && await save([...tour.rules, r])) setDraft('')
  }
  return (
    <Card title={t('tournament.info.rules')} icon="clipboard-check">
      <div style={{ display: 'grid', gap: 8 }}>
        {tour.rules.length === 0 && <Muted>{t('tournament.info.emptyRules')}</Muted>}
        {tour.rules.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Mono size={12} color="var(--text-muted)" style={{ paddingTop: 2 }}>{String(i + 1).padStart(2, '0')}</Mono>
            <span style={{ flex: 1, font: '400 13.5px/1.45 var(--font-sans)', color: 'var(--text-primary)' }}>{r}</span>
            {canEdit && <IconButton icon="trash-2" size="sm" label={t('common.delete')}
              onClick={() => save(tour.rules.filter((_, j) => j !== i))} />}
          </div>
        ))}
        {canEdit && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', paddingTop: 4 }}>
            <Input containerStyle={{ flex: 1 }} placeholder={t('tournament.info.rulePlaceholder')} value={draft}
              onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
            <Button variant="secondary" icon="plus" disabled={!draft.trim()} onClick={add}>{t('tournament.info.addRule')}</Button>
          </div>
        )}
      </div>
    </Card>
  )
}

/** Thêm / sửa một khoản chi dự trù hoặc một giải thưởng. */
function LineDialog({ table, row, nextRank, nextSort, onClose, onSave }) {
  const prize = table === 'tournament_prizes'
  const [f, setF] = useState(() => ({
    label: row?.label || '',
    amount: row ? fmtK(prize ? row.cash : row.amount) : '',
    rank: String(row?.rank || nextRank),
    description: row?.description || '',
  }))
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const ok = f.label.trim() && (!prize || intOf(f.rank) > 0)

  const submit = async () => {
    setBusy(true)
    const base = { id: row?.id, label: f.label.trim() }
    const saved = await onSave(prize
      ? { ...base, rank: intOf(f.rank), cash: intOf(f.amount), description: f.description.trim(), eventId: row?.eventId || null }
      : { ...base, amount: intOf(f.amount), sortOrder: row ? row.sortOrder : nextSort })
    if (saved) onClose()
    else setBusy(false)
  }

  return (
    <Dialog open width={440} title={t(prize ? 'tournament.line.prizeTitle' : 'tournament.line.budgetTitle')}
      onClose={busy ? undefined : onClose}
      footer={(
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>{t('common.cancel')}</Button>
          <Button loading={busy} disabled={!ok} onClick={submit}>{t('common.save')}</Button>
        </>
      )}>
      <div style={{ display: 'grid', gap: 14 }}>
        {prize && <Input label={t('tournament.line.rank')} mono inputMode="numeric" value={f.rank} onChange={set('rank')} />}
        <Input label={t(prize ? 'tournament.line.prizeLabel' : 'tournament.line.label')} value={f.label} onChange={set('label')} autoFocus />
        <Input label={t(prize ? 'tournament.line.cash' : 'tournament.line.amount')} mono inputMode="numeric"
          suffix={t('units.dong')} value={f.amount} onChange={set('amount')} />
        {prize && <Input label={t('tournament.line.desc')} hint={t('tournament.line.descHint')} value={f.description}
          onChange={set('description')} />}
      </div>
    </Dialog>
  )
}
