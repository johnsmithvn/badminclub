import assert from 'node:assert/strict'
import { calculateSeasonLeaderboard } from '#lib/season.js'
import {
  findBotMember, botGateOpen, pickBotChallenge, BOT_REASONS,
  botLineKey, BOT_LINE_VARIANTS, getBotTaunt, getBotMatchReaction, pickBotRemark,
  botBetStreak, pickBotPredictions, getBotBetLine,
  getBotArcadeOffer, getArcadeResultLine, arcadeRoundsToday,
  spendableSeasonPoints, ARCADE_GAMES, ARCADE_CHOICES, ARCADE_DAILY_CAP,
  getPlayerRelationships, getBotState, getBotInteraction,
} from '#lib/bot.js'

const NOW = Date.parse('2026-09-21T12:00:00.000Z')
const hoursFromNow = (h) => new Date(NOW + h * 3600000).toISOString()

const mem = (id, extra = {}) => ({
  id, name: id, gender: 'nam', level: 'TB', active: true, ...extra,
})
const rating = (id, r, gamesCount = 10) => ({ memberId: id, rating: r, gamesCount })

/** CLB đủ người: 1 bot + 5 người thật, Elo cách đều nhau. */
const baseDb = () => ({
  clubId: 'club1',
  levels: [],
  matches: [],
  challenges: [],
  members: [
    mem('bot', { isBot: true }),
    mem('m1'), mem('m2'), mem('m3'), mem('m4'), mem('m5'),
  ],
  playerRatings: [
    rating('bot', 1500),
    rating('m1', 1600), rating('m2', 1580), rating('m3', 1550),
    rating('m4', 1520), rating('m5', 1490),
  ],
})

/* ---------- findBotMember ---------- */

assert.equal(findBotMember(baseDb())?.id, 'bot', 'Tìm ra thành viên có cờ isBot')
assert.equal(findBotMember({ members: [mem('m1')] }), null, 'Không ai có cờ thì trả null')
assert.equal(
  findBotMember({ members: [mem('bot', { isBot: true, active: false })] }),
  null,
  'Bot đã nghỉ thì coi như không có',
)

/* ---------- botGateOpen ---------- */

assert.equal(botGateOpen(baseDb(), NOW), true, 'Chưa có kèo bot nào thì cổng mở')

const dbLiveBotChallenge = { ...baseDb(), challenges: [
  { id: 'c1', createdBy: 'bot', status: 'pending', expiresAt: hoursFromNow(5), teamA: ['m1'], teamB: ['m2'] },
] }
assert.equal(botGateOpen(dbLiveBotChallenge, NOW), false, 'Kèo bot còn hạn thì cổng đóng')

// Kèo ĐÃ NHẬN nhưng mới tạo: `expiresAt` vẫn ở tương lai vì hạn kèo bot = đúng nhịp 24h.
// Đây là luật "1 kèo / 24h" được suy ra từ cùng một phép kiểm.
const dbAcceptedBotChallenge = { ...baseDb(), challenges: [
  { id: 'c1', createdBy: 'bot', status: 'accepted', expiresAt: hoursFromNow(20), teamA: ['m1'], teamB: ['m2'] },
] }
assert.equal(botGateOpen(dbAcceptedBotChallenge, NOW), false, 'Kèo bot tạo trong 24h qua thì cổng vẫn đóng')

const dbStaleBotChallenge = { ...baseDb(), challenges: [
  { id: 'c1', createdBy: 'bot', status: 'expired', expiresAt: hoursFromNow(-2), teamA: ['m1'], teamB: ['m2'] },
] }
assert.equal(botGateOpen(dbStaleBotChallenge, NOW), true, 'Kèo bot đã quá hạn thì cổng mở lại')

// Kèo của NGƯỜI không liên quan tới nhịp của bot.
const dbHumanChallenge = { ...baseDb(), challenges: [
  { id: 'c1', createdBy: 'm1', status: 'pending', expiresAt: hoursFromNow(48), teamA: ['m1'], teamB: ['m2'] },
] }
assert.equal(botGateOpen(dbHumanChallenge, NOW), true, 'Kèo người khác tạo không khoá cổng của bot')

