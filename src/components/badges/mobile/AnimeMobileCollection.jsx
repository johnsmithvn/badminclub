import React, { useState, useMemo } from 'react'
import BadgeHex from '../BadgeHex.jsx'
import {
  ANIME_TIERS,
  NOTCH_CLIP,
  NOTCH_S_CLIP,
  HEX_CLIP,
  getBadgeFamily,
  groupBadgesByFamily,
} from '#lib/badges.js'
import { t } from '#i18n'

/**
 * AM1 · Bộ sưu tập · Hồ sơ + Kệ + Lưới (Bản Anime Mobile).
 * Triển khai chuẩn xác theo thiết kế AM1 trong Danh hiệu và Treo thưởng.dc.html:
 * - Top Header: Danh hiệu, mùa giải, nút SẮP KỆ
 * - Sub-nav 3 tab: BỘ SƯU TẬP (Active) | TRUY NÃ | XẾP HẠNG
 * - Thẻ Hồ sơ nhà sưu tập: Avatar Hex conic anime, Cấp độ, Đã mở/Tổng, Thanh XP, 3 ô chỉ số XP/Mùa/Sưu tập
 * - Kệ của tôi: 3 ô danh hiệu đeo trên hồ sơ viền gradient vàng hồng notch
 * - Lưới danh hiệu 3 cột: Nhóm đang chọn / nhóm đầu tiên với huy hiệu lục giác neon & thanh tiến độ
 * - Danh sách các nhóm danh hiệu khác: Dạng thẻ ngang bấm chuyển nhóm hoặc mở rộng
 */
