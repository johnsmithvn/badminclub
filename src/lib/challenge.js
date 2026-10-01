import cfg from '#config/app.json' with { type: 'json' }
import { isoOf } from '#utils/dates.js'

/** Sinh mã kèo kế tiếp dạng C-0125 */
export function nextChallengeCode(existingChallenges = []) {
  const maxNum = existingChallenges.reduce((max, c) => {
    if (!c.code) return max
    const match = c.code.match(/C-(\d+)/)
    if (match) {
      const n = parseInt(match[1], 10)
      return n > max ? n : max
    }
    return max
  }, 100)
  return 'C-' + String(maxNum + 1).padStart(4, '0')
}

/**
 * Đồng hồ đếm ngược, chia theo bậc thời gian còn lại.
 *
 * Trước đây mỗi màn tự in `phút:giây`. Hạn kèo giờ là 7 NGÀY, in kiểu đó ra `"10080:23"` —
 * không ai đọc được đó là gì. Trả về dữ liệu thô, để màn hình tự ghép chữ (RULES §3.1: lib
 * không chứa chuỗi tiếng Việt).
 *
 *   { kind: 'over' }                 đã quá hạn
 *   { kind: 'day',   n: 6 }          còn từ 1 ngày trở lên
 *   { kind: 'hour',  n: 5 }          còn dưới 1 ngày
 *   { kind: 'clock', text: '45:07' } còn dưới 1 giờ — lúc này giây mới đáng nhìn
 */
export function challengeCountdown(ms) {
  if (ms == null || Number.isNaN(ms)) return null
  if (ms <= 0) return { kind: 'over' }
  const days = Math.floor(ms / 86400000)
  if (days >= 1) return { kind: 'day', n: days }
  const hours = Math.floor(ms / 3600000)
  if (hours >= 1) return { kind: 'hour', n: hours }
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  return { kind: 'clock', text: `${mins}:${secs < 10 ? '0' : ''}${secs}` }
}

/**
 * Mốc giờ kèo hết hạn NHẬN. Thiếu `expiresAt` (dòng cũ trước khi có cột đó) thì suy từ lúc tạo.
 * Trả về mili-giây, hoặc null nếu không suy ra được.
 *
 * `defaultExpireMins` (60) CHỈ dùng cho nhánh suy dòng cũ — giữ nguyên để kèo cũ hành xử y như
 * trước. Kèo tạo từ giờ ghi thẳng `expiresAt` theo `pendingExpireHours` (24h), xem `createChallenge`.
 */
export function challengeExpiryAt(challenge) {
  if (challenge?.expiresAt) return new Date(challenge.expiresAt).getTime()
  if (challenge?.createdAt) {
    return new Date(challenge.createdAt).getTime() + (cfg.challenge?.defaultExpireMins ?? 60) * 60000
  }
  return null
}

/**
 * Kèo đã hết hạn NHẬN chưa.
 *
 * `expiresAt` là hạn để đối thủ bấm nhận kèo, KHÔNG phải hạn của trận. Kèo đã 'accepted' là bốn
 * người đã đồng ý và đang chờ sân — quá giờ đó không làm nó hết hiệu lực, `deployChallengeToCourt`
 * vẫn nạp nó lên sân bình thường.
 *
 * Trước đây mỗi màn tự viết lại biểu thức này một kiểu (5 bản sao), và bản trong
 * `ChallengeDetailModal` bỏ qua `status` nên khoá luôn cổng cược của kèo đã nhận — người ta nhận
 * kèo lúc 19h, 20h vào đặt thì bị báo hết hạn dù trận còn chưa đánh.
 */
export function isChallengeExpired(challenge, now = Date.now()) {
  if (!challenge) return false
  if (challenge.status === 'expired') return true
  if (challenge.status !== 'pending') return false
  const exp = challengeExpiryAt(challenge)
  return Boolean(exp && exp <= now)
}

/**
 * Kèo đã được nhận, đang chờ đánh.
 *
 * 'oncourt' đã bị gỡ khỏi máy trạng thái (migration 0043) vì nó là dữ liệu suy ra được đem đi
 * lưu. Client cũ chưa nạp lại vẫn có thể còn giá trị đó trong state, nên vẫn phải chấp nhận —
 * nhưng chỉ ĐÚNG MỘT chỗ trong toàn app biết chuyện đó là đây. Khi nào bỏ hẳn dung sai thì sửa
 * một dòng, không phải đi lùng bốn màn hình.
 */
export function isChallengeAccepted(challenge) {
  return challenge?.status === 'accepted' || challenge?.status === 'oncourt'
}

