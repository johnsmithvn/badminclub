import { useState } from 'react'
import { t } from '#i18n'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { Avatar } from '#ds'

export default function SeasonSettingsModal({
  season = {
    id: '2026-Q3',
    code: '2026-Q3',
    name: '',
    startDate: '2026-07-01',
    endDate: '2026-09-30',
    cycle: 'quarter',
    minMatchesOfficial: 8,
    inactiveDays: 21,
    bonusConfig: { streak3: 5, streak5: 10, upset150: 5 },
    provisionalThreshold: 5,
    fullConfidenceThreshold: 30,
    monteCarloCandidates: 80,
  },
  topPodium = [],
  onClose,
  onSaveSeason,
  onEndSeasonEarly,
}) {
  const { isDark } = useTheme()
  const [editing, setEditing] = useState(false)
  const [confirmingEnd, setConfirmingEnd] = useState(false)
  const [seasonName, setSeasonName] = useState(season.name || '')
  const [startDate, setStartDate] = useState(season.startDate || '2026-07-01')
  const [endDate, setEndDate] = useState(season.endDate || '2026-09-30')

  // Gợi ý thông tin mùa tiếp theo
  const currentCode = season.code || season.id || '2026-Q3'
  let defaultNextCode = '2026-Q4'
  let defaultNextStart = '2026-10-01'
  let defaultNextEnd = '2026-12-31'
  let defaultNextName = 'Đông Quyết Chiến' // i18n-ok: default season name fallback

  if (currentCode.includes('-Q')) {
    const parts = currentCode.split('-Q')
    const year = parseInt(parts[0], 10)
    const q = parseInt(parts[1], 10)
    if (q === 4) {
      defaultNextCode = `${year + 1}-Q1`
      defaultNextStart = `${year + 1}-01-01`
      defaultNextEnd = `${year + 1}-03-31`
      defaultNextName = 'Xuân Bứt Phá' // i18n-ok: default season name fallback
    } else if (q >= 1 && q <= 3) {
      defaultNextCode = `${year}-Q${q + 1}`
      const startMonths = { 2: '04-01', 3: '07-01', 4: '10-01' }
      const endMonths = { 2: '06-30', 3: '09-30', 4: '12-31' }
      const names = { 2: 'Hè Rực Cháy', 3: 'Thu Rực Lửa', 4: 'Đông Quyết Chiến' } // i18n-ok: default season name fallback
      defaultNextStart = `${year}-${startMonths[q + 1]}`
      defaultNextEnd = `${year}-${endMonths[q + 1]}`
      defaultNextName = names[q + 1] || `Mùa ${q + 1}` // i18n-ok: default season name fallback
    }
  }

  const [nextCode, setNextCode] = useState(defaultNextCode)
  const [nextName, setNextName] = useState(defaultNextName)
  const [nextStart, setNextStart] = useState(defaultNextStart)
  const [nextEnd, setNextEnd] = useState(defaultNextEnd)

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

  const handleConfirmEndSeason = () => {
    if (onEndSeasonEarly) {
      onEndSeasonEarly({
        oldSeasonId: season.id || season.code,
        newSeasonData: {
          code: nextCode,
          name: nextName,
          fullName: `${nextCode} — ${nextName}`,
          startDate: nextStart,
          endDate: nextEnd,
        },
        podiumSnapshot: topPodium,
      })
    }
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

        {confirmingEnd ? (
          <div style={{ display: 'grid', gap: 14 }}>
            {/* Banner cảnh báo */}
            <div
              style={{
                background: isDark ? 'rgba(214,59,43,.12)' : 'rgba(214,59,43,.08)',
                border: '1px solid #D63B2B',
                borderRadius: 10,
                padding: 14,
                display: 'grid',
                gap: 8,
              }}
            >
              <div style={{ font: "600 15px/1.3 'IBM Plex Sans', sans-serif", color: isDark ? '#F1A79D' : '#DC2626' }}>
                {t('season.endSeasonModalTitle')}
              </div>
              <div style={{ font: "400 13px/1.45 'IBM Plex Sans', sans-serif", color: 'var(--text-secondary)' }}>
                {t('season.endSeasonConfirmDesc')}
              </div>
            </div>

            {/* Podium Top 3 xem trước */}
            {topPodium && topPodium.length > 0 && (
              <div
                style={{
                  background: 'var(--surface-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  padding: 13,
                  display: 'grid',
                  gap: 10,
                }}
              >
                <div style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                  🏆 {t('season.podiumPreviewTitle')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                  {topPodium.slice(0, 3).map((p, idx) => {
                    const colors = [
                      { bg: 'rgba(255,215,0,.15)', border: '#FFD700', label: t('season.podiumTop1') },
                      { bg: 'rgba(192,192,192,.15)', border: '#C0C0C0', label: t('season.podiumTop2') },
                      { bg: 'rgba(205,127,50,.15)', border: '#CD7F32', label: t('season.podiumTop3') },
                    ]
                    const col = colors[idx] || colors[0]
                    return (
                      <div
                        key={p.memberId || idx}
                        style={{
                          background: col.bg,
                          border: `1px solid ${col.border}`,
                          borderRadius: 8,
                          padding: 10,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <Avatar name={p.name} url={p.avatarUrl} size={36} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ font: "600 11px/1 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                            {col.label}
                          </div>
                          <div style={{ font: "600 13px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name}
                          </div>
                          <div style={{ font: "700 13px/1 'IBM Plex Mono', monospace", color: 'var(--teal-600)' }}>
                            {p.points || 0} pts
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Form Thiết lập Mùa Mới */}
            <div
              style={{
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                padding: 13,
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                ⚡ {t('season.newSeasonSectionTitle')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr)', gap: 10 }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <label style={{ font: "500 11px 'IBM Plex Sans', sans-serif", color: 'var(--text-secondary)' }}>
                    {t('season.newSeasonCode')}
                  </label>
                  <input
                    type="text"
                    value={nextCode}
                    onChange={(e) => setNextCode(e.target.value)}
                    style={{
                      background: 'var(--field-bg)',
                      border: '1px solid var(--field-border)',
                      borderRadius: 6,
                      padding: '7px 10px',
                      color: 'var(--text-primary)',
                      font: "600 12px 'IBM Plex Mono', monospace",
                    }}
                  />
                </div>
                <div style={{ display: 'grid', gap: 4 }}>
                  <label style={{ font: "500 11px 'IBM Plex Sans', sans-serif", color: 'var(--text-secondary)' }}>
                    {t('season.newSeasonName')}
                  </label>
                  <input
                    type="text"
                    value={nextName}
                    onChange={(e) => setNextName(e.target.value)}
                    style={{
                      background: 'var(--field-bg)',
                      border: '1px solid var(--field-border)',
                      borderRadius: 6,
                      padding: '7px 10px',
                      color: 'var(--text-primary)',
                      font: "600 12px 'IBM Plex Sans', sans-serif",
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <label style={{ font: "500 11px 'IBM Plex Sans', sans-serif", color: 'var(--text-secondary)' }}>
                    {t('season.newSeasonStart')}
                  </label>
                  <input
                    type="date"
                    value={nextStart}
                    onChange={(e) => setNextStart(e.target.value)}
                    style={{
                      background: 'var(--field-bg)',
                      border: '1px solid var(--field-border)',
                      borderRadius: 6,
                      padding: '7px 10px',
                      color: 'var(--text-primary)',
                      font: "500 12px 'IBM Plex Mono', monospace",
                    }}
                  />
                </div>
                <div style={{ display: 'grid', gap: 4 }}>
                  <label style={{ font: "500 11px 'IBM Plex Sans', sans-serif", color: 'var(--text-secondary)' }}>
                    {t('season.newSeasonEnd')}
                  </label>
                  <input
                    type="date"
                    value={nextEnd}
                    onChange={(e) => setNextEnd(e.target.value)}
                    style={{
                      background: 'var(--field-bg)',
                      border: '1px solid var(--field-border)',
                      borderRadius: 6,
                      padding: '7px 10px',
                      color: 'var(--text-primary)',
                      font: "500 12px 'IBM Plex Mono', monospace",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Nút hành động xác nhận */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setConfirmingEnd(false)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 6,
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmEndSeason}
                style={{
                  padding: '9px 18px',
                  borderRadius: 6,
                  background: '#D63B2B',
                  border: 'none',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 6px rgba(214,59,43,.35)',
                }}
              >
                ✓ {t('season.confirmEndAndStartBtn')}
              </button>
            </div>
          </div>
        ) : (
          <>
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
                    onClick={() => setConfirmingEnd(true)}
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
          </>
        )}
      </div>
    </div>
  )
}
