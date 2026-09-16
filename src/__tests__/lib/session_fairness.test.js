import test from 'node:test'
import assert from 'node:assert/strict'
import { sessionFairnessRows, fairness, matchStats, detailedCourtBalance } from '#lib/assign.js'

/**
 * Bảng kiểm kê công bằng lượt đánh (THAY-ĐỔI-03).
 *
 * Luật nghiệp vụ được khoá ở đây: danh sách người lấy NGUYÊN từ điểm danh — app không lưu giờ
 * đến / giờ về nên bảng này không được tự suy ra ai đến trước ai đến sau. Ai đã điểm danh thì
 * tính có mặt cả buổi, và phần đáng được hưởng của mọi người là như nhau.
 */

const SID = 's1'

/** db tối thiểu: nhóm 'ALL' nên groupMembers trả về mọi thành viên active. */
function mkDb(memberIds, matchSpecs, { absent = [] } = {}) {
  const attendance = {}
  memberIds.forEach((id) => { attendance[id] = !absent.includes(id) })
  return {
    members: memberIds.map((id) => ({ id, name: id.toUpperCase(), active: true, level: 'tb' })),
    guests: [],
    sessionGuests: [],
    attendance: { [SID]: attendance },
    sessions: [{ id: SID, date: '2026-08-01', groupId: 'ALL', status: 'open', courts: [{}, {}] }],
    matches: matchSpecs.map((keys, i) => ({
      id: 'mt' + i,
      sessionId: SID,
      at: 1000 + i,
      minutes: 20,
      playerKeys: keys,
      teamA: keys.slice(0, 2),
      teamB: keys.slice(2, 4),
    })),
  }
}

const rowOf = (rows, key) => rows.find((r) => r.key === key)

