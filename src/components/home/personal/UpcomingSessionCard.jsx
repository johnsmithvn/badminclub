import { Icon } from '#ds'
import { t } from '#i18n'

// Thẻ "Buổi tới" kiểu VÉ VÀO SÂN (bản 3a): giờ to bên trái như cuống vé, tên sân in đủ, kèo viết
// hai dòng không cắt tên. Kèo của người đang đăng nhập xếp trên cùng, mỗi kèo một khối nền vàng
// nhạt; kèo người khác gom chung dưới nhãn "Sắp đấu". Dữ liệu dựng ở `getNextUpcomingSession`.

/** Một avatar tròn: ảnh nếu có, không thì chữ cái đầu trên nền màu riêng của người đó. */
function Av({ p, size, ring = false, style }) {
  return (
    <span
      title={p.name}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: p.bg,
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: `600 ${Math.round(size * 0.38)}px/1 var(--font-sans)`,
        overflow: 'hidden',
        flexShrink: 0,
        boxSizing: 'border-box',
        ...(ring ? { border: '2px solid var(--surface-card)' } : null),
        ...style,
      }}
    >
      {p.avatarUrl
        ? <img src={p.avatarUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : p.ini}
    </span>
  )
}

/** Một đội trong kèo: cặp avatar chồng nhau + tên đầy đủ. `team === null` là kèo mở chờ đối thủ. */
function TeamRow({ team, strong }) {
  if (!team) {
    return (
      <div style={S.teamRow}>
        <span style={S.avPair}>
          <span style={S.avEmpty} />
        </span>
        <span style={S.teamSeeking}>{t('home.personal.challengeSeekingOpponent')}</span>
      </div>
    )
  }
  return (
    <div style={S.teamRow}>
      <span style={S.avPair}>
        {team.list.slice(0, 2).map((p, i) => (
          <Av key={p.id || i} p={p} size={26} ring={i > 0} style={i > 0 ? { marginLeft: -8 } : null} />
        ))}
      </span>
      <span style={strong ? S.teamNameStrong : S.teamName}>{team.names}</span>
    </div>
  )
}

