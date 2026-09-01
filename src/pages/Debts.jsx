// Công nợ: khách theo người rủ · khách theo người · quỹ tháng · back tiền (handoff 02 §5).

import { Alert, Avatar, Button, Card, IconButton, Input, Select, Tabs } from '#ds'
import { Empty, GRID_PAIR, Mono, Overline } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { ddmy, monthTxt } from '#utils/dates.js'
import {
  adjustRows, advanceRows, dueState, duesOf, duesTotal, fmt, fmtK, genderTxt, guestDebtByInviter,
  guestDebtRows, memberOf,
} from '#lib/money.js'
import { can } from '#lib/roles.js'
import { t } from '#i18n'

export default function Debts() {
  const { db, ui, a } = useApp()
  const tab = ui.tab.debts || 'guest'
  const canMoney = can(db.viewAs || 'owner', 'money')

  const guestRows = guestDebtRows(db, db.month).filter((r) => r.debt > 0)
  const dues = duesOf(db, db.month)
  const backs = adjustRows(db, db.month)
  // Khoản ứng KHÔNG lọc theo tháng: quỹ nợ người ta từ tháng 6 thì tháng 8 vẫn còn nợ.
  const advances = advanceRows(db)

  return (
    <>
      <Tabs
        variant="underline"
        items={[
          { value: 'guest', label: t('debts.tabGuest'), count: guestRows.length },
          { value: 'dues', label: t('debts.tabDues'), count: dues.filter((x) => dueState(x).remain > 0).length },
          { value: 'back', label: t('debts.tabBack'), count: backs.filter((x) => !x.paid).length },
          { value: 'advance', label: t('debts.tabAdvance'), count: advances.filter((x) => !x.repaidAt).length },
        ]}
        value={tab}
        onChange={(v) => a.setTab('debts', v)}
      />
      {tab === 'guest' && <GuestDebts rows={guestRows} canMoney={canMoney} />}
      {tab === 'dues' && <Dues dues={dues} canMoney={canMoney} />}
      {tab === 'back' && <Back rows={backs} canMoney={canMoney} />}
      {tab === 'advance' && <Advances rows={advances} canMoney={canMoney} />}
    </>
  )
}

/* ---------------- thành viên ứng tiền ---------------- */

/**
 * Quỹ nợ thành viên — LUẬT NGƯỜI GIỮ QUỸ. Dòng chưa trả thì khoản chi CHƯA nằm trong sổ quỹ,
 * nên số dư quỹ đang cao hơn số tiền thật sự tiêu được đúng bằng tổng ở đây.
 */
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

/* ---------------- khách giao lưu ---------------- */

