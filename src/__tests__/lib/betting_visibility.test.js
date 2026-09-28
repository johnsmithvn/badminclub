// Cược kèo: vốn cược đầu mùa · BXH Sòng bạc · thẻ Mục tiêu theo điểm mùa · sổ điểm đủ cả mùa.
import assert from 'node:assert/strict'
import { stakeBaseOf, gamblerBoard } from '#lib/challenge.js'
import { calculateSeasonLeaderboard, getMemberSeasonLedger } from '#lib/season.js'
import { getRivalAnalysis } from '#lib/homePersonal.js'

const season = { id: 's-t', code: 'T', name: 'T', startDate: '2026-07-01', endDate: '2026-09-30', startPoints: 100, active: true }
const member = (id) => ({ id, name: id, level: 'trung_binh', active: true, joined: '2026-01-01' })
let seq = 0
const pred = (memberId, status, stake, day = 15) => ({
  id: `p${++seq}`, challengeId: `c${seq}`, memberId, team: 'A', stakePoints: stake,
  status, settledAt: `2026-08-${String(day).padStart(2, '0')}T10:00:00Z`,
})
const board = (db) => calculateSeasonLeaderboard(db)

// ==========================================
// 1. Vốn cược: người chưa ra sân vẫn cược được bằng điểm khởi đầu
// ==========================================
{
  const played = {
    id: 'm1', sessionId: 's1', at: Date.parse('2026-08-10T10:00:00Z'),
    teamA: ['P1'], teamB: ['X1'], winnerTeam: 'A', sets: [[21, 15]],
    initialRatingA: 1000, initialRatingB: 1000, ratingEnabled: true,
  }
  const base = { seasons: [season], members: [member('S1'), member('P1')], matches: [played] }

  const fresh = board({ ...base, challengePredictions: [] })
  assert.equal(stakeBaseOf(fresh, 'S1'), 100,
    'Đầu mùa chưa ai đánh trận nào: vốn cược phải là điểm khởi đầu, không thì kèo đầu mùa không ai đặt được')
  assert.equal(fresh.leaderboard.find((r) => r.id === 'S1').totalSeasonPoints, 0,
    'Điểm BXH của người chưa ra sân KHÔNG đổi — vốn cược chỉ là số được đem đi đặt')

  const lost = board({ ...base, challengePredictions: [pred('S1', 'lost', 30)] })
  assert.equal(stakeBaseOf(lost, 'S1'), 70, 'Thua trước khi ra sân phải trừ vào vốn, không thì thành cược miễn phí')

  const won = board({ ...base, challengePredictions: [pred('S1', 'won', 40)] })
  assert.equal(stakeBaseOf(won, 'S1'), 140, 'Lãi cược cộng đủ, không kẹp — cùng công thức với điểm mùa')
  assert.equal(won.leaderboard.find((r) => r.id === 'S1').totalSeasonPoints, 40,
    'Chưa ra sân thì BXH chỉ có lãi cược, không có 100 điểm khởi đầu')

  const busted = board({ ...base, challengePredictions: [pred('S1', 'lost', 60), pred('S1', 'lost', 60, 16)] })
  assert.equal(stakeBaseOf(busted, 'S1'), 0, 'Thua quá vốn thì về 0, không âm')

  const pRow = fresh.leaderboard.find((r) => r.id === 'P1')
  assert.equal(stakeBaseOf(fresh, 'P1'), pRow.totalSeasonPoints, 'Đã ra sân thì vốn cược đúng bằng điểm mùa')
  assert.equal(stakeBaseOf(fresh, 'nobody'), 0)
}
console.log('stake base check: OK')

// ==========================================
// 2. BXH Sòng bạc
// ==========================================
{
  const preds = [
    ...[1, 2, 3, 4, 5].map((d) => pred('G1', 'won', 10, d)), pred('G1', 'lost', 10, 6),
    pred('G2', 'won', 50, 7), pred('G2', 'won', 50, 8),
    ...[9, 10, 11, 12, 13].map((d) => pred('G3', 'lost', 5, d)),
    // Chưa có kết quả / đã hoàn: không ai được mất gì, không được đếm
    { ...pred('G1', 'pending', 99), settledAt: null },
    pred('G1', 'refunded', 99, 14),
  ]
  const res = board({ seasons: [season], members: ['G1', 'G2', 'G3', 'Z'].map(member), matches: [], challengePredictions: preds })
  const ids = (by) => gamblerBoard(res, by, 5).map((r) => r.id)

  assert.deepEqual(ids('net'), ['G2', 'G1', 'G3'])
  assert.equal(gamblerBoard(res, 'net').find((r) => r.id === 'G2').net, 100,
    'Lãi ròng là số THẬT, không kẹp trần — bảng này đo độ máu chứ không phải điểm mùa')
  assert.deepEqual(ids('accuracy'), ['G1', 'G3'], 'Thần dự đoán phải đủ số phiếu tối thiểu: 2/2 trúng chưa phải thần')
  assert.deepEqual(ids('staked'), ['G2', 'G1', 'G3'])
  assert.deepEqual(ids('tickets'), ['G1', 'G3', 'G2'])
  assert.deepEqual(ids('donor'), ['G3'], 'Nhà hảo tâm chỉ gồm người lỗ')

  const g1 = gamblerBoard(res, 'net').find((r) => r.id === 'G1')
  assert.equal(g1.tickets, 6, 'Phiếu chờ / đã hoàn không tính vào số phiếu')
  assert.deepEqual([g1.wins, g1.losses, g1.staked, g1.winRate], [5, 1, 60, 83])
  assert.ok(!ids('net').includes('Z'), 'Người không cược không lên bảng')
}
console.log('gambler board check: OK')

// ==========================================
// 3. Thẻ Mục tiêu ở chế độ điểm mùa
// ==========================================
{
  const db = {
    seasons: [season],
    members: ['X', 'Y', 'ME'].map(member),
    matches: [],
    challengePredictions: [pred('X', 'won', 12), pred('Y', 'won', 5), pred('ME', 'won', 2)],
  }
  const a = getRivalAnalysis(db, 'ME', null, 'season')
  assert.equal(a.rival.id, 'Y', 'Kình địch là người có điểm mùa ngay trên mình')
  assert.equal(a.rival.gapPoints, 3, 'Khoảng cách tính bằng SP, không phải Elo')
  assert.equal(a.rival.elo, 5, 'Số hiện trên thẻ là SP của đối thủ')
  assert.equal(a.rival.neededWins, 1)
  assert.equal(getRivalAnalysis(db, 'X', null, 'season').rival, null, 'Đứng đầu điểm mùa thì không còn ai để đuổi')
}
console.log('season rival check: OK')

// ==========================================
// 4. Sổ điểm có đủ cả mùa cho bộ lọc, thẻ tóm tắt vẫn giữ 10 dòng
// ==========================================
{
  const preds = Array.from({ length: 12 }, (_, i) => pred('L', i % 2 ? 'won' : 'lost', 1, i + 1))
  const ledger = getMemberSeasonLedger('L', { seasons: [season], members: [member('L')], matches: [], challengePredictions: preds })
  assert.equal(ledger.allEvents.length, 12, 'Bộ lọc "Dự đoán" phải thấy đủ mọi phiếu của mùa, không chỉ 10 dòng gần nhất')
  assert.equal(ledger.recentEvents.length, 10)
  assert.ok(ledger.allEvents.every((e) => e.isPrediction && e.code === '' && e.titleKey.startsWith('season.ledgerPrediction')))
}
console.log('ledger all events check: OK')
