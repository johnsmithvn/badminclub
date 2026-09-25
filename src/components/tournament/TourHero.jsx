import { Button, IconButton } from '#ds'
import { Overline } from '#ui'
import { fmtK } from '#lib/money.js'
import { nextStatuses } from '#lib/tournament/hub.js'
import { t } from '#i18n'
import { TourPill } from './TourBits.jsx'
import { tourMeta } from './tourUtils.js'

// Hướng "tiến" của giải được nút chính, còn lại là nút phụ; huỷ luôn là nút phụ đứng cuối.
const FORWARD = new Set(['registration', 'running', 'finished'])

/**
 * Hero của Hub (handoff: khối đầu trang) — pill trạng thái, tên giải chữ display, dòng meta mono,
 * cụm số bên phải. Hành động quản trị chỉ hiện khi có quyền.
 */
export default function TourHero({ tour, money, isMobile, canEdit, onBack, onEdit, onDelete, onStatus }) {
  const active = tour.registrations.filter((r) => r.status === 'registered').length
  const stats = [
    { label: t('tournament.hero.players'), value: active },
    { label: t('tournament.hero.events'), value: tour.events.length },
    { label: t('tournament.hero.collected'), value: fmtK(money.collected), sub: '/ ' + fmtK(money.expected) },
  ]
  const moves = nextStatuses(tour.status)

  return (
    <section style={{
      display: 'grid', gap: 14, padding: isMobile ? '14px 14px 16px' : '16px 20px 18px', borderRadius: 10,
      background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="ghost" size="sm" icon="arrow-left" onClick={onBack}>{t('tournament.hero.back')}</Button>
        <span style={{ flex: 1 }} />
        {canEdit && moves.map((s) => (
          <Button key={s} size="sm" variant={FORWARD.has(s) ? 'primary' : 'secondary'} onClick={() => onStatus(s)}>
            {t('tournament.statusTo.' + s)}
          </Button>
        ))}
        {canEdit && <Button size="sm" variant="secondary" icon="pencil" onClick={onEdit}>{t('tournament.edit')}</Button>}
        {canEdit && <IconButton icon="trash-2" label={t('tournament.delete')} onClick={onDelete} />}
      </div>

      <div style={{
        display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 14 : 24,
        alignItems: isMobile ? 'stretch' : 'flex-end', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <TourPill status={tour.status} />
            <Overline>{t('tournament.scope.' + tour.scope)}</Overline>
          </div>
          <h1 style={{
            margin: 0, font: `700 ${isMobile ? 22 : 28}px/1.15 var(--font-display)`, color: 'var(--text-primary)',
            overflowWrap: 'anywhere',
          }}>
            {tour.name}
          </h1>
          <div style={{ font: '400 12.5px/1.4 var(--font-mono)', color: 'var(--text-muted)' }}>{tourMeta(tour)}</div>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${stats.length}, auto)`, gap: isMobile ? 18 : 28,
          justifyContent: isMobile ? 'start' : 'end',
        }}>
          {stats.map((s) => (
            <div key={s.label} style={{ display: 'grid', gap: 5 }}>
              <span style={{ font: '700 22px/1 var(--font-display)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                {s.value}
                {s.sub && <span style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--text-muted)', marginLeft: 4 }}>{s.sub}</span>}
              </span>
              <Overline>{s.label}</Overline>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
