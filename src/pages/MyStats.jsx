import { useMemo } from 'react'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import { myMember } from '#lib/money.js'
import { resolveSeason } from '#lib/season.js'
import { getPlayerPartnersAndMatchups } from '#lib/rating.js'
import {
  calcSeasonWeek,
  getMyHeroStats,
  getPlayerForm5,
  getRivalAnalysis,
  calcSeasonRaceHistory,
  getRecentPlayerMatches,
  getNextUpcomingSession,
  getClubTodayHighlights,
  getSurroundingStandings,
} from '#lib/homePersonal.js'

import HeroRankCard from '#components/home/personal/HeroRankCard.jsx'
import RecentFormCard from '#components/home/personal/RecentFormCard.jsx'
import RivalGoalCard from '#components/home/personal/RivalGoalCard.jsx'
import SeasonRaceCard from '#components/home/personal/SeasonRaceCard.jsx'
import RecentMatchesCard from '#components/home/personal/RecentMatchesCard.jsx'
import SynergyBadgesCard from '#components/home/personal/SynergyBadgesCard.jsx'
import UpcomingSessionCard from '#components/home/personal/UpcomingSessionCard.jsx'
import ClubFeedCard from '#components/home/personal/ClubFeedCard.jsx'
import NearbyStandingsCard from '#components/home/personal/NearbyStandingsCard.jsx'

export default function MyStats() {
  const { db, a } = useApp()
  const isMobile = useMobile(768)

  // Chỉ lấy bản ghi của thành viên đang đăng nhập; nếu không thuộc CLB thì không hiển thị thành tích người khác
  const currentMember = useMemo(() => myMember(db), [db])

  const memberId = currentMember?.id || ''
  const memberName = currentMember?.name || ''

  // Lấy cấu hình mùa giải đang áp dụng (active) của CLB qua resolveSeason
  const season = useMemo(() => resolveSeason(db) || {}, [db])
  const seasonWeek = calcSeasonWeek(season.startDate)
  const seasonName = season.name || ''

  // 1. Thẻ Hero & thứ hạng
  const heroStats = useMemo(() => getMyHeroStats(db, memberId), [db, memberId])

  // 2. Phong độ 5 trận & chuỗi thắng
  const formStats = useMemo(() => getPlayerForm5(db, memberId), [db, memberId])

  // 3. Phân tích kình địch & mục tiêu
  const rivalAnalysis = useMemo(
    () => getRivalAnalysis(db, memberId, heroStats.targetRival?.id),
    [db, memberId, heroStats.targetRival?.id],
  )

  // 4. Biểu đồ đường đua mùa
  const seasonRace = useMemo(
    () => calcSeasonRaceHistory(db, memberId, rivalAnalysis?.rival?.id),
    [db, memberId, rivalAnalysis?.rival?.id],
  )

  // 5. Trận gần nhất (Mobile: 1 trận, Desktop: 3 trận)
  const recentMatches = useMemo(
    () => getRecentPlayerMatches(db, memberId, isMobile ? 1 : 3),
    [db, memberId, isMobile],
  )

  // 6. Thống kê cặp ăn ý dùng hàm chuẩn getPlayerPartnersAndMatchups từ rating.js
  const partnerStats = useMemo(() => {
    if (!db || !memberId) return { bestPartner: null, underperformingPartner: null }
    const membersMap = Object.fromEntries((db.members || []).map((m) => [m.id, m]))
    const res = getPlayerPartnersAndMatchups(db.matches || [], memberId, membersMap, db.playerRatings || {})
    const partners = res?.partners || []
    const bestPartner = partners[0] || null
    const underperformingPartner = partners.length > 1 ? partners.at(-1) : null
    return { bestPartner, underperformingPartner }
  }, [db, memberId])

  // 7. Buổi tập sắp tới
  const upcomingSession = useMemo(() => getNextUpcomingSession(db, memberId), [db, memberId])

  // 8. Tin tức nổi bật hôm nay
  const clubHighlights = useMemo(() => getClubTodayHighlights(db, memberId), [db, memberId])

  // 9. BXH quanh bạn (Desktop)
  const nearbyStandings = useMemo(() => getSurroundingStandings(db, memberId, 5), [db, memberId])

  // Callbacks điều hướng dùng a.go(key) chuẩn
  const handleLogMatch = () => a.go('matches')
  const handleViewMatches = () => a.go('matches')
  const handleViewSchedule = () => a.go('calendar')
  const handleViewAssignment = () => a.go('assign')
  const handleViewLeaderboard = () => a.go('leaderboard')

  // Nếu người dùng chưa phải thành viên trong CLB này
  if (!currentMember) {
    return (
      <div style={S.emptyScreenContainer}>
        <div style={S.emptyCard}>
          <h2 style={S.emptyTitle}>{t('pages.myStats.title')}</h2>
          <p style={S.emptyDesc}>{t('home.personal.notMember')}</p>
        </div>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div style={S.mobileContainer}>
        {/* Header Mobile */}
        <div style={S.mobileHeader}>
          <div style={S.headerCol}>
            <h1 style={S.mobileGreeting}>
              {t('home.personal.greeting', { name: memberName })}
            </h1>
            <div style={S.mobileSub}>
              {t('home.personal.subtitleMobile', {
                club: db.club?.name || t('common.unknown'),
                season: seasonName,
                week: seasonWeek,
              })}
            </div>
          </div>
          <button type="button" onClick={handleLogMatch} style={S.logMatchBtnMobile}>
            {t('home.personal.logMatch')}
          </button>
        </div>

        {/* Thẻ 01: Hero Rank */}
        <HeroRankCard data={heroStats} isMobile={true} />

        {/* Thẻ 02: Recent Form */}
        <RecentFormCard form={formStats} isMobile={true} />

        {/* Thẻ 03: Rival Goal */}
        <RivalGoalCard
          rivalAnalysis={rivalAnalysis}
          isMobile={true}
          onChallenge={handleLogMatch}
        />

        {/* Thẻ 04: Season Race */}
        <SeasonRaceCard data={seasonRace} />

        {/* Thẻ 05: Trận gần nhất */}
        <RecentMatchesCard
          matches={recentMatches}
          isMobile={true}
          onViewAll={handleViewMatches}
        />

        {/* Thẻ 06: Cặp ăn ý & Huy hiệu */}
        <SynergyBadgesCard
          bestPartner={partnerStats.bestPartner}
          underperformingPartner={partnerStats.underperformingPartner}
          badgesCount={heroStats.badgesCount}
          nextStreakBadge={formStats.nextBadgeStreak}
          winsNeededForStreak={formStats.winsNeededForBadge}
          isMobile={true}
        />

        {/* Thẻ 07: Buổi tập sắp tới */}
        <UpcomingSessionCard
          session={upcomingSession}
          isMobile={true}
          onViewSchedule={handleViewSchedule}
          onViewAssignment={handleViewAssignment}
          onChallenge={handleLogMatch}
        />

        {/* Thẻ 08: Hoạt động CLB hôm nay */}
        <ClubFeedCard
          events={clubHighlights}
          isMobile={true}
          onViewAll={handleViewMatches}
        />
      </div>
    )
  }

  // Desktop layout: 2 cột
  return (
    <div style={S.desktopWrapper}>
      {/* Header Desktop */}
      <div style={S.desktopHeader}>
        <div style={S.headerCol}>
          <h1 style={S.desktopGreeting}>
            {t('home.personal.greeting', { name: memberName })}
          </h1>
          <div style={S.desktopSub}>
            {t('home.personal.subtitleDesktop', {
              season: seasonName,
              week: seasonWeek,
              members: heroStats.totalMembers,
            })}
          </div>
        </div>
        <button type="button" onClick={handleLogMatch} style={S.logMatchBtnDesktop}>
          {t('home.personal.logMatch')}
        </button>
      </div>

      <div style={S.desktopGrid}>
        {/* Cột chính (Trái) */}
        <div style={S.mainCol}>
          <HeroRankCard data={heroStats} isMobile={false} />
          <RivalGoalCard
            rivalAnalysis={rivalAnalysis}
            isMobile={false}
            onChallenge={handleLogMatch}
          />
          <SeasonRaceCard data={seasonRace} />
          <RecentMatchesCard
            matches={recentMatches}
            isMobile={false}
            onViewAll={handleViewMatches}
          />
          <ClubFeedCard
            events={clubHighlights}
            isMobile={false}
            onViewAll={handleViewMatches}
          />
        </div>

        {/* Cột phụ (Phải - 352px) */}
        <div style={S.sideCol}>
          <RecentFormCard form={formStats} isMobile={false} />
          <NearbyStandingsCard
            standings={nearbyStandings}
            onViewLeaderboard={handleViewLeaderboard}
          />
          <SynergyBadgesCard
            bestPartner={partnerStats.bestPartner}
            underperformingPartner={partnerStats.underperformingPartner}
            badgesCount={heroStats.badgesCount}
            nextStreakBadge={formStats.nextBadgeStreak}
            winsNeededForStreak={formStats.winsNeededForBadge}
            isMobile={false}
          />
          <UpcomingSessionCard
            session={upcomingSession}
            isMobile={false}
            onViewSchedule={handleViewSchedule}
            onViewAssignment={handleViewAssignment}
            onChallenge={handleLogMatch}
          />
        </div>
      </div>
    </div>
  )
}

