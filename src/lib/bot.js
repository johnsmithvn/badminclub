// Bộ não của Bot CLB — chọn hai người cho kèo mà bot tự dựng.
// Pure functions, không React / không Supabase / không tiếng Việt (RULES §3.1: câu chữ ở i18n).
//
// PHÂN VAI. File này chỉ QUYẾT ĐỊNH. Việc ghi xuống DB nằm ở RPC `create_bot_challenge`
// (migration 0055), vì RLS cố ý cấm client tạo kèo hộ người khác. Mọi luật gác đều được RPC
// kiểm lại — những cổng ở đây chỉ để KHỎI GỌI RPC VÔ ÍCH, không phải để bảo vệ.
//
// Đây là chỗ rẻ nhất để bot "sống" thêm: thêm tiêu chí săn kèo, thêm tính cách, thêm kiểu chọn
// người đều chỉ là thêm nhánh ở đây + một dòng trong `vi.json`. Không migration, không SQL.

import {
  challengeExpiryAt,
  canMemberPredict,
  availableSeasonPoints,
  getMemberPrediction,
} from '#lib/challenge.js'
import { detectMatchNarrative, formatTeamNames } from '#lib/activity.js'
import { getPlayerRating, expectedScore, DEFAULT_RATING } from '#lib/rating.js'
import { calculateSeasonLeaderboard } from '#lib/season.js'
import {
  getClubEloLeaderboard,
  getPlayerForm5,
  getRecentEloDelta,
  getDeterministicRoll,
} from '#lib/homePersonal.js'

/** Mã lý do bot chọn cặp này. Text tương ứng nằm ở `vi.json: bot.reason.*`. */
export const BOT_REASONS = ['rank_neighbor', 'streak_hunt']

/**
 * Số biến thể câu thoại của từng mã, theo nhóm.
 *
 * ĐÂY LÀ BẢN HỢP ĐỒNG VỚI `vi.json`: mỗi mã phải có đúng ngần này key đánh số 1..n dưới
 * `bot.<nhóm>.<mã>`. Thêm câu thì tăng số ở đây, thiếu key là `t()` trả về chính chuỗi khoá.
 * Giữ ở một chỗ để không phải đếm tay khi thêm câu.
 */
export const BOT_LINE_VARIANTS = {
  reason:   { rank_neighbor: 4, streak_hunt: 4 },
  taunt:    { top1: 3, chaser: 3, win_streak: 3, lose_streak: 3, rank_up: 3, rank_down: 3, rookie: 3, idle: 3, plain: 3 },
  reaction: { blowout: 3, clutch: 3, normal: 3 },
  remark:   { rank_climb: 3, rank_drop: 3, streak: 3 },
  bet:      { favourite: 3, underdog: 3, tilt: 3, won: 3, lost: 3 },
  arcade:   { offer: 4, won: 3, lost: 3, draw: 3, capped: 2, broke: 2 },
}

/**
 * Khoá i18n của một câu thoại, chọn biến thể bằng hạt giống.
 *
 * Hạt giống quyết định câu nào — nên truyền thứ CỐ ĐỊNH theo đối tượng (id kèo, id dòng hoạt
 * động, id người + ngày). Truyền `Math.random()` là mỗi lần re-render bot lại đổi giọng.
 *
 * @returns {string|null} null khi mã không có trong bảng biến thể.
 */
export function botLineKey(group, kind, seed) {
  const n = BOT_LINE_VARIANTS[group]?.[kind]
  if (!n) return null
  return `bot.${group}.${kind}.${getDeterministicRoll(String(seed), n) + 1}`
}

/** Dưới ngần này trận thì Elo chưa nói lên điều gì — không đem ra gạ kèo. */
const MIN_GAMES = 5

/** Chuỗi thắng từ đây trở lên thì đáng để bot đi săn. */
const HOT_STREAK = 3

/** Chọn ngẫu nhiên-nhưng-ổn-định trong ngần này cặp tốt nhất, để bot không lặp một cặp mãi. */
const TOP_CANDIDATES = 5