test('Kiểm kê công bằng lượt đánh trong một buổi', async (t) => {
  await t.test('1. Chia đều tuyệt đối thì không ai lệch', () => {
    // 8 người, 2 sân, 8 trận: p0..p3 đánh các trận chẵn, p4..p7 các trận lẻ -> ai cũng đúng 4 trận.
    // fairShare = 4 chỗ / 8 người = 0.5 -> kỳ vọng 8 * 0.5 = 4 = số trận đã đánh.
    const ids = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']
    const specs = []
    for (let i = 0; i < 8; i++) specs.push(i % 2 === 0 ? ['p0', 'p1', 'p2', 'p3'] : ['p4', 'p5', 'p6', 'p7'])
    const rows = sessionFairnessRows(mkDb(ids, specs), SID)

    assert.equal(rows.length, 8)
    rows.forEach((r) => {
      assert.equal(r.played, 4)
      assert.equal(r.debt, 0, `${r.name} lệch ${r.debt} trong khi cả buổi chia đều tăm tắp — công thức đang tự sinh ra nợ`)
    })
  })

  await t.test('2. Người có mặt từ đầu mà chưa được gọi phải nổi lên đầu bảng', () => {
    // 5 người có mặt, 4 trận đều là p0..p3. p4 ngồi ngoài suốt.
    const ids = ['p0', 'p1', 'p2', 'p3', 'p4']
    const specs = Array.from({ length: 4 }, () => ['p0', 'p1', 'p2', 'p3'])
    const rows = sessionFairnessRows(mkDb(ids, specs), SID)

    const forgotten = rowOf(rows, 'p4')
    // fairShare = 4/5 = 0.8 -> kỳ vọng 4 * 0.8 = 3.2 trận, đã đánh 0.
    assert.equal(forgotten.played, 0)
    assert.equal(forgotten.debt, 3.2, 'Người bị bỏ quên phải hiện nợ dương, đây là cả lý do bảng này tồn tại')
    assert.equal(forgotten.waitTurns, 4, 'Chờ = số trận đã kết thúc từ lúc họ có mặt mà chưa được gọi')
    assert.equal(rows[0].key, 'p4', 'Mặc định sắp theo Chờ giảm dần: người đầu bảng là người nên gọi tiếp theo')

    // Người đánh liên tục thì lệch ÂM — đang được ưu ái, không phải đang bị thiệt.
    assert.equal(rowOf(rows, 'p0').debt, -0.8)
  })

  await t.test('3. Chỉ đích danh AI đang thiệt — thứ fairness() cũ không làm nổi', () => {
    const ids = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5']
    const specs = [
      ...Array.from({ length: 5 }, () => ['p0', 'p1', 'p2', 'p3']),
      ['p0', 'p1', 'p2', 'p4'],
    ]
    const db = mkDb(ids, specs)
    const players = ids.map((k) => ({ key: k, name: k }))
    const stats = matchStats(db.matches, SID)

    // fairness() cũ chỉ trả một câu về cả buổi: lệch từ 0 đến 6. Không nói 0 là ai, cũng không
    // nói còn ai khác cũng đang 0 — quản trò đọc xong vẫn không biết phải gọi ai lên sân.
    assert.equal(fairness(players, stats).tone, 'warn')

    // Bảng mới chỉ thẳng: p5 chưa đánh trận nào và đang đứng đầu danh sách nên gọi.
    const rows = sessionFairnessRows(db, SID)
    assert.equal(rows[0].key, 'p5')
    assert.equal(rows[0].played, 0)
    assert.equal(rows[0].waitTurns, 6, 'Đã 6 trận trôi qua mà chưa được gọi lần nào')
    assert.equal(rows[0].debt, 4, 'fairShare 4/6 × 6 trận = 4 lượt đáng được hưởng, đã đánh 0')

    // Và xếp được thứ tự trong nhóm ít trận: p4 cũng mới 1 trận nhưng vừa xuống sân xong.
    assert.ok(
      rowOf(rows, 'p5').waitTurns > rowOf(rows, 'p4').waitTurns,
      'Ai vừa xuống sân thì chưa tới lượt — đây là thứ cột Chờ nói mà số trận trần không nói'
    )
  })

  await t.test('4. Điểm danh là nguồn chốt DUY NHẤT: ai báo vắng thì không có trong bảng', () => {
    // App không lưu giờ đến / giờ về, và `lineup` chỉ xếp được người đã điểm danh — nên bảng này
    // KHÔNG được tự suy ra thứ tự đến từ thứ tự ra sân. Ai đã điểm danh thì tính có mặt cả buổi.
    const ids = ['p0', 'p1', 'p2', 'p3', 'p4']
    const specs = Array.from({ length: 4 }, () => ['p0', 'p1', 'p2', 'p3'])
    const rows = sessionFairnessRows(mkDb(ids, specs, { absent: ['p4'] }), SID)

    assert.equal(rows.length, 4, 'Người báo vắng không được chiếm một dòng và kéo fairShare của người khác')
    assert.equal(rowOf(rows, 'p4'), undefined)
    // 4 người có mặt, 4 chỗ mỗi trận -> fairShare = 1, ai cũng đánh đủ 4 trận -> không ai lệch.
    rows.forEach((r) => assert.equal(r.debt, 0))
  })

  await t.test('5. Chờ đếm theo TRẬN kết thúc ở bất kỳ sân nào, không theo "vòng đấu"', () => {
    // Hai sân lệch nhịp: sân 1 quay 3 trận trong lúc sân 2 mới xong 1. Không có khái niệm vòng,
    // nên Chờ phải đếm số trận đã kết thúc ở CẢ HAI sân kể từ lần cuối người đó rời sân.
    const ids = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']
    const specs = [
      ['p0', 'p1', 'p2', 'p3'], // sân 1 xong trận 1
      ['p4', 'p5', 'p6', 'p7'], // sân 2 xong trận 1
      ['p0', 'p1', 'p2', 'p3'], // sân 1 xong trận 2
      ['p0', 'p1', 'p2', 'p3'], // sân 1 xong trận 3
      ['p0', 'p1', 'p2', 'p3'], // sân 1 xong trận 4
    ]
    const rows = sessionFairnessRows(mkDb(ids, specs), SID)

    // p4 rời sân sau trận index 1; sau đó có 3 trận nữa kết thúc (index 2, 3, 4).
    assert.equal(rowOf(rows, 'p4').waitTurns, 3, 'Sân bên kia quay nhanh cũng là trận đã kết thúc — phải tính vào Chờ')
    assert.equal(rowOf(rows, 'p0').waitTurns, 0, 'Người vừa xong trận cuối thì chưa chờ lượt nào')
  })

  await t.test('6. Buổi chưa có trận nào / buổi không tồn tại không được nổ', () => {
    const ids = ['p0', 'p1', 'p2', 'p3']
    const rows = sessionFairnessRows(mkDb(ids, []), SID)
    assert.equal(rows.length, 4)
    rows.forEach((r) => {
      assert.equal(r.played, 0)
      assert.equal(r.debt, 0, 'Chưa đánh trận nào thì chưa ai nợ ai')
      assert.equal(r.waitTurns, 0)
    })
    assert.deepEqual(sessionFairnessRows(mkDb(ids, []), 'khong-co'), [])
    assert.deepEqual(sessionFairnessRows({}, SID), [])
  })
})

