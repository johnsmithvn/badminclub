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

  const nameStyle = { font: '600 12.5px/1.2 var(--font-sans)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }
  const side = (m, s) => {
    const isA = s === 'A'
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minHeight: 24 }}>
        <span style={nameStyle}>{teamName(tour, db, isA ? m.teamAId : m.teamBId)}</span>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {(m.sets || []).map(([a, b], i) => {
            const mine = isA ? a : b
            const opponent = isA ? b : a
            const won = mine > opponent
            return (
              <span
                key={i}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 5,
                  display: 'grid',
                  placeItems: 'center',
                  font: '700 11.5px/1 var(--font-mono)',
                  background: won ? 'var(--status-delivered-bg)' : 'var(--surface-sunken)',
                  color: won ? 'var(--status-delivered-fg)' : 'var(--text-primary)',
                  border: `1px solid ${won ? 'var(--action-success-border)' : 'var(--border-subtle)'}`,
                }}
              >
                {mine}
              </span>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid', gap: 10, width: '100%',
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
              display: 'flex', flexDirection: 'column', gap: 8, minHeight: 92, padding: '10px 14px', borderRadius: 10,
              background: 'var(--surface-card)', border: `1px solid ${match ? 'var(--teal-700)' : 'var(--border-subtle)'}`,
              boxShadow: 'var(--shadow-xs)', cursor: clickable ? 'pointer' : 'default', minWidth: 0,
              transition: 'border-color var(--dur-fast)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span style={{ font: '700 13px/1 var(--font-display)', color: 'var(--text-primary)', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                  {label}
                </span>
                {ev && (
                  <span style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t('tournament.kindShort.' + ev.kind)} · {matchCode(match)}
                  </span>
                )}
              </span>
              {match && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 99, flexShrink: 0,
                  background: 'var(--status-delivered-bg)', color: 'var(--status-delivered-fg)', font: '700 9.5px/1 var(--font-sans)', letterSpacing: '0.08em',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-delivered-fg)', animation: 'tourLivePulse 1.8s infinite ease-in-out' }} />
                  {t('tournament.courtStrip.live')}
                </span>
              )}
            </div>

            {match ? (
              <div style={{ display: 'grid', gap: 4 }}>
                {side(match, 'A')}
                {side(match, 'B')}
                {!(match.sets || []).length && (
                  <span style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--teal-500)', marginTop: 2 }}>
                    {t('tournament.courtStrip.playing')}
                  </span>
                )}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                <span style={{ font: '600 12.5px/1.3 var(--font-sans)', color: 'var(--text-secondary)' }}>
                  {t('tournament.courtStrip.empty')}
                </span>
                {next && (
                  <span style={{ font: '400 11px/1.3 var(--font-mono)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
