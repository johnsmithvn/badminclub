import { useState } from 'react'
import { t } from '#i18n'
import { shortName } from '#lib/money.js'

export default function NearbyStandingsCard({ standings = [], seasonStandings = [], onViewLeaderboard }) {
  const [mode, setMode] = useState('season') // 'season' | 'elo'
  const isSeason = mode === 'season'
  const displayList = isSeason && seasonStandings && seasonStandings.length > 0 ? seasonStandings : standings

  return (
    <div style={S.card}>
      <div style={S.headerRow}>
        <span style={S.title}>{t('home.personal.aroundYouTitle')}</span>

        <div style={S.modeToggle}>
          <button
            type="button"
            onClick={() => setMode('season')}
            style={isSeason ? S.modeBtnActive : S.modeBtn}
          >
            {t('home.personal.seasonTab')}
          </button>
          <button
            type="button"
            onClick={() => setMode('elo')}
            style={!isSeason ? S.modeBtnActive : S.modeBtn}
          >
            {t('home.personal.eloTab')}
          </button>
        </div>

        <button type="button" onClick={onViewLeaderboard} style={S.viewBtn}>
          {t('home.personal.viewLeaderboard')}
        </button>
      </div>

      <div style={S.rowsList}>
        {displayList.map((item) => {
          const metricVal = isSeason
            ? `${item.points ?? item.elo} ${t('home.personal.seasonPointsShortUnit')}`
            : item.elo

          if (item.isMe) {
            return (
              <div key={item.id} style={S.rowActive}>
                <span style={S.rankActive}>#{item.rank}</span>
                <span style={S.nameActive}>{t('home.personal.you')}</span>
                <span style={S.eloActive}>{metricVal}</span>
              </div>
            )
          }

          if (item.isTarget) {
            return (
              <div key={item.id} style={S.rowTarget}>
                <span style={S.rankTarget}>#{item.rank}</span>
                <span style={S.nameTarget}>
                  <span title={item.name}>{shortName(item.name)}</span>
                  <span style={S.targetTag}> · {t('home.personal.targetTag')}</span>
                </span>
                <span style={S.eloTarget}>{metricVal}</span>
              </div>
            )
          }

          return (
            <div key={item.id} style={S.rowNormal}>
              <span style={S.rankNormal}>#{item.rank}</span>
              <span style={S.nameNormal}>
                <span title={item.name}>{shortName(item.name)}</span>
                {item.streakWins >= 3 && (
                  <span style={S.streakNote}> · 🔥 {item.streakWins}T</span>
                )}
              </span>
              <span style={S.eloNormal}>{metricVal}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const S = {
  card: {
    padding: '16px 17px',
    borderRadius: 14,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  title: {
    flex: 1,
    font: '600 11px/1 var(--font-sans)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  modeToggle: {
    display: 'inline-flex',
    padding: 2,
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    gap: 2,
  },
  modeBtn: {
    background: 'none',
    border: 'none',
    padding: '3px 8px',
    borderRadius: 6,
    font: '600 11px/1 var(--font-sans)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  modeBtnActive: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    padding: '3px 8px',
    borderRadius: 6,
    font: '600 11px/1 var(--font-sans)',
    color: 'var(--text-primary)',
    boxShadow: 'var(--shadow-sm)',
    cursor: 'default',
  },
  viewBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    font: '400 12px/1 var(--font-sans)',
    color: 'var(--text-link)',
    cursor: 'pointer',
  },
  rowsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  rowNormal: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 9px',
    borderRadius: 9,
  },
  rowActive: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 9px',
    borderRadius: 9,
    background: 'var(--surface-accent-soft)',
  },
  rowTarget: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 9px',
    borderRadius: 9,
    border: '1px solid var(--status-delayed-fg)',
  },
  rankNormal: {
    width: 28,
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  rankActive: {
    width: 28,
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--status-transit-fg)',
  },
  rankTarget: {
    width: 28,
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--status-delayed-fg)',
  },
  nameNormal: {
    flex: 1,
    minWidth: 0,
    font: '500 13px/1.3 var(--font-sans)',
    color: 'var(--text-secondary)',
  },
  nameActive: {
    flex: 1,
    minWidth: 0,
    font: '600 13px/1.3 var(--font-sans)',
    color: 'var(--text-primary)',
  },
  nameTarget: {
    flex: 1,
    minWidth: 0,
    font: '600 13px/1.3 var(--font-sans)',
    color: 'var(--text-primary)',
  },
  targetTag: {
    font: '400 11px/1 var(--font-mono)',
    color: 'var(--status-delayed-fg)',
  },
  streakNote: {
    font: '400 11px/1 var(--font-mono)',
    color: 'var(--status-incident-fg)',
  },
  eloNormal: {
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  eloActive: {
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--text-primary)',
  },
  eloTarget: {
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--text-primary)',
  },
}
