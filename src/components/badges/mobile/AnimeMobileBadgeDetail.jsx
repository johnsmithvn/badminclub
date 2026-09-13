import React, { useState, useMemo } from 'react'
import BadgeHex from '../BadgeHex.jsx'
import {
  ANIME_TIERS,
  NOTCH_CLIP,
  NOTCH_S_CLIP,
  HEX_CLIP,
  getBadgeOwners,
  getStreakTimeline,
} from '#lib/badges.js'
import { t } from '#i18n'

/**
 * AM2 · Chi tiết danh hiệu · Điều kiện · Chuỗi (Bản Anime Mobile).
 * Triển khai chuẩn xác theo thiết kế AM2 trong Danh hiệu và Treo thưởng.dc.html:
 * - Header bar: Nút Back `←` + Tên danh hiệu
 * - Hero Showcase Badge:
 *   - Badge lục giác 124px bồng bềnh `aFloat 6s` + hào quang `aPulse 2.8s` + viền xoay `aSpin 7s`
 *   - Tia sáng nền `repeating-conic-gradient` xoay chậm 34s
 *   - Tên to `Oswald` 26px kèm `text-shadow`
 *   - Badge bậc & điểm: ví dụ `HUYỀN THOẠI · 120 ĐIỂM`
 *   - Mô tả điều kiện
 *   - Thanh tiến độ cá nhân: `TIẾN ĐỘ CỦA BẠN: X / Y` kèm thanh bar gradient
 * - Mốc cấp độ (nếu là họ danh hiệu nhiều mốc I, II, III, IV)
 * - Khối ĐIỀU KIỆN: 4 dòng điều kiện với icon lục giác `✓` hoặc `·`
 * - Khối CHUỖI HIỆN TẠI: Dải 10 ô ngang hiển thị chữ W cho trận thắng và số mờ
 * - Khối AI ĐÃ CÓ: Hiển thị số người & danh sách người đã mở
 */