assert.equal(botGateOpen({ ...baseDb(), members: [mem('m1')] }, NOW), false, 'Không có bot thì cổng đóng')

/* ---------- pickBotChallenge ---------- */

const picked = pickBotChallenge(baseDb(), NOW)
assert.ok(picked, 'CLB đủ người thì chọn được cặp')
assert.ok(BOT_REASONS.includes(picked.reason), 'Lý do nằm trong bộ mã đã khai báo')
assert.notEqual(picked.aId, picked.bId, 'Hai đấu thủ phải khác nhau')
assert.ok(picked.aId !== 'bot' && picked.bId !== 'bot', 'Bot KHÔNG bao giờ tự làm đấu thủ')
assert.equal(picked.reason, 'rank_neighbor', 'Không ai có chuỗi thắng thì lý do là sát BXH')

// Cùng dữ liệu + cùng ngày -> cùng cặp. Không thì mỗi lần re-render lại ra một kèo khác.
assert.deepEqual(pickBotChallenge(baseDb(), NOW), picked, 'Cùng hạt giống cho cùng kết quả')

// Cổng đóng thì không chọn gì, kể cả khi CLB thừa người.
assert.equal(pickBotChallenge(dbLiveBotChallenge, NOW), null, 'Cổng đóng thì không chọn cặp nào')

// Người đang dính kèo bị loại khỏi danh sách ứng viên.
const dbBusy = { ...baseDb(), challenges: [
  { id: 'c1', createdBy: 'm1', status: 'accepted', expiresAt: hoursFromNow(10), teamA: ['m1'], teamB: ['m2'] },
  { id: 'c2', createdBy: 'm3', status: 'oncourt', expiresAt: hoursFromNow(10), teamA: ['m3'], teamB: ['m4'] },
] }
const pickedBusy = pickBotChallenge(dbBusy, NOW)
assert.equal(pickedBusy, null, 'Loại hết người bận thì còn dưới ngưỡng ứng viên -> không gạ kèo')

// Người chưa đủ số trận tối thiểu không được đem ra gạ kèo.
const dbProvisional = { ...baseDb(), playerRatings: [
  rating('bot', 1500),
  rating('m1', 1600), rating('m2', 1580, 1), rating('m3', 1550, 2),
  rating('m4', 1520), rating('m5', 1490),
] }
const pickedProvisional = pickBotChallenge(dbProvisional, NOW)
assert.equal(pickedProvisional, null, 'Chỉ còn 3 người đủ trận thì dưới ngưỡng -> không gạ kèo')

// CLB quá mỏng.
const dbTiny = {
  ...baseDb(),
  members: [mem('bot', { isBot: true }), mem('m1'), mem('m2')],
  playerRatings: [rating('bot', 1500), rating('m1', 1600), rating('m2', 1580)],
}
assert.equal(pickBotChallenge(dbTiny, NOW), null, 'CLB dưới ngưỡng ứng viên thì không gạ kèo')

assert.equal(pickBotChallenge({ members: [] }, NOW), null, 'Thiếu clubId thì trả null, không nổ')

/* ---------- botLineKey: chọn biến thể câu ---------- */

const keyA = botLineKey('reason', 'rank_neighbor', 'seed-1')
assert.match(keyA, /^bot\.reason\.rank_neighbor\.[1-4]$/, 'Khoá đúng khuôn và trong miền biến thể')
assert.equal(botLineKey('reason', 'rank_neighbor', 'seed-1'), keyA, 'Cùng hạt giống cho cùng câu')
assert.equal(botLineKey('reason', 'khong_co_ma_nay', 'seed-1'), null, 'Mã lạ thì trả null chứ không dựng khoá chết')
assert.equal(botLineKey('nhom_la', 'rank_neighbor', 'seed-1'), null, 'Nhóm lạ cũng trả null')

