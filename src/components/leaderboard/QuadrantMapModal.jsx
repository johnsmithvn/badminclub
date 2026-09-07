import { useMemo } from 'react'
import { t } from '#i18n'

export default function QuadrantMapModal({
  leaderboardRows = [],
  medianElo = 1596,
  seasonName = '',
  onClose,
  onSelectMember,
}) {
  // Chuẩn hóa vị trí các điểm (x, y) theo phần trăm
  // Trục ngang (X): Elo career — medianElo nằm ở giữa (50%)
  // Trục dọc (Y): Điểm mùa (Season Points) — phân chia ở 50%, điểm cao nằm trên (top: 12%..48%)
  const plotData = useMemo(() => {
    const rows = (leaderboardRows && leaderboardRows.length > 0) ? leaderboardRows : []
    if (!rows.length) {
      // 10 VĐV mẫu chuẩn xác theo bản thiết kế bàn giao SS4 (Handoff Desktop 1440)
      return [
        { id: 'sample-1', name: 'Kiên', rating: 1780, displayRating: 1780, totalSeasonPoints: 580, xPct: 80, yPct: 12, isTop: true, isSample: true }, // i18n-ok: sample data
        { id: 'sample-2', name: 'Hằng', rating: 1640, displayRating: 1640, totalSeasonPoints: 490, xPct: 56, yPct: 18, color: '#7AA3DC', isSample: true }, // i18n-ok: sample data
        { id: 'sample-3', name: 'Long', rating: 1850, displayRating: 1850, totalSeasonPoints: 410, xPct: 90, yPct: 30, color: '#00B2A9', isSample: true },
        { id: 'sample-4', name: 'Tú', rating: 1680, displayRating: 1680, totalSeasonPoints: 340, xPct: 66, yPct: 44, color: '#00786F', isSample: true }, // i18n-ok: sample data
        { id: 'sample-5', name: 'Huy', rating: 1750, displayRating: 1750, totalSeasonPoints: 210, xPct: 78, yPct: 56, color: '#B0562A', isSample: true },
        { id: 'sample-6', name: 'Linh', rating: 1480, displayRating: 1480, totalSeasonPoints: 390, xPct: 30, yPct: 34, color: '#7A3D8F', isSample: true },
        { id: 'sample-7', name: 'Vy', rating: 1420, displayRating: 1420, totalSeasonPoints: 270, xPct: 22, yPct: 52, isProvisional: true, isSample: true },
        { id: 'sample-8', name: 'Nam', rating: 1510, displayRating: 1510, totalSeasonPoints: 120, xPct: 34, yPct: 76, color: '#64748B', isSample: true },
        { id: 'sample-9', name: 'Bảo', rating: 1390, displayRating: 1390, totalSeasonPoints: 70, xPct: 14, yPct: 86, isProvisional: true, isSample: true }, // i18n-ok: sample data
        { id: 'sample-10', name: 'Thắng', rating: 1660, displayRating: 1660, totalSeasonPoints: 90, xPct: 62, yPct: 82, color: '#64748B', isSample: true }, // i18n-ok: sample data
      ]
    }

    const allRatings = rows.map((r) => r.displayRating || r.rating || 1500)
    const minRating = Math.min(...allRatings)
    const maxRating = Math.max(...allRatings)
    const medElo = medianElo || Math.round((minRating + maxRating) / 2) || 1500

    const allPts = rows.map((r) => r.totalSeasonPoints || 0)
    const maxPts = Math.max(...allPts, 1)
    const minPts = Math.min(...allPts, 0)
    const sortedPts = [...allPts].sort((a, b) => a - b)
    const midPtsIdx = Math.floor(sortedPts.length / 2)
    const medPts = sortedPts[midPtsIdx] > 0 ? sortedPts[midPtsIdx] : Math.max(1, Math.round(maxPts * 0.4))

    return rows.map((r, idx) => {
      const elo = r.displayRating || r.rating || 1500
      const pts = r.totalSeasonPoints || 0

      // Trục hoành (Elo career): medElo ở chính giữa (50%)
      let xPct = 50
      if (elo < medElo) {
        const span = Math.max(10, medElo - minRating)
        xPct = 48 - Math.min(36, Math.max(0, ((medElo - elo) / span) * 36))
      } else if (elo > medElo) {
        const span = Math.max(10, maxRating - medElo)
        xPct = 52 + Math.min(36, Math.max(0, ((elo - medElo) / span) * 36))
      }

      // Trục tung (Điểm mùa): medPts ở chính giữa (50%), điểm cao hơn -> top bé hơn (nằm trên)
      let yPct = 50
      if (pts >= medPts) {
        const span = Math.max(1, maxPts - medPts)
        yPct = 48 - Math.min(36, Math.max(0, ((pts - medPts) / span) * 36))
      } else {
        const span = Math.max(1, medPts - minPts)
        yPct = 52 + Math.min(36, Math.max(0, ((medPts - pts) / span) * 36))
      }

      return {
        ...r,
        xPct: Math.round(xPct),
        yPct: Math.round(yPct),
        isTop: idx === 0 && pts > 0,
        isProvisional: r.isProvisional || (r.gamesCount !== undefined && r.gamesCount < 5),
      }
    })
  }, [leaderboardRows, medianElo])

  // Lấy các thành viên thực tế trong góc Phải - Dưới (Trụ cột vắng) và Trái - Trên (Đang lên)
  const bottomRightPlayers = useMemo(() => {
    return plotData.filter((p) => p.xPct > 50 && p.yPct >= 50).slice(0, 2)
  }, [plotData])

  const topLeftPlayers = useMemo(() => {
    return plotData.filter((p) => p.xPct <= 50 && p.yPct < 50).slice(0, 2)
  }, [plotData])

  const brNames = bottomRightPlayers.map((p) => p.name ? p.name.split(' ').pop() : '').filter(Boolean).join(' và ') || 'Huy và Thắng' // i18n-ok: fallback names
  const tlNames = topLeftPlayers.map((p) => p.name ? p.name.split(' ').pop() : '').filter(Boolean).join(' và ') || 'Linh và Vy' // i18n-ok: fallback names

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
            {seasonName ? t('season.mapTitleWithSeason', { season: seasonName }) : t('season.mapTitle')}
          </div>
          <div style={{ font: "400 12px/1.4 'IBM Plex Mono', monospace", color: '#8494AA' }}>
            {t('season.mapAxes')}
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
            height: 400,
            border: '1px solid #22304A',
            borderRadius: 10,
            background: '#141D2E',
            overflow: 'hidden',
          }}
        >
          {/* Trục hoành & Trục tung phân chia 4 góc */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: '#2E3E5C' }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: '#2E3E5C' }} />

          {/* 4 Nhãn góc */}
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
            {t('season.quadrantRising')}
            <span
              style={{
                display: 'block',
                font: "400 11px/1.3 'IBM Plex Sans', sans-serif",
                letterSpacing: 0,
                textTransform: 'none',
                color: '#8494AA',
              }}
            >
              {t('season.quadrantRisingDesc')}
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
            {t('season.quadrantLeader')}
            <span
              style={{
                display: 'block',
                font: "400 11px/1.3 'IBM Plex Sans', sans-serif",
                letterSpacing: 0,
                textTransform: 'none',
                color: '#8494AA',
              }}
            >
              {t('season.quadrantLeaderDesc')}
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
            {t('season.quadrantHibernating')}
            <span
              style={{
                display: 'block',
                font: "400 11px/1.3 'IBM Plex Sans', sans-serif",
                letterSpacing: 0,
                textTransform: 'none',
                color: '#64748B',
              }}
            >
              {t('season.quadrantHibernatingDesc')}
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
            {t('season.quadrantAbsentPillar')}
            <span
              style={{
                display: 'block',
                font: "400 11px/1.3 'IBM Plex Sans', sans-serif",
                letterSpacing: 0,
                textTransform: 'none',
                color: '#8494AA',
              }}
            >
              {t('season.quadrantAbsentPillarDesc')}
            </span>
          </div>

          {/* Player Points */}
          {plotData.map((p) => {
            const isTop = p.isTop
            const dotColor = isTop
              ? '#F0D26A'
              : p.isProvisional
              ? 'transparent'
              : p.color
              ? p.color
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
                onClick={() => onSelectMember && onSelectMember(p)}
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
                title={`${p.name}: Elo ${p.displayRating || p.rating}, ${t('season.colPoints')} ${p.totalSeasonPoints}`}
              >
                <span
                  style={{
                    width: isTop ? 14 : 12,
                    height: isTop ? 14 : 12,
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
                  {p.name ? p.name.split(' ').pop() : ''} {p.isProvisional ? '⚠' : ''}
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
            Elo {medianElo} ({t('season.medianLabel')})
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
              {t('season.actionBottomRightTitle')}
            </div>
            <div style={{ font: "400 12px/1.5 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
              {t('season.actionBottomRightDescHandoff', { names: brNames })}
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
              {t('season.actionTopLeftTitle')}
            </div>
            <div style={{ font: "400 12px/1.5 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
              {t('season.actionTopLeftDescHandoff', { names: tlNames, median: medianElo || 1600 })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
