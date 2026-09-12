import cfgBadges from '#config/badges.json' with { type: 'json' }
import { isPresent } from '#lib/money.js'
import { countInvitedBy, monthsSince } from '#lib/xp.js'

/**
 * ĐỘNG CƠ DANH HIỆU & TREO THƯỞNG (BADGES & BOUNTY ENGINE)
 * Toàn bộ là hàm thuần (pure functions), không phụ thuộc React, không gọi Supabase.
 */

export const ANIME_FONTS = {
  display: 'Oswald, sans-serif',
  ui: "'Be Vietnam Pro', sans-serif",
  mono: "'IBM Plex Mono', monospace",
}

export const ANIME_TIERS = {
  legend: {
    key: 'legend',
    name: cfgBadges.tiers?.legend?.name || 'LEGEND',
    note: cfgBadges.tiers?.legend?.note || 'ring · aura',
    pts: cfgBadges.tierPoints.legend ?? 120,
    ring: 'conic-gradient(from 200deg,#FF2E7E,#FF7A18,#FFE24B,#FFFFFF,#FF7A18,#FF2E7E)',
    core: 'radial-gradient(120% 120% at 50% 8%,#4A0718,#140109 72%)',
    ink: '#FFC46B',
    g1: '#FFFBEA',
    g2: '#FFB03A',
    g3: '#FF2E7E',
    edge: 'linear-gradient(135deg,#FF2E7E,#FFE24B 70%)',
    bd: '#FF2E7E',
    panel: 'linear-gradient(160deg,#2B0617,#110208)',
    chipBg: 'rgba(255,46,126,.18)',
    aura: 'rgba(255,46,126,.55)',
    spin: true,
  },
  epic: {
    key: 'epic',
    name: cfgBadges.tiers?.epic?.name || 'EPIC',
    note: cfgBadges.tiers?.epic?.note || 'purple · pulse',
    pts: cfgBadges.tierPoints.epic ?? 60,
    ring: 'conic-gradient(from 200deg,#6D14FF,#C04BFF,#FF6BE0,#FFFFFF,#C04BFF,#6D14FF)',
    core: 'radial-gradient(120% 120% at 50% 8%,#2C0658,#10021F 72%)',
    ink: '#D9A8FF',
    g1: '#FBF0FF',
    g2: '#C878FF',
    g3: '#6D14FF',
    edge: 'linear-gradient(135deg,#6D14FF,#FF6BE0 70%)',
    bd: '#8B2BFF',
    panel: 'linear-gradient(160deg,#1E0740,#0E0220)',
    chipBg: 'rgba(139,43,255,.18)',
    aura: 'rgba(192,75,255,.45)',
  },
  elite: {
    key: 'elite',
    name: cfgBadges.tiers?.elite?.name || 'ELITE',
    note: cfgBadges.tiers?.elite?.note || 'blue · blade',
    pts: cfgBadges.tierPoints.elite ?? 30,
    ring: 'conic-gradient(from 200deg,#0B63FF,#2EE9FF,#D6FEFF,#FFFFFF,#2EE9FF,#0B63FF)',
    core: 'radial-gradient(120% 120% at 50% 8%,#032C5E,#01101F 72%)',
    ink: '#7FE7FF',
    g1: '#EEFDFF',
    g2: '#55D8FF',
    g3: '#0B63FF',
    edge: 'linear-gradient(135deg,#0B63FF,#2EE9FF 70%)',
    bd: '#1B7BE0',
    panel: 'linear-gradient(160deg,#07203F,#020C1B)',
    chipBg: 'rgba(46,233,255,.14)',
    aura: 'rgba(46,233,255,.42)',
  },
  rare: {
    key: 'rare',
    name: cfgBadges.tiers?.rare?.name || 'RARE',
    note: cfgBadges.tiers?.rare?.note || 'teal · emblem',
    pts: cfgBadges.tierPoints.rare ?? 15,
    ring: 'conic-gradient(from 200deg,#00776B,#2EE9C0,#E3FFF8,#FFFFFF,#2EE9C0,#00776B)',
    core: 'radial-gradient(120% 120% at 50% 8%,#02332C,#01130F 72%)',
    ink: '#5FEBD0',
    g1: '#F0FFFB',
    g2: '#35D8BC',
    g3: '#00776B',
    edge: 'linear-gradient(135deg,#00776B,#2EE9C0 70%)',
    bd: '#0E9F8E',
    panel: 'linear-gradient(160deg,#042925,#010F0D)',
    chipBg: 'rgba(46,233,192,.14)',
    aura: 'rgba(46,233,192,.38)',
  },
  fun: {
    key: 'fun',
    name: cfgBadges.tiers?.fun?.name || 'FUN',
    note: cfgBadges.tiers?.fun?.note || 'gold · 0 pts',
    pts: cfgBadges.tierPoints.fun ?? 0,
    ring: 'conic-gradient(from 200deg,#B77400,#FFE24B,#FFF9D6,#FFFFFF,#FFE24B,#B77400)',
    core: 'radial-gradient(120% 120% at 50% 8%,#3A2600,#140D00 72%)',
    ink: '#FFD95E',
    g1: '#FFFDF0',
    g2: '#FFD03A',
    g3: '#B77400',
    edge: 'linear-gradient(135deg,#B77400,#FFE24B 70%)',
    bd: '#C98E12',
    panel: 'linear-gradient(160deg,#2A1D02,#120C00)',
    chipBg: 'rgba(255,226,75,.14)',
    aura: 'rgba(255,226,75,.36)',
  },
  hidden: {
    key: 'hidden',
    name: cfgBadges.tiers?.hidden?.name || 'HIDDEN',
    note: cfgBadges.tiers?.hidden?.note || '??? until unlocked',
    pts: cfgBadges.tierPoints.hidden ?? 0,
    ring: 'repeating-conic-gradient(from 0deg,#3B2560 0deg 12deg,#160B26 12deg 24deg)',
    core: 'radial-gradient(120% 120% at 50% 8%,#1B1030,#0A0514 72%)',
    ink: '#9C8ABE',
    g1: '#6B5C8C',
    g2: '#4A3B6B',
    g3: '#2A1B45',
    edge: 'linear-gradient(135deg,#3B2560,#6B5C8C 70%)',
    bd: '#3B2560',
    panel: 'linear-gradient(160deg,#150C24,#0A0512)',
    chipBg: 'rgba(107,92,140,.16)',
    aura: 'rgba(107,92,140,.28)',
    dim: true,
  },
}

