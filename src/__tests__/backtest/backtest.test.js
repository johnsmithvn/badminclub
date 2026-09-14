import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { runBacktest, diffBacktest, datasetToDb } from '#lib/backtest.js'

/**
 * Backtest — chạy lại lịch sử trận thật qua công thức hiện hành.
 *
 * Hai việc được khoá ở đây:
 *   1. Bản thân bộ máy backtest phải ĐÚNG và TẤT ĐỊNH — chạy hai lần ra hai kết quả thì nó
 *      không gác được gì cả.
 *   2. Mọi bộ dữ liệu trong `data/` phải khớp mốc trong `baseline/`. Đổi công thức Elo hay
 *      thang điểm mùa là test này ĐỎ — và đó là chủ đích: bắt người sửa phải nhìn vào đúng
 *      con số mình vừa làm đổi, rồi cập nhật mốc một cách có ý thức.
 */

const DATA_DIR = new URL('./data/', import.meta.url)
const BASE_DIR = new URL('./baseline/', import.meta.url)

const mkBackup = () => ({
  schema: 'badminclub_matches',
  version: 1,
  clubCode: 'T1',
  matches: [
    {
      id: 'm1', sessionId: 's1', at: 1000, minutes: 20, sets: [[21, 15]], winnerTeam: 'A',
      ratingEnabled: true, playerKeys: ['p1', 'p2', 'p3', 'p4'],
    },
    {
      id: 'm2', sessionId: 's1', at: 2000, minutes: 20, sets: [[15, 21]], winnerTeam: 'B',
      ratingEnabled: true, playerKeys: ['p1', 'p3', 'p2', 'p4'],
    },
  ],
  ref: {
    levels: ['Y', 'TB', 'Khá'],
    members: [
      { id: 'p1', name: 'A', level: 'Khá', gender: 'nam', active: true },
      { id: 'p2', name: 'B', level: 'TB', gender: 'nam', active: true },
      { id: 'p3', name: 'C', level: 'TB', gender: 'nu', active: true },
      { id: 'p4', name: 'D', level: 'Y', gender: 'nu', active: true },
    ],
    guests: [],
    sessions: [{ id: 's1', date: '2026-08-01' }],
  },
})

