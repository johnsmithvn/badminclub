// Thành viên: danh sách · cố định tháng sau · thay đổi chờ duyệt (handoff 02 §5).
// Nguồn ai phải đóng quỹ là roster THEO THÁNG, không phải groupIds.

import { Avatar, Button, Card, DataTable, Tabs } from '#ds'
import { Empty, LevelChip, Mono, Overline } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { addMonth, monthTxt } from '#utils/dates.js'
import { duesOf, fmt, genderTxt, memberOf, rosterStatus } from '#lib/money.js'
import { editMemberForm, memberForm } from '#lib/forms.js'
import { can } from '#lib/roles.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }

export default function Members() {
  const { db, ui, a } = useApp()
  const tab = ui.tab.members || 'all'
  const canEdit = can(db.viewAs || 'owner', 'members')
  const nextM = addMonth(db.month, 1)
  const pendingChanges = db.changes.filter((c) => c.status === 'pending')

  return (
    <>
      <Tabs
        variant="underline"
        items={[
          { value: 'all', label: t('members.tabAll'), count: db.members.filter((m) => m.active !== false).length },
          { value: 'next', label: t('members.tabNext') },
          { value: 'pending', label: t('members.tabPending'), count: pendingChanges.length },
        ]}
        value={tab}
        onChange={(v) => a.setTab('members', v)}
      />
      {tab === 'all' && <AllMembers canEdit={canEdit} />}
      {tab === 'next' && <NextMonth month={nextM} canEdit={canEdit} />}
      {tab === 'pending' && <Pending canEdit={canEdit} />}
    </>
  )
}

/* ---------------- tab Tất cả ---------------- */

function AllMembers({ canEdit }) {
  const { db, a } = useApp()
  const active = db.members.filter((m) => m.active !== false)
  const dues = duesOf(db, db.month)

  const columns = [
    {
      key: 'n', header: t('members.colName'),
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar name={r.name} size={26} />
          <span style={{ font: 'var(--type-label)', color: 'var(--text-primary)' }}>{r.name}</span>
        </div>
      ),
    },
    { key: 'g', header: t('members.colGender'), render: (r) => genderTxt(r.gender) },
    {
      key: 'l', header: t('members.colLevel'),
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <LevelChip level={r.level} />
          {r.pendingLevel && (
            <span style={{ font: 'var(--type-caption)', color: 'var(--status-delayed)' }}>
              {t('members.pendingLevel', { level: r.pendingLevel, month: r.pendingLevelFrom })}
            </span>
          )}
        </div>
      ),
    },
    { key: 'p', header: t('members.colPhone'), mono: true, muted: true, render: (r) => r.phone || t('common.unknown') },
    {
      key: 'gr', header: t('members.colGroups'),
      render: (r) => {
        const gs = db.groups.filter((g) => rosterStatus(db, db.month, g.id, r.id) === 'fixed')
        return gs.length
          ? gs.map((g) => g.short || g.name).join(', ')
          : <span style={{ color: 'var(--text-muted)' }}>{t('members.noGroup')}</span>
      },
    },
    {
      key: 'd', header: t('members.colDues'), align: 'right',
      render: (r) => {
        const mine = dues.filter((x) => x.memberId === r.id)
        if (!mine.length) return <span style={{ color: 'var(--text-disabled)' }}>{t('members.duesNone')}</span>
        const unpaid = mine.filter((x) => !x.paid)
        return (
          <span style={{
            font: 'var(--type-label)',
            color: unpaid.length ? 'var(--status-delayed)' : 'var(--status-delivered)',
          }}>
            {unpaid.length
              ? t('members.duesUnpaid') + ' · ' + fmt(unpaid.reduce((x, y) => x + y.amount, 0))
              : t('members.duesPaid')}
          </span>
        )
      },
    },
    {
      key: 'a', header: '',
      render: (r) => canEdit && (
        <Button variant="ghost" size="sm" icon="settings-2"
          onClick={() => a.openDialog('editMember', editMemberForm(r))}>
          {t('common.edit')}
        </Button>
      ),
    },
  ]

  return (
    <Card
      title={t('members.listTitle')}
      subtitle={t('members.listSub', { n: active.length })}
      icon="users"
      padding="0"
      actions={canEdit && (
        <Button variant="primary" size="sm" icon="user-round-plus"
          onClick={() => a.openDialog('addMember', memberForm(db))}>
          {t('members.addMember')}
        </Button>
      )}
    >
      {active.length === 0
        ? <Empty icon="users" title={t('members.empty')} hint={t('members.emptyHint')} />
        : <DataTable columns={columns} rows={active} rowKey="id" />}
    </Card>
  )
}

/* ---------------- tab Cố định tháng sau ---------------- */