export const ANIME_GLYPHS = {
  flame: 'polygon(50% 0%,72% 26%,62% 40%,84% 34%,74% 62%,92% 76%,50% 100%,8% 76%,26% 62%,16% 34%,38% 40%,28% 26%)',
  shuriken: 'polygon(50% 0%,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0% 50%,39% 39%)',
  wing: 'polygon(0% 100%,10% 52%,36% 62%,42% 26%,68% 40%,76% 6%,100% 22%,64% 96%)',
  crystal: 'polygon(50% 0%,100% 34%,74% 100%,26% 100%,0% 34%)',
  thunder: 'polygon(58% 0%,14% 56%,44% 56%,32% 100%,86% 40%,52% 40%)',
  horn: 'polygon(0% 100%,4% 18%,26% 54%,50% 0%,74% 54%,96% 18%,100% 100%,76% 74%,50% 88%,24% 74%)',
  moon: 'polygon(50% 0%,86% 16%,100% 50%,86% 84%,50% 100%,72% 78%,78% 50%,72% 22%)',
  fang: 'polygon(14% 0%,86% 0%,74% 40%,58% 100%,50% 56%,42% 100%,26% 40%)',
  eye: 'polygon(0% 50%,26% 16%,50% 6%,74% 16%,100% 50%,74% 84%,50% 94%,26% 84%)',
  blossom: 'polygon(50% 2%,68% 20%,92% 20%,88% 46%,98% 72%,72% 78%,50% 98%,28% 78%,2% 72%,12% 46%,8% 20%,32% 20%)',
  skull: 'polygon(20% 0%,80% 0%,100% 24%,100% 56%,78% 68%,80% 100%,62% 84%,50% 100%,38% 84%,20% 100%,22% 68%,0% 56%,0% 24%)',
}

export const HEX_CLIP = 'polygon(50% 0%,95% 25%,95% 75%,50% 100%,5% 75%,5% 25%)'
export const NOTCH_CLIP = 'polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)'
export const NOTCH_S_CLIP = 'polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)'
export const NOTCH_XS_CLIP = 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)'

