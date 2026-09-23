import cfg from '#config/app.json' with { type: 'json' }
import { isPresent, playerName } from '#lib/money.js'
import { DEFAULT_RATING, initialRatingOf } from '#lib/rating.js'

/**
 * TRỤC MÙA GIẢI — Điểm mùa theo cơ chế cày rank, và cơ chế treo thưởng chuỗi thắng.
 *
 * Điểm mùa sinh trực tiếp từ kết quả đối kháng: thắng cộng, thua trừ, mức cộng/trừ
 * theo chênh lệch Team Elo (đọc `match.initialRatingA/B` — ảnh chụp Elo lúc đánh).
 * Toàn bộ là hàm DẪN XUẤT: không bảng DB nào lưu điểm mùa, tính lại từ `db.matches`.
 *
 * Đây là trục THI ĐẤU. Trục GẮN BÓ (XP, level, thâm niên) nằm ở `#lib/xp.js`.
 */

/**
 * Tìm VĐV đang có chuỗi thắng dài nhất để treo thưởng Bounty.
 * @param {Object} db
 * @returns {Object|null}
 */
export function getSeasonBountyPlayer(db) {
  if (!db) return null
  const members = db.members || []
  const matches = db.matches || []

  let bestPlayer = null
  let maxStreak = 0

  members.forEach((m) => {
    // Sắp xếp MỚI NHẤT trước để đếm chuỗi thắng ĐANG chạy.
    // Trận không có `createdAt` (dbmap chỉ map `at`), sort theo createdAt là lệnh rỗng —
    // mảng giữ nguyên thứ tự tăng dần của dbmap và vòng lặp dưới đếm nhầm chuỗi từ trận CŨ NHẤT.
    // Trận giao lưu đứng ngoài trục thi đấu: nó không sinh điểm mùa, không tính vào
    // mốc 20 trận, nên cũng KHÔNG được quyền cắt đứt chuỗi thắng đang treo thưởng.
    const memberMatches = matches
      .filter((mt) => mt.ratingEnabled !== false)
      .filter((mt) => (mt.teamA || []).includes(m.id) || (mt.teamB || []).includes(m.id))
      .sort((a, b) => (b.at || 0) - (a.at || 0))

    let streak = 0
    for (const mt of memberMatches) {
      const inA = (mt.teamA || []).includes(m.id)
      const inB = (mt.teamB || []).includes(m.id)
      const won = (inA && mt.winnerTeam === 'A') || (inB && mt.winnerTeam === 'B')
      if (won) {
        streak++
      } else {
        break
      }
    }

    if (streak > maxStreak) {
      maxStreak = streak
      bestPlayer = {
        member: m,
        streak,
      }
    }
  })

  if (maxStreak >= 3 && bestPlayer) {
    return bestPlayer
  }

  return null
}

/**
 * Cấu hình mùa giải đang áp dụng: ưu tiên cài đặt riêng của CLB, fallback app.json.
 * Gom về một chỗ để engine, màn xếp sân và BXH luôn đọc cùng một nguồn.
 * @param {Object} [db]
 * @returns {Object}
 */
export function seasonConfigOf(db) {
  return db?.settings?.season || cfg?.season || {}
}

/**
 * Tính điểm Season Point delta sau mỗi trận đấu dựa trên 5 dải Elo chênh lệch giữa 2 đội.
 * Cả 2 người cùng đội nhận cùng delta; không cần đưa partner vào công thức Season Point.
 *
 * @param {number} teamElo - Elo của đội người chơi (trung bình Elo đôi hoặc Elo đơn)
 * @param {number} opponentTeamElo - Elo của đội đối thủ
 * @param {boolean} won - Kết quả trận đấu: true nếu thắng, false nếu thua
 * @param {object} [scaleConfig] - Cấu hình thang điểm (tuỳ chọn)
 * @returns {{ delta: number, tier: string, gap: number }}
 */
export function calcSeasonMatchDelta(teamElo, opponentTeamElo, won, scaleConfig = null) {
  const scale = scaleConfig || cfg?.season?.deltaScale || {
    heavyFavored: { win: 10, loss: -12 },
    favored: { win: 12, loss: -10 },
    balanced: { win: 14, loss: -8 },
    underdog: { win: 17, loss: -5 },
    deepUnderdog: { win: 22, loss: -3 },
  }

  const gap = Math.round((teamElo ?? DEFAULT_RATING) - (opponentTeamElo ?? DEFAULT_RATING))

  // Ngưỡng chia dải đọc từ `minGap` trong app.json, KHÔNG hard-code trong logic (RULES §3.2).
  // Xếp giảm dần theo minGap rồi lấy dải đầu tiên thoả `gap >= minGap` — sửa app.json là đổi
  // được luật chơi, không phải đụng code. `gap` luôn là số nguyên (đã Math.round) nên mốc
  // -49 / -149 tương đương đúng với "> -50" / "> -150" trong đặc tả.
  const FALLBACK_MIN_GAP = { heavyFavored: 150, favored: 50, balanced: -49, underdog: -149, deepUnderdog: -Infinity }
  const tiers = Object.entries(scale)
    .map(([key, val]) => ({
      key,
      minGap: Number.isFinite(val?.minGap) ? val.minGap : (FALLBACK_MIN_GAP[key] ?? -Infinity),
      win: val?.win ?? 0,
      loss: val?.loss ?? 0,
    }))
    .sort((a, b) => b.minGap - a.minGap)

  const hit = tiers.find((x) => gap >= x.minGap) || tiers[tiers.length - 1]
  return {
    delta: won ? hit.win : hit.loss,
    tier: hit.key,
    gap,
  }
}

