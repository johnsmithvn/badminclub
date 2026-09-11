import assert from 'node:assert/strict'
import {
  convertNumberWordsToDigits,
  extractTrailingScores,
  isValidBadmintonScore,
  mapVoiceResultToCourt,
  normalizeText,
  parseVoiceMatch,
} from '../../utils/voiceMatchParser.js'

// Dữ liệu người chơi thực tế của CLB để kiểm thử các ca khó
const mockClubPlayers = [
  { id: 'm_kuro', name: 'Kuro', fullName: 'Nguyễn Minh Tùng', gender: 'nam' },
  { id: 'm_tungdd', name: 'Anh Tungdd', fullName: 'DOAN DUY TUNG', gender: 'nam' },
  { id: 'm_thang_em', name: 'Thắng em', fullName: 'Trần Quyết Thắng', gender: 'nam' },
  { id: 'm_le_thang', name: 'Lê Minh Thắng', fullName: 'Lê Minh Thắng', gender: 'nam' },
  { id: 'm_duc_anh', name: 'Đức Anh', fullName: 'BUI DUC ANH', gender: 'nam' },
  { id: 'm_anh_vuong', name: 'Anh Vương', fullName: '', gender: 'nam' },
  { id: 'm_huong_giang', name: 'Hương Giang', fullName: 'Đoàn Hương Giang', gender: 'nu' },
  { id: 'm_huong', name: 'Hương', fullName: 'NGUYEN THI HUONG', gender: 'nu' },
  { id: 'm_thien', name: 'Thiện', fullName: 'NGUYE DUC THIEN', gender: 'nam' },
  { id: 'm_truong', name: 'Trường', fullName: '', gender: 'nam' },
  { id: 'm_khai', name: 'Khải', fullName: '', gender: 'nam' },
  { id: 'm_thanh', name: 'Thành', fullName: '', gender: 'nam' },
  { id: 'm_ba', name: 'Ba', fullName: 'Nguyễn Văn Ba', gender: 'nam' }, // Test luật 4: tên trùng số đếm
  { id: 'm_nam', name: 'Nam', fullName: 'Nguyễn Phương Nam', gender: 'nam' }, // Test chống nhiễu: tên trùng số 5
  { id: 'm_vuthang', name: 'Thắng', fullName: 'Vũ Đức Thắng', gender: 'nam' }, // Test Bug 2: tên đúng 1 chữ Thắng
  { id: 'm_tuanh', name: 'Tú Anh', fullName: 'Nguyễn Tú Anh', gender: 'nu' }, // Test Bug 3: tên bắt đầu bằng từ đếm
  { id: 'g_tuan', name: 'Khách Tuấn', fullName: 'Phạm Anh Tuấn', gender: 'nam', guest: true }, // Khách
]

console.log('1. Kiểm tra chuẩn hóa chuỗi và luật 4: không convert từ đơn trùng tên thành viên')
assert.equal(
  normalizeText('Nguyễn Minh Tùng thắng Bùi Đức Anh 21 - 19!'),
  'nguyen minh tung thang bui duc anh 21 19'
)

// Luật 4: Người tên 'Ba' nằm trong danh sách -> không convert chữ 'ba' đơn lẻ thành số 3
const excludeWords = new Set(['ba'])
assert.equal(
  convertNumberWordsToDigits('ba thang thien hai muoi mot muoi chin', excludeWords),
  'ba thang thien 21 19',
  'Từ đơn "ba" trùng tên người không được bị biến thành số 3'
)

console.log('2. Kiểm tra Luật 3: Chỉ nhận diện số ở 2 token cuối câu')
const resTrailing1 = extractTrailingScores('san 2 khai thanh thang thien truong 21 19')
assert.deepEqual(resTrailing1.scores, [21, 19], 'Bóc tách chuẩn 2 số cuối')
assert.equal(
  resTrailing1.textWithoutScores,
  'san 2 khai thanh thang thien truong',
  'Giữ nguyên phần đầu, số 2 ở "san 2" không bị cướp'
)

console.log('3. Kiểm tra Luật 5: Validate luật điểm số cầu lông')
assert.equal(isValidBadmintonScore(21, 19), true, '21 - 19: hợp lệ')
assert.equal(isValidBadmintonScore(21, 20), false, '21 - 20: chưa cách 2 điểm -> không hợp lệ')
assert.equal(isValidBadmintonScore(22, 20), true, '22 - 20: cách 2 điểm -> hợp lệ')
assert.equal(isValidBadmintonScore(29, 27), true, '29 - 27: cách 2 điểm -> hợp lệ')
assert.equal(isValidBadmintonScore(30, 29), true, '30 - 29: kịch trần 30 -> hợp lệ')
assert.equal(isValidBadmintonScore(31, 29), false, '31 - 29: vượt quá trần 30 -> không hợp lệ')
assert.equal(isValidBadmintonScore(20, 18), false, '20 - 18: chưa chạm 21 -> không hợp lệ')

