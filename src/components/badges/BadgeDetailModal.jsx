import { useState, useMemo } from 'react'
import BadgeHex from './BadgeHex.jsx'
import { NOTCH_CLIP, NOTCH_S_CLIP, HEX_CLIP, ANIME_TIERS, getBadgeOwners, getBadgeChasers } from '#lib/badges.js'
import { t } from '#i18n'

/**
 * Màn A2 · Chi tiết một danh hiệu · điều kiện · chuỗi hiện tại · ai đã có · ai đang đuổi.
 * Hỗ trợ Thanh hành trình cấp độ (Level Stepper / Tier Road) cho các họ danh hiệu có nhiều mốc.
 * Thiết kế phong cách Anime với conic rays, floating hex badge, dot grid, notch clips.
 */
export default function BadgeDetailModal({
  badge,
  streakTimeline = [],
  owners = [],
  chasers = [],
  db = null,
  currentSeason = null,
  preloadedSeasonMatches = null,
  preloadedClubStats = null,
  currentMember = null,
  onClose,
  onShowUnlock,
}) {
  // Chuỗi các mốc cấp độ (nếu là họ danh hiệu Evolving Badge)
  const tiers = useMemo(() => {
    return Array.isArray(badge?.tiers) && badge.tiers.length > 0 ? badge.tiers : (badge ? [badge] : [])
  }, [badge])
  const isFamily = tiers.length > 1 || !!badge?.isFamily

  // Mặc định chọn mốc cao nhất đã mở, hoặc mốc đang chinh phục tiếp theo, hoặc mốc 0
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

  const meta = activeTierBadge.tierMeta || ANIME_TIERS[activeTierBadge.tier] || ANIME_TIERS.rare
  const isHidden = activeTierBadge.tier === 'hidden' && !activeTierBadge.unlocked
  const badgeName = t(`badges.items.${activeTierBadge.id}.name`, { defaultValue: activeTierBadge.name || '???' })
  const badgeCond = t(`badges.items.${activeTierBadge.id}.cond`, { defaultValue: activeTierBadge.cond || '' })

  const isWinStreak = activeTierBadge.checkType === 'win_streak'
  const isHolding = isWinStreak ? Number(activeTierBadge.currentVal) > 0 : activeTierBadge.pct > 0

  // Danh sách người đã có và người đang đuổi theo mốc đang chọn
  const currentOwners = useMemo(() => {
    if (db && activeTierBadge && activeTierBadge.id) {
      return getBadgeOwners(activeTierBadge.id, db, currentSeason, preloadedSeasonMatches, preloadedClubStats)
    }
    return owners
  }, [db, activeTierBadge, currentSeason, preloadedSeasonMatches, preloadedClubStats, owners])

  const currentChasers = useMemo(() => {
    if (db && activeTierBadge && activeTierBadge.id) {
      return getBadgeChasers(activeTierBadge.id, currentMember?.id, db, currentSeason, preloadedSeasonMatches, preloadedClubStats)
    }
    return chasers
  }, [db, activeTierBadge, currentMember, currentSeason, preloadedSeasonMatches, preloadedClubStats, chasers])

  if (!badge) return null

  const conditions = [
    {
      ok: activeTierBadge.unlocked,
      text: badgeCond,
      val: activeTierBadge.unlocked ? t('badges.detail.statusAchieved') : (activeTierBadge.progressStr || `${activeTierBadge.pct}%`),
    },
    {
      ok: true,
      text: t('badges.detail.condScoreLogged'),
      val: t('badges.detail.statusOk'),
    },
    {
      ok: activeTierBadge.unlocked || isHolding,
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
      val: t('badges.seasonLabel'),
    },
  ]

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(5, 2, 12, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 14px',
        overflowY: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose && onClose()
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 1080,
          background: '#07030F',
          border: '1px solid #2A1145',
          borderRadius: 14,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(109, 20, 255, 0.25)',
          maxHeight: '94vh',
          overflowY: 'auto',
        }}
      >
        {/* Glow nền mờ 2 quầng radial gradient anime */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(60% 50% at 28% 8%, rgba(255,46,126,.2), transparent 70%), radial-gradient(56% 46% at 92% 90%, rgba(109,20,255,.22), transparent 72%)',
            pointerEvents: 'none',
          }}
        />
        {/* Lớp dot grid anime 9px x 9px */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px)',
            backgroundSize: '9px 9px',
            pointerEvents: 'none',
          }}
        />

        {/* 1. Header & Breadcrumb */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #2A1145',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            position: 'relative',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              font: "600 12px/1 'Oswald', sans-serif",
              letterSpacing: '.14em',
              color: '#9C8ABE',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {t('badges.detail.back')}
          </button>
          <span style={{ font: "400 12px/1 'IBM Plex Mono', monospace", color: '#4E3F6B' }}>/</span>
          <span
            style={{
              font: "600 12px/1 'Oswald', sans-serif",
              letterSpacing: '.14em',
              color: '#FFFFFF',
              textTransform: 'uppercase',
            }}
          >
            {isHidden ? '???' : (isFamily ? t(`badges.families.${badge.familyKey}.name`, { defaultValue: badgeName }) : badgeName)}
          </span>
          <div style={{ flex: '1 1 0%' }} />
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
              font: "700 12px/1 'Oswald', sans-serif",
            }}
          >
            {t('badges.closeBtn')}
          </button>
        </div>

        {/* 1.5. THANH HÀNH TRÌNH CẤP ĐỘ (LEVEL STEPPER / MILESTONE ROAD) */}
        {isFamily && (
          <div
            style={{
              margin: '16px 20px 0',
              padding: '14px 16px',
              clipPath: NOTCH_CLIP,
              background: 'rgba(255,255,255,.03)',
              border: '1px solid #2A1145',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ font: "700 13px/1 'Oswald', sans-serif", letterSpacing: '.14em', color: '#FFE24B' }}>
                  {t('badges.detail.milestoneRoadTitle')}
                </span>
                <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: '#9C8ABE' }}>
                  {t('badges.detail.milestoneRoadHint', {
                    unlockedCount: tiers.filter((tr) => tr.unlocked).length,
                    totalCount: tiers.length,
                  })}
                </span>
              </div>
              <span style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: '#D9A8FF' }}>
                {t(`badges.families.${badge.familyKey}.name`)}
              </span>
            </div>

            {/* Stepper Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${tiers.length}, minmax(130px, 1fr))`,
                gap: 10,
                overflowX: 'auto',
                paddingBottom: 4,
              }}
            >
              {tiers.map((tr, idx) => {
                const trMeta = tr.tierMeta || ANIME_TIERS[tr.tier] || ANIME_TIERS.rare
                const isSelected = idx === selectedTierIdx
                const isUnlocked = tr.unlocked

                return (
                  <button
                    key={tr.id || idx}
                    type="button"
                    onClick={() => setSelectedTierIdx(idx)}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      padding: '10px 8px',
                      borderRadius: 8,
                      clipPath: NOTCH_S_CLIP,
                      border: isSelected
                        ? '1px solid #FF2E7E'
                        : isUnlocked
                          ? `1px solid ${trMeta.bd || '#00786F'}`
                          : '1px dashed rgba(255,255,255,.15)',
                      background: isSelected
                        ? 'linear-gradient(180deg, rgba(255,46,126,.24), rgba(109,20,255,.24))'
                        : isUnlocked
                          ? 'rgba(0,0,0,.45)'
                          : 'rgba(255,255,255,.02)',
                      boxShadow: isSelected ? '0 0 16px rgba(255,46,126,.45)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'center',
                    }}
                  >
                    <BadgeHex
                      tier={tr.tier}
                      glyph={tr.glyph}
                      size={32}
                      dim={!isUnlocked}
                      spin={tr.tier === 'legend' && isUnlocked}
                    />
                    <span style={{ font: "700 10.5px/1 'Oswald', sans-serif", letterSpacing: '.12em', color: isSelected ? '#FFE24B' : trMeta.ink }}>
                      {t('badges.detail.milestoneLevel', { index: idx + 1 })}
                    </span>
                    <span
                      style={{
                        font: "600 11.5px/1.2 'Be Vietnam Pro', sans-serif",
                        color: isUnlocked ? '#FFFFFF' : '#8494AA',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        width: '100%',
                      }}
                    >
                      {t(`badges.items.${tr.id}.name`, { defaultValue: tr.name || '' })}
                    </span>
                    <span
                      style={{
                        font: "600 9.5px/1 'IBM Plex Mono', monospace",
                        color: isUnlocked ? '#5FEBD0' : tr.pct > 0 ? '#FFE24B' : '#6B5C8C',
                        padding: '2px 6px',
                        borderRadius: 999,
                        background: isUnlocked
                          ? 'rgba(95,235,208,.12)'
                          : tr.pct > 0
                            ? 'rgba(255,226,75,.12)'
                            : 'rgba(255,255,255,.05)',
                      }}
                    >
                      {isUnlocked
                        ? t('badges.openedStatus')
                        : tr.pct > 0
                          ? `${tr.pct}%`
                          : t('badges.lockedStatus')}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 2. Grid Nội Dung Chính: 2 Cột chuẩn Figma/Anime */}
        <div
          style={{
            padding: '20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 20,
            position: 'relative',
            alignContent: 'start',
          }}
        >
          {/* CỘT TRÁI: HUY HIỆU KHỔNG LỒ & TIẾN ĐỘ */}
          <div
            style={{
              position: 'relative',
              padding: 1,
              clipPath: NOTCH_CLIP,
              background: meta.edge || 'linear-gradient(135deg, #FF2E7E, #FFE24B 70%)',
            }}
          >
            <div
              style={{
                position: 'relative',
                overflow: 'hidden',
                clipPath: NOTCH_CLIP,
                background: meta.panel || 'linear-gradient(160deg,#2B0617,#110208)',
                padding: '28px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                height: '100%',
              }}
            >
              {/* Conic ray spinning backdrop */}
              <div
                style={{
                  position: 'absolute',
                  top: '-28%',
                  left: '-22%',
                  width: 620,
                  height: 620,
                  background: `repeating-conic-gradient(from 0deg, ${meta.aura || 'rgba(255,46,126,.18)'} 0deg 4deg, transparent 4deg 13deg)`,
                  animation: 'aSpin 34s linear infinite',
                  pointerEvents: 'none',
                }}
              />

              {/* Huy hiệu lục giác lớn 180px bồng bềnh */}
              <BadgeHex
                tier={activeTierBadge.tier}
                glyph={activeTierBadge.glyph}
                size={180}
                float
                pulse
                spin={activeTierBadge.tier === 'legend'}
                dim={isHidden}
              />

              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    font: "700 28px/1 'Oswald', sans-serif",
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                    color: '#FFFFFF',
                    textAlign: 'center',
                    textShadow: `0 0 22px ${meta.aura || 'rgba(255,46,126,.6)'}`,
                  }}
                >
                  {isHidden ? '???' : badgeName}
                </span>

                <span
                  style={{
                    font: "700 10.5px/1 'Oswald', sans-serif",
                    letterSpacing: '.2em',
                    padding: '6px 12px',
                    clipPath: NOTCH_S_CLIP,
                    background: meta.chipBg,
                    borderTop: `1px solid ${meta.bd || '#FF2E7E'}`,
                    color: meta.ink,
                  }}
                >
                  {meta.name} · {meta.pts} {t('badges.pointsLabel')}
                </span>

                {/* Phần thưởng mốc */}
                {activeTierBadge.reward && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <span
                      style={{
                        font: "700 11px/1 'Oswald', sans-serif",
                        letterSpacing: '.06em',
                        color: '#FFC46B',
                        background: 'rgba(255,122,24,.15)',
                        borderTop: '1px solid #FF7A18',
                        padding: '4px 8px',
                        clipPath: NOTCH_S_CLIP,
                      }}
                    >
                      +{activeTierBadge.reward.xp || 0} XP
                    </span>
                    {Number(activeTierBadge.reward.seasonPts) > 0 && (
                      <span
                        style={{
                          font: "700 11px/1 'Oswald', sans-serif",
                          letterSpacing: '.06em',
                          color: '#5FEBD0',
                          background: 'rgba(46,233,192,.15)',
                          borderTop: '1px solid #0E9F8E',
                          padding: '4px 8px',
                          clipPath: NOTCH_S_CLIP,
                        }}
                      >
                        +{activeTierBadge.reward.seasonPts} {t('badges.seasonPointsUnit')}
                      </span>
                    )}
                  </div>
                )}

                <span
                  style={{
                    font: "400 13px/1.55 'Be Vietnam Pro', sans-serif",
                    textAlign: 'center',
                    color: '#C9B8E6',
                    marginTop: 4,
                  }}
                >
                  {badgeCond}
                </span>
              </div>

              {/* Tiến độ cá nhân của bạn */}
              <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ font: "600 10.5px/1 'Oswald', sans-serif", letterSpacing: '.16em', color: '#FFC46B' }}>
                    {t('badges.detail.yourProgress')}
                  </span>
                  <span style={{ font: "700 22px/1 'Oswald', sans-serif", color: '#FFE24B' }}>
                    {activeTierBadge.unlocked ? t('badges.detail.statusAchieved') : activeTierBadge.progressStr || `${activeTierBadge.pct}%`}
                  </span>
                </div>
                <div
                  style={{
                    height: 12,
                    clipPath: NOTCH_S_CLIP,
                    background: 'rgba(255,255,255,.1)',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${activeTierBadge.pct}%`,
                      background: meta.edge || 'linear-gradient(90deg, #FF2E7E, #FFE24B)',
                    }}
                  />
                </div>
                <span style={{ font: "400 11.5px/1.4 'IBM Plex Mono', monospace", color: '#9C8ABE' }}>
                  {activeTierBadge.unlocked
                    ? t('badges.detail.completedDesc')
                    : isWinStreak && Number(activeTierBadge.currentVal) === 0
                      ? t('badges.detail.streakResetHint')
                      : isWinStreak && Number(activeTierBadge.currentVal) > 0
                        ? t('badges.detail.remainingStreakHint', {
                            current: activeTierBadge.currentVal,
                            remain: Math.max(1, (activeTierBadge.threshold || 10) - Number(activeTierBadge.currentVal)),
                          })
                        : t('badges.detail.remainingHint', {
                            remain: Math.max(1, (activeTierBadge.threshold || 10) - (activeTierBadge.currentVal || 0)),
                          })}
                </span>
                {activeTierBadge.unlocked && onShowUnlock && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose && onClose()
                      onShowUnlock(activeTierBadge)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '11px 14px',
                      background: 'linear-gradient(135deg, rgba(255,46,126,.25), rgba(255,226,75,.25))',
                      border: '1px solid #FFE24B',
                      clipPath: NOTCH_S_CLIP,
                      color: '#FFE24B',
                      font: "700 12px/1 'Oswald', sans-serif",
                      letterSpacing: '.12em',
                      cursor: 'pointer',
                      marginTop: 10,
                      transition: 'filter 0.15s ease, transform 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.filter = 'brightness(1.2)'
                      e.currentTarget.style.transform = 'translateY(-1px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.filter = 'brightness(1)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    ✨ {t('badges.detail.viewUnlockFanfare')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: ĐIỀU KIỆN · CHUỖI · AI ĐÃ CÓ · AI ĐANG ĐUỔI */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 1. Checklist Điều kiện */}
            <div
              style={{
                padding: '17px 19px',
                clipPath: NOTCH_CLIP,
                background: 'rgba(255,255,255,.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: 13,
              }}
            >
              <div style={{ font: "700 14px/1 'Oswald', sans-serif", letterSpacing: '.12em', color: '#FFFFFF' }}>
                {t('badges.detail.conditionsTitle')}
              </div>
              {conditions.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      flex: '0 0 auto',
                      clipPath: HEX_CLIP,
                      display: 'grid',
                      placeItems: 'center',
                      font: "700 12px/1 'Oswald', sans-serif",
                      background: c.ok ? 'linear-gradient(135deg,#00776B,#2EE9C0)' : '#241640',
                      color: c.ok ? '#01130F' : '#9C8ABE',
                    }}
                  >
                    {c.ok ? '✓' : '·'}
                  </div>
                  <span style={{ flex: '1 1 0%', minWidth: 0, font: "400 13px/1.4 'Be Vietnam Pro', sans-serif", color: '#C9B8E6' }}>
                    {c.text}
                  </span>
                  <span style={{ flex: '0 0 auto', font: "600 12.5px/1 'IBM Plex Mono', monospace", color: c.ok ? '#5FEBD0' : '#C9B8E6' }}>
                    {c.val}
                  </span>
                </div>
              ))}
            </div>

            {/* 2. Chuỗi 10 ô W/L */}
            <div
              style={{
                padding: '17px 19px',
                clipPath: NOTCH_CLIP,
                background: 'rgba(255,255,255,.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ font: "700 14px/1 'Oswald', sans-serif", letterSpacing: '.12em', color: '#FFFFFF' }}>
                  {t('badges.detail.currentStreakTitle')}
                </span>
                <span style={{ font: "400 11.5px/1 'IBM Plex Mono', monospace", color: '#9C8ABE' }}>
                  {t('badges.detail.streakHint')}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 7 }}>
                {streakTimeline.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      flex: '1 1 0%',
                      height: 44,
                      clipPath: NOTCH_S_CLIP,
                      display: 'grid',
                      placeItems: 'center',
                      font: "700 15px/1 'Oswald', sans-serif",
                      background: s.won
                        ? 'linear-gradient(165deg,#FF2E7E,#7A0A2E)'
                        : 'rgba(255,255,255,.05)',
                      color: s.won ? '#FFFBEA' : '#6B5C8C',
                    }}
                  >
                    {s.label}
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Split: Ai đã có & Ai đang đuổi */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {/* Ai đã có */}
              <div
                style={{
                  padding: '17px 19px',
                  clipPath: NOTCH_CLIP,
                  background: 'rgba(255,255,255,.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ font: "700 14px/1 'Oswald', sans-serif", letterSpacing: '.12em', color: '#FFFFFF' }}>
                  {t('badges.detail.ownersTitle', { count: currentOwners.length })}
                </div>
                {currentOwners.length === 0 ? (
                  <span style={{ font: "400 12px/1.4 'Be Vietnam Pro', sans-serif", color: '#7E6FA0' }}>
                    {t('badges.detail.noOwners')}
                  </span>
                ) : (
                  currentOwners.map((o) => {
                    const noteText = o.checkType === 'win_streak'
                      ? t('badges.detail.ownersStreakNote', { streak: o.streak, season: t('badges.seasonLabel') })
                      : t('badges.detail.ownersCondNote', { val: o.streak || o.threshold || 1 })

                    return (
                      <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            flex: '0 0 auto',
                            clipPath: HEX_CLIP,
                            background: 'linear-gradient(135deg,#FF2E7E,#6D14FF)',
                            display: 'grid',
                            placeItems: 'center',
                            font: "700 14px/1 'Oswald', sans-serif",
                            color: '#FFFBEA',
                            overflow: 'hidden',
                          }}
                        >
                          {o.avatarUrl ? (
                            <img src={o.avatarUrl} alt={o.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            o.initial
                          )}
                        </div>
                        <div style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ font: "600 13px/1.2 'Be Vietnam Pro', sans-serif", color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {o.name}
                          </span>
                          <span style={{ font: "400 11px/1.2 'IBM Plex Mono', monospace", color: '#7E6FA0' }}>
                            {noteText}
                          </span>
                        </div>
                        <span style={{ font: "600 11.5px/1 'IBM Plex Mono', monospace", color: '#9C8ABE' }}>
                          {o.at}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Ai đang đuổi */}
              <div
                style={{
                  padding: '17px 19px',
                  clipPath: NOTCH_CLIP,
                  background: 'rgba(255,255,255,.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ font: "700 14px/1 'Oswald', sans-serif", letterSpacing: '.12em', color: '#FFFFFF' }}>
                  {t('badges.detail.chasersTitle')}
                </div>
                {currentChasers.length === 0 ? (
                  <span style={{ font: "400 12px/1.4 'Be Vietnam Pro', sans-serif", color: '#7E6FA0' }}>
                    {t('badges.detail.noChasers')}
                  </span>
                ) : (
                  currentChasers.map((c) => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 20, flex: '0 0 auto', font: "600 11.5px/1 'IBM Plex Mono', monospace", color: '#7E6FA0' }}>
                        {c.rank}
                      </span>
                      <span
                        style={{
                          flex: '1 1 0%',
                          minWidth: 0,
                          font: `${c.isMe ? 700 : 500} 12.5px/1 'Be Vietnam Pro', sans-serif`,
                          color: c.isMe ? '#FFE24B' : '#C9B8E6',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {c.isMe ? t('badges.detail.you') : c.name}
                      </span>
                      <div
                        style={{
                          flex: '2 1 0%',
                          height: 7,
                          clipPath: NOTCH_S_CLIP,
                          background: 'rgba(255,255,255,.08)',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${c.pct}%`,
                            background: c.isMe ? 'linear-gradient(90deg,#FF2E7E,#FFE24B)' : 'linear-gradient(90deg,#6D14FF,#C04BFF)',
                          }}
                        />
                      </div>
                      <span style={{ width: 22, flex: '0 0 auto', textAlign: 'right', font: "600 12px/1 'IBM Plex Mono', monospace", color: '#C9B8E6' }}>
                        {c.val}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