export default function AnimeMobileCollection({
  activeMember,
  currentMember,
  isViewingSelf = true,
  currentSeason,
  memberXpData,
  memberSeasonData,
  memberBadges,
  catalogGroups = [],
  activeTab = 'collection',
  onTabChange,
  onSelectBadge,
  onReorderShelf,
  onSelectMember,
  allMembers = [],
}) {
  // Nhóm đang được chọn để hiển thị lưới 3 cột (mặc định là nhóm đầu tiên)
  const [selectedGroupIdx, setSelectedGroupIdx] = useState(0)

  // Danh sách các nhóm
  const groups = useMemo(() => {
    if (!catalogGroups || catalogGroups.length === 0) return []
    return catalogGroups
  }, [catalogGroups])

  const activeGroup = groups[selectedGroupIdx] || groups[0] || null

  // Huy hiệu gắn trên kệ của activeMember (3 ô)
  const shelfBadgeIds = useMemo(() => {
    return (activeMember?.badge_shelf || activeMember?.badgeShelf || []).slice(0, 3)
  }, [activeMember])

  const shelfBadges = useMemo(() => {
    const all = memberBadges?.all || []
    return shelfBadgeIds.map((id) => {
      const found = all.find((b) => b.id === id)
      if (found) return found
      // Nếu là họ danh hiệu
      const fInfo = getBadgeFamily(id)
      if (fInfo) {
        const fBadges = all.filter((item) => (fInfo.badgeIds || []).includes(item.id))
        const grouped = groupBadgesByFamily(fBadges)
        if (grouped[0]) return grouped[0]
      }
      return { id, name: id, tier: 'rare', glyph: 'crystal' }
    })
  }, [shelfBadgeIds, memberBadges?.all])

  // Cấp độ và tiến độ XP
  const level = memberXpData?.level || 1
  const nextLevel = level + 1
  const currentXp = memberXpData?.totalXp || 0
  const nextLevelXp = memberXpData?.nextLevelXp || 1500
  const levelPct = Math.min(100, Math.max(0, memberXpData?.levelProgressPct || 0))

  // Đã mở / Tổng số
  const unlockedCount =
    memberBadges?.officialUnlocked?.length ??
    (memberBadges?.unlocked || []).filter((b) => b.tier !== 'fun').length
  const totalCount = (memberBadges?.all || []).filter((b) => b.tier !== 'fun').length || 42

  // Điểm sưu tập
  const collectionScore = useMemo(() => {
    const list = memberBadges?.unlocked || []
    const tierPoints = { legend: 120, epic: 60, elite: 30, rare: 15, fun: 0, hidden: 0 }
    return list.reduce((sum, b) => sum + (tierPoints[b.tier] || 0), 0)
  }, [memberBadges?.unlocked])

  // Chữ cái đại diện avatar
  const memberInitial = (activeMember?.name || 'S').trim().slice(0, 1).toUpperCase()

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 480,
        margin: '0 auto',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: '#07030F',
        border: '1px solid #2A1145',
        borderRadius: 22,
        minHeight: '844px',
        color: '#FFFFFF',
      }}
    >
      {/* 1. Lớp Glow tím & Lưới Dot Matrix anime */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(80% 34% at 50% 0%, rgba(109,20,255,.28), transparent 72%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px)',
          backgroundSize: '9px 9px',
          pointerEvents: 'none',
        }}
      />

      {/* 2. Top Header Bar */}
      <div
        style={{
          position: 'relative',
          flex: '0 0 auto',
          padding: '14px 16px 12px',
          borderBottom: '1px solid #2A1145',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span
              style={{
                font: "700 22px/1 'Oswald', sans-serif",
                letterSpacing: '.04em',
                textTransform: 'uppercase',
                color: '#FFFFFF',
              }}
            >
              {t('badges.title')}
            </span>
            <span
              style={{
                font: "400 10.5px/1.3 'IBM Plex Mono', monospace",
                color: '#9C8ABE',
                textTransform: 'uppercase',
              }}
            >
              {currentSeason?.name || t('badges.seasonHeader')}
            </span>
          </div>

          {/* Nút SẮP KỆ */}
          <button
            type="button"
            onClick={onReorderShelf}
            style={{
              font: "700 9.5px/1 'Oswald', sans-serif",
              letterSpacing: '.14em',
              padding: '8px 11px',
              clipPath: 'polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px)',
              background: 'rgba(139,43,255,.2)',
              border: 'none',
              borderTop: '1px solid #8B2BFF',
              color: '#D9A8FF',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {t('badges.reorderShelf')}
          </button>
        </div>

        {/* Bộ chọn thành viên xem (nếu muốn xem hồ sơ người khác) */}
        {allMembers && allMembers.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '2px 0' }}>
            <span style={{ font: "400 11px/1 'Be Vietnam Pro', sans-serif", color: '#9C8ABE' }}>
              {t('badges.selectMember')}
            </span>
            <select
              value={activeMember?.id || ''}
              onChange={(e) => onSelectMember && onSelectMember(e.target.value)}
              style={{
                background: '#160B26',
                border: '1px solid #3B1B66',
                borderRadius: 6,
                color: '#FFFFFF',
                padding: '4px 8px',
                fontSize: 11,
                fontFamily: "'Be Vietnam Pro', sans-serif",
                outline: 'none',
                cursor: 'pointer',
                maxWidth: 200,
              }}
            >
              {allMembers.map((m) => (
                <option key={m.id} value={m.id} style={{ background: '#1D0D35', color: '#FFFFFF' }}>
                  {m.name} {m.id === currentMember?.id ? `(${t('badges.collectorProfile.rankMe')})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Sub-tabs Anime: BỘ SƯU TẬP | TRUY NÃ | XẾP HẠNG */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { id: 'collection', label: t('badges.tabCollection') },
            { id: 'bounty', label: t('badges.tabBounty') },
            { id: 'leaderboard', label: t('badges.tabLeaderboard') },
          ].map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange && onTabChange(tab.id)}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  font: "600 10.5px/1 'Oswald', sans-serif",
                  letterSpacing: '.1em',
                  padding: '10px 4px',
                  clipPath: 'polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  background: isActive
                    ? 'linear-gradient(135deg, #FF2E7E, #FFB03A)'
                    : 'rgba(255,255,255,.05)',
                  color: isActive ? '#140109' : '#9C8ABE',
                  boxShadow: isActive ? '0 0 12px rgba(255,46,126,.35)' : 'none',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Phần Nội Dung Cuộn (Scrollable Body) */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '13px 16px 30px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Banner báo đang xem người khác */}
        {!isViewingSelf && (
          <div
            style={{
              padding: '8px 12px',
              clipPath: NOTCH_S_CLIP,
              background: 'linear-gradient(135deg, rgba(255,46,126,0.2), rgba(109,20,255,0.25))',
              border: '1px solid rgba(255,46,126,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <span style={{ font: "600 11.5px/1 'Be Vietnam Pro', sans-serif", color: '#FFFFFF' }}>
              👁 {activeMember?.name}
            </span>
            <button
              type="button"
              onClick={() => onSelectMember && onSelectMember(currentMember?.id)}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: 4,
                color: '#FFE24B',
                padding: '4px 8px',
                fontSize: 10.5,
                cursor: 'pointer',
              }}
            >
              {t('badges.backToMyCollection')}
            </button>
          </div>
        )}

        {/* ═══ KHỐI 1: HỒ SƠ THÀNH VIÊN (Collector Profile Card) ═══ */}
        <div
          style={{
            flex: '0 0 auto',
            padding: 1,
            clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
            background: 'linear-gradient(120deg, #6D14FF, #2EE9FF 80%)',
          }}
        >
          <div
            style={{
              position: 'relative',
              overflow: 'hidden',
              clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
              background: 'linear-gradient(150deg, #1A0B35, #0B0518)',
              padding: '13px 15px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {/* Tia sáng conic xoay ngược chiều ngầm */}
            <div
              style={{
                position: 'absolute',
                top: '-180%',
                left: '-20%',
                width: 420,
                height: 420,
                background: 'repeating-conic-gradient(from 0deg, rgba(109,20,255,.2) 0deg 5deg, transparent 5deg 15deg)',
                animation: 'aSpinBack 30s linear infinite',
                pointerEvents: 'none',
              }}
            />

            {/* Dòng 1: Avatar Hex + Tên + Cấp + Kệ ô + Đã mở */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Avatar Hex Anime */}
              <div style={{ position: 'relative', width: 48, height: 48, flex: '0 0 auto' }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    clipPath: HEX_CLIP,
                    background: 'conic-gradient(from 200deg, #0B63FF, #2EE9FF, #D6FEFF, #FFFFFF, #2EE9FF, #0B63FF)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 2,
                    clipPath: HEX_CLIP,
                    background: 'radial-gradient(120% 120% at 50% 8%, #032C5E, #01101F 72%)',
                    display: 'grid',
                    placeItems: 'center',
                    font: "700 17px/1 'Oswald', sans-serif",
                    color: '#EEFDFF',
                    overflow: 'hidden',
                  }}
                >
                  {activeMember?.avatar ? (
                    <img
                      src={activeMember.avatar}
                      alt={activeMember.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    memberInitial
                  )}
                </div>
              </div>

              {/* Tên và thông tin kệ */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      font: "700 17px/1 'Oswald', sans-serif",
                      letterSpacing: '.04em',
                      textTransform: 'uppercase',
                      color: '#FFFFFF',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {activeMember?.name || ''} {isViewingSelf ? `· ${t('badges.collectorProfile.rankMe').toLowerCase()}` : ''}
                  </span>
                  <span
                    style={{
                      font: "700 8.5px/1 'Oswald', sans-serif",
                      letterSpacing: '.14em',
                      padding: '4px 7px',
                      clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)',
                      background: 'linear-gradient(135deg, #0B63FF, #2EE9FF)',
                      color: '#01101F',
                    }}
                  >
                    {t('badges.collectorProfile.level', { level })}
                  </span>
                </div>
                <span style={{ font: "400 10px/1 'IBM Plex Mono', monospace", color: '#7E6FA0' }}>
                  {shelfBadgeIds.length} / 3
                </span>
              </div>

              {/* Đã mở / Tổng số */}
              <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
                <span style={{ font: "700 19px/1 'Oswald', sans-serif", color: '#7FE7FF' }}>
                  {unlockedCount} / {totalCount}
                </span>
                <span style={{ font: "600 8px/1 'Oswald', sans-serif", letterSpacing: '.14em', color: '#7E6FA0' }}>
                  {t('badges.openedStatus').toUpperCase()}
                </span>
              </div>
            </div>

            {/* Dòng 2: Thanh tiến độ XP lên cấp tiếp theo */}
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ font: "600 9px/1 'Oswald', sans-serif", letterSpacing: '.14em', color: '#7FE7FF' }}>
                  {t('badges.collectorProfile.nextLevelTitle', { nextLevel })}
                </span>
                <div style={{ flex: 1 }} />
                <span style={{ font: "600 10.5px/1 'IBM Plex Mono', monospace", color: '#C9B8E6' }}>
                  {currentXp.toLocaleString('vi-VN')} / {nextLevelXp.toLocaleString('vi-VN')} XP
                </span>
              </div>
              <div style={{ height: 8, background: 'rgba(255,255,255,.09)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${levelPct}%`,
                    background: 'linear-gradient(90deg, #0B63FF, #2EE9FF)',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>

            {/* Dòng 3: 3 Ô chỉ số ngang (XP | ĐIỂM MÙA | SƯU TẬP) */}
            <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 7 }}>
              <div
                style={{
                  padding: '8px 9px',
                  background: 'rgba(255,122,24,.1)',
                  borderTop: '1px solid #FF7A18',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                <span style={{ font: "600 8px/1 'Oswald', sans-serif", letterSpacing: '.14em', color: '#FFC46B' }}>XP</span>
                <span style={{ font: "700 16px/1 'Oswald', sans-serif", color: '#FFFFFF' }}>
                  {currentXp.toLocaleString('vi-VN')}
                </span>
              </div>
              <div
                style={{
                  padding: '8px 9px',
                  background: 'rgba(46,233,192,.1)',
                  borderTop: '1px solid #0E9F8E',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                <span style={{ font: "600 8px/1 'Oswald', sans-serif", letterSpacing: '.14em', color: '#5FEBD0' }}>
                  {t('badges.collectorProfile.seasonPoints')}
                </span>
                <span style={{ font: "700 16px/1 'Oswald', sans-serif", color: '#FFFFFF' }}>
                  {memberSeasonData?.seasonPoints || 0}
                </span>
              </div>
              <div
                style={{
                  padding: '8px 9px',
                  background: 'rgba(255,46,126,.1)',
                  borderTop: '1px solid #FF2E7E',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                <span style={{ font: "600 8px/1 'Oswald', sans-serif", letterSpacing: '.14em', color: '#FFC46B' }}>
                  {t('badges.collectorProfile.collectionPoints')}
                </span>
                <span style={{ font: "700 16px/1 'Oswald', sans-serif", color: '#FFFFFF' }}>
                  {collectionScore}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ KHỐI 2: KỆ CỦA TÔI (My Shelf - 3 ô) ═══ */}
        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 3, height: 15, background: 'linear-gradient(180deg, #FF2E7E, #6D14FF)' }} />
            <span style={{ font: "700 12.5px/1 'Oswald', sans-serif", letterSpacing: '.1em', color: '#FFFFFF' }}>
              {t('badges.myShelfTitle')}
            </span>
            <span style={{ font: "400 9.5px/1 'IBM Plex Mono', monospace", color: '#7E6FA0' }}>
              {shelfBadgeIds.length} / 3
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {[0, 1, 2].map((slotIdx) => {
              const b = shelfBadges[slotIdx]
              const hasBadge = !!b && !!b.id
              const bName = hasBadge
                ? t(`badges.items.${b.id}.name`, { defaultValue: b.name || '' })
                : t('badges.shelfEmptySlot', { index: slotIdx + 1 })

              return (
                <div
                  key={slotIdx}
                  onClick={() => {
                    if (hasBadge && onSelectBadge) {
                      onSelectBadge(b)
                    } else if (onReorderShelf) {
                      onReorderShelf()
                    }
                  }}
                  style={{
                    padding: 1,
                    clipPath: NOTCH_S_CLIP,
                    background: hasBadge
                      ? 'linear-gradient(135deg, #FF2E7E, #FFE24B 70%)'
                      : 'rgba(255,255,255,.08)',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      clipPath: NOTCH_S_CLIP,
                      background: '#160B26',
                      padding: '10px 6px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 7,
                      minHeight: 110,
                      justifyContent: 'center',
                    }}
                  >
                    {hasBadge ? (
                      <BadgeHex
                        tier={b.tier}
                        glyph={b.glyph}
                        size={54}
                        spin={b.tier === 'legend'}
                        pulse
                      />
                    ) : (
                      <div
                        style={{
                          width: 50,
                          height: 50,
                          clipPath: HEX_CLIP,
                          background: 'rgba(255,255,255,.04)',
                          border: '1px dashed rgba(255,255,255,.15)',
                          display: 'grid',
                          placeItems: 'center',
                          font: "700 18px/1 'Oswald', sans-serif",
                          color: '#4E3F6B',
                        }}
                      >
                        +
                      </div>
                    )}
                    <span
                      style={{
                        font: "700 10px/1.2 'Be Vietnam Pro', sans-serif",
                        textAlign: 'center',
                        color: hasBadge ? '#FFFFFF' : '#6B5C8C',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {bName}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ═══ KHỐI 3: NHÓM DANH HIỆU ĐANG CHỌN (Lưới 3 Cột) ═══ */}
        {activeGroup && (
          <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 3, height: 15, background: 'linear-gradient(180deg, #6D14FF, #2EE9FF)' }} />
              <span style={{ font: "700 12.5px/1 'Oswald', sans-serif", letterSpacing: '.1em', color: '#FFFFFF' }}>
                {t(`badges.groups.${activeGroup.id}.title`, { defaultValue: activeGroup.title || activeGroup.name || '' }).toUpperCase()}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  font: "600 10px/1 'Oswald', sans-serif",
                  letterSpacing: '.14em',
                  padding: '4px 8px',
                  clipPath: NOTCH_S_CLIP,
                  background: 'rgba(139,43,255,.18)',
                  color: '#D9A8FF',
                  borderTop: '1px solid #8B2BFF',
                }}
              >
                {activeGroup.badges?.filter((b) => b.unlocked || b.highestUnlocked).length || 0} / {activeGroup.badges?.length || 0}
              </span>
            </div>

            {/* Lưới 3 cột danh hiệu */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              {(activeGroup.badges || []).map((b) => {
                const isUnlocked = b.unlocked || (b.isFamily && !!b.highestUnlocked)
                const currentBadge = b.isFamily ? (b.highestUnlocked || b.nextTarget || b.tiers?.[0] || b) : b
                const tierKey = currentBadge.tier || 'rare'
                const tMeta = ANIME_TIERS[tierKey] || ANIME_TIERS.rare
                const bName = t(`badges.items.${currentBadge.id}.name`, { defaultValue: currentBadge.name || '' })

                return (
                  <div
                    key={b.id}
                    onClick={() => onSelectBadge && onSelectBadge(b)}
                    style={{
                      position: 'relative',
                      padding: 1,
                      clipPath: NOTCH_CLIP,
                      background: isUnlocked ? tMeta.edge : 'rgba(255,255,255,.1)',
                      opacity: isUnlocked ? 1 : 0.72,
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        position: 'relative',
                        clipPath: NOTCH_CLIP,
                        background: isUnlocked ? tMeta.panel : '#120823',
                        padding: '12px 6px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 7,
                        height: '100%',
                      }}
                    >
                      <BadgeHex
                        tier={tierKey}
                        glyph={currentBadge.glyph}
                        size={64}
                        dim={!isUnlocked}
                        spin={tierKey === 'legend' && isUnlocked}
                      />
                      <span
                        style={{
                          font: "700 11px/1.25 'Be Vietnam Pro', sans-serif",
                          textAlign: 'center',
                          color: isUnlocked ? '#FFFFFF' : '#9C8ABE',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          minHeight: 28,
                        }}
                      >
                        {bName}
                      </span>

                      {/* Thanh tiến độ nếu chưa mở và có tiến độ */}
                      {!isUnlocked && currentBadge.pct > 0 && (
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
                          <span style={{ font: "600 9.5px/1 'IBM Plex Mono', monospace", color: tMeta.ink }}>
                            {currentBadge.progressStr || `${currentBadge.pct}%`}
                          </span>
                          <div
                            style={{
                              width: '100%',
                              height: 4,
                              clipPath: NOTCH_S_CLIP,
                              background: 'rgba(255,255,255,.08)',
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                width: `${currentBadge.pct || 0}%`,
                                background: tMeta.edge,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══ KHỐI 4: CÁC NHÓM DANH HIỆU KHÁC (Accordion / Compact List) ═══ */}
        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          {groups.map((g, idx) => {
            if (idx === selectedGroupIdx) return null
            const openedInGroup = (g.badges || []).filter((b) => b.unlocked || b.highestUnlocked).length
            const totalInGroup = g.badges?.length || 0

            return (
              <div
                key={g.id || idx}
                onClick={() => setSelectedGroupIdx(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '10px 12px',
                  clipPath: NOTCH_S_CLIP,
                  background: 'rgba(255,255,255,.04)',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    font: "700 12px/1.2 'Be Vietnam Pro', sans-serif",
                    color: '#FFFFFF',
                  }}
                >
                  {t(`badges.groups.${g.id}.title`, { defaultValue: g.title || g.name || '' }).toUpperCase()}
                </span>
                <span
                  style={{
                    font: "600 9.5px/1 'Oswald', sans-serif",
                    letterSpacing: '.12em',
                    padding: '4px 7px',
                    clipPath: NOTCH_S_CLIP,
                    background: 'rgba(255,255,255,.08)',
                    color: '#D9A8FF',
                  }}
                >
                  {openedInGroup} / {totalInGroup}
                </span>
                <span style={{ font: "400 12px/1 'IBM Plex Mono', monospace", color: '#7E6FA0' }}>
                  ›
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
