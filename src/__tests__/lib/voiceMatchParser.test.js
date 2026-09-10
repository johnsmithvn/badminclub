import assert from 'node:assert/strict'
import {
  convertNumberWordsToDigits,
  extractScores,
  mapVoiceResultToCourt,
  normalizeText,
  parseVoiceMatch,
} from '../../utils/voiceMatchParser.js'

// Dữ liệu mẫu người chơi để kiểm thử
const mockPlayers = [
  { id: 'p1', name: 'Tuấn Béo', fullName: 'Nguyễn Anh Tuấn', gender: 'nam' },
  { id: 'p2', name: 'Tuấn Cận', fullName: 'Trần Minh Tuấn', gender: 'nam' },
  { id: 'p3', name: 'Hùng Xoăn', fullName: 'Lê Văn Hùng', gender: 'nam' },
  { id: 'p4', name: 'Thùy', fullName: 'Nguyễn Thị Thùy', gender: 'nu' },
  { id: 'p5', name: 'Thắng', fullName: 'Vũ Đức Thắng', gender: 'nam' },
  { id: 'p6', name: 'Thắng', fullName: 'Đặng Thị Thắng', gender: 'nu' },
  { id: 'p7', name: 'Nam', fullName: 'Hoàng Hải Nam', gender: 'nam' },
]

// -------------------------------------------------------------
// 1. Kiểm tra chuẩn hóa chuỗi và chuyển số tiếng Việt
// -------------------------------------------------------------
assert.equal(
  normalizeText('Nguyễn Anh Tuấn, Thắng 21 - 19!'),
  'nguyen anh tuan thang 21 19',
  'Chuẩn hóa chuỗi phải bỏ dấu, lowercase, bỏ dấu câu và khoảng trắng'
)

assert.equal(
  convertNumberWordsToDigits('hai mot muoi chin'),
  '21 19',
  'Chữ số hai mốt mười chín phải đổi thành 21 19'
)

assert.equal(
  convertNumberWordsToDigits('hai muoi mot muoi lam'),
  '21 15',
  'Chữ số hai mươi mốt mười lăm phải đổi thành 21 15'
)

assert.deepEqual(
  extractScores('21 19'),
  [21, 19],
  'Trích xuất điểm số chuẩn'
)

// -------------------------------------------------------------
// 2. Logic 1: fullName exact được ưu tiên trước, không bị cắt vụn
// -------------------------------------------------------------
// Có 2 người tên Tuấn (Nguyễn Anh Tuấn và Trần Minh Tuấn).
// Nếu nói đầy đủ "Nguyễn Anh Tuấn", hệ thống phải khớp ngay, không được báo duplicate!
const resFullName = parseVoiceMatch({
  transcript: 'Nguyễn Anh Tuấn thắng Hùng 21 19',
  players: mockPlayers,
})
assert.equal(resFullName.status, 'ok', 'Khớp fullName exact phải thành công')
assert.equal(resFullName.winnerPlayerId, 'p1', 'Người thắng phải là Nguyễn Anh Tuấn (p1)')
assert.equal(resFullName.loserPlayerId, 'p3', 'Kẻ thua phải là Lê Văn Hùng (p3)')
assert.equal(resFullName.winnerScore, 21)
assert.equal(resFullName.loserScore, 19)

// -------------------------------------------------------------
// 3. Logic 2: name exact (biệt danh) được ưu tiên
// -------------------------------------------------------------
const resNick = parseVoiceMatch({
  transcript: 'Tuấn Béo thắng Hùng Xoăn 21 15',
  players: mockPlayers,
})
assert.equal(resNick.status, 'ok', 'Khớp biệt danh name exact phải thành công')
assert.equal(resNick.winnerPlayerId, 'p1')
assert.equal(resNick.loserPlayerId, 'p3')
assert.equal(resNick.winnerScore, 21)
assert.equal(resNick.loserScore, 15)

// -------------------------------------------------------------
// 4. Logic 3: Tên riêng Unique
// -------------------------------------------------------------
// Trong danh sách chỉ có 1 người tên Nam (Hoàng Hải Nam) và 1 người tên Thùy
const resUnique = parseVoiceMatch({
  transcript: 'Nam thắng Thùy 21 18',
  players: mockPlayers,
})
assert.equal(resUnique.status, 'ok', 'Tên riêng duy nhất trong buổi tập phải khớp thành công')
assert.equal(resUnique.winnerPlayerId, 'p7')
assert.equal(resUnique.loserPlayerId, 'p4')
assert.equal(resUnique.winnerScore, 21)
assert.equal(resUnique.loserScore, 18)

