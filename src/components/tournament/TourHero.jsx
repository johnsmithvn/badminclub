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
  const matches = tour.matches || []
  const doneMatches = matches.filter((m) => m.status === 'done' || m.status === 'walkover' || m.status === 'retired').length
  const totalMatches = matches.length
  const courtsCount = tour.courtLabels.length > 0 ? tour.courtLabels.length : 4

  const stats = [
    { label: t('tournament.hero.playersUpper') + ' (' + t('tournament.hero.players') + ')', value: active },
    { label: t('tournament.hero.eventsUpper'), value: tour.events.length },
    totalMatches > 0
      ? { label: t('tournament.hero.matchesUpper'), value: `${doneMatches}/${totalMatches}` }
      : { label: t('tournament.hero.collected'), value: fmtK(money?.collected ?? 0), sub: money?.expected ? '/ ' + fmtK(money.expected) : undefined },
    { label: t('tournament.hero.courtsUpper'), value: courtsCount },
  ]
  const moves = nextStatuses(tour.status)

  const metaText = [
    tourMeta(tour),
    tour.scope === 'open' ? t('tournament.scope.openNote') : null,
  ].filter(Boolean).join(' · ')

  return (
    <section style={{
      display: 'grid',
      gap: 16,
      padding: isMobile ? '16px' : '20px 24px',
      borderRadius: 14,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      boxShadow: 'var(--shadow-xs)',
      position: 'relative',
    }}>
      {/* Hàng thao tác quản trị phía trên */}
      {canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          {moves.map((s) => (
            <Button key={s} size="sm" variant={FORWARD.has(s) ? 'primary' : 'secondary'} onClick={() => onStatus(s)}>
              {t('tournament.statusTo.' + s)}
            </Button>
          ))}
          <Button size="sm" variant="secondary" icon="pencil" onClick={onEdit}>{t('tournament.edit')}</Button>
          <IconButton icon="trash-2" size="sm" label={t('tournament.delete')} onClick={onDelete} />
        </div>
      )}

      {/* Phần chính của Hero: Tiêu đề bên trái, 4 Stat Box bên phải */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 18 : 28,
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'space-between',
      }}>
        {/* Khối bên trái: Status pill + scope -> Tên giải to -> Meta line */}
        <div style={{ display: 'grid', gap: 8, minWidth: 0, flex: '1 1 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <TourPill status={tour.status} />
            <span style={{
              font: '700 11px/1 var(--font-sans)',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              {t('tournament.scope.' + tour.scope)}
            </span>
          </div>

          <h1 style={{
            margin: 0,
            font: `700 ${isMobile ? 24 : 32}px/1.2 var(--font-display)`,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            overflowWrap: 'anywhere',
          }}>
            {tour.name}
          </h1>

          <div style={{ font: '400 13px/1.4 var(--font-mono)', color: 'var(--text-secondary)' }}>
            {metaText}
          </div>
        </div>

        {/* Khối bên phải: 4 ô thống kê Hero */}
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
                font: '700 24px/1 var(--font-display)',
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                whiteSpace: 'nowrap',
              }}>
                {s.value}
              </span>
              <span style={{
                font: '700 9.5px/1 var(--font-sans)',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
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
