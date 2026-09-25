import { useMemo, useState } from 'react'
import { Button, Card, Checkbox, DataTable, Dialog, SearchField, Switch } from '#ds'
import { CardList, Empty, GenderChip, LevelChip, Mono } from '#ui'
import { fmtK, playerName } from '#lib/money.js'
import { FILTER0, compareVietnameseNames, filterMembers } from '#lib/members.js'
import { canEnter, entriesOpen } from '#lib/tournament/hub.js'
import { t } from '#i18n'

/**
 * Thí sinh (handoff: bảng Tên · Giới · Rating · Nội dung đăng ký). Chưa có cột "Nguồn" và
 * "+ Thêm người ngoài" — khách ngoài CLB hoãn (plan D3).
 */
export default function PlayersTab({ tour, db, a, canEdit, isMobile }) {
  const [adding, setAdding] = useState(false)
  const entered = useMemo(() => new Set(tour.entries.map((e) => e.eventId + ':' + e.registrationId)), [tour.entries])
  const rows = useMemo(() => tour.registrations
    .map((r) => ({ ...r, name: playerName(db, r.playerId) }))
    .sort((x, y) => (x.status === y.status ? compareVietnameseNames(x.name, y.name) : x.status === 'registered' ? -1 : 1)),
  [tour.registrations, db])

  const chip = (r, ev) => {
    const on = entered.has(ev.id + ':' + r.id)
    const why = !canEnter(ev, r.gender) ? t('tournament.players.wrongGender')
      : !entriesOpen(ev) ? t('tournament.players.lockedHint') : ''
    const off = !canEdit || r.status !== 'registered' || Boolean(why)
    // Chip đang bật vẫn hiện dù sai giới (dữ liệu cũ) — để còn thấy mà xử lý.
    if (why && !on && !canEnter(ev, r.gender)) return null
    return (
      <button
        key={ev.id}
        type="button"
        title={why || undefined}
        disabled={off}
        aria-pressed={on}
        onClick={() => a.tourToggleEntry(r.id, ev.id, !on)}
        style={{
          height: isMobile ? 32 : 26, padding: '0 10px', borderRadius: 99, whiteSpace: 'nowrap',
          font: '600 11px/1 var(--font-sans)', cursor: off ? 'default' : 'pointer', opacity: off && !on ? 0.5 : 1,
          background: on ? 'var(--surface-accent-soft)' : 'transparent',
          color: on ? 'var(--status-transit-fg)' : 'var(--text-muted)',
          border: `1px ${on ? 'solid' : 'dashed'} ${on ? 'var(--teal-500)' : 'var(--border-default)'}`,
        }}
      >
        {on ? '' : '+ '}{t('tournament.kindShort.' + ev.kind)}
      </button>
    )
  }

  const columns = [
    {
      key: 'name', header: t('tournament.players.colName'),
      render: (r) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, opacity: r.status === 'registered' ? 1 : 0.55 }}>
          <span style={{ font: '600 13.5px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{r.name}</span>
          {r.level && <LevelChip level={r.level} levels={db.levels} />}
          {r.status !== 'registered' && <Mono size={11} color="var(--text-muted)">{t('tournament.players.withdrawn')}</Mono>}
        </span>
      ),
    },
    { key: 'gender', header: t('tournament.players.colGender'), width: 70, render: (r) => <GenderChip gender={r.gender} /> },
    {
      key: 'rating', header: t('tournament.players.colRating'), width: 80, align: 'right',
      render: (r) => <Mono>{r.ratingSnapshot == null ? '—' : Math.round(r.ratingSnapshot)}</Mono>,
    },
    {
      key: 'events', header: t('tournament.players.colEvents'),
      render: (r) => (tour.events.length
        ? <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{tour.events.map((ev) => chip(r, ev))}</span>
        : <Mono size={11} color="var(--text-muted)">{t('tournament.players.noEvents')}</Mono>),
    },
    { key: 'fee', header: t('tournament.players.colFee'), width: 100, align: 'right', render: (r) => <Mono>{fmtK(r.fee)}</Mono> },
    {
      key: 'paid', header: t('tournament.players.colPaid'), width: 80, align: 'right',
      render: (r) => (
        <Switch checked={r.paid} size={isMobile ? 'touch' : 'md'} disabled={!canEdit}
          onChange={() => a.tourSetPaid(r.id, !r.paid)} />
      ),
    },
    ...(canEdit ? [{
      key: 'act', header: '', width: 104, align: 'right',
      render: (r) => (
        <Button size="sm" variant="ghost" onClick={() => a.tourWithdraw(r.id, r.status === 'registered')}>
          {t(r.status === 'registered' ? 'tournament.players.withdraw' : 'tournament.players.restore')}
        </Button>
      ),
    }] : []),
  ]

  const active = rows.filter((r) => r.status === 'registered').length
  return (
    <>
      <Card
        title={t('tournament.players.title')}
        subtitle={rows.length ? t('tournament.sub.players', { n: active, unpaid: rows.filter((r) => r.status === 'registered' && !r.paid).length }) : undefined}
        icon="users"
        padding={rows.length && !isMobile ? 0 : undefined}
        actions={canEdit && <Button size="sm" icon="user-round-plus" onClick={() => setAdding(true)}>{t('tournament.players.add')}</Button>}
      >
        {rows.length === 0 && <Empty icon="users" title={t('tournament.players.emptyTitle')} hint={t('tournament.players.emptyHint')} />}
        {rows.length > 0 && (isMobile
          ? <CardList columns={columns} rows={rows} />
          : <DataTable columns={columns} rows={rows} />)}
      </Card>
      {adding && <AddPlayersDialog tour={tour} db={db} onClose={() => setAdding(false)} onAdd={a.tourRegister} />}
    </>
  )
}