// -------------------------------------------------------------
// 5. Logic 4: Tên trùng nhưng có đại từ/giới tính rõ ràng (bộ lọc phụ)
// -------------------------------------------------------------
// Có 2 người tên Thắng: p5 (nam) và p6 (nu)
// Nói "Chị Thắng thắng Nam" -> Lọc theo xưng hô nữ
const resGender = parseVoiceMatch({
  transcript: 'Chị Thắng thắng Nam 21 17',
  players: mockPlayers,
})
assert.equal(resGender.status, 'ok', 'Trùng tên nhưng có đại từ nữ "chị" phải lọc được p6')
assert.equal(resGender.winnerPlayerId, 'p6', 'Người thắng phải là Đặng Thị Thắng (p6 nữ)')
assert.equal(resGender.loserPlayerId, 'p7')

// Nói "Anh Thắng thắng Nam" -> Lọc theo xưng hô nam
const resGenderMale = parseVoiceMatch({
  transcript: 'Anh Thắng thắng Nam 21 16',
  players: mockPlayers,
})
assert.equal(resGenderMale.status, 'ok', 'Trùng tên nhưng có đại từ nam "anh" phải lọc được p5')
assert.equal(resGenderMale.winnerPlayerId, 'p5', 'Người thắng phải là Vũ Đức Thắng (p5 nam)')

// -------------------------------------------------------------
// 6. Logic 5: Trùng tên không có cách phân biệt -> trả về 'ambiguous'
// -------------------------------------------------------------
// Nói "Tuấn thắng Hùng 21 19" (có 2 Tuấn: p1 và p2, không rõ Tuấn nào)
const resAmbiguous = parseVoiceMatch({
  transcript: 'Tuấn thắng Hùng 21 19',
  players: mockPlayers,
})
assert.equal(resAmbiguous.status, 'ambiguous', 'Trùng tên không rõ phải trả về status: ambiguous')
assert.equal(resAmbiguous.reason, 'duplicate_name')
assert.equal(resAmbiguous.queryName, 'tuan')
assert.equal(resAmbiguous.candidates.length, 2, 'Phải liệt kê đúng 2 ứng viên bị trùng')

// -------------------------------------------------------------
// 7. Logic 6: Bóc tách Thắng / Thua / Win / Lose + Đảo chiều tỷ số
// -------------------------------------------------------------
// Khi dùng từ "thua" hoặc "lose": Người được nhắc là người THUA, tỷ số thắng (21) thuộc về người còn lại
const resLose = parseVoiceMatch({
  transcript: 'Nam thua Hùng 21 15',
  players: mockPlayers,
})
assert.equal(resLose.status, 'ok')
assert.equal(resLose.winnerPlayerId, 'p3', 'Nam thua Hùng thì Hùng phải là người thắng (winner)')
assert.equal(resLose.loserPlayerId, 'p7', 'Nam phải là kẻ thua (loser)')
assert.equal(resLose.winnerScore, 21, 'Điểm thắng phải là 21')
assert.equal(resLose.loserScore, 15, 'Điểm thua phải là 15')

// Thử với từ "lose" tiếng Anh
const resEnglishLose = parseVoiceMatch({
  transcript: 'Nam lose Hùng 21 17',
  players: mockPlayers,
})
assert.equal(resEnglishLose.status, 'ok')
assert.equal(resEnglishLose.winnerPlayerId, 'p3')
assert.equal(resEnglishLose.loserPlayerId, 'p7')

// Đọc số hoàn toàn bằng chữ tiếng Việt
const resWordsScore = parseVoiceMatch({
  transcript: 'Nam thắng Hùng hai mươi mốt mười lăm',
  players: mockPlayers,
})
assert.equal(resWordsScore.status, 'ok')
assert.equal(resWordsScore.winnerScore, 21)
assert.equal(resWordsScore.loserScore, 15)

// Đọc chỉ có đội và tỷ số: "A thắng hai mốt mười chín"
const resTeamA = parseVoiceMatch({
  transcript: 'Đội A thắng hai mốt mười chín',
  players: mockPlayers,
})
assert.equal(resTeamA.status, 'ok')
assert.equal(resTeamA.winnerTeam, 'A')
assert.equal(resTeamA.winnerScore, 21)
assert.equal(resTeamA.loserScore, 19)

