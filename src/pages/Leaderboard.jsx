import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Avatar, Button, Dialog, Icon } from '#ds'
import { TabTrack } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { getPlayerRating, DEFAULT_RATING, rankPairs } from '#lib/rating.js'
import { myMember } from '#lib/money.js'
import { DEFAULT_RANK_THEME } from '#data/rankThemes.js'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }
import CreateChallengeModal from '#components/challenge/CreateChallengeModal.jsx'
import MemberProfileTab from '#components/profile/MemberProfileTab.jsx'
import SeasonRaceTab from '#components/leaderboard/SeasonRaceTab.jsx'
import CareerEloTab from '#components/leaderboard/CareerEloTab.jsx'
import PairsTab from '#components/leaderboard/PairsTab.jsx'
import PairH2HTab from '#components/leaderboard/PairH2HTab.jsx'
import MemberSeasonLedgerModal from '#components/leaderboard/MemberSeasonLedgerModal.jsx'
import EffectiveStrengthModal from '#components/session/EffectiveStrengthModal.jsx'
import SeasonSettingsModal from '#components/session/SeasonSettingsModal.jsx'
import { calculateSeasonLeaderboard } from '#lib/season.js'

export default function Leaderboard() {
  const { db, a } = useApp()
  const { isDark, toggleTheme, isGlamorous, toggleThemeMode } = useTheme()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isMobile = useMobile(900)

  const tabParam = searchParams.get('tab')
  const initialTab = (tabParam === 'elo' || tabParam === 'pairs' || tabParam === 'h2h') ? tabParam : 'season'
  const [activeTab, setActiveTab] = useState(initialTab) // 'season' | 'elo' | 'pairs' | 'h2h'
  const [genderFilter, setGenderFilter] = useState('all') // 'all' | 'nam' | 'nu'
  const [rankTheme, setRankTheme] = useState(DEFAULT_RANK_THEME)

  // Redirect các tab cũ (lịch sử, ma trận, kèo) sang màn hình Trận đấu & Kèo (/tran-dau)
  useEffect(() => {
    if (tabParam === 'search' || tabParam === 'history') {
      const pA = searchParams.get('playerA') || ''
      const pB = searchParams.get('playerB') || ''
      navigate(`/tran-dau?tab=history&playerA=${pA}&playerB=${pB}`, { replace: true })
    } else if (tabParam === 'matrix') {
      navigate('/tran-dau?tab=matrix', { replace: true })
    } else if (tabParam === 'challenges') {
      navigate('/tran-dau?tab=challenges', { replace: true })
    }
  }, [tabParam, searchParams, navigate])

  // State cho Tab 2 (Biểu đồ / Profile)
  const [selectedMemberId, setSelectedMemberId] = useState(null)

  // State cho Gạ kèo (K6)
  const [challengeModalOpen, setChallengeModalOpen] = useState(false)
  const [initialTeamA, setInitialTeamA] = useState([])
  const [initialTeamB, setInitialTeamB] = useState([])

  // State cho Hệ 3 tầng (Season & Elo & Matchmaking)
  const [ledgerMemberId, setLedgerMemberId] = useState(null)
  const [effectiveStrengthPlayer, setEffectiveStrengthPlayer] = useState(null)
  const [seasonSettingsOpen, setSeasonSettingsOpen] = useState(false)
  const [recalcConfirmOpen, setRecalcConfirmOpen] = useState(false)

  const myMem = myMember(db)
  const role = db.viewAs || myMem?.role || 'member'
  const isAdmin = role === 'owner' || role === 'treasurer'

  const activeMembers = useMemo(() => {
    return (db.members || []).filter((m) => m.active !== false)
  }, [db.members])

  const seasonLeaderboardData = useMemo(() => {
    const raw = calculateSeasonLeaderboard(db, cfg.season)
    const enrichedList = (raw.leaderboard || []).map((row) => {
      const pr = getPlayerRating(db.playerRatings, row.id, row.member || row, db.levels)
      const elo = pr.displayRating ?? pr.rating ?? DEFAULT_RATING
      const isProv = pr.isProvisional || (pr.gamesCount || 0) < 5
      return {
        ...row,
        rating: elo,
        displayRating: elo,
        gamesCount: pr.gamesCount || 0,
        isProvisional: isProv,
        confidence: pr.confidence || 'low',
      }
    })
    return {
      ...raw,
      leaderboard: enrichedList,
    }
  }, [db])

  const handleExportCsv = () => {
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF'
    if (activeTab === 'season') {
      csvContent += 'Thứ hạng,Thành viên,Giới tính,Điểm mùa,Số buổi,Số trận,Thắng,Upset\n' // i18n-ok: csv header
      const rawRows = seasonLeaderboardData?.leaderboard || []
      const filtered = genderFilter === 'all'
        ? rawRows
        : rawRows.filter((r) => (r.gender || 'nam') === genderFilter)
      filtered.forEach((r, idx) => {
        const displayRank = genderFilter === 'all' ? r.rank : idx + 1
        const gTxt = t(r.gender === 'nu' ? 'gender.nu' : 'gender.nam')
        csvContent += `"${displayRank}","${r.name}","${gTxt}","${r.totalSeasonPoints}","${r.attendedCount || 0}","${r.matchesCount || 0}","${r.winsCount || 0}","${r.upsetsCount || 0}"\n`
      })
    } else if (activeTab === 'pairs') {
      csvContent += 'Thứ hạng,Cặp,Số trận,Kỳ vọng %,Thực tế %,Lệch (pp),Độ hợp cạ,Độ tin cậy\n' // i18n-ok: csv header
      const pData = rankPairs(db.matches || [], memberMap, db.playerRatings || {}, { format: 'all', minGames: 1 })
      ;(pData.rankedPairs || []).forEach((r, idx) => {
        csvContent += `"${idx + 1}","${r.names.join(' - ')}","${r.gamesCount}","${r.expectedWinPct}%","${r.actualWinPct}%","${r.pairImpact}","${r.synergyScore}","${r.confidence}"\n`
      })
    } else {
      csvContent += 'Thứ hạng,Thành viên,Giới tính,Elo,Số trận,Độ tin cậy\n' // i18n-ok: csv header
      const rawRows = activeMembers
        .map((m) => {
          const pr = getPlayerRating(db.playerRatings, m.id, m, db.levels)
          return {
            id: m.id,
            name: m.name,
            gender: m.gender || 'nam',
            rating: pr.displayRating ?? pr.rating ?? DEFAULT_RATING,
            gamesCount: pr.gamesCount || 0,
            confidence: pr.confidence || 'low',
          }
        })
        .sort((a, b) => b.rating - a.rating)
      const filtered = genderFilter === 'all'
        ? rawRows
        : rawRows.filter((r) => r.gender === genderFilter)
      filtered.forEach((r, idx) => {
        const gTxt = t(r.gender === 'nu' ? 'gender.nu' : 'gender.nam')
        csvContent += `"${idx + 1}","${r.name}","${gTxt}","${Math.round(r.rating)}","${r.gamesCount}","${r.confidence}"\n`
      })
    }
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `badminclub_${activeTab}_${genderFilter}_leaderboard.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const memberMap = useMemo(() => {
    const map = {}
    ;(db.members || []).forEach((m) => {
      map[m.id] = m
    })
    ;(db.guests || []).forEach((g) => {
      if (!map[g.id]) map[g.id] = g
    })
    return map
  }, [db.members, db.guests])

  const normalizedRatingsMap = useMemo(() => {
    const map = {}
    ;(db.members || []).forEach((m) => {
      const pr = getPlayerRating(db.playerRatings, m.id, m, db.levels)
      map[m.id] = pr.displayRating ?? pr.rating ?? DEFAULT_RATING
    })
    ;(db.guests || []).forEach((g) => {
      const pr = getPlayerRating(db.playerRatings, g.id, g, db.levels)
      map[g.id] = pr.displayRating ?? pr.rating ?? DEFAULT_RATING
    })
    return map
  }, [db.members, db.guests, db.playerRatings, db.levels])

  // Thành viên được chọn để mở Modal Hồ sơ / Biểu đồ Elo
  const currentMember = useMemo(() => {
    if (!selectedMemberId) return null
    return (
      activeMembers.find((m) => m.id === selectedMemberId) ||
      (db?.members || []).find((m) => m.id === selectedMemberId) ||
      (db?.guests || []).find((g) => g.id === selectedMemberId) ||
      null
    )
  }, [selectedMemberId, activeMembers, db?.members, db?.guests])

  const headerSubText = activeTab === 'season'
    ? t('season.headerSub')
    : activeTab === 'elo'
      ? t('season.eloHeaderSub')
      : activeTab === 'h2h'
        ? t('leaderboard.tabH2H')
        : t('leaderboard.sub')

  const headerActionButtons = (
    <>
      <button
        type="button"
        onClick={toggleTheme}
        title={isDark ? t('common.themeLight') : t('common.themeDark')}
        aria-label={isDark ? t('common.themeLight') : t('common.themeDark')}
        style={{
          font: "600 12px/1 'IBM Plex Sans', sans-serif",
          width: isMobile ? 32 : undefined,
          height: isMobile ? 32 : undefined,
          padding: isMobile ? 0 : '8px 12px',
          borderRadius: 6,
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          transition: 'all 0.15s ease',
          flexShrink: 0,
        }}
      >
        <Icon name={isDark ? 'sun' : 'moon'} size={15} />
        {!isMobile && <span>{isDark ? t('common.themeLight') : t('common.themeDark')}</span>}
      </button>

      <button
        type="button"
        onClick={toggleThemeMode}
        title={isGlamorous ? t('settings.themeModeSimple') : t('settings.themeModeGlamorous')}
        aria-label={isGlamorous ? t('settings.themeModeSimple') : t('settings.themeModeGlamorous')}
        style={{
          font: "600 12px/1 'IBM Plex Sans', sans-serif",
          height: isMobile ? 32 : undefined,
          padding: isMobile ? '0 8px' : '8px 12px',
          borderRadius: 6,
          background: isGlamorous ? 'linear-gradient(135deg, #FFE24B, #FF9E00)' : 'var(--surface-raised)',
          border: isGlamorous ? '1px solid #D4A836' : '1px solid var(--border-default)',
          color: isGlamorous ? '#140109' : 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          transition: 'all 0.15s ease',
          flexShrink: 0,
        }}
      >
        <Icon name="sparkles" size={15} />
        {!isMobile && <span>{isGlamorous ? t('settings.themeModeGlamorous') : t('settings.themeModeSimple')}</span>}
      </button>

      <button
        type="button"
        onClick={handleExportCsv}
        title={t('common.exportCsv')}
        aria-label={t('common.exportCsv')}
        style={{
          font: "600 12px/1 'IBM Plex Sans', sans-serif",
          width: isMobile ? 32 : undefined,
          height: isMobile ? 32 : undefined,
          padding: isMobile ? 0 : '8px 14px',
          borderRadius: 6,
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          transition: 'all 0.15s ease',
          flexShrink: 0,
        }}
      >
        <Icon name="download" size={14} />
        {!isMobile && <span>{t('common.exportCsv')}</span>}
      </button>

      {isAdmin && (
        <>
          <button
            type="button"
            onClick={() => setRecalcConfirmOpen(true)}
            title={t('leaderboard.recalcHint')}
            aria-label={t('leaderboard.btnRecalc')}
            style={{
              font: "600 12px/1 'IBM Plex Sans', sans-serif",
              width: isMobile ? 32 : undefined,
              height: isMobile ? 32 : undefined,
              padding: isMobile ? 0 : '8px 14px',
              borderRadius: 6,
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
          >
            <Icon name="rotate-ccw" size={14} />
            {!isMobile && <span>{t('leaderboard.btnRecalc')}</span>}
          </button>
          <button
            type="button"
            onClick={() => setSeasonSettingsOpen(true)}
            title={t('season.settingsBtn')}
            aria-label={t('season.settingsBtn')}
            style={{
              font: "600 12px/1 'IBM Plex Sans', sans-serif",
              width: isMobile ? 32 : undefined,
              height: isMobile ? 32 : undefined,
              padding: isMobile ? 0 : '8px 14px',
              borderRadius: 6,
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
          >
            <Icon name="settings" size={14} />
            {!isMobile && <span>{t('season.settingsBtn')}</span>}
          </button>
        </>
      )}
    </>
  )

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* ---------------- Header trang Bảng xếp hạng (Duy nhất) ---------------- */}
      <div
        style={{
          padding: isMobile ? '12px 14px' : '14px 20px',
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: isMobile ? 8 : 14,
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: isMobile ? 'nowrap' : 'wrap',
            minWidth: 0,
            flex: isMobile ? undefined : '1 1 240px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            <h1 style={{ font: isMobile ? "700 18px/1.2 Barlow, sans-serif" : "700 20px/1.25 Barlow, sans-serif", color: 'var(--text-primary)', margin: 0 }}>
              {t('leaderboard.title')}
            </h1>
            {!isMobile && (
              <div style={{ font: "400 13px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                {headerSubText}
              </div>
            )}
          </div>
          {isMobile && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
              {headerActionButtons}
            </div>
          )}
        </div>

        {isMobile && (
          <div style={{ font: "400 12.5px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
            {headerSubText}
          </div>
        )}

        {!isMobile && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {headerActionButtons}
          </div>
        )}
      </div>

      {/* ---------------- 1. Tab Bar chính của Leaderboard (3 Tab cốt lõi) ---------------- */}
      <TabTrack style={{ marginBottom: 4 }}>
        <div style={S.tabTrack}>
          <button
            type="button"
            onClick={() => setActiveTab('season')}
            style={{
              ...S.tabBtn,
              ...(activeTab === 'season'
                ? { ...S.tabBtnActive, background: '#00B2A9', color: '#04302C', fontWeight: 700 }
                : {}),
            }}
          >
            {t('season.raceTab')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('elo')}
            style={{
              ...S.tabBtn,
              ...(activeTab === 'elo'
                ? { ...S.tabBtnActive, background: '#1D50A0', color: '#fff', fontWeight: 700 }
                : {}),
            }}
          >
            {t('season.careerEloTab')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pairs')}
            style={{
              ...S.tabBtn,
              ...(activeTab === 'pairs'
                ? { ...S.tabBtnActive, background: '#00B2A9', color: '#04302C', fontWeight: 700 }
                : {}),
            }}
          >
            {t('leaderboard.tabPairs')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('h2h')}
            style={{
              ...S.tabBtn,
              ...(activeTab === 'h2h'
                ? { ...S.tabBtnActive, background: '#7C3AED', color: '#fff', fontWeight: 700 }
                : {}),
            }}
          >
            {t('leaderboard.tabH2H')}
          </button>
        </div>
      </TabTrack>

      {/* ---------------- TAB 1: Đua Top Mùa Giải (Screen SS1) ---------------- */}
      {activeTab === 'season' && (
        <SeasonRaceTab
          seasonLeaderboardData={seasonLeaderboardData}
          onOpenLedger={(m) => setLedgerMemberId(m?.id || m)}
          isMobile={isMobile}
          genderFilter={genderFilter}
          onGenderFilterChange={setGenderFilter}
        />
      )}

      {/* ---------------- TAB 2: Elo Cá Nhân & Sự Nghiệp (Screen CE1) ---------------- */}
      {activeTab === 'elo' && (
        <CareerEloTab
          db={db}
          activeMembers={activeMembers}
          genderFilter={genderFilter}
          onGenderFilterChange={setGenderFilter}
          rankTheme={rankTheme}
          onSelectTheme={(themeKey) => setRankTheme(themeKey)}
          onSelectMember={(m) => setSelectedMemberId(m.id || m)}
          onOpenEffectiveStrength={(player) => setEffectiveStrengthPlayer(player)}
          onOpenLedger={(m) => setLedgerMemberId(m?.id || m)}
          isMobile={isMobile}
        />
      )}

      {/* ---------------- TAB 3: Ăn ý & Cặp đôi (Screen AY1) ---------------- */}
      {activeTab === 'pairs' && (
        <PairsTab
          db={db}
          matches={db.matches || []}
          membersMap={memberMap}
          ratingsMap={normalizedRatingsMap}
          onExportCsv={handleExportCsv}
          onViewPairMatches={(pair) => {
            const pairKey = pair?.key || (pair?.playerA && pair?.playerB ? `${pair.playerA}:${pair.playerB}` : '')
            const [p1, p2] = pairKey.split(':')
            navigate(`/tran-dau?tab=history&playerA=${p1 || ''}&playerB=${p2 || ''}`)
          }}
          onOpenChallengeModal={(p1, p2) => {
            setInitialTeamA([p1])
            setInitialTeamB([p2])
            setChallengeModalOpen(true)
          }}
        />
      )}

      {/* ---------------- TAB 4: Đối đầu Cặp đôi (Screen H2H) ---------------- */}
      {activeTab === 'h2h' && (
        <PairH2HTab
          db={db}
          matches={db.matches || []}
          membersMap={memberMap}
          ratingsMap={normalizedRatingsMap}
        />
      )}

      {/* Modal tạo kèo / gạ kèo (K6) */}
      {challengeModalOpen && (
        <CreateChallengeModal
          onClose={() => setChallengeModalOpen(false)}
          onCreated={() => {
            setChallengeModalOpen(false)
            navigate('/tran-dau?tab=challenges')
          }}
          initialTeamA={initialTeamA}
          initialTeamB={initialTeamB}
        />
      )}

      {/* Sổ điểm chi tiết mùa giải VĐV (Screen SS3) */}
      {ledgerMemberId && (
        <MemberSeasonLedgerModal
          memberId={ledgerMemberId}
          db={db}
          seasonConfig={cfg.season}
          isMobile={isMobile}
          onClose={() => setLedgerMemberId(null)}
          onViewCareerElo={() => {
            setLedgerMemberId(null)
            setActiveTab('elo')
          }}
        />
      )}

      {/* Modal Thẩm định / Effective Strength (Screen CE3) */}
      {effectiveStrengthPlayer && (
        <EffectiveStrengthModal
          player={effectiveStrengthPlayer}
          onClose={() => setEffectiveStrengthPlayer(null)}
        />
      )}

      {/* Modal Cài đặt Mùa giải & Chốt mùa (Screen CE4) */}
      {seasonSettingsOpen && (
        <SeasonSettingsModal
          season={db.settings?.season || cfg.season}
          onClose={() => setSeasonSettingsOpen(false)}
          onSaveSeason={(newSeason) => {
            a.setSeasonConfig?.(newSeason)
            setSeasonSettingsOpen(false)
          }}
        />
      )}

      {/* Modal xác nhận Đồng bộ lại Elo */}
      {recalcConfirmOpen && (
        <Dialog
          open
          width={560}
          sheet={isMobile}
          title={t('leaderboard.recalcConfirmTitle')}
          description={t('leaderboard.recalcConfirmMsg')}
          onClose={() => setRecalcConfirmOpen(false)}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, width: '100%' }}>
              <Button variant="secondary" onClick={() => setRecalcConfirmOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                icon="rotate-ccw"
                onClick={() => {
                  setRecalcConfirmOpen(false)
                  a.recalcAllRatings?.()
                }}
              >
                {t('leaderboard.recalcConfirmBtn')}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <Alert tone="warning" title={t('leaderboard.recalcWarnTitle')}>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18, display: 'grid', gap: 4 }}>
                <li>{t('leaderboard.recalcAffect1')}</li>
                <li>{t('leaderboard.recalcAffect2')}</li>
                <li>{t('leaderboard.recalcAffect3')}</li>
                <li>{t('leaderboard.recalcAffect4')}</li>
              </ul>
            </Alert>
            <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
              {t('leaderboard.recalcSafeNote')}
            </div>
          </div>
        </Dialog>
      )}

      {/* Modal Chi tiết Hồ sơ & Biểu đồ Elo của thành viên */}
      {selectedMemberId && currentMember && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? 8 : 20,
          }}
          onClick={() => setSelectedMemberId(null)}
        >
          <div
            data-screen-label="Member Profile & Rating Chart Modal"
            style={{
              width: 1040,
              maxWidth: '100%',
              maxHeight: '92vh',
              background: 'var(--surface-overlay)',
              border: '1px solid var(--border-default)',
              borderRadius: 12,
              boxShadow: 'var(--shadow-overlay)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 18px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--surface-card)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={currentMember.name} src={currentMember.avatarUrl || currentMember.avatar} size={28} />
                <span style={{ font: "700 15px/1.2 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)' }}>
                  {currentMember.name}
                </span>
                <span style={{ font: "400 12px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                  · {t('leaderboard.tabChart')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMemberId(null)}
                aria-label={t('common.close')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 4,
                }}
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: isMobile ? 12 : 20, overflowY: 'auto', flex: 1 }}>
              <MemberProfileTab
                member={currentMember}
                allMembers={activeMembers}
                onSelectMember={(id) => setSelectedMemberId(id)}
                db={db}
                rankTheme={rankTheme}
                onSelectTheme={(themeKey) => setRankTheme(themeKey)}
                isMobile={isMobile}
                onChallenge={(targetId) => {
                  setSelectedMemberId(null)
                  setInitialTeamA([])
                  setInitialTeamB([targetId])
                  setChallengeModalOpen(true)
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  tabTrack: {
    display: 'flex',
    padding: 3,
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    gap: 2,
    overflowX: 'auto',
  },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 34,
    padding: '0 14px',
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    font: "600 13px/1 'IBM Plex Sans', sans-serif",
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    background: 'var(--surface-card)',
    color: 'var(--text-primary)',
    boxShadow: 'var(--shadow-xs)',
  },
}