/** Lấy thông tin các nhóm danh hiệu */
export function getBadgeGroups() {
  return cfgBadges.groups.map((g) => ({
    id: g.id,
    key: g.key,
    tone: g.tone,
  }))
}

/** Lấy danh sách 6 bậc phẩm cấp */
export function getBadgeTiers() {
  return Object.values(ANIME_TIERS)
}

/**
 * Tính chuỗi thắng hiện tại của một thành viên trong mùa giải đang diễn ra.
 * @param {string} memberId
 * @param {Object} db
 * @returns {{ streak: number, maxStreak: number, matches: Array }}
 */
export function getMemberStreak(memberId, db) {
  if (!memberId || !db) return { streak: 0, maxStreak: 0, matches: [] }
  const matches = (db.matches || [])
    .filter((mt) => mt.ratingEnabled !== false)
    .filter((mt) => (mt.teamA || []).includes(memberId) || (mt.teamB || []).includes(memberId))
    .sort((a, b) => (b.at || 0) - (a.at || 0))

  let streak = 0
  let broken = false
  let maxStreak = 0
  let curRunning = 0

  // Duyệt từ cũ tới mới để tìm maxStreak
  const asc = matches.slice().reverse()
  asc.forEach((mt) => {
    const inA = (mt.teamA || []).includes(memberId)
    const inB = (mt.teamB || []).includes(memberId)
    const won = (inA && mt.winnerTeam === 'A') || (inB && mt.winnerTeam === 'B')
    if (won) {
      curRunning++
      if (curRunning > maxStreak) maxStreak = curRunning
    } else {
      curRunning = 0
    }
  })

  // Duyệt từ mới nhất để tìm streak đang chạy
  for (const mt of matches) {
    const inA = (mt.teamA || []).includes(memberId)
    const inB = (mt.teamB || []).includes(memberId)
    const won = (inA && mt.winnerTeam === 'A') || (inB && mt.winnerTeam === 'B')
    if (won && !broken) {
      streak++
    } else {
      broken = true
    }
  }

  return { streak, maxStreak, matches }
}

/**
 * Tính chuỗi thắng của một cặp đôi khi đánh cùng nhau.
 * Kết quả khi đánh với partner khác không làm ảnh hưởng chuỗi cặp này.
 * @param {string} m1
 * @param {string} m2
 * @param {Object} db
 * @returns {{ streak: number, totalPlayed: number, wins: number }}
 */
export function getPairStreak(m1, m2, db) {
  if (!m1 || !m2 || !db) return { streak: 0, totalPlayed: 0, wins: 0 }
  const pairMatches = (db.matches || [])
    .filter((mt) => mt.ratingEnabled !== false)
    .filter((mt) => {
      const inA = (mt.teamA || []).includes(m1) && (mt.teamA || []).includes(m2)
      const inB = (mt.teamB || []).includes(m1) && (mt.teamB || []).includes(m2)
      return inA || inB
    })
    .sort((a, b) => (b.at || 0) - (a.at || 0))

  let streak = 0
  let broken = false
  let wins = 0

  pairMatches.forEach((mt) => {
    const inA = (mt.teamA || []).includes(m1) && (mt.teamA || []).includes(m2)
    const inB = (mt.teamB || []).includes(m1) && (mt.teamB || []).includes(m2)
    const won = (inA && mt.winnerTeam === 'A') || (inB && mt.winnerTeam === 'B')
    if (won) wins++
    if (won && !broken) {
      streak++
    } else {
      broken = true
    }
  })

  return { streak, totalPlayed: pairMatches.length, wins }
}

/**
 * Tạo danh sách 10 ô W/L theo dõi chuỗi trận trực quan của một thành viên (Màn A2).
 * @param {string} memberId
 * @param {Object} db
 * @param {number} maxSlots
 * @returns {Array<{ label: string, won: boolean, current: boolean }>}
 */
export function getStreakTimeline(memberId, db, maxSlots = 10) {
  const { streak } = getMemberStreak(memberId, db)
  const result = []
  for (let i = 0; i < maxSlots; i++) {
    if (i < streak) {
      result.push({ label: 'W', won: true, current: i === streak - 1 })
    } else {
      result.push({ label: String(i + 1), won: false, current: false })
    }
  }
  return result
}

