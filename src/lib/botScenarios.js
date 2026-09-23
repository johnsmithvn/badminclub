// Personal Bot Scenario Engine (v2.2)
//
// Pipeline 5 bước độc lập:
// 1. inspectMemberState()    -> Thu thập state cá nhân, Elo pre/post, H2H, tương quan Bot
// 2. detectRecentEvents()    -> Bóc tách sự kiện tươi mới (<= 24h-48h), gắn chặt eventKey
// 3. detectScenarios()       -> Map events thành Scenario Candidates
// 4. applySynergy()          -> Gộp candidates CÙNG eventKey thành kịch bản đỉnh cao
// 5. evaluateEncounter()     -> Tính finalScore phẳng, Daily Cap (1 modal/ngày), trả về Decision

import { findBotMember, botLineKey } from '#lib/bot.js'
import { calculateSeasonLeaderboard } from '#lib/season.js'
import { BotMemoryStore } from '#lib/botMemory.js'
 
/** Số trận tối đa kể từ trận thua gần nhất để còn tính là đòi nợ (khoảng 1-2 buổi tập) */
export const MAX_REVENGE_MATCH_GAP = 6

/**
 * Kiểm tra xem một trận đấu có còn thuộc "buổi tập gần nhất" (Session-Aware Freshness) hay không.
 *
 * Tiêu chí thông minh theo nhịp sinh hoạt CLB:
 * 1. Giới hạn trần an toàn: Không quá 7 ngày kể từ khi diễn ra trận đấu.
 * 2. Người dùng này CHƯA TỪNG xem phản hồi về trận đấu này (First Encounter after session).
 * 3. Buổi tập tiếp theo của CLB CHƯA diễn ra (chưa đến ngày buổi sau hoặc buổi sau chưa closed).
 * 4. Chưa có trận đấu thuộc buổi tập mới nào trong CLB diễn ra sau trận này (> 6 tiếng).
 *
 * @param {Object} db
 * @param {string} memberId
 * @param {Object} lastMatch
 * @param {number} now
 * @param {Object} [memoryStore]
 * @returns {boolean}
 */
export function isMatchSessionFresh(db, memberId, lastMatch, now = Date.now(), memoryStore = BotMemoryStore) {
  if (!lastMatch) return false
  const matchAt = new Date(lastMatch.at || lastMatch.playedAt || 0).getTime()
  if (!matchAt) return false

  // 1. Giới hạn trần an toàn: không quá 7 ngày
  const elapsed = now - matchAt
  if (elapsed < 0 || elapsed > 7 * 24 * 3600 * 1000) return false

  // 2. Kiểm tra bộ nhớ: Người này đã từng thấy Bot phản ứng về trận này chưa?
  const matchKey = `match:${lastMatch.id}`
  if (memoryStore?.hasShownRecently && memoryStore.hasShownRecently(memberId, matchKey, 7, now)) {
    return false
  }

  // 3. Kiểm tra xem có buổi tập nào MỚI HƠN đã diễn ra hay chưa (nếu có db.sessions):
  const matchDate = new Date(matchAt).toISOString().slice(0, 10)
  const nowDate = new Date(now).toISOString().slice(0, 10)

  if (db && Array.isArray(db.sessions) && db.sessions.length > 0) {
    const nextSessions = db.sessions
      .filter((s) => s && s.date && s.date > matchDate && s.status !== 'cancelled')
      .sort((a, b) => a.date.localeCompare(b.date))

    if (nextSessions.length > 0) {
      const nextSession = nextSessions[0]
      // Nếu buổi tiếp theo đã chốt sổ (closed), hoặc ngày hiện tại đã vượt qua ngày của buổi tiếp theo
      if (nextSession.status === 'closed' || nowDate > nextSession.date) {
        return false
      }
    }
  }

  // 4. Kiểm tra có trận đấu nào mới hơn trong CLB diễn ra sau buổi này (> 6 tiếng) hay không:
  if (db && Array.isArray(db.matches)) {
    const hasNewerSessionMatches = db.matches.some((m) => {
      if (!m || m.id === lastMatch.id) return false
      const mAt = new Date(m.at || m.playedAt || 0).getTime()
      return mAt > matchAt + 6 * 3600 * 1000 && mAt <= now
    })
    if (hasNewerSessionMatches) {
      return false
    }
  }

  return true
}

