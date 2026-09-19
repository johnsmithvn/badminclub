import { useMemo, useState } from 'react'
import { Avatar, Button, IconButton } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { useAuth } from '#contexts/AuthContext.jsx'
import { useTheme } from '#contexts/ThemeContext.jsx'
import NotificationBell from '#components/notification/NotificationBell.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import { myMember } from '#lib/money.js'
import { getPlayerPartnersAndMatchups } from '#lib/rating.js'
import {
  getMyHeroStats,
  getPlayerForm5,
  getRivalAnalysis,
  getRecentPlayerMatches,
  getNextUpcomingSession,
  getClubTodayHighlights,
  getSurroundingStandings,
  getSurroundingSeasonStandings,
  getPersonalGreeting,
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
import MyOpponentsCard from '#components/home/personal/MyOpponentsCard.jsx'

export default function MyStats() {
  const { db, a } = useApp()
  const { profile } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const isMobile = useMobile(768)

  // Chỉ lấy bản ghi của thành viên đang đăng nhập; nếu không thuộc CLB thì không hiển thị thành tích người khác
  const currentMember = useMemo(() => myMember(db), [db])

  const memberId = currentMember?.id || ''
  const memberName = currentMember?.name || ''
  const myAvatarUrl =
    currentMember?.avatarUrl ||
    currentMember?.avatar_url ||
    currentMember?.avatar ||
    profile?.avatar_url ||
    profile?.avatarUrl ||
    ''

  // 1. Thẻ Hero & thứ hạng
  const heroStats = useMemo(() => getMyHeroStats(db, memberId), [db, memberId])

  // 2. Phong độ 5 trận & chuỗi thắng
  const formStats = useMemo(() => getPlayerForm5(db, memberId), [db, memberId])

  // 3. Phân tích kình địch & mục tiêu
  const rivalAnalysis = useMemo(
    () => getRivalAnalysis(db, memberId, heroStats.targetRival?.id),
    [db, memberId, heroStats.targetRival?.id],
  )

  // 4. Trận gần nhất (Hiển thị tối đa 3 trận cho cả Mobile và Desktop)
  const recentMatches = useMemo(
    () => getRecentPlayerMatches(db, memberId, 3),
    [db, memberId],
  )

  // 6. Thống kê cặp ăn ý & đối thủ dùng hàm chuẩn getPlayerPartnersAndMatchups từ rating.js
  const partnerStats = useMemo(() => {
    if (!db || !memberId) {
      return {
        bestPartner: null,
        underperformingPartner: null,
        nemesis: null,
        favoriteOpponent: null,
        partners: [],
        nemeses: [],
        favoriteOpponents: [],
        opponents: [],
      }
    }
    const membersMap = Object.fromEntries((db.members || []).map((m) => [m.id, m]))
    const res = getPlayerPartnersAndMatchups(db.matches || [], memberId, membersMap, db.playerRatings || {})
    
    // Chỉ lấy thành viên chính thức, không tính khách (guests)
    const isOfficialMember = (mObj, id) => {
      const targetId = mObj?.id || id
      const mem = membersMap[targetId]
      return Boolean(mem && !mem.isGuest && mem.type !== 'guest')
    }

    const partners = (res?.partners || []).filter((p) => isOfficialMember(p.partner, p.id))
    const bestPartner = partners[0] || null
    const underperformingPartner = partners.length > 1 ? partners.at(-1) : null
    const nemeses = (res?.nemeses || []).filter((o) => isOfficialMember(o.opponent, o.id))
    const favoriteOpponents = (res?.favoriteOpponents || []).filter((o) => isOfficialMember(o.opponent, o.id))
    const nemesis = nemeses[0] || null
    const favoriteOpponent = favoriteOpponents[0] || null
    const opponents = [...nemeses, ...favoriteOpponents]
    return {
      bestPartner,
      underperformingPartner,
      nemesis,
      favoriteOpponent,
      partners,
      nemeses,
      favoriteOpponents,
      opponents,
    }
  }, [db, memberId])

  // 7. Buổi tập sắp tới
  const upcomingSession = useMemo(() => getNextUpcomingSession(db, memberId), [db, memberId])

  // Seed ngẫu nhiên đúng MỘT lần khi mount trang: F5 đổi câu chào, nhưng mọi lần db sync lại
  // vẫn ra cùng một câu nên chữ không nhảy trước mắt người đang đọc.
  // Dùng useState với hàm khởi tạo lười, KHÔNG dùng useRef: `useRef(expr)` đánh giá `expr` ở mọi
  // lần render rồi vứt đi (gọi hàm bất thuần lúc render), và đọc `ref.current` trong useMemo là
  // đọc ref lúc render — cả hai đều bị react-hooks/purity và react-hooks/refs chặn.
  const [sessionSeed] = useState(() => Math.floor(Math.random() * 10000))

  // Lời chào cá nhân & Subtitle tương tác sinh động theo dữ liệu thực tế
  const personalGreeting = useMemo(
    () => getPersonalGreeting(currentMember, heroStats, formStats, recentMatches, upcomingSession, db, sessionSeed),
    [currentMember, heroStats, formStats, recentMatches, upcomingSession, db, sessionSeed],
  )

  // 8. Tin tức nổi bật hôm nay
  const clubHighlights = useMemo(() => getClubTodayHighlights(db, memberId), [db, memberId])

  // 9. BXH quanh bạn (Desktop)
  const nearbyStandings = useMemo(() => getSurroundingStandings(db, memberId, 5, 'elo'), [db, memberId])
  const nearbySeasonStandings = useMemo(() => getSurroundingSeasonStandings(db, memberId, 5), [db, memberId])

  // Callbacks điều hướng dùng a.go(key) chuẩn
  const handleLogMatch = () => a.go('matches')
  const handleViewMatches = () => a.go('matches')
  const handleViewSchedule = () => a.go('calendar')
  const handleViewAssignment = () => {
    if (upcomingSession?.id) {
      a.go(`/buoi-tap/${upcomingSession.id}?tab=courts`)
    } else {
      a.go('sessions')
    }
  }
  const handleViewLeaderboard = () => a.go('leaderboard')

  // Nếu người dùng chưa phải thành viên trong CLB này
  if (!currentMember) {
    return (
      <div style={S.emptyScreenContainer}>
        <div style={S.emptyCard}>
          <h2 style={S.emptyTitle}>{t('pages.home.title')}</h2>
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
              {personalGreeting?.greetingKey
                ? t(personalGreeting.greetingKey, personalGreeting.greetingParams)
                : t('home.personal.greeting', { name: memberName })}
            </h1>
            {personalGreeting?.subKey ? (
              <div style={S.mobileSubQuote}>
                “{t(personalGreeting.subKey, personalGreeting.subParams)}”
              </div>
            ) : null}
          </div>
          <div style={S.mobileHeaderActions}>
            <IconButton
              icon={isDark ? 'sun' : 'moon'}
              size="sm"
              variant="ghost"
              label={isDark ? t('common.themeLight') : t('common.themeDark')}
              onClick={toggleTheme}
            />
            <NotificationBell />
            <Avatar
              name={memberName}
              src={myAvatarUrl}
              size={34}
              onClick={() => a.go('profile')}
              style={{ cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* Thẻ 01: Hero Rank */}
        <HeroRankCard hero={heroStats} isMobile={true} />

        {/* Thẻ 02: Recent Form */}
        <RecentFormCard form={formStats} isMobile={true} />

        {/* Thẻ 03: Rival Goal */}
        <RivalGoalCard
          rivalAnalysis={rivalAnalysis}
          isMobile={true}
          onChallenge={handleLogMatch}
        />

        {/* Thẻ 04: Season Race */}
        <SeasonRaceCard
          db={db}
          memberId={memberId}
          defaultRivalId={rivalAnalysis?.rival?.id}
        />

        {/* Thẻ 05: Trận gần nhất */}
        <RecentMatchesCard
          matches={recentMatches}
          isMobile={true}
          onViewAll={handleViewMatches}
        />

        {/* Thẻ 05b: Quanh bạn trên BXH */}
        <NearbyStandingsCard
          standings={nearbyStandings}
          seasonStandings={nearbySeasonStandings}
          onViewLeaderboard={handleViewLeaderboard}
        />

        {/* Thẻ 06: Cặp ăn ý & Huy hiệu */}
        <SynergyBadgesCard
          partners={partnerStats.partners}
          bestPartner={partnerStats.bestPartner}
          underperformingPartner={partnerStats.underperformingPartner}
          isMobile={true}
        />

        {/* Thẻ 06b: Đối thủ của tôi */}
        <MyOpponentsCard
          opponents={partnerStats.opponents}
          nemeses={partnerStats.nemeses}
          favoriteOpponents={partnerStats.favoriteOpponents}
          nemesis={partnerStats.nemesis}
          favoriteOpponent={partnerStats.favoriteOpponent}
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
            {personalGreeting?.greetingKey
              ? t(personalGreeting.greetingKey, personalGreeting.greetingParams)
              : t('home.personal.greeting', { name: memberName })}
          </h1>
          {personalGreeting?.subKey ? (
            <div style={S.desktopSubQuote}>
              “{t(personalGreeting.subKey, personalGreeting.subParams)}”
            </div>
          ) : null}
        </div>
        <div style={S.headerActions}>
          <IconButton
            icon={isDark ? 'sun' : 'moon'}
            size="sm"
            variant="ghost"
            label={isDark ? t('common.themeLight') : t('common.themeDark')}
            onClick={toggleTheme}
          />
          <NotificationBell />
          <Button
            variant="primary"
            icon="plus"
            onClick={handleLogMatch}
          >
            {t('home.personal.logMatch')}
          </Button>
          <Avatar
            name={memberName}
            src={myAvatarUrl}
            size={36}
            onClick={() => a.go('profile')}
            style={{ cursor: 'pointer' }}
          />
        </div>
      </div>

      <div style={S.desktopGrid}>
        {/* Cột chính (Trái) */}
        <div style={S.mainCol}>
          {/* 01. Hạng của tôi */}
          <HeroRankCard hero={heroStats} isMobile={false} />

          {/* Hàng 2 cột: 02. Phong độ 5 trận + 03. Mục tiêu */}
          <div style={S.twoColRow}>
            <RecentFormCard
              form={formStats}
              isMobile={false}
            />
            <RivalGoalCard
              rivalAnalysis={rivalAnalysis}
              isMobile={false}
              onChallenge={handleLogMatch}
              onH2HClick={handleLogMatch}
            />
          </div>

          {/* 04. Đường đua mùa · 6 tuần */}
          <SeasonRaceCard
            db={db}
            memberId={memberId}
            defaultRivalId={rivalAnalysis?.rival?.id}
          />

          {/* 05. Trận gần nhất của tôi (3 trận) */}
          <RecentMatchesCard
            matches={recentMatches}
            isMobile={false}
            onViewAll={handleViewMatches}
          />
        </div>

        {/* Cột phụ (Phải - 352px) */}
        <div style={S.sideCol}>
          {/* 06. Buổi tới */}
          <UpcomingSessionCard
            session={upcomingSession}
            isMobile={false}
            onViewSchedule={handleViewSchedule}
            onViewAssignment={handleViewAssignment}
            onChallenge={handleLogMatch}
          />

          {/* 07. Quanh bạn trên BXH */}
          <NearbyStandingsCard
            standings={nearbyStandings}
            seasonStandings={nearbySeasonStandings}
            onViewLeaderboard={handleViewLeaderboard}
          />

          {/* 08. Đồng đội tốt của tôi */}
          <SynergyBadgesCard
            partners={partnerStats.partners}
            bestPartner={partnerStats.bestPartner}
            underperformingPartner={partnerStats.underperformingPartner}
            isMobile={false}
          />

          {/* 08b. Đối thủ của tôi */}
          <MyOpponentsCard
            opponents={partnerStats.opponents}
            nemeses={partnerStats.nemeses}
            favoriteOpponents={partnerStats.favoriteOpponents}
            nemesis={partnerStats.nemesis}
            favoriteOpponent={partnerStats.favoriteOpponent}
            isMobile={false}
          />

          {/* 09. CLB hôm nay */}
          <ClubFeedCard
            events={clubHighlights}
            isMobile={false}
            onViewAll={handleViewMatches}
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
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    overflowX: 'hidden',
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
  mobileHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
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
  mobileSubQuote: {
    font: '500 13px/1.4 var(--font-sans)',
    fontStyle: 'italic',
    color: 'var(--status-transit-fg)',
    marginTop: 2,
    lineHeight: 1.35,
  },
  desktopWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    width: '100%',
    maxWidth: 1440,
    margin: '0 auto',
    padding: '0 0 32px 0',
    boxSizing: 'border-box',
  },
  desktopHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '6px 0 14px 0',
    borderBottom: '1px solid var(--border-subtle)',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  desktopGreeting: {
    margin: 0,
    font: '700 24px/1.2 var(--font-display)',
    color: 'var(--text-primary)',
  },
  desktopSubQuote: {
    font: '500 14px/1.4 var(--font-sans)',
    fontStyle: 'italic',
    color: 'var(--status-transit-fg)',
    marginTop: 3,
    lineHeight: 1.4,
  },
  desktopGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(360px, 395px)',
    gap: 20,
    alignItems: 'start',
  },
  mainCol: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  sideCol: {
    width: '100%',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  twoColRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    gap: 18,
    alignItems: 'stretch',
  },
}