export const generateStreakTimeline = (memberIdOrMatches, dbOrMemberId, maxSlots = 10) => {
  const mid = typeof memberIdOrMatches === 'string' ? memberIdOrMatches : dbOrMemberId
  const database = typeof memberIdOrMatches === 'string' ? dbOrMemberId : (typeof dbOrMemberId === 'object' ? dbOrMemberId : {})
  return getStreakTimeline(mid, database, maxSlots)
}

/**
 * Quét toàn bộ mục tiêu đang bị treo thưởng (Bounty Targets) trong CLB.
 * Cá nhân: chuỗi >= 5 (hoặc config)
 * Cặp đôi: chuỗi >= 4 khi đánh cùng nhau
 * @param {Object} db
 * @returns {Array<Object>}
 */
export function getActiveBounties(db) {
  if (!db) return []
  const minSingle = cfgBadges.bounty?.minStreakSingle ?? 5
  const minPair = cfgBadges.bounty?.minStreakPair ?? 4
  const hotStreak = cfgBadges.bounty?.hotStreak ?? 6
  const rewHot = cfgBadges.bounty?.rewardHot ?? { xp: 100, seasonPts: 15 }
  const rewNorm = cfgBadges.bounty?.rewardNormal ?? { xp: 80, seasonPts: 12 }

  const members = db.members || []
  const matches = db.matches || []
  const bounties = []

  // 1. Quét cá nhân
  members.forEach((m) => {
    const { streak } = getMemberStreak(m.id, db)
    if (streak >= minSingle) {
      const hot = streak >= hotStreak
      const rew = hot ? rewHot : rewNorm
      // Đếm số trận đối thủ đã cố gắng hạ người này trong chuỗi
      const myMatches = matches
        .filter((mt) => (mt.teamA || []).includes(m.id) || (mt.teamB || []).includes(m.id))
        .sort((a, b) => (b.at || 0) - (a.at || 0))
      const streakMatches = myMatches.slice(0, streak)
      const triesCount = streakMatches.reduce((acc, mt) => {
        const opps = (mt.teamA || []).includes(m.id) ? (mt.teamB || []) : (mt.teamA || [])
        return acc + opps.length
      }, 0)

      bounties.push({
        id: `single_${m.id}`,
        type: 'single',
        targetId: m.id,
        name: m.name,
        avatarUrl: m.avatar_url || m.avatarUrl || '',
        meta: `${streak} wins streak`,
        streak,
        hot,
        tier: hot ? 'legend' : 'epic',
        glyph: hot ? 'flame' : 'thunder',
        xp: rew.xp,
        sp: rew.seasonPts,
        tries: triesCount,
        pct: `${streak} / 10`,
      })
    }
  })

  // 2. Quét các cặp đôi thường đánh chung
  const pairMap = new Map()
  matches.forEach((mt) => {
    if (mt.teamA?.length === 2) {
      const [p1, p2] = mt.teamA.slice().sort()
      pairMap.set(`${p1}_${p2}`, [p1, p2])
    }
    if (mt.teamB?.length === 2) {
      const [p1, p2] = mt.teamB.slice().sort()
      pairMap.set(`${p1}_${p2}`, [p1, p2])
    }
  })

  pairMap.forEach(([m1, m2]) => {
    const { streak, totalPlayed, wins } = getPairStreak(m1, m2, db)
    if (streak >= minPair && totalPlayed >= minPair) {
      const mem1 = members.find((m) => m.id === m1)
      const mem2 = members.find((m) => m.id === m2)
      if (mem1 && mem2) {
        const hot = streak >= hotStreak
        const rew = hot ? rewHot : rewNorm
        const winRate = Math.round((wins / totalPlayed) * 100)
        bounties.push({
          id: `pair_${m1}_${m2}`,
          type: 'pair',
          targetIds: [m1, m2],
          name: `${mem1.name} & ${mem2.name}`,
          avatarUrl: mem1.avatar_url || mem1.avatarUrl || '',
          meta: `${winRate}% win rate`,
          streak,
          hot,
          tier: hot ? 'legend' : 'epic',
          glyph: hot ? 'flame' : 'thunder',
          xp: rew.xp,
          sp: rew.seasonPts,
          tries: streak,
          pct: `${streak} / 10`,
        })
      }
    }
  })

  // Fallback: nếu chưa ai đạt mốc chuỗi 5 (hoặc cặp 4), lấy người đang có chuỗi thắng dài nhất CLB hiện tại (>= 2)
  if (bounties.length === 0 && members.length > 0) {
    let topPlayer = null
    let maxS = 0
    members.forEach((m) => {
      const { streak } = getMemberStreak(m.id, db)
      if (streak > maxS) {
        maxS = streak
        topPlayer = m
      }
    })
    if (topPlayer && maxS >= 2) {
      const hot = maxS >= 4
      const rew = hot ? rewHot : rewNorm
      bounties.push({
        id: `single_${topPlayer.id}`,
        type: 'single',
        targetId: topPlayer.id,
        name: topPlayer.name,
        avatarUrl: topPlayer.avatar_url || topPlayer.avatarUrl || '',
        meta: `${maxS} wins streak`,
        streak: maxS,
        hot,
        tier: hot ? 'legend' : 'epic',
        glyph: hot ? 'flame' : 'thunder',
        xp: rew.xp,
        sp: rew.seasonPts,
        tries: maxS,
        pct: `${maxS} / 10`,
      })
    }
  }

  // Sắp xếp theo streak giảm dần, hot lên đầu
  return bounties.sort((a, b) => b.streak - a.streak)
}

