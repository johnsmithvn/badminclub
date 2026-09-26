import { useState } from 'react'
import { Alert, Button, Checkbox, Dialog } from '#ds'
import { Mono } from '#ui'
import { PRIORITIES, fmtClock, genderCounts, pipelineOf, recommend, rulesOf, toMin } from '#lib/tournament/recommend.js'
import { t } from '#i18n'
import { NumStep, Seg } from './TourBits.jsx'

const BADGE_TONE = {
  recommended: { fg: 'var(--action-accent-fg)', bg: 'var(--action-accent-bg)' },
  fastest: { fg: 'var(--status-transit-fg)', bg: 'var(--surface-accent-soft)' },
  mostGames: { fg: 'var(--status-delivered-fg)', bg: 'var(--status-delivered-bg)' },
  over: { fg: 'var(--status-incident-fg)', bg: 'var(--status-incident-bg)' },
  edited: { fg: 'var(--status-delayed-fg)', bg: 'var(--status-delayed-bg)' },
}

function Badge({ k }) {
  const tone = BADGE_TONE[k]
  return (
    <span style={{ padding: '2px 6px', borderRadius: 4, font: '700 9.5px/1 var(--font-sans)', letterSpacing: '0.04em', color: tone.fg, background: tone.bg, whiteSpace: 'nowrap' }}>
      {t('tournament.recommend.badge.' + k)}
    </span>
  )
}

const label = (p) => [
  t('tournament.format.tpl.' + p.tpl),
  p.numGroups > 1 ? t('tournament.format.groupCount', { n: p.numGroups }) : null,
  p.advance ? t('tournament.recommend.take', { n: p.advance }) : null,
].filter(Boolean).join(' · ')

const SIDE_HEAD = { font: '600 11px/1 var(--font-sans)', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }

/**
 * Gợi ý thể thức cho cả giải (README handoff §5.7). Giả lập (cột trái, `sim`): số VĐV nam/nữ, nội dung bật/tắt,
 * sân/giờ/phút-trận — mặc định = số liệu thật của giải, BTC chỉnh tay để lên phương án TRƯỚC khi có đăng ký
 * thật; giả lập không ghi đè gì lên giải, chỉ đổi đầu vào phép tính (xem `recommend.js`). "Áp dụng" chỉ ghi
 * MẪU giai đoạn (numGroups/advance) cho các nội dung chưa có lịch — không đụng đăng ký/đội thật.
 */
