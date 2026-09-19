import { Avatar } from '#ds'
import { t } from '#i18n'

export default function MyOpponentsCard({
  nemesis = null,
  favoriteOpponent = null,
  isMobile = false,
}) {
  const hasData = Boolean(nemesis || favoriteOpponent)

  const getOpponentAvatar = (opp) => {
    const m = opp?.opponent
    return (
      m?.avatarUrl ||
      m?.avatar_url ||
      m?.avatar ||
      m?.profile?.avatar_url ||
      m?.profile?.avatarUrl ||
      ''
    )
  }

  if (!hasData) {
    return (
      <div style={isMobile ? S.cardMobile : S.cardDesktop}>
        <span style={S.label}>{t('home.personal.myOpponentsTitle')}</span>
        <div style={S.emptyState}>{t('home.personal.emptyOpponents')}</div>
      </div>
    )
  }

  return (
    <div style={isMobile ? S.cardMobile : S.cardDesktop}>
      <span style={S.label}>{t('home.personal.myOpponentsTitle')}</span>

      <div style={S.list}>
        {/* 1. Khắc tinh (Nemesis - Đối thủ kỵ giơ nhất) */}
        {nemesis && (
          <div style={S.opponentRow}>
            <Avatar
              name={nemesis.oppName}
              src={getOpponentAvatar(nemesis)}
              size={36}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.nameRow}>
                <span style={S.nameBold}>{nemesis.oppName}</span>
                <span style={S.tagRed}>{t('home.personal.nemesisLabel')}</span>
              </div>
              <div style={S.meta}>
                {t('home.personal.matchesAgainst', {
                  total: nemesis.gamesCount,
                  w: nemesis.winsCount,
                  pct: nemesis.actualWinPct,
                })}
              </div>
            </div>
            <span style={S.impactRed}>
              {nemesis.matchupImpact != null
                ? (nemesis.matchupImpact > 0
                    ? `+${nemesis.matchupImpact}`
                    : `${nemesis.matchupImpact}`)
                : `${nemesis.actualWinPct}%`}
            </span>
          </div>
        )}

        {nemesis && favoriteOpponent && <div style={S.divider} />}

        {/* 2. Đối thủ ưa thích (Favorite Opponent - Đối thủ dễ thở nhất) */}
        {favoriteOpponent && (
          <div style={S.opponentRow}>
            <Avatar
              name={favoriteOpponent.oppName}
              src={getOpponentAvatar(favoriteOpponent)}
              size={36}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.nameRow}>
                <span style={S.nameBold}>{favoriteOpponent.oppName}</span>
                <span style={S.tagGreen}>{t('home.personal.favoriteOpponentLabel')}</span>
              </div>
              <div style={S.meta}>
                {t('home.personal.matchesAgainst', {
                  total: favoriteOpponent.gamesCount,
                  w: favoriteOpponent.winsCount,
                  pct: favoriteOpponent.actualWinPct,
                })}
              </div>
            </div>
            <span style={S.impactGreen}>
              {favoriteOpponent.matchupImpact != null
                ? (favoriteOpponent.matchupImpact > 0
                    ? `+${favoriteOpponent.matchupImpact}`
                    : `${favoriteOpponent.matchupImpact}`)
                : `${favoriteOpponent.actualWinPct}%`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  cardDesktop: {
    padding: '16px 17px',
    borderRadius: 14,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  cardMobile: {
    padding: '14px 15px',
    borderRadius: 14,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  label: {
    font: '600 11px/1 var(--font-sans)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  opponentRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 11,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  nameBold: {
    font: '700 15px/1.2 var(--font-display)',
    color: 'var(--text-primary)',
  },
  tagRed: {
    font: '600 10px/1 var(--font-sans)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '3px 6px',
    borderRadius: 999,
    background: 'var(--status-incident-bg)',
    color: 'var(--status-incident-fg)',
  },
  tagGreen: {
    font: '600 10px/1 var(--font-sans)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '3px 6px',
    borderRadius: 999,
    background: 'var(--status-delivered-bg)',
    color: 'var(--status-delivered-fg)',
  },
  meta: {
    font: '400 11.5px/1.35 var(--font-mono)',
    color: 'var(--text-muted)',
    marginTop: 2,
  },
  impactRed: {
    font: '700 15px/1 var(--font-mono)',
    color: 'var(--status-incident-fg)',
  },
  impactGreen: {
    font: '700 15px/1 var(--font-mono)',
    color: 'var(--status-delivered-fg)',
  },
  divider: {
    height: 1,
    background: 'var(--border-subtle)',
  },
  emptyState: {
    padding: '12px 0',
    font: '400 13px/1.4 var(--font-sans)',
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
}