/**
 * Đếm số buổi có mặt của thành viên trong CLB
 */
function countAttendedSessions(memberId, db) {
  if (!memberId || !db) return 0
  const sessions = db.sessions || []
  const attendance = db.attendance || {}
  let count = 0
  sessions.forEach((s) => {
    const attMap = attendance[s.id] || (typeof s.attendance === 'object' && !Array.isArray(s.attendance) ? s.attendance : {})
    if (isPresent(attMap[memberId])) {
      count++
    } else {
      const attendees = s.attendees || []
      if (attendees.some((a) => (typeof a === 'string' ? a === memberId : a.memberId === memberId))) {
        count++
      }
    }
  })
  return count
}

/**
 * Kiểm tra thành viên đã từng ngắt bounty chưa (được lưu trong metadata hoặc đếm qua match)
 */
function countBountiesBroken(memberId, db) {
  if (!memberId || !db) return 0
  const matches = db.matches || []
  let count = 0
  matches.forEach((mt) => {
    const inA = (mt.teamA || []).includes(memberId)
    const inB = (mt.teamB || []).includes(memberId)
    const won = (inA && mt.winnerTeam === 'A') || (inB && mt.winnerTeam === 'B')
    if (won && mt.bountyBroken) {
      count++
    }
  })
  return count
}

/**
 * Tính toán trạng thái của toàn bộ danh hiệu cho một thành viên.
 * @param {string} memberId
 * @param {Object} db
 * @returns {Object}
 */