// Mọi hạt giống phải rơi vào đúng miền 1..n đã khai — nếu lệch thì `t()` trả về chính chuỗi khoá.
Object.entries(BOT_LINE_VARIANTS).forEach(([group, kinds]) => {
  Object.entries(kinds).forEach(([kind, count]) => {
    for (let i = 0; i < 30; i++) {
      const n = Number(botLineKey(group, kind, 'seed-' + i).split('.').pop())
      assert.ok(n >= 1 && n <= count, `Biến thể ${group}.${kind} phải nằm trong 1..${count}`)
    }
  })
})

/* ---------- getBotTaunt: bot nói riêng ---------- */

const taunt = getBotTaunt(baseDb(), 'm1', NOW)
assert.ok(taunt, 'Có bot và có người thì luôn nói được câu gì đó')
assert.match(taunt.lineKey, /^bot\.taunt\.[a-z0-9_]+\.\d$/, 'Khoá câu cà khịa đúng khuôn')
assert.equal(taunt.params.name, 'm1', 'Tham số câu mang tên người nghe')
assert.deepEqual(getBotTaunt(baseDb(), 'm1', NOW), taunt, 'Cùng người, cùng ngày thì cùng câu')

assert.equal(getBotTaunt(baseDb(), 'bot', NOW), null, 'Bot không cà khịa chính nó')
assert.equal(
  getBotTaunt({ ...baseDb(), members: [mem('m1')] }, 'm1', NOW),
  null,
  'CLB không có bot thì không có câu nào',
)
assert.equal(getBotTaunt(baseDb(), 'khong-ton-tai', NOW), null, 'Người lạ thì trả null, không nổ')

/* ---------- getBotMatchReaction: bot nói sau khi kèo đánh xong ---------- */

const botChal = { id: 'c9', botReason: 'rank_neighbor', teamA: ['m1'], teamB: ['m2'] }
const humanChal = { id: 'c8', botReason: null, teamA: ['m1'], teamB: ['m2'] }
const blowout = {
  id: 'mt1', challengeId: 'c9', at: NOW, winnerTeam: 'A',
  teamA: ['m1'], teamB: ['m2'], sets: [[21, 9], [21, 8]],
}

assert.equal(getBotMatchReaction(baseDb(), humanChal), null, 'Kèo người tạo thì bot không bình luận')
assert.equal(getBotMatchReaction(baseDb(), botChal), null, 'Chưa đánh trận nào thì chưa có gì để nói')

const dbPlayed = { ...baseDb(), matches: [blowout] }
const reaction = getBotMatchReaction(dbPlayed, botChal)
assert.ok(reaction, 'Kèo bot đã đánh xong thì có câu phản ứng')
assert.match(reaction.lineKey, /^bot\.reaction\.blowout\.[1-3]$/, 'Trận một chiều ra đúng nhóm câu blowout')
assert.deepEqual(getBotMatchReaction(dbPlayed, botChal), reaction, 'Cùng kèo thì câu không đổi giữa các lần render')

/* ---------- pickBotRemark: bot bình luận trước cả CLB ---------- */

assert.equal(pickBotRemark(baseDb(), NOW), null, 'Không ai biến động mạnh thì bot im')
assert.equal(pickBotRemark({ ...baseDb(), members: [mem('m1')] }, NOW), null, 'Không có bot thì không có bình luận')

// `getRecentEloDelta` đọc đồng hồ thật nên trận phải đóng dấu theo `Date.now()`, không phải NOW.
const climbMatch = (id, winner, delta) => ({
  id, at: Date.now(), winnerTeam: 'A', eloDelta: delta,
  teamA: [winner], teamB: ['m5'], sets: [[21, 15]],
})
const dbClimb = { ...baseDb(), matches: [climbMatch('mt2', 'm2', 55)] }
const remark = pickBotRemark(dbClimb, NOW)
assert.ok(remark, 'Có người tăng Elo mạnh thì bot có chuyện để nói')
assert.equal(remark.kind, 'rank_climb', 'Tăng mạnh thì đúng nhóm rank_climb')
assert.equal(remark.subjectId, 'm2', 'Nói đúng về người vừa tăng')
assert.deepEqual(pickBotRemark(dbClimb, NOW), remark, 'Cùng ngày thì bot không đổi ý')

