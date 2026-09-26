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

/** `roundLabel`: vòng/giai đoạn đang diễn ra (VD "Bán kết") thay cho nhãn chung "Đang đánh" khi status = running. */
export const EventPill = ({ status, roundLabel }) => (
  <StatusPill status={EVENT_PILL[status] || 'idle'} label={roundLabel || t('tournament.eventStatus.' + status)} size="sm" />
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
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, padding: 3, borderRadius: 8, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', maxWidth: '100%', boxSizing: 'border-box' }}>
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
 * Tên đội tách theo từng người (đôi 2 người ghép " / ") — mỗi người 1 dòng, tự cắt "..." riêng, không để
 * người 1 tên dài đẩy người 2 mất dạng (xem chat: bug ở B4.4 và danh sách hạt giống/đội tham gia).
 * `fontSize`/`weight`/`color` áp cho mọi dòng như nhau — nơi cần khác nhau (VD đội thắng đậm hơn) tự viết riêng.
 */
export function TeamNameLines({ name, fontSize = 11.5, weight = 500, color = 'var(--text-primary)' }) {
  const names = name ? name.split(' / ') : [name]
  return (
    <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 1 }}>
      {names.map((n, i) => (
        <span key={i} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', font: `${weight} ${fontSize}px/1.25 var(--font-sans)`, color }}>
          {n}
        </span>
      ))}
    </span>
  )
}

/**
 * Bảng xếp hạng 1 bảng đấu — CHỈ XEM (không xử lý hoà/đổi tay/Chốt giai đoạn, mấy cái đó chỉ ở GroupBoard
 * trang Nhánh đấu, tránh 2 nơi cùng sửa 1 thứ). Dùng ở Tổng quan để xem nhanh không cần rời trang.
 * `#` khoanh tròn nổi bật: vàng = hạng 1, teal = trong nhóm đi tiếp, xám = còn lại.
 */
export function StandingsTable({ rows, advancePerGroup = 0, teamLabel }) {
  const cols = '26px 1fr 34px 34px 44px'
  return (
    <div style={{ borderRadius: 8, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', padding: '8px 10px', display: 'grid', gap: 4, overflow: 'hidden' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: cols, alignItems: 'center', gap: 6,
        font: '700 10px/1 var(--font-sans)', color: 'var(--text-muted)', padding: '0 4px 6px',
        borderBottom: '1px solid var(--border-subtle)', letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>
        <span style={{ textAlign: 'center' }}>#</span>
        <span>{t('tournament.overview.pairs')}</span>
        <span style={{ textAlign: 'center' }}>{t('tournament.overview.won')}</span>
        <span style={{ textAlign: 'center' }}>{t('tournament.overview.lost')}</span>
        <span style={{ textAlign: 'right' }}>{t('tournament.overview.diff')}</span>
      </div>
      {rows.map((r) => {
        const advances = advancePerGroup > 0 && r.rank <= advancePerGroup
        return (
          <div key={r.teamId} style={{
            display: 'grid', gridTemplateColumns: cols, alignItems: 'center', gap: 6, padding: '5px 4px', borderRadius: 6,
            background: advances ? 'var(--surface-accent-soft)' : 'transparent',
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', justifySelf: 'center',
              font: '700 11px/1 var(--font-mono)',
              background: r.rank === 1 ? 'var(--podium-gold)' : advances ? 'var(--action-accent-bg)' : 'var(--surface-inset)',
              color: r.rank === 1 ? '#3A2A00' : advances ? 'var(--action-accent-fg)' : 'var(--text-secondary)',
            }}>
              {r.rank}
            </span>
            <TeamNameLines name={teamLabel(r.teamId)} fontSize={12.5} weight={advances ? 600 : 500} />
            <Mono size={11.5} weight={600} color={r.won > 0 ? 'var(--status-delivered-fg)' : 'var(--text-secondary)'} style={{ textAlign: 'center' }}>{r.won}</Mono>
            <Mono size={11.5} color={r.lost > 0 ? 'var(--text-secondary)' : 'var(--text-muted)'} style={{ textAlign: 'center' }}>{r.lost}</Mono>
            <Mono size={11.5} weight={600} color={r.pointDiff > 0 ? 'var(--status-delivered-fg)' : (r.pointDiff < 0 ? 'var(--status-incident-fg)' : 'var(--text-muted)')} style={{ textAlign: 'right' }}>
              {r.pointDiff > 0 ? `+${r.pointDiff}` : r.pointDiff}
            </Mono>
          </div>
        )
      })}
    </div>
  )
}

/** Ô số −/giá trị/+ (handoff: giả lập VĐV, thời gian & sân trong hộp Gợi ý thể thức). */
export function NumStep({ value, min = 0, max = Infinity, step = 1, onChange, format = String, disabled }) {
  const btn = (children, delta, edge) => (
    <button type="button" disabled={disabled || edge} onClick={() => onChange(Math.min(max, Math.max(min, value + delta)))}
      style={{
        width: 28, height: 28, borderRadius: 6, background: 'var(--surface-inset)', border: '1px solid var(--border-default)',
        font: '600 14px/1 var(--font-sans)', color: 'var(--text-secondary)', cursor: disabled || edge ? 'default' : 'pointer', opacity: disabled || edge ? 0.5 : 1,
      }}>
      {children}
    </button>
  )
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {btn('−', -step, value <= min)}
      <span style={{ minWidth: 40, textAlign: 'center', font: '700 14px/1 var(--font-mono)', color: 'var(--text-primary)' }}>{format(value)}</span>
      {btn('+', step, value >= max)}
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
    <span style={{ display: 'grid', gap: 8, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
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