export function calculateMemberBadges(memberId, db) {
  const member = (db?.members || []).find((m) => m.id === memberId)
  const catalog = cfgBadges.catalog || []
  const unlocked = []
  const inProgress = []
  const locked = []

  const { streak, maxStreak } = getMemberStreak(memberId, db)
  const sessionsCount = countAttendedSessions(memberId, db)
  const tenureMonths = monthsSince(member?.joinedAt, new Date())
  const guestsCount = countInvitedBy(db, memberId)
  const bountiesBrokenCount = countBountiesBroken(memberId, db)

  const shelfStored = member?.badgeShelf || member?.badge_shelf || member?.shelf || []

  const processed = catalog.map((badge) => {
    let currentVal = 0
    let isUnlocked = false
    let progressStr = ''
    let pct = 0

    switch (badge.checkType) {
      case 'win_streak':
        currentVal = Math.max(streak, maxStreak)
        isUnlocked = currentVal >= badge.threshold
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = Math.min(100, Math.round((currentVal / badge.threshold) * 100))
        break

      case 'sessions_count':
        currentVal = sessionsCount
        isUnlocked = currentVal >= badge.threshold
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = Math.min(100, Math.round((currentVal / badge.threshold) * 100))
        break

      case 'tenure_months':
        currentVal = tenureMonths
        isUnlocked = currentVal >= badge.threshold
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = Math.min(100, Math.round((currentVal / badge.threshold) * 100))
        break

      case 'guests_count':
        currentVal = guestsCount
        isUnlocked = currentVal >= badge.threshold
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = Math.min(100, Math.round((currentVal / badge.threshold) * 100))
        break

      case 'dues_clean_months':
        currentVal = Math.min(12, tenureMonths) // fallback
        isUnlocked = currentVal >= badge.threshold
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = Math.min(100, Math.round((currentVal / badge.threshold) * 100))
        break

      case 'bounty_break':
        currentVal = bountiesBrokenCount
        isUnlocked = currentVal >= badge.threshold
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = isUnlocked ? 100 : (currentVal > 0 ? 50 : 0)
        break

      case 'fun':
        isUnlocked = true
        progressStr = ''
        pct = 100
        break

      case 'hidden_comeback':
      case 'hidden_surprise_session':
      case 'hidden_duo_bond':
      case 'hidden_deuce_30':
        // Các danh hiệu ẩn: nếu đã unlock thì hiển thị, chưa thì giấu
        isUnlocked = !!member?.unlockedHidden?.includes(badge.id)
        progressStr = isUnlocked ? '' : '???'
        pct = isUnlocked ? 100 : 0
        break

      default:
        isUnlocked = false
        progressStr = ''
        pct = 0
    }

    const effectiveTier = isUnlocked && badge.revealedTier ? badge.revealedTier : badge.tier
    const tierMeta = ANIME_TIERS[effectiveTier] || ANIME_TIERS.rare

    const item = {
      ...badge,
      tier: effectiveTier,
      tierMeta,
      unlocked: isUnlocked,
      currentVal,
      progressStr,
      pct,
      glyph: badge.glyph || 'crystal',
    }

    if (isUnlocked) {
      unlocked.push(item)
    } else if (pct > 0 && badge.tier !== 'hidden') {
      inProgress.push(item)
    } else {
      locked.push(item)
    }

    return item
  })

  // Tính điểm sưu tập: chỉ tính các huy hiệu đã mở
  const collectionScore = unlocked.reduce((acc, b) => {
    return acc + (ANIME_TIERS[b.tier]?.pts || 0)
  }, 0)

  // Xây dựng 3 ô trên kệ
  let shelfBadges = shelfStored
    .map((id) => processed.find((b) => b.id === id))
    .filter(Boolean)

  // Nếu kệ chưa chọn đủ 3 ô, tự động lấy 3 huy hiệu có bậc cao nhất đã mở
  if (shelfBadges.length === 0 && unlocked.length > 0) {
    const tierOrder = { legend: 4, epic: 3, elite: 2, rare: 1, fun: 0, hidden: 0 }
    shelfBadges = unlocked
      .slice()
      .sort((a, b) => (tierOrder[b.tier] || 0) - (tierOrder[a.tier] || 0))
      .slice(0, cfgBadges.shelfSlots ?? 3)
  }

  return {
    all: processed,
    unlocked,
    inProgress,
    locked,
    collectionScore,
    shelfBadges,
    streak,
    maxStreak,
    sessionsCount,
    tenureMonths,
  }
}

/**
 * Lấy Bảng xếp hạng Người sưu tập (Collector Leaderboard - Màn A5)
 * @param {Object} db
 * @returns {Array<Object>}
 */
export function getCollectorLeaderboard(db) {
  if (!db) return []
  const members = db.members || []
  const list = members.map((m) => {
    const res = calculateMemberBadges(m.id, db)
    return {
      id: m.id,
      name: m.name,
      initial: m.name ? m.name.charAt(0).toUpperCase() : '?',
      signature: m.signature || '',
      count: res.unlocked.length,
      unlockedCount: res.unlocked.length,
      score: res.collectionScore,
      scoreFormatted: res.collectionScore.toLocaleString('vi-VN'),
      shelf: res.shelfBadges.map((b) => ({
        tier: b.tier,
        glyph: b.glyph,
      })),
    }
  })

  // Sắp xếp theo score giảm dần, sau đó theo số huy hiệu đã mở
  list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.unlockedCount - a.unlockedCount
  })

  return list.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }))
}