/** Ít hơn ngần này ứng viên thì CLB quá mỏng, gạ kèo chỉ quanh đi quẩn lại vài người. */
const MIN_CANDIDATES = 4

/** Trạng thái kèo coi là "đang dính" — người trong đó không nhận thêm kèo của bot. */
const BUSY_STATUSES = ['pending', 'accepted', 'oncourt']

/**
 * Thành viên được đánh dấu là bot của CLB.
 * @param {Object} db
 * @returns {Object|null}
 */
export function findBotMember(db) {
  return (db?.members || []).find((m) => m && m.isBot && m.active !== false) || null
}

/**
 * Bot có được dựng kèo mới lúc này không.
 *
 * MỘT phép kiểm cho CẢ HAI luật, và đó không phải trùng hợp: hạn nhận kèo của bot được đặt
 * bằng đúng nhịp giữa hai kèo (24h, xem migration 0055). Nên `expiresAt` của kèo bot vừa là
 * mốc hết hạn nhận, vừa là mốc hết nhịp:
 *
 *   · kèo còn mở nhận      -> expiry > now -> đóng cổng (luật "1 kèo sống")
 *   · kèo đã nhận, tạo 3h trước -> expiry > now -> đóng cổng (luật "1 kèo / 24h")
 *   · kèo tạo 25h trước    -> expiry < now -> mở cổng
 *
 * Đổi một trong hai con số ở 0055 thì phải đổi cả hai, không thì chỗ này suy sai.
 *
 * @param {Object} db
 * @param {number} [now]
 * @returns {boolean}
 */
export function botGateOpen(db, now = Date.now()) {
  const bot = findBotMember(db)
  if (!bot) return false
  return !(db.challenges || []).some((c) => {
    if (!c || c.createdBy !== bot.id) return false
    const expiry = challengeExpiryAt(c)
    return expiry != null && expiry > now
  })
}

/** Id của mọi người đang dính một kèo chưa xong. */
function busyMemberIds(db) {
  const busy = new Set()
  ;(db.challenges || []).forEach((c) => {
    if (!c || !BUSY_STATUSES.includes(c.status)) return
    ;[...(c.teamA || []), ...(c.teamB || [])].forEach((id) => busy.add(id))
  })
  return busy
}

/**
 * Chuỗi thắng hiện tại, 0 nếu không tính được.
 *
 * ponytail: mỗi lần gọi, `getPlayerForm5` -> `getMemberStreak` lại lọc `seasonMatchesOf(db)` từ
 * đầu. `pickBotChallenge` và `pickBotRemark` gọi nó một lần cho mỗi ứng viên, nên CLB N người là
 * N lần quét toàn bộ trận — chạy một lần mỗi lượt nạp CLB nên vài mili giây, chấp nhận được ở
 * quy mô một CLB. Nếu có lúc thấy giật: `getMemberStreak` đã có sẵn tham số
 * `preloadedSeasonMatches`, lọc một lần rồi truyền xuống là hết.
 */
function streakOf(db, memberId) {
  const form = getPlayerForm5(db, memberId)
  const n = Number(form?.streak) || 0
  return n > 0 ? n : 0
}

/**
 * Chọn cặp đấu cho kèo kế tiếp của bot.
 *
 * Ứng viên là các cặp KỀ NHAU trên BXH Elo: kề nhau nghĩa là Elo sát nhau, mà Elo sát nhau thì
 * trận hay — đó là tiêu chí duy nhất đáng tin khi bot chưa có tính cách. Cộng điểm cho cặp có
 * người đang ôm chuỗi thắng, vì đó mới là chuyện CLB muốn xem.
 *
 * Chọn bằng `getDeterministicRoll` với hạt giống theo NGÀY: mọi người mở app đều thấy CÙNG một
 * kèo, và màn hình re-render bao nhiêu lần cũng không đổi cặp.
 *
 * @param {Object} db
 * @param {number} [now]
 * @returns {{ aId: string, bId: string, reason: string }|null}
 */
