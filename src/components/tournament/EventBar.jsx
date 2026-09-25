import { useState } from 'react'
import { Button, Dialog, Icon, IconButton } from '#ds'
import { Empty, TabTrack } from '#ui'
import { EVENT_KINDS, eventCounts } from '#lib/tournament/hub.js'
import { t } from '#i18n'
import { EventPill, KindCode } from './TourBits.jsx'

/**
 * Hàng thẻ nội dung ngay dưới hero (handoff: `eventCards` + nút "+ Nội dung").
 * Chọn thẻ = đổi nội dung đang xem. Thêm / xoá nội dung ở ĐÂY, không ở tab Thông tin.
 */
export default function EventBar({ tour, value, onChange, canEdit, isMobile, onAdd, onDelete }) {
  const [adding, setAdding] = useState(false)

  if (!tour.events.length) {
    return (
      <div style={{ borderRadius: 10, border: '1px dashed var(--border-default)', background: 'var(--surface-card)' }}>
        <Empty icon="medal" title={t('tournament.event.emptyTitle')} hint={t('tournament.event.emptyHint')} />
        {canEdit && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 18 }}>
            <Button icon="plus" onClick={() => setAdding(true)}>{t('tournament.event.add')}</Button>
          </div>
        )}
        {adding && <AddEventDialog tour={tour} onClose={() => setAdding(false)} onAdd={onAdd} />}
      </div>
    )
  }

  return (
    <TabTrack>
      <div style={{ display: 'flex', gap: 12, paddingBottom: 4 }}>
        {tour.events.map((ev) => {
          const on = ev.id === value
          const canDelete = canEdit && on && ev.status === 'draft'

          // Đếm số trận của nội dung
          const evMatches = (tour.matches || []).filter((m) => m.eventId === ev.id)
          const doneMatches = evMatches.filter((m) => m.status === 'done' || m.status === 'walkover' || m.status === 'retired').length
          const totalMatches = evMatches.length

          // Tên thể thức ngắn gọn
          const stages = (tour.stages || []).filter((s) => s.eventId === ev.id)
          const formatText = stages.length > 1
            ? t('tournament.format.tpl.rr_ko')
            : (stages[0]?.type === 'round_robin' ? t('tournament.format.tpl.rr') : (stages[0]?.type === 'knockout' ? t('tournament.format.tpl.ko') : t('tournament.format.tpl.rr')))

          const progressPercent = totalMatches > 0 ? Math.round((doneMatches / totalMatches) * 100) : 0

          return (
            <div key={ev.id} style={{ position: 'relative', flex: '0 0 auto' }}>
              <button
                type="button"
                onClick={() => onChange(ev.id)}
                aria-pressed={on}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                  minWidth: isMobile ? 220 : 255,
                  minHeight: 68,
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: 'var(--surface-card)',
                  color: 'inherit',
                  border: `1px solid ${on ? 'var(--teal-500)' : 'var(--border-subtle)'}`,
                  boxShadow: on ? '0 0 0 1px var(--teal-500), 0 2px 8px rgba(0, 178, 169, 0.15)' : 'var(--shadow-xs)',
                  transition: 'all var(--dur-fast) var(--ease-standard)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <KindCode kind={ev.kind} on={on} />

                <span style={{ display: 'grid', gap: 4, minWidth: 0, flex: 1 }}>
                  {/* Hàng 1: Tên nội dung + Pill trạng thái */}
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                    <span style={{
                      font: '700 13.5px/1.2 var(--font-sans)',
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                    }}>
                      {t('tournament.kind.' + ev.kind)}
                    </span>
                    <EventPill status={ev.status} />
                  </span>

                  {/* Hàng 2: Mô tả thể thức */}
                  <span style={{ font: '400 11.5px/1 var(--font-sans)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {formatText}
                  </span>

                  {/* Hàng 3: Số VĐV chi tiết nam / nữ */}
                  <span style={{ font: '400 11.5px/1 var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {t('tournament.event.counts', eventCounts(tour, ev.id))}
                  </span>

                  {/* Hàng 4: Mini Progress Bar nếu đã có trận */}
                  {totalMatches > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <span style={{
                        flex: 1,
                        height: 3,
                        borderRadius: 99,
                        background: 'var(--surface-sunken)',
                        overflow: 'hidden',
                        display: 'block',
                      }}>
                        <span style={{
                          display: 'block',
                          height: '100%',
                          width: `${progressPercent}%`,
                          background: 'var(--teal-500)',
                          borderRadius: 99,
                        }} />
                      </span>
                      <span style={{ font: '500 10.5px/1 var(--font-mono)', color: 'var(--teal-500)', whiteSpace: 'nowrap' }}>
                        {t('tournament.overview.matchesCount', { done: doneMatches, total: totalMatches })}
                      </span>
                    </span>
                  )}
                </span>
              </button>

              {/* Nút xoá nội dung nếu chưa khoá */}
              {canDelete && (
                <IconButton
                  icon="trash-2"
                  size="sm"
                  label={t('tournament.event.delete')}
                  style={{ position: 'absolute', right: 6, bottom: 4 }}
                  onClick={() => onDelete(ev.id)}
                />
              )}
            </div>
          )
        })}

        {canEdit && Object.keys(EVENT_KINDS).length > tour.events.length && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '0 18px',
              minHeight: 68,
              borderRadius: 12,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: 'transparent',
              border: '1px dashed var(--border-default)',
              font: '600 13px/1 var(--font-sans)',
              color: 'var(--text-secondary)',
              transition: 'border-color var(--dur-fast), color var(--dur-fast)',
            }}
          >
            <Icon name="plus" size={15} />
            + {t('tournament.hero.events')}
          </button>
        )}
      </div>
      {adding && <AddEventDialog tour={tour} onClose={() => setAdding(false)} onAdd={onAdd} />}
    </TabTrack>
  )
}

/** Chọn loại nội dung chưa có. Mỗi loại một nội dung — trùng loại thì không phân biệt được trên màn. */
function AddEventDialog({ tour, onClose, onAdd }) {
  const [busy, setBusy] = useState(false)
  const taken = new Set(tour.events.map((e) => e.kind))
  const kinds = Object.keys(EVENT_KINDS).filter((k) => !taken.has(k))
  const pick = async (kind) => {
    setBusy(true)
    const ok = await onAdd(kind)
    setBusy(false)
    if (ok) onClose()
  }
  return (
    <Dialog open width={440} title={t('tournament.event.addTitle')} description={t('tournament.event.addHint')}
      onClose={busy ? undefined : onClose}>
      {kinds.length === 0 ? (
        <div style={{ font: 'var(--type-body)', color: 'var(--text-muted)' }}>{t('tournament.event.noneLeft')}</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              disabled={busy}
              onClick={() => pick(k)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--border-subtle)', background: 'var(--surface-inset)', cursor: 'pointer',
                textAlign: 'left', color: 'inherit',
              }}
            >
              <KindCode kind={k} />
              <span style={{ font: '600 13.5px/1 var(--font-sans)', color: 'var(--text-primary)' }}>{t('tournament.kind.' + k)}</span>
            </button>
          ))}
        </div>
      )}
    </Dialog>
  )
}