// Đọc "Đội B thua 21 18" -> Tự động đảo chiều Đội A thắng!
const resTeamBLose = parseVoiceMatch({
  transcript: 'Đội B thua 21 18',
  players: mockPlayers,
})
assert.equal(resTeamBLose.status, 'ok')
assert.equal(resTeamBLose.winnerTeam, 'A', 'Đội B thua thì Đội A phải thắng')
assert.equal(resTeamBLose.winnerScore, 21)
assert.equal(resTeamBLose.loserScore, 18)
// -------------------------------------------------------------
// 8. Test mapVoiceResultToCourt: Ánh xạ kết quả lên sân hiện tại
// -------------------------------------------------------------
// Sân đang có: Team A: [Tuấn Béo (p1), Hùng Xoăn (p3)], Team B: [Nam (p7), Thùy (p4)]
const currentTeamA = ['p1', 'p3']
const currentTeamB = ['p7', 'p4']

// Case 8.1: Nói "Tuấn Béo thắng 21 19" (Tuấn Béo thuộc team A)
const parsedTuanWon = parseVoiceMatch({
  transcript: 'Tuấn Béo thắng 21 19',
  players: mockPlayers,
})
const mappedTuan = mapVoiceResultToCourt({
  parsedResult: parsedTuanWon,
  courtIdx: 0,
  currentTeamA,
  currentTeamB,
  players: mockPlayers,
})
assert.equal(mappedTuan.status, 'ok')
assert.equal(mappedTuan.winnerTeam, 'A', 'Tuấn Béo thuộc team A thì Team A thắng')
assert.equal(mappedTuan.scoreA, 21)
assert.equal(mappedTuan.scoreB, 19)
assert.equal(mappedTuan.partner?.id, 'p3', 'Đồng đội của Tuấn Béo là Hùng Xoăn (p3)')
assert.equal(mappedTuan.isOnCurrentCourt, true)
assert.equal(mappedTuan.warning, null)

// Case 8.2: Nói "Nam thắng 21 15" (Nam thuộc team B)
const parsedNamWon = parseVoiceMatch({
  transcript: 'Nam thắng 21 15',
  players: mockPlayers,
})
const mappedNam = mapVoiceResultToCourt({
  parsedResult: parsedNamWon,
  courtIdx: 0,
  currentTeamA,
  currentTeamB,
  players: mockPlayers,
})
assert.equal(mappedNam.status, 'ok')
assert.equal(mappedNam.winnerTeam, 'B', 'Nam thuộc team B thì Team B thắng')
assert.equal(mappedNam.scoreA, 15)
assert.equal(mappedNam.scoreB, 21)
assert.equal(mappedNam.partner?.id, 'p4', 'Đồng đội của Nam là Thùy (p4)')

// Case 8.3: Người nói không có trên sân hiện tại (Ví dụ p5 - Thắng)
const parsedOtherWon = parseVoiceMatch({
  transcript: 'Anh Thắng thắng 21 16',
  players: mockPlayers,
})
const mappedOther = mapVoiceResultToCourt({
  parsedResult: parsedOtherWon,
  courtIdx: 0,
  currentTeamA,
  currentTeamB,
  players: mockPlayers,
})
assert.equal(mappedOther.status, 'ok')
assert.equal(mappedOther.isOnCurrentCourt, false, 'Người chơi không có trên sân hiện tại')
assert.equal(mappedOther.warning, 'player_not_on_court')

// Case 8.4: Sân đang trống, đọc cả người thắng lẫn người thua: "Tuấn Béo thắng Hùng Xoăn 21 15"
const parsedEmptyCourt = parseVoiceMatch({
  transcript: 'Tuấn Béo thắng Hùng Xoăn 21 15',
  players: mockPlayers,
})
const mappedEmpty = mapVoiceResultToCourt({
  parsedResult: parsedEmptyCourt,
  courtIdx: 1,
  currentTeamA: [],
  currentTeamB: [],
  players: mockPlayers,
})
assert.equal(mappedEmpty.status, 'ok')
assert.deepEqual(mappedEmpty.proposedTeamA, ['p1'], 'Tự động đề xuất Tuấn Béo vào Team A')
assert.deepEqual(mappedEmpty.proposedTeamB, ['p3'], 'Tự động đề xuất Hùng Xoăn vào Team B')
assert.equal(mappedEmpty.scoreA, 21)
assert.equal(mappedEmpty.scoreB, 15)

console.log('voiceMatchParser check: OK')
