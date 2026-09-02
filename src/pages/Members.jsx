// Thành viên: danh sách · cố định tháng sau · thay đổi chờ duyệt (handoff 02 §5).
// Nguồn ai phải đóng quỹ là roster THEO THÁNG, không phải groupIds.

import { useMemo, useState } from 'react'
import { Avatar, Button, Card, DataTable, Dialog, Icon, IconButton, Input, SearchField, Select, Tabs } from '#ds'
import { EditGuestDialog, Empty, LevelChip, Mono, Overline, QrModal } from '#ui'
import { findBank, getVietQrUrl } from '#utils/vietqr.js'
import { useApp } from '#contexts/AppContext.jsx'
import { ddmy, monthTxt } from '#utils/dates.js'
import { dueState, duesOf, duesTotal, fmt, genderTxt, memberOf, levelOf, memberRefs, nextLevelStep, offBackSuggest, rosterStatus, guestStats, normalizeText } from '#lib/money.js'
import { FILTER0, duesStatusOf, filterMembers, fixedGroups, hasFilter, nextSort, sortMembers } from '#lib/members.js'
import { editMemberForm, memberForm } from '#lib/forms.js'
import { can } from '#lib/roles.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }

export default function Members() {
  const { db, ui, a } = useApp()
  const tab = ui.tab.members || 'all'
  const role = db.viewAs || 'owner'
  const canEdit = can(role, 'members')
  const canEditGuest = can(role, 'members') || can(role, 'sessions')
  const rosterM = db.month
  const pendingChanges = db.changes.filter((c) => c.status === 'pending')

  return (
    <>
      <Tabs
        variant="underline"
        items={[
          { value: 'all', label: t('members.tabAll'), count: db.members.filter((m) => m.active !== false).length },
          { value: 'next', label: t('members.tabNext') },
          { value: 'guests', label: t('members.tabGuests'), count: (db.guests || []).length },
          { value: 'pending', label: t('members.tabPending'), count: pendingChanges.length },
        ]}
        value={tab}
        onChange={(v) => a.setTab('members', v)}
      />
      {tab === 'all' && <AllMembers canEdit={canEdit} />}
      {tab === 'next' && <NextMonth month={rosterM} canEdit={canEdit} />}
      {tab === 'guests' && <GuestMembers canEdit={canEditGuest} />}
      {tab === 'pending' && <Pending canEdit={canEdit} />}
    </>
  )
}

/* ---------------- tab Tất cả ---------------- */