/**
 * BƯỚC 1: Thu thập toàn bộ trạng thái và biến động toán học của thành viên.
 *
 * @param {Object} db
 * @param {string} memberId
 * @param {number} [now]
 * @param {Object} [memoryStore]
 * @returns {Object|null}
 */
export function inspectMemberState(db, memberId, now = Date.now(), memoryStore = BotMemoryStore) {
  if (!db || !memberId) return null
  const member = (db.members || []).find((m) => m && m.id === memberId && m.active !== false)
  if (!member) return null

  const bot = findBotMember(db)
  const isBotUser = Boolean(bot && bot.id === memberId)
  if (isBotUser) return null

  // 1. Bảng xếp hạng Elo hiện tại
  const ratings = (db.playerRatings || [])
    .filter((r) => (db.members || []).some((m) => m && m.id === r.memberId && m.active !== false))
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
  const myRankIdx = ratings.findIndex((r) => r.memberId === memberId)
  const currentRank = myRankIdx >= 0 ? myRankIdx + 1 : 99
  const currentElo = Number(ratings[myRankIdx]?.rating) || 1500

  const botRatingRow = ratings.find((r) => r.memberId === bot?.id)
  const botElo = Number(botRatingRow?.rating) || 1500
  const botRankIdx = ratings.findIndex((r) => r.memberId === bot?.id)
  const botRank = botRankIdx >= 0 ? botRankIdx + 1 : 99

  // 2. Điểm mùa (Season Points)
  let currentSp = 0
  let botSp = 0
  try {
    const sb = calculateSeasonLeaderboard(db)
    const myRow = (sb.leaderboard || []).find((r) => r.id === memberId)
    currentSp = Number(myRow?.totalSeasonPoints) || 0
    const botRow = (sb.leaderboard || []).find((r) => r.id === bot?.id)
    botSp = Number(botRow?.totalSeasonPoints) || 0
  } catch (e) {}

  // 3. Lịch sử trận đấu của thành viên (sắp xếp mới nhất lên đầu)
  const myMatches = (db.matches || [])
    .filter((m) => m && ((m.teamA || []).includes(memberId) || (m.teamB || []).includes(memberId)))
    .sort((a, b) => new Date(b.at || b.playedAt || 0) - new Date(a.at || a.playedAt || 0))

  const lastMatch = myMatches[0] || null
  const prevMatch = myMatches[1] || null
  const lastMatchAt = lastMatch ? new Date(lastMatch.at || lastMatch.playedAt || 0).getTime() : 0
  const isRecentMatch = lastMatch ? isMatchSessionFresh(db, memberId, lastMatch, now, memoryStore) : false

  // Phân tích kết quả trận gần nhất
  let lastMatchWon = false
  let lastMatchEloDelta = 0
  let lastOpponentIds = []
  if (lastMatch) {
    const isTeamA = (lastMatch.teamA || []).includes(memberId)
    lastMatchWon = (isTeamA && lastMatch.winnerTeam === 'A') || (!isTeamA && lastMatch.winnerTeam === 'B')
    lastOpponentIds = isTeamA ? (lastMatch.teamB || []) : (lastMatch.teamA || [])
    lastMatchEloDelta = Number(lastMatch.eloDelta) || 0
  }

  // Elo trước trận gần nhất
  const preMatchElo = lastMatchWon
    ? currentElo - lastMatchEloDelta
    : currentElo + lastMatchEloDelta

  // 4. Chuỗi thắng/thua hiện tại
  let streakType = null
  let streakCount = 0
  if (myMatches.length > 0) {
    const firstWon = (myMatches[0].teamA || []).includes(memberId)
      ? myMatches[0].winnerTeam === 'A'
      : myMatches[0].winnerTeam === 'B'
    streakType = firstWon ? 'won' : 'lost'
    for (const m of myMatches) {
      const isTeamA = (m.teamA || []).includes(memberId)
      const won = (isTeamA && m.winnerTeam === 'A') || (!isTeamA && m.winnerTeam === 'B')
      if ((won && streakType === 'won') || (!won && streakType === 'lost')) {
        streakCount++
      } else {
        break
      }
    }
  }

  // 5. Tìm Kình địch (Rival) chính
  // Người đối đầu nhiều trận nhất trong lịch sử với thành viên này
  const h2hCounts = new Map()
  for (const m of myMatches) {
    const isTeamA = (m.teamA || []).includes(memberId)
    const opps = isTeamA ? (m.teamB || []) : (m.teamA || [])
    const won = (isTeamA && m.winnerTeam === 'A') || (!isTeamA && m.winnerTeam === 'B')
    for (const oppId of opps) {
      if (oppId === bot?.id) continue
      const prev = h2hCounts.get(oppId) || { id: oppId, matches: 0, myWins: 0, oppWins: 0, lastWinner: null, lastMatchAt: 0 }
      prev.matches++
      if (won) prev.myWins++
      else prev.oppWins++
      const mAt = new Date(m.at || m.playedAt || 0).getTime()
      if (mAt > prev.lastMatchAt) {
        prev.lastMatchAt = mAt
        prev.lastWinner = won ? memberId : oppId
      }
      h2hCounts.set(oppId, prev)
    }
  }

  // Lấy rival có số trận đối đầu nhiều nhất (tối thiểu 2 trận)
  const rivalCandidate = Array.from(h2hCounts.values())
    .filter((h) => h.matches >= 2)
    .sort((a, b) => b.matches - a.matches)[0] || null

  let rivalMember = null
  if (rivalCandidate) {
    rivalMember = (db.members || []).find((m) => m && m.id === rivalCandidate.id) || null
  }

  // 6. Lịch sử ván Arcade gần nhất với Bot
  const myArcades = (db.arcadeRounds || [])
    .filter((r) => r && r.memberId === memberId)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  const lastArcade = myArcades[0] || null
  const lastArcadeAt = lastArcade ? new Date(lastArcade.createdAt || 0).getTime() : 0
  const isRecentArcade = lastArcade && (now - lastArcadeAt) <= 24 * 3600 * 1000

  // 7. Chuyên cần (Khoảng cách giữa trận gần nhất và trận trước đó)
  let daysSincePreviousMatch = 0
  if (lastMatch && prevMatch) {
    const prevAt = new Date(prevMatch.at || prevMatch.playedAt || 0).getTime()
    daysSincePreviousMatch = Math.round((lastMatchAt - prevAt) / (24 * 3600 * 1000))
  }

  // 8. Thứ hạng trước trận gần nhất (preRank)
  let preRank = currentRank
  if (lastMatch) {
    const preRatings = ratings.map((r) => {
      if (r.memberId === memberId) {
        return { memberId, rating: preMatchElo }
      }
      if (lastOpponentIds.includes(r.memberId)) {
        const oppPost = Number(r.rating) || 1500
        const oppPre = lastMatchWon ? oppPost + lastMatchEloDelta : oppPost - lastMatchEloDelta
        return { memberId: r.memberId, rating: oppPre }
      }
      return { memberId: r.memberId, rating: Number(r.rating) || 1500 }
    }).sort((a, b) => (b.rating || 0) - (a.rating || 0))

    const pIdx = preRatings.findIndex((r) => r.memberId === memberId)
    preRank = pIdx >= 0 ? pIdx + 1 : currentRank
  }

  return {
    memberId: member.id,
    member,
    bot,
    currentRank,
    preRank,
    currentElo,
    preMatchElo,
    botRank,
    botElo,
    currentSp,
    botSp,
    lastMatch,
    lastMatchAt,
    isRecentMatch,
    lastMatchWon,
    lastMatchEloDelta,
    lastOpponentIds,
    streakType,
    streakCount,
    rival: rivalCandidate ? { ...rivalCandidate, name: rivalMember?.name || rivalCandidate.id } : null,
    lastArcade,
    lastArcadeAt,
    isRecentArcade,
    daysSincePreviousMatch,
    myMatches,
  }
}