/** Tiến độ nhận kèo của các đấu thủ */
export function getChallengeAcceptanceProgress(challenge) {
  if (!challenge) return { acceptedCount: 0, totalCount: 0, isFullyAccepted: false, isFullTeam: false, pendingPlayerIds: [] }
  const isDoubles = (challenge.teamA || []).length > 1
  const totalCount = isDoubles ? 4 : 2
  const allCurrent = Array.from(new Set([...(challenge.teamA || []), ...(challenge.teamB || [])]))
  const acceptedList = challenge.acceptedPlayers || []
  const acceptedPlayersInMatch = allCurrent.filter((id) => acceptedList.includes(id))
  const acceptedCount = acceptedPlayersInMatch.length
  const pendingPlayerIds = allCurrent.filter((id) => !acceptedList.includes(id))
  const isFullTeam = isDoubles
    ? (challenge.teamA || []).length === 2 && (challenge.teamB || []).length === 2
    : (challenge.teamA || []).length === 1 && (challenge.teamB || []).length === 1
  const isFullyAccepted = Boolean(isFullTeam && allCurrent.length === totalCount && pendingPlayerIds.length === 0)

  return {
    acceptedCount,
    totalCount,
    isFullyAccepted,
    isFullTeam,
    pendingPlayerIds,
    isDoubles,
  }
}

/** Kiểm tra xem kèo đã được tất cả đấu thủ đồng ý chưa */
export function isChallengeFullyAccepted(challenge) {
  return getChallengeAcceptanceProgress(challenge).isFullyAccepted
}

/** Kiểm tra thành viên có thể bấm Nhận kèo không */
export function canMemberAcceptChallenge(challenge, myMemberId, isAdmin = false) {
  if (!challenge || challenge.status !== 'pending') return false
  if (isChallengeExpired(challenge)) return false

  const allCurrent = Array.from(new Set([...(challenge.teamA || []), ...(challenge.teamB || [])]))
  const acceptedList = challenge.acceptedPlayers || []

  // Nếu người dùng là đấu thủ trong trận đấu: chỉ nhận được khi BẢN THÂN CHƯA NHẬN (kể cả khi là Admin)
  if (myMemberId && allCurrent.includes(myMemberId)) {
    return !acceptedList.includes(myMemberId)
  }

  // Nếu là Admin nhưng KHÔNG thi đấu trong kèo: có thể duyệt nhanh khi kèo đã đủ người ở cả 2 đội và chưa tất cả accept
  if (isAdmin) {
    const isDoubles = (challenge.teamA || []).length > 1
    const needed = isDoubles ? 2 : 1
    const isFull = (challenge.teamA || []).length === needed && (challenge.teamB || []).length === needed
    const isFullyAccepted = isFull && allCurrent.length === (needed * 2) && allCurrent.every((id) => acceptedList.includes(id))
    return isFull && !isFullyAccepted
  }

  return false
}

/**
 * Kiểm mức cược của một phiếu dự đoán.
 *
 * MỘT chỗ duy nhất giữ luật này, vì nó từng nằm rải ở ba nơi với ba con số: CHECK trong DB,
 * guard trong RPC, và guard trong `a.placePrediction`. Khi mở sang nhập tự do, hai chỗ đầu được
 * gỡ còn chỗ thứ ba vẫn chặn cứng `[1,2,3]` — người dùng gõ 20 SP thì ăn toast từ chối ngay tại
 * máy mình, request còn chưa rời trình duyệt.
 *
 * `availableSp` để `null` khi phía gọi chưa biết số dư (server không dựng lại được điểm mùa).
 *
 * @returns {{ ok: boolean, reason: 'empty'|'not_integer'|'too_low'|'over_max'|'over_balance'|null }}
 */
export function validateStakePoints({ stake, maxStake = 100, availableSp = null } = {}) {
  if (stake === '' || stake === null || stake === undefined) return { ok: false, reason: 'empty' }
  const n = Number(stake)
  if (!Number.isFinite(n)) return { ok: false, reason: 'not_integer' }
  if (!Number.isInteger(n)) return { ok: false, reason: 'not_integer' }
  if (n < 1) return { ok: false, reason: 'too_low' }
  if (n > maxStake) return { ok: false, reason: 'over_max' }
  if (availableSp !== null && n > Number(availableSp)) return { ok: false, reason: 'over_balance' }
  return { ok: true, reason: null }
}

/**
 * Người CHỐT kèo, chỉ khi đó không phải đội B.
 *
 * Bước "nhận kèo" trên dòng thời gian nói về BÊN NHẬN, nên tên ở đó luôn là đội B. `acceptedBy`
 * là người bấm nhát cuối làm kèo đủ chữ ký — ở kèo đôi người đó có thể thuộc đội A, hoặc là admin
 * duyệt hộ chẳng đánh trận nào. Lấy nó làm tên bước 2 thì thành "Nam nhận kèo" với Nam là đồng
 * đội của chính người tạo kèo.
 *
 * Đội B tự nhận là chuyện đương nhiên nên trả `null` — nói ra chỉ thừa.
 */
export function challengeCloserOf(challenge) {
  const by = challenge?.acceptedBy
  if (!by) return null
  return (challenge.teamB || []).includes(by) ? null : by
}