/**
 * Delta điểm mùa CUỐI CÙNG của một trận — đã tính hệ số kèo.
 *
 * MỌI nơi cộng hoặc HIỂN THỊ điểm mùa của một trận phải đi qua đây, không gọi thẳng
 * `calcSeasonMatchDelta`. Hàm kia chỉ biết dải Elo, cố tình không biết trận đến từ đâu.
 *
 * Vì sao tách: khi hệ số kèo mới thêm vào, nó nằm bên trong `calculateSeasonLeaderboard` nên hai
 * màn preview (`CourtAssignmentTab` lúc ghi tỉ số, `MatchDetailModal` lúc xem lại trận) vẫn gọi
 * hàm gốc và hiện +14 trong khi sổ điểm ghi +28. Preview nói một đằng, điểm thật một nẻo.
 *
 * @param {number} teamElo Elo đội người chơi
 * @param {number} opponentTeamElo Elo đội đối thủ
 * @param {boolean} won thắng hay thua
 * @param {object} [opts]
 * @param {boolean} [opts.isChallenge] trận sinh từ kèo
 * @param {object} [opts.scaleConfig] thang 5 dải
 * @param {number} [opts.multiplier] hệ số kèo; bỏ trống thì đọc config
 * @returns {{ delta: number, baseDelta: number, multiplier: number, tier: string, gap: number }}
 */
export function calcSeasonMatchDeltaFinal(teamElo, opponentTeamElo, won, opts = {}) {
  const { isChallenge = false, scaleConfig = null, multiplier = null } = opts
  const base = calcSeasonMatchDelta(teamElo, opponentTeamElo, won, scaleConfig)
  const mult = Number(multiplier ?? cfg?.season?.challengeMultiplier ?? 1) || 1
  const applied = isChallenge ? mult : 1
  return {
    ...base,
    delta: applied === 1 ? base.delta : Math.round(base.delta * applied),
    baseDelta: base.delta,
    multiplier: applied,
  }
}

/** Trận này có sinh từ kèo không — một định nghĩa dùng chung, đừng chép lại điều kiện. */
export function isChallengeMatch(match) {
  return Boolean(match?.challengeId || match?.sourceType === 'challenge')
}

/** Hệ số điểm mùa của kèo đang áp dụng, ưu tiên cấu hình mùa của CLB. */
export function challengeMultiplierOf(db, season = null) {
  const s = season || db?.settings?.season || cfg?.season || {}
  return Number(s.challengeMultiplier ?? cfg?.season?.challengeMultiplier ?? 1) || 1
}

/**
 * Tìm cấu hình mùa giải áp dụng (active season) với đầy đủ fallback.
 * @param {Object} [db]
 * @param {Object} [season]
 * @returns {Object|null}
 */
export function resolveSeason(db, season = null) {
  if (season && (season.id || season.startDate || season.code)) return season
  const active = (db?.seasons || []).find((s) => s.active)
  if (active) return active
  if (db?.settings?.season) return db.settings.season
  if (Array.isArray(db?.seasons) && db.seasons.length > 0) return db.seasons[0]
  if (db?.club || db?.settings) return cfg?.season || null
  return null
}

/**
 * Lọc danh sách các trận đấu thuộc mùa giải đang xét (hoặc mùa giải hiện tại).
 * @param {Object} db
 * @param {Object} [season]
 * @returns {Array<Object>}
 */
export function seasonMatchesOf(db, season = null) {
  if (!db) return []
  const allSessions = db.sessions || []
  const allMatches = db.matches || []
  if (allMatches.length === 0) return []

  // Nếu caller không truyền season và db không có bất kỳ cấu hình season nào,
  // thì db đang ở chế độ unsegmented/all-time (hoặc mockDb test) -> trả về allMatches
  if (!season && (!Array.isArray(db.seasons) || db.seasons.length === 0) && !db.settings?.season) {
    return allMatches
  }

  const getMatchTs = (m) => {
    if (typeof m.at === 'number' && Number.isFinite(m.at)) return m.at
    if (m.at) {
      const n = Number(m.at)
      if (Number.isFinite(n) && n > 0) return n
      const d = Date.parse(m.at)
      if (!isNaN(d)) return d
    }
    const raw = m.playedAt || m.createdAt || m.ended_at || m.endedAt || ''
    if (raw) {
      const d = Date.parse(raw)
      if (!isNaN(d)) return d
    }
    return 0
  }

  const isWithin = (ts, start, end) => ts >= start && ts <= end

  const resolvedSeason = resolveSeason(db, season)

  if (!resolvedSeason || (!resolvedSeason.startDate && !resolvedSeason.endDate)) {
    return allMatches
  }

  const startTs = resolvedSeason.startDate ? Date.parse(`${resolvedSeason.startDate}T00:00:00Z`) : 0
  const endTs = resolvedSeason.endDate ? Date.parse(`${resolvedSeason.endDate}T23:59:59Z`) : Infinity

  const seasonSessions = allSessions.filter((s) => {
    const d = s.date || s.createdAt || ''
    const ts = Date.parse(d)
    return isWithin(ts, startTs, endTs)
  })
  const seasonSessionIds = new Set(seasonSessions.map((s) => s.id))

  return allMatches.filter((m) => {
    if (m.sessionId && seasonSessionIds.has(m.sessionId)) return true
    const ts = getMatchTs(m)
    return isWithin(ts, startTs, endTs)
  })
}

/**
 * Tính toán bảng xếp hạng Mùa giải theo cơ chế Cày Rank Thi Đấu (Season Points Leaderboard - Screen SS1)
 * @param {Object} db - Toàn bộ dữ liệu CLB
 * @param {Object} [customSeason] - Cấu hình mùa giải tùy biến
 */
