// node src/__tests__/assign.test.js
import assert from 'node:assert/strict'
import { seed } from './fixture.js'
import {
  activeCourtIdxs, arrange, assignableSessions, autoSplit, courtBalance, courtSlotIds,
  fairness, matchStats, place, removePlayer, sessionPlayers, slotCourtIdx, slotIds,
} from '#lib/assign.js'
import { levelIdx } from '#lib/money.js'

const db = { ...seed(), today: '2026-08-19' }
const S = (id) => db.sessions.find((s) => s.id === id)

/* ---------- buổi nào được xếp ---------- */
const able = assignableSessions(db).map((s) => s.id)
assert.deepEqual(able, ['B6', 'B7'], 'chỉ buổi open, từ hôm nay trở đi, đã có người có mặt')
assert.ok(!able.includes('B5'), 'B5 đã chốt tiền → không xếp')
assert.ok(!able.includes('B8'), 'B8 còn draft → chưa mở điểm danh')
assert.ok(
  assignableSessions({ ...db, today: '2026-08-25' }).map((s) => s.id).every((id) => id !== 'B6'),
  'buổi đã qua ngày thì không xếp nữa'
)
// mở nhưng chưa ai điểm danh thì không hiện
const noAtt = { ...db, attendance: { ...db.attendance, B6: {}, B7: {} } }
assert.deepEqual(assignableSessions(noAtt), [], 'chưa ai Có mặt thì không có gì để xếp')
// chỉ có người bị đánh Vắng cũng không tính
const allAbsent = { ...db, attendance: { ...db.attendance, B6: { M2: false }, B7: { M1: false } } }
assert.deepEqual(assignableSessions(allAbsent), [])

/* ---------- slot ---------- */
assert.deepEqual(courtSlotIds(0), ['c0t0s0', 'c0t0s1', 'c0t1s0', 'c0t1s1'])
assert.deepEqual(courtSlotIds(2), ['c2t0s0', 'c2t0s1', 'c2t1s0', 'c2t1s1'])
assert.equal(slotCourtIdx('c0t1s0'), 0)
assert.equal(slotCourtIdx('c2t0s1'), 2)
assert.equal(slotCourtIdx('c10t1s1'), 10, 'sân index 2 chữ số vẫn đọc đúng')

// B7 nhóm CN 2 sân, không bán → 8 chỗ
assert.deepEqual(activeCourtIdxs(S('B7')), [0, 1])
assert.equal(slotIds(S('B7')).length, 8)
// Sân đã bán KHÔNG sinh slot
assert.deepEqual(activeCourtIdxs(S('B3')), [0], 'B3 bán sân thứ hai')
assert.equal(slotIds(S('B3')).length, 4)

/* ---------- người tham gia ---------- */
const p7 = sessionPlayers(db, S('B7'))
// B7: 15 người cố định CN, M5 và M15 vắng → 13, cộng 3 khách
assert.equal(p7.length, 16)
assert.equal(p7.filter((p) => p.guest).length, 3)
assert.ok(p7.every((p) => p.key && p.name && p.level && p.gender), 'thẻ người phải đủ 4 trường để render')
assert.equal(new Set(p7.map((p) => p.key)).size, p7.length, 'key không trùng')
assert.ok(!p7.some((p) => p.key === 'M5'), 'người vắng không có trong danh sách chia sân')
assert.deepEqual(sessionPlayers(db, null), [], 'không có buổi thì rỗng, không crash')

/* ---------- matchStats ---------- */
const matches = [
  { sessionId: 'B7', courtIdx: 0, playerKeys: ['M1', 'M2', 'M3', 'M4'], minutes: 20 },
  { sessionId: 'B7', courtIdx: 0, playerKeys: ['M1', 'M2', 'K1', 'K3'], minutes: 22 },
  { sessionId: 'B6', courtIdx: 0, playerKeys: ['M1'], minutes: 15 },
]
const stats = matchStats(matches, 'B7')
assert.equal(stats.M1.n, 2)
assert.equal(stats.M1.min, 42)
assert.equal(stats.M3.n, 1)
assert.equal(stats.K1.n, 1, 'khách cũng được tính trận')
assert.equal(stats.M5, undefined, 'ai chưa đánh thì không có bản ghi')
assert.equal(matchStats(matches, 'B6').M1.min, 15, 'chỉ tính trong buổi đó, không cộng buổi khác')
assert.deepEqual(matchStats([], 'B7'), {})
assert.deepEqual(matchStats(undefined, 'B7'), {}, 'matches chưa có thì không crash')