function NextMonth({ month, canEdit }) {
  const { db, a } = useApp()
  const locked = !!db.locked[month]
  const day = parseInt(db.today.slice(8, 10), 10)
  const lockDay = db.club.lockDay || cfg.club.defaultLockDay
  const daysLeft = lockDay - day

  return (
    <>
      <Card
        title={t('members.nextTitle', { month: monthTxt(month).toLowerCase() })}
        subtitle={t('members.nextSub')}
        icon="calendar-days"
        padding="14px 16px"
        actions={canEdit && (
          <Button variant={locked ? 'secondary' : 'primary'} size="sm" icon={locked ? 'rotate-ccw' : 'check'}
            onClick={() => a.lockRoster(month)}>
            {t(locked ? 'members.unlock' : 'members.lockNow')}
          </Button>
        )}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ font: 'var(--type-caption)', color: locked ? 'var(--status-delivered)' : 'var(--text-muted)' }}>
            {locked
              ? t('members.locked')
              : daysLeft > 0
                ? t('members.lockHint', { days: daysLeft, day: lockDay })
                : t('members.lockPassed', { day: lockDay })}
          </div>

          {db.groups.map((g) => (
            <div key={g.id} style={{ display: 'grid', gap: 7 }}>
              <Overline>{g.name}</Overline>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {db.members.filter((m) => m.active !== false).map((m) => {
                  const st = rosterStatus(db, month, g.id, m.id)
                  const color = {
                    fixed: ['var(--surface-accent-soft)', 'var(--teal-500)', 'var(--text-primary)'],
                    off: ['var(--surface-sunken)', 'var(--border-subtle)', 'var(--text-muted)'],
                    pending: ['var(--status-delayed-bg)', 'var(--status-delayed)', 'var(--status-delayed-fg)'],
                    none: ['var(--surface-card)', 'var(--border-subtle)', 'var(--text-muted)'],
                  }[st]
                  // Bấm để đổi vòng: none → fixed → off → none
                  const next = st === 'fixed' ? 'off' : st === 'off' ? 'none' : 'fixed'
                  return (
                    <button key={m.id} type="button" disabled={!canEdit || locked}
                      onClick={() => a.setRoster(month, g.id, m.id, next)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px', borderRadius: 99,
                        background: color[0], border: '1px solid ' + color[1], color: color[2],
                        cursor: canEdit && !locked ? 'pointer' : 'default', font: 'inherit',
                      }}>
                      <span style={{ font: 'var(--type-label)' }}>{m.name}</span>
                      <span style={{ font: 'var(--type-caption)', opacity: 0.85 }}>{t('rosterState.' + st)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title={t('members.registerTitle')} subtitle={t('members.registerSub')} icon="user-round-plus" padding="14px 16px">
        <div style={{ display: 'grid', gap: 8 }}>
          {(() => {
            const rows = []
            db.groups.forEach((g) => {
              const r = (db.roster[month] || {})[g.id] || {}
              Object.keys(r).forEach((mid) => {
                if (r[mid] === 'pending') rows.push({ g, m: memberOf(db, mid), mid })
              })
            })
            if (!rows.length) {
              return <Empty icon="circle-check" title={t('members.registerEmpty')} hint={t('members.registerEmptyHint')} />
            }
            return rows.map((x) => (
              <div key={x.g.id + x.mid} style={S.row}>
                <Avatar name={x.m.name} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.label}>{x.m.name}</div>
                  <Mono color="var(--text-muted)">{x.g.name + ' · ' + monthTxt(month).toLowerCase()}</Mono>
                </div>
                {canEdit && (
                  <>
                    <Button variant="primary" size="sm" icon="check"
                      onClick={() => a.setRoster(month, x.g.id, x.mid, 'fixed')}>{t('members.approve')}</Button>
                    <Button variant="ghost" size="sm" icon="circle-x"
                      onClick={() => a.setRoster(month, x.g.id, x.mid, 'none')}>{t('members.reject')}</Button>
                  </>
                )}
              </div>
            ))
          })()}
        </div>
      </Card>
    </>
  )
}

/* ---------------- tab Chờ duyệt ---------------- */

function Pending({ canEdit }) {
  const { db, a } = useApp()
  const rows = db.changes.filter((c) => c.status === 'pending')

  return (
    <Card title={t('members.changesTitle')} subtitle={t('members.changesSub')} icon="settings-2" padding="14px 16px">
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.length === 0
          ? <Empty icon="circle-check" title={t('members.changesEmpty')} hint={t('members.changesEmptyHint')} />
          : rows.map((c) => {
              const m = memberOf(db, c.memberId)
              return (
                <div key={c.id} style={S.row}>
                  <Avatar name={m.name} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.label}>
                      {m.name + ' · ' + t('members.changeField.' + c.field)}
                    </div>
                    <Mono color="var(--text-muted)">
                      {t('members.changeArrow', { from: c.from, to: c.to }) + ' · ' +
                        t(c.effective === 'now' ? 'members.changeNow' : 'members.changeNext')}
                    </Mono>
                  </div>
                  {canEdit && (
                    <>
                      <Button variant="primary" size="sm" icon="check"
                        onClick={() => a.approveChange(c.id, true)}>{t('members.approve')}</Button>
                      <Button variant="ghost" size="sm" icon="circle-x"
                        onClick={() => a.approveChange(c.id, false)}>{t('members.reject')}</Button>
                    </>
                  )}
                </div>
              )
            })}
      </div>
    </Card>
  )
}

const S = {
  row: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '9px 11px',
    border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--surface-card)',
  },
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
}
