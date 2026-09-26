import { useMemo, useState } from 'react'
import { Alert, Button, Card, Checkbox, DataTable, Dialog, Input, SearchField, Select, Switch } from '#ds'
import { CardList, Empty, GenderChip, LevelChip, Mono } from '#ui'
import { fmtK } from '#lib/money.js'
import { FILTER0, compareVietnameseNames, filterMembers } from '#lib/members.js'
import { canEnter, entriesOpen, regName } from '#lib/tournament/hub.js'
import { t } from '#i18n'
import { Seg } from './TourBits.jsx'

/**
 * Thí sinh (handoff: bảng Tên · Giới · Rating · Nội dung đăng ký). Khách ngoài CLB (0059) chỉ khi giải
 * "Mở rộng" — gắn nhãn Khách. Giải miễn phí: ẩn hẳn phí / đã đóng (không có gì để tick).
 */
export default function PlayersTab({ tour, db, a, canEdit, isMobile, event, onGo }) {
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState('all') // 'all' | 'guests'
  const entered = useMemo(() => new Set(tour.entries.map((e) => e.eventId + ':' + e.registrationId)), [tour.entries])
  const rows = useMemo(() => tour.registrations
    .map((r) => ({ ...r, name: regName(tour, db, r) }))
    .sort((x, y) => (x.status === y.status ? compareVietnameseNames(x.name, y.name) : x.status === 'registered' ? -1 : 1)),
  [tour, db])

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

  // Giải miễn phí (phí 0 và không ai bị chốt phí) → không có cột tiền, không có việc "thu phí".
  const free = !tour.feeMale && !tour.feeFemale && rows.every((r) => !r.fee)
  const unpaid = rows.filter((r) => r.status === 'registered' && !r.paid && r.fee > 0).length

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
    {
      key: 'source', header: t('tournament.players.colSource'), width: 96,
      render: (r) => (r.playerType === 'guest'
        ? <Mono size={10.5} weight={700} color="var(--status-transit-fg)">{t('tournament.players.guestTag')}</Mono>
        : <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.players.sourceMember')}</span>),
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
    ...(free ? [] : [
      { key: 'fee', header: t('tournament.players.colFee'), width: 100, align: 'right', render: (r) => <Mono>{fmtK(r.fee)}</Mono> },
      {
        key: 'paid', header: t('tournament.players.colPaid'), width: 80, align: 'right',
        render: (r) => (
          <Switch checked={r.paid} size={isMobile ? 'touch' : 'md'} disabled={!canEdit}
            onChange={() => a.tourSetPaid(r.id, !r.paid)} />
        ),
      },
    ]),
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
  const guestRows = rows.filter((r) => r.playerType === 'guest')
  const shown = filter === 'guests' ? guestRows : rows
  // Giải "Nội bộ" mà vẫn còn khách đăng ký từ trước (đổi phạm vi sau): giữ nguyên họ, chỉ báo rõ — không tự gỡ.
  const hiddenNote = tour.scope !== 'open' && guestRows.some((r) => r.status === 'registered')
  const pairingEvent = event && event.teamSize > 1 ? event : null
  return (
    <>
      {hiddenNote && <Alert tone="info">{t('tournament.players.hiddenGuests', { n: guestRows.filter((r) => r.status === 'registered').length })}</Alert>}
      {guestRows.length > 0 && (
        <div style={{ display: 'flex', gap: 8 }}>
          <Seg options={[
            { key: 'all', label: t('tournament.players.filterAll', { n: rows.length }) },
            { key: 'guests', label: t('tournament.players.filterGuests', { n: guestRows.length }) },
          ]} value={filter} onChange={setFilter} />
        </div>
      )}
      <Card
        title={t('tournament.players.title')}
        subtitle={rows.length ? t(free ? 'tournament.sub.playersFree' : 'tournament.sub.players', { n: active, unpaid }) : undefined}
        icon="users"
        padding={rows.length && !isMobile ? 0 : undefined}
        actions={canEdit && (
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!free && unpaid > 0 && (
              <Button size="sm" variant="secondary" icon="check" onClick={a.tourSetAllPaid}>{t('tournament.players.allPaid', { n: unpaid })}</Button>
            )}
            <Button size="sm" icon="user-round-plus" onClick={() => setAdding(true)}>{t('tournament.players.add')}</Button>
          </span>
        )}
      >
        {rows.length === 0 && <Empty icon="users" title={t('tournament.players.emptyTitle')} hint={t('tournament.players.emptyHint')} />}
        {shown.length > 0 && (isMobile
          ? <CardList columns={columns} rows={shown} />
          : <DataTable columns={columns} rows={shown} />)}
      </Card>
      {pairingEvent && onGo && rows.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="secondary" iconAfter="arrow-right" onClick={() => onGo('pairing')}>
            {t('tournament.players.openPairing', { name: t('tournament.kind.' + pairingEvent.kind) })}
          </Button>
        </div>
      )}
      {adding && <AddPlayersDialog tour={tour} db={db} onClose={() => setAdding(false)} onAdd={a.tourRegister} />}
    </>
  )
}

/**
 * Thêm thí sinh: thành viên CLB; giải "Mở rộng" thì thêm được người ngoài — chọn lại người đã từng thi
 * (danh sách của CLB) hoặc gõ tên + giới (trình độ tuỳ chọn). Có ≥ 2 nội dung còn nhận người thì chọn đưa vào
 * nội dung nào (mặc định tất cả); chỉ 1 nội dung thì vào luôn, không hỏi.
 */
