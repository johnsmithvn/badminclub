// Primitive dùng chung của app, dựng trên design system. Chỉ để ở đây khi đã dùng ≥2 nơi.
// Mọi chữ đi qua t(); mọi màu đi qua var(--*) hoặc helper của #lib/money.js.

import { Icon, StatusPill } from '#ds'
import {
  courtNet, courtTxt, fmtK, genderTxt, groupMembers, groupOf, guestRev, levelStyle,
  presentCount, sGuestsOnly, statusMeta, timeTxt,
} from '#lib/money.js'
import { dd, monthOf, wd } from '#utils/dates.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }

/** Pill trạng thái buổi (Chưa mở / Đã mở / Đã chốt / Đã hủy). */
export function SessionPill({ status, size = 'sm' }) {
  const m = statusMeta(status)
  return <StatusPill status={m.pill} label={m.label} size={size} />
}

/**
 * Chip trình độ — màu lấy từ levelStyle, đừng tự chọn màu.
 * `levels` là thang của CLB (db.levels): màu chia theo VỊ TRÍ trong thang, nên CLB đặt thang
 * riêng vẫn ra dải màu yếu→mạnh đúng. Bỏ trống thì dùng thang mặc định.
 */
export function LevelChip({ level, levels }) {
  return (
    <span style={{
      font: '600 10px/1 var(--font-sans)', padding: '4px 8px', borderRadius: 99,
      whiteSpace: 'nowrap', ...levelStyle(level, levels),
    }}>
      {level}
    </span>
  )
}

/** Nhãn nhóm nhỏ, chữ hoa — header của bảng tự dựng. */
export const Overline = ({ children, style }) => (
  <div style={{
    font: 'var(--type-overline)', textTransform: 'uppercase',
    letterSpacing: 'var(--tracking-caps)', color: 'var(--text-muted)', ...style,
  }}>
    {children}
  </div>
)

/** Số mono — mọi số tiền / số lượng / giờ / mã đi qua đây (DESIGN.md §3). */
export const Mono = ({ children, color, weight, size, style }) => (
  <span style={{
    font: `${weight || 400} ${size || 13}px/1.2 var(--font-mono)`,
    color: color || 'var(--text-secondary)', whiteSpace: 'nowrap', ...style,
  }}>
    {children}
  </span>
)

/** Thanh tiến độ mảnh dùng trong bảng xếp hạng. */
export const Bar = ({ pct, color = 'var(--navy-500)', height = 8 }) => (
  <div style={{ flex: 1, height, borderRadius: 99, background: 'var(--surface-sunken)', overflow: 'hidden' }}>
    <div style={{ height: '100%', borderRadius: 99, background: color, width: Math.max(0, Math.min(100, pct)) + '%' }} />
  </div>
)

/** Khối ngày 52px (buổi tới, dòng lịch). */
export const DayBox = ({ iso }) => (
  <div style={{
    width: 52, flex: '0 0 auto', textAlign: 'center', padding: '5px 0',
    borderRadius: 8, background: 'var(--surface-brand-soft)',
  }}>
    <div style={{ font: '700 17px/1 var(--font-display)', color: 'var(--navy-700)' }}>{iso.slice(8, 10)}</div>
    <Overline style={{ color: 'var(--navy-600)' }}>{wd(iso)}</Overline>
  </div>
)

/** Trạng thái rỗng: một câu sự thật + một câu việc cần làm (DESIGN.md §7). */
export const Empty = ({ icon = 'inbox', title, hint }) => (
  <div style={{ display: 'grid', gap: 8, justifyItems: 'center', padding: '28px 18px', textAlign: 'center' }}>
    <Icon name={icon} size={22} style={{ color: 'var(--text-muted)' }} />
    <div style={{ font: 'var(--type-label)', color: 'var(--text-primary)' }}>{title}</div>
    {hint && <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', maxWidth: 420 }}>{hint}</div>}
  </div>
)

/** Grid auto-fit: G(cfg.ui.topStatMin) cho StatCard, G(cfg.ui.cardPairMin) cho Card đôi. */
export const G = (min, gap = 16) => ({
  display: 'grid', gridTemplateColumns: `repeat(auto-fit,minmax(${min}px,1fr))`, gap,
})
export const GRID_STAT = G(cfg.ui.topStatMin, 12)
export const GRID_PAIR = G(cfg.ui.cardPairMin, 16)

/** Nhãn ngày trong bảng buổi: '16/08 · CN' */
export const dateLabel = (iso) => dd(iso) + ' · ' + wd(iso)

/** Meta người: 'Nam · Khách · 3 trận' */
export const playerMeta = (p, matches) =>
  t('assign.matchMeta', {
    gender: genderTxt(p.gender),
    guest: p.guest ? ' · ' + t('guestTag') : '',
    n: matches || 0,
  })

/**
 * Bộ cột bảng buổi — dùng ở Trang chủ ("Buổi gần nhất") và Buổi tập ("Danh sách buổi").
 * Cột render cần db để tra nhóm/sân/khách.
 */
export function sessionColumns(db) {
  return [
    { key: 'd', header: t('sessionCol.date'), mono: true, width: 96, render: (r) => dateLabel(r.date) },
    { key: 'g', header: t('sessionCol.group'), render: (r) => groupOf(db, r.groupId).name },
    {
      key: 't', header: t('sessionCol.time'), mono: true, muted: true,
      render: (r) => timeTxt(r) + ' · ' + courtTxt(db, r),
    },
    {
      key: 'a', header: t('sessionCol.attend'), align: 'right', mono: true,
      render: (r) => (r.status === 'closed' || r.status === 'open'
        ? presentCount(db, r) + '/' + groupMembers(db, r.groupId, monthOf(r.date)).length
        : t('common.unknown')),
    },
    {
      key: 'k', header: t('sessionCol.guest'), align: 'right', mono: true,
      render: (r) => sGuestsOnly(db, r.id).length || t('common.unknown'),
    },
    {
      key: 's', header: t('sessionCol.shuttle'), align: 'right', mono: true,
      render: (r) => (r.shuttleUsed
        ? r.shuttleUsed + ' ' + t('units.shuttle') + (r.shuttleEst ? ' ~' : '')
        : t('common.unknown')),
    },
    { key: 'c', header: t('sessionCol.court'), align: 'right', mono: true, render: (r) => fmtK(courtNet(db, r)) },
    { key: 'r', header: t('sessionCol.guestRev'), align: 'right', mono: true, render: (r) => fmtK(guestRev(db, r.id)) },
    { key: 'st', header: t('sessionCol.status'), render: (r) => <SessionPill status={r.status} /> },
  ]
}
