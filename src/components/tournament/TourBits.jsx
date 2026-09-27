// Mảnh nhỏ dùng chung của màn Giải đấu. Màu chỉ qua token (docs/TOURNAMENT_PLAN.md §6.1).

import { StatusPill } from '#ds'
import { Mono } from '#ui'
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
 * Thẻ luật một nhóm vòng (handoff Nhánh đấu): số sec 1/3/5 · điểm chạm −/+ · cách 2 (công tắc) + trần −/+ · câu tóm tắt.
 * Đổi là áp ngay vào bản nháp của người gọi — không cần nút "Dùng luật này": nút −/+ kẹp sẵn (điểm 5–50, trần
 * điểm+2–60) nên luật lúc nào cũng hợp lệ (`validRule`).
 */
export function RuleCard({ title, applies, value, onChange, active = false, children }) {
  const r = { sets: value?.sets || 1, points: value?.points || 21, winBy2: Boolean(value?.winBy2), cap: value?.cap || value?.points || 21 }
  const upd = (patch) => {
    const x = { ...r, ...patch }
    x.points = Math.max(5, Math.min(50, x.points))
    x.cap = x.winBy2 ? Math.max(x.points + 2, Math.min(60, x.cap)) : x.points
    onChange(x)
  }
  const box = (on) => ({
    height: 26, minWidth: 24, padding: '0 7px', borderRadius: 6, cursor: 'pointer', font: '600 12px/1 var(--font-mono)',
    color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
    background: on ? 'var(--surface-accent-soft)' : 'var(--surface-raised)', border: `1px solid ${on ? 'var(--teal-500)' : 'var(--border-default)'}`,
  })
  const stepper = (val, key) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <button type="button" aria-label={t('tournament.rule.less')} style={box(false)} onClick={() => upd({ [key]: val - 1 })}>−</button>
      <Mono size={14} weight={700} color="var(--text-primary)" style={{ minWidth: 26, textAlign: 'center' }}>{val}</Mono>
      <button type="button" aria-label={t('tournament.rule.more')} style={box(false)} onClick={() => upd({ [key]: val + 1 })}>+</button>
    </span>
  )
  const row = (label, control) => (
    <span style={{ display: 'grid', gridTemplateColumns: '70px minmax(0,1fr)', alignItems: 'center', gap: 8 }}>
      <span style={{ font: '500 12px/1.2 var(--font-sans)', color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>{control}</span>
    </span>
  )
  return (
    <div style={{
      display: 'grid', gap: 10, padding: 12, borderRadius: 10, minWidth: 0,
      background: 'var(--surface-inset)', border: `1px solid ${active ? 'var(--teal-500)' : 'var(--border-subtle)'}`,
      boxShadow: active ? '0 0 0 1px var(--teal-500)' : 'none',
    }}>
      <span style={{ display: 'grid', gap: 3 }}>
        <span style={{ font: '700 13px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{title}</span>
        {applies && <Mono size={10.5} color="var(--text-muted)">{applies}</Mono>}
      </span>
      {row(t('tournament.rule.sets'), [1, 3, 5].map((v) => (
        <button key={v} type="button" aria-pressed={r.sets === v} style={{ ...box(r.sets === v), width: 32 }} onClick={() => upd({ sets: v })}>{v}</button>
      )))}
      {row(t('tournament.rule.points'), stepper(r.points, 'points'))}
      {row(t('tournament.rule.by2'), (
        <>
          <button type="button" role="switch" aria-checked={r.winBy2} aria-label={t('tournament.rule.by2')}
            onClick={() => upd({ winBy2: !r.winBy2, cap: r.winBy2 ? r.points : Math.max(r.cap, r.points + 9) })}
            style={{ position: 'relative', width: 38, height: 22, borderRadius: 999, cursor: 'pointer', flex: '0 0 auto',
              background: r.winBy2 ? 'var(--teal-500)' : 'var(--surface-raised)', border: `1px solid ${r.winBy2 ? 'var(--teal-500)' : 'var(--border-default)'}` }}>
            <span style={{ position: 'absolute', top: 2, left: r.winBy2 ? 18 : 2, width: 16, height: 16, borderRadius: '50%', transition: 'left .15s',
              background: r.winBy2 ? 'var(--action-accent-fg)' : 'var(--text-muted)' }} />
          </button>
          {r.winBy2 && <span style={{ font: '500 12px/1 var(--font-sans)', color: 'var(--text-muted)' }}>{t('tournament.rule.cap')}</span>}
          {r.winBy2 && stepper(r.cap, 'cap')}
        </>
      ))}
      <span style={{ font: '500 11.5px/1.4 var(--font-sans)', color: 'var(--text-secondary)' }}>
        {r.winBy2
          ? t('tournament.rule.summaryBy2', { sets: r.sets, points: r.points, deuce: r.cap - 1, cap: r.cap })
          : t('tournament.rule.summaryTouch', { sets: r.sets, points: r.points })}
      </span>
      {children}
    </div>
  )
}

