import assert from 'node:assert/strict'
import { nextChallengeCode, challengeCountdown, abandonedChallenges } from '#lib/challenge.js'
import cfg from '#config/app.json' with { type: 'json' }

// 1. Sinh mã kèo
assert.equal(nextChallengeCode([]), 'C-0101', 'Danh sách rỗng sinh mã khởi tạo C-0101')
assert.equal(nextChallengeCode([{ code: 'C-0125' }]), 'C-0126', 'Sinh mã tự tăng kế tiếp')

// `challengeDirection`, `evalChallengeBalance`, `canCancelChallenge` và
// `pickableMembersForChallenge` đã được gỡ khỏi `lib/challenge.js`: không màn hình nào gọi chúng,
// chỉ còn đúng mấy dòng test này giữ chúng sống. Luật huỷ kèo giờ nằm trong chính
// `a.cancelChallenge` (xem chốt trạng thái ở đó) thay vì một hàm rời không ai gọi.

// 2. Cơ chế đa xác nhận kèo đấu
import {
  getChallengeAcceptanceProgress,
  isChallengeFullyAccepted,
  canMemberAcceptChallenge,
  canAdminForceAcceptChallenge,
  collapseChallengeSets,
  validateStakePoints,
  challengeCloserOf,
} from '#lib/challenge.js'

// Kèo đơn 1v1: Người tạo m1 đã chấp nhận, m2 chưa chấp nhận
const cSingle = {
  createdBy: 'm1',
  teamA: ['m1'],
  teamB: ['m2'],
  acceptedPlayers: ['m1'],
  status: 'pending',
}
const pSingle1 = getChallengeAcceptanceProgress(cSingle)
assert.equal(pSingle1.acceptedCount, 1, 'Kèo đơn: 1 người đã nhận')
assert.equal(pSingle1.totalCount, 2, 'Kèo đơn: cần 2 người')
assert.equal(pSingle1.isFullyAccepted, false, 'Chưa đủ 2 người nên chưa fully accepted')
assert.ok(canMemberAcceptChallenge(cSingle, 'm2'), 'm2 có quyền bấm nhận')
assert.ok(!canMemberAcceptChallenge(cSingle, 'm1'), 'm1 đã nhận rồi thì không bấm nhận lại')
assert.ok(!canMemberAcceptChallenge(cSingle, 'm1', true), 'm1 dù là Admin nhưng đã nhận rồi thì không hiện nút nhận lại')
assert.ok(canMemberAcceptChallenge(cSingle, 'admin_id', true), 'Admin ngoài trận có quyền duyệt khi kèo đã đủ 2 người')

const cOpen = {
  createdBy: 'm1',
  teamA: ['m1'],
  teamB: [],
  acceptedPlayers: ['m1'],
  status: 'pending',
}
assert.ok(!canMemberAcceptChallenge(cOpen, 'admin_id', true), 'Admin không thể duyệt khi kèo mở chưa có Team B')

// m2 bấm nhận -> đủ 2/2
const cSingleAccepted = {
  ...cSingle,
  acceptedPlayers: ['m1', 'm2'],
}
assert.ok(isChallengeFullyAccepted(cSingleAccepted), 'Kèo đơn: cả 2 người đồng ý -> fully accepted')

// Kèo đôi 2v2: cần 4 người
const cDouble = {
  createdBy: 'm1',
  teamA: ['m1', 'm2'],
  teamB: ['m3', 'm4'],
  acceptedPlayers: ['m1', 'm3'],
  status: 'pending',
}
const pDouble = getChallengeAcceptanceProgress(cDouble)
assert.equal(pDouble.acceptedCount, 2, 'Kèo đôi: 2 người đã nhận')
assert.equal(pDouble.totalCount, 4, 'Kèo đôi: cần 4 người')
assert.equal(pDouble.isFullyAccepted, false, 'Chưa đủ 4 người')
assert.deepEqual(pDouble.pendingPlayerIds, ['m2', 'm4'], 'm2 và m4 chưa nhận')

const cDoubleFull = {
  ...cDouble,
  acceptedPlayers: ['m1', 'm2', 'm3', 'm4'],
}
assert.ok(isChallengeFullyAccepted(cDoubleFull), 'Kèo đôi: đủ 4/4 người -> fully accepted')