export function calculateSeasonLeaderboard(db = {}, customSeason = null) {
  const season = resolveSeason(db, customSeason) || cfg?.season || {
    id: '2026-Q3',
    code: '2026-Q3',
    name: 'Thu Rực Lửa', // i18n-ok: default season name
    fullName: 'Mùa 3 · 2026 — Thu Rực Lửa', // i18n-ok: default season full name
    startDate: '2026-07-01',
    endDate: '2026-09-30',
    cycle: 'quarter',
    totalSessionsExpected: 14,
    minMatchesOfficial: 8,
    inactiveDays: 21,
    bonusConfig: {
      streak3: 5,
      streak5: 10,
      upset150: 5,
    },
    deltaScale: {
      heavyFavored: { win: 10, loss: -12 },
      favored: { win: 12, loss: -10 },
      balanced: { win: 14, loss: -8 },
      underdog: { win: 17, loss: -5 },
      deepUnderdog: { win: 22, loss: -3 },
    },
  }

  const bonusCfg = season.bonusConfig || cfg?.season?.bonusConfig || {
    streak3: 5,
    streak5: 10,
    upset150: 5,
  }
  // Ngưỡng Elo để tính là thắng lội ngược dòng — lấy từ config, không hard-code (RULES §3.2)
  const upsetMinGap = bonusCfg.upsetMinGap ?? 150

  // Hệ số điểm mùa cho trận sinh ra từ KÈO. Mục đích là kích cầu việc gạ kèo: cùng một trận,
  // đánh trong kèo thì đáng giá gấp đôi so với trận xếp sân thường.
  //
  // CỐ Ý phẳng — mọi kèo, mọi bên, thắng lẫn thua đều cùng một hệ số. Bản thiết kế đầu có hệ số
  // riêng cho bên gạ / bên bị gạ (2.5 khi kẻ yếu thắng, 1.0 khi kẻ yếu thua) nhưng bị bỏ vì hai
  // lẽ: (1) hệ dải Elo ở `calcSeasonMatchDelta` ĐÃ ưu ái kẻ yếu sẵn (+22 so với +14), thêm tầng
  // nữa là ưu ái hai lần chồng nhau; (2) hệ số thắng/thua lệch nhau đẻ ra lỗ hổng — kèo BO3 thua
  // 1-2 vẫn ra tổng DƯƠNG, nên gạ kèo với người mạnh nhất rồi thua cũng có lãi.
  //
  // Elo KHÔNG nhân hệ số này. Kèo tính Elo y hệt trận thường — xem `lib/rating.js`, nó không hề
  // biết trận đến từ đâu, và cố ý giữ như vậy.
  const challengeMultiplier = Number(
    season.challengeMultiplier ?? cfg?.season?.challengeMultiplier ?? 1,
  ) || 1

  const members = (db.members || []).filter((m) => m.active !== false)
  const allSessions = db.sessions || []
  const seasonMatches = seasonMatchesOf(db, season)

  // Lọc các buổi trong khung thời gian của mùa giải
  const startTs = season.startDate ? Date.parse(`${season.startDate}T00:00:00Z`) : 0
  const endTs = season.endDate ? Date.parse(`${season.endDate}T23:59:59Z`) : Infinity

  const seasonSessions = allSessions.filter((s) => {
    const d = s.date || s.createdAt || ''
    const ts = Date.parse(d)
    return ts >= startTs && ts <= endTs
  })

  // Phiếu dự đoán cũng phải bó trong khung mùa, đúng như trận. Trước đây khối tính điểm dự đoán
  // ở dưới quét thẳng `db.challengePredictions` không lọc gì — phiếu mùa trước cộng vào điểm
  // mùa này vĩnh viễn, trong khi comment ngay tại đó ghi là "thuộc mùa giải đang xét".
  // Mốc thời gian lấy `settledAt` (lúc ăn/thua) chứ không phải lúc đặt: đó mới là lúc điểm sinh ra.
  const seasonPredictions = (db.challengePredictions || []).filter((p) => {
    if (p.status !== 'won' && p.status !== 'lost') return false
    if (!p.settledAt) return false
    const ts = Date.parse(p.settledAt)
    return Number.isFinite(ts) && ts >= startTs && ts <= endTs
  })

  // Ván arcade cũng bó trong khung mùa, cùng khuôn với phiếu dự đoán. Ván hoà không sinh điểm
  // nên loại luôn ở đây cho khối tính ở dưới khỏi phải xét lại.
  const seasonArcade = (db.arcadeRounds || []).filter((r) => {
    if (r.outcome !== 'won' && r.outcome !== 'lost') return false
    const ts = Date.parse(r.createdAt || '')
    return Number.isFinite(ts) && ts >= startTs && ts <= endTs
  })

  // Sắp xếp các trận theo thời gian tăng dần (chronological) để tính điểm lũy kế sàn Floor 0 và streak.
  // BẮT BUỘC tie-break theo id: sàn Floor 0 kẹp sau MỖI trận nên phép tính phụ thuộc thứ tự
  // (thua-rồi-thắng = 14đ, thắng-rồi-thua = 6đ). Hai sân bấm lưu cùng mili-giây mà không có
  // tie-break thì cùng một bộ dữ liệu sẽ ra hai bảng điểm khác nhau giữa các lần render.
  const getMatchTs = (mt) => mt.at || (mt.playedAt ? Date.parse(mt.playedAt) : (mt.createdAt ? Date.parse(mt.createdAt) : 0))
  const sortedSeasonMatches = [...seasonMatches].sort(
    (a, b) => getMatchTs(a) - getMatchTs(b) || String(a.id || '').localeCompare(String(b.id || ''))
  )

  const startPoints = season.startPoints ?? cfg.season?.startPoints ?? 0

  const attendance = db.attendance || {}
  // Mốc so sánh trạng thái Tạm nghỉ = min(hôm nay, hết mùa). Dùng chính endTs (23:59:59 ngày
  // cuối mùa) để khớp với khung lọc trận ở trên, tránh lệch 1 ngày ở ranh giới 21 ngày.
  const refDate = season.referenceDate
    ? Date.parse(season.referenceDate)
    : Math.min(Date.now(), endTs)

  // Seed Elo theo trình độ cho trận CŨ chưa có `initialRatingA/B` (chỉ cascade mới ghi hai trường
  // này). Dựng index + cache một lần ở đây, không nằm trong vòng lặp thành viên: cùng một trận bị
  // tính lại cho cả 22 người là 22 lần quét `db.members`.
  const memberById = new Map((db.members || []).map((x) => [x.id, x]))
  const guestById = new Map((db.guests || []).map((x) => [x.id, x]))
  const seedCache = new Map()
  // Khách khai trình độ theo TỪNG BUỔI (`sessionGuests.level` — chính là thứ màn Chia sân đọc),
  // `guests.level` chỉ là mức mặc định khi buổi đó không khai.
  const guestLevelIn = (sessionId, id) => {
    const sg = (db.sessionGuests || []).find((x) => x.sessionId === sessionId && x.guestId === id)
    return sg?.level || guestById.get(id)?.level || ''
  }
  /** Seed của một người, `null` khi không tra được trình độ — KHÔNG đoán bừa. */
  const seedOf = (id, sessionId) => {
    const ck = id + '@' + (sessionId || '')
    if (seedCache.has(ck)) return seedCache.get(ck)
    const level = memberById.get(id)?.level || guestLevelIn(sessionId, id)
    const seed = level ? initialRatingOf(level, db?.levels) : null
    seedCache.set(ck, seed)
    return seed
  }
  /**
   * Elo trung bình seed của một đội. Trả `null` nếu CÓ MỘT người không tra được trình độ:
   * seed người đó bằng 0 sẽ kéo trung bình đội xuống ~250, đẩy trận thành `deepUnderdog`
   * và trao +22 thay vì +14 cho cả đội — lạm phát điểm mùa âm thầm.
   */
  const teamSeedOf = (ids, sessionId) => {
    if (!ids.length) return null
    let sum = 0
    for (const id of ids) {
      const s = seedOf(id, sessionId)
      if (s == null) return null
      sum += s
    }
    return Math.round(sum / ids.length)
  }

  const rows = members.map((m) => {
    const memberId = m.id

    // 1. Lọc trận đấu của thành viên theo thứ tự thời gian
    const myMatches = []
    const myMatchSessionIds = new Set()
    sortedSeasonMatches.forEach((mt) => {
      const pKeys = mt.playerKeys || []
      const teamA = (mt.teamA && mt.teamA.length)
        ? mt.teamA
        : (pKeys.length <= 2 ? (pKeys[0] ? [pKeys[0]] : []) : pKeys.slice(0, 2))
      const teamB = (mt.teamB && mt.teamB.length)
        ? mt.teamB
        : (pKeys.length <= 2 ? (pKeys[1] ? [pKeys[1]] : []) : pKeys.slice(2, 4))
      const inA = teamA.includes(memberId)
      const inB = teamB.includes(memberId)
      if (inA || inB) {
        // Có mặt trong buổi được ghi nhận cho MỌI trận, kể cả trận giao lưu không tính rating.
        if (mt.sessionId) myMatchSessionIds.add(mt.sessionId)

        // Trận đánh dấu "không tính rating" thì không sinh điểm mùa và không tính vào mốc 20 trận:
        // cả cơ chế cày rank dẫn xuất từ Elo, mà trận này cố ý đứng ngoài Elo.
        if (mt.ratingEnabled === false) return

        const won = (inA && mt.winnerTeam === 'A') || (inB && mt.winnerTeam === 'B')
        let ra = mt.initialRatingA
        let rb = mt.initialRatingB
        if (ra == null || rb == null) {
          const seedA = teamSeedOf(teamA, mt.sessionId)
          const seedB = teamSeedOf(teamB, mt.sessionId)
          // Thiếu trình độ của bất kỳ ai trong trận thì coi hai đội ngang nhau (dải `balanced`,
          // không upset) — thà không tính còn hơn đoán bừa rồi trao điểm sai cho cả đội.
          if (seedA == null || seedB == null) {
            ra = DEFAULT_RATING
            rb = DEFAULT_RATING
          } else {
            if (ra == null) ra = seedA
            if (rb == null) rb = seedB
          }
        }
        const myElo = inA ? ra : rb
        const oppElo = inA ? rb : ra
        const isThreeSets = (mt.sets || []).length >= 3
        const isUpset = won && (oppElo - myElo >= upsetMinGap)

        myMatches.push({
          ...mt,
          teamA,
          teamB,
          inA,
          won,
          myElo,
          oppElo,
          isThreeSets,
          isUpset,
          at: getMatchTs(mt),
        })
      }
    })

    // 2. Tính điểm trận, thưởng mốc và sàn Floor = 0
    // Mỗi người vào mùa với một số điểm sẵn. Nó KHÔNG đổi thứ hạng, khoảng cách hay độ đảo
    // hạng — cộng cùng một hằng số cho tất cả thì mọi thứ giữ nguyên. Việc nó làm là ĐẨY SÀN 0
    // RA XA: sàn kẹp sau mỗi trận, ai chạm 0 thì các trận thua tiếp theo thành miễn phí và điểm
    // sinh ra từ hư không. Với 100 điểm đệm, người thắng từ ~25% trở lên không bao giờ chạm sàn.
    // Điểm khởi đầu chỉ cấp cho người ĐÃ RA SÂN ít nhất một trận hoặc BOT CLB (isBot). Cấp cho
    // cả người chưa đánh thì họ đứng trên người có đi tập mà thua. Bot không ra sân đánh badminton
    // nhưng là thành viên tham gia nền kinh tế cược/Arcade nên bắt đầu với đúng startPoints.
    let totalSeasonPoints = (myMatches.length || m.isBot) ? startPoints : 0
    let streak = 0
    let matchNetPts = 0
    let streakBonusPts = 0
    let upsetBonusPts = 0
    let upsetsCount = 0
    const matchLogs = []

    // Gom các set theo KÈO trước khi cộng điểm. Một kèo BO3 sinh 2-3 trận riêng trong `matches`,
    // nhưng với chuỗi thắng thì nó phải đếm là MỘT lần — không thì thắng một kèo BO3 2-0 đã cho
    // streak 2, và BO3 biến thành đường cày mốc thưởng streak 3/5.
    // `lastIdx` đánh dấu set cuối của kèo: đó là chỗ duy nhất chuỗi được cập nhật.
    const chalAgg = new Map()
    myMatches.forEach((mt, idx) => {
      if (!mt.challengeId) return
      const cur = chalAgg.get(mt.challengeId) || { wins: 0, losses: 0, lastIdx: idx }
      if (mt.won) cur.wins += 1
      else cur.losses += 1
      cur.lastIdx = idx
      chalAgg.set(mt.challengeId, cur)
    })

    myMatches.forEach((match, idx) => {
      // Hệ số kèo áp cho TỪNG set: kèo BO3 thắng 2-0 ăn gấp đôi kèo BO1 thắng. Đó là chủ đích
      // (kích cầu), không phải sót — xem ghi chú ở `challengeMultiplier`.
      // Đi qua `calcSeasonMatchDeltaFinal` để dùng CHUNG luật với hai màn preview.
      const { delta, tier, gap } = calcSeasonMatchDeltaFinal(match.myElo, match.oppElo, match.won, {
        isChallenge: isChallengeMatch(match),
        scaleConfig: season.deltaScale,
        multiplier: challengeMultiplier,
      })

      let matchBonus = 0
      let earnedStreakBonus = 0
      let earnedUpsetBonus = 0

      // Set giữa chuỗi không đụng tới streak; set cuối tính một lần theo kết quả CẢ kèo.
      const agg = match.challengeId ? chalAgg.get(match.challengeId) : null
      const countsForStreak = !agg || agg.lastIdx === idx
      const streakWon = agg ? agg.wins > agg.losses : match.won

      if (countsForStreak) {
        if (streakWon) {
          streak++
          if (streak === 3) {
            earnedStreakBonus = bonusCfg.streak3 || 5
            streakBonusPts += earnedStreakBonus
            matchBonus += earnedStreakBonus
          } else if (streak === 5) {
            earnedStreakBonus = bonusCfg.streak5 || 10
            streakBonusPts += earnedStreakBonus
            matchBonus += earnedStreakBonus
          }
        } else {
          streak = 0
        }
      }

      // Upset CỐ Ý vẫn tính theo từng set: nó thưởng cho việc hạ đối thủ mạnh trong một ván cụ
      // thể, không phải cho cả chuỗi. Gom nó theo kèo là đổi ý nghĩa của mốc thưởng.
      if (match.won && match.isUpset) {
        upsetsCount++
        earnedUpsetBonus = bonusCfg.upset150 || 5
        upsetBonusPts += earnedUpsetBonus
        matchBonus += earnedUpsetBonus
      }

      matchNetPts += delta
      const netGain = delta + matchBonus
      const prevPoints = totalSeasonPoints
      totalSeasonPoints = Math.max(0, totalSeasonPoints + netGain)
      const effectiveChange = totalSeasonPoints - prevPoints

      matchLogs.push({
        ...match,
        delta,
        tier,
        gap,
        matchBonus,
        earnedStreakBonus,
        earnedUpsetBonus,
        effectiveChange,
        pointsAfter: totalSeasonPoints,
      })
    })

    // 2b. Điểm dự đoán kèo đấu (Prediction Net Points)
    //
    // TRẦN +15 CHỈ CHẶN CHIỀU THẮNG. Trước đây kẹp đối xứng [-15, +15], và cái sàn đó là một lỗ
    // hổng cược miễn phí: chạm -15 rồi thì thua thêm KHÔNG mất gì nữa trong khi thắng vẫn được
    // cộng — cứ thua cho đủ 15 rồi cược mức cao mãi, chỉ có lợi. Bỏ sàn thì thua trừ thật, và
    // luật "hết điểm là không được cược" (`availableSeasonPoints`) mới có răng.
    //
    // Trần thắng giữ nguyên để bảng xếp hạng vẫn là bảng THI ĐẤU: không ai leo hạng bằng cách
    // ngồi ngoài đoán kèo.
    const myPredictions = seasonPredictions.filter((p) => p.memberId === memberId)
    let predictionWonPoints = 0
    let predictionLostPoints = 0
    myPredictions.forEach((p) => {
      const pts = Number(p.stakePoints) || 0
      if (p.status === 'won') predictionWonPoints += pts
      else if (p.status === 'lost') predictionLostPoints += pts
    })
    const rawPredictionNet = predictionWonPoints - predictionLostPoints
    // ĐÃ BỎ TRẦN +15 (2026-09-21, theo quyết định của chủ CLB).
    //
    // Trần cũ đặt ra để "bảng xếp hạng vẫn là bảng THI ĐẤU: không ai leo hạng bằng cách ngồi
    // ngoài đoán kèo". Chủ trương đổi: điểm mùa giờ vừa là điểm BXH vừa là TÀI SẢN đem đi cược,
    // mà trần thắng cộng với thua-không-trần thì cược luôn là lỗ về kỳ vọng — không ai dám cược,
    // và cả tính năng chết yểu. Hệ quả đã biết và chấp nhận: người cược giỏi leo được cao hơn
    // người đánh nhiều.
    const predictionNetPoints = rawPredictionNet

    // Arcade — ván tay đôi với bot. MỘT dòng mang CẢ HAI phe: người chơi là `memberId`, bot là
    // `opponentId`, phe bot là dấu ngược. Nhờ vậy tổng điểm hai bên luôn bằng không mà không cần
    // ai canh — tách thành hai dòng là mở đường cho hai phe lệch nhau.
    let arcadeNetPoints = 0
    seasonArcade.forEach((r) => {
      const pts = Number(r.stake) || 0
      const playerDelta = r.outcome === 'won' ? pts : -pts
      if (r.memberId === memberId) arcadeNetPoints += playerDelta
      else if (r.opponentId === memberId) arcadeNetPoints -= playerDelta
    })

    const matchPointsOnly = totalSeasonPoints
    // Sàn 0 của TỔNG vẫn giữ, và nó KHÔNG phá luật tổng-bằng-không: `availableSeasonPoints` chặn
    // không ai cược quá số đang có, nên tổng không bao giờ xuống dưới 0 để sàn phải cắt. Ở đây
    // nó là lưới an toàn cho dữ liệu hỏng, không phải một luật chơi.
    //
    // ⚠️ BACKTEST KHÔNG GÁC KHỐI NÀY. `backtest/data/*.json` chỉ chứa `matches` — không có phiếu
    // cược hay ván arcade nào — nên mọi thay đổi trong khối điểm cược đều cho ra số y hệt và test
    // vẫn xanh. Sửa ở đây thì phải tự nghĩ cách kiểm; đừng tin màu xanh của backtest.
    totalSeasonPoints = Math.max(0, matchPointsOnly + predictionNetPoints + arcadeNetPoints)

    // Cột "điểm sau" của sổ cái.
    //
    // Vòng lặp trận ở trên chỉ cộng điểm TRẬN, còn điểm dự đoán cộng một phát ở cuối — nên
    // `pointsAfter` của từng trận không bao giờ cộng ra `totalSeasonPoints`, và người đọc sổ
    // thấy cột cuối vênh với tổng mà không hiểu vì sao.
    //
    // Sửa bằng một lượt quét SAU, không đụng vào vòng lặp trận: `matchPointsOnly` phải giữ
    // nguyên từng bit, nếu không là đổi điểm mùa của cả CLB (LUẬT SỐ 0 — backtest).
    // Mỗi mốc cộng thêm phần điểm dự đoán đã quyết toán TRƯỚC thời điểm đó, kẹp cùng công thức
    // Dựng sự kiện ngoài trận đấu (Dự đoán + Arcade) theo trình tự thời gian
    const myArcade = seasonArcade.filter((r) => r.memberId === memberId || r.opponentId === memberId)
    const nonMatchEvents = [
      ...myPredictions.map((p) => ({
        type: 'prediction',
        at: Date.parse(p.settledAt || ''),
        numPts: (p.status === 'won' ? 1 : -1) * (Number(p.stakePoints) || 0),
        item: p,
      })),
      ...myArcade.map((r) => {
        const isPlayer = r.memberId === memberId
        const outcome = isPlayer ? r.outcome : (r.outcome === 'won' ? 'lost' : (r.outcome === 'lost' ? 'won' : 'draw'))
        const numPts = outcome === 'won' ? (Number(r.stake) || 0) : (outcome === 'lost' ? -(Number(r.stake) || 0) : 0)
        return {
          type: 'arcade',
          at: Date.parse(r.createdAt || ''),
          numPts,
          outcome,
          item: r,
        }
      }),
    ].sort((a, b) => (a.at || 0) - (b.at || 0))

    const predictionLogs = []
    const arcadeLogs = []
    let nonMatchNetSoFar = 0
    let nmIdx = 0
    let matchPtsSoFar = (myMatches.length || m.isBot) ? startPoints : 0

    matchLogs.forEach((log) => {
      const at = Number(log.at) || 0
      while (nmIdx < nonMatchEvents.length && (nonMatchEvents[nmIdx].at || 0) <= at) {
        const ev = nonMatchEvents[nmIdx]
        nonMatchNetSoFar += ev.numPts
        const currentPtsAfter = Math.max(0, matchPtsSoFar + nonMatchNetSoFar)
        if (ev.type === 'prediction') {
          predictionLogs.push({
            prediction: ev.item,
            at: ev.at,
            numPts: ev.numPts,
            pointsAfter: currentPtsAfter,
          })
        } else if (ev.type === 'arcade') {
          arcadeLogs.push({
            round: ev.item,
            outcome: ev.outcome,
            at: ev.at,
            numPts: ev.numPts,
            pointsAfter: currentPtsAfter,
          })
        }
        nmIdx++
      }
      matchPtsSoFar = log.pointsAfter
      log.pointsAfter = Math.max(0, matchPtsSoFar + nonMatchNetSoFar)
    })

    while (nmIdx < nonMatchEvents.length) {
      const ev = nonMatchEvents[nmIdx]
      nonMatchNetSoFar += ev.numPts
      const currentPtsAfter = Math.max(0, matchPtsSoFar + nonMatchNetSoFar)
      if (ev.type === 'prediction') {
        predictionLogs.push({
          prediction: ev.item,
          at: ev.at,
          numPts: ev.numPts,
          pointsAfter: currentPtsAfter,
        })
      } else if (ev.type === 'arcade') {
        arcadeLogs.push({
          round: ev.item,
          outcome: ev.outcome,
          at: ev.at,
          numPts: ev.numPts,
          pointsAfter: currentPtsAfter,
        })
      }
      nmIdx++
    }

    // 3. Số buổi có mặt
    let attendedCount = 0
    seasonSessions.forEach((s) => {
      const attMap = attendance[s.id] || (typeof s.attendance === 'object' && !Array.isArray(s.attendance) ? s.attendance : {})
      const inAttMap = isPresent(attMap[memberId])
      const inAttendees = (s.attendees || []).some((a) => (typeof a === 'string' ? a === memberId : a.memberId === memberId))
      const inAttArr = Array.isArray(s.attendance) && s.attendance.some((a) => (a.memberId === memberId || a.id === memberId) && (a.status === 'present' || a.present === true))
      const playedInSession = myMatchSessionIds.has(s.id)

      if (inAttMap || inAttendees || inAttArr || playedInSession) {
        attendedCount++
      }
    })

    const matchesCount = myMatches.length
    const winsCount = myMatches.filter((x) => x.won).length
    const lossesCount = matchesCount - winsCount
    const threeSetsCount = myMatches.filter((x) => x.isThreeSets).length
    const winRate = matchesCount > 0 ? Math.round((winsCount / matchesCount) * 100) : 0

    const lastMatch = myMatches[myMatches.length - 1]
    const lastMatchAt = lastMatch ? lastMatch.at : null
    const daysSinceLastMatch = lastMatchAt ? Math.max(0, Math.floor((refDate - lastMatchAt) / (1000 * 60 * 60 * 24))) : null
    const isInactive = matchesCount > 0 && daysSinceLastMatch > (season.inactiveDays || 21)
    // `??` chu khong phai `||`: dat nguong = 0 la co y TAT cai cong nay di, con `||` thi 0 bi
    // coi la thieu cau hinh va roi ve mac dinh — tat khong duoc.
    const isQualified = matchesCount >= (season.minMatchesOfficial ?? 8)

    return {
      id: m.id,
      member: m,
      name: m.name,
      avatar: m.avatarUrl || m.avatar || '',
      avatarUrl: m.avatarUrl || m.avatar || '',
      gender: m.gender,
      level: m.level,
      totalSeasonPoints,
      attendedCount,
      totalSessionsExpected: season.totalSessionsExpected || 14,
      matchesCount,
      winsCount,
      lossesCount,
      winRate,
      upsetsCount,
      threeSetsCount,
      streak,
      isInactive,
      isQualified,
      daysSinceLastMatch,
      lastMatchAt,
      matchLogs,
      predictionLogs,
      arcadeLogs,
      breakdown: {
        matchNetPts,
        streakBonusPts,
        upsetBonusPts,
        matchPointsOnly,
        predictionWonPoints,
        predictionLostPoints,
        predictionNetPoints,
        rawPredictionNet,
        arcadeNetPoints,
      },
    }
  })

  // Thứ tự BXH: (1) người đủ điều kiện tranh huy chương đứng trên người còn đang thẩm định,
  // (2) điểm mùa giảm dần, (3) số trận thắng, (4) tỷ lệ thắng.
  // Ưu tiên 1 chính là cơ chế chống "ôm rank": đánh 3 trận thắng cả 3 (~42đ) không được
  // đứng trên người đã cày 25 trận, dù điểm tuyệt đối có cao hơn.
  rows.sort((a, b) => (
    (Number(b.isQualified) - Number(a.isQualified))
    || (b.totalSeasonPoints - a.totalSeasonPoints)
    || (b.winsCount - a.winsCount)
    || (b.winRate - a.winRate)
  ))

  // Đánh số thứ hạng 1..N
  rows.forEach((row, idx) => {
    row.rank = idx + 1
  })

  // Tính thống kê tổng hợp mùa
  const totalSeasonPoints = rows.reduce((sum, r) => sum + r.totalSeasonPoints, 0)
  const totalSeasonMatches = seasonMatches.length
  const leaderPlayer = rows[0] || null
  const mostAttendedPlayer = [...rows].sort((a, b) => b.attendedCount - a.attendedCount)[0] || null
  const mostUpsetsPlayer = [...rows].sort((a, b) => b.upsetsCount - a.upsetsCount)[0] || null

  return {
    season,
    leaderboard: rows,
    topStats: {
      totalSeasonPoints,
      totalSeasonMatches,
      leaderPlayer,
      mostAttendedPlayer,
      mostUpsetsPlayer,
      playedSessionsCount: seasonSessions.length,
    },
  }
}

