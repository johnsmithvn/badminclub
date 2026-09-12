import React, { useState, useMemo } from 'react'
import { t } from '#i18n'
import { useApp } from '#contexts/AppContext.jsx'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '#ds'
import BadgeHex from '#components/badges/BadgeHex.jsx'
import BadgeCard from '#components/badges/BadgeCard.jsx'
import BadgeShelf from '#components/badges/BadgeShelf.jsx'
import BountyHeroPoster from '#components/badges/BountyHeroPoster.jsx'
import BadgeDetailModal from '#components/badges/BadgeDetailModal.jsx'
import BountyBoardTab from '#components/badges/BountyBoardTab.jsx'
import BadgeUnlockModal from '#components/badges/BadgeUnlockModal.jsx'
import CollectorLeaderboardTab from '#components/badges/CollectorLeaderboardTab.jsx'
import AchievementFeed from '#components/badges/AchievementFeed.jsx'
import {
  calculateMemberBadges,
  getActiveBounties,
  getStreakTimeline,
  getBadgeOwners,
  getBadgeChasers,
  getCollectorLeaderboard,
  getRarestBadges,
  getClubAchievementFeed,
  ANIME_TIERS,
  NOTCH_CLIP,
  NOTCH_S_CLIP,
} from '#lib/badges.js'
import { calculateMemberXp } from '#lib/xp.js'
import { getSeasonRankLeaderboard } from '#lib/season.js'
import { myMember } from '#lib/money.js'
import badgesConfig from '#config/badges.json'

/**
 * Trang Master: Danh hiệu & Treo thưởng (Bản Anime).
 * Triển khai chuẩn xác theo file thiết kế:
 * - A1: Bộ sưu tập danh hiệu, Wanted Hero poster (Avatar thật), Collector Profile (Data thật),
 *       Sáu bậc khung lục giác, Kệ 3 ô của tôi, Lưới 4 nhóm danh hiệu.
 * - A2: Modal chi tiết danh hiệu, điều kiện, 10-slot tracker, owners, chasers.
 * - A3: Tab Bảng treo thưởng (Bảng truy nã), luật, hunter badges, Elo integrity.
 * - A4: Modal Mở khóa danh hiệu.
 * - A5: Tab Xếp hạng sưu tập, Top 1 vinh danh, rarest badges, quy tắc tính điểm.
 */