function AddPlayersDialog({ tour, db, onClose, onAdd }) {
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState(() => new Set()) // 'm:<memberId>' | 'g:<guestId>' | 'n:<tạm>'
  const [fresh, setFresh] = useState([]) // khách mới gõ tay: { key, name, gender, level }
  const [draft, setDraft] = useState({ name: '', gender: 'nam', level: '', phone: '' })
  const [busy, setBusy] = useState(false)
  const openEvents = tour.events.filter(entriesOpen)
  const [evIds, setEvIds] = useState(() => new Set(openEvents.map((e) => e.id)))
  const open = tour.scope === 'open'
  const had = new Set(tour.registrations.map((r) => r.playerId))
  const pool = db.members.filter((m) => m.active && !had.has(m.id))
  const needle = q.trim().toLowerCase()
  const members = filterMembers(db, pool, { ...FILTER0, q }, db.month).sort((x, y) => compareVietnameseNames(x.name, y.name))
  const guests = open
    ? (tour.guests || []).filter((g) => !had.has(g.id) && (!needle || g.name.toLowerCase().includes(needle)))
      .sort((x, y) => compareVietnameseNames(x.name, y.name))
    : []
  const list = [
    ...fresh.map((g) => ({ key: g.key, name: g.name, gender: g.gender, level: g.level, guest: true })),
    ...members.map((m) => ({ key: 'm:' + m.id, name: m.name, gender: m.gender, level: m.level })),
    ...guests.map((g) => ({ key: 'g:' + g.id, name: g.name, gender: g.gender, level: g.level, guest: true })),
  ]
  const toggle = (key) => setPicked((s) => {
    const n = new Set(s)
    if (n.has(key)) n.delete(key)
    else n.add(key)
    return n
  })
  // "Chọn tất cả" theo danh sách ĐANG HIỆN (đã lọc theo ô tìm) — tìm "Nguyễn" rồi chọn hết là đúng nhóm đó.
  const shownPicked = list.filter((x) => picked.has(x.key)).length
  const allShown = list.length > 0 && shownPicked === list.length
  const toggleAll = () => setPicked((s) => {
    const n = new Set(s)
    list.forEach((x) => (allShown ? n.delete(x.key) : n.add(x.key)))
    return n
  })
  // Khách mới: chỉ cần tên + giới; thêm xong là đã được chọn sẵn, ô tên trống để gõ người kế.
  const addFresh = () => {
    const name = draft.name.trim()
    if (!name) return
    const key = `n:${fresh.length}:${name}`
    setFresh((f) => [{ key, name, gender: draft.gender, level: draft.level, phone: draft.phone.trim() }, ...f])
    setPicked((s) => new Set(s).add(key))
    setDraft((d) => ({ ...d, name: '', phone: '' }))
  }
  const submit = async () => {
    setBusy(true)
    const ids = (prefix) => [...picked].filter((k) => k.startsWith(prefix)).map((k) => k.slice(2))
    const newGuests = fresh.filter((g) => picked.has(g.key)).map(({ name, gender, level, phone }) => ({ name, gender, level, phone }))
    if (await onAdd(ids('m:'), [...evIds], { guestIds: ids('g:'), newGuests })) onClose()
    else setBusy(false)
  }

  return (
    <Dialog
      open
      width={520}
      title={t('tournament.players.addTitle')}
      description={t(open ? 'tournament.players.addHintOpen' : 'tournament.players.addHint')}
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
        {openEvents.length > 1 && (
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
        {open && (
          <div style={{ display: 'grid', gap: 6, padding: 10, borderRadius: 8, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ font: '600 12px/1.3 var(--font-sans)', color: 'var(--text-secondary)' }}>{t('tournament.players.guestAdd')}</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Input containerStyle={{ flex: '1 1 160px' }} placeholder={t('tournament.players.guestName')} value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && addFresh()} />
              <Input containerStyle={{ flex: '0 1 130px' }} placeholder={t('tournament.players.guestPhone')} inputMode="tel" value={draft.phone}
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} />
              <Seg options={['nam', 'nu'].map((k) => ({ key: k, label: t('gender.' + k) }))} value={draft.gender}
                onChange={(g) => setDraft((d) => ({ ...d, gender: g }))} />
              {db.levels?.length > 0 && (
                <Select size="sm" aria-label={t('tournament.players.guestLevel')} value={draft.level}
                  onChange={(e) => setDraft((d) => ({ ...d, level: e.target.value }))}
                  options={[{ value: '', label: t('tournament.players.guestLevel') }, ...db.levels.map((l) => ({ value: l, label: l }))]} />
              )}
              <Button size="sm" icon="plus" disabled={!draft.name.trim()} onClick={addFresh}>{t('tournament.players.guestAddBtn')}</Button>
            </div>
          </div>
        )}
        <SearchField value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ('')} width="100%"
          placeholder={t('tournament.players.search')} />
        {list.length === 0 && <Empty icon="users" title={t('tournament.players.noneLeft')} />}
        {list.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', minHeight: 44, borderBottom: '1px solid var(--border-default)' }}>
            <Checkbox size="touch" checked={allShown} indeterminate={shownPicked > 0 && !allShown} onChange={toggleAll}
              label={t('tournament.players.selectAll', { n: list.length })} style={{ flex: 1 }} />
          </div>
        )}
        <div style={{ display: 'grid', maxHeight: 380, overflowY: 'auto' }}>
          {list.map((x) => (
            <div key={x.key} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, borderBottom: '1px solid var(--border-subtle)' }}>
              <Checkbox size="touch" checked={picked.has(x.key)} onChange={() => toggle(x.key)} label={x.name} style={{ flex: 1 }} />
              {x.guest && <Mono size={10.5} weight={700} color="var(--status-transit-fg)">{t('tournament.players.guestTag')}</Mono>}
              <GenderChip gender={x.gender} />
              {x.level && <LevelChip level={x.level} levels={db.levels} />}
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  )
}