// Người bị trừ Elo cũng phải được nhận ra — và bot KHÔNG bao giờ tự nói về mình.
const dbDrop = { ...baseDb(), matches: [climbMatch('mt3', 'bot', 60)] }
assert.equal(pickBotRemark(dbDrop, NOW)?.subjectId !== 'bot', true, 'Bot không tự bình luận về chính nó')

/* ---------- botBetStreak: bot đang thua hay thắng mấy phiếu liền ---------- */

const pred = (id, status, at, stakePoints = 5) => ({
  id, memberId: 'bot', challengeId: 'c-' + id, team: 'A',
  stakePoints, status, settledAt: at,
})

assert.deepEqual(botBetStreak(baseDb(), 'bot'), { kind: null, n: 0 }, 'Chưa cược phiếu nào thì không có chuỗi')

const dbStreak = { ...baseDb(), challengePredictions: [
  pred('p1', 'lost', '2026-09-20T10:00:00Z'),
  pred('p2', 'lost', '2026-09-20T11:00:00Z'),
  pred('p3', 'lost', '2026-09-20T12:00:00Z'),
  pred('p4', 'won', '2026-09-19T10:00:00Z'),
] }
assert.deepEqual(botBetStreak(dbStreak, 'bot'), { kind: 'lost', n: 3 }, 'Đếm đúng chuỗi thua gần nhất')

const dbStreakWon = { ...baseDb(), challengePredictions: [
  pred('p1', 'lost', '2026-09-20T10:00:00Z'),
  pred('p2', 'won', '2026-09-20T12:00:00Z'),
] }
assert.deepEqual(botBetStreak(dbStreakWon, 'bot'), { kind: 'won', n: 1 }, 'Phiếu mới nhất quyết định loại chuỗi')

// Phiếu chưa quyết toán không tính vào chuỗi — không thì bot tưởng mình vừa thua khi mới đặt.
const dbStreakPending = { ...baseDb(), challengePredictions: [
  pred('p1', 'won', '2026-09-20T10:00:00Z'),
  pred('p2', 'pending', null),
] }
assert.deepEqual(botBetStreak(dbStreakPending, 'bot'), { kind: 'won', n: 1 }, 'Phiếu đang chờ không phá chuỗi')

/* ---------- pickBotPredictions: bot vào mọi kèo nó được phép ---------- */

const openChal = (id, a, b) => ({
  id, clubId: 'club1', status: 'accepted', teamA: [a], teamB: [b],
  expiresAt: hoursFromNow(48), predictionsEnabled: true, predictionsLocked: false,
})

// Bot chỉ có điểm mùa khi đã đánh trận — `calculateSeasonLeaderboard` dựng lại từ lịch sử.
const botMatch = (id, at) => ({
  id, at, winnerTeam: 'A', ratingEnabled: true, eloDelta: 10,
  teamA: ['bot'], teamB: ['m5'], sets: [[21, 15]], playerKeys: ['bot', 'm5'],
})

// Bot hết SP khả dụng (đã cược pending hết 100 SP trên kèo sống) thì không cược thêm
const dbNoBudget = {
  ...baseDb(),
  challenges: [openChal('k1', 'm1', 'm2'), openChal('k_other', 'm3', 'm4')],
  challengePredictions: [
    { id: 'p_lock', challengeId: 'k_other', memberId: 'bot', status: 'pending', stakePoints: 100 },
  ],
}
assert.deepEqual(pickBotPredictions(dbNoBudget, NOW), [], 'Bot hết SP khả dụng thì không cược')