/**
 * BƯỚC 2: Trích xuất các sự kiện THẬT VỪA DIỄN RA (Event Freshness).
 * Mỗi event bắt buộc mang `eventKey`.
 *
 * @param {Object} db
 * @param {string} memberId
 * @param {Object} state
 * @param {number} [now]
 * @returns {Array<Object>}
 */
export function detectRecentEvents(db, memberId, state, now = Date.now()) {
  if (!state) return []
  const events = []

  // --- A. Sự kiện từ Trận Đấu gần nhất (chỉ xét nếu trận diễn ra trong vòng 24h) ---
  if (state.lastMatch && state.isRecentMatch) {
    const matchKey = `match:${state.lastMatch.id}`
    const matchAt = state.lastMatchAt

    // 1. Overtake Toán Học với đối thủ vừa đấu (hoặc Rival)
    const opponents = state.lastOpponentIds || []
    for (const oppId of opponents) {
      if (oppId === state.bot?.id) continue
      const oppMember = (db.members || []).find((m) => m && m.id === oppId)
      const oppRating = (db.playerRatings || []).find((r) => r.memberId === oppId)
      const oppPostElo = Number(oppRating?.rating) || 1500
      const oppPreElo = state.lastMatchWon ? oppPostElo + state.lastMatchEloDelta : oppPostElo - state.lastMatchEloDelta

      // A vừa vượt đối thủ: Trước trận A < B, sau trận A >= B
      if (state.preMatchElo < oppPreElo && state.currentElo >= oppPostElo) {
        events.push({
          type: 'overtake_rival',
          eventKey: matchKey,
          occurredAt: matchAt,
          data: { rivalId: oppId, rivalName: oppMember?.name || oppId },
        })
      }
      // A bị đối thủ vượt: Trước trận A > B, sau trận A <= B
      else if (state.preMatchElo > oppPreElo && state.currentElo <= oppPostElo) {
        events.push({
          type: 'overtaken_by_rival',
          eventKey: matchKey,
          occurredAt: matchAt,
          data: { rivalId: oppId, rivalName: oppMember?.name || oppId },
        })
      }
    }

    // Trận đòi nợ thành công (Revenge Complete Callback)
    // Điều kiện: Trận đối đầu gần nhất trước đó THUA đối thủ này, trận này VỪA THẮNG LẠI (<= 24h),
    // VÀ trận thua đó diễn ra cách đây không quá MAX_REVENGE_MATCH_GAP trận của người chơi (khoảng 1-2 buổi tập).
    if (state.lastMatchWon) {
      for (const oppId of opponents) {
        if (oppId === state.bot?.id) continue
        const prevH2HMatchIdx = (state.myMatches || []).slice(1).findIndex((m) => {
          const isTeamA = (m.teamA || []).includes(memberId)
          const isTeamB = (m.teamB || []).includes(memberId)
          if (!isTeamA && !isTeamB) return false
          return isTeamA ? (m.teamB || []).includes(oppId) : (m.teamA || []).includes(oppId)
        })

        if (prevH2HMatchIdx >= 0) {
          const matchGap = prevH2HMatchIdx + 1
          const prevH2HMatch = state.myMatches[matchGap]
          const myTeamInPrev = (prevH2HMatch.teamA || []).includes(memberId) ? 'A' : 'B'
          const iLostPrevH2H = prevH2HMatch.winnerTeam && prevH2HMatch.winnerTeam !== myTeamInPrev
          if (iLostPrevH2H && matchGap <= MAX_REVENGE_MATCH_GAP) {
            const oppMember = (db.members || []).find((m) => m && m.id === oppId)
            events.push({
              type: 'revenge_complete',
              eventKey: matchKey,
              occurredAt: matchAt,
              data: { rivalId: oppId, rivalName: oppMember?.name || oppId, matchGap },
            })
            break
          }
        }
      }
    }

    // 2. Overtake Toán Học với Bot
    if (state.bot) {
      if (state.preMatchElo < state.botElo && state.currentElo >= state.botElo) {
        events.push({
          type: 'overtake_bot',
          eventKey: matchKey,
          occurredAt: matchAt,
          data: { botName: state.bot.name },
        })
      } else if (state.preMatchElo > state.botElo && state.currentElo <= state.botElo) {
        events.push({
          type: 'bot_overtakes',
          eventKey: matchKey,
          occurredAt: matchAt,
          data: { botName: state.bot.name },
        })
      }
    }

    // 3. Vừa chạm mốc Chuỗi Thắng / Chuỗi Thua
    if (state.lastMatchWon && state.streakType === 'won') {
      if (state.streakCount >= 3) {
        events.push({
          type: state.streakCount >= 5 ? 'streak_win_5' : 'streak_win_3',
          eventKey: matchKey,
          occurredAt: matchAt,
          data: { n: state.streakCount },
        })
      }
    } else if (!state.lastMatchWon && state.streakType === 'lost' && state.streakCount >= 3) {
      events.push({
        type: 'streak_lose_3',
        eventKey: matchKey,
        occurredAt: matchAt,
        data: { n: state.streakCount },
      })
    }

    // 4. Bước chân vào Top 3 (Chuyển đổi thứ hạng thực sự: preRank > 3 và currentRank <= 3)
    if (state.lastMatchWon && (state.preRank || 99) > 3 && state.currentRank <= 3) {
      events.push({
        type: 'top3_entered',
        eventKey: matchKey,
        occurredAt: matchAt,
        data: { rank: state.currentRank },
      })
    }

    // 5. Chasing Bot (Threshold Crossing): Trận thắng vừa rồi đưa khoảng cách bước vào vùng <= 15 Elo
    if (state.bot && state.lastMatchWon) {
      const preBotGap = state.botElo - state.preMatchElo
      const currentBotGap = state.botElo - state.currentElo
      if (preBotGap > 15 && currentBotGap > 0 && currentBotGap <= 15) {
        events.push({
          type: 'chasing_bot',
          eventKey: matchKey,
          occurredAt: matchAt,
          data: { diff: currentBotGap, botName: state.bot.name },
        })
      }
    }

    // 6. Suýt chạm mốc 5 trận thắng liên tiếp (Trận thứ 4 vừa thắng trong 24h)
    if (state.lastMatchWon && state.streakType === 'won' && state.streakCount === 4) {
      events.push({
        type: 'near_streak_5',
        eventKey: matchKey,
        occurredAt: matchAt,
        data: { current: 4, target: 5 },
      })
    }

    // 7. Chuyên cần: Quay lại sau nghỉ dài
    if (state.daysSincePreviousMatch >= 14 && state.lastMatch) {
      events.push({
        type: 'welcome_back',
        eventKey: matchKey,
        occurredAt: matchAt,
        data: { days: state.daysSincePreviousMatch },
      })
    }
  }

  // --- B. Sự kiện từ Mini-game Arcade (chỉ xét nếu ván đấu trong vòng 24h) ---
  if (state.lastArcade && state.isRecentArcade) {
    const arcadeKey = `arcade:${state.lastArcade.id}`
    const arcadeAt = state.lastArcadeAt
    if (state.lastArcade.outcome === 'won') {
      events.push({
        type: 'arcade_win_brag',
        eventKey: arcadeKey,
        occurredAt: arcadeAt,
        data: { stake: state.lastArcade.stake },
      })
    } else if (state.lastArcade.outcome === 'lost') {
      events.push({
        type: 'arcade_loss_revenge',
        eventKey: arcadeKey,
        occurredAt: arcadeAt,
        data: { stake: state.lastArcade.stake },
      })
    }
  }

  return events
}