export function pickBotChallenge(db, now = Date.now()) {
  if (!db || !db.clubId) return null
  const bot = findBotMember(db)
  if (!bot || !botGateOpen(db, now)) return null

  const busy = busyMemberIds(db)
  const board = getClubEloLeaderboard(db).filter((row) => (
    row.id !== bot.id && row.gamesCount >= MIN_GAMES && !busy.has(row.id)
  ))
  if (board.length < MIN_CANDIDATES) return null

  // Mỗi người nằm trong hai cặp kề nhau, mà `streakOf` phải quét lại toàn bộ trận mỗi lần gọi.
  // Không có cache thì mọi người đều được tính chuỗi thắng đúng hai lần.
  const streakCache = new Map()
  const streakMemo = (id) => {
    if (!streakCache.has(id)) streakCache.set(id, streakOf(db, id))
    return streakCache.get(id)
  }

  const pairs = []
  for (let i = 0; i < board.length - 1; i++) {
    const a = board[i]
    const b = board[i + 1]
    const streak = Math.max(streakMemo(a.id), streakMemo(b.id))
    const hot = streak >= HOT_STREAK
    pairs.push({
      aId: a.id,
      bId: b.id,
      reason: hot ? 'streak_hunt' : 'rank_neighbor',
      // Cặp có streak luôn đứng trên mọi cặp không có; trong cùng nhóm thì Elo càng sát càng cao.
      score: (hot ? 1e6 : 0) + streak * 1000 - Math.abs(a.elo - b.elo),
    })
  }
  if (!pairs.length) return null

  pairs.sort((x, y) => y.score - x.score)
  const top = pairs.slice(0, TOP_CANDIDATES)
  const seed = `bot-challenge:${db.clubId}:${new Date(now).toDateString()}`
  const picked = top[getDeterministicRoll(seed, top.length)]

  return { aId: picked.aId, bId: picked.bId, reason: picked.reason }
}

/* ===========================================================================
 * GIỌNG CỦA BOT
 *
 * Ba hàm dưới đây KHÔNG ghi gì xuống DB. Bot "nói" bằng cách được tính lại lúc render, y như
 * `getPersonalGreeting` đang làm với lời chào — dữ liệu đã có sẵn thì lưu thêm một bản câu chữ
 * chỉ tạo ra chỗ để lệch nhau.
 *
 * Ngoại lệ duy nhất là `pickBotRemark`: bình luận toàn CLB thì mọi người phải thấy CÙNG một dòng
 * vào CÙNG một lúc, nên nó mới cần ghi qua RPC `post_bot_remark`.
 * =========================================================================== */

/** Elo biến động trong 7 ngày từ mức này trở lên thì đáng để bot mở miệng. */
const TAUNT_ELO_SWING = 30

/** Ngưỡng cao hơn cho bình luận toàn CLB — chuyện phải đủ to mới đáng làm phiền cả CLB. */
const REMARK_ELO_SWING = 40

/** Chuỗi thắng đáng để bot nhắc trước cả CLB. */
const REMARK_STREAK = 4

/**
 * Bot nói riêng với MỘT người — câu này chỉ người đó thấy, khi họ mở app.
 *
 * Không ghi DB, không thông báo ai, không ai khác đọc được. Vì vậy nó là chỗ rẻ nhất để bot có
 * tính cách: thêm trạng thái ở đây + thêm câu trong `vi.json` là xong, không migration.
 *
 * Cùng một người trong cùng một NGÀY luôn nhận cùng một câu — không thì mỗi lần chuyển tab bot
 * lại nói một kiểu, đọc như máy hỏng chứ không như nhân vật.
 *
 * (Việc dò trạng thái ở đây trùng ý với `getPersonalGreeting`, nhưng hàm đó chỉ trả ra khoá i18n
 * chứ không trả trạng thái, nên không tái dùng được mà không mổ lại nó — một hàm 170 dòng đang
 * chạy ở màn hình chính. Không đáng.)
 *
 * @returns {{ lineKey: string, params: Object }|null}
 */
