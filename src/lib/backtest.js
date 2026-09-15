// Chạy lại LỊCH SỬ TRẬN THẬT qua công thức hiện hành, rồi so với lần chạy trước.
//
// Đây KHÔNG phải giả lập: kết quả từng trận là số thật đã ghi, chỉ phần tính toán (Elo, điểm mùa)
// được dựng lại từ đầu theo đúng thứ tự thời gian. Cùng một bộ trận, đổi công thức thì bộ số ra
// khác — `diffBacktest` chỉ đúng chỗ khác đó ra.
//
// Dùng để làm gì: trước khi đổi công thức Elo hoặc thang điểm mùa, chạy `runBacktest` lưu lại làm
// mốc. Sửa xong chạy lại, so hai bên. Không có bước này thì mọi thay đổi công thức đều là đoán —
// bảng xếp hạng đảo lộn 2 tuần sau mà không ai biết dòng nào gây ra.
//
// Hàm thuần: nhận dữ liệu, trả dữ liệu mới. Không đọc file, không Supabase, không React.

import { initialRatingOf, calcPlayerDeltas, applyRatingDelta, kFactorOf } from '#lib/rating.js'
import { calculateSeasonLeaderboard } from '#lib/season.js'
import { sessionFairnessRows } from '#lib/assign.js'
import cfg from '#config/app.json' with { type: 'json' }

/**
 * Đổi file sao lưu trận (`buildMatchBackup`) thành đối tượng `db` tối thiểu để chạy engine.
 * File bản 2 có điểm danh, sân của buổi và khách theo buổi. File bản 1 thiếu điểm danh —
 * khi đó `attendance` để rỗng, KHÔNG dựng bừa: đo công bằng trên dữ liệu tưởng tượng còn tệ hơn
 * là không đo.
 * @param {Object} backup
 * @returns {Object}
 */
export function datasetToDb(backup = {}) {
  const ref = backup.ref || {}
  return {
    club: { name: backup.clubName || '', code: backup.clubCode || '' },
    levels: ref.levels || [],
    members: ref.members || [],
    guests: ref.guests || [],
    // groupId ép 'ALL' cho MỌI buổi: `groupMembers` khi đó trả về toàn bộ hội viên active và
    // không đụng tới `roster`/`dues` (dữ liệu tiền, không có trong file sao lưu). Lọc thật nằm ở
    // bảng điểm danh ngay dưới — ra đúng cùng danh sách như production, không cần kéo theo tiền.
    sessions: (ref.sessions || []).map((x) => ({ ...x, groupId: 'ALL', courts: x.courts || [] })),
    roster: {},
    dues: [],
    sessionGuests: ref.sessionGuests || [],
    // File bản 1 không có điểm danh -> để rỗng. KHÔNG dựng bừa: đo công bằng trên điểm danh
    // tưởng tượng còn tệ hơn là không đo.
    attendance: ref.attendance || {},
    matches: (backup.matches || []).map((m) => ({
      ...m,
      teamA: (m.playerKeys || []).slice(0, 2),
      teamB: (m.playerKeys || []).slice(2, 4),
    })),
  }
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0 }
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0 }

/**
 * Chạy toàn bộ lịch sử trận và trả về BỘ SỐ CHUẨN.
 *
 * Mọi mảng sắp theo `id` chứ không theo điểm: bộ số này để so hai lần chạy với nhau, mà thứ tự
 * theo điểm thì chỉ cần một người đổi hạng là cả file lệch dòng, diff đọc không nổi.
 *
 * @param {Object} backup - nội dung file sao lưu trận
 * @returns {Object} snapshot
 */
