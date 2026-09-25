import test from 'node:test'
import assert from 'node:assert/strict'
import { groupStandings, orderedRows, stageGroups, swapUpInTie } from '#lib/tournament/standings.js'

const R21 = { sets: 1, points: 21, winBy2: true, cap: 30 }
const R3x15 = { sets: 3, points: 15, winBy2: false, cap: 15 }

test('groupStandings: thắng nhiều trận hơn luôn xếp trên', () => {
  const group = {
    id: 'grp-1',
    teams: [{ teamId: 'T1' }, { teamId: 'T2' }, { teamId: 'T3' }],
  }
  const matches = [
    // T1 thắng T2
    { id: 'm1', groupId: 'grp-1', teamAId: 'T1', teamBId: 'T2', status: 'done', sets: [[21, 15]], winner: 'A', rule: R21 },
    // T1 thắng T3
    { id: 'm2', groupId: 'grp-1', teamAId: 'T1', teamBId: 'T3', status: 'done', sets: [[21, 10]], winner: 'A', rule: R21 },
    // T2 thắng T3
    { id: 'm3', groupId: 'grp-1', teamAId: 'T2', teamBId: 'T3', status: 'done', sets: [[21, 18]], winner: 'A', rule: R21 },
  ]

  const { rows, ties, isFinished, matchesCount } = groupStandings(group, matches)
  assert.equal(isFinished, true)
  assert.equal(matchesCount.total, 3)
  assert.equal(matchesCount.done, 3)
  assert.equal(ties.length, 0)

  assert.equal(rows[0].teamId, 'T1')
  assert.equal(rows[0].won, 2)
  assert.equal(rows[0].rank, 1)

  assert.equal(rows[1].teamId, 'T2')
  assert.equal(rows[1].won, 1)
  assert.equal(rows[1].rank, 2)

  assert.equal(rows[2].teamId, 'T3')
  assert.equal(rows[2].won, 0)
  assert.equal(rows[2].rank, 3)
})

