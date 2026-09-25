import { Mono } from '#ui'
import { t } from '#i18n'
import { matchCode, teamName } from './tourUtils.js'

/**
 * Dải Sân Live (Live Courts Strip): hiển thị trạng thái các sân thi đấu ngay dưới Hero.
 * Mỗi thẻ sân thể hiện: Header sân + nội dung/vòng + badge LIVE + 2 đội & tỷ số hiện tại.
 * Sân trống thể hiện trận kế tiếp dự kiến.
 * Bấm vào sân đang đánh sẽ mở ngay popup ghi điểm trận đấu.
 */
export default function LiveCourtsStrip({ tour, db, onScore, onOpenBracket, isMobile }) {
  const courts = tour.courtLabels.length > 0 ? tour.courtLabels : [1, 2, 3, 4].map((n) => t('tournament.courtStrip.court', { n }))
  const matches = tour.matches || []

  // Các trận live
  const liveMatches = matches.filter((m) => m.status === 'live')
  // Các trận sẵn sàng tiếp theo chưa xong
  const nextMatches = matches.filter((m) => m.status === 'ready' || m.status === 'pending')

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(240px, 1fr))' : `repeat(${Math.min(4, courts.length)}, 1fr)`,
      gap: 12,
      width: '100%',
    }}>
      {courts.map((courtName, idx) => {
        // Tìm trận live trên sân này (theo courtLabel, hoặc phân bổ lần lượt)
        const match = liveMatches.find((m) => m.courtLabel === courtName) ||
          (liveMatches.length > idx && !liveMatches.some((m) => m.courtLabel === courtName) ? liveMatches[idx] : null)

        // Nếu sân trống, tìm trận kế tiếp dự kiến
        const upcoming = !match
          ? (nextMatches.find((m) => m.courtLabel === courtName) || nextMatches[idx - liveMatches.length] || null)
          : null

        const ev = match ? tour.events.find((e) => e.id === match.eventId) : null
        const upEv = upcoming ? tour.events.find((e) => e.id === upcoming.eventId) : null

        return (
          <div
            key={courtName}
            onClick={() => {
              if (match && onScore) onScore(match)
              else if (upcoming && onOpenBracket) onOpenBracket(upcoming.eventId)
            }}
            role={match ? 'button' : undefined}
            tabIndex={match ? 0 : undefined}
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 104,
              padding: '12px 14px',
              borderRadius: 12,
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              cursor: match ? 'pointer' : 'default',
              transition: 'border-color var(--dur-fast), transform var(--dur-fast)',
              boxShadow: 'var(--shadow-xs)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Header Thẻ Sân */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span style={{ font: '700 12px/1 var(--font-sans)', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {courtName.toUpperCase()}
                </span>
                {match && ev && (
                  <span style={{ font: '500 11.5px/1 var(--font-sans)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t('tournament.kind.' + ev.kind)} · {matchCode(match)}
                  </span>
                )}
              </div>

              {match && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 7px',
                  borderRadius: 99,
                  background: 'rgba(95, 217, 162, 0.12)',
                  color: 'var(--status-delivered-fg)',
                  font: '700 10px/1 var(--font-mono)',
                  letterSpacing: '0.05em',
                  flexShrink: 0,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-delivered-fg)' }} />
                  {t('tournament.courtStrip.live')}
                </span>
              )}
            </div>

            {/* Nội Dung Thẻ Sân */}
            {match ? (
              <div style={{ display: 'grid', gap: 5 }}>
                {/* Hàng Đội A */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{
                    font: '600 13px/1.2 var(--font-sans)',
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {teamName(tour, db, match.teamAId)}
                  </span>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {(match.sets && match.sets.length > 0 ? match.sets : [{ a: 0, b: 0 }]).map((s, si) => (
                      <Mono key={si} size={14} weight={700} color={s.a > s.b ? 'var(--status-delivered-fg)' : 'var(--text-primary)'}>
                        {s.a}
                      </Mono>
                    ))}
                  </div>
                </div>

                {/* Hàng Đội B */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{
                    font: '600 13px/1.2 var(--font-sans)',
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {teamName(tour, db, match.teamBId)}
                  </span>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {(match.sets && match.sets.length > 0 ? match.sets : [{ a: 0, b: 0 }]).map((s, si) => (
                      <Mono key={si} size={14} weight={700} color={s.b > s.a ? 'var(--status-delivered-fg)' : 'var(--text-primary)'}>
                        {s.b}
                      </Mono>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Sân Trống */
              <div style={{ display: 'grid', gap: 4, padding: '4px 0' }}>
                <span style={{ font: '500 13px/1.2 var(--font-sans)', color: 'var(--text-muted)' }}>
                  {t('tournament.courtStrip.empty')}
                </span>
                {upcoming ? (
                  <span style={{ font: '400 11.5px/1.3 var(--font-mono)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t('tournament.courtStrip.next', {
                      time: upcoming.scheduledTime || '10:40',
                      match: `${teamName(tour, db, upcoming.teamAId) || t('common.unknown')} vs ${teamName(tour, db, upcoming.teamBId) || t('common.unknown')}`,
                    })}
                  </span>
                ) : (
                  <span style={{ font: '400 11.5px/1 var(--font-mono)', color: 'var(--text-muted)' }}>
                    -
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