export function getBotTaunt(db, memberId, now = Date.now()) {
  if (!db || !memberId) return null
  const bot = findBotMember(db)
  // Bot không cà khịa chính nó — bạn đăng nhập vào tài khoản bot thì nó im.
  if (!bot || bot.id === memberId) return null

  const board = getClubEloLeaderboard(db)
  const me = board.find((row) => row.id === memberId)
  if (!me) return null

  const form = getPlayerForm5(db, memberId)
  const played = (form.matches || []).length
  const delta = Math.round(getRecentEloDelta(db, memberId, 7) || 0)
  // Dùng thứ hạng THẬT của bảng (bot cũng nằm trong đó) để con số bot nói khớp với con số
  // `HeroRankCard` đang hiện. Hai chỗ lệch nhau một bậc là người ta tưởng app tính sai.
  const above = me.rank > 1 ? board[me.rank - 2] : null

  const states = []
  if (me.gamesCount < MIN_GAMES) states.push({ kind: 'rookie', params: { n: me.gamesCount } })
  if (me.rank === 1) states.push({ kind: 'top1', params: {} })
  if (me.rank >= 2 && me.rank <= 3 && above) states.push({ kind: 'chaser', params: { above: above.name } })
  if (form.streak >= 3) states.push({ kind: 'win_streak', params: { n: form.streak } })
  if (played >= 3 && form.winsCount === 0) states.push({ kind: 'lose_streak', params: { n: played } })
  if (delta >= TAUNT_ELO_SWING) states.push({ kind: 'rank_up', params: { n: delta } })
  if (delta <= -TAUNT_ELO_SWING) states.push({ kind: 'rank_down', params: { n: Math.abs(delta) } })
  if (!played) states.push({ kind: 'idle', params: {} })
  // Lưng chừng bảng, phong độ phẳng: vẫn phải có gì đó để nói.
  if (!states.length) states.push({ kind: 'plain', params: {} })

  const seed = `bot-taunt:${memberId}:${new Date(now).toDateString()}`
  const picked = states[getDeterministicRoll(`${seed}:state`, states.length)]

  return {
    lineKey: botLineKey('taunt', picked.kind, `${seed}:line`),
    params: { name: me.name, rank: me.rank, ...picked.params },
  }
}

/**
 * Bot nói gì sau khi kèo NÓ dựng đã đánh xong.
 *
 * Dùng lại `detectMatchNarrative` — cùng bộ phân loại mà dòng Hoạt động đang dùng, nên bot
 * "nhìn" trận đúng như phần còn lại của app nhìn.
 *
 * @returns {{ lineKey: string, params: Object }|null} null khi chưa đánh, hoặc kèo không phải của bot.
 */
export function getBotMatchReaction(db, challenge) {
  if (!challenge?.botReason) return null

  const played = (db?.matches || [])
    .filter((m) => m && m.challengeId === challenge.id && m.winnerTeam)
    .sort((a, b) => (a.at || 0) - (b.at || 0))
  if (!played.length) return null

  const narrative = detectMatchNarrative(played[played.length - 1])
  // 'comeback' gộp vào 'clutch': với bot thì cả hai đều là "trận hay, tao xếp chuẩn".
  const kind = narrative === 'blowout' ? 'blowout'
    : (narrative === 'clutch' || narrative === 'comeback') ? 'clutch'
      : 'normal'

  return {
    lineKey: botLineKey('reaction', kind, `bot-reaction:${challenge.id}`),
    params: {},
  }
}

/**
 * Chuyện đáng để bot bình luận trước cả CLB, hoặc null nếu hôm nay chẳng có gì.
 *
 * CHỈ CHỌN, không ghi. RPC `post_bot_remark` mới là chỗ quyết định có đăng hay không (nhịp 12h
 * + không nhắc lại cùng chuyện trong 7 ngày) — ở đây không kiểm được vì client không giữ
 * `activity_events` trong state.
 *
 * @returns {{ kind: string, subjectId: string }|null}
 */