/* ---------- place: đặt và ĐỔI CHỖ ---------- */
let lu = {}
lu = place(lu, 'c0t0s0', 'M1')
assert.deepEqual(lu, { c0t0s0: 'M1' })
// đặt người mới vào ô trống
lu = place(lu, 'c0t0s1', 'M2')
assert.deepEqual(lu, { c0t0s0: 'M1', c0t0s1: 'M2' })
// kéo M1 sang ô M2 đang đứng → hai người đổi chỗ
lu = place(lu, 'c0t0s1', 'M1')
assert.deepEqual(lu, { c0t0s1: 'M1', c0t0s0: 'M2' }, 'đổi chỗ, không ai bị mất')
// kéo người từ danh sách chờ vào ô đã có người → người cũ bị đẩy ra khỏi sân
lu = place(lu, 'c0t0s1', 'M9')
assert.equal(lu.c0t0s1, 'M9')
assert.ok(!Object.values(lu).includes('M1'), 'M1 rời sân vì không có ô cũ để hoán')
// một người không được đứng hai ô
lu = place({ c0t0s0: 'M1', c0t1s0: 'M2' }, 'c0t1s1', 'M1')
assert.equal(Object.values(lu).filter((k) => k === 'M1').length, 1)
assert.equal(place({ c0t0s0: 'M1' }, 'c0t0s0', 'M1').c0t0s0, 'M1', 'đặt lại chính chỗ mình thì không đổi gì')

/* ---------- removePlayer ---------- */
assert.deepEqual(removePlayer({ c0t0s0: 'M1', c0t0s1: 'M2' }, 'M1'), { c0t0s1: 'M2' })
assert.deepEqual(removePlayer({ c0t0s0: 'M1' }, 'M9'), { c0t0s0: 'M1' }, 'bỏ người không ở sân thì không đổi')

/* ---------- 5 chế độ xếp ---------- */
const sess = S('B7') // 2 sân, 8 chỗ, 16 người
const players = p7
const lvOf = (key) => (players.find((p) => p.key === key) || {}).level

for (const mode of ['balance', 'fewest', 'rest', 'same', 'random']) {
  const { lineup, count } = arrange({ players, session: sess, mode, stats: {} })
  assert.equal(count, Object.keys(lineup).length)
  assert.ok(count <= 8, mode + ': không xếp quá số chỗ')
  assert.equal(count, 8, mode + ': 16 người / 8 chỗ thì phải đầy sân')
  const keys = Object.values(lineup)
  assert.equal(new Set(keys).size, keys.length, mode + ': không ai đứng hai ô')
  assert.ok(
    Object.keys(lineup).every((sl) => slotIds(sess).includes(sl)),
    mode + ': chỉ dùng slot của sân còn chơi'
  )
  assert.ok(keys.every((k) => players.some((p) => p.key === k)), mode + ': chỉ xếp người trong buổi')
}

// balance: trong mỗi đôi, ghép người mạnh với người nhẹ → chênh lệch trình độ trong đôi phải LỚN
const bal = arrange({ players, session: sess, mode: 'balance', stats: {} }).lineup
const pairGap = (a, b) => Math.abs(levelIdx(lvOf(bal[a])) - levelIdx(lvOf(bal[b])))
const gapTop = pairGap('c0t0s0', 'c0t0s1')
assert.ok(gapTop >= 1, 'đôi đầu tiên phải ghép mạnh nhất với nhẹ nhất')
// và hai bên lưới của sân 0 phải cân nhau
assert.equal(courtBalance(bal, 0, lvOf).text, 'Hai bên cân trình độ')

// same: mỗi sân là một mặt bằng trình độ → sân 0 (4 người khoẻ nhất) mạnh hơn sân 1
const same = arrange({ players, session: sess, mode: 'same', stats: {} }).lineup
const avgCourt = (ci, l) =>
  courtSlotIds(ci).map((s) => l[s]).filter(Boolean).map((k) => levelIdx(lvOf(k)))
    .reduce((t, x, _, arr) => t + x / arr.length, 0)
assert.ok(avgCourt(0, same) >= avgCourt(1, same), 'sân đầu gom người trình độ cao nhất')

// fewest: ai ít trận nhất lên sân trước
const few = arrange({
  players, session: sess, mode: 'fewest',
  stats: { M1: { n: 5, min: 100 }, M2: { n: 5, min: 100 }, M3: { n: 4, min: 80 } },
}).lineup
assert.ok(!Object.values(few).includes('M1'), 'người đánh 5 trận phải nhường chỗ')
assert.ok(!Object.values(few).includes('M2'))