test('groupStandings: hoà 2 đội xét Đối đầu trực tiếp (H2H) trước hiệu số toàn bảng', () => {
  // T1, T2 đều có 1 trận thắng (cùng 1W - 1L)
  // Nhưng T2 thắng T1 ở đối đầu trực tiếp dù T1 có hiệu số điểm thắng đậm hơn trước T3
  const group = {
    id: 'grp-1',
    teams: [{ teamId: 'T1' }, { teamId: 'T2' }, { teamId: 'T3' }],
  }
  const matches = [
    // T2 thắng T1 đối đầu sít sao
    { id: 'm1', groupId: 'grp-1', teamAId: 'T1', teamBId: 'T2', status: 'done', sets: [[20, 22]], winner: 'B', rule: R21 },
    // T1 huỷ diệt T3: 21-5 (hiệu số +16)
    { id: 'm2', groupId: 'grp-1', teamAId: 'T1', teamBId: 'T3', status: 'done', sets: [[21, 5]], winner: 'A', rule: R21 },
    // T3 bất ngờ thắng T2: 21-19
    { id: 'm3', groupId: 'grp-1', teamAId: 'T2', teamBId: 'T3', status: 'done', sets: [[19, 21]], winner: 'B', rule: R21 },
  ]
  // T1: 1W (21-5, 20-22) -> setDiff 0, pts +14
  // T2: 1W (22-20, 19-21) -> setDiff 0, pts 0
  // T3: 1W (5-21, 21-19) -> setDiff 0, pts -14
  // Cả 3 đội đều 1W! Đây là hoà 3 đội.
  // Nhưng hãy xét trường hợp bảng 4 đội để chỉ có ĐÚNG 2 đội hoà nhau (T1 và T2 cùng 2W):
  const group4 = {
    id: 'grp-2',
    teams: [{ teamId: 'T1' }, { teamId: 'T2' }, { teamId: 'T3' }, { teamId: 'T4' }],
  }
  const matches4 = [
    // T2 thắng T1 đối đầu: 21-19
    { id: 'm1', groupId: 'grp-2', teamAId: 'T1', teamBId: 'T2', status: 'done', sets: [[19, 21]], winner: 'B', rule: R21 },
    // T1 thắng T3 đậm: 21-5
    { id: 'm2', groupId: 'grp-2', teamAId: 'T1', teamBId: 'T3', status: 'done', sets: [[21, 5]], winner: 'A', rule: R21 },
    // T1 thắng T4 đậm: 21-5
    { id: 'm3', groupId: 'grp-2', teamAId: 'T1', teamBId: 'T4', status: 'done', sets: [[21, 5]], winner: 'A', rule: R21 },
    // T2 thắng T3 sít sao: 21-19
    { id: 'm4', groupId: 'grp-2', teamAId: 'T2', teamBId: 'T3', status: 'done', sets: [[21, 19]], winner: 'A', rule: R21 },
    // T2 thua T4: 19-21
    { id: 'm5', groupId: 'grp-2', teamAId: 'T2', teamBId: 'T4', status: 'done', sets: [[19, 21]], winner: 'B', rule: R21 },
    // T3 thua T4: 15-21
    { id: 'm6', groupId: 'grp-2', teamAId: 'T3', teamBId: 'T4', status: 'done', sets: [[15, 21]], winner: 'B', rule: R21 },
  ]
  // T1: 2 thắng, pointDiff = (19-21) + (21-5) + (21-5) = -2 + 16 + 16 = +30
  // T2: 2 thắng, pointDiff = (21-19) + (21-19) + (19-21) = +2 + 2 - 2 = +2
  // T4: 2 thắng, pointDiff = (5-21) + (21-19) + (21-15) = -16 + 2 + 6 = -8
  // T3: 0 thắng.
  // Ở đây có 3 đội cùng 2 trận thắng: T1, T2, T4.

  // Giờ hãy tạo ca chính xác chỉ có 2 đội hoà nhau về trận thắng:
  const matches2Tie = [
    // T1 vs T2: T2 thắng 21-19
    { id: 'm1', groupId: 'grp-2', teamAId: 'T1', teamBId: 'T2', status: 'done', sets: [[19, 21]], winner: 'B', rule: R21 },
    // T1 thắng T3: 21-0 (pointDiff cực cao)
    { id: 'm2', groupId: 'grp-2', teamAId: 'T1', teamBId: 'T3', status: 'done', sets: [[21, 0]], winner: 'A', rule: R21 },
    // T1 thắng T4: 21-0
    { id: 'm3', groupId: 'grp-2', teamAId: 'T1', teamBId: 'T4', status: 'done', sets: [[21, 0]], winner: 'A', rule: R21 },
    // T2 thắng T3: 21-20
    { id: 'm4', groupId: 'grp-2', teamAId: 'T2', teamBId: 'T3', status: 'done', sets: [[21, 20]], winner: 'A', rule: R21 },
    // T2 thắng T4: 21-20
    { id: 'm5', groupId: 'grp-2', teamAId: 'T2', teamBId: 'T4', status: 'done', sets: [[21, 20]], winner: 'A', rule: R21 },
    // T3 thắng T4: 21-10
    { id: 'm6', groupId: 'grp-2', teamAId: 'T3', teamBId: 'T4', status: 'done', sets: [[21, 10]], winner: 'A', rule: R21 },
  ]
  // T1: 2W, pointDiff = -2 + 21 + 21 = +40
  // T2: 3W, xếp 1
  // Nếu T2 thua T4: T2 có 2W. T1 có 2W. T3 có 1W. T4 có 1W.
  // Hãy xét ca T2 thua T4 sít sao:
  matches2Tie[4] = { id: 'm5', groupId: 'grp-2', teamAId: 'T2', teamBId: 'T4', status: 'done', sets: [[20, 22]], winner: 'B', rule: R21 }
  // Lúc này:
  // T1: 2W (thua T2, thắng T3, thắng T4). pointDiff = -2 + 21 + 21 = +40.
  // T2: 2W (thắng T1, thắng T3, thua T4). pointDiff = +2 + 1 - 2 = +1.
  // T3: 1W (thắng T4).
  // T4: 1W (thắng T2).
  // T1 và T2 cùng 2 trận thắng, chỉ có 2 đội này hoà nhau tranh hạng 1-2.
  // Đối đầu trực tiếp: T2 thắng T1 (21-19).
  // Chuẩn BWF: T2 PHẢI xếp trên T1 dù hiệu số T1 là +40 còn T2 là +1!
  const res2 = groupStandings(group4, matches2Tie)
  assert.equal(res2.rows[0].teamId, 'T2', 'T2 phải xếp #1 nhờ thắng đối đầu trực tiếp')
  assert.equal(res2.rows[0].rank, 1)
  assert.equal(res2.rows[1].teamId, 'T1', 'T1 xếp #2 dù hiệu số +40 cao hơn hẳn')
  assert.equal(res2.rows[1].rank, 2)
})

