// Chia sân: kéo thả · 5 chế độ xếp · cố định người theo sân · bấm giờ · ghi trận (handoff 05).
// KHÔNG ảnh hưởng tiền — chỉ là công cụ điều phối tại sân.

import { useRef } from 'react'
import { Button, Card, Input, Select, Switch } from '#ds'
import { Empty, LevelChip, Mono, Overline, playerMeta } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { elapsedMin, useClock } from '#hooks/useClock.js'
import { dd, wd } from '#utils/dates.js'
import { courtOf, groupOf, headCount } from '#lib/money.js'
import {
  ASSIGN_MODES, activeCourtIdxs, assignableSessions, courtBalance, courtSlotIds,
  fairness, matchStats, sessionPlayers, slotIds,
} from '#lib/assign.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }

export default function Assign() {
  const { db, ui, a } = useApp()
  const list = assignableSessions(db)
  const s = list.find((x) => x.id === ui.assignId) || list[0] || null

  // Có sân nào đang bấm giờ thì cần re-render định kỳ để đồng hồ nhảy.
  const anyPlaying = s ? Object.values((db.playing || {})[s.id] || {}).some(Boolean) : false
  useClock(anyPlaying)

  const dragKey = useRef(null)

  if (!s) {
    return (
      <Card padding="0">
        <Empty icon="route" title={t('assign.emptyTitle')} hint={t('assign.emptyHint')} />
      </Card>
    )
  }

  const players = sessionPlayers(db, s)
  const pmap = {}
  players.forEach((p) => { pmap[p.key] = p })
  const lineup = (db.lineups || {})[s.id] || {}
  const placed = Object.values(lineup)
  const groupMode = !!(db.groupMode || {})[s.id]
  const courtGroups = (db.courtGroups || {})[s.id] || {}
  const idxs = activeCourtIdxs(s)
  const stats = matchStats(db.matches, s.id)
  const matches = (db.matches || []).filter((x) => x.sessionId === s.id)
  const fair = fairness(players, stats)
  const levelOfKey = (k) => (pmap[k] || {}).level

  // Danh sách chờ: chế độ thường = ai chưa lên sân; chế độ cố định theo sân = ai chưa được gán sân.
  const pool = groupMode
    ? players.filter((p) => courtGroups[p.key] === undefined)
    : players.filter((p) => placed.indexOf(p.key) < 0)

  const drop = (e, fn) => {
    e.preventDefault()
    let k = dragKey.current
    try { k = e.dataTransfer.getData('text/plain') || k } catch { /* Safari trong drag */ }
    if (k) fn(k)
  }
  const dragProps = (key) => ({
    draggable: true,
    onDragStart: (e) => {
      dragKey.current = key
      try {
        e.dataTransfer.setData('text/plain', key)
        e.dataTransfer.effectAllowed = 'move'
      } catch { /* bỏ qua */ }
    },
  })

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* ---------------- Chọn buổi nếu có nhiều buổi ---------------- */}
      {list.length > 1 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {list.map((x) => {
            const on = x.id === s.id
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => a.setAssignSession(x.id)}
                style={{
                  ...S.sessionTab,
                  background: on ? 'var(--navy-700)' : 'var(--surface-card)',
                  borderColor: on ? 'var(--navy-700)' : 'var(--border-subtle)',
                  color: on ? '#fff' : 'var(--text-primary)',
                }}
              >
                <Mono weight={600} color={on ? '#fff' : 'var(--text-primary)'}>
                  {dd(x.date) + ' · ' + wd(x.date)}
                </Mono>
                <span style={{ fontSize: 12, color: on ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}>
                  {groupOf(db, x.groupId).name} · {headCount(db, x)} {t('units.people')}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div style={S.layout}>
        {/* ---------------- Cột trái: Danh sách người chờ ---------------- */}
        <Card
          title={groupMode ? t('assign.poolTitleGrouped') : t('assign.poolTitle')}
          subtitle={t(groupMode ? 'assign.poolSubGrouped' : 'assign.poolSub', {
            waiting: pool.length, total: players.length,
          })}
          icon="users"
          padding="12px"
        >
          <div
            style={{ display: 'grid', gap: 6, minHeight: 140 }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => drop(e, (k) => a.removeFromCourt(s.id, k))}
          >
            {pool.map((p) => {
              const on = ui.picked === p.key
              return (
                <div
                  key={p.key}
                  {...dragProps(p.key)}
                  onClick={() => a.pickPlayer(p.key)}
                  style={{
                    ...S.person,
                    cursor: 'grab',
                    background: on ? 'var(--surface-brand-soft)' : 'var(--surface-card)',
                    borderColor: on ? 'var(--teal-500)' : 'var(--border-subtle)',
                    boxShadow: on ? '0 0 0 1px var(--teal-500)' : 'none',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.label}>{p.name}</div>
                    <div style={S.caption}>{playerMeta(p, stats[p.key] && stats[p.key].n)}</div>
                  </div>
                  <LevelChip level={p.level} levels={db.levels} />
                </div>
              )
            })}
            {pool.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--text-muted)', fontSize: 12 }}>
                {t('assign.howto')}
              </div>
            )}
          </div>
        </Card>

        {/* ---------------- Cột phải: Bảng điều khiển & Các sân ---------------- */}
        <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
          <Toolbar s={s} lineup={lineup} idxs={idxs} fair={fair} matches={matches} />

          {idxs.length > 1 && (
            <div style={S.groupBar}>
              <Switch
                label={t('assign.groupModeLabel')}
                checked={groupMode}
                onChange={() => a.toggleGroupMode(s.id)}
              />
              <span style={S.caption}>{t(groupMode ? 'assign.groupModeOn' : 'assign.groupModeOff')}</span>
            </div>
          )}

          <div style={S.courtGrid}>
            {idxs.map((ci) => {
              const c = s.courts[ci]
              const bal = courtBalance(lineup, ci, levelOfKey, db.levels)
              const slots = courtSlotIds(ci)
              const onCourt = slots.filter((sl) => lineup[sl]).length
              const startedAt = ((db.playing || {})[s.id] || {})[ci]
              const mins = ((db.courtMin || {})[s.id] || {})[ci]
              const minutes = mins === undefined ? cfg.match.defaultMinutes : mins
              const running = elapsedMin(startedAt)
              const rosterHere = players.filter((p) => courtGroups[p.key] === ci)

              const Slot = ({ id }) => {
                const key = lineup[id]
                const p = key ? pmap[key] : null
                return (
                  <div
                    onClick={() => (ui.picked ? a.place(s.id, id, ui.picked) : p && a.pickPlayer(p.key))}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => drop(e, (k) => a.place(s.id, id, k))}
                    {...(p ? dragProps(p.key) : {})}
                    style={{
                      ...S.slot,
                      background: p ? 'var(--surface-card)' : 'var(--surface-inset)',
                      border: p ? '1px solid var(--border-subtle)' : '1.5px dashed var(--border-strong)',
                      cursor: p ? 'grab' : 'pointer',
                    }}
                  >
                    {p ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <span style={{ ...S.label, fontWeight: 600 }}>{p.name}</span>
                          <LevelChip level={p.level} levels={db.levels} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 'auto' }}>
                          <span style={S.caption}>{playerMeta(p, stats[p.key] && stats[p.key].n)}</span>
                        </div>
                      </>
                    ) : (
                      <div style={{ margin: 'auto', textAlign: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-disabled)', fontWeight: 500 }}>
                          + {t('assign.emptySlot')}
                        </span>
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <div key={ci} style={S.court}>
                  {/* Header Sân */}
                  <div style={S.courtHead}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ font: 'var(--type-h3)', color: 'var(--text-primary)' }}>
                        {courtOf(db, c.courtId).name}
                      </span>
                      {c.extra && <span style={S.tagAmber}>{t('assign.extraTag')}</span>}
                      <Mono color="var(--text-muted)" size={12}>{c.from + ' → ' + c.to}</Mono>
                    </div>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: bal.color,
                      padding: '3px 8px',
                      borderRadius: 99,
                      background: 'var(--surface-inset)',
                    }}>
                      {bal.text}
                    </span>
                  </div>

                  {/* Thanh đếm giờ & hoàn thành trận */}
                  <div style={S.matchBar}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Button
                        size="sm"
                        variant={startedAt ? 'secondary' : 'primary'}
                        icon={startedAt ? 'pause' : 'play'}
                        onClick={() => a.startCourt(s.id, ci)}
                      >
                        {t(startedAt ? 'assign.pause' : 'assign.start')}
                      </Button>
                      <Button
                        size="sm"
                        variant="accent"
                        icon="check"
                        onClick={() => a.finishCourt(s.id, ci, running || minutes)}
                      >
                        {t('assign.finish')}
                      </Button>
                      <Input
                        size="sm"
                        mono
                        suffix={t('units.minute')}
                        value={String(minutes)}
                        onChange={(e) => a.setCourtMin(s.id, ci, e.target.value)}
                        style={{ width: 96 }}
                      />
                    </div>
                    <span style={{
                      font: 'var(--type-caption)',
                      fontWeight: 500,
                      color: startedAt ? 'var(--status-delivered)' : 'var(--text-muted)',
                    }}>
                      {startedAt
                        ? t('assign.playing', { min: running })
                        : onCourt ? t('assign.notStarted') : t('assign.courtEmpty')}
                    </span>
                  </div>

                  {/* Khu vực mặt sân cầu lông */}
                  <div style={S.courtBody}>
                    {groupMode && (
                      <div
                        style={S.roster}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => drop(e, (k) => a.assignToCourt(s.id, k, ci))}
                        onClick={() => ui.picked && a.assignToCourt(s.id, ui.picked, ci)}
                      >
                        <Overline>{t('assign.rosterCount', { n: rosterHere.length, on: onCourt })}</Overline>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {rosterHere.filter((p) => placed.indexOf(p.key) < 0).map((p) => (
                            <div key={p.key} {...dragProps(p.key)} onClick={() => a.pickPlayer(p.key)} style={S.rosterChip}>
                              <span style={S.label}>{p.name}</span>
                              <LevelChip level={p.level} levels={db.levels} />
                            </div>
                          ))}
                          {rosterHere.length === 0 && <span style={S.caption}>{t('assign.rosterEmpty')}</span>}
                        </div>
                      </div>
                    )}

                    {/* Đội A (2 người) */}
                    <div style={S.teamRow}>
                      <Slot id={slots[0]} />
                      <Slot id={slots[1]} />
                    </div>

                    {/* Lưới phân cách */}
                    <div style={S.net}>
                      <div style={S.netLine} />
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 1.5,
                        color: 'var(--text-muted)',
                        padding: '0 8px',
                      }}>
                        {t('assign.net')}
                      </span>
                      <div style={S.netLine} />
                    </div>

                    {/* Đội B (2 người) */}
                    <div style={S.teamRow}>
                      <Slot id={slots[2]} />
                      <Slot id={slots[3]} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Thanh công cụ: chọn chế độ, xếp, xóa, chia đều, trạng thái chỗ, độ đều lượt. */
