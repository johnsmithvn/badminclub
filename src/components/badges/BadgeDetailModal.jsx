import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { HEX_CLIP, ANIME_TIERS, getBadgeOwners, getBadgeChasers, getStreakTimeline } from '#lib/badges.js'
import BadgeHex, { TIER_FX } from './BadgeHex.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'

const GOLD = '#F6C945'

// Vị trí (left %) và bề rộng (px) bốn dải cực quang, theo đúng bản thiết kế.
const CURTAIN_POS = [[18, 90], [40, 120], [64, 100], [86, 80]]

// Bụi sao rải tất định — cùng công thức với bản thiết kế, không random để khỏi nhảy mỗi lần render.
const DUST = Array.from({ length: 24 }, (_, i) => ({
  x: `${(i * 83) % 97}%`,
  y: `${(i * 47) % 48}%`,
  size: 1 + (i % 3),
  glow: 2 + (i % 3) * 3,
  twinkle: 3 + (i % 5),
  drift: 5 + (i % 4) * 2,
  delay: (i % 7) * 0.4,
}))

const SHOOTING_STARS = [
  { w: 90, dur: 7, delay: 1 },
  { w: 70, dur: 9, delay: 4.5 },
]

const CARD = {
  borderRadius: 14,
  background: 'linear-gradient(150deg,rgba(255,255,255,.045),rgba(255,255,255,.015))',
  border: '1px solid #221A3A',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  minWidth: 0,
}

const SCROLL_LIST = {
  maxHeight: 210,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  paddingRight: 4,
  scrollbarWidth: 'thin',
  scrollbarColor: 'rgba(255,255,255,0.2) transparent',
}

/**
 * Màn A2 · Chi tiết một danh hiệu · điều kiện · chuỗi hiện tại · ai đã có · ai đang đuổi.
 * Họ danh hiệu nhiều mốc có thêm thanh Hành trình cấp độ để chọn mốc.
 * Thẻ huy hiệu chính có nền hiệu ứng đổi theo bậc: bụi sao + sao băng, chùm sáng (bậc thấp)
 * hoặc cực quang (Sử thi / Huyền thoại).
 *
 * Modal DUY NHẤT cho chi tiết danh hiệu (trang Danh hiệu desktop + mobile, hồ sơ thành viên).
 * Người giữ / người đuổi / chuỗi hiện tại tự tính từ `db` — nơi gọi chỉ cần đưa badge (nên qua
 * `familyViewOf` để có thanh hành trình mốc), db và thành viên đang xét.
 */