/**
 * Thu danh sách trận thành các ĐƠN VỊ tính chuỗi thắng: mỗi kèo đếm đúng MỘT lần.
 *
 * Luật chung cho mọi nơi đếm chuỗi (điểm mùa lẫn danh hiệu): một kèo BO3 thắng 2-1 là MỘT lần
 * thắng, không phải hai. Thiếu nó thì BO3 thành đường cày mốc thưởng streak, và tệ hơn là điểm
 * mùa với danh hiệu nói hai con số khác nhau về cùng một chuỗi.
 *
 * Kết quả của kèo lấy theo đa số set thắng trong PHẠM VI danh sách truyền vào — chuỗi đang đánh
 * dở thì tính theo những set đã có, đúng như người xem đang thấy.
 *
 * Đơn vị kèo nằm ở vị trí của set ĐẦU TIÊN gặp trong mảng, nên hàm này giữ nguyên chiều sắp xếp
 * của đầu vào: truyền mảng tăng dần thì ra tăng dần, giảm dần thì ra giảm dần.
 *
 * @param {Array} matches danh sách trận đã sắp thứ tự
 * @param {(mt: object) => boolean} wonOf trả về true nếu người đang xét thắng trận đó
 * @returns {Array<{ challengeId: string|null, won: boolean, wins: number, losses: number, matches: Array }>}
 */
export function collapseChallengeSets(matches = [], wonOf) {
  const out = []
  const seen = new Map()

  for (const mt of matches) {
    const won = Boolean(wonOf(mt))
    const cid = mt?.challengeId || null

    if (cid && seen.has(cid)) {
      const unit = out[seen.get(cid)]
      if (won) unit.wins += 1
      else unit.losses += 1
      unit.matches.push(mt)
      continue
    }

    if (cid) seen.set(cid, out.length)
    out.push({ challengeId: cid, wins: won ? 1 : 0, losses: won ? 0 : 1, matches: [mt] })
  }

  // Hoà set (2-2 ở BO5 dở dang) tính là CHƯA thắng — chuỗi thắng phải có thắng thật mới nối.
  return out.map((u) => ({ ...u, won: u.wins > u.losses }))
}

/**
 * Admin duyệt nhanh CẢ kèo — nhận hộ mọi đấu thủ trong một lần bấm.
 *
 * Tách khỏi `canMemberAcceptChallenge` vì hai câu hỏi khác nhau: hàm kia hỏi "tôi có được tự
 * nhận cho mình không", hàm này hỏi "admin có được nhận hộ cả kèo không". Nhồi chung thì nhánh
 * admin nằm SAU cái `return` sớm của nhánh đấu thủ, nên admin tự đánh kèo là không bao giờ với
 * tới được — đó chính là cái bẫy đang có.
 *
 * Vì sao cần: thành viên chưa ghép tài khoản (`userId` rỗng, xem `myMember`) không đăng nhập
 * được nên KHÔNG BAO GIỜ tự bấm nhận. Admin tự đánh với người như vậy thì kèo kẹt `pending` tới
 * lúc hết hạn, và kèo pending thì không lên sân được (`CourtAssignmentTab` chỉ lấy kèo đã nhận).
 * Đây là đường thoát duy nhất.
 *
 * Cố ý KHÔNG nhận `myMemberId`: quyền này thuộc về vai admin, không phụ thuộc người bấm có đứng
 * trong kèo hay không — chính chỗ phụ thuộc đó đã đẻ ra bug.
 */
export function canAdminForceAcceptChallenge(challenge, isAdmin = false) {
  if (!isAdmin) return false
  if (!challenge || challenge.status !== 'pending') return false
  if (isChallengeExpired(challenge)) return false

  // Kèo mở còn trống chỗ thì không duyệt được: chưa biết ai là đối thủ để nhận hộ.
  const prog = getChallengeAcceptanceProgress(challenge)
  return Boolean(prog.isFullTeam && !prog.isFullyAccepted)
}

/**
 * Tính toán tiến độ chuỗi ván đấu (BO1, BO3, BO5) của một Kèo:
 * - Thu thập tất cả các trận con thuộc kèo đó.
 * - Đếm số hiệp thắng của Đội A và Đội B.
 * - Xác định trạng thái đã xong hay chưa, tỉ số chuỗi, hiệp tiếp theo.
 */