// 3. Admin duyệt hộ CẢ kèo — lối thoát cho người chưa có tài khoản
//
// Bẫy cũ: `canMemberAcceptChallenge` thoát sớm ở nhánh "người gọi là đấu thủ", nên admin TỰ ĐÁNH
// trong kèo và đã tự nhận thì không còn nút nào để bấm. Kèo với người chưa ghép tài khoản (không
// đăng nhập được -> không bao giờ tự nhận) kẹt `pending` tới lúc hết hạn, mà kèo pending thì
// `CourtAssignmentTab` không cho lên sân. Kèo chết hẳn, không đường cứu.
const cAdminInside = {
  createdBy: 'admin',
  teamA: ['admin'],
  teamB: ['no_account'],
  acceptedPlayers: ['admin'],
  status: 'pending',
}
assert.ok(
  !canMemberAcceptChallenge(cAdminInside, 'admin', true),
  'Admin đã tự nhận rồi thì KHÔNG hiện nút nhận lại (hành vi cũ, giữ nguyên)',
)
assert.ok(
  canAdminForceAcceptChallenge(cAdminInside, true),
  'Nhưng admin VẪN duyệt hộ được cả kèo — lối thoát cho người chưa có tài khoản',
)
assert.ok(
  !canAdminForceAcceptChallenge(cAdminInside, false),
  'Người thường không có quyền duyệt hộ',
)
assert.ok(
  !canAdminForceAcceptChallenge({ ...cAdminInside, teamB: [] }, true),
  'Kèo mở chưa đủ người thì admin không duyệt hộ được',
)
assert.ok(
  !canAdminForceAcceptChallenge({ ...cAdminInside, acceptedPlayers: ['admin', 'no_account'] }, true),
  'Đã nhận đủ thì nút duyệt hộ biến mất',
)
assert.ok(
  !canAdminForceAcceptChallenge({ ...cAdminInside, expiresAt: new Date(Date.now() - 60000).toISOString() }, true),
  'Kèo quá hạn thì không duyệt hộ được',
)

// `isFullTeam` được expose để nút duyệt hộ dùng chung một định nghĩa "đủ người" với phần còn lại
assert.equal(getChallengeAcceptanceProgress(cAdminInside).isFullTeam, true, 'Kèo đơn đủ 1v1 -> isFullTeam')
assert.equal(getChallengeAcceptanceProgress({ ...cAdminInside, teamB: [] }).isFullTeam, false, 'Kèo mở -> chưa đủ đội')

// 4. collapseChallengeSets — gom set của một kèo thành MỘT đơn vị chuỗi
//
// Luật dùng chung cho cả điểm mùa (`calculateSeasonLeaderboard`) lẫn danh hiệu (`badges.js`).
// Trước khi có nó, hai bên đếm chuỗi khác nhau: kèo BO3 thắng 2-0 cho điểm mùa thấy chuỗi 1 còn
// danh hiệu thấy chuỗi 2, nên cùng một người mang hai con số chuỗi.
const wonA = (mt) => mt.winner === 'me'

assert.deepEqual(
  collapseChallengeSets(
    [{ id: 'a', winner: 'me' }, { id: 'b', winner: 'opp' }],
    wonA,
  ).map((u) => u.won),
  [true, false],
  'Trận thường: mỗi trận là một đơn vị, giữ nguyên kết quả',
)

const bo3Win21 = collapseChallengeSets(
  [
    { id: 's1', challengeId: 'k1', winner: 'me' },
    { id: 's2', challengeId: 'k1', winner: 'opp' },
    { id: 's3', challengeId: 'k1', winner: 'me' },
  ],
  wonA,
)
assert.equal(bo3Win21.length, 1, 'Kèo BO3 ba set gom thành MỘT đơn vị')
assert.equal(bo3Win21[0].won, true, 'Thắng 2-1 -> đơn vị thắng')
assert.equal(bo3Win21[0].wins, 2, 'Vẫn giữ số set thắng')
assert.equal(bo3Win21[0].losses, 1, 'Vẫn giữ số set thua')
assert.equal(bo3Win21[0].matches.length, 3, 'Và giữ đủ ba trận thật bên trong')

const bo3Lose12 = collapseChallengeSets(
  [
    { id: 's1', challengeId: 'k1', winner: 'me' },
    { id: 's2', challengeId: 'k1', winner: 'opp' },
    { id: 's3', challengeId: 'k1', winner: 'opp' },
  ],
  wonA,
)
assert.equal(bo3Lose12[0].won, false, 'Thua 1-2 -> đơn vị THUA, set thắng lẻ không cứu được')

// Hoà set (BO5 dở dang 2-2) chưa tính là thắng — chuỗi phải có thắng thật mới nối
const drawn = collapseChallengeSets(
  [
    { id: 's1', challengeId: 'k1', winner: 'me' },
    { id: 's2', challengeId: 'k1', winner: 'opp' },
  ],
  wonA,
)
assert.equal(drawn[0].won, false, 'Hoà set thì chưa coi là thắng kèo')

