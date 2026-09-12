import cfgBadges from '#config/badges.json' with { type: 'json' }
import { isPresent, myDebtCounts } from '#lib/money.js'
import { countInvitedBy, monthsSince } from '#lib/xp.js'
import { seasonMatchesOf } from '#lib/season.js'

/**
 * ĐỘNG CƠ DANH HIỆU & TREO THƯỞNG (BADGES & BOUNTY ENGINE)
 * Toàn bộ là hàm thuần (pure functions), không phụ thuộc React, không gọi Supabase.
 */

export const TIER_ORDER = {
  legend: 6,
  epic: 5,
  elite: 4,
  rare: 3,
  fun: 2,
  hidden: 1,
}

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
 * Lấy timestamp chính xác của một trận đấu (epoch ms).
 * Hỗ trợ mọi định dạng: epoch number, ISO string, ended_at, playedAt, createdAt, hoặc ngày của buổi tập.
 * @param {Object} mt
 * @param {Object} [db]
 * @returns {number}
 */
export function getMatchTimestamp(mt, db) {
  if (!mt) return 0
  const raw = mt.at ?? mt.ended_at ?? mt.endedAt ?? mt.playedAt ?? mt.createdAt
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
  if (typeof raw === 'string') {
    const num = Number(raw)
    if (Number.isFinite(num) && num > 0) return num
    const parsed = Date.parse(raw)
    if (!isNaN(parsed)) return parsed
  }
  if (mt.sessionId && db && Array.isArray(db.sessions)) {
    const s = db.sessions.find((sess) => sess.id === mt.sessionId)
    if (s && s.date) {
      const parsedSess = Date.parse(s.date)
      if (!isNaN(parsedSess)) return parsedSess
    }
  }
  return 0
}

/**
 * Sắp xếp các trận đấu theo thứ tự giảm dần (mới nhất lên đầu).
 * Nếu cùng timestamp, trận ghi nhận sau (index lớn hơn trong mảng ban đầu) sẽ đứng trước.
 */
export function sortMatchesDesc(matches, db) {
  const indexed = (matches || []).map((m, idx) => ({ m, idx, ts: getMatchTimestamp(m, db) }))
  indexed.sort((a, b) => {
    const diff = b.ts - a.ts
    if (diff !== 0) return diff
    return b.idx - a.idx
  })
  return indexed.map((item) => item.m)
}

/**
 * Sắp xếp các trận đấu theo thứ tự tăng dần (cũ nhất lên đầu).
 * Nếu cùng timestamp, trận ghi nhận trước (index nhỏ hơn trong mảng ban đầu) sẽ đứng trước.
 */
export function sortMatchesAsc(matches, db) {
  const indexed = (matches || []).map((m, idx) => ({ m, idx, ts: getMatchTimestamp(m, db) }))
  indexed.sort((a, b) => {
    const diff = a.ts - b.ts
    if (diff !== 0) return diff
    return a.idx - b.idx
  })
  return indexed.map((item) => item.m)
}

/**
 * Tính chuỗi thắng hiện tại của một thành viên trong mùa giải đang diễn ra.
 * @param {string} memberId
 * @param {Object} db
 * @param {Object} [season]
 * @param {Array} [preloadedSeasonMatches]
 * @returns {{ streak: number, maxStreak: number, matches: Array }}
 */
export function getMemberStreak(memberId, db, season = null, preloadedSeasonMatches = null) {
  if (!memberId || !db) return { streak: 0, maxStreak: 0, matches: [] }
  const targetMatches = Array.isArray(preloadedSeasonMatches)
    ? preloadedSeasonMatches
    : seasonMatchesOf(db, season)
  const memberMatches = (targetMatches || [])
    .filter((mt) => mt.ratingEnabled !== false)
    .filter((mt) => mt.winnerTeam === 'A' || mt.winnerTeam === 'B') // C1: Trận chưa có tỷ số không tính là thua
    .filter((mt) => (mt.teamA || []).includes(memberId) || (mt.teamB || []).includes(memberId))

  const desc = sortMatchesDesc(memberMatches, db)
  const asc = sortMatchesAsc(memberMatches, db)

  let maxStreak = 0
  let curRunning = 0

  // Duyệt từ cũ tới mới để tìm maxStreak
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
  let streak = 0
  let broken = false
  for (const mt of desc) {
    const inA = (mt.teamA || []).includes(memberId)
    const inB = (mt.teamB || []).includes(memberId)
    const won = (inA && mt.winnerTeam === 'A') || (inB && mt.winnerTeam === 'B')
    if (won && !broken) {
      streak++
    } else {
      broken = true
    }
  }

  return { streak, maxStreak, matches: desc }
}

/**
 * Tính chuỗi thắng của một cặp đôi khi đánh cùng nhau.
 * Kết quả khi đánh với partner khác không làm ảnh hưởng chuỗi cặp này.
 * @param {string} m1
 * @param {string} m2
 * @param {Object} db
 * @param {Object} [season]
 * @param {Array} [preloadedSeasonMatches]
 * @returns {{ streak: number, totalPlayed: number, wins: number }}
 */
