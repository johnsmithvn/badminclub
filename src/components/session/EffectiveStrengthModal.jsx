import { t } from '#i18n'

export default function EffectiveStrengthModal({
  player = {
    name: 'Nguyễn Khánh Vy',
    gamesCount: 3,
    confidence: 'low',
    rating: 1655,
    seedRating: 1580,
    effectiveStrength: 1610,
  },
  onClose,
}) {
  if (!player) return null

  const name = player.name || 'VĐV'
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
        background: 'rgba(0,0,0,.70)',
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
          background: '#1A2437',
          border: '1px solid #2E3E5C',
          borderRadius: 12,
          boxShadow: '0 20px 48px rgba(0,0,0,.55)',
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
            <div style={{ font: "600 15px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>{name}</div>
            <div style={{ font: "400 12px/1.4 'IBM Plex Mono', monospace", color: '#8494AA' }}>
              {games} {t('season.matchesCount')} · confidence {(player.confidence || 'low').toUpperCase()}
            </div>
          </div>
          {games < 5 && (
            <span
              style={{
                font: "600 10px/1 'IBM Plex Mono', monospace",
                padding: '5px 7px',
                borderRadius: 999,
                background: 'rgba(214,59,43,.14)',
                border: '1px solid #8E2C20',
                color: '#F1A79D',
              }}
            >
              ⚠ {t('season.provisionalBadge')}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              font: "600 16px/1 'IBM Plex Mono', monospace",
              color: '#8494AA',
              padding: 2,
            }}
          >
            ✕
          </button>
        </div>

        {/* Stats List */}
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: "400 12px/1.2 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
            <span>{t('season.currentElo')}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#E9EFF7' }}>{elo}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: "400 12px/1.2 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
            <span>{t('season.seedRating')}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#E9EFF7' }}>{seed}</span>
          </div>
          <div style={{ height: 1, background: '#22304A', margin: '2px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
            <span>{t('season.effectiveStrengthForMatchmaking')}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#F0D26A' }}>{eff}</span>
          </div>
        </div>

        {/* Two-tone Bar */}
        <div style={{ display: 'grid', gap: 7 }}>
          <div style={{ height: 24, borderRadius: 6, overflow: 'hidden', display: 'flex', border: '1px solid #22304A' }}>
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
          <div style={{ font: "400 11px/1.4 'IBM Plex Mono', monospace", color: '#8494AA' }}>
            {seed} × {(seedPct / 100).toFixed(2)} + {elo} × {(eloPct / 100).toFixed(2)} = {eff}
          </div>
        </div>

        {/* Shrinkage Matrix Table */}
        <div style={{ borderTop: '1px solid #22304A', paddingTop: 11, display: 'grid', gap: 8 }}>
          <div
            style={{
              font: "600 12px/1.2 'IBM Plex Sans', sans-serif",
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: '#8494AA',
            }}
          >
            {t('season.shrinkageMatrixTitle')}
          </div>
          <div style={{ display: 'grid', gap: 6, font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#A8B7CB' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr) 92px', gap: 8, alignItems: 'center' }}>
              <span>&lt; 5 trận</span>
              <span style={{ height: 6, borderRadius: 999, background: '#0B1220', overflow: 'hidden', display: 'flex' }}>
                <span style={{ width: '40%', background: '#1D50A0' }} />
              </span>
              <span style={{ textAlign: 'right' }}>Elo 40%</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr) 92px', gap: 8, alignItems: 'center' }}>
              <span>5–14</span>
              <span style={{ height: 6, borderRadius: 999, background: '#0B1220', overflow: 'hidden', display: 'flex' }}>
                <span style={{ width: '65%', background: '#1D50A0' }} />
              </span>
              <span style={{ textAlign: 'right' }}>Elo 65%</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr) 92px', gap: 8, alignItems: 'center' }}>
              <span>15–29</span>
              <span style={{ height: 6, borderRadius: 999, background: '#0B1220', overflow: 'hidden', display: 'flex' }}>
                <span style={{ width: '85%', background: '#1D50A0' }} />
              </span>
              <span style={{ textAlign: 'right' }}>Elo 85%</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr) 92px', gap: 8, alignItems: 'center' }}>
              <span>≥ 30</span>
              <span style={{ height: 6, borderRadius: 999, background: '#0B1220', overflow: 'hidden', display: 'flex' }}>
                <span style={{ width: '100%', background: '#00B2A9' }} />
              </span>
              <span style={{ textAlign: 'right', color: '#5FDBD3' }}>Elo 100%</span>
            </div>
          </div>
        </div>

        {/* Note */}
        <div style={{ font: "400 12px/1.5 'IBM Plex Sans', sans-serif", color: '#8494AA', borderTop: '1px solid #22304A', paddingTop: 11 }}>
          {t('season.effectiveStrengthNote', { name })}
        </div>
      </div>
    </div>
  )
}
