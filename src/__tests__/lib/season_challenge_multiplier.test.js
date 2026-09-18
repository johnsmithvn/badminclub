import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import {
  calculateSeasonLeaderboard,
  calcSeasonMatchDelta,
  calcSeasonMatchDeltaFinal,
  isChallengeMatch,
  challengeMultiplierOf,
} from '../../lib/season.js'

import cfgApp from '#config/app.json' with { type: 'json' }

// LƯU Ý QUAN TRỌNG — vì sao file này tồn tại:
//
// Bộ backtest (`src/__tests__/backtest/`) KHÔNG có trận nào sinh từ kèo (`grep challengeId` ra 0
// kết quả trên cả hai bộ data). Nghĩa là đổi hệ số kèo vẫn để backtest xanh nguyên — LUẬT SỐ 0
// không gác được nhánh này. File này là lưới gác duy nhất cho hệ số điểm mùa của kèo.
//
// Khi nào CLB đánh đủ kèo thật thì xuất một bộ data mới có `challengeId` và tạo mốc cho nó; lúc
// đó backtest mới thật sự phủ được phần này.

const START = cfgApp.season?.startPoints ?? 0
const MULT = cfgApp.season?.challengeMultiplier ?? 1

// Hai đội Elo bằng nhau -> dải `balanced`: thắng +14, thua -8. Mọi con số dưới đây dẫn xuất từ
// hai mốc đó nhân hệ số, không ghim số tuyệt đối — đổi `deltaScale` trong config thì test vẫn
// đúng luật, chỉ đổi giá trị.
const BAL = cfgApp.season?.deltaScale?.balanced ?? { win: 14, loss: -8 }
const WIN = BAL.win
const LOSS = BAL.loss

const baseMembers = [
  { id: 'm1', name: 'Kiên', active: true },
  { id: 'm2', name: 'Mai', active: true },
]

const baseSessions = [{ id: 's1', date: '2026-07-05' }]

/** Một ván giữa m1 (đội A) và m2 (đội B), Elo cân nhau để luôn rơi vào dải `balanced`. */
const mk = (id, winnerTeam, extra = {}) => ({
  id,
  sessionId: 's1',
  teamA: ['m1'],
  teamB: ['m2'],
  winnerTeam,
  sets: [[21, 19]],
  initialRatingA: 1500,
  initialRatingB: 1500,
  createdAt: `2026-07-05T10:${String(extra.min ?? 0).padStart(2, '0')}:00Z`,
  ...extra,
})

const ptsOf = (matches, memberId) => {
  const { leaderboard } = calculateSeasonLeaderboard({
    members: baseMembers,
    sessions: baseSessions,
    matches,
  })
  return leaderboard.find((r) => r.id === memberId).totalSeasonPoints
}

