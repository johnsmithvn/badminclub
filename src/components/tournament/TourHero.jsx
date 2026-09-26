import { Button, IconButton } from '#ds'
import { fmtK } from '#lib/money.js'
import { progressOf } from '#lib/tournament/bracketView.js'
import { t } from '#i18n'
import { TourPill } from './TourBits.jsx'
import { tourMeta } from './tourUtils.js'


/**
 * Hero của Hub (handoff: khối đầu trang) — pill trạng thái, tên giải chữ display, dòng meta mono,
 * cụm số bên phải. Hành động quản trị chỉ hiện khi có quyền.
 */
export default function TourHero({ tour, money, isMobile, canEdit, onBack, onEdit, onDelete, onStatus }) {
  const active = tour.registrations.filter((r) => r.status === 'registered').length
  // Trận bye không ai đánh → không tính (progressOf), không thì nhánh có bye không bao giờ tới 100%.
  const prog = progressOf(tour.matches || [])
  const courts = tour.courtLabels.length

  const stats = [
    { label: t('tournament.hero.playersUpper') + ' (' + t('tournament.hero.players') + ')', value: active },
    { label: t('tournament.hero.eventsUpper'), value: tour.events.length },
    prog.total > 0
      ? { label: t('tournament.hero.matchesUpper'), value: `${prog.done}/${prog.total}` }
      : { label: t('tournament.hero.collected'), value: fmtK(money?.collected ?? 0), sub: money?.expected ? '/ ' + fmtK(money.expected) : undefined },
    // Chưa khai báo sân thì không hiện ô sân — không bịa số.
    ...(courts ? [{ label: t('tournament.hero.courtsUpper'), value: courts }] : []),
  ]
  // Trạng thái tự đi theo lịch (tạo lịch → đang diễn ra, xong hết → kết thúc). BTC chỉ còn: huỷ / khôi phục.
  const moves = tour.status === 'cancelled' ? ['registration'] : tour.status === 'finished' ? [] : ['cancelled']

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
      {/* Hàng trên: quay lại danh sách (mọi người) · thao tác quản trị (có quyền) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="ghost" size="sm" icon="arrow-left" onClick={onBack}>{t('tournament.hero.back')}</Button>
        <span style={{ flex: 1 }} />
        {canEdit && moves.map((s) => (
          <Button key={s} size="sm" variant="secondary" onClick={() => onStatus(s)}>
            {t('tournament.statusTo.' + s)}
          </Button>
        ))}
        {canEdit && <Button size="sm" variant="secondary" icon="pencil" onClick={onEdit}>{t('tournament.edit')}</Button>}
        {canEdit && <IconButton icon="trash-2" size="sm" label={t('tournament.delete')} onClick={onDelete} />}
      </div>

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
            {tourMeta(tour)}
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
                {s.sub && <span style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--text-muted)', marginLeft: 4 }}>{s.sub}</span>}
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
