import { t } from '#i18n'
import { useTheme } from '#contexts/ThemeContext.jsx'

export default function EffectiveStrengthModal({
  player = {
    name: 'Player',
    gamesCount: 3,
    confidence: 'low',
    rating: 1655,
    seedRating: 1580,
    effectiveStrength: 1610,
  },
  onClose,
}) {
  const { isDark } = useTheme()

  if (!player) return null

  const name = player.name || ''
  const games = player.gamesCount || 0
  const elo = player.displayRating || player.rating || 1500
  const seed = player.seedRating || 1500
  const eff = player.effectiveStrength || Math.round(seed * 0.6 + elo * 0.4)

  // Tỷ lệ co cụm
  const seedPct = games >= 30 ? 0 : games >= 15 ? 15 : games >= 5 ? 35 : 60
  const eloPct = 100 - seedPct

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        data-screen-label="CE3 Effective strength"
        style={{
          width: 420,
          maxWidth: '100%',
          background: 'var(--surface-overlay)',
          border: '1px solid var(--border-default)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-overlay)',
          padding: 18,
          display: 'grid',
          gap: 13,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              background: '#7A3D8F',
              flex: '0 0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 600,
            }}
          >
            {name.charAt(0)}
          </span>
          <div style={{ flex: '1 1 0%', minWidth: 0 }}>
            <div style={{ font: "600 15px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>{name}</div>
            <div style={{ font: "400 12px/1.4 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
              {t('season.matchesCount', { n: games })} · confidence {(player.confidence || 'low').toUpperCase()}
            </div>
          </div>
          {games < 5 && (
            <span
              style={{
                font: "600 10px/1 'IBM Plex Mono', monospace",
                padding: '5px 7px',
                borderRadius: 999,
                background: isDark ? 'rgba(214,59,43,.14)' : 'rgba(214,59,43,.10)',
                border: '1px solid #D63B2B',
                color: isDark ? '#F1A79D' : '#DC2626',
              }}
            >
              ⚠ {t('season.provisionalBadge', { n: Math.max(0, 5 - games) })}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              font: "600 16px/1 'IBM Plex Mono', monospace",
              color: 'var(--text-muted)',
              padding: 2,
            }}
          >
            ✕
          </button>
        </div>

        {/* Stats List */}
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: "400 12px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-secondary)' }}>
            <span>{t('season.currentElo')}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-primary)', fontWeight: 600 }}>{elo}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: "400 12px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-secondary)' }}>
            <span>{t('season.seedRating')}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-primary)', fontWeight: 600 }}>{seed}</span>
          </div>
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '2px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
            <span>{t('season.effectiveStrengthForMatchmaking')}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: isDark ? '#F0D26A' : '#B45309', fontWeight: 700 }}>{eff}</span>
          </div>
        </div>

        {/* Two-tone Bar */}
        <div style={{ display: 'grid', gap: 7 }}>
          <div style={{ height: 24, borderRadius: 6, overflow: 'hidden', display: 'flex', border: '1px solid var(--border-subtle)' }}>
            {seedPct > 0 && (
              <div
                style={{
                  width: `${seedPct}%`,
                  background: '#7A3D8F',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  font: "600 10px/1 'IBM Plex Mono', monospace",
                  color: '#fff',
                }}
              >
                seed {seedPct}%
              </div>
            )}
            <div
              style={{
                width: `${eloPct}%`,
                background: '#1D50A0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                font: "600 10px/1 'IBM Plex Mono', monospace",
                color: '#fff',
              }}
            >
              Elo {eloPct}%
            </div>
          </div>
          <div style={{ font: "400 11px/1.4 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
            {seed} × {(seedPct / 100).toFixed(2)} + {elo} × {(eloPct / 100).toFixed(2)} = {eff}
          </div>
        </div>

        {/* Shrinkage Matrix Table */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 11, display: 'grid', gap: 8 }}>
          <div
            style={{
              font: "600 12px/1.2 'IBM Plex Sans', sans-serif",
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            {t('season.shrinkageMatrixTitle')}
          </div>
          <div style={{ display: 'grid', gap: 6, font: "400 11px/1.3 'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr) 92px', gap: 8, alignItems: 'center' }}>
              <span>&lt; 5 {t('units.match')}</span>
              <span style={{ height: 6, borderRadius: 999, background: 'var(--surface-inset)', overflow: 'hidden', display: 'flex' }}>
                <span style={{ width: '40%', background: '#1D50A0' }} />
              </span>
              <span style={{ textAlign: 'right', color: 'var(--text-primary)' }}>Elo 40%</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr) 92px', gap: 8, alignItems: 'center' }}>
              <span>5–14</span>
              <span style={{ height: 6, borderRadius: 999, background: 'var(--surface-inset)', overflow: 'hidden', display: 'flex' }}>
                <span style={{ width: '65%', background: '#1D50A0' }} />
              </span>
              <span style={{ textAlign: 'right', color: 'var(--text-primary)' }}>Elo 65%</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr) 92px', gap: 8, alignItems: 'center' }}>
              <span>15–29</span>
              <span style={{ height: 6, borderRadius: 999, background: 'var(--surface-inset)', overflow: 'hidden', display: 'flex' }}>
                <span style={{ width: '85%', background: '#1D50A0' }} />
              </span>
              <span style={{ textAlign: 'right', color: 'var(--text-primary)' }}>Elo 85%</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr) 92px', gap: 8, alignItems: 'center' }}>
              <span>≥ 30</span>
              <span style={{ height: 6, borderRadius: 999, background: 'var(--surface-inset)', overflow: 'hidden', display: 'flex' }}>
                <span style={{ width: '100%', background: '#00B2A9' }} />
              </span>
              <span style={{ textAlign: 'right', color: isDark ? '#5FDBD3' : 'var(--teal-700)', fontWeight: 600 }}>Elo 100%</span>
            </div>
          </div>
        </div>

        {/* Note */}
        <div style={{ font: "400 12px/1.5 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: 11 }}>
          {t('season.effectiveStrengthNote', { name })}
        </div>
      </div>
    </div>
  )
}
