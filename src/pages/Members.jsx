// Thành viên: danh sách · cố định tháng sau · thay đổi chờ duyệt (handoff 02 §5).
// Nguồn ai phải đóng quỹ là roster THEO THÁNG, không phải groupIds.

import { useMemo, useState } from 'react'
import { Avatar, Button, Card, DataTable, Icon, IconButton, SearchField, Select, Tabs } from '#ds'
import { Empty, LevelChip, Mono, Overline } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { addMonth, monthShort, monthTxt } from '#utils/dates.js'
import { dueState, duesOf, duesTotal, fmt, genderTxt, memberOf, levelOf, memberRefs, nextLevelStep, offBackSuggest, rosterStatus } from '#lib/money.js'
import { FILTER0, duesStatusOf, filterMembers, fixedGroups, hasFilter, nextSort, sortMembers } from '#lib/members.js'
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
  const [flt, setFlt] = useState(FILTER0)
  const [sort, setSort] = useState({})
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
          <Avatar name={r.name} size={26} />
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
      key: 'note', header: 'Ghi chú', width: 150,
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
              label={t('common.delete')} onClick={() => a.confirm({
                title: `Xoá thành viên "${r.name}"?`,
                message: `Bạn có chắc chắn muốn xoá thành viên "${r.name}" khỏi CLB?`,
                tone: 'danger',
                confirmText: 'Xoá thành viên',
                onConfirm: () => a.deleteMember(r.id),
              })} />
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
              Đã chọn {selected.length} / {rows.length} người
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
                Cả {db.groups.length} ca
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
              Bỏ cố định (Đi lẻ)
            </Button>

            {!showOff ? (
              <Button
                variant="secondary"
                size="sm"
                icon="user-round-minus"
                onClick={() => {
                  a.confirm({
                    title: 'Chuyển trạng thái Inactive?',
                    message: `Chuyển ${selected.length} thành viên đã chọn sang trạng thái Inactive?`,
                    desc: 'Lịch sử điểm danh và quỹ của các thành viên này được giữ nguyên 100%.',
                    tone: 'warning',
                    confirmText: 'Chuyển Inactive',
                    onConfirm: () => {
                      a.deactivateMembersBulk(selected)
                      setSelectedIds([])
                    },
                  })
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
                  a.reactivateMembersBulk(selected)
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
                const blocked = selected.filter((id) => memberRefs(db, id).length > 0)
                if (blocked.length === selected.length) {
                  return a.alert({
                    title: 'Không thể xoá vĩnh viễn',
                    message: 'Tất cả thành viên đã chọn đều đã có dữ liệu (điểm danh/quỹ).',
                    desc: 'Hệ thống không cho phép xoá vĩnh viễn để bảo toàn lịch sử sổ sách. Hãy dùng nút "Chuyển Inactive" bên cạnh.',
                    tone: 'warning',
                  })
                }
                const msg = blocked.length > 0
                  ? `Có ${selected.length - blocked.length} người chưa có dữ liệu sẽ bị xoá. Còn ${blocked.length} người đã có dữ liệu sinh hoạt sẽ được giữ lại an toàn.`
                  : `Bạn có chắc chắn muốn xoá vĩnh viễn ${selected.length} thành viên này khỏi CLB?`
                a.confirm({
                  title: 'Xoá thành viên hàng loạt',
                  message: msg,
                  tone: 'danger',
                  confirmText: 'Xác nhận xoá',
                  onConfirm: () => {
                    a.deleteMembersBulk(selected)
                    setSelectedIds([])
                  },
                })
              }}
            >
              Xoá vĩnh viễn
            </Button>
          </div>
        </div>
      )}
      {rows.length === 0
        ? (hasFilter(flt)
            ? <Empty icon="search" title={t('members.fltEmpty')} hint={t('members.fltEmptyHint')} />
            : <Empty icon="users" title={t('members.empty')} hint={t('members.emptyHint')} />)
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
