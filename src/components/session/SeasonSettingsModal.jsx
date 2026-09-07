import { useState } from 'react'
import { t } from '#i18n'

export default function SeasonSettingsModal({
  season = {
    id: '2026-Q3',
    code: '2026-Q3',
    name: 'Thu Rực Lửa', // i18n-ok: ui
    startDate: '2026-07-01',
    endDate: '2026-09-30',
    cycle: 'quarter',
    pointsConfig: {
      attendance: 30,
      matchPlayed: 10,
      matchWon: 15,
      upsetWon: 25,
      threeSets: 10,
      streakThree: 20,
    },
    provisionalThreshold: 5,
    fullConfidenceThreshold: 30,
    monteCarloCandidates: 80,
  },
  onClose,
  onSaveSeason,
  onEndSeasonEarly,
}) {
  const [editing, setEditing] = useState(false)
  const [seasonName, setSeasonName] = useState(season.name || 'Thu Rực Lửa') // i18n-ok: ui
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
        data-screen-label="CE4 Cai dat mua giai"
        style={{
          width: 760,
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
            {t('season.settingsTitle') || 'Mùa giải & công thức điểm'} // i18n-ok: ui
          </div>
          <div style={{ font: "400 12px/1.4 'IBM Plex Mono', monospace", color: '#8494AA' }}>
            {t('season.adminOnly') || 'chỉ chủ CLB sửa được'} // i18n-ok: ui
          </div>
          <div style={{ flex: '1 1 0%' }} />
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              font: "600 16px/1 'IBM Plex Mono', monospace",
              color: '#8494AA',
            }}
          >
            ✕
          </button>
        </div>

        {/* 2 Top Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          {/* Mùa đang chạy */} // i18n-ok: ui
          <div
            style={{
              background: '#141D2E',
              border: '1px solid #22304A',
              borderRadius: 10,
              padding: 13,
              display: 'grid',
              gap: 9,
            }}
          >
            <div style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
              {t('season.currentRunning') || 'Mùa đang chạy'} // i18n-ok: ui
            </div>
            <div style={{ display: 'grid', gap: 7, font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span>{t('season.code') || 'Mã mùa'}</span> // i18n-ok: ui
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#E9EFF7' }}>{season.code || season.id || '2026-Q3'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span>{t('season.name') || 'Tên'}</span> // i18n-ok: ui
                <span style={{ color: '#E9EFF7' }}>{seasonName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span>{t('season.dateRange') || 'Từ → đến'}</span> // i18n-ok: ui
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#E9EFF7' }}>
                  {startDate} → {endDate}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span>{t('season.cycle') || 'Chu kỳ'}</span> // i18n-ok: ui
                <span style={{ color: '#E9EFF7' }}>{t('season.cycleQuarterly') || 'Theo quý · tự mở mùa mới'}</span> // i18n-ok: ui
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid #22304A', paddingTop: 9 }}>
              <button
                type="button"
                onClick={() => setEditing(!editing)}
                style={{
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  padding: '9px 13px',
                  borderRadius: 6,
                  background: '#1A2437',
                  border: '1px solid #2E3E5C',
                  color: '#E9EFF7',
                  cursor: 'pointer',
                }}
              >
                {editing ? 'Hủy sửa' : t('season.editSeason') || 'Sửa mùa'} // i18n-ok: ui
              </button>
              <button
                type="button"
                onClick={() => onEndSeasonEarly && onEndSeasonEarly()}
                style={{
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  padding: '9px 13px',
                  borderRadius: 6,
                  background: 'rgba(214,59,43,.14)',
                  border: '1px solid #8E2C20',
                  color: '#F1A79D',
                  cursor: 'pointer',
                }}
              >
                {t('season.endSeasonEarly') || 'Kết mùa sớm'} // i18n-ok: ui
              </button>
            </div>
            {editing && (
              <div style={{ display: 'grid', gap: 8, marginTop: 6, borderTop: '1px solid #22304A', paddingTop: 8 }}>
                <input
                  type="text"
                  value={seasonName}
                  onChange={(e) => setSeasonName(e.target.value)}
                  style={{
                    background: '#0B1220',
                    border: '1px solid #2E3E5C',
                    borderRadius: 6,
                    padding: '6px 10px',
                    color: '#fff',
                    font: "400 12px 'IBM Plex Sans', sans-serif",
                  }}
                  placeholder="Tên mùa..." // i18n-ok: ui
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{
                      background: '#0B1220',
                      border: '1px solid #2E3E5C',
                      borderRadius: 6,
                      padding: '6px 10px',
                      color: '#fff',
                      flex: 1,
                      font: "400 12px 'IBM Plex Mono', monospace",
                    }}
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{
                      background: '#0B1220',
                      border: '1px solid #2E3E5C',
                      borderRadius: 6,
                      padding: '6px 10px',
                      color: '#fff',
                      flex: 1,
                      font: "400 12px 'IBM Plex Mono', monospace",
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  style={{
                    background: '#00B2A9',
                    color: '#04302C',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Lưu thay đổi // i18n-ok: ui
                </button>
              </div>
            )}
          </div>

          {/* Khi kết mùa */} // i18n-ok: ui
          <div
            style={{
              background: '#141D2E',
              border: '1px solid #22304A',
              borderRadius: 10,
              padding: 13,
              display: 'grid',
              gap: 9,
            }}
          >
            <div style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
              {t('season.whenEnding') || 'Khi kết mùa'} // i18n-ok: ui
            </div>
            <div style={{ display: 'grid', gap: 8, font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <span style={{ width: 15, height: 15, borderRadius: 4, background: '#00B2A9', flex: '0 0 auto', marginTop: 1 }} />
                <span>{t('season.step1') || 'Chốt bảng, lưu ảnh top 10 vào lịch sử mùa'}</span> // i18n-ok: ui
              </div>
              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <span style={{ width: 15, height: 15, borderRadius: 4, background: '#00B2A9', flex: '0 0 auto', marginTop: 1 }} />
                <span>{t('season.step2') || 'Reset điểm mùa về 0 cho toàn CLB'}</span> // i18n-ok: ui
              </div>
              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <span style={{ width: 15, height: 15, borderRadius: 4, border: '1.5px solid #4A5B76', flex: '0 0 auto', marginTop: 1 }} />
                <span>{t('season.step3') || 'Trao huy chương ảo cho top 3 và giải chuyên cần'}</span> // i18n-ok: ui
              </div>
              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <span style={{ width: 15, height: 15, borderRadius: 4, border: '1.5px solid #4A5B76', flex: '0 0 auto', marginTop: 1 }} />
                <span>{t('season.step4') || 'Gửi tổng kết mùa cho từng thành viên'}</span> // i18n-ok: ui
              </div>
            </div>
            <div
              style={{
                font: "400 12px/1.45 'IBM Plex Sans', sans-serif",
                color: '#F0D26A',
                borderTop: '1px solid #22304A',
                paddingTop: 9,
              }}
            >
              {t('season.eloImmunityNote') || 'Elo career, số trận và lịch sử H2H không bị ảnh hưởng.'} // i18n-ok: ui
            </div>
          </div>
        </div>

        {/* Công thức điểm mùa */} // i18n-ok: ui
        <div style={{ background: '#141D2E', border: '1px solid #22304A', borderRadius: 10, overflow: 'hidden' }}>
          <div
            style={{
              padding: '10px 13px',
              borderBottom: '1px solid #22304A',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
              {t('season.formulaTitle') || 'Công thức điểm mùa'} // i18n-ok: ui
            </span>
            <div style={{ flex: '1 1 0%' }} />
            <span style={{ font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
              {t('season.applyNextNotice') || 'sửa xong áp dụng từ buổi kế tiếp'} // i18n-ok: ui
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 96px 132px',
              padding: '8px 13px',
              borderBottom: '1px solid #22304A',
              font: "600 11px/1.2 'IBM Plex Sans', sans-serif",
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: '#8494AA',
            }}
          >
            <span>{t('season.action') || 'Hành động'}</span> // i18n-ok: ui
            <span style={{ textAlign: 'right' }}>{t('season.points') || 'Điểm'}</span> // i18n-ok: ui
            <span style={{ textAlign: 'right' }}>{t('season.thisSeason') || 'Mùa này'}</span> // i18n-ok: ui
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 96px 132px', alignItems: 'center', padding: '9px 13px', borderBottom: '1px solid rgba(34,48,74,.6)', font: "400 13px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
            <span>{t('season.actAttendance') || 'Tham gia buổi'}</span> // i18n-ok: ui
            <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#5FDBD3' }}>+30</span>
            <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#8494AA' }}>7.980 pts</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 96px 132px', alignItems: 'center', padding: '9px 13px', borderBottom: '1px solid rgba(34,48,74,.6)', font: "400 13px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
            <span>{t('season.actMatchPlay') || 'Mỗi trận ra sân'}</span> // i18n-ok: ui
            <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#5FDBD3' }}>+10</span>
            <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#8494AA' }}>6.340 pts</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 96px 132px', alignItems: 'center', padding: '9px 13px', borderBottom: '1px solid rgba(34,48,74,.6)', font: "400 13px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
            <span>{t('season.actWin') || 'Thắng trận'}</span> // i18n-ok: ui
            <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#5FDBD3' }}>+15</span>
            <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#8494AA' }}>5.160 pts</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 96px 132px', alignItems: 'center', padding: '9px 13px', borderBottom: '1px solid rgba(34,48,74,.6)', font: "400 13px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
            <span>{t('season.actUpset') || 'Thắng đối thủ Elo cao hơn · upset'}</span> // i18n-ok: ui
            <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#F0D26A' }}>+25</span>
            <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#8494AA' }}>2.100 pts</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 96px 132px', alignItems: 'center', padding: '9px 13px', borderBottom: '1px solid rgba(34,48,74,.6)', font: "400 13px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
            <span>{t('season.actThreeSets') || 'Trận 3 set kịch tính'}</span> // i18n-ok: ui
            <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#5FDBD3' }}>+10</span>
            <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#8494AA' }}>1.170 pts</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 96px 132px', alignItems: 'center', padding: '9px 13px', font: "400 13px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
            <span>{t('season.actStreakThree') || 'Chuỗi 3 trận thắng liên tiếp'}</span> // i18n-ok: ui
            <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#5FDBD3' }}>+20</span>
            <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#8494AA' }}>700 pts</span>
          </div>
        </div>

        {/* Ngưỡng thẩm định & co Elo */} // i18n-ok: ui
        <div style={{ background: '#1A2437', border: '1px solid #2E3E5C', borderRadius: 10, padding: 13, display: 'grid', gap: 9 }}>
          <div style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
            {t('season.thresholdsTitle') || 'Ngưỡng thẩm định & co Elo'} // i18n-ok: ui
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={{ font: "400 12px/1.2 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                {t('season.officialReq') || 'Đủ trận vào bảng chính thức'} // i18n-ok: ui
              </span>
              <span style={{ font: "600 20px/1 'IBM Plex Mono', monospace", color: '#E9EFF7' }}>
                {season.provisionalThreshold || 5}
              </span>
            </div>
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={{ font: "400 12px/1.2 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                {t('season.fullEloReq') || 'Dùng Elo nguyên 100% từ'} // i18n-ok: ui
              </span>
              <span style={{ font: "600 20px/1 'IBM Plex Mono', monospace", color: '#E9EFF7' }}>
                {season.fullConfidenceThreshold || 30}
              </span>
            </div>
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={{ font: "400 12px/1.2 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                {t('season.candidatesCount') || 'Số phương án máy dò'} // i18n-ok: ui
              </span>
              <span style={{ font: "600 20px/1 'IBM Plex Mono', monospace", color: '#E9EFF7' }}>
                {season.monteCarloCandidates || 80}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
