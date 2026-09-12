import { useMemo } from 'react'
import { Avatar } from '#ds'
import { t } from '#i18n'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { getPlayerRating, isProvisional, DEFAULT_RATING } from '#lib/rating.js'
import BadgeHex from '#components/badges/BadgeHex.jsx'
import { getMemberHighestBadge, getMemberStreak, computeClubBadgeStats } from '#lib/badges.js'
import { seasonMatchesOf } from '#lib/season.js'
import RankMedalIcon from '#components/leaderboard/RankMedalIcon.jsx'

function BountyBadgeTag({ streak = 0 }) {
  if (streak < 5) return null
  return (
    <span
      style={{
        font: "700 10px/1 'Oswald', sans-serif",
        letterSpacing: '.06em',
        padding: '3px 7px',
        borderRadius: 999,
        background: 'linear-gradient(135deg, rgba(255,46,126,.25), rgba(255,226,75,.15))',
        border: '1px solid #FF2E7E',
        color: '#FF2E7E',
        boxShadow: '0 0 10px rgba(255,46,126,.35)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
      }}
    >
      <span>⚡</span>
      <span>{t('badges.bountyTag')} · {streak}W</span>
    </span>
  )
}

function SingleBadgeSlot({ badge, size = 18 }) {
  if (badge) {
    return <BadgeHex tier={badge.tier} glyph={badge.glyph} size={size} />
  }
  return (
    <span
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 5,
        border: '1px dashed rgba(255,255,255,.14)',
        background: 'rgba(255,255,255,.03)',
        display: 'inline-block',
      }}
    />
  )
}

