// Mảnh nhỏ dùng chung của màn Giải đấu. Màu chỉ qua token (docs/TOURNAMENT_PLAN.md §6.1).

import { useState } from 'react'
import { Button, Input, StatusPill } from '#ds'
import { RULE_PRESETS, presetKeyOf } from '#lib/tournament/format.js'
import { validRule } from '#lib/tournament/scoring.js'
import { t } from '#i18n'

// Trạng thái → màu pill của TDMS. Nháp xám, mở đăng ký xanh dương, đang diễn ra teal, xong xanh lá.
const TOUR_PILL = { draft: 'idle', registration: 'scheduled', running: 'transit', finished: 'delivered', cancelled: 'cancelled' }
const EVENT_PILL = { draft: 'scheduled', pairing: 'loading', drawn: 'assigned', running: 'transit', finished: 'delivered' }

export const TourPill = ({ status: raw, size = 'sm' }) => {
  const status = raw === 'draft' ? 'registration' : raw // giải "nháp" cũ: không còn bước nháp riêng
  return <StatusPill status={TOUR_PILL[status] || 'idle'} label={t('tournament.status.' + status)} size={size} />
}

export const EventPill = ({ status }) => (
  <StatusPill status={EVENT_PILL[status] || 'idle'} label={t('tournament.eventStatus.' + status)} size="sm" />
)

/** Ô mã nội dung (ĐN, ĐNN…) — cùng kiểu ô số của stepper trong handoff. */
export const KindCode = ({ kind, on }) => (
  <span style={{
    minWidth: 34, height: 34, padding: '0 6px', borderRadius: 8, display: 'grid', placeItems: 'center',
    font: '700 11.5px/1 var(--font-mono)', flex: '0 0 auto',
    background: on ? 'var(--action-accent-bg)' : 'var(--surface-inset)',
    color: on ? 'var(--action-accent-fg)' : 'var(--text-secondary)',
    border: `1px solid ${on ? 'transparent' : 'var(--border-default)'}`,
  }}>
    {t('tournament.kindShort.' + kind)}
  </span>
)



/** Hàng nút chọn một (handoff: các hàng tuỳ chọn ở Thể thức, "Cách ghép" ở Ghép cặp). */
export function Seg({ options, value, onChange, disabled, size = 30 }) {
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, padding: 3, borderRadius: 8, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}>
      {options.map((o) => {
        const on = o.key === value
        return (
          <button
            key={o.key}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => !on && onChange(o.key)}
            style={{
              height: size, padding: '0 11px', borderRadius: 6, border: 'none', whiteSpace: 'nowrap',
              cursor: disabled ? 'default' : 'pointer', font: `${on ? 700 : 600} 12px/1 var(--font-sans)`,
              background: on ? 'var(--action-accent-bg)' : 'transparent',
              color: on ? 'var(--action-accent-fg)' : 'var(--text-secondary)',
              opacity: disabled && !on ? 0.55 : 1,
            }}
          >
            {o.label}
          </button>
        )
      })}
    </span>
  )
}

/**
 * Chọn luật trận: các luật mẫu (app.json) + "Tuỳ chỉnh luật" (handoff: số sec · điểm chạm · cách 2 · trần).
 * Tuỳ chỉnh chỉ ghi khi bấm "Dùng luật này" và luật hợp lệ (`validRule`) — không ghi dở dang từng phím gõ.
 */
export function RuleField({ value, onChange, disabled }) {
  const preset = presetKeyOf(value)
  const [open, setOpen] = useState(!preset && Boolean(value?.points))
  const [d, setD] = useState(() => ({ sets: value?.sets || 1, points: String(value?.points || 21), winBy2: Boolean(value?.winBy2), cap: String(value?.cap || 30) }))
  const opts = [
    ...Object.keys(RULE_PRESETS).map((k) => ({ key: k, label: t('tournament.format.preset.' + k) })),
    { key: 'custom', label: t('tournament.format.customRule') },
  ]
  const draft = { sets: d.sets, points: Number(d.points), winBy2: d.winBy2, cap: d.winBy2 ? Number(d.cap) : Number(d.points) }
  const ok = validRule(draft)
  return (
    <span style={{ display: 'grid', gap: 8 }}>
      <Seg options={opts} value={open ? 'custom' : preset} disabled={disabled}
        onChange={(k) => (k === 'custom' ? setOpen(true) : (setOpen(false), onChange({ ...RULE_PRESETS[k] })))} />
      {open && (
        <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <span style={{ display: 'grid', gap: 4 }}>
            <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.format.ruleSets')}</span>
            <Seg options={[1, 3, 5].map((k) => ({ key: k, label: String(k) }))} value={d.sets} disabled={disabled} onChange={(k) => setD((x) => ({ ...x, sets: k }))} />
          </span>
          <Input label={t('tournament.format.rulePoints')} mono inputMode="numeric" value={d.points} disabled={disabled}
            containerStyle={{ width: 90 }} onChange={(e) => setD((x) => ({ ...x, points: e.target.value.replace(/\D/g, '') }))} />
          <span style={{ display: 'grid', gap: 4 }}>
            <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.format.ruleWinBy2')}</span>
            <Seg options={[{ key: 'on', label: t('tournament.format.on') }, { key: 'off', label: t('tournament.format.off') }]}
              value={d.winBy2 ? 'on' : 'off'} disabled={disabled} onChange={(k) => setD((x) => ({ ...x, winBy2: k === 'on' }))} />
          </span>
          {d.winBy2 && (
            <Input label={t('tournament.format.ruleCap')} mono inputMode="numeric" value={d.cap} disabled={disabled}
              containerStyle={{ width: 90 }} onChange={(e) => setD((x) => ({ ...x, cap: e.target.value.replace(/\D/g, '') }))} />
          )}
          <Button size="sm" disabled={disabled || !ok} onClick={() => onChange(draft)}>{t('tournament.format.ruleApply')}</Button>
        </span>
      )}
    </span>
  )
}