test('Hệ số điểm mùa cho kèo', async (t) => {
  await t.test('1. Trận thường KHÔNG được nhân — hệ số không rò ra ngoài kèo', () => {
    const ms = [mk('mt1', 'A', { min: 0 })]
    assert.equal(ptsOf(ms, 'm1'), START + WIN, 'Thắng trận thường vẫn đúng +14')
    assert.equal(ptsOf(ms, 'm2'), START + LOSS, 'Thua trận thường vẫn đúng -8')
  })

  await t.test('2. Trận thuộc kèo được nhân hệ số', () => {
    const ms = [mk('mt1', 'A', { min: 0, challengeId: 'k1' })]
    assert.equal(ptsOf(ms, 'm1'), START + WIN * MULT, `Thắng kèo -> ${WIN}x${MULT}`)
    assert.equal(ptsOf(ms, 'm2'), START + LOSS * MULT, `Thua kèo -> ${LOSS}x${MULT}`)
  })

  await t.test('3. `sourceType: challenge` cũng được nhân, không cần challengeId', () => {
    const ms = [mk('mt1', 'A', { min: 0, sourceType: 'challenge' })]
    assert.equal(ptsOf(ms, 'm1'), START + WIN * MULT)
  })

  await t.test('4. Kèo BO3 nhân TỪNG set — thắng 2-0 ăn gấp đôi BO1', () => {
    const ms = [
      mk('mt1', 'A', { min: 0, challengeId: 'k1' }),
      mk('mt2', 'A', { min: 5, challengeId: 'k1' }),
    ]
    assert.equal(ptsOf(ms, 'm1'), START + WIN * MULT * 2, 'Thắng 2-0 = hai set thắng cùng nhân')
    assert.equal(ptsOf(ms, 'm2'), START + LOSS * MULT * 2, 'Thua 2-0 = hai set thua cùng nhân')
  })

  await t.test('5. Kèo BO3 thắng 2-1 — set thua vẫn trừ bình thường', () => {
    const ms = [
      mk('mt1', 'A', { min: 0, challengeId: 'k1' }),
      mk('mt2', 'B', { min: 5, challengeId: 'k1' }),
      mk('mt3', 'A', { min: 10, challengeId: 'k1' }),
    ]
    // m1: hai set thắng + một set thua, tất cả cùng nhân
    assert.equal(ptsOf(ms, 'm1'), START + (WIN * 2 + LOSS) * MULT)
    assert.equal(ptsOf(ms, 'm2'), START + (LOSS * 2 + WIN) * MULT)
  })

  await t.test('6. Streak gom theo KÈO, không đếm từng set', () => {
    // Kèo BO3 thắng 2-0, rồi một trận thường thắng nữa.
    // Nếu streak đếm theo set: 2 set + 1 trận = streak 3 -> ăn thưởng mốc 3.
    // Gom theo kèo thì mới là streak 2 -> CHƯA được thưởng. Đó là hành vi đúng.
    const ms = [
      mk('mt1', 'A', { min: 0, challengeId: 'k1' }),
      mk('mt2', 'A', { min: 5, challengeId: 'k1' }),
      mk('mt3', 'A', { min: 10 }),
    ]
    const expected = START + WIN * MULT * 2 + WIN
    assert.equal(ptsOf(ms, 'm1'), expected, 'Không được dính thưởng streak 3 — kèo chỉ đếm 1 lần')

    const { leaderboard } = calculateSeasonLeaderboard({
      members: baseMembers,
      sessions: baseSessions,
      matches: ms,
    })
    const kien = leaderboard.find((r) => r.id === 'm1')
    assert.equal(kien.breakdown.streakBonusPts, 0, 'Chuỗi mới 2, chưa có điểm thưởng nào')
    assert.equal(kien.streak, 2, 'Kèo BO3 2-0 + 1 trận thường = chuỗi 2, không phải 3')
  })

  await t.test('7. Thua chuỗi kèo thì chuỗi thắng bị cắt, dù có thắng set lẻ', () => {
    const ms = [
      mk('mt1', 'A', { min: 0 }),                       // thắng thường -> chuỗi 1
      mk('mt2', 'A', { min: 5, challengeId: 'k1' }),    // thắng set 1
      mk('mt3', 'B', { min: 10, challengeId: 'k1' }),   // thua set 2
      mk('mt4', 'B', { min: 15, challengeId: 'k1' }),   // thua set 3 -> THUA kèo 1-2
    ]
    const { leaderboard } = calculateSeasonLeaderboard({
      members: baseMembers,
      sessions: baseSessions,
      matches: ms,
    })
    const kien = leaderboard.find((r) => r.id === 'm1')
    assert.equal(kien.streak, 0, 'Thua kèo -> chuỗi về 0, set thắng lẻ bên trong không cứu được')
  })

  await t.test('8. Kèo tắt xếp hạng thì không sinh điểm mùa, hệ số không cứu', () => {
    const ms = [mk('mt1', 'A', { min: 0, challengeId: 'k1', ratingEnabled: false })]
    assert.equal(ptsOf(ms, 'm1'), 0, 'Trận giao lưu đứng ngoài mùa hoàn toàn')
  })

  await t.test('9. calcSeasonMatchDeltaFinal — hàm dùng chung cho mọi nơi hiển thị', () => {
    const base = calcSeasonMatchDelta(1500, 1500, true)
    assert.equal(base.delta, WIN, 'Hàm gốc vẫn chỉ biết dải Elo, không biết kèo')

    const normal = calcSeasonMatchDeltaFinal(1500, 1500, true, { isChallenge: false })
    assert.equal(normal.delta, WIN, 'Trận thường không nhân')
    assert.equal(normal.multiplier, 1)

    const chal = calcSeasonMatchDeltaFinal(1500, 1500, true, { isChallenge: true, multiplier: 2 })
    assert.equal(chal.delta, WIN * 2, 'Trận kèo nhân hệ số')
    assert.equal(chal.baseDelta, WIN, 'Vẫn trả delta gốc để giao diện giải thích được phép tính')
    assert.equal(chal.multiplier, 2)

    const loss = calcSeasonMatchDeltaFinal(1500, 1500, false, { isChallenge: true, multiplier: 2 })
    assert.equal(loss.delta, LOSS * 2, 'Thua cũng nhân — hệ số PHẲNG, không lệch thắng/thua')

    // Hệ số phẳng là thứ chặn lỗ hổng "thua kèo vẫn được cộng điểm": BO3 thua 1-2 phải ra âm.
    const bo3Lose = (WIN + LOSS + LOSS) * 2
    assert.ok(bo3Lose < 0, `Kèo BO3 thua 1-2 phải ra tổng ÂM, đang là ${bo3Lose}`)
  })

  await t.test('10. isChallengeMatch nhận cả hai đường đánh dấu', () => {
    assert.equal(isChallengeMatch({ challengeId: 'k1' }), true)
    assert.equal(isChallengeMatch({ sourceType: 'challenge' }), true)
    assert.equal(isChallengeMatch({ sourceType: 'session' }), false)
    assert.equal(isChallengeMatch({}), false)
    assert.equal(isChallengeMatch(null), false, 'Đầu vào rỗng không được nổ')
  })

  await t.test('11. challengeMultiplierOf ưu tiên cấu hình mùa của CLB', () => {
    assert.equal(challengeMultiplierOf({}), MULT, 'Không có gì thì đọc app.json')
    assert.equal(challengeMultiplierOf({ settings: { season: { challengeMultiplier: 3 } } }), 3, 'CLB tự đặt thì theo CLB')
    assert.equal(challengeMultiplierOf({}, { challengeMultiplier: 5 }), 5, 'Mùa truyền thẳng thì theo mùa')

    // Phân biệt có chủ đích giữa "đặt số vô nghĩa" và "không đặt gì":
    //   0 là số ai đó CỐ Ý điền, mà nhân 0 thì xoá sạch điểm cả mùa -> hạ về 1 (không nhân).
    //   null/vắng là "chưa cấu hình" -> mới rơi xuống mặc định của app.json.
    // Âm thầm biến 0 thành 2 là tệ nhất: người ta tưởng đã tắt mà thực ra vẫn nhân đôi.
    assert.equal(challengeMultiplierOf({ settings: { season: { challengeMultiplier: 0 } } }), 1, 'Số 0 cố ý -> không nhân, KHÔNG âm thầm áp mặc định')
    assert.equal(challengeMultiplierOf({ settings: { season: { challengeMultiplier: null } } }), MULT, 'Chưa cấu hình -> mặc định app.json')
    assert.equal(challengeMultiplierOf({ settings: { season: {} } }), MULT, 'Thiếu khoá -> mặc định app.json')
  })

  // ---------------------------------------------------------------------------
  // 12. Lưới chặn TÁI DIỄN, không phải test hành vi.
  //
  // Bug thật đã xảy ra: hệ số được nhân BÊN TRONG `calculateSeasonLeaderboard`, nên hai màn
  // preview (`CourtAssignmentTab` lúc ghi tỉ số, `MatchDetailModal` lúc xem lại trận) vẫn gọi
  // thẳng `calcSeasonMatchDelta` và hiện +14 trong khi sổ điểm ghi +28. Không test hành vi nào
  // bắt được loại lỗi này vì mỗi hàm riêng lẻ đều đúng — cái sai là GỌI NHẦM HÀM.
  //
  // Nên quét thẳng source: ngoài `season.js`, không file nào được gọi hàm gốc.
  // ---------------------------------------------------------------------------
  await t.test('12. Không nơi nào ngoài season.js gọi thẳng calcSeasonMatchDelta', () => {
    const root = path.resolve(import.meta.dirname, '../..')
    const offenders = []

    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === '__tests__') continue
        const full = path.join(dir, name)
        if (statSync(full).isDirectory()) { walk(full); continue }
        if (!/\.(js|jsx)$/.test(name)) continue
        if (full.endsWith(`lib${path.sep}season.js`)) continue

        const src = readFileSync(full, 'utf8')
        // Bỏ qua `calcSeasonMatchDeltaFinal` — đó mới là hàm đúng để gọi.
        if (/\bcalcSeasonMatchDelta\b(?!Final)/.test(src)) {
          offenders.push(path.relative(root, full))
        }
      }
    }
    walk(root)

    assert.deepEqual(
      offenders,
      [],
      `Phải gọi calcSeasonMatchDeltaFinal (đã tính hệ số kèo), không gọi hàm gốc. Vi phạm: ${offenders.join(', ')}`,
    )
  })
})
