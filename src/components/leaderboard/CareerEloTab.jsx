import { useState, useMemo } from 'react'
import { t } from '#i18n'
import { getPlayerRating, effectiveStrengthOf, isProvisional } from '#lib/rating.js'

export default function CareerEloTab({
  db,
  members = [],
  playerRatings = {},
  matches = [],
  levels = {},
  onOpenEffectiveStrengthModal,
  isMobile = false,
}) {
  const [filterMode, setFilterMode] = useState('official') // 'official' | 'all'

  // Chuẩn bị dữ liệu danh sách thành viên
  const { officialList, provisionalList, allList, histogramData, medianElo, middleRangePct } = useMemo(() => {
    const list = (members || []).map((m) => {
      const pr = getPlayerRating(playerRatings, m.id, m, levels)
      const gamesCount = pr.gamesCount || 0
      const rating = pr.rating || 1500
      const prov = isProvisional(gamesCount)
      const remaining = Math.max(0, 5 - gamesCount)

      // Thống kê trận
      let wins = 0
      let losses = 0
      let delta30Days = 0
      const now = Date.now()
      const thirtyDaysAgo = now - 30 * 86400000

      matches.forEach((mt) => {
        const teamA = mt.teamA || (mt.playerKeys ? mt.playerKeys.slice(0, 2) : [])
        const teamB = mt.teamB || (mt.playerKeys ? mt.playerKeys.slice(2, 4) : [])
        const inA = teamA.includes(m.id)
        const inB = teamB.includes(m.id)
        if (inA || inB) {
          const won = (inA && mt.winnerTeam === 'A') || (inB && mt.winnerTeam === 'B')
          if (won) wins++
          else losses++

          const matchTime = mt.at || (mt.playedAt ? Date.parse(mt.playedAt) : 0)
          if (matchTime >= thirtyDaysAgo) {
            const d = Number(mt.delta) || 16
            if (won) delta30Days += d
            else delta30Days -= d
          }
        }
      })

      const totalGames = wins + losses > 0 ? wins + losses : gamesCount
      const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0

      // Thang độ tin cậy
      let confLabel = 'LOW'
      let confColor = '#8494AA'
      let confBarColor = '#64748B'
      let confBarWidth = '14%'
      if (gamesCount >= 100) {
        confLabel = 'V.HIGH'
        confColor = '#F0D26A'
        confBarColor = '#C9A227'
        confBarWidth = '100%'
      } else if (gamesCount >= 30) {
        confLabel = 'HIGH'
        confColor = '#B6CDEC'
        confBarColor = '#1D50A0'
        confBarWidth = '75%'
      } else if (gamesCount >= 5) {
        confLabel = 'MED'
        confColor = '#B6CDEC'
        confBarColor = '#7AA3DC'
        confBarWidth = '45%'
      }

      return {
        id: m.id,
        name: m.name,
        gender: m.gender,
        level: m.level,
        gamesCount,
        rating,
        effectiveStrength: pr.effectiveStrength || effectiveStrengthOf(rating, gamesCount, pr.seedRating || 1500),
        isProvisional: prov,
        provisionalRemaining: remaining,
        wins,
        losses,
        totalGames,
        winRate,
        delta30Days,
        confLabel,
        confColor,
        confBarColor,
        confBarWidth,
      }
    })

    const officials = list.filter((p) => !p.isProvisional).sort((a, b) => b.rating - a.rating)
    officials.forEach((p, idx) => {
      p.rank = idx + 1
    })

    const provisionals = list.filter((p) => p.isProvisional).sort((a, b) => b.rating - a.rating)
    provisionals.forEach((p) => {
      p.rank = '—'
    })

    const allSorted = [...list].sort((a, b) => b.rating - a.rating)

    // Phổ Elo histogram (1300, 1400, 1500, 1600, 1700, 1800, 1900)
    const bins = [
      { label: '1300', min: 0, max: 1399, count: 0 },
      { label: '1400', min: 1400, max: 1499, count: 0 },
      { label: '1500', min: 1500, max: 1599, count: 0 },
      { label: '1600', min: 1600, max: 1699, count: 0 },
      { label: '1700', min: 1700, max: 1799, count: 0 },
      { label: '1800', min: 1800, max: 1899, count: 0 },
      { label: '1900', min: 1900, max: 9999, count: 0 },
    ]

    list.forEach((p) => {
      const b = bins.find((bn) => p.rating >= bn.min && p.rating <= bn.max)
      if (b) b.count++
    })

    const maxCount = Math.max(1, ...bins.map((b) => b.count))
    const histogramWithHeights = bins.map((b) => ({
      ...b,
      heightPx: Math.max(10, Math.round((b.count / maxCount) * 80)),
      color: b.label >= '1800' ? '#00B2A9' : b.label >= '1500' ? '#1D50A0' : '#2E3E5C',
    }))

    // Trung vị
    const sortedRatings = list.map((p) => p.rating).sort((a, b) => a - b)
    const mid = Math.floor(sortedRatings.length / 2)
    const med = sortedRatings.length % 2 !== 0 ? sortedRatings[mid] : Math.round(((sortedRatings[mid - 1] || 1500) + (sortedRatings[mid] || 1500)) / 2) || 1500

    // % trong khoảng 1500 - 1700
    const inRange = list.filter((p) => p.rating >= 1500 && p.rating <= 1700).length
    const rangePct = list.length > 0 ? Math.round((inRange / list.length) * 100) : 60

    return {
      officialList: officials,
      provisionalList: provisionals,
      allList: allSorted,
      histogramData: histogramWithHeights,
      medianElo: med,
      middleRangePct: rangePct,
    }
  }, [members, playerRatings, matches, levels])

  const displayList = filterMode === 'official' ? officialList : allList

  return (
    <div
      data-screen-label="SS2 Bang dang cap Elo"
      style={{
        display: 'grid',
        gap: 16,
      }}
    >
      {/* FILTER TOGGLE TRÊN CÙNG */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, padding: 3, borderRadius: 8, background: '#141D2E', border: '1px solid #22304A' }}>
          <button
            type="button"
            onClick={() => setFilterMode('official')}
            style={{
              font: "600 12px/1 'IBM Plex Sans', sans-serif",
              padding: '8px 12px',
              borderRadius: 6,
              background: filterMode === 'official' ? '#1A2437' : 'transparent',
              border: filterMode === 'official' ? '1px solid #2E3E5C' : '1px solid transparent',
              color: filterMode === 'official' ? '#E9EFF7' : '#A8B7CB',
              cursor: 'pointer',
            }}
          >
            {t('season.filterOfficial')}
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            style={{
              font: "600 12px/1 'IBM Plex Sans', sans-serif",
              padding: '8px 12px',
              borderRadius: 6,
              background: filterMode === 'all' ? '#1A2437' : 'transparent',
              border: filterMode === 'all' ? '1px solid #2E3E5C' : '1px solid transparent',
              color: filterMode === 'all' ? '#E9EFF7' : '#A8B7CB',
              cursor: 'pointer',
            }}
          >
            {t('season.filterAll')}
          </button>
        </div>
      </div>

      {/* NỘI DUNG CHÍNH: 2 CỘT */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 356px',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* CỘT TRÁI: BẢNG XẾP HẠNG VÀ KHU THẨM ĐỊNH */}
        <div style={{ display: 'grid', gap: 14 }}>
          {/* Bảng xếp hạng chính thức */}
          <div style={{ background: '#141D2E', border: '1px solid #22304A', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '10px 13px', borderBottom: '1px solid #22304A', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                {filterMode === 'official'
                  ? `Xếp hạng chính thức · ${officialList.length} người`
                  : `Tất cả thành viên · ${allList.length} người`}
              </span>
              {provisionalList.length > 0 && filterMode === 'official' && (
                <span
                  style={{
                    font: "600 11px/1 'IBM Plex Mono', monospace",
                    padding: '5px 8px',
                    borderRadius: 999,
                    background: 'rgba(214,59,43,.14)',
                    border: '1px solid #8E2C20',
                    color: '#F1A79D',
                  }}
                >
                  {provisionalList.length} người đang thẩm định
                </span>
              )}
              <div style={{ flex: '1 1 0%' }} />
              <span style={{ font: "400 12px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                sort: Elo ↓
              </span>
            </div>

            {/* Header hàng */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '40px minmax(0,1fr) 92px 78px 128px 74px 84px',
                padding: '8px 13px',
                borderBottom: '1px solid #22304A',
                font: "600 11px/1.2 'IBM Plex Sans', sans-serif",
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: '#8494AA',
              }}
            >
              <span>#</span>
              <span>Thành viên</span>
              <span style={{ textAlign: 'right' }}>Elo</span>
              <span style={{ textAlign: 'right' }}>Trận</span>
              <span style={{ textAlign: 'center' }}>Độ tin cậy</span>
              <span style={{ textAlign: 'right' }}>Thắng</span>
              <span style={{ textAlign: 'right' }}>30 ngày</span>
            </div>

            {/* Danh sách thành viên */}
            {displayList.map((player) => {
              const rankColor = player.rank === 1 ? '#F0D26A' : player.rank === 2 ? '#A8B7CB' : player.rank === 3 ? '#B0562A' : '#A8B7CB'
              const deltaColor = player.delta30Days > 0 ? '#5FDBD3' : player.delta30Days < 0 ? '#F1A79D' : '#8494AA'
              const deltaSign = player.delta30Days > 0 ? `+${player.delta30Days}` : player.delta30Days < 0 ? `${player.delta30Days}` : '0'

              return (
                <div
                  key={player.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px minmax(0,1fr) 92px 78px 128px 74px 84px',
                    alignItems: 'center',
                    padding: '9px 13px',
                    borderBottom: '1px solid rgba(34,48,74,.6)',
                    font: "400 13px/1.3 'IBM Plex Sans', sans-serif",
                  }}
                >
                  {/* Rank */}
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: rankColor, fontWeight: 600 }}>
                    {player.rank}
                  </span>

                  {/* Tên & Avatar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 999,
                        background: player.gender === 'Nữ' || player.gender === 'F' ? '#7A3D8F' : '#1D50A0',
                        flex: '0 0 auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      {player.name ? player.name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <span style={{ fontWeight: 600, color: '#E9EFF7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {player.name}
                    </span>
                    {player.rank === 1 && (
                      <span
                        style={{
                          font: "600 10px/1 'IBM Plex Mono', monospace",
                          padding: '3px 6px',
                          borderRadius: 999,
                          background: 'rgba(201,162,39,.16)',
                          border: '1px solid #8A6F16',
                          color: '#F0D26A',
                        }}
                      >
                        Top 1
                      </span>
                    )}
                  </div>

                  {/* Elo */}
                  <span
                    style={{
                      textAlign: 'right',
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontWeight: 600,
                      color: player.rank === 1 ? '#F7E3A1' : '#E9EFF7',
                    }}
                  >
                    {player.rating}
                  </span>

                  {/* Số trận */}
                  <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#A8B7CB' }}>
                    {player.gamesCount}
                  </span>

                  {/* Độ tin cậy */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                    <div
                      style={{
                        width: 56,
                        height: 7,
                        borderRadius: 999,
                        background: '#0B1220',
                        overflow: 'hidden',
                        display: 'flex',
                      }}
                    >
                      <div style={{ width: player.confBarWidth, background: player.confBarColor }} />
                    </div>
                    <span
                      style={{
                        font: "600 10px/1 'IBM Plex Mono', monospace",
                        color: player.confColor,
                        letterSpacing: '.04em',
                      }}
                    >
                      {player.confLabel}
                    </span>
                  </div>

                  {/* Thắng % */}
                  <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#A8B7CB' }}>
                    {player.winRate}%
                  </span>

                  {/* 30 ngày */}
                  <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: deltaColor }}>
                    {deltaSign}
                  </span>
                </div>
              )
            })}
          </div>

          {/* KHU THẨM ĐỊNH (Provisional Section) */}
          {provisionalList.length > 0 && filterMode === 'official' && (
            <div style={{ background: '#141D2E', border: '1px solid #8E2C20', borderRadius: 10, overflow: 'hidden' }}>
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
                <span style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#F1A79D' }}>
                  ⚠ Đang thẩm định · chưa vào podium
                </span>
                <div style={{ flex: '1 1 0%' }} />
                <span style={{ font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  Elo vẫn chạy, chỉ chưa xếp hạng chính thức
                </span>
              </div>

              {provisionalList.map((player) => {
                const deltaColor = player.delta30Days > 0 ? '#5FDBD3' : player.delta30Days < 0 ? '#F1A79D' : '#8494AA'
                const deltaSign = player.delta30Days > 0 ? `+${player.delta30Days}` : player.delta30Days < 0 ? `${player.delta30Days}` : '0'

                return (
                  <div
                    key={player.id}
                    onClick={() => onOpenEffectiveStrengthModal && onOpenEffectiveStrengthModal(player)}
                    title={t('season.clickToInspectProvisional')}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '40px minmax(0,1fr) 92px 78px 128px 74px 84px',
                      alignItems: 'center',
                      padding: '9px 13px',
                      borderBottom: '1px solid rgba(34,48,74,.6)',
                      font: "400 13px/1.3 'IBM Plex Sans', sans-serif",
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#8494AA' }}>—</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 999,
                          background: player.gender === 'Nữ' || player.gender === 'F' ? '#7A3D8F' : '#B0562A',
                          flex: '0 0 auto',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      >
                        {player.name ? player.name.charAt(0).toUpperCase() : '?'}
                      </div>
                      <span style={{ fontWeight: 600, color: '#E9EFF7' }}>{player.name}</span>
                      <span
                        style={{
                          font: "600 10px/1 'IBM Plex Mono', monospace",
                          padding: '3px 6px',
                          borderRadius: 999,
                          background: 'rgba(214,59,43,.14)',
                          border: '1px solid #8E2C20',
                          color: '#F1A79D',
                        }}
                      >
                        còn {player.provisionalRemaining} trận
                      </span>
                    </div>

                    <span
                      style={{
                        textAlign: 'right',
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontWeight: 600,
                        color: '#A8B7CB',
                      }}
                    >
                      {player.rating}?
                    </span>

                    <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#A8B7CB' }}>
                      {player.gamesCount}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                      <div
                        style={{
                          width: 56,
                          height: 7,
                          borderRadius: 999,
                          background: '#0B1220',
                          overflow: 'hidden',
                          display: 'flex',
                        }}
                      >
                        <div style={{ width: player.confBarWidth, background: player.confBarColor }} />
                      </div>
                      <span
                        style={{
                          font: "600 10px/1 'IBM Plex Mono', monospace",
                          color: player.confColor,
                          letterSpacing: '.04em',
                        }}
                      >
                        {player.confLabel}
                      </span>
                    </div>

                    <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#A8B7CB' }}>
                      {player.winRate}%
                    </span>

                    <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: deltaColor }}>
                      {deltaSign}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* CỘT PHẢI (RIGHT RAIL) */}
        <div style={{ display: 'grid', gap: 12 }}>
          {/* Card 1: Thang độ tin cậy */}
          <div
            style={{
              background: '#141D2E',
              border: '1px solid #22304A',
              borderRadius: 10,
              padding: '13px 15px',
              display: 'grid',
              gap: 11,
            }}
          >
            <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
              {t('season.confidenceScaleTitle')}
            </div>
            <div style={{ display: 'grid', gap: 8, font: "400 12px/1.3 'IBM Plex Sans', sans-serif" }}>
              <div style={{ display: 'grid', gridTemplateColumns: '14px 82px minmax(0,1fr)', gap: 9, alignItems: 'center' }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: '#64748B' }} />
                <span style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: '#E9EFF7' }}>LOW</span>
                <span style={{ color: '#8494AA' }}>&lt; 5 trận · gắn nhãn thẩm định</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '14px 82px minmax(0,1fr)', gap: 9, alignItems: 'center' }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: '#7AA3DC' }} />
                <span style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: '#E9EFF7' }}>MED</span>
                <span style={{ color: '#8494AA' }}>5–29 trận · vào bảng chính thức</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '14px 82px minmax(0,1fr)', gap: 9, alignItems: 'center' }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: '#1D50A0' }} />
                <span style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: '#E9EFF7' }}>HIGH</span>
                <span style={{ color: '#8494AA' }}>30–99 trận · Elo dùng nguyên 100%</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '14px 82px minmax(0,1fr)', gap: 9, alignItems: 'center' }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: '#C9A227' }} />
                <span style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: '#E9EFF7' }}>V.HIGH</span>
                <span style={{ color: '#8494AA' }}>≥ 100 trận · số liệu ổn định</span>
              </div>
            </div>
            <div
              style={{
                font: "400 12px/1.5 'IBM Plex Sans', sans-serif",
                color: '#8494AA',
                borderTop: '1px solid #22304A',
                paddingTop: 9,
              }}
            >
              Elo hiển thị của người LOW có dấu <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#E9EFF7' }}>?</span> — con số có thật nhưng biên sai số còn rộng.
            </div>
          </div>

          {/* Card 2: Phổ Elo toàn CLB (Histogram) */}
          <div
            style={{
              background: '#141D2E',
              border: '1px solid #22304A',
              borderRadius: 10,
              padding: '13px 15px',
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
              {t('season.eloDistributionTitle')}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 104 }}>
              {histogramData.map((bar) => (
                <div
                  key={bar.label}
                  style={{
                    flex: '1 1 0%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    gap: 5,
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      width: '100%',
                      height: bar.heightPx,
                      background: bar.color,
                      borderRadius: '3px 3px 0 0',
                    }}
                  />
                  <span style={{ font: "400 9px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                    {bar.label}
                  </span>
                </div>
              ))}
            </div>
            <div
              style={{
                font: "400 12px/1.5 'IBM Plex Sans', sans-serif",
                color: '#8494AA',
                borderTop: '1px solid #22304A',
                paddingTop: 9,
              }}
            >
              Trung vị {medianElo} · nhóm 1500–1700 chiếm {middleRangePct}% CLB, đủ dày để ghép sân cân trình mỗi buổi.
            </div>
          </div>

          {/* Card 3: Hai bảng khác nhau chỗ nào */}
          <div
            style={{
              background: '#1A2437',
              border: '1px solid #2E3E5C',
              borderRadius: 10,
              padding: '13px 15px',
              display: 'grid',
              gap: 9,
            }}
          >
            <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
              Hai bảng khác nhau chỗ nào
            </div>
            <div style={{ display: 'grid', gap: 8, font: "400 12px/1.45 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '78px minmax(0,1fr)', gap: 10 }}>
                <span style={{ font: "600 11px/1.3 'IBM Plex Mono', monospace", color: '#5FDBD3' }}>Elo</span>
                <span>Đo trình độ. Không bao giờ bị xóa. Quyết định ai vào sân với ai.</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '78px minmax(0,1fr)', gap: 10 }}>
                <span style={{ font: "600 11px/1.3 'IBM Plex Mono', monospace", color: '#F0D26A' }}>Điểm mùa</span>
                <span>Đo mức tham gia trong quý. Reset 01/10. Quyết định ai nhận thưởng.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