export function getChallengeSeriesProgress(challenge, matches = []) {
  if (!challenge) {
    return {
      winsA: 0,
      winsB: 0,
      winsNeeded: 1,
      isComplete: false,
      winnerTeam: null,
      totalSetsPlayed: 0,
      nextSetNumber: 1,
      isDecider: false,
      seriesScoreText: '0 – 0',
      playedMatches: [],
    }
  }

  const chalMatches = (matches || [])
    .filter((m) => m && m.challengeId === challenge.id)
    .slice()
    .sort((a, b) => (a.at || 0) - (b.at || 0))

  let winsA = 0
  let winsB = 0
  chalMatches.forEach((m) => {
    if (m.winnerTeam === 'A') winsA++
    else if (m.winnerTeam === 'B') winsB++
  })

  const bestOf = Number(challenge.bestOf) || 1
  const winsNeeded = Math.ceil(bestOf / 2)
  const isComplete = Boolean(winsA >= winsNeeded || winsB >= winsNeeded)
  const winnerTeam = winsA >= winsNeeded ? 'A' : (winsB >= winsNeeded ? 'B' : null)
  const totalSetsPlayed = chalMatches.length
  const nextSetNumber = totalSetsPlayed + 1
  const isDecider = Boolean(!isComplete && winsA === winsNeeded - 1 && winsB === winsNeeded - 1)
  const seriesScoreText = `${winsA} – ${winsB}`

  return {
    winsA,
    winsB,
    winsNeeded,
    isComplete,
    winnerTeam,
    totalSetsPlayed,
    nextSetNumber,
    isDecider,
    seriesScoreText,
    playedMatches: chalMatches,
  }
}

/**
 * Thống kê tỷ lệ và số điểm dự đoán cho một Kèo đấu
 */
export function getPredictionStats(predictions = [], challengeId) {
  // Loại cả 'refunded': phiếu đã hoàn thì net = 0, để nó trong hồ là tỉ lệ pool kể chuyện một
  // ván cược không còn tồn tại.
  const activePreds = (predictions || []).filter(
    (p) => p && p.challengeId === challengeId && p.status !== 'cancelled' && p.status !== 'refunded'
  )

  let countA = 0
  let countB = 0
  let pointsA = 0
  let pointsB = 0
  const predictorsA = []
  const predictorsB = []

  activePreds.forEach((p) => {
    const pts = Number(p.stakePoints) || 0
    if (p.team === 'A') {
      countA++
      pointsA += pts
      predictorsA.push(p)
    } else if (p.team === 'B') {
      countB++
      pointsB += pts
      predictorsB.push(p)
    }
  })

  const totalCount = countA + countB
  const totalPoints = pointsA + pointsB

  let pctA = 50
  let pctB = 50
  if (totalPoints > 0) {
    pctA = Math.round((pointsA / totalPoints) * 100)
    pctB = 100 - pctA
  } else if (totalCount > 0) {
    pctA = Math.round((countA / totalCount) * 100)
    pctB = 100 - pctA
  }

  return {
    countA,
    countB,
    totalCount,
    pointsA,
    pointsB,
    totalPoints,
    pctA,
    pctB,
    predictorsA,
    predictorsB,
  }
}

/**
 * Lấy phiếu dự đoán của thành viên cho một kèo cụ thể
 */
export function getMemberPrediction(predictions = [], challengeId, memberId) {
  if (!challengeId || !memberId) return null
  return (predictions || []).find(
    (p) => p.challengeId === challengeId && p.memberId === memberId && p.status !== 'cancelled'
  ) || null
}

/**
 * Kiểm tra thành viên có đủ điều kiện gửi dự đoán cho Kèo đấu không
 */
export function canMemberPredict(challenge, memberId, db = {}, availablePoints = 0) {
  if (!challenge || !memberId) return { ok: false, reason: 'invalid_params' }

  // 1. Kiểm tra cờ cho phép dự đoán và khóa sổ
  if (challenge.predictionsEnabled === false) {
    return { ok: false, reason: 'disabled' }
  }
  if (challenge.predictionsLocked || challenge.status === 'oncourt' || challenge.status === 'played' || challenge.status === 'cancelled' || challenge.status === 'expired' || challenge.status === 'declined') {
    return { ok: false, reason: 'locked' }
  }
  // Chặn theo MỐC GIỜ chứ không theo cột `status`: kèo quá hạn mà chưa ai bấm vào thì `status`
  // vẫn đang là 'pending'. Chỉ áp cho kèo chưa ai nhận — xem `isChallengeExpired`.
  if (isChallengeExpired(challenge)) {
    return { ok: false, reason: 'locked' }
  }
  // Đã ghi hiệp nào là đóng cổng — SUY THẲNG TỪ TRẬN, không chỉ tin cờ `predictionsLocked`.
  // Cờ đó là dữ liệu dẫn xuất đem đi lưu, đúng cái bẫy đã sinh ra `oncourt`: nó chỉ có đường
  // bật. Đọc từ trận thì không bao giờ lệch với sự thật.
  if (getChallengeSeriesProgress(challenge, db.matches || []).totalSetsPlayed > 0) {
    return { ok: false, reason: 'locked' }
  }

  // 2. Luật 1: Cấm tuyệt đối đấu thủ trong trận dự đoán
  const allPlayers = [...(challenge.teamA || []), ...(challenge.teamB || [])]
  if (allPlayers.includes(memberId)) {
    return { ok: false, reason: 'player_conflict' }
  }

  // 3. Kiểm tra thành viên đang hoạt động
  const member = (db.members || []).find((m) => m.id === memberId)
  if (!member || member.active === false) {
    return { ok: false, reason: 'member_inactive' }
  }

  // 4. Kiểm tra đã có phiếu cược chưa (mỗi người 1 phiếu)
  const existing = getMemberPrediction(db.challengePredictions || [], challenge.id, memberId)
  if (existing && existing.status === 'pending') {
    return { ok: false, reason: 'already_predicted', existing }
  }

  // 5. Kiểm tra số dư SP tối thiểu (>= 1 SP)
  if (Number(availablePoints) < 1) {
    return { ok: false, reason: 'insufficient_points' }
  }

  return { ok: true, reason: null }
}

