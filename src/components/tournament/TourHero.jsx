import { useState } from 'react'
import { Button, IconButton } from '#ds'
import { fmtK } from '#lib/money.js'
import { progressOf } from '#lib/tournament/bracketView.js'
import { t } from '#i18n'
import { TourPill } from './TourBits.jsx'
import { tourMeta } from './tourUtils.js'

/**
 * Hero của Hub (handoff: khối đầu trang phong cách Dispatch Thể thao) —
 * vạch sân cầu lông trang trí, pill trạng thái, tên giải chữ display 42px, dòng meta mono,
 * cụm CTA nổi bật (nhập tỷ số cam, mở sơ đồ, link chia sẻ), cụm 4 số liệu bên phải.
 */
export default function TourHero({ tour, money, isMobile, canEdit, onBack, onEdit, onDelete, onStatus }) {
  const [copied, setCopied] = useState(false)
  const active = tour.registrations.filter((r) => r.status === 'registered').length
  const prog = progressOf(tour.matches || [])
  const courts = tour.courtLabels.length

  const stats = [
    { label: t('tournament.hero.players'), value: active },
    { label: t('tournament.hero.events'), value: tour.events.length },
    prog.total > 0
      ? { label: t('tournament.hero.matchesUpper'), value: `${prog.done}/${prog.total}` }
      : { label: t('tournament.hero.collected'), value: fmtK(money?.collected ?? 0), sub: money?.expected ? '/ ' + fmtK(money.expected) : undefined },
    ...(courts ? [{ label: t('tournament.hero.courtsUpper'), value: courts }] : []),
  ]

  const moves = tour.status === 'cancelled' ? ['registration'] : tour.status === 'finished' ? [] : ['cancelled']

  const copyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <section style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      padding: isMobile ? '16px' : '20px 24px',
      borderRadius: 14,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      boxShadow: 'var(--shadow-sm)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Vạch sân cầu lông trang trí nghệ thuật mờ ảo ở góc phải (chuẩn handoff) */}
      <div aria-hidden style={{ position: 'absolute', right: -60, top: -40, width: 560, height: 260, border: '2px solid rgba(0, 178, 169, 0.08)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', right: 220, top: -40, width: 0, height: 260, borderLeft: '2px solid rgba(0, 178, 169, 0.08)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', right: 110, top: -40, width: 220, height: 260, borderLeft: '2px solid rgba(0, 178, 169, 0.04)', borderRight: '2px solid rgba(0, 178, 169, 0.04)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', right: -60, top: 90, width: 560, height: 0, borderTop: '2px solid rgba(0, 178, 169, 0.04)', pointerEvents: 'none' }} />

      {/* Hàng trên: Hành động điều hướng & Quản trị bên trái · Dải CTA thể thao bên phải */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="ghost" size="sm" icon="arrow-left" onClick={onBack}>{t('tournament.hero.back')}</Button>
          {canEdit && moves.map((s) => (
            <Button key={s} size="sm" variant="secondary" onClick={() => onStatus(s)}>
              {t('tournament.statusTo.' + s)}
            </Button>
          ))}
          {canEdit && <Button size="sm" variant="secondary" icon="pencil" onClick={onEdit}>{t('tournament.edit')}</Button>}
          {canEdit && <IconButton icon="trash-2" size="sm" label={t('tournament.delete')} onClick={onDelete} />}
        </div>

        {/* Dải nút CTA góc trên bên phải — "Nhập tỷ số"/"Mở sơ đồ" đã có ở TourModuleNav (mọi trang), không lặp lại ở đây */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
          <button
            type="button"
            onClick={copyLink}
            style={{
              height: 32, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 12px',
              borderRadius: 6, background: 'var(--surface-raised)', border: '1px solid var(--border-default)',
              font: '600 12px/1 var(--font-sans)', color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            {copied ? t('tournament.hero.copied') : t('tournament.hero.copyLink')}
          </button>
        </div>
      </div>

      {/* Phần chính của Hero: Tiêu đề lớn bên trái · 4 Stat Box nổi bên phải */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 18 : 28,
        alignItems: isMobile ? 'stretch' : 'flex-end',
        justifyContent: 'space-between',
        position: 'relative',
        zIndex: 2,
      }}>
        {/* Khối bên trái: Status pill + scope -> Tên giải to 42px -> Meta line */}
        <div style={{ display: 'grid', gap: 8, minWidth: 0, flex: '1 1 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <TourPill status={tour.status} />
            <span style={{
              font: '700 11px/1 var(--font-sans)',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              {t('tournament.scope.' + tour.scope)}
            </span>
          </div>

          <h1 style={{
            margin: 0,
            font: `700 ${isMobile ? 26 : 42}px/1.15 var(--font-display)`,
            color: 'var(--text-primary)',
            letterSpacing: '-0.025em',
            overflowWrap: 'anywhere',
          }}>
            {tour.name}
          </h1>

          <div style={{ font: '400 13px/1.4 var(--font-mono)', color: 'var(--text-secondary)' }}>
            {tourMeta(tour)}
          </div>
        </div>

        {/* Khối bên phải: 4 ô thống kê Hero số lớn Barlow 32px */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
          gap: isMobile ? 12 : 20,
          padding: isMobile ? '12px 14px' : '14px 22px',
          background: 'var(--surface-inset)',
          borderRadius: 12,
          border: '1px solid var(--border-subtle)',
          flexShrink: 0,
          textAlign: 'center',
        }}>
          {stats.map((s, idx) => (
            <div key={s.label} style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minWidth: isMobile ? 55 : 68,
              borderLeft: idx > 0 ? '1px solid var(--border-subtle)' : 'none',
              paddingLeft: idx > 0 ? (isMobile ? 8 : 16) : 0,
            }}>
              <span style={{
                font: '700 32px/1 var(--font-display)',
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                whiteSpace: 'nowrap',
              }}>
                {s.value}
                {s.sub && <span style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--text-muted)', marginLeft: 4 }}>{s.sub}</span>}
              </span>
              <span style={{
                font: '700 10.5px/1 var(--font-sans)',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                whiteSpace: 'nowrap',
              }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