test('Điểm H2H trên thẻ sân', async (t) => {
  /**
   * H2H chấm "hai bên này gặp nhau có hay không": gặp nhiều trận sát điểm thì cao, gặp toàn trận
   * một chiều thì thấp. Nó KHÔNG cộng vào điểm tổng của thẻ sân, chỉ hiển thị để quản trò cân nhắc.
   */
  const P = ['p1', 'p2', 'p3', 'p4'].map((k) => ({ key: k, name: k }))
  const RM = { p1: 500, p2: 500, p3: 500, p4: 500 }
  const LU = { c0t0s0: 'p1', c0t0s1: 'p2', c0t1s0: 'p3', c0t1s1: 'p4' }
  const h2h = (matches) => detailedCourtBalance({
    lineup: LU, ci: 0, ratingsMap: RM, matches, players: P, stats: {},
  }).h2h
  const mk = (...sets) => ({ teamA: ['p1', 'p2'], teamB: ['p3', 'p4'], sets, winnerTeam: sets[0][0] > sets[0][1] ? 'A' : 'B' })

  await t.test('7. Đánh với nhau một trận bình thường KHÔNG được làm điểm tụt', () => {
    // Lỗi cũ: nhánh "chưa gặp" lấy nền 88, nhánh "đã gặp" lấy nền 80. Nên chỉ cần gặp nhau
    // một trận tỷ số thường là điểm rơi 88 → 80, tức hai người CHƯA TỪNG gặp lại được chấm
    // cao hơn hai người đã gặp. Quản trò đọc bảng sẽ ưu tiên sai cặp.
    const chuaGap = h2h([]).score
    const motTranThuong = h2h([mk([21, 16])]).score
    assert.ok(
      motTranThuong >= chuaGap,
      `Gặp nhau một trận tỷ số thường (${motTranThuong}) mà thấp hơn chưa từng gặp (${chuaGap}) là nghịch lý`
    )
  })

  await t.test('8. Đếm theo TRẬN, không theo set', () => {
    // Lỗi cũ: vòng lặp chạy trên từng set nên trận 3 set bị cộng/trừ gấp ba. Hai cặp cùng đánh
    // một trận sát điểm mà cặp nào kéo 3 set thì tự nhiên được cộng nhiều hơn.
    const motSet = h2h([mk([21, 19])])
    const baSet = h2h([mk([21, 19], [19, 21], [22, 20])])
    assert.equal(motSet.matchesCount, 1)
    assert.equal(baSet.matchesCount, 1, 'Một trận ba set vẫn là MỘT trận')
    assert.equal(
      baSet.score, motSet.score,
      'Trận 3 set sát điểm phải chấm y như trận 1 set sát điểm — kéo dài set không phải là thành tích'
    )
  })

  await t.test('9. Sát điểm cộng, một chiều trừ, và một trận chỉ vào đúng một nhóm', () => {
    const base = h2h([]).score
    assert.ok(h2h([mk([21, 19])]).score > base, 'Gặp nhau toàn trận sát điểm thì nên ưu tiên ghép lại')
    assert.ok(h2h([mk([21, 5])]).score < base, 'Gặp nhau toàn trận một chiều thì nên tránh ghép lại')
    // Trận chênh 6 điểm: không sát (>3) cũng không một chiều (<12) -> đứng yên ở nền.
    assert.equal(h2h([mk([21, 15])]).score, base, 'Trận bình thường không cộng cũng không trừ')
  })
})