export default function UpcomingSessionCard({
  session = null,
  isMobile,
  onViewSchedule,
  onViewAssignment,
  onChallenge,
  onOpenChallenge,
  club = null,
}) {
  if (!session) {
    return (
      <div style={{ ...S.card, ...S.emptyCard }}>
        <span style={S.blockLabel}>{t('home.personal.upcomingSession', { time: '—' })}</span>
        <span style={S.emptyState}>{t('home.noUpcoming')}</span>
        <button type="button" onClick={onViewSchedule} style={S.emptyBtn}>
          {t('home.personal.viewSchedule')}
        </button>
      </div>
    )
  }

  const live = session.isHappeningNow
  // Buổi tuần sau / buổi đã qua thì ghi "T5 · 02/10"; trong hôm nay / mai thì "tối nay", "ngày mai".
  const dayLabel = live
    ? t('home.personal.ticketLive')
    : session.when === 'next'
      ? [session.weekday, session.dateFormatted].filter(Boolean).join(' · ')
      : t('home.personal.when.' + session.when)

  const attendees = session.attendees || []
  const shownAv = attendees.slice(0, 3)
  const extraAv = Math.max(0, (session.goingCount || 0) - shownAv.length)
  const mine = session.myChallenges || []
  const others = session.otherChallenges || []

  // Cả khối kèo bấm được → Sàn kèo, làm nổi bật đúng kèo đó (cùng đích với thông báo / Bảng tin).
  const openProps = (id) => (onOpenChallenge ? {
    role: 'link',
    tabIndex: 0,
    onClick: () => onOpenChallenge(id),
    onKeyDown: (ev) => { if (ev.key === 'Enter') onOpenChallenge(id) },
    style: { cursor: 'pointer' },
  } : {})

  return (
    <div style={S.card}>
      {/* Cuống vé: ngày + giờ to | thân vé: sân, người đi */}
      <div style={{ ...S.header, gridTemplateColumns: isMobile ? '96px minmax(0, 1fr)' : '108px minmax(0, 1fr)' }}>
        <div style={S.stub}>
          <span style={live ? { ...S.stubLabel, color: 'var(--status-delivered-fg)' } : S.stubLabel}>
            {live && <span style={S.liveDot} />}
            {dayLabel}
          </span>
          <span style={S.stubTime}>{session.timeFrom || '—'}</span>
          {session.timeTo && (
            <span style={S.stubUntil}>{t('home.personal.ticketUntil', { time: session.timeTo })}</span>
          )}
        </div>

        <div style={S.info}>
          <div style={S.venueRow}>
            <span style={isMobile ? S.venueMobile : S.venue}>
              {session.venueName || t('home.personal.defaultVenue')}
            </span>
            {session.mapUrl && (
              <a
                href={session.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={S.pinBtn}
                title={t('home.personal.ticketOpenMap')}
                aria-label={t('home.personal.ticketOpenMap')}
              >
                <Icon name="map-pin" size={16} />
              </a>
            )}
          </div>
          <div style={S.metaRow}>
            {shownAv.length > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                {shownAv.map((p, i) => (
                  <Av key={p.id || i} p={p} size={24} ring style={i > 0 ? { marginLeft: -6 } : null} />
                ))}
                {extraAv > 0 && <span style={S.avMore}>+{extraAv}</span>}
              </span>
            )}
            <span style={S.meta}>
              {t('home.personal.ticketGoing', { n: session.goingCount || 0 })}
              {' · '}
              <span style={session.isRegistered ? S.metaYou : null}>
                {session.isRegistered ? t('home.personal.ticketWithYou') : t('home.personal.ticketWithoutYou')}
              </span>
            </span>
          </div>
        </div>
      </div>

      {(mine.length > 0 || others.length > 0) && (
        <div style={S.body}>
          {mine.map((c) => {
            const { style: clickStyle, ...click } = openProps(c.id)
            return (
              <div key={c.id} style={{ ...S.block, ...S.blockMine, ...clickStyle }} {...click}>
                <span style={{ ...S.blockLabel, color: 'var(--status-delayed-fg)' }}>
                  {t('home.personal.myChallengeTag')}
                  {c.status === 'pending' && ` · ${t('challenge.status.pending')}`}
                </span>
                <TeamRow team={c.top} strong />
                <TeamRow team={c.bottom} />
              </div>
            )
          })}

          {others.length > 0 && (
            <div style={S.block}>
              <span style={S.blockLabel}>{t('home.personal.readyTag')}</span>
              {others.map((c, i) => {
                const { style: clickStyle, ...click } = openProps(c.id)
                return (
                  <div
                    key={c.id}
                    style={{ ...S.otherItem, ...(i > 0 ? S.otherDivider : null), ...clickStyle }}
                    {...click}
                  >
                    <TeamRow team={c.top} strong />
                    <TeamRow team={c.bottom} />
                  </div>
                )
              })}
              {session.moreChallenges > 0 && (
                <button type="button" onClick={() => onOpenChallenge?.()} style={S.moreBtn}>
                  {t('home.personal.ticketMoreChallenges', { n: session.moreChallenges })}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tóm tắt buổi của CLB (tab Sân đấu truyền vào) */}
      {club && <div style={S.club}>{club}</div>}

      <div style={S.footer}>
        <button type="button" onClick={onViewAssignment} style={S.footPrimary}>
          {t('home.personal.viewCourtAssignment')}
        </button>
        <button type="button" onClick={onChallenge} style={S.footSecondary}>
          {t('home.personal.challengeAction')}
        </button>
      </div>
    </div>
  )
}

const S = {
  card: {
    borderRadius: 14,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    // Bo góc cho dải nút dán đáy. Trong thẻ không có popover nào nên cắt tràn là an toàn.
    overflow: 'hidden',
  },
  club: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: 10,
    padding: '12px 16px',
    borderTop: '1px solid var(--border-subtle)',
  },
  emptyCard: {
    padding: '16px 16px',
    gap: 8,
  },
  emptyState: {
    font: '400 13px/1.4 var(--font-sans)',
    color: 'var(--text-muted)',
  },
  emptyBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    font: '600 12.5px/1 var(--font-sans)',
    padding: '10px 14px',
    borderRadius: 999,
    background: 'var(--action-primary-bg)',
    color: 'var(--action-primary-fg)',
    border: 'none',
    cursor: 'pointer',
  },

  header: {
    display: 'grid',
  },
  stub: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '16px 8px',
    textAlign: 'center',
    background: 'var(--surface-inset)',
    // Đường xé vé
    borderRight: '1px dashed var(--border-default)',
  },
  stubLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    font: '700 11px/1.2 var(--font-sans)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-accent)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    background: 'var(--status-delivered-fg)',
  },
  stubTime: {
    font: '700 28px/1 var(--font-display)',
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--text-primary)',
  },
  stubUntil: {
    font: '400 12px/1 var(--font-sans)',
    color: 'var(--text-muted)',
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '14px 14px 14px 16px',
    minWidth: 0,
  },
  venueRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  venue: {
    font: '700 18px/1.3 var(--font-display)',
    color: 'var(--text-primary)',
    wordBreak: 'break-word',
    minWidth: 0,
  },
  venueMobile: {
    font: '700 16px/1.3 var(--font-display)',
    color: 'var(--text-primary)',
    wordBreak: 'break-word',
    minWidth: 0,
  },
  pinBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    border: '1px solid var(--border-default)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    flexShrink: 0,
    textDecoration: 'none',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  avMore: {
    marginLeft: -6,
    minWidth: 24,
    height: 24,
    padding: '0 5px',
    borderRadius: 999,
    boxSizing: 'border-box',
    border: '2px solid var(--surface-card)',
    background: 'var(--surface-sunken)',
    color: 'var(--text-secondary)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    font: '600 9.5px/1 var(--font-sans)',
  },
  meta: {
    font: '400 12.5px/1.3 var(--font-sans)',
    color: 'var(--text-muted)',
  },
  metaYou: {
    color: 'var(--status-delivered-fg)',
    fontWeight: 600,
  },

  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 8,
    borderTop: '1px solid var(--border-subtle)',
  },
  block: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '10px 12px',
    borderRadius: 10,
    background: 'var(--surface-inset)',
  },
  // Kèo của mình: chỉ đánh dấu bằng NỀN vàng nhạt + nhãn vàng, không thêm viền hay icon.
  blockMine: {
    background: 'var(--status-delayed-bg)',
  },
  blockLabel: {
    font: '700 11px/1.2 var(--font-sans)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  otherItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  otherDivider: {
    paddingTop: 8,
    borderTop: '1px solid var(--border-subtle)',
  },
  teamRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  avPair: {
    display: 'inline-flex',
    alignItems: 'center',
    width: 44,
    flexShrink: 0,
  },
  avEmpty: {
    width: 26,
    height: 26,
    borderRadius: '50%',
    border: '1.5px dashed var(--border-strong-color)',
    boxSizing: 'border-box',
  },
  // Không cắt tên: tên dài xuống dòng, không "…".
  teamNameStrong: {
    font: '600 14px/1.35 var(--font-sans)',
    color: 'var(--text-primary)',
    wordBreak: 'break-word',
    minWidth: 0,
  },
  teamName: {
    font: '500 14px/1.35 var(--font-sans)',
    color: 'var(--text-secondary)',
    wordBreak: 'break-word',
    minWidth: 0,
  },
  teamSeeking: {
    font: 'italic 500 13px/1.35 var(--font-sans)',
    color: 'var(--status-delayed-fg)',
  },
  moreBtn: {
    alignSelf: 'flex-start',
    padding: 0,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    font: '600 12px/1.3 var(--font-sans)',
    color: 'var(--text-link)',
  },

  footer: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    borderTop: '1px solid var(--border-subtle)',
  },
  footPrimary: {
    padding: '14px 12px',
    border: 'none',
    background: 'var(--action-primary-bg)',
    color: 'var(--action-primary-fg)',
    font: '600 13px/1 var(--font-sans)',
    cursor: 'pointer',
  },
  footSecondary: {
    padding: '14px 12px',
    border: 'none',
    borderLeft: '1px solid var(--border-subtle)',
    background: 'var(--surface-card)',
    color: 'var(--text-primary)',
    font: '600 13px/1 var(--font-sans)',
    cursor: 'pointer',
  },
}