/**
 * Lấy sổ điểm mùa giải chi tiết (Audit Ledger) của một VĐV (Screen SS3)
 */
export function getMemberSeasonLedger(memberId, db = {}, customSeason = null) {
  if (!memberId || !db) return null
  const { season, leaderboard } = calculateSeasonLeaderboard(db, customSeason)
  const memberRow = leaderboard.find((r) => r.id === memberId)
  if (!memberRow) return null

  // Tìm khoảng cách điểm với người đứng trên
  let ptsToNextRank = 0
  if (memberRow.rank > 1) {
    const higherRow = leaderboard[memberRow.rank - 2]
    ptsToNextRank = Math.max(0, higherRow.totalSeasonPoints - memberRow.totalSeasonPoints)
  }

  // Danh sách các trận trong mùa (mới nhất lên đầu)
  const allLogs = memberRow.matchLogs || []
  const recentLogs = [...allLogs].reverse().slice(0, 15)

  let latestSessionPts = 0
  const latestSessionId = allLogs[allLogs.length - 1]?.sessionId || null
  if (latestSessionId) {
    allLogs.filter((m) => m.sessionId === latestSessionId).forEach((m) => {
      latestSessionPts += (m.effectiveChange ?? 0)
    })
  }

  // Trả về KEY + tham số, không dựng sẵn câu chữ — cùng pattern với getMemberXpLedger ở trên.
  // lib/ là hàm thuần, câu chữ do component render bằng t() (RULES §3.1).
  const memberNameOf = (id) => playerName(db, id) || id

  const events = recentLogs.map((m) => {
    // Giờ thật của trận, giờ địa phương. Nhánh cũ đọc `m.createdAt` (không tồn tại trên
    // trận lấy từ Supabase) nên luôn rơi vào chuỗi bịa `19:${20 + idx*20}` — từ dòng thứ 3
    // trở đi in ra "19:60", "19:80", "19:100"… là giờ không có thật.
    const timeStr = m.at ? new Date(m.at).toTimeString().slice(0, 5) : ''

    // Tỷ số tính theo góc nhìn người chơi (mình trước, đối thủ sau)
    const scoreStr = (m.sets || []).map((s) => {
      const myPts = m.inA ? s[0] : s[1]
      const oppPts = m.inA ? s[1] : s[0]
      return `${myPts}–${oppPts}`
    }).join(', ') || ''

    const isChallenge = Boolean(m.challengeId || m.sourceType === 'challenge')
    const myTeamIds = m.inA ? (m.teamA || []) : (m.teamB || [])
    const oppTeamIds = m.inA ? (m.teamB || []) : (m.teamA || [])
    const partnerId = myTeamIds.find((id) => id !== memberId)
    const partnerName = partnerId ? memberNameOf(partnerId) : null
    const oppNames = oppTeamIds.map(memberNameOf)
    const oppNamesStr = oppNames.join(', ')

    const gapStr = m.gap >= 0 ? `+${m.gap}` : `${m.gap}`
    const sign = m.effectiveChange > 0 ? `+${m.effectiveChange}` : `${m.effectiveChange}`

    return {
      id: m.id,
      time: timeStr,
      titleKey: m.won ? 'season.ledgerWin' : 'season.ledgerLoss',
      scoreText: scoreStr,
      gapText: gapStr,
      streakBonus: m.earnedStreakBonus || 0,
      upsetBonus: m.earnedUpsetBonus || 0,
      pts: sign,
      numPts: m.effectiveChange,
      pointsAfter: m.pointsAfter,
      type: m.won ? 'win' : 'loss',
      isUpset: Boolean(m.earnedUpsetBonus),
      gap: m.gap,
      tier: m.tier,
      isChallenge,
      partnerName,
      oppNamesStr,
      at: m.at || 0,
    }
  })

  // Phiếu dự đoán lấy thẳng `predictionLogs` do `calculateSeasonLeaderboard` dựng: nó đã bó
  // trong khung mùa VÀ mang sẵn `pointsAfter` tính cùng một dòng thời gian với các trận. Dựng
  // lại ở đây là có hai công thức cho một con số, và đó đúng là lý do cột "điểm sau" từng vênh.
  const predEvents = (memberRow.predictionLogs || []).map((log) => {
    const p = log.prediction
    const isWon = p.status === 'won'
    const chal = (db.challenges || []).find((c) => c.id === p.challengeId)
    const code = chal?.code || ''
    return {
      time: p.settledAt ? new Date(p.settledAt).toTimeString().slice(0, 5) : '',
      titleKey: isWon ? 'season.ledgerPredictionWon' : 'season.ledgerPredictionLost',
      code,
      scoreText: code,
      gapText: '',
      pts: log.numPts > 0 ? `+${log.numPts}` : String(log.numPts),
      numPts: log.numPts,
      pointsAfter: log.pointsAfter,
      type: isWon ? 'win' : 'loss',
      isPrediction: true,
      at: log.at || 0,
    }
  })

  const arcadeEvents = (memberRow.arcadeLogs || []).map((log) => {
    const r = log.round
    const isWon = log.outcome === 'won'
    const isLost = log.outcome === 'lost'
    const oppId = r.memberId === memberId ? r.opponentId : r.memberId
    const oppName = memberNameOf(oppId)
    const titleKey = isWon
      ? 'season.ledgerArcadeWon'
      : (isLost ? 'season.ledgerArcadeLost' : 'season.ledgerArcadeDraw')
    return {
      id: r.id,
      time: r.createdAt ? new Date(r.createdAt).toTimeString().slice(0, 5) : '',
      titleKey,
      oppName,
      scoreText: oppName,
      gapText: '',
      pts: log.numPts > 0 ? `+${log.numPts}` : String(log.numPts),
      numPts: log.numPts,
      pointsAfter: log.pointsAfter,
      type: isWon ? 'win' : (isLost ? 'loss' : 'draw'),
      isArcade: true,
      at: log.at || 0,
    }
  })

  const combinedEvents = [...events, ...predEvents, ...arcadeEvents].sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 10)

  return {
    season,
    member: memberRow.member,
    totalPoints: memberRow.totalSeasonPoints,
    rank: memberRow.rank,
    totalMembers: leaderboard.length,
    latestSessionPts,
    ptsToNextRank,
    isInactive: memberRow.isInactive,
    isQualified: memberRow.isQualified,
    daysSinceLastMatch: memberRow.daysSinceLastMatch,
    breakdown: memberRow.breakdown,
    recentEvents: combinedEvents,
  }
}

/**
 * Trả về danh sách xếp hạng mùa giải dạng mảng phẳng rows.
 * @param {Object} db
 * @param {Object} [season]
 * @returns {Array}
 */
export function getSeasonRankLeaderboard(db, season) {
  return calculateSeasonLeaderboard(db, season)?.leaderboard || []
}