console.log('4. Kiểm tra ca "Minh Tùng" (Kuro) và "Đức Anh"')
// "Minh Tùng" là cụm con trong "Nguyễn Minh Tùng" (Kuro)
const resMinhTung = parseVoiceMatch({
  transcript: 'Minh Tùng thắng Đức Anh 21 19',
  players: mockClubPlayers,
})
assert.equal(resMinhTung.status, 'ok')
assert.equal(resMinhTung.winnerPlayers[0].id, 'm_kuro', 'Minh Tùng phải map chính xác về Kuro')
assert.equal(resMinhTung.loserPlayers[0].id, 'm_duc_anh', 'Đức Anh phải map chính xác về Bùi Đức Anh')
assert.equal(resMinhTung.winnerScore, 21)
assert.equal(resMinhTung.loserScore, 19)

console.log('5. Kiểm tra ca "Thắng em" & "Lê Minh Thắng" (chữ Thắng trong tên không bị nuốt)')
const resThangEm = parseVoiceMatch({
  transcript: 'Thắng em thắng Đức Anh 21 19',
  players: mockClubPlayers,
})
assert.equal(resThangEm.status, 'ok')
assert.equal(resThangEm.winnerPlayers[0].id, 'm_thang_em', 'Thắng em không bị nuốt chữ Thắng')
assert.equal(resThangEm.loserPlayers[0].id, 'm_duc_anh')

const resLeThang = parseVoiceMatch({
  transcript: 'Lê Minh Thắng thắng Thiện 21 18',
  players: mockClubPlayers,
})
assert.equal(resLeThang.status, 'ok')
assert.equal(resLeThang.winnerPlayers[0].id, 'm_le_thang')
assert.equal(resLeThang.loserPlayers[0].id, 'm_thien')

console.log('6. Kiểm tra ca "Hương Giang" vs "Hương"')
const resHuong = parseVoiceMatch({
  transcript: 'Hương Giang thắng Hương 21 15',
  players: mockClubPlayers,
})
assert.equal(resHuong.status, 'ok')
assert.equal(resHuong.winnerPlayers[0].id, 'm_huong_giang')
assert.equal(resHuong.loserPlayers[0].id, 'm_huong')

console.log('7. Kiểm tra ca Khách giao lưu trên sân')
const resGuest = parseVoiceMatch({
  transcript: 'Khách Tuấn thắng Thiện 21 17',
  players: mockClubPlayers,
})
assert.equal(resGuest.status, 'ok')
assert.equal(resGuest.winnerPlayers[0].id, 'g_tuan', 'Khách giao lưu map chuẩn xác')

console.log('8. Kiểm tra ca đọc 4 người chuẩn Grammar: <A B> THẮNG <C D> <21 19>')
const res4Players = parseVoiceMatch({
  transcript: 'Khải Thành thắng Thiện Trường 21 19',
  players: mockClubPlayers,
})
assert.equal(res4Players.status, 'ok')
assert.equal(res4Players.winnerPlayers.length, 2)
assert.equal(res4Players.winnerPlayers[0].id, 'm_khai')
assert.equal(res4Players.winnerPlayers[1].id, 'm_thanh')
assert.equal(res4Players.loserPlayers.length, 2)
assert.equal(res4Players.loserPlayers[0].id, 'm_thien')
assert.equal(res4Players.loserPlayers[1].id, 'm_truong')

console.log('9. Kiểm tra biến thể trên sân: "A thắng 21 19"')
const resTeamA = parseVoiceMatch({
  transcript: 'A thắng 21 19',
  players: mockClubPlayers,
})
assert.equal(resTeamA.status, 'ok')
assert.equal(resTeamA.winnerTeam, 'A')