const dbBets = {
  ...baseDb(),
  matches: [botMatch('bm1', Date.now())],
  challenges: [openChal('k1', 'm1', 'm2'), openChal('k2', 'm3', 'm4')],
}
const bets = pickBotPredictions(dbBets, NOW)
bets.forEach((b) => {
  assert.ok(b.stake >= 1, 'Mức cược luôn từ 1 SP trở lên')
  assert.ok(['A', 'B'].includes(b.team), 'Phe cược hợp lệ')
})
assert.deepEqual(pickBotPredictions(dbBets, NOW), bets, 'Cùng dữ liệu cho cùng bộ phiếu')

// Bot KHÔNG cược kèo nó là đấu thủ — luật cứng, thủng là thành gian lận.
const dbBotPlays = {
  ...baseDb(),
  matches: [botMatch('bm1', Date.now())],
  challenges: [openChal('k3', 'bot', 'm1')],
}
assert.deepEqual(pickBotPredictions(dbBotPlays, NOW), [], 'Bot là đấu thủ thì không được cược kèo đó')

// Đã có phiếu rồi thì không đặt thêm (mỗi kèo một phiếu).
const dbAlreadyBet = {
  ...baseDb(),
  matches: [botMatch('bm1', Date.now())],
  challenges: [openChal('k1', 'm1', 'm2')],
  challengePredictions: [{ ...pred('p9', 'pending', null), challengeId: 'k1' }],
}
assert.deepEqual(pickBotPredictions(dbAlreadyBet, NOW), [], 'Kèo đã có phiếu của bot thì bỏ qua')

// Tổng cược không bao giờ vượt số dư, kể cả khi có nhiều kèo cùng lúc.
const dbManyChals = {
  ...baseDb(),
  matches: [botMatch('bm1', Date.now())],
  challenges: ['k1', 'k2', 'k3', 'k4'].map((id, i) => openChal(id, ['m1', 'm3'][i % 2], ['m2', 'm4'][i % 2])),
}
const manyBets = pickBotPredictions(dbManyChals, NOW)
const totalStaked = manyBets.reduce((s, b) => s + b.stake, 0)
const botRow = calculateSeasonLeaderboard(dbManyChals).leaderboard.find((r) => r.id === 'bot')
assert.ok(totalStaked <= (Number(botRow?.totalSeasonPoints) || 0), 'Tổng cược không vượt số dư của bot')

/* ---------- getBotBetLine: bot nói gì về phiếu của nó ---------- */

const chalForLine = openChal('k1', 'm1', 'm2')
assert.equal(getBotBetLine(baseDb(), chalForLine), null, 'Không có phiếu thì không có câu nào')

const withPending = { ...baseDb(), challengePredictions: [
  { ...pred('p1', 'pending', null), challengeId: 'k1', team: 'A' },
] }
const lineP = getBotBetLine(withPending, chalForLine)
assert.match(lineP.lineKey, /^bot\.bet\.(favourite|underdog|tilt)\.[1-3]$/, 'Phiếu đang chờ ra nhóm câu đặt cửa')
assert.equal(lineP.params.n, 5, 'Câu mang đúng mức cược')

const withWon = { ...baseDb(), challengePredictions: [
  { ...pred('p1', 'won', '2026-09-20T10:00:00Z'), challengeId: 'k1', team: 'A' },
] }
assert.match(getBotBetLine(withWon, chalForLine).lineKey, /^bot\.bet\.won\.[1-3]$/, 'Phiếu thắng ra nhóm câu ăn tiền')

const withLost = { ...baseDb(), challengePredictions: [
  { ...pred('p1', 'lost', '2026-09-20T10:00:00Z'), challengeId: 'k1', team: 'A' },
] }
assert.match(getBotBetLine(withLost, chalForLine).lineKey, /^bot\.bet\.lost\.[1-3]$/, 'Phiếu thua ra nhóm câu mất tiền')

