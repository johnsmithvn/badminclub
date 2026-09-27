import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateSeasonLeaderboard, resolveSeason, seasonMatchesOf } from '#lib/season.js'

test('Season Transition: 1. resolveSeason tìm đúng mùa active', () => {
  const s1 = { id: '2026-Q3', code: '2026-Q3', name: 'Thu Rực Lửa', active: false, startDate: '2026-07-01', endDate: '2026-09-30' }
  const s2 = { id: '2026-Q4', code: '2026-Q4', name: 'Đông Quyết Chiến', active: true, startDate: '2026-10-01', endDate: '2026-12-31' }

  const db = {
    seasons: [s1, s2],
    members: [{ id: 'm1', name: 'An', active: true }],
    matches: [],
  }

  const resolved = resolveSeason(db)
  assert.equal(resolved.code, '2026-Q4', 'Mùa active phải là 2026-Q4')
  assert.equal(resolved.active, true)

  // Truyền mùa cụ thể thì phải trả về đúng mùa đó
  const resolvedOld = resolveSeason(db, s1)
  assert.equal(resolvedOld.code, '2026-Q3', 'Khi chỉ định s1 thì resolveSeason phải trả về s1')
})

test('Season Transition: 2. Reset điểm mùa mới về 0 khi chưa có trận đấu ở mùa mới', () => {
  const s1 = { id: '2026-Q3', code: '2026-Q3', name: 'Thu Rực Lửa', active: false, startDate: '2026-07-01', endDate: '2026-09-30' }
  const s2 = { id: '2026-Q4', code: '2026-Q4', name: 'Đông Quyết Chiến', active: true, startDate: '2026-10-01', endDate: '2026-12-31' }

  const db = {
    seasons: [s1, s2],
    members: [
      { id: 'm1', name: 'An', active: true, level: 'TB' },
      { id: 'm2', name: 'Bình', active: true, level: 'TB' },
    ],
    sessions: [
      { id: 'ses_old', date: '2026-08-15', status: 'closed' },
    ],
    matches: [
      // Trận thuộc Mùa 1
      {
        id: 'mt1',
        sessionId: 'ses_old',
        at: Date.parse('2026-08-15T18:00:00Z'),
        teamA: ['m1'],
        teamB: ['m2'],
        winnerTeam: 'A',
        initialRatingA: 500,
        initialRatingB: 500,
        ratingEnabled: true,
      },
    ],
  }

  // 1. Kiểm tra mùa cũ: An có điểm thi đấu
  const lbOld = calculateSeasonLeaderboard(db, s1)
  const anOld = lbOld.leaderboard.find((r) => r.id === 'm1')
  assert.ok(anOld.totalSeasonPoints > 0, 'An phải có điểm ở mùa cũ 2026-Q3')
  assert.equal(anOld.winsCount, 1)

  // 2. Kiểm tra mùa mới: An và Bình bắt đầu lại từ 0 điểm
  const lbNew = calculateSeasonLeaderboard(db, s2)
  const anNew = lbNew.leaderboard.find((r) => r.id === 'm1')
  const binhNew = lbNew.leaderboard.find((r) => r.id === 'm2')
  assert.equal(anNew.totalSeasonPoints, 0, 'An phải có 0 điểm ở mùa mới 2026-Q4')
  assert.equal(anNew.matchesCount, 0, 'An chưa có trận nào ở mùa mới')
  assert.equal(binhNew.totalSeasonPoints, 0, 'Bình phải có 0 điểm ở mùa mới 2026-Q4')
})

test('Season Transition: 3. Điểm cược bó chặt trong từng mùa theo settledAt', () => {
  const s1 = { id: '2026-Q3', code: '2026-Q3', name: 'Thu Rực Lửa', active: false, startDate: '2026-07-01', endDate: '2026-09-30' }
  const s2 = { id: '2026-Q4', code: '2026-Q4', name: 'Đông Quyết Chiến', active: true, startDate: '2026-10-01', endDate: '2026-12-31' }

  const db = {
    seasons: [s1, s2],
    members: [
      { id: 'm1', name: 'An', active: true, level: 'TB' },
      { id: 'm2', name: 'Bình', active: true, level: 'TB' },
    ],
    sessions: [
      { id: 'ses_old', date: '2026-08-15', status: 'closed' },
      { id: 'ses_new', date: '2026-10-15', status: 'closed' },
    ],
    matches: [
      // Trận mùa 1
      {
        id: 'mt1',
        sessionId: 'ses_old',
        at: Date.parse('2026-08-15T18:00:00Z'),
        teamA: ['m1'],
        teamB: ['m2'],
        winnerTeam: 'A',
        initialRatingA: 500,
        initialRatingB: 500,
      },
      // Trận mùa 2
      {
        id: 'mt2',
        sessionId: 'ses_new',
        at: Date.parse('2026-10-15T18:00:00Z'),
        teamA: ['m1'],
        teamB: ['m2'],
        winnerTeam: 'A',
        initialRatingA: 500,
        initialRatingB: 500,
      },
    ],
    challengePredictions: [
      // Phiếu cược quyết toán ở Mùa 1: An thắng 3 SP
      {
        id: 'pred1',
        memberId: 'm1',
        stakePoints: 3,
        status: 'won',
        settledAt: '2026-08-15T18:30:00Z',
      },
      // Phiếu cược quyết toán ở Mùa 2: An thua 2 SP
      {
        id: 'pred2',
        memberId: 'm1',
        stakePoints: 2,
        status: 'lost',
        settledAt: '2026-10-15T18:30:00Z',
      },
    ],
  }

  // Bảng mùa 1
  const lbOld = calculateSeasonLeaderboard(db, s1)
  const anOld = lbOld.leaderboard.find((r) => r.id === 'm1')
  assert.equal(anOld.breakdown.predictionWonPoints, 3, 'Mùa 1 An thắng 3 SP cược')
  assert.equal(anOld.breakdown.predictionLostPoints, 0, 'Mùa 1 An không thua cược')

  // Bảng mùa 2
  const lbNew = calculateSeasonLeaderboard(db, s2)
  const anNew = lbNew.leaderboard.find((r) => r.id === 'm1')
  assert.equal(anNew.breakdown.predictionWonPoints, 0, 'Mùa 2 An chưa thắng cược nào')
  assert.equal(anNew.breakdown.predictionLostPoints, 2, 'Mùa 2 An thua 2 SP cược')
})
