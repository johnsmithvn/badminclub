import { Icon } from '#ds'
import { t } from '#i18n'
import { dd } from '#utils/dates.js'

/**
 * Thẻ "Trận của bạn có video" (18d): các trận gần nhất của mình có video, cùng kiểu ô của Phong độ.
 * Bấm một ô → xem video trận đó ngay (`onPlay`). Bấm dòng tiêu đề → Lịch sử trận đã lọc (`onViewAll`).
 * `data` = getMyVideoMatches(). Chưa có trận nào có video thì không vẽ gì.
 */
export default function MyVideoMatchesCard({ data, isMobile, onViewAll, onPlay }) {
  if (!data?.total) return null

  return (
    <div style={S.card}>
      <button
        type="button"
        onClick={onViewAll}
        aria-label={t('home.personal.videoMatchesAllAria', { n: data.total })}
        style={{ ...S.headerRow, minHeight: isMobile ? 44 : 32 }}
      >
        <span style={S.title}>{t('home.personal.videoMatchesTitle')}</span>
        <span style={S.all}>
          {t('home.personal.videoMatchesAll', { n: data.total })}
          <Icon name="chevron-right" size={14} />
        </span>
      </button>

      <div style={S.grid}>
        {data.items.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onPlay(m.id)}
            aria-label={t('home.personal.videoMatchPlayAria', { date: m.date ? dd(m.date) : '', score: m.score || '—' })}
            style={{ ...S.tile, height: isMobile ? 56 : 52 }}
          >
            <span style={{
              ...S.score,
              color: m.won === true ? 'var(--status-delivered-fg)' : m.won === false ? 'var(--status-incident-fg)' : 'var(--text-secondary)',
            }}>
              {m.score || '—'}
            </span>
            <span style={S.date}>
              <Icon name="play" size={9} style={{ color: 'var(--status-incident-fg)', fill: 'currentColor' }} />
              {m.date ? dd(m.date) : ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

const S = {
  card: {
    padding: '12px 15px 14px',
    borderRadius: 'var(--radius-card, 14px)',
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: 0,
    border: 0,
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
  },
  title: {
    flex: 1,
    minWidth: 0,
    font: '600 11px/1 var(--font-sans)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  all: {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--status-incident-fg)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 7,
  },
  tile: {
    minWidth: 0,
    padding: 0,
    borderRadius: 'var(--radius-sm, 8px)',
    background: 'var(--surface-inset)',
    border: '1px solid var(--status-incident-bg)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    cursor: 'pointer',
  },
  score: {
    font: '600 13px/1 var(--font-mono)',
    whiteSpace: 'nowrap',
  },
  date: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    font: '400 10.5px/1 var(--font-mono)',
    color: 'var(--text-muted)',
  },
}