export default function CareerEloTab({
  db,
  members = [],
  playerRatings = {},
  matches = [],
  levels = {},
  _onOpenEffectiveStrengthModal,
  onSelectMember,
  isMobile = false,
}) {
  const { isDark, isGlamorous } = useTheme()

  const myMember = useMemo(() => {
    if (!db || !db.currentUserId) return null
    return (db.members || []).find((m) => m.userId === db.currentUserId) || null
  }, [db])

  // Chuẩn bị dữ liệu danh sách thành viên - Hiện toàn bộ thành viên, xếp hạng liên tục 1..N
  const { allList, histogramData, medianElo, middleRangePct } = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 86400000
    const preloadedMatches = db ? (seasonMatchesOf(db) || []) : []
    const preloadedClubStats = db ? computeClubBadgeStats(db, null, preloadedMatches) : null

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
        highestBadge: db ? getMemberHighestBadge(m.id, db, null, preloadedMatches, preloadedClubStats) : null,
        streak: db ? (getMemberStreak(m.id, db, null, preloadedMatches).streak || 0) : 0,
      }
    })

    // Toàn bộ thành viên có xếp hạng liên tục 1..N
    const allSorted = [...list].sort((a, b) => b.rating - a.rating)
    allSorted.forEach((p, idx) => {
      p.rank = idx + 1
    })

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
      allList: allSorted,
      histogramData: histogramWithHeights,
      medianElo: med,
      middleRangePct: rangePct,
    }
  }, [members, playerRatings, matches, levels, isDark, db])

  const displayList = allList

  return (
    <div
      data-screen-label="SS2 Bang dang cap Elo"
      style={{
        display: 'grid',
        gap: 16,
      }}
    >
      {/* NỘI DUNG CHÍNH: 2 CỘT */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 356px',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* CỘT TRÁI: BẢNG XẾP HẠNG ELO TOÀN DIỆN */}
        <div style={{ display: 'grid', gap: 14 }}>
          {/* TỐP ĐẲNG CẤP 14a · Hào nhoáng */}
          {isGlamorous && allList.length >= 3 && (
            isMobile ? (
              /* Mobile Bục Tốp Đẳng Cấp Dạng Dọc (M11v2) */
              <div
                style={{
                  position: 'relative',
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: '1px solid #2E3E5C',
                  background: 'linear-gradient(180deg, #16202E, #101827 66%)',
                  padding: 12,
                  display: 'grid',
                  gap: 9,
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(66% 70% at 30% 0%, rgba(122,163,220,.16), transparent 72%)',
                    pointerEvents: 'none',
                  }}
                />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ font: "700 15px/1.2 'Barlow', sans-serif", color: '#FFFFFF' }}>
                    {t('season.topEloTitle14a')}
                  </span>
                  <span style={{ font: "400 11px/1.2 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                    {t('season.topEloSubtitle14a')}
                  </span>
                </div>

                {/* Top 1 Mobile (Thẻ ngang lớn vàng hoàng kim) */}
                {allList[0] && (
                  <div
                    onClick={() => onSelectMember && onSelectMember(allList[0])}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 12px 11px',
                      borderRadius: 11,
                      background: 'linear-gradient(150deg, rgba(240,183,92,.22), rgba(20,29,46,.94) 68%)',
                      border: '1px solid #C9A227',
                      cursor: onSelectMember ? 'pointer' : 'default',
                    }}
                  >
                    <div style={{ position: 'relative', width: 50, height: 50, flex: '0 0 auto', marginTop: 5 }}>
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
                          inset: -6,
                          borderRadius: 999,
                          background: 'radial-gradient(circle, rgba(240,183,92,.32), transparent 70%)',
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
                        <Avatar name={allList[0].name} src={allList[0].avatarUrl} size={44} />
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
                          border: '2px solid #161104',
                          display: 'grid',
                          placeItems: 'center',
                          font: "700 10px/1 'Barlow', sans-serif",
                          color: '#2A1F00',
                        }}
                      >
                        1
                      </div>
                    </div>
                    <div style={{ flex: '1 1 0%', minWidth: 0, display: 'grid', gap: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <SingleBadgeSlot badge={allList[0].highestBadge} size={19} />
                        <span style={{ font: "700 15.5px/1.15 'Barlow', sans-serif", color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {allList[0].name}
                        </span>
                        {myMember?.id === allList[0].id && (
                          <span style={{ font: "600 9.5px/1 'IBM Plex Mono', monospace", padding: '2px 6px', borderRadius: 999, background: 'rgba(29,80,160,.24)', border: '1px solid #1D50A0', color: '#B6CDEC' }}>
                            {t('season.youTag')}
                          </span>
                        )}
                        {allList[0].streak >= 5 ? (
                          <BountyBadgeTag streak={allList[0].streak} />
                        ) : allList[0].streak >= 3 ? (
                          <span style={{ font: "600 9.5px/1 'IBM Plex Mono', monospace", padding: '2px 6px', borderRadius: 999, background: 'rgba(0,178,169,.14)', border: '1px solid #00786F', color: '#5FDBD3' }}>
                            streak {allList[0].streak}
                          </span>
                        ) : null}
                        <div style={{ flex: '1 1 0%' }} />
                        <span style={{ font: "600 24px/1 'IBM Plex Mono', monospace", color: '#F7E3A1' }}>
                          {allList[0].rating}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: '1 1 0%', height: 6, borderRadius: 999, background: '#0B1220', overflow: 'hidden', display: 'flex' }}>
                          <span style={{ width: allList[0].confBarWidth, background: allList[0].confBarColor }} />
                        </span>
                        <span style={{ font: "600 10px/1 'IBM Plex Mono', monospace", color: allList[0].confColor, flex: '0 0 auto', letterSpacing: '.04em' }}>
                          {allList[0].confLabel}
                        </span>
                      </div>
                      <div style={{ font: "400 11px/1.2 'IBM Plex Mono', monospace", color: '#C6B683' }}>
                        {allList[0].gamesCount} {t('units.match')} · {allList[0].winRate}% ·{' '}
                        <span style={{ color: allList[0].delta30Days >= 0 ? '#5FDBD3' : '#F1A79D' }}>
                          {allList[0].delta30Days >= 0 ? `+${allList[0].delta30Days}` : `${allList[0].delta30Days}`} / 30 {t('units.day')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Top 2 Mobile (Thẻ ngang viền bạc) */}
                {allList[1] && (
                  <div
                    onClick={() => onSelectMember && onSelectMember(allList[1])}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 11,
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: 'linear-gradient(150deg, rgba(199,210,228,.12), rgba(20,29,46,.92) 66%)',
                      border: '1px solid #6F7F96',
                      cursor: onSelectMember ? 'pointer' : 'default',
                    }}
                  >
                    <div style={{ position: 'relative', width: 42, height: 42, flex: '0 0 auto' }}>
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: 999,
                          background: 'conic-gradient(from 210deg, #5B6B81, #C7D2E4, #FFFFFF, #8FA3BE, #5B6B81)',
                          boxShadow: '0 0 0 1px rgba(199,210,228,.45)',
                        }}
                      />
                      <div style={{ position: 'absolute', inset: 2.5, borderRadius: 999, overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                        <Avatar name={allList[1].name} src={allList[1].avatarUrl} size={37} />
                      </div>
                      <div
                        style={{
                          position: 'absolute',
                          right: -3,
                          bottom: -3,
                          width: 17,
                          height: 17,
                          borderRadius: 999,
                          background: 'linear-gradient(180deg, #EDF3FB, #8FA3BE)',
                          border: '2px solid #141D2B',
                          display: 'grid',
                          placeItems: 'center',
                          font: "700 9px/1 'Barlow', sans-serif",
                          color: '#1B2435',
                        }}
                      >
                        2
                      </div>
                    </div>
                    <div style={{ flex: '1 1 0%', minWidth: 0, display: 'grid', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <SingleBadgeSlot badge={allList[1].highestBadge} size={18} />
                        <span style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {allList[1].name}
                        </span>
                        {myMember?.id === allList[1].id && (
                          <span style={{ font: "600 9.5px/1 'IBM Plex Mono', monospace", padding: '2px 6px', borderRadius: 999, background: 'rgba(29,80,160,.24)', border: '1px solid #1D50A0', color: '#B6CDEC' }}>
                            {t('season.youTag')}
                          </span>
                        )}
                        {allList[1].streak >= 5 ? (
                          <BountyBadgeTag streak={allList[1].streak} />
                        ) : allList[1].streak >= 3 ? (
                          <span style={{ font: "600 9.5px/1 'IBM Plex Mono', monospace", padding: '2px 6px', borderRadius: 999, background: 'rgba(0,178,169,.14)', border: '1px solid #00786F', color: '#5FDBD3' }}>
                            streak {allList[1].streak}
                          </span>
                        ) : null}
                        <div style={{ flex: '1 1 0%' }} />
                        <span style={{ font: "600 20px/1 'IBM Plex Mono', monospace", color: '#DCE6F5' }}>
                          {allList[1].rating}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: '1 1 0%', height: 5, borderRadius: 999, background: '#0B1220', overflow: 'hidden', display: 'flex' }}>
                          <span style={{ width: allList[1].confBarWidth, background: allList[1].confBarColor }} />
                        </span>
                        <span style={{ font: "600 10px/1 'IBM Plex Mono', monospace", color: allList[1].confColor, flex: '0 0 auto', letterSpacing: '.04em' }}>
                          {allList[1].confLabel}
                        </span>
                        <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: allList[1].delta30Days >= 0 ? '#5FDBD3' : '#F1A79D' }}>
                          {allList[1].delta30Days >= 0 ? `+${allList[1].delta30Days}` : `${allList[1].delta30Days}`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Top 3 Mobile (Thẻ ngang viền đồng) */}
                {allList[2] && (
                  <div
                    onClick={() => onSelectMember && onSelectMember(allList[2])}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 11,
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: 'linear-gradient(150deg, rgba(200,128,74,.14), rgba(20,29,46,.92) 66%)',
                      border: '1px solid #8A4E24',
                      cursor: onSelectMember ? 'pointer' : 'default',
                    }}
                  >
                    <div style={{ position: 'relative', width: 42, height: 42, flex: '0 0 auto' }}>
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: 999,
                          background: 'conic-gradient(from 210deg, #6B3512, #C8804A, #F0C096, #B0562A, #6B3512)',
                          boxShadow: '0 0 0 1px rgba(240,192,150,.4)',
                        }}
                      />
                      <div style={{ position: 'absolute', inset: 2.5, borderRadius: 999, overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                        <Avatar name={allList[2].name} src={allList[2].avatarUrl} size={37} />
                      </div>
                      <div
                        style={{
                          position: 'absolute',
                          right: -3,
                          bottom: -3,
                          width: 17,
                          height: 17,
                          borderRadius: 999,
                          background: 'linear-gradient(180deg, #F0C096, #B0562A)',
                          border: '2px solid #1A1008',
                          display: 'grid',
                          placeItems: 'center',
                          font: "700 9px/1 'Barlow', sans-serif",
                          color: '#2A1405',
                        }}
                      >
                        3
                      </div>
                    </div>
                    <div style={{ flex: '1 1 0%', minWidth: 0, display: 'grid', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <SingleBadgeSlot badge={allList[2].highestBadge} size={18} />
                        <span style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {allList[2].name}
                        </span>
                        {myMember?.id === allList[2].id && (
                          <span style={{ font: "600 9.5px/1 'IBM Plex Mono', monospace", padding: '2px 6px', borderRadius: 999, background: 'rgba(29,80,160,.24)', border: '1px solid #1D50A0', color: '#B6CDEC' }}>
                            {t('season.youTag')}
                          </span>
                        )}
                        {allList[2].streak >= 5 ? (
                          <BountyBadgeTag streak={allList[2].streak} />
                        ) : allList[2].streak >= 3 ? (
                          <span style={{ font: "600 9.5px/1 'IBM Plex Mono', monospace", padding: '2px 6px', borderRadius: 999, background: 'rgba(0,178,169,.14)', border: '1px solid #00786F', color: '#5FDBD3' }}>
                            streak {allList[2].streak}
                          </span>
                        ) : null}
                        <div style={{ flex: '1 1 0%' }} />
                        <span style={{ font: "600 20px/1 'IBM Plex Mono', monospace", color: '#F0C096' }}>
                          {allList[2].rating}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: '1 1 0%', height: 5, borderRadius: 999, background: '#0B1220', overflow: 'hidden', display: 'flex' }}>
                          <span style={{ width: allList[2].confBarWidth, background: allList[2].confBarColor }} />
                        </span>
                        <span style={{ font: "600 10px/1 'IBM Plex Mono', monospace", color: allList[2].confColor, flex: '0 0 auto', letterSpacing: '.04em' }}>
                          {allList[2].confLabel}
                        </span>
                        <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: allList[2].delta30Days >= 0 ? '#5FDBD3' : '#F1A79D' }}>
                          {allList[2].delta30Days >= 0 ? `+${allList[2].delta30Days}` : `${allList[2].delta30Days}`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Desktop Bục Tốp Đẳng Cấp 3 Cột */
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
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 12,
                  }}
                >
                  {/* Top 1 Desktop */}
                  {allList[0] && (
                    <div
                      onClick={() => onSelectMember && onSelectMember(allList[0])}
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
                          <Avatar name={allList[0].name} src={allList[0].avatarUrl} size={42} />
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
                          {allList[0].name}
                        </div>
                        <div style={{ font: "600 26px/1 'IBM Plex Mono', monospace", color: '#F7E3A1' }}>
                          {allList[0].rating}
                        </div>
                        <div style={{ font: "400 11.5px/1.2 'IBM Plex Mono', monospace", color: '#C6B683' }}>
                          {t('season.statsDetail14a', {
                            matches: allList[0].totalGames,
                            conf: allList[0].confLabel,
                            delta: allList[0].delta30Days >= 0 ? `+${allList[0].delta30Days}` : `${allList[0].delta30Days}`,
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Top 2 Desktop */}
                  {allList[1] && (
                    <div
                      onClick={() => onSelectMember && onSelectMember(allList[1])}
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
                          <Avatar name={allList[1].name} src={allList[1].avatarUrl} size={38} />
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
                          {allList[1].name}
                        </div>
                        <div style={{ font: "600 24px/1 'IBM Plex Mono', monospace", color: '#E3EDFB' }}>
                          {allList[1].rating}
                        </div>
                        <div style={{ font: "400 11.5px/1.2 'IBM Plex Mono', monospace", color: '#A8B7CB' }}>
                          {t('season.statsDetail14a', {
                            matches: allList[1].totalGames,
                            conf: allList[1].confLabel,
                            delta: allList[1].delta30Days >= 0 ? `+${allList[1].delta30Days}` : `${allList[1].delta30Days}`,
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Top 3 Desktop */}
                  {allList[2] && (
                    <div
                      onClick={() => onSelectMember && onSelectMember(allList[2])}
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
                          <Avatar name={allList[2].name} src={allList[2].avatarUrl} size={38} />
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
                          {allList[2].name}
                        </div>
                        <div style={{ font: "600 24px/1 'IBM Plex Mono', monospace", color: '#F5E0D0' }}>
                          {allList[2].rating}
                        </div>
                        <div style={{ font: "400 11.5px/1.2 'IBM Plex Mono', monospace", color: '#A8B7CB' }}>
                          {t('season.statsDetail14a', {
                            matches: allList[2].totalGames,
                            conf: allList[2].confLabel,
                            delta: allList[2].delta30Days >= 0 ? `+${allList[2].delta30Days}` : `${allList[2].delta30Days}`,
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {/* BẢNG XẾP HẠNG ELO TOÀN BỘ (Hiện tất cả thành viên, không lọc) */}
          {isMobile && isGlamorous ? (
            /* TOÀN BẢNG MOBILE HÀO NHOÁNG (M11v2) */
            <div style={{ background: '#141D2E', border: '1px solid #22304A', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '9px 12px', borderBottom: '1px solid #22304A', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ font: "600 12.5px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                  {t('season.wholeTable')}
                </span>
                <div style={{ flex: '1 1 0%' }} />
                <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                  {t('season.wholeTableCount', { n: allList.length })}
                </span>
              </div>

              {(allList.length > 3 ? allList.slice(3) : allList).map((player, idx, arr) => {
                const isMe = myMember && myMember.id === player.id
                const deltaColor = player.delta30Days > 0 ? '#5FDBD3' : player.delta30Days < 0 ? '#F1A79D' : '#8494AA'
                const deltaSign = player.delta30Days > 0 ? `+${player.delta30Days}` : player.delta30Days < 0 ? `${player.delta30Days}` : '0'

                return (
                  <div
                    key={player.id}
                    onClick={() => onSelectMember && onSelectMember(player)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '9px 12px',
                      borderBottom: idx === arr.length - 1 ? 'none' : '1px solid rgba(34,48,74,.6)',
                      background: isMe ? 'rgba(29,80,160,.12)' : 'transparent',
                      cursor: onSelectMember ? 'pointer' : 'default',
                    }}
                  >
                    <span style={{ width: 20, font: "600 12px/1 'IBM Plex Mono', monospace", color: isMe ? '#B6CDEC' : '#A8B7CB' }}>
                      {player.rank}
                    </span>
                    <Avatar name={player.name} src={player.avatarUrl} size={30} />
                    <SingleBadgeSlot badge={player.highestBadge} size={18} />
                    <div style={{ flex: '1 1 0%', minWidth: 0, display: 'grid', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ font: "600 13.5px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {player.name}
                        </span>
                        {isMe && (
                          <span style={{ font: "600 9.5px/1 'IBM Plex Mono', monospace", padding: '3px 6px', borderRadius: 999, background: 'rgba(29,80,160,.24)', border: '1px solid #1D50A0', color: '#B6CDEC' }}>
                            {t('season.youTag')}
                          </span>
                        )}
                        {player.streak >= 5 ? (
                          <BountyBadgeTag streak={player.streak} />
                        ) : player.streak >= 3 ? (
                          <span style={{ font: "600 9.5px/1 'IBM Plex Mono', monospace", padding: '2px 6px', borderRadius: 999, background: 'rgba(0,178,169,.14)', border: '1px solid #00786F', color: '#5FDBD3' }}>
                            streak {player.streak}
                          </span>
                        ) : null}
                      </div>
                      <div style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                        {player.gamesCount} {t('units.match')} · {player.confLabel} ·{' '}
                        <span style={{ color: deltaColor }}>{deltaSign}</span>
                      </div>
                    </div>
                    <span style={{ font: "600 17px/1 'IBM Plex Mono', monospace", color: '#E9EFF7' }}>
                      {player.rating}
                    </span>
                  </div>
                )
              })}

              <div style={{ padding: '10px 12px', background: '#101927', borderTop: '1px solid #22304A', font: "400 12px/1.5 'IBM Plex Sans', sans-serif", color: '#A8B7CB' }}>
                {t('season.eloSingleBadgeFooterNote14a')}
              </div>
            </div>
          ) : (
            /* DESKTOP / SIMPLE ELO TABLE */
            <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }}>
              <div style={{ padding: '10px 13px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                  {t('season.officialRankCount14a', { n: allList.length })}
                </span>
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

              {/* Danh sách thành viên (Mobile Simple & Desktop) */}
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
                  const isMe = myMember && myMember.id === player.id
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
                        background: glamBg || (isMe ? (isDark ? 'rgba(29,80,160,.14)' : 'rgba(29,80,160,.06)') : 'transparent'),
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (onSelectMember) e.currentTarget.style.background = isGlamTopAny ? glamBg : isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)'
                      }}
                      onMouseLeave={(e) => {
                        if (onSelectMember) e.currentTarget.style.background = glamBg || (isMe ? (isDark ? 'rgba(29,80,160,.14)' : 'rgba(29,80,160,.06)') : 'transparent')
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ font: "600 14px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {player.name}
                            </span>
                            {isMe && (
                              <span style={{ font: "600 9.5px/1 'IBM Plex Mono', monospace", padding: '2px 6px', borderRadius: 999, background: 'rgba(29,80,160,.24)', border: '1px solid #1D50A0', color: '#B6CDEC' }}>
                                {t('season.youTag')}
                              </span>
                            )}
                          </div>
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
                          {myMember && myMember.id === player.id && (
                            <span style={{ font: "600 9.5px/1 'IBM Plex Mono', monospace", padding: '2px 6px', borderRadius: 999, background: 'rgba(29,80,160,.24)', border: '1px solid #1D50A0', color: '#B6CDEC' }}>
                              {t('season.youTag')}
                            </span>
                          )}
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
