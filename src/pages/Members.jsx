// Thành viên: danh sách · cố định tháng sau · thay đổi chờ duyệt (handoff 02 §5).
// Nguồn ai phải đóng quỹ là roster THEO THÁNG, không phải groupIds.

import { useMemo, useState } from 'react'
import { Avatar, Button, Card, Checkbox, DataTable, Dialog, Icon, IconButton, Input, SearchField, Select, Tabs } from '#ds'
import { EditGuestDialog, Empty, GenderChip, LevelChip, Mono, Overline, QrModal, TabTrack } from '#ui'
import { findBank, getVietQrUrl } from '#utils/vietqr.js'
import { useApp } from '#contexts/AppContext.jsx'
import { ddmy, monthTxt } from '#utils/dates.js'
import { dueState, duesOf, duesTotal, fmt, genderTxt, memberOf, levelOf, memberRefs, nextLevelStep, offBackSuggest, rosterStatus, guestStats, normalizeText } from '#lib/money.js'
import { FILTER0, duesStatusOf, filterMembers, fixedGroups, hasFilter, nextSort, sortMembers } from '#lib/members.js'
import { editMemberForm, memberForm } from '#lib/forms.js'
import { can } from '#lib/roles.js'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }

export default function Members() {
  const { db, ui, a } = useApp()
  const isMobile = useMobile()
  const tab = ui.tab.members || 'all'
  const role = db.viewAs || 'owner'
  const canEdit = can(role, 'members')
  const canEditGuest = can(role, 'members') || can(role, 'sessions')
  const rosterM = db.month
  const pendingChanges = db.changes.filter((c) => c.status === 'pending')

  const pendingRosterRows = useMemo(() => {
    const list = []
    db.groups.forEach((g) => {
      const r = (db.roster[rosterM] || {})[g.id] || {}
      Object.keys(r).forEach((mid) => {
        if (r[mid] === 'pending') list.push({ g, m: memberOf(db, mid), mid })
      })
    })
    return list
  }, [db, rosterM])

  const totalPending = pendingChanges.length + pendingRosterRows.length

  if (isMobile) {
    const activeCount = db.members.filter((m) => m.active !== false).length
    const inactiveCount = db.members.filter((m) => m.active === false).length
    const guestsCount = (db.guests || []).length
    const regularGuestCount = (db.guests || []).filter((g) => guestStats(db, g.id).isRegular).length

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 24 }}>
        {/* Header */}
        <div style={{
          padding: '16px 18px', background: '#080F1C', borderBottom: '1px solid rgba(255,255,255,.10)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 60,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ font: '600 17px/1.2 Barlow, sans-serif', color: '#E9EFF7' }}>{t('nav.members')}</div>
            <div style={{ font: "400 12px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
              {tab === 'pending'
                ? t('members.mobilePendingHeaderSub', { n: totalPending })
                : tab === 'guests'
                  ? t('members.mobileGuestSub', { total: guestsCount, regular: regularGuestCount })
                  : t('members.mobileHeaderSub', { active: activeCount, inactive: inactiveCount })}
            </div>
          </div>
          {canEdit && tab === 'all' && (
            <div
              onClick={() => a.openDialog('addMember', memberForm(db))}
              style={{
                minHeight: 36, padding: '0 12px', display: 'flex', alignItems: 'center',
                background: '#1D50A0', borderRadius: 6, font: "600 13px/1 'IBM Plex Sans', sans-serif",
                color: '#FFFFFF', cursor: 'pointer',
              }}
            >
              {t('members.mobileAdd')}
            </div>
          )}
        </div>

        {/* Segmented Control */}
        <div style={{ padding: '0 14px' }}>
          <div style={{ display: 'flex', background: '#101927', border: '1px solid #22304A', borderRadius: 8, padding: 3 }}>
            <div
              onClick={() => a.setTab('members', 'all')}
              style={{
                flex: 1, textTransform: 'none', textAlign: 'center', padding: '9px 6px', borderRadius: 6,
                background: tab === 'all' ? '#141D2E' : 'transparent',
                boxShadow: tab === 'all' ? '0 1px 1px rgba(0,0,0,.30)' : 'none',
                font: `${tab === 'all' ? 600 : 500} 13px/1.2 'IBM Plex Sans', sans-serif`,
                color: tab === 'all' ? '#E9EFF7' : '#8494AA', cursor: 'pointer',
              }}
            >
              {t('members.tabAll')}
            </div>
            <div
              onClick={() => a.setTab('members', 'guests')}
              style={{
                flex: 1, textTransform: 'none', textAlign: 'center', padding: '9px 6px', borderRadius: 6,
                background: tab === 'guests' ? '#141D2E' : 'transparent',
                boxShadow: tab === 'guests' ? '0 1px 1px rgba(0,0,0,.30)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                font: `${tab === 'guests' ? 600 : 500} 13px/1.2 'IBM Plex Sans', sans-serif`,
                color: tab === 'guests' ? '#E9EFF7' : '#8494AA', cursor: 'pointer',
              }}
            >
              {t('members.tabGuests')}
              {guestsCount > 0 && (
                <span style={{ font: "600 10px/1 'IBM Plex Mono', monospace", color: '#5FD9A2', background: 'rgba(18,168,103,.18)', padding: '3px 6px', borderRadius: 999 }}>
                  {guestsCount}
                </span>
              )}
            </div>
            <div
              onClick={() => a.setTab('members', 'next')}
              style={{
                flex: 1, textTransform: 'none', textAlign: 'center', padding: '9px 6px', borderRadius: 6,
                background: tab === 'next' ? '#141D2E' : 'transparent',
                boxShadow: tab === 'next' ? '0 1px 1px rgba(0,0,0,.30)' : 'none',
                font: `${tab === 'next' ? 600 : 500} 13px/1.2 'IBM Plex Sans', sans-serif`,
                color: tab === 'next' ? '#E9EFF7' : '#8494AA', cursor: 'pointer',
              }}
            >
              {t('members.tabNext')}
            </div>
            <div
              onClick={() => a.setTab('members', 'pending')}
              style={{
                flex: 1, textTransform: 'none', textAlign: 'center', padding: '9px 6px', borderRadius: 6,
                background: tab === 'pending' ? '#141D2E' : 'transparent',
                boxShadow: tab === 'pending' ? '0 1px 1px rgba(0,0,0,.30)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                font: `${tab === 'pending' ? 600 : 500} 13px/1.2 'IBM Plex Sans', sans-serif`,
                color: tab === 'pending' ? '#E9EFF7' : '#8494AA', cursor: 'pointer',
              }}
            >
              {t('members.tabPending')}
              {totalPending > 0 && (
                <span style={{ font: "600 10px/1 'IBM Plex Mono', monospace", color: '#F0B75C', background: 'rgba(224,138,0,.18)', padding: '3px 6px', borderRadius: 999 }}>
                  {totalPending}
                </span>
              )}
            </div>
          </div>
        </div>

        {tab === 'all' && <AllMembers canEdit={canEdit} />}
        {tab === 'next' && <NextMonth month={rosterM} canEdit={canEdit} />}
        {tab === 'guests' && <GuestMembers canEdit={canEditGuest} />}
        {tab === 'pending' && <Pending canEdit={canEdit} pendingRosterRows={pendingRosterRows} month={rosterM} />}
      </div>
    )
  }

  return (
    <>
      <TabTrack>
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
      </TabTrack>
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
  const isMobile = useMobile()
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
    { key: 'g', header: sortHead('g', t('members.colGender')), render: (r) => <GenderChip gender={r.gender} /> },
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
    { key: 'p', header: sortHead('p', t('members.colPhone')), mono: true, muted: true, render: (r) => r.phone || '' },
    {
      key: 'note', header: t('members.colNote'), width: 150,
      render: (r) => {
        if (!r.note) return null
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
            {t('members.stateInactive')}
          </span>
        ) : (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '2px 8px', borderRadius: 99,
            background: 'var(--surface-accent-soft)', border: '1px solid var(--teal-500)',
            font: '600 11px var(--font-sans)', color: 'var(--teal-700)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-delivered)' }} />
            {t('members.stateActive')}
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

  const exportCsv = () => {
    const headers = ['ID', 'Tên', 'Họ tên', 'Giới tính', 'Trình độ', 'SĐT', 'Nhóm', 'Trạng thái'] // i18n-ok: Tiêu đề cột CSV
    const csvRows = rows.map((r) => [
      r.id,
      `"${(r.name || '').replace(/"/g, '""')}"`,
      `"${(r.fullName || '').replace(/"/g, '""')}"`,
      genderTxt(r.gender),
      levelOf(r, db.month),
      `"${r.phone || ''}"`,
      `"${fixedGroups(db, r.id, db.month).map((g) => g.short || g.name).join(', ')}"`,
      r.active === false ? t('members.stateInactive') : t('members.stateActive'),
    ].join(','))
    const blob = new Blob(['\uFEFF' + [headers.join(','), ...csvRows].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `thanh_vien_${db.month}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Filter chips & Search */}
        <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Status chips */}
            <span
              onClick={() => a.setTab('mstate', 'on')}
              style={{
                font: "600 12px/1 'IBM Plex Sans', sans-serif",
                color: (ui.tab.mstate || 'on') === 'on' ? '#E9EFF7' : '#A8B7CB',
                background: (ui.tab.mstate || 'on') === 'on' ? '#1D50A0' : '#1A2437',
                border: (ui.tab.mstate || 'on') === 'on' ? 'none' : '1px solid #2E3E5C',
                padding: '9px 12px', borderRadius: 999, cursor: 'pointer',
              }}
            >
              {t('members.stateActive')}
            </span>
            {off.length > 0 && (
              <span
                onClick={() => a.setTab('mstate', 'off')}
                style={{
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  color: ui.tab.mstate === 'off' ? '#E9EFF7' : '#A8B7CB',
                  background: ui.tab.mstate === 'off' ? '#1D50A0' : '#1A2437',
                  border: ui.tab.mstate === 'off' ? 'none' : '1px solid #2E3E5C',
                  padding: '9px 12px', borderRadius: 999, cursor: 'pointer',
                }}
              >
                {t('members.mobileInactiveBadge')} ({off.length})
              </span>
            )}

            {/* Groups chips */}
            {db.groups.map((g) => {
              const active = flt.group === g.id
              return (
                <span
                  key={g.id}
                  onClick={() => setF('group', active ? '' : g.id)}
                  style={{
                    font: "600 12px/1 'IBM Plex Sans', sans-serif",
                    color: active ? '#E9EFF7' : '#A8B7CB',
                    background: active ? '#1D50A0' : '#1A2437',
                    border: active ? 'none' : '1px solid #2E3E5C',
                    padding: '9px 12px', borderRadius: 999, cursor: 'pointer',
                  }}
                >
                  {g.short || g.name}
                </span>
              )
            })}
          </div>

          {/* Search box */}
          <SearchField
            width="100%"
            placeholder={t('members.searchPh')}
            value={flt.q}
            onChange={(e) => setF('q', e.target.value)}
            onClear={() => setF('q', '')}
          />
        </div>

        {/* Member cards list */}
        <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.length === 0 ? (
            hasFilter(flt)
              ? <Empty icon="search" title={t('members.fltEmpty')} hint={t('members.fltEmptyHint')} />
              : <Empty icon="users" title={t('members.empty')} hint={t('members.emptyHint')} />
          ) : (
            rows.map((r) => {
              const gs = fixedGroups(db, r.id, db.month)
              const st = duesStatusOf(db, r.id, db.month)
              const unpaid = dues.filter((x) => x.memberId === r.id && dueState(x).remain > 0)
              const isInactive = r.active === false

              return (
                <div
                  key={r.id}
                  onClick={() => canEdit && a.openDialog('editMember', editMemberForm(r))}
                  style={{
                    background: '#141D2E', border: '1px solid #22304A', borderRadius: 10,
                    boxShadow: '0 1px 1px rgba(0,0,0,.30)', padding: '12px 13px',
                    display: 'flex', alignItems: 'center', gap: 12,
                    opacity: isInactive ? 0.72 : 1, cursor: canEdit ? 'pointer' : 'default',
                  }}
                >
                  <Avatar name={r.name} src={r.avatarUrl} size={40} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ font: "600 16px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>{r.name}</div>
                      <LevelChip level={levelOf(r, db.month)} levels={db.levels} />
                      <GenderChip gender={r.gender} />
                      {isInactive ? (
                        <span style={{
                          font: "600 10px/1 'IBM Plex Sans', sans-serif", color: '#A8B7CB',
                          background: 'rgba(148,164,186,.14)', padding: '4px 8px', borderRadius: 999,
                        }}>
                          {t('members.mobileInactiveBadge')}
                        </span>
                      ) : gs.length ? (
                        <span style={{
                          font: "600 10px/1 'IBM Plex Sans', sans-serif", color: '#9FC0EA',
                          background: 'rgba(60,116,196,.18)', padding: '4px 8px', borderRadius: 999,
                        }}>
                          {gs[0].short || gs[0].name}
                        </span>
                      ) : (
                        <span style={{
                          font: "600 10px/1 'IBM Plex Sans', sans-serif", color: '#A8B7CB',
                          background: 'rgba(148,164,186,.14)', padding: '4px 8px', borderRadius: 999,
                        }}>
                          {t('members.soloShort')}
                        </span>
                      )}
                    </div>
                    {isInactive ? (
                      <div style={{ font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                        {t('members.mobileInactiveNote', { date: '01/' + db.month.slice(5, 7) })}
                      </div>
                    ) : (r.fullName || r.note) ? (
                      <div style={{ font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                        {r.fullName || r.note}
                      </div>
                    ) : null}
                    {(r.phone || st === 'unpaid') && (
                      <div style={{ font: "400 12px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                        {r.phone && <span>{r.phone}</span>}
                        {st === 'unpaid' && (
                          <span style={{ color: '#FF9A8F' }}>
                            {r.phone ? ' · ' : ''}
                            {`${t('members.duesUnpaid')} ${fmt(duesTotal(unpaid).remain)}`}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions / QR */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {(r.bankName && r.bankNo) && (
                      <IconButton
                        icon="qr-code"
                        size="sm"
                        variant="ghost"
                        label={t('bank.viewQr')}
                        onClick={(e) => {
                          e.stopPropagation()
                          setQrMember(r)
                        }}
                      />
                    )}
                    <Icon name="chevron-right" size={14} style={{ color: '#8494AA', opacity: 0.6 }} />
                  </div>
                </div>
              )
            })
          )}

          {/* Dashed CSV Export Button */}
          <div
            onClick={exportCsv}
            style={{
              background: '#101927', border: '1px dashed #2E3E5C', borderRadius: 10,
              minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
              font: "600 15px/1 'IBM Plex Sans', sans-serif", color: '#A8B7CB', cursor: 'pointer',
              marginTop: 4,
            }}
          >
            {t('members.mobileExportCsv')}
          </div>
        </div>

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
      </div>
    )
  }

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
                { value: 'on', label: t('members.stateActive') },
                { value: 'off', label: t('members.stateInactive'), count: off.length },
              ]}
              value={ui.tab.mstate || 'on'}
              onChange={(v) => a.setTab('mstate', v)}
            />
          )}
          {canEdit && (
            <>
              {!isMobile && (
                <Button variant="secondary" size="sm" icon="file-spreadsheet"
                  onClick={() => a.openDialog('importMembers', {})}>
                  {t('members.importCsv')}
                </Button>
              )}
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
              icon="user-round-minus"
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
                <Avatar name={x.m.name} src={x.m.avatarUrl} size={30} />
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

function Pending({ canEdit, pendingRosterRows = [], month }) {
  const { db, a } = useApp()
  const isMobile = useMobile()
  const rows = db.changes.filter((c) => c.status === 'pending')

  if (isMobile) {
    const hasRoster = pendingRosterRows.length > 0
    const hasChanges = rows.length > 0
    const mMonth = month || db.month

    if (!hasRoster && !hasChanges) {
      return (
        <div style={{ padding: '0 14px' }}>
          <Empty
            icon="circle-check"
            title={t('members.mobilePendingAllDone')}
            hint={t('members.mobilePendingAllDoneHint')}
          />
        </div>
      )
    }

    return (
      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Section 1: Đăng ký cố định tháng sau */}
        {hasRoster && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{
              font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '0.08em',
              textTransform: 'uppercase', color: '#8494AA',
            }}>
              {t('members.mobileSecGroupNext')}
            </div>
            {pendingRosterRows.map((x) => (
              <div
                key={x.g.id + x.mid}
                style={{
                  background: '#141D2E', border: '1px solid #22304A', borderRadius: 10,
                  boxShadow: '0 1px 1px rgba(0,0,0,.30)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={x.m.name} src={x.m.avatarUrl} size={36} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ font: "600 16px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>{x.m.name}</div>
                    <div style={{ font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                      {t('members.mobileGroupNextTitle', { group: x.g.name })}
                    </div>
                  </div>
                </div>
                <div style={{
                  background: '#101927', border: '1px solid #22304A', borderRadius: 8,
                  padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  <div style={{ font: "400 13px/1.45 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                    {t('members.mobileGroupNextDesc', { month: monthTxt(mMonth).toLowerCase(), price: fmt(x.g.price || 0) })}
                  </div>
                  <div style={{ font: "400 12px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                    {t('members.mobileGroupNextEffect', { date: '01/' + mMonth.slice(5, 7) + '/' + mMonth.slice(0, 4) })}
                  </div>
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div
                      onClick={() => a.setRoster(mMonth, x.g.id, x.mid, 'fixed')}
                      style={{
                        flex: 1, textAlign: 'center', minHeight: 48, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', background: '#1D50A0', borderRadius: 6,
                        font: "600 15px/1 'IBM Plex Sans', sans-serif", color: '#FFFFFF', cursor: 'pointer',
                      }}
                    >
                      {t('members.approve')}
                    </div>
                    <div
                      onClick={() => a.setRoster(mMonth, x.g.id, x.mid, 'none')}
                      style={{
                        minHeight: 48, padding: '0 16px', display: 'flex', alignItems: 'center',
                        background: '#1A2437', border: '1px solid #2E3E5C', borderRadius: 6,
                        font: "600 15px/1 'IBM Plex Sans', sans-serif", color: '#A8B7CB', cursor: 'pointer',
                      }}
                    >
                      {t('members.reject')}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Section 2: Thay đổi thông tin */}
        {hasChanges && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{
              font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '0.08em',
              textTransform: 'uppercase', color: '#8494AA',
            }}>
              {t('members.mobileSecChangeInfo')}
            </div>
            {rows.map((c) => {
              const m = memberOf(db, c.memberId)
              const isNow = c.effective === 'now'

              return (
                <div
                  key={c.id}
                  style={{
                    background: '#141D2E', border: '1px solid #22304A', borderRadius: 10,
                    boxShadow: '0 1px 1px rgba(0,0,0,.30)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={m.name} src={m.avatarUrl} size={36} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ font: "600 16px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>{m.name}</div>
                      <div style={{ font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                        {t('members.mobileChangeTitle', { field: t('members.changeField.' + c.field) })}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{
                      background: '#101927', border: '1px solid #22304A', borderRadius: 8,
                      padding: '11px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                          {t('members.changeField.' + c.field)}
                        </div>
                        <div style={{
                          font: "400 12px/1.3 'IBM Plex Sans', sans-serif",
                          color: isNow ? '#5FD9A2' : '#F0B75C',
                        }}>
                          {t(isNow ? 'members.mobileApplyNow' : 'members.mobileApplyNext')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {c.field === 'level' ? (
                          <>
                            <LevelChip level={c.from} levels={db.levels} />
                            <span style={{ font: "400 13px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>→</span>
                            <LevelChip level={c.to} levels={db.levels} />
                          </>
                        ) : (
                          <span style={{ font: "400 13px/1.3 'IBM Plex Mono', monospace", color: '#A8B7CB' }}>
                            {c.from} → {c.to}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div
                        onClick={() => a.approveChange(c.id, true)}
                        style={{
                          flex: 1, textAlign: 'center', minHeight: 48, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', background: '#1D50A0', borderRadius: 6,
                          font: "600 15px/1 'IBM Plex Sans', sans-serif", color: '#FFFFFF', cursor: 'pointer',
                        }}
                      >
                        {t('members.approve')}
                      </div>
                      <div
                        onClick={() => a.approveChange(c.id, false)}
                        style={{
                          minHeight: 48, padding: '0 16px', display: 'flex', alignItems: 'center',
                          background: '#1A2437', border: '1px solid #2E3E5C', borderRadius: 6,
                          font: "600 15px/1 'IBM Plex Sans', sans-serif", color: '#A8B7CB', cursor: 'pointer',
                        }}
                      >
                        {t('members.reject')}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card title={t('members.changesTitle')} subtitle={t('members.changesSub')} icon="settings-2" padding="14px 16px">
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.length === 0
          ? <Empty icon="circle-check" title={t('members.changesEmpty')} hint={t('members.changesEmptyHint')} />
          : rows.map((c) => {
              const m = memberOf(db, c.memberId)
              return (
                <div key={c.id} style={S.row}>
                  <Avatar name={m.name} src={m.avatarUrl} size={30} />
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
  const isMobile = useMobile()
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

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Filter Subtabs & Search */}
        <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span
              onClick={() => setSubTab('all')}
              style={{
                font: "600 12px/1 'IBM Plex Sans', sans-serif",
                color: subTab === 'all' ? '#E9EFF7' : '#A8B7CB',
                background: subTab === 'all' ? '#1D50A0' : '#1A2437',
                border: subTab === 'all' ? 'none' : '1px solid #2E3E5C',
                padding: '9px 12px', borderRadius: 999, cursor: 'pointer',
              }}
            >
              {t('members.mobileGuestFltAll')} ({guests.length})
            </span>
            <span
              onClick={() => setSubTab('regular')}
              style={{
                font: "600 12px/1 'IBM Plex Sans', sans-serif",
                color: subTab === 'regular' ? '#E9EFF7' : '#A8B7CB',
                background: subTab === 'regular' ? '#1D50A0' : '#1A2437',
                border: subTab === 'regular' ? 'none' : '1px solid #2E3E5C',
                padding: '9px 12px', borderRadius: 999, cursor: 'pointer',
              }}
            >
              {t('members.mobileGuestFltRegular')} ({regularCount})
            </span>
            <span
              onClick={() => setSubTab('once')}
              style={{
                font: "600 12px/1 'IBM Plex Sans', sans-serif",
                color: subTab === 'once' ? '#E9EFF7' : '#A8B7CB',
                background: subTab === 'once' ? '#1D50A0' : '#1A2437',
                border: subTab === 'once' ? 'none' : '1px solid #2E3E5C',
                padding: '9px 12px', borderRadius: 999, cursor: 'pointer',
              }}
            >
              {t('members.mobileGuestFltOnce')} ({onceCount})
            </span>
          </div>

          <SearchField
            width="100%"
            placeholder={t('members.mobileGuestSearchPh')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </div>

        {/* Guest cards list */}
        <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredGuests.length === 0 ? (
            <Empty icon="users" title={t('members.guestEmpty')} hint={t('members.guestEmptyHint')} />
          ) : (
            filteredGuests.map((g) => {
              const stats = guestStats(db, g.id)
              const topInviterName = stats.topInviter ? stats.topInviter.name : (g.invitedBy ? memberOf(db, g.invitedBy).name : t('debts.clubRecruited'))
              const lastDate = stats.lastSession ? ddmy(stats.lastSession.date) : ''

              return (
                <div
                  key={g.id}
                  style={{
                    background: '#141D2E', border: '1px solid #22304A', borderRadius: 10,
                    boxShadow: '0 1px 1px rgba(0,0,0,.30)', padding: 14,
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <Avatar name={g.name} size={40} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ font: "600 16px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>{g.name}</div>
                        <LevelChip level={g.level} levels={db.levels} />
                        <GenderChip gender={g.gender} />
                        {stats.isRegular ? (
                          <span style={{
                            font: "600 10px/1 'IBM Plex Sans', sans-serif", color: '#5FD9A2',
                            background: 'rgba(18,168,103,.18)', padding: '4px 8px', borderRadius: 999,
                          }}>
                            {t('members.mobileGuestFltRegular')}
                          </span>
                        ) : g.companionOf ? (
                          <span style={{
                            font: "600 10px/1 'IBM Plex Sans', sans-serif", color: '#5FDBD3',
                            background: 'rgba(0,178,169,.18)', padding: '4px 8px', borderRadius: 999,
                          }}>
                            {t('members.companionBadge', { name: (db.guests.find((x) => x.id === g.companionOf) || {}).name || '' })}
                          </span>
                        ) : null}
                      </div>
                      <div style={{ font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                        {t('members.mobileGuestInviter', { name: topInviterName })}
                      </div>
                      <div style={{ font: "400 12px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                        {g.phone ? <span>{g.phone} · </span> : null}
                        {t('members.guestSessionsCount', { n: stats.sessionCount })}{lastDate ? ` (${lastDate})` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Financial Box */}
                  <div style={{
                    background: '#101927', border: '1px solid #22304A', borderRadius: 8,
                    padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#5FD9A2' }}>
                      {t('members.mobileGuestPaidTotal', { amount: fmt(stats.totalPaid) })}
                    </div>
                    <div>
                      {stats.totalDebt > 0 ? (
                        <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#FF9A8F' }}>
                          {t('members.mobileGuestDebt', { amount: fmt(stats.totalDebt) })}
                        </span>
                      ) : (
                        <span style={{ font: "400 12px/1.2 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                          {t('members.mobileGuestNoDebt')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 48px Action Buttons */}
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div
                        onClick={() => setEditingGuest({ ...g })}
                        style={{
                          flex: 1, minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          gap: 6, background: '#1A2437', border: '1px solid #2E3E5C', borderRadius: 6,
                          font: "600 15px/1 'IBM Plex Sans', sans-serif", color: '#A8B7CB', cursor: 'pointer',
                        }}
                      >
                        <Icon name="pencil" size={15} />
                        {t('common.edit')}
                      </div>
                      <div
                        onClick={() => a.confirm({
                          title: t('session.delGuestTitle'),
                          message: t('session.delGuestMsg', { name: g.name }),
                          tone: 'danger',
                          confirmText: t('session.delGuestOk'),
                          onConfirm: () => a.deleteGuest(g.id),
                        })}
                        style={{
                          minHeight: 48, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: '#1A2437', border: '1px solid #2E3E5C', borderRadius: 6,
                          font: "600 15px/1 'IBM Plex Sans', sans-serif", color: '#FF9A8F', cursor: 'pointer',
                        }}
                      >
                        <Icon name="trash-2" size={16} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

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
      </div>
    )
  }

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
              const lastDate = stats.lastSession ? ddmy(stats.lastSession.date) : ''
              const topInviterName = stats.topInviter ? stats.topInviter.name : (g.invitedBy ? memberOf(db, g.invitedBy).name : t('debts.clubRecruited'))
              return (
                <div key={g.id} style={{ ...S.row, borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0, padding: '12px 16px' }}>
                  <Avatar name={g.name} size={36} />
                  <div style={{ flex: 1.5, minWidth: 150 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ font: 'var(--type-label)', fontWeight: 600 }}>{g.name}</span>
                      <LevelChip level={g.level} levels={db.levels} />
                      <GenderChip gender={g.gender} />
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