export function pickBotRemark(db, now = Date.now()) {
  if (!db?.clubId) return null
  const bot = findBotMember(db)
  if (!bot) return null

  const candidates = []
  getClubEloLeaderboard(db).forEach((row) => {
    if (row.id === bot.id || row.gamesCount < MIN_GAMES) return
    const delta = getRecentEloDelta(db, row.id, 7) || 0
    if (delta >= REMARK_ELO_SWING) {
      candidates.push({ kind: 'rank_climb', subjectId: row.id })
    } else if (delta <= -REMARK_ELO_SWING) {
      candidates.push({ kind: 'rank_drop', subjectId: row.id })
    } else if (getPlayerForm5(db, row.id).streak >= REMARK_STREAK) {
      // `else if` chứ không phải `if` rời: một người chỉ vào danh sách một lần, không thì ai
      // vừa thắng liền tay vừa tăng Elo sẽ chiếm hai suất và át hết người khác.
      candidates.push({ kind: 'streak', subjectId: row.id })
    }
  })
  if (!candidates.length) return null

  const seed = `bot-remark:${db.clubId}:${new Date(now).toDateString()}`
  return candidates[getDeterministicRoll(seed, candidates.length)]
}

/* ===========================================================================
 * BOT ĐI CƯỢC — tính cách con nghiện
 *
 * Kèo trong app ăn 1:1, không có tỷ lệ. Về toán thì đánh cửa mạnh mọi lúc là tối ưu, nên mọi
 * thứ dưới đây thuần là TÍNH CÁCH chứ không phải chiến lược:
 *   · mức cược = % SỐ DƯ, nhân với độ tự tin (Elo chênh càng nhiều càng xuống tay mạnh)
 *   · thua liên tiếp thì cược TO HƠN (gỡ), thắng liên tiếp cũng to hơn (tiền chùa)
 *   · cứ 5 kèo thì có 1 kèo bot cố tình bắt cửa dưới
 *
 * ⚠️ MỘT CHIỀU: lãi cược bị chặn ở +15 SP/mùa (`season.js`), còn lỗ thì KHÔNG có trần. Cộng với
 * cơn tilt ở trên, về dài hạn bot chắc chắn cháy. Đó đúng là kết cục của một con nghiện, nhưng
 * nó là kết cục MỘT CHIỀU: hết SP thì `canMemberPredict` chặn, bot không cược nữa và không có
 * đường tự gỡ. Muốn hồi sinh phải xoá bớt phiếu thua của bot dưới DB.
 * =========================================================================== */

/** Phần trăm số dư bot xuống tay khi kèo sát nút (độ tự tin ~50%). */
const BET_PCT_MIN = 0.05

/** Phần trăm khi bot tin chắc (độ tự tin ~100%). Giữa hai mốc thì nội suy thẳng. */
const BET_PCT_MAX = 0.30

/** Cược cửa dưới: bỏ qua độ tự tin, đây là lúc bot liều chứ không phải lúc bot tính. */
const BET_PCT_UNDERDOG = 0.20

/** Trần tuyệt đối cho MỘT phiếu, sau khi đã nhân cơn tilt. Không có nó thì bot all-in ngay lần thua thứ ba. */
const BET_PCT_HARD_CAP = 0.45

/** Cứ ngần này kèo thì có một kèo bot bắt cửa dưới. */
const UNDERDOG_ONE_IN = 5

/** Hệ số gỡ cho mỗi phiếu thua liên tiếp, và trần của nó. */
const TILT_CHASE_STEP = 0.5
const TILT_CHASE_MAX = 2.5

/** Hệ số tiền chùa cho mỗi phiếu thắng liên tiếp, và trần của nó. */
const TILT_HOUSE_STEP = 0.25
const TILT_HOUSE_MAX = 1.75