// Kèo huỷ thì phiếu được hoàn — không thắng không thua, không có gì để nói.
const withRefund = { ...baseDb(), challengePredictions: [
  { ...pred('p1', 'refunded', '2026-09-20T10:00:00Z'), challengeId: 'k1', team: 'A' },
] }
assert.equal(getBotBetLine(withRefund, chalForLine), null, 'Phiếu được hoàn thì bot im')

// Đang trong cơn gỡ thì giọng đổi, kể cả khi phiếu này đánh cửa mạnh.
const withTilt = { ...baseDb(), challengePredictions: [
  pred('p1', 'lost', '2026-09-20T10:00:00Z'),
  pred('p2', 'lost', '2026-09-20T11:00:00Z'),
  { ...pred('p3', 'pending', null), challengeId: 'k1', team: 'A' },
] }
assert.match(getBotBetLine(withTilt, chalForLine).lineKey, /^bot\.bet\.tilt\.[1-3]$/, 'Thua 2 phiếu liền thì bot vào cơn gỡ')

/* ---------- ARCADE ---------- */

const round = (id, memberId, outcome, stake = 5, at = new Date().toISOString()) => ({
  id, clubId: 'club1', memberId, opponentId: 'bot',
  game: 'rps', stake, choice: 'rock', oppChoice: 'scissors', outcome, createdAt: at,
})

// Cần CẢ HAI bên có điểm mùa thì mới có ván: m1 có trận nên có 100 SP, bot có cờ isBot nên có 100 SP.
const pairMatch = (id, a, b) => ({
  id, at: Date.now(), winnerTeam: 'A', ratingEnabled: true, eloDelta: 10,
  teamA: [a], teamB: [b], sets: [[21, 15]], playerKeys: [a, b],
})

const dbArcade = () => ({
  ...baseDb(),
  matches: [pairMatch('am1', 'm1', 'm2')],
  arcadeRounds: [],
})

/* -- arcadeRoundsToday -- */

assert.equal(arcadeRoundsToday(dbArcade(), 'm1'), 0, 'Chưa chơi ván nào')
assert.equal(
  arcadeRoundsToday({ ...dbArcade(), arcadeRounds: [round('r1', 'm1', 'won'), round('r2', 'm1', 'lost')] }, 'm1'),
  2,
  'Đếm đúng số ván trong 24h',
)
// Ván cũ hơn 24h không tính vào hạn mức ngày.
const oldAt = new Date(Date.now() - 30 * 3600 * 1000).toISOString()
assert.equal(
  arcadeRoundsToday({ ...dbArcade(), arcadeRounds: [round('r1', 'm1', 'won', 5, oldAt)] }, 'm1'),
  0,
  'Ván quá 24h không còn tính',
)

/* -- getBotArcadeOffer -- */

// m1 chưa đánh trận nào -> m1 có 0 SP -> không mở được ván, bot báo broke
const noPoints = getBotArcadeOffer(baseDb(), 'm1', NOW)
assert.equal(noPoints.blocked, 'broke', 'User chưa có trận thì có 0 SP -> cổng đóng vì hết vốn')
assert.match(noPoints.lineKey, /^bot\.arcade\.broke\.[1-2]$/, 'Câu hết vốn đúng nhóm')

const offer = getBotArcadeOffer(dbArcade(), 'm1', NOW)
assert.ok(offer, 'Bot có điểm và người chơi có điểm thì có lời gạ')
assert.ok(ARCADE_GAMES.includes(offer.game), 'Trò nằm trong danh sách đã cài')
assert.deepEqual(offer.choices, ARCADE_CHOICES[offer.game], 'Nước đi khớp trò')
assert.ok(offer.stake >= 1 && offer.stake <= 100, 'Mức cược nằm trong trần DB')
assert.match(offer.lineKey, /^bot\.arcade\.offer\.[1-4]$/, 'Câu gạ đúng nhóm')
assert.deepEqual(getBotArcadeOffer(dbArcade(), 'm1', NOW), offer, 'Cùng ngày, cùng số ván thì cùng lời gạ')

