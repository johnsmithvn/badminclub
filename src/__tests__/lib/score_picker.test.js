// Bộ chọn tỉ số 1 set — dùng chung cho modal Ghi kết quả (ScoreModal) và khối ghi kết quả ở Chia sân.
// Khoá đúng hành vi đang chạy trước khi gom hai bản chép về một nơi.
import assert from 'node:assert/strict'
import {
  SCORE_PRESETS, SUB_PRESETS, scoreStateFrom, pickWinner, pickPreset, stepScore, typeScore, swapScores,
  pickSubPreset, editCustom,
} from '../../lib/scorePicker.js'

const S = (winnerTeam, presetScore, scoreA, scoreB) => ({ winnerTeam, presetScore, scoreA, scoreB })

// Trạng thái đầu: không có điểm sẵn → A thắng 21-19; có điểm sẵn → suy đội thắng + preset
assert.deepEqual(scoreStateFrom(), S('A', '21-19', 21, 19))
assert.deepEqual(scoreStateFrom([[19, 21]]), S('B', '21-19', 19, 21), '19-21 vẫn là preset 21-19, B thắng')
assert.deepEqual(scoreStateFrom([[15, 21]]), S('B', '21-15', 15, 21))
assert.deepEqual(scoreStateFrom([[17, 21]]), S('B', 'custom', 17, 21), 'điểm lạ → Khác')
assert.deepEqual(scoreStateFrom([[20, 20]]), S('A', 'custom', 20, 20), 'hoà: giữ A, để người dùng sửa')
assert.deepEqual(SCORE_PRESETS, ['21-19', '21-15', '21-11'])
assert.equal(SUB_PRESETS.length, 6)

// Chạm đội thắng: preset → điểm theo preset; Khác → đảo điểm nếu đội được chọn đang thấp hơn
assert.deepEqual(pickWinner(S('A', '21-15', 21, 15), 'B'), S('B', '21-15', 15, 21))
assert.deepEqual(pickWinner(S('A', '21-11', 21, 11), 'A'), S('A', '21-11', 21, 11))
assert.deepEqual(pickWinner(S('A', 'custom', 22, 24), 'A'), S('A', 'custom', 24, 22), 'Khác: A đang thua → đảo điểm')
assert.deepEqual(pickWinner(S('B', 'custom', 22, 24), 'B'), S('B', 'custom', 22, 24), 'Khác: B đang dẫn → giữ nguyên')
assert.deepEqual(pickWinner(S('A', 'custom', 20, 20), 'B'), S('B', 'custom', 20, 20), 'hoà: chỉ đổi đội thắng')

// Chọn preset: điểm theo đội đang thắng; Khác giữ nguyên điểm
assert.deepEqual(pickPreset(S('B', 'custom', 3, 7), '21-11'), S('B', '21-11', 11, 21))
assert.deepEqual(pickPreset(S('A', '21-19', 21, 19), 'custom'), S('A', 'custom', 21, 19))

// +/− điểm: kẹp 0..30, chuyển sang Khác, đội cao điểm hơn thành đội thắng (bằng nhau giữ nguyên)
assert.deepEqual(stepScore(S('A', '21-19', 21, 19), 'B', 1), S('A', 'custom', 21, 20))
assert.deepEqual(stepScore(S('A', 'custom', 21, 20), 'B', 1), S('A', 'custom', 21, 21), 'bằng điểm → chưa đổi đội thắng')
assert.deepEqual(stepScore(S('A', 'custom', 21, 21), 'B', 1), S('B', 'custom', 21, 22))
assert.deepEqual(stepScore(S('A', 'custom', 30, 5), 'A', 1), S('A', 'custom', 30, 5), 'trần 30')
assert.deepEqual(stepScore(S('B', 'custom', 0, 5), 'A', -1), S('B', 'custom', 0, 5), 'sàn 0')

// Gõ điểm: không phải số → 0, kẹp 0..30
assert.deepEqual(typeScore(S('A', '21-19', 21, 19), 'A', '15'), S('B', 'custom', 15, 19))
assert.deepEqual(typeScore(S('A', 'custom', 21, 19), 'B', 'abc'), S('A', 'custom', 21, 0))
assert.deepEqual(typeScore(S('A', 'custom', 21, 19), 'B', '99'), S('B', 'custom', 21, 30))
assert.deepEqual(typeScore(S('A', 'custom', 21, 19), 'A', '-4'), S('B', 'custom', 0, 19))

// Đổi điểm hai bên: đội thắng đi theo điểm
assert.deepEqual(swapScores(S('A', '21-19', 21, 19)), S('B', 'custom', 19, 21))
assert.deepEqual(swapScores(S('A', 'custom', 20, 20)), S('A', 'custom', 20, 20))

// Tỷ số nhanh trong ô Khác: đặt điểm theo phía đội đang thắng, không đổi đội thắng / preset
assert.deepEqual(pickSubPreset(S('B', 'custom', 1, 2), [30, 29]), S('B', 'custom', 29, 30))
assert.deepEqual(pickSubPreset(S('A', 'custom', 1, 2), [21, 0]), S('A', 'custom', 21, 0))

// Bấm vào ô điểm lớn: mở ô Khác, giữ điểm
assert.deepEqual(editCustom(S('B', '21-15', 15, 21)), S('B', 'custom', 15, 21))

console.log('score_picker.test.js: OK')