/** Thua từng này phiếu liên tiếp là bot chính thức vào cơn — câu nói đổi giọng theo. */
const TILT_TALK_FROM = 2

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/** Elo trung bình của một đội. */
function teamRating(db, ids = []) {
  if (!ids.length) return DEFAULT_RATING
  const sum = ids.reduce((acc, id) => {
    const member = (db.members || []).find((m) => m.id === id)
    const pr = getPlayerRating(db.playerRatings, id, member, db.levels)
    return acc + (pr?.displayRating ?? pr?.rating ?? DEFAULT_RATING)
  }, 0)
  return sum / ids.length
}

/**
 * Chuỗi phiếu cùng kết quả gần nhất của bot.
 * @returns {{ kind: 'won'|'lost'|null, n: number }}
 */
export function botBetStreak(db, botId) {
  const settled = (db?.challengePredictions || [])
    .filter((p) => p && p.memberId === botId && (p.status === 'won' || p.status === 'lost'))
    .sort((a, b) => new Date(b.settledAt || 0) - new Date(a.settledAt || 0))
  if (!settled.length) return { kind: null, n: 0 }

  const kind = settled[0].status
  let n = 0
  for (const p of settled) {
    if (p.status !== kind) break
    n++
  }
  return { kind, n }
}

/** Hệ số nhân mức cược theo cơn tilt hiện tại của bot. */
function tiltMultiplier(streak) {
  if (streak.kind === 'lost') return clamp(1 + TILT_CHASE_STEP * streak.n, 1, TILT_CHASE_MAX)
  if (streak.kind === 'won') return clamp(1 + TILT_HOUSE_STEP * streak.n, 1, TILT_HOUSE_MAX)
  return 1
}

/**
 * Mọi phiếu bot muốn đặt ngay lúc này — bot vào MỌI kèo nó được phép vào.
 *
 * Số dư trừ dần qua từng phiếu trong cùng một lượt, vì `availableSeasonPoints` chỉ thấy những
 * phiếu ĐÃ nằm trong state. Thiếu bước đó là bot đặt năm kèo, mỗi kèo đều tưởng mình còn nguyên
 * tiền, và tổng cược vượt số dư thật.
 *
 * Server KHÔNG kiểm được số dư (điểm mùa là số dẫn xuất — xem đầu 0047), nên chốt chặn thật nằm
 * ở đây. Cùng cách phân vai đang áp cho người thật.
 *
 * @returns {Array<{ challengeId: string, team: 'A'|'B', stake: number }>}
 */
export function pickBotPredictions(db, now = Date.now()) {
  const bot = findBotMember(db)
  if (!bot || !db?.clubId) return []

  const row = calculateSeasonLeaderboard(db).leaderboard.find((r) => r.id === bot.id)
  let budget = availableSeasonPoints(
    Number(row?.totalSeasonPoints) || 0,
    db.challengePredictions, db.challenges, db.sessions, bot.id, now,
  )
  if (budget < 1) return []

  const streak = botBetStreak(db, bot.id)
  const tilt = tiltMultiplier(streak)

  // Sắp theo id để thứ tự trừ tiền ổn định giữa các máy — không thì hai người mở app cùng lúc
  // có thể tính ra hai bộ mức cược khác nhau cho cùng bộ kèo.
  const open = (db.challenges || [])
    .filter((c) => c && canMemberPredict(c, bot.id, db, budget).ok)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))

  const out = []
  open.forEach((c) => {
    if (budget < 1) return

    const ra = teamRating(db, c.teamA)
    const rb = teamRating(db, c.teamB)
    const favTeam = ra >= rb ? 'A' : 'B'
    // Độ tự tin của CỬA MẠNH, luôn nằm trong [0.5, 1).
    const confidence = Math.max(expectedScore(ra, rb), expectedScore(rb, ra))

    const goUnderdog = getDeterministicRoll(`bot-bet-side:${c.id}`, UNDERDOG_ONE_IN) === 0
    const team = goUnderdog ? (favTeam === 'A' ? 'B' : 'A') : favTeam

    // Cửa mạnh: nội suy thẳng từ độ tự tin. Cửa dưới: một mức cố định, vì lúc đó bot không tính.
    const pct = goUnderdog
      ? BET_PCT_UNDERDOG
      : BET_PCT_MIN + (clamp(confidence, 0.5, 1) - 0.5) * 2 * (BET_PCT_MAX - BET_PCT_MIN)

    const raw = Math.round(budget * pct * tilt)
    const cap = Math.max(1, Math.floor(budget * BET_PCT_HARD_CAP))
    const stake = clamp(raw, 1, Math.min(cap, budget))

    out.push({ challengeId: c.id, team, stake })
    budget -= stake
  })

  return out
}