export function runBacktest(backup = {}) {
  const db = datasetToDb(backup)
  const { members, guests, levels } = db
  const all = [...members, ...guests]
  const memberIds = new Set(members.map((m) => m.id))
  const nameOf = Object.fromEntries(all.map((x) => [x.id, x.name]))

  const seed = {}
  const rating = {}
  const games = {}
  const wins = {}
  const losses = {}
  all.forEach((x) => {
    seed[x.id] = initialRatingOf(x.level, levels)
    rating[x.id] = seed[x.id]
    games[x.id] = 0
    wins[x.id] = 0
    losses[x.id] = 0
  })

  // Cùng thứ tự với replayRatingCascade: theo `at`, tie-break theo id. Hai sân bấm lưu cùng
  // mili-giây mà thiếu tie-break thì mỗi lần chạy ra một kết quả, backtest thành vô nghĩa.
  const ms = [...db.matches].sort(
    (a, b) => (a.at || 0) - (b.at || 0) || String(a.id || '').localeCompare(String(b.id || ''))
  )

  const pairGaps = []   // chênh Elo trong nội bộ một đôi
  const teamGaps = []   // chênh Elo giữa hai đội
  let drift = 0         // tổng điểm hệ thống tự sinh/huỷ — Elo chuẩn phải ≈ 0

  ms.forEach((m) => {
    const teamA = m.teamA || []
    const teamB = m.teamB || []
    if (teamA.length < 2 || teamB.length < 2) return

    pairGaps.push(Math.abs(rating[teamA[0]] - rating[teamA[1]]))
    pairGaps.push(Math.abs(rating[teamB[0]] - rating[teamB[1]]))
    const ra = Math.round((rating[teamA[0]] + rating[teamA[1]]) / 2)
    const rb = Math.round((rating[teamB[0]] + rating[teamB[1]]) / 2)
    teamGaps.push(Math.abs(ra - rb))

    if (m.ratingEnabled === false || !m.winnerTeam) return
    const aWon = m.winnerTeam === 'A'
    const { deltas } = calcPlayerDeltas({
      teamA, teamB, aWon, ratingsMap: rating, gamesCountMap: games, sets: m.sets,
    })
    teamA.forEach((id) => { if (aWon) wins[id]++; else losses[id]++ })
    teamB.forEach((id) => { if (aWon) losses[id]++; else wins[id]++ })
    ;[...teamA, ...teamB].forEach((id) => {
      // Khách giao lưu đứng yên ở seed suốt replay, giống replayRatingCascade.
      if (memberIds.has(id)) {
        drift += deltas[id] || 0
        rating[id] = applyRatingDelta(rating[id], deltas[id])
      }
      games[id]++
    })
  })

  const { leaderboard } = calculateSeasonLeaderboard(db)
  const startPoints = cfg.season?.startPoints ?? 0

  // Sàn 0 kẹp sau MỖI trận, nên trận thua bị cắt rồi trận thắng sau lại cộng từ 0 -> điểm sinh ra
  // từ hư không. Đo thẳng phần chênh này: đây là con số nói thang điểm có replay được hay không.
  const season = leaderboard
    .filter((r) => r.matchesCount > 0)
    .map((r) => {
      const b = r.breakdown || {}
      // Cộng cả điểm khởi đầu vào "điểm thật", nếu không thì 100 điểm ai cũng có sẽ bị
      // `clampGain` đếm nhầm thành điểm ảo và chỉ số sức khoẻ báo động giả cho cả 22 người.
      const raw = startPoints + (b.matchNetPts || 0) + (b.streakBonusPts || 0) + (b.upsetBonusPts || 0)
      return {
        id: r.id,
        name: r.name,
        points: r.totalSeasonPoints,
        rawPoints: raw,
        clampGain: r.totalSeasonPoints - raw,
        matches: r.matchesCount,
        wins: r.winsCount,
        losses: r.lossesCount,
        upsets: r.upsetsCount,
      }
    })
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))

  const tierCounts = {}
  leaderboard.forEach((r) => (r.matchLogs || []).forEach((x) => {
    tierCounts[x.tier] = (tierCounts[x.tier] || 0) + 1
  }))

  return {
    dataset: {
      clubCode: backup.clubCode || '',
      matches: ms.length,
      sessions: new Set(ms.map((m) => m.sessionId)).size,
      players: all.length,
    },
    elo: members
      .map((m) => ({
        id: m.id,
        name: nameOf[m.id],
        level: m.level,
        seed: seed[m.id],
        rating: rating[m.id],
        games: games[m.id],
        wins: wins[m.id],
        losses: losses[m.id],
        kFactor: kFactorOf(games[m.id]),
      }))
      .sort((a, b) => String(a.id).localeCompare(String(b.id))),
    season,
    stats: {
      eloDrift: drift,
      pairGapMedian: median(pairGaps),
      pairGapP90: pct(pairGaps, 0.9),
      pairGapMax: pairGaps.length ? Math.max(...pairGaps) : 0,
      teamGapMedian: median(teamGaps),
      teamGapP90: pct(teamGaps, 0.9),
      teamGapMax: teamGaps.length ? Math.max(...teamGaps) : 0,
      totalUpsets: season.reduce((s, r) => s + r.upsets, 0),
      clampedPlayers: season.filter((r) => r.clampGain !== 0).length,
      clampGainTotal: season.reduce((s, r) => s + r.clampGain, 0),
      tierCounts,
      ...attendanceStats(db),
    },
  }
}

