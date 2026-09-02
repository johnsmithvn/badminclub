// Primitive dùng chung của app, dựng trên design system. Chỉ để ở đây khi đã dùng ≥2 nơi.
// Mọi chữ đi qua t(); mọi màu đi qua var(--*) hoặc helper của #lib/money.js.

import { useState } from 'react'
import { Alert, Button, Dialog, Icon, Input, StatusPill } from '#ds'
import { useAuth } from '#contexts/AuthContext.jsx'
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

/** Khối ngày 56px (buổi tới, dòng lịch) hiển thị ngày/tháng rõ ràng. */
export const DayBox = ({ iso }) => (
  <div style={{
    width: 56, flex: '0 0 auto', textAlign: 'center', padding: '5px 2px',
    borderRadius: 8, background: 'var(--surface-brand-soft)',
  }}>
    <div style={{ font: '700 16px/1 var(--font-display)', color: 'var(--navy-700)' }}>
      {iso.slice(8, 10)}<span style={{ fontSize: 11, fontWeight: 500, color: 'var(--navy-500)' }}>/{iso.slice(5, 7)}</span>
    </div>
    <Overline style={{ color: 'var(--navy-600)', marginTop: 2 }}>{wd(iso)}</Overline>
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
    {
      key: 'd', header: t('sessionCol.date'), width: 105,
      render: (r) => {
        const isSunday = wd(r.date) === 'CN'
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
              {dd(r.date)}
            </span>
            <span style={{
              font: '700 11px/1 var(--font-sans)',
              padding: '3px 6px',
              borderRadius: 4,
              background: isSunday ? 'rgba(239, 68, 68, 0.12)' : 'var(--surface-brand-soft)',
              color: isSunday ? '#dc2626' : 'var(--navy-700)',
              border: `1px solid ${isSunday ? 'rgba(239, 68, 68, 0.25)' : 'rgba(30, 58, 138, 0.15)'}`,
            }}>
              {wd(r.date)}
            </span>
          </div>
        )
      },
    },
    {
      key: 'g', header: t('sessionCol.group'),
      render: (r) => {
        const grp = groupOf(db, r.groupId)
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 9px', borderRadius: 6,
            background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(14, 165, 233, 0.12) 100%)',
            border: '1px solid rgba(2, 132, 199, 0.22)',
            color: 'var(--teal-700)', fontWeight: 600, fontSize: 12,
            whiteSpace: 'nowrap',
          }}>
            <Icon name="users" size={12} style={{ color: 'var(--teal-600)' }} />
            <span>{grp.name}</span>
          </span>
        )
      },
    },
    {
      key: 't', header: t('sessionCol.time'),
      render: (r) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
            color: 'var(--navy-700)', padding: '2px 7px', borderRadius: 4,
            background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)',
            whiteSpace: 'nowrap',
          }}>
            {timeTxt(r)}
          </span>
          <span style={{
            fontSize: 12, color: 'var(--text-secondary)',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <Icon name="map-pin" size={12} style={{ color: 'var(--teal-600)', flexShrink: 0 }} />
            <span style={{ fontWeight: 500 }}>{courtTxt(db, r)}</span>
          </span>
        </div>
      ),
    },
    {
      key: 'a', header: t('sessionCol.attend'), align: 'right', mono: true,
      render: (r) => {
        if (r.status !== 'closed' && r.status !== 'open') {
          return <span style={{ color: 'var(--text-muted)' }}>—</span>
        }
        const p = presentCount(db, r)
        const tot = groupMembers(db, r.groupId, monthOf(r.date)).length
        return (
          <span style={{
            fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12,
            padding: '2px 8px', borderRadius: 99,
            background: p > 0 ? 'rgba(16, 185, 129, 0.12)' : 'var(--surface-inset)',
            color: p > 0 ? '#047857' : 'var(--text-muted)',
            border: `1px solid ${p > 0 ? 'rgba(16, 185, 129, 0.25)' : 'var(--border-subtle)'}`,
          }}>
            {p}/{tot}
          </span>
        )
      },
    },
    {
      key: 'k', header: t('sessionCol.guest'), align: 'right', mono: true,
      render: (r) => {
        const gCount = sGuestsOnly(db, r.id).length
        if (!gCount) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        return (
          <span style={{
            fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12,
            padding: '2px 8px', borderRadius: 99,
            background: 'rgba(245, 158, 11, 0.12)',
            color: '#b45309',
            border: '1px solid rgba(245, 158, 11, 0.28)',
          }}>
            +{gCount}
          </span>
        )
      },
    },
    {
      key: 's', header: t('sessionCol.shuttle'), align: 'right', mono: true,
      render: (r) => {
        if (!r.shuttleUsed) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        return (
          <span style={{
            fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12,
            padding: '2px 8px', borderRadius: 99,
            background: 'rgba(14, 165, 233, 0.1)',
            color: 'var(--navy-700)',
            border: '1px solid rgba(14, 165, 233, 0.25)',
          }}>
            {r.shuttleUsed} quả{r.shuttleEst ? ' ~' : ''}
          </span>
        )
      },
    },
    {
      key: 'c', header: t('sessionCol.court'), align: 'right', mono: true,
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12.5, color: 'var(--text-primary)' }}>
          {fmtK(courtNet(db, r))}
        </span>
      ),
    },
    {
      key: 'r', header: t('sessionCol.guestRev'), align: 'right', mono: true,
      render: (r) => {
        const rev = guestRev(db, r.id)
        if (rev > 0) {
          return (
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12.5, color: '#059669' }}>
              +{fmtK(rev)}
            </span>
          )
        }
        return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>0</span>
      },
    },
    { key: 'st', header: t('sessionCol.status'), render: (r) => <SessionPill status={r.status} /> },
  ]
}

/**
 * Hộp xác nhận XOÁ CỨNG một CLB. Dùng ở hai nơi (trang "CLB của tôi" và Cài đặt → Chung) nên
 * để chung ở đây — hai bản sao của một hộp thoại phá dữ liệu là hai luật xác nhận rồi sẽ lệch.
 *
 * Bắt gõ đúng MÃ CLB chứ không phải bấm "Đồng ý": mã nằm ngay trên hộp thoại, gõ lại mất ba
 * giây, nhưng nó buộc người bấm phải đọc xem mình đang xoá CLB nào. RPC cũng đòi đúng mã đó —
 * ô nhập này chỉ là lớp tiện, cổng thật nằm dưới DB.
 *
 * `onDone` chạy SAU khi xoá xong (điều hướng đi đâu là việc của nơi gọi).
 */
export function DeleteClubDialog({ club, onClose, onDone }) {
  const { deleteClub } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const ok = code.trim().toUpperCase() === String(club.code || '').toUpperCase()

  const submit = async () => {
    setBusy(true)
    setErr('')
    try {
      await deleteClub(club.id, code.trim())
      if (onDone) onDone()
    } catch (e) {
      setErr(e.message)
      setBusy(false)
    }
  }

  return (
    <Dialog open title={t('clubs.delTitle')} width={520} onClose={busy ? undefined : onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        <Alert tone="danger" title={t('clubs.delWarnTitle')}>{t('clubs.delWarn')}</Alert>
        <Input
          label={t('clubs.delConfirmLabel', { code: club.code })}
          mono
          value={code}
          disabled={busy}
          onChange={(e) => setCode(e.target.value)}
        />
        {err && <Alert tone="danger">{err}</Alert>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
          <Button variant="secondary" disabled={busy} onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="danger" icon="trash-2" disabled={!ok || busy} onClick={submit}>
            {t(busy ? 'clubs.delBusy' : 'clubs.delSubmit')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