console.log('10. Kiểm tra mapVoiceResultToCourt: Ánh xạ và cấu trúc hiển thị đối chiếu')
const courtPlayers = [
  mockClubPlayers.find((p) => p.id === 'm_kuro'),
  mockClubPlayers.find((p) => p.id === 'm_duc_anh'),
  mockClubPlayers.find((p) => p.id === 'm_thang_em'),
  mockClubPlayers.find((p) => p.id === 'm_thien'),
]
// Giả sử Đội A trên sân gồm: Kuro + Đức Anh; Đội B gồm: Thắng em + Thiện
const mapped = mapVoiceResultToCourt({
  parsedResult: resMinhTung, // Minh Tùng (Kuro) thắng Đức Anh 21 19
  courtIdx: 0,
  currentTeamA: ['m_kuro', 'm_duc_anh'],
  currentTeamB: ['m_thang_em', 'm_thien'],
  players: mockClubPlayers,
})
assert.equal(mapped.status, 'ok')
assert.equal(mapped.winnerTeam, 'A', 'Kuro thuộc Team A -> Team A thắng')
assert.equal(mapped.scoreA, 21)
assert.equal(mapped.scoreB, 19)
assert.equal(mapped.winnerNames, 'Kuro')

console.log('11. Kiểm tra trường hợp chỉ gọi 1 tên người thắng trên sân: "Kuro thắng 21 19"')
const resSingleWinner = parseVoiceMatch({
  transcript: 'Kuro thắng 21 19',
  players: mockClubPlayers,
  courtPlayers,
})
assert.equal(resSingleWinner.status, 'ok')
assert.equal(resSingleWinner.winnerPlayers[0].id, 'm_kuro')

const mappedSingle = mapVoiceResultToCourt({
  parsedResult: resSingleWinner,
  courtIdx: 0,
  currentTeamA: ['m_kuro', 'm_duc_anh'],
  currentTeamB: ['m_thang_em', 'm_thien'],
  players: mockClubPlayers,
})
assert.equal(mappedSingle.status, 'ok')
assert.equal(mappedSingle.winnerTeam, 'A', 'Kuro ở Team A -> Team A thắng 21, Team B thua 19')
assert.equal(mappedSingle.scoreA, 21)
assert.equal(mappedSingle.scoreB, 19)

console.log('12. Kiểm tra từ khóa "win" (hoàn toàn không bị đụng tên Thắng)')
const resWinThang = parseVoiceMatch({
  transcript: 'Thắng em win Đức Anh 21 19',
  players: mockClubPlayers,
})
assert.equal(resWinThang.status, 'ok')
assert.equal(resWinThang.winnerPlayers[0].id, 'm_thang_em', 'Từ khóa "win" bảo vệ tuyệt đối tên Thắng em')
assert.equal(resWinThang.loserPlayers[0].id, 'm_duc_anh')
assert.equal(resWinThang.winnerScore, 21)
assert.equal(resWinThang.loserScore, 19)

console.log('13. Kiểm tra trường hợp SÂN ĐÃ CÓ NGƯỜI và CHỈ ĐỌC SỐ ĐIỂM')
// Sân đang có Team A: Kuro + Đức Anh; Team B: Thắng em + Thiện
// Nói: "21 19" -> Team A thắng 21, Team B 19
const resScoreOnlyA = parseVoiceMatch({
  transcript: '21 19',
  players: mockClubPlayers,
  courtPlayers,
})
assert.equal(resScoreOnlyA.status, 'ok')
assert.equal(resScoreOnlyA.scoreOnly, true)

const mappedScoreOnlyA = mapVoiceResultToCourt({
  parsedResult: resScoreOnlyA,
  courtIdx: 0,
  currentTeamA: ['m_kuro', 'm_duc_anh'],
  currentTeamB: ['m_thang_em', 'm_thien'],
  players: mockClubPlayers,
})
assert.equal(mappedScoreOnlyA.status, 'ok')
assert.equal(mappedScoreOnlyA.winnerTeam, 'A', 'Đội A điểm cao hơn -> Đội A thắng')
assert.equal(mappedScoreOnlyA.scoreA, 21)
assert.equal(mappedScoreOnlyA.scoreB, 19)

// Nói: "18 21" -> Team A 18, Team B 21 -> Team B thắng
const resScoreOnlyB = parseVoiceMatch({
  transcript: 'mười tám hai mốt',
  players: mockClubPlayers,
  courtPlayers,
})
assert.equal(resScoreOnlyB.status, 'ok')
assert.equal(resScoreOnlyB.scoreOnly, true)

const mappedScoreOnlyB = mapVoiceResultToCourt({
  parsedResult: resScoreOnlyB,
  courtIdx: 0,
  currentTeamA: ['m_kuro', 'm_duc_anh'],
  currentTeamB: ['m_thang_em', 'm_thien'],
  players: mockClubPlayers,
})
assert.equal(mappedScoreOnlyB.status, 'ok')
assert.equal(mappedScoreOnlyB.winnerTeam, 'B', 'Đội B điểm cao hơn -> Đội B thắng')
assert.equal(mappedScoreOnlyB.scoreA, 18)
assert.equal(mappedScoreOnlyB.scoreB, 21)