test('groupStandings: hoà 3 đội xét mini-table hiệu số set và điểm trong nhóm', () => {
  const group = {
    id: 'grp-3',
    teams: [{ teamId: 'A' }, { teamId: 'B' }, { teamId: 'C' }],
  }
  // Thể thức 3 set 15 điểm:
  // Trận 1: A thắng B 2-0: [15-10, 15-10] (A set +2, pts +10; B set -2, pts -10)
  // Trận 2: B thắng C 2-1: [15-10, 10-15, 15-10] (B set +1, pts +5; C set -1, pts -5)
  // Trận 3: C thắng A 2-0: [15-5, 15-5] (C set +2, pts +20; A set -2, pts -20)
  // Cả 3 đội đều 1 thắng, 1 thua.
  // Set diff trong mini-table:
  // C: thắng 2 set (trận 3), thua 1 set (trận 2) => setsWon = 2+1=3, setsLost = 2, setDiff = 3 - 2 = +1.
  // Chờ chút:
  // C vs A: C thắng 2-0 => C có 2 set, A có 0 set.
  // B vs C: B thắng 2-1 => B có 2 set, C có 1 set.
  // Tổng của C: 3 set thắng, 2 set thua => setDiff = +1.
  // Tổng của A: A vs B (2-0), C vs A (0-2) => A có 2 set thắng, 2 set thua => setDiff = 0.
  // Tổng của B: A vs B (0-2), B vs C (2-1) => B có 2 set thắng, 3 set thua => setDiff = -1.
  // Vậy C có setDiff +1 -> Hạng 1!
  // A có setDiff 0 -> Hạng 2!
  // B có setDiff -1 -> Hạng 3!
  const matches = [
    { id: 'm1', groupId: 'grp-3', teamAId: 'A', teamBId: 'B', status: 'done', sets: [[15, 10], [15, 10]], winner: 'A', rule: R3x15 },
    { id: 'm2', groupId: 'grp-3', teamAId: 'B', teamBId: 'C', status: 'done', sets: [[15, 10], [10, 15], [15, 10]], winner: 'A', rule: R3x15 },
    { id: 'm3', groupId: 'grp-3', teamAId: 'C', teamBId: 'A', status: 'done', sets: [[15, 5], [15, 5]], winner: 'A', rule: R3x15 },
  ]
  const res = groupStandings(group, matches)
  assert.equal(res.rows[0].teamId, 'C')
  assert.equal(res.rows[1].teamId, 'A')
  assert.equal(res.rows[2].teamId, 'B')
  assert.equal(res.ties.length, 0)
})

test('groupStandings: hoà tuyệt đối đưa vào ties để BTC phân xử', () => {
  const group = {
    id: 'grp-4',
    teams: [{ teamId: 'X' }, { teamId: 'Y' }],
  }
  // 2 đội chưa đấu hoặc tỉ số giống hệt nhau
  const matches = [
    { id: 'm1', groupId: 'grp-4', teamAId: 'X', teamBId: 'Y', status: 'ready', sets: [], winner: null, rule: R21 },
  ]
  const res = groupStandings(group, matches)
  assert.equal(res.isFinished, false)
  // Cả hai đều 0W, 0L, 0 diff -> ties
  assert.equal(res.ties.length, 1)
  assert.deepEqual(res.ties[0].sort(), ['X', 'Y'])
})

test('groupStandings: walkover và retired tính đúng số set và điểm', () => {
  const group = {
    id: 'grp-5',
    teams: [{ teamId: 'T1' }, { teamId: 'T2' }, { teamId: 'T3' }],
  }
  const matches = [
    // T1 thắng walkover T2
    { id: 'm1', groupId: 'grp-5', teamAId: 'T1', teamBId: 'T2', status: 'walkover', sets: [], winner: 'A', rule: R21 },
    // T3 bỏ cuộc (retired) giữa chừng khi đấu với T1 ở set 1: đang 10-15
    { id: 'm2', groupId: 'grp-5', teamAId: 'T1', teamBId: 'T3', status: 'retired', sets: [[15, 10]], winner: 'A', rule: R21 },
    // T2 thắng T3 bình thường: 21-10
    { id: 'm3', groupId: 'grp-5', teamAId: 'T2', teamBId: 'T3', status: 'done', sets: [[21, 10]], winner: 'A', rule: R21 },
  ]
  const res = groupStandings(group, matches)
  assert.equal(res.isFinished, true)
  assert.equal(res.rows[0].teamId, 'T1')
  assert.equal(res.rows[0].won, 2)
  assert.equal(res.rows[0].setsWon, 2)
  // Walkover được 21 điểm, retired set 1 được 15 điểm
  assert.equal(res.rows[0].pointsWon, 36)
})