function GuestDebts({ rows, canMoney }) {
  const { db, a } = useApp()
  const inviters = guestDebtByInviter(db, db.month).filter((r) => r.debt > 0)
  const total = rows.reduce((x, r) => x + r.debt, 0)

  if (!rows.length) {
    return (
      <Card padding="0">
        <Empty icon="circle-check" title={t('debts.noGuestDebt')} hint={t('debts.noGuestDebtHint')} />
      </Card>
    )
  }

  return (
    <div style={GRID_PAIR}>
      <Card title={t('debts.byInviterTitle')} subtitle={t('debts.byInviterSub')} icon="users" padding="14px 16px">
        <div style={{ display: 'grid', gap: 9 }}>
          {inviters.map((r) => (
            <div key={r.mid || 'none'} style={S.row}>
              <Avatar name={r.name} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.label}>{r.name}</div>
                <div style={S.caption}>{t('debts.byInviterMeta', { n: r.guests, paid: fmt(r.paid) })}</div>
              </div>
              <Mono weight={600} size={14} color="var(--status-delayed)">{fmt(r.debt)}</Mono>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title={t('debts.byGuestTitle')}
        subtitle={t('debts.byGuestSub', { month: monthTxt(db.month).toLowerCase() })}
        icon="user-round-x"
        padding="14px 16px"
        actions={<Mono weight={600} color="var(--status-delayed)">{t('debts.totalDebt', { amount: fmt(total) })}</Mono>}
      >
        <div style={{ display: 'grid', gap: 9 }}>
          {rows.map((r) => (
            <div key={r.guest.id} style={S.row}>
              <Avatar name={r.guest.name} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.label}>{r.guest.name}</div>
                <div style={S.caption}>
                  {t('debts.guestMeta', {
                    n: r.sessions, gender: genderTxt(r.guest.gender), level: r.guest.level,
                  })}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Mono weight={600} size={14} color="var(--status-delayed)">{fmt(r.debt)}</Mono>
                <div style={S.caption}>{t('debts.paidLabel') + ' ' + fmt(r.paidAmt)}</div>
              </div>
              {canMoney && (
                <Button variant="secondary" size="sm" icon="circle-check" onClick={() => a.collectDebt(r.guest.id)}>
                  {t('debts.collect')}
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
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
                      const key = 'due' + x.id
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
                          {/* Đã nhận / phải đóng — hiện cả hai để không phải nhẩm còn thiếu bao nhiêu. */}
                          <Mono color={st.state === 'full' ? 'var(--status-delivered)' : 'var(--text-primary)'}>
                            {fmtK(st.paid) + ' / ' + fmt(st.amount)}
                          </Mono>
                          {st.remain > 0 && (
                            <Mono color="var(--status-delayed)">{t('debts.dueRemain', { amount: fmtK(st.remain) })}</Mono>
                          )}
                          {canMoney && st.remain > 0 && (
                            <>
                              {/* Điền sẵn số còn thiếu: thu đủ thì bấm luôn, thu một phần thì sửa
                                  số. Số điền sẵn để THÔ (không dấu chấm) nhưng gõ có dấu chấm
                                  cũng đọc được — xem money.js: intOf. */}
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

/* ---------------- back tiền ---------------- */

/**
 * Đối chiếu buổi — HAI CHIỀU, cùng một đơn giá, chỉ khác dấu.
 *   amount ÂM  quỹ nợ người: cố định mà nghỉ, được trả lại
 *   amount DƯƠNG người nợ quỹ: đi thêm buổi của nhóm khác
 * Chưa bấm gì thì chỉ là khoản phải trả / phải thu, KHÔNG đụng vào quỹ.
 */
function Back({ rows, canMoney }) {
  const { a } = useApp()
  const open = rows.filter((r) => !r.paid)
  const owed = open.filter((r) => r.amount < 0).reduce((x, r) => x - r.amount, 0)
  const due = open.filter((r) => r.amount > 0).reduce((x, r) => x + r.amount, 0)

  return (
    <>
      <Alert tone="info" title={t('debts.backAlertTitle')}>{t('debts.backAlert')}</Alert>
      <Card
        title={t('debts.backTitle')}
        subtitle={t('debts.backSub')}
        icon="rotate-ccw"
        padding="0"
        actions={
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Mono weight={600} color="var(--status-incident)">{t('debts.totalBack', { amount: fmt(owed) })}</Mono>
            <Mono weight={600} color="var(--status-delivered)">{t('debts.totalExtra', { amount: fmt(due) })}</Mono>
          </div>
        }
      >
        {rows.length === 0
          ? <Empty icon="circle-check" title={t('debts.backEmpty')} hint={t('debts.backEmptyHint')} />
          : <div style={{ display: 'grid', overflowX: 'auto' }}>
              <div style={{ ...S.backGrid, ...S.backHead }}>
                <span>{t('debts.backColMember')}</span>
                <span>{t('debts.backColGroup')}</span>
                <span style={S.r}>{t('debts.backColAbsent')}</span>
                <span style={S.r}>{t('debts.backColTotal')}</span>
                <span style={S.r}>{t('debts.backColUnit')}</span>
                <span style={S.r}>{t('debts.backColAmount')}</span>
                <span>{t('debts.backColSettle')}</span>
                <span style={S.r}>{t('debts.backColStatus')}</span>
              </div>
              {rows.map((r) => {
                const back = r.amount < 0
                const offset = r.settle === 'offset_next_dues'
                return (
                  <div key={r.key} style={{ ...S.backGrid, ...S.backRow }}>
                    <span style={{ color: 'var(--text-primary)', font: 'var(--type-label)' }}>{r.member.name}</span>
                    <span style={S.caption}>
                      {r.group.name}
                      <span style={back ? S.kindBack : S.kindExtra}>{t('debts.kind.' + r.kind)}</span>
                      {/* Khoản đã lưu nhưng người đó không còn cố định nhóm này nữa. */}
                      {r.orphan && <span style={S.kindOrphan}>{t('debts.kindOrphan')}</span>}
                    </span>
                    <span style={S.r}>{r.sessions}</span>
                    <span style={S.r}>{r.total}</span>
                    <span style={S.r}>
                      {fmt(r.unit)}
                      {/* Số CLB tự chốt, không phải app chia ra — nói rõ để không ai đi dò lại. */}
                      {r.unitOverride && <span style={S.kindOrphan}>{t('debts.unitOwn')}</span>}
                    </span>
                    {/* Dấu là thông tin, không phải trang trí: − quỹ trả ra, + quỹ thu về. */}
                    <span style={{
                      ...S.r, fontWeight: 600,
                      color: back ? 'var(--status-incident)' : 'var(--status-delivered)',
                    }}>
                      {back ? `Trả: −${fmt(Math.abs(r.amount))}` : `Thu: +${fmt(Math.abs(r.amount))}`}
                    </span>
                    <span>
                      <Select size="sm" disabled={!canMoney || r.paid} value={r.settle}
                        options={[
                          { value: 'cash', label: t('debts.settle.cash') },
                          { value: 'offset_next_dues', label: t('debts.settle.offset_next_dues') },
                        ]}
                        onChange={(e) => a.setAdjustSettle(r.key, e.target.value)} />
                    </span>
                    <span style={{ ...S.r, display: 'flex', justifyContent: 'flex-end' }}>
                      <Button variant={r.paid ? 'ghost' : 'secondary'} size="sm" disabled={!canMoney}
                        icon={r.paid ? 'circle-check' : back ? 'send' : 'hand-coins'}
                        onClick={() => a.settleAdjust(r.key)}>
                        {r.paid
                          ? t(offset ? 'debts.adjustOffset' : 'debts.backPaid')
                          : t(back ? 'debts.backUnpaid' : 'debts.extraUncollected')}
                      </Button>
                    </span>
                  </div>
                )
              })}
            </div>}
        <div style={{ ...S.caption, padding: '10px 18px' }}>{t('debts.backNote')}</div>
      </Card>
    </>
  )
}

const S = {
  kindBack: {
    font: '600 9px/1 var(--font-sans)', padding: '3px 6px', borderRadius: 99, marginLeft: 6,
    background: 'var(--status-delayed-bg)', color: 'var(--status-delayed-fg)', whiteSpace: 'nowrap',
  },
  kindExtra: {
    font: '600 9px/1 var(--font-sans)', padding: '3px 6px', borderRadius: 99, marginLeft: 6,
    background: 'var(--status-delivered-bg)', color: 'var(--status-delivered-fg)', whiteSpace: 'nowrap',
  },
  kindOrphan: {
    font: '600 9px/1 var(--font-sans)', padding: '3px 6px', borderRadius: 99, marginLeft: 6,
    background: 'var(--status-idle-bg)', color: 'var(--status-idle-fg)', whiteSpace: 'nowrap',
  },
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
  // 8 cột: người · nhóm+loại · số buổi · tổng buổi · đơn giá · thành tiền · cách trả · trạng thái
  backGrid: { display: 'grid', gridTemplateColumns: '1.3fr 1.5fr .6fr .7fr .9fr 1fr 1.3fr 1.2fr', gap: 8, minWidth: 980 },
  backHead: {
    padding: '10px 18px', background: 'var(--surface-inset)', borderBottom: '1px solid var(--border-subtle)',
    font: 'var(--type-overline)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)',
    color: 'var(--text-muted)',
  },
  backRow: {
    padding: '10px 18px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center',
    font: 'var(--type-mono)', color: 'var(--text-secondary)',
  },
  r: { textAlign: 'right' },
}
