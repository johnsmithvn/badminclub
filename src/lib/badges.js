import cfgBadges from '#config/badges.json' with { type: 'json' }
import { isPresent, myDebtCounts, playerName } from '#lib/money.js'
import { countInvitedBy, monthsSince } from '#lib/xp.js'
import { seasonMatchesOf, resolveSeason } from '#lib/season.js'
import { collapseChallengeSets } from '#lib/challenge.js'

/**
 * ĐỘNG CƠ DANH HIỆU & TREO THƯỞNG (BADGES & BOUNTY ENGINE)
 * Toàn bộ là hàm thuần (pure functions), không phụ thuộc React, không gọi Supabase.
 */

/** Một ngày tính bằng mili-giây — đơn vị thời gian, không phải hằng số nghiệp vụ. */
const DAY_MS = 86400 * 1000

export const TIER_ORDER = {
  legend: 6,
  epic: 5,
  elite: 4,
  rare: 3,
  fun: 2,
  hidden: 1,
}

export const BADGE_ID_ALIASES = {
  bat_bai_3: 'bat_bai_5',
  bat_bai_v: 'bat_bai_5',
  bat_bai_x: 'bat_bai_10',
  bat_bai_15: 'bat_bai_18',
  de_bep_15: 'de_bep_10',
  de_bep_5: 'de_bep_4',
  de_bep_3: 'de_bep_2',
  tay_doi: 'can_quet_clb',
  hoa_hau_nhat_cau: 'nguoi_co_suc_hut',
  can_ca_top: 'dai_nao_thien_cung',
  ke_ngat_chuoi: 'thanh_guom_diet_quy_3',
  ke_di_san_3: 'ke_di_san_10',
  ke_di_san_8: 'ke_di_san_10',
  ke_di_san_15: 'ke_di_san_20',
  ke_di_san_25: 'ke_di_san_30',
}

export function resolveBadgeId(id) {
  return BADGE_ID_ALIASES[id] || id
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
  // Bốn hình dưới đây do `families` trong badges.json gọi tên. Thiếu chúng thì BadgeHex rơi về
  // `crystal`, khiến 5 họ danh hiệu trông giống hệt nhau mà không báo lỗi gì.
  crosshair: 'polygon(44% 0%,56% 0%,56% 30%,70% 30%,70% 44%,100% 44%,100% 56%,70% 56%,70% 70%,56% 70%,56% 100%,44% 100%,44% 70%,30% 70%,30% 56%,0% 56%,0% 44%,30% 44%,30% 30%,44% 30%)',
  sparkle: 'polygon(50% 0%,58% 28%,79% 12%,68% 36%,96% 34%,72% 50%,96% 66%,68% 64%,79% 88%,58% 72%,50% 100%,42% 72%,21% 88%,32% 64%,4% 66%,28% 50%,4% 34%,32% 36%,21% 12%,42% 28%)',
  // `evenodd` để đường viền trong khoét thành lỗ thật, không bị tô đặc lại.
  ring: 'polygon(evenodd,50% 0%,100% 50%,50% 100%,0% 50%,50% 0%,50% 20%,20% 50%,50% 80%,80% 50%,50% 20%)',
  star: 'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',
}

export const HEX_CLIP = 'polygon(50% 0%,95% 25%,95% 75%,50% 100%,5% 75%,5% 25%)'
export const NOTCH_CLIP = 'polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)'
export const NOTCH_S_CLIP = 'polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)'
export const NOTCH_XS_CLIP = 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)'

/**
 * Danh mục danh hiệu đang bật.
 * `enabled: false` trong badges.json = tạm tắt vì tính năng nguồn chưa có (ví dụ `trum_giai`
 * chờ tính năng Giải đấu). Bật lại chỉ cần xoá cờ đó, không phải đụng code.
 * hunterBadges KHÔNG nối vào đây — nó chỉ là metadata hiển thị cho tab Bounty.
 */