export default function AnimeMobileBadgeDetail({
  badge,
  currentMember,
  db,
  currentSeason,
  preloadedSeasonMatches,
  preloadedClubStats,
  onClose,
}) {
  // Nếu là họ danh hiệu Evolving Badge (có nhiều mốc)
  const tiers = useMemo(() => {
    return Array.isArray(badge?.tiers) && badge.tiers.length > 0 ? badge.tiers : (badge ? [badge] : [])
  }, [badge])
  const isFamily = tiers.length > 1 || !!badge?.isFamily

  // Mốc cấp độ đang chọn
  const initialIdx = useMemo(() => {
    if (!badge || !isFamily) return 0
    if (badge.nextTarget) {
      const idx = tiers.findIndex((tr) => tr.id === badge.nextTarget.id)
      if (idx >= 0) return idx
    }
    if (badge.highestUnlocked) {
      const idx = tiers.findIndex((tr) => tr.id === badge.highestUnlocked.id)
      if (idx >= 0) return idx
    }
    return 0
  }, [badge, isFamily, tiers])

  const [selectedTierIdx, setSelectedTierIdx] = useState(initialIdx)
  const activeTierBadge = useMemo(() => {
    return tiers[selectedTierIdx] || tiers[0] || badge || {}
  }, [tiers, selectedTierIdx, badge])

  // Trạng thái mở rộng khối "AI ĐÃ CÓ"
  const [showOwnersList, setShowOwnersList] = useState(false)

  const meta = activeTierBadge.tierMeta || ANIME_TIERS[activeTierBadge.tier] || ANIME_TIERS.rare
  const isHidden = activeTierBadge.tier === 'hidden' && !activeTierBadge.unlocked
  const badgeName = t(`badges.items.${activeTierBadge.id}.name`, { defaultValue: activeTierBadge.name || '???' })
  const badgeCond = t(`badges.items.${activeTierBadge.id}.cond`, { defaultValue: activeTierBadge.cond || '' })

  const isWinStreak = activeTierBadge.checkType === 'win_streak'
  const isHolding = isWinStreak ? Number(activeTierBadge.currentVal) > 0 : (activeTierBadge.pct || 0) > 0

  // 1. Danh sách người đã mở danh hiệu này
  const badgeOwners = useMemo(() => {
    if (db && activeTierBadge?.id) {
      return getBadgeOwners(activeTierBadge.id, db, currentSeason, preloadedSeasonMatches, preloadedClubStats)
    }
    return []
  }, [db, activeTierBadge?.id, currentSeason, preloadedSeasonMatches, preloadedClubStats])

  // 2. Dữ liệu chuỗi 10 trận gần nhất
  const streakTimeline = useMemo(() => {
    if (db && currentMember?.id) {
      return getStreakTimeline(currentMember.id, db, 10)
    }
    return []
  }, [db, currentMember?.id])

  // Chuẩn bị dải 10 ô chuỗi thắng
  const streakCells = useMemo(() => {
    // Nếu có dữ liệu timeline từ trận đấu thật
    if (streakTimeline.length > 0) {
      const cells = []
      for (let i = 0; i < 10; i++) {
        const item = streakTimeline[i]
        if (item) {
          cells.push({ isWin: item.isWin, label: item.isWin ? 'W' : 'L' })
        } else {
          cells.push({ isWin: false, label: String(i + 1), isFuture: true })
        }
      }
      return cells
    }
    // Fallback: nếu danh hiệu có tiến độ chuỗi hiện tại
    const curStreak = Number(activeTierBadge.currentVal) || 0
    const cells = []
    for (let i = 0; i < 10; i++) {
      if (i < curStreak) {
        cells.push({ isWin: true, label: 'W' })
      } else {
        cells.push({ isWin: false, label: String(i + 1), isFuture: true })
      }
    }
    return cells
  }, [streakTimeline, activeTierBadge.currentVal])

  // 3. Danh sách 4 điều kiện
  const conditions = useMemo(() => {
    return [
      {
        ok: !!activeTierBadge.unlocked,
        text: badgeCond || t('badges.detail.conditionsTitle'),
        val: activeTierBadge.unlocked
          ? t('badges.detail.statusAchieved')
          : (activeTierBadge.progressStr || `${activeTierBadge.pct || 0}%`),
      },
      {
        ok: true,
        text: t('badges.detail.condScoreLogged'),
        val: t('badges.detail.statusOk'),
      },
      {
        ok: !!activeTierBadge.unlocked || isHolding,
        text: t('badges.detail.condNoLoss'),
        val: activeTierBadge.unlocked
          ? t('badges.detail.statusAchieved')
          : isHolding
            ? t('badges.detail.statusHolding')
            : t('badges.detail.statusBroken'),
      },
      {
        ok: true,
        text: t('badges.detail.condSeason'),
        val: currentSeason?.code || 'S3',
      },
    ]
  }, [activeTierBadge, badgeCond, isHolding, currentSeason])

  if (!badge) return null

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
      {/* 1. Nền hồng neon Anime & Dot Matrix */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(80% 34% at 50% 0%, ${meta.aura || 'rgba(255,46,126,.24)'}, transparent 72%)`,
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
          padding: '14px 16px',
          borderBottom: '1px solid #2A1145',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            border: 'none',
            background: 'rgba(255,255,255,.06)',
            color: '#9C8ABE',
            cursor: 'pointer',
            padding: '6px 12px',
            clipPath: NOTCH_S_CLIP,
            font: "700 13px/1 'Oswald', sans-serif",
            letterSpacing: '.14em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ← {t('badges.detail.back')}
        </button>

        <span
          style={{
            font: "700 15px/1 'Oswald', sans-serif",
            letterSpacing: '.1em',
            color: '#FFFFFF',
            textTransform: 'uppercase',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {isHidden ? '???' : badgeName}
        </span>
      </div>

      {/* 3. Thân Màn Hình Cuộn (Scrollable Body) */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '16px 16px 36px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* ═══ MỐC CẤP ĐỘ NẾU LÀ HỌ DANH HIỆU (Milestone Road / Level Stepper) ═══ */}
        {isFamily && (
          <div
            style={{
              padding: '10px 12px',
              clipPath: NOTCH_S_CLIP,
              background: 'rgba(255,255,255,.03)',
              border: '1px solid #2A1145',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ font: "700 11px/1 'Oswald', sans-serif", letterSpacing: '.12em', color: '#FFE24B' }}>
                {t('badges.detail.milestoneRoadTitle')}
              </span>
              <span style={{ font: "400 10px/1 'IBM Plex Mono', monospace", color: '#9C8ABE' }}>
                {t('badges.detail.milestoneRoadHint', {
                  unlockedCount: tiers.filter((tr) => tr.unlocked).length,
                  totalCount: tiers.length,
                })}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tiers.length}, minmax(0, 1fr))`, gap: 6 }}>
              {tiers.map((tr, idx) => {
                const isSelected = idx === selectedTierIdx
                const isUnlocked = tr.unlocked
                const trMeta = ANIME_TIERS[tr.tier] || ANIME_TIERS.rare
                return (
                  <button
                    key={tr.id || idx}
                    type="button"
                    onClick={() => setSelectedTierIdx(idx)}
                    style={{
                      border: 'none',
                      clipPath: NOTCH_S_CLIP,
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(255,46,126,.3), rgba(109,20,255,.3))'
                        : isUnlocked
                          ? 'rgba(0,0,0,.45)'
                          : 'rgba(255,255,255,.02)',
                      padding: '8px 4px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 0 10px rgba(255,46,126,.4)' : 'none',
                    }}
                  >
                    <BadgeHex
                      tier={tr.tier}
                      glyph={tr.glyph}
                      size={28}
                      dim={!isUnlocked}
                      spin={tr.tier === 'legend' && isUnlocked}
                    />
                    <span
                      style={{
                        font: "700 9.5px/1 'Oswald', sans-serif",
                        letterSpacing: '.08em',
                        color: isSelected ? '#FFE24B' : isUnlocked ? trMeta.ink : '#6B5C8C',
                      }}
                    >
                      {t('badges.detail.milestoneLevel', { index: idx + 1 })}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══ KHỐI HERO SHOWCASE BADGE ═══ */}
        <div
          style={{
            flex: '0 0 auto',
            position: 'relative',
            overflow: 'hidden',
            padding: '22px 16px',
            clipPath: NOTCH_CLIP,
            background: meta.panel || 'linear-gradient(160deg, #2B0617, #110208)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            borderTop: `1px solid ${meta.bd || '#FF2E7E'}`,
          }}
        >
          {/* Vòng xoay tia sáng anime repeating conic */}
          <div
            style={{
              position: 'absolute',
              top: '-40%',
              left: '-30%',
              width: 520,
              height: 520,
              background: `repeating-conic-gradient(from 0deg, ${meta.aura || 'rgba(255,46,126,.16)'} 0deg 4deg, transparent 4deg 13deg)`,
              animation: 'aSpin 34s linear infinite',
              pointerEvents: 'none',
            }}
          />

          {/* Huy hiệu lục giác khổng lồ 124px */}
          <BadgeHex
            tier={activeTierBadge.tier}
            glyph={activeTierBadge.glyph}
            size={124}
            float
            pulse
            spin={activeTierBadge.tier === 'legend' || !!activeTierBadge.unlocked}
            dim={isHidden}
          />

          {/* Tên danh hiệu lớn */}
          <span
            style={{
              position: 'relative',
              font: "700 24px/1 'Oswald', sans-serif",
              letterSpacing: '.05em',
              textTransform: 'uppercase',
              color: '#FFFFFF',
              textAlign: 'center',
              textShadow: `0 0 20px ${meta.aura || 'rgba(255,46,126,.6)'}`,
            }}
          >
            {isHidden ? '???' : badgeName}
          </span>

          {/* Tag Bậc & Điểm */}
          <span
            style={{
              position: 'relative',
              font: "700 9px/1 'Oswald', sans-serif",
              letterSpacing: '.18em',
              padding: '6px 10px',
              clipPath: NOTCH_S_CLIP,
              background: meta.chipBg || 'rgba(255,46,126,.2)',
              borderTop: `1px solid ${meta.bd || '#FF2E7E'}`,
              color: meta.ink || '#FFC46B',
              textTransform: 'uppercase',
            }}
          >
            {meta.name} · {meta.pts} {t('badges.pointsLabel')}
          </span>

          {/* Mô tả điều kiện */}
          <span
            style={{
              position: 'relative',
              font: "400 12px/1.5 'Be Vietnam Pro', sans-serif",
              textAlign: 'center',
              color: '#C9B8E6',
              maxWidth: 320,
            }}
          >
            {badgeCond}
          </span>

          {/* Thanh tiến độ cá nhân */}
          <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ font: "600 9.5px/1 'Oswald', sans-serif", letterSpacing: '.14em', color: meta.ink }}>
                {t('badges.detail.yourProgress')}
              </span>
              <span style={{ font: "700 17px/1 'Oswald', sans-serif", color: '#FFE24B' }}>
                {activeTierBadge.unlocked
                  ? t('badges.openedStatus')
                  : (activeTierBadge.progressStr || `${activeTierBadge.pct || 0}%`)}
              </span>
            </div>
            <div style={{ height: 10, background: 'rgba(255,255,255,.1)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${activeTierBadge.unlocked ? 100 : (activeTierBadge.pct || 0)}%`,
                  background: meta.edge || 'linear-gradient(90deg, #FF2E7E, #FFE24B)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        </div>

        {/* ═══ KHỐI ĐIỀU KIỆN ═══ */}
        <div
          style={{
            flex: '0 0 auto',
            padding: '13px 14px',
            clipPath: NOTCH_CLIP,
            background: 'rgba(255,255,255,.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <span style={{ font: "700 12px/1 'Oswald', sans-serif", letterSpacing: '.12em', color: '#FFFFFF' }}>
            {t('badges.detail.conditionsTitle')}
          </span>

          {conditions.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  flex: '0 0 auto',
                  clipPath: HEX_CLIP,
                  display: 'grid',
                  placeItems: 'center',
                  font: "700 12px/1 'Oswald', sans-serif",
                  background: c.ok ? 'linear-gradient(135deg, #00776B, #2EE9FF)' : '#241640',
                  color: c.ok ? '#01130F' : '#9C8ABE',
                }}
              >
                {c.ok ? '✓' : '·'}
              </div>
              <span style={{ flex: 1, minWidth: 0, font: "400 11.5px/1.35 'Be Vietnam Pro', sans-serif", color: '#C9B8E6' }}>
                {c.text}
              </span>
              <span
                style={{
                  flex: '0 0 auto',
                  font: "600 11.5px/1 'IBM Plex Mono', monospace",
                  color: c.ok ? '#5FEBD0' : '#C9B8E6',
                }}
              >
                {c.val}
              </span>
            </div>
          ))}
        </div>

        {/* ═══ KHỐI CHUỖI HIỆN TẠI (10 Ô Ngang) ═══ */}
        <div
          style={{
            flex: '0 0 auto',
            padding: '13px 14px',
            clipPath: NOTCH_CLIP,
            background: 'rgba(255,255,255,.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <span style={{ font: "700 12px/1 'Oswald', sans-serif", letterSpacing: '.12em', color: '#FFFFFF' }}>
            {t('badges.detail.currentStreakTitle')}
          </span>

          <div style={{ display: 'flex', gap: 4 }}>
            {streakCells.map((s, idx) => (
              <div
                key={idx}
                style={{
                  flex: 1,
                  height: 42,
                  clipPath: NOTCH_S_CLIP,
                  display: 'grid',
                  placeItems: 'center',
                  font: "700 14px/1 'Oswald', sans-serif",
                  background: s.isWin
                    ? 'linear-gradient(165deg, #FF2E7E, #7A0A2E)'
                    : s.isFuture
                      ? 'rgba(255,255,255,.05)'
                      : 'rgba(126,111,160,.18)',
                  color: s.isWin ? '#FFFBEA' : '#6B5C8C',
                  borderTop: s.isWin ? '1px solid #FF7A18' : 'none',
                }}
              >
                {s.label}
              </div>
            ))}
          </div>
        </div>

        {/* ═══ KHỐI AI ĐÃ CÓ (Badge Owners) ═══ */}
        <div
          style={{
            flex: '0 0 auto',
            padding: '13px 14px',
            clipPath: NOTCH_CLIP,
            background: 'rgba(255,255,255,.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            onClick={() => setShowOwnersList((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
            }}
          >
            <span style={{ flex: 1, minWidth: 0, font: "700 12px/1 'Oswald', sans-serif", letterSpacing: '.12em', color: '#FFFFFF' }}>
              {t('badges.detail.ownersTitle')}
            </span>
            <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: '#9C8ABE' }}>
              {badgeOwners.length > 0
                ? `${badgeOwners.length} ${t('units.person')} · ${badgeOwners.slice(0, 2).map((o) => o.name).join(', ')}`
                : t('badges.detail.noOwners')}
            </span>
            <span
              style={{
                font: "400 11px/1 'IBM Plex Mono', monospace",
                color: '#7E6FA0',
                transform: showOwnersList ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.2s ease',
              }}
            >
              ›
            </span>
          </div>

          {/* Danh sách mở rộng người đã sở hữu */}
          {showOwnersList && badgeOwners.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,.06)' }}>
              {badgeOwners.map((owner, idx) => (
                <div
                  key={owner.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 8px',
                    background: 'rgba(255,255,255,.02)',
                    clipPath: NOTCH_S_CLIP,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      clipPath: HEX_CLIP,
                      background: '#241640',
                      display: 'grid',
                      placeItems: 'center',
                      font: "700 12px/1 'Oswald', sans-serif",
                      color: '#C9B8E6',
                    }}
                  >
                    {(owner.name || 'M').slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ font: "600 11.5px/1.2 'Be Vietnam Pro', sans-serif", color: '#FFFFFF' }}>
                      {owner.name}
                    </span>
                    {owner.note && (
                      <span style={{ font: "400 9.5px/1 'IBM Plex Mono', monospace", color: '#7E6FA0' }}>
                        {owner.note}
                      </span>
                    )}
                  </div>
                  {owner.unlockedAt && (
                    <span style={{ font: "400 10px/1 'IBM Plex Mono', monospace", color: '#9C8ABE' }}>
                      {owner.unlockedAt}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