console.log('14. Kiểm tra từ khóa "thua": "B thua 21 18"')
const resBLose = parseVoiceMatch({
  transcript: 'B thua 21 18',
  players: mockClubPlayers,
})
assert.equal(resBLose.status, 'ok')
assert.equal(resBLose.winnerTeam, 'A', 'B thua -> Đội A thắng')
assert.equal(resBLose.winnerScore, 21)
assert.equal(resBLose.loserScore, 18)

console.log('15. Kiểm tra cú pháp: <Người thua> THUA <Người thắng> <Điểm 1> <Điểm 2>')
const resPlayerThua = parseVoiceMatch({
  transcript: 'Đức Anh thua Thắng em 21 19',
  players: mockClubPlayers,
})
assert.equal(resPlayerThua.status, 'ok')
assert.equal(resPlayerThua.winnerPlayers[0].id, 'm_thang_em', 'Đức Anh thua Thắng em -> Thắng em là người thắng')
assert.equal(resPlayerThua.loserPlayers[0].id, 'm_duc_anh', 'Đức Anh là người thua')
assert.equal(resPlayerThua.winnerScore, 21)
assert.equal(resPlayerThua.loserScore, 19)

console.log('16. Kiểm tra người trên sân tự nhận thua: "Đức Anh thua 21 19"')
const resSelfThua = parseVoiceMatch({
  transcript: 'Đức Anh thua 21 19',
  players: mockClubPlayers,
  courtPlayers,
})
assert.equal(resSelfThua.status, 'ok')
assert.equal(resSelfThua.loserPlayers[0].id, 'm_duc_anh')

const mappedSelfThua = mapVoiceResultToCourt({
  parsedResult: resSelfThua,
  courtIdx: 0,
  currentTeamA: ['m_kuro', 'm_duc_anh'],
  currentTeamB: ['m_thang_em', 'm_thien'],
  players: mockClubPlayers,
})
assert.equal(mappedSelfThua.status, 'ok')
assert.equal(mappedSelfThua.winnerTeam, 'B', 'Đức Anh ở Team A nhận thua -> Team B thắng')
assert.equal(mappedSelfThua.scoreA, 19)
assert.equal(mappedSelfThua.scoreB, 21)

console.log('17. Kiểm tra từ khóa "lose": "B lose 21 18"')
const resLoseWord = parseVoiceMatch({
  transcript: 'B lose 21 18',
  players: mockClubPlayers,
})
assert.equal(resLoseWord.status, 'ok')
assert.equal(resLoseWord.winnerTeam, 'A', 'B lose -> Đội A thắng')

console.log('18. Kiểm tra Bug 1: Sân trống tự đề xuất người vs Người không trên sân trả cảnh báo')
const resBug1 = parseVoiceMatch({
  transcript: 'Khải Thành thắng Thiện Trường 21 19',
  players: mockClubPlayers,
})
// Case A: Sân trống -> đề xuất xếp người và gán đội A thắng 21 - 19
const mappedEmpty = mapVoiceResultToCourt({
  parsedResult: resBug1,
  courtIdx: 0,
  currentTeamA: [],
  currentTeamB: [],
  players: mockClubPlayers,
})
assert.equal(mappedEmpty.status, 'ok')
assert.equal(mappedEmpty.winnerTeam, 'A')
assert.equal(mappedEmpty.scoreA, 21)
assert.equal(mappedEmpty.scoreB, 19)
assert.deepEqual(mappedEmpty.proposedTeamA, ['m_khai', 'm_thanh'])
assert.deepEqual(mappedEmpty.proposedTeamB, ['m_thien', 'm_truong'])

// Case B: Người gọi tên không trên sân -> trả status 'warning', warning 'player_not_on_court', winnerTeam null
const mappedNotOnCourt = mapVoiceResultToCourt({
  parsedResult: resBug1,
  courtIdx: 0,
  currentTeamA: ['m_kuro', 'm_duc_anh'],
  currentTeamB: ['m_thang_em', 'm_tuanh'],
  players: mockClubPlayers,
})
assert.equal(mappedNotOnCourt.status, 'warning')
assert.equal(mappedNotOnCourt.warning, 'player_not_on_court')
assert.equal(mappedNotOnCourt.winnerTeam, null)
assert.equal(mappedNotOnCourt.scoreA, null)
assert.equal(mappedNotOnCourt.scoreB, null)