/**
 * BƯỚC 3: Map Events thành Scenario Candidates với điểm trọng số và Tone.
 *
 * @param {Array<Object>} events
 * @param {Object} state
 * @returns {Array<Object>}
 */
export function detectScenarios(events, state) {
  if (!events || !events.length) return []
  const candidates = []

  for (const evt of events) {
    const memberName = state?.member?.name || ''
    const botName = state?.bot?.name || ''

    switch (evt.type) {
      case 'overtake_bot':
        candidates.push({
          scenarioKey: 'overtake_bot',
          category: 'bot',
          eventKey: evt.eventKey,
          occurredAt: evt.occurredAt,
          baseScore: 88,
          tone: 'teasing',
          lineKey: 'bot.encounter.competitive.overtake_bot',
          params: { name: memberName, bot: botName },
          action: { type: 'rank', labelKey: 'bot.encounter.actionViewRank' },
        })
        break

      case 'bot_overtakes':
        candidates.push({
          scenarioKey: 'bot_overtakes',
          category: 'bot',
          eventKey: evt.eventKey,
          occurredAt: evt.occurredAt,
          baseScore: 86,
          tone: 'competitive',
          lineKey: 'bot.encounter.competitive.chasing_bot',
          params: { name: memberName, bot: botName },
          action: { type: 'rank', labelKey: 'bot.encounter.actionViewRank' },
        })
        break

      case 'overtake_rival':
        candidates.push({
          scenarioKey: 'overtake_rival',
          category: 'rival',
          eventKey: evt.eventKey,
          occurredAt: evt.occurredAt,
          baseScore: 85,
          tone: 'teasing',
          lineKey: 'bot.encounter.teasing.overtake_rival',
          params: { name: memberName, rival: evt.data?.rivalName || '', bot: botName },
          action: { type: 'rank', labelKey: 'bot.encounter.actionViewRank' },
        })
        break

      case 'overtaken_by_rival':
        candidates.push({
          scenarioKey: 'overtaken_by_rival',
          category: 'rival',
          eventKey: evt.eventKey,
          occurredAt: evt.occurredAt,
          baseScore: 85,
          tone: 'supportive',
          lineKey: 'bot.encounter.supportive.overtaken',
          params: { name: memberName, rival: evt.data?.rivalName || '', bot: botName },
          action: { type: 'challenge_rival', targetId: evt.data?.rivalId, labelKey: 'bot.encounter.actionChallenge' },
        })
        break

      case 'revenge_complete':
        candidates.push({
          scenarioKey: 'revenge_complete',
          category: 'rival',
          eventKey: evt.eventKey,
          occurredAt: evt.occurredAt,
          baseScore: 95,
          tone: 'teasing',
          lineKey: 'bot.encounter.teasing.revenge_complete',
          params: { name: memberName, rival: evt.data?.rivalName || '', bot: botName },
          action: { type: 'rank', labelKey: 'bot.encounter.actionViewRank' },
        })
        break

      case 'streak_win_5':
        candidates.push({
          scenarioKey: 'streak_win_5',
          category: 'form',
          eventKey: evt.eventKey,
          occurredAt: evt.occurredAt,
          baseScore: 82,
          tone: 'teasing',
          lineKey: 'bot.encounter.teasing.streak_win',
          params: { name: memberName, n: evt.data?.n || 5, bot: botName },
          action: { type: 'rank', labelKey: 'bot.encounter.actionViewRank' },
        })
        break

      case 'streak_win_3':
        candidates.push({
          scenarioKey: 'streak_win_3',
          category: 'form',
          eventKey: evt.eventKey,
          occurredAt: evt.occurredAt,
          baseScore: 72,
          tone: 'teasing',
          lineKey: 'bot.encounter.teasing.streak_win',
          params: { name: memberName, n: evt.data?.n || 3, bot: botName },
          action: { type: 'rank', labelKey: 'bot.encounter.actionViewRank' },
        })
        break

      case 'streak_lose_3':
        candidates.push({
          scenarioKey: 'streak_lose_3',
          category: 'form',
          eventKey: evt.eventKey,
          occurredAt: evt.occurredAt,
          baseScore: 78,
          tone: 'supportive',
          lineKey: 'bot.encounter.supportive.streak_lose',
          params: { name: memberName, bot: botName },
          action: { type: 'dismiss', labelKey: 'bot.encounter.actionUnderstand' },
        })
        break

      case 'top3_entered':
        candidates.push({
          scenarioKey: 'top3_entered',
          category: 'rank',
          eventKey: evt.eventKey,
          occurredAt: evt.occurredAt,
          baseScore: 80,
          tone: 'competitive',
          lineKey: 'bot.encounter.competitive.near_streak',
          params: { name: memberName, bot: botName },
          action: { type: 'rank', labelKey: 'bot.encounter.actionViewRank' },
        })
        break

      case 'arcade_loss_revenge':
        candidates.push({
          scenarioKey: 'arcade_loss_revenge',
          category: 'bot',
          eventKey: evt.eventKey,
          occurredAt: evt.occurredAt,
          baseScore: 76,
          tone: 'teasing',
          lineKey: 'bot.encounter.teasing.streak_win',
          params: { name: memberName, bot: botName, stake: evt.data?.stake },
          action: { type: 'arcade', labelKey: 'bot.encounter.actionArcade' },
        })
        break

      case 'arcade_win_brag':
        candidates.push({
          scenarioKey: 'arcade_win_brag',
          category: 'bot',
          eventKey: evt.eventKey,
          occurredAt: evt.occurredAt,
          baseScore: 76,
          tone: 'competitive',
          lineKey: 'bot.encounter.competitive.overtake_bot',
          params: { name: memberName, bot: botName, stake: evt.data?.stake },
          action: { type: 'arcade', labelKey: 'bot.encounter.actionArcade' },
        })
        break

      case 'chasing_bot':
        candidates.push({
          scenarioKey: 'chasing_bot',
          category: 'progress',
          eventKey: evt.eventKey,
          occurredAt: evt.occurredAt,
          baseScore: 70,
          tone: 'teasing',
          lineKey: 'bot.encounter.competitive.chasing_bot',
          params: { name: memberName, bot: botName, diff: evt.data?.diff },
          action: { type: 'rank', labelKey: 'bot.encounter.actionViewRank' },
        })
        break

      case 'near_streak_5':
        candidates.push({
          scenarioKey: 'near_streak_5',
          category: 'progress',
          eventKey: evt.eventKey,
          occurredAt: evt.occurredAt,
          baseScore: 72,
          tone: 'competitive',
          lineKey: 'bot.encounter.competitive.near_streak',
          params: { name: memberName, bot: botName },
          action: { type: 'matches', labelKey: 'bot.encounter.actionLogMatch' },
        })
        break

      case 'welcome_back':
        candidates.push({
          scenarioKey: 'welcome_back',
          category: 'attendance',
          eventKey: evt.eventKey,
          occurredAt: evt.occurredAt,
          baseScore: 65,
          tone: 'friendly',
          lineKey: 'bot.encounter.friendly.welcome_back',
          params: { name: memberName, bot: botName },
          action: { type: 'dismiss', labelKey: 'bot.encounter.actionUnderstand' },
        })
        break

      default:
        break
    }
  }

  return candidates
}

