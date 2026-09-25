import { Button, Select } from '#ds'
import { TabTrack } from '#ui'
import { dd } from '#utils/dates.js'
import { t } from '#i18n'

/**
 * Thanh module của giải (chuẩn theo thiết kế TDMS Dark):
 * - Hàng trên: Badge [GD] + Tên giải & meta | Stepper module: ① Tổng quan & đăng ký → ② Nhánh đấu | Chấm live & chọn nội dung (ở nhánh)
 * - Hàng hành động: Mở sơ đồ thi đấu → | Link đăng ký | Màn hình trình chiếu | Nhập tỷ số (nút cam)
 */
export default function TourModuleNav({
  tour,
  active = 'hub',
  events = [],
  eventId,
  onSelectEvent,
  onHub,
  onBracket,
  onScheme,
  onScore,
  onRegisterLink,
  onProjection,
  isMobile,
}) {
  const allEvents = tour?.events || events || []
  const matches = tour?.matches || []
  const liveCount = matches.filter((m) => m.status === 'live').length
  const courtsCount = tour?.courtLabels?.length || 4

  // Ngày bắt đầu ngắn (ví dụ: 26/09)
  const startsOnStr = tour?.startsOn ? `${dd(tour.startsOn)}/${tour.startsOn.slice(5, 7)}` : ''
  const subMeta = [
    startsOnStr,
    allEvents.length > 0 ? `${allEvents.length} ${t('tournament.hero.events').toLowerCase()}` : null,
    `${courtsCount} ${t('tournament.bracket.court').toLowerCase()}`,
  ].filter(Boolean).join(' · ')

  const steps = [
    { key: 'hub', label: t('tournament.module.hub'), onClick: onHub, off: false },
    { key: 'bracket', label: t('tournament.module.bracket'), onClick: () => onBracket(eventId || allEvents[0]?.id), off: allEvents.length === 0 },
  ]

  return (
    <div style={{ display: 'grid', gap: 10, width: '100%' }}>
      {/* Top Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        flexWrap: isMobile ? 'wrap' : 'nowrap',
        padding: '8px 16px',
        minHeight: 56,
        borderRadius: 12,
        background: 'var(--surface-nav)',
        border: '1px solid var(--border-nav)',
      }}>
        {/* Góc trái: Badge [GD] + Tên giải + Subline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--teal-500)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            font: '700 12px/1 var(--font-mono)',
            letterSpacing: '0.05em',
            flexShrink: 0,
          }}>
            GD
          </div>
          <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
            <span style={{
              font: '700 14px/1.2 var(--font-sans)',
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {tour?.name || t('pages.tournaments.title')}
            </span>
            <span style={{ font: '400 11.5px/1 var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {subMeta}
            </span>
          </div>
        </div>

        {/* Ở giữa: Module Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '1 1 auto', minWidth: 0 }}>
          <TabTrack>
            <nav style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px',
              borderRadius: 10,
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border-subtle)',
            }}>
              {steps.map((s, i) => {
                const on = s.key === active
                return (
                  <button
                    key={s.key}
                    type="button"
                    disabled={s.off}
                    aria-current={on ? 'page' : undefined}
                    onClick={on ? undefined : s.onClick}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '6px 14px',
                      borderRadius: 7,
                      whiteSpace: 'nowrap',
                      border: on ? '1px solid rgba(0, 178, 169, 0.4)' : '1px solid transparent',
                      background: on ? 'rgba(0, 178, 169, 0.15)' : 'transparent',
                      cursor: on || s.off ? 'default' : 'pointer',
                      opacity: s.off ? 0.45 : 1,
                      font: '600 12.5px/1 var(--font-sans)',
                      color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
                      transition: 'all var(--dur-fast)',
                    }}
                  >
                    <span style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      font: '700 10px/1 var(--font-mono)',
                      background: on ? 'var(--teal-500)' : 'transparent',
                      color: on ? '#fff' : 'var(--text-muted)',
                      border: on ? 'none' : '1px solid var(--border-default)',
                    }}>
                      {i + 1}
                    </span>
                    {s.label}
                  </button>
                )
              })}
            </nav>
          </TabTrack>
        </div>

        {/* Góc phải: Chấm live + Dropdown chọn nội dung (chỉ hiện khi active === 'bracket') */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {liveCount > 0 && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              font: '600 12.5px/1 var(--font-sans)',
              color: 'var(--status-delivered-fg)',
              whiteSpace: 'nowrap',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--status-delivered-fg)' }} />
              {t('tournament.module.liveCount', { n: liveCount })}
            </span>
          )}

          {active === 'bracket' && allEvents.length > 1 && (
            <Select
              size="sm"
              aria-label={t('tournament.bracket.pickEvent')}
              value={eventId}
              onChange={(e) => onBracket && onBracket(e.target.value)}
              options={allEvents.map((ev) => ({ value: ev.id, label: t('tournament.kind.' + ev.kind) }))}
              containerStyle={{ minWidth: 140 }}
            />
          )}
        </div>
      </div>

      {/* Hàng nút hành động phụ (Top Action Bar): Mở sơ đồ | Link đăng ký | Trình chiếu | Nhập tỷ số */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: isMobile ? 'flex-start' : 'flex-end',
        gap: 10,
        flexWrap: 'wrap',
      }}>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onBracket(eventId || allEvents[0]?.id)}
          style={{
            borderColor: 'var(--teal-500)',
            color: 'var(--teal-500)',
            background: 'rgba(0, 178, 169, 0.08)',
          }}
        >
          {t('tournament.module.openBracket')}
        </Button>

        <Button
          size="sm"
          variant="secondary"
          onClick={onRegisterLink}
        >
          {t('tournament.module.registerLink')}
        </Button>

        <Button
          size="sm"
          variant="secondary"
          onClick={onProjection}
        >
          {t('tournament.module.projection')}
        </Button>

        {/* Nút Nhập tỷ số nổi bật màu Cam San Hô */}
        <button
          type="button"
          onClick={onScore}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            minHeight: 32,
            padding: '0 16px',
            borderRadius: 8,
            border: 'none',
            background: 'linear-gradient(135deg, #FF6B4A 0%, #FA541C 100%)',
            color: '#fff',
            font: '700 12.5px/1 var(--font-sans)',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(250, 84, 28, 0.35)',
            transition: 'opacity var(--dur-fast), transform var(--dur-fast)',
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          {t('tournament.module.enterScore')}
        </button>
      </div>
    </div>
  )
}