test('Bộ máy backtest', async (t) => {
  await t.test('1. Chạy hai lần trên cùng dữ liệu phải ra y hệt nhau', () => {
    // Engine có chỗ phụ thuộc thứ tự (sàn 0 kẹp sau mỗi trận). Thiếu tie-break theo id thì hai
    // trận trùng mốc thời gian đảo chỗ nhau, và cả bộ số nhảy — backtest thành vô dụng.
    const a = runBacktest(mkBackup())
    const b = runBacktest(mkBackup())
    assert.deepEqual(a, b, 'Backtest không tất định thì không gác được thay đổi công thức nào')
    assert.equal(diffBacktest(a, b).identical, true)
  })

  await t.test('2. Trận trùng mốc thời gian vẫn cho kết quả ổn định', () => {
    const backup = mkBackup()
    backup.matches[0].at = 1000
    backup.matches[1].at = 1000 // cùng mili-giây
    const a = runBacktest(backup)
    const b = runBacktest(JSON.parse(JSON.stringify(backup)))
    assert.deepEqual(a.elo, b.elo, 'Hai sân bấm lưu cùng lúc không được làm bộ số nhảy giữa các lần chạy')
  })

  await t.test('3. Seed lấy theo trình độ, khách không tích luỹ Elo', () => {
    const backup = mkBackup()
    backup.ref.guests = [{ id: 'g1', name: 'Khách', level: 'Khá', gender: 'nam' }]
    backup.matches = [{
      id: 'm1', sessionId: 's1', at: 1000, minutes: 20, sets: [[21, 10]], winnerTeam: 'A',
      ratingEnabled: true, playerKeys: ['p1', 'g1', 'p3', 'p4'],
    }]
    const snap = runBacktest(backup)
    assert.equal(snap.elo.find((x) => x.id === 'p1').seed, 800, 'Khá = 800 theo levelInitialRatings')
    assert.equal(snap.elo.find((x) => x.id === 'p4').seed, 200, 'Y = 200')
    assert.equal(snap.elo.some((x) => x.id === 'g1'), false, 'Khách không có dòng Elo — bảng xếp hạng chỉ của hội viên')
  })

  await t.test('4. Trận giao lưu không đụng vào Elo', () => {
    const backup = mkBackup()
    backup.matches.forEach((m) => { m.ratingEnabled = false })
    const snap = runBacktest(backup)
    snap.elo.forEach((r) => assert.equal(r.rating, r.seed, `${r.name} đổi Elo trong khi mọi trận đều là giao lưu`))
  })

  await t.test('5. datasetToDb KHÔNG bịa điểm danh', () => {
    // File sao lưu không chứa điểm danh. Dựng bừa ra là mọi phép đo công bằng sau này đều sai.
    const db = datasetToDb(mkBackup())
    assert.deepEqual(db.attendance, {}, 'Bịa điểm danh là đo công bằng trên dữ liệu tưởng tượng')
    assert.equal(db.matches[0].teamA.length, 2, 'Hai ô đầu là một bên lưới')
    assert.equal(db.matches[0].teamB.length, 2)
  })

  await t.test('6. diffBacktest chỉ ra đúng người và đúng con số đã đổi', () => {
    const before = runBacktest(mkBackup())
    const after = JSON.parse(JSON.stringify(before))
    after.elo[0].rating += 25
    after.stats.eloDrift += 25

    const d = diffBacktest(before, after)
    assert.equal(d.identical, false)
    assert.equal(d.elo.length, 1, 'Chỉ một người đổi thì chỉ được báo một người')
    assert.equal(d.elo[0].changed.rating.delta, 25)
    assert.ok(d.stats.some((s) => s.key === 'eloDrift' && s.delta === 25))
  })

  await t.test('7. Chỉ số sức khoẻ đo đúng thứ cần đo', () => {
    const snap = runBacktest(mkBackup())
    assert.equal(typeof snap.stats.eloDrift, 'number', 'Elo chuẩn là hệ tổng-bằng-không; lệch 0 nhiều là engine tự sinh điểm')
    assert.equal(typeof snap.stats.clampGainTotal, 'number', 'Sàn 0 tạo điểm từ hư không — số này phải = 0 thì thang điểm mới replay được')
    assert.ok(snap.stats.pairGapMedian >= 0)
  })
})