function Toolbar({ s, lineup, idxs, fair, matches }) {
  const { ui, a } = useApp()
  const mode = ui.asnMode || 'balance'
  const modeInfo = ASSIGN_MODES.find((m) => m.value === mode) || ASSIGN_MODES[0]
  const total = slotIds(s).length
  const on = Object.keys(lineup).length
  const totalMin = matches.reduce((x, m) => x + m.minutes, 0)
  const toneColor = fair.tone === 'ok' ? 'var(--status-delivered)'
    : fair.tone === 'warn' ? 'var(--status-delayed)' : 'var(--text-muted)'

  return (
    <div style={S.toolbarBox}>
      {/* Dòng 1: Chọn chế độ & Các nút lệnh chính */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Select
            value={mode}
            options={ASSIGN_MODES.map((m) => ({ value: m.value, label: m.label }))}
            onChange={(e) => a.setAsnMode(e.target.value)}
            style={{ width: 230 }}
          />
          <Button variant="primary" icon="wand-sparkles" onClick={() => a.arrange(s.id, mode)}>
            {t('assign.arrangeNow')}
          </Button>
          <Button variant="secondary" icon="eraser" onClick={() => a.clearLineup(s.id)}>
            {t('assign.clear')}
          </Button>
          {idxs.length > 1 && (
            <Button variant="secondary" icon="split" onClick={() => a.autoSplitCourts(s.id)}>
              {t('assign.splitEven')}
            </Button>
          )}
        </div>

        {/* Badge trạng thái chỗ ngồi */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 8,
          background: 'var(--surface-inset)',
          border: '1px solid var(--border-subtle)',
          fontSize: 12.5,
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          <span>{t('assign.seats', { on, total, courts: idxs.length })}</span>
        </div>
      </div>

      {/* Dòng 2: Thông tin lượt đánh & nút hoàn tác */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        paddingTop: 8,
        borderTop: '1px solid var(--border-subtle)',
        fontSize: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {t('assign.matchTotal', { n: matches.length, min: totalMin })}
          </span>
          <span style={{ color: 'var(--text-disabled)' }}>·</span>
          <span style={{ color: toneColor, fontWeight: 500 }}>{fair.text}</span>
          <span style={{ color: 'var(--text-disabled)' }}>·</span>
          <span style={{ color: 'var(--text-muted)' }}>{modeInfo.desc}</span>
        </div>

        {matches.length > 0 && (
          <Button variant="ghost" size="sm" icon="undo-2" onClick={() => a.undoMatch(s.id)}>
            {t('assign.undoMatch')}
          </Button>
        )}
      </div>
    </div>
  )
}

const S = {
  layout: { display: 'grid', gridTemplateColumns: '270px minmax(0, 1fr)', gap: 14, alignItems: 'start' },
  sessionTab: {
    padding: '8px 14px', borderRadius: 8, border: '1px solid',
    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', font: 'inherit',
    transition: 'all 0.15s ease',
  },
  person: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
    border: '1px solid', borderRadius: 8, transition: 'all 0.15s ease',
  },
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  toolbarBox: {
    background: 'var(--surface-card)', borderRadius: 10, padding: '12px 14px',
    border: '1px solid var(--border-subtle)', display: 'grid', gap: 10,
    boxShadow: 'var(--shadow-xs)',
  },
  groupBar: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '9px 14px',
    borderRadius: 8, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)',
  },
  courtGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 },
  court: {
    border: '1px solid var(--border-subtle)', borderRadius: 10, boxShadow: 'var(--shadow-xs)',
    overflow: 'hidden', background: 'var(--surface-card)',
  },
  courtHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, padding: '10px 14px', flexWrap: 'wrap',
    borderBottom: '1px solid var(--border-subtle)',
  },
  matchBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, padding: '8px 14px', flexWrap: 'wrap',
    background: 'var(--surface-inset)', borderBottom: '1px solid var(--border-subtle)',
  },
  courtBody: {
    background: 'var(--surface-sunken)', padding: '12px 14px', display: 'grid', gap: 10,
  },
  teamRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  slot: {
    minHeight: 64, borderRadius: 8, padding: '8px 10px',
    display: 'flex', flexDirection: 'column', gap: 4, transition: 'all 0.15s ease',
  },
  net: { display: 'flex', alignItems: 'center', gap: 4, margin: '2px 0' },
  netLine: { flex: 1, height: 1, background: 'var(--border-strong)', opacity: 0.7 },
  roster: {
    border: '1px dashed var(--navy-500)', borderRadius: 8, padding: '8px 10px', display: 'grid', gap: 6,
    background: 'var(--surface-card)',
  },
  rosterChip: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 99,
    background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', cursor: 'grab',
  },
  tagAmber: {
    font: '600 10px/1 var(--font-sans)', padding: '4px 8px', borderRadius: 99,
    background: 'var(--status-delayed-bg)', color: 'var(--status-delayed-fg)', whiteSpace: 'nowrap',
  },
}
