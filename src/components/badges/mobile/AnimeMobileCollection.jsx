import { useState, useMemo } from 'react'
import BadgeHex from '../BadgeHex.jsx'
import TierBackdrop from '../TierBackdrop.jsx'
import { TIER_FX, levelTier } from '../tierFx.js'
import { HEX_CLIP, sortBadgesByRarity } from '#lib/badges.js'
import { t } from '#i18n'
import { shortName } from '#lib/money.js'

const GOLD = '#F6C945'

// Tab đang chọn vát một góc dưới bên phải.
const TAB_CLIP = 'polygon(0 0,100% 0,100% 70%,92% 100%,0 100%)'

const SECTION_TITLE = {
  font: "700 14px/1.2 'Oswald', sans-serif",
  letterSpacing: '.14em',
  textTransform: 'uppercase',
  color: '#FFFFFF',
}
const COUNT_MONO = { flex: '0 0 auto', font: '400 12px/1 var(--font-mono)', color: '#8E83A8' }
const COUNT_CHIP = { flex: '0 0 auto', font: '600 11px/1 var(--font-mono)', padding: '4px 8px', borderRadius: 4 }
const SELECT = {
  maxWidth: 210,
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #2B3A8A',
  background: '#0B0820',
  outline: 'none',
  cursor: 'pointer',
}
const OPTION = { background: '#0B0820', color: '#FFFFFF' }