export default function RecommendDialog({ tour, onClose, onApply }) {
  const [priority, setPriority] = useState('balanced')
  const [picks, setPicks] = useState({})
  const [useRules, setUseRules] = useState(false)
  const [busy, setBusy] = useState(false)
  const [focus, setFocus] = useState(null)
  const [sim, setSim] = useState(() => {
    const { M, W } = genderCounts(tour)
    const r = tour.events[0] ? rulesOf(tour, tour.events[0]) : { dq: 14, df: 22 }
    return {
      M, W,
      enabled: Object.fromEntries(tour.events.map((e) => [e.id, true])),
      courts: tour.courtLabels?.length || 2,
      start: toMin(tour.startTime) ?? 480,
      end: toMin(tour.endTime) ?? 720,
      dq: r.dq, df: r.df, rest: 3,
    }
  })
  const patchSim = (p) => setSim((s) => ({ ...s, ...p }))

  const locked = new Set(tour.stages.filter((s) => s.status !== 'pending').map((s) => s.eventId))
  const enabled = Object.fromEntries(tour.events.map((e) => [e.id, locked.has(e.id) || sim.enabled[e.id] !== false]))
  const res = recommend(tour, priority, picks, { ...sim, enabled })
  const todo = res.events.filter((e) => e.pick && !locked.has(e.eventId))
  const focusEvent = res.events.find((e) => e.eventId === focus) || res.events[0]
  const focusName = focusEvent && tour.events.find((x) => x.id === focusEvent.eventId)

  const apply = async () => {
    setBusy(true)
    if (await onApply(todo, useRules ? res.rules : null)) onClose()
    else setBusy(false)
  }

  const capacityPct = res.capacity ? Math.min(100, Math.round((res.totalMinutes / res.capacity) * 100)) : null
  const isOver = res.capacity ? res.totalMinutes > res.capacity : false

  return (
    <Dialog
      open
      width={1040}
      title={t('tournament.recommend.title')}
      description={t('tournament.recommend.hint')}
      onClose={busy ? undefined : onClose}
      footer={(
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>{t('common.cancel')}</Button>
          <Button loading={busy} disabled={!todo.length} onClick={apply}>{t('tournament.recommend.apply', { n: todo.length })}</Button>
        </>
      )}
    >
      <div style={{ display: 'grid', gap: 14 }}>
        {res.capacity != null && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={SIDE_HEAD}>{t('tournament.recommend.courtUsage', { used: res.totalMinutes, capacity: res.capacity })}</span>
              <Mono size={12} weight={700} color={isOver ? 'var(--status-incident-fg)' : 'var(--teal-300)'}>
                {t('tournament.recommend.capacityPct', { pct: capacityPct, status: isOver ? t('tournament.recommend.statusOver') : t('tournament.recommend.statusFit') })}
              </Mono>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--border-default)', overflow: 'hidden', position: 'relative' }}>
              <div style={{ height: '100%', width: `${capacityPct}%`, borderRadius: 4, background: isOver ? 'var(--status-incident-fg)' : 'var(--teal-500)', transition: 'width .3s ease, background-color .3s ease' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
              <span>{t('tournament.recommend.startTime', { time: fmtClock(sim.start) })}</span>
              <span>{t('tournament.recommend.finishTime', { finish: res.finish || '—', end: fmtClock(sim.end) })}</span>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0,1fr) 280px', gap: 16, alignItems: 'start' }}>
          {/* Cột trái: giả lập */}
          <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={SIDE_HEAD}>{t('tournament.recommend.people')}</span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)' }}>{t('tournament.recommend.male')}</span>
                <NumStep value={sim.M} max={200} onChange={(n) => patchSim({ M: n })} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)' }}>{t('tournament.recommend.female')}</span>
                <NumStep value={sim.W} max={200} onChange={(n) => patchSim({ W: n })} />
              </div>
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <span style={SIDE_HEAD}>{t('tournament.recommend.content')}</span>
              {tour.events.map((ev) => {
                const on = enabled[ev.id]
                const isLocked = locked.has(ev.id)
                return (
                  <button key={ev.id} type="button" disabled={isLocked} onClick={() => patchSim({ enabled: { ...sim.enabled, [ev.id]: !on } })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, textAlign: 'left', color: 'inherit',
                      background: on ? 'var(--surface-accent-soft)' : 'transparent', border: `1px solid ${on ? 'var(--teal-500)' : 'var(--border-subtle)'}`,
                      cursor: isLocked ? 'default' : 'pointer', opacity: isLocked ? 0.7 : 1,
                    }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: 4, flex: '0 0 auto', display: 'grid', placeItems: 'center',
                      background: on ? 'var(--action-accent-bg)' : 'transparent', border: `1px solid ${on ? 'var(--action-accent-bg)' : 'var(--border-default)'}`,
                      font: '700 11px/1 var(--font-sans)', color: 'var(--action-accent-fg)',
                    }}>{on ? '✓' : ''}</span>
                    <span style={{ flex: 1, font: '600 13px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{t('tournament.kind.' + ev.kind)}</span>
                  </button>
                )
              })}
              <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.recommend.contentHint')}</span>
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <span style={SIDE_HEAD}>{t('tournament.recommend.timeCourt')}</span>
              {[
                [t('tournament.recommend.timeStart'), sim.start, (v) => patchSim({ start: v }), { min: 0, max: 1440, step: 15, format: fmtClock }],
                [t('tournament.recommend.timeEnd'), sim.end, (v) => patchSim({ end: v }), { min: 0, max: 1440, step: 15, format: fmtClock }],
                [t('tournament.recommend.timeCourts'), sim.courts, (v) => patchSim({ courts: v }), { min: 1, max: 30 }],
                [t('tournament.recommend.timeDq'), sim.dq, (v) => patchSim({ dq: v }), { min: 5, max: 60, step: 5 }],
                [t('tournament.recommend.timeDf'), sim.df, (v) => patchSim({ df: v }), { min: 5, max: 60, step: 5 }],
                [t('tournament.recommend.timeRest'), sim.rest, (v) => patchSim({ rest: v }), { min: 0, max: 15 }],
              ].map(([lb, val, onCh, extra]) => (
                <div key={lb} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)' }}>{lb}</span>
                  <NumStep value={val} onChange={onCh} {...extra} />
                </div>
              ))}
            </div>
          </div>

          {/* Cột giữa: phương án */}
          <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <Seg options={PRIORITIES.map((k) => ({ key: k, label: t('tournament.recommend.priority.' + k) }))} value={priority}
                onChange={(k) => { setPriority(k); setPicks({}) }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.recommend.priorityHint.' + priority)}</span>
                {Object.keys(picks).length > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setPicks({})}>{t('tournament.recommend.autoPick')}</Button>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10, maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
              {res.events.length === 0 && <Alert tone="info">{t('tournament.recommend.noContent')}</Alert>}
              {res.events.map((e) => {
                const ev = tour.events.find((x) => x.id === e.eventId)
                const isLocked = locked.has(e.eventId)
                return (
                  <section key={e.eventId} style={{ display: 'grid', gap: 6, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ font: '700 13.5px/1.3 var(--font-sans)', color: 'var(--text-primary)' }}>{t('tournament.kind.' + ev.kind)}</span>
                      <Mono size={11} color="var(--text-muted)">{t(e.estimated ? 'tournament.recommend.teamsEst' : 'tournament.recommend.teams', { n: e.n })}</Mono>
                      {e.edited && <Badge k="edited" />}
                      <span style={{ flex: 1 }} />
                      {e.edited && !isLocked && (
                        <Button size="sm" variant="ghost" onClick={() => setPicks((p) => { const n = { ...p }; delete n[e.eventId]; return n })}>
                          {t('tournament.recommend.resetPick')}
                        </Button>
                      )}
                    </span>
                    {!e.pick && <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.recommend.none')}</span>}
                    {isLocked && e.pick && <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.recommend.locked')}</span>}
                    {!isLocked && e.options.map((o) => {
                      const on = e.pick?.key === o.key
                      return (
                        <button key={o.key} type="button" aria-pressed={on}
                          onClick={() => { setPicks((p) => ({ ...p, [e.eventId]: o.key })); setFocus(e.eventId) }}
                          onFocus={() => setFocus(e.eventId)}
                          style={{
                            display: 'grid', gap: 4, textAlign: 'left', padding: '10px 12px', borderRadius: 8, cursor: 'pointer', color: 'inherit',
                            background: on ? 'var(--surface-accent-soft)' : 'transparent',
                            border: `1px solid ${on ? 'var(--teal-500)' : 'var(--border-subtle)'}`,
                            boxShadow: on ? '0 0 0 1px var(--teal-500)' : 'none',
                            transition: 'background .15s, border-color .15s, box-shadow .15s',
                          }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ font: `${on ? 700 : 600} 13px/1.3 var(--font-sans)`, color: 'var(--text-primary)' }}>{label(o)}</span>
                            {o.badges.map((b) => <Badge key={b} k={b} />)}
                          </span>
                          <Mono size={11} color="var(--text-muted)">{t('tournament.recommend.optionLine', { n: o.matches, g: o.minG, m: o.minutes })}</Mono>
                        </button>
                      )
                    })}
                  </section>
                )
              })}
            </div>

            {res.rules && (
              <div style={{ display: 'grid', gap: 6, padding: 12, borderRadius: 8, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ font: '600 12px/1.3 var(--font-sans)', color: 'var(--text-secondary)' }}>{t('tournament.recommend.rulesTitle')}</span>
                <Mono size={12} color="var(--text-primary)">
                  {t('tournament.recommend.rulesText', { q: t('tournament.format.preset.' + res.rules.qualify), f: t('tournament.format.preset.' + res.rules.final) })}
                </Mono>
                <Checkbox checked={useRules} onChange={() => setUseRules((x) => !x)} label={t('tournament.recommend.useRules')} />
              </div>
            )}

            {res.capacity == null
              ? <Alert tone="info">{t('tournament.recommend.noWindow')}</Alert>
              : <Alert tone={res.fits ? 'success' : 'warning'}>{t(res.fits ? 'tournament.recommend.fits' : 'tournament.recommend.over', { finish: res.finish, end: fmtClock(sim.end) })}</Alert>}
          </div>

          {/* Cột phải: xem trước */}
          <div style={{ display: 'grid', gap: 10, alignContent: 'start', minWidth: 0, padding: 14, borderRadius: 10, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}>
            <span style={SIDE_HEAD}>{t('tournament.recommend.preview')}</span>
            {!focusEvent?.pick ? (
              <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.recommend.noContent')}</span>
            ) : (
              <>
                <span style={{ font: '700 15px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{t('tournament.kind.' + focusName.kind)}</span>
                <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{label(focusEvent.pick)}</span>
                <div style={{ display: 'grid', gap: 4 }}>
                  {pipelineOf(focusEvent.pick, focusEvent.n).map((s, i) => (
                    <div key={i} style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                      <span style={{ display: 'block', font: '700 12.5px/1.3 var(--font-sans)', color: 'var(--text-primary)' }}>
                        {s.key === 'groups' ? (s.numGroups > 1 ? t('tournament.stage.groups') : t('tournament.format.tpl.rr')) : s.key === 'plate' ? t('tournament.stage.plate') : t('tournament.format.tpl.ko')}
                      </span>
                      <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
                        {s.key === 'groups' ? t('tournament.format.groupCount', { n: s.numGroups }) + ' · ' + s.sizes.join('/') : s.key === 'ko' ? t('tournament.recommend.toNext', { n: s.n }) : null}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gap: 4, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                  <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.recommend.optionLine', { n: focusEvent.pick.matches, g: focusEvent.pick.minG, m: focusEvent.pick.minutes })}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  )
}