/** Trạng thái kèo đã kết thúc hẳn, không còn đường quay lại sân. */
const DEAD_CHALLENGE_STATUS = new Set(['cancelled', 'declined', 'expired'])

/** Trạng thái buổi tập mà mọi kèo gắn vào nó không còn cơ hội được đánh:
 * - Buổi bị huỷ ('cancelled')
 * - Buổi đã chốt ('closed') VÀ ngày của buổi đã thực sự trôi qua trong quá khứ.
 * Buổi ở hôm nay hoặc tương lai (kể cả đã chốt danh sách người đi trước) thì chưa diễn ra xong,
 * quản trò vẫn có thể mở lại hoặc xếp kèo vào sân đánh bình thường.
 */
export function isSessionDead(session, now = Date.now()) {
  if (!session) return true
  if (session.status === 'cancelled') return true
  if (session.status === 'closed') {
    if (!session.date) return true
    const today = isoOf(new Date(now))
    return session.date < today
  }
  return false
}

/**
 * Kèo đã chết trên THỰC TẾ — tính cả những kèo mà cột `status` chưa kịp đổi.
 *
 * Ba đường chết:
 *   1. `status` đã là cancelled / declined / expired.
 *   2. Còn 'pending' nhưng quá hạn nhận kèo (không có tiến trình nào quét, `status` chỉ đổi khi
 *      có người bấm vào nó).
 *   3. Gắn vào một buổi đã CHỐT SỔ (trong quá khứ) hoặc bị HUỶ — trận sẽ không bao giờ được đánh
 *      nữa. Đây là đường duy nhất giết được kèo 'accepted' bị bỏ rơi; thiếu nó thì cọc của người
 *      đặt bị giam vĩnh viễn vì bốn người đã nhận kèo rồi không ai bấm gì thêm.
 *
 * Kèo 'played' KHÔNG chết: nó đã có kết quả để quyết toán.
 *
 * 'oncourt' thì CÓ, nhưng chỉ qua đường số 3. Quản trò đẩy kèo lên sân rồi cả nhóm về mất, không
 * ai nhập tỷ số — `status` nằm lại 'oncourt' vĩnh viễn và phiếu không bao giờ tới lượt được
 * quyết toán. Kèo 'oncourt' trong một buổi ĐANG MỞ thì vẫn sống: nó đang đánh thật.
 *
 * @param session buổi tập của kèo (có thể null nếu kèo tự do, chưa gắn buổi nào)
 */
const ALIVE_CHALLENGE_STATUS = new Set(['pending', 'accepted', 'oncourt'])

export function isChallengeDead(challenge, session = null, now = Date.now()) {
  if (!challenge) return true
  if (DEAD_CHALLENGE_STATUS.has(challenge.status)) return true
  if (!ALIVE_CHALLENGE_STATUS.has(challenge.status)) return false
  if (isChallengeExpired(challenge, now)) return true
  if (session && isSessionDead(session, now)) return true
  return false
}

/**
 * Kèo HẾT HẠN NHẬN mà cột `status` chưa kịp đổi — không ai bấm vào thì nó nằm lì ở 'pending'.
 * Đây mới đúng nghĩa "hết hạn".
 */
export function expiredChallenges(db, now = Date.now()) {
  return (db?.challenges || []).filter(
    (c) => ALIVE_CHALLENGE_STATUS.has(c.status) && isChallengeExpired(c, now)
  )
}

/**
 * Kèo còn sống nhưng BUỔI của nó đã chốt sổ (trong quá khứ) / bị huỷ — trận sẽ không diễn ra
 * ở buổi đó nữa.
 *
 * TÁCH HẲN khỏi nhóm hết hạn, vì hai nguyên nhân khác nhau và cách xử phải khác nhau. Bản đầu
 * tôi gộp làm một rồi đánh dấu tất cả là 'expired': quản trò chốt sổ buổi tối là kèo chưa kịp
 * đánh bị GIẾT, người dùng nhìn thấy nhãn "Hết hạn" trong khi kèo chưa hề quá giờ nhận.
 *
 * Buổi chết không giết kèo — kèo chỉ mất chỗ. Trả nó về hàng chờ tự do để gắn sang buổi khác.
 */
export function orphanedChallenges(db, now = Date.now()) {
  const sessions = new Map((db?.sessions || []).map((s) => [s.id, s]))
  return (db?.challenges || []).filter((c) => {
    if (!ALIVE_CHALLENGE_STATUS.has(c.status)) return false
    if (isChallengeExpired(c, now)) return false // đã thuộc nhóm hết hạn ở trên
    const sess = c.sessionId ? sessions.get(c.sessionId) || null : null
    return Boolean(sess && isSessionDead(sess, now))
  })
}