export function getPairStreak(m1, m2, db, season = null, preloadedSeasonMatches = null) {
  if (!m1 || !m2 || !db) return { streak: 0, totalPlayed: 0, wins: 0 }
  const targetMatches = Array.isArray(preloadedSeasonMatches)
    ? preloadedSeasonMatches
    : seasonMatchesOf(db, season)
  const pairMatches = (targetMatches || [])
    .filter((mt) => mt.ratingEnabled !== false)
    .filter((mt) => mt.winnerTeam === 'A' || mt.winnerTeam === 'B')
    .filter((mt) => {
      const inA = (mt.teamA || []).includes(m1) && (mt.teamA || []).includes(m2)
      const inB = (mt.teamB || []).includes(m1) && (mt.teamB || []).includes(m2)
      return inA || inB
    })

  const desc = sortMatchesDesc(pairMatches, db)

  let streak = 0
  let broken = false
  let wins = 0

  desc.forEach((mt) => {
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
 * @param {Object} [season]
 * @returns {Array<{ label: string, won: boolean, current: boolean }>}
 */
export function getStreakTimeline(memberId, db, maxSlots = 10, season = null) {
  const { streak } = getMemberStreak(memberId, db, season)
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

export const generateStreakTimeline = (memberIdOrMatches, dbOrMemberId, maxSlots = 10, season = null) => {
  const mid = typeof memberIdOrMatches === 'string' ? memberIdOrMatches : dbOrMemberId
  const database = typeof memberIdOrMatches === 'string' ? dbOrMemberId : (typeof dbOrMemberId === 'object' ? dbOrMemberId : {})
  return getStreakTimeline(mid, database, maxSlots, season)
}

/**
 * Quét toàn bộ mục tiêu đang bị treo thưởng (Bounty Targets) trong CLB.
 * Cá nhân: chuỗi >= 5 (hoặc config)
 * Cặp đôi: chuỗi >= 4 khi đánh cùng nhau
 * @param {Object} db
 * @param {Object} [season]
 * @returns {Array<Object>}
 */
export function getActiveBounties(db, season = null) {
  if (!db) return []
  const minSingle = cfgBadges.bounty?.minStreakSingle ?? 5
  const minPair = cfgBadges.bounty?.minStreakPair ?? 4
  const hotStreak = cfgBadges.bounty?.hotStreak ?? 6
  const rewHot = cfgBadges.bounty?.rewardHot ?? { xp: 100, seasonPts: 15 }
  const rewNorm = cfgBadges.bounty?.rewardNormal ?? { xp: 80, seasonPts: 12 }

  const members = (db.members || []).filter((m) => m.active !== false)
  const targetMatches = seasonMatchesOf(db, season)
  const bounties = []

  // 1. Quét cá nhân
  members.forEach((m) => {
    const { streak } = getMemberStreak(m.id, db, season, targetMatches)
    if (streak >= minSingle) {
      const hot = streak >= hotStreak
      const rew = hot ? rewHot : rewNorm
      // Đếm số trận đối thủ đã cố gắng hạ người này trong chuỗi
      const filteredMatches = targetMatches
        .filter((mt) => (mt.teamA || []).includes(m.id) || (mt.teamB || []).includes(m.id))
      const myMatches = sortMatchesDesc(filteredMatches, db)
      const streakMatches = myMatches.slice(0, streak)
      const triesCount = streakMatches.reduce((acc, mt) => {
        const opps = (mt.teamA || []).includes(m.id) ? (mt.teamB || []) : (mt.teamA || [])
        return acc + opps.length
      }, 0)

      let streakDate = ''
      if (streakMatches.length > 0) {
        const oldestInStreak = streakMatches[streakMatches.length - 1]
        const ts = getMatchTimestamp(oldestInStreak, db)
        if (ts > 0) {
          const d = new Date(ts)
          const dd = String(d.getDate()).padStart(2, '0')
          const mm = String(d.getMonth() + 1).padStart(2, '0')
          streakDate = `${dd}/${mm}`
        }
      }

      bounties.push({
        id: `single_${m.id}`,
        type: 'single',
        targetId: m.id,
        name: m.name,
        avatarUrl: m.avatar_url || m.avatarUrl || '',
        streakDate,
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
  targetMatches.forEach((mt) => {
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
    const { streak, totalPlayed, wins } = getPairStreak(m1, m2, db, season, targetMatches)
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
          winRate,
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

  // Sắp xếp theo streak giảm dần, hot lên đầu (không có fallback 2 để tránh loãng dữ liệu)
  return bounties.sort((a, b) => b.streak - a.streak)
}

/**
 * Đếm số buổi có mặt của thành viên trong CLB
 */
function countAttendedSessions(memberId, db) {
  if (!memberId || !db) return 0
  const sessions = (db.sessions || []).filter((s) => s.status !== 'cancelled' && s.status !== 'draft')
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
 * @param {string} memberId
 * @param {Object} db
 * @param {boolean} [distinct=false]
 * @param {Array} [matchesPool=null] - Nếu có thì đếm trên matchesPool (theo mùa), không thì all-time
 * @returns {number}
 */
function countBountiesBroken(memberId, db, distinct = false, matchesPool = null) {
  if (!memberId || !db) return 0
  const matches = Array.isArray(matchesPool) ? matchesPool : (db.matches || [])
  if (!distinct) {
    let count = 0
    matches.forEach((mt) => {
      const isBroken = mt.bountyBroken || mt.bounty_broken
      if (!isBroken) return
      const inA = (mt.teamA || []).includes(memberId)
      const inB = (mt.teamB || []).includes(memberId)
      const won = (inA && mt.winnerTeam === 'A') || (inB && mt.winnerTeam === 'B')
      if (won) {
        count++
      }
    })
    return count
  }

  const distinctVictims = new Set()
  matches.forEach((mt) => {
    const isBroken = mt.bountyBroken || mt.bounty_broken
    if (!isBroken) return
    const inA = (mt.teamA || []).includes(memberId)
    const inB = (mt.teamB || []).includes(memberId)
    const won = (inA && mt.winnerTeam === 'A') || (inB && mt.winnerTeam === 'B')
    if (won) {
      const losers = mt.winnerTeam === 'A' ? (mt.teamB || []) : (mt.teamA || [])
      losers.forEach((victimId) => distinctVictims.add(victimId))
    }
  })
  return distinctVictims.size
}

/**
 * Tính toán trạng thái của toàn bộ danh hiệu cho một thành viên.
 * @param {string} memberId
 * @param {Object} db
 * @param {Object} [season]
 * @param {Array} [preloadedSeasonMatches]
 * @returns {Object}
 */
export function calculateMemberBadges(memberId, db, season = null, preloadedSeasonMatches = null) {
  const member = (db?.members || []).find((m) => m.id === memberId)
  // Chỉ gộp catalog với bountyBadges; hunterBadges chỉ là metadata hiển thị cho tab Bounty
  const catalog = (cfgBadges.catalog || []).concat(cfgBadges.bountyBadges || [])
  const unlocked = []
  const inProgress = []
  const locked = []

  const allSeasonMatches = Array.isArray(preloadedSeasonMatches)
    ? preloadedSeasonMatches
    : (seasonMatchesOf(db, season) || [])

  const { streak, maxStreak } = getMemberStreak(memberId, db, season, allSeasonMatches)
  const sessionsCount = countAttendedSessions(memberId, db)
  // C4: Thâm niên dừng lại nếu đã ngừng sinh hoạt (active === false)
  const joinDate = member?.joined || member?.joinedAt
  const tenureMonths =
    member?.active === false
      ? monthsSince(joinDate, member?.leftAt || member?.updatedAt || joinDate)
      : monthsSince(joinDate, new Date())
  const guestsCount = countInvitedBy(db, memberId)
  // Đếm bounty ngắt được TRONG MÙA GIẢI ĐANG XÉT
  const bountiesBrokenCount = countBountiesBroken(memberId, db, false, allSeasonMatches)
  const bountiesBrokenDistinctCount = countBountiesBroken(memberId, db, true, allSeasonMatches)

  // D2: Chuẩn hóa đọc badgeShelf và badge_shelf, bỏ shelf rác
  const shelfStored = member?.badgeShelf || member?.badge_shelf || []

  // Thống kê chuyên sâu từ dữ liệu trận đấu mùa giải
  const memberMatches = allSeasonMatches.filter(
    (mt) => mt.ratingEnabled !== false && ((mt.teamA || []).includes(memberId) || (mt.teamB || []).includes(memberId))
  )
  const wonMatches = memberMatches.filter((mt) => {
    const inA = (mt.teamA || []).includes(memberId)
    const inB = (mt.teamB || []).includes(memberId)
    return (inA && mt.winnerTeam === 'A') || (inB && mt.winnerTeam === 'B')
  })
  const totalWins = wonMatches.length

  // Thống kê Upset Elo
  let maxUpsetGap = 0
  const upsetWinsGaps = []
  wonMatches.forEach((mt) => {
    const inA = (mt.teamA || []).includes(memberId)
    const ra = Number(mt.initialRatingA || 0)
    const rb = Number(mt.initialRatingB || 0)
    const myR = inA ? ra : rb
    const oppR = inA ? rb : ra
    const gap = oppR - myR
    if (gap > 0) {
      upsetWinsGaps.push(gap)
      if (gap > maxUpsetGap) maxUpsetGap = gap
    }
  })

  // Thống kê trận 3 set
  const threeSetWinsCount = wonMatches.filter((mt) => Array.isArray(mt.sets) && mt.sets.length >= 3).length

  // Thống kê điểm đối thủ thấp nhất trong set thắng
  let minOpponentScoreInWinSet = 21
  wonMatches.forEach((mt) => {
    if (!Array.isArray(mt.sets)) return
    const inA = (mt.teamA || []).includes(memberId)
    mt.sets.forEach((set) => {
      if (!Array.isArray(set) || set.length < 2) return
      const sA = Number(set[0]), sB = Number(set[1])
      const myS = inA ? sA : sB
      const oppS = inA ? sB : sA
      if (myS > oppS && oppS < minOpponentScoreInWinSet) {
        minOpponentScoreInWinSet = oppS
      }
    })
  })

  // Thống kê chuỗi đôi tốt nhất
  let bestPairStreak = 0
  const partners = new Set()
  wonMatches.forEach((mt) => {
    const team = (mt.teamA || []).includes(memberId) ? mt.teamA : mt.teamB
    ;(team || []).forEach((pid) => {
      if (pid && pid !== memberId) partners.add(pid)
    })
  })
  partners.forEach((partnerId) => {
    const { streak: pStr } = getPairStreak(memberId, partnerId, db, season, allSeasonMatches)
    if (pStr > bestPairStreak) bestPairStreak = pStr
  })

  // Thống kê buổi tập
  const sessionWinsMap = new Map()
  const sessionTotalMap = new Map()
  memberMatches.forEach((mt) => {
    if (!mt.sessionId) return
    sessionTotalMap.set(mt.sessionId, (sessionTotalMap.get(mt.sessionId) || 0) + 1)
    const inA = (mt.teamA || []).includes(memberId)
    const won = (inA && mt.winnerTeam === 'A') || (!inA && mt.winnerTeam === 'B')
    if (won) {
      sessionWinsMap.set(mt.sessionId, (sessionWinsMap.get(mt.sessionId) || 0) + 1)
    }
  })

  let cleanSessionsCount = 0
  sessionTotalMap.forEach((total, sid) => {
    const won = sessionWinsMap.get(sid) || 0
    if (total >= 3 && won === total) {
      cleanSessionsCount++
    }
  })

  // Đối thủ khác nhau trong các trận thắng
  const distinctOpponents = new Set()
  wonMatches.forEach((mt) => {
    const oppTeam = (mt.teamA || []).includes(memberId) ? (mt.teamB || []) : (mt.teamA || [])
    ;(oppTeam || []).forEach((opId) => distinctOpponents.add(opId))
  })

  // Trận thắng sau 22h
  const nightWinsCount = wonMatches.filter((mt) => {
    const ts = getMatchTimestamp(mt, db)
    if (!ts) return false
    return new Date(ts).getHours() >= 22
  }).length

  // Set thắng 21-0
  const sweepSet21_0 = wonMatches.some((mt) => {
    if (!Array.isArray(mt.sets)) return false
    const inA = (mt.teamA || []).includes(memberId)
    return mt.sets.some((s) => Array.isArray(s) && ((inA && s[0] === 21 && s[1] === 0) || (!inA && s[1] === 21 && s[0] === 0)))
  })

  // 1. Top 5 thành viên Elo cao nhất CLB (không tính chính mình)
  const top5EloMembers = (db?.members || [])
    .filter((m) => m.id !== memberId && m.active !== false)
    .map((m) => {
      const r =
        (db?.playerRatings || {})[m.id]?.displayRating ||
        (db?.playerRatings || {})[m.id]?.rating ||
        m.rating ||
        m.initialRating ||
        0
      return { id: m.id, r }
    })
    .sort((a, b) => b.r - a.r)
    .slice(0, 5)
    .map((m) => m.id)

  const beatenTop5Ids = new Set()
  wonMatches.forEach((mt) => {
    const opps = (mt.teamA || []).includes(memberId) ? (mt.teamB || []) : (mt.teamA || [])
    opps.forEach((opId) => {
      if (top5EloMembers.includes(opId)) beatenTop5Ids.add(opId)
    })
  })
  const distinctTop5Beaten = beatenTop5Ids.size

  // 2. Thành viên Rank 1 Elo hiện tại của CLB
  const rank1Member = (db?.members || [])
    .filter((m) => m.active !== false)
    .map((m) => {
      const r =
        (db?.playerRatings || {})[m.id]?.displayRating ||
        (db?.playerRatings || {})[m.id]?.rating ||
        m.rating ||
        m.initialRating ||
        0
      return { id: m.id, r }
    })
    .sort((a, b) => b.r - a.r)[0]

  // 3. Quét các cặp đôi trong mùa giải để tìm cặp số 1 CLB
  const pairStatsMap = new Map()
  allSeasonMatches.forEach((mt) => {
    if (mt.ratingEnabled === false) return
    const isFinished = mt.winnerTeam === 'A' || mt.winnerTeam === 'B'
    if (!isFinished) return
    if (Array.isArray(mt.teamA) && mt.teamA.length === 2) {
      const pKey = mt.teamA.slice().sort().join('_')
      const stat = pairStatsMap.get(pKey) || { played: 0, wins: 0 }
      stat.played++
      if (mt.winnerTeam === 'A') stat.wins++
      pairStatsMap.set(pKey, stat)
    }
    if (Array.isArray(mt.teamB) && mt.teamB.length === 2) {
      const pKey = mt.teamB.slice().sort().join('_')
      const stat = pairStatsMap.get(pKey) || { played: 0, wins: 0 }
      stat.played++
      if (mt.winnerTeam === 'B') stat.wins++
      pairStatsMap.set(pKey, stat)
    }
  })

  let topPairKey = null
  let maxPairWinRate = 0
  pairStatsMap.forEach((stat, pKey) => {
    const [p1, p2] = pKey.split('_')
    if (p1 === memberId || p2 === memberId) return
    if (stat.played >= 3) {
      const wr = stat.wins / stat.played
      if (wr > maxPairWinRate) {
        maxPairWinRate = wr
        topPairKey = pKey
      }
    }
  })

  // 4. Số trận thắng đối thủ có Elo cao hơn đáng kể (>= 50 điểm)
  const significantHigherRankWins = upsetWinsGaps.filter((gap) => gap >= 50).length

  // 5. Trận deuce chuẩn: cả 2 bên cùng đạt >= 20 điểm và cách biệt đúng 2 điểm
  const trueDeuceWinsCount = wonMatches.filter((mt) => {
    if (!Array.isArray(mt.sets)) return false
    return mt.sets.some((s) => Array.isArray(s) && s[0] >= 20 && s[1] >= 20 && Math.abs(s[0] - s[1]) === 2)
  }).length

  // 6. Số trận thắng trận cuối của một buổi tập
  let lastMatchWinsCount = 0
  sessionTotalMap.forEach((tot, sid) => {
    const sessMatches = memberMatches
      .filter((mt) => mt.sessionId === sid)
      .sort((a, b) => getMatchTimestamp(a, db) - getMatchTimestamp(b, db))
    const lastM = sessMatches[sessMatches.length - 1]
    if (lastM) {
      const inA = (lastM.teamA || []).includes(memberId)
      const won = (inA && lastM.winnerTeam === 'A') || (!inA && lastM.winnerTeam === 'B')
      if (won) lastMatchWinsCount++
    }
  })

  // 7. Thắng phục thù: từng thua chính đối thủ này trước đó trong mùa rồi sau đó thắng lại
  const hasRevengeWin = wonMatches.some((winMt) => {
    const winTs = getMatchTimestamp(winMt, db)
    const inA = (winMt.teamA || []).includes(memberId)
    const opps = inA ? (winMt.teamB || []) : (winMt.teamA || [])
    return memberMatches.some((prevMt) => {
      const prevTs = getMatchTimestamp(prevMt, db)
      if (prevTs >= winTs) return false
      const pInA = (prevMt.teamA || []).includes(memberId)
      const lost = (pInA && prevMt.winnerTeam === 'B') || (!pInA && prevMt.winnerTeam === 'A')
      if (!lost) return false
      const pOpps = pInA ? (prevMt.teamB || []) : (prevMt.teamA || [])
      return opps.some((opId) => pOpps.includes(opId))
    })
  })

  // 8. Lội ngược dòng set 3: thua set 1, thắng 2 set sau (chung cuộc 2-1)
  const hasComebackSet3 = wonMatches.some((mt) => {
    if (!Array.isArray(mt.sets) || mt.sets.length < 3) return false
    const inA = (mt.teamA || []).includes(memberId)
    const s1 = mt.sets[0]
    if (!Array.isArray(s1) || s1.length < 2) return false
    const myS1 = inA ? s1[0] : s1[1]
    const oppS1 = inA ? s1[1] : s1[0]
    return oppS1 > myS1
  })

  // 9. Ngay lần đầu chạm trán ngắt bounty trong mùa
  const hasFirstTryBounty = wonMatches.some((mt) => {
    const isBroken = mt.bountyBroken || mt.bounty_broken
    if (!isBroken) return false
    const inA = (mt.teamA || []).includes(memberId)
    const opps = inA ? (mt.teamB || []) : (mt.teamA || [])
    const prevMatchesWithOpp = allSeasonMatches.filter((prevMt) => {
      if (getMatchTimestamp(prevMt, db) >= getMatchTimestamp(mt, db)) return false
      const prevInA = (prevMt.teamA || []).includes(memberId)
      const prevInB = (prevMt.teamB || []).includes(memberId)
      if (!prevInA && !prevInB) return false
      const prevOpps = prevInA ? (prevMt.teamB || []) : (prevMt.teamA || [])
      return opps.some((opId) => prevOpps.includes(opId))
    })
    return prevMatchesWithOpp.length === 0
  })

  // 10. Số trận thắng tối đa khi đánh cùng 1 đồng đội duy nhất
  let maxPartnerWins = 0
  partners.forEach((partnerId) => {
    const { wins } = getPairStreak(memberId, partnerId, db, season, allSeasonMatches)
    if (wins > maxPartnerWins) maxPartnerWins = wins
  })

  const processed = catalog.map((badge) => {
    let currentVal = 0
    let isUnlocked = false
    let progressStr = ''
    let pct = 0

    switch (badge.checkType) {
      case 'win_streak':
        if (maxStreak >= badge.threshold) {
          currentVal = badge.threshold
          isUnlocked = true
          progressStr = `${badge.threshold} / ${badge.threshold}`
          pct = 100
        } else {
          currentVal = streak
          isUnlocked = false
          progressStr = `${streak} / ${badge.threshold}`
          pct = Math.min(100, Math.round((streak / badge.threshold) * 100))
        }
        break

      case 'total_wins':
        currentVal = totalWins
        isUnlocked = currentVal >= badge.threshold
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = Math.min(100, Math.round((currentVal / badge.threshold) * 100))
        break

      case 'upset_elo':
        currentVal = maxUpsetGap
        isUnlocked = maxUpsetGap >= badge.threshold
        progressStr = isUnlocked ? `+${badge.threshold}` : (maxUpsetGap > 0 ? `+${maxUpsetGap} / +${badge.threshold}` : `0 / +${badge.threshold}`)
        pct = Math.min(100, Math.round((maxUpsetGap / badge.threshold) * 100))
        break

      case 'win_margin':
        currentVal = minOpponentScoreInWinSet <= badge.threshold ? badge.threshold : minOpponentScoreInWinSet
        isUnlocked = minOpponentScoreInWinSet <= badge.threshold
        progressStr = isUnlocked ? `≤ ${badge.threshold}` : (minOpponentScoreInWinSet < 21 ? `${minOpponentScoreInWinSet}` : `0 / ≤ ${badge.threshold}`)
        pct = isUnlocked ? 100 : (minOpponentScoreInWinSet < 21 ? Math.max(0, Math.round(((21 - minOpponentScoreInWinSet) / (21 - badge.threshold)) * 100)) : 0)
        break

      case 'pair_streak':
        currentVal = bestPairStreak
        isUnlocked = currentVal >= badge.threshold
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = Math.min(100, Math.round((currentVal / badge.threshold) * 100))
        break

      case 'three_set_wins':
        currentVal = threeSetWinsCount
        isUnlocked = currentVal >= badge.threshold
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = Math.min(100, Math.round((currentVal / badge.threshold) * 100))
        break

      case 'higher_rank_wins':
        currentVal = significantHigherRankWins
        isUnlocked = currentVal >= badge.threshold
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = Math.min(100, Math.round((currentVal / badge.threshold) * 100))
        break

      case 'clean_sessions':
        currentVal = cleanSessionsCount
        isUnlocked = currentVal >= badge.threshold
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = Math.min(100, Math.round((currentVal / badge.threshold) * 100))
        break

      case 'first_season_win':
        currentVal = Math.min(1, totalWins)
        isUnlocked = totalWins >= 1
        progressStr = isUnlocked ? '1 / 1' : '0 / 1'
        pct = isUnlocked ? 100 : 0
        break

      case 'comeback_set3':
        isUnlocked = hasComebackSet3 || !!member?.comebackSet3
        currentVal = isUnlocked ? 1 : 0
        progressStr = isUnlocked ? '1 / 1' : '0 / 1'
        pct = isUnlocked ? 100 : 0
        break

      case 'night_win':
        currentVal = Math.min(1, nightWinsCount)
        isUnlocked = nightWinsCount >= 1 || !!member?.nightWin
        progressStr = isUnlocked ? '1 / 1' : '0 / 1'
        pct = isUnlocked ? 100 : 0
        break

      case 'last_match_win':
        currentVal = lastMatchWinsCount
        isUnlocked = currentVal >= badge.threshold || !!member?.lastMatchWin
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = Math.min(100, Math.round((currentVal / badge.threshold) * 100))
        break

      case 'perfect_session_4': {
        const hasPerf4 = Array.from(sessionTotalMap.entries()).some(([sid, tot]) => tot >= 4 && (sessionWinsMap.get(sid) || 0) === tot)
        isUnlocked = hasPerf4 || !!member?.perfectSession4
        currentVal = isUnlocked ? 1 : 0
        progressStr = isUnlocked ? '1 / 1' : '0 / 1'
        pct = isUnlocked ? 100 : 0
        break
      }

      case 'perfect_session_6': {
        const hasPerf6 = Array.from(sessionTotalMap.entries()).some(([sid, tot]) => tot >= 6 && (sessionWinsMap.get(sid) || 0) === tot)
        isUnlocked = hasPerf6 || !!member?.perfectSession6
        currentVal = isUnlocked ? 1 : 0
        progressStr = isUnlocked ? '1 / 1' : '0 / 1'
        pct = isUnlocked ? 100 : 0
        break
      }

      case 'deuce_wins':
        currentVal = trueDeuceWinsCount
        isUnlocked = currentVal >= badge.threshold
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = Math.min(100, Math.round((currentVal / badge.threshold) * 100))
        break

      case 'revenge_win':
        isUnlocked = hasRevengeWin || !!member?.revengeWin
        currentVal = isUnlocked ? 1 : 0
        progressStr = isUnlocked ? '1 / 1' : '0 / 1'
        pct = isUnlocked ? 100 : 0
        break

      case 'distinct_opponents_season':
        currentVal = distinctOpponents.size
        isUnlocked = currentVal >= badge.threshold
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = Math.min(100, Math.round((currentVal / badge.threshold) * 100))
        break

      case 'first_try_bounty':
        isUnlocked = hasFirstTryBounty || !!member?.firstTryBounty
        currentVal = isUnlocked ? 1 : 0
        progressStr = isUnlocked ? '1 / 1' : '0 / 1'
        pct = isUnlocked ? 100 : 0
        break

      case 'beat_all_top5': {
        currentVal = distinctTop5Beaten
        isUnlocked = currentVal >= badge.threshold || !!member?.beatTop5
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = Math.min(100, Math.round((currentVal / badge.threshold) * 100))
        break
      }

      case 'sweep_set_21_0':
        isUnlocked = sweepSet21_0 || !!member?.sweep21_0
        currentVal = isUnlocked ? 1 : 0
        progressStr = isUnlocked ? '1 / 1' : '0 / 1'
        pct = isUnlocked ? 100 : 0
        break

      case 'break_streak_10': {
        const reqStreak = Number(badge.threshold || 10)
        const broke10 = wonMatches.some((mt) => (mt.brokenStreak || 0) >= reqStreak)
        isUnlocked = broke10 || !!member?.brokeStreak10
        currentVal = isUnlocked ? 1 : 0
        progressStr = isUnlocked ? '1 / 1' : '0 / 1'
        pct = isUnlocked ? 100 : 0
        break
      }

      case 'beat_champion': {
        const champId = season?.previousChampion || db?.club?.championId || rank1Member?.id
        const beatChamp = champId && champId !== memberId ? wonMatches.some((mt) => {
          const opps = (mt.teamA || []).includes(memberId) ? (mt.teamB || []) : (mt.teamA || [])
          return opps.includes(champId)
        }) : false
        isUnlocked = beatChamp || !!member?.beatChampion
        currentVal = isUnlocked ? 1 : 0
        progressStr = isUnlocked ? '1 / 1' : '0 / 1'
        pct = isUnlocked ? 100 : 0
        break
      }

      case 'win_rate_season': {
        const minMatches = Number(cfgBadges.minMatchesWinRate || 15)
        const played = memberMatches.length
        const wr = played >= minMatches ? Math.round((totalWins / played) * 100) : 0
        currentVal = wr
        isUnlocked = played >= minMatches && wr >= badge.threshold
        progressStr = `${wr}% / ${badge.threshold}%`
        pct = isUnlocked ? 100 : Math.min(99, Math.round((wr / badge.threshold) * 100))
        break
      }

      case 'days_rank_1': {
        const isRank1Now = rank1Member?.id === memberId
        let days = Number(member?.daysRank1 || 0)
        if (!days && isRank1Now) {
          const seasonStart = season?.startDate ? new Date(season.startDate).getTime() : 0
          const daysInSeason = seasonStart ? Math.max(1, Math.floor((Date.now() - seasonStart) / (86400 * 1000))) : 0
          days = Math.max(days, daysInSeason)
        }
        currentVal = days
        isUnlocked = currentVal >= badge.threshold || !!member?.docCo
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = Math.min(100, Math.round((currentVal / badge.threshold) * 100))
        break
      }

      case 'century_comeback': {
        const hasCenturyComeback = wonMatches.some((mt) => {
          if (!Array.isArray(mt.sets) || mt.sets.length < 3) return false
          const inA = (mt.teamA || []).includes(memberId)
          const s1 = mt.sets[0]
          const s3 = mt.sets[mt.sets.length - 1]
          if (!Array.isArray(s1) || !Array.isArray(s3)) return false
          const myS1 = inA ? s1[0] : s1[1]
          const oppS1 = inA ? s1[1] : s1[0]
          const myS3 = inA ? s3[0] : s3[1]
          const oppS3 = inA ? s3[1] : s3[0]
          return oppS1 >= 21 && myS1 <= 12 && myS3 >= 21 && (myS3 - oppS3 <= 2)
        })
        isUnlocked = hasCenturyComeback || !!member?.centuryComeback
        currentVal = isUnlocked ? 1 : 0
        progressStr = isUnlocked ? '1 / 1' : '0 / 1'
        pct = isUnlocked ? 100 : 0
        break
      }

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

      case 'dues_clean_months': {
        // A1: Đếm số tháng liên tiếp không nợ quỹ (tối đa threshold tháng)
        const thresholdMonths = Number(badge.threshold || 12)
        if (!joinDate || tenureMonths < 1) {
          currentVal = 0
          isUnlocked = false
          progressStr = `0 / ${thresholdMonths}`
          pct = 0
          break
        }

        const maxCheckMonths = Math.min(thresholdMonths, tenureMonths)
        const now = new Date()
        let curYear = now.getFullYear()
        // Bắt đầu từ tháng TRƯỚC (tháng đã chốt hạn đóng quỹ), không tính tháng hiện tại đang dở dang
        let curMonth = now.getMonth() // 0..11, tương ứng tháng trước (1..12)
        if (curMonth === 0) {
          curMonth = 12
          curYear--
        }

        let cleanConsecutive = 0
        for (let i = 0; i < maxCheckMonths; i++) {
          const mKey = `${curYear}-${String(curMonth).padStart(2, '0')}`
          let debts = { total: 0 }
          try {
            debts = myDebtCounts(db, mKey, memberId)
          } catch {
            debts = { total: 0 }
          }
          if ((debts.total || 0) > 0) {
            break
          }
          cleanConsecutive++

          curMonth--
          if (curMonth === 0) {
            curMonth = 12
            curYear--
          }
        }

        currentVal = cleanConsecutive
        isUnlocked = tenureMonths >= thresholdMonths && currentVal >= thresholdMonths
        progressStr = `${currentVal} / ${thresholdMonths}`
        pct = Math.min(100, Math.round((currentVal / thresholdMonths) * 100))
        break
      }

      case 'bounty_break':
      case 'bounty_break_season':
        currentVal = bountiesBrokenCount
        isUnlocked = currentVal >= badge.threshold
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = Math.min(100, Math.round((currentVal / badge.threshold) * 100))
        break

      case 'bounty_break_distinct': {
        currentVal = bountiesBrokenDistinctCount
        isUnlocked = currentVal >= badge.threshold
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = Math.min(100, Math.round((currentVal / badge.threshold) * 100))
        break
      }

      case 'beat_top_pair': {
        // B1: Đánh bại cặp đôi có tỷ lệ thắng cao nhất CLB
        const beatTop = topPairKey ? wonMatches.some((mt) => {
          const isDoubles = (mt.teamA || []).length === 2 && (mt.teamB || []).length === 2
          if (!isDoubles) return false
          const inA = (mt.teamA || []).includes(memberId)
          const oppTeam = inA ? mt.teamB : mt.teamA
          const oppKey = oppTeam.slice().sort().join('_')
          return oppKey === topPairKey
        }) : false
        isUnlocked = beatTop || !!member?.beatTopPair
        currentVal = isUnlocked ? 1 : 0
        progressStr = isUnlocked ? '1 / 1' : '0 / 1'
        pct = isUnlocked ? 100 : 0
        break
      }

      case 'internal_champion': {
        // B1: Quán quân giải nội bộ
        const isChamp =
          !!member?.internalChampion ||
          (member?.tournamentsWon || 0) > 0 ||
          (member?.titles || []).includes('champion')
        isUnlocked = isChamp
        currentVal = isUnlocked ? 1 : 0
        progressStr = isUnlocked ? '1 / 1' : '0 / 1'
        pct = isUnlocked ? 100 : 0
        break
      }

      case 'fun':
        isUnlocked = true
        progressStr = ''
        pct = 100
        break

      case 'hidden_comeback': {
        const reqGap = Number(badge.threshold || 10)
        const hasComeback = wonMatches.some((mt) => {
          if (!Array.isArray(mt.sets) || mt.sets.length < 3) return false
          const inA = (mt.teamA || []).includes(memberId)
          const s1 = mt.sets[0]
          if (!Array.isArray(s1) || s1.length < 2) return false
          const myS1 = inA ? s1[0] : s1[1]
          const oppS1 = inA ? s1[1] : s1[0]
          return (oppS1 - myS1) >= reqGap
        })
        isUnlocked = hasComeback || !!member?.unlockedHidden?.includes(badge.id)
        currentVal = isUnlocked ? 1 : 0
        progressStr = isUnlocked ? '' : '???'
        pct = isUnlocked ? 100 : 0
        break
      }

      case 'hidden_surprise_session': {
        const hasPerf5 = Array.from(sessionTotalMap.entries()).some(
          ([sid, tot]) => tot >= 5 && (sessionWinsMap.get(sid) || 0) === tot
        )
        isUnlocked = hasPerf5 || !!member?.unlockedHidden?.includes(badge.id)
        currentVal = isUnlocked ? 1 : 0
        progressStr = isUnlocked ? '' : '???'
        pct = isUnlocked ? 100 : 0
        break
      }

      case 'hidden_duo_bond': {
        const duoThreshold = Number(badge.threshold || 20)
        isUnlocked = maxPartnerWins >= duoThreshold || bestPairStreak >= duoThreshold || !!member?.unlockedHidden?.includes(badge.id)
        currentVal = maxPartnerWins
        progressStr = isUnlocked ? '' : '???'
        pct = isUnlocked ? 100 : 0
        break
      }

      case 'hidden_deuce_30': {
        const has30PointSet = wonMatches.some((mt) => {
          if (!Array.isArray(mt.sets)) return false
          return mt.sets.some((s) => Array.isArray(s) && (s[0] === 30 || s[1] === 30))
        })
        isUnlocked = has30PointSet || !!member?.unlockedHidden?.includes(badge.id)
        currentVal = isUnlocked ? 1 : 0
        progressStr = isUnlocked ? '' : '???'
        pct = isUnlocked ? 100 : 0
        break
      }

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

  // Danh hiệu chính thức đã mở (loại trừ nhóm Tự phong 'fun')
  const officialUnlocked = unlocked.filter((b) => b.tier !== 'fun')

  // Tính điểm sưu tập: chỉ tính các huy hiệu chính thức đã mở
  const collectionScore = officialUnlocked.reduce((acc, b) => {
    return acc + (ANIME_TIERS[b.tier]?.pts || 0)
  }, 0)

  // Xây dựng 3 ô trên kệ
  let shelfBadges = shelfStored
    .map((id) => processed.find((b) => b.id === id))
    .filter(Boolean)

  // D3: Tự động lấp đầy các ô trống còn lại nếu kệ chưa đủ 3 ô
  const maxShelf = cfgBadges.shelfSlots ?? 3
  if (shelfBadges.length < maxShelf && unlocked.length > 0) {
    const remainingSlots = maxShelf - shelfBadges.length
    const currentShelfIds = new Set(shelfBadges.map((b) => b.id))
    const availableToFill = unlocked
      .filter((b) => !currentShelfIds.has(b.id))
      .sort((a, b) => (TIER_ORDER[b.tier] || 0) - (TIER_ORDER[a.tier] || 0) || (b.pts || 0) - (a.pts || 0))
      .slice(0, remainingSlots)
    shelfBadges = [...shelfBadges, ...availableToFill]
  }

  return {
    all: processed,
    unlocked,
    officialUnlocked,
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
 * Lấy Bảng xếp hạng Người sưu tập (Collector Leaderboard - Màn A5).
 * Tuyệt đối không tính danh hiệu Tự phong (fun) vào điểm hoặc số lượng huy hiệu.
 * @param {Object} db
 * @param {Object} [season]
 * @returns {Array<Object>}
 */
export function getCollectorLeaderboard(db, season = null) {
  if (!db) return []
  const members = db.members || []
  const preloadedMatches = seasonMatchesOf(db, season) || []
  const list = members.map((m) => {
    const res = calculateMemberBadges(m.id, db, season, preloadedMatches)
    const officialCount = (res.officialUnlocked || res.unlocked.filter((b) => b.tier !== 'fun')).length
    return {
      id: m.id,
      name: m.name,
      initial: m.name ? m.name.charAt(0).toUpperCase() : '?',
      signature: m.signature || '',
      count: officialCount,
      unlockedCount: officialCount,
      score: res.collectionScore,
      scoreFormatted: res.collectionScore.toLocaleString('vi-VN'),
      shelf: res.shelfBadges.map((b) => ({
        tier: b.tier,
        glyph: b.glyph,
      })),
    }
  })

  // Sắp xếp theo score giảm dần, sau đó theo số huy hiệu chính thức đã mở
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
 * @param {Object} [season]
 * @returns {Array<Object>}
 */
export function getRarestBadges(db, season = null) {
  if (!db) return []
  const members = db.members || []
  const totalMembers = Math.max(1, members.length)
  // Chỉ gộp catalog với bountyBadges; không nối hunterBadges
  const catalog = (cfgBadges.catalog || []).concat(cfgBadges.bountyBadges || [])
  const preloadedMatches = seasonMatchesOf(db, season) || []

  // Đếm số người sở hữu từng danh hiệu
  const ownershipCount = new Map()
  catalog.forEach((b) => ownershipCount.set(b.id, 0))

  members.forEach((m) => {
    const { unlocked } = calculateMemberBadges(m.id, db, season, preloadedMatches)
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
        pts: ANIME_TIERS[b.tier]?.pts || 0,
      }
    })

  // Sắp xếp: Ưu tiên các danh hiệu đã có người sở hữu (> 0) xếp theo tỷ lệ tăng dần.
  // Các danh hiệu chưa ai có (count = 0) xếp theo bậc TIER_ORDER giảm dần và điểm số.
  return scored
    .sort((a, b) => {
      if (a.count > 0 && b.count === 0) return -1
      if (a.count === 0 && b.count > 0) return 1
      if (a.count > 0 && b.count > 0) return a.ratio - b.ratio
      return (TIER_ORDER[b.tier] || 0) - (TIER_ORDER[a.tier] || 0) || b.pts - a.pts
    })
    .slice(0, 4)
}

/**
 * Tìm danh sách VĐV đã có danh hiệu này (Màn A2)
 * @param {string} badgeId
 * @param {Object} db
 * @param {Object} [season]
 * @returns {Array<Object>}
 */
export function getBadgeOwners(badgeId, db, season = null) {
  if (!badgeId || !db) return []
  const members = db.members || []
  const preloadedMatches = seasonMatchesOf(db, season) || []
  const owners = []

  members.forEach((m) => {
    const { unlocked } = calculateMemberBadges(m.id, db, season, preloadedMatches)
    const found = unlocked.find((b) => b.id === badgeId)
    if (found) {
      const { maxStreak, matches } = getMemberStreak(m.id, db, season, preloadedMatches)
      let atDate = ''
      const ascMatches = sortMatchesAsc(matches, db)

      // E3: Tìm đúng thời điểm / trận đấu chạm mốc theo từng loại điều kiện
      let milestoneTs = 0
      const threshold = found.threshold || 1

      if (found.checkType === 'win_streak') {
        let runStreak = 0
        for (const mt of ascMatches) {
          const inA = (mt.teamA || []).includes(m.id)
          const inB = (mt.teamB || []).includes(m.id)
          const won = (inA && mt.winnerTeam === 'A') || (inB && mt.winnerTeam === 'B')
          if (won) {
            runStreak++
            if (runStreak === threshold) {
              milestoneTs = getMatchTimestamp(mt, db)
              break
            }
          } else {
            runStreak = 0
          }
        }
      } else if (found.checkType === 'total_wins') {
        const winMatches = ascMatches.filter((mt) => {
          const inA = (mt.teamA || []).includes(m.id)
          const inB = (mt.teamB || []).includes(m.id)
          return (inA && mt.winnerTeam === 'A') || (inB && mt.winnerTeam === 'B')
        })
        const mMatch = winMatches[threshold - 1] || winMatches[winMatches.length - 1]
        if (mMatch) milestoneTs = getMatchTimestamp(mMatch, db)
      } else if (found.checkType === 'sessions_count') {
        const attendance = db.attendance || {}
        const attendedSessions = (db.sessions || [])
          .filter((s) => {
            if (s.status === 'cancelled' || s.status === 'draft') return false
            const attMap = attendance[s.id] || (typeof s.attendance === 'object' && !Array.isArray(s.attendance) ? s.attendance : {})
            if (isPresent(attMap[m.id])) return true
            const attendees = s.attendees || []
            return attendees.some((a) => (typeof a === 'string' ? a === m.id : a.memberId === m.id))
          })
          .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
        const sess = attendedSessions[threshold - 1] || attendedSessions[attendedSessions.length - 1]
        if (sess && sess.date) {
          milestoneTs = new Date(sess.date).getTime()
        }
      } else if (found.checkType === 'tenure_months') {
        const joinDate = m.joined || m.joinedAt
        if (joinDate) {
          const d = new Date(joinDate)
          d.setMonth(d.getMonth() + threshold)
          milestoneTs = d.getTime()
        }
      } else if (found.checkType === 'bounty_break' || found.checkType === 'bounty_break_distinct') {
        const breakMatches = ascMatches.filter((mt) => {
          const isBroken = mt.bountyBroken || mt.bounty_broken
          if (!isBroken) return false
          const inA = (mt.teamA || []).includes(m.id)
          const inB = (mt.teamB || []).includes(m.id)
          return (inA && mt.winnerTeam === 'A') || (inB && mt.winnerTeam === 'B')
        })
        const bMatch = breakMatches[threshold - 1] || breakMatches[breakMatches.length - 1]
        if (bMatch) milestoneTs = getMatchTimestamp(bMatch, db)
      } else {
        const lastM = ascMatches[ascMatches.length - 1]
        if (lastM) milestoneTs = getMatchTimestamp(lastM, db)
      }

      if (milestoneTs > 0) {
        const d = new Date(milestoneTs)
        const dd = String(d.getDate()).padStart(2, '0')
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        atDate = `${dd}/${mm}`
      }

      owners.push({
        id: m.id,
        initial: m.name ? m.name.charAt(0).toUpperCase() : '?',
        name: m.name,
        avatarUrl: m.avatar_url || m.avatarUrl || '',
        streak: maxStreak || found.threshold || 0,
        threshold: found.threshold || 0,
        checkType: found.checkType || '',
        at: atDate || '',
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
 * @param {Object} [season]
 * @returns {Array<Object>}
 */
export function getBadgeChasers(badgeId, currentUserId, db, season = null) {
  if (!badgeId || !db) return []
  const members = db.members || []
  const preloadedMatches = seasonMatchesOf(db, season) || []
  const chasers = []
  members.forEach((m) => {
    const { inProgress } = calculateMemberBadges(m.id, db, season, preloadedMatches)
    const found = inProgress.find((b) => b.id === badgeId)
    // Chỉ lấy thành viên ĐANG CÓ TIẾN ĐỘ THẬT (> 0).
    if (found && Number(found.currentVal) > 0) {
      chasers.push({
        id: m.id,
        name: m.name,
        isMe: m.id === currentUserId,
        val: String(found.currentVal),
        currentVal: Number(found.currentVal),
        pct: found.pct,
      })
    }
  })

  return chasers
    .sort((a, b) => (b.pct || 0) - (a.pct || 0) || (b.currentVal || 0) - (a.currentVal || 0))
    .slice(0, 4)
    .map((c, i) => ({ ...c, rank: i + 1 }))
}

/**
 * Lấy danh hiệu cao nhất của thành viên để vinh danh (ví dụ trên bảng xếp hạng Elo)
 * @param {string} memberId
 * @param {Object} db
 * @param {Object} [season]
 * @returns {Object|null}
 */
export function getMemberHighestBadge(memberId, db, season = null, preloadedSeasonMatches = null) {
  if (!memberId || !db) return null
  const { unlocked } = calculateMemberBadges(memberId, db, season, preloadedSeasonMatches)
  if (!unlocked || unlocked.length === 0) return null

  // D4 & D5: Dùng TIER_ORDER thống nhất và tiebreak bằng pts thật
  return (
    unlocked.slice().sort((a, b) => {
      const tierDiff = (TIER_ORDER[b.tier] || 0) - (TIER_ORDER[a.tier] || 0)
      if (tierDiff !== 0) return tierDiff
      const ptsA = a.points || a.pts || ANIME_TIERS[a.tier]?.pts || 0
      const ptsB = b.points || b.pts || ANIME_TIERS[b.tier]?.pts || 0
      return ptsB - ptsA
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

    // E4: Đọc tỷ số chuẩn xác từ cả sets (mảng lồng [sA, sB]), scoreText hoặc scoreTeamA
    let sA = Number(mt.scoreTeamA) || 0
    let sB = Number(mt.scoreTeamB) || 0
    if (!sA && !sB && Array.isArray(mt.sets) && mt.sets.length > 0) {
      const lastSet = mt.sets[mt.sets.length - 1]
      if (Array.isArray(lastSet)) {
        sA = Number(lastSet[0]) || 0
        sB = Number(lastSet[1]) || 0
      } else if (lastSet && typeof lastSet === 'object') {
        sA = Number(lastSet.a ?? lastSet.scoreA ?? lastSet.teamA ?? 0)
        sB = Number(lastSet.b ?? lastSet.scoreB ?? lastSet.teamB ?? 0)
      }
    }
    if (!sA && !sB && mt.scoreText) {
      const parts = String(mt.scoreText).split('-')
      if (parts.length === 2) {
        sA = parseInt(parts[0], 10) || 0
        sB = parseInt(parts[1], 10) || 0
      }
    }
    const scoreStr = sA || sB ? `${sA} - ${sB}` : (mt.scoreText || '')

    // Kiểm tra trận ngắt chuỗi / bounty breaker
    if (mt.bountyBroken || mt.bounty_broken || mt.brokenStreak) {
      const winnerName = (winners || []).map((id) => memberMap.get(id)?.name || id).join(' & ')
      const loserName = (losers || []).map((id) => memberMap.get(id)?.name || id).join(' & ')
      feed.push({
        id: `feed-bounty-${mt.id || idx}`,
        type: 'bounty_break',
        timestamp: mt.at ? new Date(mt.at).toISOString() : (mt.createdAt || mt.date || new Date().toISOString()),
        actorName: winnerName,
        targetName: loserName,
        streakBroken: mt.brokenStreak || 5,
        score: scoreStr,
        eventIcon: 'flame',
        color: '#FF2E7E',
      })
    }

    // Kiểm tra trận đấu nghẹt thở (Clutch win: cách biệt 1 hoặc 2 điểm ở tỷ số cao)
    const diff = Math.abs(sA - sB)
    if ((sA >= 20 || sB >= 20) && diff <= 2 && diff > 0) {
      const winnerName = (winners || []).map((id) => memberMap.get(id)?.name || id).join(' & ')
      const loserName = (losers || []).map((id) => memberMap.get(id)?.name || id).join(' & ')
      feed.push({
        id: `feed-clutch-${mt.id || idx}`,
        type: 'clutch_win',
        timestamp: mt.at ? new Date(mt.at).toISOString() : (mt.createdAt || mt.date || new Date().toISOString()),
        actorName: winnerName,
        targetName: loserName,
        score: `${sA} - ${sB}`,
        eventIcon: 'sword',
        color: '#00F5D4',
      })
    }
  })

  // 2. Quét các mốc chuỗi thắng hiện tại của các thành viên (dùng timestamp trận mới nhất của member)
  members.forEach((m) => {
    const { streak } = getMemberStreak(m.id, db)
    const st = streak
    const memberMatches = (db.matches || []).filter(
      (mt) => (mt.teamA || []).includes(m.id) || (mt.teamB || []).includes(m.id)
    )
    const latestMatch = memberMatches[memberMatches.length - 1]
    const milestoneTime = latestMatch
      ? (latestMatch.at ? new Date(latestMatch.at).toISOString() : (latestMatch.createdAt || latestMatch.date || new Date().toISOString()))
      : (m.joined ? new Date(m.joined).toISOString() : new Date().toISOString())

    if (st >= 5) {
      feed.push({
        id: `feed-streak-${m.id}`,
        type: 'streak_milestone',
        timestamp: milestoneTime,
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
        timestamp: milestoneTime,
        actorName: m.name,
        elo,
        eventIcon: 'crown',
        color: '#9D4EDD',
      })
    }
  })

  // E5: Sắp xếp feed theo thời gian mới nhất lên đầu
  return feed
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
    .slice(0, limit)
}

/**
 * Tra cứu thông tin cấu hình danh hiệu theo ID
 * @param {string} badgeId
 * @returns {Object|null}
 */
export function getBadgeById(badgeId) {
  if (!badgeId) return null
  const all = (cfgBadges.catalog || []).concat(cfgBadges.bountyBadges || [])
  return all.find((b) => b.id === badgeId) || null
}
