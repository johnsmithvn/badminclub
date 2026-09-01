// Thành viên: danh sách · cố định tháng sau · thay đổi chờ duyệt (handoff 02 §5).
// Nguồn ai phải đóng quỹ là roster THEO THÁNG, không phải groupIds.

import { useState } from 'react'
import { Avatar, Button, Card, DataTable, IconButton, Tabs } from '#ds'
import { Empty, LevelChip, Mono, Overline } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { addMonth, monthShort, monthTxt } from '#utils/dates.js'
import { dueState, duesOf, duesTotal, fmt, genderTxt, memberOf, memberRefs, offBackSuggest, rosterStatus } from '#lib/money.js'
import { editMemberForm, memberForm } from '#lib/forms.js'
import { can } from '#lib/roles.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }

export default function Members() {
  const { db, ui, a } = useApp()
  const tab = ui.tab.members || 'all'
  const canEdit = can(db.viewAs || 'owner', 'members')
  // Chốt danh sách được cho CẢ tháng đang xem, không chỉ tháng sau. Dựng CLB giữa tháng thì
  // việc đầu tiên phải làm là chốt danh sách THÁNG NÀY để có quỹ tháng mà thu.
  const rosterWhen = ui.tab.roster || 'next'
  const rosterM = rosterWhen === 'this' ? db.month : addMonth(db.month, 1)
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
      {tab === 'next' && <NextMonth month={rosterM} canEdit={canEdit} />}
      {tab === 'pending' && <Pending canEdit={canEdit} />}
    </>
  )
}

/* ---------------- tab Tất cả ---------------- */