/**
 * Kèo ĐÃ NHẬN nhưng bỏ hoang: bốn người đã ký tên rồi không ai đánh, quá `abandonedAcceptedDays`.
 *
 * TÁCH KHỎI 'expired' vì `isChallengeExpired` cố ý trả false cho kèo đã nhận — hạn nhận kèo và
 * hạn đánh kèo là hai chuyện. Nhưng kèo đã nhận mà treo vô thời hạn cũng không được: ai đã đặt
 * phiếu vào đó bị giam SP không có ngày trả.
 *
 * Mốc đếm từ `acceptedAt`; dòng cũ thiếu mốc đó thì lùi về `createdAt`, không có cả hai thì BỎ
 * QUA — thà để kèo treo còn hơn huỷ nhầm một kèo không biết nó bao nhiêu tuổi.
 *
 * ĐÁNH RỒI THÌ KHÔNG ĐỤNG: còn một hiệp đã đánh nghĩa là loạt đang dở, huỷ nó là xoá kết quả
 * thật và kéo theo cả Elo. Đó là việc của người, không phải của máy quét.
 */
export function abandonedChallenges(db, now = Date.now()) {
  const days = cfg.challenge?.abandonedAcceptedDays
  if (!days || days <= 0) return []
  const cutoff = days * 86400000
  const matches = db?.matches || []
  return (db?.challenges || []).filter((c) => {
    if (!isChallengeAccepted(c)) return false
    const since = c.acceptedAt || c.createdAt
    if (!since) return false
    const t = new Date(since).getTime()
    if (Number.isNaN(t) || now - t < cutoff) return false
    return getChallengeSeriesProgress(c, matches).totalSetsPlayed === 0
  })
}

/**
 * Tổng SP đang bị giam trong các phiếu CHỜ quyết toán của một thành viên.
 * Bỏ qua phiếu nằm trên kèo đã chết — xem `isChallengeDead`.
 */
export function pendingStakeOf(predictions = [], challenges = [], sessions = [], memberId, now = Date.now()) {
  if (!memberId) return 0
  const byId = new Map((challenges || []).map((c) => [c.id, c]))
  const sessById = new Map((sessions || []).map((s) => [s.id, s]))
  return (predictions || []).reduce((sum, p) => {
    if (p.memberId !== memberId || p.status !== 'pending') return sum
    const chal = byId.get(p.challengeId)
    const sess = chal?.sessionId ? sessById.get(chal.sessionId) || null : null
    if (isChallengeDead(chal, sess, now)) return sum
    return sum + (Number(p.stakePoints) || 0)
  }, 0)
}

/**
 * VỐN CƯỢC của một thành viên = số SP được đem ra đặt, trước khi trừ phần đang bị giam.
 *
 * Người đã ra sân trong mùa: đúng bằng điểm mùa. Người CHƯA đánh trận nào: điểm khởi đầu cộng lãi/lỗ
 * cược. Không có nhánh này thì đầu mùa cả CLB đều 0 SP (điểm khởi đầu chỉ cấp sau trận đầu — xem
 * `calculateSeasonLeaderboard`), và kèo đầu tiên của mùa không ai cược được.
 *
 * Không mở lỗ cược miễn phí: thua trước khi ra sân thì lỗ đó vẫn nằm trong `predictionNetPoints`,
 * trận đầu tiên cộng vào điểm khởi đầu là trừ ngay. Điểm trên BXH KHÔNG đổi — hàm này chỉ đọc.
 *
 * @param seasonRes kết quả `calculateSeasonLeaderboard`
 */
export function stakeBaseOf(seasonRes, memberId) {
  const row = (seasonRes?.leaderboard || []).find((r) => r.id === memberId)
  if (!row) return 0
  if (row.matchesCount > 0) return row.totalSeasonPoints || 0
  const start = seasonRes.season?.startPoints ?? cfg.season?.startPoints ?? 0
  return Math.max(0, start + (row.breakdown?.predictionNetPoints || 0))
}

