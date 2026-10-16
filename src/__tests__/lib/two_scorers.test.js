// Hai người cùng ghi sân trên hai máy.
//
// Kèo: DB chặn ván trùng bằng unique (challenge_id, set_no) (migration 0068) — test này gác phía
// client: số ván tính ra phải khiến máy chưa nạp ván mới luôn đụng một số ĐÃ CÓ, và kèo đã đủ ván
// thắng thì không nhận thêm ván nào (ván thừa mang số mới, index không bắt được).
// Trận thường: KHÔNG chặn trùng (cùng 4 người đánh lại thật là chuyện thường) — chỉ ghi lại ai ghi,
// để danh sách trận cho thấy dòng nào của máy nào.
import test from 'node:test'
import assert from 'node:assert/strict'
import { nextChallengeSetNo } from '../../lib/challenge.js'
import { recorderName } from '../../lib/money.js'
import { makeActions } from '../../contexts/appActions.js'
import { mergeSessionSlice } from '../../contexts/dbmap.js'

test('recorderName — tên người ghi trận theo tài khoản', () => {
  const db = {
    members: [
      { id: 'm1', name: 'Minh', userId: 'U1' },
      { id: 'm9', name: 'Lan', userId: 'U9', active: false },
    ],
    guests: [],
    users: [{ id: 'U5', name: 'Chủ sân', nick: 'Boss' }],
  }
  assert.equal(recorderName(db, 'U1'), 'Minh')
  assert.equal(recorderName(db, 'U9'), 'Lan', 'người đã nghỉ vẫn là người ghi trận cũ')
  assert.equal(recorderName(db, 'U5'), 'Boss', 'không phải thành viên thì lấy hồ sơ tài khoản')
  assert.equal(recorderName(db, 'U404'), '')
  assert.equal(recorderName(db, null), '', 'trận cũ chưa ghi người ghi')
})

test('nextChallengeSetNo — số ván kế tiếp', () => {
  assert.equal(nextChallengeSetNo([]), 1, 'kèo chưa có ván nào')
  assert.equal(nextChallengeSetNo([{ setNo: 1 }]), 2)
  assert.equal(nextChallengeSetNo([{}, {}]), 3, 'ván ghi trước 0068 chưa có số vẫn được đếm')
  assert.equal(nextChallengeSetNo([{ setNo: 2 }]), 3, 'huỷ ván 1 giữa chuỗi: không được lùi về số 2 đang có')

  // Máy B chỉ biết ván 1, máy A đã ghi tới ván 2: số B tính ra phải nằm trong số đã có dưới DB.
  const real = [{ setNo: 1 }, { setNo: 2 }]
  const staleB = real.slice(0, 1)
  assert.ok(real.some((m) => m.setNo === nextChallengeSetNo(staleB)), 'máy cũ phải đụng số ván đã có')
  // Máy B chưa biết ván nào.
  assert.ok(real.some((m) => m.setNo === nextChallengeSetNo([])))
})