/**
 * Tìm 4 danh hiệu hiếm nhất CLB (tỷ lệ sở hữu thấp nhất - Màn A5)
 * @param {Object} db
 * @returns {Array<Object>}
 */
export function getRarestBadges(db) {
  if (!db) return []
  const members = db.members || []
  const totalMembers = Math.max(1, members.length)
  const catalog = cfgBadges.catalog || []

  // Đếm số người sở hữu từng danh hiệu
  const ownershipCount = new Map()
  catalog.forEach((b) => ownershipCount.set(b.id, 0))

  members.forEach((m) => {
    const { unlocked } = calculateMemberBadges(m.id, db)
    unlocked.forEach((b) => {
      ownershipCount.set(b.id, (ownershipCount.get(b.id) || 0) + 1)
    })
  })

  const scored = catalog
    .filter((b) => b.tier !== 'fun') // Loại tự phong
    .map((b) => {
      const count = ownershipCount.get(b.id) || 0
      const ratio = count / totalMembers
      return {
        id: b.id,
        tier: b.tier,
        glyph: b.glyph,
        count,
        own: count === 0 ? '0' : `${count} / ${totalMembers}`,
        ratio,
      }
    })

  // Sắp xếp tăng dần theo tỷ lệ sở hữu (hiếm nhất lên đầu)
  return scored.sort((a, b) => a.ratio - b.ratio).slice(0, 4)
}

/**
 * Tìm danh sách VĐV đã có danh hiệu này (Màn A2)
 * @param {string} badgeId
 * @param {Object} db
 * @returns {Array<Object>}
 */
export function getBadgeOwners(badgeId, db) {
  if (!badgeId || !db) return []
  const members = db.members || []
  const owners = []
  members.forEach((m) => {
    const { unlocked } = calculateMemberBadges(m.id, db)
    const found = unlocked.find((b) => b.id === badgeId)
    if (found) {
      owners.push({
        id: m.id,
        initial: m.name ? m.name.charAt(0).toUpperCase() : '?',
        name: m.name,
        note: 'unlocked',
        at: 'season',
      })
    }
  })
  return owners
}

/**
 * Tìm danh sách VĐV đang gần đạt danh hiệu này nhất (Màn A2 "Ai đang đuổi")
 * @param {string} badgeId
 * @param {string} currentUserId
 * @param {Object} db
 * @returns {Array<Object>}
 */
export function getBadgeChasers(badgeId, currentUserId, db) {
  if (!badgeId || !db) return []
  const members = db.members || []
  const chasers = []
  members.forEach((m) => {
    const { inProgress } = calculateMemberBadges(m.id, db)
    const found = inProgress.find((b) => b.id === badgeId)
    if (found) {
      chasers.push({
        id: m.id,
        name: m.name,
        isMe: m.id === currentUserId,
        val: String(found.currentVal),
        pct: found.pct,
      })
    }
  })

  return chasers
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4)
    .map((c, i) => ({ ...c, rank: i + 1 }))
}

const TIER_ORDER = {
  legend: 6,
  epic: 5,
  elite: 4,
  rare: 3,
  fun: 2,
  hidden: 1,
}

/**
 * Lấy danh hiệu cao nhất của thành viên để vinh danh (ví dụ trên bảng xếp hạng Elo)
 * @param {string} memberId
 * @param {Object} db
 * @returns {Object|null}
 */
export function getMemberHighestBadge(memberId, db) {
  if (!memberId || !db) return null
  const { unlocked } = calculateMemberBadges(memberId, db)
  if (!unlocked || unlocked.length === 0) return null

  return (
    unlocked.slice().sort((a, b) => {
      const tierDiff = (TIER_ORDER[b.tier] || 0) - (TIER_ORDER[a.tier] || 0)
      if (tierDiff !== 0) return tierDiff
      return (b.points || 0) - (a.points || 0)
    })[0] || null
  )
}

/**
 * Trích xuất Bảng tin Thành tích & Tương tác CLB (Achievement Feed)
 * Không hardcode chuỗi tiếng Việt; trả về dữ liệu cấu trúc kèm key i18n
 * @param {Object} db
 * @param {number} limit
 * @returns {Array<Object>}
 */
