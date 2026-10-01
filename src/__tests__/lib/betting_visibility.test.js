// Cược kèo: vốn cược đầu mùa · BXH Sòng bạc · thẻ Mục tiêu theo điểm mùa · sổ điểm đủ cả mùa.
import assert from 'node:assert/strict'
import { stakeBaseOf, gamblerBoard } from '#lib/challenge.js'
import { calculateSeasonLeaderboard, getMemberSeasonLedger } from '#lib/season.js'
import { getRivalAnalysis } from '#lib/homePersonal.js'
import { t } from '#i18n'

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
  const rows = gamblerBoard(res, 5)
  const by = (id) => rows.find((r) => r.id === id)

  assert.deepEqual(rows.map((r) => r.id), ['G2', 'G1', 'G3'], 'MỘT bảng, xếp theo lãi ròng')
  assert.deepEqual(rows.map((r) => r.rank), [1, 2, 3])
  assert.equal(by('G2').net, 100, 'Lãi ròng là số thật, cộng đủ')

  // Mỗi danh hiệu trao cho đúng MỘT người dẫn đầu chỉ số đó
  assert.deepEqual(by('G1').titles, ['accuracy', 'roi', 'hotHand', 'tickets'],
    'Thần dự đoán / Nhà đầu tư phải đủ số phiếu tối thiểu: G2 trúng 2/2 nhưng mới 2 phiếu nên nhường G1')
  assert.deepEqual(by('G2').titles, ['bigShot', 'staked'], 'Phiếu thắng to nhất (50) và đặt nhiều SP nhất')
  assert.deepEqual(by('G3').titles, ['coldHand', 'donor'], 'Trượt 5 liền và lỗ nhiều nhất')
  assert.equal(rows.flatMap((r) => r.titles).length, 8, 'Tám danh hiệu, không trao trùng')

  const g1 = by('G1')
  assert.equal(g1.tickets, 6, 'Phiếu chờ / đã hoàn không tính vào số phiếu')
  assert.deepEqual([g1.wins, g1.losses, g1.staked, g1.winRate], [5, 1, 60, 83])
  assert.equal(g1.roi, 67, 'ROI = lãi / tổng đặt: 40 / 60')
  assert.deepEqual(g1.form, ['won', 'won', 'won', 'won', 'lost'], 'Phong độ = 5 phiếu gần nhất, cũ → mới')
  assert.deepEqual(g1.streak, { won: false, n: 1 }, 'Chuỗi đang chạy tính từ phiếu mới nhất')
  assert.deepEqual([g1.bestWinStreak, g1.bestLoseStreak, g1.biggestWin], [5, 1, 10])
  assert.ok(!by('Z'), 'Người không cược không lên bảng')

  // Không ai lỗ thì danh hiệu Nhà hảo tâm để trống, không trao đại cho người lãi ít nhất
  const onlyWinners = gamblerBoard(board({ seasons: [season], members: ['G2'].map(member), matches: [],
    challengePredictions: [pred('G2', 'won', 50, 7)] }), 5)
  assert.ok(!onlyWinners[0].titles.includes('donor'))
}
console.log('gambler board check: OK')

// ==========================================
// 3. Thẻ Mục tiêu ở chế độ điểm mùa: đối thủ đổi theo ngày, câu chữ đủ biến
// ==========================================
{
  const base = {
    seasons: [season],
    members: ['FAR', 'X', 'Y', 'ME'].map(member),
    matches: [],
    // Chưa ai ra sân nên điểm BXH = lãi cược: FAR 200, X 12, Y 5, ME 2
    challengePredictions: [pred('FAR', 'won', 200), pred('X', 'won', 12), pred('Y', 'won', 5), pred('ME', 'won', 2)],
  }
  const day = (d) => ({ ...base, today: `2026-09-${String(d).padStart(2, '0')}` })
  const text = (key, params) => t(`home.personal.${key}`, params)

  const seen = new Set()
  for (let d = 1; d <= 30; d++) {
    const a = getRivalAnalysis(day(d), 'ME', null, 'season')
    seen.add(a.rival.id)
    assert.ok(['X', 'Y'].includes(a.rival.id),
      'Chỉ chọn trong 3 người ngay trên mà còn với tới (≤ 5 trận thắng) — FAR cách 198 điểm là ngoài tầm')
    assert.equal(a.rival.gapPoints, a.rival.elo - 2, 'Khoảng cách tính bằng SP, không phải Elo')
    const line = text(a.rival.tacticalInsight.key, a.rival.tacticalInsight.params)
    assert.ok(!line.startsWith('home.personal.') && !line.includes('{{'),
      `Câu "${a.rival.tacticalInsight.key}" phải có trong vi.json và đủ biến: ${line}`)
    assert.deepEqual(getRivalAnalysis(day(d), 'ME', null, 'season').rival.id, a.rival.id,
      'Trong cùng một ngày đối thủ đứng yên — không nhảy mỗi lần db đồng bộ')
  }
  assert.equal(seen.size, 2, 'Qua một tháng phải được gặp cả hai đối thủ trong tầm, không thì thẻ vẫn nhàm')
  assert.equal(getRivalAnalysis(day(1), 'FAR', null, 'season').rival, null, 'Đứng đầu điểm mùa thì không còn ai để đuổi')

  // Ngưỡng co theo thang điểm: một trận thắng mùa ~14 SP, nên cách 17 SP là 2 trận — không được
  // nói "một trận nữa là vượt" như mốc 20 viết cứng theo Elo.
  const two = { seasons: [season], members: ['R', 'ME'].map(member), matches: [], today: '2026-09-01',
    challengePredictions: [pred('R', 'won', 19), pred('ME', 'won', 2)] }
  const r = getRivalAnalysis(two, 'ME', null, 'season').rival
  assert.equal(r.gapPoints, 17)
  assert.ok(r.tacticalInsight.key.startsWith('rivalInsightMedium'), `Cách 17 SP phải là câu cần ~2 trận, ra ${r.tacticalInsight.key}`)
}
{
  // Người bám đuổi là kẻ đang NÓNG, không phải cứ người ngay dưới: ME 150, N 149 (không chuỗi),
  // H 147 (thắng 3 trận liền, cách 3 điểm) → phải cảnh báo H.
  const win = (i) => ({
    id: `hw${i}`, sessionId: 's1', at: Date.parse(`2026-08-2${i}T10:00:00Z`), teamA: ['H'], teamB: ['Z'],
    winnerTeam: 'A', sets: [[21, 15]], initialRatingA: 1000, initialRatingB: 1000, ratingEnabled: true,
  })
  const db = {
    seasons: [season],
    members: ['ME', 'N', 'H', 'Z'].map(member),
    matches: [win(1), win(2), win(3)],
    challengePredictions: [pred('ME', 'won', 150), pred('N', 'won', 149)],
    today: '2026-09-28',
  }
  const board = calculateSeasonLeaderboard(db).leaderboard.map((r) => `${r.id}:${r.totalSeasonPoints}`)
  assert.deepEqual(board.slice(0, 3), ['ME:150', 'N:149', 'H:147'], 'Dựng đúng thế trận cần kiểm')
  const c = getRivalAnalysis(db, 'ME', null, 'season').chaser
  assert.equal(c.id, 'H', 'Người đang thắng liền và còn trong tầm mới là mối nguy, không phải N đứng im')
  assert.equal(c.streak, 3)
  assert.ok(c.warningInsight.key.startsWith('chaserWarningThreat'))
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