test('saveMatchScore — gắn số ván và không ghi thêm vào kèo đã xong', async (t) => {
  let currentDb = {
    clubId: 'CL1',
    currentUserId: 'U1',
    members: [
      { id: 'm1', name: 'Minh', userId: 'U1', level: 'TB' },
      { id: 'm2', name: 'Hùng', level: 'TB' },
      { id: 'm3', name: 'Tuấn', level: 'TB' },
      { id: 'm4', name: 'Vũ', level: 'TB' },
    ],
    guests: [],
    levels: ['TB'],
    sessions: [{ id: 'S1', date: '2026-10-16' }],
    challenges: [
      { id: 'BO1', code: 'C-0001', bestOf: 1, status: 'accepted', sessionId: 'S1', teamA: ['m1', 'm2'], teamB: ['m3', 'm4'] },
      { id: 'BO3', code: 'C-0002', bestOf: 3, status: 'accepted', sessionId: 'S1', teamA: ['m1', 'm2'], teamB: ['m3', 'm4'] },
    ],
    challengePredictions: [],
    matches: [],
    playerRatings: {},
    clubCalibration: [],
    lineups: {},
    notifications: [],
  }
  const dbRef = { current: currentDb }
  const toasts = []
  const a = makeActions({
    setDb: (updater) => {
      const patch = typeof updater === 'function' ? updater(currentDb) : updater
      currentDb = { ...currentDb, ...patch }
      dbRef.current = currentDb
    },
    setUi: () => {},
    dbRef,
    uiRef: { current: {} },
    navRef: { current: () => {} },
    toast: (msg) => toasts.push(msg),
    reload: () => {},
  })
  const save = (challengeId, sets) => a.saveMatchScore({
    sid: 'S1', ci: 0, teamA: ['m1', 'm2'], teamB: ['m3', 'm4'], sets, challengeId,
  })

  await t.test('trận thường không mang số ván, có ghi người ghi', () => {
    const res = save(null, [[21, 15]])
    assert.ok(res)
    assert.equal(res.setNo, null)
    assert.equal(res.createdBy, 'U1')
  })

  await t.test('trận thường ghi lại y hệt vẫn lưu — không chặn trùng', () => {
    const before = currentDb.matches.length
    assert.ok(save(null, [[21, 15]]))
    assert.equal(currentDb.matches.length, before + 1)
  })

  await t.test('BO3: mỗi ván một số, tăng dần', () => {
    assert.equal(save('BO3', [[21, 15]]).setNo, 1)
    assert.equal(save('BO3', [[15, 21]]).setNo, 2)
    assert.equal(save('BO3', [[21, 18]]).setNo, 3)
  })

  await t.test('BO3 đã đủ 2 ván thắng: ván thứ 4 bị từ chối, không sinh trận', () => {
    const before = currentDb.matches.length
    toasts.length = 0
    assert.equal(save('BO3', [[21, 10]]), undefined)
    assert.equal(currentDb.matches.length, before, 'kèo đã xong mà vẫn ghi thêm trận')
    assert.ok(toasts.some((m) => m.includes('C-0002')), 'phải báo rõ kèo nào đã xong')
  })

  await t.test('BO1: ghi lần hai (trận còn treo trên sân) bị từ chối', () => {
    assert.equal(save('BO1', [[21, 19]]).setNo, 1)
    const before = currentDb.matches.length
    assert.equal(save('BO1', [[21, 19]]), undefined)
    assert.equal(currentDb.matches.length, before)
    assert.equal(currentDb.matches.filter((m) => m.challengeId === 'BO1').length, 1)
  })

  await t.test('ensureMatchFresh: trận thường không từ sân → cho lưu, không gọi mạng', async () => {
    assert.equal(await a.ensureMatchFresh({}), true)
    assert.equal(await a.ensureMatchFresh(), true)
  })

  await t.test('trận nháp: xếp lên sân → ghi tỉ số thì thành trận thật mang mã nháp, rời sân', () => {
    const live = a.deployLiveMatch({ sessionId: 'S1', courtIdx: 1, courtLabel: 'Sân 2', teamA: ['m1', 'm2'], teamB: ['m3', 'm4'] })
    assert.ok(live?.id)
    assert.equal(live.createdBy, 'U1')
    assert.equal(currentDb.liveMatches.length, 1)

    const res = a.saveMatchScore({ sid: 'S1', ci: 1, teamA: live.teamA, teamB: live.teamB, sets: [[21, 17]], liveId: live.id })
    assert.equal(res.liveId, live.id)
    assert.equal(currentDb.liveMatches.length, 0, 'ghi xong mà trận nháp vẫn nằm trên sân')
    assert.equal(currentDb.matches.filter((m) => m.liveId === live.id).length, 1)
  })

  await t.test('trận nháp: huỷ khỏi sân chỉ bỏ đúng trận đó', () => {
    const x = a.deployLiveMatch({ sessionId: 'S1', teamA: ['m1'], teamB: ['m2'], mode: 'singles' })
    const y = a.deployLiveMatch({ sessionId: 'S1', teamA: ['m3'], teamB: ['m4'], mode: 'lạ' })
    assert.equal(y.mode, 'doubles', 'mode lạ phải về doubles — CHECK dưới DB chỉ nhận doubles/singles')
    a.removeLiveMatch(x.id)
    assert.deepEqual(currentDb.liveMatches.map((m) => m.id), [y.id])
  })
})

test('mergeSessionSlice — chỉ thay phần của buổi vừa hỏi', () => {
  const db = {
    clubId: 'CL1',
    levels: ['TB'],
    members: [{ id: 'm1' }],
    liveMatches: [
      { id: 'L1', sessionId: 'S1' },
      { id: 'L2', sessionId: 'S2' },
    ],
    matches: [
      { id: 'A', sessionId: 'S1', at: 1 },
      { id: 'B', sessionId: 'S2', at: 2 },
    ],
    challenges: [{ id: 'C1', code: 'C-0001', status: 'accepted' }, { id: 'C9', code: 'C-0009', status: 'pending' }],
    playerRatings: { m1: { rating: 900 } },
    clubCalibration: [],
    notes: 'giữ nguyên',
  }
  const merged = mergeSessionSlice(db, {
    liveMatches: [{ id: 'L3', session_id: 'S1', team_a: ['m1'], team_b: ['m2'], started_at: '2026-10-16T13:00:00Z' }],
    matches: [
      { id: 'A', court_index: 0, minutes: 20, ended_at: '2026-10-16T12:00:00Z', match_players: [] },
      { id: 'N', court_index: 1, minutes: 20, ended_at: '2026-10-16T12:30:00Z', match_players: [], live_id: 'L1', created_by: 'U2' },
    ],
    challenges: [{ id: 'C1', code: 'C-0001', status: 'played' }],
    playerRatings: [{ id: 'r1', member_id: 'm1', rating: 912 }],
    clubCalibration: [],
  }, 'S1')

  assert.deepEqual(merged.liveMatches.map((m) => m.id).sort(), ['L2', 'L3'], 'L1 đã được máy kia ghi — phải rời sân; L2 buổi khác giữ nguyên')
  assert.deepEqual(merged.matches.filter((m) => m.sessionId === 'S1').map((m) => m.id).sort(), ['A', 'N'])
  assert.ok(merged.matches.some((m) => m.id === 'B'), 'trận buổi khác không được đụng')
  assert.equal(merged.matches.find((m) => m.id === 'N').liveId, 'L1')
  assert.equal(merged.challenges.find((c) => c.id === 'C1').status, 'played')
  assert.equal(merged.challenges.find((c) => c.id === 'C9').status, 'pending', 'kèo không nạp lại thì giữ nguyên')
  assert.equal(merged.playerRatings.m1.rating, 912)
  assert.equal(merged.notes, 'giữ nguyên')
})