export default function BadgeDetailModal({
  badge,
  db = null,
  currentSeason = null,
  preloadedSeasonMatches = null,
  preloadedClubStats = null,
  currentMember = null,
  onClose,
  onShowUnlock,
}) {
  const isMobile = useMobile(768)

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
  const fx = TIER_FX[activeTierBadge.tier] || TIER_FX.rare
  const rgba = (a) => `rgba(${fx.rgb},${a})`
  const isHidden = activeTierBadge.tier === 'hidden' && !activeTierBadge.unlocked
  const badgeName = t(`badges.items.${activeTierBadge.id}.name`, { defaultValue: activeTierBadge.name || '???' })
  const badgeCond = t(`badges.items.${activeTierBadge.id}.cond`, { defaultValue: activeTierBadge.cond || '' })

  // `pct` vắng mặt khi modal được mở bằng bản ĐỊNH NGHĨA danh hiệu (getBadgeById) thay vì bản
  // đã tính tiến độ cho một người — không chặn thì in thẳng ra chữ "undefined%".
  const pct = Number(activeTierBadge.pct) || 0
  const isUnlocked = !!activeTierBadge.unlocked
  const barPct = isUnlocked ? 100 : pct
  const isWinStreak = activeTierBadge.checkType === 'win_streak'
  const isHolding = isWinStreak ? Number(activeTierBadge.currentVal) > 0 : activeTierBadge.pct > 0

  // Danh sách người đã có và người đang đuổi theo mốc đang chọn
  const currentOwners = useMemo(() => {
    if (!db || !activeTierBadge?.id) return []
    return getBadgeOwners(activeTierBadge.id, db, currentSeason, preloadedSeasonMatches, preloadedClubStats)
  }, [db, activeTierBadge, currentSeason, preloadedSeasonMatches, preloadedClubStats])

  const currentChasers = useMemo(() => {
    if (!db || !activeTierBadge?.id) return []
    return getBadgeChasers(activeTierBadge.id, currentMember?.id, db, currentSeason, preloadedSeasonMatches, preloadedClubStats)
  }, [db, activeTierBadge, currentMember, currentSeason, preloadedSeasonMatches, preloadedClubStats])

  const memberId = currentMember?.id
  const streakTimeline = useMemo(() => {
    if (!db || !memberId) return []
    return getStreakTimeline(memberId, db, 10)
  }, [db, memberId])

  const isFun = activeTierBadge.tier === 'fun'
  const isStreakBadge = activeTierBadge.checkType === 'win_streak' || activeTierBadge.checkType === 'pair_streak'

  const conditions = useMemo(() => {
    if (isFun) return []
    const list = [
      {
        ok: !!activeTierBadge.unlocked,
        text: badgeCond,
        val: activeTierBadge.unlocked ? t('badges.detail.statusAchieved') : (activeTierBadge.progressStr || `${pct}%`),
      },
    ]
    if (isStreakBadge) {
      list.push({
        ok: !!activeTierBadge.unlocked || isHolding,
        text: t('badges.detail.condNoLoss'),
        val: activeTierBadge.unlocked
          ? t('badges.detail.statusAchieved')
          : isHolding
            ? t('badges.detail.statusHolding')
            : t('badges.detail.statusBroken'),
      })
    }
    return list
  }, [isFun, isStreakBadge, activeTierBadge.unlocked, badgeCond, activeTierBadge.progressStr, pct, isHolding])

  // Mọi hook phải chạy TRƯỚC lần return sớm này (rules-of-hooks)
  if (!badge) return null

  const familyName = isFamily ? t(`badges.families.${badge.familyKey}.name`, { defaultValue: badgeName }) : badgeName
  const progressText = isUnlocked ? t('badges.detail.statusAchieved') : (activeTierBadge.progressStr || `${pct}%`)
  const progressColor = isUnlocked ? fx.acc : GOLD
  const progressHint = isUnlocked
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
          })

  const cardPad = isMobile ? '15px 16px' : '16px 18px'
  const cardTitle = {
    font: `700 ${isMobile ? 13 : 14}px/1.2 'Oswald', sans-serif`,
    letterSpacing: '.14em',
    textTransform: 'uppercase',
    color: '#FFFFFF',
  }
  const emptyText = { font: `400 ${isMobile ? 12 : 12.5}px/1.4 var(--font-sans)`, color: '#8E83A8' }
  const tierRing = `linear-gradient(160deg,${fx.light},${fx.acc} 55%,${fx.mid})`
  const tierBar = `linear-gradient(90deg,${fx.mid},${fx.acc})`

  /* ── Thẻ huy hiệu chính với nền hiệu ứng ───────────────────────────────── */
  const hero = (
    <div
      data-badge-fx
      style={{
        position: 'relative',
        minHeight: 560,
        borderRadius: 16,
        overflow: 'hidden',
        border: `1px solid ${rgba(0.45)}`,
        background: '#06080C',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      {DUST.map((s, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
            borderRadius: 999,
            background: '#FFFFFF',
            opacity: 0.3,
            boxShadow: `0 0 ${s.glow}px rgba(255,255,255,.8)`,
            animation: `bdTwinkle ${s.twinkle}s ease-in-out ${s.delay}s infinite, bdDrift ${s.drift}s ease-in-out ${s.delay}s infinite`,
            pointerEvents: 'none',
          }}
        />
      ))}
      {SHOOTING_STARS.map((s, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: s.w,
            height: 1.5,
            background: 'linear-gradient(90deg,transparent,#FFFFFF)',
            transform: 'rotate(28deg)',
            opacity: 0,
            animation: `bdShoot ${s.dur}s ease-in ${s.delay}s infinite`,
            pointerEvents: 'none',
          }}
        />
      ))}

      {fx.effect === 'beam' && (
        <>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 0,
              width: 270,
              height: 300,
              marginLeft: -135,
              background: `linear-gradient(180deg,${rgba(0.3)},${rgba(0.08)} 72%,transparent)`,
              clipPath: 'polygon(40% 0,60% 0,100% 100%,0 100%)',
              animation: 'bdBeam 6s ease-in-out infinite',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 120,
              width: 230,
              height: 70,
              marginLeft: -115,
              background: `radial-gradient(50% 50% at 50% 50%,${rgba(0.3)},transparent 70%)`,
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      {fx.effect === 'aurora' && (
        <>
          {fx.curtains.map(([c1, c2], i) => {
            const [left, w] = CURTAIN_POS[i]
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${left}%`,
                  top: -40,
                  width: w,
                  height: 400,
                  marginLeft: -w / 2,
                  background: `linear-gradient(180deg,transparent,rgba(${c1},.5) 30%,rgba(${c2},.45) 62%,transparent)`,
                  filter: 'blur(22px)',
                  transformOrigin: 'top',
                  mixBlendMode: 'screen',
                  animation: `bdSway ${9 + i * 1.5}s ease-in-out ${-i * 2}s infinite`,
                  pointerEvents: 'none',
                }}
              />
            )
          })}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 230,
              height: 140,
              background: 'linear-gradient(180deg,transparent,#06080C)',
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      <div
        style={{
          position: 'relative',
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 11,
          padding: isMobile ? '0 18px 18px' : '0 24px 22px',
          textAlign: 'center',
        }}
      >
        <div style={{ marginTop: 140, marginBottom: 6, filter: `drop-shadow(0 0 22px ${rgba(0.45)})` }}>
          <Hex width={128} height={140} inset={3} ring={tierRing} well={fx.well}>
            {isHidden ? (
              <span style={{ font: "700 48px/1 'Oswald', sans-serif", color: fx.acc }}>?</span>
            ) : (
              <span
                style={{
                  width: 54,
                  height: 48,
                  clipPath: glyphClip(activeTierBadge.glyph),
                  background: `linear-gradient(180deg,${fx.light},${fx.acc})`,
                }}
              />
            )}
          </Hex>
        </div>

        <span
          style={{
            font: `700 ${isMobile ? 32 : 36}px/1.05 'Oswald', sans-serif`,
            letterSpacing: '.05em',
            textTransform: 'uppercase',
            color: '#FFFFFF',
            textShadow: `0 0 22px ${rgba(0.45)}`,
            overflowWrap: 'anywhere',
          }}
        >
          {isHidden ? '???' : badgeName}
        </span>

        {activeTierBadge.seasonCode && (
          <span style={{ font: '600 12px/1 var(--font-mono)', letterSpacing: '.1em', color: fx.acc }}>
            ✦ {activeTierBadge.seasonCode} ✦
          </span>
        )}

        <span
          style={{
            font: `600 ${isMobile ? 10.5 : 11}px/1 'Oswald', sans-serif`,
            letterSpacing: '.22em',
            textTransform: 'uppercase',
            padding: '6px 12px',
            borderRadius: 6,
            background: rgba(0.12),
            borderTop: `1px solid ${rgba(0.45)}`,
            color: fx.acc,
          }}
        >
          {meta.name} · {meta.pts} {t('badges.pointsLabel')}
        </span>

        {activeTierBadge.reward && (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
            <span
              style={{
                font: '700 12px/1 var(--font-display)',
                padding: '7px 11px',
                borderRadius: 7,
                background: 'rgba(246,201,69,.12)',
                border: '1px solid rgba(246,201,69,.4)',
                color: GOLD,
              }}
            >
              +{activeTierBadge.reward.xp || 0} XP
            </span>
            {Number(activeTierBadge.reward.seasonPts) > 0 && (
              <span
                style={{
                  font: '700 12px/1 var(--font-display)',
                  padding: '7px 11px',
                  borderRadius: 7,
                  background: rgba(0.12),
                  border: `1px solid ${rgba(0.45)}`,
                  color: fx.acc,
                }}
              >
                +{activeTierBadge.reward.seasonPts} {t('badges.seasonPointsUnit')}
              </span>
            )}
          </div>
        )}

        <span style={{ font: `400 ${isMobile ? 14 : 14.5}px/1.4 var(--font-sans)`, color: '#E3DCEE' }}>
          {badgeCond}
        </span>

        {/* Tiến độ cá nhân — đẩy xuống đáy thẻ để huy hiệu luôn nằm ngay dưới chùm sáng */}
        <div
          style={{
            alignSelf: 'stretch',
            marginTop: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 9,
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(4,8,10,.72)',
            border: '1px solid rgba(255,255,255,.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span
              style={{
                flex: '1 1 0%',
                textAlign: 'left',
                font: `600 ${isMobile ? 10 : 10.5}px/1 'Oswald', sans-serif`,
                letterSpacing: '.16em',
                textTransform: 'uppercase',
                color: GOLD,
              }}
            >
              {t('badges.detail.yourProgress')}
            </span>
            <span style={{ font: `700 ${isMobile ? 22 : 24}px/1 'Oswald', sans-serif`, color: progressColor }}>
              {progressText}
            </span>
          </div>
          <div style={{ height: 7, borderRadius: 999, background: 'rgba(255,255,255,.1)', overflow: 'hidden' }}>
            <div style={{ width: `${barPct}%`, height: '100%', borderRadius: 999, background: tierBar }} />
          </div>
          <span style={{ textAlign: 'left', font: '400 11px/1.4 var(--font-mono)', color: '#9A90AD' }}>
            {progressHint}
          </span>
        </div>

        {isUnlocked && onShowUnlock && (
          <button
            type="button"
            onClick={() => {
              onClose && onClose()
              onShowUnlock(activeTierBadge)
            }}
            style={{
              alignSelf: 'stretch',
              padding: '12px 14px',
              borderRadius: 10,
              border: `1px solid ${rgba(0.55)}`,
              background: rgba(0.14),
              color: fx.acc,
              font: "700 12px/1 'Oswald', sans-serif",
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'filter 140ms cubic-bezier(.2,.8,.2,1)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = 'none' }}
          >
            {t('badges.detail.viewUnlockFanfare')}
          </button>
        )}
      </div>
    </div>
  )

  /* ── Thanh hành trình cấp độ ───────────────────────────────────────────── */
  const pipW = isMobile ? 26 : 34
  const pipH = isMobile ? 28 : 36
  const journey = isFamily && (
    <div
      style={
        isMobile
          ? { ...CARD, padding: cardPad }
          : {
              ...CARD,
              padding: '16px 18px 18px',
              background: 'linear-gradient(180deg,rgba(90,20,60,.4),rgba(20,10,34,.6))',
              border: '1px solid #2A1F4A',
            }
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12 }}>
        <span
          style={{
            font: `700 ${isMobile ? 12 : 13}px/1 'Oswald', sans-serif`,
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: GOLD,
          }}
        >
          {t('badges.detail.milestoneRoadTitle')}
        </span>
        <span style={{ flex: '1 1 0%', minWidth: 0, font: '400 11px/1 var(--font-mono)', color: '#8E83A8' }}>
          {t('badges.detail.milestoneRoadHint', {
            unlockedCount: tiers.filter((tr) => tr.unlocked).length,
            totalCount: tiers.length,
          })}
        </span>
        {!isMobile && (
          <span style={{ font: '600 12px/1 var(--font-sans)', color: '#C8A8F0' }}>{familyName}</span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tiers.length}, minmax(0, 1fr))`, gap: isMobile ? 7 : 12 }}>
        {tiers.map((tr, idx) => {
          const trFx = TIER_FX[tr.tier] || TIER_FX.rare
          const isSelected = idx === selectedTierIdx
          const isOpen = !!tr.unlocked
          const trPct = Number(tr.pct) || 0

          return (
            <button
              key={tr.id || idx}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelectedTierIdx(idx)}
              style={{
                minWidth: 0,
                padding: isMobile ? '10px 4px 9px' : '14px 10px 12px',
                borderRadius: isMobile ? 10 : 12,
                background: isSelected
                  ? 'linear-gradient(180deg,rgba(170,30,90,.55),rgba(50,20,120,.55))'
                  : isOpen
                    ? `rgba(${trFx.rgb},.06)`
                    : 'transparent',
                border: isSelected
                  ? '1px solid #FF4F8A'
                  : isOpen
                    ? `1px solid rgba(${trFx.rgb},.45)`
                    : '1px dashed #2E2447',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: isMobile ? 6 : 7,
                cursor: 'pointer',
                transition: 'background 140ms cubic-bezier(.2,.8,.2,1), border-color 140ms cubic-bezier(.2,.8,.2,1)',
              }}
            >
              <Hex width={pipW} height={pipH} inset={2} ring={trFx.pip} well={trFx.pipWell}>
                {isOpen ? (
                  <span
                    style={{
                      width: Math.round(pipW * 0.46),
                      height: Math.round(pipW * 0.42),
                      clipPath: glyphClip(tr.glyph),
                      background: trFx.pip,
                    }}
                  />
                ) : (
                  <span style={{ font: `700 ${isMobile ? 10 : 12}px/1 var(--font-display)`, color: trFx.pip }}>?</span>
                )}
              </Hex>
              <span
                style={{
                  font: `700 ${isMobile ? 10 : 11}px/1 'Oswald', sans-serif`,
                  letterSpacing: isMobile ? '.1em' : '.12em',
                  color: isSelected ? GOLD : trFx.acc,
                }}
              >
                {t('badges.detail.milestoneLevel', { index: idx + 1 })}
              </span>
              <span
                style={{
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  font: `500 ${isMobile ? 11 : 13}px/1.2 var(--font-sans)`,
                  color: isSelected || isOpen ? '#E3DCEE' : '#9A90AD',
                }}
              >
                {t(`badges.items.${tr.id}.name`, { defaultValue: tr.name || '' })}
              </span>
              {!isMobile && (
                <span
                  style={{
                    font: '400 10px/1 var(--font-mono)',
                    padding: '4px 8px',
                    borderRadius: 999,
                    background: isOpen
                      ? `rgba(${trFx.rgb},.14)`
                      : trPct > 0
                        ? 'rgba(246,201,69,.12)'
                        : isSelected
                          ? 'rgba(255,255,255,.08)'
                          : 'rgba(255,255,255,.06)',
                    color: isOpen ? trFx.acc : trPct > 0 ? GOLD : isSelected ? '#9A90AD' : '#7C7294',
                  }}
                >
                  {isOpen ? t('badges.openedStatus') : trPct > 0 ? `${trPct}%` : t('badges.lockedStatus')}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )

  /* ── Các thẻ chi tiết: điều kiện · tiến độ/chuỗi · ai đã có · người sắp đạt ── */
  const funCard = (
    <div
      style={{
        ...CARD,
        padding: cardPad,
        gap: 14,
        background: 'linear-gradient(150deg,rgba(246,201,69,.08),rgba(255,79,138,.05))',
        border: '1px solid rgba(246,201,69,.3)',
      }}
    >
      <span style={{ ...cardTitle, color: GOLD }}>{t('badges.groups.fun')}</span>
      <div
        style={{
          font: '400 13.5px/1.6 var(--font-sans)',
          color: '#FFFBEA',
          background: 'rgba(0,0,0,.35)',
          padding: '12px 14px',
          borderRadius: 10,
          borderLeft: `3px solid ${GOLD}`,
        }}
      >
        "{badgeCond}"
      </div>
      <span style={{ font: '600 12.5px/1.5 var(--font-sans)', color: '#FFC46B' }}>{t('badges.detail.funPunchline')}</span>
      <span style={{ font: '400 11.5px/1.4 var(--font-mono)', color: '#8E83A8' }}>{t('badges.detail.funBadgeNote')}</span>
    </div>
  )

  const conditionsCard = (
    <div style={{ ...CARD, padding: cardPad, gap: 11 }}>
      <span style={cardTitle}>{t('badges.detail.conditionsTitle')}</span>
      {conditions.map((c, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 12 }}>
          <span
            style={{
              width: isMobile ? 20 : 22,
              height: isMobile ? 22 : 24,
              flex: '0 0 auto',
              clipPath: HEX_CLIP,
              display: 'grid',
              placeItems: 'center',
              background: c.ok ? `linear-gradient(160deg,${fx.light},${fx.acc})` : '#2A1B55',
              font: "700 11px/1 'Oswald', sans-serif",
              color: '#06080C',
            }}
          >
            {c.ok ? '✓' : <span style={{ width: 3, height: 3, borderRadius: 999, background: '#8E7BD0' }} />}
          </span>
          <span style={{ flex: '1 1 0%', minWidth: 0, font: `400 ${isMobile ? 13.5 : 14}px/1.4 var(--font-sans)`, color: '#E3DCEE' }}>
            {c.text}
          </span>
          <span style={{ flex: '0 0 auto', font: `600 ${isMobile ? 12 : 13}px/1 var(--font-mono)`, color: c.ok ? fx.acc : '#9A90AD' }}>
            {c.val}
          </span>
        </div>
      ))}
    </div>
  )

  const streakCard = (
    <div style={{ ...CARD, padding: cardPad }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <span style={cardTitle}>{t('badges.detail.currentStreakTitle')}</span>
        <span style={{ font: '400 11px/1 var(--font-mono)', color: '#8E83A8' }}>{t('badges.detail.streakHint')}</span>
      </div>
      <div style={{ display: 'flex', gap: isMobile ? 5 : 7 }}>
        {streakTimeline.map((s, i) => (
          <div
            key={i}
            style={{
              flex: '1 1 0%',
              minWidth: 0,
              height: isMobile ? 34 : 40,
              borderRadius: 8,
              display: 'grid',
              placeItems: 'center',
              font: "700 14px/1 'Oswald', sans-serif",
              background: s.won ? rgba(0.18) : 'rgba(255,255,255,.04)',
              border: s.won ? `1px solid ${rgba(0.55)}` : '1px solid #221A3A',
              color: s.won ? fx.acc : '#5E5478',
            }}
          >
            {s.label}
          </div>
        ))}
      </div>
    </div>
  )

  const missionCard = (
    <div style={{ ...CARD, padding: cardPad, gap: 11 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ ...cardTitle, flex: '1 1 0%' }}>{t('badges.detail.missionProgressTitle')}</span>
        <span style={{ font: `700 ${isMobile ? 18 : 20}px/1 'Oswald', sans-serif`, color: progressColor }}>{progressText}</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
        <div
          style={{
            width: `${barPct}%`,
            height: '100%',
            borderRadius: 999,
            background: tierBar,
            transition: 'width 320ms cubic-bezier(.2,.8,.2,1)',
          }}
        />
      </div>
      <span style={{ font: `500 ${isMobile ? 12 : 12.5}px/1.4 var(--font-sans)`, color: '#C9BFDC' }}>
        {isUnlocked
          ? t('badges.detail.missionCompleted')
          : t('badges.detail.missionRemaining', {
              current: activeTierBadge.currentVal || 0,
              target: activeTierBadge.threshold || 1,
              remain: Math.max(0, (activeTierBadge.threshold || 1) - (activeTierBadge.currentVal || 0)),
            })}
      </span>
    </div>
  )

  // Điện thoại: hai thẻ người đứng cạnh nhau chỉ khi cả hai đều trống (như bản thiết kế); có
  // danh sách thì xếp dọc, vì ô ~165px không chứa nổi avatar + tên + ngày.
  const stackPeople = isMobile && (currentOwners.length > 0 || currentChasers.length > 0)
  const peopleGrid = (
    <div style={{ display: 'grid', gridTemplateColumns: stackPeople ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: isMobile ? 12 : 14 }}>
      <div style={{ ...CARD, padding: isMobile ? '14px 15px' : cardPad, gap: 10 }}>
        <span style={cardTitle}>{t('badges.detail.ownersTitle', { count: currentOwners.length })}</span>
        {currentOwners.length === 0 ? (
          <span style={emptyText}>{t('badges.detail.noOwners')}</span>
        ) : (
          <div style={{ ...SCROLL_LIST, gap: 11, minWidth: 0 }}>
            {currentOwners.map((o) => {
              const noteText = o.checkType === 'win_streak'
                ? t('badges.detail.ownersStreakNote', { streak: o.streak, season: t('badges.seasonLabel') })
                : t('badges.detail.ownersCondNote', { val: o.streak || o.threshold || 1 })

              return (
                <div key={o.id} style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      flex: '0 0 auto',
                      clipPath: HEX_CLIP,
                      background: tierRing,
                      display: 'grid',
                      placeItems: 'center',
                      font: "700 14px/1 'Oswald', sans-serif",
                      color: '#06080C',
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
                    <span
                      title={o.name}
                      style={{
                        font: '600 13px/1.2 var(--font-sans)',
                        color: '#FFFFFF',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {o.name}
                    </span>
                    <span style={{ font: '400 11px/1.2 var(--font-mono)', color: '#8E83A8' }}>{noteText}</span>
                  </div>
                  <span style={{ flex: '0 0 auto', font: '600 11.5px/1 var(--font-mono)', color: '#9A90AD' }}>{o.at}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ ...CARD, padding: isMobile ? '14px 15px' : cardPad, gap: 10 }}>
        <span style={cardTitle}>{t('badges.detail.chasersTitle')}</span>
        {currentChasers.length === 0 ? (
          <span style={emptyText}>{t('badges.detail.noChasers')}</span>
        ) : (
          <div style={{ ...SCROLL_LIST, gap: 10 }}>
            {currentChasers.map((c) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 20, flex: '0 0 auto', font: '600 11.5px/1 var(--font-mono)', color: '#8E83A8' }}>{c.rank}</span>
                <span
                  title={c.name}
                  style={{
                    flex: '1 1 0%',
                    minWidth: 0,
                    font: `${c.isMe ? 700 : 500} 12.5px/1.2 var(--font-sans)`,
                    color: c.isMe ? GOLD : '#E3DCEE',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {c.isMe ? t('badges.detail.you') : c.name}
                </span>
                <div style={{ flex: '2 1 0%', height: 7, borderRadius: 999, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${c.pct}%`,
                      height: '100%',
                      borderRadius: 999,
                      background: c.isMe ? `linear-gradient(90deg,#9A7414,${GOLD})` : tierBar,
                    }}
                  />
                </div>
                <span style={{ width: 22, flex: '0 0 auto', textAlign: 'right', font: '600 12px/1 var(--font-mono)', color: '#C9BFDC' }}>
                  {c.val}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const details = (
    <>
      {isFun ? funCard : (
        <>
          {conditionsCard}
          {isStreakBadge ? streakCard : missionCard}
        </>
      )}
      {peopleGrid}
    </>
  )

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        background: 'rgba(5,3,9,.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '10px 8px' : '24px 16px',
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
          maxWidth: 1100,
          maxHeight: '94vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: isMobile ? 26 : 22,
          border: '1px solid #2A1F4A',
          // Lưới chấm nằm trên NỀN của khung cuộn chứ không phải một lớp absolute — lớp absolute
          // chỉ phủ đúng phần nhìn thấy lúc mở, cuộn xuống là hết chấm.
          background: 'radial-gradient(rgba(255,255,255,.06) 1px,transparent 1px) 0 0/14px 14px, #09060F',
          boxShadow: '0 24px 70px rgba(0,0,0,.75), 0 0 48px rgba(90,40,170,.22)',
        }}
      >
        {/* Header dính trên cùng, thân cuộn bên dưới — nền phải đục vì nội dung chạy ngay dưới nó */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 5,
            flexShrink: 0,
            height: isMobile ? 54 : 56,
            padding: isMobile ? '0 16px' : '0 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderBottom: '1px solid #1E1636',
            background: '#050309',
          }}
        >
          <span
            style={{
              flex: '1 1 0%',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              font: "700 14px/1 'Oswald', sans-serif",
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: '#FFFFFF',
            }}
          >
            {isHidden ? '???' : familyName}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: '0 0 auto',
              border: 'none',
              borderRadius: 8,
              background: '#161026',
              color: '#C9BFDC',
              padding: isMobile ? '9px 12px' : '9px 14px',
              font: "600 12px/1 'Oswald', sans-serif",
              letterSpacing: '.12em',
              cursor: 'pointer',
              transition: 'background 140ms cubic-bezier(.2,.8,.2,1)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#201838' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#161026' }}
          >
            {t('badges.closeBtn')}
          </button>
        </div>

        <div
          style={{
            padding: isMobile ? 14 : '20px 24px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? 14 : 18,
          }}
        >
          {isMobile ? (
            <>
              {hero}
              {journey}
              {details}
            </>
          ) : (
            <>
              {journey}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 430px) minmax(0, 1fr)', gap: 20 }}>
                {hero}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>{details}</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent
}