function AllMembers({ canEdit }) {
  const { db, ui, a } = useApp()
  const [selectedIds, setSelectedIds] = useState([])
  const [flt, setFlt] = useState(FILTER0)
  const [sort, setSort] = useState({})
  const [qrMember, setQrMember] = useState(null)
  const setF = (k, v) => setFlt((s) => ({ ...s, [k]: v }))

  const off = db.members.filter((m) => m.active === false)
  const showOff = off.length > 0 && (ui.tab.mstate || 'on') === 'off'
  const base = showOff ? off : db.members.filter((m) => m.active !== false)
  const dues = duesOf(db, db.month)

  const rows = useMemo(
    () => sortMembers(db, filterMembers(db, base, flt, db.month), sort, db.month),
    [db, base, flt, sort]
  )

  // Chọn xong rồi mới lọc thì trong `selectedIds` còn id đã bị ẩn. Mọi thao tác hàng loạt
  // chạy trên `selected` (đã cắt về những dòng ĐANG thấy) — không thì bấm "Xoá vĩnh viễn"
  // xoá cả người không hiện trên màn hình, và không có gì nói cho người bấm biết.
  const visible = new Set(rows.map((r) => r.id))
  const selected = selectedIds.filter((id) => visible.has(id))

  const isAllSelected = rows.length > 0 && selected.length === rows.length
  const isSomeSelected = selected.length > 0 && selected.length < rows.length

  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedIds([])
    else setSelectedIds(rows.map((r) => r.id))
  }

  /** Tiêu đề bấm được. `header` của DataTable nhận node nên không phải sửa DS (file sinh ra). */
  const sortHead = (key, label) => {
    const on = sort.key === key
    return (
      <button type="button" onClick={() => setSort(nextSort(sort, key))} style={S.sortBtn}>
        {label}
        {/* Không có icon chevron-up trong bảng icon — xoay chevron-down 180° cho chiều xuôi. */}
        <Icon name="chevron-down" size={12} style={{
          opacity: on ? 1 : 0.25,
          transform: on && sort.dir === 'asc' ? 'rotate(180deg)' : 'none',
        }} />
      </button>
    )
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
      key: 'n', header: sortHead('n', t('members.colName')),
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar name={r.name} src={r.avatarUrl} size={26} />
          {/* `name` là TÊN HIỂN THỊ — cái nằm trên mọi bảng điểm danh và dòng tiền. `fullName`
              chỉ để đối chiếu nên đứng dưới, cỡ caption, không thay chỗ của tên hiển thị. */}
          <div style={{ minWidth: 0 }}>
            <div style={{ font: 'var(--type-label)', color: 'var(--text-primary)' }}>{r.name}</div>
            {r.fullName && (
              <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{r.fullName}</div>
            )}
          </div>
        </div>
      ),
    },
    { key: 'g', header: sortHead('g', t('members.colGender')), render: (r) => genderTxt(r.gender) },
    {
      key: 'l', header: sortHead('l', t('members.colLevel')),
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {/* Trình độ của THÁNG ĐANG XEM, không phải ô `level` gốc: có mốc đổi trong quá khứ
              thì hai cái đó khác nhau, và cột phải nói cùng một thứ với bộ lọc + thứ tự sắp. */}
          <LevelChip level={levelOf(r, db.month)} levels={db.levels} />
          {nextLevelStep(r, db.month) && (
            <span style={{ font: 'var(--type-caption)', color: 'var(--status-delayed)' }}>
              {t('members.pendingLevel', {
                level: nextLevelStep(r, db.month).level, month: nextLevelStep(r, db.month).from,
              })}
            </span>
          )}
        </div>
      ),
    },
    { key: 'p', header: sortHead('p', t('members.colPhone')), mono: true, muted: true, render: (r) => r.phone || t('common.unknown') },
    {
      key: 'note', header: t('members.colNote'), width: 150,
      render: (r) => {
        if (!r.note) return <span style={{ color: 'var(--text-disabled)' }}>—</span>
        const isUrl = /^https?:\/\//i.test(r.note) || /^(facebook|fb|zalo)\./i.test(r.note)
        const href = /^https?:\/\//i.test(r.note) ? r.note : 'https://' + r.note
        return isUrl ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            style={{
              color: 'var(--teal-600)', fontSize: 12, display: 'inline-flex', alignItems: 'center',
              gap: 4, textDecoration: 'underline', fontWeight: 500,
            }}
            title={r.note}
            onClick={(e) => e.stopPropagation()}
          >
            <Icon name="link" size={12} />
            <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.note.replace(/^https?:\/\/(www\.)?/, '')}
            </span>
          </a>
        ) : (
          <span style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)' }} title={r.note}>
            {r.note}
          </span>
        )
      },
    },
    {
      key: 'gr', header: sortHead('gr', t('members.colGroups')),
      render: (r) => {
        const gs = fixedGroups(db, r.id, db.month)
        return gs.length
          ? gs.map((g) => g.short || g.name).join(', ')
          : <span style={{ color: 'var(--text-muted)' }}>{t('members.noGroup')}</span>
      },
    },
    {
      key: 'd', header: sortHead('d', t('members.colDues')), align: 'right',
      render: (r) => {
        // Cùng hàm với bộ lọc "trạng thái thu" — lọc ra một tập mà cột tô màu theo tập khác
        // là kiểu sai không ai nhìn ra cho tới lúc đi đòi nhầm người.
        const st = duesStatusOf(db, r.id, db.month)
        if (st === 'none') return <span style={{ color: 'var(--text-disabled)' }}>{t('members.duesNone')}</span>
        const unpaid = dues.filter((x) => x.memberId === r.id && dueState(x).remain > 0)
        return (
          <span style={{
            font: 'var(--type-label)',
            color: st === 'unpaid' ? 'var(--status-delayed)' : 'var(--status-delivered)',
          }}>
            {st === 'unpaid'
              ? t('members.duesUnpaid') + ' · ' + fmt(duesTotal(unpaid).remain)
              : t('members.duesPaid')}
          </span>
        )
      },
    },
    {
      key: 'st', header: t('members.colState'), width: 95,
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
      render: (r) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
          {(r.bankName && r.bankNo) && (
            <IconButton
              icon="qr-code"
              size="sm"
              variant="ghost"
              label={t('bank.viewQr')}
              onClick={() => setQrMember(r)}
            />
          )}
          {canEdit && (
            <Button variant="ghost" size="sm" icon="settings-2"
              onClick={() => a.openDialog('editMember', editMemberForm(r))}>
              {t('common.edit')}
            </Button>
          )}
          {/* Ngưng hoạt động (Inactive) giữ nguyên lịch sử; xoá cứng chỉ mở khi chưa dính gì. */}
          <IconButton icon={r.active === false ? 'rotate-ccw' : 'user-round-minus'} size="sm" variant="ghost"
            label={t(r.active === false ? 'members.toActive' : 'members.toInactive')}
            onClick={() => {
              if (r.active === false) return a.reactivate(r.id)
              const s = offBackSuggest(db, r.id)
              return s
                ? a.openDialog('offBack', { obId: r.id, obAmount: String(s.amount || '') })
                : a.deactivate(r.id, 0)
            }} />
          {!memberRefs(db, r.id).length ? (
            <IconButton icon="trash-2" size="sm" variant="ghost"
              label={t('common.delete')} onClick={() => a.confirm({
                title: t('members.delTitle', { name: r.name }),
                message: t('members.delMsg', { name: r.name }),
                tone: 'danger',
                confirmText: t('members.delOk'),
                onConfirm: () => a.deleteMember(r.id),
              })} />
          ) : (
            <span
              title={t('members.delBlocked')}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                opacity: 0.4, cursor: 'not-allowed',
              }}
            >
              <IconButton icon="lock" size="sm" variant="ghost" disabled label={t('members.delBlockedShort')} />
            </span>
          )}
        </div>
      ),
    },
  ]

  return (
    <Card
      title={t('members.listTitle')}
      subtitle={t(showOff ? 'members.listSubOff' : 'members.listSub', { n: base.length })}
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
      <div style={S.fltBar}>
        {/* SearchField không có size 'sm' — ép cao 32px cho khớp các Select bên cạnh. */}
        <SearchField
          width={260} style={{ height: 32 }} placeholder={t('members.searchPh')}
          value={flt.q} onChange={(e) => setF('q', e.target.value)} onClear={() => setF('q', '')} />
        <Select size="sm" value={flt.gender} onChange={(e) => setF('gender', e.target.value)}
          options={[{ value: '', label: t('members.fltAllGender') }]
            .concat(cfg.genders.map((g) => ({ value: g, label: genderTxt(g) })))} />
        <Select size="sm" value={flt.level} onChange={(e) => setF('level', e.target.value)}
          options={[{ value: '', label: t('members.fltAllLevel') }]
            .concat(db.levels.map((l) => ({ value: l, label: l })))} />
        <Select size="sm" value={flt.group} onChange={(e) => setF('group', e.target.value)}
          options={[{ value: '', label: t('members.fltAllGroup') }]
            .concat(db.groups.map((g) => ({ value: g.id, label: g.name })))
            .concat([{ value: 'none', label: t('members.noGroup') }])} />
        <Select size="sm" value={flt.dues} onChange={(e) => setF('dues', e.target.value)}
          options={[
            { value: '', label: t('members.fltAllDues') },
            { value: 'unpaid', label: t('members.duesUnpaid') },
            { value: 'paid', label: t('members.duesPaid') },
            { value: 'none', label: t('members.duesNone') },
          ]} />
        {hasFilter(flt) && (
          <>
            <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
              {t('members.fltCount', { n: rows.length, all: base.length })}
            </span>
            <Button variant="ghost" size="sm" icon="eraser" onClick={() => setFlt(FILTER0)}>
              {t('members.fltClear')}
            </Button>
          </>
        )}
      </div>

      {canEdit && selected.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', background: 'var(--surface-brand-soft)',
          borderBottom: '1px solid var(--teal-500)', flexWrap: 'wrap', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ font: 'var(--type-label)', fontWeight: 600, color: 'var(--navy-800)' }}>
              {t('members.bulkSelected', { n: selected.length, total: rows.length })}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
              {t('members.bulkClear')}
            </Button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('members.bulkAssign')}</span>
            {db.groups.map((g) => (
              <Button
                key={g.id}
                variant="secondary"
                size="sm"
                onClick={() => {
                  a.setMembersGroupsBulk(selected, [g.id])
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
                  a.setMembersGroupsBulk(selected, db.groups.map((g) => g.id))
                  setSelectedIds([])
                }}
              >
                {t('members.bulkAllGroups', { n: db.groups.length })}
              </Button>
            )}

            <div style={{ width: 1, height: 18, background: 'var(--border-default)', margin: '0 4px' }} />

            <Button
              variant="ghost"
              size="sm"
              icon="user-minus"
              onClick={() => {
                a.setMembersGroupsBulk(selected, [])
                setSelectedIds([])
              }}
            >
              {t('members.bulkNoGroup')}
            </Button>

            {!showOff ? (
              <Button
                variant="secondary"
                size="sm"
                icon="user-round-minus"
                onClick={() => {
                  a.confirm({
                    title: t('members.bulkOffTitle'),
                    message: t('members.bulkOffMsg', { n: selected.length }),
                    desc: t('members.bulkOffDesc'),
                    tone: 'warning',
                    confirmText: t('members.bulkOff'),
                    onConfirm: () => {
                      a.deactivateMembersBulk(selected)
                      setSelectedIds([])
                    },
                  })
                }}
              >
                {t('members.bulkOff')}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                icon="rotate-ccw"
                onClick={() => {
                  a.reactivateMembersBulk(selected)
                  setSelectedIds([])
                }}
              >
                {t('members.bulkOn')}
              </Button>
            )}

            <Button
              variant="danger"
              size="sm"
              icon="trash-2"
              onClick={() => {
                const blocked = selected.filter((id) => memberRefs(db, id).length > 0)
                if (blocked.length === selected.length) {
                  return a.alert({
                    title: t('members.bulkDelNoneTitle'),
                    message: t('members.bulkDelNoneMsg'),
                    desc: t('members.bulkDelNoneDesc'),
                    tone: 'warning',
                  })
                }
                const msg = blocked.length > 0
                  ? t('members.bulkDelSomeMsg', { n: selected.length - blocked.length, kept: blocked.length })
                  : t('members.bulkDelAllMsg', { n: selected.length })
                a.confirm({
                  title: t('members.bulkDelTitle'),
                  message: msg,
                  tone: 'danger',
                  confirmText: t('members.bulkDelOk'),
                  onConfirm: () => {
                    a.deleteMembersBulk(selected)
                    setSelectedIds([])
                  },
                })
              }}
            >
              {t('members.bulkDel')}
            </Button>
          </div>
        </div>
      )}
      {rows.length === 0
        ? (hasFilter(flt)
            ? <Empty icon="search" title={t('members.fltEmpty')} hint={t('members.fltEmptyHint')} />
            : <Empty icon="users" title={t('members.empty')} hint={t('members.emptyHint')} />)
        : <DataTable columns={columns} rows={rows} rowKey="id" />}

      {qrMember && (
        <QrModal
          title={t('bank.qrTitle') + ' · ' + qrMember.name}
          qrUrl={getVietQrUrl({
            bankCode: (findBank(qrMember.bankName) || {}).bin || qrMember.bankName,
            accountNo: qrMember.bankNo,
            accountHolder: qrMember.bankHolder || qrMember.fullName || qrMember.name,
          })}
          bankName={qrMember.bankName}
          accountNo={qrMember.bankNo}
          accountHolder={qrMember.bankHolder || qrMember.fullName || qrMember.name}
          onClose={() => setQrMember(null)}
        />
      )}
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

  const pendingRows = []
  db.groups.forEach((g) => {
    const r = (db.roster[month] || {})[g.id] || {}
    Object.keys(r).forEach((mid) => {
      if (r[mid] === 'pending') pendingRows.push({ g, m: memberOf(db, mid), mid })
    })
  })

  return (
    <>
      <Card
        title={t('members.nextTitle', { month: monthTxt(month).toLowerCase() })}
        subtitle={t('members.nextSub')}
        icon="calendar-days"
        padding="14px 16px"
        actions={
          canEdit && (
            <Button
              variant={locked ? 'secondary' : 'primary'}
              size="sm"
              icon={locked ? 'rotate-ccw' : 'check'}
              onClick={() => a.lockRoster(month)}
            >
              {t(locked ? 'members.unlock' : 'members.lockNow')}
            </Button>
          )
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

          {/* CLB chưa có nhóm nào */}
          {db.groups.length === 0 && (
            <Empty icon="users" title={t('members.noGroupTitle')} hint={t('members.noGroupHint')} />
          )}
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

      {pendingRows.length > 0 && (
        <Card title={t('members.registerTitle')} subtitle={t('members.registerSub')} icon="user-round-plus" padding="14px 16px">
          <div style={{ display: 'grid', gap: 8 }}>
            {pendingRows.map((x) => (
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
            ))}
          </div>
        </Card>
      )}
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

/* ---------------- tab Khách giao lưu ---------------- */

function GuestMembers({ canEdit }) {
  const { db, a } = useApp()
  const [subTab, setSubTab] = useState('all') // 'all' | 'regular' | 'once'
  const [levelFlt, setLevelFlt] = useState('')
  const [genderFlt, setGenderFlt] = useState('')
  const [search, setSearch] = useState('')
  const [editingGuest, setEditingGuest] = useState(null)

  const guests = useMemo(() => db.guests || [], [db.guests])

  // Đếm số lượng
  const regularCount = guests.filter((g) => guestStats(db, g.id).isRegular).length
  const onceCount = guests.filter((g) => guestStats(db, g.id).sessionCount === 1).length

  const filteredGuests = useMemo(() => {
    return guests.filter((g) => {
      const stats = guestStats(db, g.id)
      if (subTab === 'regular' && !stats.isRegular) return false
      if (subTab === 'once' && stats.sessionCount !== 1) return false
      if (levelFlt && g.level !== levelFlt) return false
      if (genderFlt && g.gender !== genderFlt) return false
      if (search) {
        const q = normalizeText(search)
        const nameNorm = normalizeText(g.name)
        const phoneNorm = (g.phone || '').replace(/\D/g, '')
        const noteNorm = normalizeText(g.note || '')
        if (!nameNorm.includes(q) && !phoneNorm.includes(q) && !noteNorm.includes(q)) {
          return false
        }
      }
      return true
    })
  }, [guests, db, subTab, levelFlt, genderFlt, search])

  const levelOptions = [{ value: '', label: t('members.fltAllLevel') }].concat(
    db.levels.map((l) => ({ value: l, label: l }))
  )
  const genderOptions = [
    { value: '', label: t('members.fltAllGender') },
    { value: 'nam', label: genderTxt('nam') },
    { value: 'nu', label: genderTxt('nu') },
  ]

  return (
    <>
      <Card padding="0">
        <div style={S.fltBar}>
          <Tabs
            variant="segmented"
            items={[
              { value: 'all', label: t('members.guestSubAll'), count: guests.length },
              { value: 'regular', label: t('members.guestSubRegular'), count: regularCount },
              { value: 'once', label: t('members.guestSubOnce'), count: onceCount },
            ]}
            value={subTab}
            onChange={(v) => setSubTab(v)}
          />

          <Select
            options={levelOptions}
            value={levelFlt}
            onChange={(e) => setLevelFlt(e.target.value)}
          />

          <Select
            options={genderOptions}
            value={genderFlt}
            onChange={(e) => setGenderFlt(e.target.value)}
          />

          <SearchField
            placeholder={t('members.guestSearchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
        </div>

        {filteredGuests.length === 0 ? (
          <Empty icon="users" title={t('members.guestEmpty')} hint={t('members.guestEmptyHint')} />
        ) : (
          <div style={{ display: 'grid' }}>
            {filteredGuests.map((g) => {
              const stats = guestStats(db, g.id)
              const lastDate = stats.lastSession ? ddmy(stats.lastSession.date) : '—'
              const topInviterName = stats.topInviter ? stats.topInviter.name : (g.invitedBy ? memberOf(db, g.invitedBy).name : t('debts.clubRecruited'))
              return (
                <div key={g.id} style={{ ...S.row, borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0, padding: '12px 16px' }}>
                  <Avatar name={g.name} size={36} />
                  <div style={{ flex: 1.5, minWidth: 150 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ font: 'var(--type-label)', fontWeight: 600 }}>{g.name}</span>
                      <LevelChip level={g.level} levels={db.levels} />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{genderTxt(g.gender)}</span>
                      {g.companionOf && (
                        <span style={{
                          fontSize: 11, padding: '2px 6px', borderRadius: 4,
                          background: 'var(--surface-brand-soft)', color: 'var(--teal-700)', fontWeight: 500,
                        }}>
                          {t('members.companionBadge', { name: (db.guests.find((x) => x.id === g.companionOf) || {}).name || '' })}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {g.phone ? (
                        <span>{g.phone}</span>
                      ) : (
                        <span style={{ fontStyle: 'italic' }}>{t('members.guestNoPhone')}</span>
                      )}
                      {g.note && <span style={{ marginLeft: 6 }}>· {g.note}</span>}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 120, fontSize: 13 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{t('members.guestInvitedBy')}</div>
                    <div style={{ fontWeight: 500 }}>{topInviterName}</div>
                  </div>

                  <div style={{ flex: 1, minWidth: 100, fontSize: 13 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{t('members.colGuestSessions')}</div>
                    <div>
                      {t('members.guestSessionsCount', { n: stats.sessionCount })}
                      {stats.lastSession && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>({lastDate})</span>
                      )}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 110, fontSize: 13 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{t('members.colGuestPaid')}</div>
                    <Mono weight={600} color="var(--status-delivered)">{fmt(stats.totalPaid)}</Mono>
                    {stats.totalDebt > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--status-incident)' }}>
                        {t('members.guestCurrentDebt', { amount: fmt(stats.totalDebt) })}
                      </div>
                    )}
                  </div>

                  {canEdit && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="pencil"
                        onClick={() => setEditingGuest({ ...g })}
                      >
                        {t('common.edit')}
                      </Button>
                      <IconButton
                        icon="trash-2"
                        size="sm"
                        variant="ghost"
                        label={t('common.delete')}
                        onClick={() => a.confirm({
                          title: t('session.delGuestTitle'),
                          message: t('session.delGuestMsg', { name: g.name }),
                          tone: 'danger',
                          confirmText: t('session.delGuestOk'),
                          onConfirm: () => a.deleteGuest(g.id),
                        })}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Dialog sửa thông tin khách */}
      {editingGuest && (
        <EditGuestDialog
          guest={editingGuest}
          levels={db.levels}
          onClose={() => setEditingGuest(null)}
          onSave={(patch) => {
            a.updateGuest(editingGuest.id, patch)
            setEditingGuest(null)
          }}
          onDelete={() => {
            a.confirm({
              title: t('session.delGuestTitle'),
              message: t('session.delGuestMsg', { name: editingGuest.name }),
              tone: 'danger',
              confirmText: t('session.delGuestOk'),
              onConfirm: () => {
                a.deleteGuest(editingGuest.id)
                setEditingGuest(null)
              },
            })
          }}
        />
      )}
    </>
  )
}

const S = {
  row: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '9px 11px',
    border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--surface-card)',
  },
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  // Nút trong <th>: nuốt hết style của header rồi kế thừa lại font/màu của chính <th>.
  sortBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: 0,
    border: 0, background: 'transparent', cursor: 'pointer',
    font: 'inherit', color: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit',
  },
  fltBar: {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)',
  },
}