export function getClubAchievementFeed(db, limit = 20) {
  if (!db) return []
  const matches = (db.matches || []).slice()
  const members = db.members || []
  const memberMap = new Map(members.map((m) => [m.id, m]))
  const feed = []

  // 1. Quét các trận đấu để phát hiện ngắt chuỗi và trận đấu nghẹt thở
  matches.forEach((mt, idx) => {
    if (!mt || !mt.teamA || !mt.teamB) return
    const isFinished = mt.winnerTeam === 'A' || mt.winnerTeam === 'B'
    if (!isFinished) return

    const winners = mt.winnerTeam === 'A' ? mt.teamA : mt.teamB
    const losers = mt.winnerTeam === 'A' ? mt.teamB : mt.teamA
    const scoreStr = mt.scoreTeamA && mt.scoreTeamB ? `${mt.scoreTeamA} - ${mt.scoreTeamB}` : ''

    // Kiểm tra trận ngắt chuỗi / bounty breaker
    if (mt.bountyBroken || mt.brokenStreak) {
      const winnerName = (winners || []).map((id) => memberMap.get(id)?.name || id).join(' & ')
      const loserName = (losers || []).map((id) => memberMap.get(id)?.name || id).join(' & ')
      feed.push({
        id: `feed-bounty-${mt.id || idx}`,
        type: 'bounty_break',
        timestamp: mt.createdAt || mt.date || new Date().toISOString(),
        actorName: winnerName,
        targetName: loserName,
        streakBroken: mt.brokenStreak || 5,
        score: scoreStr,
        eventIcon: 'flame',
        color: '#FF2E7E',
      })
    }

    // Kiểm tra trận đấu nghẹt thở (Clutch win: cách biệt 1 hoặc 2 điểm ở tỷ số cao)
    const sA = Number(mt.scoreTeamA) || 0
    const sB = Number(mt.scoreTeamB) || 0
    const diff = Math.abs(sA - sB)
    if ((sA >= 20 || sB >= 20) && diff <= 2 && diff > 0) {
      const winnerName = (winners || []).map((id) => memberMap.get(id)?.name || id).join(' & ')
      const loserName = (losers || []).map((id) => memberMap.get(id)?.name || id).join(' & ')
      feed.push({
        id: `feed-clutch-${mt.id || idx}`,
        type: 'clutch_win',
        timestamp: mt.createdAt || mt.date || new Date().toISOString(),
        actorName: winnerName,
        targetName: loserName,
        score: `${sA} - ${sB}`,
        eventIcon: 'sword',
        color: '#00F5D4',
      })
    }
  })

  // 2. Quét các mốc chuỗi thắng hiện tại của các thành viên
  members.forEach((m) => {
    const { streak, maxStreak } = getMemberStreak(m.id, db)
    const st = Math.max(streak, maxStreak)
    if (st >= 5) {
      feed.push({
        id: `feed-streak-${m.id}`,
        type: 'streak_milestone',
        timestamp: new Date().toISOString(),
        actorName: m.name,
        streakCount: st,
        badgeNameKey: st >= 10 ? 'streak_10' : st >= 8 ? 'streak_8' : 'streak_5',
        eventIcon: 'trophy',
        color: '#FFE24B',
      })
    }

    // Mốc Elo
    const ratingObj = (db.playerRatings || {})[m.id]
    const elo = ratingObj?.displayRating || ratingObj?.rating || 0
    if (elo >= 1500) {
      feed.push({
        id: `feed-elo-${m.id}`,
        type: 'elo_milestone',
        timestamp: new Date().toISOString(),
        actorName: m.name,
        elo,
        eventIcon: 'crown',
        color: '#9D4EDD',
      })
    }
  })

  // Thêm demo feed nếu CLB chưa có sự kiện
  if (feed.length === 0 && cfgBadges.demoFeed) {
    return cfgBadges.demoFeed.slice(0, limit)
  }

  return feed.slice(0, limit)
}

/**
 * Tra cứu thông tin cấu hình danh hiệu theo ID
 * @param {string} badgeId
 * @returns {Object|null}
 */
export function getBadgeById(badgeId) {
  if (!badgeId) return null
  const all = (cfgBadges.catalog || [])
    .concat(cfgBadges.hunterBadges || [])
    .concat(cfgBadges.bountyBadges || [])
  return all.find((b) => b.id === badgeId) || null
}