/**
 * Phiếu của bot ở một kèo, kèm câu nó nói về phiếu đó.
 *
 * Không ghi gì: cả phe lẫn mức cược đã nằm trong `challenge_predictions`, câu chữ dựng lại từ
 * trạng thái phiếu + id phiếu.
 *
 * @returns {{ lineKey: string, params: Object, prediction: Object }|null}
 */
export function getBotBetLine(db, challenge) {
  const bot = findBotMember(db)
  if (!bot || !challenge) return null

  const pred = getMemberPrediction(db?.challengePredictions || [], challenge.id, bot.id)
  if (!pred) return null

  let kind = null
  if (pred.status === 'won' || pred.status === 'lost') {
    kind = pred.status
  } else if (pred.status === 'pending') {
    // Đang trong cơn gỡ thì giọng đổi, kể cả khi phiếu này đánh cửa mạnh.
    const streak = botBetStreak(db, bot.id)
    if (streak.kind === 'lost' && streak.n >= TILT_TALK_FROM) {
      kind = 'tilt'
    } else {
      const backed = pred.team === 'A' ? challenge.teamA : challenge.teamB
      const other = pred.team === 'A' ? challenge.teamB : challenge.teamA
      kind = teamRating(db, backed) >= teamRating(db, other) ? 'favourite' : 'underdog'
    }
  }
  // 'refunded' / 'cancelled': kèo không diễn ra, không có gì để nói.
  if (!kind) return null

  const backedIds = pred.team === 'A' ? challenge.teamA : challenge.teamB
  return {
    lineKey: botLineKey('bet', kind, `bot-bet-line:${pred.id}`),
    params: { n: pred.stakePoints, who: formatTeamNames(db, backedIds) },
    prediction: pred,
  }
}

/* ===========================================================================
 * ARCADE — ván tay đôi với bot, thanh toán bằng ĐIỂM MÙA
 *
 * Không có đồng tiền riêng: thắng thua chuyển thẳng SP giữa người chơi và bot, và `season.js`
 * cộng trừ khi dựng lại bảng. Một dòng `arcade_rounds` mang cả hai phe nên tổng luôn bằng không.
 *
 * CHỈ NHỮNG TRÒ CÔNG BẰNG 1:1 — kéo búa bao (thắng/hoà/thua mỗi thứ 1/3) và tung xu (1/2). Trò
 * tỷ lệ lệch cần hệ số trả thưởng riêng; thêm vào mà quên hệ số là bot chảy máu điểm một chiều.
 * =========================================================================== */

/** Các trò đã cài. Phải khớp CHECK của `arcade_rounds.game` và nhánh trong `play_arcade_round`. */
export const ARCADE_GAMES = ['rps', 'coin']

export const ARCADE_CHOICES = {
  rps: ['rock', 'paper', 'scissors'],
  coin: ['heads', 'tails'],
}

/** Mỗi người mỗi ngày ngần này ván. PHẢI khớp `c_daily_cap` trong RPC — SQL không đọc được JS. */
export const ARCADE_DAILY_CAP = 5

/** Bot gạ ngần này phần trăm số dư của người chơi. */
const ARCADE_STAKE_PCT = 0.10

/** Dưới ngần này SP thì không đủ để thành một ván đáng chơi. */
const ARCADE_MIN_STAKE = 1

/**
 * Điểm mùa khả dụng của một người — số thật dùng được để cược.
 *
 * `board` để truyền lại bảng đã tính: `calculateSeasonLeaderboard` chạy lại TOÀN BỘ lịch sử, gọi
 * hai lần cho hai người là quét hai lượt vô ích.
 */