function activeCatalog() {
  return (cfgBadges.catalog || [])
    .concat(cfgBadges.bountyBadges || [])
    .filter((b) => b.enabled !== false)
}

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

  const wonOf = (mt) => {
    const inA = (mt.teamA || []).includes(memberId)
    const inB = (mt.teamB || []).includes(memberId)
    return (inA && mt.winnerTeam === 'A') || (inB && mt.winnerTeam === 'B')
  }

  // Một KÈO đếm đúng một lần vào chuỗi, không phải mỗi set một lần — cùng luật với điểm mùa
  // (`calculateSeasonLeaderboard`). Trước đây hai chỗ này đếm khác nhau: kèo BO3 thắng 2-0 cho
  // điểm mùa thấy chuỗi 1 còn danh hiệu thấy chuỗi 2, nên cùng một người có hai con số chuỗi.
  const ascUnits = collapseChallengeSets(asc, wonOf)
  const descUnits = collapseChallengeSets(desc, wonOf)

  let maxStreak = 0
  let curRunning = 0

  // Duyệt từ cũ tới mới để tìm maxStreak
  ascUnits.forEach((u) => {
    if (u.won) {
      curRunning++
      if (curRunning > maxStreak) maxStreak = curRunning
    } else {
      curRunning = 0
    }
  })

  // Duyệt từ mới nhất để tìm streak đang chạy
  let streak = 0
  // Trận THẬT nằm trong chuỗi đang chạy. Phải trả ra riêng: từ khi kèo đếm gộp, `streak` là số
  // ĐƠN VỊ chứ không còn là số trận, nên `matches.slice(0, streak)` ở phía gọi sẽ hụt trận.
  const streakMatches = []
  let broken = false
  for (const u of descUnits) {
    if (u.won && !broken) {
      streak++
      streakMatches.push(...u.matches)
    } else {
      broken = true
    }
  }

  return { streak, maxStreak, matches: desc, streakMatches }
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
export function getActiveBounties(db, season = null, preloadedMatches = null) {
  if (!db) return []
  const minSingle = cfgBadges.bounty?.minStreakSingle ?? 5
  const minPair = cfgBadges.bounty?.minStreakPair ?? 4
  const hotStreak = cfgBadges.bounty?.hotStreak ?? 6
  const rewHot = cfgBadges.bounty?.rewardHot ?? { xp: 100, seasonPts: 15 }
  const rewNorm = cfgBadges.bounty?.rewardNormal ?? { xp: 80, seasonPts: 12 }

  const resolvedSeason = resolveSeason(db, season)
  const members = (db.members || []).filter((m) => m.active !== false)
  const targetMatches = Array.isArray(preloadedMatches)
    ? preloadedMatches
    : (seasonMatchesOf(db, resolvedSeason) || [])
  const bounties = []

  // 1. Quét cá nhân
  members.forEach((m) => {
    const { streak, streakMatches } = getMemberStreak(m.id, db, resolvedSeason, targetMatches)
    if (streak >= minSingle) {
      const hot = streak >= hotStreak
      const rew = hot ? rewHot : rewNorm
      // Đếm số trận đối thủ đã cố gắng hạ người này trong chuỗi. Dùng `streakMatches` từ chính
      // `getMemberStreak` thay vì cắt `slice(0, streak)`: kèo BO3 là MỘT đơn vị chuỗi nhưng hai
      // ba trận thật, cắt theo số đơn vị thì đếm thiếu đối thủ và lấy sai ngày mở chuỗi.
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
    const { streak, totalPlayed, wins } = getPairStreak(m1, m2, db, resolvedSeason, targetMatches)
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
      const isBroken = mt.bountyBroken || mt.bounty_broken || ((mt.brokenStreak || 0) >= 5)
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
    const isBroken = mt.bountyBroken || mt.bounty_broken || ((mt.brokenStreak || 0) >= 5)
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
 * Tính toán bộ dữ liệu thống kê cấp CLB dùng chung cho danh hiệu (Top 5 Elo, Rank 1, Quán quân, Top Pair, Timeline Elo)
 * Giúp tối ưu O(1) cấp CLB thay vì tính lặp lại O(N) cho từng thành viên.
 * @param {Object} db
 * @param {Object} [season=null]
 * @param {Array} [seasonMatches=null]
 * @returns {Object}
 */
export function computeClubBadgeStats(db, season = null, seasonMatches = null) {
  if (!db) {
    return {
      top5EloMemberIds: [],
      rank1Member: null,
      seasonChampionId: null,
      topPairKey: null,
      daysRank1Map: new Map(),
      matchRank1Map: new Map(),
      resolvedSeason: null,
    }
  }

  const resolvedSeason = resolveSeason(db, season)
  const allSeasonMatches = Array.isArray(seasonMatches)
    ? seasonMatches
    : (seasonMatchesOf(db, resolvedSeason) || [])

  // 1. Thành viên active và ratings
  const members = (db?.members || []).filter((m) => m.active !== false)
  const memberRatings = members
    .map((m) => {
      const r =
        (db?.playerRatings || {})[m.id]?.displayRating ||
        (db?.playerRatings || {})[m.id]?.rating ||
        m.rating ||
        m.initialRating ||
        0
      const isFemale = m.gender === 'nu' || m.gender === 'F'
      return { id: m.id, r, isFemale, gender: m.gender }
    })
    .sort((a, b) => b.r - a.r)

  const topLimit = cfgBadges.topEloRankCount || 5
  const top5EloMemberIds = memberRatings.slice(0, topLimit).map((m) => m.id)
  const top3EloMemberIds = memberRatings.slice(0, 3).map((m) => m.id)
  const rank1Member = memberRatings[0] || null
  const rank1Male = memberRatings.find((m) => !m.isFemale) || null
  const rank1Female = memberRatings.find((m) => m.isFemale) || null

  // 2. Quán quân CLB / Mùa trước
  const seasonChampionId =
    resolvedSeason?.previousChampion ||
    resolvedSeason?.championId ||
    db?.club?.championId ||
    db?.club?.champion_id ||
    null

  // 3. Top cặp đôi CLB: dùng công thức uy tín score = wins * (wins / played) với played >= minPairMatches
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

  const minPairMatches = cfgBadges.minPairMatches || 5
  const maxPairEloGap = cfgBadges.maxPairEloGap || 250
  const minPairMemberElo = cfgBadges.minPairMemberElo || 300
  const memberRatingMap = new Map(memberRatings.map((m) => [m.id, m.r]))

  const isEligiblePair = (pKey) => {
    const ids = pKey.split('_')
    if (ids.length !== 2) return true
    const r1 = memberRatingMap.get(ids[0]) ?? 500
    const r2 = memberRatingMap.get(ids[1]) ?? 500
    if (Math.abs(r1 - r2) > maxPairEloGap) return false
    if (r1 < minPairMemberElo || r2 < minPairMemberElo) return false
    return true
  }

  let bestPairScore = -1
  let topPairKey = null
  pairStatsMap.forEach((stat, pKey) => {
    if (stat.played >= minPairMatches && isEligiblePair(pKey)) {
      const wr = stat.wins / stat.played
      const score = stat.wins * wr
      if (score > bestPairScore) {
        bestPairScore = score
        topPairKey = pKey
      }
    }
  })

  // Fallback nếu chưa cặp nào đủ minPairMatches hoặc đủ điều kiện Elo
  if (!topPairKey) {
    let maxWr = -1
    pairStatsMap.forEach((stat, pKey) => {
      if (stat.played >= 2 && isEligiblePair(pKey)) {
        const wr = stat.wins / stat.played
        if (wr > maxWr) {
          maxWr = wr
          topPairKey = pKey
        }
      }
    })
  }

  // 4. Dòng thời gian Rank 1 và số ngày giữ Rank 1
  //
  // KHÔNG mô phỏng lại Elo. `match.initialRatingA/B` đã là ẢNH CHỤP Elo ngay trước trận —
  // cùng nguồn mà `season.js` đọc để tính điểm mùa — nên đọc thẳng vừa đúng vừa rẻ.
  // Bản trước nạp Elo HIỆN TẠI (đã gồm mọi trận) rồi cộng tiếp delta của cả mùa: cộng hai
  // lần, khiến người YẾU NHẤT CLB leo lên "Rank 1" ảo và ăn trọn `doc_co` sau đúng 1 buổi.
  //
  // Hạn chế còn lại, cố ý không che: trận đôi thì `initialRating` là Elo TRUNG BÌNH của cặp,
  // nên Rank 1 lịch sử là xấp xỉ. Muốn tuyệt đối thì phải có bảng snapshot hạng theo ngày.
  const daysRank1Map = new Map()
  const matchRank1Map = new Map()

  const ascMatches = sortMatchesAsc(allSeasonMatches, db)
  const activeIds = new Set(members.map((m) => m.id))

  // Elo quan sát được tới thời điểm đang duyệt. Mốc nền là Elo THẬT hiện tại, sau đó mỗi
  // trận có ảnh chụp sẽ ghi đè lại cho đúng thời điểm. Trận cũ thiếu `initialRating`
  // (dbmap trả null) nhờ vậy vẫn có mốc so sánh, thay vì biến mọi người thành vô hạng.
  // Đây là gán TĨNH, không cộng dồn — nên không tái hiện lỗi Rank 1 ảo của bản mô phỏng.
  const observedRatings = new Map(memberRatings.map((m) => [m.id, m.r]))
  // Trả null khi KHÔNG có người dẫn đầu rõ ràng: CLB một người, hoặc hai người trở lên cùng
  // đứng nhất. "Giữ hạng 1" giữa một mình mình, hay khi cả CLB cùng 0 điểm, là vô nghĩa —
  // trả đại một id ở đây là cách CLB mới lập tự phát LEGEND cho người đứng đầu danh sách.
  const highestObservedId = () => {
    let maxR = -Infinity
    let runnerUpR = -Infinity
    let bestId = null
    observedRatings.forEach((r, id) => {
      if (r > maxR) {
        runnerUpR = maxR
        maxR = r
        bestId = id
      } else if (r > runnerUpR) {
        runnerUpR = r
      }
    })
    if (runnerUpR === -Infinity || maxR === runnerUpR) return null
    return bestId
  }

  const seasonStartTs = resolvedSeason?.startDate ? new Date(resolvedSeason.startDate).getTime() : 0
  let currentRank1Id = null
  // Đồng hồ giữ hạng 1 chỉ chạy TỪ TRẬN ĐẦU TIÊN của mùa, không phải từ ngày khai mùa:
  // trước khi có trận nào thì chưa có thứ hạng nào được xác lập để mà giữ.
  let lastTs = ascMatches[0] ? getMatchTimestamp(ascMatches[0], db) : 0

  ascMatches.forEach((mt, idx) => {
    const matchTs = getMatchTimestamp(mt, db)

    // Khoảng từ mốc trước tới trận này thuộc về người đang giữ Rank 1 ở mốc trước.
    if (currentRank1Id && lastTs > 0 && matchTs > lastTs) {
      daysRank1Map.set(currentRank1Id, (daysRank1Map.get(currentRank1Id) || 0) + (matchTs - lastTs) / DAY_MS)
    }

    // Ghi nhận Elo ngay TRƯỚC trận này từ ảnh chụp có sẵn trên chính bản ghi trận.
    const ra = Number(mt.initialRatingA)
    const rb = Number(mt.initialRatingB)
    if (Number.isFinite(ra)) {
      ;(mt.teamA || []).forEach((id) => { if (activeIds.has(id)) observedRatings.set(id, ra) })
    }
    if (Number.isFinite(rb)) {
      ;(mt.teamB || []).forEach((id) => { if (activeIds.has(id)) observedRatings.set(id, rb) })
    }

    currentRank1Id = highestObservedId() || currentRank1Id
    matchRank1Map.set(mt.id || String(idx), currentRank1Id)

    if (matchTs > 0) lastTs = matchTs
  })

  // Từ trận cuối tới hôm nay (hoặc hết mùa) thì người giữ Rank 1 là người đứng đầu Elo THẬT.
  // Chỉ cộng khi trận cuối thực sự nằm trong khung mùa — dữ liệu test dùng timestamp giả
  // (at: 100) sẽ không lọt qua, khỏi cần mốc epoch ma thuật để nhận diện.
  const seasonEndRaw = resolvedSeason?.endDate ? new Date(resolvedSeason.endDate).getTime() : NaN
  const endTs = Math.min(Date.now(), Number.isFinite(seasonEndRaw) ? seasonEndRaw : Infinity)

  // Người giữ hạng 1 ở đoạn đuôi phải là người dẫn đầu THẬT SỰ, cùng chuẩn với trong vòng lặp.
  const tailRank1Id = highestObservedId()
  if (
    tailRank1Id &&
    ascMatches.length > 0 &&           // CLB chưa đánh trận nào thì không ai đang giữ hạng gì
    seasonStartTs > 0 &&
    lastTs >= seasonStartTs &&
    endTs > lastTs
  ) {
    daysRank1Map.set(tailRank1Id, (daysRank1Map.get(tailRank1Id) || 0) + (endTs - lastTs) / DAY_MS)
  }

  return {
    top5EloMemberIds,
    top3EloMemberIds,
    rank1Member,
    rank1MaleId: rank1Male?.id || null,
    rank1FemaleId: rank1Female?.id || null,
    seasonChampionId,
    topPairKey,
    daysRank1Map,
    matchRank1Map,
    resolvedSeason,
  }
}

/**
 * Tính toán trạng thái của toàn bộ danh hiệu cho một thành viên.
 * @param {string} memberId
 * @param {Object} db
 * @param {Object} [season=null]
 * @param {Array} [preloadedSeasonMatches=null]
 * @param {Object} [preloadedClubStats=null]
 * @returns {Object}
 */
export function calculateMemberBadges(
  memberId,
  db,
  season = null,
  preloadedSeasonMatches = null,
  preloadedClubStats = null
) {
  const member = (db?.members || []).find((m) => m.id === memberId)
  const catalog = activeCatalog()
  const unlocked = []
  const inProgress = []
  const locked = []

  const resolvedSeason = resolveSeason(db, season)
  const allSeasonMatches = Array.isArray(preloadedSeasonMatches)
    ? preloadedSeasonMatches
    : (seasonMatchesOf(db, resolvedSeason) || [])

  const clubStats = preloadedClubStats || computeClubBadgeStats(db, resolvedSeason, allSeasonMatches)

  const { streak, maxStreak } = getMemberStreak(memberId, db, resolvedSeason, allSeasonMatches)
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

  // D2: Chuẩn hóa đọc badgeShelf và badge_shelf, map qua ID mới nếu có ID cũ
  const shelfStored = (member?.badgeShelf || member?.badge_shelf || []).map(resolveBadgeId)

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
    const { streak: pStr } = getPairStreak(memberId, partnerId, db, resolvedSeason, allSeasonMatches)
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

  const minCleanMatches = Number(cfgBadges.cleanSessionMinMatches || 3)
  let cleanSessionsCount = 0
  sessionTotalMap.forEach((total, sid) => {
    const won = sessionWinsMap.get(sid) || 0
    if (total >= minCleanMatches && won === total) {
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

  // Set thắng 21-0 (hoặc tối đa maxSweepOppScore theo config)
  const maxSweepOppScore = Number(cfgBadges.sweepOpponentMaxScore ?? 0)
  const sweepSet21_0 = wonMatches.some((mt) => {
    if (!Array.isArray(mt.sets)) return false
    const inA = (mt.teamA || []).includes(memberId)
    return mt.sets.some((s) => Array.isArray(s) && ((inA && s[0] === 21 && s[1] <= maxSweepOppScore) || (!inA && s[1] === 21 && s[0] <= maxSweepOppScore)))
  })

  // 1. Hạ các đối thủ khác nhau trong Top 5 Elo CLB (dùng clubStats)
  const beatenTop5Ids = new Set()
  wonMatches.forEach((mt) => {
    const opps = (mt.teamA || []).includes(memberId) ? (mt.teamB || []) : (mt.teamA || [])
    opps.forEach((opId) => {
      if (clubStats.top5EloMemberIds.includes(opId) && opId !== memberId) {
        beatenTop5Ids.add(opId)
      }
    })
  })
  const distinctTop5Beaten = beatenTop5Ids.size

  // 1b. Thống kê hạ các đối thủ Top 5 mỗi người ít nhất 2 lần (Đại Náo Thiên Cung)
  const top5Targets = clubStats.top5EloMemberIds.filter((id) => id !== memberId)
  const top5BeatMap = new Map()
  top5Targets.forEach((id) => top5BeatMap.set(id, 0))
  wonMatches.forEach((mt) => {
    const opps = (mt.teamA || []).includes(memberId) ? (mt.teamB || []) : (mt.teamA || [])
    opps.forEach((opId) => {
      if (top5BeatMap.has(opId)) {
        top5BeatMap.set(opId, top5BeatMap.get(opId) + 1)
      }
    })
  })
  const top5BeatenAtLeast2Count = top5Targets.filter((id) => (top5BeatMap.get(id) || 0) >= 2).length

  // 1c. Thống kê hạ cặp đôi đối thủ có tổng Elo hơn cặp mình >= 150 điểm (Sát Thần Đôi)
  let beatHighEloPairCount = 0
  wonMatches.forEach((mt) => {
    const isDoubles = (mt.teamA || []).length === 2 && (mt.teamB || []).length === 2
    if (!isDoubles) return
    const inA = (mt.teamA || []).includes(memberId)
    const myPairRating = inA ? Number(mt.initialRatingA || 0) : Number(mt.initialRatingB || 0)
    const oppPairRating = inA ? Number(mt.initialRatingB || 0) : Number(mt.initialRatingA || 0)
    if ((oppPairRating - myPairRating) >= 150) {
      beatHighEloPairCount++
    }
  })

  // 1d. Thống kê tỷ lệ thắng khi gặp đối thủ dưới mình >= 50 Elo (Kẻ Hủy Diệt Giấc Mơ)
  let underdogMatchesCount = 0
  let underdogWinsCount = 0
  memberMatches.forEach((mt) => {
    const inA = (mt.teamA || []).includes(memberId)
    const myRating = inA ? Number(mt.initialRatingA || 0) : Number(mt.initialRatingB || 0)
    const oppRating = inA ? Number(mt.initialRatingB || 0) : Number(mt.initialRatingA || 0)
    if ((myRating - oppRating) >= 50) {
      underdogMatchesCount++
      const won = (inA && mt.winnerTeam === 'A') || (!inA && mt.winnerTeam === 'B')
      if (won) underdogWinsCount++
    }
  })
  const underdogWinRate = underdogMatchesCount > 0 ? Math.round((underdogWinsCount / underdogMatchesCount) * 100) : 0

  // 1e. Thống kê gánh tạ: đánh đôi với đồng đội kém mình >= 150 Elo (Gánh Tạ Gãy Lưng)
  const memberRatingsMap = new Map((db?.members || []).map((m) => {
    const r = (db?.playerRatings || {})[m.id]?.displayRating || (db?.playerRatings || {})[m.id]?.rating || m.rating || m.initialRating || 0
    return [m.id, r]
  }))
  const myCurrentRating = memberRatingsMap.get(memberId) || 0
  let heavyCarryWinsCount = 0
  wonMatches.forEach((mt) => {
    const isDoubles = (mt.teamA || []).length === 2 && (mt.teamB || []).length === 2
    if (!isDoubles) return
    const inA = (mt.teamA || []).includes(memberId)
    const myTeam = inA ? mt.teamA : mt.teamB
    const teammateId = myTeam.find((id) => id !== memberId)
    if (teammateId) {
      const mateRating = memberRatingsMap.get(teammateId) || 0
      if ((myCurrentRating - mateRating) >= 150) {
        heavyCarryWinsCount++
      }
    }
  })

  // 1f. Thống kê Robin Hood: thắng Top 3 nhưng thua người kém mình >= 120 Elo
  const hasWonTop3 = wonMatches.some((mt) => {
    const opps = (mt.teamA || []).includes(memberId) ? (mt.teamB || []) : (mt.teamA || [])
    return opps.some((opId) => (clubStats.top3EloMemberIds || []).includes(opId) && opId !== memberId)
  })
  const hasLostToUnderdog120 = memberMatches.some((mt) => {
    const inA = (mt.teamA || []).includes(memberId)
    const lost = (inA && mt.winnerTeam === 'B') || (!inA && mt.winnerTeam === 'A')
    if (!lost) return false
    const myRating = inA ? Number(mt.initialRatingA || 0) : Number(mt.initialRatingB || 0)
    const oppRating = inA ? Number(mt.initialRatingB || 0) : Number(mt.initialRatingA || 0)
    return (myRating - oppRating) >= 120
  })
  const isRobinHood = hasWonTop3 && hasLostToUnderdog120

  // 1g. Thống kê đôi Nam Nữ ăn ý (Tâm Đầu Ý Hợp)
  const isFemale = member?.gender === 'nu' || member?.gender === 'F'
  const mixedPartnerStats = new Map()
  memberMatches.forEach((mt) => {
    const isDoubles = (mt.teamA || []).length === 2 && (mt.teamB || []).length === 2
    if (!isDoubles) return
    const inA = (mt.teamA || []).includes(memberId)
    const myTeam = inA ? mt.teamA : mt.teamB
    const partnerId = myTeam.find((id) => id !== memberId)
    if (!partnerId) return
    const partnerMem = (db?.members || []).find((m) => m.id === partnerId)
    const partnerFemale = partnerMem?.gender === 'nu' || partnerMem?.gender === 'F'
    if (isFemale !== partnerFemale) {
      const stat = mixedPartnerStats.get(partnerId) || { played: 0, wins: 0 }
      stat.played++
      const won = (inA && mt.winnerTeam === 'A') || (!inA && mt.winnerTeam === 'B')
      if (won) stat.wins++
      mixedPartnerStats.set(partnerId, stat)
    }
  })
  let hasEligibleMixedPartner = false
  let bestMixedPartnerWinRate = 0
  mixedPartnerStats.forEach((st) => {
    if (st.played >= 10) {
      const wr = Math.round((st.wins / st.played) * 100)
      if (wr > bestMixedPartnerWinRate) bestMixedPartnerWinRate = wr
      if (wr >= 80) hasEligibleMixedPartner = true
    }
  })

  // 2. Số trận thắng đối thủ có Elo cao hơn đáng kể (theo significantEloGap config)
  const minEloGap = Number(cfgBadges.significantEloGap || 120)
  const significantHigherRankWins = upsetWinsGaps.filter((gap) => gap >= minEloGap).length

  // 3. Trận deuce chuẩn: cả 2 bên cùng đạt >= 20 điểm và cách biệt đúng 2 điểm
  const trueDeuceWinsCount = wonMatches.filter((mt) => {
    if (!Array.isArray(mt.sets)) return false
    return mt.sets.some((s) => Array.isArray(s) && s[0] >= 20 && s[1] >= 20 && Math.abs(s[0] - s[1]) === 2)
  }).length

  // 4. Số trận thắng trận cuối của mình trong một buổi tập
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

  // Các trận của thành viên theo thứ tự tăng dần thời gian cho các kiểm tra O(M)
  const ascMemberMatches = sortMatchesAsc(memberMatches, db)

  // 5. Thắng phục thù: từng thua chính đối thủ này trước đó trong mùa rồi sau đó thắng lại (O(M))
  const lostOpponents = new Set()
  let hasRevengeWin = false
  for (const mt of ascMemberMatches) {
    const inA = (mt.teamA || []).includes(memberId)
    const won = (inA && mt.winnerTeam === 'A') || (!inA && mt.winnerTeam === 'B')
    const opps = inA ? (mt.teamB || []) : (mt.teamA || [])
    if (won) {
      if (opps.some((opId) => lostOpponents.has(opId))) {
        hasRevengeWin = true
        break
      }
    } else {
      opps.forEach((opId) => lostOpponents.add(opId))
    }
  }

  // 6. Lội ngược dòng set 3: thua set 1, thắng 2 set sau (chung cuộc 2-1)
  const hasComebackSet3 = wonMatches.some((mt) => {
    if (!Array.isArray(mt.sets) || mt.sets.length < 3) return false
    const inA = (mt.teamA || []).includes(memberId)
    const s1 = mt.sets[0]
    if (!Array.isArray(s1) || s1.length < 2) return false
    const myS1 = inA ? s1[0] : s1[1]
    const oppS1 = inA ? s1[1] : s1[0]
    return oppS1 > myS1
  })

  // 7. Ngay lần đầu chạm trán ngắt bounty trong mùa (O(M))
  const metOpponents = new Set()
  let hasFirstTryBounty = false
  for (const mt of ascMemberMatches) {
    const inA = (mt.teamA || []).includes(memberId)
    const won = (inA && mt.winnerTeam === 'A') || (!inA && mt.winnerTeam === 'B')
    const opps = inA ? (mt.teamB || []) : (mt.teamA || [])
    const isBroken = mt.bountyBroken || mt.bounty_broken
    if (won && isBroken) {
      const isFirstEncounter = opps.every((opId) => !metOpponents.has(opId))
      if (isFirstEncounter) {
        hasFirstTryBounty = true
        break
      }
    }
    opps.forEach((opId) => metOpponents.add(opId))
  }

  // 8. Số trận thắng tối đa khi đánh cùng 1 đồng đội duy nhất
  let maxPartnerWins = 0
  partners.forEach((partnerId) => {
    const { wins } = getPairStreak(memberId, partnerId, db, resolvedSeason, allSeasonMatches)
    if (wins > maxPartnerWins) maxPartnerWins = wins
  })

  // Mọi nhánh dưới đây CHỈ đọc dữ liệu trận / buổi / hồ sơ thật.
  //
  // Bản trước còn kèm một lớp "cờ mở tay" trên bản ghi thành viên (`member.nightWin`,
  // `member.docCo`, `member.unlockedHidden`, `member.beatTopPair`…) — 16 field mà `dbmap.js`
  // KHÔNG hề map, tức là luôn `undefined`. Chúng là điều kiện luôn-false nằm rải khắp switch,
  // làm mỗi case trông như có hai nguồn sự thật trong khi chỉ có một. Đã gỡ.
  // Muốn mở tay một danh hiệu thì phải thêm cột thật vào DB + map trong dbmap trước, chứ
  // không phải để lại nhánh chờ.
  const processed = catalog.map((badge) => {
    let currentVal = 0
    let isUnlocked = false
    let progressStr = ''
    let pct = 0
    let extraData = {}

    switch (badge.checkType) {
      case 'win_streak':
        if (maxStreak >= badge.threshold) {
          currentVal = badge.threshold
          isUnlocked = true
          progressStr = `${badge.threshold} / ${badge.threshold}`
          pct = 100
        } else {
          // CỐ Ý lệch thước với nhánh trên: mở khoá xét `maxStreak` (đã từng làm được thì
          // danh hiệu đóng băng vĩnh viễn), còn tiến độ xét `streak` ĐANG chạy. Chuỗi bị cắt
          // là về 0 thật — `badges_streak.test.js` mục 3 và 4 khoá đúng hành vi này, kể cả
          // việc badge rơi xuống `locked` và người đó rời mục "Ai đang đuổi".
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

      case 'comeback_set3':
        isUnlocked = hasComebackSet3
        currentVal = isUnlocked ? 1 : 0
        progressStr = isUnlocked ? '1 / 1' : '0 / 1'
        pct = isUnlocked ? 100 : 0
        break

      case 'last_match_win':
        currentVal = lastMatchWinsCount
        isUnlocked = currentVal >= badge.threshold
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = Math.min(100, Math.round((currentVal / badge.threshold) * 100))
        break

      case 'perfect_session_4': {
        const hasPerf4 = Array.from(sessionTotalMap.entries()).some(([sid, tot]) => tot >= 4 && (sessionWinsMap.get(sid) || 0) === tot)
        isUnlocked = hasPerf4
        currentVal = isUnlocked ? 1 : 0
        progressStr = isUnlocked ? '1 / 1' : '0 / 1'
        pct = isUnlocked ? 100 : 0
        break
      }

      case 'perfect_session_6': {
        const hasPerf6 = Array.from(sessionTotalMap.entries()).some(([sid, tot]) => tot >= 6 && (sessionWinsMap.get(sid) || 0) === tot)
        isUnlocked = hasPerf6
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
        isUnlocked = hasRevengeWin
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

      case 'distinct_opponents_pct': {
        const otherActiveCount = (db?.members || []).filter((m) => m.active !== false && m.id !== memberId).length
        const pctOpponents = otherActiveCount >= 10 ? Math.round((distinctOpponents.size / otherActiveCount) * 100) : 0
        currentVal = pctOpponents
        isUnlocked = otherActiveCount >= 10 && pctOpponents >= badge.threshold
        progressStr = otherActiveCount > 0 ? `${distinctOpponents.size}/${otherActiveCount} (${pctOpponents}%)` : '0 / 0'
        pct = isUnlocked ? 100 : Math.min(99, Math.round((pctOpponents / badge.threshold) * 100))
        break
      }

      case 'beat_all_top5_multi': {
        currentVal = top5BeatenAtLeast2Count
        const targetTotal = top5Targets.length || 5
        isUnlocked = top5Targets.length >= 4 && top5BeatenAtLeast2Count >= targetTotal
        progressStr = `${top5BeatenAtLeast2Count} / ${targetTotal}`
        pct = Math.min(100, Math.round((top5BeatenAtLeast2Count / targetTotal) * 100))
        break
      }

      case 'beat_high_elo_pair': {
        currentVal = beatHighEloPairCount
        isUnlocked = currentVal >= badge.threshold
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = Math.min(100, Math.round((currentVal / badge.threshold) * 100))
        break
      }

      case 'gatekeeper_winrate': {
        const reqMatches = 15
        isUnlocked = underdogMatchesCount >= reqMatches && underdogWinRate >= badge.threshold
        currentVal = underdogWinRate
        progressStr = underdogMatchesCount >= reqMatches
          ? `${underdogWinRate}% (${underdogWinsCount}/${underdogMatchesCount})`
          : `${underdogMatchesCount} / ${reqMatches}`
        pct = isUnlocked ? 100 : (underdogMatchesCount >= reqMatches ? Math.min(99, Math.round((underdogWinRate / badge.threshold) * 100)) : Math.round((underdogMatchesCount / reqMatches) * 50))
        break
      }

      case 'rank_1_male': {
        const isMale = member?.gender !== 'nu' && member?.gender !== 'F'
        const qualified = memberMatches.length >= 20 && totalWins >= 10
        const isRank1ThisSeason = qualified && isMale && clubStats.rank1MaleId === memberId
        const pastSeasonsWon = (db?.seasons || []).filter((s) => {
          if (!s || s.active) return false
          if (s.topMaleId && s.topMaleId === memberId) return true
          const podium = s.podiumSnapshot || []
          const topMale = podium.find((p) => p.gender !== 'nu' && p.gender !== 'F')
          return topMale && (topMale.id === memberId || topMale.memberId === memberId)
        })
        isUnlocked = isRank1ThisSeason || pastSeasonsWon.length > 0
        currentVal = isUnlocked ? 1 : 0
        progressStr = isUnlocked ? '1 / 1' : `${Math.min(20, memberMatches.length)} / 20`
        pct = isUnlocked ? 100 : Math.round((Math.min(20, memberMatches.length) / 20) * 50)
        if (isUnlocked) {
          const seasonTag = isRank1ThisSeason
            ? (resolvedSeason?.code || resolvedSeason?.name || '')
            : (pastSeasonsWon[0]?.code || pastSeasonsWon[0]?.name || '')
          if (seasonTag) extraData = { seasonCode: seasonTag }
        }
        break
      }

      case 'rank_1_female': {
        const isFemaleMember = member?.gender === 'nu' || member?.gender === 'F'
        const qualified = memberMatches.length >= 20 && totalWins >= 10
        const isRank1ThisSeason = qualified && isFemaleMember && clubStats.rank1FemaleId === memberId
        const pastSeasonsWon = (db?.seasons || []).filter((s) => {
          if (!s || s.active) return false
          if (s.topFemaleId && s.topFemaleId === memberId) return true
          const podium = s.podiumSnapshot || []
          const topFem = podium.find((p) => p.gender === 'nu' || p.gender === 'F')
          return topFem && (topFem.id === memberId || topFem.memberId === memberId)
        })
        isUnlocked = isRank1ThisSeason || pastSeasonsWon.length > 0
        currentVal = isUnlocked ? 1 : 0
        progressStr = isUnlocked ? '1 / 1' : `${Math.min(20, memberMatches.length)} / 20`
        pct = isUnlocked ? 100 : Math.round((Math.min(20, memberMatches.length) / 20) * 50)
        if (isUnlocked) {
          const seasonTag = isRank1ThisSeason
            ? (resolvedSeason?.code || resolvedSeason?.name || '')
            : (pastSeasonsWon[0]?.code || pastSeasonsWon[0]?.name || '')
          if (seasonTag) extraData = { seasonCode: seasonTag }
        }
        break
      }

      case 'mixed_doubles_master': {
        isUnlocked = hasEligibleMixedPartner
        currentVal = bestMixedPartnerWinRate
        progressStr = `${bestMixedPartnerWinRate}% / 80%`
        pct = isUnlocked ? 100 : Math.min(99, Math.round((bestMixedPartnerWinRate / 80) * 100))
        break
      }

      case 'heavy_carry_wins': {
        currentVal = heavyCarryWinsCount
        isUnlocked = currentVal >= badge.threshold
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = Math.min(100, Math.round((currentVal / badge.threshold) * 100))
        break
      }

      case 'robin_hood_season': {
        isUnlocked = isRobinHood
        currentVal = isUnlocked ? 1 : 0
        progressStr = isUnlocked ? '1 / 1' : '0 / 1'
        pct = isUnlocked ? 100 : (hasWonTop3 ? 50 : 0)
        break
      }

      case 'first_try_bounty':
        isUnlocked = hasFirstTryBounty
        currentVal = isUnlocked ? 1 : 0
        progressStr = isUnlocked ? '1 / 1' : '0 / 1'
        pct = isUnlocked ? 100 : 0
        break

      case 'beat_all_top5': {
        currentVal = distinctTop5Beaten
        isUnlocked = currentVal >= badge.threshold
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = Math.min(100, Math.round((currentVal / badge.threshold) * 100))
        break
      }

      case 'sweep_set_21_0':
        isUnlocked = sweepSet21_0
        currentVal = isUnlocked ? 1 : 0
        progressStr = isUnlocked ? '1 / 1' : '0 / 1'
        pct = isUnlocked ? 100 : 0
        break

      case 'break_streak_10': {
        const reqStreak = Number(badge.streakRequired || 10)
        const broke10 = wonMatches.some((mt) => (mt.brokenStreak || 0) >= reqStreak)
        isUnlocked = broke10
        currentVal = isUnlocked ? 1 : 0
        progressStr = isUnlocked ? '1 / 1' : '0 / 1'
        pct = isUnlocked ? 100 : 0
        break
      }

      case 'beat_champion': {
        const targetReq = Number(badge.threshold || 5)
        const beatChampCount = wonMatches.filter((mt) => {
          const opps = (mt.teamA || []).includes(memberId) ? (mt.teamB || []) : (mt.teamA || [])
          const rank1AtMatch = clubStats.matchRank1Map?.get(mt.id || '')
          const hitChamp = !!(clubStats.seasonChampionId && opps.includes(clubStats.seasonChampionId))
          // CHỈ tính Rank 1 TẠI THỜI ĐIỂM đánh. Không được dùng Rank 1 hiện tại: hạng đổi
          // người là badge đã mở của người khác biến mất, điểm sưu tập tụt 120 — danh hiệu
          // phải đóng băng tại lúc đạt, không phải hàm của trạng thái hôm nay.
          const hitRank1AtTime = !!(rank1AtMatch && rank1AtMatch !== memberId && opps.includes(rank1AtMatch))
          return hitChamp || hitRank1AtTime
        }).length
        isUnlocked = beatChampCount >= targetReq
        currentVal = beatChampCount
        progressStr = `${Math.min(beatChampCount, targetReq)} / ${targetReq}`
        pct = Math.min(100, Math.round((beatChampCount / targetReq) * 100))
        break
      }

      case 'win_rate_season': {
        const minMatches = Number(cfgBadges.minMatchesWinRate || 30)
        const played = memberMatches.length
        const wr = played >= minMatches ? Math.round((totalWins / played) * 100) : 0
        currentVal = wr
        isUnlocked = played >= minMatches && wr >= badge.threshold
        progressStr = `${wr}% / ${badge.threshold}%`
        pct = isUnlocked ? 100 : Math.min(99, Math.round((wr / badge.threshold) * 100))
        break
      }

      case 'days_rank_1': {
        const days = Math.floor(clubStats.daysRank1Map?.get(memberId) || 0)
        currentVal = days
        isUnlocked = currentVal >= badge.threshold
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



      case 'break_streak_5_count':
      case 'bounty_break':
      case 'bounty_break_season': {
        currentVal = bountiesBrokenCount
        isUnlocked = currentVal >= badge.threshold
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = Math.min(100, Math.round((currentVal / badge.threshold) * 100))
        if (isUnlocked) {
          // `wonMatches` giữ nguyên thứ tự của `allSeasonMatches`, KHÔNG phải thứ tự thời gian
          // — lấy phần tử cuối mảng là khoe nhầm nạn nhân của một trận bất kỳ.
          const breakMatches = sortMatchesDesc(
            wonMatches.filter((mt) => mt.bountyBroken || mt.bounty_broken),
            db
          )
          if (breakMatches.length > 0) {
            const lastBreak = breakMatches[0]
            const losers = lastBreak.winnerTeam === 'A' ? (lastBreak.teamB || []) : (lastBreak.teamA || [])
            const victimName = losers.map((id) => playerName(db, id) || id).join(' · ')
            extraData = {
              victim: victimName,
              streak: lastBreak.brokenStreak || 5,
              elo: lastBreak.eloDelta || 18,
            }
          }
        }
        break
      }

      case 'bounty_break_distinct': {
        currentVal = bountiesBrokenDistinctCount
        isUnlocked = currentVal >= badge.threshold
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = Math.min(100, Math.round((currentVal / badge.threshold) * 100))
        break
      }

      case 'beat_top_pair': {
        const targetPairKey = clubStats.topPairKey
        const timesBeat = targetPairKey
          ? wonMatches.filter((mt) => {
              const isDoubles = (mt.teamA || []).length === 2 && (mt.teamB || []).length === 2
              if (!isDoubles) return false
              const inA = (mt.teamA || []).includes(memberId)
              const oppTeam = inA ? mt.teamB : mt.teamA
              const oppKey = oppTeam.slice().sort().join('_')
              return oppKey === targetPairKey
            }).length
          : 0
        currentVal = timesBeat
        isUnlocked = currentVal >= badge.threshold
        progressStr = `${currentVal} / ${badge.threshold}`
        pct = Math.min(100, Math.round((currentVal / badge.threshold) * 100))
        break
      }

      // CHỜ TÍNH NĂNG GIẢI ĐẤU. Badge `trum_giai` đang tắt bằng `enabled: false` trong
      // badges.json nên nhánh này không chạy. Không nguồn nào dưới đây tồn tại trong dbmap
      // (`db.tournaments`, `club.championId`, `member.tournamentsWon`…) — giữ lại làm khung
      // sẵn cho lúc dựng tính năng Giải, lúc đó bỏ cờ `enabled` và nối đúng nguồn dữ liệu.
      case 'internal_champion': {
        const isChamp =
          !!(clubStats.seasonChampionId && memberId === clubStats.seasonChampionId) ||
          !!member?.internalChampion ||
          (member?.tournamentsWon || 0) > 0 ||
          (member?.titles || []).includes('champion') ||
          !!member?.isChampion ||
          !!member?.champion ||
          (Array.isArray(db?.tournaments) && db.tournaments.some((t) => t.winnerId === memberId || t.championId === memberId))
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
        isUnlocked = hasComeback
        currentVal = isUnlocked ? 1 : 0
        progressStr = isUnlocked ? '' : '???'
        pct = isUnlocked ? 100 : 0
        break
      }

      case 'hidden_surprise_session': {
        const hasPerf5 = Array.from(sessionTotalMap.entries()).some(
          ([sid, tot]) => tot >= 5 && (sessionWinsMap.get(sid) || 0) === tot
        )
        isUnlocked = hasPerf5
        currentVal = isUnlocked ? 1 : 0
        progressStr = isUnlocked ? '' : '???'
        pct = isUnlocked ? 100 : 0
        break
      }

      case 'hidden_duo_bond': {
        const duoThreshold = Number(badge.threshold || 20)
        isUnlocked = maxPartnerWins >= duoThreshold || bestPairStreak >= duoThreshold
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
        isUnlocked = has30PointSet
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
      ...extraData,
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
 * @param {Object} [season=null]
 * @param {Array} [preloadedMatches=null]
 * @param {Object} [preloadedClubStats=null]
 * @returns {Array<Object>}
 */
export function getCollectorLeaderboard(db, season = null, preloadedMatches = null, preloadedClubStats = null) {
  if (!db) return []
  const members = db.members || []
  const resolvedSeason = resolveSeason(db, season)
  const matches = Array.isArray(preloadedMatches) ? preloadedMatches : (seasonMatchesOf(db, resolvedSeason) || [])
  const clubStats = preloadedClubStats || computeClubBadgeStats(db, resolvedSeason, matches)
  const list = members.map((m) => {
    const res = calculateMemberBadges(m.id, db, resolvedSeason, matches, clubStats)
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
 * @param {Object} [season=null]
 * @param {Array} [preloadedMatches=null]
 * @param {Object} [preloadedClubStats=null]
 * @returns {Array<Object>}
 */
export function getRarestBadges(db, season = null, preloadedMatches = null, preloadedClubStats = null) {
  if (!db) return []
  const members = db.members || []
  const totalMembers = Math.max(1, members.length)
  const catalog = activeCatalog()
  const resolvedSeason = resolveSeason(db, season)
  const matches = Array.isArray(preloadedMatches) ? preloadedMatches : (seasonMatchesOf(db, resolvedSeason) || [])
  const clubStats = preloadedClubStats || computeClubBadgeStats(db, resolvedSeason, matches)

  // Đếm số người sở hữu từng danh hiệu
  const ownershipCount = new Map()
  catalog.forEach((b) => ownershipCount.set(b.id, 0))

  members.forEach((m) => {
    const { unlocked } = calculateMemberBadges(m.id, db, resolvedSeason, matches, clubStats)
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
        // KHÔNG trả `name` / `cond`: catalog trong `badges.json` không có hai field đó
        // (tên và điều kiện nằm ở `vi.json → badges.items.<id>`), nên trả ra chỉ là
        // `undefined` đội lốt dữ liệu — màn hình in thẳng ra id thô như `bat_bai_3`.
        // Người gọi dịch bằng `t('badges.items.${id}.name')` như mọi chỗ khác.
        id: b.id,
        tier: b.tier,
        glyph: b.glyph,
        count,
        totalMembers,
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
 * @param {Object} [season=null]
 * @param {Array} [preloadedMatches=null]
 * @param {Object} [preloadedClubStats=null]
 * @returns {Array<Object>}
 */
export function getBadgeOwners(badgeId, db, season = null, preloadedMatches = null, preloadedClubStats = null) {
  if (!badgeId || !db) return []
  const members = db.members || []
  const resolvedSeason = resolveSeason(db, season)
  const matches = Array.isArray(preloadedMatches) ? preloadedMatches : (seasonMatchesOf(db, resolvedSeason) || [])
  const clubStats = preloadedClubStats || computeClubBadgeStats(db, resolvedSeason, matches)
  const owners = []
  const resolvedId = resolveBadgeId(badgeId)

  members.forEach((m) => {
    const { unlocked } = calculateMemberBadges(m.id, db, resolvedSeason, matches, clubStats)
    const found = unlocked.find((b) => b.id === resolvedId)
    if (found) {
      const { maxStreak, matches: memberStreakMatches } = getMemberStreak(m.id, db, resolvedSeason, matches)
      let atDate = ''
      const ascMatches = sortMatchesAsc(memberStreakMatches, db)

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
 * @param {Object} [season=null]
 * @param {Array} [preloadedMatches=null]
 * @param {Object} [preloadedClubStats=null]
 * @returns {Array<Object>}
 */
export function getBadgeChasers(badgeId, currentUserId, db, season = null, preloadedMatches = null, preloadedClubStats = null) {
  if (!badgeId || !db) return []
  const members = db.members || []
  const resolvedSeason = resolveSeason(db, season)
  const matches = Array.isArray(preloadedMatches) ? preloadedMatches : (seasonMatchesOf(db, resolvedSeason) || [])
  const clubStats = preloadedClubStats || computeClubBadgeStats(db, resolvedSeason, matches)
  const chasers = []
  const resolvedId = resolveBadgeId(badgeId)
  members.forEach((m) => {
    const { inProgress } = calculateMemberBadges(m.id, db, resolvedSeason, matches, clubStats)
    const found = inProgress.find((b) => b.id === resolvedId)
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
 * @param {Object} [season=null]
 * @param {Array} [preloadedSeasonMatches=null]
 * @param {Object} [preloadedClubStats=null]
 * @returns {Object|null}
 */
export function getMemberHighestBadge(memberId, db, season = null, preloadedSeasonMatches = null, preloadedClubStats = null) {
  if (!memberId || !db) return null
  const resolvedSeason = resolveSeason(db, season)
  const matches = Array.isArray(preloadedSeasonMatches)
    ? preloadedSeasonMatches
    : (seasonMatchesOf(db, resolvedSeason) || [])
  const clubStats = preloadedClubStats || computeClubBadgeStats(db, resolvedSeason, matches)
  const { unlocked } = calculateMemberBadges(memberId, db, resolvedSeason, matches, clubStats)
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
 * Tra cứu thông tin cấu hình danh hiệu theo ID
 * @param {string} badgeId
 * @returns {Object|null}
 */
export function newlyUnlockedBadges(before, after) {
  // Thiếu một vế (calculateMemberBadges ném lỗi) thì KHÔNG được coi mọi huy hiệu đang có là mới:
  // beforeIds rỗng sẽ báo nhầm cả bộ sưu tập cũ. Thà bỏ sót một lần còn hơn chúc mừng nhầm.
  if (!before || !after) return []
  // Chỉ xét danh hiệu CHÍNH THỨC. Nhóm 'fun' (Tự phong) mở sẵn ngay từ thành viên trắng trơn,
  // đưa vào đây thì lưu tỷ số trận nào cũng bắn modal chúc mừng.
  const beforeIds = new Set((before.officialUnlocked || []).map((b) => b.id))
  return (after.officialUnlocked || []).filter((b) => b && !beforeIds.has(b.id))
}

export function getBadgeById(badgeId) {
  if (!badgeId) return null
  const resolvedId = resolveBadgeId(badgeId)
  return activeCatalog().find((b) => b.id === resolvedId) || null
}

/**
 * Lấy thông tin họ danh hiệu và toàn bộ danh sách các mốc cấp độ
 * @param {string} badgeId
 * @returns {Object|null}
 */
export function getBadgeFamily(badgeId) {
  if (!badgeId) return null
  const resolvedId = resolveBadgeId(badgeId)
  const familiesCfg = cfgBadges.families || {}
  for (const [fKey, fData] of Object.entries(familiesCfg)) {
    if ((fData.badgeIds || []).includes(resolvedId)) {
      return {
        key: fKey,
        ...fData,
      }
    }
  }
  return null
}

/**
 * Nhóm danh sách các danh hiệu đã tính toán theo họ cấp độ (Evolving Badges).
 * Các danh hiệu thuộc cùng một chuỗi (ví dụ bat_bai_3, bat_bai_v, bat_bai_x, bat_bai_15)
 * sẽ được gộp thành 1 đối tượng duy nhất đại diện cho họ danh hiệu đó.
 *
 * @param {Array} badgesList
 * @returns {Array}
 */
export function groupBadgesByFamily(badgesList = []) {
  if (!Array.isArray(badgesList) || badgesList.length === 0) return []
  const familiesCfg = cfgBadges.families || {}

  const badgeIdToFamily = new Map()
  for (const [fKey, fData] of Object.entries(familiesCfg)) {
    for (const bId of (fData.badgeIds || [])) {
      badgeIdToFamily.set(bId, fKey)
    }
  }

  const processedFamilies = new Set()
  const result = []
  const badgeMap = new Map(badgesList.map((b) => [b.id, b]))

  for (const badge of badgesList) {
    const fKey = badgeIdToFamily.get(badge.id)
    if (!fKey) {
      result.push({
        ...badge,
        isFamily: false,
        familyKey: null,
        tiers: [badge],
        totalTiers: 1,
        unlockedTiersCount: badge.unlocked ? 1 : 0,
        highestUnlocked: badge.unlocked ? badge : null,
        nextTarget: badge.unlocked ? null : badge,
        activeBadge: badge,
        isAllUnlocked: !!badge.unlocked,
        currentTierIndex: 1,
      })
    } else {
      if (processedFamilies.has(fKey)) continue
      processedFamilies.add(fKey)

      const fData = familiesCfg[fKey]
      const tierBadgeIds = fData.badgeIds || []
      const tiers = tierBadgeIds
        .map((id) => badgeMap.get(id))
        .filter(Boolean)

      if (tiers.length === 0) continue

      const unlockedTiers = tiers.filter((b) => b.unlocked)
      const highestUnlocked = unlockedTiers.length > 0 ? unlockedTiers[unlockedTiers.length - 1] : null
      const nextTarget = tiers.find((b) => !b.unlocked) || null
      // Thẻ đại diện: mốc cao nhất đã mở để vinh danh; nếu chưa mở mốc nào thì lấy mốc đầu tiên
      const activeBadge = highestUnlocked || nextTarget || tiers[0]
      const activeIdx = tiers.findIndex((b) => b.id === activeBadge.id)

      result.push({
        ...activeBadge,
        id: activeBadge.id,
        isFamily: true,
        familyKey: fKey,
        glyph: fData.glyph || activeBadge.glyph,
        tiers,
        totalTiers: tiers.length,
        unlockedTiersCount: unlockedTiers.length,
        highestUnlocked,
        nextTarget,
        activeBadge,
        isAllUnlocked: unlockedTiers.length === tiers.length,
        currentTierIndex: activeIdx + 1,
      })
    }
  }

  return result
}

/** Trọng số phẩm cấp phục vụ sắp xếp theo độ hiếm giảm dần */
export const TIER_WEIGHT = {
  legend: 5,
  epic: 4,
  elite: 3,
  rare: 2,
  fun: 1,
  hidden: 0,
}

/**
 * Sắp xếp danh sách danh hiệu theo độ hiếm và trạng thái:
 * 1. Phẩm cấp cao hơn đứng trước (Legend -> Epic -> Elite -> Rare -> Fun/Hidden).
 * 2. Đã mở khóa đứng trước danh hiệu chưa mở.
 * 3. Tiến độ % cao hơn đứng trước.
 * 4. Giữ thứ tự ổn định theo ID.
 *
 * @param {Array} list
 * @returns {Array}
 */
export function sortBadgesByRarity(list = []) {
  if (!Array.isArray(list) || list.length === 0) return []
  return [...list].sort((a, b) => {
    // 1. Phẩm cấp cao nhất (với họ danh hiệu lấy phẩm cấp mốc cuối cùng)
    const tierA = a.isFamily ? (a.tiers?.[a.tiers.length - 1]?.tier || a.tier) : a.tier
    const tierB = b.isFamily ? (b.tiers?.[b.tiers.length - 1]?.tier || b.tier) : b.tier
    const wA = TIER_WEIGHT[tierA] ?? 0
    const wB = TIER_WEIGHT[tierB] ?? 0
    if (wB !== wA) return wB - wA

    // 2. Trạng thái đã mở khóa
    const unlScoreA = a.unlocked || (a.isFamily && a.isAllUnlocked)
      ? 2
      : (a.isFamily && a.unlockedTiersCount > 0 ? 1 : 0)
    const unlScoreB = b.unlocked || (b.isFamily && b.isAllUnlocked)
      ? 2
      : (b.isFamily && b.unlockedTiersCount > 0 ? 1 : 0)
    if (unlScoreB !== unlScoreA) return unlScoreB - unlScoreA

    // 3. Tiến độ phần trăm (%)
    const pctA = a.isFamily ? (a.nextTarget?.pct || (a.isAllUnlocked ? 100 : 0)) : (a.pct || 0)
    const pctB = b.isFamily ? (b.nextTarget?.pct || (b.isAllUnlocked ? 100 : 0)) : (b.pct || 0)
    if (pctB !== pctA) return pctB - pctA

    // 4. Giữ thứ tự ổn định theo ID
    return String(a.id || '').localeCompare(String(b.id || ''))
  })
}

