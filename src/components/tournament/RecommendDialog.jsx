import { useState } from 'react'
import { Alert, Button, Checkbox, Dialog } from '#ds'
import { Mono } from '#ui'
import { PRIORITIES, recommend } from '#lib/tournament/recommend.js'
import { t } from '#i18n'
import { Seg } from './TourBits.jsx'

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

/**
 * Gợi ý thể thức cho cả giải (README handoff §5.7). BTC KHÔNG nhập gì: số đội, sân, giờ, luật đọc từ giải.
 * Chọn một ưu tiên → mỗi nội dung có phương án khuyên dùng; muốn khác thì chọn phương án khác ngay trong danh sách
 * (nhãn NHANH NHẤT / NHIỀU TRẬN / VƯỢT GIỜ giúp so) → "Áp dụng" một lần cho mọi nội dung chưa có lịch,
 * tuỳ chọn ghi luôn luật trận gợi ý theo khung giờ.
 */
export default function RecommendDialog({ tour, onClose, onApply }) {
  const [priority, setPriority] = useState('balanced')
  const [picks, setPicks] = useState({})
  const [useRules, setUseRules] = useState(false)
  const [busy, setBusy] = useState(false)
  const res = recommend(tour, priority, picks)
  const locked = new Set(tour.stages.filter((s) => s.status !== 'pending').map((s) => s.eventId))
  const todo = res.events.filter((e) => e.pick && !locked.has(e.eventId))

  const apply = async () => {
    setBusy(true)
    if (await onApply(todo, useRules ? res.rules : null)) onClose()
    else setBusy(false)
  }
  const label = (p) => [
    t('tournament.format.tpl.' + p.tpl),
    p.numGroups > 1 ? t('tournament.format.groupCount', { n: p.numGroups }) : null,
    p.advance ? t('tournament.recommend.take', { n: p.advance }) : null,
  ].filter(Boolean).join(' · ')

  const capacityPct = res.capacity ? Math.min(100, Math.round((res.totalMinutes / res.capacity) * 100)) : null
  const isOver = res.capacity ? res.totalMinutes > res.capacity : false

  return (
    <Dialog
      open
      width={680}
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
        {/* Dùng sân / Capacity Bar (theo handoff) */}
        {res.capacity != null && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 10,
            background: 'var(--surface-inset)',
            border: '1px solid var(--border-subtle)',
            display: 'grid',
            gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ font: '600 11.5px/1 var(--font-sans)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                {t('tournament.recommend.courtUsage', { used: res.totalMinutes, capacity: res.capacity })}
              </span>
              <Mono size={12} weight={700} color={isOver ? 'var(--status-incident-fg)' : 'var(--teal-300)'}>
                {t('tournament.recommend.capacityPct', { pct: capacityPct, status: isOver ? t('tournament.recommend.statusOver') : t('tournament.recommend.statusFit') })}
              </Mono>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--border-default)', overflow: 'hidden', position: 'relative' }}>
              <div style={{
                height: '100%',
                width: `${capacityPct}%`,
                borderRadius: 4,
                background: isOver ? 'var(--status-incident-fg)' : 'var(--teal-500)',
                transition: 'width .3s ease, background-color .3s ease',
              }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
              <span>{t('tournament.recommend.startTime', { time: tour.startTime?.slice(0, 5) || '—' })}</span>
              <span>{t('tournament.recommend.finishTime', { finish: res.finish || '—', end: tour.endTime?.slice(0, 5) || '—' })}</span>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gap: 6 }}>
          <Seg options={PRIORITIES.map((k) => ({ key: k, label: t('tournament.recommend.priority.' + k) }))} value={priority}
            onChange={(k) => { setPriority(k); setPicks({}) }} />
          <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.recommend.priorityHint.' + priority)}</span>
        </div>

        <div style={{ display: 'grid', gap: 10, maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
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
                      onClick={() => setPicks((p) => ({ ...p, [e.eventId]: o.key }))}
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
          : (
            <Alert tone={res.fits ? 'success' : 'warning'}>
              {t(res.fits ? 'tournament.recommend.fits' : 'tournament.recommend.over', { finish: res.finish, end: tour.endTime?.slice(0, 5) })}
            </Alert>
          )}
      </div>
    </Dialog>
  )
}