/** Chọn thành viên đang hoạt động chưa có trong giải (người đã rút thì Khôi phục, không đăng ký lại). */
function AddPlayersDialog({ tour, db, onClose, onAdd }) {
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  // Nội dung đưa người mới vào luôn — mặc định mọi nội dung còn nhận người (ai sai giới thì tự bỏ qua).
  const openEvents = tour.events.filter(entriesOpen)
  const [evIds, setEvIds] = useState(() => new Set(openEvents.map((e) => e.id)))
  const had = new Set(tour.registrations.map((r) => r.playerId))
  const pool = db.members.filter((m) => m.active && !had.has(m.id))
  const list = filterMembers(db, pool, { ...FILTER0, q }, db.month).sort((x, y) => compareVietnameseNames(x.name, y.name))
  const toggle = (id) => setPicked((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })
  // "Chọn tất cả" theo danh sách ĐANG HIỆN (đã lọc theo ô tìm) — tìm "Nguyễn" rồi chọn hết là đúng nhóm đó.
  const shownPicked = list.filter((m) => picked.has(m.id)).length
  const allShown = list.length > 0 && shownPicked === list.length
  const toggleAll = () => setPicked((s) => {
    const n = new Set(s)
    list.forEach((m) => (allShown ? n.delete(m.id) : n.add(m.id)))
    return n
  })
  const submit = async () => {
    setBusy(true)
    if (await onAdd([...picked], [...evIds])) onClose()
    else setBusy(false)
  }

  return (
    <Dialog
      open
      width={520}
      title={t('tournament.players.addTitle')}
      description={t('tournament.players.addHint')}
      onClose={busy ? undefined : onClose}
      footer={(
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>{t('common.cancel')}</Button>
          <Button loading={busy} disabled={!picked.size} onClick={submit}>
            {t('tournament.players.addSubmit', { n: picked.size })}
          </Button>
        </>
      )}
    >
      <div style={{ display: 'grid', gap: 10 }}>
        {openEvents.length > 0 && (
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={{ font: '600 12px/1.3 var(--font-sans)', color: 'var(--text-secondary)' }}>{t('tournament.players.addEvents')}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {openEvents.map((ev) => (
                <Checkbox key={ev.id} checked={evIds.has(ev.id)} label={t('tournament.kind.' + ev.kind)}
                  onChange={() => setEvIds((s) => { const n = new Set(s); if (n.has(ev.id)) n.delete(ev.id); else n.add(ev.id); return n })} />
              ))}
            </div>
            <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.players.addEventsHint')}</span>
          </div>
        )}
        <SearchField value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ('')} width="100%"
          placeholder={t('tournament.players.search')} />
        {pool.length === 0 && <Empty icon="users" title={t('tournament.players.noneLeft')} />}
        {list.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', minHeight: 44, borderBottom: '1px solid var(--border-default)' }}>
            <Checkbox size="touch" checked={allShown} indeterminate={shownPicked > 0 && !allShown} onChange={toggleAll}
              label={t('tournament.players.selectAll', { n: list.length })} style={{ flex: 1 }} />
          </div>
        )}
        <div style={{ display: 'grid', maxHeight: 380, overflowY: 'auto' }}>
          {list.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, borderBottom: '1px solid var(--border-subtle)' }}>
              <Checkbox size="touch" checked={picked.has(m.id)} onChange={() => toggle(m.id)} label={m.name} style={{ flex: 1 }} />
              <GenderChip gender={m.gender} />
              {m.level && <LevelChip level={m.level} levels={db.levels} />}
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  )
}
