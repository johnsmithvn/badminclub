import React, { useState, useMemo } from 'react'
import { t } from '#i18n'
import { useApp } from '#contexts/AppContext.jsx'
import { useNavigate } from 'react-router-dom'
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
  HEX_CLIP,
  NOTCH_CLIP,
  NOTCH_S_CLIP,
} from '#lib/badges.js'
import badgesConfig from '#config/badges.json'

/**
 * Trang Master: Danh hiệu & Treo thưởng (Bản Anime).
 * Tích hợp 5 màn A1, A2, A3, A4, A5:
 * - A1: Bộ sưu tập danh hiệu, Wanted Hero poster, Collector Profile, 6-tier showcase, My Shelf, 4 nhóm danh hiệu.
 * - A2: Modal chi tiết danh hiệu, điều kiện, 10-slot tracker, owners, chasers.
 * - A3: Tab Bảng treo thưởng (Bảng truy nã), luật, hunter badges, Elo integrity.
 * - A4: Modal Fanfare Mở khóa danh hiệu lộng lẫy (speed lines, rotating conic rays, 190px badge).
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

  // Thành viên hiện tại (tài khoản đang đăng nhập)
  const currentMember = useMemo(() => {
    if (!db || !db.members || db.members.length === 0) {
      return { id: 'demo-me', name: 'Me' }
    }
    const found = db.members.find(
      (m) => m.user_id && db.currentUser && m.user_id === db.currentUser.id,
    )
    return found || db.members[0]
  }, [db])

  // Thành viên đang được xem bộ sưu tập (mặc định là chính mình)
  const activeMember = useMemo(() => {
    if (viewingMemberId && db && db.members) {
      const found = db.members.find((m) => m.id === viewingMemberId)
      if (found) return found
    }
    return currentMember
  }, [viewingMemberId, db, currentMember])

  const isViewingSelf = activeMember.id === currentMember.id

  // Tính toán toàn bộ danh hiệu của thành viên đang xem
  const memberBadges = useMemo(() => {
    return calculateMemberBadges(activeMember.id, db)
  }, [activeMember.id, db])

  // Danh sách các Bounty đang mở
  const bounties = useMemo(() => {
    return getActiveBounties(db?.matches || [], db?.members || [])
  }, [db?.matches, db?.members])

  // Bảng xếp hạng Collector
  const collectors = useMemo(() => {
    return getCollectorLeaderboard(db)
  }, [db])

  // Top huy hiệu hiếm nhất CLB
  const rarestBadges = useMemo(() => {
    return getRarestBadges(db)
  }, [db])

  // 4 nhóm danh hiệu
  const catalogGroups = useMemo(() => {
    const groups = badgesConfig.groups || []
    const all = memberBadges.all || []

    return groups.map((g) => ({
      ...g,
      badges: all.filter((b) => b.group === g.id),
    }))
  }, [memberBadges.all])

  // Thao tác gắn danh hiệu lên kệ
  const handleEquipShelf = (badge) => {
    if (!badge) return
    const currentShelf = (currentMember.badge_shelf || []).slice()
    const foundIdx = currentShelf.indexOf(badge.id)
    if (foundIdx >= 0) {
      currentShelf.splice(foundIdx, 1)
    }
    if (currentShelf.length >= (badgesConfig.shelfSlots || 3)) {
      currentShelf.pop() // Thay ô cuối
    }
    currentShelf.unshift(badge.id)

    if (a && a.setMemberShelf) {
      a.setMemberShelf(currentMember.id, currentShelf)
    } else {
      currentMember.badge_shelf = currentShelf
    }

    if (unlockingBadge) {
      setUnlockingBadge(null)
    }
  }

  // Bảng tin thành tích CLB
  const clubFeed = useMemo(() => {
    return getClubAchievementFeed(db)
  }, [db])

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
        gap: 22,
        paddingBottom: 40,
        color: '#FFFFFF',
      }}
    >
      {/* ═══ Header Bar & Sub-Navigation Tabs ═══ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          paddingBottom: 16,
          borderBottom: '1px solid #2A1145',
        }}
      >
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  font: '700 13px/1 Oswald, sans-serif',
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  padding: '10px 20px',
                  clipPath: NOTCH_S_CLIP,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all .15s ease',
                  background: isActive
                    ? 'linear-gradient(135deg, #FF2E7E, #FFE24B)'
                    : 'rgba(255,255,255,.05)',
                  color: isActive ? '#140109' : '#C9B8E6',
                  boxShadow: isActive ? '0 0 16px rgba(255,46,126,.5)' : 'none',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Dropdown xem nhanh bộ sưu tập của thành viên khác */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ font: "400 12px/1 'Be Vietnam Pro', sans-serif", color: '#9C8ABE' }}>
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
              border: '1px solid rgba(156, 138, 190, 0.4)',
              borderRadius: 6,
              color: '#FFFFFF',
              padding: '6px 10px',
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
      </div>

      {/* ═══ NỘI DUNG CHÍNH THEO TAB ═══ */}

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: BỘ SƯU TẬP DANH HIỆU (Màn A1)
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'collection' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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

          {/* Hero Bounty Poster: Mục tiêu hot nhất */}
          {heroBounty && (
            <BountyHeroPoster
              bounty={heroBounty}
              onChallenge={(b) => {
                if (b && b.id) {
                  navigate(`/bang-xep-hang?tab=search&playerA=${b.id}`)
                } else {
                  navigate('/chia-san')
                }
              }}
              onViewBadge={(b) => setSelectedBadge(b)}
            />
          )}

          {/* Hồ sơ Nhà sưu tập (Collector Profile Card) */}
          <div
            style={{
              clipPath: NOTCH_CLIP,
              background: 'linear-gradient(135deg, #1D0D35, #120624)',
              border: '1px solid #3B1B66',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
              padding: '24px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            {/* Header profile: Avatar + Cấp + Chữ ký + Tiến độ XP */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  width: 58,
                  height: 58,
                  clipPath: HEX_CLIP,
                  background: 'linear-gradient(135deg, #FF2E7E, #FFE24B)',
                  display: 'grid',
                  placeItems: 'center',
                  font: '700 22px/1 Oswald, sans-serif',
                  color: '#140109',
                  flexShrink: 0,
                }}
              >
                {activeMember.name ? activeMember.name.charAt(0).toUpperCase() : 'U'}
              </div>

              <div
                style={{
                  flex: 1,
                  minWidth: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      font: '700 22px/1 Oswald, sans-serif',
                      letterSpacing: '.04em',
                      color: '#FFFFFF',
                    }}
                  >
                    {activeMember.name}
                  </span>
                  <span
                    style={{
                      font: '700 10px/1 Oswald, sans-serif',
                      letterSpacing: '.16em',
                      padding: '4px 8px',
                      clipPath: NOTCH_S_CLIP,
                      background: 'rgba(255,226,75,.16)',
                      borderTop: '1px solid #FFE24B',
                      color: '#FFE24B',
                    }}
                  >
                    {t('badges.collectorProfile.level', { level: 7 })}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      font: "400 12.5px/1.3 'Be Vietnam Pro', sans-serif",
                      color: '#9C8ABE',
                    }}
                  >
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
                        borderRadius: 6,
                        color: '#FFE24B',
                        padding: '2px 8px',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontFamily: "'Be Vietnam Pro', sans-serif",
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>✎</span>
                    </button>
                  )}
                </div>
              </div>

                {/* Huy hiệu đã mở count */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 3,
                  }}
                >
                  <span
                    style={{
                      font: '700 28px/1 Oswald, sans-serif',
                      color: '#FFE24B',
                    }}
                  >
                    {memberBadges.unlocked?.length || 0} / {memberBadges.all?.length || 42}
                  </span>
                  <span
                    style={{
                      font: '600 9.5px/1 Oswald, sans-serif',
                      letterSpacing: '.14em',
                      color: '#7E6FA0',
                    }}
                  >
                    {t('badges.collectorProfile.unlockedLabel')}
                  </span>
                </div>
              </div>

              {/* 3 Thẻ chỉ số: XP tích luỹ · Điểm mùa · Điểm sưu tập */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 14,
                }}
              >
                {/* 1. XP Tích luỹ */}
                <div
                  style={{
                    padding: '14px 16px',
                    clipPath: NOTCH_S_CLIP,
                    background: 'rgba(255,255,255,.04)',
                    borderTop: '1px solid #FF7A18',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      font: '600 10px/1 Oswald, sans-serif',
                      letterSpacing: '.14em',
                      color: '#9C8ABE',
                    }}
                  >
                    {t('badges.collectorProfile.xpAccumulated')}
                  </span>
                  <span
                    style={{
                      font: '700 24px/1 Oswald, sans-serif',
                      color: '#FFC46B',
                    }}
                  >
                    1.420 XP
                  </span>
                  <span
                    style={{
                      font: "400 11px/1 'Be Vietnam Pro', sans-serif",
                      color: '#7E6FA0',
                    }}
                  >
                    {t('badges.collectorProfile.xpNote')}
                  </span>
                </div>

                {/* 2. Điểm mùa */}
                <div
                  style={{
                    padding: '14px 16px',
                    clipPath: NOTCH_S_CLIP,
                    background: 'rgba(255,255,255,.04)',
                    borderTop: '1px solid #0E9F8E',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      font: '600 10px/1 Oswald, sans-serif',
                      letterSpacing: '.14em',
                      color: '#9C8ABE',
                    }}
                  >
                    {t('badges.collectorProfile.seasonPoints')}
                  </span>
                  <span
                    style={{
                      font: '700 24px/1 Oswald, sans-serif',
                      color: '#5FEBD0',
                    }}
                  >
                    185 SP
                  </span>
                  <span
                    style={{
                      font: "400 11px/1 'Be Vietnam Pro', sans-serif",
                      color: '#7E6FA0',
                    }}
                  >
                    {t('badges.collectorProfile.seasonPointsNote', { rank: 2 })}
                  </span>
                </div>

                {/* 3. Điểm sưu tập */}
                <div
                  style={{
                    padding: '14px 16px',
                    clipPath: NOTCH_S_CLIP,
                    background: 'rgba(255,255,255,.04)',
                    borderTop: '1px solid #FFE24B',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      font: '600 10px/1 Oswald, sans-serif',
                      letterSpacing: '.14em',
                      color: '#9C8ABE',
                    }}
                  >
                    {t('badges.collectorProfile.collectionPoints')}
                  </span>
                  <span
                    style={{
                      font: '700 24px/1 Oswald, sans-serif',
                      color: '#FFE24B',
                    }}
                  >
                    {memberBadges.collectionScore || 480}
                  </span>
                  <span
                    style={{
                      font: "400 11px/1 'Be Vietnam Pro', sans-serif",
                      color: '#7E6FA0',
                    }}
                  >
                    {t('badges.collectorProfile.collectionPointsNote', { rank: 1 })}
                  </span>
                </div>
              </div>
            </div>

          {/* 3. Sáu bậc · Khung lục giác (Six Tiers Showcase) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span
              style={{
                font: '700 14px/1 Oswald, sans-serif',
                letterSpacing: '.14em',
                color: '#FFFFFF',
              }}
            >
              {t('badges.sixTiersTitle')}
            </span>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 12,
              }}
            >
              {Object.keys(ANIME_TIERS).map((tierKey) => {
                const tier = ANIME_TIERS[tierKey]
                return (
                  <div
                    key={tierKey}
                    style={{
                      padding: 1,
                      clipPath: NOTCH_CLIP,
                      background: tier.ring,
                    }}
                  >
                    <div
                      style={{
                        clipPath: NOTCH_CLIP,
                        background: tier.panel,
                        padding: '14px 10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <BadgeHex
                        tier={tierKey}
                        glyph={tierKey === 'legend' ? 'crystal' : tierKey === 'epic' ? 'flame' : 'shuriken'}
                        size={54}
                        spin={tier.spin}
                      />
                      <span
                        style={{
                          font: '700 11.5px/1 Oswald, sans-serif',
                          letterSpacing: '.12em',
                          color: '#FFFFFF',
                          textAlign: 'center',
                        }}
                      >
                        {tier.name}
                      </span>
                      <span
                        style={{
                          font: "400 10.5px/1 'IBM Plex Mono', monospace",
                          color: tier.ink || '#9C8ABE',
                        }}
                      >
                        {tier.pts}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 4. Kệ danh hiệu của tôi (My Shelf) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  font: '700 14px/1 Oswald, sans-serif',
                  letterSpacing: '.14em',
                  color: '#FFFFFF',
                }}
              >
                {t('badges.myShelfTitle')}
              </span>
              <span
                style={{
                  font: "400 11.5px/1 'IBM Plex Mono', monospace",
                  color: '#7E6FA0',
                }}
              >
                {t('badges.myShelfNote')}
              </span>
            </div>

            <BadgeShelf
              shelf={memberBadges.shelfBadges}
              onSlotClick={(idx, badge) => {
                if (badge) setSelectedBadge(badge)
              }}
            />
          </div>

          {/* 5. Lưới 4 nhóm danh hiệu (42 Danh hiệu) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {catalogGroups.map((group) => {
              const groupBadges = group.badges || []

              return (
                <div key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        width: 4,
                        height: 18,
                        background: 'linear-gradient(180deg, #FF2E7E, #6D14FF)',
                      }}
                    />
                    <span
                      style={{
                        font: '700 16px/1 Oswald, sans-serif',
                        letterSpacing: '.12em',
                        color: '#FFFFFF',
                      }}
                    >
                      {t(`badges.groups.${group.key}`)}
                    </span>
                    <span
                      style={{
                        font: "400 11.5px/1 'IBM Plex Mono', monospace",
                        color: '#7E6FA0',
                      }}
                    >
                      {t(`badges.groups.${group.key}Note`)}
                    </span>
                  </div>

                  {/* Lưới các thẻ danh hiệu */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: 14,
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
            if (b && b.id) {
              navigate(`/bang-xep-hang?tab=search&playerA=${b.id}`)
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
      {activeTab === 'feed' && (
        <AchievementFeed feed={clubFeed} />
      )}

      {/* ═══ MODAL A2: CHI TIẾT DANH HIỆU ═══ */}
      {selectedBadge && (
        <BadgeDetailModal
          badge={selectedBadge}
          streakTimeline={getStreakTimeline(currentMember.id, db, 10)}
          owners={getBadgeOwners(selectedBadge.id, db)}
          chasers={getBadgeChasers(selectedBadge.id, currentMember.id, db)}
          onClose={() => setSelectedBadge(null)}
        />
      )}

      {/* ═══ MODAL A4: MỞ KHÓA DANH HIỆU FANFARE ═══ */}
      {unlockingBadge && (
        <BadgeUnlockModal
          badge={unlockingBadge}
          onClose={() => setUnlockingBadge(null)}
          onEquipShelf={(b) => handleEquipShelf(b)}
          onViewCollection={() => {
            setUnlockingBadge(null)
            setActiveTab('collection')
          }}
          shelfIsFull={(memberBadges.shelfBadges?.length || 0) >= (badgesConfig.shelfSlots || 3)}
        />
      )}

      {/* ═══ MODAL SỬA CHÂM NGÔN CÁ NHÂN ═══ */}
      {isEditingSignature && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(10, 4, 20, 0.85)',
            backdropFilter: 'blur(8px)',
            padding: 16,
          }}
          onClick={() => setIsEditingSignature(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              background: 'linear-gradient(135deg, #1D0D35, #120624)',
              border: '1px solid rgba(255, 226, 75, 0.4)',
              boxShadow: '0 0 40px rgba(255, 226, 75, 0.2)',
              clipPath: NOTCH_S_CLIP,
              padding: '24px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                font: '700 20px/1 Oswald, sans-serif',
                letterSpacing: '.06em',
                color: '#FFE24B',
                textTransform: 'uppercase',
              }}
            >
              {t('badges.signatureModal.title')}
            </div>
            <div
              style={{
                font: "400 13px/1.4 'Be Vietnam Pro', sans-serif",
                color: '#9C8ABE',
              }}
            >
              {t('badges.signatureModal.sub')}
            </div>

            <input
              type="text"
              maxLength={80}
              value={signatureDraft}
              onChange={(e) => setSignatureDraft(e.target.value)}
              placeholder={t('badges.signatureModal.placeholder')}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(156, 138, 190, 0.4)',
                borderRadius: 6,
                padding: '12px 14px',
                color: '#FFFFFF',
                fontFamily: "'Be Vietnam Pro', sans-serif",
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
              autoFocus
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 12,
                marginTop: 8,
              }}
            >
              <button
                type="button"
                onClick={() => setIsEditingSignature(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(156, 138, 190, 0.3)',
                  color: '#9C8ABE',
                  padding: '8px 18px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: "'Be Vietnam Pro', sans-serif",
                  fontSize: 13,
                }}
              >
                {t('badges.signatureModal.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (a && a.setMemberSignature) {
                    a.setMemberSignature(currentMember.id, signatureDraft)
                  }
                  currentMember.signature = signatureDraft
                  setIsEditingSignature(false)
                }}
                style={{
                  background: 'linear-gradient(135deg, #FFE24B, #FF9E00)',
                  border: 'none',
                  color: '#140109',
                  padding: '8px 20px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontFamily: "'Be Vietnam Pro', sans-serif",
                  fontSize: 13,
                }}
              >
                {t('badges.signatureModal.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