export function spendableSeasonPoints(db, memberId, now = Date.now(), board = null) {
  if (!db || !memberId) return 0
  const rows = board || calculateSeasonLeaderboard(db).leaderboard
  const row = rows.find((r) => r.id === memberId)
  return availableSeasonPoints(
    Number(row?.totalSeasonPoints) || 0,
    db.challengePredictions, db.challenges, db.sessions, memberId, now,
  )
}

/** Số ván người này đã chơi trong 24h qua. Bản sao nhẹ của cổng trong RPC, để khỏi gọi vô ích. */
export function arcadeRoundsToday(db, memberId, now = Date.now()) {
  const cutoff = now - 24 * 3600 * 1000
  return (db?.arcadeRounds || []).filter((r) => (
    r && r.memberId === memberId && Date.parse(r.createdAt || '') >= cutoff
  )).length
}

/**
 * Bot có đang gạ người này một ván không, và gạ bao nhiêu.
 *
 * Mức cược lấy theo % số dư NGƯỜI CHƠI, nhưng kẹp lại bằng số dư của BOT: bot không được phép hứa
 * một ván mà chính nó không trả nổi. Đây là chỗ duy nhất giữ được luật đó, vì server không dựng
 * lại được điểm mùa của ai cả (xem đầu 0047).
 *
 * Hạt giống có kèm SỐ VÁN ĐÃ CHƠI HÔM NAY, nên chơi xong một ván là lời gạ đổi sang trò/mức khác
 * thay vì lặp y nguyên.
 *
 * @returns {{ game: string, stake: number, choices: string[], lineKey: string, params: Object }
 *          | { blocked: 'capped'|'broke', lineKey: string, params: Object }
 *          | null}
 */
export function getBotArcadeOffer(db, memberId, now = Date.now()) {
  const bot = findBotMember(db)
  // Đăng nhập bằng chính tài khoản bot thì không có ai để gạ.
  if (!bot || !memberId || bot.id === memberId) return null

  const played = arcadeRoundsToday(db, memberId, now)
  const seed = `bot-arcade:${memberId}:${new Date(now).toDateString()}:${played}`

  if (played >= ARCADE_DAILY_CAP) {
    return { blocked: 'capped', lineKey: botLineKey('arcade', 'capped', seed), params: { n: ARCADE_DAILY_CAP } }
  }

  const board = calculateSeasonLeaderboard(db).leaderboard
  const mine = spendableSeasonPoints(db, memberId, now, board)
  const botHas = spendableSeasonPoints(db, bot.id, now, board)
  // Một trong hai hết điểm là không có ván nào. Bot hết điểm là trạng thái CHẾT một chiều —
  // xem ghi chú ở khối "BOT ĐI CƯỢC" phía trên.
  if (mine < ARCADE_MIN_STAKE || botHas < ARCADE_MIN_STAKE) {
    return { blocked: 'broke', lineKey: botLineKey('arcade', 'broke', seed), params: {} }
  }

  const game = ARCADE_GAMES[getDeterministicRoll(`${seed}:game`, ARCADE_GAMES.length)]
  const stake = clamp(Math.round(mine * ARCADE_STAKE_PCT), ARCADE_MIN_STAKE, Math.min(mine, botHas, 100))

  return {
    game,
    stake,
    choices: ARCADE_CHOICES[game],
    lineKey: botLineKey('arcade', 'offer', `${seed}:line`),
    params: { n: stake },
  }
}

/**
 * Câu bot nói về kết quả một ván vừa xong.
 * @param {{ id: string, outcome: 'won'|'lost'|'draw', stake: number }} round kết quả RPC trả về
 */
export function getArcadeResultLine(round) {
  if (!round?.outcome) return null
  return {
    lineKey: botLineKey('arcade', round.outcome, `bot-arcade-result:${round.id}`),
    params: { n: round.stake },
  }
}