export default function Badges() {
  const { db, a } = useApp()
  const navigate = useNavigate()

  // Tab hiện tại: 'collection' (A1), 'bounty' (A3), 'leaderboard' (A5), 'feed'
  const [activeTab, setActiveTab] = useState('collection')

  // Modals state
  const [selectedBadge, setSelectedBadge] = useState(null)
  const [unlockingBadge, setUnlockingBadge] = useState(null)
  const [isEditingSignature, setIsEditingSignature] = useState(false)
  const [signatureDraft, setSignatureDraft] = useState('')
  const [viewingMemberId, setViewingMemberId] = useState(null)
  const [showRulesModal, setShowRulesModal] = useState(false)
  const [showShelfModal, setShowShelfModal] = useState(false)

  // Thành viên hiện tại (tài khoản đang đăng nhập)
  const currentMember = useMemo(() => {
    if (!db || !db.members || db.members.length === 0) {
      return null
    }
    return myMember(db) || db.members[0] || null
  }, [db])

  // Thành viên đang được xem bộ sưu tập (mặc định là chính mình)
  const activeMember = useMemo(() => {
    if (viewingMemberId && db && db.members) {
      const found = db.members.find((m) => m.id === viewingMemberId)
      if (found) return found
    }
    return currentMember
  }, [viewingMemberId, db, currentMember])

  const isViewingSelf = Boolean(activeMember && currentMember && activeMember.id === currentMember.id)

  // 1. Dữ liệu XP THẬT của thành viên đang xem
  const memberXpData = useMemo(() => {
    if (!activeMember?.id) return { xp: 0, level: 1, currentLevel: 1, progressPct: 0 }
    return calculateMemberXp(activeMember.id, db)
  }, [activeMember?.id, db])

  // 2. Mùa giải hiện tại
  const currentSeason = useMemo(() => {
    const seasons = db?.seasons || []
    return seasons.find((s) => s.active) || seasons[0] || {}
  }, [db?.seasons])

  // 3. Bảng xếp hạng mùa giải để lấy Điểm Mùa & Hạng Mùa THẬT
  const seasonRows = useMemo(() => {
    return getSeasonRankLeaderboard(db, currentSeason)
  }, [db, currentSeason])

  const memberSeasonData = useMemo(() => {
    const found = seasonRows.find((r) => r.id === activeMember.id)
    return {
      seasonPoints: found?.totalSeasonPoints ?? found?.seasonPoints ?? 0,
      rank: found?.rank ?? '—',
    }
  }, [seasonRows, activeMember.id])

  // 4. Bảng xếp hạng Collector THẬT
  const collectors = useMemo(() => {
    return getCollectorLeaderboard(db)
  }, [db])

  const memberCollectorRank = useMemo(() => {
    const idx = collectors.findIndex((c) => c.id === activeMember.id)
    return idx >= 0 ? idx + 1 : '—'
  }, [collectors, activeMember.id])

  // 5. Tính toán toàn bộ danh hiệu của thành viên đang xem
  const memberBadges = useMemo(() => {
    return calculateMemberBadges(activeMember.id, db)
  }, [activeMember.id, db])

  // 6. Danh sách các Bounty đang mở từ DB THẬT
  const bounties = useMemo(() => {
    return getActiveBounties(db)
  }, [db])

  // 7. Top huy hiệu hiếm nhất CLB
  const rarestBadges = useMemo(() => {
    return getRarestBadges(db)
  }, [db])

  // 8. 4 nhóm danh hiệu
  const catalogGroups = useMemo(() => {
    const groups = badgesConfig.groups || []
    const all = memberBadges.all || []

    return groups.map((g) => ({
      ...g,
      badges: all.filter((b) => b.groupId === g.id || b.group === g.id),
    }))
  }, [memberBadges.all])

  // Thống kê số lượng danh hiệu chính thức (không tính tự phong)
  const officialUnlockedCount =
    memberBadges.officialUnlocked?.length ??
    (memberBadges.unlocked || []).filter((b) => b.tier !== 'fun').length
  const inProgressCount = memberBadges.inProgress?.length || 0
  const totalOfficialCount = (memberBadges.all || []).filter((b) => b.tier !== 'fun').length

  // Thao tác gắn danh hiệu lên kệ
  const handleToggleShelf = (badgeId) => {
    if (!badgeId || !currentMember?.id) return
    const currentShelf = (currentMember.badge_shelf || currentMember.badgeShelf || []).slice()
    const foundIdx = currentShelf.indexOf(badgeId)
    if (foundIdx >= 0) {
      currentShelf.splice(foundIdx, 1)
    } else {
      if (currentShelf.length >= (badgesConfig.shelfSlots || 3)) {
        currentShelf.pop() // Thay ô cuối nếu đã đầy 3 ô
      }
      currentShelf.unshift(badgeId)
    }

    if (a && a.setMemberShelf) {
      a.setMemberShelf(currentMember.id, currentShelf)
    }
  }

  // Lưu châm ngôn / chữ ký
  const handleSaveSignature = () => {
    if (!currentMember?.id) return
    if (a && a.setMemberSignature) {
      a.setMemberSignature(currentMember.id, signatureDraft.trim())
    }
    setIsEditingSignature(false)
  }

  // Bảng tin thành tích CLB
  const clubFeed = useMemo(() => {
    return getClubAchievementFeed(db)
  }, [db])

  // Dữ liệu cho Modal A2 Chi tiết danh hiệu (tối ưu tránh tính toán lại trong render)
  const selectedBadgeOwners = useMemo(() => {
    if (!selectedBadge?.id || !db) return []
    return getBadgeOwners(selectedBadge.id, db)
  }, [selectedBadge?.id, db])

  const selectedBadgeChasers = useMemo(() => {
    if (!selectedBadge?.id || !db) return []
    return getBadgeChasers(selectedBadge.id, currentMember?.id, db)
  }, [selectedBadge?.id, currentMember?.id, db])

  const streakTimeline = useMemo(() => {
    if (!selectedBadge || !currentMember?.id || !db) return []
    return getStreakTimeline(currentMember.id, db, 10)
  }, [selectedBadge, currentMember?.id, db])

  // Danh sách tabs phong cách Anime
  const tabs = [
    { id: 'collection', label: t('badges.tabCollection') },
    { id: 'bounty', label: t('badges.tabBounty') },
    { id: 'leaderboard', label: t('badges.tabLeaderboard') },
    { id: 'feed', label: t('badges.tabFeed') },
  ]

  // Hero Bounty Poster mục tiêu hot nhất
  const heroBounty = bounties.length > 0 ? bounties[0] : null

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        paddingBottom: 40,
        color: '#FFFFFF',
      }}
    >
      {/* ═══ Header Bar (Thiết kế A1) ═══ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          padding: '14px 4px',
          borderBottom: '1px solid #2A1145',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              font: '700 26px/1 Oswald, sans-serif',
              letterSpacing: '.03em',
              textTransform: 'uppercase',
              color: '#FFFFFF',
            }}
          >
            {t('badges.title')}
          </div>
          <div style={{ font: "400 12px/1.4 'IBM Plex Mono', monospace", color: '#9C8ABE' }}>
            {currentSeason.name || t('badges.seasonHeader')}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Dropdown xem nhanh bộ sưu tập thành viên khác */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ font: "400 11.5px/1 'Be Vietnam Pro', sans-serif", color: '#9C8ABE' }}>
              {t('badges.selectMember')}
            </span>
            <select
              value={activeMember.id}
              onChange={(e) => {
                const val = e.target.value
                setViewingMemberId(val === currentMember.id ? null : val)
                setActiveTab('collection')
              }}
              style={{
                background: '#190C2D',
                border: '1px solid #3B1B66',
                borderRadius: 6,
                color: '#FFFFFF',
                padding: '5px 10px',
                fontSize: 12,
                fontFamily: "'Be Vietnam Pro', sans-serif",
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {(db?.members || []).map((m) => (
                <option key={m.id} value={m.id} style={{ background: '#1D0D35', color: '#FFFFFF' }}>
                  {m.name} {m.id === currentMember.id ? `(${t('badges.collectorProfile.rankMe')})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Nút Sắp lại kệ */}
          <button
            type="button"
            onClick={() => setShowShelfModal(true)}
            style={{
              font: '600 11.5px/1 Oswald, sans-serif',
              letterSpacing: '.12em',
              padding: '10px 16px',
              clipPath: NOTCH_S_CLIP,
              background: 'rgba(255,255,255,.06)',
              border: 'none',
              borderTop: '1px solid #8B2BFF',
              color: '#D9A8FF',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.06)')}
          >
            {t('badges.reorderShelf')}
          </button>

          {/* Nút Luật danh hiệu */}
          <button
            type="button"
            onClick={() => setShowRulesModal(true)}
            style={{
              font: '600 11.5px/1 Oswald, sans-serif',
              letterSpacing: '.12em',
              padding: '10px 16px',
              clipPath: NOTCH_S_CLIP,
              background: 'rgba(255,255,255,.06)',
              border: 'none',
              borderTop: '1px solid #8B2BFF',
              color: '#D9A8FF',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.06)')}
          >
            {t('badges.rulesBtn')}
          </button>
        </div>
      </div>

      {/* ═══ Hàng Tabs & Tóm tắt số lượng (Thiết kế A1) ═══ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  font: '600 12px/1 Oswald, sans-serif',
                  letterSpacing: '.12em',
                  padding: '11px 18px',
                  clipPath: NOTCH_S_CLIP,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all .15s ease',
                  background: isActive
                    ? 'linear-gradient(135deg, #FF2E7E, #FFB03A)'
                    : 'rgba(255,255,255,.05)',
                  color: isActive ? '#140109' : '#9C8ABE',
                  boxShadow: isActive ? '0 0 16px rgba(255,46,126,.4)' : 'none',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <span style={{ font: "400 12px/1 'IBM Plex Mono', monospace", color: '#9C8ABE' }}>
          {t('badges.collectionSummary', {
            opened: officialUnlockedCount,
            total: totalOfficialCount,
            chasing: inProgressCount,
          })}
        </span>
      </div>

      {/* ═══ NỘI DUNG CHÍNH THEO TAB ═══ */}

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: BỘ SƯU TẬP DANH HIỆU (MÀN A1 · CHUẨN THIẾT KẾ)
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'collection' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Banner nếu đang xem bộ sưu tập của người khác */}
          {!isViewingSelf && (
            <div
              style={{
                padding: '12px 18px',
                clipPath: NOTCH_S_CLIP,
                background: 'linear-gradient(135deg, rgba(255, 46, 126, 0.25), rgba(121, 40, 202, 0.35))',
                border: '1px solid rgba(255, 46, 126, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>👁</span>
                <span style={{ font: "600 14px/1.3 'Be Vietnam Pro', sans-serif", color: '#FFFFFF' }}>
                  {t('badges.viewingOther', { name: activeMember.name })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingMemberId(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: 6,
                  color: '#FFE24B',
                  padding: '6px 14px',
                  cursor: 'pointer',
                  font: "600 12px/1 'Be Vietnam Pro', sans-serif",
                }}
              >
                {t('badges.backToMyCollection')}
              </button>
            </div>
          )}

          {/* 1. Hero Bounty Poster (Avatar thật + Quầng sáng Anime) */}
          <BountyHeroPoster
            bounty={heroBounty}
            onChallenge={(b) => {
              if (b && b.targetId) {
                navigate(`/bang-xep-hang?tab=search&playerA=${b.targetId}`)
              } else {
                navigate('/chia-san')
              }
            }}
          />

          {/* 2. Khối 2 cột: Hồ sơ nhà sưu tập (Profile) & Sáu bậc lục giác (6 Tiers) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
              gap: 16,
              alignItems: 'stretch',
            }}
          >
            {/* CỘT TRÁI: THẺ HỒ SƠ NHÀ SƯU TẬP (Collector Profile Card) */}
            <div
              style={{
                position: 'relative',
                padding: 1,
                clipPath: NOTCH_CLIP,
                background: 'linear-gradient(120deg, #6D14FF, #2EE9FF 80%)',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  clipPath: NOTCH_CLIP,
                  background: 'linear-gradient(150deg, #1A0B35, #0B0518)',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 15,
                  height: '100%',
                }}
              >
                {/* Vòng xoay tia sáng background */}
                <div
                  style={{
                    position: 'absolute',
                    top: '-140%',
                    left: '-12%',
                    width: 520,
                    height: 520,
                    background: 'repeating-conic-gradient(from 0deg, rgba(109,20,255,.2) 0deg 5deg, transparent 5deg 15deg)',
                    animation: 'aSpinBack 30s linear infinite',
                    pointerEvents: 'none',
                  }}
                />

                {/* Dòng 1: Avatar thật + Tên + Cấp + Chữ ký + Huy hiệu đã mở */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 15 }}>
                  {/* AVATAR THẬT TRONG KHUNG LỤC GIÁC CONIC XANH LAM */}
                  <div style={{ position: 'relative', width: 64, height: 64, flex: '0 0 auto' }}>
                    <div
                      style={{
                        position: 'absolute',
                        inset: '-22%',
                        background: 'radial-gradient(50% 50% at 50% 50%, rgba(46,233,255,.4), transparent 70%)',
                        animation: 'aPulse 4s ease-in-out infinite',
                        pointerEvents: 'none',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        clipPath: 'polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)',
                        background: 'conic-gradient(from 200deg, #0B63FF, #2EE9FF, #D6FEFF, #FFFFFF, #2EE9FF, #0B63FF)',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 3,
                        clipPath: 'polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)',
                        background: 'radial-gradient(120% 120% at 50% 8%, #032C5E, #01101F 72%)',
                        display: 'grid',
                        placeItems: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      <Avatar
                        name={activeMember.name}
                        src={activeMember.avatar_url || activeMember.avatarUrl}
                        size={58}
                      />
                    </div>
                  </div>

                  <div style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          font: '700 22px/1 Oswald, sans-serif',
                          letterSpacing: '.04em',
                          textTransform: 'uppercase',
                          color: '#FFFFFF',
                        }}
                      >
                        {activeMember.name} {isViewingSelf ? `· ${t('season.youBadge')}` : ''}
                      </span>
                      <span
                        style={{
                          font: '700 10px/1 Oswald, sans-serif',
                          letterSpacing: '.16em',
                          padding: '5px 9px',
                          clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                          background: 'linear-gradient(135deg, #0B63FF, #2EE9FF)',
                          color: '#01101F',
                        }}
                      >
                        {t('badges.collectorProfile.level', { level: memberXpData.level })}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ font: "400 11.5px/1 'IBM Plex Mono', monospace", color: '#7E6FA0' }}>
                        {t('badges.collectorProfile.signature', {
                          sig: activeMember.signature || t('badges.collectorProfile.notSelected'),
                          shelf: memberBadges.shelfBadges?.length || 0,
                          max: badgesConfig.shelfSlots || 3,
                        })}
                      </span>
                      {isViewingSelf && (
                        <button
                          type="button"
                          onClick={() => {
                            setSignatureDraft(currentMember.signature || '')
                            setIsEditingSignature(true)
                          }}
                          title={t('badges.signatureModal.title')}
                          style={{
                            background: 'rgba(255, 226, 75, 0.1)',
                            border: '1px solid rgba(255, 226, 75, 0.3)',
                            borderRadius: 4,
                            color: '#FFE24B',
                            padding: '1px 6px',
                            cursor: 'pointer',
                            fontSize: 10,
                            fontFamily: "'IBM Plex Mono', monospace",
                          }}
                        >
                          ✎
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                    <span style={{ font: '700 26px/1 Oswald, sans-serif', color: '#7FE7FF' }}>
                      {officialUnlockedCount} / {totalOfficialCount}
                    </span>
                    <span style={{ font: '600 9.5px/1 Oswald, sans-serif', letterSpacing: '.16em', color: '#7E6FA0' }}>
                      {t('badges.collectorProfile.unlockedLabel')}
                    </span>
                  </div>
                </div>

                {/* Dòng 2: Thanh tiến độ lên cấp XP thật từ DB */}
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ font: '600 10px/1 Oswald, sans-serif', letterSpacing: '.16em', color: '#7FE7FF' }}>
                      {t('badges.collectorProfile.nextLevelTitle', { nextLevel: memberXpData.level + 1 })}
                    </span>
                    <div style={{ flex: '1 1 0%' }} />
                    <span style={{ font: "600 12px/1 'IBM Plex Mono', monospace", color: '#C9B8E6' }}>
                      {t('badges.collectorProfile.nextLevelProgress', {
                        current: (memberXpData.totalXp - memberXpData.currentLevelBaseXp).toLocaleString('vi-VN'),
                        target: (memberXpData.nextLevelXp - memberXpData.currentLevelBaseXp).toLocaleString('vi-VN'),
                      })}
                    </span>
                  </div>
                  <div style={{ height: 10, clipPath: NOTCH_S_CLIP, background: 'rgba(255,255,255,.09)' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${memberXpData.levelProgressPct}%`,
                        background: 'linear-gradient(90deg, #0B63FF, #2EE9FF)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                  <span style={{ font: "400 11px/1.4 'IBM Plex Mono', monospace", color: '#7E6FA0' }}>
                    {t('badges.collectorProfile.nextLevelHint', {
                      remain: Math.max(0, memberXpData.nextLevelXp - memberXpData.totalXp).toLocaleString('vi-VN'),
                    })}
                  </span>
                </div>

                {/* Dòng 3: 3 Ô chỉ số THẬT từ DB (XP Tích luỹ · Điểm mùa · Điểm sưu tập) */}
                <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                  <div style={{ padding: '11px 13px', clipPath: NOTCH_S_CLIP, background: 'rgba(255,122,24,.1)', borderTop: '1px solid #FF7A18', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <span style={{ font: '600 9.5px/1 Oswald, sans-serif', letterSpacing: '.16em', color: '#FFC46B' }}>
                      {t('badges.collectorProfile.xpAccumulated')}
                    </span>
                    <span style={{ font: '700 20px/1 Oswald, sans-serif', color: '#FFFFFF' }}>
                      {memberXpData.totalXp.toLocaleString('vi-VN')}
                    </span>
                    <span style={{ font: "400 10px/1 'IBM Plex Mono', monospace", color: '#7E6FA0' }}>
                      {t('badges.collectorProfile.xpNote')}
                    </span>
                  </div>
                  <div style={{ padding: '11px 13px', clipPath: NOTCH_S_CLIP, background: 'rgba(46,233,192,.1)', borderTop: '1px solid #0E9F8E', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <span style={{ font: '600 9.5px/1 Oswald, sans-serif', letterSpacing: '.16em', color: '#5FEBD0' }}>
                      {t('badges.collectorProfile.seasonPoints')}
                    </span>
                    <span style={{ font: '700 20px/1 Oswald, sans-serif', color: '#FFFFFF' }}>
                      {memberSeasonData.seasonPoints}
                    </span>
                    <span style={{ font: "400 10px/1 'IBM Plex Mono', monospace", color: '#7E6FA0' }}>
                      {t('badges.collectorProfile.seasonPointsNote', { rank: memberSeasonData.rank })}
                    </span>
                  </div>
                  <div style={{ padding: '11px 13px', clipPath: NOTCH_S_CLIP, background: 'rgba(255,46,126,.1)', borderTop: '1px solid #FF2E7E', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <span style={{ font: '600 9.5px/1 Oswald, sans-serif', letterSpacing: '.16em', color: '#FFC46B' }}>
                      {t('badges.collectorProfile.collectionPoints')}
                    </span>
                    <span style={{ font: '700 20px/1 Oswald, sans-serif', color: '#FFFFFF' }}>
                      {memberBadges.collectionScore}
                    </span>
                    <span style={{ font: "400 10px/1 'IBM Plex Mono', monospace", color: '#7E6FA0' }}>
                      {t('badges.collectorProfile.collectionPointsNote', { rank: memberCollectorRank })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* CỘT PHẢI: SÁU BẬC · KHUNG LỤC GIÁC (Six Tiers Showcase) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: '15px 17px',
                clipPath: NOTCH_CLIP,
                background: 'rgba(255,255,255,.04)',
                border: '1px solid #2A1145',
              }}
            >
              <div style={{ font: '700 13px/1 Oswald, sans-serif', letterSpacing: '.12em', color: '#FFFFFF' }}>
                {t('badges.sixTiersTitle')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                {Object.keys(ANIME_TIERS).map((k) => {
                  const tMeta = ANIME_TIERS[k]
                  const glyph =
                    k === 'legend'
                      ? 'flame'
                      : k === 'epic'
                        ? 'thunder'
                        : k === 'elite'
                          ? 'wing'
                          : k === 'rare'
                            ? 'crystal'
                            : k === 'fun'
                              ? 'horn'
                              : 'crystal'

                  return (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <BadgeHex tier={k} glyph={glyph} size={44} dim={k === 'hidden'} spin={tMeta.spin} />
                      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ font: '600 13px/1 Oswald, sans-serif', letterSpacing: '.12em', color: tMeta.ink }}>
                          {tMeta.name}
                        </span>
                        <span style={{ font: "400 10.5px/1.3 'IBM Plex Mono', monospace", color: '#7E6FA0' }}>
                          {tMeta.note}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 3. KỆ DANH HIỆU CỦA TÔI (My Badge Shelf) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 11,
              padding: '15px 17px',
              clipPath: NOTCH_CLIP,
              background: 'rgba(255,255,255,.04)',
              border: '1px solid #2A1145',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ font: '700 15px/1 Oswald, sans-serif', letterSpacing: '.1em', color: '#FFFFFF' }}>
                  {t('badges.myShelfTitle')}
                </span>
                <span style={{ font: "400 11.5px/1 'IBM Plex Mono', monospace", color: '#9C8ABE' }}>
                  {t('badges.myShelfNote')}
                </span>
              </div>
              {isViewingSelf && (
                <button
                  type="button"
                  onClick={() => setShowShelfModal(true)}
                  style={{
                    font: '600 11px/1 Oswald, sans-serif',
                    letterSpacing: '.12em',
                    padding: '6px 12px',
                    clipPath: NOTCH_S_CLIP,
                    background: 'rgba(255,255,255,.08)',
                    border: 'none',
                    borderTop: '1px solid #8B2BFF',
                    color: '#D9A8FF',
                    cursor: 'pointer',
                  }}
                >
                  {t('badges.reorderShelf')}
                </button>
              )}
            </div>

            <BadgeShelf
              shelf={memberBadges.shelfBadges}
              onSlotClick={(idx, badge) => {
                if (badge) {
                  setSelectedBadge(badge)
                } else if (isViewingSelf) {
                  setShowShelfModal(true)
                }
              }}
            />
          </div>

          {/* 4. Lưới 4 Nhóm Danh Hiệu theo bản thiết kế Anime A1 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {catalogGroups.map((group) => {
              const groupBadges = group.badges || []
              const openedInGroup = groupBadges.filter((b) => b.unlocked).length
              const groupTone = group.tone || 'elite'
              const toneMeta = ANIME_TIERS[groupTone] || ANIME_TIERS.elite

              return (
                <div key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Header nhóm */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ width: 3, height: 20, background: 'linear-gradient(180deg,#FF2E7E,#6D14FF)' }} />
                    <span style={{ font: '700 17px/1 Oswald, sans-serif', letterSpacing: '.1em', color: '#FFFFFF' }}>
                      {t(`badges.groups.${group.key}`).toUpperCase()}
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        font: '600 10px/1 Oswald, sans-serif',
                        letterSpacing: '.14em',
                        padding: '4px 8px',
                        clipPath: NOTCH_S_CLIP,
                        background: toneMeta.chipBg,
                        color: toneMeta.ink,
                        borderTop: `1px solid ${toneMeta.bd}`,
                      }}
                    >
                      {groupTone === 'fun' ? `${groupBadges.length} / 10` : `${openedInGroup} / ${groupBadges.length}`}
                    </span>
                    <span style={{ font: "400 12px/1 'Be Vietnam Pro', sans-serif", color: '#7E6FA0' }}>
                      {t(`badges.groups.${group.key}Note`)}
                    </span>
                    <div style={{ flex: '1 1 0%', height: 1, background: 'linear-gradient(90deg,#2A1145,transparent)' }} />
                  </div>

                  {/* Lưới các thẻ danh hiệu 5 cột */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                      gap: 12,
                    }}
                  >
                    {groupBadges.map((badge) => (
                      <BadgeCard
                        key={badge.id}
                        badge={badge}
                        onClick={(b) => setSelectedBadge(b)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: BẢNG TREO THƯỞNG (Màn A3)
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'bounty' && (
        <BountyBoardTab
          bounties={bounties}
          onChallenge={(b) => {
            if (b && b.targetId) {
              navigate(`/bang-xep-hang?tab=search&playerA=${b.targetId}`)
            } else {
              navigate('/chia-san')
            }
          }}
          onViewBadge={(b) => setSelectedBadge(b)}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: XẾP HẠNG SƯU TẬP (Màn A5)
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'leaderboard' && (
        <CollectorLeaderboardTab
          collectors={collectors}
          rarestBadges={rarestBadges}
          onSelectMember={(m) => {
            if (m && m.id) {
              setViewingMemberId(m.id)
              setActiveTab('collection')
            }
          }}
          onViewBadge={(b) => setSelectedBadge(b)}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: BẢNG TIN THÀNH TÍCH (Achievement Feed)
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'feed' && <AchievementFeed feed={clubFeed} />}

      {/* ═══ MODAL A2: CHI TIẾT DANH HIỆU ═══ */}
      {selectedBadge && (
        <BadgeDetailModal
          badge={selectedBadge}
          streakTimeline={streakTimeline}
          owners={selectedBadgeOwners}
          chasers={selectedBadgeChasers}
          onClose={() => setSelectedBadge(null)}
          onShowUnlock={(b) => setUnlockingBadge(b)}
        />
      )}

      {/* ═══ MODAL A4: MỞ KHÓA DANH HIỆU ═══ */}
      {unlockingBadge && (
        <BadgeUnlockModal
          badge={unlockingBadge}
          shelfCount={(currentMember?.badge_shelf || currentMember?.badgeShelf || []).length}
          shelfIsFull={(currentMember?.badge_shelf || currentMember?.badgeShelf || []).length >= 3}
          onEquipShelf={(b) => {
            handleToggleShelf(b?.id || unlockingBadge.id)
            setUnlockingBadge(null)
          }}
          onViewCollection={() => setUnlockingBadge(null)}
          onClose={() => setUnlockingBadge(null)}
        />
      )}

      {/* ═══ MODAL SẮP LẠI KỆ (Shelf Reorder Modal) ═══ */}
      {showShelfModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(7,3,15,.85)',
            backdropFilter: 'blur(8px)',
            padding: 16,
          }}
          onClick={() => setShowShelfModal(false)}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 580,
              padding: 1,
              clipPath: NOTCH_CLIP,
              background: 'linear-gradient(135deg, #6D14FF, #2EE9FF 70%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                clipPath: NOTCH_CLIP,
                background: '#120823',
                padding: '24px 26px',
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                maxHeight: '85vh',
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ font: '700 20px/1 Oswald, sans-serif', color: '#FFFFFF' }}>
                    {t('badges.shelfModalTitle')}
                  </span>
                  <span style={{ font: "400 12px/1.4 'Be Vietnam Pro', sans-serif", color: '#9C8ABE' }}>
                    {t('badges.shelfModalDesc')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowShelfModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#9C8ABE',
                    cursor: 'pointer',
                    fontSize: 20,
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Danh sách các danh hiệu đã mở của người dùng */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {memberBadges.all
                  .filter((b) => b.unlocked || b.tier === 'fun')
                  .map((badge) => {
                    const isEquipped = (currentMember.badge_shelf || []).includes(badge.id)
                    const tierMeta = ANIME_TIERS[badge.tier] || ANIME_TIERS.rare

                    return (
                      <div
                        key={badge.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 14px',
                          clipPath: NOTCH_S_CLIP,
                          background: isEquipped ? 'rgba(109,20,255,.25)' : 'rgba(255,255,255,.04)',
                          border: isEquipped ? '1px solid #8B2BFF' : '1px solid rgba(255,255,255,.08)',
                        }}
                      >
                        <BadgeHex tier={badge.tier} glyph={badge.glyph} size={40} />
                        <div style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ font: "700 13.5px/1.2 'Be Vietnam Pro', sans-serif", color: '#FFFFFF' }}>
                            {t(`badges.items.${badge.id}.name`, { defaultValue: badge.name })}
                          </span>
                          <span style={{ font: '600 9.5px/1 Oswald, sans-serif', color: tierMeta.ink }}>
                            {tierMeta.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleShelf(badge.id)}
                          style={{
                            font: '600 11px/1 Oswald, sans-serif',
                            letterSpacing: '.12em',
                            padding: '6px 14px',
                            clipPath: NOTCH_S_CLIP,
                            border: 'none',
                            cursor: 'pointer',
                            background: isEquipped
                              ? 'rgba(255,46,126,.2)'
                              : 'linear-gradient(135deg, #0B63FF, #2EE9FF)',
                            color: isEquipped ? '#FF7A9E' : '#01101F',
                          }}
                        >
                          {isEquipped ? t('badges.unequipBtn') : t('badges.equipBtn')}
                        </button>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL LUẬT DANH HIỆU (Rules Modal) ═══ */}
      {showRulesModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(7,3,15,.85)',
            backdropFilter: 'blur(8px)',
            padding: 16,
          }}
          onClick={() => setShowRulesModal(false)}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 580,
              padding: 1,
              clipPath: NOTCH_CLIP,
              background: 'linear-gradient(135deg, #FF2E7E, #FFE24B 60%, #6D14FF)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                clipPath: NOTCH_CLIP,
                background: '#120823',
                padding: '24px 26px',
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ font: '700 20px/1 Oswald, sans-serif', color: '#FFFFFF' }}>
                  {t('badges.rulesModalTitle')}
                </span>
                <button
                  type="button"
                  onClick={() => setShowRulesModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#9C8ABE',
                    cursor: 'pointer',
                    fontSize: 20,
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {badgesConfig.bounty?.rules?.map((rule, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: '10px 14px',
                      clipPath: NOTCH_S_CLIP,
                      background: 'rgba(255,255,255,.04)',
                      borderLeft: '2px solid #FF2E7E',
                    }}
                  >
                    <span style={{ font: "700 13px/1 'IBM Plex Mono', monospace", color: '#FFC46B' }}>
                      0{idx + 1}
                    </span>
                    <span style={{ font: "400 13px/1.4 'Be Vietnam Pro', sans-serif", color: '#E6CFDE' }}>
                      {rule}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL SỬA CHÂM NGÔN / CHỮ KÝ ═══ */}
      {isEditingSignature && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(7, 3, 15, 0.85)',
            backdropFilter: 'blur(8px)',
            padding: 16,
          }}
          onClick={() => setIsEditingSignature(false)}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 480,
              padding: 1,
              clipPath: NOTCH_CLIP,
              background: 'linear-gradient(135deg, #FF2E7E, #FFE24B)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                clipPath: NOTCH_CLIP,
                background: '#15082A',
                padding: '24px 26px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span
                  style={{
                    font: '700 18px/1 Oswald, sans-serif',
                    letterSpacing: '.06em',
                    color: '#FFFFFF',
                  }}
                >
                  {t('badges.signatureModal.title')}
                </span>
                <span style={{ font: "400 12px/1.4 'Be Vietnam Pro', sans-serif", color: '#9C8ABE' }}>
                  {t('badges.signatureModal.sub')}
                </span>
              </div>

              <input
                type="text"
                maxLength={60}
                value={signatureDraft}
                onChange={(e) => setSignatureDraft(e.target.value)}
                placeholder={t('badges.signatureModal.placeholder')}
                style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid #6D14FF',
                  borderRadius: 6,
                  color: '#FFFFFF',
                  padding: '12px 14px',
                  fontSize: 14,
                  fontFamily: "'Be Vietnam Pro', sans-serif",
                  outline: 'none',
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsEditingSignature(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    color: '#C9B8E6',
                    padding: '8px 16px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    font: '600 12px/1 Oswald, sans-serif',
                  }}
                >
                  {t('badges.signatureModal.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSaveSignature}
                  style={{
                    background: 'linear-gradient(135deg, #FFE24B, #FF7A18)',
                    border: 'none',
                    color: '#140109',
                    padding: '8px 18px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    font: '700 12px/1 Oswald, sans-serif',
                    letterSpacing: '.1em',
                  }}
                >
                  {t('badges.signatureModal.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
