import { useMemo } from 'react'
import { t } from '#i18n'

export default function QuadrantMapModal({
  leaderboardRows = [],
  medianElo = 1596,
  seasonName = 'Mùa 3', // i18n-ok: ui
  onClose,
  onSelectMember,
}) {
  // Chuẩn hóa vị trí các điểm (x, y) theo phần trăm // i18n-ok: ui
  // X: Elo career (từ minElo ~1200 đến maxElo ~2000) // i18n-ok: ui
  // Y: Điểm mùa (từ 0 đến maxPoints ~1400) - đảo chiều y (top = điểm cao) // i18n-ok: ui
  const plotData = useMemo(() => {
    if (!leaderboardRows.length) return []
    const maxPts = Math.max(...leaderboardRows.map((r) => r.totalSeasonPoints || 0), 1200)
    const minElo = 1200
    const maxElo = 2000

    return leaderboardRows.map((r) => {
      const elo = r.displayRating || r.rating || 1500
      const pts = r.totalSeasonPoints || 0
      const xPct = Math.min(92, Math.max(8, ((elo - minElo) / (maxElo - minElo)) * 100))
      const yPct = Math.min(90, Math.max(10, 100 - (pts / maxPts) * 85 - 10))

      return {
        ...r,
        xPct,
        yPct,
        isProvisional: r.isProvisional || r.gamesCount < 5,
      }
    })
  }, [leaderboardRows])

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
        data-screen-label="SS4 Ban do bon goc"
        style={{
          width: 700,
          maxWidth: '100%',
          background: '#0B1220',
          border: '1px solid #22304A',
          borderRadius: 12,
          padding: 18,
          display: 'grid',
          gap: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,.60)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ font: '600 17px/1.25 Barlow, sans-serif', color: '#fff' }}>
            {t('season.mapTitle', { season: seasonName }) || `Bản đồ CLB ${seasonName}`} // i18n-ok: ui
          </div>
          <div style={{ font: "400 12px/1.4 'IBM Plex Mono', monospace", color: '#8494AA' }}>
            {t('season.mapAxes') || 'trục ngang Elo career · trục dọc điểm mùa'} // i18n-ok: ui
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

        {/* 2D Quadrant Map */}
        <div
          style={{
            position: 'relative',
            height: 380,
            border: '1px solid #22304A',
            borderRadius: 10,
            background: '#141D2E',
            overflow: 'hidden',
          }}
        >
          {/* Trục hoành & Trục tung phân chia 4 góc */} // i18n-ok: ui
          <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: '#2E3E5C' }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: '#2E3E5C' }} />

          {/* 4 Nhãn góc */} // i18n-ok: ui
          <div
            style={{
              position: 'absolute',
              left: 12,
              top: 10,
              font: "600 11px/1.3 'IBM Plex Sans', sans-serif",
              letterSpacing: '.05em',
              textTransform: 'uppercase',
              color: '#5FDBD3',
            }}
          >
            {t('season.quadrantRising') || 'Đang lên'} // i18n-ok: ui
            <span
              style={{
                display: 'block',
                font: "400 11px/1.3 'IBM Plex Sans', sans-serif",
                letterSpacing: 0,
                textTransform: 'none',
                color: '#8494AA',
              }}
            >
              {t('season.quadrantRisingDesc') || 'đi đều, trình còn thấp'} // i18n-ok: ui
            </span>
          </div>

          <div
            style={{
              position: 'absolute',
              right: 12,
              top: 10,
              textAlign: 'right',
              font: "600 11px/1.3 'IBM Plex Sans', sans-serif",
              letterSpacing: '.05em',
              textTransform: 'uppercase',
              color: '#F0D26A',
            }}
          >
            {t('season.quadrantLeader') || 'Đầu tàu'} // i18n-ok: ui
            <span
              style={{
                display: 'block',
                font: "400 11px/1.3 'IBM Plex Sans', sans-serif",
                letterSpacing: 0,
                textTransform: 'none',
                color: '#8494AA',
              }}
            >
              {t('season.quadrantLeaderDesc') || 'trình cao, có mặt đều'} // i18n-ok: ui
            </span>
          </div>

          <div
            style={{
              position: 'absolute',
              left: 12,
              bottom: 10,
              font: "600 11px/1.3 'IBM Plex Sans', sans-serif",
              letterSpacing: '.05em',
              textTransform: 'uppercase',
              color: '#8494AA',
            }}
          >
            {t('season.quadrantHibernating') || 'Ngủ đông'} // i18n-ok: ui
            <span
              style={{
                display: 'block',
                font: "400 11px/1.3 'IBM Plex Sans', sans-serif",
                letterSpacing: 0,
                textTransform: 'none',
                color: '#64748B',
              }}
            >
              {t('season.quadrantHibernatingDesc') || 'cần rủ đi tập'} // i18n-ok: ui
            </span>
          </div>

          <div
            style={{
              position: 'absolute',
              right: 12,
              bottom: 10,
              textAlign: 'right',
              font: "600 11px/1.3 'IBM Plex Sans', sans-serif",
              letterSpacing: '.05em',
              textTransform: 'uppercase',
              color: '#B6CDEC',
            }}
          >
            {t('season.quadrantAbsentPillar') || 'Trụ cột vắng'} // i18n-ok: ui
            <span
              style={{
                display: 'block',
                font: "400 11px/1.3 'IBM Plex Sans', sans-serif",
                letterSpacing: 0,
                textTransform: 'none',
                color: '#8494AA',
              }}
            >
              {t('season.quadrantAbsentPillarDesc') || 'mạnh nhưng ít ra sân'} // i18n-ok: ui
            </span>
          </div>

          {/* Player Points */}
          {plotData.map((p, idx) => {
            const isTop = idx === 0
            const dotColor = isTop
              ? '#F0D26A'
              : p.isProvisional
              ? 'transparent'
              : p.xPct > 50
              ? p.yPct < 50
                ? '#F0D26A'
                : '#B6CDEC'
              : p.yPct < 50
              ? '#00B2A9'
              : '#64748B'

            return (
              <div
                key={p.id}
                onClick={() => onSelectMember && onSelectMember(p.id)}
                style={{
                  position: 'absolute',
                  left: `${p.xPct}%`,
                  top: `${p.yPct}%`,
                  transform: 'translate(-50%, -50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  zIndex: 10,
                }}
                title={`${p.name}: Elo ${p.displayRating || p.rating}, Điểm mùa ${p.totalSeasonPoints}`} // i18n-ok: ui
              >
                <span
                  style={{
                    width: isTop ? 14 : 11,
                    height: isTop ? 14 : 11,
                    borderRadius: 999,
                    background: dotColor,
                    border: p.isProvisional ? '1.5px dashed #8494AA' : 'none',
                    boxShadow: isTop ? '0 0 0 4px rgba(201,162,39,.20)' : 'none',
                    flex: '0 0 auto',
                  }}
                />
                <span
                  style={{
                    font: "600 11px/1 'IBM Plex Sans', sans-serif",
                    color: isTop ? '#F7E3A1' : p.isProvisional ? '#A8B7CB' : '#E9EFF7',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.name.split(' ').pop()} {p.isProvisional ? '⚠' : ''}
                </span>
              </div>
            )
          })}

          <div
            style={{
              position: 'absolute',
              left: '50%',
              bottom: 4,
              transform: 'translateX(-50%)',
              font: "400 10px/1 'IBM Plex Mono', monospace",
              color: '#64748B',
            }}
          >
            Elo {medianElo} (trung vị) // i18n-ok: ui
          </div>
        </div>

        {/* Actionable Insights Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <div
            style={{
              background: '#141D2E',
              border: '1px solid #22304A',
              borderRadius: 9,
              padding: 12,
              display: 'grid',
              gap: 5,
            }}
          >
            <div style={{ font: "600 12px/1.2 'IBM Plex Sans', sans-serif", color: '#B6CDEC' }}>
              {t('season.actionBottomRight') || 'Việc cần làm · góc phải dưới'} // i18n-ok: ui
            </div>
            <div style={{ font: "400 12px/1.5 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
              {t('season.actionBottomRightDesc') ||
                'Thành viên trình cao nhưng ít đi buổi. Nhắc lịch riêng cho nhóm này để các buổi tối trong tuần đủ người đánh.'} // i18n-ok: ui
            </div>
          </div>

          <div
            style={{
              background: '#141D2E',
              border: '1px solid #22304A',
              borderRadius: 9,
              padding: 12,
              display: 'grid',
              gap: 5,
            }}
          >
            <div style={{ font: "600 12px/1.2 'IBM Plex Sans', sans-serif", color: '#5FDBD3' }}>
              {t('season.actionTopLeft') || 'Việc cần làm · góc trái trên'} // i18n-ok: ui
            </div>
            <div style={{ font: "400 12px/1.5 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
              {t('season.actionTopLeftDesc') ||
                'Thành viên đi đều, phong độ đang lên nhanh. Thử ghép họ với nhóm Elo cao hơn 1 trận mỗi buổi để tăng cọ xát.'} // i18n-ok: ui
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