/**
 * BXH "Sòng bạc": thống kê phiếu dự đoán ĐÃ ĂN/THUA trong mùa, theo từng người.
 *
 * Dựng từ `predictionLogs` của `calculateSeasonLeaderboard` chứ không quét lại `challengePredictions`:
 * nó đã bó phiếu trong khung mùa, nên bảng này và điểm mùa không bao giờ đếm hai bộ phiếu khác nhau.
 * Phiếu đang chờ / đã hoàn không có mặt — chưa ai được mất gì.
 *
 * MỘT bảng, xếp theo lãi ròng. Các chỉ số khác thành DANH HIỆU, mỗi danh hiệu trao cho đúng một
 * người dẫn đầu chỉ số đó (hoà thì người xếp trên bảng giữ) — thay cho nhiều bảng xếp riêng.
 *
 * Phiếu lấy theo thứ tự `predictionLogs` (tăng dần theo lúc có kết quả), nên `form` và các chuỗi
 * đọc đúng chiều thời gian.
 *
 * @param minTickets số phiếu tối thiểu để nhận "Thần dự đoán" / "Nhà đầu tư" — 1/1 trúng không phải thần.
 * @param minStreak chuỗi tối thiểu để nhận "Tay đỏ" / "Tay đen".
 * @returns {Array<{ id, name, avatarUrl, rank, tickets, wins, losses, staked, net, winRate, roi,
 *   form: Array<'won'|'lost'>, streak: { won: boolean, n: number }, bestWinStreak, bestLoseStreak,
 *   biggestWin, titles: string[] }>}
 */
export function gamblerBoard(
  seasonRes,
  minTickets = cfg.challenge?.gamblerMinTickets ?? 5,
  minStreak = cfg.challenge?.gamblerMinStreak ?? 3,
) {
  const rows = (seasonRes?.leaderboard || [])
    .filter((r) => r.predictionLogs?.length)
    .map((r) => {
      const tickets = r.predictionLogs.map((l) => l.prediction)
      const stakeOf = (p) => Number(p.stakePoints) || 0
      const won = tickets.map((p) => p.status === 'won')
      const wins = won.filter(Boolean).length
      const staked = tickets.reduce((s, p) => s + stakeOf(p), 0)
      const net = r.breakdown?.predictionNetPoints || 0

      // Chuỗi dài nhất mỗi chiều + chuỗi đang chạy (tính tới phiếu mới nhất)
      let run = 0
      let bestWinStreak = 0
      let bestLoseStreak = 0
      won.forEach((w, i) => {
        run = i > 0 && won[i - 1] === w ? run + 1 : 1
        if (w) bestWinStreak = Math.max(bestWinStreak, run)
        else bestLoseStreak = Math.max(bestLoseStreak, run)
      })

      return {
        id: r.id,
        name: r.name,
        avatarUrl: r.avatarUrl,
        tickets: tickets.length,
        wins,
        losses: tickets.length - wins,
        staked,
        net,
        winRate: Math.round((wins / tickets.length) * 100),
        // Lãi trên mỗi SP đặt: +50% nghĩa là cứ đặt 100 SP thì lời 50.
        roi: staked ? Math.round((net / staked) * 100) : 0,
        form: tickets.slice(-5).map((p) => p.status),
        streak: { won: won[won.length - 1], n: run },
        bestWinStreak,
        bestLoseStreak,
        biggestWin: Math.max(0, ...tickets.filter((p) => p.status === 'won').map(stakeOf)),
        titles: [],
      }
    })
    .sort((a, b) => b.net - a.net || b.winRate - a.winRate || b.tickets - a.tickets)

  // [danh hiệu, ai đủ điều kiện, chỉ số để so]. Thứ tự = thứ tự hiện trên màn hình.
  const TITLES = [
    ['accuracy', (r) => r.tickets >= minTickets, (r) => r.winRate],
    ['roi', (r) => r.tickets >= minTickets && r.roi > 0, (r) => r.roi],
    ['hotHand', (r) => r.bestWinStreak >= minStreak, (r) => r.bestWinStreak],
    ['bigShot', (r) => r.biggestWin > 0, (r) => r.biggestWin],
    ['staked', () => true, (r) => r.staked],
    ['tickets', () => true, (r) => r.tickets],
    ['coldHand', (r) => r.bestLoseStreak >= minStreak, (r) => r.bestLoseStreak],
    ['donor', (r) => r.net < 0, (r) => -r.net],
  ]
  TITLES.forEach(([key, eligible, score]) => {
    const best = rows.filter(eligible).reduce((top, r) => (!top || score(r) > score(top) ? r : top), null)
    if (best) best.titles.push(key)
  })
  rows.forEach((r, i) => { r.rank = i + 1 })
  return rows
}

/**
 * SP còn dùng được để đặt cược = điểm mùa hiện có trừ phần đang bị giam.
 * Bằng 0 là KHÔNG được cược — không có cửa nợ điểm.
 */
export function availableSeasonPoints(totalSeasonPoints, predictions = [], challenges = [], sessions = [], memberId, now = Date.now()) {
  const total = Number(totalSeasonPoints) || 0
  return Math.max(0, total - pendingStakeOf(predictions, challenges, sessions, memberId, now))
}

/**
 * Áp kết quả quyết toán lên danh sách phiếu ở state client.
 *
 * Phải khớp TỪNG DÒNG với `settle_challenge_predictions` trong 0042, vì đây chỉ là bản cập nhật
 * lạc quan cho màn hình còn sự thật nằm ở RPC. Lệch nhau là màn hình báo một đằng DB một nẻo.
 *
 * @param winnerTeam 'A' | 'B' để chia thắng thua; null/undefined để hoàn phiếu.
 */