// rest: GIỮ NGUYÊN người đang trên sân, chỉ điền ô trống
const current = { c0t0s0: 'M7', c0t0s1: 'M8' }
const rest = arrange({ players, session: sess, mode: 'rest', stats: {}, current }).lineup
assert.equal(rest.c0t0s0, 'M7', 'người đang đánh không bị đẩy đi')
assert.equal(rest.c0t0s1, 'M8')
assert.equal(Object.keys(rest).length, 8)
assert.equal(Object.values(rest).filter((k) => k === 'M7').length, 1, 'không nhân bản người đang ở sân')

/* ---------- ít người hơn số chỗ ---------- */
const fourOnly = players.slice(0, 4)
const small = arrange({ players: fourOnly, session: sess, mode: 'balance', stats: {} })
assert.equal(small.count, 4, '4 người thì chỉ điền 4 ô, không nhân bản để cho đủ')
const oneOnly = arrange({ players: players.slice(0, 1), session: sess, mode: 'balance', stats: {} })
assert.equal(oneOnly.count, 1, 'người lẻ vẫn được đặt một mình')
const noneAtAll = arrange({ players: [], session: sess, mode: 'balance', stats: {} })
assert.equal(noneAtAll.count, 0)

/* ---------- chế độ cố định người theo sân ---------- */
const cg = autoSplit(players, [0, 1])
assert.equal(Object.keys(cg).length, players.length, 'mọi người đều được chia vào một sân')
assert.deepEqual([...new Set(Object.values(cg))].sort(), [0, 1])
const c0 = Object.keys(cg).filter((k) => cg[k] === 0)
const c1 = Object.keys(cg).filter((k) => cg[k] === 1)
assert.ok(Math.abs(c0.length - c1.length) <= 1, 'chia đều số người giữa các sân')
// serpentine: trình độ trung bình hai sân phải gần nhau
const avgOf = (keys) => keys.map((k) => levelIdx(lvOf(k))).reduce((t, x, _, a) => t + x / a.length, 0)
assert.ok(Math.abs(avgOf(c0) - avgOf(c1)) < 0.75, 'chia serpentine thì hai sân cân trình độ')

// groupMode: người của sân 0 KHÔNG được xếp sang sân 1
const gm = arrange({ players, session: sess, mode: 'fewest', stats: {}, groupMode: true, courtGroups: cg }).lineup
Object.keys(gm).forEach((slot) => {
  assert.equal(cg[gm[slot]], slotCourtIdx(slot), 'người bị xếp sang sân khác — sai chế độ cố định theo sân')
})
// autoSplit với 3 sân
const cg3 = autoSplit(players, [0, 1, 2])
assert.deepEqual([...new Set(Object.values(cg3))].sort(), [0, 1, 2])

/* ---------- cân trình độ hai bên lưới ---------- */
assert.equal(courtBalance({}, 0, lvOf).text, 'Chưa đủ 4 người')
assert.equal(courtBalance({ c0t0s0: 'M1', c0t0s1: 'M2' }, 0, lvOf).text, 'Chưa đủ 4 người',
  'một bên trống thì chưa đánh giá được')
// M7 (TB) + M12 (TB) vs M5 (Newbie) + M18 (Newbie) → lệch rõ
const skew = { c0t0s0: 'M7', c0t0s1: 'M12', c0t1s0: 'M5', c0t1s1: 'M18' }
const lvAll = (key) => (db.members.find((x) => x.id === key) || {}).level
assert.equal(courtBalance(skew, 0, lvAll).text, 'Lệch trình độ giữa hai bên')
// TB + Newbie vs TB- + TBY → trung bình gần nhau
const even = { c0t0s0: 'M7', c0t0s1: 'M5', c0t1s0: 'M9', c0t1s1: 'M14' }
assert.equal(courtBalance(even, 0, lvAll).text, 'Hai bên cân trình độ')

/* ---------- đánh giá độ đều lượt ---------- */
assert.equal(fairness([], {}).tone, 'muted')
assert.equal(fairness(players, {}).tone, 'muted', 'chưa ghi trận nào thì nhắc bấm Xong trận')
const evenStats = {}
players.forEach((p) => { evenStats[p.key] = { n: 2, min: 40 } })
assert.equal(fairness(players, evenStats).tone, 'ok')
assert.match(fairness(players, evenStats).text, /2–2 trận/)
evenStats[players[0].key] = { n: 3, min: 60 }
assert.equal(fairness(players, evenStats).tone, 'ok', 'lệch 1 trận vẫn coi là đều')
evenStats[players[1].key] = { n: 5, min: 100 }
const warn = fairness(players, evenStats)
assert.equal(warn.tone, 'warn')
assert.match(warn.text, /nhiều nhất 5 trận, ít nhất 2 trận/)

console.log('assign check: OK')
