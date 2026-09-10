import { useState } from 'react'
import { t } from '#i18n'
import { useTheme } from '#contexts/ThemeContext.jsx'

export default function SeasonSettingsModal({
  season = {
    id: '2026-Q3',
    code: '2026-Q3',
    name: '',
    startDate: '2026-07-01',
    endDate: '2026-09-30',
    cycle: 'quarter',
    minMatchesOfficial: 20,
    inactiveDays: 21,
    bonusConfig: { streak3: 5, streak5: 10, upset150: 5 },
    provisionalThreshold: 5,
    fullConfidenceThreshold: 30,
    monteCarloCandidates: 80,
  },
  onClose,
  onSaveSeason,
  onEndSeasonEarly,
}) {
  const { isDark } = useTheme()
  const [editing, setEditing] = useState(false)
  const [seasonName, setSeasonName] = useState(season.name || '')
  const [startDate, setStartDate] = useState(season.startDate || '2026-07-01')
  const [endDate, setEndDate] = useState(season.endDate || '2026-09-30')

  const handleSave = () => {
    if (onSaveSeason) {
      onSaveSeason({
        ...season,
        name: seasonName,
        startDate,
        endDate,
      })
    }
    setEditing(false)
  }

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
        data-screen-label="CE4 Cai dat mua giai"
        style={{
          width: 760,
          maxWidth: '100%',
          background: 'var(--surface-overlay)',
          border: '1px solid var(--border-default)',
          borderRadius: 12,
          padding: 20,
          display: 'grid',
          gap: 14,
          boxShadow: 'var(--shadow-overlay)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ font: '600 18px/1.25 Barlow, sans-serif', color: 'var(--text-primary)' }}>
            {t('season.settingsTitle')}
          </div>
          <div style={{ font: "400 12px/1.4 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
            {t('season.adminOnly')}
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
              color: 'var(--text-muted)',
            }}
          >
            ✕
          </button>
        </div>

        {/* 2 Top Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          {/* Mùa đang chạy */}
          <div
            style={{
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
              padding: 13,
              display: 'grid',
              gap: 9,
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            <div style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
              {t('season.currentRunning')}
            </div>
            <div style={{ display: 'grid', gap: 7, font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span>{t('season.code')}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-primary)', fontWeight: 600 }}>{season.code || season.id || '2026-Q3'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span>{t('season.name')}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{seasonName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span>{t('season.dateRange')}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                  {startDate} → {endDate}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span>{t('season.cycle')}</span>
                <span style={{ color: 'var(--text-primary)' }}>{t('season.cycleQuarterly')}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--border-subtle)', paddingTop: 9 }}>
              <button
                type="button"
                onClick={() => setEditing(!editing)}
                style={{
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  padding: '9px 13px',
                  borderRadius: 6,
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {editing ? t('season.cancelEdit') : t('season.editSeason')}
              </button>
              <button
                type="button"
                onClick={() => onEndSeasonEarly && onEndSeasonEarly()}
                style={{
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  padding: '9px 13px',
                  borderRadius: 6,
                  background: isDark ? 'rgba(214,59,43,.14)' : 'rgba(214,59,43,.10)',
                  border: '1px solid #D63B2B',
                  color: isDark ? '#F1A79D' : '#DC2626',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {t('season.endSeasonEarly')}
              </button>
            </div>
            {editing && (
              <div style={{ display: 'grid', gap: 8, marginTop: 6, borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
                <input
                  type="text"
                  value={seasonName}
                  onChange={(e) => setSeasonName(e.target.value)}
                  style={{
                    background: 'var(--field-bg)',
                    border: '1px solid var(--field-border)',
                    borderRadius: 6,
                    padding: '6px 10px',
                    color: 'var(--text-primary)',
                    font: "400 12px 'IBM Plex Sans', sans-serif",
                  }}
                  placeholder={t('season.seasonNamePlaceholder')}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{
                      background: 'var(--field-bg)',
                      border: '1px solid var(--field-border)',
                      borderRadius: 6,
                      padding: '6px 10px',
                      color: 'var(--text-primary)',
                      flex: 1,
                      font: "400 12px 'IBM Plex Mono', monospace",
                    }}
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{
                      background: 'var(--field-bg)',
                      border: '1px solid var(--field-border)',
                      borderRadius: 6,
                      padding: '6px 10px',
                      color: 'var(--text-primary)',
                      flex: 1,
                      font: "400 12px 'IBM Plex Mono', monospace",
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  style={{
                    background: 'var(--teal-500)',
                    color: '#04302C',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t('common.saveChanges')}
                </button>
              </div>
            )}
          </div>

          {/* Khi kết mùa */}
          <div
            style={{
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
              padding: 13,
              display: 'grid',
              gap: 9,
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            <div style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
              {t('season.whenEnding')}
            </div>
            <div style={{ display: 'grid', gap: 8, font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <span style={{ width: 15, height: 15, borderRadius: 4, background: '#00B2A9', flex: '0 0 auto', marginTop: 1 }} />
                <span>{t('season.step1')}</span>
              </div>
              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <span style={{ width: 15, height: 15, borderRadius: 4, background: '#00B2A9', flex: '0 0 auto', marginTop: 1 }} />
                <span>{t('season.step2')}</span>
              </div>
              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <span style={{ width: 15, height: 15, borderRadius: 4, border: '1.5px solid var(--border-default)', flex: '0 0 auto', marginTop: 1 }} />
                <span>{t('season.step3')}</span>
              </div>
              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <span style={{ width: 15, height: 15, borderRadius: 4, border: '1.5px solid var(--border-default)', flex: '0 0 auto', marginTop: 1 }} />
                <span>{t('season.step4')}</span>
              </div>
            </div>
            <div
              style={{
                font: "400 12px/1.45 'IBM Plex Sans', sans-serif",
                color: isDark ? '#F0D26A' : '#B45309',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: 9,
              }}
            >
              {t('season.eloImmunityNote')}
            </div>
          </div>
        </div>

        {/* Công thức điểm mùa */}
        <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }}>
          <div
            style={{
              padding: '10px 13px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
              {t('season.formulaTitle')}
            </span>
            <div style={{ flex: '1 1 0%' }} />
            <span style={{ font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
              {t('season.applyNextNotice')}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 110px 110px',
              padding: '8px 13px',
              borderBottom: '1px solid var(--border-subtle)',
              font: "600 11px/1.2 'IBM Plex Sans', sans-serif",
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            <span>{t('season.tierCol')}</span>
            <span style={{ textAlign: 'right' }}>{t('season.winDeltaCol')}</span>
            <span style={{ textAlign: 'right' }}>{t('season.lossDeltaCol')}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 110px 110px', alignItems: 'center', padding: '9px 13px', borderBottom: '1px solid var(--border-subtle)', font: "400 13px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
            <span>{t('season.tierHeavyFavored')}</span>
            <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: isDark ? '#5FDBD3' : 'var(--teal-700)', fontWeight: 600 }}>+10</span>
            <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#DC2626' }}>-12</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 110px 110px', alignItems: 'center', padding: '9px 13px', borderBottom: '1px solid var(--border-subtle)', font: "400 13px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
            <span>{t('season.tierFavored')}</span>
            <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: isDark ? '#5FDBD3' : 'var(--teal-700)', fontWeight: 600 }}>+12</span>
            <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#DC2626' }}>-10</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 110px 110px', alignItems: 'center', padding: '9px 13px', borderBottom: '1px solid var(--border-subtle)', font: "600 13px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', background: isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)' }}>
            <span>{t('season.tierBalanced')}</span>
            <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: isDark ? '#5FDBD3' : 'var(--teal-700)', fontWeight: 700 }}>+14</span>
            <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#DC2626' }}>-8</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 110px 110px', alignItems: 'center', padding: '9px 13px', borderBottom: '1px solid var(--border-subtle)', font: "400 13px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
            <span>{t('season.tierUnderdog')}</span>
            <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: isDark ? '#5FDBD3' : 'var(--teal-700)', fontWeight: 600 }}>+17</span>
            <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#DC2626' }}>-5</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 110px 110px', alignItems: 'center', padding: '9px 13px', borderBottom: '1px solid var(--border-subtle)', font: "400 13px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
            <span>{t('season.tierDeepUnderdog')}</span>
            <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: isDark ? '#5FDBD3' : 'var(--teal-700)', fontWeight: 600 }}>+22</span>
            <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#DC2626' }}>-3</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', alignItems: 'center', padding: '9px 13px', borderBottom: '1px solid var(--border-subtle)', font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-secondary)' }}>
            <span>{t('season.ruleStreakMilestone')}</span>
            <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: isDark ? '#F0D26A' : '#B45309', fontWeight: 600 }}>+5 / +10 pts</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', alignItems: 'center', padding: '9px 13px', font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-secondary)' }}>
            <span>{t('season.ruleUpsetMilestone')}</span>
            <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: isDark ? '#F0D26A' : '#B45309', fontWeight: 600 }}>+5 pts</span>
          </div>
        </div>

        {/* Ngưỡng thẩm định & co Elo */}
        <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 13, display: 'grid', gap: 9, boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
            {t('season.thresholdsTitle')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={{ font: "400 12px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                {t('season.officialReq')}
              </span>
              <span style={{ font: "600 20px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                {season.provisionalThreshold || 5}
              </span>
            </div>
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={{ font: "400 12px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                {t('season.fullEloReq')}
              </span>
              <span style={{ font: "600 20px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                {season.fullConfidenceThreshold || 30}
              </span>
            </div>
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={{ font: "400 12px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                {t('season.candidatesCount')}
              </span>
              <span style={{ font: "600 20px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                {season.monteCarloCandidates || 80}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
