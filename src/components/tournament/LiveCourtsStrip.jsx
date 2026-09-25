import { Mono } from '#ui'
import { t } from '#i18n'
import { queueOf } from '#lib/tournament/bracketView.js'
import { matchCode, teamName } from './tourUtils.js'

/**
 * Dải sân (handoff: "dải sân LIVE" dưới hero). Chỉ hiện dữ liệu CÓ THẬT:
 *   - Sân = `tour.courtLabels`. Trận đang đánh chưa gán / gán sân lạ → thẻ riêng, không xếp đại vào sân nào.
 *   - Tỷ số = các set ĐÃ ghi (`sets` dạng [[a,b],…]). Điểm từng quả chỉ nằm ở máy trọng tài (plan §4.5)
 *     nên set đang đánh không có ở đây → ghi "đang đánh", không hiện 0–0 giả.
 *   - Sân trống: trận kế tiếp chỉ khi BTC đã xếp trận đó vào đúng sân này (`courtLabel`). Không có giờ dự kiến.
 * Không có sân khai báo và không trận nào đang đánh → không hiện gì.
 * @param {(m) => void} [onScore]  chỉ truyền khi người xem có quyền ghi điểm
 */
export default function LiveCourtsStrip({ tour, db, onScore, isMobile }) {
  const courts = tour.courtLabels
  const live = (tour.matches || []).filter((m) => m.status === 'live')
  const waiting = queueOf(tour.matches || []).filter((m) => m.status === 'ready')

  const cards = [
    ...courts.map((label) => ({
      key: 'c:' + label, label,
      match: live.find((m) => m.courtLabel === label) || null,
      next: waiting.find((m) => m.courtLabel === label) || null,
    })),
    ...live.filter((m) => !courts.includes(m.courtLabel)).map((m) => ({
      key: 'm:' + m.id, label: m.courtLabel || t('tournament.courtStrip.noCourt'), match: m, next: null,
    })),
  ]
  if (!cards.length) return null

  const nameStyle = { font: '600 13px/1.2 var(--font-sans)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }
  const side = (m, s) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={nameStyle}>{teamName(tour, db, s === 'A' ? m.teamAId : m.teamBId)}</span>
      <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {(m.sets || []).map(([a, b], i) => {
          const mine = s === 'A' ? a : b
          return <Mono key={i} size={14} weight={700} color={mine > (s === 'A' ? b : a) ? 'var(--status-delivered-fg)' : 'var(--text-primary)'}>{mine}</Mono>
        })}
      </span>
    </div>
  )

  return (
    <div style={{
      display: 'grid', gap: 12, width: '100%',
      gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(240px, 1fr))' : `repeat(${Math.min(4, cards.length)}, minmax(0, 1fr))`,
    }}>
      {cards.map(({ key, label, match, next }) => {
        const ev = match && tour.events.find((e) => e.id === match.eventId)
        const clickable = Boolean(match && onScore)
        return (
          <div
            key={key}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? () => onScore(match) : undefined}
            onKeyDown={clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && onScore(match) : undefined}
            style={{
              display: 'flex', flexDirection: 'column', gap: 8, minHeight: 96, padding: '12px 14px', borderRadius: 12,
              background: 'var(--surface-card)', border: `1px solid ${match ? 'var(--teal-500)' : 'var(--border-subtle)'}`,
              boxShadow: 'var(--shadow-xs)', cursor: clickable ? 'pointer' : 'default', minWidth: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span style={{ font: '700 12px/1 var(--font-sans)', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                  {label}
                </span>
                {ev && (
                  <span style={{ font: '500 11.5px/1 var(--font-sans)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t('tournament.kindShort.' + ev.kind)} · {matchCode(match)}
                  </span>
                )}
              </span>
              {match && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 99, flexShrink: 0,
                  background: 'var(--status-delivered-bg)', color: 'var(--status-delivered-fg)', font: '700 10px/1 var(--font-mono)', letterSpacing: '0.05em',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-delivered-fg)' }} />
                  {t('tournament.courtStrip.live')}
                </span>
              )}
            </div>

            {match ? (
              <div style={{ display: 'grid', gap: 5 }}>
                {side(match, 'A')}
                {side(match, 'B')}
                {!(match.sets || []).length && <Mono size={11} color="var(--text-muted)">{t('tournament.courtStrip.playing')}</Mono>}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 4 }}>
                <span style={{ font: '500 13px/1.2 var(--font-sans)', color: 'var(--text-muted)' }}>{t('tournament.courtStrip.empty')}</span>
                {next && (
                  <span style={{ font: '400 11.5px/1.3 var(--font-mono)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t('tournament.courtStrip.next', { code: matchCode(next), match: `${teamName(tour, db, next.teamAId)} – ${teamName(tour, db, next.teamBId)}` })}
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