test('Sao lưu bản 2 — điểm danh, sân của buổi, khách theo buổi', async (t) => {
  const v2 = () => {
    const b = mkBackup()
    b.version = 2
    b.ref.sessions = [{
      id: 's1', date: '2026-08-01', status: 'closed',
      courts: [{ from: '18:00', to: '20:00', sold: false }, { from: '18:00', to: '20:00', sold: true }],
    }]
    // p1..p3 có mặt, p4 báo vắng
    b.ref.attendance = { s1: { p1: true, p2: true, p3: true, p4: false } }
    b.ref.sessionGuests = []
    return b
  }

  await t.test('8. Có điểm danh thì mới đo được công bằng lượt đánh', () => {
    const v1 = runBacktest(mkBackup())
    assert.equal(v1.stats.attendanceKnown, false, 'Bản 1 không có điểm danh')
    assert.equal(v1.stats.debtSpread, null, 'Thiếu dữ liệu phải trả null — trả 0 thì đọc nhầm thành "đã đo, không lệch"')

    const snap = runBacktest(v2())
    assert.equal(snap.stats.attendanceKnown, true)
    assert.equal(typeof snap.stats.debtSpread, 'number', 'Có điểm danh rồi thì phải ra được độ lệch lượt đánh')
  })

  await t.test('9. Người báo vắng không được tính vào công bằng của buổi', () => {
    const b = v2()
    // p4 vắng nhưng vẫn dính trong trận (dữ liệu lệch) — không được kéo fairShare của người khác
    const snap = runBacktest(b)
    assert.ok(snap.stats.debtSpread !== null)
    assert.equal(snap.stats.seatsPerSession, 1, 'Sân đã bán không sinh lượt nào, chỉ còn 1 sân chạy')
  })

  await t.test('10. Thêm điểm danh KHÔNG được làm đổi Elo hay điểm mùa', () => {
    // Điểm danh chỉ dùng để đo công bằng. Nếu nó lọt vào Elo hoặc điểm mùa thì mọi mốc cũ
    // thành vô giá trị, và không ai biết con số nào mới là đúng.
    const a = runBacktest(mkBackup())
    const b = runBacktest(v2())
    assert.deepEqual(a.elo, b.elo, 'Điểm danh làm đổi Elo là sai tầng — Elo chỉ sinh từ kết quả trận')
    assert.deepEqual(a.season, b.season, 'Điểm danh hiện KHÔNG cộng vào điểm mùa; đổi luật này phải là quyết định có ý thức')
  })

  await t.test('11. File bản mới hơn bị validateMatchBackup từ chối, bản cũ vẫn đọc được', async () => {
    const { validateMatchBackup, MATCH_BACKUP_VERSION } = await import('#lib/matchBackup.js')
    assert.equal(MATCH_BACKUP_VERSION, 2)
    const db = { matches: [], sessions: [{ id: 's1' }], members: [{ id: 'p1' }, { id: 'p2' }], guests: [] }
    const v1file = { ...mkBackup(), version: 1, matches: [{ id: 'm', sessionId: 's1', playerKeys: ['p1', 'p2'] }] }
    assert.equal(validateMatchBackup(v1file, db).ok, true, 'Bản 1 phải nhập được vào app bản mới')
    assert.equal(validateMatchBackup({ ...v1file, version: 3 }, db).error, 'matchIo.errVersion')
  })
})

test('Mốc backtest — đổi công thức là test này ĐỎ (đúng chủ đích)', async (t) => {
  const files = existsSync(DATA_DIR) ? readdirSync(DATA_DIR).filter((f) => f.endsWith('.json')) : []

  if (!files.length) {
    await t.test('(chưa có bộ dữ liệu nào trong data/)', () => { assert.ok(true) })
    return
  }

  for (const f of files) {
    await t.test(`${f} khớp mốc`, () => {
      const baseUrl = new URL(f, BASE_DIR)
      assert.ok(
        existsSync(baseUrl),
        `Thiếu mốc cho ${f}. Chạy: npm run backtest -- src/__tests__/backtest/data/${f} --save src/__tests__/backtest/baseline/${f}`
      )
      const snap = runBacktest(JSON.parse(readFileSync(new URL(f, DATA_DIR), 'utf8')))
      const base = JSON.parse(readFileSync(baseUrl, 'utf8'))
      const d = diffBacktest(base, snap)

      const lines = [
        ...d.stats.map((s) => `  chỉ số ${s.key}: ${JSON.stringify(s.before)} → ${JSON.stringify(s.after)}`),
        ...d.elo.slice(0, 8).map((r) => `  Elo ${r.name}: ${Object.entries(r.changed).map(([k, v]) => `${k} ${v.before}→${v.after}`).join(', ')}`),
        ...d.season.slice(0, 8).map((r) => `  Điểm ${r.name}: ${Object.entries(r.changed).map(([k, v]) => `${k} ${v.before}→${v.after}`).join(', ')}`),
      ]

      assert.ok(
        d.identical,
        `Công thức Elo hoặc thang điểm mùa vừa đổi — bộ số trên dữ liệu thật đã khác mốc.\n` +
        `Đây KHÔNG phải lỗi cần sửa cho xanh: đọc từng dòng dưới đây, xác nhận đúng ý đồ,\n` +
        `rồi mới cập nhật mốc bằng --save. Cập nhật mốc mà không đọc là mất luôn tác dụng gác.\n` +
        lines.join('\n') +
        (d.elo.length > 8 || d.season.length > 8 ? `\n  … và ${d.elo.length + d.season.length - 16} dòng nữa` : '')
      )
    })
  }
})
