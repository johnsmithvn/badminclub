import test from 'node:test'
import assert from 'node:assert/strict'
import { buildKnockout } from '#lib/tournament/bracket.js'
import { canUndo, applyCommit, applyUndo, applyEdit, canResetStage } from '#lib/tournament/advance.js'

const R30 = { sets: 1, points: 30, winBy2: false, cap: 30 }
const R3x15 = { sets: 3, points: 15, winBy2: false, cap: 15 }
const stage = { id: 's1', matchRule: R30, ruleOverrides: { final: R3x15, third: R3x15 }, config: { thirdPlace: true } }

let counter = 0
const eight = () => buildKnockout({
  stage,
  entrants: Array.from({ length: 8 }, (_, i) => ({ id: `T${i + 1}`, seed: i + 1 })),
  newId: () => `m${++counter}`,
})
const at = (ms, round, slot) => ms.find((m) => m.round === round && m.slot === slot)
const kind = (ms, k) => ms.find((m) => m.roundKind === k)
const byId = (ms, id) => ms.find((m) => m.id === id)

// Chốt, và bắt buộc thành công (dùng để dựng tình huống).
function commit(ms, matchId, p = {}) {
  const res = applyCommit(ms, { matchId, sets: [[30, 20]], winner: 'A', ...p })
  assert.equal(res.error, null, res.error)
  return res.matches
}
// Đánh xong TK + BK, bên A thắng hết → CK: T1–T2, 3-4: T4–T3.
function throughSemis() {
  let ms = eight()
  for (let s = 0; s < 4; s++) ms = commit(ms, at(ms, 0, s).id)
  for (let s = 0; s < 2; s++) ms = commit(ms, at(ms, 1, s).id)
  return ms
}

test('chốt: đội thắng lên đúng bên của trận sau; đủ 2 đội mới ready', () => {
  let ms = eight()
  ms = commit(ms, at(ms, 0, 0).id)
  assert.equal(at(ms, 1, 0).teamAId, 'T1')
  assert.equal(at(ms, 1, 0).status, 'pending', 'thiếu đội bên B mà ready là cho đánh trận thiếu người')
  ms = commit(ms, at(ms, 0, 1).id, { sets: [[28, 30]], winner: 'B' })
  assert.equal(at(ms, 1, 0).teamBId, 'T5', 'TK2 bên B (T5) thắng → vào BK1 bên B')
  assert.equal(at(ms, 1, 0).status, 'ready')
})

test('chốt bán kết: thắng → CK, thua → 3-4, hai bán kết vào hai bên khác nhau', () => {
  const ms = throughSemis()
  assert.deepEqual([kind(ms, 'final').teamAId, kind(ms, 'final').teamBId], ['T1', 'T2'])
  assert.deepEqual([kind(ms, 'third').teamAId, kind(ms, 'third').teamBId], ['T4', 'T3'])
  assert.equal(kind(ms, 'final').status, 'ready')
  assert.equal(kind(ms, 'third').status, 'ready')
})

test('chốt bị từ chối: điểm sai luật, người thắng lệch điểm, trận chưa đủ đội, chốt lần 2', () => {
  let ms = eight()
  const qf1 = at(ms, 0, 0).id
  const err = (p) => applyCommit(ms, { matchId: qf1, sets: [[30, 20]], winner: 'A', ...p }).error
  assert.equal(err({ sets: [[25, 20]] }), 'tournament.err.incompleteSet', '25-20 luật chạm 30: set chưa xong mà chốt được là đẩy đội lên vòng sau quá sớm')
  assert.equal(err({ sets: [[31, 20]] }), 'tournament.err.invalidSetScore')
  assert.equal(err({ winner: 'B' }), 'tournament.err.winnerMismatch', 'điểm A thắng mà ghi B thắng = đẩy nhầm đội lên vòng sau')
  assert.equal(err({ status: 'walkover', sets: [] }), 'tournament.err.missingReason', 'xử thua phải có lý do')
  assert.equal(applyCommit(ms, { matchId: at(ms, 1, 0).id, sets: [[30, 1]], winner: 'A' }).error,
    'tournament.err.matchNotReady', 'bán kết chưa có đội mà chốt được là tạo kết quả ma')
  ms = commit(ms, qf1)
  assert.equal(err({}), 'tournament.err.alreadyCommitted',
    'chốt lần 2 phải đi đường sửa điểm (có lý do, có nhật ký), không được ghi đè im lặng')
})

