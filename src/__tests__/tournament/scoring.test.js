import test from 'node:test'
import assert from 'node:assert/strict'
import { setWinner, matchWinner, validateSets, scoreFlags, ruleFor } from '#lib/tournament/scoring.js'

test('Module Giải đấu - Kiểm thử logic tính điểm scoring.js', async (t) => {
  // Luật 1: 1x21 cách 2 trần 30 (Vòng loại Đôi nam nữ quy chế mùa 1)
  const rule21WinBy2 = { sets: 1, points: 21, winBy2: true, cap: 30 }

  // Luật 2: 1x30 chạm 30 (Vòng loại Đôi nam, Đôi nữ quy chế mùa 1)
  const rule30Sudden = { sets: 1, points: 30, winBy2: false, cap: 30 }

  // Luật 3: 3x15 chạm 15 (Chung kết & Tranh 3-4 quy chế mùa 1)
  const rule3x15 = { sets: 3, points: 15, winBy2: false, cap: 15 }

  await t.test('1. Luật 1x21 cách 2 trần 30: Các ca kết thúc hợp lệ', () => {
    // Thắng cách biệt chuẩn khi chạm 21
    assert.equal(setWinner(21, 19, rule21WinBy2), 'A', '21-19: A thắng hợp lệ khi chạm 21 và cách 2')
    assert.equal(setWinner(19, 21, rule21WinBy2), 'B', '19-21: B thắng hợp lệ khi chạm 21 và cách 2')
    assert.equal(setWinner(21, 5, rule21WinBy2), 'A', '21-5: A thắng cách biệt lớn')
    assert.equal(setWinner(0, 21, rule21WinBy2), 'B', '0-21: B thắng cách biệt tuyệt đối')

    // Thắng sau deuce (phải cách đúng 2 điểm)
    assert.equal(setWinner(22, 20, rule21WinBy2), 'A', '22-20: A thắng sau deuce 20-20')
    assert.equal(setWinner(20, 22, rule21WinBy2), 'B', '20-22: B thắng sau deuce 20-20')
    assert.equal(setWinner(29, 27, rule21WinBy2), 'A', '29-27: A thắng sau deuce kéo dài')
    assert.equal(setWinner(27, 29, rule21WinBy2), 'B', '27-29: B thắng sau deuce kéo dài')

    // Thắng khi chạm trần 30
    assert.equal(setWinner(30, 28, rule21WinBy2), 'A', '30-28: A thắng khi chạm trần cách 2 điểm')
    assert.equal(setWinner(30, 29, rule21WinBy2), 'A', '30-29: 29 đều bên nào chạm 30 trước thắng (chỉ cần cách 1)')
    assert.equal(setWinner(29, 30, rule21WinBy2), 'B', '29-30: B chạm 30 trước thắng')
  })

  await t.test('2. Luật 1x21 cách 2 trần 30: Các ca set chưa xong (null)', () => {
    assert.equal(setWinner(0, 0, rule21WinBy2), null, '0-0: set mới bắt đầu')
    assert.equal(setWinner(20, 0, rule21WinBy2), null, '20-0: chưa chạm 21')
    assert.equal(setWinner(21, 20, rule21WinBy2), null, '21-20: chạm 21 nhưng mới cách 1 điểm, phải tiếp tục')
    assert.equal(setWinner(20, 21, rule21WinBy2), null, '20-21: B dẫn 1 điểm, chưa đủ cách 2')
    assert.equal(setWinner(28, 28, rule21WinBy2), null, '28-28: đang hòa deuce')
    assert.equal(setWinner(29, 29, rule21WinBy2), null, '29-29: đang hòa deuce sát trần')
  })

  await t.test('3. Luật 1x21 cách 2 trần 30: Các ca điểm sai luật (invalid)', () => {
    assert.equal(setWinner(30, 30, rule21WinBy2), 'invalid', '30-30: đã kịch trần cap=30 thì không thể hòa')
    assert.equal(setWinner(31, 29, rule21WinBy2), 'invalid', '31-29: điểm vượt quá cap=30')
    assert.equal(setWinner(31, 30, rule21WinBy2), 'invalid', '31-30: điểm vượt quá cap=30')
    assert.equal(setWinner(24, 21, rule21WinBy2), 'invalid', '24-21: lẽ ra trận đấu đã dừng ở 23-21')
    assert.equal(setWinner(25, 10, rule21WinBy2), 'invalid', '25-10: lẽ ra trận đấu đã dừng ở 21-10')
    assert.equal(setWinner(-1, 21, rule21WinBy2), 'invalid', 'Điểm âm không hợp lệ')
    assert.equal(setWinner(21.5, 10, rule21WinBy2), 'invalid', 'Điểm thập phân không hợp lệ')
  })

  await t.test('4. Luật 1x30 chạm 30: Kiểm tra tính đúng đắn', () => {
    // Hợp lệ
    assert.equal(setWinner(30, 29, rule30Sudden), 'A', '30-29: A chạm 30 thắng')
    assert.equal(setWinner(30, 0, rule30Sudden), 'A', '30-0: A chạm 30 thắng tuyệt đối')
    assert.equal(setWinner(15, 30, rule30Sudden), 'B', '15-30: B chạm 30 thắng')

    // Chưa xong
    assert.equal(setWinner(29, 29, rule30Sudden), null, '29-29: chưa bên nào chạm 30')
    assert.equal(setWinner(29, 10, rule30Sudden), null, '29-10: chưa bên nào chạm 30')
    assert.equal(setWinner(20, 25, rule30Sudden), null, '20-25: chưa bên nào chạm 30')

    // Sai luật
    assert.equal(setWinner(30, 30, rule30Sudden), 'invalid', '30-30: chạm 30 không thể hòa')
    assert.equal(setWinner(31, 5, rule30Sudden), 'invalid', '31-5: vượt quá cap=30')
    assert.equal(setWinner(32, 30, rule30Sudden), 'invalid', '32-30: vượt quá cap=30')
  })

  await t.test('5. Luật 3x15 chạm 15: matchWinner, validateSets & các ca sai luật', () => {
    // Trận thắng 2-0 sạch sẽ
    const sets2_0 = [[15, 10], [15, 12]]
    assert.equal(matchWinner(sets2_0, rule3x15), 'A', 'A thắng 2-0')
    assert.equal(validateSets(sets2_0, rule3x15), null, 'validateSets trả về null (hợp lệ)')

    // Trận thắng lội ngược dòng 2-1
    const sets2_1 = [[15, 10], [8, 15], [15, 14]]
    assert.equal(matchWinner(sets2_1, rule3x15), 'A', 'A thắng 2-1 sau 3 set')
    assert.equal(validateSets(sets2_1, rule3x15), null, 'validateSets hợp lệ cho trận 3 set')

    // B thắng 2-0
    const sets0_2 = [[10, 15], [12, 15]]
    assert.equal(matchWinner(sets0_2, rule3x15), 'B', 'B thắng 2-0')

    // Trận chưa kết thúc (mới 1-0)
    const sets1_0 = [[15, 10]]
    assert.equal(matchWinner(sets1_0, rule3x15), null, 'Mới đánh 1 set trong trận best-of-3 thì chưa có người thắng')
    assert.equal(validateSets(sets1_0, rule3x15), 'tournament.err.matchNotFinished', 'Báo lỗi matchNotFinished khi commit trận chưa xong')

    // Trận chưa kết thúc (hòa 1-1)
    const sets1_1 = [[15, 10], [10, 15]]
    assert.equal(matchWinner(sets1_1, rule3x15), null, 'Hòa 1-1 chưa có người thắng trận')

    // Lỗi thừa set khi đã có bên thắng 2 set
    const setsExtra = [[15, 10], [15, 12], [15, 3]]
    assert.equal(matchWinner(setsExtra, rule3x15), 'invalid', 'Đã thắng 2-0 mà vẫn đánh set 3 là thừa set')
    assert.equal(validateSets(setsExtra, rule3x15), 'tournament.err.extraSets', 'validateSets báo lỗi extraSets')

    // Lỗi set sai luật 3x15: hòa 15-15 hoặc vượt quá cap 16-3
    assert.equal(setWinner(15, 15, rule3x15), 'invalid', '15-15: chạm 15 không thể hòa')
    assert.equal(setWinner(16, 3, rule3x15), 'invalid', '16-3: vượt quá cap=15')
    const setsBadScore = [[15, 15], [15, 10]]
    assert.equal(matchWinner(setsBadScore, rule3x15), 'invalid', 'Có set không hợp lệ thì trận đấu invalid')
    assert.equal(validateSets(setsBadScore, rule3x15), 'tournament.err.invalidSetScore', 'Báo lỗi invalidSetScore')

    // Lỗi có set dở dang ở giữa
    const setsIncomplete = [[15, 10], [10, 8], [15, 12]]
    assert.equal(matchWinner(setsIncomplete, rule3x15), 'invalid', 'Set 2 chưa xong mà có set 3 là không hợp lệ')

    // Set cuối đang đánh dở (set 1 A thắng 15-10, set 2 đang đánh dở 10-8)
    const setsDangling = [[15, 10], [10, 8]]
    assert.equal(matchWinner(setsDangling, rule3x15), null, 'Set 2 đang đánh dở (10-8) thì matchWinner phải là null (chưa xong)')
    assert.equal(validateSets(setsDangling, rule3x15), 'tournament.err.incompleteSet', 'validateSets phải trả incompleteSet khi có set dở dang')
  })

  await t.test('6. scoreFlags: Tính cờ Deuce, Set Point và Match Point độc lập cho cả A và B', () => {
    // Ca 1: Trận 1 set 21 điểm (Đôi nam nữ), tỉ số 20-20 -> Deuce
    const state1 = { currentScore: [20, 20], sets: [] }
    const flags1 = scoreFlags(state1, rule21WinBy2)
    assert.equal(flags1.deuce, true, '20-20 winBy2 phải báo deuce = true')
    assert.deepEqual(flags1.setPoint, { A: false, B: false }, '20-20 chưa bên nào có set point')
    assert.deepEqual(flags1.matchPoint, { A: false, B: false }, '20-20 chưa bên nào có match point')

    // Ca 2: Trận 1 set 21 điểm, tỉ số 20-19 -> Chỉ A có set point và match point
    const state2 = { currentScore: [20, 19], sets: [] }
    const flags2 = scoreFlags(state2, rule21WinBy2)
    assert.equal(flags2.deuce, false, '20-19 không còn ở thế cân bằng deuce')
    assert.deepEqual(flags2.setPoint, { A: true, B: false }, 'A được 1 quả nữa (21-19) là thắng set')
    assert.deepEqual(flags2.matchPoint, { A: true, B: false }, 'Vì là trận 1 set, A thắng set là thắng luôn trận')

    // Ca 2b (KHÔI PHỤC CA BỊ THIẾU): Trận 3 set 15 điểm, set 1 đang 14-10 -> A có set point nhưng CHƯA có match point
    const stateSet1 = { currentScore: [14, 10], sets: [] }
    const flagsSet1 = scoreFlags(stateSet1, rule3x15)
    assert.deepEqual(flagsSet1.setPoint, { A: true, B: false }, 'Set 1 dẫn 14-10: A có set point')
    assert.deepEqual(flagsSet1.matchPoint, { A: false, B: false }, 'Set 1 dẫn 14-10: A CHƯA thể có match point vì cần thắng 2 set mới xong trận')

    // Ca 3 (LỖI THẬT ĐÃ SỬA): 29-29 trong luật 21 trần 30 (1 set) -> CẢ HAI bên cùng có set point và match point
    const state3 = { currentScore: [29, 29], sets: [] }
    const flags3 = scoreFlags(state3, rule21WinBy2)
    assert.equal(flags3.deuce, true, '29-29 vẫn là deuce sát trần')
    assert.deepEqual(flags3.setPoint, { A: true, B: true }, '29-29: Ai ăn quả tới cũng chạm 30 và thắng set')
    assert.deepEqual(flags3.matchPoint, { A: true, B: true }, '29-29: Trận 1 set, ai ăn quả tới cũng thắng cả trận')

    // Ca 4 (LỖI THẬT ĐÃ SỬA): 29-29 trong luật 30 chạm (1 set) -> CẢ HAI bên cùng có set point và match point, KHÔNG có deuce
    const state4 = { currentScore: [29, 29], sets: [] }
    const flags4 = scoreFlags(state4, rule30Sudden)
    assert.equal(flags4.deuce, false, '29-29 luật chạm 30 không có winBy2 nên deuce = false')
    assert.deepEqual(flags4.setPoint, { A: true, B: true }, '29-29 chạm 30: Cả hai bên đều có set point')
    assert.deepEqual(flags4.matchPoint, { A: true, B: true }, '29-29 chạm 30: Cả hai bên đều có match point')

    // Ca 5 (LỖI THẬT ĐÃ SỬA): Trận 3 set 15 điểm. Set 1 A đã thắng (15-10). Set 2 đang hòa 14-14
    // -> A có match point (và set point), B có set point (nhưng CHƯA có match point vì mới là set 1 của B)
    const state5 = { currentScore: [14, 14], sets: [[15, 10]] }
    const flags5 = scoreFlags(state5, rule3x15)
    assert.deepEqual(flags5.setPoint, { A: true, B: true }, '14-14: Cả A và B đều đang có set point ở set 2')
    assert.deepEqual(flags5.matchPoint, { A: true, B: false }, 'A ăn quả này là thắng trận 2-0 (match point); B ăn quả này chỉ gỡ 1-1 (không có match point)')
  })

  await t.test('7. ruleFor: Lấy đúng luật chuẩn camelCase và ném lỗi khi thiếu dữ liệu', () => {
    const stage = {
      matchRule: { sets: 1, points: 30, winBy2: false, cap: 30 },
      ruleOverrides: {
        final: { sets: 3, points: 15, winBy2: false, cap: 15 },
        third: { sets: 3, points: 15, winBy2: false, cap: 15 }
      }
    }

    assert.deepEqual(ruleFor(stage, 'qf'), { sets: 1, points: 30, winBy2: false, cap: 30 }, 'Tứ kết dùng luật matchRule 1x30')
    assert.deepEqual(ruleFor(stage, 'sf'), { sets: 1, points: 30, winBy2: false, cap: 30 }, 'Bán kết dùng luật matchRule 1x30')
    assert.deepEqual(ruleFor(stage, 'final'), { sets: 3, points: 15, winBy2: false, cap: 15 }, 'Chung kết override sang 3x15')
    assert.deepEqual(ruleFor(stage, 'third'), { sets: 3, points: 15, winBy2: false, cap: 15 }, 'Tranh hạng 3 override sang 3x15')

    // Ném lỗi rõ ràng khi thiếu stage hoặc thiếu matchRule, không tự bịa fallback che lỗi
    assert.throws(() => ruleFor(null, 'qf'), /stage or stage\.matchRule is missing/, 'Thiếu stage phải throw Error')
    assert.throws(() => ruleFor({}, 'qf'), /stage or stage\.matchRule is missing/, 'Thiếu matchRule phải throw Error')
  })
})
