import { useState, useMemo } from 'react'
import { Avatar } from '#ds'
import { t } from '#i18n'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { getPlayerRating, isProvisional, DEFAULT_RATING } from '#lib/rating.js'

export default function CareerEloTab({
  members = [],
  playerRatings = {},
  matches = [],
  levels = {},
  onOpenEffectiveStrengthModal,
  onSelectMember,
  isMobile = false,
}) {
  const { isDark } = useTheme()
  const [filterMode, setFilterMode] = useState('official') // 'official' | 'all'

  // Chuẩn bị dữ liệu danh sách thành viên
  const { officialList, provisionalList, allList, histogramData, medianElo, middleRangePct } = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 86400000

    const list = (members || []).map((m) => {
      const pr = getPlayerRating(playerRatings, m.id, m, levels)
      const gamesCount = pr.gamesCount || 0
      const rating = pr.rating ?? DEFAULT_RATING
      const prov = isProvisional(gamesCount)
      const remaining = Math.max(0, 5 - gamesCount)

      // Thống kê trận
      let wins = 0
      let losses = 0
      let delta30Days = 0

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
      let confColor = 'var(--text-muted)'
      let confBarColor = '#64748B'
      let confBarWidth = '14%'
      if (gamesCount >= 100) {
        confLabel = 'V.HIGH'
        confColor = isDark ? '#F0D26A' : '#B45309'
        confBarColor = '#C9A227'
        confBarWidth = '100%'
      } else if (gamesCount >= 30) {
        confLabel = 'HIGH'
        confColor = isDark ? '#B6CDEC' : '#1D50A0'
        confBarColor = '#1D50A0'
        confBarWidth = '75%'
      } else if (gamesCount >= 5) {
        confLabel = 'MED'
        confColor = isDark ? '#B6CDEC' : '#2563EB'
        confBarColor = '#7AA3DC'
        confBarWidth = '45%'
      }

      return {
        id: m.id,
        name: m.name,
        avatarUrl: m.avatarUrl || m.avatar || '',
        gender: m.gender,
        level: m.level,
        gamesCount,
        rating,
        effectiveStrength: pr.effectiveStrength ?? rating,
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
      color: b.label >= '1800' ? '#00B2A9' : b.label >= '1500' ? '#1D50A0' : (isDark ? '#2E3E5C' : '#94A3B8'),
    }))

    // Trung vị
    const sortedRatings = list.map((p) => p.rating).sort((a, b) => a - b)
    const mid = Math.floor(sortedRatings.length / 2)
    const med = sortedRatings.length % 2 !== 0
      ? (sortedRatings[mid] ?? DEFAULT_RATING)
      : Math.round(((sortedRatings[mid - 1] ?? DEFAULT_RATING) + (sortedRatings[mid] ?? DEFAULT_RATING)) / 2)

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
  }, [members, playerRatings, matches, levels, isDark])

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
        <div style={{ display: 'flex', gap: 6, padding: 3, borderRadius: 8, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            onClick={() => setFilterMode('official')}
            style={{
              font: "600 12px/1 'IBM Plex Sans', sans-serif",
              padding: isMobile ? '8px 12px' : '8px 12px',
              borderRadius: isMobile ? 999 : 6,
              background: filterMode === 'official' ? (isMobile ? 'var(--surface-raised)' : 'var(--surface-card)') : 'transparent',
              border: filterMode === 'official' ? '1px solid var(--border-default)' : (isMobile ? '1px solid var(--border-subtle)' : '1px solid transparent'),
              color: filterMode === 'official' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: filterMode === 'official' ? 'var(--shadow-xs)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {isMobile ? t('season.filterOfficialShort') : t('season.filterOfficial')}
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            style={{
              font: "600 12px/1 'IBM Plex Sans', sans-serif",
              padding: isMobile ? '8px 12px' : '8px 12px',
              borderRadius: isMobile ? 999 : 6,
              background: filterMode === 'all' ? (isMobile ? 'var(--surface-raised)' : 'var(--surface-card)') : 'transparent',
              border: filterMode === 'all' ? '1px solid var(--border-default)' : (isMobile ? '1px solid var(--border-subtle)' : '1px solid transparent'),
              color: filterMode === 'all' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: filterMode === 'all' ? 'var(--shadow-xs)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {isMobile ? t('season.filterAllShort') : t('season.filterAll')}
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
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }}>
            <div style={{ padding: '10px 13px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                {filterMode === 'official'
                  ? t('season.officialActiveCount', { n: officialList.length })
                  : t('season.allActiveCount', { n: allList.length })}
              </span>
              {provisionalList.length > 0 && filterMode === 'official' && (
                <span
                  style={{
                    font: "600 11px/1 'IBM Plex Mono', monospace",
                    padding: '5px 8px',
                    borderRadius: 999,
                    background: isDark ? 'rgba(214,59,43,.14)' : 'rgba(214,59,43,.10)',
                    border: '1px solid #D63B2B',
                    color: isDark ? '#F1A79D' : '#D63B2B',
                  }}
                >
                  {t('season.provisionalActiveCount', { n: provisionalList.length })}
                </span>
              )}
              <div style={{ flex: '1 1 0%' }} />
              <span style={{ font: "400 12px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                {t('season.sortEloDesc')}
              </span>
            </div>

            {/* Header hàng (Desktop only) */}
            {!isMobile && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px minmax(0,1fr) 92px 78px 128px 74px 84px',
                  padding: '8px 13px',
                  borderBottom: '1px solid var(--border-subtle)',
                  font: "600 11px/1.2 'IBM Plex Sans', sans-serif",
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                }}
              >
                <span>#</span>
                <span>{t('season.colMember')}</span>
                <span style={{ textAlign: 'right' }}>Elo</span>
                <span style={{ textAlign: 'right' }}>{t('season.colMatches')}</span>
                <span style={{ textAlign: 'center' }}>{t('season.colConfidence')}</span>
                <span style={{ textAlign: 'right' }}>{t('season.colWins')}</span>
                <span style={{ textAlign: 'right' }}>{t('season.col30Days')}</span>
              </div>
            )}

            {/* Danh sách thành viên */}
            {displayList.map((player) => {
              const isRank1 = player.rank === 1
              const rankColor = isRank1
                ? '#D97706'
                : player.rank === 2 || player.rank === 3
                  ? (isDark ? '#A8B7CB' : 'var(--text-secondary)')
                  : 'var(--text-muted)'
              const deltaColor = player.delta30Days > 0 ? (isDark ? '#5FDBD3' : '#0D9488') : player.delta30Days < 0 ? (isDark ? '#F1A79D' : '#DC2626') : 'var(--text-muted)'
              const deltaSign = player.delta30Days > 0 ? `+${player.delta30Days}` : player.delta30Days < 0 ? `${player.delta30Days}` : '0'

              if (isMobile) {
                return (
                  <div
                    key={player.id}
                    onClick={() => onSelectMember && onSelectMember(player)}
                    title={onSelectMember ? t('leaderboard.tabChart') : undefined}
                    style={{
                      padding: '11px 14px',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      cursor: onSelectMember ? 'pointer' : 'default',
                      background: 'transparent',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (onSelectMember) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)'
                    }}
                    onMouseLeave={(e) => {
                      if (onSelectMember) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    {/* Dòng 1: Hạng + Avatar + Tên + Badge Top 1 + Elo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ width: 20, font: "600 13px/1 'IBM Plex Mono', monospace", color: rankColor }}>
                        {player.rank}
                      </span>
                      <Avatar name={player.name} src={player.avatarUrl} size={22} />
                      <span style={{ flex: '1 1 0%', minWidth: 0, font: "600 14px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {player.name}
                      </span>
                      {player.rank === 1 && (
                        <span
                          style={{
                            font: "600 10px/1 'IBM Plex Mono', monospace",
                            padding: '2px 6px',
                            borderRadius: 999,
                            background: isDark ? 'rgba(201,162,39,.16)' : 'rgba(245,158,11,.14)',
                            border: '1px solid #C9A227',
                            color: isDark ? '#F0D26A' : '#B45309',
                          }}
                        >
                          Top 1
                        </span>
                      )}
                      <span
                        style={{
                          font: "600 15px/1 'IBM Plex Mono', monospace",
                          color: player.rank === 1 ? (isDark ? '#F7E3A1' : '#B45309') : 'var(--text-primary)',
                        }}
                      >
                        {player.rating}
                      </span>
                    </div>

                    {/* Dòng 2: Mini confidence bar + Nhãn + {games} trận · {winRate}% · {delta} */}
                    <div style={{ paddingLeft: 29, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          width: 52,
                          height: 7,
                          borderRadius: 999,
                          background: 'var(--surface-inset)',
                          border: '1px solid var(--border-subtle)',
                          overflow: 'hidden',
                          display: 'flex',
                          flex: '0 0 auto',
                        }}
                      >
                        <span style={{ width: player.confBarWidth, background: player.confBarColor }} />
                      </span>
                      <span
                        style={{
                          font: "600 10px/1 'IBM Plex Mono', monospace",
                          color: player.confColor,
                          letterSpacing: '.04em',
                        }}
                      >
                        {player.confLabel}
                      </span>
                      <span
                        style={{
                          flex: '1 1 0%',
                          font: "400 11px/1.3 'IBM Plex Mono', monospace",
                          color: 'var(--text-muted)',
                          textAlign: 'right',
                        }}
                      >
                        {player.gamesCount} {t('units.match')} · {player.winRate}% ·{' '}
                        <span style={{ color: deltaColor, fontWeight: 600 }}>{deltaSign}</span>
                      </span>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={player.id}
                  onClick={() => onSelectMember && onSelectMember(player)}
                  title={onSelectMember ? t('leaderboard.tabChart') : undefined}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px minmax(0,1fr) 92px 78px 128px 74px 84px',
                    alignItems: 'center',
                    padding: '9px 13px',
                    borderBottom: '1px solid var(--border-subtle)',
                    font: "400 13px/1.3 'IBM Plex Sans', sans-serif",
                    cursor: onSelectMember ? 'pointer' : 'default',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (onSelectMember) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)'
                  }}
                  onMouseLeave={(e) => {
                    if (onSelectMember) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {/* Rank */}
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: rankColor, fontWeight: 600 }}>
                    {player.rank}
                  </span>

                  {/* Tên & Avatar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <Avatar name={player.name} src={player.avatarUrl} size={24} />
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {player.name}
                    </span>
                    {player.rank === 1 && (
                      <span
                        style={{
                          font: "600 10px/1 'IBM Plex Mono', monospace",
                          padding: '3px 6px',
                          borderRadius: 999,
                          background: isDark ? 'rgba(201,162,39,.16)' : 'rgba(245,158,11,.14)',
                          border: '1px solid #C9A227',
                          color: isDark ? '#F0D26A' : '#B45309',
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
                      color: player.rank === 1 ? (isDark ? '#F7E3A1' : '#B45309') : 'var(--text-primary)',
                    }}
                  >
                    {player.rating}
                  </span>

                  {/* Số trận */}
                  <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>
                    {player.gamesCount}
                  </span>

                  {/* Độ tin cậy */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                    <div
                      style={{
                        width: 56,
                        height: 7,
                        borderRadius: 999,
                        background: 'var(--surface-inset)',
                        border: '1px solid var(--border-subtle)',
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
                  <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>
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
            <div style={{ background: 'var(--surface-card)', border: '1px solid #D63B2B', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }}>
              {isMobile ? (
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ font: "600 14px/1.25 'IBM Plex Sans', sans-serif", color: isDark ? '#F1A79D' : '#DC2626' }}>
                    {t('season.provisionalUnderReviewMobile', { n: provisionalList.length })}
                  </span>
                  <span style={{ font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                    {t('season.provisionalSectionSub')}
                  </span>
                </div>
              ) : (
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
                  <span style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: isDark ? '#F1A79D' : '#DC2626' }}>
                    {t('season.provisionalSectionTitle')}
                  </span>
                  <div style={{ flex: '1 1 0%' }} />
                  <span style={{ font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                    {t('season.provisionalSectionSub')}
                  </span>
                </div>
              )}

              {provisionalList.map((player) => {
                const deltaColor = player.delta30Days > 0 ? (isDark ? '#5FDBD3' : '#0D9488') : player.delta30Days < 0 ? (isDark ? '#F1A79D' : '#DC2626') : 'var(--text-muted)'
                const deltaSign = player.delta30Days > 0 ? `+${player.delta30Days}` : player.delta30Days < 0 ? `${player.delta30Days}` : '0'

                if (isMobile) {
                  return (
                    <div
                      key={player.id}
                      onClick={() => (onSelectMember ? onSelectMember(player) : onOpenEffectiveStrengthModal && onOpenEffectiveStrengthModal(player))}
                      title={onSelectMember ? t('leaderboard.tabChart') : t('season.clickToInspectProvisional')}
                      style={{
                        padding: '11px 14px',
                        borderBottom: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        cursor: 'pointer',
                        background: 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Dòng 1: — + Avatar + Tên + Elo? */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span style={{ width: 20, font: "600 13px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>—</span>
                        <Avatar name={player.name} src={player.avatarUrl} size={22} />
                        <span style={{ flex: '1 1 0%', minWidth: 0, font: "600 14px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {player.name}
                        </span>
                        <span style={{ font: "600 15px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                          {player.rating}?
                        </span>
                      </div>

                      {/* Dòng 2: Tag còn n trận + {games} trận · {winRate}% · {delta} */}
                      <div style={{ paddingLeft: 29, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          onClick={(e) => {
                            if (onOpenEffectiveStrengthModal) {
                              e.stopPropagation()
                              onOpenEffectiveStrengthModal(player)
                            }
                          }}
                          style={{
                            font: "600 10px/1 'IBM Plex Mono', monospace",
                            padding: '3px 6px',
                            borderRadius: 999,
                            background: isDark ? 'rgba(214,59,43,.14)' : 'rgba(214,59,43,.10)',
                            border: '1px solid #D63B2B',
                            color: isDark ? '#F1A79D' : '#DC2626',
                            cursor: 'pointer',
                          }}
                        >
                          {t('season.provisionalBadgeCount', { n: player.provisionalRemaining })}
                        </span>
                        <span
                          style={{
                            flex: '1 1 0%',
                            font: "400 11px/1.3 'IBM Plex Mono', monospace",
                            color: 'var(--text-muted)',
                            textAlign: 'right',
                          }}
                        >
                          {player.gamesCount} {t('units.match')} · {player.winRate}% ·{' '}
                          <span style={{ color: deltaColor, fontWeight: 600 }}>{deltaSign}</span>
                        </span>
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={player.id}
                    onClick={() => (onSelectMember ? onSelectMember(player) : onOpenEffectiveStrengthModal && onOpenEffectiveStrengthModal(player))}
                    title={onSelectMember ? t('leaderboard.tabChart') : t('season.clickToInspectProvisional')}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '40px minmax(0,1fr) 92px 78px 128px 74px 84px',
                      alignItems: 'center',
                      padding: '9px 13px',
                      borderBottom: '1px solid var(--border-subtle)',
                      font: "400 13px/1.3 'IBM Plex Sans', sans-serif",
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>—</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <Avatar name={player.name} src={player.avatarUrl} size={24} />
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{player.name}</span>
                      <span
                        onClick={(e) => {
                          if (onOpenEffectiveStrengthModal) {
                            e.stopPropagation()
                            onOpenEffectiveStrengthModal(player)
                          }
                        }}
                        title={t('season.clickToInspectProvisional')}
                        style={{
                          font: "600 10px/1 'IBM Plex Mono', monospace",
                          padding: '3px 6px',
                          borderRadius: 999,
                          background: isDark ? 'rgba(214,59,43,.14)' : 'rgba(214,59,43,.10)',
                          border: '1px solid #D63B2B',
                          color: isDark ? '#F1A79D' : '#DC2626',
                          cursor: 'pointer',
                        }}
                      >
                        {t('season.provisionalBadgeCount', { n: player.provisionalRemaining })}
                      </span>
                    </div>

                    <span
                      style={{
                        textAlign: 'right',
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {player.rating}?
                    </span>

                    <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>
                      {player.gamesCount}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                      <div
                        style={{
                          width: 56,
                          height: 7,
                          borderRadius: 999,
                          background: 'var(--surface-inset)',
                          border: '1px solid var(--border-subtle)',
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

                    <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>
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
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
              padding: '13px 15px',
              display: 'grid',
              gap: 11,
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
              {t('season.confidenceScaleTitle')}
            </div>
            <div style={{ display: 'grid', gap: 8, font: "400 12px/1.3 'IBM Plex Sans', sans-serif" }}>
              <div style={{ display: 'grid', gridTemplateColumns: '14px 82px minmax(0,1fr)', gap: 9, alignItems: 'center' }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: '#64748B' }} />
                <span style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>LOW</span>
                <span style={{ color: 'var(--text-muted)' }}>{t('season.confLowNote')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '14px 82px minmax(0,1fr)', gap: 9, alignItems: 'center' }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: '#7AA3DC' }} />
                <span style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>MED</span>
                <span style={{ color: 'var(--text-muted)' }}>{t('season.confMedNote')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '14px 82px minmax(0,1fr)', gap: 9, alignItems: 'center' }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: '#1D50A0' }} />
                <span style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>HIGH</span>
                <span style={{ color: 'var(--text-muted)' }}>{t('season.confHighNote')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '14px 82px minmax(0,1fr)', gap: 9, alignItems: 'center' }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: '#C9A227' }} />
                <span style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>V.HIGH</span>
                <span style={{ color: 'var(--text-muted)' }}>{t('season.confVHighNote')}</span>
              </div>
            </div>
            <div
              style={{
                font: "400 12px/1.5 'IBM Plex Sans', sans-serif",
                color: 'var(--text-muted)',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: 9,
              }}
            >
              {t('season.confQuestionNote')}
            </div>
          </div>

          {/* Card 2: Phổ Elo toàn CLB (Histogram) */}
          <div
            style={{
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
              padding: '13px 15px',
              display: 'grid',
              gap: 10,
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
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
                  <span style={{ font: "400 9px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                    {bar.label}
                  </span>
                </div>
              ))}
            </div>
            <div
              style={{
                font: "400 12px/1.5 'IBM Plex Sans', sans-serif",
                color: 'var(--text-muted)',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: 9,
              }}
            >
              {t('season.medianNote', { median: medianElo, pct: middleRangePct })}
            </div>
          </div>

          {/* Card 3: Hai Bảng Khác Nhau Thế Nào */}
          <div
            style={{
              background: 'var(--surface-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 10,
              padding: '13px 15px',
              display: 'grid',
              gap: 9,
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
              {t('season.twoTablesDiffTitle')}
            </div>
            <div style={{ display: 'grid', gap: 8, font: "400 12px/1.45 'IBM Plex Sans', sans-serif", color: 'var(--text-secondary)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '78px minmax(0,1fr)', gap: 10 }}>
                <span style={{ font: "600 11px/1.3 'IBM Plex Mono', monospace", color: isDark ? '#5FDBD3' : 'var(--teal-700)' }}>Elo</span>
                <span>{t('season.eloPurpose')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '78px minmax(0,1fr)', gap: 10 }}>
                <span style={{ font: "600 11px/1.3 'IBM Plex Mono', monospace", color: isDark ? '#F0D26A' : '#B45309' }}>{t('season.colPoints')}</span>
                <span>{t('season.seasonPointsPurpose')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