/**
 * BƯỚC 4: Gom Synergy Candidates — CHỈ GỘP CÁC KỊCH BẢN CÓ CÙNG `eventKey`!
 *
 * @param {Array<Object>} candidates
 * @param {Object} state
 * @returns {Array<Object>}
 */
export function applySynergy(candidates, state) {
  if (!candidates || candidates.length <= 1) return candidates || []

  // Nhóm theo eventKey
  const byEvent = new Map()
  for (const c of candidates) {
    const key = c.eventKey || 'global'
    const list = byEvent.get(key) || []
    list.push(c)
    byEvent.set(key, list)
  }

  const out = []
  const memberName = state?.member?.name || ''
  const botName = state?.bot?.name || ''
  const rivalName = state?.rival?.name || ''

  byEvent.forEach((group, eventKey) => {
    const keys = group.map((c) => c.scenarioKey)
    const hasStreak = keys.some((k) => k.startsWith('streak_win'))
    const hasOvertakeRival = keys.includes('overtake_rival')
    const hasOvertakeBot = keys.includes('overtake_bot')

    // 1. [Score 100] Synergy: Chuỗi thắng + Vượt Rival + Vượt Bot CÙNG TRẬN
    if (hasStreak && hasOvertakeRival && hasOvertakeBot) {
      out.push({
        scenarioKey: 'synergy_streak_overtake_both',
        category: 'synergy',
        eventKey,
        occurredAt: group[0].occurredAt,
        baseScore: 100,
        tone: 'teasing',
        lineKey: 'bot.encounter.synergy.streak_overtake_both',
        params: { name: memberName, rival: rivalName, bot: botName },
        action: { type: 'rank', labelKey: 'bot.encounter.actionViewRank' },
      })
      return
    }

    // 2. [Score 95] Synergy: Chuỗi thắng + Vượt Rival
    if (hasStreak && hasOvertakeRival) {
      out.push({
        scenarioKey: 'synergy_streak_overtake_rival',
        category: 'synergy',
        eventKey,
        occurredAt: group[0].occurredAt,
        baseScore: 95,
        tone: 'teasing',
        lineKey: 'bot.encounter.synergy.streak_overtake_both',
        params: { name: memberName, rival: rivalName, bot: botName },
        action: { type: 'rank', labelKey: 'bot.encounter.actionViewRank' },
      })
      return
    }

    // Không có synergy: giữ nguyên các candidates trong nhóm
    group.forEach((item) => out.push(item))
  })

  return out
}