/**
 * Chỉ số về công bằng lượt đánh và sức chứa sân. Chỉ có ý nghĩa với file sao lưu bản 2 trở lên
 * (bản 1 không có điểm danh) — thiếu dữ liệu thì trả `null` chứ không trả 0, vì 0 đọc như
 * "đo rồi, không lệch", còn null đọc đúng là "chưa đo được".
 */
function attendanceStats(db) {
  const sessionIds = Object.keys(db.attendance || {})
  if (!sessionIds.length) {
    return { attendanceKnown: false, debtSpread: null, worstDebt: null, seatsPerSession: null }
  }
  let worst = null
  const debts = []
  const seats = []
  ;(db.sessions || []).forEach((s) => {
    const rows = sessionFairnessRows(db, s.id)
    if (!rows.length) return
    // Suất ra sân của buổi = số sân còn chơi × số trận chạy được trong khung giờ × 4 chỗ.
    const playing = (s.courts || []).filter((c) => !c.sold).length
    if (playing) seats.push(playing)
    rows.forEach((r) => {
      debts.push(r.debt)
      if (worst === null || r.debt > worst.debt) worst = { name: r.name, debt: r.debt, sessionId: s.id }
    })
  })
  if (!debts.length) return { attendanceKnown: true, debtSpread: null, worstDebt: null, seatsPerSession: null }
  return {
    attendanceKnown: true,
    debtSpread: Math.round((Math.max(...debts) - Math.min(...debts)) * 10) / 10,
    worstDebt: worst,
    seatsPerSession: seats.length ? Math.round((seats.reduce((a, b) => a + b, 0) / seats.length) * 10) / 10 : null,
  }
}

/**
 * So hai lần chạy. Trả về ĐÚNG chỗ khác nhau, không trả cả bộ số — đọc diff 22 dòng không đổi
 * để tìm 3 dòng đổi là cách nhanh nhất để bỏ sót.
 *
 * @param {Object} before - snapshot mốc
 * @param {Object} after - snapshot sau khi đổi công thức
 * @returns {{identical: boolean, stats: Array, elo: Array, season: Array, missing: Array}}
 */
export function diffBacktest(before, after) {
  const stats = []
  const keys = new Set([...Object.keys(before?.stats || {}), ...Object.keys(after?.stats || {})])
  keys.forEach((k) => {
    const a = before?.stats?.[k]
    const b = after?.stats?.[k]
    if (typeof a === 'object' || typeof b === 'object') {
      if (JSON.stringify(a) !== JSON.stringify(b)) stats.push({ key: k, before: a, after: b })
    } else if (a !== b) {
      stats.push({ key: k, before: a, after: b, delta: (b ?? 0) - (a ?? 0) })
    }
  })

  const byId = (list) => Object.fromEntries((list || []).map((x) => [x.id, x]))
  const missing = []

  const cmp = (listKey, fields) => {
    const A = byId(before?.[listKey])
    const B = byId(after?.[listKey])
    const out = []
    Object.keys({ ...A, ...B }).sort().forEach((id) => {
      if (!A[id] || !B[id]) { missing.push({ list: listKey, id, onlyIn: A[id] ? 'before' : 'after' }); return }
      const changed = {}
      fields.forEach((f) => {
        if (A[id][f] !== B[id][f]) changed[f] = { before: A[id][f], after: B[id][f], delta: B[id][f] - A[id][f] }
      })
      if (Object.keys(changed).length) out.push({ id, name: B[id].name, changed })
    })
    return out
  }

  const elo = cmp('elo', ['rating', 'seed', 'games', 'wins', 'losses'])
  const season = cmp('season', ['points', 'rawPoints', 'clampGain', 'matches', 'wins', 'losses', 'upsets'])

  return {
    identical: stats.length === 0 && elo.length === 0 && season.length === 0 && missing.length === 0,
    stats,
    elo,
    season,
    missing,
  }
}