const S = {
  emptyScreenContainer: {
    padding: '48px 16px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCard: {
    padding: '32px 24px',
    borderRadius: 14,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    textAlign: 'center',
    maxWidth: 420,
    width: '100%',
  },
  emptyTitle: {
    margin: '0 0 12px 0',
    font: '700 18px/1.2 var(--font-display)',
    color: 'var(--text-primary)',
  },
  emptyDesc: {
    margin: 0,
    font: '400 13px/1.5 var(--font-sans)',
    color: 'var(--text-muted)',
  },
  mobileContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    maxWidth: 480,
    margin: '0 auto',
    padding: '4px 0 24px 0',
  },
  mobileHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '4px 2px',
  },
  headerCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    minWidth: 0,
    flex: 1,
  },
  mobileGreeting: {
    margin: 0,
    font: '700 20px/1.2 var(--font-display)',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  mobileSub: {
    font: '400 12px/1.3 var(--font-mono)',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  logMatchBtnMobile: {
    flex: '0 0 auto',
    padding: '9px 14px',
    borderRadius: 999,
    background: 'var(--action-primary-bg)',
    color: 'var(--action-primary-fg)',
    font: '600 12.5px/1 var(--font-sans)',
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  desktopWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    maxWidth: 1200,
    margin: '0 auto',
    padding: '8px 0 32px 0',
  },
  desktopHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '4px 2px',
  },
  desktopGreeting: {
    margin: 0,
    font: '700 26px/1.2 var(--font-display)',
    color: 'var(--text-primary)',
  },
  desktopSub: {
    font: '400 13px/1.3 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  logMatchBtnDesktop: {
    flex: '0 0 auto',
    padding: '11px 18px',
    borderRadius: 999,
    background: 'var(--action-primary-bg)',
    color: 'var(--action-primary-fg)',
    font: '600 13.5px/1 var(--font-sans)',
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  desktopGrid: {
    display: 'flex',
    gap: 16,
    alignItems: 'flex-start',
  },
  mainCol: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  sideCol: {
    width: 352,
    flex: '0 0 352px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
}