console.log('19. Kiểm tra Bug 2: Thành viên tên đúng 1 chữ "Thắng" (Vũ Đức Thắng)')
const courtThangPlayers = [
  mockClubPlayers.find((p) => p.id === 'm_vuthang'),
  mockClubPlayers.find((p) => p.id === 'm_thanh'),
]
const resThang1Word = parseVoiceMatch({
  transcript: 'Thắng thắng Thành 21 19',
  players: mockClubPlayers,
  courtPlayers: courtThangPlayers,
})
assert.equal(resThang1Word.status, 'ok')
assert.equal(resThang1Word.winnerPlayers[0].id, 'm_vuthang', 'Thắng phải là người thắng')
assert.equal(resThang1Word.loserPlayers[0].id, 'm_thanh', 'Thành phải là người thua')

const mappedThang1Word = mapVoiceResultToCourt({
  parsedResult: resThang1Word,
  courtIdx: 0,
  currentTeamA: ['m_vuthang'],
  currentTeamB: ['m_thanh'],
  players: mockClubPlayers,
})
assert.equal(mappedThang1Word.status, 'ok')
assert.equal(mappedThang1Word.winnerTeam, 'A', 'Đội A (Thắng) phải là bên thắng')
assert.equal(mappedThang1Word.scoreA, 21)
assert.equal(mappedThang1Word.scoreB, 19)

console.log('20. Kiểm tra Bug 3: Tên "Tú Anh" không bị biến thành "4 anh"')
const resTuAnh = parseVoiceMatch({
  transcript: 'Tú Anh thắng Thành 21 19',
  players: mockClubPlayers,
})
assert.equal(resTuAnh.status, 'ok')
assert.equal(resTuAnh.winnerPlayers[0].id, 'm_tuanh', 'Tú Anh nhận diện chính xác, không bị ambiguous')
assert.equal(resTuAnh.loserPlayers[0].id, 'm_thanh')

console.log('21. Kiểm tra Kuro đặc cách: nhận diện phiên âm "Kư rô" và "cu ro"')
const resKuroJap = parseVoiceMatch({
  transcript: 'Kư rô thắng Thành 21 19',
  players: mockClubPlayers,
})
assert.equal(resKuroJap.status, 'ok')
assert.equal(resKuroJap.winnerPlayers[0].id, 'm_kuro', '"Kư rô" map chính xác về Kuro')

const resCuRo = parseVoiceMatch({
  transcript: 'cu ro thắng Thành 21 19',
  players: mockClubPlayers,
})
assert.equal(resCuRo.status, 'ok')
console.log('22. Kiểm tra chống nhiễu: Tên người chơi trùng số đếm ("Nam") vs điểm số dạng chữ ("năm") ở đuôi câu')
const resNamScore = parseVoiceMatch({
  transcript: 'Khải thắng Nam hai mốt năm',
  players: mockClubPlayers,
})
assert.equal(resNamScore.status, 'ok')
assert.equal(resNamScore.winnerPlayers[0].id, 'm_khai')
assert.equal(resNamScore.loserPlayers[0].id, 'm_nam')
assert.equal(resNamScore.winnerScore, 21)
assert.equal(resNamScore.loserScore, 5)

console.log('23. Kiểm tra chống nhiễu Kuro: Kuro thắng, Kuro thua, Kuro đứng cặp không gây sai lệch')
const resKuroLose = parseVoiceMatch({
  transcript: 'Kuro thua Thành 19 21',
  players: mockClubPlayers,
})
assert.equal(resKuroLose.status, 'ok')
assert.equal(resKuroLose.winnerPlayers[0].id, 'm_thanh', 'Thành là bên thắng')
assert.equal(resKuroLose.loserPlayers[0].id, 'm_kuro', 'Kuro là bên thua')
assert.equal(resKuroLose.winnerScore, 21)
assert.equal(resKuroLose.loserScore, 19)

console.log('24. Kiểm tra chống nhiễu người tên "Thắng" khi dùng từ khóa "thua"')
const resThangLose = parseVoiceMatch({
  transcript: 'Thắng thua Thành 19 21',
  players: mockClubPlayers,
  courtPlayers: courtThangPlayers,
})
assert.equal(resThangLose.status, 'ok')
assert.equal(resThangLose.winnerPlayers[0].id, 'm_thanh', 'Thành là bên thắng')
assert.equal(resThangLose.loserPlayers[0].id, 'm_vuthang', 'Thắng là bên thua')
assert.equal(resThangLose.winnerScore, 21)
assert.equal(resThangLose.loserScore, 19)

console.log('voiceMatchParser check: OK')