/**
 * AM1 · Bộ sưu tập (mobile) — thiết kế "Danh hiệu · Bộ sưu tập mobile (hiệu ứng mới)".
 * - Header: tiêu đề, mùa, nút Sắp lại kệ, chọn mùa / người xem, 3 tab
 * - Thẻ hồ sơ: nền hiệu ứng theo cấp (TierBackdrop compact) ở nửa trên, chữ và chỉ số nằm trên
 *   nền tối ở nửa dưới
 * - Kệ 3 ô · Kho huy hiệu đã mở · Bộ lọc loại · Lưới nhóm đang chọn · Danh sách nhóm khác
 * Lưới tô viền theo bậc để nhìn ra bậc ngay cả khi chưa mở; chưa mở thì icon hiện dấu "?".
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
  onEditSignature,
  allMembers = [],
  allSeasons = [],
  selectedSeasonId = null,
  onSelectSeason,
}) {
  // Nhóm đang được chọn để hiển thị lưới 3 cột (mặc định là nhóm đầu tiên)
  const [selectedGroupIdx, setSelectedGroupIdx] = useState(0)

  // Bộ lọc loại danh hiệu: all | family | solo
  const [filterKind, setFilterKind] = useState('all')

  // Danh sách huy hiệu chính thức đã mở khóa cho Kho Đã Mở
  const unlockedShowcaseBadges = useMemo(() => {
    const list = memberBadges?.unlocked || []
    const official = list.filter((b) => b.tier !== 'fun')
    return sortBadgesByRarity(official)
  }, [memberBadges?.unlocked])

  // Danh sách các nhóm
  const groups = useMemo(() => {
    if (!catalogGroups || catalogGroups.length === 0) return []
    return catalogGroups
  }, [catalogGroups])

  const activeGroup = groups[selectedGroupIdx] || groups[0] || null

  // Kệ của activeMember — đúng những gì họ tự gắn (đã chuẩn hoá trong calculateMemberBadges)
  const shelfBadges = memberBadges?.shelfBadges || []

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

  // Màu và hiệu ứng thẻ hồ sơ theo cấp
  const levelTierKey = levelTier(level)
  const levelFx = TIER_FX[levelTierKey]
  const levelRgba = (a) => `rgba(${levelFx.rgb},${a})`
  const levelRing = `linear-gradient(160deg,${levelFx.light},${levelFx.acc} 55%,${levelFx.mid})`

  const stats = [
    { key: 'xp', label: 'XP', value: currentXp.toLocaleString('vi-VN'), color: '#F6A03C', ink: '#F6A03C', bg: 'rgba(246,160,60,.08)' },
    { key: 'season', label: t('badges.collectorProfile.seasonPoints'), value: memberSeasonData?.seasonPoints || 0, color: '#5FDBD3', ink: '#5FDBD3', bg: 'rgba(95,219,211,.08)' },
    { key: 'collection', label: t('badges.collectorProfile.collectionPoints'), value: collectionScore, color: '#FF3D77', ink: '#FF6A95', bg: 'rgba(255,61,119,.08)' },
  ]

  const signaturePill = {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 14px',
    borderRadius: 999,
    border: '1px solid rgba(246,201,69,.45)',
    background: 'transparent',
    font: 'italic 400 14px/1.2 var(--font-sans)',
    textAlign: 'left',
  }

  const renderBadgeItem = (b) => {
    const isUnlocked = b.unlocked || (b.isFamily && !!b.highestUnlocked)
    const currentBadge = b.isFamily ? (b.highestUnlocked || b.nextTarget || b.tiers?.[0] || b) : b
    const tierKey = currentBadge.tier || 'rare'
    const bFx = TIER_FX[tierKey] || TIER_FX.rare
    const bName = t(`badges.items.${currentBadge.id}.name`, { defaultValue: currentBadge.name || '' })
    const pct = Number(currentBadge.pct) || 0
    // Vạch cấp của họ danh hiệu: tô tới mốc đang hiển thị (mốc cao nhất đã mở, hoặc mốc đang đuổi)
    const familyTiers = b.isFamily && Array.isArray(b.tiers) ? b.tiers : []
    const shownIdx = familyTiers.findIndex((tr) => tr.id === currentBadge.id)

    return (
      <div
        key={b.id}
        onClick={() => onSelectBadge && onSelectBadge(b)}
        style={{
          minWidth: 0,
          padding: '14px 4px 10px',
          borderRadius: 12,
          background: isUnlocked
            ? 'linear-gradient(180deg,rgba(246,201,69,.1),rgba(255,255,255,.01))'
            : 'linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01))',
          border: isUnlocked ? '1px solid rgba(246,201,69,.7)' : `1px solid rgba(${bFx.rgb},.3)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 9,
          cursor: 'pointer',
        }}
      >
        <BadgeHex tier={tierKey} glyph={currentBadge.glyph} size={57} dim={!isUnlocked} />
        <span
          style={{
            maxWidth: '100%',
            padding: '0 2px',
            font: '500 12px/1.2 var(--font-sans)',
            color: isUnlocked ? '#FFFFFF' : '#C9BFDC',
            textAlign: 'center',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {bName}
        </span>

        {familyTiers.length > 1 && (
          <div style={{ display: 'flex', gap: 3 }}>
            {familyTiers.map((tr, i) => (
              <span
                key={tr.id || i}
                style={{
                  width: 12,
                  height: 3,
                  borderRadius: 2,
                  background: i <= shownIdx ? (TIER_FX[tr.tier] || TIER_FX.rare).acc : 'rgba(255,255,255,.12)',
                }}
              />
            ))}
          </div>
        )}

        {!isUnlocked && pct > 0 && (
          <div style={{ width: '100%', padding: '0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ font: '600 10px/1 var(--font-mono)', color: bFx.acc }}>
              {currentBadge.progressStr || `${pct}%`}
            </span>
            <div style={{ width: '100%', height: 3, borderRadius: 999, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg,${bFx.mid},${bFx.acc})` }} />
            </div>
          </div>
        )}
      </div>
    )
  }

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
        borderRadius: 26,
        border: '1px solid #2A1F4A',
        background: 'radial-gradient(rgba(255,255,255,.055) 1px,transparent 1px) 0 0/14px 14px, #09060F',
        minHeight: '844px',
        color: '#FFFFFF',
      }}
    >
      {/* ═══ HEADER: tiêu đề · mùa · bộ chọn · 3 tab ═══ */}
      <div
        style={{
          position: 'relative',
          flex: '0 0 auto',
          padding: '18px 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: 'linear-gradient(180deg,#1A0C3A,#0D0820)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span
              style={{
                font: "700 32px/1 'Oswald', sans-serif",
                letterSpacing: '.04em',
                textTransform: 'uppercase',
                color: '#FFFFFF',
              }}
            >
              {t('badges.title')}
            </span>
            <span
              style={{
                font: '400 12px/1.3 var(--font-mono)',
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: '#9A90AD',
              }}
            >
              {currentSeason?.name || t('badges.seasonHeader')}
            </span>
          </div>

          {/* Nút SẮP KỆ — chỉ trên hồ sơ của chính mình (modal gắn/gỡ kệ của người đăng nhập) */}
          {isViewingSelf && (
            <button
              type="button"
              onClick={onReorderShelf}
              style={{
                flex: '0 0 auto',
                font: "700 11px/1 'Oswald', sans-serif",
                letterSpacing: '.14em',
                padding: '9px 12px',
                borderRadius: 6,
                border: 'none',
                background: 'rgba(120,70,220,.3)',
                color: '#C8A8F0',
                cursor: 'pointer',
              }}
            >
              {t('badges.reorderShelf')}
            </button>
          )}
        </div>

        {/* Bộ chọn mùa giải */}
        {allSeasons && allSeasons.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, minWidth: 0, font: '400 13px/1.2 var(--font-sans)', color: '#9A90AD' }}>
              {t('season.filterSeason')}
            </span>
            <select
              value={currentSeason?.id || currentSeason?.code || selectedSeasonId || ''}
              onChange={(e) => onSelectSeason && onSelectSeason(e.target.value)}
              style={{ ...SELECT, font: '600 13px/1.2 var(--font-sans)', color: '#5FDBD3' }}
            >
              {allSeasons.map((s) => (
                <option key={s.id || s.code} value={s.id || s.code} style={OPTION}>
                  {s.code || s.name} {s.active ? `(${t('season.activeCurrent')})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Bộ chọn thành viên xem (nếu muốn xem hồ sơ người khác) */}
        {allMembers && allMembers.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, minWidth: 0, font: '400 13px/1.2 var(--font-sans)', color: '#9A90AD' }}>
              {t('badges.selectMember')}
            </span>
            <select
              value={activeMember?.id || ''}
              onChange={(e) => onSelectMember && onSelectMember(e.target.value)}
              style={{ ...SELECT, font: '500 13px/1.2 var(--font-sans)', color: '#E9EFF7' }}
            >
              {allMembers.map((m) => (
                <option key={m.id} value={m.id} style={OPTION}>
                  {shortName(m.name)} {m.id === currentMember?.id ? `(${t('badges.collectorProfile.rankMe')})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Sub-tabs: BỘ SƯU TẬP | TREO THƯỞNG | XẾP HẠNG */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
          {[
            { id: 'collection', label: t('badges.tabCollection') },
            { id: 'bounty', label: t('badges.tabBounties') },
            { id: 'leaderboard', label: t('badges.tabLeaderboardShort') },
          ].map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange && onTabChange(tab.id)}
                style={{
                  minWidth: 0,
                  padding: '11px 4px',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'center',
                  font: "700 12px/1 'Oswald', sans-serif",
                  letterSpacing: '.14em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  background: isActive ? 'linear-gradient(90deg,#FF3D77,#FF9A3D)' : 'rgba(255,255,255,.05)',
                  color: isActive ? '#1A0510' : '#8E83A8',
                  clipPath: isActive ? TAB_CLIP : undefined,
                  transition: 'background 140ms cubic-bezier(.2,.8,.2,1), color 140ms cubic-bezier(.2,.8,.2,1)',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ═══ THÂN CUỘN ═══ */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '14px 14px 30px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Banner báo đang xem người khác */}
        {!isViewingSelf && (
          <div
            style={{
              flex: '0 0 auto',
              padding: '10px 12px',
              borderRadius: 12,
              background: 'linear-gradient(135deg,rgba(255,61,119,.16),rgba(120,70,220,.2))',
              border: '1px solid rgba(255,61,119,.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <span
              style={{
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                font: '600 13px/1.2 var(--font-sans)',
                color: '#FFFFFF',
              }}
            >
              👁 <span title={activeMember?.name}>{shortName(activeMember?.name)}</span>
            </span>
            <button
              type="button"
              onClick={() => onSelectMember && onSelectMember(currentMember?.id)}
              style={{
                flex: '0 0 auto',
                border: 'none',
                borderRadius: 8,
                background: 'rgba(255,255,255,.1)',
                color: GOLD,
                padding: '8px 10px',
                font: '600 12px/1 var(--font-sans)',
                cursor: 'pointer',
              }}
            >
              {t('badges.backToMyCollection')}
            </button>
          </div>
        )}

        {/* ═══ KHỐI 1: THẺ HỒ SƠ — hiệu ứng theo cấp ở nửa trên ═══ */}
        <div
          style={{
            position: 'relative',
            flex: '0 0 auto',
            borderRadius: 16,
            overflow: 'hidden',
            border: `1px solid ${levelRgba(0.55)}`,
            background: '#080615',
          }}
        >
          <TierBackdrop tier={levelTierKey} compact />

          {/* Avatar · tên · cấp · kệ · đã mở */}
          <div style={{ position: 'relative', padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                position: 'relative',
                width: 62,
                height: 68,
                flex: '0 0 auto',
                filter: `drop-shadow(0 0 16px ${levelRgba(0.5)})`,
              }}
            >
              <div style={{ position: 'absolute', inset: 0, clipPath: HEX_CLIP, background: levelRing }} />
              <div
                style={{
                  position: 'absolute',
                  inset: 2.5,
                  clipPath: HEX_CLIP,
                  background: levelFx.well,
                  display: 'grid',
                  placeItems: 'center',
                  font: "700 24px/1 'Oswald', sans-serif",
                  color: '#FFFFFF',
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

            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span
                  style={{
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    font: "700 22px/1.1 'Oswald', sans-serif",
                    letterSpacing: '.04em',
                    textTransform: 'uppercase',
                    color: '#FFFFFF',
                  }}
                >
                  {activeMember?.name || ''} {isViewingSelf ? `· ${t('badges.collectorProfile.rankMe')}` : ''}
                </span>
                <span
                  style={{
                    flex: '0 0 auto',
                    font: "700 11px/1 'Oswald', sans-serif",
                    letterSpacing: '.14em',
                    padding: '5px 9px',
                    borderRadius: 4,
                    background: levelRing,
                    color: '#04101A',
                  }}
                >
                  {t('badges.collectorProfile.level', { level })}
                </span>
              </div>
              <span style={{ font: '400 12px/1 var(--font-mono)', color: '#9A90AD' }}>{shelfBadges.length} / 3</span>
            </div>

            <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
              <span style={{ font: "700 26px/1 'Oswald', sans-serif", color: '#FFFFFF' }}>
                {unlockedCount} / {totalCount}
              </span>
              <span style={{ font: "600 10px/1 'Oswald', sans-serif", letterSpacing: '.14em', color: '#8E83A8' }}>
                {t('badges.openedStatus').toUpperCase()}
              </span>
            </div>
          </div>

          {/* Nửa dưới trên nền tối: châm ngôn · tiến độ cấp · 3 chỉ số */}
          <div
            style={{
              position: 'relative',
              marginTop: 6,
              padding: '12px 16px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              background: 'linear-gradient(180deg,transparent,rgba(6,4,16,.92) 30%)',
            }}
          >
            {isViewingSelf ? (
              <button
                type="button"
                onClick={() => onEditSignature && onEditSignature()}
                title={t('badges.signatureModal.title')}
                style={{ ...signaturePill, cursor: 'pointer', color: activeMember?.signature ? GOLD : '#A899C5' }}
              >
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  “{activeMember?.signature || t('badges.collectorProfile.notSelected')}”
                </span>
                <span style={{ fontStyle: 'normal', color: GOLD }}>✎</span>
              </button>
            ) : activeMember?.signature ? (
              <span style={{ ...signaturePill, color: GOLD }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  “{activeMember.signature}”
                </span>
              </span>
            ) : null}

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  font: "700 11px/1.2 'Oswald', sans-serif",
                  letterSpacing: '.16em',
                  color: levelFx.acc,
                }}
              >
                {t('badges.collectorProfile.nextLevelTitle', { nextLevel })}
              </span>
              <span style={{ flex: '0 0 auto', font: '500 12px/1 var(--font-mono)', color: '#C9BFDC' }}>
                {currentXp.toLocaleString('vi-VN')} / {nextLevelXp.toLocaleString('vi-VN')} XP
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,.1)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${levelPct}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: `linear-gradient(90deg,${levelFx.mid},${levelFx.acc})`,
                  transition: 'width 320ms cubic-bezier(.2,.8,.2,1)',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              {stats.map((s) => (
                <div
                  key={s.key}
                  style={{
                    minWidth: 0,
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: s.bg,
                    borderTop: `2px solid ${s.color}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <span style={{ font: "700 10px/1.2 'Oswald', sans-serif", letterSpacing: '.14em', color: s.ink }}>{s.label}</span>
                  <span style={{ font: "700 22px/1 'Oswald', sans-serif", color: '#FFFFFF' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ KHỐI 2: KỆ DANH HIỆU (3 ô) ═══ */}
        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 3, height: 16, flex: '0 0 auto', background: 'linear-gradient(180deg,#FF3D77,#8E4CF5)' }} />
            <span style={SECTION_TITLE}>{t('badges.myShelfTitle')}</span>
            <span style={COUNT_MONO}>{shelfBadges.length} / 3</span>
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
                    } else if (isViewingSelf && onReorderShelf) {
                      onReorderShelf()
                    }
                  }}
                  style={{
                    minWidth: 0,
                    padding: '12px 6px 10px',
                    borderRadius: 12,
                    background: hasBadge ? '#120A24' : 'rgba(255,255,255,.025)',
                    border: hasBadge ? '1px solid rgba(246,201,69,.55)' : '1px dashed #2E2447',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                  }}
                >
                  {hasBadge ? (
                    <BadgeHex tier={b.tier} glyph={b.glyph} size={54} />
                  ) : (
                    <span
                      style={{
                        width: 50,
                        height: 54,
                        clipPath: HEX_CLIP,
                        background: '#1A1430',
                        display: 'grid',
                        placeItems: 'center',
                        font: '500 18px/1 var(--font-display)',
                        color: '#5A4E78',
                      }}
                    >
                      +
                    </span>
                  )}
                  <span
                    style={{
                      maxWidth: '100%',
                      font: `${hasBadge ? 600 : 500} 12px/1.2 var(--font-sans)`,
                      color: hasBadge ? '#FFFFFF' : '#6B6188',
                      textAlign: 'center',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {bName}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ═══ KHỐI 2.5: KHO HUY HIỆU ĐÃ MỞ ═══ */}
        <div
          style={{
            flex: '0 0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: 14,
            borderRadius: 14,
            background: 'linear-gradient(150deg,rgba(246,201,69,.07),rgba(255,255,255,.015))',
            border: '1px solid rgba(246,201,69,.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...SECTION_TITLE, flex: 1, minWidth: 0, color: GOLD }}>{t('badges.unlockedVaultTitle')}</span>
            <span style={{ ...COUNT_MONO, color: '#C9BFDC' }}>
              {unlockedShowcaseBadges.length} · {collectionScore} pts
            </span>
          </div>

          {unlockedShowcaseBadges.length === 0 ? (
            <span style={{ font: 'italic 400 12px/1.4 var(--font-sans)', color: '#8E83A8' }}>
              {t('badges.unlockedVaultEmpty')}
            </span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {unlockedShowcaseBadges.map((badge) => {
                const bFx = TIER_FX[badge.tier] || TIER_FX.rare
                return (
                  <div
                    key={badge.id}
                    onClick={() => onSelectBadge && onSelectBadge(badge)}
                    style={{
                      flex: '0 0 auto',
                      width: 96,
                      padding: '12px 6px 10px',
                      borderRadius: 12,
                      background: '#120A24',
                      border: `1px solid rgba(${bFx.rgb},.5)`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <BadgeHex tier={badge.tier} glyph={badge.glyph} size={48} />
                    <span
                      style={{
                        width: '100%',
                        font: '600 11px/1.2 var(--font-sans)',
                        color: '#FFFFFF',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {t(`badges.items.${badge.id}.name`, { defaultValue: badge.name || '' })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ═══ KHỐI 3: BỘ LỌC LOẠI + NHÓM ĐANG CHỌN ═══ */}
        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
            {[
              { id: 'all', label: t('badges.filterKindAll') },
              { id: 'family', label: t('badges.filterKindFamily') },
              { id: 'solo', label: t('badges.filterKindSolo') },
            ].map((k) => {
              const isActive = filterKind === k.id
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setFilterKind(k.id)}
                  style={{
                    minWidth: 0,
                    padding: '11px 4px',
                    border: 'none',
                    cursor: 'pointer',
                    font: "700 11px/1 'Oswald', sans-serif",
                    letterSpacing: '.1em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    background: isActive ? 'linear-gradient(90deg,#7A4DFF,#3FC8FF)' : 'rgba(255,255,255,.05)',
                    color: isActive ? '#050A1A' : '#8E83A8',
                    clipPath: isActive ? TAB_CLIP : undefined,
                    transition: 'background 140ms cubic-bezier(.2,.8,.2,1), color 140ms cubic-bezier(.2,.8,.2,1)',
                  }}
                >
                  {k.label}
                </button>
              )
            })}
          </div>

          {activeGroup && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...SECTION_TITLE, minWidth: 0 }}>
                  {t(`badges.groups.${activeGroup.key || activeGroup.id}`, { defaultValue: activeGroup.title || activeGroup.name || '' })}
                </span>
                <span style={{ ...COUNT_CHIP, background: 'rgba(120,70,220,.3)', color: '#C8A8F0' }}>
                  {activeGroup.badges?.filter((b) => b.unlocked || b.highestUnlocked).length || 0} / {activeGroup.badges?.length || 0}
                </span>
              </div>

              {/* Phân loại các badges trong nhóm theo filterKind */}
              {(() => {
                const allBadges = activeGroup.badges || []
                const filtered = allBadges.filter((b) => {
                  if (filterKind === 'family' && !b.isFamily) return false
                  if (filterKind === 'solo' && b.isFamily) return false
                  return true
                })
                const famBadges = sortBadgesByRarity(filtered.filter((b) => b.isFamily))
                const solBadges = sortBadgesByRarity(filtered.filter((b) => !b.isFamily))

                if (filtered.length === 0) {
                  return (
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        background: 'rgba(255,255,255,.025)',
                        border: '1px dashed #2E2447',
                        font: 'italic 400 12px/1.4 var(--font-sans)',
                        color: '#8E83A8',
                      }}
                    >
                      {t('badges.noBadgesMatch')}
                    </div>
                  )
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {famBadges.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {filterKind === 'all' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ minWidth: 0, font: '600 12px/1.2 var(--font-sans)', letterSpacing: '.06em', color: '#8E83A8' }}>
                              {t('badges.sectionFamilyTitle')}
                            </span>
                            <span style={{ ...COUNT_CHIP, padding: '3px 7px', background: 'rgba(255,255,255,.07)', color: '#C9BFDC' }}>
                              {famBadges.length}
                            </span>
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                          {famBadges.map(renderBadgeItem)}
                        </div>
                      </div>
                    )}

                    {solBadges.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {filterKind === 'all' && famBadges.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                            <span style={{ ...SECTION_TITLE, minWidth: 0 }}>{t('badges.sectionSoloTitle')}</span>
                            <span style={{ ...COUNT_CHIP, background: 'rgba(255,122,61,.2)', color: '#FFB38A' }}>
                              {solBadges.length}
                            </span>
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                          {solBadges.map(renderBadgeItem)}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </>
          )}
        </div>

        {/* ═══ KHỐI 4: CÁC NHÓM DANH HIỆU KHÁC ═══ */}
        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'linear-gradient(150deg,rgba(255,255,255,.045),rgba(255,255,255,.015))',
                  border: '1px solid #221A3A',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    font: "700 13px/1.2 'Oswald', sans-serif",
                    letterSpacing: '.12em',
                    textTransform: 'uppercase',
                    color: '#FFFFFF',
                  }}
                >
                  {t(`badges.groups.${g.key || g.id}`, { defaultValue: g.title || g.name || '' })}
                </span>
                <span style={{ ...COUNT_CHIP, background: 'rgba(120,70,220,.3)', color: '#C8A8F0' }}>
                  {openedInGroup} / {totalInGroup}
                </span>
                <span style={{ font: '400 14px/1 var(--font-mono)', color: '#8E83A8' }}>›</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