function AllMembers({ canEdit }) {
  const { db, ui, a } = useApp()
  const [selectedIds, setSelectedIds] = useState([])

  const off = db.members.filter((m) => m.active === false)
  const showOff = off.length > 0 && (ui.tab.mstate || 'on') === 'off'
  const rows = showOff ? off : db.members.filter((m) => m.active !== false)
  const dues = duesOf(db, db.month)

  const isAllSelected = rows.length > 0 && selectedIds.length === rows.length
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < rows.length

  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedIds([])
    else setSelectedIds(rows.map((r) => r.id))
  }

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.concat([id])))
  }

  const columns = [
    ...(canEdit ? [{
      key: 'sel', width: 42, align: 'center',
      header: (
        <input
          type="checkbox"
          checked={isAllSelected}
          ref={(el) => { if (el) el.indeterminate = isSomeSelected }}
          onChange={toggleSelectAll}
          style={{ cursor: 'pointer', margin: 0 }}
        />
      ),
      render: (r) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(r.id)}
          onChange={() => toggleSelectOne(r.id)}
          style={{ cursor: 'pointer', margin: 0 }}
        />
      ),
    }] : []),
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
          <LevelChip level={r.level} levels={db.levels} />
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
        const unpaid = mine.filter((x) => dueState(x).remain > 0)
        return (
          <span style={{
            font: 'var(--type-label)',
            color: unpaid.length ? 'var(--status-delayed)' : 'var(--status-delivered)',
          }}>
            {unpaid.length
              ? t('members.duesUnpaid') + ' · ' + fmt(duesTotal(unpaid).remain)
              : t('members.duesPaid')}
          </span>
        )
      },
    },
    {
      key: 'st', header: 'Trạng thái', width: 95,
      render: (r) => (
        r.active === false ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '2px 8px', borderRadius: 99,
            background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)',
            font: '600 11px var(--font-sans)', color: 'var(--text-muted)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-disabled)' }} />
            Inactive
          </span>
        ) : (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '2px 8px', borderRadius: 99,
            background: 'var(--surface-accent-soft)', border: '1px solid var(--teal-500)',
            font: '600 11px var(--font-sans)', color: 'var(--teal-700)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-delivered)' }} />
            Active
          </span>
        )
      ),
    },
    {
      key: 'a', header: '',
      render: (r) => canEdit && (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" icon="settings-2"
            onClick={() => a.openDialog('editMember', editMemberForm(r))}>
            {t('common.edit')}
          </Button>
          {/* Ngưng hoạt động (Inactive) giữ nguyên lịch sử; xoá cứng chỉ mở khi chưa dính gì. */}
          <IconButton icon={r.active === false ? 'rotate-ccw' : 'user-round-minus'} size="sm" variant="ghost"
            label={r.active === false ? 'Kích hoạt lại (Active)' : 'Chuyển Inactive (Ngưng hoạt động)'}
            onClick={() => {
              if (r.active === false) return a.reactivate(r.id)
              const s = offBackSuggest(db, r.id)
              return s
                ? a.openDialog('offBack', { obId: r.id, obAmount: String(s.amount || '') })
                : a.deactivate(r.id, 0)
            }} />
          {!memberRefs(db, r.id).length ? (
            <IconButton icon="trash-2" size="sm" variant="ghost"
              label={t('common.delete')} onClick={() => a.deleteMember(r.id)} />
          ) : (
            <span
              title="Đã phát sinh lịch sử (điểm danh / tiền quỹ) — không cho phép xoá để bảo toàn sổ sách. Hãy dùng nút Inactive bên cạnh."
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                opacity: 0.4, cursor: 'not-allowed',
              }}
            >
              <IconButton icon="lock" size="sm" variant="ghost" disabled label="Đã có lịch sử sinh hoạt" />
            </span>
          )}
        </div>
      ),
    },
  ]

  return (
    <Card
      title={t('members.listTitle')}
      subtitle={t(showOff ? 'members.listSubOff' : 'members.listSub', { n: rows.length })}
      icon="users"
      padding="0"
      actions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {off.length > 0 && (
            <Tabs
              variant="segmented"
              items={[
                { value: 'on', label: 'Active' },
                { value: 'off', label: 'Inactive', count: off.length },
              ]}
              value={ui.tab.mstate || 'on'}
              onChange={(v) => a.setTab('mstate', v)}
            />
          )}
          {canEdit && (
            <>
              <Button variant="secondary" size="sm" icon="file-spreadsheet"
                onClick={() => a.openDialog('importMembers', {})}>
                {t('members.importCsv')}
              </Button>
              <Button variant="primary" size="sm" icon="user-round-plus"
                onClick={() => a.openDialog('addMember', memberForm(db))}>
                {t('members.addMember')}
              </Button>
            </>
          )}
        </div>
      }
    >
      {canEdit && selectedIds.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', background: 'var(--surface-brand-soft)',
          borderBottom: '1px solid var(--teal-500)', flexWrap: 'wrap', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ font: 'var(--type-label)', fontWeight: 600, color: 'var(--navy-800)' }}>
              Đã chọn {selectedIds.length} / {rows.length} người
            </span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
              Bỏ chọn
            </Button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>Gán ca:</span>
            {db.groups.map((g) => (
              <Button
                key={g.id}
                variant="secondary"
                size="sm"
                onClick={() => {
                  a.setMembersGroupsBulk(selectedIds, [g.id])
                  setSelectedIds([])
                }}
              >
                {g.short || g.name}
              </Button>
            ))}
            {db.groups.length > 1 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  a.setMembersGroupsBulk(selectedIds, db.groups.map((g) => g.id))
                  setSelectedIds([])
                }}
              >
                Cả {db.groups.length} ca
              </Button>
            )}

            <div style={{ width: 1, height: 18, background: 'var(--border-default)', margin: '0 4px' }} />

            <Button
              variant="ghost"
              size="sm"
              icon="user-minus"
              onClick={() => {
                a.setMembersGroupsBulk(selectedIds, [])
                setSelectedIds([])
              }}
            >
              Bỏ cố định (Đi lẻ)
            </Button>

            {!showOff ? (
              <Button
                variant="secondary"
                size="sm"
                icon="user-round-minus"
                onClick={() => {
                  if (window.confirm(`Chuyển ${selectedIds.length} thành viên sang trạng thái Inactive (lịch sử điểm danh và quỹ được giữ nguyên 100%)?`)) {
                    a.deactivateMembersBulk(selectedIds)
                    setSelectedIds([])
                  }
                }}
              >
                Chuyển Inactive
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                icon="rotate-ccw"
                onClick={() => {
                  a.reactivateMembersBulk(selectedIds)
                  setSelectedIds([])
                }}
              >
                Kích hoạt Active
              </Button>
            )}

            <Button
              variant="danger"
              size="sm"
              icon="trash-2"
              onClick={() => {
                const blocked = selectedIds.filter((id) => memberRefs(db, id).length > 0)
                if (blocked.length === selectedIds.length) {
                  return alert('Tất cả thành viên đã chọn đều đã có dữ liệu (điểm danh/quỹ). Hệ thống không cho phép xoá vĩnh viễn để bảo toàn lịch sử. Hãy bấm nút "Ngưng hoạt động (Off)" bên cạnh!')
                }
                const msg = blocked.length > 0
                  ? `Có ${selectedIds.length - blocked.length} người chưa có dữ liệu sẽ bị xoá. Còn ${blocked.length} người đã có dữ liệu sinh hoạt sẽ được giữ lại an toàn. Bạn có muốn tiếp tục?`
                  : `Bạn có chắc chắn muốn xoá vĩnh viễn ${selectedIds.length} thành viên này?`
                if (window.confirm(msg)) {
                  a.deleteMembersBulk(selectedIds)
                  setSelectedIds([])
                }
              }}
            >
              Xoá vĩnh viễn
            </Button>
          </div>
        </div>
      )}
      {rows.length === 0
        ? <Empty icon="users" title={t('members.empty')} hint={t('members.emptyHint')} />
        : <DataTable columns={columns} rows={rows} rowKey="id" />}
    </Card>
  )
}

/* ---------------- tab Cố định tháng sau ---------------- */

function NextMonth({ month, canEdit }) {
  const { db, ui, a } = useApp()
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
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Tabs
              variant="segmented"
              items={[
                { value: 'this', label: t('members.rosterThis', { month: monthShort(db.month) }) },
                { value: 'next', label: t('members.rosterNext', { month: monthShort(addMonth(db.month, 1)) }) },
              ]}
              value={ui.tab.roster || 'next'}
              onChange={(v) => a.setTab('roster', v)}
            />
            {canEdit && (
              <Button variant={locked ? 'secondary' : 'primary'} size="sm" icon={locked ? 'rotate-ccw' : 'check'}
                onClick={() => a.lockRoster(month)}>
                {t(locked ? 'members.unlock' : 'members.lockNow')}
              </Button>
            )}
          </div>
        }
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