// Bot không gạ chính nó (chủ CLB đăng nhập bằng tài khoản bot).
assert.equal(getBotArcadeOffer(dbArcade(), 'bot', NOW), null, 'Bot không tự mở sòng với mình')

// Mức cược không bao giờ vượt số dư của BÊN ÍT HƠN — bot không được hứa ván nó không trả nổi.
const mine = spendableSeasonPoints(dbArcade(), 'm1', NOW)
const botHas = spendableSeasonPoints(dbArcade(), 'bot', NOW)
assert.ok(offer.stake <= Math.min(mine, botHas), 'Mức cược không vượt số dư của bên ít điểm hơn')

// Hết lượt ngày: chỉ còn câu nói, không có nút chơi.
const dbCapped = {
  ...dbArcade(),
  arcadeRounds: Array.from({ length: ARCADE_DAILY_CAP }, (_, i) => round('rc' + i, 'm1', 'lost')),
}
const capped = getBotArcadeOffer(dbCapped, 'm1', NOW)
assert.equal(capped.blocked, 'capped', 'Chơi đủ hạn mức thì cổng đóng')
assert.equal(capped.game, undefined, 'Cổng đóng thì không kèm trò nào')
assert.match(capped.lineKey, /^bot\.arcade\.capped\.[1-2]$/, 'Câu hết lượt đúng nhóm')

// Bot hết sạch điểm: khi bot thua arcade 100 SP, số dư về 0 SP
const dbBotBroke = {
  ...baseDb(),
  matches: [pairMatch('am1', 'm1', 'm2')],
  arcadeRounds: [round('r_broke', 'm1', 'won', 100)],
}
assert.equal(getBotArcadeOffer(dbBotBroke, 'm1', NOW).blocked, 'broke', 'Bot hết điểm thì không mở ván nào')

/* -- getArcadeResultLine -- */

assert.equal(getArcadeResultLine(null), null, 'Không có kết quả thì không có câu')
assert.match(
  getArcadeResultLine({ id: 'r1', outcome: 'won', stake: 7 }).lineKey,
  /^bot\.arcade\.won\.[1-3]$/,
  'Người chơi thắng ra đúng nhóm câu',
)
assert.match(
  getArcadeResultLine({ id: 'r1', outcome: 'draw', stake: 7 }).lineKey,
  /^bot\.arcade\.draw\.[1-3]$/,
  'Hoà ra đúng nhóm câu',
)
assert.equal(getArcadeResultLine({ id: 'r1', outcome: 'won', stake: 7 }).params.n, 7, 'Câu mang đúng mức cược')

/* ---------- ZERO-SUM: tổng điểm mùa hai bên không đổi sau một ván ---------- */

const sumSp = (d) => calculateSeasonLeaderboard(d).leaderboard
  .reduce((s, r) => s + (Number(r.totalSeasonPoints) || 0), 0)

const dbBeforeRound = {
  ...baseDb(),
  matches: [pairMatch('bm1', 'm1', 'm2'), pairMatch('bm2', 'm1', 'm3')],
  arcadeRounds: [],
}
// Cho m1 thắng bot một ván 3 SP.
const dbAfterRound = { ...dbBeforeRound, arcadeRounds: [round('r1', 'm1', 'won', 3)] }
assert.equal(sumSp(dbAfterRound), sumSp(dbBeforeRound), 'Tổng điểm mùa cả CLB không đổi sau một ván arcade')

// Ván hoà không đổi điểm của ai.
const dbDraw = { ...dbBeforeRound, arcadeRounds: [round('r2', 'm1', 'draw', 9)] }
assert.equal(sumSp(dbDraw), sumSp(dbBeforeRound), 'Ván hoà không sinh cũng không tiêu điểm')

/* ---------- PLAYER RELATIONSHIPS ENGINE ---------- */