/**
 * BƯỚC 5: Tính điểm phẳng finalScore, áp dụng Daily Cap và quyết định Encounter.
 *
 * @param {Array<Object>} candidates
 * @param {string} memberId
 * @param {number} [now]
 * @param {Object} [memoryStore]
 * @returns {{ mode: 'modal'|'card'|'none', scenario: Object|null, eventKey: string|null }}
 */
export function evaluateEncounter(candidates, memberId, now = Date.now(), memoryStore = BotMemoryStore) {
  if (!candidates || !candidates.length) {
    return { mode: 'none', scenario: null, eventKey: null }
  }

  const scored = candidates.map((cand) => {
    let finalScore = cand.baseScore || 50

    // 1. Freshness bonus dựa trên thời gian thực diễn ra
    const elapsed = now - (cand.occurredAt || now)
    if (elapsed <= 2 * 3600 * 1000) finalScore += 10
    else if (elapsed <= 12 * 3600 * 1000) finalScore += 5
    else if (elapsed <= 24 * 3600 * 1000) finalScore += 0
    else if (elapsed <= 7 * 24 * 3600 * 1000) finalScore -= 2
    else finalScore -= 10

    // 2. Dedupe penalty nếu cùng scenarioKey đã xuất hiện trong 3 ngày qua
    if (memoryStore.hasShownRecently && memoryStore.hasShownRecently(memberId, cand.scenarioKey, 3, now)) {
      finalScore -= 40
    }

    // 3. Fallback chasing cooldown 72h nếu là standings event
    if (cand.eventKey && cand.eventKey.startsWith('standings:')) {
      if (memoryStore.hasShownRecently && memoryStore.hasShownRecently(memberId, cand.scenarioKey, 3, now)) {
        finalScore -= 50
      }
    }

    return { ...cand, finalScore }
  })

  // Lọc điểm tối thiểu
  const valid = scored.filter((c) => c.finalScore >= 40)
  if (!valid.length) {
    return { mode: 'none', scenario: null, eventKey: null }
  }

  // Sắp xếp: điểm cao nhất lên đầu, tie-breaker: occurredAt mới hơn
  valid.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore
    return (b.occurredAt || 0) - (a.occurredAt || 0)
  })

  const top1 = valid[0]

  // Daily Modal Cap: Tối đa 1 Modal / Ngày
  const alreadySeenModal = memoryStore.hasSeenModalToday && memoryStore.hasSeenModalToday(memberId, now)

  if (top1.finalScore >= 75 && !alreadySeenModal) {
    return {
      mode: 'modal',
      scenario: top1,
      eventKey: top1.eventKey,
    }
  }

  if (top1.finalScore >= 40) {
    return {
      mode: 'card',
      scenario: top1,
      eventKey: top1.eventKey,
    }
  }

  return { mode: 'none', scenario: null, eventKey: null }
}

/**
 * ENTRYPOINT DUY NHẤT: Chạy toàn bộ pipeline cho 1 thành viên.
 *
 * @param {Object} db
 * @param {string} memberId
 * @param {number} [now]
 * @param {Object} [memoryStore]
 * @returns {{ mode: 'modal'|'card'|'none', scenario: Object|null, eventKey: string|null }}
 */
export function getPersonalBotEncounter(db, memberId, now = Date.now(), memoryStore = BotMemoryStore) {
  const state = inspectMemberState(db, memberId, now, memoryStore)
  if (!state) return { mode: 'none', scenario: null, eventKey: null }

  const events = detectRecentEvents(db, memberId, state, now)
  if (!events.length) return { mode: 'none', scenario: null, eventKey: null }

  const candidates = detectScenarios(events, state)
  const synergized = applySynergy(candidates, state)
  return evaluateEncounter(synergized, memberId, now, memoryStore)
}