// Hai kèo khác nhau không bị trộn vào nhau, và thứ tự đầu vào được giữ nguyên
const mixed = collapseChallengeSets(
  [
    { id: 'x', winner: 'me' },
    { id: 'k1s1', challengeId: 'k1', winner: 'me' },
    { id: 'k2s1', challengeId: 'k2', winner: 'opp' },
    { id: 'k1s2', challengeId: 'k1', winner: 'me' },
  ],
  wonA,
)
assert.equal(mixed.length, 3, 'Một trận thường + hai kèo = ba đơn vị')
assert.deepEqual(mixed.map((u) => u.challengeId), [null, 'k1', 'k2'], 'Giữ thứ tự xuất hiện đầu tiên')
assert.equal(mixed[1].matches.length, 2, 'Set thứ hai của k1 gộp về đúng đơn vị của nó')

assert.deepEqual(collapseChallengeSets([], wonA), [], 'Danh sách rỗng trả rỗng, không nổ')

// 5. validateStakePoints — mức cược nhập tự do
//
// Luật này từng nằm rải ở BA nơi với ba con số (CHECK trong DB, guard RPC, guard trong
// `a.placePrediction`). Khi mở sang nhập tự do, chỗ thứ ba vẫn chặn cứng [1,2,3] nên gõ 20 SP là
// bị từ chối ngay tại máy người dùng, request còn chưa rời trình duyệt.
assert.equal(validateStakePoints({ stake: 20, maxStake: 100 }).ok, true, '20 SP hợp lệ khi trần 100')
assert.equal(validateStakePoints({ stake: 1, maxStake: 100 }).ok, true, 'Cận dưới 1 SP hợp lệ')
assert.equal(validateStakePoints({ stake: 100, maxStake: 100 }).ok, true, 'Đúng trần vẫn hợp lệ')
assert.equal(validateStakePoints({ stake: 101, maxStake: 100 }).reason, 'over_max', 'Vượt trần bị chặn')
assert.equal(validateStakePoints({ stake: 0, maxStake: 100 }).reason, 'too_low', '0 SP không cược được')
assert.equal(validateStakePoints({ stake: -5, maxStake: 100 }).reason, 'too_low', 'Số âm bị chặn')
assert.equal(validateStakePoints({ stake: 2.5, maxStake: 100 }).reason, 'not_integer', 'Số lẻ bị chặn')
assert.equal(validateStakePoints({ stake: '', maxStake: 100 }).reason, 'empty', 'Ô rỗng lúc đang gõ')
assert.equal(validateStakePoints({ stake: 'abc', maxStake: 100 }).reason, 'not_integer', 'Chữ bị chặn')
assert.equal(
  validateStakePoints({ stake: 50, maxStake: 100, availableSp: 20 }).reason,
  'over_balance',
  'Cược quá số dư bị chặn — luật riêng của client, server không tính nổi điểm mùa',
)
assert.equal(
  validateStakePoints({ stake: 50, maxStake: 100, availableSp: null }).ok,
  true,
  'Không biết số dư (phía server) thì chỉ kiểm trần',
)

// 6. challengeCloserOf — người chốt kèo, chỉ khi KHÔNG phải đội B
//
// Bước 2 dòng thời gian nói về BÊN NHẬN nên tên luôn là đội B. `acceptedBy` là người bấm nhát
// cuối; ở kèo đôi người đó có thể thuộc đội A, hoặc là admin duyệt hộ. Lấy nó làm tên bước 2 thì
// thành "Nam nhận kèo" với Nam là đồng đội của chính người tạo kèo.
assert.equal(challengeCloserOf({ teamB: ['b1'], acceptedBy: 'b1' }), null, 'Đội B tự nhận thì không nhắc')
assert.equal(challengeCloserOf({ teamB: ['b1', 'b2'], acceptedBy: 'a1' }), 'a1', 'Người đội A bấm cuối thì có nhắc')
assert.equal(challengeCloserOf({ teamB: ['b1'], acceptedBy: 'admin' }), 'admin', 'Admin duyệt hộ thì có nhắc')
assert.equal(challengeCloserOf({ teamB: ['b1'] }), null, 'Kèo cũ chưa có acceptedBy -> null, không nổ')
assert.equal(challengeCloserOf(null), null, 'Đầu vào rỗng trả null')

