import { t } from '#i18n'

export default function RatingFormulaModal({ onClose, totalMatches = 214 }) {
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
        data-screen-label="EA2 Cai dat rating"
        style={{
          width: 820,
          maxWidth: '100%',
          background: '#0B1220',
          border: '1px solid #22304A',
          borderRadius: 12,
          padding: 20,
          display: 'grid',
          gap: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,.60)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ font: '600 18px/1.25 Barlow, sans-serif', color: '#fff' }}>
            {t('rating.formulaTitle')}
          </div>
          <div style={{ font: "400 12px/1.4 'IBM Plex Mono', monospace", color: '#8494AA' }}>
            {t('rating.formulaAdminOnly')}
          </div>
          <div style={{ flex: '1 1 0%' }} />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              font: "600 16px/1 'IBM Plex Mono', monospace",
              color: '#8494AA',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Khối 1: Biên thắng làm mềm */}
        <div
          style={{
            background: '#141D2E',
            border: '1px solid #22304A',
            borderRadius: 10,
            padding: 15,
            display: 'grid',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", flex: 1, color: '#fff' }}>
              {t('rating.movMultiplier')}
            </span>
            <span
              style={{
                font: "600 10px/1 'IBM Plex Mono', monospace",
                padding: '4px 7px',
                borderRadius: 999,
                background: 'rgba(0,178,169,.16)',
                border: '1px solid #00786F',
                color: '#5FDBD3',
              }}
            >
              {t('rating.movSoftened')}
            </span>
          </div>
          <div style={{ font: "400 12.5px/1.55 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
            {t('rating.movDesc')}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '126px minmax(0,1fr) 92px 92px',
                gap: 10,
                alignItems: 'center',
                font: "600 11px/1.2 'IBM Plex Sans', sans-serif",
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: '#8494AA',
              }}
            >
              <span>{t('rating.pointsDiff')}</span>
              <span />
              <span style={{ textAlign: 'right' }}>{t('rating.oldCol')}</span>
              <span style={{ textAlign: 'right' }}>{t('rating.newCol')}</span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '126px minmax(0,1fr) 92px 92px',
                gap: 10,
                alignItems: 'center',
                padding: '9px 0',
                borderTop: '1px solid #22304A',
              }}
            >
              <span style={{ font: "400 12.5px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                {t('rating.le4Pts')}
              </span>
              <span style={{ height: 8, borderRadius: 999, background: '#0B1220', overflow: 'hidden', display: 'flex' }}>
                <span style={{ width: '6%', background: '#00786F' }} />
              </span>
              <span style={{ textAlign: 'right', font: "400 12px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                ×1.05
              </span>
              <span style={{ textAlign: 'right', font: "600 13px/1 'IBM Plex Mono', monospace", color: '#5FDBD3' }}>
                ×1.02
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '126px minmax(0,1fr) 92px 92px',
                gap: 10,
                alignItems: 'center',
                padding: '9px 0',
                borderTop: '1px solid #22304A',
              }}
            >
              <span style={{ font: "400 12.5px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                {t('rating.pts5to8')}
              </span>
              <span style={{ height: 8, borderRadius: 999, background: '#0B1220', overflow: 'hidden', display: 'flex' }}>
                <span style={{ width: '32%', background: '#00786F' }} />
              </span>
              <span style={{ textAlign: 'right', font: "400 12px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                ×1.20
              </span>
              <span style={{ textAlign: 'right', font: "600 13px/1 'IBM Plex Mono', monospace", color: '#5FDBD3' }}>
                ×1.10
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '126px minmax(0,1fr) 92px 92px',
                gap: 10,
                alignItems: 'center',
                padding: '9px 0',
                borderTop: '1px solid #22304A',
              }}
            >
              <span style={{ font: "400 12.5px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                {t('rating.pts9to13')}
              </span>
              <span style={{ height: 8, borderRadius: 999, background: '#0B1220', overflow: 'hidden', display: 'flex' }}>
                <span style={{ width: '52%', background: '#00B2A9' }} />
              </span>
              <span style={{ textAlign: 'right', font: "400 12px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                ×1.40
              </span>
              <span style={{ textAlign: 'right', font: "600 13px/1 'IBM Plex Mono', monospace", color: '#5FDBD3' }}>
                ×1.15
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '126px minmax(0,1fr) 92px 92px',
                gap: 10,
                alignItems: 'center',
                padding: '9px 0',
                borderTop: '1px solid #22304A',
              }}
            >
              <span style={{ font: "400 12.5px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                {t('rating.ge14Pts')}
              </span>
              <span style={{ height: 8, borderRadius: 999, background: '#0B1220', overflow: 'hidden', display: 'flex' }}>
                <span style={{ width: '76%', background: '#00B2A9' }} />
              </span>
              <span style={{ textAlign: 'right', font: "400 12px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                ×1.40
              </span>
              <span style={{ textAlign: 'right', font: "600 13px/1 'IBM Plex Mono', monospace", color: '#5FDBD3' }}>
                ×1.22
              </span>
            </div>
          </div>
        </div>

        {/* Khối 2: Vai trò khi chia sân */}
        <div
          style={{
            background: '#141D2E',
            border: '1px solid #22304A',
            borderRadius: 10,
            padding: 15,
            display: 'grid',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", flex: 1, color: '#fff' }}>
              {t('rating.courtRoleTitle')}
            </span>
            <span style={{ font: "400 12px/1.2 'IBM Plex Mono', monospace", color: '#8494AA' }}>
              {t('rating.total100')}
            </span>
          </div>
          <div style={{ font: "400 12.5px/1.55 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
            {t('rating.courtRoleDesc')}
          </div>
          <div style={{ display: 'grid', gap: 9 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr) 96px 40px', gap: 10, alignItems: 'center' }}>
              <span style={{ font: "600 12.5px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>{t('rating.courtBalance')}</span>
              <span style={{ height: 10, borderRadius: 999, background: '#0B1220', border: '1px solid #22304A', overflow: 'hidden', display: 'flex' }}>
                <span style={{ width: '34%', background: '#00B2A9' }} />
              </span>
              <span style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>30 → 34</span>
              <span style={{ textAlign: 'right', font: "600 13px/1 'IBM Plex Mono', monospace", color: '#fff' }}>34</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr) 96px 40px', gap: 10, alignItems: 'center' }}>
              <span style={{ font: "600 12.5px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>{t('rating.fairTurns')}</span>
              <span style={{ height: 10, borderRadius: 999, background: '#0B1220', border: '1px solid #22304A', overflow: 'hidden', display: 'flex' }}>
                <span style={{ width: '20%', background: '#00B2A9' }} />
              </span>
              <span style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>15 → 20</span>
              <span style={{ textAlign: 'right', font: "600 13px/1 'IBM Plex Mono', monospace", color: '#fff' }}>20</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr) 96px 40px', gap: 10, alignItems: 'center' }}>
              <span style={{ font: "600 12.5px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>{t('rating.partnerOppDiversity')}</span>
              <span style={{ height: 10, borderRadius: 999, background: '#0B1220', border: '1px solid #22304A', overflow: 'hidden', display: 'flex' }}>
                <span style={{ width: '18%', background: '#3C74C4' }} />
              </span>
              <span style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>{t('rating.combined2015')}</span>
              <span style={{ textAlign: 'right', font: "600 13px/1 'IBM Plex Mono', monospace", color: '#fff' }}>18</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr) 96px 40px', gap: 10, alignItems: 'center' }}>
              <span style={{ font: "600 12.5px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                {t('rating.synergyNew')} <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: '#5FDBD3' }}>{t('rating.newBadge')}</span>
              </span>
              <span style={{ height: 10, borderRadius: 999, background: '#0B1220', border: '1px solid #22304A', overflow: 'hidden', display: 'flex' }}>
                <span style={{ width: '16%', background: '#00786F' }} />
              </span>
              <span style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>{t('rating.onlyWhenR2')}</span>
              <span style={{ textAlign: 'right', font: "600 13px/1 'IBM Plex Mono', monospace", color: '#5FDBD3' }}>16</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr) 96px 40px', gap: 10, alignItems: 'center' }}>
              <span style={{ font: "600 12.5px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                {t('rating.matchupNew')} <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: '#5FDBD3' }}>{t('rating.newBadge')}</span>
              </span>
              <span style={{ height: 10, borderRadius: 999, background: '#0B1220', border: '1px solid #22304A', overflow: 'hidden', display: 'flex' }}>
                <span style={{ width: '8%', background: '#00786F' }} />
              </span>
              <span style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>{t('rating.onlyWhenR2')}</span>
              <span style={{ textAlign: 'right', font: "600 13px/1 'IBM Plex Mono', monospace", color: '#5FDBD3' }}>8</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr) 96px 40px', gap: 10, alignItems: 'center' }}>
              <span style={{ font: "600 12.5px/1.3 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>H2H</span>
              <span style={{ height: 10, borderRadius: 999, background: '#0B1220', border: '1px solid #22304A', overflow: 'hidden', display: 'flex' }}>
                <span style={{ width: '4%', background: '#2E3E5C' }} />
              </span>
              <span style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#F0B75C' }}>20 → 4</span>
              <span style={{ textAlign: 'right', font: "600 13px/1 'IBM Plex Mono', monospace", color: '#A8B7CB' }}>4</span>
            </div>
          </div>
          <div style={{ font: "400 12px/1.5 'IBM Plex Sans', sans-serif", color: '#8494AA', borderTop: '1px solid #22304A', paddingTop: 11 }}>
            {t('rating.h2hRoleNote')}
          </div>
        </div>

        {/* Khối 3: Ngưỡng mẫu */}
        <div
          style={{
            background: '#141D2E',
            border: '1px solid #22304A',
            borderRadius: 10,
            padding: 15,
            display: 'grid',
            gap: 11,
          }}
        >
          <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#fff' }}>
            {t('rating.sampleThresholdTitle')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
            <div style={{ padding: '11px 12px', borderRadius: 8, background: '#101927', border: '1px solid #22304A', display: 'grid', gap: 4 }}>
              <span style={{ font: "600 10px/1 'IBM Plex Mono', monospace", padding: '4px 6px', borderRadius: 4, background: 'rgba(214,59,43,.18)', color: '#F09A8E', justifySelf: 'start' }}>
                R1 ●○○○
              </span>
              <span style={{ font: "600 15px/1.2 'IBM Plex Sans', sans-serif", color: '#fff' }}>{t('rating.r1Matches')}</span>
              <span style={{ font: "400 11.5px/1.4 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                {t('rating.r1Rule')}
              </span>
            </div>

            <div style={{ padding: '11px 12px', borderRadius: 8, background: '#101927', border: '1px solid #22304A', display: 'grid', gap: 4 }}>
              <span style={{ font: "600 10px/1 'IBM Plex Mono', monospace", padding: '4px 6px', borderRadius: 4, background: 'rgba(240,183,92,.16)', color: '#F0B75C', justifySelf: 'start' }}>
                R2 ●●○○
              </span>
              <span style={{ font: "600 15px/1.2 'IBM Plex Sans', sans-serif", color: '#fff' }}>{t('rating.r2Matches')}</span>
              <span style={{ font: "400 11.5px/1.4 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                {t('rating.r2Rule')}
              </span>
            </div>

            <div style={{ padding: '11px 12px', borderRadius: 8, background: '#101927', border: '1px solid #22304A', display: 'grid', gap: 4 }}>
              <span style={{ font: "600 10px/1 'IBM Plex Mono', monospace", padding: '4px 6px', borderRadius: 4, background: 'rgba(0,178,169,.16)', color: '#5FDBD3', justifySelf: 'start' }}>
                R3 ●●●○
              </span>
              <span style={{ font: "600 15px/1.2 'IBM Plex Sans', sans-serif", color: '#fff' }}>{t('rating.r3Matches')}</span>
              <span style={{ font: "400 11.5px/1.4 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                {t('rating.r3Rule')}
              </span>
            </div>

            <div style={{ padding: '11px 12px', borderRadius: 8, background: '#101927', border: '1px solid #00786F', display: 'grid', gap: 4 }}>
              <span style={{ font: "600 10px/1 'IBM Plex Mono', monospace", padding: '4px 6px', borderRadius: 4, background: 'rgba(0,178,169,.16)', color: '#5FDBD3', justifySelf: 'start' }}>
                R4 ●●●●
              </span>
              <span style={{ font: "600 15px/1.2 'IBM Plex Sans', sans-serif", color: '#fff' }}>{t('rating.r4Matches')}</span>
              <span style={{ font: "400 11.5px/1.4 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                {t('rating.r4Rule')}
              </span>
            </div>
          </div>
        </div>

        {/* Khối 4: Đầu vào công thức */}
        <div
          style={{
            background: '#141D2E',
            border: '1px solid #2E3E5C',
            borderRadius: 10,
            padding: 15,
            display: 'grid',
            gap: 11,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <span style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", flex: 1, color: '#fff' }}>
              {t('rating.formulaInputsTitle')}
            </span>
            <span
              style={{
                font: "600 10px/1 'IBM Plex Mono', monospace",
                padding: '4px 7px',
                borderRadius: 999,
                background: 'rgba(148,164,186,.16)',
                border: '1px solid #2E3E5C',
                color: '#A8B7CB',
              }}
            >
              {t('rating.formulaInputsAdminOnly')}
            </span>
          </div>
          <div style={{ font: "400 12.5px/1.55 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
            {t('rating.formulaInputsDesc')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
            <div style={{ padding: '11px 12px', borderRadius: 8, background: '#101927', border: '1px solid #22304A', display: 'grid', gap: 4 }}>
              <span style={{ font: "400 11.5px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>{t('rating.rawSynergy')}</span>
              <span style={{ font: "400 16px/1.2 'IBM Plex Mono', monospace", color: '#E9EFF7' }}>+70</span>
              <span style={{ font: "400 11px/1.4 'IBM Plex Sans', sans-serif", color: '#5B6B81' }}>Minh · Nam</span>
            </div>
            <div style={{ padding: '11px 12px', borderRadius: 8, background: '#101927', border: '1px solid #22304A', display: 'grid', gap: 4 }}>
              <span style={{ font: "400 11.5px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>{t('rating.pairStrength')}</span>
              <span style={{ font: "400 16px/1.2 'IBM Plex Mono', monospace", color: '#E9EFF7' }}>1752 → 1822</span>
              <span style={{ font: "400 11px/1.4 'IBM Plex Sans', sans-serif", color: '#5B6B81' }}>{t('rating.expectedToActual')}</span>
            </div>
            <div style={{ padding: '11px 12px', borderRadius: 8, background: '#101927', border: '1px solid #22304A', display: 'grid', gap: 4 }}>
              <span style={{ font: "400 11.5px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>{t('rating.synergyConvert')}</span>
              <span style={{ font: "400 16px/1.2 'IBM Plex Mono', monospace", color: '#E9EFF7' }}>×1.85</span>
              <span style={{ font: "400 11px/1.4 'IBM Plex Sans', sans-serif", color: '#5B6B81' }}>{t('rating.rawToSynergy91')}</span>
            </div>
            <div style={{ padding: '11px 12px', borderRadius: 8, background: '#101927', border: '1px solid #22304A', display: 'grid', gap: 4 }}>
              <span style={{ font: "400 11.5px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>{t('rating.impactDisplay')}</span>
              <span style={{ font: "400 16px/1.2 'IBM Plex Mono', monospace", color: '#5FDBD3' }}>+17pp</span>
              <span style={{ font: "400 11px/1.4 'IBM Plex Sans', sans-serif", color: '#5B6B81' }}>55% → 72%</span>
            </div>
          </div>
        </div>

        {/* Khối 5: Chưa bật */}
        <div
          style={{
            background: '#101927',
            border: '1px solid #22304A',
            borderRadius: 10,
            padding: 14,
            display: 'grid',
            gap: 9,
          }}
        >
          <div style={{ font: "600 13px/1.3 'IBM Plex Sans', sans-serif", color: '#fff' }}>
            {t('rating.notEnabledTitle')}
          </div>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <span style={{ font: "400 12px/1.3 'IBM Plex Mono', monospace", color: '#8494AA', padding: '6px 10px', borderRadius: 6, background: '#0B1220', border: '1px solid #22304A' }}>
              {t('rating.disabledGlicko')}
            </span>
            <span style={{ font: "400 12px/1.3 'IBM Plex Mono', monospace", color: '#8494AA', padding: '6px 10px', borderRadius: 6, background: '#0B1220', border: '1px solid #22304A' }}>
              {t('rating.disabledTrueSkill')}
            </span>
            <span style={{ font: "400 12px/1.3 'IBM Plex Mono', monospace", color: '#8494AA', padding: '6px 10px', borderRadius: 6, background: '#0B1220', border: '1px solid #22304A' }}>
              {t('rating.disabledGenderElo')}
            </span>
          </div>
          <div style={{ font: "400 12px/1.5 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
            {t('rating.notEnabledNote', { count: totalMatches })}
          </div>
        </div>
      </div>
    </div>
  )
}
