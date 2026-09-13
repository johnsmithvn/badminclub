import { useMemo } from 'react'
import { Avatar } from '#ds'
import { t } from '#i18n'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { useApp } from '#contexts/AppContext.jsx'
import BadgeHex from '#components/badges/BadgeHex.jsx'
import { getBadgeById } from '#lib/badges.js'
import RankMedalIcon from '#components/leaderboard/RankMedalIcon.jsx'

function MiniShelf({ shelf = [], size = 18 }) {
  if (!shelf || !shelf.length) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
      {shelf.slice(0, 3).map((badgeId, idx) => {
        const b = getBadgeById(badgeId)
        if (!b) return null
        return (
          <BadgeHex
            key={idx}
            tier={b.tier}
            glyph={b.glyph}
            size={size}
          />
        )
      })}
    </span>
  )
}

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

export default function SeasonRaceTab({
  seasonLeaderboardData,
  onOpenLedger,
  isMobile = false,
  genderFilter = 'all',
  onGenderFilterChange,
}) {
  const { db } = useApp()
  const { isDark, isGlamorous } = useTheme()

  const myMember = useMemo(() => {
    if (!db || !db.currentUserId) return null
    return (db.members || []).find((m) => m.userId === db.currentUserId) || null
  }, [db])

  const { season, leaderboard = [], topStats = {} } = seasonLeaderboardData || {}

  const totalCount = leaderboard.length
  const maleCount = useMemo(() => leaderboard.filter((r) => (r.gender || 'nam') === 'nam').length, [leaderboard])
  const femaleCount = useMemo(() => leaderboard.filter((r) => (r.gender || 'nam') === 'nu').length, [leaderboard])

  const filteredLeaderboard = useMemo(() => {
    if (genderFilter === 'all') return leaderboard
    return leaderboard
      .filter((r) => (r.gender || 'nam') === genderFilter)
      .map((r, idx) => ({ ...r, rank: idx + 1, originalRank: r.rank }))
  }, [leaderboard, genderFilter])

  const top1 = filteredLeaderboard[0] || null
  const top2 = filteredLeaderboard[1] || null
  const top3 = filteredLeaderboard[2] || null

  let top3EloRank = 1
  if (top3) {
    const sorted = [...filteredLeaderboard].sort((a, b) => (b.rating || 0) - (a.rating || 0))
    const idx = sorted.findIndex((x) => x.id === top3.id)
    top3EloRank = idx >= 0 ? idx + 1 : 1
  }

  const totalSessionsExpected = season?.totalSessionsExpected || 14
  const playedSessions = topStats.playedSessionsCount ?? 0
  const progressPct = totalSessionsExpected > 0 ? Math.min(100, Math.round((playedSessions / totalSessionsExpected) * 100)) : 0
  const remainingSessions = Math.max(0, totalSessionsExpected - playedSessions)
  const maxPossiblePts = remainingSessions * 3 * 22

  return (
    <div
      data-screen-label="SS1 Dua top mua giai"
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 356px',
        gap: 16,
        alignItems: 'start',
      }}
    >
      {/* CỘT TRÁI (BẢNG ĐUA TOP & TIẾN TRÌNH) */}
      <div style={{ display: 'grid', gap: 12 }}>
        {/* 1. Tiến trình mùa */}
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
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
              {t('season.progressTitle')}
            </span>
            <span style={{ font: "400 12px/1.2 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
              {t('season.sessionProgress', { n: playedSessions, total: totalSessionsExpected, pct: progressPct })}
            </span>
            <div style={{ flex: '1 1 0%' }} />
            <span
              style={{
                font: "600 11px/1 'IBM Plex Mono', monospace",
                padding: '5px 8px',
                borderRadius: 999,
                background: isDark ? 'rgba(0,178,169,.14)' : 'rgba(0,178,169,.10)',
                border: '1px solid var(--teal-500)',
                color: isDark ? '#5FDBD3' : 'var(--teal-700)',
              }}
            >
              {t('season.running')}
            </span>
          </div>

          <div
            style={{
              height: 10,
              borderRadius: 999,
              background: 'var(--surface-inset)',
              border: '1px solid var(--border-subtle)',
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #00786F, #00B2A9)',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              font: "400 11px/1.2 'IBM Plex Mono', monospace",
              color: 'var(--text-muted)',
            }}
          >
            <span>{season?.startDate?.slice(5) || '01/07'}</span>
            <span>{t('season.remainingSessionDesc', { n: remainingSessions, pts: maxPossiblePts })}</span>
            <span>{season?.endDate?.slice(5) || '30/09'}</span>
          </div>
        </div>

        {/* Bộ lọc giới tính Nam / Nữ */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: 3,
              gap: 2,
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            <button
              type="button"
              onClick={() => onGenderFilterChange && onGenderFilterChange('all')}
              style={{
                font: "600 12px/1 'IBM Plex Sans', sans-serif",
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: genderFilter === 'all' ? (isDark ? 'var(--navy-700)' : '#00B2A9') : 'transparent',
                color: genderFilter === 'all' ? '#FFFFFF' : 'var(--text-secondary)',
                fontWeight: genderFilter === 'all' ? 700 : 500,
                transition: 'all 0.15s ease',
              }}
            >
              <span>{t('gender.all')}</span>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "'IBM Plex Mono', monospace",
                  padding: '2px 6px',
                  borderRadius: 999,
                  background: genderFilter === 'all' ? 'rgba(255,255,255,.22)' : 'var(--surface-inset)',
                  color: genderFilter === 'all' ? '#FFFFFF' : 'var(--text-muted)',
                }}
              >
                {totalCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onGenderFilterChange && onGenderFilterChange('nam')}
              style={{
                font: "600 12px/1 'IBM Plex Sans', sans-serif",
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: genderFilter === 'nam' ? '#1D50A0' : 'transparent',
                color: genderFilter === 'nam' ? '#FFFFFF' : 'var(--text-secondary)',
                fontWeight: genderFilter === 'nam' ? 700 : 500,
                transition: 'all 0.15s ease',
              }}
            >
              <span>♂ {t('gender.nam')}</span>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "'IBM Plex Mono', monospace",
                  padding: '2px 6px',
                  borderRadius: 999,
                  background: genderFilter === 'nam' ? 'rgba(255,255,255,.22)' : 'var(--surface-inset)',
                  color: genderFilter === 'nam' ? '#FFFFFF' : 'var(--text-muted)',
                }}
              >
                {maleCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onGenderFilterChange && onGenderFilterChange('nu')}
              style={{
                font: "600 12px/1 'IBM Plex Sans', sans-serif",
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: genderFilter === 'nu' ? '#D946EF' : 'transparent',
                color: genderFilter === 'nu' ? '#FFFFFF' : 'var(--text-secondary)',
                fontWeight: genderFilter === 'nu' ? 700 : 500,
                transition: 'all 0.15s ease',
              }}
            >
              <span>♀ {t('gender.nu')}</span>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "'IBM Plex Mono', monospace",
                  padding: '2px 6px',
                  borderRadius: 999,
                  background: genderFilter === 'nu' ? 'rgba(255,255,255,.22)' : 'var(--surface-inset)',
                  color: genderFilter === 'nu' ? '#FFFFFF' : 'var(--text-muted)',
                }}
              >
                {femaleCount}
              </span>
            </button>
          </div>
        </div>

        {/* 2. Podium Top 3 */}
        {filteredLeaderboard.length >= 3 && (
          isGlamorous ? (
            isMobile ? (
              /* Bục Tốp 3 14a · M10v2 Mobile Hào nhoáng */
              <div
                style={{
                  position: 'relative',
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: '1px solid #2E3E5C',
                  background: 'linear-gradient(180deg, #18212F, #101827 62%)',
                  padding: 12,
                  display: 'grid',
                  gap: 10,
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(66% 70% at 50% 0%, rgba(240,183,92,.20), transparent 74%)',
                    pointerEvents: 'none',
                  }}
                />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ font: "700 15px/1.2 'Barlow', sans-serif", color: '#FFFFFF' }}>
                    {t('season.podiumTitle14a', { seasonNumber: season?.number || 3 })}
                  </span>
                  <div style={{ flex: 1 }} />
                  <span
                    style={{
                      font: "600 10.5px/1 'IBM Plex Mono', monospace",
                      padding: '5px 8px',
                      borderRadius: 999,
                      background: 'rgba(240,183,92,.14)',
                      border: '1px solid #8A6F16',
                      color: '#F0D26A',
                    }}
                  >
                    {t('season.sessionsRemainingChip', { count: remainingSessions })}
                  </span>
                </div>

                {/* Top 1 Thẻ Ngang Lớn */}
                <div
                  onClick={() => top1 && onOpenLedger && onOpenLedger(top1.id)}
                  title={`${t('season.viewLedgerBtn')}: ${top1?.name || ''}`}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '13px 12px 12px',
                    borderRadius: 11,
                    background: 'linear-gradient(180deg, rgba(240,183,92,.24), rgba(20,29,46,.94) 70%)',
                    border: '1px solid #C9A227',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ position: 'relative', width: 54, height: 54, flex: '0 0 auto', marginTop: 6 }}>
                    <div
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: -15,
                        transform: 'translateX(-50%)',
                        width: 26,
                        height: 16,
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
                        background: 'radial-gradient(circle, rgba(240,183,92,.36), transparent 70%)',
                        animation: 'medalGlow 4.4s ease-in-out infinite',
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
                      <Avatar name={top1?.name} src={top1?.avatarUrl || top1?.avatar} size={48} />
                    </div>
                    <div
                      style={{
                        position: 'absolute',
                        right: -4,
                        bottom: -4,
                        width: 20,
                        height: 20,
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
                  <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ font: "700 16px/1.15 'Barlow', sans-serif", color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {top1?.name}
                      </span>
                      {top1?.streak >= 5 ? (
                        <BountyBadgeTag streak={top1.streak} />
                      ) : top1?.streak >= 3 ? (
                        <span
                          style={{
                            font: "600 10.5px/1 'IBM Plex Mono', monospace",
                            padding: '3px 7px',
                            borderRadius: 999,
                            background: 'rgba(0,178,169,.14)',
                            border: '1px solid #00786F',
                            color: '#5FDBD3',
                          }}
                        >
                          streak {top1.streak}
                        </span>
                      ) : null}
                      <div style={{ flex: 1 }} />
                      <span style={{ font: "600 26px/1 'IBM Plex Mono', monospace", color: '#F7E3A1' }}>
                        {top1?.totalSeasonPoints?.toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                      <MiniShelf shelf={top1?.badgeShelf || top1?.member?.badgeShelf || top1?.member?.badge_shelf || []} size={19} />
                    </div>
                    <div style={{ font: "400 11.5px/1.3 'IBM Plex Mono', monospace", color: '#C6B683' }}>
                      {top1?.attendedCount || top1?.sessionsCount || 0} {t('units.session')} · {top1?.matchesCount || 0} {t('units.match')} · {top1?.upsetsCount || 0} upset
                    </div>
                  </div>
                </div>

                {/* Top 2 & Top 3 Cards in 2 columns */}
                <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                  {/* Top 2 */}
                  <div
                    onClick={() => top2 && onOpenLedger && onOpenLedger(top2.id)}
                    title={`${t('season.viewLedgerBtn')}: ${top2?.name || ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: 10,
                      borderRadius: 10,
                      background: 'linear-gradient(150deg, rgba(199,210,228,.13), rgba(20,29,46,.92) 66%)',
                      border: '1px solid #6F7F96',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ position: 'relative', width: 40, height: 40, flex: '0 0 auto' }}>
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
                        <Avatar name={top2?.name} src={top2?.avatarUrl || top2?.avatar} size={35} />
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
                    <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {top2?.name}
                        </span>
                        {top2?.streak >= 5 ? (
                          <BountyBadgeTag streak={top2.streak} />
                        ) : top2?.streak >= 3 ? (
                          <span style={{ font: "600 9px/1 'IBM Plex Mono', monospace", padding: '2px 5px', borderRadius: 999, background: 'rgba(0,178,169,.14)', border: '1px solid #00786F', color: '#5FDBD3' }}>
                            {top2.streak}W
                          </span>
                        ) : null}
                      </div>
                      <div style={{ font: "600 19px/1 'IBM Plex Mono', monospace", color: '#DCE6F5' }}>
                        {top2?.totalSeasonPoints?.toLocaleString()}
                      </div>
                      <MiniShelf shelf={top2?.badgeShelf || top2?.member?.badgeShelf || top2?.member?.badge_shelf || []} size={16} />
                      <div style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                        {t('season.behindTop1', { diff: ((top1?.totalSeasonPoints || 0) - (top2?.totalSeasonPoints || 0)).toLocaleString() })}
                      </div>
                    </div>
                  </div>

                  {/* Top 3 */}
                  <div
                    onClick={() => top3 && onOpenLedger && onOpenLedger(top3.id)}
                    title={`${t('season.viewLedgerBtn')}: ${top3?.name || ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: 10,
                      borderRadius: 10,
                      background: 'linear-gradient(150deg, rgba(200,128,74,.15), rgba(20,29,46,.92) 66%)',
                      border: '1px solid #8A4E24',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ position: 'relative', width: 40, height: 40, flex: '0 0 auto' }}>
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
                        <Avatar name={top3?.name} src={top3?.avatarUrl || top3?.avatar} size={35} />
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
                    <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {top3?.name}
                        </span>
                        {top3?.streak >= 5 ? (
                          <BountyBadgeTag streak={top3.streak} />
                        ) : top3?.streak >= 3 ? (
                          <span style={{ font: "600 9px/1 'IBM Plex Mono', monospace", padding: '2px 5px', borderRadius: 999, background: 'rgba(0,178,169,.14)', border: '1px solid #00786F', color: '#5FDBD3' }}>
                            {top3.streak}W
                          </span>
                        ) : null}
                      </div>
                      <div style={{ font: "600 19px/1 'IBM Plex Mono', monospace", color: '#F0C096' }}>
                        {top3?.totalSeasonPoints?.toLocaleString()}
                      </div>
                      <MiniShelf shelf={top3?.badgeShelf || top3?.member?.badgeShelf || top3?.member?.badge_shelf || []} size={16} />
                      <div style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: '#F0D26A' }}>
                        {top3EloRank ? t('season.eloRankClub', { rank: top3EloRank }) : t('season.behindTop1', { diff: ((top1?.totalSeasonPoints || 0) - (top3?.totalSeasonPoints || 0)).toLocaleString() })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Bục Tốp 3 14a · Desktop Hào nhoáng */
              <div
                style={{
                  position: 'relative',
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: '1px solid #2E3E5C',
                  background: 'linear-gradient(180deg, #18212F, #101827 58%, #0D1422)',
                  padding: '13px 14px 14px',
                  display: 'grid',
                  gap: 11,
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(58% 78% at 50% 0%, rgba(240,183,92,.22), transparent 72%)',
                    pointerEvents: 'none',
                  }}
                />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ font: "700 17px/1.2 'Barlow', sans-serif", letterSpacing: '-0.01em', color: '#FFFFFF' }}>
                    {t('season.podiumTitle14a', { seasonNumber: season?.number || 3 })}
                  </span>
                  <span style={{ font: "400 12px/1.2 'IBM Plex Mono', monospace", color: '#C6B683' }}>
                    {t('season.podiumSubtitle14a', { sessions: totalSessionsExpected })}
                  </span>
                  <div style={{ flex: 1 }} />
                  <span
                    style={{
                      font: "600 11px/1 'IBM Plex Mono', monospace",
                      padding: '5px 9px',
                      borderRadius: 999,
                      background: 'rgba(240,183,92,.14)',
                      border: '1px solid #8A6F16',
                      color: '#F0D26A',
                    }}
                  >
                    {t('season.podiumRemainingChip14a', { remaining: remainingSessions, maxPts: maxPossiblePts })}
                  </span>
                </div>

                <div
                  style={{
                    position: 'relative',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 11,
                    alignItems: 'end',
                  }}
                >
                  {/* #2 Á Quân */}
                  <div
                    onClick={() => top2 && onOpenLedger && onOpenLedger(top2.id)}
                    title={`${t('season.viewLedgerBtn')}: ${top2?.name || ''}`}
                    style={{
                      borderRadius: 11,
                      padding: '13px 12px',
                      display: 'grid',
                      gap: 7,
                      justifyItems: 'center',
                      textAlign: 'center',
                      background: 'linear-gradient(180deg, rgba(199,210,228,.14), rgba(20,29,46,.92) 64%)',
                      border: '1px solid #6F7F96',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease',
                    }}
                  >
                    <div style={{ position: 'relative', width: 50, height: 50 }}>
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: 999,
                          background: 'conic-gradient(from 210deg, #5B6B81, #C7D2E4, #FFFFFF, #8FA3BE, #5B6B81)',
                          boxShadow: '0 0 0 1px rgba(199,210,228,.5), 0 8px 18px rgba(143,163,190,.22)',
                        }}
                      />
                      <div style={{ position: 'absolute', inset: 3, borderRadius: 999, overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                        <Avatar name={top2?.name} src={top2?.avatarUrl || top2?.avatar} size={44} />
                      </div>
                      <div
                        style={{
                          position: 'absolute',
                          right: -4,
                          bottom: -4,
                          width: 19,
                          height: 19,
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
                    <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#FFFFFF' }}>
                      {top2?.name}
                    </div>
                    <div style={{ font: "600 24px/1 'IBM Plex Mono', monospace", color: '#DCE6F5' }}>
                      {top2?.totalSeasonPoints?.toLocaleString()}
                    </div>
                    <MiniShelf shelf={top2?.badgeShelf || top2?.member?.badgeShelf || top2?.member?.badge_shelf || []} />
                    <div style={{ font: "400 11px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                      {top2?.matchesCount} {t('units.match')} · {top2?.winsCount}W–{top2?.lossesCount}L · {top2?.winRate}%
                    </div>
                  </div>

                  {/* #1 Quán Quân */}
                  <div
                    onClick={() => top1 && onOpenLedger && onOpenLedger(top1.id)}
                    title={`${t('season.viewLedgerBtn')}: ${top1?.name || ''}`}
                    style={{
                      borderRadius: 12,
                      padding: '16px 14px',
                      display: 'grid',
                      gap: 8,
                      justifyItems: 'center',
                      textAlign: 'center',
                      background: 'linear-gradient(180deg, rgba(255,214,107,.24), rgba(20,29,46,.94) 64%)',
                      border: '1px solid #D4A836',
                      boxShadow: '0 0 24px rgba(212,168,54,.25)',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease',
                    }}
                  >
                    <div style={{ position: 'relative', width: 56, height: 56 }}>
                      {/* Vương miện Top 1 */}
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
                          inset: 0,
                          borderRadius: 999,
                          background: 'conic-gradient(from 210deg, #7A5620, #F0B75C, #FFF3C4, #F0D26A, #7A5620)',
                          boxShadow: '0 0 0 1px rgba(247,227,161,.55), 0 10px 22px rgba(201,162,39,.32)',
                        }}
                      />
                      <div style={{ position: 'absolute', inset: 3, borderRadius: 999, overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                        <Avatar name={top1?.name} src={top1?.avatarUrl || top1?.avatar} size={50} />
                      </div>
                      <div
                        style={{
                          position: 'absolute',
                          right: -4,
                          bottom: -4,
                          width: 20,
                          height: 20,
                          borderRadius: 999,
                          background: 'linear-gradient(180deg, #FFF3C4, #C9A227)',
                          border: '2px solid #171206',
                          display: 'grid',
                          placeItems: 'center',
                          font: "700 11px/1 'Barlow', sans-serif",
                          color: '#2A1F00',
                        }}
                      >
                        1
                      </div>
                    </div>
                    <div style={{ font: "700 16px/1.2 'IBM Plex Sans', sans-serif", color: '#FFFFFF' }}>
                      {top1?.name}
                    </div>
                    <div style={{ font: "700 32px/1 'IBM Plex Mono', monospace", color: '#F7E3A1' }}>
                      {top1?.totalSeasonPoints?.toLocaleString()}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                      <MiniShelf shelf={top1?.badgeShelf || top1?.member?.badgeShelf || top1?.member?.badge_shelf || []} />
                      {top1?.streak >= 5 && <BountyBadgeTag streak={top1.streak} />}
                    </div>
                    <div style={{ font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: '#C6B683' }}>
                      {top1?.matchesCount} {t('units.match')} · {top1?.winsCount}W–{top1?.lossesCount}L · {top1?.winRate}% · {top1?.upsetsCount} upset
                    </div>
                  </div>

                  {/* #3 Quý Quân */}
                  <div
                    onClick={() => top3 && onOpenLedger && onOpenLedger(top3.id)}
                    title={`${t('season.viewLedgerBtn')}: ${top3?.name || ''}`}
                    style={{
                      borderRadius: 11,
                      padding: '13px 12px',
                      display: 'grid',
                      gap: 7,
                      justifyItems: 'center',
                      textAlign: 'center',
                      background: 'linear-gradient(180deg, rgba(232,180,140,.14), rgba(20,29,46,.92) 64%)',
                      border: '1px solid #A66A38',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease',
                    }}
                  >
                    <div style={{ position: 'relative', width: 48, height: 48 }}>
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: 999,
                          background: 'conic-gradient(from 210deg, #5C2C10, #C77C48, #F5C09A, #C77C48, #5C2C10)',
                          boxShadow: '0 0 0 1px rgba(232,180,140,.45), 0 8px 18px rgba(166,106,56,.2)',
                        }}
                      />
                      <div style={{ position: 'absolute', inset: 3, borderRadius: 999, overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                        <Avatar name={top3?.name} src={top3?.avatarUrl || top3?.avatar} size={42} />
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
                    <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#FFFFFF' }}>
                      {top3?.name}
                    </div>
                    <div style={{ font: "600 22px/1 'IBM Plex Mono', monospace", color: '#E8C8AE' }}>
                      {top3?.totalSeasonPoints?.toLocaleString()}
                    </div>
                    <MiniShelf shelf={top3?.badgeShelf || top3?.member?.badgeShelf || top3?.member?.badge_shelf || []} />
                    <div style={{ font: "400 11px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                      {top3?.matchesCount} {t('units.match')} · {top3?.winsCount}W–{top3?.lossesCount}L · {top3?.winRate}%
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : isMobile ? (
            /* Mobile Podium: Card #1 to ở trên, #2 và #3 chia 2 cột ở dưới */
            <div style={{ display: 'grid', gap: 10 }}>
              {/* #1 Dẫn Đầu (Gold Card) */}
              <div
                onClick={() => top1 && onOpenLedger && onOpenLedger(top1.id)}
                title={`${t('season.viewLedgerBtn')}: ${top1?.name || ''}`}
                style={{
                  background: isDark
                    ? 'linear-gradient(180deg, rgba(201,162,39,.18), var(--surface-card))'
                    : 'linear-gradient(180deg, rgba(245,158,11,.14), var(--surface-card))',
                  border: '1px solid #C9A227',
                  borderRadius: 10,
                  padding: 14,
                  display: 'grid',
                  gap: 7,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: isDark ? '#F0D26A' : '#B45309' }}>#1</div>
                  <span
                    style={{
                      font: "600 10px/1 'IBM Plex Mono', monospace",
                      letterSpacing: '.06em',
                      padding: '4px 7px',
                      borderRadius: 999,
                      background: '#C9A227',
                      color: '#2A1F00',
                    }}
                  >
                    {t('season.leaderBadge')}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexWrap: 'wrap' }}>
                    <Avatar name={top1?.name} src={top1?.avatarUrl || top1?.avatar} size={34} />
                    <span style={{ font: "600 17px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {top1?.name}
                    </span>
                    {top1?.streak >= 5 ? (
                      <BountyBadgeTag streak={top1.streak} />
                    ) : top1?.streak >= 3 ? (
                      <span
                        style={{
                          font: "600 11px/1 'IBM Plex Mono', monospace",
                          padding: '3px 8px',
                          borderRadius: 999,
                          background: 'rgba(0,178,169,.14)',
                          border: '1px solid #00786F',
                          color: '#5FDBD3',
                        }}
                      >
                        streak {top1.streak}
                      </span>
                    ) : null}
                    <MiniShelf shelf={top1?.badgeShelf || top1?.member?.badgeShelf || top1?.member?.badge_shelf || []} />
                  </div>
                  <span style={{ font: "600 32px/1 'IBM Plex Mono', monospace", color: isDark ? '#F7E3A1' : '#B45309' }}>
                    {top1?.totalSeasonPoints?.toLocaleString()}
                  </span>
                </div>
                <div style={{ font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: isDark ? '#C6B683' : '#92400E' }}>
                  {top1?.matchesCount} {t('units.match')} · {top1?.winsCount}W–{top1?.lossesCount}L · {top1?.winRate}% · {top1?.upsetsCount} upset
                </div>
              </div>

              {/* #2 Á Quân & #3 Quý Quân chia 2 cột */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div
                  onClick={() => top2 && onOpenLedger && onOpenLedger(top2.id)}
                  title={`${t('season.viewLedgerBtn')}: ${top2?.name || ''}`}
                  style={{
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 10,
                    padding: 12,
                    display: 'grid',
                    gap: 5,
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <div style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>#2</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <Avatar name={top2?.name} src={top2?.avatarUrl || top2?.avatar} size={26} />
                    <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {top2?.name}
                    </div>
                  </div>
                  <div style={{ font: "600 22px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                    {top2?.totalSeasonPoints?.toLocaleString()}
                  </div>
                  <div style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                    {top2?.matchesCount} {t('units.match')} · {top2?.winsCount}W–{top2?.lossesCount}L · {top2?.winRate}%
                  </div>
                </div>

                <div
                  onClick={() => top3 && onOpenLedger && onOpenLedger(top3.id)}
                  title={`${t('season.viewLedgerBtn')}: ${top3?.name || ''}`}
                  style={{
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 10,
                    padding: 12,
                    display: 'grid',
                    gap: 5,
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <div style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>#3</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <Avatar name={top3?.name} src={top3?.avatarUrl || top3?.avatar} size={26} />
                    <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {top3?.name}
                    </div>
                  </div>
                  <div style={{ font: "600 22px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                    {top3?.totalSeasonPoints?.toLocaleString()}
                  </div>
                  <div style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                    {top3?.matchesCount} {t('units.match')} · {top3?.winsCount}W–{top3?.lossesCount}L · {top3?.winRate}%
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Desktop Podium: 3 cột ngang */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 12,
                alignItems: 'end',
              }}
            >
              {/* #2 Á Quân */}
              <div
                onClick={() => top2 && onOpenLedger && onOpenLedger(top2.id)}
                title={`${t('season.viewLedgerBtn')}: ${top2?.name || ''}`}
                style={{
                  background: 'var(--surface-card)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 10,
                  padding: 14,
                  display: 'grid',
                  gap: 7,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-xs)',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                }}
              >
                <div style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>#2</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  <Avatar name={top2?.name} src={top2?.avatarUrl || top2?.avatar} size={30} />
                  <div style={{ font: "600 15px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {top2?.name}
                  </div>
                </div>
                <div style={{ font: "600 26px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                  {top2?.totalSeasonPoints?.toLocaleString()}
                </div>
                <div style={{ font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                  {top2?.matchesCount} {t('units.match')} · {top2?.winsCount}W–{top2?.lossesCount}L · {top2?.winRate}%
                </div>
              </div>

              {/* #1 Dẫn Đầu (Gold Card) */}
              <div
                onClick={() => top1 && onOpenLedger && onOpenLedger(top1.id)}
                title={`${t('season.viewLedgerBtn')}: ${top1?.name || ''}`}
                style={{
                  background: isDark
                    ? 'linear-gradient(180deg, rgba(201,162,39,.18), var(--surface-card))'
                    : 'linear-gradient(180deg, rgba(245,158,11,.14), var(--surface-card))',
                  border: '1px solid #C9A227',
                  borderRadius: 10,
                  padding: '18px 14px',
                  display: 'grid',
                  gap: 7,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: isDark ? '#F0D26A' : '#B45309' }}>#1</div>
                  <span
                    style={{
                      font: "600 10px/1 'IBM Plex Mono', monospace",
                      letterSpacing: '.06em',
                      padding: '4px 7px',
                      borderRadius: 999,
                      background: '#C9A227',
                      color: '#2A1F00',
                    }}
                  >
                    {t('season.leaderBadge')}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <Avatar name={top1?.name} src={top1?.avatarUrl || top1?.avatar} size={36} />
                  <div style={{ font: "600 17px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {top1?.name}
                  </div>
                </div>
                <div style={{ font: "600 32px/1 'IBM Plex Mono', monospace", color: isDark ? '#F7E3A1' : '#B45309' }}>
                  {top1?.totalSeasonPoints?.toLocaleString()}
                </div>
                <div style={{ font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: isDark ? '#C6B683' : '#92400E' }}>
                  {top1?.matchesCount} {t('units.match')} · {top1?.winsCount}W–{top1?.lossesCount}L · {top1?.winRate}% · {top1?.upsetsCount} upset
                </div>
              </div>

              {/* #3 Quý Quân */}
              <div
                onClick={() => top3 && onOpenLedger && onOpenLedger(top3.id)}
                title={`${t('season.viewLedgerBtn')}: ${top3?.name || ''}`}
                style={{
                  background: 'var(--surface-card)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 10,
                  padding: 14,
                  display: 'grid',
                  gap: 7,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-xs)',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                }}
              >
                <div style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>#3</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  <Avatar name={top3?.name} src={top3?.avatarUrl || top3?.avatar} size={30} />
                  <div style={{ font: "600 15px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {top3?.name}
                  </div>
                </div>
                <div style={{ font: "600 26px/1 'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                  {top3?.totalSeasonPoints?.toLocaleString()}
                </div>
                <div style={{ font: "400 12px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                  {top3?.matchesCount} {t('units.match')} · {top3?.winsCount}W–{top3?.lossesCount}L · {top3?.winRate}%
                </div>
              </div>
            </div>
          )
        )}

        {/* 3. Bảng Xếp Hạng Toàn Bộ */}
        {isMobile && isGlamorous ? (
          /* Toàn bảng Mobile · M10v2 Hào nhoáng */
          <div>
            <div
              style={{
                background: '#141D2E',
                border: '1px solid #22304A',
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '9px 12px',
                  borderBottom: '1px solid #22304A',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ font: "600 12.5px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                  {t('season.wholeTable')}
                </span>
                <div style={{ flex: 1 }} />
                <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                  {t('season.wholeTableCount', { count: filteredLeaderboard.length })}
                </span>
              </div>

              {(filteredLeaderboard.length >= 3 ? filteredLeaderboard.slice(3) : filteredLeaderboard).map((row) => {
                const isMe = myMember && (row.id === myMember.id || row.id === myMember.userId)
                return (
                  <div
                    key={row.id}
                    onClick={() => onOpenLedger && onOpenLedger(row.id)}
                    title={`${t('season.viewLedgerBtn')}: ${row.name}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '9px 12px',
                      borderBottom: '1px solid rgba(34,48,74,.6)',
                      background: isMe ? 'rgba(29,80,160,.12)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <span
                      style={{
                        width: 20,
                        font: "600 12px/1 'IBM Plex Mono', monospace",
                        color: isMe ? '#B6CDEC' : '#A8B7CB',
                      }}
                    >
                      {row.rank}
                    </span>
                    <Avatar name={row.name} src={row.avatarUrl || row.avatar} size={30} />
                    <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            font: "600 13.5px/1.2 'IBM Plex Sans', sans-serif",
                            color: '#E9EFF7',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {row.name}
                        </span>
                        {isMe && (
                          <span
                            style={{
                              font: "600 9.5px/1 'IBM Plex Mono', monospace",
                              padding: '3px 6px',
                              borderRadius: 999,
                              background: 'rgba(29,80,160,.24)',
                              border: '1px solid #1D50A0',
                              color: '#B6CDEC',
                            }}
                          >
                            {t('season.youTag')}
                          </span>
                        )}
                        {row.streak >= 5 ? (
                          <BountyBadgeTag streak={row.streak} />
                        ) : row.streak >= 3 ? (
                          <span
                            style={{
                              font: "600 9.5px/1 'IBM Plex Mono', monospace",
                              padding: '3px 6px',
                              borderRadius: 999,
                              background: 'rgba(0,178,169,.14)',
                              border: '1px solid #00786F',
                              color: '#5FDBD3',
                            }}
                          >
                            streak {row.streak}
                          </span>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <MiniShelf shelf={row.badgeShelf || row.member?.badgeShelf || row.member?.badge_shelf || []} size={17} />
                        <span
                          style={{
                            font: "400 10.5px/1 'IBM Plex Mono', monospace",
                            color: '#8494AA',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {row.matchesCount} {t('units.match')} · {row.upsetsCount || 0} upset
                        </span>
                      </div>
                    </div>
                    <span
                      style={{
                        font: "600 17px/1 'IBM Plex Mono', monospace",
                        color: '#E9EFF7',
                      }}
                    >
                      {row.totalSeasonPoints?.toLocaleString()}
                    </span>
                  </div>
                )
              })}
            </div>

            <div
              style={{
                padding: '10px 12px',
                borderRadius: 6,
                background: '#101927',
                border: '1px solid #22304A',
                font: "400 12px/1.5 'IBM Plex Sans', sans-serif",
                color: '#A8B7CB',
                marginTop: 10,
              }}
            >
              {t('season.shelfThreeSlotFooterNote14a')}
            </div>
          </div>
        ) : (
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
            <span style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
              {t('season.tableTotal', { total: filteredLeaderboard.length, count: filteredLeaderboard.length, n: filteredLeaderboard.length })}
            </span>
            {isMobile ? (
              <span style={{ font: "400 11px/1.2 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                {t('season.legendFormulaShort')}
              </span>
            ) : isGlamorous ? (
              <span
                style={{
                  font: "600 11px/1 'IBM Plex Sans', sans-serif",
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: 'rgba(29,80,160,.20)',
                  border: '1px solid #1D50A0',
                  color: '#B6CDEC',
                }}
              >
                {t('season.shelfThreeSlotLegend14a')}
              </span>
            ) : (
              <span
                style={{
                  font: "600 11px/1 'IBM Plex Sans', sans-serif",
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: isDark ? 'rgba(29,80,160,.20)' : 'rgba(29,80,160,.10)',
                  border: '1px solid #1D50A0',
                  color: isDark ? '#B6CDEC' : '#1D50A0',
                }}
              >
                {t('season.columnsLegend')}
              </span>
            )}
          </div>

          {!isMobile && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isGlamorous ? '46px minmax(0, 1fr) 96px 74px 74px 74px 74px 86px' : '40px minmax(0, 1fr) 96px 74px 74px 74px 74px 86px',
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
              <span style={{ textAlign: 'right' }}>{t('season.colPoints')}</span>
              <span style={{ textAlign: 'right' }}>{t('season.colRecord')}</span>
              <span style={{ textAlign: 'right' }}>{t('season.colMatches')}</span>
              <span style={{ textAlign: 'right' }}>{t('season.colWinRate')}</span>
              <span style={{ textAlign: 'right' }}>{t('season.colUpset')}</span>
              <span style={{ textAlign: 'right' }}>{t('season.colTrend')}</span>
            </div>
          )}

          {filteredLeaderboard.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', font: "400 13px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
              {t('season.emptyGenderList')}
            </div>
          ) : filteredLeaderboard.map((row) => {
            const isRank1 = row.rank === 1
            const isRank2 = row.rank === 2
            const isRank3 = row.rank === 3
            const rankColor = isRank1
              ? '#D97706'
              : isRank2 || isRank3
                ? (isDark ? '#A8B7CB' : 'var(--text-secondary)')
                : 'var(--text-muted)'

            if (isMobile) {
              return (
                <div
                  key={row.id}
                  onClick={() => onOpenLedger && onOpenLedger(row.id)}
                  title={`${t('season.viewLedgerBtn')}: ${row.name}`}
                  style={{
                    padding: '11px 14px',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                    cursor: 'pointer',
                    background: 'transparent',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Dòng 1: Hạng + Avatar + Tên + Điểm mùa */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ width: 20, font: "600 13px/1 'IBM Plex Mono', monospace", color: rankColor }}>
                      {row.rank}
                    </span>
                    <Avatar name={row.name} src={row.avatarUrl || row.avatar} size={22} />
                    <span style={{ flex: '1 1 0%', minWidth: 0, font: "600 14px/1.3 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.name}
                    </span>
                    <span
                      style={{
                        font: "600 15px/1 'IBM Plex Mono', monospace",
                        color: isRank1 ? (isDark ? '#F7E3A1' : '#B45309') : 'var(--text-primary)',
                      }}
                    >
                      {row.totalSeasonPoints.toLocaleString()}
                    </span>
                  </div>

                  {/* Dòng 2: W-L, Win Rate, Upset, Badges */}
                  <div style={{ paddingLeft: 29, display: 'flex', alignItems: 'center', gap: 8, font: "400 11px/1.3 'IBM Plex Mono', monospace", color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span>
                      {row.winsCount}W–{row.lossesCount}L · {row.matchesCount} {t('units.match')} · {row.winRate}%
                    </span>
                    {row.upsetsCount > 0 && (
                      <span style={{ color: isDark ? '#F0D26A' : '#B45309', fontWeight: 600 }}>
                        {row.upsetsCount} upset
                      </span>
                    )}
                    {row.streak >= 5 ? (
                      <BountyBadgeTag streak={row.streak} />
                    ) : row.streak >= 3 ? (
                      <span
                        style={{
                          font: "600 10px/1 'IBM Plex Mono', monospace",
                          padding: '2px 6px',
                          borderRadius: 999,
                          background: isDark ? 'rgba(0,178,169,.14)' : 'rgba(0,178,169,.10)',
                          border: '1px solid var(--teal-500)',
                          color: isDark ? '#5FDBD3' : 'var(--teal-700)',
                        }}
                      >
                        streak {row.streak}
                      </span>
                    ) : null}
                    {row.isInactive && (
                      <span
                        style={{
                          font: "600 10px/1 'IBM Plex Mono', monospace",
                          padding: '2px 6px',
                          borderRadius: 999,
                          background: isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)',
                          border: '1px solid var(--border-default)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {t('season.inactiveBadge')}
                      </span>
                    )}
                    {!row.isQualified && (
                      <span
                        style={{
                          font: "600 10px/1 'IBM Plex Mono', monospace",
                          padding: '2px 6px',
                          borderRadius: 999,
                          background: isDark ? 'rgba(245,158,11,.15)' : 'rgba(245,158,11,.10)',
                          border: '1px solid #D97706',
                          color: isDark ? '#FCD34D' : '#B45309',
                        }}
                      >
                        {row.matchesCount}/20
                      </span>
                    )}
                    {isRank1 && (
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
                  </div>
                </div>
              )
            }

            // Style cho hàng Top 1, 2, 3 khi bật mode Hào nhoáng
            const isGlamTop1 = isGlamorous && isRank1
            const isGlamTop2 = isGlamorous && isRank2
            const isGlamTop3 = isGlamorous && isRank3
            const glamLeftBorder = isGlamTop1
              ? 'linear-gradient(180deg,#F0D26A,#C9A227)'
              : isGlamTop2
                ? 'linear-gradient(180deg,#C7D2E4,#8FA3BE)'
                : isGlamTop3
                  ? 'linear-gradient(180deg,#F5C09A,#A66A38)'
                  : null
            const glamBg = isGlamTop1
              ? 'linear-gradient(90deg, rgba(240,183,92,.16), rgba(240,183,92,0) 46%)'
              : isGlamTop2
                ? 'linear-gradient(90deg, rgba(199,210,228,.12), rgba(199,210,228,0) 46%)'
                : isGlamTop3
                  ? 'linear-gradient(90deg, rgba(232,180,140,.12), rgba(232,180,140,0) 46%)'
                  : 'transparent'

            return (
              <div
                key={row.id}
                onClick={() => onOpenLedger && onOpenLedger(row.id)}
                title={`${t('season.viewLedgerBtn')}: ${row.name}`}
                style={{
                  position: 'relative',
                  display: 'grid',
                  gridTemplateColumns: isGlamorous
                    ? '46px minmax(0, 1fr) 96px 74px 74px 74px 74px 86px'
                    : '40px minmax(0, 1fr) 96px 74px 74px 74px 74px 86px',
                  alignItems: 'center',
                  padding: '9px 13px',
                  borderBottom: '1px solid var(--border-subtle)',
                  font: "400 13px/1.3 'IBM Plex Sans', sans-serif",
                  background: glamBg,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isGlamorous ? glamBg : (isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)'))}
                onMouseLeave={(e) => (e.currentTarget.style.background = glamBg)}
              >
                {glamLeftBorder && (
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 3,
                      background: glamLeftBorder,
                    }}
                  />
                )}

                {/* Hạng */}
                {isGlamorous ? (
                  <RankMedalIcon rank={row.rank} size={28} />
                ) : (
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: rankColor, fontWeight: 600 }}>
                    {row.rank}
                  </span>
                )}

                {/* Thành viên + Badges */}
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <Avatar name={row.name} src={row.avatarUrl || row.avatar} size={24} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.name}
                  </span>
                  <MiniShelf shelf={row.badgeShelf || row.member?.badgeShelf || row.member?.badge_shelf || []} />
                  {row.streak >= 5 ? (
                    <BountyBadgeTag streak={row.streak} />
                  ) : row.streak >= 3 ? (
                    <span
                      style={{
                        font: "600 10px/1 'IBM Plex Mono', monospace",
                        padding: '3px 6px',
                        borderRadius: 999,
                        background: isDark ? 'rgba(0,178,169,.14)' : 'rgba(0,178,169,.10)',
                        border: '1px solid var(--teal-500)',
                        color: isDark ? '#5FDBD3' : 'var(--teal-700)',
                      }}
                    >
                      streak {row.streak}
                    </span>
                  ) : null}
                  {row.isInactive && (
                    <span
                      style={{
                        font: "600 10px/1 'IBM Plex Mono', monospace",
                        padding: '3px 6px',
                        borderRadius: 999,
                        background: isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {t('season.inactiveBadge')}
                    </span>
                  )}
                  {!row.isQualified && (
                    <span
                      style={{
                        font: "600 10px/1 'IBM Plex Mono', monospace",
                        padding: '3px 6px',
                        borderRadius: 999,
                        background: isDark ? 'rgba(245,158,11,.15)' : 'rgba(245,158,11,.10)',
                        border: '1px solid #D97706',
                        color: isDark ? '#FCD34D' : '#B45309',
                      }}
                    >
                      {row.matchesCount}/20
                    </span>
                  )}
                </span>

                {/* Điểm mùa */}
                <span
                  style={{
                    textAlign: 'right',
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontWeight: 600,
                    color: isGlamTop1 ? '#F7E3A1' : isRank1 ? (isDark ? '#F7E3A1' : '#B45309') : 'var(--text-primary)',
                  }}
                >
                  {row.totalSeasonPoints.toLocaleString()}
                </span>

                {/* W-L */}
                <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>
                  {row.winsCount}–{row.lossesCount}
                </span>

                {/* Số trận */}
                <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>
                  {row.matchesCount}
                </span>

                {/* Win Rate */}
                <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>
                  {row.winRate}%
                </span>

                {/* Điểm Upset */}
                <span
                  style={{
                    textAlign: 'right',
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: row.upsetsCount > 0 ? (isDark ? '#F0D26A' : '#B45309') : 'var(--text-muted)',
                    fontWeight: row.upsetsCount > 0 ? 600 : 400,
                  }}
                >
                  {row.upsetsCount}
                </span>

                {/* Xu hướng Sparkline SVG */}
                <span
                  style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}
                  title={t('season.viewLedgerBtn')}
                >
                  <svg width="70" height="20" viewBox="0 0 70 20">
                    <polyline
                      points={
                        row.streak >= 2 || (row.winRate >= 50 && row.rank <= 5)
                          ? `0,${16 - (row.rank % 3)} 12,${14 - (row.rank % 3)} 24,${11 - (row.rank % 2)} 36,${12 - (row.rank % 3)} 48,${7 - (row.rank % 2)} 60,${4 - (row.rank % 2)} 70,2`
                          : `0,${10 + (row.rank % 3)} 12,${9 + (row.rank % 2)} 24,${11 + (row.rank % 3)} 36,10 48,12 60,11 70,13`
                      }
                      fill="none"
                      stroke={row.streak >= 2 || (row.winRate >= 50 && row.rank <= 5) ? '#00B2A9' : 'var(--text-muted)'}
                      strokeWidth="2"
                    />
                  </svg>
                </span>
              </div>
            )
          })}
        </div>
      )}
      </div>

      {/* CỘT PHẢI (SẮP TRAO, ĐIỂM ĐẾN TỪ ĐÂU, MINI CHART) */}
      <div style={{ display: 'grid', gap: 12 }}>
        {/* 1. Bảng 5 dải điểm Elo (+14 / -8) */}
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
            {t('season.scaleTableTitle')}
          </div>
          <div style={{ display: 'grid', gap: 6, font: "400 12px/1.3 'IBM Plex Sans', sans-serif" }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 50px 50px', gap: 8, font: "600 11px/1 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              <span>{t('season.tierCol')}</span>
              <span style={{ textAlign: 'right' }}>{t('season.winDeltaCol')}</span>
              <span style={{ textAlign: 'right' }}>{t('season.lossDeltaCol')}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 50px 50px', gap: 8, color: 'var(--text-secondary)' }}>
              <span>{t('season.tierHeavyFavored')}</span>
              <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#00B2A9', fontWeight: 600 }}>+10</span>
              <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#DC2626' }}>-12</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 50px 50px', gap: 8, color: 'var(--text-secondary)' }}>
              <span>{t('season.tierFavored')}</span>
              <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#00B2A9', fontWeight: 600 }}>+12</span>
              <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#DC2626' }}>-10</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 50px 50px', gap: 8, color: 'var(--text-primary)', fontWeight: 600, background: isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.03)', padding: '2px 4px', borderRadius: 4 }}>
              <span>{t('season.tierBalanced')}</span>
              <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#00B2A9', fontWeight: 700 }}>+14</span>
              <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#DC2626' }}>-8</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 50px 50px', gap: 8, color: 'var(--text-secondary)' }}>
              <span>{t('season.tierUnderdog')}</span>
              <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#00B2A9', fontWeight: 600 }}>+17</span>
              <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#DC2626' }}>-5</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 50px 50px', gap: 8, color: 'var(--text-secondary)' }}>
              <span>{t('season.tierDeepUnderdog')}</span>
              <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#00B2A9', fontWeight: 600 }}>+22</span>
              <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#DC2626' }}>-3</span>
            </div>
          </div>
          <div style={{ font: "400 11px/1.45 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: 9, display: 'grid', gap: 3 }}>
            <div>• {t('season.ruleFloorZero')}</div>
            <div>• {t('season.ruleStreakMilestone')}</div>
            <div>• {t('season.ruleUpsetMilestone')}</div>
            <div>• {t('season.ruleMinMatches')}</div>
            <div>• {t('season.ruleInactive21Days')}</div>
          </div>
        </div>

        {/* 2. Đua top 3 qua từng buổi (Mini SVG Chart) */}
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
            {t('season.top3RaceTitle')}
          </div>
          <svg width="326" height="130" viewBox="0 0 326 130" style={{ width: '100%', overflow: 'visible' }}>
            <line x1="0" y1="34" x2="326" y2="34" stroke="var(--border-subtle)" strokeWidth="1" />
            <line x1="0" y1="70" x2="326" y2="70" stroke="var(--border-subtle)" strokeWidth="1" />
            <line x1="0" y1="106" x2="326" y2="106" stroke="var(--border-subtle)" strokeWidth="1" />
            <polyline points="8,106 60,70 112,70 164,34 216,34 268,34 318,34" fill="none" stroke="#F0D26A" strokeWidth="2.5" />
            <polyline points="8,34 60,34 112,34 164,70 216,70 268,70 318,70" fill="none" stroke="#7AA3DC" strokeWidth="2.5" />
            <polyline points="8,70 60,106 112,106 164,106 216,106 268,106 318,106" fill="none" stroke="#00B2A9" strokeWidth="2.5" />
            <text x="0" y="128" fill="var(--text-muted)" fontFamily="IBM Plex Mono, monospace" fontSize="10">{t('season.sessionN', { n: 5 })}</text>
            <text x="278" y="128" fill="var(--text-muted)" fontFamily="IBM Plex Mono, monospace" fontSize="10">{t('season.sessionN', { n: 11 })}</text>
          </svg>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', font: "400 11px/1.2 'IBM Plex Mono', monospace", color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 3, background: '#F0D26A' }} />
              {top1?.name?.split(' ').pop() || 'Top 1'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 3, background: '#7AA3DC' }} />
              {top2?.name?.split(' ').pop() || 'Top 2'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 3, background: '#00B2A9' }} />
              {top3?.name?.split(' ').pop() || 'Top 3'}
            </span>
          </div>
          <div style={{ font: "400 12px/1.5 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: 9 }}>
            {t('season.leadSurgeDesc', { name: top1?.name || 'Top 1', chaser: top2?.name || 'Top 2' })}
          </div>
        </div>

        {/* 3. Sắp trao mùa này */}
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
            {t('season.awardsUpcomingTitle')}
          </div>
          <div style={{ display: 'grid', gap: 7, font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span>{t('season.awardPointsKing')}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-primary)', fontWeight: 600 }}>
                {top1?.name} · {top1?.totalSeasonPoints}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span>{t('season.awardMostDiligent')}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-primary)', fontWeight: 600 }}>
                {topStats.mostAttendedPlayer?.name} · {topStats.mostAttendedPlayer?.attendedCount}/{playedSessions}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span>{t('season.awardUpsetHunter')}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-primary)', fontWeight: 600 }}>
                {topStats.mostUpsetsPlayer?.name} · {topStats.mostUpsetsPlayer?.upsetsCount} {t('units.times')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