test('hoàn tác bán kết: gỡ đội ở CẢ chung kết lẫn 3-4; chặn khi trận đích đã đánh', () => {
  let ms = throughSemis()
  const sf1 = at(ms, 1, 0).id
  const res = applyUndo(ms, { matchId: sf1, reason: 'ghi nhầm' })
  assert.equal(res.error, null)
  assert.equal(kind(res.matches, 'final').teamAId, null)
  assert.equal(kind(res.matches, 'third').teamAId, null, 'quên gỡ 3-4 = đội thua cũ vẫn đá tranh hạng')
  assert.equal(kind(res.matches, 'final').status, 'pending')
  assert.equal(byId(res.matches, sf1).status, 'ready')

  for (const status of ['live', 'done']) {
    const blocked = ms.map((m) => (m.roundKind === 'third' ? { ...m, status } : m))
    assert.equal(applyUndo(blocked, { matchId: sf1, reason: 'x' }).error, 'tournament.err.downstreamHasResult',
      `3-4 đang ${status}: gỡ đội ra là xoá trận người ta đang/đã đánh`)
  }
  assert.equal(applyUndo(ms, { matchId: sf1, reason: '  ' }).error, 'tournament.err.missingReason')
})

test('hoàn tác walkover / retired: gỡ downstream và xoá lý do cũ', () => {
  for (const status of ['walkover', 'retired']) {
    let ms = eight()
    const qf1 = at(ms, 0, 0).id
    const sets = status === 'retired' ? [[12, 7]] : []
    ms = commit(ms, qf1, { status, sets, winner: 'B', note: 'chấn thương' })
    assert.equal(at(ms, 1, 0).teamAId, 'T8')
    assert.equal(byId(ms, qf1).resultNote, 'chấn thương')
    const res = applyUndo(ms, { matchId: qf1, reason: 'nhầm trận' })
    assert.equal(res.error, null, status)
    assert.equal(at(res.matches, 1, 0).teamAId, null, `${status}: đội thắng xử phải bị gỡ khỏi bán kết`)
    assert.equal(byId(res.matches, qf1).resultNote, null, `${status}: lý do cũ còn lại là nhãn sai trên trận`)
  }
})

test('retired: set dở dang hợp lệ, nhưng điểm vẫn phải đọc được theo luật', () => {
  const ms = eight()
  const qf1 = at(ms, 0, 0).id
  const retire = (sets) => applyCommit(ms, { matchId: qf1, sets, winner: 'A', status: 'retired', note: 'đau' }).error
  assert.equal(retire([[12, 7]]), null)
  assert.equal(retire([[40, 7]]), 'tournament.err.invalidSetScore')
  assert.equal(retire([[1, 1], [1, 1]]), 'tournament.err.invalidSetScore', 'luật 1 set mà có 2 set')
  assert.equal(applyCommit(ms, { matchId: qf1, sets: [[3, 1]], winner: 'A', status: 'walkover', note: 'vắng' }).error,
    'tournament.err.walkoverHasSets', 'xử thua là chưa đánh — có điểm là nhập nhầm trạng thái')
})

test('sửa điểm: giữ người thắng ✓; điểm mới đổi người thắng ✗; đổi người thắng = undo + commit', () => {
  let ms = eight()
  const qf1 = at(ms, 0, 0).id
  ms = commit(ms, qf1)
  const ok = applyEdit(ms, { matchId: qf1, sets: [[30, 25]], reason: 'biên bản' })
  assert.equal(ok.error, null)
  assert.deepEqual(byId(ok.matches, qf1).sets, [[30, 25]])
  assert.deepEqual(byId(ms, qf1).sets, [[30, 20]], 'không được sửa vào mảng người gọi')
  assert.equal(applyEdit(ms, { matchId: qf1, sets: [[25, 30]], reason: 'x' }).error, 'tournament.err.cannotChangeWinnerInEdit')
  assert.equal(applyEdit(ms, { matchId: qf1, sets: [[30, 25]], reason: '' }).error, 'tournament.err.missingReason')

  ms = applyUndo(ms, { matchId: qf1, reason: 'nhầm người thắng' }).matches
  ms = commit(ms, qf1, { sets: [[25, 30]], winner: 'B' })
  assert.equal(at(ms, 1, 0).teamAId, 'T8')
})

test('bye không hoàn tác được; reset giai đoạn chỉ khi chưa có kết quả thật', () => {
  const ms = buildKnockout({
    stage, entrants: Array.from({ length: 5 }, (_, i) => ({ id: `T${i + 1}`, seed: i + 1 })), newId: () => `b${++counter}`,
  })
  assert.equal(canUndo(ms, ms.find((m) => m.status === 'bye').id).reasonKey, 'tournament.err.cannotUndoBye')
  assert.equal(canResetStage(ms).ok, true, 'mới có bye thì vẫn sinh lại được')
  const played = commit(ms, ms.find((m) => m.round === 0 && m.status === 'ready').id)
  assert.equal(canResetStage(played).reasonKey, 'tournament.err.stageHasResults')
})