/* ---------- challengeCountdown: chia bậc thời gian còn lại ---------- */
//
// Hạn nhận kèo là 7 NGÀY. Bản cũ in thẳng `phút:giây` nên 7 ngày ra "10080:23" — con số đó
// không nói với người dùng điều gì, và họ không biết kèo còn sống hay sắp chết.

assert.equal(challengeCountdown(null), null, 'Không có hạn thì không có gì để đếm')
assert.deepEqual(challengeCountdown(0), { kind: 'over' }, 'Đúng mốc hạn là đã hết')
assert.deepEqual(challengeCountdown(-5000), { kind: 'over' }, 'Quá hạn')

assert.deepEqual(
  challengeCountdown(7 * 86400000), { kind: 'day', n: 7 },
  'Từ 1 ngày trở lên đếm theo NGÀY — đây chính là ca làm vỡ bản cũ'
)
assert.deepEqual(
  challengeCountdown(86400000 + 3600000), { kind: 'day', n: 1 },
  '1 ngày 1 giờ vẫn là 1 ngày, làm tròn XUỐNG để không hứa dài hơn thực tế'
)
assert.deepEqual(
  challengeCountdown(86400000 - 1000), { kind: 'hour', n: 23 },
  'Sát dưới 1 ngày phải rơi xuống bậc GIỜ, không được nhảy về 0 ngày'
)
assert.deepEqual(challengeCountdown(5 * 3600000), { kind: 'hour', n: 5 })
assert.deepEqual(
  challengeCountdown(3600000 - 1000), { kind: 'clock', text: '59:59' },
  'Dưới 1 giờ mới hiện giây — lúc này từng phút mới đáng nhìn'
)
assert.deepEqual(challengeCountdown(45 * 60000 + 7000), { kind: 'clock', text: '45:07' },
  'Giây phải đệm số 0, không thì ra "45:7"')

/* ---------- abandonedChallenges: kèo ĐÃ NHẬN mà bỏ hoang ---------- */
//
// Vì sao đáng test: nhánh này HUỶ kèo và HOÀN điểm cược. Bắt nhầm một kèo đang đánh dở là xoá
// kết quả thật và kéo theo cả Elo; bỏ sót thì điểm của người đặt phiếu bị giam không ngày trả.

const DAY = 86400000
const nowTs = Date.parse('2026-09-20T12:00:00Z')
const overdue = new Date(nowTs - (cfg.challenge.abandonedAcceptedDays + 1) * DAY).toISOString()
const fresh = new Date(nowTs - 2 * DAY).toISOString()

assert.deepEqual(
  abandonedChallenges({ challenges: [{ id: 'c1', status: 'accepted', acceptedAt: fresh }] }, nowTs).map((c) => c.id),
  [], 'Mới nhận 2 ngày thì chưa phải bỏ hoang'
)
assert.deepEqual(
  abandonedChallenges({ challenges: [{ id: 'c1', status: 'accepted', acceptedAt: overdue }] }, nowTs).map((c) => c.id),
  ['c1'], 'Quá hạn mà chưa đánh hiệp nào -> bỏ hoang'
)
assert.deepEqual(
  abandonedChallenges({
    challenges: [{ id: 'c1', status: 'accepted', acceptedAt: overdue, bestOf: 3 }],
    matches: [{ challengeId: 'c1', sets: [[21, 15]], winnerTeam: 'A' }],
  }, nowTs).map((c) => c.id),
  [], 'ĐÃ ĐÁNH một hiệp thì không đụng: huỷ nó là xoá kết quả thật và tính lại Elo'
)
assert.deepEqual(
  abandonedChallenges({ challenges: [{ id: 'c1', status: 'pending', createdAt: overdue }] }, nowTs).map((c) => c.id),
  [], "Kèo 'pending' thuộc nhánh hết hạn NHẬN, không phải nhánh này — hai luật khác mốc"
)
assert.deepEqual(
  abandonedChallenges({ challenges: [{ id: 'c1', status: 'accepted' }] }, nowTs).map((c) => c.id),
  [], 'Không biết kèo bao nhiêu tuổi thì để yên, thà treo còn hơn huỷ nhầm'
)
assert.deepEqual(
  abandonedChallenges({ challenges: [{ id: 'c1', status: 'accepted', createdAt: overdue }] }, nowTs).map((c) => c.id),
  ['c1'], 'Dòng cũ thiếu acceptedAt thì lùi về createdAt'
)
assert.deepEqual(abandonedChallenges(null, nowTs), [], 'CLB rỗng không được throw')

console.log('challenge check: OK')