export function settlePredictionsLocal(predictions = [], challengeId, winnerTeam, at) {
  return (predictions || []).map((p) => {
    if (p.challengeId !== challengeId) return p
    if (winnerTeam === 'A' || winnerTeam === 'B') {
      // Nhận cả phiếu đã quyết toán: sửa tỷ số làm lật đội thắng thì phiếu phải chạy lại.
      if (p.status !== 'pending' && p.status !== 'won' && p.status !== 'lost') return p
      const won = p.team === winnerTeam
      return {
        ...p,
        status: won ? 'won' : 'lost',
        payoutPoints: won ? (Number(p.stakePoints) || 0) * 2 : 0,
        settledAt: at,
        updatedAt: at,
      }
    }
    // Hoàn: chỉ đụng phiếu đang chờ, không lặng lẽ gỡ kết quả đã ăn/thua.
    if (p.status !== 'pending') return p
    return { ...p, status: 'refunded', payoutPoints: Number(p.stakePoints) || 0, settledAt: at, updatedAt: at }
  })
}

/**
 * Quét và phân loại tính chất trận đấu tự động theo 2 trục độc lập:
 * 1. Trục Lịch sử đối đầu (H2H): Lần đầu so vợt / Duyên nợ / Phục thù
 * 2. Trục Trình độ (Rating Gap): Một chín một mười / Châu chấu đá xe
 *
 * @param {object} challenge
 * @param {Array} matches
 * @param {number} ratA
 * @param {number} ratB
 * @returns {Array<{ id: string, labelKey: string, color: string, bg: string, border: string }>}
 */
export function getChallengeMatchTags(challenge, matches = [], ratA = 0, ratB = 0) {
  const teamA = challenge?.teamA || []
  const teamB = challenge?.teamB || []
  if (!teamA.length || !teamB.length) return []

  const tags = []

  // 1. TRỤC ĐỐI ĐẦU (H2H STORY) - Chọn 1 tag tiêu biểu
  const pA1 = teamA[0]
  const pA2 = teamA[1]
  const pB1 = teamB[0]
  const pB2 = teamB[1]

  const h2hMatches = []
  ;(matches || []).forEach((m) => {
    if (!m || !m.winnerTeam) return
    const mA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
    const mB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])

    const aInA = pA2 ? (mA.includes(pA1) && mA.includes(pA2)) : mA.includes(pA1)
    const bInB = pB2 ? (mB.includes(pB1) && mB.includes(pB2)) : mB.includes(pB1)
    const aInB = pA2 ? (mB.includes(pA1) && mB.includes(pA2)) : mB.includes(pA1)
    const bInA = pB2 ? (mA.includes(pB1) && mA.includes(pB2)) : mA.includes(pB1)

    if ((aInA && bInB) || (aInB && bInA)) {
      const wonA = aInA ? m.winnerTeam === 'A' : m.winnerTeam === 'B'
      const at = m.at || (m.playedAt ? Date.parse(m.playedAt) : (m.date ? Date.parse(m.date) : 0))
      h2hMatches.push({ id: m.id, wonA, at })
    }
  })

  h2hMatches.sort((a, b) => a.at - b.at)

  if (h2hMatches.length === 0) {
    tags.push({
      id: 'firstTime',
      labelKey: 'challenge.tagFirstTime',
      color: '#8FE3DA',
      bg: 'rgba(143,227,218,0.12)',
      border: 'rgba(143,227,218,0.4)',
    })
  } else {
    const winsA = h2hMatches.filter((x) => x.wonA).length
    const winsB = h2hMatches.length - winsA

    if (h2hMatches.length >= 3 && Math.abs(winsA - winsB) <= 1) {
      tags.push({
        id: 'rivalry',
        labelKey: 'challenge.tagRivalry',
        color: '#FFB39F',
        bg: 'rgba(255,179,159,0.12)',
        border: 'rgba(255,179,159,0.4)',
      })
    } else {
      tags.push({
        id: 'revenge',
        labelKey: 'challenge.tagRevenge',
        color: '#FF9C9C',
        bg: 'rgba(255,156,156,0.12)',
        border: 'rgba(255,156,156,0.4)',
      })
    }
  }

  // 2. TRỤC TRÌNH ĐỘ (RATING GAP) - Chọn 1 tag tiêu biểu
  if (ratA > 0 && ratB > 0) {
    const gap = Math.abs(ratA - ratB)
    if (gap <= 50) {
      tags.push({
        id: 'balanced',
        labelKey: 'challenge.tagBalanced',
        color: '#5FD9A2',
        bg: 'rgba(95,217,162,0.12)',
        border: 'rgba(95,217,162,0.4)',
      })
    } else if (gap >= 150) {
      tags.push({
        id: 'underdog',
        labelKey: 'challenge.tagUnderdog',
        color: '#F5C451',
        bg: 'rgba(245,196,81,0.12)',
        border: 'rgba(245,196,81,0.4)',
      })
    }
  }

  return tags
}