const matchH2H = (id, a, b, winA = true) => ({
  id, at: Date.now(), winnerTeam: winA ? 'A' : 'B', ratingEnabled: true,
  teamA: [a], teamB: [b], sets: [[21, 15]], playerKeys: [a, b],
})
const matchDuo = (id, a, b, opp1, opp2, winDuo = true) => ({
  id, at: Date.now(), winnerTeam: winDuo ? 'A' : 'B', ratingEnabled: true,
  teamA: [a, b], teamB: [opp1, opp2], sets: [[21, 15]], playerKeys: [a, b, opp1, opp2],
})

// 1. Rivalry: 5 trận, tỷ số 3-2
const dbRivalry = {
  ...baseDb(),
  matches: [
    matchH2H('h1', 'm1', 'm2', true),
    matchH2H('h2', 'm1', 'm2', false),
    matchH2H('h3', 'm1', 'm2', true),
    matchH2H('h4', 'm1', 'm2', false),
    matchH2H('h5', 'm1', 'm2', true),
  ],
}
const relRiv = getPlayerRelationships(dbRivalry, 'm1', 'm2')
assert.equal(relRiv.matchesAgainst, 5, '5 trận đối đầu')
assert.equal(relRiv.h2h.winsA, 3, 'm1 thắng 3')
assert.equal(relRiv.h2h.winsB, 2, 'm2 thắng 2')
assert.equal(relRiv.rivalry, true, 'Kỳ phùng địch thủ (5 trận, chênh 1)')

// 2. Dominance: 4 trận, tỷ số 4-0
const dbDom = {
  ...baseDb(),
  matches: [
    matchH2H('d1', 'm1', 'm3', true),
    matchH2H('d2', 'm1', 'm3', true),
    matchH2H('d3', 'm1', 'm3', true),
    matchH2H('d4', 'm1', 'm3', true),
  ],
}
const relDom = getPlayerRelationships(dbDom, 'm1', 'm3')
assert.ok(relDom.dominance, 'Có áp đảo')
assert.equal(relDom.dominance.leader, 'm1', 'm1 là boss áp đảo')
assert.equal(relDom.dominance.gap, 4, 'Chênh lệch 4 trận')
assert.equal(relDom.matchupForA, 'easy', 'Kèo dễ cho m1')
assert.equal(relDom.matchupForB, 'hard', 'Kèo khó cho m3')

// 3. Best Duo: 4 trận cùng nhau, thắng 3 (75%)
const dbDuo = {
  ...baseDb(),
  matches: [
    matchDuo('du1', 'm1', 'm4', 'm2', 'm3', true),
    matchDuo('du2', 'm1', 'm4', 'm2', 'm3', true),
    matchDuo('du3', 'm1', 'm4', 'm2', 'm3', true),
    matchDuo('du4', 'm1', 'm4', 'm2', 'm3', false),
  ],
}
const relDuo = getPlayerRelationships(dbDuo, 'm1', 'm4')
assert.equal(relDuo.matchesTogether, 4, '4 trận cùng nhau')
assert.equal(relDuo.synergy.wins, 3, 'Thắng 3 trận')
assert.equal(relDuo.isBestDuo, true, 'Cặp đôi ăn ý (>= 75%)')
assert.equal(relDuo.isFrequentPartner, true, 'Đối tác thường xuyên')

/* ---------- BOT STATE & 3-TIER INTERACTION ---------- */

const state = getBotState(dbRivalry, NOW)
assert.ok(state.bot, 'Có thông tin bot')
assert.equal(state.bot.id, 'bot', 'Đúng ID bot')
assert.equal(state.seasonPoints, 100, 'Bot có 100 SP khởi đầu')
assert.ok(state.clubRivalries.length > 0, 'Phát hiện được rivalry m1-m2 trong CLB')

// Interaction: Tier 1 Popup khi user đứng ngay trên Bot
const interactAbove = getBotInteraction(dbRivalry, 'm1', NOW)
assert.ok(interactAbove.mode === 'popup' || interactAbove.mode === 'ambient', 'Có chế độ tương tác')
assert.ok(interactAbove.lineKey, 'Có câu thoại tương tác')

console.log('bot check: OK')
