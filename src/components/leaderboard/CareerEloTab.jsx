import { useState, useMemo } from 'react'
import { Avatar } from '#ds'
import { t } from '#i18n'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { getPlayerRating, isProvisional, DEFAULT_RATING } from '#lib/rating.js'
import BadgeHex from '#components/badges/BadgeHex.jsx'
import { getMemberHighestBadge } from '#lib/badges.js'
import RankMedalIcon from '#components/leaderboard/RankMedalIcon.jsx'

export default function CareerEloTab({
  db,
  members = [],
  playerRatings = {},
  matches = [],
  levels = {},
  onOpenEffectiveStrengthModal,
  onSelectMember,
  isMobile = false,
}) {
  const { isDark, isGlamorous } = useTheme()
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
        highestBadge: db ? getMemberHighestBadge(m.id, db) : null,
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
          {/* TỐP ĐẲNG CẤP 14a · Hào nhoáng */}
          {isGlamorous && officialList.length >= 3 && (
            <div
              style={{
                position: 'relative',
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid #2E3E5C',
                background: 'linear-gradient(180deg, #16202E, #101827 62%)',
                padding: '15px 16px 16px',
                display: 'grid',
                gap: 12,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'radial-gradient(60% 80% at 22% 0%, rgba(122,163,220,.18), transparent 70%)',
                  pointerEvents: 'none',
                }}
              />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ font: "700 16px/1.2 'Barlow', sans-serif", color: '#FFFFFF' }}>
                  {t('season.topEloTitle14a')}
                </span>
                <span style={{ font: "400 12px/1.2 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                  {t('season.topEloSubtitle14a')}
                </span>
              </div>

              <div
                style={{
                  position: 'relative',
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
                  gap: 12,
                }}
              >
                {/* Top 1 Elo Card */}
                {officialList[0] && (
                  <div
                    onClick={() => onSelectMember && onSelectMember(officialList[0])}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 13,
                      padding: '13px 14px',
                      borderRadius: 10,
                      background: 'linear-gradient(120deg, rgba(240,183,92,.20), rgba(20,29,46,.92) 62%)',
                      border: '1px solid #C9A227',
                      cursor: onSelectMember ? 'pointer' : 'default',
                      transition: 'transform 0.15s ease',
                    }}
                  >
                    <div style={{ position: 'relative', width: 48, height: 48, flex: '0 0 auto' }}>
                      <div
                        style={{
                          position: 'absolute',
                          left: '50%',
                          top: -14,
                          transform: 'translateX(-50%)',
                          width: 24,
                          height: 15,
                          background: 'linear-gradient(180deg, #FFF3C4, #F0D26A 52%, #C9A227)',
                          clipPath: 'polygon(0% 100%, 0% 22%, 22% 58%, 50% 0%, 78% 58%, 100% 22%, 100% 100%)',
                          filter: 'drop-shadow(0 2px 6px rgba(201,162,39,.5))',
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          inset: -7,
                          borderRadius: 999,
                          background: 'radial-gradient(circle, rgba(240,183,92,.34), transparent 70%)',
                          animation: 'medalGlow 4.6s ease-in-out infinite',
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: 999,
                          background: 'conic-gradient(from 210deg, #7A5620, #F0B75C, #FFF3C4, #F0D26A, #7A5620)',
                          boxShadow: '0 0 0 1px rgba(247,227,161,.55)',
                        }}
                      />
                      <div style={{ position: 'absolute', inset: 3, borderRadius: 999, overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                        <Avatar name={officialList[0].name} src={officialList[0].avatarUrl} size={42} />
                      </div>
                      <div
                        style={{
                          position: 'absolute',
                          right: -4,
                          bottom: -4,
                          width: 19,
                          height: 19,
                          borderRadius: 999,
                          background: 'linear-gradient(180deg, #FFF3C4, #C9A227)',
                          border: '2px solid #171206',
                          display: 'grid',
                          placeItems: 'center',
                          font: "700 10px/1 'Barlow', sans-serif",
                          color: '#2A1F00',
                        }}
                      >
                        1
                      </div>
                    </div>
                    <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
                      <div style={{ font: "600 15px/1.2 'IBM Plex Sans', sans-serif", color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {officialList[0].name}
                      </div>
                      <div style={{ font: "600 26px/1 'IBM Plex Mono', monospace", color: '#F7E3A1' }}>
                        {officialList[0].rating}
                      </div>
                      <div style={{ font: "400 11.5px/1.2 'IBM Plex Mono', monospace", color: '#C6B683' }}>
                        {t('season.statsDetail14a', {
                          matches: officialList[0].totalGames,
                          conf: officialList[0].confLabel,
                          delta: officialList[0].delta30Days >= 0 ? `+${officialList[0].delta30Days}` : `${officialList[0].delta30Days}`,
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Top 2 Elo Card */}
                {officialList[1] && (
                  <div
                    onClick={() => onSelectMember && onSelectMember(officialList[1])}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 13,
                      padding: '13px 14px',
                      borderRadius: 10,
                      background: 'linear-gradient(120deg, rgba(199,210,228,.14), rgba(20,29,46,.92) 62%)',
                      border: '1px solid #6F7F96',
                      cursor: onSelectMember ? 'pointer' : 'default',
                      transition: 'transform 0.15s ease',
                    }}
                  >
                    <div style={{ position: 'relative', width: 44, height: 44, flex: '0 0 auto' }}>
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: 999,
                          background: 'conic-gradient(from 210deg, #5B6B81, #C7D2E4, #FFFFFF, #8FA3BE, #5B6B81)',
                          boxShadow: '0 0 0 1px rgba(199,210,228,.45)',
                        }}
                      />
                      <div style={{ position: 'absolute', inset: 3, borderRadius: 999, overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                        <Avatar name={officialList[1].name} src={officialList[1].avatarUrl} size={38} />
                      </div>
                      <div
                        style={{
                          position: 'absolute',
                          right: -4,
                          bottom: -4,
                          width: 18,
                          height: 18,
                          borderRadius: 999,
                          background: 'linear-gradient(180deg, #EDF3FB, #8FA3BE)',
                          border: '2px solid #141D2B',
                          display: 'grid',
                          placeItems: 'center',
                          font: "700 10px/1 'Barlow', sans-serif",
                          color: '#1B2435',
                        }}
                      >
                        2
                      </div>
                    </div>
                    <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
                      <div style={{ font: "600 15px/1.2 'IBM Plex Sans', sans-serif", color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {officialList[1].name}
                      </div>
                      <div style={{ font: "600 24px/1 'IBM Plex Mono', monospace", color: '#E3EDFB' }}>
                        {officialList[1].rating}
                      </div>
                      <div style={{ font: "400 11.5px/1.2 'IBM Plex Mono', monospace", color: '#A8B7CB' }}>
                        {t('season.statsDetail14a', {
                          matches: officialList[1].totalGames,
                          conf: officialList[1].confLabel,
                          delta: officialList[1].delta30Days >= 0 ? `+${officialList[1].delta30Days}` : `${officialList[1].delta30Days}`,
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Top 3 Elo Card */}
                {officialList[2] && (
                  <div
                    onClick={() => onSelectMember && onSelectMember(officialList[2])}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 13,
                      padding: '13px 14px',
                      borderRadius: 10,
                      background: 'linear-gradient(120deg, rgba(232,180,140,.14), rgba(20,29,46,.92) 62%)',
                      border: '1px solid #A66A38',
                      cursor: onSelectMember ? 'pointer' : 'default',
                      transition: 'transform 0.15s ease',
                    }}
                  >
                    <div style={{ position: 'relative', width: 44, height: 44, flex: '0 0 auto' }}>
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: 999,
                          background: 'conic-gradient(from 210deg, #5C2C10, #C77C48, #F5C09A, #C77C48, #5C2C10)',
                          boxShadow: '0 0 0 1px rgba(232,180,140,.4)',
                        }}
                      />
                      <div style={{ position: 'absolute', inset: 3, borderRadius: 999, overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                        <Avatar name={officialList[2].name} src={officialList[2].avatarUrl} size={38} />
                      </div>
                      <div
                        style={{
                          position: 'absolute',
                          right: -4,
                          bottom: -4,
                          width: 18,
                          height: 18,
                          borderRadius: 999,
                          background: 'linear-gradient(180deg, #F5C09A, #A66A38)',
                          border: '2px solid #170E07',
                          display: 'grid',
                          placeItems: 'center',
                          font: "700 10px/1 'Barlow', sans-serif",
                          color: '#2A1608',
                        }}
                      >
                        3
                      </div>
                    </div>
                    <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
                      <div style={{ font: "600 15px/1.2 'IBM Plex Sans', sans-serif", color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {officialList[2].name}
                      </div>
                      <div style={{ font: "600 24px/1 'IBM Plex Mono', monospace", color: '#F5E0D0' }}>
                        {officialList[2].rating}
                      </div>
                      <div style={{ font: "400 11.5px/1.2 'IBM Plex Mono', monospace", color: '#A8B7CB' }}>
                        {t('season.statsDetail14a', {
                          matches: officialList[2].totalGames,
                          conf: officialList[2].confLabel,
                          delta: officialList[2].delta30Days >= 0 ? `+${officialList[2].delta30Days}` : `${officialList[2].delta30Days}`,
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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
                {isGlamorous ? t('season.singleHighestBadgeLegend14a') : t('season.sortEloDesc')}
              </span>
            </div>

            {/* Header hàng (Desktop only) */}
            {!isMobile && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isGlamorous ? '46px minmax(0,1fr) 92px 78px 128px 74px 84px' : '40px minmax(0,1fr) 92px 78px 128px 74px 84px',
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

              const isGlamTop1 = isGlamorous && player.rank === 1
              const isGlamTop2 = isGlamorous && player.rank === 2
              const isGlamTop3 = isGlamorous && player.rank === 3
              const isGlamTopAny = isGlamTop1 || isGlamTop2 || isGlamTop3

              const glamLeftBorder = isGlamTop1
                ? '3px solid #E5B842'
                : isGlamTop2
                  ? '3px solid #BAC7D5'
                  : isGlamTop3
                    ? '3px solid #D98844'
                    : '3px solid transparent'

              const glamBg = isGlamTop1
                ? (isDark ? 'linear-gradient(90deg, rgba(229,184,66,.14) 0%, rgba(20,27,45,.75) 45%)' : 'linear-gradient(90deg, rgba(245,158,11,.12) 0%, rgba(255,255,255,.9) 45%)')
                : isGlamTop2
                  ? (isDark ? 'linear-gradient(90deg, rgba(186,199,213,.12) 0%, rgba(20,27,45,.6) 45%)' : 'linear-gradient(90deg, rgba(148,163,184,.12) 0%, rgba(255,255,255,.9) 45%)')
                  : isGlamTop3
                    ? (isDark ? 'linear-gradient(90deg, rgba(217,136,68,.12) 0%, rgba(20,27,45,.6) 45%)' : 'linear-gradient(90deg, rgba(217,119,6,.1) 0%, rgba(255,255,255,.9) 45%)')
                    : undefined

              if (isMobile) {
                return (
                  <div
                    key={player.id}
                    onClick={() => onSelectMember && onSelectMember(player)}
                    title={onSelectMember ? t('leaderboard.tabChart') : undefined}
                    style={{
                      padding: '11px 14px',
                      borderBottom: '1px solid var(--border-subtle)',
                      borderLeft: isGlamorous ? glamLeftBorder : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      cursor: onSelectMember ? 'pointer' : 'default',
                      background: glamBg || 'transparent',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (onSelectMember) e.currentTarget.style.background = isGlamTopAny ? glamBg : isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)'
                    }}
                    onMouseLeave={(e) => {
                      if (onSelectMember) e.currentTarget.style.background = glamBg || 'transparent'
                    }}
                  >
                    {/* Dòng 1: Hạng + Avatar + Tên + Badge Top 1 + Elo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      {isGlamorous && (player.rank === 1 || player.rank === 2 || player.rank === 3) ? (
                        <div style={{ width: 22, display: 'flex', justifyContent: 'center' }}>
                          <RankMedalIcon rank={player.rank} size={20} />
                        </div>
                      ) : (
                        <span style={{ width: 20, font: "600 13px/1 'IBM Plex Mono', monospace", color: rankColor }}>
                          {player.rank}
                        </span>
                      )}
                      <Avatar name={player.name} src={player.avatarUrl} size={22} />
                      <div style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <span style={{ font: "600 14px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {player.name}
                        </span>
                        {isGlamorous && player.highestBadge && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                            <BadgeHex tier={player.highestBadge.tier} glyph={player.highestBadge.glyph} size={13} />
                            <span
                              style={{
                                font: "600 10px/1 'IBM Plex Sans', sans-serif",
                                color:
                                  player.highestBadge.tier === 'legend'
                                    ? '#FFE24B'
                                    : player.highestBadge.tier === 'epic'
                                      ? '#D946EF'
                                      : player.highestBadge.tier === 'elite'
                                        ? '#38BDF8'
                                        : player.highestBadge.tier === 'rare'
                                          ? '#A78BFA'
                                          : 'var(--text-secondary)',
                              }}
                            >
                              {player.highestBadge.name}
                            </span>
                          </div>
                        )}
                      </div>
                      {!isGlamorous && player.rank === 1 && (
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
                    gridTemplateColumns: isGlamorous
                      ? '46px minmax(0,1fr) 92px 78px 128px 74px 84px'
                      : '40px minmax(0,1fr) 92px 78px 128px 74px 84px',
                    alignItems: 'center',
                    padding: isGlamorous ? '10px 13px' : '9px 13px',
                    borderBottom: '1px solid var(--border-subtle)',
                    borderLeft: isGlamorous ? glamLeftBorder : 'none',
                    background: glamBg || 'transparent',
                    font: "400 13px/1.3 'IBM Plex Sans', sans-serif",
                    cursor: onSelectMember ? 'pointer' : 'default',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (onSelectMember) {
                      e.currentTarget.style.background = isGlamTopAny
                        ? glamBg
                        : isDark
                          ? 'rgba(255,255,255,.04)'
                          : 'rgba(0,0,0,.03)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (onSelectMember) {
                      e.currentTarget.style.background = glamBg || 'transparent'
                    }
                  }}
                >
                  {/* Rank */}
                  {isGlamorous && (player.rank === 1 || player.rank === 2 || player.rank === 3) ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <RankMedalIcon rank={player.rank} size={28} />
                    </div>
                  ) : (
                    <span
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        color: isGlamorous ? '#7F93B8' : rankColor,
                        fontWeight: 600,
                        textAlign: isGlamorous ? 'center' : 'left',
                      }}
                    >
                      {player.rank}
                    </span>
                  )}

                  {/* Tên & Avatar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                    <div
                      style={{
                        position: 'relative',
                        padding: isGlamTop1 ? 2 : 0,
                        borderRadius: '50%',
                        background: isGlamTop1
                          ? 'conic-gradient(from 180deg, #FFE24B, #E5A824, #F27036, #FFE24B)'
                          : isGlamTop2
                            ? 'conic-gradient(from 180deg, #BAC7D5, #8C99A8, #BAC7D5)'
                            : isGlamTop3
                              ? 'conic-gradient(from 180deg, #D98844, #8C4724, #D98844)'
                              : 'transparent',
                        flexShrink: 0,
                      }}
                    >
                      <Avatar name={player.name} src={player.avatarUrl} size={isGlamorous ? 28 : 24} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: isGlamorous && player.highestBadge ? 1 : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {player.name}
                        </span>
                        {!isGlamorous && player.rank === 1 && (
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

                      {/* Tên huy hiệu bậc cao nhất dưới tên người chơi khi ở chế độ hào nhoáng */}
                      {isGlamorous && player.highestBadge && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
                          <BadgeHex tier={player.highestBadge.tier} glyph={player.highestBadge.glyph} size={14} />
                          <span
                            style={{
                              font: "600 11px/1 'IBM Plex Sans', sans-serif",
                              color:
                                player.highestBadge.tier === 'legend'
                                  ? '#FFE24B'
                                  : player.highestBadge.tier === 'epic'
                                    ? '#D946EF'
                                    : player.highestBadge.tier === 'elite'
                                      ? '#38BDF8'
                                      : player.highestBadge.tier === 'rare'
                                        ? '#A78BFA'
                                        : 'var(--text-secondary)',
                            }}
                          >
                            {player.highestBadge.name}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Chip huy hiệu khi ở chế độ đơn giản */}
                    {!isGlamorous && player.highestBadge && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                          border: '1px solid var(--border-subtle)',
                        }}
                        title={player.highestBadge.name}
                      >
                        <BadgeHex tier={player.highestBadge.tier} glyph={player.highestBadge.glyph} size={15} />
                        <span
                          style={{
                            font: "600 10.5px/1 'IBM Plex Sans', sans-serif",
                            color:
                              player.highestBadge.tier === 'legend'
                                ? '#FFE24B'
                                : player.highestBadge.tier === 'epic'
                                  ? '#D946EF'
                                  : player.highestBadge.tier === 'elite'
                                    ? '#38BDF8'
                                    : 'var(--text-secondary)',
                          }}
                        >
                          {player.highestBadge.name}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Elo */}
                  <span
                    style={{
                      textAlign: 'right',
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontWeight: isGlamTop1 ? 700 : 600,
                      fontSize: isGlamTop1 ? 14 : 13,
                      color: isGlamTop1
                        ? (isDark ? '#F7E3A1' : '#B45309')
                        : isGlamTop2
                          ? (isDark ? '#D2DCE6' : 'var(--text-primary)')
                          : isGlamTop3
                            ? (isDark ? '#E8A76B' : 'var(--text-primary)')
                            : 'var(--text-primary)',
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
                  <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: deltaColor, fontWeight: 600 }}>
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