test('groupStandings: hoà 3 đội vòng tròn khép kín, bảng con tách 1 đội → 2 đội còn lại quay về đối đầu', () => {
  // A>B, B>C, C>A — cả 3 đều 1 thắng, hiệu set trong nhóm đều 0.
  // Hiệu điểm: A +6, B −3, C −3 → A tách lên đầu, B–C còn hoà → B thắng C nên B xếp trên.
  // Thứ tự đội truyền vào cố ý là C, B, A: không được để thứ tự đầu vào quyết định.
  const group = { id: 'g', teams: ['C', 'B', 'A'] }
  const matches = [
    { id: 'm1', groupId: 'g', teamAId: 'A', teamBId: 'B', status: 'done', sets: [[21, 11]], winner: 'A', rule: R21 },
    { id: 'm2', groupId: 'g', teamAId: 'B', teamBId: 'C', status: 'done', sets: [[21, 14]], winner: 'A', rule: R21 },
    { id: 'm3', groupId: 'g', teamAId: 'C', teamBId: 'A', status: 'done', sets: [[21, 17]], winner: 'A', rule: R21 },
  ]
  const res = groupStandings(group, matches)
  assert.deepEqual(res.rows.map((r) => r.teamId), ['A', 'B', 'C'])
  assert.equal(res.ties.length, 0)
})

test('groupStandings: hoà 3 đội đối xứng hoàn toàn → một nhóm ties 3 đội, đánh dấu tied', () => {
  const group = { id: 'g', teams: ['A', 'B', 'C'] }
  const matches = [
    { id: 'm1', groupId: 'g', teamAId: 'A', teamBId: 'B', status: 'done', sets: [[21, 15]], winner: 'A', rule: R21 },
    { id: 'm2', groupId: 'g', teamAId: 'B', teamBId: 'C', status: 'done', sets: [[21, 15]], winner: 'A', rule: R21 },
    { id: 'm3', groupId: 'g', teamAId: 'C', teamBId: 'A', status: 'done', sets: [[21, 15]], winner: 'A', rule: R21 },
  ]
  const res = groupStandings(group, matches)
  assert.equal(res.ties.length, 1)
  assert.deepEqual([...res.ties[0]].sort(), ['A', 'B', 'C'])
  assert.ok(res.rows.every((r) => r.tied))
})

test('groupStandings: bỏ cuộc khi bên bỏ cuộc đang dẫn — set dở dang tính cho bên thắng', () => {
  // B bỏ cuộc khi đang dẫn 15-5 ở set 1 (luật 3×21): A thắng. Set dở không được tính cho B.
  const R3x21 = { sets: 3, points: 21, winBy2: true, cap: 30 }
  const group = { id: 'g', teams: ['A', 'B'] }
  const matches = [{ id: 'm1', groupId: 'g', teamAId: 'A', teamBId: 'B', status: 'retired', sets: [[5, 15]], winner: 'A', rule: R3x21 }]
  const { rows } = groupStandings(group, matches)
  const a = rows.find((r) => r.teamId === 'A')
  const b = rows.find((r) => r.teamId === 'B')
  assert.equal(a.setsWon, 2)
  assert.equal(b.setsWon, 0)
  assert.equal(rows[0].teamId, 'A')
})

test('stageGroups + orderedRows + swapUpInTie: ghép đội vào bảng, BTC chỉ đảo được trong nhóm hoà', () => {
  const tour = {
    groups: [{ id: 'gB', stageId: 's1', label: 'B', seq: 2 }, { id: 'gA', stageId: 's1', label: 'A', seq: 1 }, { id: 'gX', stageId: 's2', label: 'A', seq: 1 }],
    groupTeams: [
      { groupId: 'gA', teamId: 'T2', seedInGroup: 2 }, { groupId: 'gA', teamId: 'T1', seedInGroup: 1 },
      { groupId: 'gB', teamId: 'T3', seedInGroup: 1 },
    ],
  }
  const gs = stageGroups(tour, 's1')
  assert.deepEqual(gs.map((g) => g.label), ['A', 'B'])
  assert.deepEqual(gs[0].teams.map((t) => t.teamId), ['T1', 'T2'])

  const rows = [{ teamId: 'X', rank: 1 }, { teamId: 'Y', rank: 2 }, { teamId: 'Z', rank: 3 }]
  const ties = [['Y', 'Z']]
  assert.equal(swapUpInTie(rows, ties, 'Y'), null, 'X không hoà với Y → không được đảo')
  const manual = swapUpInTie(rows, ties, 'Z')
  assert.deepEqual(manual, ['X', 'Z', 'Y'])
  assert.deepEqual(orderedRows(rows, manual).map((r) => [r.teamId, r.rank]), [['X', 1], ['Z', 2], ['Y', 3]])
  assert.equal(orderedRows(rows, ['X', 'Y']), rows, 'thứ tự cũ không còn khớp đội → bỏ qua')
})
